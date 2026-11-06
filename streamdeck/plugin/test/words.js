// The words the plugin draws, in all four languages, without a server: every status a key
// can show fits on it (keyart shrinks lines over 14 characters, which on a 15-key's 72 px
// keys is too small to read), and a dial's turn and push words fit its strip's value line
// with their + or − kept. Drives actions.js with a stub Stream Deck and Tablet Deck, as a
// Stream Deck + XL.
//
//   node streamdeck/plugin/test/words.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const EventEmitter = require("events");
const { write: writeData } = require("./make-test-data");

const SRC = process.env.TD_PLUGIN_SRC || path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");
const U = "com.nodiecode.tabletdeck";
const LANGS = ["en", "es", "fr", "de"];

let failures = 0, passes = 0;
function check(name, ok, detail = "") {
  if (ok) { passes++; console.log(`  ok    ${name}`); } else { failures++; console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-words-"));
const dir = path.join(tmp, `${U}.sdPlugin`);
fs.cpSync(SRC, dir, { recursive: true });
writeData(dir);
const { load } = require(path.join(dir, "bin", "data.js"));
const { createDraw } = require(path.join(dir, "bin", "draw.js"));
const { createActions } = require(path.join(dir, "bin", "actions.js"));

function rig(lang) {
  const data = load(lang), draw = createDraw(data);
  const fb = new Map();
  const sd = { pluginUUID: "P", send: () => {}, image: () => {}, feedback: (c, p) => fb.set(c, { ...(fb.get(c) || {}), ...p }), forget: () => {} };
  const tablet = Object.assign(new EventEmitter(), { connected: true, link: { state: "connected", rtt: 8, port: 8765 }, send: () => true, configure() {}, retryNow() {}, reconnect() {} });
  const a = createActions({ sd, tablet, data, draw, log: () => {} });
  a.onEvent({ event: "didReceiveGlobalSettings", payload: { settings: {} } });
  a.addDevice("XL", { type: 13, name: "Stream Deck + XL", size: { columns: 9, rows: 4 } });
  return { a, fb, data };
}

console.log("\nKey status words fit on the key");
{
  const fixed = ["ON", "OFF", "ONLINE", "DEPLOYED", "RETRACTED", "DEPLOYING…", "RETRACTING…", "HOLD TO ENGAGE", "SPOOLING…", "ENGAGED", "OPEN", "CLOSED", "OPENING…", "CLOSING…", "ACQUIRING…", "LOCKED", "HOLD TO ARM", "ARMING…", "ARMED", "ACTIVE", "LISTENING", "VOICE OFF", "HEARD", "NOT HEARD", "OFFLINE", "CONNECTING…", "NOT PAIRED", "WRONG CODE", "LOCKED OUT", "{0} MS", "PORT {0}"];
  for (const lang of LANGS) {
    const data = load(lang);
    const words = new Set(fixed);
    for (const a of data.actions) if (a.state && typeof a.state.on === "string") words.add(a.state.on);
    const long = [...words].map((w) => data.t(w, "65535")).filter((s) => s.length > 14);
    check(`${lang}: no status word over 14 characters`, !long.length, long.join(", "));
  }
}

console.log("\nDial words fit the strip and keep their sign");
for (const lang of LANGS) {
  const { a, fb, data } = rig(lang);
  const bad = [], lost = [], small = [];
  let n = 0;
  for (const [name, dial] of Object.entries(data.DIAL)) {
    if (!dial || typeof dial !== "object") continue;
    const pressable = (ref) => { const d = data.byId.get(ref); return d && d.kind === "deck"; };
    for (const way of ["ccw", "cw", "press"]) {
      if (!pressable(dial[way])) continue;
      const ctx = `${name}-${way}`;
      const payload = { controller: "Encoder", coordinates: { column: n++ % 6, row: 0 }, settings: { dial } };
      a.onEvent({ event: "willAppear", action: `${U}.dial`, context: ctx, device: "XL", payload });
      if (way === "press") a.onEvent({ event: "touchTap", action: `${U}.dial`, context: ctx, device: "XL", payload: { ...payload, tapPos: [100, 50], hold: false } });
      else a.onEvent({ event: "dialRotate", action: `${U}.dial`, context: ctx, device: "XL", payload: { ...payload, ticks: way === "cw" ? 1 : -1 } });
      const value = ((fb.get(ctx) || {}).value || {}).value || "";
      // The value line takes 14 characters at 13 px; longer words get 12 px, and past 17,
      // 10 px (which fits 18).
      if (value.length > 18) bad.push(`${name} ${way} "${value}"`);
      else if (value.length > 14) small.push(`${name} ${way} "${value}"`);
      const label = data.t(data.byId.get(dial[way]).label);
      const sign = /[+−-]$/.exec(label);
      if (sign && !value.endsWith(sign[0])) lost.push(`${name} ${way} "${value}" for "${label}"`);
      a.onEvent({ event: "willDisappear", action: `${U}.dial`, context: ctx, device: "XL", payload });
    }
  }
  check(`${lang}: every preset dial's turn and push word fits the value line`, !bad.length, bad.join(", "));
  if (small.length) console.log(`        (drawn smaller: ${small.join(", ")})`);
  check(`${lang}: a turn whose button ends in + or − still shows it`, !lost.length, lost.join(", "));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
