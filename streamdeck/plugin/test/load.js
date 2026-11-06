// The image rate under load: a full Stream Deck + XL page (36 keys, 6 dials) animating,
// every key pressed in turn as fast as the plugin's press line takes them (one tap at a
// time, about 4 a second here so the dials get their turns too), with all six dials
// turning, shared states changing, a theme change mid-animation and a page change.
// Checks Elgato's "at most 10 updates a second" per key and strip, that nothing is drawn on
// a key after it disappeared, and that once everything settles each key shows its final
// look (a fresh willAppear draws exactly the same picture: no frame left behind).
//
//   node streamdeck/plugin/test/load.js [--port 8876]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { FakeStreamDeck, ev } = require("./fake-streamdeck");
const { write: writeData, REPO } = require("./make-test-data");

// TD_PLUGIN_SRC tests another copy of the plugin folder (a patched or unpacked one).
const SRC = process.env.TD_PLUGIN_SRC || path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");
const U = "com.nodiecode.tabletdeck";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0, passes = 0;
function check(name, ok, detail = "") {
  if (ok) { passes++; console.log(`  ok    ${name}`); } else { failures++; console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`); }
}
async function within(ms, test, step = 50) {
  const end = Date.now() + ms;
  for (;;) { const v = test(); if (v) return v; if (Date.now() > end) return null; await sleep(step); }
}
function freePort(from = 8876, to = 8899) {
  const wanted = process.argv.includes("--port") ? [Number(process.argv[process.argv.indexOf("--port") + 1])] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return new Promise((resolve, reject) => {
    const next = (i) => {
      if (i >= wanted.length) { reject(new Error("no free port")); return; }
      const s = net.createServer().once("error", () => next(i + 1)).listen(wanted[i], "127.0.0.1", () => s.close(() => resolve(wanted[i])));
    };
    next(0);
  });
}
// Most commands of these events one context got in any one second.
function worst(sd, events, from = 0) {
  const by = new Map();
  for (const c of sd.commands.slice(from)) if (events.includes(c.msg.event)) { if (!by.has(c.msg.context)) by.set(c.msg.context, []); by.get(c.msg.context).push(c.time); }
  let w = { n: 0, context: null };
  for (const [context, times] of by) {
    let j = 0;
    for (let i = 0; i < times.length; i++) { while (times[i] - times[j] >= 1000) j++; if (i - j + 1 > w.n) w = { n: i - j + 1, context }; }
  }
  return w;
}

async function main() {
  const token = JSON.parse(fs.readFileSync(path.join(REPO, "config.json"), "utf8")).token;
  const port = await freePort();
  const server = spawn(process.execPath, ["server.js", "--dry-run", "--port", String(port)], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
  let slog = "";
  server.stdout.on("data", (d) => { slog += d; });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-load-"));
  const pluginDir = path.join(tmp, `${U}.sdPlugin`);
  fs.cpSync(SRC, pluginDir, { recursive: true });
  writeData(pluginDir);
  const scenes = JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "scenes.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "catalog.json"), "utf8"));
  const appdata = path.join(tmp, "appdata");
  fs.mkdirSync(path.join(appdata, "TabletDeck"), { recursive: true });
  fs.writeFileSync(path.join(appdata, "TabletDeck", "config.json"), JSON.stringify({ port, token }));
  let sd = null, tablet = null;
  try {
    await within(8000, () => / running \(/.test(slog), 100);
    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: appdata } });
    await sd.start();
    const XL = "DEV-PLUSXL";
    sd.send(ev.device(XL, 13, 9, 4, "Stream Deck + XL"));
    // Every key of a page an animated tap button (no holds, so nothing is left down).
    const animated = catalog.filter((a) => a.kind === "deck" && a.mode === "tap" && (a.anim || a.state)).map((a) => a.id);
    const keys = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) keys.push({ context: `k${c}-${r}`, settings: { action: animated[(r * 9 + c) % animated.length] }, c, r });
    const dialNames = ["weapons", "thrusters", "shields", "speed", "targets", "scenes"];
    const dials = dialNames.map((n, i) => ({ context: `d-${n}`, settings: { dial: scenes.DIAL[n] }, c: i }));
    const appear = (k) => sd.send(ev.appear(`${U}.key`, k.context, XL, k.settings, { column: k.c, row: k.r }));
    const appearDial = (d) => sd.send(ev.appear(`${U}.dial`, d.context, XL, d.settings, { controller: "Encoder", column: d.c }));
    keys.forEach(appear);
    dials.forEach(appearDial);
    await within(8000, () => sd.find((m) => m.event === "setImage" && /\d+ MS|ONLINE/.test(decodeURIComponent(m.payload.image))).length || null, 100);
    await sleep(1500);
    // A tablet to change shared states from outside.
    tablet = new WebSocket(`ws://127.0.0.1:${port}/ws?t=${encodeURIComponent(token)}&device=tablet`);
    await within(3000, () => tablet.readyState === WebSocket.OPEN);

    console.log("\nA full + XL page animating");
    const from = sd.mark();
    const t0 = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      sd.send(ev.key("keyDown", `${U}.key`, k.context, XL, k.settings));
      sd.send(ev.key("keyUp", `${U}.key`, k.context, XL, k.settings));
      if (i % 12 === 0) {
        for (const d of dials) sd.send(ev.dial("dialRotate", `${U}.dial`, d.context, XL, d.settings, { column: d.c, ticks: i % 24 ? -1 : 1, pressed: false }));
        tablet.send(JSON.stringify({ t: "tap", id: "pl-gear" }));
        tablet.send(JSON.stringify({ t: "tap", id: "fa-lights" }));
      }
      if (i === 18) sd.send({ event: "didReceiveGlobalSettings", payload: { settings: { theme: "drake" } } });
      await sleep(250);
    }
    await sleep(3000);
    const span = (Date.now() - t0) / 1000;
    const img = worst(sd, ["setImage"], from), fb = worst(sd, ["setFeedback"], from);
    check("no key gets more than 10 setImage in any second", img.n <= 10, `${img.n} on ${img.context}`);
    check("no strip gets more than 10 setFeedback in any second", fb.n <= 10, `${fb.n} on ${fb.context}`);
    const cmds = sd.commands.slice(from);
    const bytes = cmds.reduce((n, c) => n + JSON.stringify(c.msg).length, 0);
    console.log(`        (${cmds.length} commands, ${(bytes / 1024 / span).toFixed(0)} KB/s to Stream Deck over ${span.toFixed(1)} s; largest ${Math.max(...cmds.map((c) => JSON.stringify(c.msg).length))} bytes)`);
    const alerts = cmds.filter((c) => c.msg.event === "showAlert").length;
    check("no alerts while online", alerts === 0, String(alerts));

    console.log("\nSettled pictures");
    // Wait until nothing has been drawn for a second.
    await within(8000, () => { const last = sd.commands[sd.commands.length - 1]; return last && Date.now() - last.time > 1000; }, 100);
    const lastImg = (ctx, from2 = 0) => { const l = sd.find((m) => m.event === "setImage" && m.context === ctx, from2); return l.length ? l[l.length - 1].payload.image : null; };
    const lastFb = (ctx, from2 = 0) => { const out = {}; for (const m of sd.find((x) => x.event === "setFeedback" && x.context === ctx, from2)) Object.assign(out, m.payload); return out; };
    const before = Object.fromEntries(keys.map((k) => [k.context, lastImg(k.context)]));
    const beforeFb = Object.fromEntries(dials.map((d) => [d.context, lastFb(d.context)]));
    const m2 = sd.mark();
    keys.forEach(appear);
    dials.forEach(appearDial);
    await sleep(800);
    const stale = keys.filter((k) => lastImg(k.context, m2) !== before[k.context]).map((k) => `${k.context} (${k.settings.action})`);
    check("every settled key shows its final picture (a redraw changes nothing)", !stale.length, stale.join(", "));
    const staleFb = dials.filter((d) => { const a = beforeFb[d.context], b = lastFb(d.context, m2); return Object.keys(b).some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])); }).map((d) => d.context);
    check("every settled strip shows its final picture", !staleFb.length, staleFb.join(", "));

    console.log("\nA page change mid-animation");
    const m3 = sd.mark();
    for (const k of keys) { sd.send(ev.key("keyDown", `${U}.key`, k.context, XL, k.settings)); sd.send(ev.key("keyUp", `${U}.key`, k.context, XL, k.settings)); }
    for (const d of dials) sd.send(ev.dial("dialRotate", `${U}.dial`, d.context, XL, d.settings, { column: d.c, ticks: 1, pressed: false }));
    await sleep(60);
    for (const k of keys) sd.send(ev.disappear(`${U}.key`, k.context, XL, k.settings, { column: k.c, row: k.r }));
    for (const d of dials) sd.send(ev.disappear(`${U}.dial`, d.context, XL, d.settings, { controller: "Encoder", column: d.c }));
    const gone = Date.now() + 30; // let the disappear events arrive
    await sleep(1500);
    const late = sd.commands.slice(m3).filter((c) => c.time > gone && ["setImage", "setFeedback", "showAlert", "setTriggerDescription"].includes(c.msg.event));
    check("nothing is drawn on keys or strips after they disappear", !late.length, `${late.length}: ${[...new Set(late.map((c) => `${c.msg.event} ${c.msg.context}`))].slice(0, 6).join(", ")}`);
  } finally {
    if (tablet) tablet.close();
    if (sd) await sd.stop();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(2); });
