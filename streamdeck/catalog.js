// Every action the Stream Deck pack offers, for the icon pack, the generated profiles and the
// plugin. Star Citizen actions come from layouts/hud.json, the source of every SpoolUp
// button, so the pack presses the same keys as the deck (and follows the same fixes).
// Stream Deck's own actions (media keys, websites, page and folder navigation) and other
// plugins' (Discord, OBS) are added here, since a tablet has nothing like them.
//
//   const { actions, byId, categories } = require("./catalog");
//
// An action: { id, label, icon, color, category, kind, ... }, with keyLabel where the pack's
// keys say it shorter than the label (see PACK)
//   kind "deck":    a SpoolUp button: keys, mode (tap/hold/timed), ms, anim, state, scAction
//   kind "system":  a built-in Stream Deck action: system { uuid, settings }
//   kind "plugin":  another plugin's action: plugin { uuid, name, version, action, settings, states }
//   kind "website": opens a site in the PC's browser: url
//   kind "nav":     moves around the pack's own pages and folders (the generator links them)
//   kind "spoolup": needs the SpoolUp plugin (voice, lights, status, themes, scenes)
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// Panel titles in hud.json -> the pack's categories (what the icon pack and property
// inspector group by).
const CATEGORIES = [
  { id: "ui", name: "mobiGlas & UI", icon: "mobiglas", panels: ["Top bar"] },
  { id: "landing", name: "Landing & Docking", icon: "gear", panels: [] },
  { id: "power", name: "Power", icon: "power-reset", panels: [] },
  { id: "systems", name: "Ship Systems", icon: "flight-ready", panels: ["QT/Systems"] },
  { id: "flight", name: "Flight", icon: "speed", panels: ["Flight Assist"] },
  { id: "shields", name: "Shields", icon: "power-shields", panels: ["Shields"] },
  { id: "targeting", name: "Targeting", icon: "target", panels: ["Targeting"] },
  { id: "combat", name: "Combat", icon: "missile", panels: ["Combat"] },
  { id: "modes", name: "Operator Modes", icon: "scanning", panels: ["Operator Modes"] },
  { id: "mining", name: "Mining", icon: "mining", panels: ["Mining"] },
  { id: "salvage", name: "Salvage", icon: "salvage", panels: ["Salvage"] },
  { id: "crew", name: "Crew & Doors", icon: "doors", panels: ["Crew/Doors"] },
  { id: "onfoot", name: "On Foot", icon: "walk", panels: ["On Foot"] },
  { id: "emotes", name: "Emotes", icon: "emote", panels: ["Emotes"] },
  { id: "comms", name: "Comms", icon: "comms", panels: ["Comms"] },
  { id: "camera", name: "Camera", icon: "camera", panels: ["Camera"] },
  { id: "media", name: "Media & Audio", icon: "play-pause", panels: [] },
  { id: "stream", name: "Streaming", icon: "live", panels: [] },
  { id: "tools", name: "Tools & Websites", icon: "link", panels: [] },
  { id: "deck", name: "SpoolUp", icon: "sliders", panels: [] },
  { id: "nav", name: "Navigation", icon: "grid", panels: [] },
];

// Buttons the HUD draws as text only get an icon on a Stream Deck key.
const ICON_FOR = {
  "top-atc": "atc", "pl-gear": "gear", "pl-vtol": "vtol", "pl-dock-vtol": "vtol", "pl-autoland": "autoland",
  "pl-request-dock": "docking", "pl-dock-cam": "dock-camera", "qt-flight-ready": "flight-ready",
  "qt-scm-nav": "scm-nav", "qt-engage": "quantum-jump", "qt-eject": "eject", "qt-self-destruct": "self-destruct",
};
// The pack's own look for a few buttons, over hud.json's (the tablet keeps its own): a
// key's words rather than a slider's ("Slide to eject" on a key that taps), Eject red like
// the rest of its folder, and icons told apart from their neighbours'. keyLabel is drawn
// only on the pack's keys, so the plugin keeps hud.json's label and its translations in
// public/i18n.js.
const PACK = {
  "qt-eject": { keyLabel: "Eject", color: "red" },
  "qt-flight-ready": { keyLabel: "Flight Ready" },
  "sh-back": { keyLabel: "Rear" },
  "fa-look-behind": { icon: "headtrack" },
  "top-contacts": { icon: "contacts" },
};
// Power/Landing holds two kinds of action: landing ones, and the power triangle.
const POWER = /^(pl-(max|min|inc|dec|reset)|.*power)/;

// The buttons of layouts/hud.json, one per action: the same keys and label in two panels
// (Operator Modes in QT/Systems' menu and in its own panel, VTOL twice) are one action,
// with the other ids kept as aliases so profiles and settings using either still work.
function deckActions(layoutFile = path.join(ROOT, "layouts", "hud.json")) {
  const layout = JSON.parse(fs.readFileSync(layoutFile, "utf8"));
  const found = [];
  const walk = (node, panel) => {
    if (Array.isArray(node)) { node.forEach((n) => walk(n, panel)); return; }
    if (!node || typeof node !== "object") return;
    if (typeof node.id === "string" && typeof node.keys === "string") found.push({ node, panel });
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, panel);
  };
  walk(layout.chrome || [], "Top bar");
  for (const panel of Object.values(layout.panels || {})) walk(panel.elements, panel.title);
  const byKey = new Map();
  const out = [];
  for (const { node, panel } of found) {
    const dupe = `${node.label}|${node.keys}`;
    if (byKey.has(dupe)) { byKey.get(dupe).aliases.push(node.id); continue; }
    const category = categoryOf(node, panel);
    const a = {
      id: node.id, label: node.label, kind: "deck", category,
      icon: node.icon || ICON_FOR[node.id] || (category === "emotes" ? `emote-${node.id.replace(/^em-/, "")}` : node.id),
      color: node.color || "", keys: node.keys, mode: node.mode || "tap", ms: node.ms, anim: node.anim || "",
      state: node.state || null, scAction: node.scAction || "", voice: node.voice, panel, aliases: [],
      ...PACK[node.id],
    };
    byKey.set(dupe, a);
    out.push(a);
  }
  return out;
}
function categoryOf(node, panel) {
  if (panel === "Power/Landing") return POWER.test(node.id) || /Weapons|Thrusters|Shields|Reset All/.test(node.label) ? "power" : "landing";
  const c = CATEGORIES.find((k) => k.panels.includes(panel));
  return c ? c.id : "systems";
}

// ---------- Stream Deck's own actions, and other plugins' ----------

const sys = (uuid, settings = {}) => ({ uuid, settings });
const media = (actionIdx) => sys("com.elgato.streamdeck.system.multimedia", { actionIdx });
// Elgato's plugins, as profiles store them (research/plugins.md). Settings stay empty: they
// work on any PC, and the player picks anything personal in Stream Deck.
const DISCORD = { uuid: "com.elgato.discord", name: "Discord", version: "2.4.0.123" };
const OBS = { uuid: "com.elgato.obsstudio", name: "OBS Studio", version: "3.0.3.31" };
const plug = (p, action, extra = {}) => ({ ...p, action, settings: {}, states: 1, ...extra });

const EXTRAS = [
  // Comms: Discord (Elgato's Discord plugin; one-time "Authorize" in Discord).
  { id: "sd-discord-mute", label: "Discord Mute", icon: "mic-off", color: "red", category: "comms", kind: "plugin", plugin: plug(DISCORD, "com.elgato.discord.mute", { states: 2 }) },
  { id: "sd-discord-deafen", label: "Discord Deafen", icon: "deafen", color: "red", category: "comms", kind: "plugin", plugin: plug(DISCORD, "com.elgato.discord.deafen", { states: 2 }) },
  { id: "sd-discord-ptt", label: "Discord PTT", icon: "push-to-talk", color: "green", category: "comms", kind: "plugin", plugin: plug(DISCORD, "com.elgato.discord.pushto.talk", { states: 2 }) },
  { id: "sd-discord-mode", label: "Voice Mode", icon: "voice-channel", category: "comms", kind: "plugin", plugin: plug(DISCORD, "com.elgato.discord.pushtotalktoggle", { states: 2 }) },
  // On a dial: turn for Discord's input or output volume, press to mute.
  { id: "sd-discord-volume", label: "Discord Volume", icon: "headset", category: "comms", kind: "plugin", dial: true, plugin: plug(DISCORD, "com.elgato.discord.volumecontrol", { settings: { device: "output" } }) },
  { id: "sd-discord-ptm", label: "Discord PTM", icon: "push-to-mute", color: "amber", category: "comms", kind: "plugin", plugin: plug(DISCORD, "com.elgato.discord.pushto.mute", { states: 2 }) },

  // Media and system audio (built in).
  { id: "sd-play-pause", label: "Play / Pause", icon: "play-pause", category: "media", kind: "system", system: media(1) },
  { id: "sd-next-track", label: "Next Track", icon: "next-track", category: "media", kind: "system", system: media(2) },
  { id: "sd-prev-track", label: "Previous Track", icon: "prev-track", category: "media", kind: "system", system: media(0) },
  { id: "sd-volume-up", label: "Volume Up", icon: "volume-up", category: "media", kind: "system", system: media(5) },
  { id: "sd-volume-down", label: "Volume Down", icon: "volume-down", category: "media", kind: "system", system: media(6) },
  { id: "sd-volume-mute", label: "Mute PC", icon: "volume-mute", color: "red", category: "media", kind: "system", system: media(4) },

  // Streaming (Elgato's OBS Studio plugin).
  { id: "sd-obs-record", label: "Record", icon: "record", color: "red", category: "stream", kind: "plugin", plugin: plug(OBS, "com.elgato.obsstudio.record", { states: 2 }) },
  { id: "sd-obs-stream", label: "Go Live", icon: "live", color: "red", category: "stream", kind: "plugin", plugin: plug(OBS, "com.elgato.obsstudio.stream", { states: 2, settings: { isInMultiAction: false, longpress: true } }) },
  { id: "sd-obs-replay", label: "Save Replay", icon: "replay", color: "amber", category: "stream", kind: "plugin", plugin: plug(OBS, "com.elgato.obsstudio.replaybuffer.save", { states: 2 }) },
  { id: "sd-obs-screenshot", label: "Screenshot", icon: "screenshot", category: "stream", kind: "plugin", plugin: plug(OBS, "com.elgato.obsstudio.screenshot", { states: 2 }) },

  // Websites (the same as SpoolUp's "Open on PC" defaults).
  { id: "sd-uex", label: "UEX", icon: "link", color: "blue", category: "tools", kind: "website", url: "https://uexcorp.space/" },
  { id: "sd-erkul", label: "Erkul", icon: "link", color: "blue", category: "tools", kind: "website", url: "https://www.erkul.games/" },
  { id: "sd-spviewer", label: "SPViewer", icon: "link", color: "blue", category: "tools", kind: "website", url: "https://www.spviewer.eu/" },
  { id: "sd-scmdb", label: "SCMDB", icon: "link", color: "blue", category: "tools", kind: "website", url: "https://scmdb.net/" },
  { id: "sd-brightness", label: "Brightness", icon: "brightness", category: "tools", kind: "system", system: sys("com.elgato.streamdeck.system.keybrightness") },
  // One step each way, for a dial's turns (research/navigation.verified.md: 0 brighter, 1 darker).
  { id: "sd-brightness-up", label: "Brighter", icon: "brightness", category: "tools", kind: "system", system: sys("com.elgato.streamdeck.system.keybrightness", { actionIdx: 0 }) },
  { id: "sd-brightness-down", label: "Dimmer", icon: "brightness", category: "tools", kind: "system", system: sys("com.elgato.streamdeck.system.keybrightness", { actionIdx: 1 }) },

  // SpoolUp (only with the plugin). Hold to Talk is blue, not the game's push-to-talk
  // green or danger red, and its key says what it's for.
  { id: "td-talk", label: "Hold to Talk", keyLabel: "Voice Command", icon: "mic", color: "blue", category: "deck", kind: "spoolup", spoolup: "talk" },
  { id: "td-status", label: "SpoolUp", icon: "sliders", category: "deck", kind: "spoolup", spoolup: "status" },
  { id: "td-lights-reset", label: "Reset Lights", icon: "power-reset", category: "deck", kind: "spoolup", spoolup: "lights-reset" },
  { id: "td-theme", label: "Theme", icon: "palette", category: "deck", kind: "spoolup", spoolup: "theme" },
  { id: "td-scene", label: "Scene", icon: "grid", category: "deck", kind: "spoolup", spoolup: "scene" },

  // Navigation inside the pack's profiles (the generator turns these into page/folder links).
  { id: "nav-next", label: "Next Page", icon: "page-next", category: "nav", kind: "nav", nav: "next" },
  { id: "nav-prev", label: "Previous Page", icon: "page-prev", category: "nav", kind: "nav", nav: "prev" },
  { id: "nav-back", label: "Back", icon: "back", category: "nav", kind: "nav", nav: "back" },
  { id: "nav-home", label: "Home", icon: "home", category: "nav", kind: "nav", nav: "home" },
  { id: "nav-themes", label: "Themes", icon: "palette", category: "nav", kind: "nav", nav: "folder:themes" },
];

function build(layoutFile) {
  const actions = [...deckActions(layoutFile), ...EXTRAS];
  const byId = new Map();
  for (const a of actions) {
    byId.set(a.id, a);
    for (const alias of a.aliases || []) byId.set(alias, a);
  }
  return { actions, byId, categories: CATEGORIES };
}

module.exports = { ...build(), build, CATEGORIES };
