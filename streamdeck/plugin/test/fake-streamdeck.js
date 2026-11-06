// A stand-in for the Stream Deck app, for testing the plugin without Windows or hardware:
// a WebSocket server (RFC 6455 on net + crypto) that launches bin/plugin.js with the
// argument format Stream Deck uses (plus a stray flag, which the plugin must skip), plays
// events to it, and records every command it sends. Property inspectors can connect too
// (connectElgatoStreamDeckSocket's protocol); their messages are routed like the app does.
"use strict";
const net = require("net");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const { EventEmitter } = require("events");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function frame(text, opcode = 1) {
  const p = Buffer.from(text);
  let h;
  if (p.length < 126) h = Buffer.from([0x80 | opcode, p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | opcode; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, p]);
}

// Reads client frames (masked) off a buffer; returns { frames, rest }.
function readFrames(buf) {
  const frames = [];
  let o = 0;
  while (buf.length - o >= 2) {
    const fin = (buf[o] & 0x80) !== 0, op = buf[o] & 15, masked = (buf[o + 1] & 0x80) !== 0;
    let len = buf[o + 1] & 127, off = o + 2;
    if (len === 126) { if (buf.length < off + 2) break; len = buf.readUInt16BE(off); off += 2; }
    else if (len === 127) { if (buf.length < off + 8) break; len = Number(buf.readBigUInt64BE(off)); off += 8; }
    const mask = masked ? buf.subarray(off, off + 4) : null;
    if (masked) off += 4;
    if (buf.length < off + len) break;
    const data = Buffer.from(buf.subarray(off, off + len));
    if (mask) for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
    frames.push({ fin, op, data });
    o = off + len;
  }
  return { frames, rest: buf.subarray(o) };
}

class FakeStreamDeck extends EventEmitter {
  // pluginDir: the .sdPlugin folder; info: the -info JSON; env: extra environment.
  constructor({ pluginDir, info = {}, env = {}, language = "en" } = {}) {
    super();
    this.pluginDir = pluginDir;
    this.pluginUUID = `PLUGIN${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    this.info = {
      application: { font: "Segoe UI", language, platform: "windows", platformVersion: "10.0.22631", version: "7.6.0.22000" },
      colors: {}, devicePixelRatio: 1, devices: [], plugin: { uuid: "com.xattribution.spoolup", version: "2.0.0.0" }, ...info,
    };
    this.env = env;
    this.commands = []; // { time, msg } from the plugin
    this.plugin = null; // the plugin's socket
    this.pis = new Map(); // inspector uuid -> { sock, action, context }
    this.globals = {};
    this.settings = new Map(); // context -> settings
    this.output = "";
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((sock) => this.accept(sock));
      this.server.listen(0, "127.0.0.1", () => {
        const port = String(this.server.address().port);
        const args = ["--enable-source-maps", "--no-global-search-paths", path.join(this.pluginDir, "bin", "plugin.js"),
          "-port", port, "-pluginUUID", this.pluginUUID, "-bool", "-registerEvent", "registerPlugin", "-info", JSON.stringify(this.info)];
        this.child = spawn(process.execPath, args, { cwd: this.pluginDir, env: { ...process.env, ...this.env }, stdio: ["ignore", "pipe", "pipe"] });
        this.child.stdout.on("data", (d) => { this.output += d; });
        this.child.stderr.on("data", (d) => { this.output += d; });
        this.exited = new Promise((res) => this.child.on("exit", (code) => res(code)));
        const timer = setTimeout(() => reject(new Error(`plugin didn't register:\n${this.output}`)), 5000);
        this.once("registered", () => { clearTimeout(timer); resolve(); });
      });
    });
  }

  accept(sock) {
    let pending = Buffer.alloc(0), upgraded = false, parts = [];
    const conn = { sock, role: null };
    sock.on("data", (d) => {
      pending = Buffer.concat([pending, d]);
      if (!upgraded) {
        const s = pending.toString("latin1"), i = s.indexOf("\r\n\r\n");
        if (i < 0) return;
        const key = /Sec-WebSocket-Key: *(.*)\r\n/i.exec(s)[1].trim();
        const acc = crypto.createHash("sha1").update(key + GUID).digest("base64");
        sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
        upgraded = true;
        pending = pending.subarray(i + 4);
      }
      const { frames, rest } = readFrames(pending);
      pending = rest;
      for (const f of frames) {
        if (f.op === 8) { sock.end(frame("", 8)); return; }
        if (f.op === 9) { sock.write(frame(f.data, 10)); continue; }
        if (f.op === 1 || f.op === 0) {
          parts.push(f.data);
          if (!f.fin) continue;
          const text = Buffer.concat(parts).toString("utf8");
          parts = [];
          this.onText(conn, JSON.parse(text));
        }
      }
    });
    sock.on("error", () => {});
  }

  onText(conn, msg) {
    if (!conn.role) {
      if (msg.event === "registerPlugin" && msg.uuid === this.pluginUUID) {
        conn.role = "plugin";
        this.plugin = conn.sock;
        this.commands.push({ time: Date.now(), msg });
        this.emit("registered");
        return;
      }
      if (msg.event === "registerPropertyInspector") {
        conn.role = "pi";
        const pi = this.pis.get(msg.uuid) || {};
        Object.assign(pi, { sock: conn.sock });
        this.pis.set(msg.uuid, pi);
        this.emit("pi", msg.uuid);
        return;
      }
      return;
    }
    if (conn.role === "plugin") return this.fromPlugin(msg);
    return this.fromInspector(msg);
  }

  fromPlugin(msg) {
    this.commands.push({ time: Date.now(), msg });
    this.emit("command", msg);
    if (msg.event === "getGlobalSettings") this.send({ event: "didReceiveGlobalSettings", payload: { settings: this.globals } });
    if (msg.event === "setGlobalSettings") {
      this.globals = msg.payload;
      for (const pi of this.pis.values()) this.write(pi.sock, { event: "didReceiveGlobalSettings", payload: { settings: this.globals } });
    }
    if (msg.event === "setSettings") this.settings.set(msg.context, msg.payload);
    if (msg.event === "sendToPropertyInspector") {
      for (const pi of this.pis.values()) if (pi.context === msg.context) this.write(pi.sock, { event: "sendToPropertyInspector", action: pi.action, context: msg.context, payload: msg.payload });
    }
  }

  // A property inspector's message, routed the way Stream Deck does.
  fromInspector(msg) {
    this.emit("pi-command", msg);
    const pi = [...this.pis.values()].find((p) => p.uuid === msg.context || p.context === msg.context) || [...this.pis.values()][0];
    if (msg.event === "sendToPlugin") this.send({ event: "sendToPlugin", action: pi.action, context: pi.context, payload: msg.payload });
    if (msg.event === "setSettings") {
      this.settings.set(pi.context, msg.payload);
      this.send({ event: "didReceiveSettings", action: pi.action, context: pi.context, device: pi.device, payload: { controller: pi.controller || "Keypad", settings: msg.payload, coordinates: { column: 0, row: 0 }, isInMultiAction: false } });
    }
    if (msg.event === "getSettings") this.write(pi.sock, { event: "didReceiveSettings", action: pi.action, context: pi.context, device: pi.device, payload: { settings: this.settings.get(pi.context) || {} } });
    if (msg.event === "setGlobalSettings") {
      this.globals = msg.payload;
      this.send({ event: "didReceiveGlobalSettings", payload: { settings: this.globals } });
    }
    if (msg.event === "getGlobalSettings") this.write(pi.sock, { event: "didReceiveGlobalSettings", payload: { settings: this.globals } });
  }

  // Says which action instance an inspector (by its registration uuid) belongs to.
  inspector(uuid, { action, context, device, controller }) {
    const pi = this.pis.get(uuid) || {};
    Object.assign(pi, { uuid, action, context, device, controller });
    this.pis.set(uuid, pi);
  }

  write(sock, msg) { if (sock && !sock.destroyed) sock.write(frame(JSON.stringify(msg))); }
  send(msg) { this.write(this.plugin, msg); }

  // Every command so far matching a test, or those after an index.
  find(test, from = 0) { return this.commands.slice(from).filter((c) => test(c.msg)).map((c) => c.msg); }
  mark() { return this.commands.length; }
  waitFor(test, ms = 3000, from = 0) {
    return new Promise((resolve, reject) => {
      const hit = this.commands.slice(from).find((c) => test(c.msg));
      if (hit) { resolve(hit.msg); return; }
      const on = (msg) => { if (test(msg)) { cleanup(); resolve(msg); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error("timed out waiting for a plugin command")); }, ms);
      const cleanup = () => { clearTimeout(timer); this.off("command", on); };
      this.on("command", on);
    });
  }

  // Stream Deck quitting: a close frame, then the socket ends.
  closeSocket() {
    if (this.plugin && !this.plugin.destroyed) { this.plugin.write(frame("", 8)); this.plugin.end(); }
  }

  async stop() {
    this.closeSocket();
    const code = await Promise.race([this.exited, new Promise((r) => setTimeout(() => r("timeout"), 3000))]);
    if (code === "timeout") this.child.kill();
    for (const pi of this.pis.values()) pi.sock && pi.sock.destroy();
    this.server.close();
    return code;
  }
}

// Helpers to build Stream Deck events.
const ev = {
  device: (device, type, columns, rows, name) => ({ event: "deviceDidConnect", device, deviceInfo: { name, size: { columns, rows }, type } }),
  appear: (action, context, device, settings = {}, { controller = "Keypad", column = 0, row = 0 } = {}) => ({
    event: "willAppear", action, context, device,
    payload: { controller, coordinates: { column, row }, isInMultiAction: false, resources: {}, settings, ...(controller === "Keypad" ? { state: 0 } : {}) },
  }),
  disappear: (action, context, device, settings = {}, { controller = "Keypad", column = 0, row = 0 } = {}) => ({
    event: "willDisappear", action, context, device,
    payload: { controller, coordinates: { column, row }, isInMultiAction: false, resources: {}, settings },
  }),
  key: (event, action, context, device, settings = {}) => ({
    event, action, context, device,
    payload: { controller: "Keypad", coordinates: { column: 0, row: 0 }, isInMultiAction: false, resources: {}, settings, state: 0 },
  }),
  dial: (event, action, context, device, settings = {}, extra = {}) => ({
    event, action, context, device,
    payload: { controller: "Encoder", coordinates: { column: extra.column || 0, row: 0 }, resources: {}, settings, ...extra },
  }),
};

module.exports = { FakeStreamDeck, ev, frame, readFrames };
