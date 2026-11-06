// Static checks of the plugin folder, the ones Elgato's `streamdeck validate` makes that
// don't need its schema download, plus the plugin's own rules:
// - the folder is <UUID>.sdPlugin, every action UUID starts with the plugin's;
// - every file the manifest names exists with an allowed extension (PNGs with @2x);
// - the dial layout's items stay inside 200x100 and don't overlap on one zOrder;
// - en/es/fr/de.json cover the same strings, and every string the code shows is in them;
// - no action that presses keys can go in a Multi Action or Key Logic.
//
//   node streamdeck/plugin/test/check.js
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "com.nodiecode.tabletdeck.sdPlugin");

function check() {
  const problems = [];
  const fail = (text) => problems.push(text);
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
  if (path.basename(DIR) !== `${manifest.UUID}.sdPlugin`) fail(`folder isn't ${manifest.UUID}.sdPlugin`);
  if (manifest.Profiles) fail("the source manifest has Profiles (the generator adds them when packing)");

  // Files, as the CLI resolves them: extension-less image paths, with their allowed types.
  const image = (rel, types, what) => {
    if (!rel) return;
    const found = types.filter((ext) => fs.existsSync(path.join(DIR, `${rel}.${ext}`)));
    if (!found.length) fail(`${what}: no ${rel}.{${types.join(",")}}`);
    if (found.length > 1) fail(`${what}: ${rel} matches ${found.join(" and ")}`);
    if (found[0] === "png" && !fs.existsSync(path.join(DIR, `${rel}@2x.png`))) fail(`${what}: ${rel}@2x.png is missing`);
  };
  const file = (rel, what) => { if (rel && !fs.existsSync(path.join(DIR, rel))) fail(`${what}: ${rel} is missing`); };
  image(manifest.Icon, ["png"], "Icon");
  image(manifest.CategoryIcon, ["png", "svg"], "CategoryIcon");
  file(manifest.CodePath, "CodePath");
  file(manifest.PropertyInspectorPath, "PropertyInspectorPath");
  const ids = new Set();
  for (const a of manifest.Actions) {
    if (ids.has(a.UUID)) fail(`duplicate action ${a.UUID}`);
    ids.add(a.UUID);
    if (!a.UUID.startsWith(`${manifest.UUID}.`)) fail(`${a.UUID} isn't under ${manifest.UUID}`);
    image(a.Icon, ["png", "svg"], `${a.UUID} Icon`);
    for (const s of a.States) image(s.Image, ["gif", "png", "svg"], `${a.UUID} state image`);
    file(a.PropertyInspectorPath, `${a.UUID} PropertyInspectorPath`);
    if (a.SupportedInMultiActions !== false || a.SupportedInKeyLogicActions !== false) fail(`${a.UUID} can go in Multi Actions or Key Logic`);
    if (a.Encoder) {
      image(a.Encoder.Icon, ["png", "svg"], `${a.UUID} Encoder.Icon`);
      image(a.Encoder.background, ["png", "svg"], `${a.UUID} Encoder.background`);
      if (a.Encoder.layout && !a.Encoder.layout.startsWith("$")) {
        file(a.Encoder.layout, `${a.UUID} layout`);
        const layout = JSON.parse(fs.readFileSync(path.join(DIR, a.Encoder.layout), "utf8"));
        const keys = new Set();
        const items = layout.items.map((i) => ({ key: i.key, x1: i.rect[0], y1: i.rect[1], x2: i.rect[0] + i.rect[2], y2: i.rect[1] + i.rect[3], z: i.zOrder || 0 }));
        for (const i of layout.items) { if (keys.has(i.key)) fail(`layout key ${i.key} twice`); keys.add(i.key); }
        for (const p of items) {
          if (p.x1 < 0 || p.y1 < 0 || p.x2 > 200 || p.y2 > 100) fail(`layout item ${p.key} leaves the 200x100 canvas`);
          for (const q of items) if (p !== q && p.z === q.z && !(q.x2 <= p.x1 || q.x1 >= p.x2 || q.y2 <= p.y1 || q.y1 >= p.y2)) fail(`layout items ${p.key} and ${q.key} overlap`);
        }
      }
    }
  }

  // Languages: the same strings in all four, and everything the code shows.
  const langs = Object.fromEntries(["en", "es", "fr", "de"].map((l) => [l, JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), "utf8"))]));
  const en = langs.en.Localization || {};
  for (const [l, f] of Object.entries(langs)) {
    if (!f.Name || !f.Description) fail(`${l}.json: Name or Description missing`);
    for (const a of manifest.Actions) {
      const e = f[a.UUID];
      if (!e || !e.Name || !e.Tooltip) fail(`${l}.json: ${a.UUID} Name or Tooltip missing`);
      if (a.Encoder && a.Encoder.TriggerDescription) for (const k of Object.keys(a.Encoder.TriggerDescription)) if (!e || !e.Encoder || !e.Encoder.TriggerDescription[k]) fail(`${l}.json: ${a.UUID} TriggerDescription.${k} missing`);
    }
    const loc = f.Localization || {};
    for (const k of Object.keys(en)) if (!loc[k]) fail(`${l}.json: no "${k}"`);
    for (const k of Object.keys(loc)) if (!(k in en)) fail(`${l}.json: "${k}" isn't in en.json`);
  }
  const shown = new Set();
  const code = ["bin/actions.js", "bin/draw.js", "pi/pi.js"].map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n");
  for (const m of code.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)) shown.add(m[1].replace(/\\(.)/g, "$1"));
  for (const m of code.matchAll(/(?:word|status|text|name|heading|note)\s*[:(]\s*"([A-Z][^"]*)"/g)) shown.add(m[1]);
  for (const m of code.matchAll(/\b(?:words|MODE|text|name)\s*=\s*\{([^}]*)\}/g)) for (const w of m[1].matchAll(/:\s*"([^"]+)"/g)) shown.add(w[1]);
  // Status words: every all-capitals string in the plugin's code, and unset keys' prompts.
  const plugin = ["bin/actions.js", "bin/draw.js"].map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n").replace(/^\s*\/\/.*$|\s\/\/ .*$/gm, "");
  for (const m of plugin.matchAll(/"([A-Z][A-Z …{}0-9]*[A-Z…}])"/g)) shown.add(m[1]);
  for (const m of plugin.matchAll(/unset\(th, "([^"]+)"\)/g)) shown.add(m[1]);
  const html = fs.readFileSync(path.join(DIR, "pi", "index.html"), "utf8");
  for (const m of html.matchAll(/data-t="([^"]+)"/g)) shown.add(m[1].replace(/&#39;/g, "'"));
  for (const s of shown) if (!(s in en)) fail(`"${s}" is shown but isn't in en.json`);

  // No network or packages: only Node's built-ins and the plugin's own files.
  for (const f of fs.readdirSync(path.join(DIR, "bin"))) {
    if (!f.endsWith(".js") || f === "keyart.js") continue;
    const src = fs.readFileSync(path.join(DIR, "bin", f), "utf8");
    for (const m of src.matchAll(/require\("([^"]+)"\)/g)) if (!m[1].startsWith("./") && !["fs", "path", "http"].includes(m[1])) fail(`bin/${f} requires ${m[1]}`);
    for (const m of src.matchAll(/(?:ws|http):\/\/\$\{?([A-Za-z0-9_.]+)/g)) if (!["HOST", "127.0.0.1"].includes(m[1])) fail(`bin/${f} connects to ${m[1]}`);
  }
  const pi = (html + fs.readFileSync(path.join(DIR, "pi", "pi.js"), "utf8") + fs.readFileSync(path.join(DIR, "pi", "pi.css"), "utf8")).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "");
  if (/https?:\/\/(?!127\.0\.0\.1)/.test(pi)) fail("the property inspector loads something from the network");
  return { problems, strings: shown.size, actions: manifest.Actions.length };
}

if (require.main === module) {
  const r = check();
  for (const p of r.problems) console.log(`  FAIL  ${p}`);
  console.log(r.problems.length ? `${r.problems.length} problems` : `ok: ${r.actions} actions, ${r.strings} strings in all four languages, files and layout as the CLI wants`);
  process.exit(r.problems.length ? 1 : 0);
}
module.exports = { check };
