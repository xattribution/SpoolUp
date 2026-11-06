// The link to Tablet Deck on this PC. The plugin connects like a tablet (device=streamdeck)
// and every press goes through the server, so its focus check and the player's keybinds
// apply exactly as for a tablet; the plugin never sends a key itself.
//
// Like public/app.js: heartbeats every 1.5 s (the server answers each, and drops a client
// it hasn't heard from for 5 s, releasing its keys), a link with no answer for 5 s is given
// up as dead, and a connection that never opened asks over HTTP whether the pairing code is
// wrong before trying again, rather than counting wrong codes.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");

const HOST = "127.0.0.1"; // only this PC: Stream Deck and Tablet Deck run next to the game
const DEFAULT_PORT = 8765;
const HB_MS = 1500;
const DEAD_MS = 5000;
const LAYOUT = "layouts/hud.json"; // the catalog's button ids come from this layout

// The installed Tablet Deck keeps its port and pairing code in %APPDATA%\TabletDeck. A copy
// run from source keeps config.json next to server.js, which the plugin can't know, so the
// property inspector's port and code are the fallback.
function readTabletDeckConfig() {
  if (!process.env.APPDATA) return null;
  try {
    const c = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, "TabletDeck", "config.json"), "utf8"));
    if (typeof c.token !== "string" || !c.token) return null;
    return { port: validPort(c.port) || DEFAULT_PORT, code: c.token };
  } catch { return null; }
}
const validPort = (p) => { const n = Number(p); return Number.isInteger(n) && n > 0 && n < 65536 ? n : 0; };

class TabletDeck {
  constructor({ log = () => {} } = {}) {
    this.log = log;
    this.settings = { port: 0, code: "" };
    // state: connecting | connected | offline (not running) | unpaired (no code anywhere) |
    // wrong-code | locked (too many wrong codes); found: config.json was read
    this.link = { state: "connecting", rtt: null, port: null, source: null, found: false };
    this.listeners = { message: [], link: [], drop: [] };
    this.ws = null;
    this.gen = 0; // bumped on every new attempt, so stale callbacks do nothing
    this.retryTimer = null;
    this.started = false;
    this.closing = false;
    this.lastHeard = 0;
    this.answers = false;
    this.signature = "";
    this.beat = setInterval(() => this.heartbeat(), HB_MS);
  }

  on(event, fn) { this.listeners[event].push(fn); }
  emit(event, ...args) { for (const fn of this.listeners[event]) fn(...args); }

  get connected() { return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN && this.link.state === "connected"); }

  setLink(patch) {
    const before = JSON.stringify(this.link);
    Object.assign(this.link, patch);
    if (JSON.stringify(this.link) !== before) this.emit("link", { ...this.link });
  }

  // Where to connect, in order: the property inspector's code (with its port, or the one
  // Tablet Deck wrote), then the code Tablet Deck wrote on its own port, then on the typed
  // one. A port typed once and forgotten mustn't hide a Tablet Deck that config.json finds,
  // and a server started with --port doesn't write its port there.
  targets() {
    const auto = readTabletDeckConfig();
    const port = validPort(this.settings.port) || (auto && auto.port) || DEFAULT_PORT;
    const list = [];
    if (this.settings.code) list.push({ port, code: this.settings.code, source: "settings" });
    if (auto) for (const p of [auto.port, validPort(this.settings.port)]) if (p && !list.some((t) => t.port === p && t.code === auto.code)) list.push({ port: p, code: auto.code, source: "auto" });
    this.setLink({ found: Boolean(auto) });
    return list;
  }

  configure(settings) {
    const next = { port: validPort(settings.port), code: typeof settings.code === "string" ? settings.code.trim() : "" };
    const changed = next.port !== this.settings.port || next.code !== this.settings.code;
    this.settings = next;
    if (!this.started) { this.started = true; this.connect(); return; }
    if (changed) this.reconnect();
  }

  send(obj) {
    if (!this.connected) return false;
    try { this.ws.send(JSON.stringify(obj)); return true; } catch { return false; }
  }

  // Closes the link (if any) without waiting and connects again at once.
  reconnect() {
    if (this.ws) {
      const old = this.ws;
      const wasOpen = old.readyState === WebSocket.OPEN;
      this.ws = null;
      old.onopen = old.onclose = old.onmessage = old.onerror = null;
      try { old.close(); } catch { /* already gone */ }
      if (wasOpen) this.dropped();
    }
    this.connect();
  }

  // Try again now if not connected: a press on the Status key, the PC waking up.
  retryNow() { if (!this.ws) this.connect(); }

  retry(ms) {
    clearTimeout(this.retryTimer);
    if (this.closing) return;
    this.retryTimer = setTimeout(() => this.connect(), ms);
  }

  connect() {
    clearTimeout(this.retryTimer);
    if (this.closing) return;
    const list = this.targets();
    this.signature = JSON.stringify(list);
    if (!list.length) { this.setLink({ state: "unpaired", rtt: null, port: null, source: null }); this.retry(5000); return; }
    this.attempt(list, 0);
  }

  attempt(list, i, worst = "down") {
    const target = list[i];
    const gen = ++this.gen;
    if (this.link.state !== "connected") this.setLink({ state: this.link.state === "offline" ? "offline" : "connecting", port: target.port, source: target.source });
    let sock;
    try {
      sock = new WebSocket(`ws://${HOST}:${target.port}/ws?t=${encodeURIComponent(target.code)}&device=streamdeck&layout=${encodeURIComponent(LAYOUT)}`);
    } catch { this.setLink({ state: "offline" }); this.retry(2000); return; }
    this.ws = sock;
    this.answers = false;
    let opened = false;
    // A connection attempt that hangs counts as failed.
    const giveUp = setTimeout(() => { if (sock.readyState === WebSocket.CONNECTING) sock.close(); }, DEAD_MS);
    sock.onopen = () => {
      opened = true;
      clearTimeout(giveUp);
      this.lastHeard = Date.now();
      this.setLink({ state: "connected", rtt: null, port: target.port, source: target.source });
      this.log(`Connected to Tablet Deck on port ${target.port} (${target.source === "auto" ? "settings found on this PC" : "code from the property inspector"}).`);
      this.send({ t: "hb", n: performance.now() }); // measure the round trip straight away
    };
    // Node's WebSocket reports a refused upgrade (a wrong code's 403) with an error and no
    // close, so both end the attempt.
    sock.onerror = () => { if (!opened) ended(); };
    sock.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.lastHeard = Date.now();
      if (msg.t === "hb") {
        this.answers = true;
        const sample = performance.now() - Number(msg.n);
        if (sample >= 0 && sample < 10000) {
          this.smooth = this.smooth === undefined ? sample : this.smooth * 0.7 + sample * 0.3;
          this.setLink({ rtt: Math.max(1, Math.round(this.smooth)) });
        }
        return;
      }
      // How long Tablet Deck holds a tap (its Tap time setting), for spacing the plugin's taps.
      if (msg.t === "hello") { const ms = Number(msg.tapMs); this.tapMs = Number.isInteger(ms) && ms >= 20 && ms <= 1000 ? ms : 60; }
      this.emit("message", msg);
    };
    sock.onclose = () => ended();
    const ended = () => {
      clearTimeout(giveUp);
      if (this.ws !== sock) return;
      this.ws = null;
      sock.onopen = sock.onclose = sock.onmessage = sock.onerror = null;
      if (opened) {
        this.log("Lost the link to Tablet Deck.");
        this.dropped();
        this.retry(1000);
        return;
      }
      // Never opened: ask once over HTTP why, so a wrong code isn't retried in a loop.
      checkPairing(target).then((answer) => {
        if (gen !== this.gen || this.ws || this.closing) return;
        // Try the next port and code; once all have failed, say the most telling reason.
        const result = [answer, worst].includes("locked") ? "locked" : [answer, worst].includes("wrong") ? "wrong" : answer;
        if (i + 1 < list.length) { this.attempt(list, i + 1, result); return; }
        if (result === "wrong") { this.setLink({ state: "wrong-code", rtt: null }); this.retry(15000); }
        else if (result === "locked") { this.setLink({ state: "locked", rtt: null }); this.retry(60000); }
        else { this.setLink({ state: "offline", rtt: null }); this.retry(2000); }
      });
    };
  }

  // The link went away after being open: Tablet Deck has released everything this plugin
  // held (it does that for any client that closes or goes quiet).
  dropped() {
    this.smooth = undefined;
    this.emit("drop");
    this.setLink({ state: "connecting", rtt: null });
  }

  heartbeat() {
    if (this.closing) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.answers && Date.now() - this.lastHeard > DEAD_MS) {
        this.log("Tablet Deck stopped answering; connecting again.");
        this.reconnect();
        return;
      }
      this.send({ t: "hb", n: performance.now() });
      return;
    }
    // Waiting after a wrong or missing code: try at once when Tablet Deck's config.json or
    // the property inspector gives a new one.
    if (!this.ws && ["wrong-code", "unpaired", "locked"].includes(this.link.state) && JSON.stringify(this.targets()) !== this.signature) this.connect();
  }

  // The property inspector's "Test connection": asks the server over HTTP (no second
  // client in its list) whether this port and code would work.
  async test({ port, code } = {}) {
    const target = code ? { port: validPort(port) || (readTabletDeckConfig() || {}).port || DEFAULT_PORT, code } : this.targets()[0];
    if (!target) return { state: "unpaired" };
    const start = performance.now();
    const result = await checkPairing(target);
    const ms = Math.max(1, Math.round(performance.now() - start));
    return { state: { ok: "connected", wrong: "wrong-code", locked: "locked" }[result] || "offline", rtt: result === "ok" ? ms : null, port: target.port, source: target.source || "settings" };
  }

  // Shuts the link after whatever was sent last (releases) has gone out.
  close() {
    this.closing = true;
    clearInterval(this.beat);
    clearTimeout(this.retryTimer);
    const sock = this.ws;
    if (!sock || sock.readyState !== WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 1000);
      sock.onclose = done;
      try { sock.close(1000); } catch { done(); }
    });
  }
}

// "ok", "wrong" (403), "locked" (429) or "down" (not running / not answering).
function checkPairing({ port, code }) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port, path: `/links.json?t=${encodeURIComponent(code)}`, timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200 ? "ok" : res.statusCode === 403 ? "wrong" : res.statusCode === 429 ? "locked" : "down");
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve("down"));
  });
}

module.exports = { TabletDeck, readTabletDeckConfig };
