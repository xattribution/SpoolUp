// Grid layouts (layout.grid, SpoolUp 2.1): panels are arrangements of buttons and widgets on
// a grid of cells that follows the screen. A panel is authored on 6 columns (12 for a wide
// dashboard); each item has a span in cells and may be pinned to a cell. The deck works out
// how many columns fit the screen, scales spans down when there are fewer, never stretches
// them when there are more, and packs the items in order around the pins, so adding a
// button, hiding one or turning the screen keeps everything on the grid.
//
// DeckGrid is pure (no DOM), so tools/check-grid.js runs it under Node. DeckWidgets is the
// registry the cockpit clusters, the mode dial and the emote board register with; the
// canvas renderer (canvas.js) draws an item with its widget when there is one.
(function () {
  "use strict";

  // Two size classes, by the stage's shorter side, each with three densities (the cell
  // width the column count aims for). Small screens open on one panel, large on two halves.
  const CLASSES = {
    small: { units: { compact: 48, default: 56, roomy: 64 }, gap: 6, minH: 44, maxH: 72, bar: 44, pager: 36, margin: 0, between: 12, mode: "full" },
    large: { units: { compact: 64, default: 76, roomy: 92 }, gap: 10, minH: 56, maxH: 120, bar: 64, pager: 44, margin: 14, between: 16, mode: "halves" },
  };
  const DENSITIES = ["compact", "default", "roomy"];

  // Spans of the 2.0 element types when an item gives none ([w, h] on 6 columns).
  const BUILTIN_SPANS = {
    button: [2, 1], header: [6, 1], "state-header": [4, 1], switch: [2, 1], menu: [2, 1],
    slider: [4, 1], "danger-zone": [6, 2], caption: [6, 1], lever: [2, 3], level: [2, 3],
    fader: [6, 2], rotary: [6, 5], recenter: [3, 1], recentre: [3, 1], group: [6, 3],
  };

  // The narrowest a type gets when a panel is shown on fewer columns than it was made for
  // (a dashboard on a phone held upright): a group keeps its own columns, the dial its face.
  const BUILTIN_MIN = { rotary: 4, fader: 3, slider: 3, "danger-zone": 3 };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const isSpan = (s) => Array.isArray(s) && s.length === 2 && s.every((n) => Number.isFinite(n) && n >= 1);

  // ---------- widget registry ----------

  const widgets = new Map();
  const DeckWidgets = {
    // def: { label, category, icon, spans: { small, large }, min, max, drag, buttons(e), render(e, ctx) }
    register(type, def) {
      if (typeof type !== "string" || !def || typeof def.render !== "function") throw new Error(`DeckWidgets.register: bad widget "${type}"`);
      widgets.set(type, def);
      return def;
    },
    get: (type) => widgets.get(type),
    list: () => [...widgets.entries()],
  };

  // ---------- the grid ----------

  const DeckGrid = {
    CLASSES,
    DENSITIES,
    BUILTIN_SPANS,

    isGrid: (layout) => Boolean(layout && layout.grid && typeof layout.grid === "object" && !Array.isArray(layout.grid)),

    sizeClass: (w, h) => (Math.min(w, h) < 500 ? "small" : "large"),

    // An item with `only: "small"` or `only: "large"` shows on that size class alone (a
    // dashboard keeps its essentials on a phone and the rest stays on its own panels).
    shows: (item, sizeClass) => !(item && (item.only === "small" || item.only === "large")) || item.only === sizeClass,

    // Columns that fit `width` at the density's cell width: an even number, 4 to 12.
    metrics({ width, sizeClass, density }) {
      const c = CLASSES[sizeClass] || CLASSES.large;
      const unit = c.units[density] || c.units.default;
      const cols = clamp(Math.round((width + c.gap) / (unit + c.gap) / 2) * 2, 4, 12);
      return { cols, unit, gap: c.gap, minH: c.minH, maxH: c.maxH };
    },

    // An item's [w, h] in authored cells: its size for this class, its span, the widget's
    // default for the class, or the type's.
    spanOf(item, sizeClass, typeDefaults) {
      if (item && item.size && isSpan(item.size[sizeClass])) return item.size[sizeClass].slice();
      if (item && isSpan(item.span)) return item.span.slice();
      const d = typeDefaults || (item && widgets.get(item.type) && widgets.get(item.type).spans);
      if (d) {
        if (isSpan(d[sizeClass])) return d[sizeClass].slice();
        if (isSpan(d.large)) return d.large.slice();
        if (isSpan(d)) return d.slice();
      }
      if (item && item.type === "grid" && Array.isArray(item.buttons)) {
        const per = item.cols || 3;
        return [6, Math.max(1, Math.ceil(item.buttons.length / per))];
      }
      return (BUILTIN_SPANS[item && item.type] || BUILTIN_SPANS.button).slice();
    },

    // The narrowest an item gets when spans are scaled down (authored columns).
    minWidth(item) {
      if (!item) return 1;
      if (item.type === "group") return Math.max(1, Math.round(item.cols) || 6);
      const d = widgets.get(item.type);
      if (d && isSpan(d.min)) return d.min[0];
      return BUILTIN_MIN[item.type] || 1;
    },

    // Packs items on `cols` columns: pins first (where they fit), then the rest in order,
    // first fit, top to bottom and left to right. `items` are { item, span: [w, h], min }
    // or plain items (spans then come from spanOf). Returns { rows, cells }. On fewer
    // columns than authored, spans shrink in proportion, but never below an item's
    // minimum width (`min`, else minWidth), so a cluster stays usable on a narrow screen.
    place(items, { cols, authoredCols = 6, sizeClass = "large" } = {}) {
      const ac = authoredCols || 6;
      const scaleW = (w, min) => (cols < ac ? clamp(Math.max(Math.round((w * cols) / ac), Math.min(w, min || 1)), 1, cols) : Math.min(w, cols));
      const taken = []; // rows of booleans
      const free = (c, r, w, h) => {
        if (c < 0 || c + w > cols) return false;
        for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken[y] && taken[y][x]) return false;
        return true;
      };
      const take = (c, r, w, h) => {
        for (let y = r; y < r + h; y++) { taken[y] = taken[y] || []; for (let x = c; x < c + w; x++) taken[y][x] = true; }
      };
      const list = items.map((it) => {
        const item = it && it.item ? it.item : it;
        const span = it && it.item && isSpan(it.span) ? it.span : DeckGrid.spanOf(item, sizeClass);
        const min = it && it.item && Number.isFinite(it.min) ? it.min : DeckGrid.minWidth(item);
        return { item, w: scaleW(span[0], min), h: Math.max(1, Math.round(span[1])) };
      });
      const cells = new Array(list.length);
      list.forEach((p, i) => {
        const at = p.item && p.item.at;
        if (!Array.isArray(at) || at.length !== 2 || !at.every((n) => Number.isInteger(n) && n >= 0)) return;
        const c = cols < ac ? Math.round((at[0] * cols) / ac) : at[0];
        const r = at[1];
        if (!free(c, r, p.w, p.h)) return; // doesn't fit this screen: flows with the rest
        take(c, r, p.w, p.h);
        cells[i] = { item: p.item, col: c, row: r, w: p.w, h: p.h, pinned: true };
      });
      list.forEach((p, i) => {
        if (cells[i]) return;
        for (let r = 0; ; r++) {
          let c = 0;
          for (; c + p.w <= cols; c++) if (free(c, r, p.w, p.h)) break;
          if (c + p.w <= cols) { take(c, r, p.w, p.h); cells[i] = { item: p.item, col: c, row: r, w: p.w, h: p.h, pinned: false }; return; }
        }
      });
      const rows = cells.reduce((m, c) => Math.max(m, c.row + c.h), 0);
      return { rows, cells };
    },

    // Cell size for a placement in a body of bodyW x bodyH: rows grow to fill the body
    // between minH and maxH; when even minH doesn't fit, the body scrolls.
    cellSize({ bodyW, bodyH, cols, rows, gap, minH, maxH }) {
      const cellW = Math.max(1, (bodyW - gap * (cols - 1)) / cols);
      const n = Math.max(1, rows);
      const cellH = clamp((bodyH - gap * (n - 1)) / n, minH, maxH);
      const scrolls = n * minH + gap * (n - 1) > bodyH + 0.5;
      return { cellW, cellH, scrolls, height: n * cellH + gap * (n - 1) };
    },

    // Every element, wherever it sits (panels, groups), by id; for refs.
    index(layout) {
      const byId = new Map();
      const walk = (els) => {
        for (const e of els || []) {
          if (!e || typeof e !== "object") continue;
          if (typeof e.id === "string" && e.type !== "ref" && !byId.has(e.id)) byId.set(e.id, e);
          if (e.type === "group") walk(e.elements);
        }
      };
      for (const p of Object.values((layout && layout.panels) || {})) walk(p.elements);
      return byId;
    },

    // The panel ids a mode shows, in order: halves left and right, or the full track
    // (dashboards, then the left half's panels, then the right's, once each).
    tracks(layout) {
      const g = layout.grid || {};
      const panels = layout.panels || {};
      const ok = (id) => Object.prototype.hasOwnProperty.call(panels, id);
      const halves = g.halves || {};
      const left = (halves.left || []).filter((id) => ok(id) && !panels[id].wide);
      const right = (halves.right || []).filter((id) => ok(id) && !panels[id].wide);
      const full = [];
      for (const id of [...(g.full || []), ...(halves.left || []), ...(halves.right || [])]) if (ok(id) && !full.includes(id)) full.push(id);
      return { left, right, full };
    },

    // A 2.0 canvas layout as a grid layout, for the editor's Convert: each half's panels,
    // their elements in reading order, sized to the cells they covered.
    fromCanvas(layout) {
      const [W, H] = layout.canvas || [1024, 768];
      const regions = layout.regions || [];
      const out = {
        name: `${layout.name || "Layout"} (grid)`,
        notes: layout.notes || "",
        grid: { version: 3, density: { small: "default", large: "default" }, halves: { left: [], right: [] } },
        chrome: [],
        panels: {},
      };
      const DROP = new Set(["vlabel", "rule", "bracket", "divider"]);
      for (const c of layout.chrome || []) {
        if (DROP.has(c.type)) continue;
        const { x, y, w, h, ...rest } = c;
        out.chrome.push({ ...rest, bar: (Number(x) || 0) < W / 2 ? "left" : "right" });
      }
      const seen = new Set();
      regions.slice(0, 2).forEach((region, ri) => {
        const side = ri === 0 ? "left" : "right";
        const bodyH = (region.h || H) - (region.pager || 44) - 8;
        const rowPx = bodyH / (H >= 500 ? 7 : 4);
        const colPx = (region.w || W / 2) / 6;
        for (const pid of region.panels || []) {
          const panel = layout.panels && layout.panels[pid];
          if (!panel) continue;
          if (!seen.has(pid)) {
            seen.add(pid);
            const els = (panel.elements || []).filter((e) => e && !DROP.has(e.type))
              .map((e, i) => ({ e, i }))
              .sort((a, b) => (a.e.y || 0) - (b.e.y || 0) || (a.e.x || 0) - (b.e.x || 0) || a.i - b.i);
            out.panels[pid] = {
              title: panel.title || pid,
              cols: 6,
              elements: els.map(({ e, i }) => {
                const { x, y, w, h, ...rest } = e;
                const item = { ...rest };
                if (item.type === "recentre") item.type = "recenter";
                if (typeof item.id !== "string") item.id = `${pid}-${i}`;
                const sw = w === undefined ? 6 : clamp(Math.round(w / colPx), 1, 6);
                const sh = h === undefined ? 1 : clamp(Math.round(h / rowPx), 1, 8);
                item.span = [sw, sh];
                return item;
              }),
            };
          }
          out.grid.halves[side].push(pid);
        }
      });
      return out;
    },
  };

  if (typeof window !== "undefined") { window.DeckGrid = DeckGrid; window.DeckWidgets = DeckWidgets; }
  if (typeof module !== "undefined" && module.exports) module.exports = { DeckGrid, DeckWidgets };
})();
