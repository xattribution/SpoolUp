// Builds the starter layouts for different kinds of flying from the HUD layout, by putting
// the panels and the dashboard for that kind of flying first, the ship layouts, which
// start with a panel made for that ship, and Dashboards, which shows the dashboards only.
// Run it after changing layouts/hud.json, so they keep up.
//
//   node tools/make-starter-layouts.js
//
// Writes layouts/<id>.json for each starter, ship and Dashboards. Since SpoolUp 2.1 these
// are grid layouts that fit every screen, so each layouts/<id>-phone.json is the same
// layout marked "hidden": players' settings that name a phone file keep working, and the
// layout lists show it once. The buttons, keys and voice phrases are the HUD's own (ship
// panels copy them under new ids), so the keybind profile is unchanged.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const hud = JSON.parse(fs.readFileSync(path.join(ROOT, "layouts", "hud.json"), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));

// The panels each half starts on, in order (the half's other panels follow), and the
// dashboard the one-panel view starts on.
const STARTERS = [
  { id: "combat", name: "Combat", halves: [["power-landing", "shields", "targets", "flight-assist"], ["combat", "qt-systems", "modes", "crew"]], full: ["combat-dash"] },
  { id: "mining-salvage", name: "Mining & Salvage", halves: [["mining", "salvage", "power-landing", "flight-assist"], ["modes", "qt-systems", "crew", "on-foot"]], full: ["industry"] },
  { id: "hauling-exploration", name: "Hauling & Exploration", halves: [["power-landing", "flight-assist", "targets"], ["qt-systems", "crew", "on-foot", "emotes"]], full: ["pilot"] },
];

// Every button and element in the HUD by id.
const byId = new Map();
(function scan(node) {
  if (Array.isArray(node)) { node.forEach(scan); return; }
  if (!node || typeof node !== "object") return;
  if (typeof node.id === "string" && !byId.has(node.id)) byId.set(node.id, node);
  for (const v of Object.values(node)) if (v && typeof v === "object") scan(v);
})(hud.panels);
const need = (id) => { if (!byId.has(id)) throw new Error(`No "${id}" in layouts/hud.json`); return byId.get(id); };

// A copy of an element with every id in it prefixed, since a layout can't use a button id
// twice; with the same keys the copies share voice phrases and lit states.
function prefixed(prefix, el) {
  const copy = clone(el);
  (function walk(n) {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    if (typeof n.id === "string") n.id = `${prefix}-${n.id}`;
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
  })(copy);
  return copy;
}
// A button item (ids of the HUD's buttons) under the ship's prefix, as a plain button: the
// HUD's big framed styles (Engage Quantum's) don't fit a cell of a group.
const button = (prefix, id, span) => {
  const { type, span: _s, size, when, at, style, ...rest } = clone(need(id));
  return { type: "button", ...rest, id: `${prefix}-${id}`, span };
};
const group = (prefix, id, title, items) => ({ type: "group", id: `${prefix}-${id}`, title, cols: 6, span: [6, Math.ceil(items.length / 3)], elements: items });

// Ship layouts: a panel of that ship's controls, made from the HUD's own cluster and
// buttons, comes first in the left half; the starter's panels and everything else follow.
const SHIPS = [
  {
    id: "prospector", name: "Prospector", prefix: "pr", like: "mining-salvage",
    panel: (p) => ({ title: "Prospector", cols: 6, elements: [
      { ...prefixed(p, need("mn-cluster")), span: [6, 4] },
      // In the order they're used: start-up and leaving the pad, the operator modes, then
      // travel and getting out.
      group(p, "ship", "Ship", ["qt-flight-ready", "fa-lights", "pl-gear", "op-flight", "op-scan", "op-mining", "qt-scm-nav", "qt-engage", "fa-exit"].map((id) => button(p, id, [2, 1]))),
      // Quantanium turns unstable in the hold: its jettison in a danger frame.
      { ...group(p, "cargo", undefined, [button(p, "mn-jettison", [6, 1])]), style: "danger" },
    ] }),
  },
  {
    id: "vulture", name: "Vulture", prefix: "vu", like: "mining-salvage",
    panel: (p) => ({ title: "Vulture", cols: 6, elements: [
      { ...prefixed(p, need("sv-cluster")), span: [6, 3] },
      group(p, "heads", "Salvage heads", ["sv-focus-left", "sv-focus-all", "sv-focus-right", "sv-fire-left", "sv-fire-right"].map((id, i) => button(p, id, [i < 3 ? 2 : 3, 1]))),
      group(p, "ship", "Ship", ["qt-flight-ready", "fa-lights", "pl-gear", "op-flight", "op-scan", "op-salvage", "qt-scm-nav", "qt-engage", "pl-vtol"].map((id) => button(p, id, [2, 1]))),
      group(p, "doors", "Doors", ["cr-doors-open", "cr-doors-close", "fa-exit"].map((id) => button(p, id, [2, 1]))),
    ] }),
  },
];

// Every panel stays: each half shows the starter's panels first, then the rest of that
// half's panels in the HUD's order, so nothing (emotes, on foot...) is ever out of reach.
// Panels in "extra" (ship panels) aren't the HUD's; they go first and are added.
function starter(name, halves, full, note, extra = {}) {
  const base = hud.grid.halves;
  const order = (want, have, side) => {
    for (const id of want) if (!have.includes(id) && !extra[id]) throw new Error(`Panel "${id}" isn't in the ${side} half of the HUD`);
    return [...want, ...have.filter((id) => !want.includes(id))];
  };
  for (const id of full) if (!hud.panels[id]) throw new Error(`No dashboard "${id}" in the HUD`);
  return {
    name, notes: note,
    grid: {
      ...clone(hud.grid),
      halves: { left: order(halves[0], base.left, "left"), right: order(halves[1], base.right, "right") },
      full: [...full, ...(hud.grid.full || []).filter((id) => !full.includes(id))],
    },
    chrome: clone(hud.chrome),
    panels: { ...extra, ...clone(hud.panels) },
  };
}

const note = "Generated by tools/make-starter-layouts.js from the HUD layout; edit that script, not this file.";
const outputs = [];
for (const s of STARTERS) outputs.push([s.id, starter(s.name, s.halves, s.full, note)]);
for (const ship of SHIPS) {
  const like = STARTERS.find((s) => s.id === ship.like);
  const extra = { [ship.id]: ship.panel(ship.prefix) };
  outputs.push([ship.id, starter(ship.name, [[ship.id, ...like.halves[0]], like.halves[1]], like.full, note, extra)]);
}

// Dashboards: wide panels of clusters only, one at a time on every screen. The HUD's
// panels stay in the file (the dashboards show their clusters by reference) but aren't on
// a track, so paging goes through the dashboards alone.
// `small` is its size on a phone, or false to leave it to its own panel there, so a phone
// shows the dashboard's essentials without scrolling.
const ref = (panel, id, span, small) => {
  need(id);
  const r = { type: "ref", id: `${panel}-${id}`, ref: id, span };
  if (small === false) r.only = "large";
  else if (small) r.size = { small };
  return r;
};
const dashboards = {
  ...clone(Object.fromEntries((hud.grid.full || []).map((id) => [id, hud.panels[id]]))),
  // Start-up and landing, the spool, the cargo doors; then flying it there.
  hauling: { title: "Hauling", cols: 12, wide: true, elements: [
    ref("hl", "pl-group", [4, 3]), ref("hl", "qt-quantum", [4, 3], [4, 2]), ref("hl", "cr-hull", [4, 4], [4, 3]),
    ref("hl", "qt-modes", [4, 5], false), ref("hl", "pw-group", [4, 5], false),
    ref("hl", "qt-boot", [4, 1]), ref("hl", "cr-turrets", [4, 1], false), ref("hl", "fa-bank", [4, 1], false), ref("hl", "fa-range", [4, 1], false),
    ref("hl", "cr-ship", [4, 1], false),
  ] },
};
outputs.push(["dashboards", {
  name: "Dashboards",
  notes: `${note} Wide dashboards of the HUD's clusters, one at a time.`,
  grid: { ...clone(hud.grid), start: { small: "full", large: "full" }, halves: { left: [], right: [] }, full: Object.keys(dashboards) },
  chrome: clone(hud.chrome),
  panels: { ...dashboards, ...Object.fromEntries(Object.entries(clone(hud.panels)).filter(([id]) => !dashboards[id])) },
}]);

// Every button id must be unique within a layout.
function checkIds(layout, file) {
  const seen = new Set();
  (function check(node) {
    if (Array.isArray(node)) { node.forEach(check); return; }
    if (!node || typeof node !== "object") return;
    if (typeof node.id === "string" && typeof node.keys === "string") {
      if (seen.has(node.id)) throw new Error(`${file}: duplicate id "${node.id}"`);
      seen.add(node.id);
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") check(v);
  })(layout);
}

for (const [id, layout] of outputs) {
  checkIds(layout, id);
  const write = (file, obj) => fs.writeFileSync(path.join(ROOT, "layouts", file), JSON.stringify(obj, null, 2) + "\n");
  write(`${id}.json`, layout);
  // Phone copy: the same layout, hidden from the lists (Dashboards is new, so has none).
  if (id !== "dashboards") write(`${id}-phone.json`, { name: layout.name, notes: layout.notes, hidden: true, ...Object.fromEntries(Object.entries(layout).filter(([k]) => !["name", "notes"].includes(k))) });
  const t = layout.grid;
  console.log(`Wrote layouts/${id}.json${id === "dashboards" ? "" : ` (and ${id}-phone.json)`}: ${t.halves.left.length} + ${t.halves.right.length} panels, ${t.full.length} dashboards.`);
}
