package dev.xattribution.spoolup

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads the QR code the SpoolUp window on the PC shows (`http://192.168.1.20:8765/?t=1a2b3c4d`)
 * with the camera, on the device only (CameraX and ZXing; no image leaves the phone), and
 * hands the text back to MainActivity. A code that isn't a home network SpoolUp address is
 * ignored with a note, and scanning goes on.
 */
class ScanActivity : ComponentActivity() {
    private lateinit var preview: PreviewView
    private lateinit var note: TextView
    private var camera: ProcessCameraProvider? = null
    private val worker: ExecutorService = Executors.newSingleThreadExecutor()
    private val done = AtomicBoolean(false)
    private val reader = MultiFormatReader().apply {
        setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE), DecodeHintType.TRY_HARDER to true))
    }
    private var lastBadText = ""

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera() else note.setText(R.string.scan_no_camera)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(GROUND) }
        preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
        root.addView(preview, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(PANEL)
            val pad = dp(16)
            setPadding(pad, pad, pad, pad)
        }
        note = TextView(this).apply {
            setText(R.string.scan_hint)
            setTextColor(INK)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            gravity = Gravity.CENTER
        }
        panel.addView(note, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val cancel = Button(this).apply {
            setText(R.string.scan_cancel)
            setTextColor(INK)
            isAllCaps = true
            minHeight = dp(48)
            background = GradientDrawable().apply { cornerRadius = dp(4).toFloat(); setStroke(dp(1), LINE); setColor(PANEL) }
            setOnClickListener { finish() }
        }
        panel.addView(cancel, LinearLayout.LayoutParams(dp(200), ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) })
        root.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            panel.setPadding(dp(16) + bars.left, dp(16), dp(16) + bars.right, dp(16) + bars.bottom)
            insets
        }
        setContentView(root)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
        else askCamera.launch(Manifest.permission.CAMERA)
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = try { future.get() } catch (e: Exception) { note.setText(R.string.scan_no_camera); return@addListener }
            camera = provider
            val shown = Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(worker, ::analyze) }
            try {
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, shown, analysis)
            } catch (e: Exception) {
                // No back camera (some tablets): try the front one.
                try {
                    provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, shown, analysis)
                } catch (e2: Exception) {
                    note.setText(R.string.scan_no_camera)
                }
            }
        }, ContextCompat.getMainExecutor(this))
    }

    /** One frame: the luminance plane is all ZXing needs. */
    private fun analyze(image: ImageProxy) {
        try {
            if (done.get()) return
            val plane = image.planes[0]
            val buf = plane.buffer
            // The last row can come without its padding: size the array for full rows.
            val bytes = ByteArray(maxOf(buf.remaining(), plane.rowStride * image.height)).also { buf.get(it, 0, buf.remaining()) }
            val source = PlanarYUVLuminanceSource(bytes, plane.rowStride, image.height, 0, 0, image.width, image.height, false)
            val text = try {
                reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text
            } catch (e: NotFoundException) {
                // The PC's window draws the code light on dark: try it inverted too.
                try { reader.decodeWithState(BinaryBitmap(HybridBinarizer(source.invert()))).text } catch (e2: NotFoundException) { null }
            } finally {
                reader.reset()
            } ?: return
            if (PcAddress.parse(text) is PcAddress.Result.Ok) {
                if (done.compareAndSet(false, true)) runOnUiThread {
                    setResult(RESULT_OK, Intent().putExtra(EXTRA_TEXT, text))
                    finish()
                }
            } else if (text != lastBadText) {
                lastBadText = text
                runOnUiThread { note.setText(R.string.scan_not_spoolup) }
            }
        } catch (e: Exception) {
            // A frame that can't be read: wait for the next one.
        } finally {
            image.close()
        }
    }

    override fun onDestroy() {
        camera?.unbindAll()
        worker.shutdown()
        super.onDestroy()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_TEXT = "text"
        private val GROUND = Color.rgb(0x05, 0x09, 0x0F)
        private val PANEL = Color.rgb(0x0B, 0x17, 0x26)
        private val LINE = Color.rgb(0x1F, 0x3A, 0x58)
        private val INK = Color.rgb(0xE8, 0xEE, 0xF5)
    }
}
