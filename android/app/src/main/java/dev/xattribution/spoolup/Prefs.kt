package dev.xattribution.spoolup

import android.content.Context
import androidx.core.content.edit
import org.json.JSONArray

/**
 * The PCs opened before, most recent first, in SharedPreferences on this device only (kept
 * out of backups: res/xml/data_extraction_rules.xml). The pairing code isn't kept here: the
 * deck stores it itself, per address, as it does in a browser.
 */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("spoolup", Context.MODE_PRIVATE)

    fun saved(): List<Pc> {
        val raw = sp.getString(K_PCS, null) ?: return emptyList()
        return try {
            val a = JSONArray(raw)
            (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let(Pc::fromJson) }.sortedByDescending { it.lastUsed }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun lastUsed(): Pc? = saved().firstOrNull()

    /** Saves (or refreshes) a PC as the last one used. The same address, or the same mDNS name, is the same PC. */
    fun use(pc: Pc, now: Long = System.currentTimeMillis()) {
        val old = saved().firstOrNull { it.sameAs(pc) }
        val merged = pc.copy(
            service = pc.service.ifEmpty { old?.service.orEmpty() },
            version = pc.version.ifEmpty { old?.version.orEmpty() },
            lastUsed = now,
        )
        write(listOf(merged) + saved().filterNot { it.sameAs(pc) })
    }

    /** A saved PC seen again at a new address or under a new name. */
    fun update(pc: Pc) {
        val list = saved()
        val i = list.indexOfFirst { it.sameAs(pc) }
        if (i < 0) return
        val old = list[i]
        val next = old.copy(name = pc.name, host = pc.host, port = pc.port, version = pc.version.ifEmpty { old.version })
        if (next != old) write(list.toMutableList().also { it[i] = next })
    }

    fun forget(host: String, port: Int) {
        write(saved().filterNot { it.host.equals(host, ignoreCase = true) && it.port == port })
    }

    private fun write(list: List<Pc>) {
        sp.edit { putString(K_PCS, Pc.listJson(list.take(LIMIT)).toString()) }
    }

    private companion object {
        const val K_PCS = "pcs"
        /** Enough for a home with a few gaming PCs; the oldest drop off. */
        const val LIMIT = 12
    }
}
