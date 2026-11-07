package dev.xattribution.spoolup

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Socket

/**
 * One full-screen WebView that shows either the app's launch page (the PCs found on the
 * network and the ones opened before, an address field, the QR scanner) or the deck the PC
 * serves, exactly as a browser would get it. The screen stays on the whole time.
 */
class MainActivity : ComponentActivity() {
    lateinit var haptics: Haptics
        private set
    private lateinit var prefs: Prefs
    private lateinit var discovery: Discovery

    private val main = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private var web: WebView? = null
    private val deckBridge by lazy { DeckBridge(this) }
    private val launchBridge by lazy { LaunchBridge(this) }

    private enum class Mode { LAUNCH, LOADING, DECK }

    private var mode = Mode.LAUNCH
    /** Read by the launch page's bridge on the JavaBridge thread. */
    @Volatile var onLaunchPage = false
        private set
    /** What to reload if the renderer dies. */
    private var currentUrl = LAUNCH_URL
    /** The PC being connected to or shown. */
    private var target: Pc? = null
    private var loadFailed = false
    /** Bumped to cancel a reachability probe in flight. */
    @Volatile private var attempt = 0
    private var ready = false

    private val scanner = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val text = result.data?.getStringExtra(ScanActivity.EXTRA_TEXT)
        if (result.resultCode == RESULT_OK && text != null) callPage("scanned", launchBridge.parse(text))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !ready }
        main.postDelayed({ ready = true }, 1200)

        prefs = Prefs(this)
        discovery = Discovery(this) { pcs -> onFound(pcs) }

        // The deck is a control panel next to a game: the screen never dims or locks on it.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        root = FrameLayout(this).apply { setBackgroundColor(BG) }
        setContentView(root)
        haptics = Haptics(this, root)
        // Full screen behind the bars, but the deck's buttons stay clear of a camera cutout,
        // and the keyboard (for the address field) pushes the page up.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(cut.left, cut.top, cut.right, maxOf(cut.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        newWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = handleBack()
        })

        val last = prefs.lastUsed()
        if (last != null && savedInstanceState == null) {
            showLaunch("connecting=" + Uri.encode(last.name) + "&addr=" + Uri.encode(last.address))
            probeAndLoad(last, null)
        } else {
            showLaunch(null)
        }
    }

    // ---------- WebView ----------

    @SuppressLint("SetJavaScriptEnabled")
    private fun newWebView() {
        val w = WebView(this)
        w.setBackgroundColor(BG)
        w.overScrollMode = View.OVER_SCROLL_NEVER
        w.isVerticalScrollBarEnabled = false
        w.isHorizontalScrollBarEnabled = false
        w.isHapticFeedbackEnabled = false
        w.isLongClickable = false
        w.setOnLongClickListener { true } // no text-selection or link menus on the deck
        w.defaultFocusHighlightEnabled = false
        w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // the deck keeps its pairing code and settings there
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
            useWideViewPort = true
            loadWithOverviewMode = false
            allowFileAccess = false
            allowContentAccess = false
            setGeolocationEnabled(false)
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            userAgentString = "$userAgentString SpoolUpAndroid/${BuildConfig.VERSION_NAME}"
        }
        w.addJavascriptInterface(deckBridge, "SpoolUpApp")
        w.webChromeClient = WebChromeClient()
        w.webViewClient = Client()
        root.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = w
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if (url.toString().startsWith(LAUNCH_URL)) return mode != Mode.LAUNCH
            val t = target
            if (t != null && mode != Mode.LAUNCH && url.scheme == "http" && sameHost(url, t)) return false
            // Anything else (the website, GitHub, a link on the PC) opens in the browser.
            try {
                startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: ActivityNotFoundException) {
            }
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            loadFailed = false
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (url.startsWith(LAUNCH_URL)) {
                ready = true
                view.clearHistory()
                return
            }
            if (mode == Mode.LOADING && !loadFailed) {
                mode = Mode.DECK
                target?.let { pc ->
                    prefs.use(pc)
                    // The code went in once; a reload asks the deck's own storage, so a newer
                    // code typed on the deck isn't overridden by the one in the address.
                    currentUrl = PcAddress(pc.host, pc.port).deckUrl()
                }
                discovery.stop()
                view.clearHistory()
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame || mode == Mode.LAUNCH) return
            loadFailed = true
            val t = target ?: return showLaunch(null)
            if (mode == Mode.LOADING) {
                // The port answered but the page didn't load: say so rather than retrying forever.
                showLaunch("error=" + Uri.encode(t.name) + "&addr=" + Uri.encode(t.address))
                return
            }
            // The deck lost the PC (SpoolUp closed, or the PC moved): back to the list, still trying it.
            showLaunch("connecting=" + Uri.encode(t.name) + "&addr=" + Uri.encode(t.address))
            probeAndLoad(t, null)
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The renderer crashed or was killed for memory: a new WebView, and the same page again.
            root.removeView(view)
            if (web === view) web = null
            view.destroy()
            newWebView()
            if (mode == Mode.LAUNCH) web?.addJavascriptInterface(launchBridge, "SpoolUpLaunch")
            web?.loadUrl(currentUrl)
            return true
        }
    }

    private fun sameHost(url: Uri, pc: Pc): Boolean {
        val port = if (url.port == -1) 80 else url.port
        return url.host.equals(pc.host, ignoreCase = true) && port == pc.port
    }

    private fun callPage(fn: String, json: String) {
        if (mode == Mode.LAUNCH) web?.evaluateJavascript("window.spoolUp&&window.spoolUp.$fn($json)", null)
    }

    // ---------- the launch page ----------

    fun showLaunch(hash: String?) {
        attempt++
        mode = Mode.LAUNCH
        onLaunchPage = true
        currentUrl = if (hash.isNullOrEmpty()) LAUNCH_URL else "$LAUNCH_URL#$hash"
        web?.let {
            it.stopLoading()
            it.addJavascriptInterface(launchBridge, "SpoolUpLaunch")
            it.loadUrl(currentUrl)
        }
        discovery.start()
    }

    fun launchState(): String = JSONObject()
        .put("version", BuildConfig.VERSION_NAME)
        .put("found", Pc.listJson(discovery.snapshot()))
        .put("saved", Pc.listJson(prefs.saved()))
        .toString()

    private fun onFound(pcs: List<Pc>) {
        // Follow saved PCs to a new address (DHCP gave the PC another one).
        for (pc in pcs) prefs.update(pc)
        callPage("update", launchState())
    }

    fun scan() = scanner.launch(Intent(this, ScanActivity::class.java))

    fun forget(host: String, port: Int) {
        prefs.forget(host, port)
        callPage("update", launchState())
    }

    // ---------- connecting ----------

    /** From the launch page: the player picked a PC, typed an address or scanned a QR code. */
    fun connect(pc: Pc, code: String?) {
        if (mode != Mode.LAUNCH) showLaunch("connecting=" + Uri.encode(pc.name) + "&addr=" + Uri.encode(pc.address))
        probeAndLoad(pc, code)
    }

    fun cancelConnect() {
        attempt++
        target = null
    }

    /**
     * Checks the PC answers on its port before the WebView loads it, so a PC that's off shows
     * a clear message instead of a browser error page. Tries for a while, and follows the PC
     * to a new address if discovery finds it somewhere else meanwhile.
     */
    private fun probeAndLoad(pc: Pc, code: String?) {
        val my = ++attempt
        target = pc
        discovery.start()
        Thread({
            val deadline = SystemClock.elapsedRealtime() + PROBE_WINDOW_MS
            var t = pc
            while (attempt == my) {
                if (t.service.isNotEmpty()) {
                    val seen = discovery.find(t.service)
                    if (seen != null && (seen.host != t.host || seen.port != t.port)) t = t.copy(host = seen.host, port = seen.port)
                }
                if (reachable(t)) {
                    val found = t
                    main.post { if (attempt == my) loadDeck(found, code) }
                    return@Thread
                }
                if (SystemClock.elapsedRealtime() > deadline) {
                    val lost = t
                    main.post { if (attempt == my) connectFailed(lost) }
                    return@Thread
                }
                try { Thread.sleep(700) } catch (_: InterruptedException) { return@Thread }
            }
        }, "spoolup-probe").apply { isDaemon = true }.start()
    }

    private fun reachable(pc: Pc): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(pc.host, pc.port), PROBE_TIMEOUT_MS); true }
    } catch (_: Exception) {
        false
    }

    private fun loadDeck(pc: Pc, code: String?) {
        target = pc
        mode = Mode.LOADING
        onLaunchPage = false
        currentUrl = PcAddress(pc.host, pc.port, code).deckUrl()
        web?.let {
            // The launch page's calls aren't for the PC's pages.
            it.removeJavascriptInterface("SpoolUpLaunch")
            it.loadUrl(currentUrl)
        }
    }

    private fun connectFailed(pc: Pc) {
        val msg = JSONObject().put("name", pc.name).put("addr", pc.address).toString()
        if (mode == Mode.LAUNCH) callPage("failed", msg)
        else showLaunch("error=" + Uri.encode(pc.name) + "&addr=" + Uri.encode(pc.address))
    }

    // ---------- back, immersive, lifecycle ----------

    /** On the launch page, the page goes back a step first; on the deck, the app goes to the background. */
    private fun handleBack() {
        val w = web
        if (w == null || mode != Mode.LAUNCH) { moveTaskToBack(true); return }
        w.evaluateJavascript(BACK_JS) { r -> if (r != "true") moveTaskToBack(true) }
    }

    private fun hideBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    override fun onResume() {
        super.onResume()
        hideBars()
        web?.onResume()
        if (mode == Mode.LAUNCH) discovery.start()
    }

    override fun onPause() {
        web?.onPause()
        discovery.stop()
        super.onPause()
    }

    override fun onDestroy() {
        attempt++
        discovery.stop()
        haptics.release()
        web?.let { root.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }

    private companion object {
        const val LAUNCH_URL = "file:///android_asset/launch/index.html"
        const val BG = 0xFF05090F.toInt()
        const val PROBE_TIMEOUT_MS = 2500
        const val PROBE_WINDOW_MS = 12_000L
        const val BACK_JS = "(function(){try{var a=window.spoolUp;return !!(a&&a.back&&a.back())}catch(e){return false}})()"
    }
}
