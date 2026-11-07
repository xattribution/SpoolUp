package dev.xattribution.spoolup

import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * `window.SpoolUpApp`, for the deck the PC serves: the same two calls the iOS app offers
 * (ios/SpoolUp/Bridge.swift). The deck checks for it before use (public/app.js), so the
 * browser deck never sees it. Nothing here presses a key; the deck still talks only to the
 * PC, through the server's pairing and focus checks.
 *
 * Methods run on the WebView's JavaBridge thread; anything that touches views hops to the
 * UI thread.
 */
class DeckBridge(private val activity: MainActivity) {
    /** `tick`, `tap`, `press`, `heavy` or `error`; unknown kinds are ignored. */
    @JavascriptInterface
    fun haptic(kind: String?) = activity.haptics.perform(kind)

    /** Leaves the deck for the app's list of PCs. */
    @JavascriptInterface
    fun switchPC() = activity.runOnUiThread { activity.showLaunch(null) }
}

/**
 * `window.SpoolUpLaunch`, for the app's own launch page (assets/launch/index.html) only:
 * MainActivity adds it before loading that page and removes it before loading a deck, and
 * every call checks the launch page is what's showing.
 */
class LaunchBridge(private val activity: MainActivity) {
    /** `{"version", "searching", "found": [...], "saved": [...]}`, each PC as [Pc.toJson]. */
    @JavascriptInterface
    fun state(): String = if (activity.onLaunchPage) activity.launchState() else "{}"

    /** Opens a PC's deck. [code] is the pairing code from a QR code, or "". */
    @JavascriptInterface
    fun open(host: String?, port: Int, code: String?, name: String?, service: String?) {
        if (!activity.onLaunchPage) return
        val h = host?.trim()?.lowercase().orEmpty()
        if (!PcAddress.isLocal(h) || port !in PcAddress.PORTS) return
        val pc = Pc(name?.trim().orEmpty().take(Pc.MAX_NAME).ifEmpty { h }, h, port, service.orEmpty().take(Pc.MAX_SERVICE))
        val c = code?.let(PcAddress::validCode)
        activity.runOnUiThread { activity.connect(pc, c) }
    }

    /**
     * Reads a typed address or a scanned link: `{"host","port","code"}` or `{"problem"}`
     * (empty, notHttp, notLocal, ipv6, badPort), so the page and the app agree on what's local.
     */
    @JavascriptInterface
    fun parse(text: String?): String = when (val r = PcAddress.parse(text)) {
        is PcAddress.Result.Ok -> JSONObject().put("host", r.address.host).put("port", r.address.port).put("code", r.address.code ?: "").toString()
        is PcAddress.Result.Bad -> JSONObject().put("problem", problemName(r.problem)).toString()
    }

    /** Opens the QR code scanner; the result comes back through `spoolUp.scanned(...)`. */
    @JavascriptInterface
    fun scan() {
        if (activity.onLaunchPage) activity.runOnUiThread { activity.scan() }
    }

    /** Stops trying to reach a PC. */
    @JavascriptInterface
    fun cancel() {
        if (activity.onLaunchPage) activity.runOnUiThread { activity.cancelConnect() }
    }

    @JavascriptInterface
    fun forget(host: String?, port: Int) {
        if (!activity.onLaunchPage || host == null) return
        activity.runOnUiThread { activity.forget(host, port) }
    }

    @JavascriptInterface
    fun haptic(kind: String?) = activity.haptics.perform(kind)

    companion object {
        fun problemName(p: PcAddress.Problem): String = when (p) {
            PcAddress.Problem.EMPTY -> "empty"
            PcAddress.Problem.NOT_HTTP -> "notHttp"
            PcAddress.Problem.NOT_LOCAL -> "notLocal"
            PcAddress.Problem.IPV6 -> "ipv6"
            PcAddress.Problem.BAD_PORT -> "badPort"
        }
    }
}
