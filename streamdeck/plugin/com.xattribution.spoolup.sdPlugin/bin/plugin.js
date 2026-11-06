// SpoolUp's Stream Deck plugin. Plain Node (the Node 24 runtime Stream Deck ships, with
// its global WebSocket) speaking Stream Deck's WebSocket protocol directly: no
// @elgato/streamdeck, no npm packages, nothing to bundle.
//
// Stream Deck starts it as:
//   node bin/plugin.js -port <n> -pluginUUID <id> -registerEvent <event> -info <json>
// The four flags come in no fixed order and other arguments may sit between them, so argv
// is scanned the way @elgato/streamdeck does (take the value after each known flag, skip
// anything else) rather than read in pairs.
"use strict";
const { load } = require("./data");
const { createDraw } = require("./draw");
const { SpoolUp } = require("./spoolup");
const { createActions, FRAME_MS } = require("./actions");

const KNOWN = new Set(["-port", "-pluginUUID", "-registerEvent", "-info"]);
const args = {};
for (let i = 2; i < process.argv.length - 1; i++) if (KNOWN.has(process.argv[i])) args[process.argv[i]] = process.argv[++i];
const port = args["-port"], pluginUUID = args["-pluginUUID"], registerEvent = args["-registerEvent"];
let info = {};
try { info = JSON.parse(args["-info"] || "{}"); } catch { /* keep defaults */ }
if (!port || !pluginUUID || !registerEvent) {
  console.error("Started without Stream Deck's -port, -pluginUUID and -registerEvent.");
  process.exit(1);
}

// ---------- the Stream Deck socket ----------

const socket = new WebSocket(`ws://127.0.0.1:${port}`);
const outbox = [];
function send(msg) {
  const text = JSON.stringify(msg);
  if (socket.readyState === WebSocket.OPEN) socket.send(text);
  else if (socket.readyState === WebSocket.CONNECTING) outbox.push(text);
}
const log = (message) => send({ event: "logMessage", payload: { message: `SpoolUp: ${message}` } });

// Stream Deck's guidelines allow a plugin at most 10 image updates a second per key or
// touch strip. Every setImage and setFeedback goes through here: per context at most one
// every FRAME_MS (8 a second), the newest picture winning, and nothing sent twice.
class Painter {
  constructor() { this.slots = new Map(); }
  slot(context) {
    let s = this.slots.get(context);
    if (!s) this.slots.set(context, (s = { last: 0, timer: null, image: null, feedback: null, shownImage: null, shown: {} }));
    return s;
  }
  image(context, image) {
    const s = this.slot(context);
    if (image === s.shownImage && s.image === null) return;
    s.image = image;
    this.flush(context, s);
  }
  feedback(context, payload) {
    const s = this.slot(context);
    const changed = {};
    for (const [k, v] of Object.entries(payload)) if (JSON.stringify(v) !== s.shown[k] || (s.feedback && k in s.feedback)) changed[k] = v;
    if (!Object.keys(changed).length) return;
    s.feedback = { ...s.feedback, ...changed };
    this.flush(context, s);
  }
  flush(context, s) {
    if (s.timer || (s.image === null && !s.feedback)) return;
    const wait = s.last + FRAME_MS - Date.now();
    if (wait > 0) { s.timer = setTimeout(() => { s.timer = null; this.flush(context, s); }, wait); return; }
    s.last = Date.now();
    if (s.image !== null && s.image !== s.shownImage) send({ event: "setImage", context, payload: { image: s.image, target: 0 } });
    if (s.image !== null) s.shownImage = s.image;
    s.image = null;
    if (s.feedback) {
      const todo = {};
      for (const [k, v] of Object.entries(s.feedback)) { const j = JSON.stringify(v); if (j !== s.shown[k]) { todo[k] = v; s.shown[k] = j; } }
      if (Object.keys(todo).length) send({ event: "setFeedback", context, payload: todo });
      s.feedback = null;
    }
  }
  // A context that (re)appears shows its manifest image until drawn again.
  forget(context) {
    const s = this.slots.get(context);
    if (s) clearTimeout(s.timer);
    this.slots.delete(context);
  }
}
const painter = new Painter();

const data = load(info.application && info.application.language);
const draw = createDraw(data);
const tablet = new SpoolUp({ log });
const sd = {
  pluginUUID,
  send,
  image: (context, image) => painter.image(context, image),
  feedback: (context, payload) => painter.feedback(context, payload),
  forget: (context) => painter.forget(context),
};
const actions = createActions({ sd, tablet, data, draw, log });
for (const d of info.devices || []) actions.addDevice(d.id, d);
if (!data.keyart || !data.actions.length) log("data/ or bin/keyart.js is missing: build the plugin with tools/make-streamdeck.js.");

socket.onopen = () => {
  socket.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
  for (const text of outbox.splice(0)) socket.send(text);
  send({ event: "getGlobalSettings", context: pluginUUID });
};
socket.onmessage = (e) => {
  let msg;
  try { msg = JSON.parse(e.data); } catch { return; }
  try { actions.onEvent(msg); } catch (err) { log(`error in ${msg.event}: ${err && err.stack || err}`); }
};
socket.onerror = () => { /* a close follows */ };
socket.onclose = () => { void shutdown(0); };

// Stream Deck closed the socket (it quit, or restarts the plugin): release whatever is
// still held, let that reach SpoolUp, then go. (If the process is killed instead,
// SpoolUp sees its connection close and releases the keys itself.)
let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  try { actions.releaseAll(); } catch { /* still close */ }
  await tablet.close();
  process.exit(code);
}
process.on("uncaughtException", (err) => {
  try { log(`stopped by an error: ${err && err.stack || err}`); } catch { /* socket gone */ }
  void shutdown(1);
});
