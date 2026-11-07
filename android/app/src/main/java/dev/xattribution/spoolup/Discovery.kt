package dev.xattribution.spoolup

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.net.Inet4Address
import java.net.InetAddress

/**
 * Finds SpoolUp PCs on the home network with Android's DNS-SD browser (NsdManager): the PC's
 * server answers for `_spoolup._tcp` (discovery.js) with its name, port, version and address,
 * never the pairing code. Only browses while the list of PCs is on screen.
 *
 * Found PCs resolve one at a time, since Android before 14 refuses a second resolve while one
 * is running. Only home network IPv4 addresses are kept ([PcAddress.isLocal]).
 */
class Discovery(context: Context, private val onChange: (List<Pc>) -> Unit) {
    private val nsd = context.applicationContext.getSystemService(NsdManager::class.java)
    private val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
    private val main = Handler(Looper.getMainLooper())

    /** Found and resolved, by service name. Written on the main thread; read from any. */
    private val found = LinkedHashMap<String, Pc>()
    private val toResolve = ArrayDeque<NsdServiceInfo>()
    private var resolving = false
    private var listener: NsdManager.DiscoveryListener? = null
    private var lock: WifiManager.MulticastLock? = null
    /** Bumped on every start and stop, so callbacks from an old browse are dropped. */
    private var generation = 0

    val running: Boolean get() = listener != null

    fun start() {
        if (listener != null || nsd == null) return
        val gen = ++generation
        // A fresh browse reports every PC still there; one that left meanwhile drops off.
        synchronized(found) { found.clear() }
        lock = try {
            wifi?.createMulticastLock("spoolup-discovery")?.apply { setReferenceCounted(false); acquire() }
        } catch (e: RuntimeException) {
            null
        }
        val l = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                main.post {
                    if (gen != generation) return@post
                    listener = null
                    // Wi-Fi coming up, or the system service busy: try again shortly.
                    main.postDelayed({ if (gen == generation) start() }, RETRY_MS)
                }
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceFound(info: NsdServiceInfo) {
                main.post { if (gen == generation) queue(info) }
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                main.post {
                    if (gen != generation) return@post
                    toResolve.removeAll { it.serviceName == info.serviceName }
                    if (synchronized(found) { found.remove(info.serviceName) } != null) publish()
                }
            }
        }
        listener = l
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, l)
        } catch (e: RuntimeException) {
            listener = null
        }
    }

    fun stop() {
        generation++
        val l = listener
        listener = null
        if (l != null) try { nsd?.stopServiceDiscovery(l) } catch (e: RuntimeException) { /* never started */ }
        toResolve.clear()
        resolving = false
        try { lock?.release() } catch (e: RuntimeException) { /* already released */ }
        lock = null
    }

    /** PCs found so far, by name. Any thread. */
    fun snapshot(): List<Pc> = synchronized(found) { found.values.sortedBy { it.name.lowercase() } }

    /** Any thread. */
    fun find(service: String): Pc? = synchronized(found) { found[service] }

    private fun queue(info: NsdServiceInfo) {
        if (toResolve.none { it.serviceName == info.serviceName }) toResolve.addLast(info)
        next()
    }

    @Suppress("DEPRECATION") // resolveService: its replacement (registerServiceInfoCallback) is Android 14+ only.
    private fun next() {
        if (resolving || listener == null) return
        val info = toResolve.removeFirstOrNull() ?: return
        resolving = true
        val gen = generation
        val done = { pc: Pc? ->
            main.post {
                if (gen != generation) return@post
                resolving = false
                if (pc != null && synchronized(found) { found.put(pc.service, pc) } != pc) publish()
                next()
            }
            Unit
        }
        try {
            nsd!!.resolveService(info, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    // Busy: put it back and try again in a moment.
                    if (errorCode == NsdManager.FAILURE_ALREADY_ACTIVE) main.postDelayed({ if (gen == generation) queue(info) }, 400)
                    done(null)
                }
                override fun onServiceResolved(serviceInfo: NsdServiceInfo) = done(toPc(serviceInfo))
            })
        } catch (e: RuntimeException) {
            done(null)
        }
    }

    private fun publish() = onChange(snapshot())

    companion object {
        const val SERVICE_TYPE = "_spoolup._tcp"
        private const val RETRY_MS = 3000L

        /** A resolved service as a PC, or null when it isn't a usable home network address. */
        fun toPc(info: NsdServiceInfo): Pc? {
            val ip = addressesOf(info).firstOrNull { it is Inet4Address }?.hostAddress ?: return null
            return fromRecords(info.serviceName.orEmpty(), ip, info.port, attributesOf(info))
        }

        /** The records' parts as a PC: the TXT `name` (else the service name) and `v`. */
        fun fromRecords(service: String, ip: String, port: Int, txt: Map<String, String>): Pc? {
            if (!PcAddress.isLocal(ip) || PcAddress.ipv4Octets(ip) == null || port !in PcAddress.PORTS) return null
            if (service.isEmpty() || service.length > Pc.MAX_SERVICE) return null
            val name = txt["name"]?.trim()?.take(Pc.MAX_NAME)?.ifEmpty { null } ?: service
            return Pc(name = name, host = ip, port = port, service = service, version = txt["v"]?.trim()?.take(24).orEmpty())
        }

        @Suppress("DEPRECATION")
        private fun addressesOf(info: NsdServiceInfo): List<InetAddress> =
            if (Build.VERSION.SDK_INT >= 34) info.hostAddresses else listOfNotNull(info.host)

        private fun attributesOf(info: NsdServiceInfo): Map<String, String> =
            info.attributes.orEmpty().mapValues { (_, v) -> v?.toString(Charsets.UTF_8).orEmpty() }
    }
}
