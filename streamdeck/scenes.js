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
//   folder, never on a page, in slots away from Back and from the navigation.
// - Knobs are knobs: on dial models a dial sets a level or steps through a cycle (power,
//   the speed limit, master mode, laser power, beam spacing, targets, the voice channel)
//   with set actions or ± steps, never a toggle or a one-off action on a turn, and a push
//   is one press. The last dial turns through the scenes.
//
// A slot holds a catalog id (streamdeck/catalog.js), or "@..." for the pack's own keys:
// "@scene:<id>" (go to that scene; lit on its own page), "@folder:<id>", "@back",
// "@next", "@prev", "@theme:<id>", or null for an empty key. Dials are
// { label, icon, color, ccw, cw, press, hints } with catalog ids, or a catalog id of a
// dial action.
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
  // In fixed slots per model (`at`: ref -> "c,r"), chosen against the keys beneath them on
  // the scene pages. Eject is never beside Back, never in the navigation zone (tab row,
  // rail column, corner key) and never on the Emergency key's own slot (+ XL 8,3, XL 7,3,
  // 15-key 3,2 and its Scenes folder's 3,2, + and Neo 3,1, the Mini's Scenes folder 0,1),
  // so a double tap lands on nothing. On the small decks Self-D, a 3 s hold to arm, takes
  // the slot nearest Back.
  emergency: {
    name: "Emergency", icon: "eject", color: "red", items: ["fa-exit", "qt-self-destruct", "qt-eject"],
    at: {
      plusxl: { "fa-exit": "0,3", "qt-self-destruct": "4,2", "qt-eject": "2,3" },
      xl: { "fa-exit": "0,3", "qt-self-destruct": "4,2", "qt-eject": "2,3" },
      std: { "qt-self-destruct": "1,1", "fa-exit": "3,1", "qt-eject": "0,2" },
      mobile: { "qt-self-destruct": "1,1", "fa-exit": "3,1", "qt-eject": "0,2" },
      plus: { "qt-self-destruct": "1,1", "fa-exit": "2,1", "qt-eject": "3,0" },
      neo: { "qt-self-destruct": "1,1", "fa-exit": "2,1", "qt-eject": "3,0" },
      mini: { "qt-self-destruct": "1,0", "fa-exit": "1,1", "qt-eject": "2,0" },
    },
  },
  themes: { name: "Themes", icon: "palette", items: "@themes" },
  // Most-used first; small decks stop after three pages rather than chain More keys to
  // the end (the icon pack has every emote).
  emotes: {
    name: "Emotes", icon: "emote", maxPages: 3, items: [
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
  power: { name: "Power", icon: "power", color: "green", grid: "power" },
  // Every scene and every folder, for decks without tabs.
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
  // The same two on a 4x2 deck (Neo, Stream Deck +), one page each with Back at 0,0.
  // Shields like arrow keys: front over rear, left and right beside rear, top and bottom
  // at the left. Power without Max and Min, which are timed, and which the + has on its
  // dials' pushes.
  shieldsWide: [
    [null, "sh-up", "sh-front", "sh-reset"],
    ["sh-down", "sh-left", "sh-back", "sh-right"],
  ],
  powerWide: [
    [null, "pw-wep-up", "pw-thr-up", "pw-shd-up"],
    ["pw-reset", "pw-wep-down", "pw-thr-down", "pw-shd-down"],
  ],
};

// ---------- dials ----------

// Knobs are knobs: a dial sets a level or steps through a cycle, so its turns are set
// actions or ± steps (one press per notch), never a toggle or a one-off action that a
// stray notch could fire; a push is one press. `hints` { ccw, cw, press } overrides the
// touch strip's words where the action labels don't shorten well.
const DIAL = {
  weapons: { label: "Weapons", icon: "power-weapons", color: "red", ccw: "pw-wep-down", cw: "pw-wep-up", press: "pw-wep-max" },
  thrusters: { label: "Thrusters", icon: "power-engines", color: "blue", ccw: "pw-thr-down", cw: "pw-thr-up", press: "pw-thr-max" },
  shields: { label: "Shields", icon: "power-shields", color: "green", ccw: "pw-shd-down", cw: "pw-shd-up", press: "pw-shd-max" },
  speed: { label: "Speed Limit", icon: "speed", ccw: "fa-range-down", cw: "fa-range-up", press: "fa-limiter", hints: { ccw: "−", cw: "+", press: "On / Off" } },
  // The master modes as a loop: left sets SCM, right NAV (set taps, so extra notches
  // change nothing), and the push picks the Quantum operator mode.
  master: { label: "Master Mode", icon: "scm-nav", color: "blue", ccw: "fa-scm", cw: "fa-nav", press: "op-quantum", hints: { ccw: "SCM", cw: "NAV", press: "Quantum" } },
  laser: { label: "Laser Power", icon: "laser", color: "amber", ccw: "mn-power-down", cw: "mn-power-up", press: "mn-fire" },
  beam: { label: "Beam Spacing", icon: "salvage", color: "amber", ccw: "sv-spacing-down", cw: "sv-spacing-up", press: "op-salvage", hints: { press: "Salvage Mode" } },
  modifier: { label: "Modifier", icon: "swap", color: "amber", ccw: "sv-mod-left", cw: "sv-mod-right", press: "op-scan", hints: { press: "Scan Mode" } },
  targets: { label: "Targets", icon: "target", color: "red", ccw: "tg-hostile", cw: "tg-next-hostile", press: "tg-attacker" },
  tracks: { label: "Media", icon: "play-pause", ccw: "sd-prev-track", cw: "sd-next-track", press: "sd-play-pause" },
  volume: { label: "Volume", icon: "volume-up", ccw: "sd-volume-down", cw: "sd-volume-up", press: "sd-volume-mute" },
  brightness: { label: "Brightness", icon: "brightness", ccw: "sd-brightness-down", cw: "sd-brightness-up", hints: { ccw: "−", cw: "+" } },
  channel: { label: "Voice Channel", icon: "voice-channel", color: "blue", cw: "cm-channel", press: "cm-hail" },
  // On foot there's nothing to hail: the push opens chat.
  channelFoot: { label: "Voice Channel", icon: "voice-channel", color: "blue", cw: "cm-channel", press: "top-chat" },
  discord: "sd-discord-volume",
  // Turns through the scenes; a press opens the theme folder. For the + XL, whose tabs
  // pick scenes.
  scenes: { label: "Scenes", icon: "grid", ccw: "@prev", cw: "@next", press: "@folder:themes" },
  // The Stream Deck +'s scene dial: its press opens the Scenes folder, with every scene
  // and folder.
  scenesHub: { label: "Scenes", icon: "grid", ccw: "@prev", cw: "@next", press: "@folder:scenes" },
};

// ---------- layouts ----------

// The + XL's ship scenes (Flight, Mining, Salvage, Hauling) share their two lower rows:
// the landing console along the bottom, with Hold to Talk and Emergency in the corner as
// on every page, and above it Quantum, Engage and the flight assists, the last key being
// the scene's own.
const LANDING = ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "pl-gear", "pl-vtol", "fa-lights", "td-talk", "@folder:emergency"];
const SHIP_ROW = (last) => ["op-quantum", "qt-engage", "pw-reset", "cr-doors-toggle", "top-mobiglas", "fa-gsafe", "fa-esp", "fa-decoupled", last];

// Stream Deck + XL, the flagship: 9 scene tabs on top, 27 keys, six dials. On the ship
// scenes dials 1-3 are the power triangle or the scene's tools, dial 4 the speed limiter,
// dial 5 the scene's cycle (master mode or targets); dial 6 is always the scenes. Levels
// live on the dials, so the keys don't repeat them. Flight, Mining, Salvage and Hauling
// share rows 2-3 (above), and Scanning, Flight and Star Map at the end of row 1.
const PLUSXL = {
  flight: {
    keys: [
      ["qt-flight-ready", "qt-pwr", "qt-wep", "qt-thr", "qt-shld", "fa-throttle", "op-scan", "op-flight", "top-starmap"],
      SHIP_ROW("fa-look-behind"),
      LANDING,
    ],
    dials: ["weapons", "thrusters", "shields", "speed", "master", "scenes"],
  },
  combat: {
    keys: [
      ["op-guns", "op-missile", "cb-missile", "sh-up", "sh-front", "pw-shd-up", "tg-sub", "tg-friendly", "tg-all"],
      ["cb-decoy", "cb-noise", "cb-panic", "sh-left", "sh-reset", "sh-right", "tg-view", "fa-look-behind", "fa-scm"],
      ["cb-pips", "fa-decoupled", "cb-fewer", "sh-down", "sh-back", "pw-shd-down", "pw-reset", "td-talk", "@folder:emergency"],
    ],
    dials: ["weapons", "thrusters", "shields", "speed", "targets", "scenes"],
  },
  mining: {
    keys: [
      ["mn-mode", "mn-fire", "mn-type", "mn-module-1", "mn-module-2", "mn-module-3", "op-scan", "op-flight", "top-starmap"],
      SHIP_ROW("qt-flight-ready"),
      LANDING,
    ],
    dials: ["laser", "thrusters", "shields", "speed", "master", "scenes"],
  },
  salvage: {
    keys: [
      ["op-salvage", "cr-doors-open", "cr-doors-close", "cr-doors-lock", "cr-doors-unlock", "fa-throttle", "op-scan", "op-flight", "top-starmap"],
      SHIP_ROW("qt-flight-ready"),
      LANDING,
    ],
    dials: ["beam", "modifier", "shields", "speed", "master", "scenes"],
  },
  hauling: {
    keys: [
      ["cr-turret-1", "cr-doors-open", "cr-doors-close", "cr-doors-lock", "cr-doors-unlock", "fa-throttle", "op-scan", "op-flight", "top-starmap"],
      SHIP_ROW("qt-flight-ready"),
      LANDING,
    ],
    dials: ["weapons", "thrusters", "shields", "speed", "master", "scenes"],
  },
  // On Foot and Comms leave a dial empty rather than fill it with media.
  onfoot: {
    keys: [
      ["ft-inventory", "ft-camera", "ft-walk", "ft-drop", "ft-inspect", "top-mobiglas", "top-starmap", "top-contacts", "ft-escape"],
      ["cm-visor", "cm-pit", "top-chat", "cm-accept", "cm-decline", "em-wave", "em-salute", "em-point", "cm-ptt-prox"],
      ["em-greet", "em-cheer", "em-clap", "em-dance", "em-laugh", "em-sit", "em-wait", "td-talk", "em-flex"],
    ],
    dials: ["channelFoot", null, null, "brightness", "volume", "scenes"],
  },
  comms: {
    keys: [
      ["cm-ptt", "cm-ptt-prox", "cm-channel", "cm-hail", "top-chat", "top-contacts", "cm-accept", "cm-decline", "cm-pit"],
      ["sd-discord-mute", "sd-discord-deafen", "sd-discord-ptt", "sd-discord-ptm", "sd-discord-mode", "sd-obs-record", "sd-obs-stream", "sd-obs-replay", "sd-obs-screenshot"],
      ["sd-prev-track", "sd-play-pause", "sd-next-track", "sd-volume-down", "sd-volume-up", "sd-volume-mute", "top-mobiglas", "td-talk", "@folder:websites"],
    ],
    dials: ["channel", null, "discord", "brightness", "volume", "scenes"],
  },
};

// Stream Deck XL: 8 scene tabs (the eighth opens the theme folder), 24 keys, no dials, so the
// cockpit blocks come back as keys: the power triangle on Flight, the shield compass on Combat,
// and the ± pairs the + XL turns on its dials. On Flight, Mining, Salvage and Hauling, Gear,
// VTOL and Lights start row 2 and ATC and Request Docking row 3; Hold to Talk and Emergency
// end row 3 on every page.
const XL = {
  flight: [
    ["qt-flight-ready", "qt-pwr", "qt-wep", "qt-thr", "qt-shld", "pw-wep-up", "pw-thr-up", "pw-shd-up"],
    ["pl-gear", "pl-vtol", "fa-lights", "fa-limiter", "pw-reset", "pw-wep-down", "pw-thr-down", "pw-shd-down"],
    ["top-atc", "pl-request-dock", "qt-scm-nav", "op-quantum", "qt-engage", "top-starmap", "td-talk", "@folder:emergency"],
  ],
  combat: [
    ["op-guns", "op-missile", "cb-missile", "sh-up", "sh-front", "pw-shd-up", "tg-next-hostile", "tg-attacker"],
    ["cb-decoy", "cb-noise", "cb-panic", "sh-left", "sh-reset", "sh-right", "tg-sub", "fa-look-behind"],
    ["pw-wep-down", "pw-wep-up", "fa-scm", "sh-down", "sh-back", "pw-shd-down", "td-talk", "@folder:emergency"],
  ],
  mining: [
    ["mn-mode", "mn-fire", "mn-type", "mn-module-1", "mn-module-2", "mn-module-3", "op-scan", "op-flight"],
    ["pl-gear", "pl-vtol", "fa-lights", "mn-power-down", "mn-power-up", "fa-scm", "fa-limiter", "top-starmap"],
    ["top-atc", "pl-request-dock", "pw-shd-max", "pw-thr-max", "pw-reset", "cr-doors-toggle", "td-talk", "@folder:emergency"],
  ],
  salvage: [
    ["op-salvage", "sv-mod-left", "sv-mod-right", "sv-spacing-down", "sv-spacing-up", "op-scan", "op-flight", "top-starmap"],
    ["pl-gear", "pl-vtol", "fa-lights", "fa-limiter", "fa-decoupled", "fa-scm", "fa-esp", "cr-doors-toggle"],
    ["top-atc", "pl-request-dock", "pl-autoland", "pw-shd-max", "pw-thr-max", "pw-reset", "td-talk", "@folder:emergency"],
  ],
  hauling: [
    ["op-scan", "fa-throttle", "fa-limiter", "fa-scm", "fa-nav", "op-quantum", "qt-engage", "top-starmap"],
    ["pl-gear", "pl-vtol", "fa-lights", "cr-doors-open", "cr-doors-close", "cr-doors-lock", "cr-doors-unlock", "qt-flight-ready"],
    ["top-atc", "pl-request-dock", "pl-autoland", "pl-dock-cam", "cr-turret-1", "top-mobiglas", "td-talk", "@folder:emergency"],
  ],
  onfoot: [
    ["ft-inventory", "ft-camera", "ft-walk", "ft-drop", "ft-inspect", "top-mobiglas", "top-starmap", "ft-escape"],
    ["cm-visor", "cm-pit", "top-chat", "top-contacts", "cm-accept", "cm-decline", "em-wave", "@folder:emotes"],
    ["em-salute", "em-point", "em-greet", "em-cheer", "em-dance", "em-laugh", "td-talk", "em-sit"],
  ],
  comms: [
    ["cm-ptt", "cm-ptt-prox", "cm-channel", "cm-hail", "top-chat", "top-contacts", "cm-accept", "cm-decline"],
    ["sd-discord-mute", "sd-discord-deafen", "sd-discord-ptt", "sd-discord-ptm", "sd-obs-record", "sd-obs-stream", "sd-obs-replay", "sd-obs-screenshot"],
    ["sd-prev-track", "sd-play-pause", "sd-next-track", "sd-volume-down", "sd-volume-up", "sd-volume-mute", "td-talk", "@folder:websites"],
  ],
};

// 15 keys (and Mobile): 12 keys and a rail on the right (scenes menu, next, previous).
// Shields and power are one key each here, opening their blocks as folders. Flight and
// Hauling share Gear, ATC and Request Docking, and the SCM/NAV, Quantum, Engage, Star Map
// row, slot for slot.
const STD = {
  flight: [
    ["qt-flight-ready", "pl-gear", "top-atc", "pl-request-dock"],
    ["qt-scm-nav", "op-quantum", "qt-engage", "top-starmap"],
    ["pl-vtol", "fa-lights", "@folder:power", "@folder:emergency"],
  ],
  combat: [
    ["op-guns", "op-missile", "cb-missile", "tg-next-hostile"],
    ["cb-decoy", "cb-noise", "cb-panic", "tg-attacker"],
    ["@folder:shields", "@folder:power", "fa-scm", "@folder:emergency"],
  ],
  mining: [
    ["mn-mode", "mn-fire", "mn-type", "op-scan"],
    ["mn-module-1", "mn-module-2", "mn-module-3", "op-flight"],
    ["mn-power-down", "mn-power-up", "fa-lights", "pl-gear"],
  ],
  salvage: [
    ["op-salvage", "sv-mod-left", "sv-mod-right", "op-scan"],
    ["sv-spacing-down", "sv-spacing-up", "fa-limiter", "op-flight"],
    ["pl-vtol", "cr-doors-toggle", "fa-lights", "pl-gear"],
  ],
  hauling: [
    ["op-scan", "pl-gear", "top-atc", "pl-request-dock"],
    ["qt-scm-nav", "op-quantum", "qt-engage", "top-starmap"],
    ["pl-autoland", "cr-doors-toggle", "cr-doors-lock", "top-mobiglas"],
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

// A folder's pages: Back top left, its items in the rest, and a "More" key on the last
// free slot chaining to the next page when they don't fit. Back goes top left on every
// model because that's where the Stream Deck app puts it in every folder it writes.
function folderPages(modelId, id, folder) {
  const m = MODELS[modelId];
  const back = [0, 0];
  const slots = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) if (!(c === back[0] && r === back[1])) slots.push([c, r]);
  if (folder.grid) {
    // A block goes whole, centred beside Back (under the top row on the XLs, whose top row
    // is their navigation, else right of the first column). When it only fits turned on
    // its side, each of its columns becomes a row read from its bottom up, so Power's
    // weapons, thrusters and shields each run min to max. Else it's a list.
    const top = m.nav === "tabs" ? 1 : 0, left = top ? 0 : 1;
    const fits = (b) => b[0].length <= m.cols - left && b.length <= m.rows - top;
    const upright = BLOCKS[folder.grid];
    const turned = upright[0].map((_, c) => upright.map((row) => row[c]).reverse());
    const block = fits(upright) ? upright : fits(turned) ? turned : null;
    if (block) {
      const keys = { [`${back[0]},${back[1]}`]: "@back" };
      const x = left + Math.floor((m.cols - left - block[0].length) / 2);
      block.forEach((row, r) => row.forEach((ref, c) => { keys[`${c + x},${r + top}`] = ref; }));
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
    const keys = { [`${back[0]},${back[1]}`]: "@back" };
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
