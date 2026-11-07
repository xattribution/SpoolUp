package dev.xattribution.spoolup

import org.json.JSONArray
import org.json.JSONObject

/**
 * A SpoolUp PC: one found on the network, or one opened before. [service] is the name the
 * PC advertises over mDNS (discovery.js), so a saved PC can be followed to a new address.
 */
data class Pc(
    val name: String,
    val host: String,
    val port: Int,
    val service: String = "",
    val version: String = "",
    val lastUsed: Long = 0L,
) {
    /** "192.168.1.20:8765", as the PC's window shows it. */
    val address: String get() = "$host:$port"

    fun sameAs(o: Pc): Boolean =
        (host.equals(o.host, ignoreCase = true) && port == o.port) ||
            (service.isNotEmpty() && service == o.service)

    fun toJson(): JSONObject = JSONObject()
        .put("name", name).put("host", host).put("port", port)
        .put("service", service).put("version", version).put("lastUsed", lastUsed)

    companion object {
        fun fromJson(o: JSONObject): Pc? {
            val host = o.optString("host").trim().lowercase()
            val port = o.optInt("port", 0)
            if (!PcAddress.isLocal(host) || port !in PcAddress.PORTS) return null
            return Pc(
                name = o.optString("name").trim().take(MAX_NAME).ifEmpty { host },
                host = host,
                port = port,
                service = o.optString("service").take(MAX_SERVICE),
                version = o.optString("version").take(24),
                lastUsed = o.optLong("lastUsed", 0L),
            )
        }

        fun listJson(pcs: Collection<Pc>): JSONArray = JSONArray().apply { for (p in pcs) put(p.toJson()) }

        const val MAX_NAME = 63
        const val MAX_SERVICE = 63
    }
}

/**
 * Where a SpoolUp PC serves its deck, read from what the player typed (`192.168.1.20`,
 * `192.168.1.20:8765`, `gaming-pc.local`) or what the PC's QR code holds
 * (`http://192.168.1.20:8765/?t=1a2b3c4d`). The same rules as the iOS app's PCAddress:
 * only home network addresses, so the app never opens a site on the internet as a "PC".
 */
data class PcAddress(val host: String, val port: Int, val code: String? = null) {
    enum class Problem { EMPTY, NOT_HTTP, NOT_LOCAL, IPV6, BAD_PORT }

    sealed class Result {
        data class Ok(val address: PcAddress) : Result()
        data class Bad(val problem: Problem) : Result()
    }

    /** The deck's address; the pairing code goes in only when there is one (`?t=`). */
    fun deckUrl(): String = "http://$host:$port/" + (code?.let { "?t=$it" } ?: "")

    companion object {
        /** The server's default port (`config.port` in server.js). */
        const val DEFAULT_PORT = 8765
        val PORTS = 1024..65535

        fun parse(raw: String?): Result {
            var text = raw?.trim().orEmpty()
            if (text.isEmpty()) return Result.Bad(Problem.EMPTY)
            if ('[' in text) return Result.Bad(Problem.IPV6)
            val scheme = Regex("^([a-zA-Z][a-zA-Z0-9+.-]*)://").find(text)
            if (scheme != null) {
                if (!scheme.groupValues[1].equals("http", ignoreCase = true)) return Result.Bad(Problem.NOT_HTTP)
                text = text.substring(scheme.value.length)
            }
            val query = text.substringAfter('?', "").substringBefore('#')
            text = text.substringBefore('/').substringBefore('?').substringBefore('#')
            if ('@' in text) return Result.Bad(Problem.NOT_LOCAL)
            val colons = text.count { it == ':' }
            if (colons > 1) return Result.Bad(Problem.IPV6)
            var host = text.substringBefore(':').lowercase()
            if (host.endsWith('.')) host = host.dropLast(1)
            if (host.isEmpty()) return Result.Bad(Problem.EMPTY)
            if (!isLocal(host)) return Result.Bad(Problem.NOT_LOCAL)
            val port = if (colons == 1) {
                val p = text.substringAfter(':')
                if (p.isEmpty() || p.length > 5 || !p.all { it in '0'..'9' }) return Result.Bad(Problem.BAD_PORT)
                p.toInt()
            } else DEFAULT_PORT
            if (port !in PORTS) return Result.Bad(Problem.BAD_PORT)
            val code = query.split('&').firstOrNull { it.startsWith("t=") }?.substring(2)?.let(::validCode)
            return Result.Ok(PcAddress(host, port, code))
        }

        /** Pairing codes are what server.js accepts: 1 to 32 letters and digits, lowercase. */
        fun validCode(raw: String): String? {
            val code = raw.lowercase()
            return code.takeIf { it.length in 1..32 && it.all { c -> c in 'a'..'z' || c in '0'..'9' } }
        }

        /** Private IPv4 ranges, `.local` names and single-label names; never the device itself. */
        fun isLocal(host: String): Boolean {
            if (host == "localhost") return false
            val octets = ipv4Octets(host)
            if (octets != null) {
                val (a, b) = octets
                return a == 10 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 169 && b == 254)
            }
            // Something that looks like an IP address but isn't one (999.1.1.1, 1.2.3).
            if (host.isEmpty() || host.all { it in '0'..'9' || it == '.' }) return false
            val allowed = host.all { it in 'a'..'z' || it in '0'..'9' || it == '-' || it == '.' }
            if (!allowed || host.startsWith('.') || ".." in host) return false
            return '.' !in host || host.endsWith(".local")
        }

        fun ipv4Octets(host: String): List<Int>? {
            val pieces = host.split('.')
            if (pieces.size != 4) return null
            return pieces.map { p ->
                if (p.isEmpty() || p.length > 3 || !p.all { it in '0'..'9' }) return null
                p.toInt().takeIf { it <= 255 } ?: return null
            }
        }
    }
}
