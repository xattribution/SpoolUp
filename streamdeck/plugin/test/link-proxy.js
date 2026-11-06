// A TCP proxy between the plugin and the SpoolUp server, so tests can see what the
// plugin sends, slip server messages in (a "blocked" the dry run never sends on Linux),
// cut the link, or make it go quiet without closing (a PC asleep, Wi-Fi gone).
"use strict";
const net = require("net");
const { frame, readFrames } = require("./fake-streamdeck");

class LinkProxy {
  constructor(target) {
    this.target = target;
    this.sent = []; // { time, msg } plugin -> server
    this.links = new Set();
    this.quiet = false;
  }

  start() {
    return new Promise((resolve) => {
      this.server = net.createServer((client) => this.accept(client));
      this.server.listen(0, "127.0.0.1", () => { this.port = this.server.address().port; resolve(this.port); });
    });
  }

  accept(client) {
    const upstream = net.connect(this.target, "127.0.0.1");
    const link = { client, upstream, ws: false, up: Buffer.alloc(0), down: Buffer.alloc(0), quiet: false };
    this.links.add(link);
    const end = () => { this.links.delete(link); client.destroy(); upstream.destroy(); };
    client.on("error", end); upstream.on("error", end);
    client.on("close", end); upstream.on("close", end);
    client.on("data", (d) => {
      if (link.quiet) return;
      upstream.write(d);
      if (!link.ws) return;
      link.up = Buffer.concat([link.up, d]);
      const { frames, rest } = readFrames(link.up);
      link.up = rest;
      for (const f of frames) if (f.op === 1) { try { this.sent.push({ time: Date.now(), msg: JSON.parse(f.data.toString()) }); } catch { /* not JSON */ } }
    });
    // Server frames are passed on whole, so an injected one never lands inside another.
    upstream.on("data", (d) => {
      if (link.quiet) return;
      if (!link.ws) {
        const s = d.toString("latin1");
        if (s.startsWith("HTTP/1.1 101")) {
          const i = s.indexOf("\r\n\r\n");
          client.write(d.subarray(0, i + 4));
          link.ws = true;
          d = d.subarray(i + 4);
        } else { client.write(d); return; }
      }
      link.down = Buffer.concat([link.down, d]);
      let o = 0;
      while (link.down.length - o >= 2) {
        let len = link.down[o + 1] & 127, off = o + 2;
        if (len === 126) { if (link.down.length < off + 2) break; len = link.down.readUInt16BE(off); off += 2; }
        else if (len === 127) { if (link.down.length < off + 8) break; len = Number(link.down.readBigUInt64BE(off)); off += 8; }
        if (link.down.length < off + len) break;
        client.write(link.down.subarray(o, off + len));
        o = off + len;
      }
      link.down = link.down.subarray(o);
    });
  }

  // A message from "the server" to the plugin, on every open link.
  inject(msg) { for (const l of this.links) if (l.ws && !l.quiet) l.client.write(frame(JSON.stringify(msg))); }
  // Cuts every link at once: a normal TCP close (FIN) both ways, as when a process dies,
  // or with reset: true a reset (RST), as when the network goes away.
  drop({ reset = false } = {}) {
    for (const l of [...this.links]) {
      if (reset) { l.client.resetAndDestroy(); l.upstream.resetAndDestroy(); } else { l.client.destroy(); l.upstream.destroy(); }
    }
  }
  // The open links stop passing anything either way but stay open; new links work.
  hush() { for (const l of this.links) l.quiet = true; }
  find(test, from = 0) { return this.sent.slice(from).filter((s) => test(s.msg)).map((s) => s.msg); }
  mark() { return this.sent.length; }
  close() { this.drop(); this.server.close(); }
}

module.exports = { LinkProxy };
