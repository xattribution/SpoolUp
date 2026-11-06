// End-to-end test of the Stream Deck plugin against a dry-run Tablet Deck server (which
// presses no keys), with a fake Stream Deck app playing a Stream Deck + XL and a 15-key.
// What the plugin pressed is read from the server's /events stream (dry runs only), what it
// sent from a proxy on the link, and the server's own "key d/u" log lines show that every
// key that went down came back up.
//
//   node streamdeck/plugin/test/run.js [--port 8860]
//
// It copies the plugin to a temporary folder and writes its data there
// (make-test-data.js); nothing in the repo changes.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const { FakeStreamDeck, ev } = require("./fake-streamdeck");
const { LinkProxy } = require("./link-proxy");
const { write: writeData, REPO } = require("./make-test-data");

const SRC = path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");
const U = "com.nodiecode.tabletdeck";
const A = { key: `${U}.key`, dial: `${U}.dial`, scene: `${U}.scene`, theme: `${U}.theme`, talk: `${U}.talk`, status: `${U}.status`, lights: `${U}.lights` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- a tiny runner ----------

let failures = 0, passes = 0;
function check(name, ok, detail = "") {
  if (ok) { passes++; console.log(`  ok    ${name}`); } else { failures++; console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`); }
}
async function within(ms, test, step = 50) {
  const end = Date.now() + ms;
  for (;;) { const v = test(); if (v) return v; if (Date.now() > end) return null; await sleep(step); }
}

// ---------- the server and its event stream ----------

function freePort(from = 8860, to = 8899) {
  const wanted = process.argv.includes("--port") ? [Number(process.argv[process.argv.indexOf("--port") + 1])] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return new Promise((resolve, reject) => {
    const next = (i) => {
      if (i >= wanted.length) { reject(new Error("no free port")); return; }
      const s = net.createServer().once("error", () => next(i + 1)).listen(wanted[i], "127.0.0.1", () => s.close(() => resolve(wanted[i])));
    };
    next(0);
  });
}

function startServer(port) {
  const proc = spawn(process.execPath, ["server.js", "--dry-run", "--port", String(port)], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
  proc.log = "";
  proc.stdout.on("data", (d) => { proc.log += d; });
  proc.stderr.on("data", (d) => { proc.log += d; });
  return proc;
}

function events(port, token) {
  const list = [];
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: `/events?t=${encodeURIComponent(token)}` }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`/events answered ${res.statusCode}`)); return; }
      let buf = "";
      res.on("data", (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (line) list.push(JSON.parse(line.slice(6)));
        }
      });
      resolve({ list, close: () => req.destroy(), mark: () => list.length, find: (test, from = 0) => list.slice(from).filter(test) });
    });
    req.on("error", reject);
  });
}

// ---------- reading the plugin's pictures ----------

const svgOf = (cmd) => decodeURIComponent(String(cmd.payload.image).replace(/^data:image\/svg\+xml,/, ""));
const lastImage = (sd, context, from = 0) => { const l = sd.find((m) => m.event === "setImage" && m.context === context, from); return l.length ? svgOf(l[l.length - 1]) : ""; };
const feedbacks = (sd, context, from = 0) => sd.find((m) => m.event === "setFeedback" && m.context === context, from).map((m) => m.payload);
const lastValue = (sd, context, from = 0) => { const v = feedbacks(sd, context, from).filter((p) => p.value); return v.length ? v[v.length - 1].value.value : ""; };
const OFFLINE_MARK = "M114 20l14 14";

// Most updates any context got within any one second.
function maxPerSecond(sd, events) {
  const by = new Map();
  for (const c of sd.commands) if (events.includes(c.msg.event)) { if (!by.has(c.msg.context)) by.set(c.msg.context, []); by.get(c.msg.context).push(c.time); }
  let worst = { n: 0, context: null };
  for (const [context, times] of by) {
    let j = 0;
    for (let i = 0; i < times.length; i++) { while (times[i] - times[j] >= 1000) j++; if (i - j + 1 > worst.n) worst = { n: i - j + 1, context }; }
  }
  return worst;
}

// Every key the server pressed was let go: its dry-run log prints "  key d|u <code> <ext>".
function stuckKeys(log) {
  const held = new Map();
  for (const m of log.matchAll(/^ {2}key ([du]) (\S+ \S+)$/gm)) held.set(m[2], (held.get(m[2]) || 0) + (m[1] === "d" ? 1 : -1));
  return [...held].filter(([, n]) => n !== 0);
}

// ---------- the scenario ----------

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(REPO, "config.json"), "utf8"));
  const token = config.token;
  const port = await freePort();
  const server = startServer(port);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-"));
  const pluginDir = path.join(tmp, `${U}.sdPlugin`);
  fs.cpSync(SRC, pluginDir, { recursive: true });
  writeData(pluginDir);
  const data = {
    scenes: JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "scenes.json"), "utf8")),
    themes: JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "themes.json"), "utf8")),
  };
  const DIAL = data.scenes.DIAL;
  let sd = null, proxy = null, stream = null, tabletWs = null;
  try {
    if (!(await within(8000, () => / running \(/.test(server.log), 100))) throw new Error(`server didn't start:\n${server.log.split(token).join("<code>")}`);
    await sleep(500);
    stream = await events(port, token);
    proxy = new LinkProxy(port);
    const proxyPort = await proxy.start();

    // Tablet Deck's config.json where the installed app keeps it, pointing at the proxy.
    const appdata = path.join(tmp, "appdata");
    fs.mkdirSync(path.join(appdata, "TabletDeck"), { recursive: true });
    fs.writeFileSync(path.join(appdata, "TabletDeck", "config.json"), JSON.stringify({ port: proxyPort, token }));

    // A tablet that follows scenes, to see what the server passes on.
    const tabletMsgs = [];
    tabletWs = new WebSocket(`ws://127.0.0.1:${port}/ws?t=${encodeURIComponent(token)}&device=tablet`);
    tabletWs.onmessage = (e) => tabletMsgs.push(JSON.parse(e.data));
    await within(3000, () => tabletWs.readyState === WebSocket.OPEN);
    // Heartbeats, or the server drops it after 5 s like any silent tablet.
    const tabletBeat = setInterval(() => { if (tabletWs.readyState === WebSocket.OPEN) tabletWs.send(JSON.stringify({ t: "hb", n: 0 })); }, 1500);
    tabletBeat.unref();

    console.log("\nStart-up");
    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: appdata } });
    await sd.start();
    check("registers despite a stray -bool flag", sd.commands[0].msg.uuid === sd.pluginUUID);
    const gg = await sd.waitFor((m) => m.event === "getGlobalSettings");
    check("asks for global settings with the plugin UUID as context", gg.context === sd.pluginUUID);

    // A Stream Deck + XL (type 13, 9x4, six dials) and a 15-key (type 0).
    const XL = "DEV-PLUSXL", STD = "DEV-15";
    sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"));
    sd.send(ev.device(STD, 0, 5, 3, "Stream Deck"));
    const keys = {
      gear: [A.key, "k-gear", XL, { action: "pl-gear" }, { column: 0, row: 2 }],
      qt: [A.key, "k-qt", XL, { action: "qt-engage" }, { column: 6, row: 1 }],
      qt2: [A.key, "k-qt2", XL, { action: "qt-engage" }, { column: 7, row: 1 }],
      decoy: [A.key, "k-decoy", XL, { action: "cb-decoy" }, { column: 0, row: 3 }],
      maxw: [A.key, "k-maxw", XL, { action: "pw-wep-max" }, { column: 1, row: 3 }],
      doors: [A.key, "k-doors", XL, { action: "cr-doors-toggle" }, { column: 5, row: 3 }],
      unset: [A.key, "k-unset", XL, {}, { column: 8, row: 3 }],
      flight: [A.scene, "s-flight", XL, { scene: "flight", page: "flight" }, { column: 0, row: 0 }],
      combat: [A.scene, "s-combat", XL, { scene: "combat", page: "flight" }, { column: 1, row: 0 }],
      drake: [A.theme, "t-drake", XL, { theme: "drake" }, { column: 2, row: 1 }],
      talk: [A.talk, "x-talk", XL, {}, { column: 7, row: 3 }],
      status: [A.status, "x-status", XL, {}, { column: 8, row: 2 }],
      lights: [A.lights, "x-lights", XL, {}, { column: 8, row: 1 }],
      gear15: [A.key, "k15-gear", STD, { action: "pl-gear" }, { column: 1, row: 0 }],
      combat15: [A.scene, "s15-combat", STD, { scene: "combat" }, { column: 4, row: 0 }],
    };
    const dialSet = ["weapons", "thrusters", "shields", "speed", "volume", "scenes"];
    const dials = Object.fromEntries(dialSet.map((name, column) => [name, [A.dial, `d-${name}`, XL, { dial: DIAL[name] }, { controller: "Encoder", column, row: 0 }]]));
    const appear = (k) => sd.send(ev.appear(k[0], k[1], k[2], k[3], k[4]));
    const press = (k, event) => sd.send(ev.key(event, k[0], k[1], k[2], k[3]));
    const turn = (d, ticks) => sd.send(ev.dial("dialRotate", d[0], d[1], d[2], d[3], { column: d[4].column, ticks, pressed: false }));
    const dialEv = (d, event, extra = {}) => sd.send(ev.dial(event, d[0], d[1], d[2], d[3], { column: d[4].column, ...extra }));
    Object.values(keys).forEach(appear);
    Object.values(dials).forEach(appear);

    const link = await within(6000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck")[0]);
    check("connects to Tablet Deck as device=streamdeck, from config.json in %APPDATA%\\TabletDeck", Boolean(link));
    await within(3000, () => /\d+ MS/.test(lastImage(sd, "x-status")));
    check("Status shows the round trip", /\d+ MS/.test(lastImage(sd, "x-status")), lastImage(sd, "x-status").match(/>[^<]*MS<|OFFLINE|CONNECTING/)?.[0]);
    await sleep(300);
    const drawn = Object.values(keys).every((k) => lastImage(sd, k[1]));
    check("every key gets an SVG image", drawn);
    check("unset key asks for an action", /CHOOSE AN ACTION|CHOOSE AN|ACTION/i.test(lastImage(sd, "k-unset")));
    const fb = feedbacks(sd, "d-weapons");
    check("dials get the strip layout's items", fb.length && ["bg", "icon", "label", "value"].every((k) => fb.some((p) => p[k])), JSON.stringify(Object.keys(fb[0] || {})));
    check("dials get trigger descriptions", sd.find((m) => m.event === "setTriggerDescription" && m.context === "d-weapons").length === 1);
    check("the scene dial shows the scene from the page hint", lastValue(sd, "d-scenes") === "FLIGHT", lastValue(sd, "d-scenes"));
    check("the flight tab is lit, combat isn't", /ACTIVE/.test(lastImage(sd, "s-flight")) && !/ACTIVE/.test(lastImage(sd, "s-combat")));
    // + XL strip: brackets at the two ends only.
    const bgOf = (ctx) => { const b = feedbacks(sd, ctx).filter((p) => p.bg).pop(); return b ? Buffer.from(b.bg.split(",")[1], "base64").toString() : ""; };
    check("+ XL strip: end brackets on dial 1 and dial 6 only", /M3 18V3H18/.test(bgOf("d-weapons")) && !/M197 18/.test(bgOf("d-weapons")) && /M197 18V3H182/.test(bgOf("d-scenes")) && !/M3 18V3/.test(bgOf("d-shields")) && !/M197 18/.test(bgOf("d-shields")));
    // Stream Deck + (type 7): four dials, so its strip ends at the fourth.
    let c0;
    const PLUS = "DEV-PLUS";
    sd.send(ev.device(PLUS, 7, 4, 2, "Stream Deck +"));
    sd.send(ev.appear(A.dial, "p-d3", PLUS, { dial: DIAL.scenes }, { controller: "Encoder", column: 3 }));
    sd.send(ev.appear(A.dial, "p-d2", PLUS, { dial: DIAL.shields }, { controller: "Encoder", column: 2 }));
    await sleep(300);
    check("Stream Deck + strip: the end bracket on dial 4", /M197 18V3H182/.test(bgOf("p-d3")) && !/M197 18/.test(bgOf("p-d2")));
    c0 = sd.mark();
    turn([A.dial, "p-d3", PLUS, { dial: DIAL.scenes }, { column: 3 }], -1);
    const swPlus = await sd.waitFor((m) => m.event === "switchToProfile" && m.device === PLUS, 2000, c0).catch(() => null);
    check("  ...and its scene dial picks the Stream Deck + profile", swPlus && swPlus.payload.profile === "profiles/Tablet Deck Stream Deck +", JSON.stringify(swPlus && swPlus.payload));
    sd.send(ev.disappear(A.dial, "p-d3", PLUS, {}, { controller: "Encoder", column: 3 }));
    sd.send(ev.disappear(A.dial, "p-d2", PLUS, {}, { controller: "Encoder", column: 2 }));

    console.log("\nKeys");
    let e0 = stream.mark();
    press(keys.gear, "keyDown"); await sleep(80); press(keys.gear, "keyUp");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "pl-gear", e0).length);
    await sleep(400);
    const gearPresses = stream.find((e) => e.t === "press" && e.id === "pl-gear", e0);
    check("a tap sends one press", gearPresses.length === 1 && gearPresses[0].kind === "tap", JSON.stringify(gearPresses));
    await within(2000, () => /DEPLOYED/.test(lastImage(sd, "k-gear")) && /DEPLOYED/.test(lastImage(sd, "k15-gear")));
    check("the shared state lights the key on both decks (DEPLOYED)", /DEPLOYED/.test(lastImage(sd, "k-gear")) && /DEPLOYED/.test(lastImage(sd, "k15-gear")));

    e0 = stream.mark();
    c0 = sd.mark();
    press(keys.qt, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length);
    await sleep(1500);
    check("a hold key spools then shows ENGAGED while held", /ENGAGED/.test(lastImage(sd, "k-qt")));
    const chargeFrames = sd.find((m) => m.event === "setImage" && m.context === "k-qt", c0).length;
    check("the charge plays as frames", chargeFrames >= 6, `${chargeFrames} frames`);
    press(keys.qt, "keyUp");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length);
    const qt = stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).map((e) => e.kind);
    check("hold: one down on keyDown, one up on keyUp", qt.join() === "down,up", qt.join());

    // Two keys holding the same button: one down, one up.
    e0 = stream.mark();
    press(keys.qt, "keyDown"); await sleep(60); press(keys.qt2, "keyDown"); await sleep(200);
    press(keys.qt, "keyUp"); await sleep(200);
    const mid = stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).map((e) => e.kind).join();
    press(keys.qt2, "keyUp"); await sleep(300);
    const both = stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).map((e) => e.kind).join();
    check("two keys on one hold button: down once, up when the last lets go", mid === "down" && both === "down,up", `${mid} / ${both}`);

    // Releases on willDisappear, deviceDidDisconnect, systemDidWakeUp.
    for (const [name, trigger, restore] of [
      ["willDisappear", () => sd.send(ev.disappear(...keys.qt.slice(0, 4), keys.qt[4])), () => appear(keys.qt)],
      ["deviceDidDisconnect", () => sd.send({ event: "deviceDidDisconnect", device: XL }), () => sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"))],
      ["systemDidWakeUp", () => sd.send({ event: "systemDidWakeUp" }), () => {}],
    ]) {
      e0 = stream.mark();
      press(keys.qt, "keyDown");
      await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length);
      trigger();
      await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length);
      const kinds = stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).map((e) => e.kind).join();
      check(`a hold is released on ${name}`, kinds === "down,up", kinds);
      press(keys.qt, "keyUp"); // the key comes up later: nothing more is sent
      await sleep(250);
      check(`  ...and the late keyUp sends nothing more`, stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).length === 2);
      restore();
      await sleep(150);
    }

    // A timed button (Max Weapons) is one tap; the server holds it for its ms.
    e0 = stream.mark();
    press(keys.maxw, "keyDown"); await sleep(60); press(keys.maxw, "keyUp");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "pw-wep-max", e0).length);
    const maxw = stream.find((e) => e.t === "press" && e.id === "pw-wep-max", e0);
    check("a timed button is one timed press", maxw.length === 1 && maxw[0].kind === "timed", JSON.stringify(maxw));

    // Doors: the state's own effect plays when the server says OPEN.
    c0 = sd.mark();
    press(keys.doors, "keyDown"); await sleep(60); press(keys.doors, "keyUp");
    await within(2000, () => /OPEN</.test(lastImage(sd, "k-doors")));
    check("doors slide (OPENING…) then show OPEN", sd.find((m) => m.event === "setImage" && m.context === "k-doors", c0).some((m) => /OPENING…/.test(svgOf(m))) && /OPEN</.test(lastImage(sd, "k-doors")));

    console.log("\nHold to Talk");
    e0 = stream.mark();
    press(keys.talk, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "voice" && e.result === "listen", e0).length);
    press(keys.talk, "keyUp");
    await within(2000, () => stream.find((e) => e.t === "voice" && e.result === "stop", e0).length);
    const voice = stream.find((e) => e.t === "voice", e0).map((e) => e.result).join();
    check("voice on while held, off on release", voice === "listen,stop", voice);
    await within(2000, () => /VOICE OFF/.test(lastImage(sd, "x-talk")));
    check("the PC's 'voice off' answer shows on the key", /VOICE OFF/.test(lastImage(sd, "x-talk")));
    proxy.inject({ t: "listening", on: true });
    await within(2000, () => /LISTENING/.test(lastImage(sd, "x-talk")));
    check("PC push-to-talk lights the key (LISTENING)", /LISTENING/.test(lastImage(sd, "x-talk")));
    proxy.inject({ t: "listening", on: false });
    e0 = stream.mark();
    press(keys.talk, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "voice" && e.result === "listen", e0).length);
    sd.send(ev.disappear(...keys.talk.slice(0, 4), keys.talk[4]));
    await within(2000, () => stream.find((e) => e.t === "voice" && e.result === "stop", e0).length);
    check("talk is released on willDisappear", stream.find((e) => e.t === "voice", e0).map((e) => e.result).join() === "listen,stop");
    appear(keys.talk);

    console.log("\nDials");
    e0 = stream.mark();
    c0 = sd.mark();
    turn(dials.weapons, 3);
    await within(3000, () => stream.find((e) => e.t === "press" && e.id === "pw-wep-up", e0).length >= 3);
    await sleep(400);
    const ups = stream.find((e) => e.t === "press" && e.id === "pw-wep-up", e0);
    check("3 detents clockwise = 3 presses of the cw button", ups.length === 3, `${ups.length}`);
    const gaps = ups.slice(1).map((e, i) => e.time - ups[i].time);
    check("  ...each a separate press (spaced so the game sees three)", gaps.every((g) => g >= 100), gaps.join(","));
    check("  ...and the strip shows the word with a count", /^\+ ×3$/.test(lastValue(sd, "d-weapons", c0)), lastValue(sd, "d-weapons", c0));
    e0 = stream.mark();
    turn(dials.weapons, -8);
    await within(3000, () => stream.find((e) => e.t === "press" && e.id === "pw-wep-down", e0).length >= 5);
    await sleep(800);
    check("8 detents the other way are capped at 5 presses", stream.find((e) => e.t === "press" && e.id === "pw-wep-down", e0).length === 5);
    e0 = stream.mark();
    turn(dials.weapons, 5); await sleep(30); turn(dials.weapons, -1);
    await sleep(1200);
    const afterFlip = stream.find((e) => e.t === "press" && (e.id === "pw-wep-up" || e.id === "pw-wep-down"), e0).map((e) => e.id === "pw-wep-up" ? "+" : "-").join("");
    check("turning back drops the detents still waiting", /^\+{1,2}-$/.test(afterFlip), afterFlip);
    e0 = stream.mark();
    dialEv(dials.weapons, "dialDown"); await sleep(60); dialEv(dials.weapons, "dialUp");
    sd.send(ev.dial("touchTap", ...dials.weapons.slice(0, 4), { column: 0, tapPos: [100, 50], hold: false }));
    await within(3000, () => stream.find((e) => e.t === "press" && e.id === "pw-wep-max", e0).length >= 2);
    check("a push and a touch each press the dial's press button", stream.find((e) => e.t === "press" && e.id === "pw-wep-max", e0).length === 2);
    e0 = stream.mark();
    c0 = sd.mark();
    turn(dials.volume, 2);
    await sleep(500);
    check("a dial on Stream Deck's own media actions presses nothing, and alerts", stream.find((e) => e.t === "press", e0).length === 0 && sd.find((m) => m.event === "showAlert" && m.context === "d-volume", c0).length === 1);

    console.log("\nScenes");
    c0 = sd.mark();
    turn(dials.scenes, 1);
    const sw = await sd.waitFor((m) => m.event === "switchToProfile", 2000, c0).catch(() => null);
    check("the scene dial switches to the + XL profile's next page", sw && sw.payload.profile === "profiles/Tablet Deck Stream Deck + XL" && sw.payload.page === 1 && sw.device === XL && sw.context === sd.pluginUUID, JSON.stringify(sw));
    await within(1000, () => lastValue(sd, "d-scenes") === "COMBAT");
    check("  ...and shows the new scene", lastValue(sd, "d-scenes") === "COMBAT", lastValue(sd, "d-scenes"));
    check("  ...and the combat tab lights", /ACTIVE/.test(lastImage(sd, "s-combat")) && !/ACTIVE/.test(lastImage(sd, "s-flight")));
    c0 = sd.mark();
    press(keys.combat15, "keyDown"); press(keys.combat15, "keyUp");
    const sw15 = await sd.waitFor((m) => m.event === "switchToProfile", 2000, c0).catch(() => null);
    check("a scene key on the 15-key picks its own profile", sw15 && sw15.payload.profile === "profiles/Tablet Deck Stream Deck" && sw15.payload.page === 1 && sw15.device === STD, JSON.stringify(sw15));
    const s0 = proxy.mark();
    const t0 = tabletMsgs.length;
    press(keys.flight, "keyDown"); press(keys.flight, "keyUp");
    await sleep(400);
    check("with 'Tablets follow scenes' off, nothing goes to the tablets", proxy.find((m) => m.t === "scene", s0).length === 0 && !tabletMsgs.slice(t0).some((m) => m.t === "scene"));
    sd.globals = { ...sd.globals, follow: true };
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: sd.globals } });
    await sleep(100);
    press(keys.combat, "keyDown"); press(keys.combat, "keyUp");
    await within(2000, () => tabletMsgs.slice(t0).some((m) => m.t === "scene"));
    const relayed = tabletMsgs.slice(t0).find((m) => m.t === "scene");
    check("with it on, a tablet gets the scene and its panels", relayed && relayed.scene === "combat" && relayed.left === "shields" && relayed.right === "combat", JSON.stringify(relayed));

    console.log("\nThemes and lights");
    c0 = sd.mark();
    press(keys.drake, "keyDown"); press(keys.drake, "keyUp");
    const gs = await sd.waitFor((m) => m.event === "setGlobalSettings", 2000, c0).catch(() => null);
    check("a theme key sets the global theme", gs && gs.payload.theme === "drake" && gs.context === sd.pluginUUID && gs.payload.follow === true, JSON.stringify(gs && gs.payload));
    await sleep(900);
    const drakeAccent = data.themes.drake.accent;
    const redrawn = Object.values(keys).filter((k) => k[2] === XL || k[2] === STD).filter((k) => sd.find((m) => m.event === "setImage" && m.context === k[1], c0).length);
    check("every key redraws in the new theme", redrawn.length === Object.keys(keys).length, `${redrawn.length}/${Object.keys(keys).length}`);
    check("  ...in its colours", lastImage(sd, "k-decoy").includes(drakeAccent));
    check("  ...and every dial too", Object.values(dials).every((d) => feedbacks(sd, d[1], c0).some((p) => p.bg)));
    check("the active theme key is lit", /ACTIVE/.test(lastImage(sd, "t-drake")));
    e0 = stream.mark();
    press(keys.lights, "keyDown"); press(keys.lights, "keyUp");
    await within(2000, () => /RETRACTED/.test(lastImage(sd, "k-gear")));
    check("Reset Lights clears the shared states (gear back to RETRACTED)", /RETRACTED/.test(lastImage(sd, "k-gear")) && /CLOSED/.test(lastImage(sd, "k-doors")));

    console.log("\nSkipped presses");
    c0 = sd.mark();
    proxy.inject({ t: "blocked", id: "cb-decoy" });
    const red = data.themes.drake.red;
    await within(1500, () => lastImage(sd, "k-decoy", c0).includes(`stroke="${red}" stroke-width="2.6"`));
    check("a blocked press flashes the key red", lastImage(sd, "k-decoy", c0).includes(`stroke="${red}" stroke-width="2.6"`));
    await sleep(1000);
    check("  ...and the flash ends", !lastImage(sd, "k-decoy").includes(`stroke="${red}" stroke-width="2.6"`));
    c0 = sd.mark();
    proxy.inject({ t: "blocked", id: "pw-wep-up" });
    await sleep(300);
    check("a blocked dial press alerts on the strip and says NOT FOCUSED", sd.find((m) => m.event === "showAlert" && m.context === "d-weapons", c0).length === 1 && feedbacks(sd, "d-weapons", c0).some((p) => p.value && p.value.value === "NOT FOCUSED"));

    console.log("\nAnimations");
    c0 = sd.mark();
    for (let i = 0; i < 6; i++) { press(keys.decoy, "keyDown"); press(keys.decoy, "keyUp"); await sleep(70); }
    await sleep(1200);
    const decoyFrames = sd.find((m) => m.event === "setImage" && m.context === "k-decoy", c0).length;
    check("burst frames play", decoyFrames >= 5, `${decoyFrames}`);
    const worstKey = maxPerSecond(sd, ["setImage"]);
    const worstStrip = maxPerSecond(sd, ["setFeedback"]);
    check("no key ever gets more than 10 setImage a second", worstKey.n <= 10, JSON.stringify(worstKey));
    check("no strip ever gets more than 10 setFeedback a second", worstStrip.n <= 10, JSON.stringify(worstStrip));
    sd.globals = { ...sd.globals, motion: false };
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: sd.globals } });
    await sleep(200);
    c0 = sd.mark();
    press(keys.decoy, "keyDown"); press(keys.decoy, "keyUp");
    await sleep(900);
    const still = sd.find((m) => m.event === "setImage" && m.context === "k-decoy", c0).length;
    check("with Key animations off, a press is a still redraw, not frames", still <= 2, `${still}`);
    sd.globals = { ...sd.globals, motion: true };
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: sd.globals } });

    console.log("\nThe Tablet Deck link");
    // Cut with a reset (the network going away): the server lets go at once.
    e0 = stream.mark();
    let p0 = proxy.mark();
    press(keys.qt, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length);
    proxy.drop({ reset: true });
    const cutAt = Date.now();
    await within(2000, () => stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length);
    const goneAfter = Date.now() - cutAt;
    check("a link reset mid-hold: the server drops the client (and its held keys) at once", stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length === 1 && goneAfter < 1000, `${goneAfter} ms`);
    await within(900, () => lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    check("  ...keys show the offline mark", lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    await within(5000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length);
    check("  ...the plugin connects again", stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length === 1);
    await within(2000, () => !lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    check("  ...and the offline mark goes", !lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    press(keys.qt, "keyUp");
    await sleep(300);
    check("  ...the key coming up later sends no stale up (the server let go already)", proxy.find((m) => m.t === "up", p0).length === 0 && proxy.find((m) => m.t === "down", p0).length === 1);
    check("  ...no key stays down on the server", stuckKeys(server.log).length === 0, JSON.stringify(stuckKeys(server.log)));

    // Cut with a normal close (FIN, as when a process dies): the plugin notices at once; the
    // server only through its 5 s watchdog (see the report: it ignores a client's FIN).
    e0 = stream.mark();
    p0 = proxy.mark();
    press(keys.qt, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length);
    proxy.drop();
    const finAt = Date.now();
    await within(900, () => lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    check("a link closed mid-hold: keys show the offline mark at once", lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    await within(8000, () => stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length);
    const finGone = Date.now() - finAt;
    check("  ...the server lets go of the old link's keys (by its watchdog)", stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length === 1, `${finGone} ms`);
    console.log(`        (the server noticed the closed link after ${finGone} ms)`);
    press(keys.qt, "keyUp");
    await sleep(300);
    check("  ...no key stays down on the server", stuckKeys(server.log).length === 0, JSON.stringify(stuckKeys(server.log)));
    await within(3000, () => /\d+ MS/.test(lastImage(sd, "x-status")));

    e0 = stream.mark();
    proxy.hush(); // the link goes quiet without closing
    const quietAt = Date.now();
    await within(9000, () => lastImage(sd, "x-status").includes(OFFLINE_MARK) || /CONNECTING/.test(lastImage(sd, "x-status")));
    const noticed = Date.now() - quietAt;
    // 5 s after the last answer, which came up to one heartbeat (1.5 s) before the hush.
    check("a link that goes quiet is given up 5 s after the last answer", noticed >= 3400 && noticed < 8000, `${noticed} ms`);
    await within(6000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length);
    check("  ...and the plugin connects again", stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length >= 1);
    await within(3000, () => /\d+ MS/.test(lastImage(sd, "x-status")));

    console.log("\nOffline presses");
    // While not connected nothing is sent or kept for later.
    proxy.drop();
    await within(2000, () => lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    p0 = proxy.mark();
    c0 = sd.mark();
    press(keys.gear, "keyDown"); press(keys.gear, "keyUp");
    await sleep(100);
    check("a press while offline alerts and isn't saved for later", sd.find((m) => m.event === "showAlert" && m.context === "k-gear", c0).length === 1 || lastImage(sd, "k-gear").includes(OFFLINE_MARK));
    await within(5000, () => /\d+ MS/.test(lastImage(sd, "x-status")));
    await sleep(500);
    check("  ...nothing is pressed once it's back", proxy.find((m) => m.t === "tap" || m.t === "down", p0).length === 0);

    const dialCtx = new Set(sd.commands.filter((c) => c.msg.event === "setFeedback" || c.msg.event === "setTriggerDescription").map((c) => c.msg.context));
    const keyCtx = new Set(sd.commands.filter((c) => c.msg.event === "setImage").map((c) => c.msg.context));
    check("setImage only goes to keys, setFeedback only to dials, no setTitle or setState", [...dialCtx].every((c) => /^(d-|p-d)/.test(c)) && [...keyCtx].every((c) => !/^(d-|p-d)/.test(c)) && !sd.find((m) => m.event === "setTitle" || m.event === "setState").length);
    check("plugin-wide commands use the plugin UUID as context", sd.find((m) => ["setGlobalSettings", "getGlobalSettings", "switchToProfile"].includes(m.event)).every((m) => m.context === sd.pluginUUID));
    check("the pairing code never goes into action settings or logs", !JSON.stringify(sd.commands.filter((c) => c.msg.event === "setSettings" || c.msg.event === "logMessage")).includes(token));

    console.log("\nStream Deck closing");
    e0 = stream.mark();
    press(keys.qt, "keyDown");
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length);
    sd.closeSocket();
    const code = await Promise.race([sd.exited, sleep(4000).then(() => "timeout")]);
    await within(2000, () => stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length);
    check("closing the Stream Deck socket mid-hold releases the hold", stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).map((e) => e.kind).join() === "down,up");
    check("  ...and the plugin exits cleanly", code === 0, String(code));
    await within(2000, () => stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length);
    check("  ...after closing its Tablet Deck link", stream.find((e) => e.t === "client" && !e.on && e.device === "streamdeck", e0).length === 1);
    sd.server.close();
    sd = null;

    console.log("\nPairing without config.json");
    const empty = path.join(tmp, "appdata-empty");
    fs.mkdirSync(empty);
    for (const [name, globals, expect] of [
      ["no code anywhere shows NOT PAIRED", {}, /NOT PAIRED/],
      ["a wrong code shows WRONG CODE", { port, code: "00000000" }, /WRONG CODE/],
      ["the property inspector's port and code connect", { port, code: token }, /\d+ MS/],
    ]) {
      const f = new FakeStreamDeck({ pluginDir, env: { APPDATA: empty } });
      f.globals = globals;
      e0 = stream.mark();
      await f.start();
      f.send(ev.device(STD, 0, 5, 3, "Stream Deck"));
      f.send(ev.appear(A.status, "x-status", STD, {}));
      await within(5000, () => expect.test(lastImage(f, "x-status")));
      check(name, expect.test(lastImage(f, "x-status")), lastImage(f, "x-status").match(/>[A-Z0-9 …]+</g)?.join(" "));
      await f.stop();
    }

    console.log("\nAt the end");
    await sleep(500);
    const allowed = new Set(["hb", "tap", "down", "up", "voice", "reset-states", "scene"]);
    const kinds = new Set(proxy.sent.map((x) => x.msg.t));
    check("the plugin only ever sent Tablet Deck heartbeats, presses, releases, voice, reset and scenes", [...kinds].every((k) => allowed.has(k)), [...kinds].join(","));
    check("every key the server pressed was released", stuckKeys(server.log).length === 0, JSON.stringify(stuckKeys(server.log)));
  } finally {
    if (sd) await sd.stop().catch(() => {});
    if (tabletWs) tabletWs.close();
    if (proxy) proxy.close();
    if (stream) stream.close();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
