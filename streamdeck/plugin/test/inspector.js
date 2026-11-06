// The property inspector in a real Chromium (Playwright), connected to the plugin through
// the fake Stream Deck the way Stream Deck does it (connectElgatoStreamDeckSocket), in
// German: every visible string must be translated, a picked button must reach the plugin
// and redraw the key, the code typed in must connect, and a wrong code must say so.
// Screenshots go to the folder given (default: a temporary one).
//
//   NODE_PATH=/opt/node-tools/node_modules node streamdeck/plugin/test/inspector.js [out folder] [--port 8874]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
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
  for (;;) { const v = await test(); if (v) return v; if (Date.now() > end) return null; await sleep(step); }
}
function freePort(from = 8874, to = 8899) {
  const wanted = process.argv.includes("--port") ? [Number(process.argv[process.argv.indexOf("--port") + 1])] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return new Promise((resolve, reject) => {
    const next = (i) => {
      if (i >= wanted.length) { reject(new Error("no free port")); return; }
      const s = net.createServer().once("error", () => next(i + 1)).listen(wanted[i], "127.0.0.1", () => s.close(() => resolve(wanted[i])));
    };
    next(0);
  });
}

async function main() {
  const { chromium } = require("playwright");
  const outArg = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--port");
  const out = outArg ? path.resolve(outArg) : fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-pi-shots-"));
  fs.mkdirSync(out, { recursive: true });
  const token = JSON.parse(fs.readFileSync(path.join(REPO, "config.json"), "utf8")).token;
  const port = await freePort();
  const server = spawn(process.execPath, ["server.js", "--dry-run", "--port", String(port)], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
  let slog = "";
  server.stdout.on("data", (d) => { slog += d; });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-sd-pi-"));
  const pluginDir = path.join(tmp, `${U}.sdPlugin`);
  fs.cpSync(SRC, pluginDir, { recursive: true });
  writeData(pluginDir);
  const de = JSON.parse(fs.readFileSync(path.join(pluginDir, "de.json"), "utf8")).Localization;
  const en = JSON.parse(fs.readFileSync(path.join(pluginDir, "en.json"), "utf8")).Localization;
  const DIAL = JSON.parse(fs.readFileSync(path.join(pluginDir, "data", "scenes.json"), "utf8")).DIAL;
  // English text that has a different German entry must not be on screen.
  const english = new Set(Object.entries(en).filter(([k, v]) => de[k] && de[k] !== v).map(([, v]) => v));
  let sd = null, browser = null;
  try {
    await within(8000, () => / running \(/.test(slog), 100);
    // No config.json anywhere: the inspector is where the code comes from.
    sd = new FakeStreamDeck({ pluginDir, env: { APPDATA: path.join(tmp, "empty") }, language: "de" });
    await sd.start();
    const DEV = "DEV-PLUSXL";
    sd.send(ev.device(DEV, 13, 9, 4, "Stream Deck + XL"));
    sd.send(ev.appear(`${U}.key`, "k1", DEV, { action: "pl-gear" }, { column: 0, row: 2 }));
    sd.send(ev.appear(`${U}.dial`, "d1", DEV, { dial: DIAL.weapons }, { controller: "Encoder", column: 0 }));
    sd.send(ev.appear(`${U}.scene`, "s1", DEV, { scene: "combat" }, { column: 1, row: 0 }));
    await sleep(300);

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 360, height: 760 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const wsPort = sd.server.address().port;
    const open = async (uuid, action, context, settings, controller = "Keypad") => {
      sd.inspector(uuid, { action, context, device: DEV, controller });
      sd.send({ event: "propertyInspectorDidAppear", action, context, device: DEV });
      await page.goto(pathToFileURL(path.join(pluginDir, "pi", "index.html")).href);
      const info = JSON.stringify(sd.info);
      const actionInfo = JSON.stringify({ action, context, device: DEV, payload: { settings, controller, coordinates: { column: 0, row: 0 }, isInMultiAction: false } });
      await page.evaluate(([p, u, i, a]) => window.connectElgatoStreamDeckSocket(p, u, "registerPropertyInspector", i, a), [wsPort, uuid, info, actionInfo]);
      await within(3000, () => page.evaluate(() => !document.getElementById("action").hidden));
      await sleep(200);
    };
    const visibleText = () => page.evaluate(() => {
      const out = [];
      const walk = (n) => {
        if (n.nodeType === 3 && n.textContent.trim()) { const el = n.parentElement; if (el && el.offsetParent !== null) out.push(n.textContent.trim()); }
        for (const c of n.childNodes) walk(c);
      };
      walk(document.body);
      for (const el of document.querySelectorAll("input[placeholder],[aria-label],option")) out.push(el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.textContent);
      return out.filter(Boolean);
    });

    console.log("\nDeck Button inspector, in German");
    await open("PI-KEY", `${U}.key`, "k1", { action: "pl-gear" });
    let words = await visibleText();
    let left = words.filter((w) => english.has(w));
    check("no English left on screen", !left.length, left.join(" | "));
    check("the picked button is selected", await page.evaluate(() => (document.querySelector('.item[aria-selected="true"] .name') || {}).textContent), "");
    await page.screenshot({ path: path.join(out, "pi-key-de.png"), fullPage: true });
    // Search, then pick Engage Quantum.
    await page.fill(".search", "quant");
    const items = await page.$$eval(".item .name", (l) => l.map((n) => n.textContent));
    check("search narrows the list", items.length > 0 && items.length < 20, `${items.length}: ${items.join(", ")}`);
    let mark = sd.mark();
    const before = sd.find((m) => m.event === "setImage" && m.context === "k1").length;
    await page.click(".item >> nth=0");
    const picked = await within(2000, () => [...sd.settings.get("k1") ? [sd.settings.get("k1")] : []][0]);
    check("a click saves the action in the key's settings", picked && typeof picked.action === "string" && picked.action !== "pl-gear", JSON.stringify(picked));
    await within(2000, () => sd.find((m) => m.event === "setImage" && m.context === "k1").length > before);
    check("  ...and the key redraws", sd.find((m) => m.event === "setImage" && m.context === "k1").length > before);

    console.log("\nConnection");
    check("with no config.json and no code, the inspector says so", (await page.textContent("#linkText")) === de["No pairing code yet: enter the one the Tablet Deck window shows."], await page.textContent("#linkText"));
    await page.fill("#port", String(port));
    await page.fill("#code", "deadbeef");
    await page.click("#test");
    const wrong = await within(4000, async () => { const t = await page.textContent("#linkText"); return t !== (de["Connecting…"] || "Connecting…") && t; });
    check("Test connection with a wrong code says it's wrong", wrong === de["Wrong pairing code."], wrong);
    mark = sd.mark();
    await page.fill("#port", String(port));
    await page.fill("#code", token);
    const g = await within(3000, () => sd.find((m) => m.event === "setGlobalSettings", mark).length || (sd.globals.code === token && sd.globals));
    check("the typed port and code are saved in global settings", sd.globals.code === token && sd.globals.port === port, JSON.stringify({ ...sd.globals, code: sd.globals.code === token ? "<code>" : sd.globals.code }));
    const ok = await within(8000, async () => /Verbunden/.test(await page.textContent("#linkText")));
    check("  ...the plugin connects and the inspector shows it", Boolean(ok), await page.textContent("#linkText"));
    check("  ...the code is not in any action's settings", ![...sd.settings.values()].some((s) => JSON.stringify(s).includes(token)));
    await page.screenshot({ path: path.join(out, "pi-key-de-connected.png"), fullPage: true });

    console.log("\nDeck Dial inspector");
    await open("PI-DIAL", `${U}.dial`, "d1", { dial: DIAL.weapons }, "Encoder");
    const presetName = await page.$eval("select", (s) => s.options[s.selectedIndex].textContent);
    check("a bundled Weapons dial shows its preset", presetName === (de.Weapons || "Weapons"), presetName);
    words = await visibleText();
    left = words.filter((w) => english.has(w));
    check("no English left on screen", !left.length, left.join(" | "));
    await page.selectOption("select", "");
    await sleep(300);
    let selects = await page.$$("select");
    check("choosing Custom on a preset dial shows the three pickers", selects.length === 4, `${selects.length} select(s); the preset now reads ${await page.$eval("select", (s) => s.options[s.selectedIndex].textContent)}`);
    if (selects.length !== 4) {
      // Start from a dial that matches no preset instead, to test the pickers.
      await open("PI-DIAL2", `${U}.dial`, "d1", { dial: { label: "", ccw: "pw-shd-down", cw: "", press: "" } }, "Encoder");
      selects = await page.$$("select");
    }
    await page.screenshot({ path: path.join(out, "pi-dial-de-custom.png"), fullPage: true });
    mark = sd.mark();
    await selects[2].selectOption("pw-shd-up");
    await within(2000, () => sd.settings.get("d1") && sd.settings.get("d1").dial && sd.settings.get("d1").dial.cw === "pw-shd-up");
    const ds = sd.settings.get("d1") || {};
    check("a custom pick is saved as { dial: { ccw, cw, press, label, icon, color } }", ds.dial && ds.dial.cw === "pw-shd-up" && typeof ds.dial.label === "string", JSON.stringify(ds));

    console.log("\nScene inspector");
    await open("PI-SCENE", `${U}.scene`, "s1", { scene: "combat" });
    words = await visibleText();
    left = words.filter((w) => english.has(w));
    check("no English left on screen", !left.length, left.join(" | "));
    await page.screenshot({ path: path.join(out, "pi-scene-de.png"), fullPage: true });
    check("no script errors", !errors.length, errors.join(" | "));
  } finally {
    if (browser) await browser.close();
    if (sd) await sd.stop();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${passes} passed, ${failures} failed (screenshots in ${out})`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(2); });
