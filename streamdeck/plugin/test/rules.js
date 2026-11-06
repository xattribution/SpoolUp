// Ground-rule edge cases for the Stream Deck plugin, timed at the key level: a dry-run
// Tablet Deck server prints "  key d|u <code> <ext>" for every key it would send, and this
// test stamps each line as it arrives, so it can tell two presses from one merged press
// (the server reference-counts keys, so overlapping taps of a shared key reach the game as
// one press). Complements run.js; written for the review of the plugin.
//
//   node streamdeck/plugin/test/rules.js [--port 8870]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const { FakeStreamDeck, ev } = require("./fake-streamdeck");
const { write: writeData, REPO } = require("./make-test-data");

// TD_PLUGIN_SRC tests another copy of the plugin folder (a patched or unpacked one).
const SRC = process.env.TD_PLUGIN_SRC || path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");
const U = "com.nodiecode.tabletdeck";
const A = { key: `${U}.key`, dial: `${U}.dial`, scene: `${U}.scene`, talk: `${U}.talk`, lights: `${U}.lights`, status: `${U}.status` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0, passes = 0;
function check(name, ok, detail = "") {
  if (ok) { passes++; console.log(`  ok    ${name}`); } else { failures++; console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`); }
}
async function within(ms, test, step = 25) {
  const end = Date.now() + ms;
  for (;;) { const v = test(); if (v) return v; if (Date.now() > end) return null; await sleep(step); }
}

function freePort(from = 8870, to = 8899) {
  const wanted = process.argv.includes("--port") ? [Number(process.argv[process.argv.indexOf("--port") + 1])] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return new Promise((resolve, reject) => {
    const next = (i) => {
      if (i >= wanted.length) { reject(new Error("no free port")); return; }
      const s = net.createServer().once("error", () => next(i + 1)).listen(wanted[i], "127.0.0.1", () => s.close(() => resolve(wanted[i])));
    };
    next(0);
  });
}

// The server, with every "key d/u" line stamped on arrival.
function startServer(port) {
  const proc = spawn(process.execPath, ["server.js", "--dry-run", "--port", String(port)], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
  proc.log = "";
  proc.keys = []; // { time, dir, code }
  let rest = "";
  proc.stdout.on("data", (d) => {
    const now = Date.now();
    proc.log += d;
    rest += d;
    const lines = rest.split("\n");
    rest = lines.pop();
    for (const l of lines) { const m = /^ {2}key ([du]) (\S+ \S+)$/.exec(l); if (m) proc.keys.push({ time: now, dir: m[1], code: m[2] }); }
  });
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

// f5 is 3f 0 and lalt is 38 0 in the server's scancode table.
const F5 = "3f 0";
const downs = (server, code, from) => server.keys.slice(from).filter((k) => k.code === code && k.dir === "d").length;
const held = (server) => { const m = new Map(); for (const k of server.keys) m.set(k.code, (m.get(k.code) || 0) + (k.dir === "d" ? 1 : -1)); return [...m].filter(([, n]) => n); };

async function main() {
  const token = JSON.parse(fs.readFileSync(path.join(REPO, "config.json"), "utf8")).token;
  const port = await freePort();
  const server = startServer(port);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-rules-"));
  const pluginDir = path.join(tmp, `${U}.sdPlugin`);
  fs.cpSync(SRC, pluginDir, { recursive: true });
  writeData(pluginDir);
  const DIAL = JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "scenes.json"), "utf8")).DIAL;
  let sd = null, stream = null;
  try {
    if (!(await within(8000, () => / running \(/.test(server.log), 100))) throw new Error("server didn't start");
    await sleep(300);
    stream = await events(port, token);
    const appdata = path.join(tmp, "appdata");
    fs.mkdirSync(path.join(appdata, "TabletDeck"), { recursive: true });
    fs.writeFileSync(path.join(appdata, "TabletDeck", "config.json"), JSON.stringify({ port, token }));

    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: appdata } });
    await sd.start();
    const XL = "DEV-PLUSXL";
    sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"));
    const weapons = [A.dial, "d-weapons", XL, { dial: DIAL.weapons }, { controller: "Encoder", column: 0 }];
    const timedDial = [A.dial, "d-timed", XL, { dial: { label: "Max", icon: "chev-max", color: "red", ccw: "", cw: "pw-wep-max", press: "" } }, { controller: "Encoder", column: 1 }];
    const qt = [A.key, "k-qt", XL, { action: "qt-engage" }, { column: 6, row: 1 }];
    for (const x of [weapons, timedDial, qt]) sd.send(ev.appear(x[0], x[1], x[2], x[3], x[4]));
    const turn = (d, ticks) => sd.send(ev.dial("dialRotate", d[0], d[1], d[2], d[3], { column: d[4].column, ticks, pressed: false }));
    const dialEv = (d, event) => sd.send(ev.dial(event, d[0], d[1], d[2], d[3], { column: d[4].column }));
    if (!(await within(6000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck")[0]))) throw new Error("plugin didn't connect");
    await sleep(400);

    console.log("\nDial detents are separate presses");
    // Weapons + is F5, Weapons − is LAlt+F5: a turn back right after a turn shares F5.
    let k0 = server.keys.length;
    turn(weapons, 1);
    await sleep(10);
    turn(weapons, -1);
    await sleep(900);
    const f5a = downs(server, F5, k0);
    check("a turn back 10 ms after a turn: F5 goes down twice (two presses, not one merged)", f5a === 2, `F5 went down ${f5a} time(s); key log: ${server.keys.slice(k0).map((k) => `${k.dir} ${k.code} @${k.time - server.keys[k0].time}`).join(", ")}`);

    // A push (Max Weapons, F5 held 900 ms) right after a turn (Weapons +, F5).
    k0 = server.keys.length;
    turn(weapons, 1);
    await sleep(10);
    dialEv(weapons, "dialDown");
    await sleep(30);
    dialEv(weapons, "dialUp");
    await sleep(1400);
    const f5b = downs(server, F5, k0);
    check("a push 10 ms after a turn: F5 goes down twice", f5b === 2, `F5 went down ${f5b} time(s)`);

    // A dial whose turn is a timed button (Max Weapons holds F5 for 900 ms).
    k0 = server.keys.length;
    let e0 = stream.mark();
    turn(timedDial, 3);
    await sleep(4500);
    const taps = stream.find((e) => e.t === "press" && e.id === "pw-wep-max", e0).length;
    const f5c = downs(server, F5, k0);
    check("three detents of a timed button: three presses reach the game", f5c === 3, `${taps} taps sent, F5 went down ${f5c} time(s)`);

    // Two dials turned together (two hands on a + XL): Weapons + (F5) and Shields −
    // (LAlt+F7). If an F5 goes down while LAlt is down, the game reads LAlt+F5: Weapons −.
    const shields = [A.dial, "d-shields", XL, { dial: DIAL.shields }, { controller: "Encoder", column: 3 }];
    sd.send(ev.appear(shields[0], shields[1], shields[2], shields[3], shields[4]));
    await sleep(300);
    k0 = server.keys.length;
    turn(weapons, 3);
    turn(shields, -3);
    await sleep(1500);
    let lalt = 0, wrong = 0;
    for (const k of server.keys.slice(k0)) {
      if (k.code === "38 0") lalt += k.dir === "d" ? 1 : -1;
      if (k.code === F5 && k.dir === "d" && lalt > 0) wrong++;
    }
    check("two dials turned together: no F5 goes down while LAlt is held (no Weapons − from a Weapons + detent)", wrong === 0, `${wrong} of ${downs(server, F5, k0)} F5 presses landed under LAlt`);

    // The scene dial spun fast: every dialRotate is a profile switch, and each switch
    // redraws the whole page (36 keys and 6 strips on a + XL).
    const scenesDial = [A.dial, "d-scenes", XL, { dial: DIAL.scenes }, { controller: "Encoder", column: 5 }];
    sd.send(ev.appear(scenesDial[0], scenesDial[1], scenesDial[2], scenesDial[3], scenesDial[4]));
    await sleep(200);
    let m0 = sd.mark();
    for (let i = 0; i < 20; i++) { turn(scenesDial, 1); await sleep(50); }
    await sleep(300);
    const switches = sd.find((m) => m.event === "switchToProfile", m0).length;
    check("the scene dial spun for a second (20 events): at most 5 profile switches", switches <= 5, `${switches} switchToProfile`);

    console.log("\nHolds are released");
    const press = (k, event) => sd.send(ev.key(event, k[0], k[1], k[2], k[3]));
    const qtB = [A.key, "k-qt-b", "DEV-15", { action: "qt-engage" }, { column: 0, row: 0 }];
    sd.send(ev.device("DEV-15", 0, 5, 3, "Stream Deck"));
    sd.send(ev.appear(qtB[0], qtB[1], qtB[2], qtB[3], qtB[4]));
    await sleep(200);

    // Two decks hold one hold button; one is unplugged: still held until the other lets go.
    e0 = stream.mark();
    press(qt, "keyDown");
    press(qtB, "keyDown");
    await sleep(300);
    sd.send({ event: "deviceDidDisconnect", device: "DEV-15" });
    await sleep(300);
    const upEarly = stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length;
    press(qt, "keyUp");
    await sleep(300);
    const dn = stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "down", e0).length;
    const upn = stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length;
    check("two decks on one hold, one unplugged: one down, and the up only when the other lets go", dn === 1 && upEarly === 0 && upn === 1, `down ${dn}, up before ${upEarly}, up ${upn}`);
    press(qtB, "keyUp");
    await sleep(200);
    check("  ...the unplugged deck's late keyUp sends nothing", stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).length === 2);

    // The pairing code changes mid-hold (the link is rebuilt): Tablet Deck lets go at once.
    k0 = server.keys.length;
    press(qt, "keyDown");
    await within(2000, () => server.keys.slice(k0).some((k) => k.dir === "d"));
    let t0 = Date.now();
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: { code: "00000000" } } });
    let upAt = await within(6000, () => server.keys.slice(k0).find((k) => k.dir === "u"));
    check("a new code in the inspector mid-hold: the server lets go within 1 s", upAt && upAt.time - t0 < 1000, upAt ? `${upAt.time - t0} ms` : "never");
    const back = await within(8000, () => stream.list.find((e) => e.t === "client" && e.on && e.device === "streamdeck" && e.time >= t0));
    check("  ...and the plugin connects again (from config.json, the new code being wrong)", Boolean(back));
    e0 = stream.mark();
    press(qt, "keyUp");
    await sleep(300);
    check("  ...the keyUp after the new link sends no stale up", !stream.find((e) => e.t === "press" && e.id === "qt-engage", e0).length);

    // A dial push on a hold button, then the page changes under it.
    const holdDial = [A.dial, "d-hold", XL, { dial: { label: "QT", icon: "quantum", color: "blue", ccw: "", cw: "", press: "qt-engage" } }, { controller: "Encoder", column: 2 }];
    sd.send(ev.appear(holdDial[0], holdDial[1], holdDial[2], holdDial[3], holdDial[4]));
    await sleep(200);
    e0 = stream.mark();
    k0 = server.keys.length;
    dialEv(holdDial, "dialDown");
    await sleep(300);
    sd.send(ev.disappear(holdDial[0], holdDial[1], holdDial[2], holdDial[3], { controller: "Encoder", column: 2 }));
    await sleep(400);
    check("a dial held down on a hold button, then the page changes: released", stream.find((e) => e.t === "press" && e.id === "qt-engage" && e.kind === "up", e0).length === 1, JSON.stringify(stream.find((e) => e.t === "press", e0).map((e) => e.kind)));

    // Stream Deck crashes: its socket goes away with no close frame.
    k0 = server.keys.length;
    press(qt, "keyDown");
    await within(2000, () => server.keys.slice(k0).some((k) => k.dir === "d"));
    t0 = Date.now();
    sd.plugin.destroy();
    upAt = await within(6000, () => server.keys.slice(k0).find((k) => k.dir === "u"));
    check("Stream Deck's socket dropped without a close frame mid-hold: released within 1 s", upAt && upAt.time - t0 < 1000, upAt ? `${upAt.time - t0} ms` : "never");
    const code = await Promise.race([sd.exited, sleep(3000).then(() => "running")]);
    check("  ...and the plugin exits", code === 0, String(code));
    try { sd.server.close(); } catch { /* gone */ }

    // The plugin process killed mid-hold (no close frames at all): only the server can help.
    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: appdata } });
    await sd.start();
    sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"));
    sd.send(ev.appear(qt[0], qt[1], qt[2], qt[3], qt[4]));
    e0 = stream.mark();
    await within(6000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length);
    await sleep(500);
    k0 = server.keys.length;
    press(qt, "keyDown");
    await within(2000, () => server.keys.slice(k0).some((k) => k.dir === "d"));
    const tDown = Date.now();
    sd.child.kill("SIGKILL");
    const up = await within(9000, () => server.keys.slice(k0).find((k) => k.dir === "u"));
    check("the plugin killed mid-hold: the key comes up within 1 s (needs the server change)", up && up.time - tDown < 1000, up ? `came up after ${up.time - tDown} ms` : "never came up");
    await sleep(300);
    check("no key left down", !held(server).length, JSON.stringify(held(server)));
  } finally {
    if (sd) { try { sd.server.close(); } catch { /* gone */ } }
    if (stream) stream.close();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(2); });
