// Checks the built-in grid layouts (SpoolUp 2.1) the way the deck lays them out, at the
// screen sizes players have, in both size classes and both views (two halves, one panel):
//
// - every element has an id, and no id is used twice (buttons, clusters, groups, refs);
// - every ref shows an element that exists (and isn't itself a ref);
// - placed cells never overlap and never run off the grid;
// - every element type is drawn by something: a 2.0 renderer or a registered widget
//   (public/grid.js, clusters.js, dial.js and emotes.js are loaded with no DOM, so a
//   widget that touches the page while registering fails here).
//
// Panels that need to scroll at a size are listed as notes, not failures (hidden copies,
// the *-phone.json files, are checked but not noted again).
//
//   node tools/check-grid.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const { DeckGrid, DeckWidgets } = require(path.join(ROOT, "public", "grid.js"));

// The element types canvas.js draws itself.
const BUILTIN = new Set(["button", "action", "talk", "voicehelp", "status", "rule", "divider", "header", "state-header",
  "switch", "vlabel", "caption", "bracket", "danger-zone", "slider", "menu", "lever", "level", "fader", "recenter",
  "recentre", "rotary", "grid", "group", "ref"]);

const problems = [], notes = [];
const fail = (msg) => problems.push(msg);

// ---------- widgets ----------
// Each widget script runs in a context with window = itself and no document, the way a
// tool would load it; it registers with the same DeckWidgets.
for (const file of ["dial.js", "clusters.js", "emotes.js"]) {
  const p = path.join(ROOT, "public", file);
  if (!fs.existsSync(p)) { notes.push(`public/${file} isn't there yet: its widgets fall back to plain buttons.`); continue; }
  const sandbox = { DeckGrid, DeckWidgets, console, setTimeout, clearTimeout, Math, JSON };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(fs.readFileSync(p, "utf8"), sandbox, { filename: file });
  } catch (err) {
    fail(`public/${file} failed to load without a page (registration must not touch the DOM): ${err.message}`);
  }
}
const registered = new Set(DeckWidgets.list().map(([type]) => type));

// ---------- layouts ----------
const SIZES = [
  // [name, width, height] of the stage
  ["phone landscape", 734, 372],
  ["phone landscape (no insets)", 852, 393],
  ["phone portrait", 393, 760],
  ["tablet", 1024, 768],
  ["large tablet", 1366, 1024],
];

function checkLayout(file) {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, "layouts", file), "utf8"));
  if (!DeckGrid.isGrid(layout)) return false;
  const where = `layouts/${file}`;
  // ids
  const ids = new Map();
  const buttons = new Set();
  const index = DeckGrid.index(layout);
  (function walk(n, at) {
    if (Array.isArray(n)) { n.forEach((v) => walk(v, at)); return; }
    if (!n || typeof n !== "object") return;
    if (typeof n.id === "string" && typeof n.keys === "string") {
      if (buttons.has(n.id)) fail(`${where}: button id "${n.id}" is used twice`);
      buttons.add(n.id);
    }
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, at);
  })(layout);
  const elementIds = (els, at) => {
    for (const e of els || []) {
      if (!e || typeof e !== "object") { fail(`${where} ${at}: an element isn't an object`); continue; }
      if (typeof e.id !== "string" || !e.id) fail(`${where} ${at}: a "${e.type}" element has no id`);
      else if (ids.has(e.id)) fail(`${where} ${at}: element id "${e.id}" is also in ${ids.get(e.id)}`);
      else ids.set(e.id, at);
      if (e.type === "ref") {
        const t = index.get(e.ref);
        if (!t) fail(`${where} ${at}: ref "${e.id}" shows "${e.ref}", which isn't in the layout`);
        else if (t.type === "ref") fail(`${where} ${at}: ref "${e.id}" shows another ref`);
      } else if (!BUILTIN.has(e.type) && !registered.has(e.type) && registered.size) {
        fail(`${where} ${at}: nothing draws the "${e.type}" element "${e.id}" (no widget registered)`);
      }
      if (e.type === "group") elementIds(e.elements, `${at} > ${e.id}`);
    }
  };
  for (const [pid, p] of Object.entries(layout.panels || {})) {
    if (!Array.isArray(p.elements)) { fail(`${where}: panel "${pid}" has no elements`); continue; }
    elementIds(p.elements, `panel "${pid}"`);
  }
  // tracks
  const g = layout.grid;
  for (const id of [...(g.full || []), ...((g.halves || {}).left || []), ...((g.halves || {}).right || [])]) {
    if (!layout.panels[id]) fail(`${where}: the grid names panel "${id}", which isn't in the layout`);
  }
  // placement at every size, class and view
  const tracks = DeckGrid.tracks(layout);
  for (const [name, W, H] of SIZES) {
    const cls = DeckGrid.sizeClass(W, H);
    const c = DeckGrid.CLASSES[cls];
    const y = c.bar + (cls === "small" ? 6 : 16);
    const bodyH = H - y - (cls === "small" ? 0 : 14) - c.pager - 8;
    const views = [["one panel", W - c.margin * 2, tracks.full]];
    if (!(cls === "small" && H > W) && tracks.left.length && tracks.right.length) {
      const half = (W - c.margin * 2 - c.between) / 2;
      views.push(["two halves", half, [...tracks.left, ...tracks.right]]);
    }
    for (const density of DeckGrid.DENSITIES) {
      for (const [view, width, panels] of views) {
        const m = DeckGrid.metrics({ width, sizeClass: cls, density });
        for (const pid of panels) {
          const panel = layout.panels[pid];
          const items = (panel.elements || []).filter((e) => !(e.type === "ref" && !index.get(e.ref)) && DeckGrid.shows(e, cls));
          const authoredCols = Math.round(panel.cols) || (panel.wide ? 12 : 6);
          const spanOf = (e) => (e.type === "ref" && !e.span && !e.size && index.get(e.ref) ? DeckGrid.spanOf(index.get(e.ref), cls) : DeckGrid.spanOf(e, cls));
          // Every `when` value shown at once is the worst case for overlaps; check each
          // switch value too.
          const groups = [...new Set(items.filter((e) => e.when).map((e) => e.when[0]))];
          const variants = groups.length ? [null, ...items.filter((e) => e.when).map((e) => e.when)] : [null];
          for (const shown of variants) {
            const vis = items.filter((e) => !e.when || !shown || e.when[0] !== shown[0] || e.when[1] === shown[1]);
            const placed = DeckGrid.place(vis.map((item) => ({ item, span: spanOf(item), min: DeckGrid.minWidth(item.type === "ref" ? index.get(item.ref) : item) })),
              { cols: m.cols, authoredCols, sizeClass: cls });
            const taken = new Set();
            for (const cell of placed.cells) {
              if (cell.col < 0 || cell.col + cell.w > m.cols) fail(`${where} ${name} ${view}: "${cell.item.id}" in "${pid}" runs off the grid`);
              for (let r = cell.row; r < cell.row + cell.h; r++) for (let q = cell.col; q < cell.col + cell.w; q++) {
                const k = `${q},${r}`;
                if (taken.has(k)) fail(`${where} ${name} ${view}: "${cell.item.id}" in "${pid}" overlaps another item`);
                taken.add(k);
              }
            }
            if (shown === null && density === "default" && !layout.hidden) {
              const size = DeckGrid.cellSize({ bodyW: width, bodyH, cols: m.cols, rows: placed.rows, gap: m.gap, minH: m.minH, maxH: m.maxH });
              if (size.scrolls) notes.push(`${where} ${name}, ${view}: "${pid}" scrolls (${placed.rows} rows)`);
            }
          }
        }
      }
    }
  }
  return true;
}

const files = fs.readdirSync(path.join(ROOT, "layouts")).filter((f) => f.endsWith(".json")).sort();
let grids = 0;
for (const f of files) {
  try { if (checkLayout(f)) grids++; } catch (err) { fail(`layouts/${f}: ${err.message}`); }
}

for (const n of notes) console.log(`note: ${n}`);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`${problems.length} problem${problems.length === 1 ? "" : "s"} in the grid layouts.`);
  process.exit(1);
}
console.log(`Grid layouts: ${grids} checked at ${SIZES.length} screen sizes, both views and every density; widgets registered: ${[...registered].sort().join(", ") || "none yet"}.`);
