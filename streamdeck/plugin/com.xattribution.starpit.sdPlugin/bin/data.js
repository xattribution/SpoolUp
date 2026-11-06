// What the plugin draws and presses, read from its own folder. tools/make-streamdeck.js
// writes these when it packs the plugin (they aren't kept in the source folder):
//   data/catalog.json  the pack's actions (streamdeck/catalog.js), an array or { actions }
//   data/icons.json    public/icons.js's DECK_ICONS
//   data/themes.json   the 12 themes' tokens (keyart.parseThemes of public/themes.css)
//   data/scenes.json   { SCENES, MODELS, DIAL } from streamdeck/scenes.js
//   data/i18n.json     optional: public/i18n.js's labels, { English: [es, fr, de] }
//   bin/keyart.js      a copy of streamdeck/keyart.js
// and <lang>.json next to manifest.json holds the plugin's own text (its "Localization").
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const COLUMN = { es: 0, fr: 1, de: 2 };

// Category names for grouping, used when data/catalog.json is a bare array of actions
// (from CATEGORIES in streamdeck/catalog.js).
const CATEGORY_NAMES = {
  ui: "mobiGlas & UI", landing: "Landing & Docking", power: "Power", systems: "Ship Systems",
  flight: "Flight", shields: "Shields", targeting: "Targeting", combat: "Combat", modes: "Operator Modes",
  mining: "Mining", salvage: "Salvage", crew: "Crew & Doors", onfoot: "On Foot", emotes: "Emotes",
  comms: "Comms", camera: "Camera", media: "Media & Audio", stream: "Streaming", tools: "Tools & Websites",
  deck: "Tablet Deck", nav: "Navigation",
};

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch { return fallback; }
}

function load(language) {
  const lang = ["en", "es", "fr", "de"].includes(language) ? language : "en";
  const raw = readJson("data/catalog.json", []);
  const actions = Array.isArray(raw) ? raw : raw.actions || [];
  const categories = !Array.isArray(raw) && Array.isArray(raw.categories)
    ? raw.categories.map((c) => ({ id: c.id, name: c.name }))
    : Object.entries(CATEGORY_NAMES).map(([id, name]) => ({ id, name }));
  const byId = new Map();
  for (const a of actions) {
    byId.set(a.id, a);
    for (const alias of a.aliases || []) if (!byId.has(alias)) byId.set(alias, a);
  }
  const scenes = readJson("data/scenes.json", {});
  let keyart = null;
  try { keyart = require("./keyart.js"); } catch { /* the pack wasn't built: nothing to draw with */ }
  const labels = lang === "en" ? {} : readJson("data/i18n.json", {});
  const strings = readJson(`${lang}.json`, {}).Localization || {};
  // The plugin's own text first, then the deck's labels, else English.
  const t = (text, ...args) => {
    if (text === undefined || text === null || text === "") return "";
    const s = String(text);
    let out = strings[s];
    if (out === undefined && labels[s]) out = labels[s][COLUMN[lang]];
    if (out === undefined) out = s;
    return args.length ? String(out).replace("{0}", args[0]) : out;
  };
  return {
    lang, t, strings, keyart, actions, byId, categories,
    icons: readJson("data/icons.json", {}),
    themeTokens: readJson("data/themes.json", {}),
    SCENES: scenes.SCENES || [],
    MODELS: scenes.MODELS || {},
    DIAL: scenes.DIAL || {},
  };
}

module.exports = { load };
