// Renders what the plugin draws to PNG, to look at: a Stream Deck + XL page (keys and the
// six-dial touch strip), key states and animation frames, the theme keys, and the property
// inspector. Uses Playwright with Chromium, which isn't a dependency of the repo:
//
//   NODE_PATH=<folder with playwright> node streamdeck/plugin/test/render.js <out folder>
//
// Chromium isn't Stream Deck's renderer, so these show the design, not pixel-exact output.
// The touch strip's text items are drawn here as HTML text at the layout's rects.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { write: writeData } = require("./make-test-data");
const { FakeStreamDeck, ev } = require("./fake-streamdeck");

const SRC = path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), "tabletdeck-render"));

async function main() {
  const { chromium } = require("playwright");
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "td-render-"));
  const dir = path.join(tmp, "com.nodiecode.tabletdeck.sdPlugin");
  fs.cpSync(SRC, dir, { recursive: true });
  writeData(dir);
  const { load } = require(path.join(dir, "bin", "data.js"));
  const { createDraw, svgUrl, svgBase64 } = require(path.join(dir, "bin", "draw.js"));
  const scenes = require(path.join(__dirname, "..", "..", "scenes.js"));
  const layoutDef = JSON.parse(fs.readFileSync(path.join(dir, "layouts", "dial.json"), "utf8"));
  const browser = await chromium.launch();
  const shot = async (name, html, width, height) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#111;font-family:'Segoe UI',system-ui,sans-serif">${html}</body></html>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, name) });
    await page.close();
    console.log(path.join(out, name));
  };
  const img = (svg, size = 112) => `<img width="${size}" height="${size}" src="${svgUrl(svg)}" style="display:block">`;

  // The strip as Stream Deck would compose it: the layout's items at their rects.
  const segment = (fb) => `<div style="position:relative;width:200px;height:100px;overflow:hidden">${layoutDef.items.map((it) => {
    const [x, y, w, h] = it.rect, v = fb[it.key];
    if (!v) return "";
    if (it.type === "pixmap") return `<img src="${typeof v === "string" ? v : v.value}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px">`;
    const val = typeof v === "string" ? v : v.value, color = (typeof v === "object" && v.color) || it.color || "#fff";
    const font = (typeof v === "object" && v.font) || it.font;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;line-height:${h}px;font-size:${font.size}px;font-weight:${font.weight};color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:${it.alignment || "center"}">${val}</div>`;
  }).join("")}</div>`;

  // ---- 1. A live + XL page, through the plugin itself, against a dry-run Tablet Deck ----
  const REPO = path.join(__dirname, "..", "..", "..");
  const token = JSON.parse(fs.readFileSync(path.join(REPO, "config.json"), "utf8")).token;
  const port = Number(process.env.PORT || 8898);
  const server = require("child_process").spawn(process.execPath, ["server.js", "--dry-run", "--port", String(port)], { cwd: REPO, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2500));
  const appdata = path.join(tmp, "appdata");
  fs.mkdirSync(path.join(appdata, "TabletDeck"), { recursive: true });
  fs.writeFileSync(path.join(appdata, "TabletDeck", "config.json"), JSON.stringify({ port, token }));
  const sd = new FakeStreamDeck({ pluginDir: dir, env: { APPDATA: appdata } });
  sd.globals = { theme: process.env.THEME || "rsi" };
  await sd.start();
  sd.send(ev.device("XL", 13, 9, 4, "Stream Deck + XL"));
  const layout = scenes.layoutFor("plusxl");
  const page = layout.pages[1]; // Combat
  const U = "com.nodiecode.tabletdeck";
  for (const [pos, ref] of Object.entries(page.keys)) {
    const [c, r] = pos.split(",").map(Number);
    let action = null, settings = {};
    if (ref && ref.startsWith("@scene:")) { action = `${U}.scene`; settings = { scene: ref.slice(7), page: "combat" }; }
    else if (ref === "td-talk") action = `${U}.talk`;
    else if (ref === "td-status") action = `${U}.status`;
    else if (ref === "td-lights-reset") action = `${U}.lights`;
    else if (ref && !ref.startsWith("@") && !ref.startsWith("sd-")) { action = `${U}.key`; settings = { action: ref }; }
    if (action) sd.send(ev.appear(action, `k${c}-${r}`, "XL", settings, { column: c, row: r }));
  }
  page.dials.forEach((d, i) => { if (d && !d.action) sd.send(ev.appear(`${U}.dial`, `d${i}`, "XL", { dial: d }, { controller: "Encoder", column: i })); });
  await new Promise((r) => setTimeout(r, 2500));
  // Light a toggle, turn weapons up three detents, push the targets dial (wherever the
  // layout puts them).
  const keyAt = (ref) => Object.entries(page.keys).find(([, v]) => v === ref)[0].split(",").map(Number);
  const lit = ["qt-flight-ready", "pl-gear", "fa-lights", "fa-decoupled", "cr-doors-toggle"].find((r) => Object.values(page.keys).includes(r));
  const [sc, sr] = keyAt(lit);
  sd.send(ev.key("keyDown", `${U}.key`, `k${sc}-${sr}`, "XL", { action: lit }));
  sd.send(ev.key("keyUp", `${U}.key`, `k${sc}-${sr}`, "XL", { action: lit }));
  sd.send(ev.dial("dialRotate", `${U}.dial`, "d0", "XL", { dial: page.dials[0] }, { column: 0, ticks: 3 }));
  const ti = Math.max(0, page.dials.findIndex((d) => d && d.label === "Targets"));
  sd.send(ev.dial("dialDown", `${U}.dial`, `d${ti}`, "XL", { dial: page.dials[ti] }, { column: ti }));
  sd.send(ev.dial("dialUp", `${U}.dial`, `d${ti}`, "XL", { dial: page.dials[ti] }, { column: ti }));
  await new Promise((r) => setTimeout(r, 250));
  const lastImg = (ctx) => { const l = sd.find((m) => m.event === "setImage" && m.context === ctx); return l.length ? l[l.length - 1].payload.image : null; };
  const lastFb = (ctx) => Object.assign({}, ...sd.find((m) => m.event === "setFeedback" && m.context === ctx).map((m) => m.payload));
  const data = load("en");
  const draw = createDraw(data);
  const th = draw.theme(sd.globals.theme);
  let grid = "";
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
    const u = lastImg(`k${c}-${r}`);
    const ref = page.keys[`${c},${r}`];
    grid += u ? `<img width="112" height="112" src="${u}">` : `<div style="width:112px;height:112px;display:grid;place-items:center;color:#556;font:10px sans-serif;background:#000">${ref ? ref.replace(/^@/, "") : ""}</div>`;
  }
  const strip = page.dials.map((d, i) => segment(lastFb(`d${i}`))).join("");
  await shot("plusxl-combat.png", `<div style="padding:16px"><div style="display:grid;grid-template-columns:repeat(9,112px);gap:14px;margin-left:46px">${grid}</div>
    <div style="display:flex;margin-top:22px;width:1200px">${strip}</div></div>`, 1240, 4 * 126 + 160);
  await sd.stop();
  server.kill();

  // ---- 2. States and frames of single keys ----
  const def = (id) => data.byId.get(id);
  const row = (items) => `<div style="display:flex;gap:10px;margin:8px">${items.map(([svg, cap]) => `<div style="color:#9ab;font:11px sans-serif;text-align:center">${img(svg)}${cap}</div>`).join("")}</div>`;
  const states = [
    [draw.deck(th, def("pl-gear"), { status: "RETRACTED" }), "idle"],
    [draw.deck(th, def("pl-gear"), { lit: true, status: "DEPLOYED" }), "lit"],
    [draw.deck(th, def("pl-gear"), { pressed: true, status: "RETRACTED" }), "pressed"],
    [draw.deck(th, def("pl-gear"), { blocked: true, status: "RETRACTED" }), "blocked"],
    [draw.deck(th, def("pl-gear"), { offline: true, status: "RETRACTED" }), "offline"],
    [draw.deck(th, def("qt-engage"), { status: "HOLD TO ENGAGE" }), "hold idle"],
    [draw.deck(th, def("qt-engage"), { pressed: true, status: "SPOOLING…", anim: { kind: "charge", t: 0.55 } }), "charging"],
    [draw.deck(th, def("qt-engage"), { pressed: true, lit: true, status: "ENGAGED", anim: { kind: "charge", t: 1 } }), "engaged"],
  ];
  const frames = ["burst", "ripple", "doors", "lock", "recoil", "streak", "timed", "hazard"].map((k) => {
    const d = { burst: "cb-decoy", ripple: "qt-pwr", doors: "cr-doors-toggle", lock: "tg-hostile", recoil: "cb-missile", streak: "fa-nav", timed: "pw-wep-max", hazard: "qt-self-destruct" }[k];
    return [draw.deck(th, def(d) || def("pl-gear"), { pressed: true, anim: { kind: k, t: 0.45 } }), k];
  });
  const de = createDraw(load("de"));
  const german = [
    [de.deck(th, def("qt-engage"), { status: "HOLD TO ENGAGE" }), "de: hold"],
    [de.deck(th, def("qt-self-destruct"), { status: "HOLD TO ARM" }), "de: arm"],
    [de.deck(th, def("pl-gear"), { lit: true, status: "DEPLOYED" }), "de: lit"],
    [de.scene(th, data.SCENES[4], { lit: true, status: "ACTIVE" }), "de: scene"],
    [de.deck(th, { label: "Hold to Talk", icon: "mic", color: "red" }, { lit: true, status: "LISTENING" }), "de: talk"],
    [de.deck(th, { label: "Tablet Deck", icon: "sliders", color: "red" }, { offline: true, status: "NOT PAIRED" }), "de: status"],
  ];
  await shot("key-states.png", row(states) + row(frames) + row(german), 8 * 122 + 20, 3 * 150 + 20);

  // ---- 3. The theme keys, each in its own theme, and a strip per theme ----
  const { THEMES } = require(path.join(dir, "bin", "emblems.js"));
  const themeRow = THEMES.map((x, i) => [draw.themeKey(x.id, i === 0), x.name]);
  await shot("theme-keys.png", row(themeRow.slice(0, 6)) + row(themeRow.slice(6)), 6 * 122 + 20, 2 * 150 + 20);
  const strips = THEMES.map((x) => {
    const t2 = draw.theme(x.id);
    const fb = (col, count, label, icon, color, value, flash) => ({
      bg: svgBase64(draw.strip(t2, { color, place: { column: col, count }, flash })),
      icon: svgBase64(draw.stripIcon(t2, icon, color)),
      label: { value: t2.font.upper ? label.toUpperCase() : label, color: t2.text },
      value: { value, color: flash ? t2.colors[color] || t2.accent : t2.text },
      hint: { value: "PUSH · MAX", color: t2.dim },
    });
    return `<div style="display:flex;margin:6px 0">${segment(fb(0, 3, "Weapons", "power-weapons", "red", "+ ×3", 0.6))}${segment(fb(1, 3, "Shields", "power-shields", "green", "−", 0))}${segment(fb(2, 3, "Scenes", "target", "red", "COMBAT", 0))}</div>`;
  }).join("");
  await shot("strips.png", `<div style="padding:8px">${strips}</div>`, 620, 12 * 112 + 20);

  // ---- 4. The property inspector, against the fake Stream Deck and the real plugin ----
  const pis = new FakeStreamDeck({ pluginDir: dir, env: { APPDATA: path.join(tmp, "none") } });
  pis.globals = { theme: "rsi", follow: true };
  await pis.start();
  pis.send(ev.device("XL", 13, 9, 4, "Stream Deck + XL"));
  const checks = [];
  for (const [kind, controller, settings, height] of [
    ["key", "Keypad", { action: "pl-gear" }, 900],
    ["dial", "Encoder", { dial: data.DIAL.weapons }, 760],
    ["dial", "Encoder", {}, 860],
    ["scene", "Keypad", { scene: "combat" }, 620],
  ]) {
    const context = `pi-${kind}-${checks.length}`, piUUID = `PI${checks.length}`;
    pis.send(ev.appear(`${U}.${kind}`, context, "XL", settings, { controller }));
    pis.inspector(piUUID, { action: `${U}.${kind}`, context, device: "XL", controller });
    pis.send({ event: "propertyInspectorDidAppear", action: `${U}.${kind}`, context, device: "XL" });
    const pg = await browser.newPage({ viewport: { width: 360, height } });
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(`file://${path.join(dir, "pi", "index.html")}`);
    const port = pis.server.address().port;
    await pg.evaluate(([port, piUUID, info, actionInfo]) => window.connectElgatoStreamDeckSocket(port, piUUID, "registerPropertyInspector", info, actionInfo),
      [port, piUUID, JSON.stringify(pis.info), JSON.stringify({ action: `${U}.${kind}`, context, device: "XL", payload: { settings, controller, isInMultiAction: false } })]);
    await pg.waitForTimeout(700);
    const name = `pi-${kind}${kind === "dial" && !settings.dial ? "-custom" : ""}.png`;
    await pg.screenshot({ path: path.join(out, name), fullPage: true });
    console.log(path.join(out, name));
    if (kind === "key") {
      await pg.fill(".search", "quantum");
      await pg.waitForTimeout(100);
      const shown = await pg.$$eval(".item .name", (n) => n.map((x) => x.textContent));
      await pg.click(".item >> nth=0");
      await pg.waitForTimeout(400);
      checks.push(["key: search filters", shown.length > 0 && shown.every((x) => /quantum/i.test(x)), shown.join(", ")]);
      const firstId = data.actions.find((a) => a.kind === "deck" && a.label === shown[0]).id;
      checks.push(["key: a click saves the button", (pis.settings.get(context) || {}).action === firstId, `${JSON.stringify(pis.settings.get(context))} vs ${firstId}`]);
      await pg.check("#motion").catch(() => {});
      await pg.click("label.switch >> nth=1");
      await pg.waitForTimeout(300);
      checks.push(["globals: the animations switch saves", pis.globals.motion === false && pis.globals.follow === true && pis.globals.theme === "rsi", JSON.stringify(pis.globals)]);
      await pg.fill("#code", "1a2b3c4d");
      await pg.waitForTimeout(800);
      checks.push(["globals: the code saves (and keeps the rest)", pis.globals.code === "1a2b3c4d" && pis.globals.theme === "rsi", JSON.stringify({ ...pis.globals, code: pis.globals.code ? "<set>" : "" })]);
      await pg.fill("#code", "");
      await pg.click("label.switch >> nth=1");
      await pg.waitForTimeout(800);
    }
    if (kind === "dial" && checks.length > 2 && !settings.dial) {
      await pg.selectOption("select >> nth=1", "pw-shd-down");
      await pg.waitForTimeout(200);
      await pg.selectOption("select >> nth=2", "pw-shd-up");
      await pg.waitForTimeout(300);
      const saved = pis.settings.get(context) || {};
      checks.push(["dial: custom ccw/cw save as a dial", saved.dial && saved.dial.ccw === "pw-shd-down" && saved.dial.cw === "pw-shd-up" && saved.dial.label === "Shields" && saved.dial.icon && !/</.test(saved.dial.icon), JSON.stringify(saved)]);
      await pg.screenshot({ path: path.join(out, "pi-dial-custom-filled.png"), fullPage: true });
    }
    checks.push([`${kind}: no script errors`, errors.length === 0, errors.join("; ")]);
    await pg.close();
  }
  await pis.stop();
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `: ${detail}`}`);

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => { console.error(err); process.exit(1); });
