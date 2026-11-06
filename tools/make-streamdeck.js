// Builds the Stream Deck pack from the deck's own designs: an icon pack per theme, ready-made
// profiles for every model in every theme (with the keybind profile their hotkeys expect),
// and the Tablet Deck plugin with its bundled profiles. Nothing here needs npm packages: the
// key art (streamdeck/keyart.js) is drawn to PNG by an installed Edge or Chrome, and the
// files are plain ZIPs written with zlib.
//
//   node tools/make-streamdeck.js                     build everything into dist/streamdeck/
//   node tools/make-streamdeck.js --themes rsi,drake --models std,plusxl
//   node tools/make-streamdeck.js --skip icons,plugin  (also: profiles, preview)
//   node tools/make-streamdeck.js --browser <path>     (or set TABLETDECK_BROWSER)
//   node tools/make-streamdeck.js --out <folder>
//   node tools/make-streamdeck.js --release           also zip the downloads into <out>/release/
//   node tools/make-streamdeck.js --check              validate layouts and what's built; no browser
//
// Sources: streamdeck/catalog.js (actions), streamdeck/scenes.js (pages per model),
// streamdeck/keyart.js (key art), public/icons.js, public/themes.css, public/app.js (theme
// names and emblems). File formats follow streamdeck/research/ (profiles.md, navigation.md,
// iconpacks.md, plugins.md, sdk.verified.md).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const catalog = require("../streamdeck/catalog");
const scenes = require("../streamdeck/scenes");
const keyart = require("../streamdeck/keyart");
const { createArt, TEXT } = require("./streamdeck/art");
const { Renderer, findBrowser } = require("./streamdeck/browser");
const { EncoderPool } = require("./streamdeck/encoder");
const { zip, unzip } = require("./streamdeck/zip");
const png = require("./streamdeck/png");
const P = require("./streamdeck/profile");
const { hotkey, hotkeySettings } = require("./streamdeck/hotkeys");

const VERSION = require("../package.json").version;
const AUTHOR = "Tablet Deck";
const SITE = "https://nodiecode.github.io/tablet-deck/";
const PLUGIN_UUID = "com.nodiecode.tabletdeck";
const PLUGIN_SRC = path.join(ROOT, "streamdeck", "plugin", `${PLUGIN_UUID}.sdPlugin`);
const ICONPACK_ID = (theme) => `com.nodiecode.tabletdeck.icons.${theme}`;
const MAX_PAGES = 10; // Stream Deck's limit per profile; folders don't count
// Profile keys are 144 px on every model, as in the profiles the Stream Deck app writes itself
// (Elgato's default + profile included; research/profiles.verified.md 5.4). The app shrinks
// them to each device's own key size, and the picture stays sharp in the app's window on a
// high-DPI screen. A model in scenes.MODELS may set keyPx to try another size.
const keyPx = (modelId) => scenes.MODELS[modelId].keyPx || 144;
const DIAL_ICON_PX = 72;
const PLUGIN_DIAL_REFS = new Set(["@next", "@prev", "@folder:themes"]);
// Plugins whose state 0 is the active one (OBS: recording, live) and 1 idle: their lit picture
// goes first and keys start in state 1 (research/plugins.verified.md correction 3). Discord's
// are the other way round, like the rest.
const ON_FIRST = new Set(["com.elgato.obsstudio"]);
// Stream Deck's Hotkey only taps (research/profiles.verified.md correction 1), so a deck
// button that must be held, or held for a set time, goes through the Tablet Deck plugin in
// the standalone profiles too, marked PLUGIN, rather than tap and do the wrong thing. A dial
// turn is one tap per detent either way (the plugin's own dial taps hold buttons too), so
// there only a timed press needs the plugin.
const viaPlugin = (a, turn = false) => !!a && a.kind === "deck" && (a.mode === "timed" || (a.mode === "hold" && !turn));

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");
// A mistake in the command line: shown without a stack trace.
const usage = (msg) => Object.assign(new Error(msg), { usage: true });
const mb = (n) => `${(n / 1048576).toFixed(n < 1048576 ? 2 : 1)} MB`;

// ---------- options ----------

function parseArgs(argv) {
  const o = { out: path.join(ROOT, "dist", "streamdeck"), themes: null, models: null, skip: new Set(), check: false, browser: null, release: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { if (i + 1 >= argv.length) throw usage(`${a} needs a value`); return argv[++i]; };
    if (a === "--out") o.out = path.resolve(next());
    else if (a === "--themes") o.themes = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--models") o.models = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--skip") next().split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => o.skip.add(s));
    else if (a === "--browser") o.browser = next();
    else if (a === "--check") o.check = true;
    else if (a === "--release") o.release = true;
    else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(5, 14).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(0); }
    else throw usage(`Unknown option ${a} (see --help)`);
  }
  for (const s of o.skip) if (!["icons", "profiles", "plugin", "preview"].includes(s)) throw usage(`--skip takes icons, profiles, plugin, preview (not "${s}")`);
  return o;
}

// ---------- sources ----------

// Theme names and emblems live in public/app.js (the deck's theme picker); they're read from
// there so the pack and the deck never disagree. Emblem parts drawn in the theme's text
// colour keep a placeholder that art.js fills in.
function loadThemes(tokens) {
  try {
    const src = read("public/app.js");
    const start = src.indexOf("const F = "), list = src.indexOf("const THEMES = [", start);
    const end = src.indexOf("\n  ];", list);
    if (start < 0 || list < 0 || end < 0) throw new Error("THEMES not found");
    const code = src.slice(start, end + 5).replace(/^\s*const T = .*$/m, "");
    const T = (body) => `<g stroke="${TEXT}">${body.replace(/currentColor/g, TEXT)}</g>`;
    const themes = vm.runInNewContext(`${code}\nTHEMES`, { T });
    return themes.filter((t) => tokens[t.id]).map((t) => ({ id: t.id, name: t.name, full: t.full || t.name, emblem: t.emblem }));
  } catch (err) {
    console.warn(`  ! couldn't read theme names from public/app.js (${err.message}); using theme ids`);
    return Object.keys(tokens).map((id) => ({ id, name: id.toUpperCase(), full: id, emblem: '<circle cx="32" cy="32" r="24"/>' }));
  }
}

function loadSources() {
  const ctx = { window: {} };
  vm.runInNewContext(read("public/icons.js"), ctx);
  const icons = ctx.window.DECK_ICONS;
  const tokens = keyart.parseThemes(read("public/themes.css"));
  const themes = loadThemes(tokens);
  // The same Google Fonts the tablet loads, so keys use each theme's own typeface.
  const link = /href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/.exec(read("public/index.html"));
  const fontsCss = link ? link[1].replace(/&amp;/g, "&").replace(/display=swap/, "display=block") : "";
  return { icons, tokens, themes, fontsCss };
}

// ---------- images ----------

// Every picture the pack needs, keyed by what it draws: the same SVG at the same size is
// rendered once, however many keys and themes use it.
class ImageStore {
  constructor() { this.pending = new Map(); this.done = new Map(); }
  add(svg, w = 144, h = 144) {
    const key = sha1(`${w}x${h}|${svg}`);
    if (!this.done.has(key)) this.pending.set(key, { svg, w, h });
    return key;
  }
  get(key) { return this.done.get(key); }
  async render(renderer, log) {
    // Tallest first, so the sheets pack tightly.
    const jobs = [...this.pending.entries()].sort((a, b) => b[1].h - a[1].h || b[1].w - a[1].w);
    if (!jobs.length) return;
    let last = 0;
    const encoder = new EncoderPool();
    try {
      const out = await renderer.renderSvgs(jobs.map(([, j]) => j), {
        encoder,
        onProgress: (n, total) => { if (n - last >= 2000 || n === total) { log(`  drawn ${n}/${total} images`); last = n; } },
      });
      jobs.forEach(([key], i) => this.done.set(key, out[i]));
    } finally {
      await encoder.close();
    }
    this.pending.clear();
  }
}

// ---------- layout ----------

// The themes folder lists all twelve themes; scenes.js gives the slots on one page, and on
// small decks they're chained into More pages here.
function withThemePages(layout, themeIds) {
  const first = layout.folders.themes && layout.folders.themes[0];
  if (!first || !first.themes) return layout;
  const backSlot = Object.keys(first.keys).find((k) => first.keys[k] === "@back");
  const slots = first.themes.map(([c, r]) => `${c},${r}`);
  const pages = [];
  const rest = [...themeIds];
  while (rest.length) {
    const keys = backSlot ? { [backSlot]: "@back" } : {};
    const room = rest.length > slots.length ? slots.length - 1 : slots.length;
    rest.splice(0, room).forEach((id, i) => { keys[slots[i]] = `@theme:${id}`; });
    if (rest.length) keys[slots[slots.length - 1]] = `@more:themes:${pages.length + 1}`;
    pages.push({ keys });
  }
  return { ...layout, folders: { ...layout.folders, themes: pages } };
}
const layoutOf = (modelId, themeIds) => withThemePages(scenes.layoutFor(modelId), themeIds);

// What a dial's refs do, shortened for its touch-strip panel ("Weapons −" on the Weapons
// dial is just "−"; "Voice Channel" on the Voice Channel dial is "Next").
function hintFor(ref, dialLabel, dir) {
  if (!ref) return "";
  if (ref === "@prev") return "Prev";
  if (ref === "@next") return "Next";
  if (ref.startsWith("@folder:")) return (scenes.FOLDERS[ref.slice(8)] || {}).name || "Folder";
  const a = catalog.byId.get(ref);
  if (!a) return "";
  const drop = new Set(String(dialLabel).toLowerCase().split(/\s+/));
  const short = a.label.split(/\s+/).filter((w) => !drop.has(w.toLowerCase())).join(" ");
  return (short || { ccw: "Prev", cw: "Next", press: "Push" }[dir] || a.label).replace(/^Previous\b/, "Prev");
}
// `standalone`: which of the dial's turns and push go through the Tablet Deck plugin there.
const dialArt = (d, standalone) => {
  if (d.action) {
    const a = catalog.byId.get(d.action);
    return a ? { label: a.label, icon: a.icon, color: a.color, hints: { ccw: "−", cw: "+", press: "Mute" } } : null;
  }
  const refs = { ccw: d.ccw, cw: d.cw, press: d.press };
  const plugin = standalone ? Object.keys(refs).filter((k) => viaPlugin(refs[k] && catalog.byId.get(refs[k]), k !== "press")) : [];
  // The preset's own words (DIAL hints) win over the shortened labels.
  const hint = (dir) => (d.hints && d.hints[dir] != null ? d.hints[dir] : hintFor(d[dir], d.label, dir));
  return { label: d.label, icon: d.icon, color: d.color, hints: { ccw: hint("ccw"), cw: hint("cw"), press: hint("press") }, plugin };
};

// ---------- profiles ----------

const profileUuid = (variant, themeId, modelId) => P.uuidFrom(`profile|${variant}|${themeId || ""}|${modelId}`);
const standaloneName = (theme, model) => `Tablet Deck ${theme.name} - ${model.name}`;
const bundledName = (model) => `Tablet Deck ${model.name}`;

// Builds one profile. variant "standalone": Stream Deck's own actions only, drawn in `theme`.
// variant "bundled": shipped inside the plugin; Tablet Deck keys are the plugin's actions,
// which draw themselves, and everything else is as in the standalone profiles.
function buildProfile(env, modelId, variant, theme) {
  const { art, store, themes, warn } = env;
  const model = scenes.MODELS[modelId];
  const layout = layoutOf(modelId, themes.map((t) => t.id));
  const th = art.theme(theme.id);
  const standalone = variant === "standalone";
  const key = `${variant}|${standalone ? theme.id : ""}|${modelId}`;
  const profile = {
    uuid: profileUuid(variant, standalone ? theme.id : "", modelId),
    name: standalone ? standaloneName(theme, model) : bundledName(model),
    model, pages: [], folders: [], defaultPage: null,
  };
  // Previews: the scene pages, then each folder page once, in the order they're first reached.
  const pagePreviews = [], folderPreviews = [], previewed = new Set();
  const counts = { keys: 0, dials: 0, folders: 0, blanks: 0 };
  const plugin = env.plugin;
  const id = (where) => P.uuidFrom(`action|${key}|${where}`);
  const px = keyPx(modelId);
  const image = (svg, w = px, h = px) => store.add(svg, w, h);

  // ---- one slot ----
  // An empty slot: a Hotkey with nothing set, there only to carry the blank picture, so a
  // page reads as one panel.
  const blank = (where) => {
    counts.blanks++;
    const k = image(art.blankKey(th));
    return { json: P.action(id(where), "com.elgato.streamdeck.system.hotkey", { settings: hotkeySettings(null), states: [P.keyState(k)] }), img: k };
  };
  // One of our plugin's actions. Without `states` it draws itself (bundled profiles); a
  // standalone profile gives it the key's picture, marked PLUGIN. On a bundled profile's scene
  // page each one also carries that scene as `page`, so the plugin knows which scene is showing
  // after Stream Deck's own page keys or dials have moved it (folders have none).
  const ours = (at, where, suffix, name, settings = {}, states = null) => P.action(id(where), `${PLUGIN_UUID}.${suffix}`, {
    name, plugin: { Name: "Tablet Deck", UUID: PLUGIN_UUID, Version: plugin.version },
    settings: !standalone && at.page ? { ...settings, page: at.page } : settings,
    states: states || Array.from({ length: plugin.states(`${PLUGIN_UUID}.${suffix}`) }, () => ({})),
  });
  const themeTarget = (themeId) => profileUuid("standalone", themeId, modelId);

  // A ref -> { json, img } for a key. `at`: { where, sceneIndex, path, child, turn } (child:
  // inside an Action Trigger, where pictures aren't shown; turn: a dial turn, not its push).
  function resolve(ref, at) {
    const where = at.where;
    const withImg = (svg, title) => {
      const k = at.child ? null : image(svg);
      return { states: [P.keyState(k, title)], img: k };
    };
    if (!ref) return at.child ? null : blank(where);
    if (ref.startsWith("@")) {
      const [kind, arg, arg2] = ref.split(":");
      if (kind === "@scene") {
        const idx = scenes.SCENES.findIndex((s) => s.id === arg);
        if (idx < 0) { warn(`${modelId}: unknown scene in ${ref}`); return blank(where); }
        if (!standalone) return { json: ours(at, where, "scene", "Scene", { scene: arg }), img: null };
        const s = withImg(art.sceneKey(th, scenes.SCENES[idx], idx === at.sceneIndex), scenes.SCENES[idx].name);
        return { json: P.action(id(where), "com.elgato.streamdeck.page.goto", { settings: { PageIndex: idx + 1 }, states: s.states }), img: s.img };
      }
      if (kind === "@next" || kind === "@prev") {
        const s = withImg(art.navKey(th, kind.slice(1)), kind === "@next" ? "Next Page" : "Previous Page");
        return { json: P.action(id(where), kind === "@next" ? "com.elgato.streamdeck.page.next" : "com.elgato.streamdeck.page.previous", { settings: {}, states: s.states }), img: s.img };
      }
      if (kind === "@back") {
        const s = withImg(art.navKey(th, "back"), "Back");
        return { json: P.action(id(where), "com.elgato.streamdeck.profile.backtoparent", { settings: {}, states: s.states }), img: s.img };
      }
      if (kind === "@folder" || kind === "@more") {
        const n = kind === "@more" ? Number(arg2) : 0;
        const child = folderPage(arg, n, at);
        if (!child) return blank(where);
        const f = scenes.FOLDERS[arg] || { name: arg, icon: "folder" };
        // On a scene page of the XLs the top row is the tab bar, folders included.
        const tab = model.nav === "tabs" && !at.path.includes(">") && /,0$/.test(at.slot || "");
        const s = withImg(kind === "@more" ? art.navKey(th, "more") : art.folderKey(th, f, { tab }), kind === "@more" ? "More" : f.name);
        return { json: P.action(id(where), "com.elgato.streamdeck.profile.openchild", { settings: { ProfileUUID: child }, states: s.states }), img: s.img };
      }
      if (kind === "@theme") {
        if (!themes.some((t) => t.id === arg)) { warn(`${modelId}: unknown theme in ${ref}`); return blank(where); }
        if (!standalone) return { json: ours(at, where, "theme", "Theme", { theme: arg }), img: null };
        // Opens the same model's profile in that theme, on the scene the folder was opened from.
        const s = withImg(art.themeKey(arg, arg === theme.id), themes.find((t) => t.id === arg).name);
        return { json: P.action(id(where), "com.elgato.streamdeck.profile.rotate", { settings: { DeviceUUID: "", PageIndex: (at.sceneIndex || 0) + 1, ProfileUUID: themeTarget(arg) }, states: s.states }), img: s.img };
      }
      warn(`${modelId}: unknown ref ${ref}`);
      return blank(where);
    }
    const a = catalog.byId.get(ref);
    if (!a) { env.missing.add(ref); return at.child ? null : blank(where); }
    return actionFor(a, at);
  }

  function actionFor(a, at) {
    const where = at.where;
    const lit = (svg) => (at.child ? undefined : [P.keyState(image(svg), a.label)]);
    const idle = (mark) => (at.child ? null : image(art.actionKey(th, a, { mark })));
    // Our plugin's action in a standalone profile, with a picture saying it needs the plugin.
    const viaOurs = (suffix, settings) => {
      const k = idle("PLUGIN");
      return { json: ours(at, where, suffix, a.label, settings, k ? [P.keyState(k, a.label)] : null), img: k };
    };
    switch (a.kind) {
      case "deck": {
        if (!standalone) return { json: ours(at, where, "key", a.label, { action: a.id }), img: null };
        if (viaPlugin(a, at.turn)) return viaOurs("key", { action: a.id });
        let combo;
        try { hotkey(a.keys); combo = a.keys; } catch (err) { warn(`${a.id}: ${err.message}`); return blank(where); }
        // A toggle (lit while on) flips its picture with each tap; Open/Close-style buttons
        // that set a state one way keep one picture, since a switch would drift.
        const toggle = a.state && a.state.set === undefined && !at.child;
        if (toggle) {
          const off = idle();
          return { json: P.action(id(where), "com.elgato.streamdeck.system.hotkeyswitch", { settings: hotkeySettings(combo, { slots: 2 }), states: [P.keyState(off, a.label), ...lit(art.actionKey(th, a, { lit: true }))] }), img: off };
        }
        const k = idle();
        return { json: P.action(id(where), "com.elgato.streamdeck.system.hotkey", { settings: hotkeySettings(combo), states: [P.keyState(k, a.label)] }), img: k };
      }
      case "system": case "website": {
        const k = idle();
        const uuid = a.kind === "website" ? "com.elgato.streamdeck.system.website" : a.system.uuid;
        const settings = a.kind === "website" ? { openInBrowser: true, path: a.url } : a.system.settings || {};
        return { json: P.action(id(where), uuid, { settings, states: [P.keyState(k, a.label)] }), img: k };
      }
      case "plugin": {
        const n = a.plugin.states || 1;
        const k = idle();
        let states = [at.child ? {} : P.keyState(k, a.label)];
        if (n > 1) states.push(at.child ? {} : P.keyState(image(art.actionKey(th, a, { lit: true })), a.label));
        while (states.length < n) states.push(states[0]);
        const onFirst = n > 1 && ON_FIRST.has(a.plugin.uuid);
        if (onFirst) states = [states[1], states[0], ...states.slice(2)];
        return {
          json: P.action(id(where), a.plugin.action, { name: a.label, plugin: { Name: a.plugin.name, UUID: a.plugin.uuid, Version: a.plugin.version }, settings: a.plugin.settings || {}, states, state: onFirst ? 1 : 0 }),
          img: k,
        };
      }
      case "nav": {
        const ref = { next: "@next", prev: "@prev", back: "@back", home: `@scene:${scenes.SCENES[0].id}` }[a.nav] || (a.nav.startsWith("folder:") ? `@folder:${a.nav.slice(7)}` : null);
        return ref ? resolve(ref, at) : blank(where);
      }
      case "tabletdeck": {
        const suffix = { talk: "talk", status: "status", "lights-reset": "lights", theme: "theme", scene: "scene" }[a.tabletdeck];
        if (!suffix) return at.child ? null : blank(where);
        if (!standalone) return { json: ours(at, where, suffix, a.label), img: null };
        // A standalone profile has Hold to Talk through the plugin, like the held buttons.
        // Status and Reset Lights show and clear the lights of the plugin's own keys, which
        // these profiles hardly use, and themes and scenes have built-in keys here: blank.
        if (a.tabletdeck === "talk") return viaOurs("talk", {});
        return at.child ? null : blank(where);
      }
      default:
        warn(`${a.id}: unknown kind ${a.kind}`);
        return blank(where);
    }
  }

  // A dial: built-in Action Trigger ([turn left, push, turn right]) with Hotkey and page
  // actions inside, the plugin's dial in a bundled profile, or another plugin's dial action.
  // `titleSize`: the strip's one title size, so its own background matches the strip.
  function dialFor(d, i, at, titleSize) {
    const where = `${at.where}/dial${i}`;
    if (!d) return null;
    const drawn = dialArt(d, standalone);
    const look = drawn && titleSize ? { ...drawn, titleSize } : drawn;
    const panel = look ? image(art.dialPanel(th, look), 200, 100) : null;
    const icon = look ? image(art.dialIcon(th, look), DIAL_ICON_PX, DIAL_ICON_PX) : null;
    if (d.action) {
      const a = catalog.byId.get(d.action);
      if (!a || a.kind !== "plugin" || !a.dial) { warn(`${modelId}: dial action "${d.action}" isn't a dial plugin action`); return null; }
      // Another plugin draws its own dial (a volume bar for Discord), so it gets no pictures,
      // and the strip draws only a frame there for that layout to sit in.
      return { json: P.action(id(where), a.plugin.action, { name: a.label, plugin: { Name: a.plugin.name, UUID: a.plugin.uuid, Version: a.plugin.version }, settings: a.plugin.settings || {}, states: [{}] }), look: look && { ...look, external: true }, icon };
    }
    const refs = [d.ccw, d.press, d.cw];
    // The plugin's dial presses deck buttons and steps through scenes and themes itself
    // (@next/@prev/@folder:themes); a dial with media or other plugins' actions stays built in.
    const pluginCan = (r) => !r || PLUGIN_DIAL_REFS.has(r) || (catalog.byId.get(r) || {}).kind === "deck";
    if (!standalone && refs.every(pluginCan)) {
      return { json: ours(at, where, "dial", d.label, { dial: { label: d.label, icon: d.icon, color: d.color || "", ccw: d.ccw || null, cw: d.cw || null, press: d.press || null } }), look, icon };
    }
    const children = refs.map((r, n) => {
      const child = r ? resolve(r, { ...at, where: `${where}/${n}`, child: true, turn: n !== 1 }) : null;
      // An unused direction is a Hotkey with nothing set, so the three slots keep their order.
      return child ? child.json : P.action(id(`${where}/${n}`), "com.elgato.streamdeck.system.hotkey", { settings: hotkeySettings(null) });
    });
    return {
      json: P.action(id(where), "com.elgato.streamdeck.keys.adaptor", {
        settings: {}, states: [{ ShowTitle: false, Title: " " }],
        extra: { Actions: children, Encoder: { Icon: P.img(icon), IconVisible: false, background: P.img(panel) } },
      }),
      look, icon,
    };
  }

  // ---- pages ----
  function fillKeys(keysIn, at) {
    const keys = {}, imgs = {};
    for (let r = 0; r < model.rows; r++) for (let c = 0; c < model.cols; c++) {
      const slot = `${c},${r}`;
      const res = resolve(keysIn[slot] || null, { ...at, where: `${at.path}@${slot}`, slot });
      keys[slot] = res.json;
      imgs[slot] = res.img;
      counts.keys++;
    }
    for (const slot of Object.keys(keysIn)) {
      const [c, r] = slot.split(",").map(Number);
      if (!(c < model.cols && r < model.rows)) warn(`${modelId}: ${keysIn[slot]} at ${slot} is outside the ${model.cols}x${model.rows} grid`);
    }
    return { keys, imgs };
  }

  function folderPage(folderId, n, at) {
    const pages = layout.folders[folderId];
    if (!pages || !pages[n]) { warn(`${modelId}: no folder page ${folderId}:${n}`); return null; }
    const pathHere = `${at.path}@${at.slot || "dial"}>${folderId}.${n}`;
    // A folder inside itself would never end; long More chains (emotes on a Mini) are fine.
    if (at.path.split(">").slice(1).some((p) => p.split("@")[0] === `${folderId}.${n}`) || pathHere.split(">").length > 32) throw new Error(`${modelId}: folder ${folderId} opens itself (${pathHere})`);
    const uuid = P.uuidFrom(`page|${key}|${pathHere}`);
    const folder = scenes.FOLDERS[folderId] || { name: folderId, icon: "folder" };
    const page = { uuid, name: pages.length > 1 ? `${folder.name} ${n + 1}` : folder.name, controllers: null };
    profile.folders.push(page);
    counts.folders++;
    const pv = `${folderId}.${n}`;
    const preview = previewed.has(pv) ? null : { title: `Folder: ${page.name}`, keys: {}, strip: null, dials: null };
    if (preview) { previewed.add(pv); folderPreviews.push(preview); }
    const { keys, imgs } = fillKeys(pages[n].keys, { path: pathHere, sceneIndex: at.sceneIndex });
    // Dials rest while a folder is open; the strip says which folder (and page) it is.
    const strip = model.dials ? image(art.folderStrip(th, { ...folder, name: page.name }, model.dials, n > 0 ? `Back: page ${n}` : "Back to leave"), 200 * model.dials, 100) : null;
    page.controllers = P.controllers(model, { keys, dials: {}, background: strip });
    if (preview) Object.assign(preview, { keys: imgs, strip });
    return uuid;
  }

  scenes.SCENES.forEach((scene, i) => {
    const p = layout.pages.find((x) => x.scene === scene.id);
    if (!p) { warn(`${modelId}: no page for scene ${scene.id}`); return; }
    const page = { uuid: P.uuidFrom(`page|${key}|scene:${scene.id}`), name: scene.name, controllers: null };
    profile.pages.push(page);
    const at = { path: `scene:${scene.id}`, sceneIndex: i, page: scene.id };
    const { keys, imgs } = fillKeys(p.keys, at);
    let dials = null, strip = null, dialLooks = null;
    if (model.dials) {
      dials = {};
      dialLooks = [];
      const list = (p.dials || []).slice(0, model.dials);
      if ((p.dials || []).length > model.dials) warn(`${modelId}: ${scene.id} has ${p.dials.length} dials, the model has ${model.dials}`);
      const ts = art.titleSize(th, list.filter((d) => d && !d.action).map((d) => d.label));
      for (let n = 0; n < model.dials; n++) {
        const res = dialFor(list[n] || null, n, { ...at, where: `${at.path}`, slot: `dial${n}` }, ts);
        if (res) { dials[`${n},0`] = res.json; counts.dials++; }
        dialLooks.push(res ? { look: res.look, icon: res.icon, label: res.look ? res.look.label : (catalog.byId.get((list[n] || {}).action) || {}).label } : null);
      }
      strip = image(art.strip(th, dialLooks.map((x) => (x ? x.look : null))), 200 * model.dials, 100);
    } else if (p.dials && p.dials.some(Boolean)) warn(`${modelId}: ${scene.id} has dials but the model has none`);
    page.controllers = P.controllers(model, { keys, dials, background: strip });
    pagePreviews.push({ title: `${i + 1} · ${scene.name}`, keys: imgs, strip, dials: dialLooks });
  });
  if (profile.pages.length > MAX_PAGES) warn(`${modelId}: ${profile.pages.length} pages, Stream Deck shows at most ${MAX_PAGES}`);
  profile.defaultPage = { uuid: P.uuidFrom(`page|${key}|default`), name: "", controllers: P.controllers(model) };
  return { profile, previews: [...pagePreviews, ...folderPreviews], counts };
}

// ---------- icon packs ----------

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && w.length > 1);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

function planIconPack(env, theme) {
  const { art, store } = env;
  const th = art.theme(theme.id);
  const cats = new Map(catalog.categories.map((c) => [c.id, c]));
  const items = [];
  const add = (name, label, tags, svg, category) => items.push({ file: `${slug(name)}.png`, name: label, tags: [...new Set(tags)], img: store.add(svg), category });
  // Names as Stream Deck's icon library lists them, so none is there twice: scene keys say
  // so ("Flight scene" next to the Flight operator mode), and actions sharing a label ("Back"
  // on shields and in navigation) get their category.
  const uses = new Map();
  for (const a of catalog.actions) uses.set(a.label, (uses.get(a.label) || 0) + 1);
  const nameOf = (a) => (uses.get(a.label) > 1 ? `${a.label} (${(cats.get(a.category) || { name: a.category }).name})` : a.label);
  for (const a of catalog.actions) {
    const c = cats.get(a.category) || { id: a.category, name: a.category };
    const tags = [c.id, ...words(c.name), ...(a.kind === "deck" ? ["starcitizen"] : [a.kind])];
    add(a.id, nameOf(a), tags, art.actionKey(th, a), a.category);
    if (a.state || (a.plugin && a.plugin.states > 1)) add(`${a.id}-lit`, `${nameOf(a)} (lit)`, [...tags, "lit"], art.actionKey(th, a, { lit: true }));
  }
  for (const s of scenes.SCENES) {
    add(`scene-${s.id}`, `${s.name} scene`, ["scene", "navigation", ...words(s.name)], art.sceneKey(th, s, false));
    add(`scene-${s.id}-lit`, `${s.name} scene (current)`, ["scene", "navigation", "lit", ...words(s.name)], art.sceneKey(th, s, true));
  }
  for (const [id, f] of Object.entries(scenes.FOLDERS)) add(`folder-${id}`, `${f.name} folder`, ["folder", "navigation", ...words(f.name)], art.folderKey(th, f));
  add("nav-more", "More", ["navigation", "folder"], art.navKey(th, "more"));
  add(`theme-${theme.id}`, `${theme.name} theme`, ["theme", ...words(theme.full)], art.themeKey(theme.id, false));
  add("blank", "Blank", ["blank"], art.blankKey(th));
  const emblem = keyart.key({ theme: th, icon: `<g transform="scale(.75)">${theme.emblem}</g>`, showLabel: false }).split(TEXT).join(th.text);
  const named = new Set();
  for (const it of items) { if (named.has(it.name)) env.warn(`icon pack: "${it.name}" is listed twice`); named.add(it.name); }
  return { theme, items, icon: store.add(emblem, 56, 56) };
}

// A contact sheet of the pack's keys for its previews/ folder (1280x800, like Icon Pack Man).
function packPreviewHtml(pack, store) {
  // The theme key and the scenes, a row of lit keys, then a round of every category; each key
  // once, lit or not.
  const pick = [], seen = new Set();
  const take = (it) => {
    const base = it && it.file.replace(/-lit\.png$/, ".png");
    if (it && !seen.has(base) && pick.length < 40) { seen.add(base); pick.push(it); }
  };
  take(pack.items.find((it) => it.file.startsWith("theme-")));
  pack.items.filter((it) => /^scene-[a-z]+\.png$/.test(it.file)).forEach(take);
  pack.items.filter((it) => /-lit\.png$/.test(it.file) && !it.file.startsWith("scene-")).slice(0, 8).forEach(take);
  const byCat = new Map();
  for (const it of pack.items) if (it.category && !/-lit\.png$/.test(it.file)) { if (!byCat.has(it.category)) byCat.set(it.category, []); byCat.get(it.category).push(it); }
  for (let round = 0; pick.length < 40 && round < 20; round++) for (const list of byCat.values()) take(list[round]);
  const cells = pick.map((it) => `<img src="data:image/png;base64,${store.get(it.img).toString("base64")}" width="144" height="144">`).join("");
  return `<div style="width:1280px;height:800px;background:#000;display:grid;grid-template-columns:repeat(8,144px);gap:16px;padding:8px;box-sizing:border-box;justify-content:center;align-content:center">${cells}</div>`;
}

function writeIconPack(env, pack, previewPng) {
  const { store } = env;
  const id = ICONPACK_ID(pack.theme.id);
  const root = `${id}.sdIconPack/`;
  const manifest = {
    Name: `Tablet Deck ${pack.theme.name}`,
    Version: VERSION,
    Description: `${pack.items.length} Star Citizen keys in Tablet Deck's ${pack.theme.full} HUD theme: every Tablet Deck action (with lit versions of the ones that light up), scenes, folders and navigation. Static PNG, 144 x 144. Fan-made; not affiliated with Cloud Imperium Games or Elgato.`,
    Author: AUTHOR,
    URL: SITE,
    Icon: "icon.png",
    License: "license.txt",
  };
  const icons = pack.items.map((it) => ({ path: it.file, name: it.name, tags: it.tags }));
  const entries = [
    { name: root, dir: true }, { name: `${root}icons/`, dir: true }, { name: `${root}previews/`, dir: true },
    { name: `${root}icons.json`, data: JSON.stringify(icons, null, 4) },
    { name: `${root}icon.png`, data: store.get(pack.icon) },
    { name: `${root}manifest.json`, data: JSON.stringify(manifest, null, 4) },
    { name: `${root}license.txt`, data: read("LICENSE") },
    ...pack.items.map((it) => ({ name: `${root}icons/${it.file}`, data: store.get(it.img) })),
  ];
  if (previewPng) entries.push({ name: `${root}previews/1-preview.png`, data: previewPng });
  const file = path.join(env.out, "icons", `Tablet Deck ${pack.theme.name}.streamDeckIconPack`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zip(entries));
  return file;
}

// ---------- the plugin ----------

// The deck's translations (public/i18n.js: English -> [es, fr, de]), so the plugin shows
// button labels in the player's language. Optional: the plugin falls back to English.
function deckLabels() {
  try {
    const src = read("public/i18n.js");
    const start = src.indexOf("const T = {");
    const end = src.indexOf("\n  };", start);
    if (start < 0 || end < 0) return null;
    return vm.runInNewContext(`${src.slice(start, end + 5)}\nT`, {});
  } catch (err) {
    console.warn(`  ! couldn't read public/i18n.js (${err.message}); the plugin gets no translations`);
    return null;
  }
}

// What the plugin's source manifest declares, so bundled profiles give each of our actions
// as many states as it has; works (with one state each) before the plugin exists. The packed
// plugin's version is Tablet Deck's own (package.json), whatever the source manifest says.
function pluginInfo() {
  const file = path.join(PLUGIN_SRC, "manifest.json");
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { if (fs.existsSync(file)) console.warn(`  ! ${path.relative(ROOT, file)}: ${err.message}`); }
  const states = new Map(((manifest && manifest.Actions) || []).map((a) => [a.UUID, (a.States || []).length || 1]));
  return { manifest, version: `${VERSION}.0`, states: (uuid) => states.get(uuid) || 1 };
}

// Images the manifest points at (paths without extension) that the source folder lacks:
// those are drawn here at 1x and @2x, by the rules in research/sdk.verified.md section 4.
function plannedPluginImages(env, manifest) {
  const { art, store } = env;
  const th = art.theme(env.themes[0].id);
  const want = [];
  const exists = (p) => [".png", ".svg", ".gif"].some((ext) => fs.existsSync(path.join(PLUGIN_SRC, `${p}${ext}`)));
  const plan = (p, make) => { if (p && typeof p === "string" && !exists(p) && !want.some((w) => w.path === p)) want.push({ path: p, make }); };
  const ICON_FOR = { key: "flight-ready", dial: "speed", scene: "grid", theme: "palette", talk: "mic", status: "app", lights: "power-reset" };
  const iconFor = (uuid) => ICON_FOR[String(uuid).split(".").pop()] || "default";
  const pluginIcon = read("public/icon.svg");
  plan(manifest.Icon, (s) => [pluginIcon, 256 * s, 256 * s]);
  plan(manifest.CategoryIcon, (s) => [art.tabletMark(28 * s), 28 * s, 28 * s]);
  for (const a of manifest.Actions || []) {
    const name = iconFor(a.UUID);
    plan(a.Icon, (s) => [art.listIcon(name, 20 * s), 20 * s, 20 * s]);
    (a.States || []).forEach((st, i) => plan(st.Image, (s) => [keyart.key({ theme: th, icon: art.icon(name), label: a.Name, lit: i > 0 }), 72 * s, 72 * s]));
    if (a.Encoder) {
      const look = { label: a.Name, icon: name, color: "", hints: { ccw: "−", cw: "+", press: "Push" } };
      plan(a.Encoder.Icon, (s) => [art.dialIcon(th, look), 72 * s, 72 * s]);
      plan(a.Encoder.background, (s) => [art.dialPanel(th, look), 200 * s, 100 * s]);
    }
  }
  return want.map((w) => ({ path: w.path, x1: store.add(...w.make(1)), x2: store.add(...w.make(2)), png: !/\.svg$/.test(w.path) }));
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

function writePlugin(env, info, images, bundled) {
  const stage = path.join(env.out, "plugin", `${PLUGIN_UUID}.sdPlugin`);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  const files = new Map(); // path in the plugin -> Buffer
  if (fs.existsSync(PLUGIN_SRC)) for (const rel of listFiles(PLUGIN_SRC)) if (!rel.startsWith("data/") && !rel.startsWith("profiles/")) files.set(rel, fs.readFileSync(path.join(PLUGIN_SRC, rel)));
  // What the plugin reads at run time (streamdeck/CONTRACT.md).
  files.set("data/catalog.json", Buffer.from(JSON.stringify({ actions: catalog.actions, categories: catalog.categories })));
  files.set("data/icons.json", Buffer.from(JSON.stringify(env.icons)));
  files.set("data/themes.json", Buffer.from(JSON.stringify(env.tokens)));
  files.set("data/scenes.json", Buffer.from(JSON.stringify({ SCENES: scenes.SCENES, MODELS: scenes.MODELS, DIAL: scenes.DIAL })));
  files.set("bin/keyart.js", fs.readFileSync(path.join(ROOT, "streamdeck", "keyart.js")));
  const labels = deckLabels();
  if (labels) files.set("data/i18n.json", Buffer.from(JSON.stringify(labels)));
  for (const im of images) {
    files.set(`${im.path}.png`, env.store.get(im.x1));
    files.set(`${im.path}@2x.png`, env.store.get(im.x2));
  }
  for (const b of bundled) files.set(`profiles/${bundledName(b.model)}.streamDeckProfile`, b.buffer);
  if (info.manifest) {
    // The source manifest has no Profiles: they're listed here, one per model's DeviceType.
    const manifest = { ...info.manifest, Version: info.version, Profiles: bundled.map((b) => ({ Name: `profiles/${bundledName(b.model)}`, DeviceType: b.model.type, Readonly: false, DontAutoSwitchWhenInstalled: true, AutoInstall: false })) };
    files.set("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, "\t")}\n`));
  }
  for (const [rel, buf] of files) { fs.mkdirSync(path.dirname(path.join(stage, rel)), { recursive: true }); fs.writeFileSync(path.join(stage, rel), buf); }
  if (!info.manifest) return { stage, file: null, files: files.size };
  // Like Elgato's CLI: file entries only, deflated, under the <uuid>.sdPlugin folder.
  const file = path.join(env.out, `${PLUGIN_UUID}.streamDeckPlugin`);
  fs.writeFileSync(file, zip([...files.keys()].sort().map((rel) => ({ name: `${PLUGIN_UUID}.sdPlugin/${rel}`, data: files.get(rel) }))));
  return { stage, file, files: files.size };
}

// ---------- keybinds ----------

// The standalone profiles' Hotkeys press the Tablet Deck Keyboard profile's keys for actions
// Star Citizen has no default key for, so the profile ships next to them.
const KEYBINDS = "TabletDeck-StarCitizen.xml";
const KEYBINDS_README = `Tablet Deck Keyboard: the Star Citizen keybinds the Stream Deck profiles use

The "Tablet Deck <theme> - <model>" profiles press Star Citizen's default keys, and for
actions the game has no default key for (operator modes, shield faces, doors, emotes,
targeting and more) the keys in this profile. Load it once, or those keys press nothing
useful.

1. Copy ${KEYBINDS} into the game's Controls\\Mappings folder, for example
   StarCitizen\\LIVE\\user\\client\\0\\Controls\\Mappings (create the Controls and Mappings
   folders if they're missing). Tablet Deck's window does this for you: Settings, Install
   keybind profile.
2. In Star Citizen, open Options > Keybindings > Control Profiles and load
   "Tablet Deck Keyboard". This replaces your current custom binds, so note any you want to
   keep and set them again afterwards.

Good to know:
- Stream Deck presses these keys into whichever window is in front. Tablet Deck's check that
  Star Citizen has focus only covers keys that go through Tablet Deck.
- Keys marked PLUGIN must be held, or held for a set time, which Stream Deck's own Hotkey
  can't do. They need the Tablet Deck plugin (com.nodiecode.tabletdeck.streamDeckPlugin) and
  Tablet Deck running on this PC, and they go through its focus check.
`;
function writeKeybinds(out) {
  const dir = path.join(out, "keybinds");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, "keybinds", KEYBINDS), path.join(dir, KEYBINDS));
  fs.writeFileSync(path.join(dir, "README.txt"), KEYBINDS_README.replace(/\n/g, "\r\n"));
  return path.join(dir, KEYBINDS);
}

// ---------- release downloads ----------

// --release: the downloads a GitHub release carries, in <out>/release/: a zip of each model's
// profiles (every theme built, with the keybind profile they rely on and a readme), one of all
// the icon packs, and the plugin as it is. Made from the files just written.
const RELEASE_NAME = { mini: "Mini", neo: "Neo", std: "15-Key", mobile: "Mobile", plus: "Plus", xl: "XL", plusxl: "Plus-XL" };
const PROFILES_README = `Tablet Deck: Stream Deck profiles for {model}

One profile per manufacturer theme. Double-click one to add it to Stream Deck, and add every
theme you want to switch between: the Themes folder opens the same page in another theme's
profile (if a theme key doesn't switch, pick that profile once in the key's settings).

Each profile has a page per scene (Flight, Combat, Mining, Salvage, Hauling & Exploration,
On Foot, Comms) and folders for emergencies, shields, power, emotes, websites and themes.

Before you fly, load the Tablet Deck Keyboard keybinds in Star Citizen: see keybinds\\README.txt.

The keys are Stream Deck Hotkeys, which Stream Deck presses into whichever window is in
front. Keys marked PLUGIN hold a key or press it for a set time, which a Hotkey can't do:
they need the Tablet Deck plugin (com.nodiecode.tabletdeck.streamDeckPlugin) and Tablet Deck
running on this PC. Discord and OBS keys need Elgato's Discord and OBS Studio plugins;
Stream Deck offers to install them.

More: https://github.com/nodieCode/tablet-deck#stream-deck
`;
function writeRelease(out, models) {
  const dir = path.join(out, "release");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const filesIn = (sub, ext) => {
    const d = path.join(out, sub);
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(ext) && fs.statSync(path.join(d, f)).isFile()).sort().map((f) => path.join(d, f)) : [];
  };
  const entry = (name, file) => ({ name, data: fs.readFileSync(file) });
  const keybinds = filesIn("keybinds", "").map((f) => entry(`keybinds/${path.basename(f)}`, f));
  const written = [];
  for (const m of models) {
    const model = scenes.MODELS[m];
    const profiles = filesIn(path.join("profiles", model.name), ".streamDeckProfile");
    if (!profiles.length) continue;
    const file = path.join(dir, `TabletDeck-StreamDeck-Profiles-${RELEASE_NAME[m] || m}.zip`);
    const readme = { name: "README.txt", data: PROFILES_README.replace("{model}", model.name).replace(/\n/g, "\r\n") };
    fs.writeFileSync(file, zip([readme, ...profiles.map((f) => entry(path.basename(f), f)), ...keybinds]));
    written.push(file);
  }
  const packs = filesIn("icons", ".streamDeckIconPack");
  if (packs.length) {
    const file = path.join(dir, "TabletDeck-StreamDeck-IconPacks.zip");
    fs.writeFileSync(file, zip(packs.map((f) => entry(path.basename(f), f))));
    written.push(file);
  }
  const plugin = path.join(out, `${PLUGIN_UUID}.streamDeckPlugin`);
  if (fs.existsSync(plugin)) {
    fs.copyFileSync(plugin, path.join(dir, path.basename(plugin)));
    written.push(path.join(dir, path.basename(plugin)));
  }
  return written;
}

// Stream Deck versions as numbers to compare ("7.10" after "7.9").
const versionAtLeast = (v, min) => {
  const a = String(v || "0").split(".").map(Number), b = min.split(".").map(Number);
  for (let i = 0; i < b.length; i++) if ((a[i] || 0) !== b[i]) return (a[i] || 0) > b[i];
  return true;
};
// research/profiles.verified.md 7: a plugin that switches to its bundled profiles wants 7.3+
// (7.3.0 fixed switching from them), and 7.3 is also the first app with the + XL.
const minVersionNote = (manifest) => {
  const v = manifest && manifest.Software && manifest.Software.MinimumVersion;
  return v && !versionAtLeast(v, "7.3") ? `plugin manifest: Software.MinimumVersion is "${v}"; switching to bundled profiles needs Stream Deck 7.3 or later (research/profiles.verified.md 7)` : null;
};

// ---------- previews ----------

function previewHtml(env, title, model, panels, theme) {
  const { store, art } = env;
  const th = art.theme(theme.id);
  const K = 72, G = 8;
  const url = (k) => `data:image/png;base64,${store.get(k).toString("base64")}`;
  const keypadW = model.cols * K + (model.cols - 1) * G;
  const panelW = keypadW + 32;
  const columns = Math.max(1, Math.min(panels.length, Math.floor(2600 / (panelW + 24))));
  const font = `font-family:${th.font.family.replace(/"/g, "'")};`;
  const cells = panels.map((p) => {
    const keys = [];
    for (let r = 0; r < model.rows; r++) for (let c = 0; c < model.cols; c++) {
      const k = p.keys[`${c},${r}`];
      keys.push(k ? `<img src="${url(k)}" width="${K}" height="${K}" style="border-radius:8px">` : `<div style="width:${K}px;height:${K}px;border-radius:8px;background:#111"></div>`);
    }
    let lower = "";
    if (model.dials) {
      const sh = Math.round((keypadW / (200 * model.dials)) * 100);
      lower += p.strip ? `<img src="${url(p.strip)}" width="${keypadW}" height="${sh}" style="display:block;margin-top:${G * 2}px;border-radius:6px">` : "";
      const slot = keypadW / model.dials;
      lower += `<div style="display:flex;margin-top:${G * 2}px">${Array.from({ length: model.dials }, (_, i) => {
        const d = p.dials && p.dials[i];
        return `<div style="width:${slot}px;text-align:center;color:#8a99a8;font:600 11px sans-serif"><div style="width:52px;height:52px;margin:0 auto 4px;border-radius:50%;background:radial-gradient(#2a3038,#0b0d10);border:2px solid #3a424c;display:flex;align-items:center;justify-content:center">${d && d.icon ? `<img src="${url(d.icon)}" width="34" height="34">` : ""}</div>${d ? (d.label || "").replace(/</g, "&lt;") : "–"}</div>`;
      }).join("")}</div>`;
    }
    return `<figure style="margin:0;width:${panelW}px"><figcaption style="color:#e8eef5;font-size:15px;font-weight:600;letter-spacing:.06em;margin:0 0 8px;${font}">${p.title.replace(/</g, "&lt;")}</figcaption>
      <div style="background:linear-gradient(#1b1f24,#0d0f12);border:1px solid #2c3239;border-radius:18px;padding:16px">
      <div style="display:grid;grid-template-columns:repeat(${model.cols},${K}px);gap:${G}px">${keys.join("")}</div>${lower}</div></figure>`;
  }).join("");
  return `<div style="display:inline-block;background:#06080b;padding:24px 28px 28px">
    <div style="color:#fff;font:700 22px sans-serif;margin-bottom:18px;${font}">${title.replace(/</g, "&lt;")}</div>
    <div style="display:grid;grid-template-columns:repeat(${columns},max-content);gap:24px">${cells}</div></div>`;
}

function writePreviewIndex(out, list) {
  // Stream Deck + XL first: the flagship layout.
  const rows = [...list].sort((a, b) => (b.file.startsWith("plusxl-") ? 1 : 0) - (a.file.startsWith("plusxl-") ? 1 : 0)).map((p) => `<figure><a href="${encodeURI(p.file)}"><img src="${encodeURI(p.file)}" loading="lazy" alt=""></a><figcaption>${p.title}</figcaption></figure>`).join("\n");
  fs.writeFileSync(path.join(out, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tablet Deck Stream Deck previews</title>
<style>body{margin:0;padding:24px;background:#06080b;color:#e8eef5;font:15px system-ui,sans-serif}h1{font-size:22px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px}figure{margin:0}img{width:100%;border:1px solid #2c3239;border-radius:8px;background:#000}
figcaption{margin-top:6px;color:#9fb0c0}</style></head>
<body><h1>Tablet Deck for Stream Deck: profile previews</h1><p>Each sheet shows every page and folder of one profile as the device shows it.</p>
<main>
${rows}
</main></body></html>
`);
}

// ---------- check ----------

function checkLayouts(env) {
  const errors = [], warnings = [];
  const themeIds = new Set(env.themes.map((t) => t.id));
  const sceneIds = new Set(scenes.SCENES.map((s) => s.id));
  const ids = new Set();
  for (const a of catalog.actions) {
    if (ids.has(a.id)) errors.push(`catalog: duplicate id ${a.id}`);
    ids.add(a.id);
    if (!env.icons[a.icon]) warnings.push(`catalog: ${a.id} has no icon "${a.icon}" in public/icons.js (draws the default)`);
    if (a.kind === "deck") { try { hotkey(a.keys); } catch (err) { errors.push(`catalog: ${a.id}: ${err.message}`); } }
  }
  for (const [modelId, model] of Object.entries(scenes.MODELS)) {
    let layout;
    try { layout = layoutOf(modelId, env.themes.map((t) => t.id)); } catch (err) { errors.push(`${modelId}: layoutFor failed: ${err.message}`); continue; }
    if (layout.pages.length > MAX_PAGES) errors.push(`${modelId}: ${layout.pages.length} pages (at most ${MAX_PAGES})`);
    const checkRef = (ref, where) => {
      if (!ref) return;
      if (!ref.startsWith("@")) { if (!catalog.byId.has(ref)) errors.push(`${modelId} ${where}: "${ref}" isn't in the catalog`); return; }
      const [kind, arg, n] = ref.split(":");
      const ok = kind === "@back" || kind === "@next" || kind === "@prev"
        || (kind === "@scene" && sceneIds.has(arg)) || (kind === "@theme" && themeIds.has(arg))
        || (kind === "@folder" && layout.folders[arg] && layout.folders[arg].length)
        || (kind === "@more" && layout.folders[arg] && layout.folders[arg][Number(n)]);
      if (!ok) errors.push(`${modelId} ${where}: "${ref}" doesn't resolve`);
    };
    const checkKeys = (keys, where) => {
      for (const [slot, ref] of Object.entries(keys)) {
        const [c, r] = slot.split(",").map(Number);
        if (!(Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < model.cols && r < model.rows)) errors.push(`${modelId} ${where}: slot ${slot} is outside the ${model.cols}x${model.rows} grid`);
        checkRef(ref, `${where} ${slot}`);
      }
    };
    for (const p of layout.pages) {
      checkKeys(p.keys, p.scene);
      const dials = (p.dials || []).filter(Boolean);
      if (dials.length && !model.dials) errors.push(`${modelId} ${p.scene}: dials on a model without dials`);
      if ((p.dials || []).length > (model.dials || 0)) errors.push(`${modelId} ${p.scene}: ${p.dials.length} dials (the model has ${model.dials || 0})`);
      for (const d of dials) {
        if (d.action) {
          const a = catalog.byId.get(d.action);
          if (!a || a.kind !== "plugin" || !a.dial) errors.push(`${modelId} ${p.scene}: dial action "${d.action}" isn't a dial plugin action`);
        } else [d.ccw, d.press, d.cw].forEach((r) => checkRef(r, `${p.scene} dial ${d.label}`));
        if (!d.action && !env.icons[d.icon]) warnings.push(`${modelId} ${p.scene}: dial ${d.label} has no icon "${d.icon}"`);
      }
    }
    for (const [fid, pages] of Object.entries(layout.folders)) pages.forEach((p, n) => {
      checkKeys(p.keys, `folder ${fid}.${n}`);
      // Stream Deck keeps a folder's Back key top left: every folder the app writes has it at
      // 0,0 (research/navigation.verified.md 2.2), and one script-written profile seen again
      // after the app had it had its Back keys moved there, over the key at 0,0.
      if (!Object.values(p.keys).includes("@back")) errors.push(`${modelId} folder ${fid}.${n}: no Back key`);
      else if (p.keys["0,0"] !== "@back") errors.push(`${modelId} folder ${fid}.${n}: Back isn't at 0,0`);
    });
  }
  for (const s of scenes.SCENES) if (!env.icons[s.icon]) warnings.push(`scene ${s.id}: no icon "${s.icon}"`);
  for (const [id, f] of Object.entries(scenes.FOLDERS)) if (!env.icons[f.icon]) warnings.push(`folder ${id}: no icon "${f.icon}"`);
  // Every theme's key face: a --key-clip the outline can't read draws no face, frame or lit
  // ring at all (a path of two points), so a lit key looks unlit.
  for (const t of env.themes) {
    const d = keyart.outline(env.art.theme(t.id), 6, 6, 132, 132);
    const points = new Set();
    let x = 0, y = 0;
    for (const [, cmd, args] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/g)) {
      const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
      if (cmd === "H") x = n[0]; else if (cmd === "V") y = n[0]; else if (n.length >= 2) [x, y] = n.slice(-2);
      if (cmd !== "Z") points.add(`${x},${y}`);
    }
    if (/NaN/.test(d) || points.size < 4) errors.push(`theme ${t.id}: key outline is degenerate`);
  }
  return { errors, warnings };
}

// Opens what's in --out and checks it the way Stream Deck will read it.
function checkBuilt(out) {
  const errors = [], notes = [];
  if (!fs.existsSync(out)) return { errors, notes: ["nothing built yet"] };
  const profilesByModel = new Map(); // model -> Set(profile uuid)
  const rotateTargets = [];
  // Labels of deck buttons a Hotkey can't press (held or timed), and of those it can.
  const held = new Set(), tapped = new Set();
  for (const a of catalog.actions) if (a.kind === "deck") (viaPlugin(a) ? held : tapped).add(a.label);
  const walkFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
  const all = walkFiles(out);
  const checkProfile = (label, buf) => {
    const entries = unzip(buf);
    const byName = new Map(entries.map((e) => [e.name, e]));
    const root = entries.find((e) => /^[0-9A-F-]{36}\.sdProfile\/manifest\.json$/.test(e.name));
    if (!root) { errors.push(`${label}: no <UUID>.sdProfile/manifest.json`); return; }
    const base = root.name.replace("manifest.json", "");
    const m = JSON.parse(root.data);
    const uuid = base.slice(0, 36).toLowerCase();
    if (!profilesByModel.has(m.Device.Model)) profilesByModel.set(m.Device.Model, new Set());
    profilesByModel.get(m.Device.Model).add(uuid);
    if (m.Version !== "2.0") errors.push(`${label}: Version ${m.Version}`);
    if (m.Pages.Pages.length > MAX_PAGES) errors.push(`${label}: ${m.Pages.Pages.length} pages`);
    if (m.Pages.Pages.includes(m.Pages.Default)) errors.push(`${label}: the Default page is listed in Pages`);
    const pageDirs = new Set(entries.filter((e) => e.name.endsWith("/manifest.json") && e.name.startsWith(`${base}Profiles/`)).map((e) => e.name.split("/")[2]));
    for (const p of [...m.Pages.Pages, m.Pages.Default]) if (!pageDirs.has(P.pageDir(p))) errors.push(`${label}: page ${p} has no folder ${P.pageDir(p)}`);
    const known = new Set([...pageDirs]);
    for (const dir of pageDirs) {
      const pm = JSON.parse(byName.get(`${base}Profiles/${dir}/manifest.json`).data);
      const checkImage = (ref, want, where) => {
        const e = byName.get(`${base}Profiles/${dir}/${ref}`);
        if (!e) { errors.push(`${label} ${dir}: ${where} image ${ref} is missing`); return; }
        const s = png.size(e.data);
        if (!s) errors.push(`${label} ${dir}: ${ref} isn't a PNG`);
        else if (want === "square" ? s.width !== s.height || s.width < 72 || s.width > 288 : want && (s.width !== want[0] || s.height !== want[1])) errors.push(`${label} ${dir}: ${ref} is ${s.width}x${s.height}, expected ${want === "square" ? "a square of 72 to 288 px" : want.join("x")}`);
      };
      for (const ctl of pm.Controllers) {
        if (ctl.Background) checkImage(ctl.Background, null, `${ctl.Type} background`);
        for (const [slot, a] of Object.entries(ctl.Actions || {})) {
          // turn: a dial turn inside an Action Trigger, where a held button taps (viaPlugin).
          const walk = (act, where, turn = false) => {
            (act.States || []).forEach((st) => { if (st.Image) checkImage(st.Image, "square", where); });
            if (!(Number.isInteger(act.State) && act.State >= 0 && act.State < Math.max(1, (act.States || []).length))) errors.push(`${label} ${dir} ${where}: State ${act.State} with ${(act.States || []).length} states`);
            if (/^com\.elgato\.streamdeck\.system\.hotkey/.test(act.UUID) && act.States && act.States[0] && !turn && held.has(act.States[0].Title) && !tapped.has(act.States[0].Title)) errors.push(`${label} ${dir} ${where}: "${act.States[0].Title}" must be held, which a Hotkey can't do`);
            if (act.Encoder) {
              if (act.Encoder.Icon) checkImage(act.Encoder.Icon, "square", `${where} dial icon`);
              if (act.Encoder.background) checkImage(act.Encoder.background, [200, 100], `${where} dial background`);
            }
            if (act.UUID === "com.elgato.streamdeck.profile.openchild" && !known.has(P.pageDir(act.Settings.ProfileUUID))) errors.push(`${label} ${dir} ${where}: folder ${act.Settings.ProfileUUID} has no page`);
            if (act.UUID === "com.elgato.streamdeck.page.goto" && !(act.Settings.PageIndex >= 1 && act.Settings.PageIndex <= m.Pages.Pages.length)) errors.push(`${label} ${dir} ${where}: PageIndex ${act.Settings.PageIndex}`);
            if (act.UUID === "com.elgato.streamdeck.profile.rotate") rotateTargets.push({ label, model: m.Device.Model, uuid: act.Settings.ProfileUUID });
            (act.Actions || []).forEach((c, i) => walk(c, `${where}/${i}`, act.UUID === "com.elgato.streamdeck.keys.adaptor" && i !== 1));
          };
          walk(a, `${ctl.Type} ${slot}`);
        }
      }
    }
  };
  let profiles = 0, packs = 0;
  for (const f of all.filter((x) => x.endsWith(".streamDeckProfile") && !x.includes(`${path.sep}plugin${path.sep}`))) {
    try { checkProfile(path.relative(out, f), fs.readFileSync(f)); profiles++; } catch (err) { errors.push(`${path.relative(out, f)}: ${err.message}`); }
  }
  if (profiles && !fs.existsSync(path.join(out, "keybinds", KEYBINDS))) errors.push(`keybinds/${KEYBINDS} is missing: the standalone profiles' hotkeys need it`);
  // Theme keys name the same model's profile in another theme; with only some themes built,
  // the others' targets can't be checked here.
  const open = rotateTargets.filter((t) => !(profilesByModel.get(t.model) || new Set()).has(t.uuid));
  if (rotateTargets.length) notes.push(`${rotateTargets.length - open.length} of ${rotateTargets.length} Switch Profile keys point at a profile built here${open.length ? ` (the rest at themes not built this time: ${new Set(open.map((t) => t.uuid)).size} profiles)` : ""}`);
  for (const f of all.filter((x) => x.endsWith(".streamDeckIconPack"))) {
    const label = path.relative(out, f);
    try {
      const entries = unzip(fs.readFileSync(f));
      const byName = new Map(entries.map((e) => [e.name, e]));
      const top = [...new Set(entries.map((e) => e.name.split("/")[0]))];
      if (top.length !== 1 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+\.sdIconPack$/.test(top[0])) { errors.push(`${label}: one <id>.sdIconPack folder expected, found ${top.join(", ")}`); continue; }
      const root = `${top[0]}/`;
      const m = JSON.parse(byName.get(`${root}manifest.json`).data);
      for (const k of ["Name", "Version", "Author", "Icon"]) if (!m[k]) errors.push(`${label}: manifest has no ${k}`);
      if (!/^[0-9.]+$/.test(m.Version || "")) errors.push(`${label}: Version "${m.Version}" must be digits and dots`);
      if (!byName.has(`${root}${m.Icon}`)) errors.push(`${label}: pack icon ${m.Icon} is missing`);
      if (m.License && !byName.has(`${root}${m.License}`)) errors.push(`${label}: license ${m.License} is missing`);
      const list = JSON.parse(byName.get(`${root}icons.json`).data);
      const listed = new Set(), names = new Set();
      for (const it of list) {
        if (!it.path || !it.name || !Array.isArray(it.tags)) errors.push(`${label}: bad icons.json entry ${JSON.stringify(it)}`);
        if (it.tags.some((t) => /, /.test(t))) errors.push(`${label}: ${it.path} has a comma list as a tag`);
        const e = byName.get(`${root}icons/${it.path}`);
        if (!e) errors.push(`${label}: ${it.path} is listed but missing`);
        else { const s = png.size(e.data); if (!s || s.width !== 144 || s.height !== 144) errors.push(`${label}: ${it.path} isn't a 144x144 PNG`); }
        if (it.path.length > 80) errors.push(`${label}: ${it.path} is longer than 80 characters`);
        if (names.has(it.name)) errors.push(`${label}: two icons are named "${it.name}"`);
        listed.add(it.path);
        names.add(it.name);
      }
      for (const e of entries) if (e.name.startsWith(`${root}icons/`) && !e.dir && !listed.has(e.name.slice(root.length + 6))) errors.push(`${label}: ${e.name} has no icons.json entry`);
      packs++;
    } catch (err) { errors.push(`${label}: ${err.message}`); }
  }
  const pluginFile = path.join(out, `${PLUGIN_UUID}.streamDeckPlugin`);
  if (fs.existsSync(pluginFile)) {
    try {
      const entries = unzip(fs.readFileSync(pluginFile));
      const byName = new Map(entries.map((e) => [e.name, e]));
      const root = `${PLUGIN_UUID}.sdPlugin/`;
      if (entries.some((e) => !e.name.startsWith(root))) errors.push("plugin: entries outside the .sdPlugin folder");
      const m = JSON.parse(byName.get(`${root}manifest.json`).data);
      if (m.UUID !== PLUGIN_UUID) errors.push(`plugin: manifest UUID ${m.UUID}`);
      for (const f of ["data/catalog.json", "data/icons.json", "data/themes.json", "data/scenes.json", "bin/keyart.js"]) if (!byName.has(root + f)) errors.push(`plugin: ${f} is missing`);
      const has = (p) => [".png", ".svg", ".gif"].some((x) => byName.has(`${root}${p}${x}`));
      const imgs = [m.Icon, m.CategoryIcon, ...(m.Actions || []).flatMap((a) => [a.Icon, ...(a.States || []).map((s) => s.Image), a.Encoder && a.Encoder.Icon, a.Encoder && a.Encoder.background])].filter(Boolean);
      for (const p of imgs) if (!has(p)) errors.push(`plugin: image ${p} is missing`);
      for (const p of m.Profiles || []) {
        const e = byName.get(`${root}${p.Name}.streamDeckProfile`);
        if (!e) errors.push(`plugin: bundled profile ${p.Name} is missing`);
        else { try { checkProfile(`plugin ${p.Name}`, e.data); profiles++; } catch (err) { errors.push(`plugin ${p.Name}: ${err.message}`); } }
        if ("ReadOnly" in p) errors.push(`plugin: Profiles use "Readonly" (lower-case o)`);
      }
      const note = (m.Profiles || []).length ? minVersionNote(m) : null;
      if (note) notes.push(note);
      notes.push(`plugin: ${entries.length} files, ${(m.Profiles || []).length} bundled profiles`);
    } catch (err) { errors.push(`plugin: ${err.message}`); }
  }
  notes.unshift(`checked ${profiles} profiles and ${packs} icon packs in ${out}`);
  return { errors, notes };
}

// ---------- main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const src = loadSources();
  const env = { ...src, out: opts.out, store: new ImageStore(), warnings: new Set(), missing: new Set() };
  env.warn = (msg) => env.warnings.add(msg);
  env.art = createArt({ icons: src.icons, themes: src.themes, tokens: src.tokens });

  if (opts.check) {
    const { errors, warnings } = checkLayouts(env);
    const built = checkBuilt(opts.out);
    for (const w of warnings) console.log(`  warning: ${w}`);
    for (const n of built.notes) console.log(`  ${n}`);
    for (const e of [...errors, ...built.errors]) console.log(`  ERROR: ${e}`);
    const n = errors.length + built.errors.length;
    console.log(n ? `${n} problem(s).` : "Stream Deck pack: everything checks out.");
    process.exit(n ? 1 : 0);
  }

  const themes = opts.themes ? opts.themes.map((id) => src.themes.find((t) => t.id === id) || (() => { throw usage(`No theme "${id}" (themes: ${src.themes.map((t) => t.id).join(", ")})`); })()) : src.themes;
  const models = opts.models || Object.keys(scenes.MODELS);
  for (const m of models) if (!scenes.MODELS[m]) throw usage(`No model "${m}" (models: ${Object.keys(scenes.MODELS).join(", ")})`);
  // Layout problems don't stop a build (the check does); refs the catalog doesn't have yet
  // become blank keys and are listed once.
  for (const e of checkLayouts(env).errors) if (!/isn't in the catalog$/.test(e) && models.some((m) => e.startsWith(`${m} `) || !scenes.MODELS[e.split(" ")[0]])) env.warn(e);

  fs.mkdirSync(opts.out, { recursive: true });
  const timings = {};
  const lap = (name, since) => { timings[name] = (timings[name] || 0) + (Date.now() - since); };

  // Plan: every picture is added to the store, then all are drawn in one browser session.
  let t = Date.now();
  const packs = opts.skip.has("icons") ? [] : themes.map((th) => planIconPack(env, th));
  // Bundled profiles are made of our plugin's actions, and standalone ones use them for held
  // keys: both need its version and states.
  const info = pluginInfo();
  env.plugin = info;
  const standalone = [];
  if (!opts.skip.has("profiles")) for (const th of themes) for (const m of models) standalone.push({ theme: th, modelId: m, ...buildProfile(env, m, "standalone", th) });
  const bundled = opts.skip.has("plugin") ? [] : models.filter((m) => scenes.MODELS[m]).map((m) => ({ modelId: m, ...buildProfile(env, m, "bundled", src.themes[0]) }));
  if (bundled.length && minVersionNote(info.manifest)) env.warn(minVersionNote(info.manifest));
  const pluginImages = !opts.skip.has("plugin") && info.manifest ? plannedPluginImages(env, info.manifest) : [];
  lap("plan", t);

  t = Date.now();
  const exe = findBrowser(opts.browser);
  const families = [];
  for (const th of src.themes) {
    const f = env.art.theme(th.id).font;
    for (const fam of f.googleFamilies) for (const w of new Set([f.weight, "600", "700"])) families.push(`${w} 24px "${fam}"`);
  }
  const renderer = new Renderer(exe, { fontsCss: src.fontsCss, families: [...new Set(families)] });
  console.log(`Rendering with ${path.basename(exe)}...`);
  const { missingFonts } = await renderer.start();
  if (missingFonts.length) console.warn(`  ! fonts that didn't load (keys fall back to system fonts): ${missingFonts.join(", ")}`);
  lap("browser", t);
  const results = { files: [] };
  try {
    t = Date.now();
    const count = env.store.pending.size;
    await env.store.render(renderer, (m) => console.log(m));
    lap("render", t);
    console.log(`  ${count} distinct images in ${renderer.captures} captures`);

    t = Date.now();
    for (const pack of packs) {
      const previewPng = await renderer.renderHtml(packPreviewHtml(pack, env.store));
      const file = writeIconPack(env, pack, previewPng);
      results.files.push({ kind: "icon pack", file, count: pack.items.length });
    }
    lap("icon packs", t);

    t = Date.now();
    for (const s of standalone) {
      const { buffer, pages, images } = P.profileZip(s.profile, (k) => env.store.get(k));
      const file = path.join(opts.out, "profiles", s.profile.model.name, `${s.profile.name}.streamDeckProfile`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buffer);
      results.files.push({ kind: "profile", file, count: pages, images });
    }
    if (standalone.length) results.files.push({ kind: "keybind profile", file: writeKeybinds(opts.out) });
    lap("profiles", t);

    t = Date.now();
    if (!opts.skip.has("plugin")) {
      const zips = bundled.map((b) => ({ model: b.profile.model, ...P.profileZip(b.profile, (k) => env.store.get(k)) }));
      const res = writePlugin(env, info, pluginImages, zips);
      if (res.file) results.files.push({ kind: "plugin", file: res.file, count: res.files });
      else console.warn(`  ! no plugin source at ${path.relative(ROOT, PLUGIN_SRC)}: data and profiles staged in ${path.relative(ROOT, res.stage)}, no .streamDeckPlugin written`);
      results.plugin = { ...res, images: pluginImages.length, profiles: zips.length };
    }
    lap("plugin", t);

    t = Date.now();
    if (!opts.skip.has("preview") && standalone.length) {
      const dir = path.join(opts.out, "preview");
      fs.mkdirSync(dir, { recursive: true });
      const list = [];
      for (const s of standalone) {
        const name = `${s.modelId}-${s.theme.id}.png`;
        const buf = await renderer.renderHtml(previewHtml(env, s.profile.name, s.profile.model, s.previews, s.theme));
        fs.writeFileSync(path.join(dir, name), buf);
        list.push({ file: name, title: s.profile.name });
        results.files.push({ kind: "preview", file: path.join(dir, name) });
      }
      writePreviewIndex(dir, list);
    }
    lap("previews", t);
  } finally {
    await renderer.close();
  }
  if (opts.release) {
    t = Date.now();
    for (const file of writeRelease(opts.out, models)) results.files.push({ kind: "download", file });
    lap("release", t);
  }

  // ---------- summary ----------
  const by = (kind) => results.files.filter((f) => f.kind === kind);
  const total = (list) => list.reduce((n, f) => n + fs.statSync(f.file).size, 0);
  console.log("");
  for (const kind of ["icon pack", "profile", "keybind profile", "plugin", "preview", "download"]) {
    const list = by(kind);
    if (!list.length) continue;
    console.log(`${list.length} ${kind}${list.length > 1 ? "s" : ""}, ${mb(total(list))}`);
    const shown = kind === "profile" ? 4 : kind === "download" ? 9 : 3;
    for (const f of list.slice(0, shown)) console.log(`  ${path.relative(opts.out, f.file)}  ${mb(fs.statSync(f.file).size)}${f.count ? `, ${f.count} ${kind === "icon pack" ? "icons" : kind === "plugin" ? "files" : "pages"}` : ""}${f.images ? `, ${f.images} images` : ""}`);
    if (list.length > shown) console.log(`  ... and ${list.length - shown} more`);
  }
  const counted = standalone.reduce((a, s) => ({ keys: a.keys + s.counts.keys, dials: a.dials + s.counts.dials, folders: a.folders + s.counts.folders }), { keys: 0, dials: 0, folders: 0 });
  if (standalone.length) console.log(`Profiles hold ${counted.keys} keys, ${counted.dials} dials and ${counted.folders} folder pages.`);
  if (results.plugin) console.log(`Plugin: ${results.plugin.profiles} bundled profiles, ${results.plugin.images} manifest images drawn.`);
  console.log(`Times: ${Object.entries(timings).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`).join(", ")}; total ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  if (env.missing.size) console.log(`Not in the catalog yet, left blank: ${[...env.missing].sort().join(", ")}.`);
  if (env.warnings.size) {
    console.log(`${env.warnings.size} warning(s):`);
    for (const w of [...env.warnings].slice(0, 30)) console.log(`  ! ${w}`);
    if (env.warnings.size > 30) console.log(`  ... and ${env.warnings.size - 30} more`);
  }
  console.log(`Output: ${opts.out}`);
}

main().catch((err) => { console.error(err.usage ? err.message : err.stack || err.message); process.exit(1); });
