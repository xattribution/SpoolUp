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
  const { DIAL, SCENES } = JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "scenes.json"), "utf8"));
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
    const press = (k, event) => sd.send(ev.key(event, k[0], k[1], k[2], k[3]));
    // How many F5 presses went down while LAlt was held (the game reads those as LAlt+F5).
    const underLalt = (from) => {
      let lalt = 0, wrong = 0;
      for (const k of server.keys.slice(from)) {
        if (k.code === "38 0") lalt += k.dir === "d" ? 1 : -1;
        if (k.code === F5 && k.dir === "d" && lalt > 0) wrong++;
      }
      return wrong;
    };
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
    let wrong = underLalt(k0);
    check("two dials turned together: no F5 goes down while LAlt is held (no Weapons − from a Weapons + detent)", wrong === 0, `${wrong} of ${downs(server, F5, k0)} F5 presses landed under LAlt`);

    // One hand on the keys, one on the dials: Weapons + pressed on a key (F5) just after a
    // Shields − detent (LAlt+F7).
    const wepKey = [A.key, "k-wep", XL, { action: "pw-wep-up" }, { column: 0, row: 3 }];
    sd.send(ev.appear(wepKey[0], wepKey[1], wepKey[2], wepKey[3], wepKey[4]));
    await sleep(200);
    k0 = server.keys.length;
    turn(shields, -2);
    await sleep(30);
    press(wepKey, "keyDown");
    press(wepKey, "keyUp");
    await sleep(1200);
    wrong = underLalt(k0);
    check("a key pressed while a dial turns: its F5 goes down once, and not under the dial's LAlt", wrong === 0 && downs(server, F5, k0) === 1, `${downs(server, F5, k0)} F5 presses, ${wrong} under LAlt`);

    // The same key pressed three times quickly: three presses, not one long one.
    k0 = server.keys.length;
    for (let i = 0; i < 3; i++) { press(wepKey, "keyDown"); press(wepKey, "keyUp"); await sleep(40); }
    await sleep(1000);
    check("a key pressed three times in 120 ms: F5 goes down three times", downs(server, F5, k0) === 3, `${downs(server, F5, k0)} time(s)`);

    // Nine keys pressed in the same instant (no hand does that): one goes at once and four
    // wait their turn; the other four alert instead of being pressed seconds later.
    const row = ["cb-decoy", "cb-noise", "fa-lights", "pl-gear", "tg-hostile", "tg-attacker", "cm-hail", "op-scan", "mn-fire"].map((id, c) => [A.key, `k-row-${c}`, XL, { action: id }, { column: c, row: 2 }]);
    for (const k of row) sd.send(ev.appear(k[0], k[1], k[2], k[3], k[4]));
    await sleep(300);
    e0 = stream.mark();
    let b0 = sd.mark();
    for (const k of row) { press(k, "keyDown"); press(k, "keyUp"); }
    await sleep(2500);
    const rowTaps = stream.find((e) => e.t === "press" && row.some((k) => k[3].action === e.id), e0);
    const rowAlerts = sd.find((m) => m.event === "showAlert" && m.context.startsWith("k-row-"), b0).length;
    const apart = rowTaps.every((e, i) => !i || e.time - rowTaps[i - 1].time >= 100);
    check("nine keys pressed at once: five are pressed, one at a time, and four alert", rowTaps.length === 5 && rowAlerts === 4 && apart, `${rowTaps.length} pressed (${rowTaps.map((e) => e.time - rowTaps[0].time).join(", ")} ms), ${rowAlerts} alerts`);

    // Three dials spun five detents at once, one of them a timed button (900 ms each): no
    // press goes more than 2 s after its turn; the rest are dropped, and the dial alerts.
    e0 = stream.mark();
    b0 = sd.mark();
    const spun = Date.now();
    turn(timedDial, 5);
    turn(weapons, 5);
    turn(shields, 5);
    await sleep(4000);
    const late = stream.find((e) => e.t === "press" && e.kind !== "up", e0).filter((e) => e.time - spun > 2100);
    const spunPresses = stream.find((e) => e.t === "press" && e.kind !== "up", e0);
    const dropped = sd.find((m) => m.event === "showAlert" && m.context.startsWith("d-"), b0).length;
    const everyDial = ["pw-wep-max", "pw-wep-up", "pw-shd-up"].every((id) => spunPresses.some((e) => e.id === id));
    check("three dials spun at once, one timed: each gets its turn, nothing is pressed more than 2 s late, and what can't go alerts", everyDial && !late.length && spunPresses.length < 15 && dropped >= 1, `${spunPresses.length} of 15 pressed (${spunPresses.map((e) => `${e.id} @${e.time - spun}`).join(", ")}), ${late.length} late, ${dropped} alerts`);

    // A dial on Stream Deck's own volume actions spun for a second: the plugin can't press
    // those, and it alerts, but not once for every tick.
    const volume = [A.dial, "d-volume", XL, { dial: DIAL.volume }, { controller: "Encoder", column: 4 }];
    sd.send(ev.appear(volume[0], volume[1], volume[2], volume[3], volume[4]));
    await sleep(200);
    const a0 = sd.mark();
    for (let i = 0; i < 20; i++) { turn(volume, 1); await sleep(50); }
    await sleep(100);
    const alerts = sd.find((m) => m.event === "showAlert" && m.context === "d-volume", a0).length;
    check("a dial the plugin can't press, spun for a second: at most 3 alerts", alerts >= 1 && alerts <= 3, `${alerts} alerts`);

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

    console.log("\nFollowing the tablet");
    // A tablet pages its HUD halves ({t:"panel"}); a Stream Deck showing a scene page of the
    // plugin's profile goes to the scene with that panel, one on a profile of the player's own
    // stays, and nothing goes back to the tablet (tablets follow scenes here, so an echo shows).
    const tabMsgs = [];
    const tab = new WebSocket(`ws://127.0.0.1:${port}/ws?t=${encodeURIComponent(token)}&device=tablet`);
    tab.onmessage = (e) => tabMsgs.push(JSON.parse(e.data));
    await within(3000, () => tab.readyState === WebSocket.OPEN);
    const tabBeat = setInterval(() => { if (tab.readyState === WebSocket.OPEN) tab.send(JSON.stringify({ t: "hb", n: 0 })); }, 1500);
    const panelTo = (side, panel) => tab.send(JSON.stringify({ t: "panel", side, panel }));
    const sceneIdx = (id) => SCENES.findIndex((s) => s.id === id);
    const switchesOn = (device, from) => sd.commands.slice(from).filter((c) => c.msg.event === "switchToProfile" && c.msg.device === device);
    const FD = "DEV-FOLLOW", OWN = "DEV-OWN";
    const onPage = (ctx, page) => [A.scene, ctx, FD, { scene: "combat", page }, { column: 4, row: 0 }];
    sd.send(ev.device(FD, 0, 5, 3, "Stream Deck"));
    sd.send(ev.device(OWN, 0, 5, 3, "Stream Deck"));
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: { follow: true } } });
    const show = (k) => sd.send(ev.appear(...k));
    const hide = (k) => sd.send(ev.disappear(...k));
    let fk = onPage("f-1", "flight");
    show(fk);
    sd.send(ev.appear(A.key, "o-gear", OWN, { action: "pl-gear" }, { column: 0, row: 0 }));
    await sleep(300);
    let p0 = sd.mark(), pt0 = tabMsgs.length;
    panelTo("right", "crew");
    const swH = await within(1500, () => switchesOn(FD, p0)[0]);
    check("a tablet's right half on Crew: the Stream Deck on the profile's Flight page goes to Hauling", swH && swH.msg.payload.page === sceneIdx("hauling") && swH.msg.payload.profile === "profiles/Tablet Deck Stream Deck", JSON.stringify(swH && swH.msg.payload));
    check("  ...the one on a profile of the player's own stays", !switchesOn(OWN, p0).length);
    // Stream Deck shows Hauling, with a page from before arriving late in between.
    hide(fk);
    show(onPage("f-late", "flight"));
    hide(onPage("f-late", "flight"));
    show((fk = onPage("f-2", "hauling")));
    await sleep(500);
    check("  ...and sends no scene back to the tablet, the late page included", !tabMsgs.slice(pt0).some((m) => m.t === "scene"), JSON.stringify(tabMsgs.slice(pt0).filter((m) => m.t !== "hb")));
    p0 = sd.mark();
    panelTo("right", "crew");
    panelTo("right", "modes");
    panelTo("left", "flight-assist");
    await sleep(600);
    check("already on its scene, several scenes (Modes) or none (Flight Assist): no switch", !switchesOn(FD, p0).length, `${switchesOn(FD, p0).length} switches`);
    // Stream Deck's own page keys move it a moment later: tablets are told again.
    await sleep(300);
    pt0 = tabMsgs.length;
    hide(fk);
    show((fk = onPage("f-3", "mining")));
    const told = await within(1500, () => tabMsgs.slice(pt0).find((m) => m.t === "scene"));
    check("  ...a page change on the Stream Deck itself still reaches the tablet", told && told.scene === "mining", JSON.stringify(told));
    p0 = sd.mark();
    panelTo("right", "systems");
    const swF = await within(1500, () => switchesOn(FD, p0)[0]);
    check("a phone's Systems panel (part of QT & Systems): Flight", swF && swF.msg.payload.page === sceneIdx("flight"), JSON.stringify(swF && swF.msg.payload));
    await sleep(300);
    p0 = sd.mark();
    panelTo("left", "shields");
    await sleep(50);
    panelTo("right", "comms");
    await sleep(800);
    const pair = switchesOn(FD, p0);
    check("two halves 50 ms apart: Combat, then Comms at least 250 ms later", pair.length === 2 && pair[0].msg.payload.page === sceneIdx("combat") && pair[1].msg.payload.page === sceneIdx("comms") && pair[1].time - pair[0].time >= 240, pair.map((c) => `${c.msg.payload.page} @${c.time - pair[0].time}`).join(", "));
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: { follow: true, followTablet: false } } });
    await sleep(300);
    p0 = sd.mark();
    panelTo("right", "crew");
    await sleep(600);
    check("with Follow the tablet off: no switch", !switchesOn(FD, p0).length);
    check("the tablet never gets a panel message", !tabMsgs.some((m) => m.t === "panel"));
    clearInterval(tabBeat);
    tab.close();
    hide(fk);
    sd.send({ event: "didReceiveGlobalSettings", payload: { settings: {} } });

    console.log("\nHolds are released");
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

    console.log("\nConnecting");
    // A port typed in the inspector once, long ago, and no code: Tablet Deck runs on the
    // port its config.json names. The plugin still finds it.
    const stale = await new Promise((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: appdata } });
    sd.globals = { port: stale };
    e0 = stream.mark();
    await sd.start();
    sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"));
    sd.send(ev.appear(A.status, "st", XL, {}, { column: 8, row: 3 }));
    const found = await within(8000, () => stream.find((e) => e.t === "client" && e.on && e.device === "streamdeck", e0).length);
    await sleep(600);
    const shown = sd.find((m) => m.event === "setImage" && m.context === "st").map((m) => decodeURIComponent(m.payload.image));
    const last = shown.length ? shown[shown.length - 1] : "";
    check("a port typed once in the inspector, Tablet Deck on config.json's port: the plugin connects", Boolean(found) && !/>OFFLINE</.test(last), found ? "status key still says OFFLINE" : "never connected");
    await sd.stop();
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
