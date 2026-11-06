// Writes the files the plugin reads at runtime into a plugin folder, from the repo's
// sources, in the same shapes tools/make-streamdeck.js writes when it packs the plugin:
//   data/catalog.json  streamdeck/catalog.js actions
//   data/icons.json    public/icons.js DECK_ICONS
//   data/themes.json   keyart.parseThemes(public/themes.css)
//   data/scenes.json   { SCENES, MODELS, DIAL } from streamdeck/scenes.js
//   data/i18n.json     public/i18n.js's table, { English: [es, fr, de] } (optional for the plugin)
//   bin/keyart.js      a copy of streamdeck/keyart.js
//
//   node streamdeck/plugin/test/make-test-data.js <plugin folder>
// Tests run it on a copy of the plugin, never on the source folder (these aren't committed).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO = path.join(__dirname, "..", "..", "..");

// Runs a browser script that sets window.<name> and returns it.
function browserGlobal(file, transform = (s) => s) {
  const window = {};
  const sandbox = { window, document: { documentElement: {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { language: "en" } };
  vm.runInNewContext(transform(fs.readFileSync(path.join(REPO, file), "utf8")), sandbox, { filename: file });
  return window;
}

function write(pluginDir) {
  const catalog = require(path.join(REPO, "streamdeck", "catalog.js"));
  const scenes = require(path.join(REPO, "streamdeck", "scenes.js"));
  const keyart = require(path.join(REPO, "streamdeck", "keyart.js"));
  const icons = browserGlobal("public/icons.js").DECK_ICONS;
  // i18n.js keeps its table private; expose it on window.DeckI18n for this export.
  const i18n = browserGlobal("public/i18n.js", (s) => s.replace("window.DeckI18n = {", "window.DeckI18n = { T,")).DeckI18n.T;
  const out = path.join(pluginDir, "data");
  fs.mkdirSync(out, { recursive: true });
  const json = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value));
  json("catalog.json", catalog.actions);
  json("icons.json", icons);
  json("themes.json", keyart.parseThemes(fs.readFileSync(path.join(REPO, "public", "themes.css"), "utf8")));
  json("scenes.json", { SCENES: scenes.SCENES, MODELS: scenes.MODELS, DIAL: scenes.DIAL });
  if (i18n) json("i18n.json", i18n);
  fs.copyFileSync(path.join(REPO, "streamdeck", "keyart.js"), path.join(pluginDir, "bin", "keyart.js"));
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: node make-test-data.js <plugin folder>"); process.exit(1); }
  write(path.resolve(dir));
  console.log(`Wrote data/ and bin/keyart.js in ${dir}`);
}

module.exports = { write, REPO };
