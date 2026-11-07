package dev.xattribution.spoolup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PcAddressTest {
    private fun ok(text: String) = (PcAddress.parse(text) as PcAddress.Result.Ok).address
    private fun bad(text: String?) = (PcAddress.parse(text) as PcAddress.Result.Bad).problem

    @Test
    fun readsTypedAddresses() {
        assertEquals(PcAddress("192.168.1.20", 8765), ok("192.168.1.20"))
        assertEquals(PcAddress("192.168.1.20", 8790), ok(" 192.168.1.20:8790 "))
        assertEquals(PcAddress("gaming-pc.local", 8765), ok("Gaming-PC.local."))
        assertEquals(PcAddress("gaming-pc", 8765), ok("gaming-pc"))
        assertEquals(PcAddress("10.0.0.5", 8765), ok("http://10.0.0.5/"))
    }

    @Test
    fun readsTheQrCodeLink() {
        val a = ok("http://192.168.1.20:8765/?t=1A2B3C4D")
        assertEquals(PcAddress("192.168.1.20", 8765, "1a2b3c4d"), a)
        assertEquals("http://192.168.1.20:8765/?t=1a2b3c4d", a.deckUrl())
        assertEquals("http://192.168.1.20:8765/", a.copy(code = null).deckUrl())
        // A code server.js wouldn't accept is dropped; the deck then asks for it.
        assertNull(ok("http://192.168.1.20:8765/?t=bad-code!").code)
        assertNull(ok("http://192.168.1.20:8765/?x=1").code)
    }

    @Test
    fun refusesAnythingOffTheHomeNetwork() {
        assertEquals(PcAddress.Problem.EMPTY, bad(""))
        assertEquals(PcAddress.Problem.EMPTY, bad(null))
        assertEquals(PcAddress.Problem.NOT_HTTP, bad("https://192.168.1.20:8765/"))
        assertEquals(PcAddress.Problem.NOT_HTTP, bad("javascript://alert(1)"))
        assertEquals(PcAddress.Problem.NOT_LOCAL, bad("8.8.8.8"))
        assertEquals(PcAddress.Problem.NOT_LOCAL, bad("example.com"))
        assertEquals(PcAddress.Problem.NOT_LOCAL, bad("localhost:8765"))
        assertEquals(PcAddress.Problem.NOT_LOCAL, bad("999.1.1.1"))
        assertEquals(PcAddress.Problem.NOT_LOCAL, bad("http://evil.com@192.168.1.20/"))
        assertEquals(PcAddress.Problem.IPV6, bad("[fe80::1]:8765"))
        assertEquals(PcAddress.Problem.IPV6, bad("fe80::1"))
        assertEquals(PcAddress.Problem.BAD_PORT, bad("192.168.1.20:80"))
        assertEquals(PcAddress.Problem.BAD_PORT, bad("192.168.1.20:70000"))
        assertEquals(PcAddress.Problem.BAD_PORT, bad("192.168.1.20:"))
    }

    @Test
    fun localRanges() {
        for (h in listOf("10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.3.4", "pc.local", "pc")) assertTrue(h, PcAddress.isLocal(h))
        for (h in listOf("172.15.0.1", "172.32.0.1", "192.169.0.1", "1.2.3", "a..local", ".local", "pc.lan", "", "localhost")) assertFalse(h, PcAddress.isLocal(h))
    }

    @Test
    fun discoveredRecordsBecomePcs() {
        val pc = Discovery.fromRecords("Gaming PC", "192.168.1.20", 8765, mapOf("v" to "2.1.0", "name" to "Gaming PC"))!!
        assertEquals(Pc("Gaming PC", "192.168.1.20", 8765, "Gaming PC", "2.1.0"), pc)
        assertEquals("Desk", Discovery.fromRecords("Desk", "10.0.0.2", 8765, emptyMap())!!.name)
        assertNull(Discovery.fromRecords("PC", "8.8.8.8", 8765, emptyMap()))
        assertNull(Discovery.fromRecords("PC", "pc.local", 8765, emptyMap())) // an IP address only
        assertNull(Discovery.fromRecords("PC", "192.168.1.20", 80, emptyMap()))
        assertNull(Discovery.fromRecords("", "192.168.1.20", 8765, emptyMap()))
    }

    @Test
    fun samePcByAddressOrName() {
        val a = Pc("PC", "192.168.1.20", 8765, "PC")
        assertTrue(a.sameAs(Pc("Other", "192.168.1.20", 8765)))
        assertTrue(a.sameAs(Pc("PC", "192.168.1.31", 8765, "PC")))
        assertFalse(a.sameAs(Pc("PC", "192.168.1.31", 8765)))
    }
}
