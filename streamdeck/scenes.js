// The Stream Deck pack's pages ("scenes") and folders, laid out for every model. A scene is
// one kind of flying (Flight, Combat, Mining...); each is a page of one profile per model,
// in every theme. Folders hold what doesn't fit a page (emotes, themes, emergency...).
//
// Layout rules, the same on every model so a player's hands learn one deck:
// - Each model has one navigation zone that never moves: a scene tab bar along the top
//   on XL and + XL, a rail down the right on 15-key and Mobile, one corner key on Mini and
//   Neo (whose touch points page by themselves), the last dial on Stream Deck +.
// - Blocks mirror the cockpit: the power triangle as Weapons/Thrusters/Shields columns,
//   shields as a compass (front up, back down), mining modules in a row, the start-up
//   sequence left to right (Flight Ready, then PWR, WEP, THR, SHLD).
// - Danger stays out of reach: Eject, Self-destruct and Exit Seat live in an Emergency
//   folder, never on a page.
// - On dial models the dials take what turns (power, laser power, speed, volume) and the
//   last dial turns through the scenes.
//
// A slot holds a catalog id (streamdeck/catalog.js), or "@..." for the pack's own keys:
// "@scene:<id>" (go to that scene; lit on its own page), "@folder:<id>", "@back",
// "@next", "@prev", "@theme:<id>", or null for an empty key. Dials are
// { label, icon, color, ccw, cw, press } with catalog ids, or a catalog id of a dial action.
"use strict";

const MODELS = {
  mini: { name: "Stream Deck Mini", type: 1, model: "20GAI9901", cols: 3, rows: 2, nav: "corner" },
  neo: { name: "Stream Deck Neo", type: 9, model: "20GBJ9901", cols: 4, rows: 2, nav: "corner", touchPaging: true },
  std: { name: "Stream Deck", type: 0, model: "20GAA9901", cols: 5, rows: 3, nav: "rail" },
  mobile: { name: "Stream Deck Mobile", type: 3, model: "VSD2/WiFi", cols: 5, rows: 3, nav: "rail" },
  plus: { name: "Stream Deck +", type: 7, model: "20GBD9901", cols: 4, rows: 2, nav: "dial", dials: 4, strip: [800, 100] },
  xl: { name: "Stream Deck XL", type: 2, model: "20GAT9901", cols: 8, rows: 4, nav: "tabs" },
  plusxl: { name: "Stream Deck + XL", type: 13, model: "20GBX9901", cols: 9, rows: 4, nav: "tabs", dials: 6, strip: [1200, 100] },
};

// Scenes in page order. `tablet` names the tablet HUD panels that match, for the plugin's
// "scenes follow" option (left and right halves of layouts/hud.json and its starters).
const SCENES = [
  { id: "flight", name: "Flight", icon: "flight-ready", color: "green", tablet: { left: "power-landing", right: "qt-systems" } },
  { id: "combat", name: "Combat", icon: "target", color: "red", tablet: { left: "shields", right: "combat" } },
  { id: "mining", name: "Mining", icon: "mining", color: "amber", tablet: { left: "mining", right: "modes" } },
  { id: "salvage", name: "Salvage", icon: "salvage", color: "amber", tablet: { left: "salvage", right: "modes" } },
  { id: "hauling", name: "Hauling & Exploration", short: "Haul & Explore", icon: "cargo", color: "blue", tablet: { left: "power-landing", right: "crew" } },
  { id: "onfoot", name: "On Foot", icon: "walk", color: "", tablet: { right: "on-foot" } },
  { id: "comms", name: "Comms", icon: "comms", color: "blue", tablet: { right: "comms" } },
];

// Folders: their contents in order; each model lays them out in its content area (with
// "More" folders chained on when they don't fit) and puts Back where its navigation is.
const FOLDERS = {
  emergency: { name: "Emergency", icon: "eject", color: "red", items: ["qt-eject", "qt-self-destruct", "fa-exit"] },
  themes: { name: "Themes", icon: "palette", items: "@themes" },
  emotes: {
    name: "Emotes", icon: "emote", items: [
      "em-wave", "em-salute", "em-point", "em-greet", "em-cheer", "em-clap", "em-dance", "em-laugh",
      "em-agree", "em-disagree", "em-come", "em-wait", "em-bow", "em-atease", "em-attention", "em-sit",
      "em-flex", "em-taunt", "em-gloat", "em-threaten", "em-angry", "em-cry", "em-gasp", "em-failure",
      "em-flirt", "em-blah", "em-bored", "em-sleep", "em-chicken", "em-burp", "em-smell", "em-whistle",
      "em-rude", "em-launch",
    ],
  },
  websites: { name: "Websites", icon: "link", color: "blue", items: ["sd-uex", "sd-erkul", "sd-spviewer", "sd-scmdb"] },
  // The cockpit blocks, as folders for decks too small to show them on a page.
  shields: { name: "Shields", icon: "power-shields", color: "green", grid: "shields" },
  power: { name: "Power", icon: "power-reset", color: "green", grid: "power" },
  // Small decks reach every scene from here.
  scenes: { name: "Scenes", icon: "grid", items: "@scenes" },
};

// Spatial blocks, placed whole where they fit (3x3, 3x4).
const BLOCKS = {
  // Front is ahead (up), back behind; top and bottom on the left; shield power on the right.
  shields: [
    ["sh-up", "sh-front", "pw-shd-up"],
    ["sh-left", "sh-reset", "sh-right"],
    ["sh-down", "sh-back", "pw-shd-down"],
  ],
  // The tablet's power triangle: a column each for weapons, thrusters and shields.
  power: [
    ["pw-wep-max", "pw-thr-max", "pw-shd-max"],
    ["pw-wep-up", "pw-thr-up", "pw-shd-up"],
    ["pw-wep-down", "pw-thr-down", "pw-shd-down"],
    ["pw-wep-min", "pw-thr-min", "pw-shd-min"],
  ],
};

// ---------- dials ----------

const DIAL = {
  weapons: { label: "Weapons", icon: "power-weapons", color: "red", ccw: "pw-wep-down", cw: "pw-wep-up", press: "pw-wep-max" },
  thrusters: { label: "Thrusters", icon: "power-engines", color: "blue", ccw: "pw-thr-down", cw: "pw-thr-up", press: "pw-thr-max" },
  shields: { label: "Shields", icon: "power-shields", color: "green", ccw: "pw-shd-down", cw: "pw-shd-up", press: "pw-shd-max" },
  speed: { label: "Speed Limit", icon: "speed", ccw: "fa-range-down", cw: "fa-range-up", press: "fa-limiter" },
  laser: { label: "Laser Power", icon: "laser", color: "amber", ccw: "mn-power-down", cw: "mn-power-up", press: "mn-fire" },
  beam: { label: "Beam Spacing", icon: "salvage", color: "amber", ccw: "sv-spacing-down", cw: "sv-spacing-up", press: "op-salvage" },
  modifier: { label: "Modifier", icon: "salvage", color: "amber", ccw: "sv-mod-left", cw: "sv-mod-right", press: "op-scan" },
  targets: { label: "Targets", icon: "target", color: "red", ccw: "tg-hostile", cw: "tg-attacker", press: "tg-sub" },
  tracks: { label: "Media", icon: "play-pause", ccw: "sd-prev-track", cw: "sd-next-track", press: "sd-play-pause" },
  volume: { label: "Volume", icon: "volume-up", ccw: "sd-volume-down", cw: "sd-volume-up", press: "sd-volume-mute" },
  channel: { label: "Voice Channel", icon: "voice-channel", color: "blue", cw: "cm-channel", press: "cm-hail" },
  discord: "sd-discord-volume",
  // Turns through the scenes; a press opens the theme folder.
  scenes: { label: "Scenes", icon: "grid", ccw: "@prev", cw: "@next", press: "@folder:themes" },
};

// ---------- layouts ----------

// Stream Deck + XL, the flagship: 9 scene tabs on top, 27 keys, six dials (the power
// triangle on the first three wherever power matters, volume and scenes always last).
const PLUSXL = {
  flight: {
    keys: [
      ["qt-flight-ready", "qt-pwr", "qt-wep", "qt-thr", "qt-shld", "op-quantum", "qt-engage", "qt-scm-nav", "top-starmap"],
      ["pl-gear", "pl-vtol", "fa-lights", "fa-esp", "fa-gsafe", "fa-scm", "fa-nav", "fa-limiter", "fa-match"],
      ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "fa-look-behind", "cr-doors-toggle", "top-mobiglas", "td-talk", "@folder:emergency"],
    ],
    dials: ["weapons", "thrusters", "shields", "speed", "volume", "scenes"],
  },
  combat: {
    keys: [
      ["op-guns", "op-missile", "cb-missile", "sh-up", "sh-front", "pw-shd-up", "cb-pips", "cb-fewer", "qt-flight-ready"],
      ["tg-hostile", "tg-attacker", "tg-sub", "sh-left", "sh-reset", "sh-right", "tg-friendly", "tg-all", "tg-view"],
      ["cb-decoy", "cb-noise", "cb-panic", "sh-down", "sh-back", "pw-shd-down", "pw-reset", "td-talk", "@folder:emergency"],
    ],
    dials: ["weapons", "thrusters", "shields", "targets", "volume", "scenes"],
  },
  mining: {
    keys: [
      ["mn-mode", "mn-fire", "mn-type", "mn-module-1", "mn-module-2", "mn-module-3", "op-scan", "op-flight", "top-starmap"],
      ["mn-power-down", "mn-power-up", "fa-limiter", "fa-lights", "pl-gear", "pl-vtol", "qt-flight-ready", "fa-esp", "fa-match"],
      ["pw-shd-max", "pw-thr-max", "pw-reset", "top-atc", "pl-request-dock", "pl-autoland", "cr-doors-toggle", "td-talk", "@folder:emergency"],
    ],
    dials: ["laser", "thrusters", "shields", "speed", "volume", "scenes"],
  },
  salvage: {
    keys: [
      ["op-salvage", "sv-mod-left", "sv-mod-right", "sv-spacing-down", "sv-spacing-up", "op-scan", "op-flight", "top-starmap", "td-talk"],
      ["fa-lights", "pl-gear", "pl-vtol", "fa-limiter", "fa-match", "qt-flight-ready", "fa-esp", "cr-doors-toggle", "top-mobiglas"],
      ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "pw-shd-max", "pw-thr-max", "cr-doors-open", "cr-doors-close", "@folder:emergency"],
    ],
    dials: ["beam", "modifier", "shields", "speed", "volume", "scenes"],
  },
  hauling: {
    keys: [
      ["op-quantum", "qt-engage", "top-starmap", "op-scan", "fa-nav", "fa-scm", "qt-scm-nav", "fa-limiter", "fa-match"],
      ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "pl-gear", "pl-vtol", "fa-lights", "qt-flight-ready", "fa-esp"],
      ["cr-doors-open", "cr-doors-close", "cr-doors-lock", "cr-doors-unlock", "cr-turret-1", "cr-turret-2", "cr-turret-3", "top-mobiglas", "@folder:emergency"],
    ],
    dials: ["weapons", "thrusters", "shields", "speed", "volume", "scenes"],
  },
  onfoot: {
    keys: [
      ["ft-inventory", "ft-camera", "ft-walk", "ft-drop", "ft-inspect", "top-mobiglas", "top-starmap", "top-contacts", "ft-escape"],
      ["cm-visor", "cm-pit", "top-chat", "cm-accept", "cm-decline", "em-wave", "em-salute", "em-point", "@folder:emotes"],
      ["em-greet", "em-cheer", "em-clap", "em-dance", "em-laugh", "em-sit", "em-wait", "em-flex", "td-talk"],
    ],
    dials: ["discord", "tracks", null, null, "volume", "scenes"],
  },
  comms: {
    keys: [
      ["cm-ptt", "cm-ptt-prox", "cm-channel", "cm-hail", "top-chat", "top-contacts", "cm-accept", "cm-decline", "td-talk"],
      ["sd-discord-mute", "sd-discord-deafen", "sd-discord-ptt", "sd-discord-ptm", "sd-discord-mode", "sd-obs-record", "sd-obs-stream", "sd-obs-replay", "sd-obs-screenshot"],
      ["sd-prev-track", "sd-play-pause", "sd-next-track", "sd-volume-down", "sd-volume-up", "sd-volume-mute", "@folder:websites", "td-status", "td-lights-reset"],
    ],
    dials: ["discord", "tracks", "channel", null, "volume", "scenes"],
  },
};

// Stream Deck XL: 8 scene tabs (the eighth opens the theme folder), 24 keys, no dials, so the
// cockpit blocks come back as keys: the power triangle on Flight, the shield compass on Combat.
const XL = {
  flight: [
    ["qt-flight-ready", "qt-pwr", "qt-wep", "qt-thr", "qt-shld", "pw-wep-up", "pw-thr-up", "pw-shd-up"],
    ["pl-gear", "pl-vtol", "fa-lights", "op-quantum", "qt-engage", "pw-wep-down", "pw-thr-down", "pw-shd-down"],
    ["top-atc", "pl-request-dock", "fa-limiter", "qt-scm-nav", "top-starmap", "pw-reset", "td-talk", "@folder:emergency"],
  ],
  combat: [
    ["op-guns", "op-missile", "cb-missile", "sh-up", "sh-front", "pw-shd-up", "tg-hostile", "tg-attacker"],
    ["cb-decoy", "cb-noise", "cb-panic", "sh-left", "sh-reset", "sh-right", "tg-sub", "tg-friendly"],
    ["pw-wep-up", "pw-wep-down", "cb-pips", "sh-down", "sh-back", "pw-shd-down", "td-talk", "@folder:emergency"],
  ],
  mining: [
    ["mn-mode", "mn-fire", "mn-type", "mn-module-1", "mn-module-2", "mn-module-3", "op-scan", "op-flight"],
    ["mn-power-down", "mn-power-up", "fa-lights", "pl-gear", "pl-vtol", "qt-flight-ready", "fa-limiter", "top-starmap"],
    ["pw-shd-max", "pw-thr-max", "pw-reset", "top-atc", "pl-request-dock", "cr-doors-toggle", "td-talk", "@folder:emergency"],
  ],
  salvage: [
    ["op-salvage", "sv-mod-left", "sv-mod-right", "sv-spacing-down", "sv-spacing-up", "op-scan", "op-flight", "top-starmap"],
    ["fa-lights", "pl-gear", "pl-vtol", "fa-limiter", "fa-match", "qt-flight-ready", "fa-esp", "cr-doors-toggle"],
    ["top-atc", "pl-request-dock", "pl-autoland", "pw-shd-max", "pw-thr-max", "pw-reset", "td-talk", "@folder:emergency"],
  ],
  hauling: [
    ["op-quantum", "qt-engage", "top-starmap", "op-scan", "fa-nav", "fa-scm", "qt-scm-nav", "fa-limiter"],
    ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "pl-gear", "pl-vtol", "fa-lights", "qt-flight-ready"],
    ["cr-doors-open", "cr-doors-close", "cr-doors-lock", "cr-doors-unlock", "cr-turret-1", "top-mobiglas", "td-talk", "@folder:emergency"],
  ],
  onfoot: [
    ["ft-inventory", "ft-camera", "ft-walk", "ft-drop", "ft-inspect", "top-mobiglas", "top-starmap", "ft-escape"],
    ["cm-visor", "cm-pit", "top-chat", "top-contacts", "cm-accept", "cm-decline", "em-wave", "@folder:emotes"],
    ["em-salute", "em-point", "em-greet", "em-cheer", "em-dance", "em-laugh", "em-sit", "td-talk"],
  ],
  comms: [
    ["cm-ptt", "cm-ptt-prox", "cm-channel", "cm-hail", "top-chat", "top-contacts", "cm-accept", "cm-decline"],
    ["sd-discord-mute", "sd-discord-deafen", "sd-discord-ptt", "sd-discord-ptm", "sd-obs-record", "sd-obs-stream", "sd-obs-replay", "td-talk"],
    ["sd-prev-track", "sd-play-pause", "sd-next-track", "sd-volume-down", "sd-volume-up", "sd-volume-mute", "@folder:websites", "td-status"],
  ],
};

// 15 keys (and Mobile): 12 keys and a rail on the right (scenes menu, next, previous).
// Shields and power are one key each here, opening their blocks as folders.
const STD = {
  flight: [
    ["qt-flight-ready", "pl-gear", "pl-vtol", "fa-lights"],
    ["op-quantum", "qt-engage", "qt-scm-nav", "top-starmap"],
    ["top-atc", "pl-request-dock", "@folder:power", "@folder:emergency"],
  ],
  combat: [
    ["op-guns", "op-missile", "cb-missile", "tg-hostile"],
    ["cb-decoy", "cb-noise", "cb-panic", "tg-attacker"],
    ["@folder:shields", "@folder:power", "tg-sub", "@folder:emergency"],
  ],
  mining: [
    ["mn-mode", "mn-fire", "mn-type", "op-scan"],
    ["mn-module-1", "mn-module-2", "mn-module-3", "op-flight"],
    ["mn-power-down", "mn-power-up", "fa-lights", "pl-gear"],
  ],
  salvage: [
    ["op-salvage", "sv-mod-left", "sv-mod-right", "op-scan"],
    ["sv-spacing-down", "sv-spacing-up", "fa-lights", "op-flight"],
    ["pl-gear", "pl-vtol", "fa-limiter", "cr-doors-toggle"],
  ],
  hauling: [
    ["op-quantum", "qt-engage", "top-starmap", "op-scan"],
    ["top-atc", "pl-request-dock", "pl-autoland", "pl-gear"],
    ["cr-doors-open", "cr-doors-close", "cr-doors-lock", "top-mobiglas"],
  ],
  onfoot: [
    ["ft-inventory", "ft-camera", "ft-walk", "top-mobiglas"],
    ["ft-drop", "ft-inspect", "cm-visor", "cm-pit"],
    ["top-chat", "top-contacts", "@folder:emotes", "ft-escape"],
  ],
  comms: [
    ["cm-ptt", "cm-ptt-prox", "cm-channel", "cm-hail"],
    ["sd-discord-mute", "sd-discord-deafen", "sd-discord-ptt", "td-talk"],
    ["sd-play-pause", "sd-volume-down", "sd-volume-up", "@folder:websites"],
  ],
};

// Stream Deck +: 8 keys, three dials for the scene, the fourth turns through scenes.
const PLUS = {
  flight: { keys: [["qt-flight-ready", "pl-gear", "pl-vtol", "fa-lights"], ["op-quantum", "qt-engage", "top-atc", "@folder:emergency"]], dials: ["weapons", "thrusters", "shields", "scenes"] },
  combat: { keys: [["op-guns", "op-missile", "cb-missile", "tg-hostile"], ["cb-decoy", "cb-noise", "cb-panic", "@folder:shields"]], dials: ["weapons", "targets", "shields", "scenes"] },
  mining: { keys: [["mn-mode", "mn-fire", "mn-type", "op-scan"], ["mn-module-1", "mn-module-2", "mn-module-3", "op-flight"]], dials: ["laser", "thrusters", "speed", "scenes"] },
  salvage: { keys: [["op-salvage", "sv-mod-left", "sv-mod-right", "op-scan"], ["fa-lights", "pl-gear", "op-flight", "cr-doors-toggle"]], dials: ["beam", "modifier", "speed", "scenes"] },
  hauling: { keys: [["op-quantum", "qt-engage", "top-starmap", "op-scan"], ["top-atc", "pl-request-dock", "pl-gear", "cr-doors-toggle"]], dials: ["thrusters", "shields", "speed", "scenes"] },
  onfoot: { keys: [["ft-inventory", "ft-camera", "top-mobiglas", "cm-pit"], ["top-chat", "cm-visor", "@folder:emotes", "ft-escape"]], dials: ["discord", "tracks", "volume", "scenes"] },
  comms: { keys: [["cm-ptt", "cm-ptt-prox", "cm-hail", "top-chat"], ["sd-discord-mute", "sd-discord-deafen", "td-talk", "@folder:websites"]], dials: ["discord", "channel", "volume", "scenes"] },
};

// Neo (7 keys and a scenes key; its touch points page) and Mini (5 and a scenes key): the
// first keys of the 15-key layout, read row by row, which is ordered most-used first.
const firstOf = (grid, n) => grid.flat().filter((ref) => ref && !/^@folder:(power|shields|emergency)$/.test(ref)).slice(0, n);

// ---------- building ----------

// { pages: [{ scene, keys: {"c,r": ref}, dials: [dial|null] }], folders: { id: [{ keys }] } }
function layoutFor(modelId) {
  const m = MODELS[modelId];
  if (!m) throw new Error(`No model "${modelId}"`);
  const pages = SCENES.map((scene) => {
    const keys = {};
    const put = (c, r, ref) => { if (ref !== undefined) keys[`${c},${r}`] = ref; };
    let dials = null;
    if (m.nav === "tabs") {
      const tabs = SCENES.map((s) => `@scene:${s.id}`);
      if (modelId === "plusxl") tabs.push("@folder:themes", "@folder:emotes");
      else tabs.push("@folder:themes");
      tabs.slice(0, m.cols).forEach((ref, c) => put(c, 0, ref));
      const grid = modelId === "plusxl" ? PLUSXL[scene.id].keys : XL[scene.id];
      grid.forEach((row, r) => row.forEach((ref, c) => put(c, r + 1, ref)));
      if (modelId === "plusxl") dials = PLUSXL[scene.id].dials.map(dialFor);
    } else if (m.nav === "rail") {
      STD[scene.id].forEach((row, r) => row.forEach((ref, c) => put(c, r, ref)));
      put(m.cols - 1, 0, "@folder:scenes");
      put(m.cols - 1, 1, "@next");
      put(m.cols - 1, 2, "@prev");
    } else if (m.nav === "dial") {
      PLUS[scene.id].keys.forEach((row, r) => row.forEach((ref, c) => put(c, r, ref)));
      dials = PLUS[scene.id].dials.map(dialFor);
    } else {
      // corner: the last key opens the scenes menu
      const n = m.cols * m.rows - 1;
      firstOf(STD[scene.id], n).forEach((ref, i) => put(i % m.cols, Math.floor(i / m.cols), ref));
      put(m.cols - 1, m.rows - 1, "@folder:scenes");
    }
    return { scene: scene.id, keys, dials };
  });
  const folders = {};
  for (const [id, f] of Object.entries(FOLDERS)) folders[id] = folderPages(modelId, id, f);
  return { model: modelId, pages, folders };
}

function dialFor(name) {
  if (!name) return null;
  const d = DIAL[name];
  return typeof d === "string" ? { action: d } : { ...d };
}

// A folder's pages: its items in the content area, Back where the model's navigation is,
// and a "More" key on the last free slot chaining to the next page when they don't fit.
function folderPages(modelId, id, folder) {
  const m = MODELS[modelId];
  const back = m.nav === "tabs" ? [0, 0] : m.nav === "rail" ? [m.cols - 1, 0] : [m.cols - 1, m.rows - 1];
  const slots = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) if (!(c === back[0] && r === back[1])) slots.push([c, r]);
  if (folder.grid) {
    // A block: placed whole when it fits, else as a list.
    const block = BLOCKS[folder.grid];
    const fitsW = block[0].length <= m.cols - (m.nav === "rail" ? 1 : 0), fitsH = block.length <= m.rows - (m.nav === "tabs" ? 1 : 0);
    if (fitsW && fitsH) {
      const keys = { [`${back[0]},${back[1]}`]: "@back" };
      const top = m.nav === "tabs" ? 1 : 0;
      block.forEach((row, r) => row.forEach((ref, c) => { keys[`${c},${r + top}`] = ref; }));
      return [{ keys }];
    }
  }
  const items = folder.items === "@themes" ? "@themes" : folder.items === "@scenes"
    ? [...SCENES.map((s) => `@scene:${s.id}`), "@folder:themes", "@folder:emotes"]
    : folder.items || BLOCKS[folder.grid].flat();
  if (items === "@themes") return [{ keys: { [`${back[0]},${back[1]}`]: "@back" }, themes: slots }];
  const pages = [];
  let rest = [...items];
  while (rest.length) {
    const keys = { [`${back[0]},${back[1]}`]: pages.length ? "@back" : "@back" };
    const room = rest.length > slots.length ? slots.length - 1 : slots.length;
    rest.splice(0, room).forEach((ref, i) => { keys[`${slots[i][0]},${slots[i][1]}`] = ref; });
    if (rest.length) { const last = slots[slots.length - 1]; keys[`${last[0]},${last[1]}`] = `@more:${id}:${pages.length + 1}`; }
    pages.push({ keys });
  }
  return pages;
}

// Every catalog id a layout uses, for checking against the catalog.
function refsIn(layout) {
  const out = new Set();
  const add = (ref) => { if (ref && !ref.startsWith("@")) out.add(ref); };
  for (const p of layout.pages) {
    Object.values(p.keys).forEach(add);
    for (const d of p.dials || []) if (d) [d.action, d.ccw, d.cw, d.press].forEach(add);
  }
  for (const pages of Object.values(layout.folders)) for (const p of pages) Object.values(p.keys).forEach(add);
  return [...out];
}

module.exports = { MODELS, SCENES, FOLDERS, BLOCKS, DIAL, layoutFor, refsIn };
