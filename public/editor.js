// Layout editor: shows a layout with the deck's own renderer (canvas.js), where clicking
// selects instead of pressing keys. Saving goes to the server (/editor/save), which checks
// the layout and stores it as the player's own. Export saves the layout as a file to share;
// Import opens such a file unsaved, to look at and then save like any edit, so it gets the
// same checks.
//
// Grid layouts (layout.grid, 2.1) are edited on their grid: a see-through layer over the
// preview draws the cells and one box per item, so selecting, dragging and resizing work the
// same for a button, a cockpit cluster or a group, whatever the renderer drew. Items flow in
// order (drag to reorder, the rest reflows live) or are pinned to a cell; spans resize by
// whole cells. The preview shows either size class (small or large screen), either view
// (two halves or one panel) and each density, with the same code the deck runs.
//
// 2.0 canvas layouts keep their free editing (drag by pixels) and can be converted into a
// new grid layout.
(() => {
  const $ = (id) => document.getElementById(id);
  const token = (new URLSearchParams(location.search).get("t") || "").trim().toLowerCase();
  const api = (p) => `/editor/${p}${p.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
  try { document.documentElement.dataset.theme = localStorage.getItem("theme") || "rsi"; } catch { /* default theme */ }

  const COLORS = ["", "green", "amber", "red", "blue"];
  const ANIMS = ["", "flash", "ripple", "gear", "charge", "burst", "glow", "recoil", "streak", "doors", "lock", "hazard", "timed"];
  const MODES = { tap: "Tap (quick press)", hold: "Hold (held while your finger is down)", timed: "Long press (held for a set time)" };
  const Grid = window.DeckGrid;
  const Widgets = window.DeckWidgets;

  let info = null;       // { layouts, keys, overrides } from the server
  let file = "";         // the layout file being edited
  let layout = null;     // the layout itself, changed in place
  let deck = null;       // canvas.js handle
  let selectedId = null; // id of the selected button or item
  let dirty = false;
  const undoStack = [];
  const redoStack = [];
  const elementOf = new Map(); // button id -> its element in the preview
  const idOfEl = new WeakMap(); // and back, to pick a group's part under the pointer
  const fxOf = new Map();      // button id -> its press animation, for "Try animation"
  const memory = {};           // the preview's page positions, kept apart from the real deck's
  const store = { get: (k) => (k in memory ? memory[k] : null), set: (k, v) => { memory[k] = v; } };

  // ---------- messages ----------

  let statusTimer = null;
  function status(text, bad) {
    const el = $("edStatus");
    el.textContent = text;
    el.classList.toggle("bad", Boolean(bad));
    el.classList.add("show");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.classList.remove("show"), bad ? 6000 : 3000);
  }

  // ---------- layout helpers ----------

  const isGrid = () => Boolean(layout && Grid && Grid.isGrid(layout));
  const isButton = (n) => n && typeof n === "object" && typeof n.id === "string" && typeof n.keys === "string";
  // Cockpit controls (gear lever, level sliders, speed fader, mode dial) hold their buttons
  // inside them; the control itself moves and resizes like a button.
  const CONTROLS = { lever: "Gear lever", level: "Level slider", fader: "Fader", rotary: "Mode dial" };
  const isControl = (n) => n && typeof n === "object" && typeof n.id === "string" && Object.prototype.hasOwnProperty.call(CONTROLS, n.type);
  // A control's buttons, by the part they play in it. Registered widgets (2.1 clusters, the
  // new mode dial) list their own.
  const partsOf = (c) => {
    const def = Widgets && Widgets.get(c.type);
    if (def && typeof def.buttons === "function") {
      try { return def.buttons(c).filter((p) => Array.isArray(p) && isButton(p[1])); } catch { /* fall back below */ }
    }
    if (CONTROLS[c.type]) {
      return [
        ...(c.button ? [["Pull or push", c.button]] : []),
        ...(c.up ? [["Step up", c.up]] : []),
        ...(c.down ? [["Step down", c.down]] : []),
        ...(c.hub ? [["Center", c.hub]] : []),
        ...(Array.isArray(c.options) ? c.options.map((o) => ["Mode", o]) : []),
      ];
    }
    // Anything else (a widget whose script isn't loaded): every button inside, named by
    // where it sits ("faces front", "doors open").
    const out = [];
    (function walk(n, path) {
      if (!n || typeof n !== "object" || out.length > 80) return;
      if (n !== c && isButton(n)) { out.push([path.join(" ") || "Button", n]); return; }
      if (n !== c && n.type === "group") return;
      for (const [k, v] of Object.entries(n)) {
        if (!v || typeof v !== "object") continue;
        walk(v, Array.isArray(n) ? path : [...path, k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()]);
      }
    })(c, []);
    return out.map(([role, b]) => [role.charAt(0).toUpperCase() + role.slice(1), b]);
  };

  // Every button with the array it sits in.
  function eachButton(fn) {
    (function walk(node, parent) {
      if (Array.isArray(node)) { node.forEach((n) => walk(n, node)); return; }
      if (!node || typeof node !== "object") return;
      if (isButton(node)) fn(node, parent);
      for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, Array.isArray(node) ? node : null);
    })(layout, null);
  }
  function eachControl(fn) {
    (function walk(node, parent) {
      if (Array.isArray(node)) { node.forEach((n) => walk(n, node)); return; }
      if (!node || typeof node !== "object") return;
      if (isControl(node)) fn(node, parent);
      for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, Array.isArray(node) ? node : null);
    })(layout, null);
  }
  function find(id) {
    let found = null;
    eachButton((b, parent) => { if (!found && b.id === id) found = { button: b, parent }; });
    if (!found) eachControl((c, parent) => { if (!found && c.id === id) found = { button: c, parent, control: true }; });
    if (!found && isGrid()) { const at = locate(id); if (at) found = { button: at.item, parent: at.list, item: true }; }
    return found;
  }
  const selected = () => (selectedId && find(selectedId)?.button) || null;

  // The keys a button presses: its Star Citizen keybind when it follows one.
  const effectiveKeys = (b) => (b.scAction && info.overrides[b.scAction]) || b.keys;

  // Same as server.js spoken(): "Shields +" is said as "shields up".
  const spoken = (label) => String(label).toLowerCase()
    .replace(/\s*\+$/, " up").replace(/\s*[−-]$/, " down").replace(/&/g, " and ")
    .replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  const phrasesOf = (b) => (b.voice === false ? [] : [b.label, ...(Array.isArray(b.voice) ? b.voice : [])].map(spoken).filter(Boolean));

  // Every id in the layout (buttons, items, panels), so new ones never clash.
  function allIds() {
    const ids = new Set(Object.keys(layout.panels || {}));
    (function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== "object") return;
      if (typeof node.id === "string") ids.add(node.id);
      for (const v of Object.values(node)) if (v && typeof v === "object") walk(v);
    })(layout);
    return ids;
  }
  function freshId(base) {
    const ids = allIds();
    base = String(base || "item").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "item";
    let n = 1;
    while (ids.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
  const newId = () => freshId("my-button");

  // ---------- undo ----------

  function snapshot() {
    undoStack.push(JSON.stringify(layout));
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    markDirty();
  }
  function restore(json) {
    const prev = JSON.parse(json);
    for (const k of Object.keys(layout)) delete layout[k];
    Object.assign(layout, prev);
    if (selectedId && !find(selectedId)) selectedId = null;
    if (isGrid()) rebuild(); else redraw();
    renderProps();
    renderLibrary();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(layout)); restore(undoStack.pop()); markDirty(); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(layout)); restore(redoStack.pop()); markDirty(); }
  function markDirty() {
    dirty = true;
    $("undoBtn").disabled = !undoStack.length;
    $("redoBtn").disabled = !redoStack.length;
  }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- preview ----------

  // The preview's screen: small or large (fixed sizes that stand for each class), or the
  // pane itself ("Fit window"); two halves or one panel; and the density shown.
  const VIEWPORTS = { small: [734, 372], large: [1024, 768] };
  const preview = { screen: "large", mode: "halves" };
  function viewport() {
    if (preview.screen === "fit") {
      const pane = $("pane");
      return [Math.max(320, pane.clientWidth - 32), Math.max(240, pane.clientHeight - 32)];
    }
    return VIEWPORTS[preview.screen];
  }
  const sizeClass = () => { const [w, h] = viewport(); return preview.screen === "fit" ? Grid.sizeClass(w, h) : preview.screen; };
  const densityOf = (cls) => (layout.grid && layout.grid.density && layout.grid.density[cls]) || "default";
  function previewState() {
    const cls = sizeClass();
    return { sizeClass: cls, mode: preview.mode, viewport: viewport(), density: densityOf(cls) };
  }

  // Gives the stage the shape being previewed, scaled down to fit, so canvas pixels map to
  // layout (or viewport) pixels.
  function fitStage() {
    if (!layout) return;
    const pane = $("pane");
    const [W, H] = isGrid() ? viewport() : layout.canvas;
    const s = Math.min(1, (pane.clientWidth - 32) / W, (pane.clientHeight - 32) / H);
    const stage = $("stage");
    stage.style.width = `${W * s}px`;
    stage.style.height = `${H * s}px`;
    stage.style.left = `${(pane.clientWidth - W * s) / 2}px`;
    stage.style.top = `${(pane.clientHeight - H * s) / 2}px`;
  }
  // The pane changes size with the window and when the Add side shows or hides.
  let paneSize = "";
  new ResizeObserver(() => {
    const pane = $("pane");
    const now = `${pane.clientWidth}x${pane.clientHeight}`;
    if (now === paneSize || !layout) return;
    paneSize = now;
    if (isGrid()) later(rebuild); else fitStage();
  }).observe($("pane"));

  const D = {
    send() {}, buzz() {}, openPicker() {}, openVoiceHelp() {}, toggleFullscreen() {}, bindTalk() {},
    // Widgets bind nothing while editing; these keep any that ask from pressing a key.
    bindControl() {}, tapStep: () => false, canPress: () => false, stateOf: () => false, toast() {}, paged() {},
    // The preview isn't connected to anything; its status line says so instead of "Connecting…".
    refreshStatus() {
      for (const d of document.querySelectorAll(".js-dot")) d.classList.add("on");
      for (const t of document.querySelectorAll(".js-status")) t.textContent = "Editing";
    },
    store,
    deckIcon: window.deckIcon,
    emblemHtml: () => window.deckIcon("ship"),
    // Buttons select (and, on 2.0 layouts, drag) instead of pressing keys. On grid layouts
    // the editor's grid layer lies over the panels, so this only reaches the top bar.
    bindButton(el, def) {
      elementOf.set(def.id, el);
      idOfEl.set(el, def.id);
      fxOf.set(def.id, window.DeckFX.attach(el, def));
      el.addEventListener("pointerdown", (e) => startDrag(e, el, def));
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    },
    // Controls select (and drag) too; their gestures press nothing here. Their buttons
    // show the control when picked from its list.
    placeControl(el, def) {
      elementOf.set(def.id, el);
      idOfEl.set(el, def.id);
      for (const [, b] of partsOf(def)) if (!elementOf.has(b.id)) elementOf.set(b.id, el);
      el.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-btn]") && e.target.closest("[data-btn]") !== el) return; startDrag(e, el, def); });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    },
    afterRender: () => (isGrid() ? drawGrid() : drawSelection()),
  };

  function redraw() {
    elementOf.clear();
    fxOf.clear();
    if (!deck) return;
    if (isGrid()) rebuild(); else deck.render();
  }

  // Draws the grid layout afresh with the preview settings, keeping the panels that were
  // showing. A new deck each time, so new panels, refs and modes always show.
  function rebuild() {
    if (!layout) return;
    const shown = deck && deck.gridOf ? ["left", "right", "full"].map((r) => deck.gridOf(r)).filter(Boolean).map((g) => g.panelId) : [];
    elementOf.clear();
    fxOf.clear();
    D.preview = previewState();
    fitStage();
    $("canvas").innerHTML = "";
    deck = null; // the first draw happens inside renderCanvas, before its handle exists
    deck = window.renderCanvas(layout, D);
    if (deck.setMode && deck.mode && deck.mode() !== preview.mode) deck.setMode(preview.mode);
    if (shown.length && deck.showPanels) {
      const want = {};
      for (const id of shown) { const side = sideOf(id); if (side && !want[side]) want[side] = id; else if (!want.left) want.left = id; }
      if (preview.mode === "full") deck.showPanels({ left: shown[0] }); else deck.showPanels(want);
    }
    drawGrid();
    renderPreviewBar();
  }

  // ---------- 2.0 layouts: selecting, dragging, resizing by pixels ----------

  function select(id) {
    selectedId = id;
    if (isGrid()) {
      const at = id && locate(id);
      if (at && at.panelId) focusPanel = at.panelId;
      drawGrid();
    } else drawSelection();
    renderProps();
    renderLibrary();
  }

  // The canvas is scaled to fit; this turns screen pixels into layout pixels.
  const scale = () => $("canvas").getBoundingClientRect().width / ($("canvas").offsetWidth || 1);

  function drawSelection() {
    const canvas = $("canvas");
    let box = $("edSel");
    const el = selectedId && elementOf.get(selectedId);
    if (!el || !el.isConnected) { if (box) box.remove(); return; }
    if (!box || box.parentNode !== canvas) {
      if (box) box.remove();
      box = document.createElement("div");
      box.id = "edSel";
      box.innerHTML = `<i class="handle" title="Drag to resize"></i>`;
      box.querySelector(".handle").addEventListener("pointerdown", startResize);
      canvas.appendChild(box);
    }
    const s = scale(), c = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    Object.assign(box.style, {
      left: `${(r.left - c.left) / s}px`, top: `${(r.top - c.top) / s}px`,
      width: `${r.width / s}px`, height: `${r.height / s}px`,
    });
    // Buttons in automatic grids and menus have no position of their own; grid items
    // resize on the grid layer.
    box.querySelector(".handle").hidden = isGrid() || typeof selected()?.x !== "number";
  }

  function startDrag(e, el, def) {
    e.preventDefault();
    e.stopPropagation();
    if (selectedId !== def.id) select(def.id);
    if (typeof def.x !== "number" || isGrid()) return;
    const s = scale(), start = { px: e.clientX, py: e.clientY, x: def.x, y: def.y };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = Math.round((ev.clientX - start.px) / s), dy = Math.round((ev.clientY - start.py) / s);
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!moved) { snapshot(); moved = true; }
      def.x = start.x + dx;
      def.y = start.y + dy;
      el.style.left = `${def.x}px`;
      el.style.top = `${def.y}px`;
      drawSelection();
    };
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      if (moved) { redraw(); renderProps(); }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function startResize(e) {
    const def = selected();
    if (!def || typeof def.w !== "number") return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget, s = scale();
    const start = { px: e.clientX, py: e.clientY, w: def.w, h: def.h };
    snapshot();
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      def.w = Math.max(24, start.w + Math.round((ev.clientX - start.px) / s));
      def.h = Math.max(24, start.h + Math.round((ev.clientY - start.py) / s));
      const el = elementOf.get(def.id);
      if (el) { el.style.width = `${def.w}px`; el.style.height = `${def.h}px`; }
      drawSelection();
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      redraw();
      renderProps();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
  }

  // Clicking empty space clears the selection.
  $("pane").addEventListener("pointerdown", (e) => {
    if (e.target === $("pane") || e.target === $("stage")) select(null);
  });

  // ---------- grid layouts: where things are ----------

  // An item (anything with an id in a panel or a group) with the list it sits in, its
  // panel and its group.
  function locate(id) {
    if (!layout || !layout.panels || !id) return null;
    for (const [panelId, panel] of Object.entries(layout.panels)) {
      const hit = (function walk(list, group) {
        for (const e of list || []) {
          if (!e || typeof e !== "object") continue;
          if (e.id === id) return { item: e, list, panelId, panel, group };
          if (e.type === "group") { const r = walk(e.elements, e); if (r) return r; }
        }
        return null;
      })(panel.elements, null);
      if (hit) return hit;
    }
    return null;
  }
  const target = (e) => (e && e.type === "ref" ? Grid.index(layout).get(e.ref) || null : e);
  const groupTitle = (g) => g.title || g.label || "Group";
  function itemName(e) {
    if (!e) return "";
    if (e.type === "ref") { const t = target(e); return t ? itemName(t) : `Missing: ${e.ref}`; }
    const def = Widgets && Widgets.get(e.type);
    if (e.type === "group") return groupTitle(e);
    return e.label || e.title || e.text || (e.labels && Object.values(e.labels)[0]) || (def && def.label) || CONTROLS[e.type] || TYPE_NAMES[e.type] || e.type;
  }
  const TYPE_NAMES = {
    button: "Button", header: "Header", "state-header": "Mode header", switch: "Mode switch", menu: "Menu", slider: "Eject slider",
    "danger-zone": "Danger zone", caption: "Caption", grid: "Button grid", recenter: "Center sliders", recentre: "Center sliders",
    group: "Group", ref: "Copy", switchbank: "Switch bank",
  };
  const typeName = (e) => (Widgets && Widgets.get(e.type) && Widgets.get(e.type).label) || CONTROLS[e.type] || TYPE_NAMES[e.type] || e.type;

  // Resize limits in authored cells: the widget's, else by type.
  function limitsOf(e) {
    const t = target(e) || e;
    const def = Widgets && Widgets.get(t.type);
    const ok = (s) => Array.isArray(s) && s.length === 2;
    if (def && (ok(def.min) || ok(def.max))) return { min: ok(def.min) ? def.min : [1, 1], max: ok(def.max) ? def.max : [12, 8] };
    if (t.type === "button") return { min: [1, 1], max: [12, 4] };
    return { min: [1, 1], max: [12, 8] };
  }
  const spanNow = (e) => {
    const cls = sizeClass();
    if (e.type === "ref" && !e.span && !(e.size && e.size[cls])) { const t = target(e); if (t) return Grid.spanOf(t, cls); }
    return Grid.spanOf(e, cls);
  };

  // Which half's track lists a panel (or null for a full-screen-only panel).
  function sideOf(panelId) {
    const h = (layout.grid && layout.grid.halves) || {};
    if ((h.left || []).includes(panelId)) return "left";
    if ((h.right || []).includes(panelId)) return "right";
    return null;
  }
  const gridOf = (rid) => (deck && deck.gridOf ? deck.gridOf(rid) : null);
  // The regions drawn: the deck may show one panel when halves were asked for (a track is
  // empty, or a small screen stands upright).
  const regionsShown = () => {
    const mode = deck && deck.mode ? deck.mode() : preview.mode;
    return mode === "full" ? ["full"] : ["left", "right"];
  };
  function regionOf(panelId) {
    for (const rid of regionsShown()) { const g = gridOf(rid); if (g && g.panelId === panelId) return rid; }
    return null;
  }

  // The panel new things go on: the one last clicked or selected in, if it's showing.
  let focusPanel = null;
  function currentPanel() {
    if (focusPanel && layout.panels[focusPanel] && regionOf(focusPanel)) return focusPanel;
    for (const rid of regionsShown()) { const g = gridOf(rid); if (g) return g.panelId; }
    return Object.keys(layout.panels)[0] || null;
  }

  // Pages a region to the panel, switching to one panel when it only shows there.
  function showPanel(panelId) {
    if (!panelId || !layout.panels[panelId]) return;
    focusPanel = panelId;
    const side = sideOf(panelId);
    if (preview.mode === "halves" && (!side || layout.panels[panelId].wide)) { preview.mode = "full"; rebuild(); }
    if (!deck.showPanels) return;
    if (preview.mode === "full") deck.showPanels({ left: panelId }); else deck.showPanels({ [side]: panelId });
    drawGrid();
    renderProps();
    renderLibrary();
  }

  // ---------- grid layouts: the grid layer ----------

  let pinMode = false;   // drops pin to a cell instead of flowing into place
  let drag = null;       // the move, resize or library drag in progress
  let frame = 0;
  const later = (fn) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = 0; fn(); }); };

  // One layer per region shown: cells, a box per item, the selection and its resize handle.
  function drawGrid() {
    const canvas = $("canvas");
    for (const old of canvas.querySelectorAll(".ed-grid")) old.remove();
    drawChildSelection();
    if (!isGrid() || !deck || !deck.gridOf) return;
    const s = scale(), cr = canvas.getBoundingClientRect();
    for (const rid of regionsShown()) {
      const g = deck.gridOf(rid);
      if (!g) continue;
      const pitchX = g.cellW + g.gap, pitchY = g.cellH + g.gap;
      // The layer goes in the panel body when there is one, so it scrolls with it.
      const body = canvas.querySelector(`.hud-region[data-region="${rid}"] .hud-panel`);
      const layer = document.createElement("div");
      layer.className = "ed-grid";
      layer.dataset.region = rid;
      layer.dataset.panel = g.panelId;
      if (focusPanel === g.panelId || (!focusPanel && rid === regionsShown()[0])) layer.classList.add("focus");
      let left = g.x, top = g.y, bodyH = 0;
      if (body) {
        const br = body.getBoundingClientRect();
        left = g.x - (br.left - cr.left) / s;
        top = g.y - (br.top - cr.top) / s;
        bodyH = br.height / s;
      }
      // It covers the body (never the pager below it), or all the rows when they scroll.
      const contentH = Math.max(1, g.rows) * pitchY - g.gap;
      const layerH = Math.max(contentH, bodyH ? bodyH - top : contentH + pitchY);
      const shownRows = Math.max(1, Math.ceil((layerH + g.gap) / pitchY));
      // A half panel shown alone is centered, its grid a few columns in: the layer starts
      // at the body's edge, so every column has its cells, and the items move in by `lead`.
      const lead = body ? Math.max(0, Math.round(left / pitchX)) : 0;
      left -= lead * pitchX;
      layer.dataset.lead = String(lead);
      Object.assign(layer.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${g.cols * pitchX - g.gap}px`, height: `${layerH}px`,
      });
      layer.dataset.cell = `${g.cellW},${g.cellH},${g.gap}`;
      const cells = document.createElement("div");
      cells.className = "ed-cells";
      for (let r = 0; r < shownRows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const cell = document.createElement("i");
          place(cell, { col: c, row: r, w: 1, h: 1 }, pitchX, pitchY, g.gap);
          cells.append(cell);
        }
      }
      layer.append(cells);
      if (!g.items.length) {
        const hint = document.createElement("div");
        hint.className = "ed-empty";
        hint.textContent = "Empty panel. Click or drag something from Add on the left.";
        layer.append(hint);
      }
      for (const it of g.items) {
        const box = document.createElement("div");
        const e = locate(it.id) && locate(it.id).item;
        box.className = "ed-item";
        box.dataset.id = it.id;
        box.title = e ? `${itemName(e)} (${typeName(e)})` : it.id;
        if (it.id === selectedId || (drag && drag.kind === "move" && drag.id === it.id)) box.classList.add("sel");
        if (drag && drag.kind === "move" && drag.id === it.id && drag.started) box.classList.add("moving");
        if (e && e.type === "ref") box.classList.add("ref");
        place(box, { ...it, col: it.col + lead }, pitchX, pitchY, g.gap);
        if (it.pinned) box.insertAdjacentHTML("beforeend", `<span class="ed-pin" title="Pinned to this cell">${PIN}</span>`);
        if (e && e.type === "ref") box.insertAdjacentHTML("beforeend", `<span class="ed-tag" title="A copy: the same buttons as the original">copy</span>`);
        if (it.id === selectedId) {
          const h = document.createElement("i");
          h.className = "ed-rs";
          h.title = "Drag to resize by whole cells";
          h.addEventListener("pointerdown", (ev) => startGridResize(ev, it.id, rid));
          box.append(h);
          const size = document.createElement("span");
          size.className = "ed-size";
          size.textContent = `${it.w} × ${it.h}`;
          box.append(size);
        }
        box.addEventListener("pointerdown", (ev) => startGridMove(ev, it.id, rid));
        box.addEventListener("dblclick", () => { const t = e && e.type === "ref" && target(e); if (t) select(t.id); });
        layer.append(box);
      }
      layer.addEventListener("pointerdown", (ev) => {
        if (ev.target.closest(".ed-item")) return;
        focusPanel = g.panelId;
        select(null);
      });
      (body || canvas).append(layer);
    }
    drawDropHint();
  }
  function place(el, it, pitchX, pitchY, gap) {
    Object.assign(el.style, {
      left: `${it.col * pitchX}px`, top: `${it.row * pitchY}px`,
      width: `${it.w * pitchX - gap}px`, height: `${it.h * pitchY - gap}px`,
    });
  }
  const PIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/></svg>`;

  // A selected part of a group gets the 2.0 outline (the group's box stays the handle).
  function drawChildSelection() {
    const at = isGrid() && selectedId && locate(selectedId);
    let box = $("edSel");
    const el = at && at.group && elementOf.get(selectedId);
    if (!el || !el.isConnected) { if (box) box.remove(); return; }
    drawSelection();
  }

  // Where the pointer is on the grid: the region layer, its cell, and the item there.
  function hitTest(x, y) {
    for (const layer of $("canvas").querySelectorAll(".ed-grid")) {
      const r = layer.getBoundingClientRect();
      // A little outside the layer still counts, so the last column and row are easy to hit.
      if (x < r.left - 8 || x > r.right + 8 || y < r.top - 8 || y > r.bottom + 40) continue;
      const g = gridOf(layer.dataset.region);
      if (!g) continue;
      const s = scale();
      const lead = Number(layer.dataset.lead) || 0;
      const col = Math.max(0, Math.min(g.cols - 1, Math.floor(((x - r.left) / s + g.gap / 2) / (g.cellW + g.gap)) - lead));
      const row = Math.max(0, Math.floor(((y - r.top) / s + g.gap / 2) / (g.cellH + g.gap)));
      const over = g.items.find((it) => col >= it.col && col < it.col + it.w && row >= it.row && row < it.row + it.h);
      return { region: layer.dataset.region, panelId: g.panelId, col, row, overId: over ? over.id : null, g, lead };
    }
    return null;
  }

  // The rendered cell as an authored pin: columns scale back up when the screen has fewer.
  function authoredAt(g, col, row, w) {
    const ac = g.authoredCols || (layout.panels[g.panelId] && layout.panels[g.panelId].cols) || 6;
    let c = g.cols < ac ? Math.round((col * ac) / g.cols) : col;
    c = Math.max(0, Math.min(ac - Math.min(w, ac), c));
    return [c, row];
  }

  // Moves item `id` (a top-level item) to panel `panelId`, before `beforeId` (or last).
  function moveItem(id, panelId, beforeId) {
    const at = locate(id);
    const dest = layout.panels[panelId];
    if (!at || at.group || !dest) return false;
    if (beforeId === id) return false;
    const list = dest.elements || (dest.elements = []);
    const from = at.list.indexOf(at.item);
    let to = beforeId ? list.findIndex((e) => e && e.id === beforeId) : list.length;
    if (to < 0) to = list.length;
    if (at.list === list) {
      // Dropped on a later item: take its place, so moving forward and back both work.
      if (from === to || (!beforeId && from === list.length - 1)) return false;
      list.splice(from, 1);
      if (beforeId && to > from) to = list.findIndex((e) => e && e.id === beforeId) + 1;
      else if (!beforeId) to = list.length;
      list.splice(Math.min(to, list.length), 0, at.item);
    } else {
      at.list.splice(from, 1);
      list.splice(to, 0, at.item);
    }
    return true;
  }

  // Drags an item: flow mode reorders as the pointer goes (the rest reflows live), pin mode
  // (or Shift) shows the cell it will be pinned to. A click without a drag selects; on a
  // group, it selects the group's part under the pointer.
  function startGridMove(ev, id, rid) {
    if (ev.button > 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const at = locate(id);
    if (!at) return;
    const wasSelected = selectedId === id;
    focusPanel = at.panelId;
    drag = { kind: "move", id, region: rid, x: ev.clientX, y: ev.clientY, started: false, pin: false, before: JSON.stringify(layout), wasSelected };
    if (selectedId !== id) { selectedId = id; renderProps(); renderLibrary(); }
    drawGrid();
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  function onDragMove(ev) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 6) return;
      drag.started = true;
      document.body.classList.add("ed-dragging");
      ghost(drag.kind === "lib" ? drag.entry.name : itemName(locate(drag.id)?.item));
      if (drag.kind === "move") drawGrid();
    }
    moveGhost(ev.clientX, ev.clientY);
    const hit = hitTest(ev.clientX, ev.clientY);
    drag.pin = pinMode || ev.shiftKey;
    drag.hit = hit;
    if (drag.kind === "move" && !drag.pin && hit) {
      if (hit.overId !== drag.id) {
        // Live reflow: move it now and draw again; the drop only keeps it there.
        const changed = moveItem(drag.id, hit.panelId, hit.overId);
        if (changed) {
          const at = locate(drag.id);
          if (at) delete at.item.at;
          focusPanel = hit.panelId;
          later(rebuild);
          return;
        }
      }
    }
    drawDropHint();
  }

  function onDragEnd(ev) {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    const d = drag;
    drag = null;
    document.body.classList.remove("ed-dragging");
    $("edGhost")?.remove();
    if (!d) return;
    if (ev.type === "pointercancel" || d.cancel) {
      if (d.kind === "move" && d.started) restoreQuiet(d.before);
      drawGrid();
      return;
    }
    if (d.kind === "lib") { if (d.started) dropFromLibrary(d.entry, hitTest(ev.clientX, ev.clientY), ev.shiftKey || pinMode); else addFromLibrary(d.entry); return; }
    if (!d.started) {
      // A click: on a group already selected (or any group), pick the part under the pointer.
      const at = locate(d.id);
      if (at && at.item.type === "group") {
        const part = partUnder(ev.clientX, ev.clientY, at.item);
        if (part) { select(part); return; }
      }
      select(d.id);
      return;
    }
    const at = locate(d.id);
    const hit = hitTest(ev.clientX, ev.clientY) || d.hit;
    if (at && (d.pin || ev.shiftKey || pinMode) && hit) {
      if (hit.panelId !== at.panelId) moveItem(d.id, hit.panelId, null);
      const now = locate(d.id);
      const w = spanNow(now.item)[0];
      now.item.at = authoredAt(hit.g, hit.col, hit.row, w);
    } else if (at) delete at.item.at;
    if (JSON.stringify(layout) === d.before) { drawGrid(); return; }
    undoStack.push(d.before);
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    markDirty();
    rebuild();
    renderProps();
    renderLibrary();
  }

  // Puts the layout back without an undo step (a drag that was called off).
  function restoreQuiet(json) {
    const prev = JSON.parse(json);
    for (const k of Object.keys(layout)) delete layout[k];
    Object.assign(layout, prev);
    rebuild();
  }

  // The pin target while dragging in pin mode, and the drop line for library drags.
  function drawDropHint() {
    for (const old of $("canvas").querySelectorAll(".ed-drop")) old.remove();
    if (!drag || !drag.started || !drag.hit) return;
    const hit = drag.hit;
    const layer = $("canvas").querySelector(`.ed-grid[data-region="${hit.region}"]`);
    if (!layer) return;
    const g = hit.g;
    let w, h;
    if (drag.kind === "move") { const at = locate(drag.id); if (!at) return; const it = g.items.find((i) => i.id === drag.id); [w, h] = it ? [it.w, it.h] : spanNow(at.item); }
    else [w, h] = drag.entry.span || [2, 1];
    w = Math.min(w, g.cols);
    if (!drag.pin && drag.kind === "move") return; // flow: the live reflow shows it
    const box = document.createElement("div");
    box.className = drag.pin ? "ed-drop pin" : "ed-drop";
    if (drag.pin) {
      place(box, { col: Math.min(hit.col, g.cols - w) + hit.lead, row: hit.row, w, h }, g.cellW + g.gap, g.cellH + g.gap, g.gap);
    } else {
      // Library drop in flow mode: it goes before the item under the pointer, or at the end.
      const over = hit.overId && g.items.find((i) => i.id === hit.overId);
      const cell = over || { col: 0, row: g.rows, w: g.cols, h: 1 };
      place(box, { col: cell.col + hit.lead, row: cell.row, w: over ? 0.12 : cell.w, h: over ? cell.h : 1 }, g.cellW + g.gap, g.cellH + g.gap, 0);
      box.classList.add("line");
    }
    layer.append(box);
  }

  function ghost(text) {
    $("edGhost")?.remove();
    const g = document.createElement("div");
    g.id = "edGhost";
    g.textContent = text || "";
    document.body.append(g);
  }
  function moveGhost(x, y) {
    const g = $("edGhost");
    if (g) g.style.transform = `translate(${x + 14}px, ${y + 12}px)`;
  }

  // The part of a group under the pointer, found through the elements the renderer drew.
  function partUnder(x, y, group) {
    for (const el of document.elementsFromPoint(x, y)) {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const id = idOfEl.get(n);
        if (!id) continue;
        const at = locate(id);
        if (at && at.group === group) return id;
      }
    }
    return null;
  }

  // Resizes by whole cells; the panel reflows as it grows. Writes the span, or the size for
  // this screen only when that box is ticked.
  let sizeOnlyHere = false;
  function startGridResize(ev, id, rid) {
    ev.preventDefault();
    ev.stopPropagation();
    const g = gridOf(rid);
    const at = locate(id);
    const it = g && g.items.find((i) => i.id === id);
    if (!g || !at || !it) return;
    const s = scale();
    const ac = g.authoredCols || 6;
    const start = { x: ev.clientX, y: ev.clientY, w: it.w, h: it.h, before: JSON.stringify(layout), last: "" };
    drag = { kind: "resize", id };
    const lim = limitsOf(at.item);
    const move = (m) => {
      const dw = Math.round((m.clientX - start.x) / s / (g.cellW + g.gap));
      const dh = Math.round((m.clientY - start.y) / s / (g.cellH + g.gap));
      const w = Math.max(1, Math.min(g.cols, start.w + dw));
      const h = Math.max(1, start.h + dh);
      let aw = g.cols < ac ? Math.round((w * ac) / g.cols) : w;
      aw = Math.max(lim.min[0], Math.min(lim.max[0], ac, aw));
      const ah = Math.max(lim.min[1], Math.min(lim.max[1], h));
      const key = `${aw}x${ah}`;
      if (key === start.last) return;
      start.last = key;
      writeSpan(locate(id).item, [aw, ah]);
      later(rebuild);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag = null;
      if (JSON.stringify(layout) !== start.before) {
        undoStack.push(start.before);
        redoStack.length = 0;
        markDirty();
      }
      rebuild();
      renderProps();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
  function writeSpan(e, span) {
    if (sizeOnlyHere) { e.size = { ...(e.size || {}), [sizeClass()]: span }; }
    else {
      e.span = span;
      // A span set for every screen replaces a size for this one, or it would hide it.
      if (e.size) { delete e.size[sizeClass()]; if (!Object.keys(e.size).length) delete e.size; }
    }
  }

  // ---------- keys ----------

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "Escape" && drag && drag.kind !== "resize") { drag.cancel = true; onDragEnd(e); return; }
    if (ctrl && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
    if (typing) return;
    if (e.key === "Escape" && selectedId) { select(null); return; }
    const def = selected();
    if (!def) return;
    if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!dirs[e.key]) return;
    e.preventDefault();
    if (isGrid()) { nudgeOnGrid(def, dirs[e.key], e.shiftKey); return; }
    if (typeof def.x === "number") {
      const step = e.shiftKey ? 10 : 1;
      snapshot();
      def.x += dirs[e.key][0] * step;
      def.y += dirs[e.key][1] * step;
      redraw();
      renderProps();
    }
  });

  // Arrow keys on the grid: one place in the flow, or one cell when pinned (Pin mode or
  // Shift pins it where it is first).
  function nudgeOnGrid(e, [dx, dy], shift) {
    const at = locate(e.id);
    if (!at) return;
    if (!(pinMode || shift || Array.isArray(e.at)) || at.group) { shiftItem(dx + dy); return; }
    const rid = regionOf(at.panelId);
    const g = rid && gridOf(rid);
    const it = g && g.items.find((i) => i.id === e.id);
    const ac = (g && g.authoredCols) || at.panel.cols || 6;
    const w = spanNow(e)[0];
    const cur = Array.isArray(e.at) ? e.at : it ? authoredAt(g, it.col, it.row, w) : [0, 0];
    const next = [Math.max(0, Math.min(ac - Math.min(w, ac), cur[0] + dx)), Math.max(0, cur[1] + dy)];
    snapshot();
    e.at = next;
    rebuild();
    renderProps();
  }

  // ---------- add, duplicate, delete ----------

  // The panel shown in the first region, for "Add button" with nothing selected (2.0).
  function visibleElements() {
    const region = layout.regions && layout.regions[0];
    if (!region) return layout.chrome || [];
    return layout.panels[region.panels[deck.panelShown(region.id)]].elements;
  }

  // An F-key no button uses yet, so a new button doesn't clash.
  function freeKey() {
    const used = new Set();
    eachButton((b) => used.add(effectiveKeys(b)));
    for (let n = 13; n <= 24; n++) if (!used.has(`f${n}`)) return `f${n}`;
    return "f13";
  }

  function add() {
    if (isGrid()) { addFromLibrary(LIB_NEW.find((x) => x.key === "button")); return; }
    const near = selected() && find(selectedId)?.parent ? find(selectedId) : null;
    const target = near ? near.parent : visibleElements();
    const placed = !near || typeof near.button.x === "number";
    const b = { type: "button", id: newId(), label: "New button", keys: freeKey(), mode: "tap" };
    if (placed) {
      Object.assign(b, near ? { x: near.button.x + 12, y: near.button.y + 12, w: near.button.w, h: near.button.h } : { x: 20, y: 20, w: 140, h: 56 });
      if (near && near.button.when) b.when = near.button.when;
      if (near && near.button.style) b.style = near.button.style;
    }
    snapshot();
    target.splice(near ? target.indexOf(near.button) + 1 : target.length, 0, b);
    redraw();
    select(b.id);
    status("Added a button. Set its label and keys on the right.");
  }

  function duplicate() {
    const near = selected() && find(selectedId);
    if (!near) return;
    if (isGrid()) {
      const at = locate(selectedId);
      if (at && !isButton(at.item) && at.item.type !== "ref") {
        // A cluster or a group can't be copied (its buttons would share ids), but a copy of
        // it can sit anywhere: same buttons, same ids.
        const ref = { type: "ref", id: freshId(`${at.item.id}-copy`), ref: at.item.id, span: spanNow(at.item) };
        snapshot();
        at.list.splice(at.list.indexOf(at.item) + 1, 0, ref);
        rebuild();
        select(ref.id);
        status("Added a copy: it shows the same buttons, so a press on either is the same press.");
        return;
      }
      if (at && at.item.type === "ref") {
        const copy = { ...JSON.parse(JSON.stringify(at.item)), id: freshId(at.item.id) };
        delete copy.at;
        snapshot();
        at.list.splice(at.list.indexOf(at.item) + 1, 0, copy);
        rebuild();
        select(copy.id);
        return;
      }
    }
    if (near.control || !near.parent) { status("Controls and their parts can't be duplicated: their buttons would share ids.", true); return; }
    const copy = JSON.parse(JSON.stringify(near.button));
    copy.id = newId();
    copy.label = `${near.button.label} copy`;
    delete copy.voice; // the copy's phrases would clash with the original's
    delete copy.at;
    if (typeof copy.x === "number") { copy.x += 12; copy.y += 12; }
    snapshot();
    near.parent.splice(near.parent.indexOf(near.button) + 1, 0, copy);
    redraw();
    select(copy.id);
  }

  // The refs that show an item, wherever they are.
  function refsTo(id) {
    const out = [];
    for (const [panelId, panel] of Object.entries(layout.panels || {})) {
      (function walk(list) {
        for (const e of list || []) {
          if (!e) continue;
          if (e.type === "ref" && e.ref === id) out.push({ item: e, list, panelId });
          if (e.type === "group") walk(e.elements);
        }
      })(panel.elements);
    }
    return out;
  }
  // Ids of an item and everything inside it (a group's parts), for the refs check.
  function idsIn(e) {
    const ids = [];
    (function walk(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (typeof n.id === "string") ids.push(n.id);
      for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
    })(e);
    return ids;
  }

  function remove() {
    const near = selected() && find(selectedId);
    if (!near) return;
    if (!near.parent) { status("This button is part of a control; select the control to delete it.", true); return; }
    let extra = [];
    if (isGrid()) {
      // Deleting an original takes its copies with it (they'd show nothing).
      extra = idsIn(near.button).flatMap(refsTo).filter((r) => r.item !== near.button);
      if (extra.length && !confirm(`"${itemName(near.button)}" also shows on ${[...new Set(extra.map((r) => layout.panels[r.panelId].title || r.panelId))].join(", ")} as a copy. Delete those copies too?`)) return;
    }
    snapshot();
    near.parent.splice(near.parent.indexOf(near.button), 1);
    for (const r of extra) { const i = r.list.indexOf(r.item); if (i >= 0) r.list.splice(i, 1); }
    selectedId = null;
    redraw();
    renderProps();
    renderLibrary();
    status(`Deleted "${itemName(near.button) || near.button.label}". Undo brings it back.`);
  }

  // Grid and menu buttons have no position; they move within their list instead.
  function shiftItem(by) {
    const near = selected() && find(selectedId);
    if (!near || !near.parent) return;
    const i = near.parent.indexOf(near.button), j = i + Math.sign(by);
    if (j < 0 || j >= near.parent.length) return;
    snapshot();
    near.parent.splice(i, 1);
    near.parent.splice(j, 0, near.button);
    if (isGrid()) delete near.button.at;
    redraw();
    renderProps();
  }

  // ---------- grid layouts: the Add list ----------

  // Categories of the Add list, in the deck's order. A thing's category is its widget's,
  // else its id's prefix, else its panel's.
  const CATS = [
    ["flight", "Flight"], ["power", "Power"], ["landing", "Landing"], ["shields", "Shields"], ["targeting", "Targeting"],
    ["combat", "Combat"], ["quantum", "Quantum"], ["systems", "Systems"], ["mining", "Mining"], ["salvage", "Salvage"],
    ["crew", "Crew"], ["onfoot", "On foot"], ["comms", "Comms"], ["emotes", "Emotes"], ["layout", "Layout"],
  ];
  const PREFIX_CAT = {
    pl: "landing", pw: "power", fa: "flight", sh: "shields", tg: "targeting", sv: "salvage", mn: "mining", qt: "systems",
    op: "systems", cb: "combat", cr: "crew", ft: "onfoot", cm: "comms", em: "emotes", top: "systems",
  };
  const TYPE_CAT = { lever: "landing", level: "power", fader: "flight", rotary: "systems", recenter: "power", recentre: "power", slider: "systems", header: "layout", caption: "layout", "danger-zone": "layout" };
  const PANEL_CAT = {
    "power-landing": "power", "flight-assist": "flight", shields: "shields", targets: "targeting", salvage: "salvage", mining: "mining",
    "qt-systems": "systems", modes: "systems", combat: "combat", crew: "crew", "on-foot": "onfoot", comms: "comms", emotes: "emotes",
  };
  function categoryOf(e, panelId) {
    const def = Widgets && Widgets.get(e.type);
    if (def && def.category) return def.category;
    if (/quantum|engage/.test(e.id || "")) return "quantum";
    const pre = String(e.id || "").split("-")[0];
    if (PREFIX_CAT[pre]) return PREFIX_CAT[pre];
    if (TYPE_CAT[e.type]) return TYPE_CAT[e.type];
    return PANEL_CAT[panelId] || "systems";
  }
  const iconOf = (e) => {
    const def = Widgets && Widgets.get(e.type);
    return (def && def.icon) || e.icon || (e.button && e.button.icon) || { group: "grid", lever: "gear", level: "sliders", fader: "speed", rotary: "scm-nav", header: "page-next", ref: "link" }[e.type] || "default";
  };

  // New things, not copies: a button with a free key, a group, a header, Center sliders.
  const LIB_NEW = [
    { key: "button", name: "New button", cat: "layout", icon: "keypad", span: [2, 1], make: () => ({ type: "button", id: newId(), label: "New button", keys: freeKey(), mode: "tap", span: [2, 1] }) },
    { key: "group", name: "Group", cat: "layout", icon: "grid", span: [6, 2], make: () => ({ type: "group", id: freshId("my-group"), label: "Group", cols: 6, span: [6, 2], elements: [] }) },
    { key: "header", name: "Header", cat: "layout", icon: "page-next", span: [6, 1], make: () => ({ type: "header", id: freshId("my-header"), text: "Header", span: [6, 1] }) },
    { key: "recenter", name: "Center sliders", cat: "power", icon: "power-reset", span: [3, 1], make: () => ({ type: "recenter", id: freshId("my-recenter"), label: "Center sliders", span: [3, 1] }) },
  ];
  // Types not offered as copies: decoration and mode switches belong to their own panel.
  const NO_COPY = new Set(["ref", "header", "caption", "state-header", "switch", "danger-zone", "divider", "rule", "vlabel", "bracket"]);

  // Everything in the layout that can be shown again as a copy, by category.
  function libraryEntries() {
    const out = [];
    const seen = new Set();
    for (const [panelId, panel] of Object.entries(layout.panels || {})) {
      (function walk(list) {
        for (const e of list || []) {
          if (!e || typeof e !== "object" || typeof e.id !== "string") continue;
          if (e.type === "group") walk(e.elements);
          if (NO_COPY.has(e.type) || seen.has(e.id)) continue;
          seen.add(e.id);
          const cluster = !isButton(e);
          out.push({ key: `ref:${e.id}`, ref: e.id, name: itemName(e), sub: cluster ? typeName(e) : String(effectiveKeys(e) || ""), cat: categoryOf(e, panelId), icon: iconOf(e), cluster, span: spanNow(e), from: panel.title || panelId });
        }
      })(panel.elements);
    }
    return out;
  }

  // Where Add puts things: the selected group, else the panel in focus.
  function addTarget() {
    const at = selectedId && locate(selectedId);
    if (at && at.item.type === "group") return { panelId: at.panelId, list: at.item.elements || (at.item.elements = []), group: at.item };
    if (at && at.group) return { panelId: at.panelId, list: at.group.elements, group: at.group };
    const panelId = currentPanel();
    if (!panelId) return null;
    const p = layout.panels[panelId];
    return { panelId, list: p.elements || (p.elements = []), group: null };
  }
  // Is this already on that panel (itself or a copy)?
  function onPanel(refId, panelId) {
    const p = layout.panels[panelId];
    let found = false;
    (function walk(list) {
      for (const e of list || []) {
        if (!e) continue;
        if (e.id === refId || (e.type === "ref" && e.ref === refId)) found = true;
        if (e.type === "group") walk(e.elements);
      }
    })(p && p.elements);
    return found;
  }

  function entryItem(entry) {
    if (entry.make) return entry.make();
    return { type: "ref", id: freshId(`${entry.ref}-copy`), ref: entry.ref, span: (entry.span || [2, 1]).slice() };
  }

  function addFromLibrary(entry) {
    const t = addTarget();
    if (!t || !entry) return;
    if (entry.ref && onPanel(entry.ref, t.panelId)) { status(`"${entry.name}" is already on this panel.`, true); return; }
    const item = entryItem(entry);
    if (t.group && item.type === "group") { status("A group can't go inside a group.", true); return; }
    snapshot();
    t.list.push(item);
    rebuild();
    showPanel(t.panelId);
    select(item.id);
    status(item.type === "ref" ? `Added "${entry.name}". It flows into place; drag it to move it.` : `Added ${entry.name.toLowerCase()}. Set it up on the right.`);
  }

  function dropFromLibrary(entry, hit, pin) {
    if (!hit) { status("Drop it on a panel's grid."); drawGrid(); return; }
    if (entry.ref && onPanel(entry.ref, hit.panelId)) { status(`"${entry.name}" is already on this panel.`, true); drawGrid(); return; }
    const item = entryItem(entry);
    const list = layout.panels[hit.panelId].elements || (layout.panels[hit.panelId].elements = []);
    snapshot();
    if (pin) {
      item.at = authoredAt(hit.g, hit.col, hit.row, (item.span || [2, 1])[0]);
      list.push(item);
    } else {
      const i = hit.overId ? list.findIndex((e) => e && e.id === hit.overId) : -1;
      list.splice(i < 0 ? list.length : i, 0, item);
    }
    focusPanel = hit.panelId;
    rebuild();
    select(item.id);
  }

  let libTab = "add";
  const openCats = new Set(["layout"]); // categories opened in the Add list, kept across redraws
  let libQuery = "";
  function renderLibrary() {
    const lib = $("lib");
    if (!lib) return;
    lib.hidden = !isGrid();
    if (!isGrid()) return;
    const tabs = `<div class="ed-tabs" role="tablist">
      <button type="button" role="tab" data-tab="add" aria-selected="${libTab === "add"}">Add</button>
      <button type="button" role="tab" data-tab="panels" aria-selected="${libTab === "panels"}">Panels</button></div>`;
    lib.innerHTML = tabs;
    for (const b of lib.querySelectorAll("[data-tab]")) b.onclick = () => { libTab = b.dataset.tab; renderLibrary(); };
    if (libTab === "panels") { renderPanels(lib); return; }

    const t = addTarget();
    const where = make("div", { className: "ed-where" });
    where.textContent = t ? (t.group ? `Adds to the group "${groupTitle(t.group)}"` : `Adds to "${layout.panels[t.panelId].title || t.panelId}"`) : "No panel to add to";
    const q = make("input", { type: "search", placeholder: "Find a button or cluster", value: libQuery, className: "ed-find" });
    q.setAttribute("aria-label", "Find a button or cluster");
    q.addEventListener("input", () => { libQuery = q.value; fillEntries(); });
    const list = make("div", { className: "ed-lib" });
    lib.append(where, q, make("div", { className: "hint", textContent: "Click to add at the end, or drag onto a cell. Things already in the layout come in as copies: the same buttons, shown again." }), list);
    function fillEntries() {
      list.innerHTML = "";
      const words = libQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const match = (x) => words.every((w) => `${x.name} ${x.sub || ""} ${x.ref || ""} ${x.from || ""}`.toLowerCase().includes(w));
      const all = [...LIB_NEW, ...libraryEntries()].filter(match);
      for (const [cat, title] of CATS) {
        const here = all.filter((x) => x.cat === cat);
        if (!here.length) continue;
        // Clusters and controls first, then the new things, then buttons.
        here.sort((a, b) => (b.cluster ? 1 : 0) - (a.cluster ? 1 : 0) || (b.make ? 1 : 0) - (a.make ? 1 : 0));
        const sec = make("details", { className: "ed-cat", open: Boolean(words.length) || openCats.has(cat) });
        sec.addEventListener("toggle", () => { if (!words.length) { if (sec.open) openCats.add(cat); else openCats.delete(cat); } });
        sec.append(make("summary", { textContent: `${title} (${here.length})` }));
        for (const entry of here) sec.append(libButton(entry, t));
        list.append(sec);
      }
      if (!list.children.length) list.append(make("div", { className: "hint", textContent: "Nothing matches." }));
    }
    fillEntries();
  }

  function libButton(entry, t) {
    const b = make("button", { type: "button", className: `ed-entry${entry.cluster ? " cluster" : ""}${entry.make ? " new" : ""}` });
    b.innerHTML = `<span class="ico">${window.deckIcon(entry.icon || "default")}</span><span class="n"></span><span class="s"></span>`;
    b.querySelector(".n").textContent = entry.name;
    b.querySelector(".s").textContent = entry.make ? "new" : entry.cluster ? entry.sub : entry.sub ? `${entry.sub} · ${entry.from}` : entry.from;
    const here = entry.ref && t && onPanel(entry.ref, t.panelId);
    if (here) { b.disabled = true; b.title = "Already on this panel"; }
    else b.title = entry.make ? `Add a ${entry.name.toLowerCase()}` : `Show "${entry.name}" here too`;
    b.addEventListener("pointerdown", (ev) => {
      if (b.disabled || ev.button > 0) return;
      ev.preventDefault();
      drag = { kind: "lib", entry, x: ev.clientX, y: ev.clientY, started: false, pin: false };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
      window.addEventListener("pointercancel", onDragEnd);
    });
    // Keyboard: Enter or Space adds it.
    b.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (!b.disabled) addFromLibrary(entry); } });
    return b;
  }

  // ---------- grid layouts: panels and presets ----------

  const TRACKS = [["left", "Left half"], ["right", "Right half"], ["full", "One panel only"]];
  function trackOf(panelId) {
    const g = layout.grid;
    if ((g.halves?.left || []).includes(panelId)) return "left";
    if ((g.halves?.right || []).includes(panelId)) return "right";
    if ((g.full || []).includes(panelId)) return "full";
    return null;
  }
  function trackList(track) {
    const g = layout.grid;
    if (track === "full") return g.full || (g.full = []);
    g.halves = g.halves || {};
    return g.halves[track] || (g.halves[track] = []);
  }
  function setTrack(panelId, track, index) {
    for (const [t] of TRACKS) { const l = trackList(t); const i = l.indexOf(panelId); if (i >= 0) l.splice(i, 1); }
    if (!track) return;
    const l = trackList(track);
    l.splice(index === undefined ? l.length : index, 0, panelId);
    // A panel in a half is drawn in a half; one only for the single view is wide.
    const p = layout.panels[panelId];
    if (track !== "full" && p.wide) delete p.wide;
  }

  function renderPanels(lib) {
    const g = layout.grid;
    for (const [track, title] of TRACKS) {
      const sec = make("div", { className: "ed-track" });
      sec.append(make("h3", { textContent: title }));
      const ids = trackList(track).filter((id) => layout.panels[id]);
      if (!ids.length) sec.append(make("div", { className: "hint", textContent: track === "full" ? "Wide dashboards shown only in the one-panel view." : "No panels." }));
      for (const id of ids) sec.append(panelRow(id));
      lib.append(sec);
    }
    const loose = Object.keys(layout.panels).filter((id) => !trackOf(id));
    if (loose.length) {
      const sec = make("div", { className: "ed-track" });
      sec.append(make("h3", { textContent: "Not shown" }), make("div", { className: "hint", textContent: "In the layout but on no list. Pick one and choose where it shows." }));
      for (const id of loose) sec.append(panelRow(id));
      lib.append(sec);
    }
    const add = make("div", { className: "ed-track" });
    add.append(make("h3", { textContent: "New panel" }));
    const empty = make("button", { type: "button", textContent: "Empty panel" });
    empty.onclick = () => newPanel("Panel", [], focusPanel && trackOf(focusPanel) !== "full" ? trackOf(focusPanel) : "left");
    add.append(empty, make("div", { className: "hint", textContent: "From a preset: a wide dashboard of the clusters this layout has (any it lacks are left out)." }));
    const presets = make("div", { className: "ed-presets" });
    for (const p of PANEL_PRESETS) {
      const b = make("button", { type: "button", textContent: p.title, title: p.hint });
      b.onclick = () => newFromPreset(p);
      presets.append(b);
    }
    add.append(presets);
    lib.append(add);
    if (g.primary && !layout.panels[g.primary]) delete g.primary;
  }

  function panelRow(id) {
    const p = layout.panels[id];
    const row = make("button", { type: "button", className: "ed-prow" });
    row.innerHTML = `<span class="n"></span><span class="s"></span>`;
    row.querySelector(".n").textContent = `${layout.grid.primary === id ? "★ " : ""}${p.title || id}`;
    row.querySelector(".s").textContent = `${p.cols || 6} cols${p.wide ? " · wide" : ""} · ${(p.elements || []).length}`;
    if (regionOf(id)) row.classList.add("shown");
    if (focusPanel === id && !selectedId) row.classList.add("on");
    row.onclick = () => { selectedId = null; showPanel(id); };
    return row;
  }

  function freshPanelId(title) {
    const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "panel";
    const ids = allIds();
    if (!ids.has(base)) return base;
    let n = 2;
    while (ids.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  function newPanel(title, elements, track, opts = {}) {
    const id = freshPanelId(opts.id || title);
    snapshot();
    layout.panels[id] = { title, cols: opts.cols || 6, ...(opts.wide ? { wide: true } : {}), elements };
    setTrack(id, track);
    selectedId = null;
    if (track === "full" || opts.wide) preview.mode = "full";
    rebuild();
    showPanel(id);
    libTab = "panels";
    renderLibrary();
    status(`Added the panel "${title}".`);
    return id;
  }

  // Wide dashboards to start from. Each wants clusters by id (also matching ship layouts'
  // prefixed ids, like "pr-mn-cluster") or else by type; what the layout lacks is left out.
  const PANEL_PRESETS = [
    { title: "Pilot", hint: "Start-up, landing, modes, quantum, power and the flight assists", items: [
      { ids: ["pl-group"], span: [4, 3] }, { ids: ["qt-modes"], type: "rotary", span: [4, 5] }, { ids: ["qt-boot", "qt-bus"], span: [4, 1] },
      { ids: ["pw-group"], span: [4, 5] }, { ids: ["qt-quantum"], type: "quantum", span: [4, 3] }, { ids: ["fa-bank"], span: [4, 1] }, { ids: ["fa-range"], span: [12, 1] },
    ] },
    { title: "Gunner", hint: "Targeting and countermeasures side by side, shields, power and the turret seats", items: [
      { ids: ["sh-cluster"], type: "shields", span: [4, 5] }, { ids: ["tg-cluster"], type: "targeting", span: [4, 5] }, { ids: ["cb-cluster"], type: "countermeasures", span: [4, 5] },
      { ids: ["pw-group"], span: [6, 4] }, { ids: ["qt-modes"], type: "rotary", span: [6, 3] }, { ids: ["cr-turrets"], type: "turrets", span: [6, 1] },
    ] },
    { title: "Miner", hint: "The mining head, operator modes, power and shields", items: [
      { ids: ["mn-cluster"], type: "mining", span: [6, 6] }, { ids: ["qt-modes"], type: "rotary", span: [6, 4] },
      { ids: ["pw-group"], span: [6, 5] }, { ids: ["sh-cluster"], type: "shields", span: [6, 4] },
    ] },
    { title: "Salvager", hint: "The salvage head, operator modes, power, lights and doors", items: [
      { ids: ["sv-cluster"], type: "salvage", span: [6, 5] }, { ids: ["qt-modes"], type: "rotary", span: [6, 4] },
      { ids: ["pw-group"], span: [6, 5] }, { ids: ["cr-hull"], type: "hull", span: [6, 4] },
    ] },
    { title: "Hauler", hint: "Start-up and landing, quantum, lights and doors, modes and comms", items: [
      { ids: ["qt-boot", "qt-bus"], span: [4, 1] }, { ids: ["qt-quantum"], type: "quantum", span: [4, 3] }, { ids: ["cr-hull"], type: "hull", span: [4, 4] },
      { ids: ["pl-group"], span: [4, 3] }, { ids: ["qt-modes"], type: "rotary", span: [4, 4] }, { ids: ["cm-ptt"], span: [2, 2] }, { ids: ["cm-ptt-prox"], span: [2, 2] },
    ] },
  ];

  function newFromPreset(preset) {
    const index = Grid.index(layout);
    const used = new Set();
    const pick = (want) => {
      for (const id of want.ids || []) if (index.has(id) && !used.has(id)) return id;
      for (const id of want.ids || []) for (const k of index.keys()) if (k.endsWith(`-${id}`) && !used.has(k)) return k;
      if (want.type) for (const [k, e] of index) if (e.type === want.type && !used.has(k)) return k;
      return null;
    };
    const elements = [];
    const prefix = freshPanelId(preset.title);
    for (const want of preset.items) {
      const ref = pick(want);
      if (!ref) continue;
      used.add(ref);
      elements.push({ type: "ref", id: `${prefix}-${ref}`, ref, span: want.span.slice() });
    }
    if (!elements.length) { status(`This layout has none of the ${preset.title.toLowerCase()} clusters.`, true); return; }
    // The new ids must be free too (the prefix only makes them likely to be).
    const ids = allIds();
    for (const e of elements) if (ids.has(e.id)) e.id = freshId(e.id);
    newPanel(preset.title, elements, "full", { cols: 12, wide: true });
  }

  function deletePanel(id) {
    const p = layout.panels[id];
    if (!p) return;
    // Copies elsewhere would show nothing once the originals go.
    const inside = idsIn(p.elements);
    const outside = inside.flatMap(refsTo).filter((r) => r.panelId !== id);
    if (outside.length) {
      const where = [...new Set(outside.map((r) => layout.panels[r.panelId].title || r.panelId))].join(", ");
      if (!confirm(`Things on "${p.title || id}" also show on ${where}. Deleting the panel deletes those copies too. Go ahead?`)) return;
    } else if ((p.elements || []).length && !confirm(`Delete the panel "${p.title || id}" and everything on it?`)) return;
    snapshot();
    for (const r of outside) { const i = r.list.indexOf(r.item); if (i >= 0) r.list.splice(i, 1); }
    setTrack(id, null);
    delete layout.panels[id];
    if (layout.grid.primary === id) delete layout.grid.primary;
    focusPanel = null;
    rebuild();
    renderProps();
    renderLibrary();
    status(`Deleted the panel "${p.title || id}". Undo brings it back.`);
  }

  // ---------- grid layouts: the preview bar ----------

  function seg(name, options, current, pick) {
    const wrap = make("div", { className: "ed-seg", role: "group" });
    wrap.setAttribute("aria-label", name);
    wrap.append(make("span", { className: "l", textContent: name }));
    for (const [v, label, title] of options) {
      const b = make("button", { type: "button", textContent: label, title: title || "" });
      b.setAttribute("aria-pressed", String(v === current));
      b.onclick = () => pick(v);
      wrap.append(b);
    }
    return wrap;
  }

  function renderPreviewBar() {
    const bar = $("pbar");
    bar.innerHTML = "";
    if (!layout) return;
    if (!isGrid()) {
      const note = make("div", { className: "ed-convert" });
      note.append(make("span", { textContent: "This is a 2.0 layout: buttons sit at fixed spots for one screen shape." }));
      const b = make("button", { type: "button", className: "primary", textContent: "Convert to grid" });
      b.title = "Open a grid copy of this layout that fits every screen. The original stays as it is.";
      b.onclick = convert;
      note.append(b);
      bar.append(note);
      return;
    }
    const cls = sizeClass();
    bar.append(seg("Screen", [["small", "Small", "A phone, or a small tablet turned sideways"], ["large", "Large", "A tablet"], ["fit", "Fit window", "This window's size"]], preview.screen, (v) => { preview.screen = v; rebuild(); renderProps(); }));
    bar.append(seg("View", [["halves", "Two halves"], ["full", "One panel"]], preview.mode, (v) => { preview.mode = v; rebuild(); renderProps(); renderLibrary(); }));
    bar.append(seg(`Density (${cls === "small" ? "small" : "large"} screens)`, [["compact", "Compact"], ["default", "Default"], ["roomy", "Roomy"]], densityOf(cls), (v) => {
      snapshot();
      layout.grid.density = { ...(layout.grid.density || {}), [cls]: v };
      rebuild();
    }));
    // How a tablet set to icons only would show it (Deck settings' Button labels).
    bar.append(seg("Labels", [["show", "Shown", "Deck settings: icons and labels"], ["icons", "Icons only", "Deck settings: icons only; the layout's own Labels settings still win"]], store.get("labels") === "icons" ? "icons" : "show", (v) => {
      store.set("labels", v === "icons" ? "icons" : "");
      rebuild();
      renderPreviewBar();
    }));
    bar.append(make("span", { className: "ed-grow" }));
    bar.append(seg("Drop", [["flow", "Flow", "Things keep their order and fill the rows"], ["pin", "Pin", "Things stay on the cell you drop them on (or hold Shift)"]], pinMode ? "pin" : "flow", (v) => { pinMode = v === "pin"; renderPreviewBar(); }));
    const reflow = make("button", { type: "button", textContent: "Reflow panel", title: "Unpin everything on the panel in focus, so it all flows in order" });
    reflow.onclick = reflowPanel;
    bar.append(reflow);
  }

  function reflowPanel() {
    const id = currentPanel();
    const p = id && layout.panels[id];
    if (!p) return;
    const pinned = [];
    (function walk(list) { for (const e of list || []) { if (e && Array.isArray(e.at)) pinned.push(e); if (e && e.type === "group") walk(e.elements); } })(p.elements);
    if (!pinned.length) { status(`Nothing on "${p.title || id}" is pinned.`); return; }
    snapshot();
    for (const e of pinned) delete e.at;
    rebuild();
    renderProps();
    status(`Unpinned ${pinned.length} on "${p.title || id}"; everything flows in order.`);
  }

  // A 2.0 layout as a new grid layout: opened unsaved under a new name, the original untouched.
  function convert() {
    if (!Grid || !Grid.fromCanvas) { status("This version can't convert layouts.", true); return; }
    if (dirty && !confirm("Converting opens a new, unsaved copy. Discard your unsaved changes to this one?")) return;
    const base = (file || "layout").replace(/^layouts\//, "").replace(/\.json$/, "").replace(/^my-/, "");
    let next;
    try { next = Grid.fromCanvas(cleaned()); } catch (err) { status(`Couldn't convert it: ${err.message || err}`, true); return; }
    delete next.custom;
    file = "";
    $("layoutSelect").value = "";
    begin(next, freeName(`${base}-grid`));
    $("useIt").checked = false;
    status("Converted. This is a new layout, not saved yet; the 2.0 one stays as it was. Check it on both screen sizes, then Save.");
  }

  // ---------- properties panel ----------

  function field(label, control, hint) {
    const wrap = document.createElement("div");
    const l = document.createElement("label");
    l.className = "f";
    l.textContent = label;
    wrap.append(l, control);
    if (hint) { const h = document.createElement("div"); h.className = "hint"; h.textContent = hint; wrap.append(h); }
    return wrap;
  }
  function make(tag, props = {}) { return Object.assign(document.createElement(tag), props); }

  // A text field: one undo step per edit, live preview while typing.
  function textInput(value, apply) {
    const input = make("input", { value: value ?? "" });
    let snapped = false;
    input.addEventListener("focus", () => { snapped = false; });
    input.addEventListener("input", () => {
      if (!snapped) { snapshot(); snapped = true; }
      apply(input.value);
      redrawSoon();
    });
    return input;
  }
  // Typing redraws once the typing pauses on grid layouts (a redraw there is a new deck).
  let typingTimer = 0;
  function redrawSoon() {
    if (!isGrid()) { redraw(); return; }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(rebuild, 250);
  }
  function change(apply, rerenderProps = true) {
    return (e) => { snapshot(); apply(e.target); redraw(); if (rerenderProps) renderProps(); renderLibrary(); };
  }

  // Labels on the deck: Inherit, Show or Hide (icon only). Kept as "labels" on a panel, an
  // item (a cluster, control, group or copy) or a button; on the deck the most specific
  // one wins over the next one out, and the deck's own Button labels setting is the last.
  const LABEL_HINTS = {
    panel: "Inherit follows Button labels in each tablet's Deck settings. Clusters and buttons can set their own.",
    item: "Inherit follows the group it's in, else the panel. Its buttons can set their own.",
    button: "Inherit follows its cluster or group, else the panel. A button without an icon always shows its label; hidden, it still has its name for screen readers and voice.",
  };
  function labelsField(obj, kind) {
    const sel = make("select");
    for (const [v, t] of [["", "Inherit"], ["show", "Show"], ["hide", "Hide (icons only)"]]) sel.append(make("option", { value: v, textContent: t, selected: (obj.labels || "") === v }));
    sel.addEventListener("change", change(() => { if (sel.value) obj.labels = sel.value; else delete obj.labels; }));
    return field("Labels", sel, LABEL_HINTS[kind]);
  }

  function renderProps() {
    const side = $("props");
    side.innerHTML = "";
    const b = selected();
    $("dupBtn").disabled = $("delBtn").disabled = !b;
    $("addBtn").hidden = isGrid();
    if (!b) {
      if (isGrid()) { renderPanelProps(side); return; }
      side.innerHTML = `<div class="help"><h2>Edit the layout</h2>
        <p>Click a button to select it, then drag it to move it, or drag the yellow corner to resize it. Arrow keys nudge it (hold Shift for bigger steps).</p>
        <p>The arrows under each half flip through panels, and mode switches (like Landing / Docking) work, so you can reach every button.</p>
        <p>Buttons in automatic grids and menus keep their place in the grid; move them with "Earlier" and "Later".</p>
        <p>Cockpit controls (the gear lever, the level sliders, the speed fader and the mode dial) move and resize the same way; their buttons are listed when you select one.</p>
        <p>Saving makes your own copy of the layout. The built-in layouts never change.</p></div>`;
      return;
    }
    const at = isGrid() ? locate(b.id) : null;
    if (at && !isButton(at.item)) { renderItemProps(side, at); return; }
    if (isControl(b)) { renderControlProps(side, b); return; }
    side.append(make("h2", { textContent: b.label || "(no label)" }), make("div", { className: "id", textContent: `id: ${b.id}` }));
    const owner = ownerOf(b);
    if (owner) {
      const back = make("button", { type: "button", textContent: `◀ Part of ${typeName(owner).toLowerCase()} "${itemName(owner)}"` });
      back.addEventListener("click", () => select(owner.id));
      side.append(back);
    }
    if (at && at.group) side.append(backToGroup(at.group));

    side.append(field("Label", textInput(b.label, (v) => { b.label = v; side.querySelector("h2").textContent = v || "(no label)"; })));
    side.append(field("Short label (optional)", textInput(b.short || "", (v) => { if (v) b.short = v; else delete b.short; }),
      "Shown on the button instead of its label; the label stays its name for voice and screen readers."));
    side.append(labelsField(b, "button"));

    // Keys: follows the Star Citizen keybind for its action, or its own keys.
    const following = Boolean(b.scAction);
    const keysBox = make("div");
    if (b.scAction || b._scAction) {
      const action = b.scAction || b._scAction;
      const follow = make("label", { className: "check" });
      const cb = make("input", { type: "checkbox", checked: following });
      cb.addEventListener("change", change(() => {
        if (cb.checked) { b.scAction = b._scAction; delete b._scAction; }
        else { b._scAction = b.scAction; delete b.scAction; b.keys = effectiveKeys({ ...b, scAction: b._scAction }); }
      }));
      follow.append(cb, make("span", { textContent: "Follow game keybind" }));
      keysBox.append(follow);
      keysBox.append(make("div", { className: "hint", textContent: following
        ? `Uses your Star Citizen keybind for "${action}". To change its key, rebind it in the game, or untick this to set your own.`
        : `Uses its own keys below instead of your Star Citizen keybind for "${action}".` }));
    }
    const chips = make("div", { className: `chips${following ? " locked" : ""}` });
    const keys = String(effectiveKeys(b)).split("+").filter(Boolean);
    keys.forEach((k, i) => {
      const chip = make("span", { textContent: k });
      if (!following) {
        const x = make("button", { type: "button", textContent: "×", title: "Remove this key" });
        x.addEventListener("click", change(() => { b.keys = keys.filter((_, j) => j !== i).join("+") || "f13"; }));
        chip.append(x);
      }
      chips.append(chip);
    });
    keysBox.append(chips);
    if (!following) {
      const pick = make("select");
      pick.append(make("option", { value: "", textContent: "Add a key…" }));
      for (const k of info.keys) pick.append(make("option", { value: k, textContent: k }));
      pick.addEventListener("change", change(() => {
        if (!pick.value) return;
        // Modifiers go first, the main key last, as Star Citizen writes them.
        const mods = ["lalt", "ralt", "lctrl", "rctrl", "lshift", "rshift"];
        const next = [...keys.filter((k) => k !== pick.value), pick.value];
        next.sort((a, c) => (mods.includes(c) ? 1 : 0) - (mods.includes(a) ? 1 : 0));
        b.keys = next.join("+");
      }));
      keysBox.append(pick);
    }
    const sameKeys = [];
    eachButton((o) => { if (o !== b && effectiveKeys(o) === effectiveKeys(b)) sameKeys.push(o.label); });
    if (sameKeys.length) keysBox.append(make("div", { className: "warn", textContent: `Same keys as: ${[...new Set(sameKeys)].join(", ")}` }));
    side.append(field("Keys", keysBox));

    // Mode.
    const mode = make("select");
    for (const [v, t] of Object.entries(MODES)) mode.append(make("option", { value: v, textContent: t, selected: (b.mode || "tap") === v }));
    mode.addEventListener("change", change(() => { b.mode = mode.value; if (b.mode === "timed" && !b.ms) b.ms = 1500; }));
    side.append(field("How it presses", mode));
    if (b.mode === "timed") {
      const ms = make("input", { type: "number", min: 100, max: 10000, step: 100, value: b.ms || 1500 });
      ms.addEventListener("change", change(() => { b.ms = Math.max(100, Math.min(10000, Number(ms.value) || 1500)); }));
      side.append(field("Hold time (milliseconds)", ms));
    }

    // Look.
    const color = make("select");
    for (const c of COLORS) color.append(make("option", { value: c, textContent: c || "Theme color", selected: (b.color || "") === c }));
    color.addEventListener("change", change(() => { if (color.value) b.color = color.value; else delete b.color; }));
    side.append(field("Color", color));

    const iconBox = make("div");
    const current = make("div", { className: "icon-pick" });
    current.innerHTML = b.icon ? window.deckIcon(b.icon) : "";
    const toggle = make("button", { type: "button", textContent: b.icon ? `${b.icon} (change)` : "Pick an icon" });
    current.append(toggle);
    const gridEl = make("div", { className: "icon-grid", hidden: true });
    const none = make("button", { type: "button", textContent: "None", title: "No icon" });
    none.addEventListener("click", change(() => { delete b.icon; }));
    gridEl.append(none);
    for (const name of Object.keys(window.DECK_ICONS).filter((n) => n !== "default")) {
      const ib = make("button", { type: "button", title: name, className: b.icon === name ? "on" : "" });
      ib.innerHTML = window.deckIcon(name);
      ib.addEventListener("click", change(() => { b.icon = name; }));
      gridEl.append(ib);
    }
    toggle.addEventListener("click", () => { gridEl.hidden = !gridEl.hidden; });
    iconBox.append(current, gridEl);
    side.append(field("Icon", iconBox));

    const anim = make("select");
    for (const a of ANIMS) anim.append(make("option", { value: a, textContent: a || "Automatic", selected: (b.anim || "") === a }));
    anim.addEventListener("change", change(() => { if (anim.value) b.anim = anim.value; else delete b.anim; }));
    const tryIt = make("button", { type: "button", textContent: "Try it" });
    tryIt.addEventListener("click", () => {
      const fx = fxOf.get(b.id), el = elementOf.get(b.id);
      if (!fx || !el) return;
      const r = el.getBoundingClientRect();
      fx.down({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      setTimeout(() => fx.up(), b.mode === "timed" ? Math.min(b.ms || 1500, 3000) : 250);
    });
    const animRow = make("div", { className: "row" });
    animRow.append(anim, tryIt);
    side.append(field("Press animation", animRow));

    // Voice.
    const voiceOn = make("label", { className: "check" });
    const vcb = make("input", { type: "checkbox", checked: b.voice !== false });
    vcb.addEventListener("change", change(() => { if (vcb.checked) delete b.voice; else b.voice = false; }));
    voiceOn.append(vcb, make("span", { textContent: "Responds to voice commands" }));
    const voiceBox = make("div");
    voiceBox.append(voiceOn);
    if (b.voice !== false) {
      const phrases = make("textarea", { value: (Array.isArray(b.voice) ? b.voice : []).join("\n"), placeholder: "One phrase per line, e.g. gear up" });
      let snapped = false;
      phrases.addEventListener("focus", () => { snapped = false; });
      phrases.addEventListener("input", () => {
        if (!snapped) { snapshot(); snapped = true; }
        const list = phrases.value.split("\n").map((p) => p.trim()).filter(Boolean);
        if (list.length) b.voice = list; else delete b.voice;
      });
      phrases.addEventListener("change", renderProps);
      voiceBox.append(phrases, make("div", { className: "hint", textContent: `Its label ("${spoken(b.label)}") always works too.` }));
      const clashes = [];
      const mine = phrasesOf(b), myKeys = effectiveKeys(b);
      eachButton((o) => {
        if (o === b || effectiveKeys(o) === myKeys) return;
        for (const p of phrasesOf(o)) if (mine.includes(p)) clashes.push(`"${p}" (${o.label})`);
      });
      if (clashes.length) voiceBox.append(make("div", { className: "warn", textContent: `Also used by other buttons, so voice ignores: ${clashes.join(", ")}` }));
    }
    side.append(field("Voice", voiceBox));

    // Position.
    if (owner) {
      // Placed by its control.
    } else if (at) {
      gridProps(side, at);
    } else if (typeof b.x === "number") {
      const row = make("div", { className: "row" });
      for (const k of ["x", "y", "w", "h"]) {
        const n = make("input", { type: "number", value: b[k], title: { x: "Left", y: "Top", w: "Width", h: "Height" }[k] });
        n.addEventListener("change", change(() => { b[k] = Math.max(k === "w" || k === "h" ? 24 : -2000, Math.round(Number(n.value) || 0)); }));
        row.append(n);
      }
      side.append(field("Left, top, width, height", row, "In layout pixels. You can also drag in the preview."));
    } else {
      side.append(field("Place in its list", orderRow()));
    }
  }

  function orderRow() {
    const row = make("div", { className: "row" });
    const earlier = make("button", { type: "button", textContent: "◀ Earlier" });
    const laterB = make("button", { type: "button", textContent: "Later ▶" });
    earlier.addEventListener("click", () => shiftItem(-1));
    laterB.addEventListener("click", () => shiftItem(1));
    row.append(earlier, laterB);
    return row;
  }
  function backToGroup(group) {
    const back = make("button", { type: "button", textContent: `◀ In the group "${groupTitle(group)}"` });
    back.addEventListener("click", () => select(group.id));
    return back;
  }

  // The item a button sits inside (a control, a cluster, a switch bank), if any.
  function ownerOf(b) {
    let owner = null;
    eachControl((c) => { if (!owner && partsOf(c).some(([, p]) => p === b)) owner = c; });
    if (owner || !isGrid()) return owner;
    for (const panel of Object.values(layout.panels || {})) {
      (function walk(list) {
        for (const e of list || []) {
          if (owner || !e || typeof e !== "object" || e === b) continue;
          if (e.type === "group") { walk(e.elements); continue; }
          if (isButton(e)) continue;
          if (idsIn(e).includes(b.id) && e.id !== b.id) owner = e;
        }
      })(panel.elements);
      if (owner) break;
    }
    return owner;
  }

  // Size and place on the grid, for any top-level item or a group's part.
  function gridProps(side, at) {
    const e = at.item;
    const cls = sizeClass();
    const ac = (at.group ? at.group.cols : at.panel.cols) || 6;
    const lim = limitsOf(e);
    const own = e.size && Array.isArray(e.size[cls]);
    const span = spanNow(e);
    const sec = make("div", { className: "ed-gridprops" });
    sec.append(make("h3", { textContent: "On the grid" }));
    const row = make("div", { className: "row" });
    const mk = (i, label) => {
      const n = make("input", { type: "number", min: lim.min[i], max: i === 0 ? Math.min(lim.max[0], ac) : lim.max[1], value: span[i], title: label });
      n.setAttribute("aria-label", label);
      n.addEventListener("change", change(() => {
        const next = span.slice();
        next[i] = Math.max(lim.min[i], Math.min(i === 0 ? Math.min(lim.max[0], ac) : lim.max[1], Math.round(Number(n.value) || span[i])));
        const was = sizeOnlyHere;
        sizeOnlyHere = only.checked;
        writeSpan(e, next);
        sizeOnlyHere = was;
      }));
      return n;
    };
    row.append(mk(0, "Width in cells"), make("span", { className: "x", textContent: "×" }), mk(1, "Height in cells"));
    sec.append(field(`Size in cells (of ${ac} across)`, row, `Drag the corner on the preview to resize. Min ${lim.min[0]} × ${lim.min[1]}, max ${Math.min(lim.max[0], ac)} × ${lim.max[1]}.`));
    const onlyBox = make("label", { className: "check" });
    const only = make("input", { type: "checkbox", checked: sizeOnlyHere || own });
    only.addEventListener("change", () => {
      sizeOnlyHere = only.checked;
      if (!only.checked && own) { snapshot(); delete e.size[cls]; if (!Object.keys(e.size).length) delete e.size; rebuild(); renderProps(); }
    });
    onlyBox.append(only, make("span", { textContent: `This size on ${cls} screens only` }));
    sec.append(onlyBox);
    if (own) sec.append(make("div", { className: "hint", textContent: `Has its own size on ${cls} screens. Untick to use its size for every screen.` }));
    // Shown on one size class only (a dashboard keeps its essentials on a phone).
    const other = cls === "small" ? "large" : "small";
    const alsoBox = make("label", { className: "check" });
    const also = make("input", { type: "checkbox", checked: e.only !== cls });
    also.addEventListener("change", change(() => { if (also.checked) delete e.only; else e.only = cls; }));
    alsoBox.append(also, make("span", { textContent: `Show on ${other} screens too` }));
    sec.append(alsoBox);
    if (e.only === cls) sec.append(make("div", { className: "hint", textContent: `Hidden on ${other} screens; the rest flows into its place there. The panel's settings on a ${other} screen can bring it back.` }));

    if (Array.isArray(e.at)) {
      const pinRow = make("div", { className: "row" });
      pinRow.append(make("span", { textContent: `Pinned at column ${e.at[0] + 1}, row ${e.at[1] + 1}` }));
      const unpin = make("button", { type: "button", textContent: "Unpin" });
      unpin.onclick = change(() => { delete e.at; });
      pinRow.append(unpin);
      sec.append(field("Place", pinRow, "Pinned things keep their cell; the rest flow around them. Arrow keys move it one cell."));
    } else {
      const r = orderRow();
      if (!at.group) {
        const rid = regionOf(at.panelId);
        const g = rid && gridOf(rid);
        const it = g && g.items.find((i) => i.id === e.id);
        if (it) {
          const pin = make("button", { type: "button", textContent: "Pin here", title: "Keep it on the cell it's on now" });
          pin.onclick = change(() => { e.at = authoredAt(g, it.col, it.row, span[0]); });
          r.append(pin);
        }
      }
      sec.append(field("Place", r, "It flows in order with the rest. Drag it to reorder, or hold Shift while dropping to pin it to a cell."));
    }
    // Shown only in one mode, like 2.0 ("when").
    if (Array.isArray(e.when)) sec.append(make("div", { className: "hint", textContent: `Shows only while ${e.when[0]} is ${e.when[1]}; hidden, the rest reflows into its place.` }));
    side.append(sec);
  }

  // A grid item that isn't a plain button: a copy, a group, a widget or a 2.0 control.
  function renderItemProps(side, at) {
    const e = at.item;
    side.append(make("h2", { textContent: itemName(e) }), make("div", { className: "id", textContent: `${typeName(e)} · id: ${e.id}` }));
    if (at.group) side.append(backToGroup(at.group));
    if (e.type === "ref") {
      const t = target(e);
      const where = t && locate(t.id);
      side.append(make("div", { className: "hint", textContent: t
        ? `A copy of "${itemName(t)}" from "${where ? where.panel.title || where.panelId : "?"}": the same buttons, so a press here is the same press. Its own size and place are set here.`
        : `Shows "${e.ref}", which isn't in the layout any more. Delete this copy.` }));
      if (t) {
        const open = make("button", { type: "button", textContent: "Edit the original" });
        open.onclick = () => { if (where) showPanel(where.panelId); select(t.id); };
        side.append(open);
      }
      side.append(labelsField(e, "item"));
      gridProps(side, at);
      return;
    }
    if (e.type === "group") {
      // The deck draws only `title` above a group; `label` is its name in the editor's lists.
      side.append(field("Name", textInput(e.label || "", (v) => { if (v) e.label = v; else delete e.label; side.querySelector("h2").textContent = groupTitle(e); })));
      side.append(field("Title on the deck (empty for none)", textInput(e.title || "", (v) => { if (v) e.title = v; else delete e.title; side.querySelector("h2").textContent = groupTitle(e); })));
      const style = make("select");
      for (const [v, t] of [["", "Plain frame"], ["danger", "Danger (hazard stripes)"]]) style.append(make("option", { value: v, textContent: t, selected: (e.style || "") === v }));
      style.addEventListener("change", change(() => { if (style.value) e.style = style.value; else delete e.style; }));
      side.append(field("Look", style));
      const list = make("div", { className: "parts" });
      for (const c of e.elements || []) {
        const b = make("button", { type: "button", textContent: `${itemName(c)} (${typeName(c).toLowerCase()}, ${spanNow(c).join(" × ")})` });
        b.onclick = () => select(c.id);
        list.append(b);
      }
      if (!(e.elements || []).length) list.append(make("div", { className: "hint", textContent: "Empty. With the group selected, things from Add go into it." }));
      side.append(field("Inside it", list, "Click a part on the preview, or here, to edit it. While the group is selected, Add puts things in it."));
      side.append(labelsField(e, "item"));
      gridProps(side, at);
      return;
    }
    const def = Widgets && Widgets.get(e.type);
    if (isControl(e) && !def) { renderControlProps(side, e); side.append(labelsField(e, "item")); gridProps(side, at); return; }
    if (def && def.hint) side.append(make("div", { className: "hint", textContent: def.hint }));
    if ("label" in e || "title" in e || "text" in e) {
      const k = "label" in e ? "label" : "title" in e ? "title" : "text";
      side.append(field(k === "text" ? "Text" : "Label", textInput(e[k], (v) => { e[k] = v; side.querySelector("h2").textContent = v || typeName(e); })));
    }
    const parts = partsOf(e);
    if (parts.length) {
      const list = make("div", { className: "parts" });
      for (const [part, b] of parts) {
        const open = make("button", { type: "button", textContent: `${part}: ${b.label} (${effectiveKeys(b)})` });
        open.addEventListener("click", () => select(b.id));
        list.append(open);
      }
      side.append(field("Its buttons", list, "Open one to change its label, keys, color or voice phrases."));
    }
    side.append(labelsField(e, "item"));
    gridProps(side, at);
  }

  // A control: its label, size and steps, and its buttons, each opened to edit like any button.
  function renderControlProps(side, c) {
    if (!isGrid()) side.append(make("h2", { textContent: c.label || CONTROLS[c.type] }), make("div", { className: "id", textContent: `${CONTROLS[c.type]} · id: ${c.id}` }));
    side.append(make("div", { className: "hint", textContent: {
      lever: "Pulling the knob down or pushing it up taps its button once. Its lamps follow the button's state.",
      level: "Each step of the slider taps Step up or Step down once, at most 5 per drag. It shows the steps sent, not the game.",
      fader: "Each step of the fader taps Step up or Step down once, at most 5 per drag. It shows the steps sent, not the game.",
      rotary: "Turning the dial to a mode, or tapping the mode, taps that mode's button once. The center is its own button.",
    }[c.type] }));
    side.append(field("Label", textInput(c.label, (v) => { c.label = v; side.querySelector("h2").textContent = v || CONTROLS[c.type]; })));
    if (c.type === "level" || c.type === "fader") {
      const steps = make("input", { type: "number", min: 1, max: 10, value: c.steps || 5 });
      steps.addEventListener("change", change(() => { c.steps = Math.max(1, Math.min(10, Math.round(Number(steps.value) || 5))); }));
      side.append(field("Steps each way from the center", steps));
      const color = make("select");
      for (const k of COLORS) color.append(make("option", { value: k, textContent: k || "Theme color", selected: (c.color || "") === k }));
      color.addEventListener("change", change(() => { if (color.value) c.color = color.value; else delete c.color; }));
      side.append(field("Color", color));
    }
    const list = make("div", { className: "parts" });
    for (const [part, b] of partsOf(c)) {
      const open = make("button", { type: "button", textContent: `${part}: ${b.label} (${effectiveKeys(b)})` });
      open.addEventListener("click", () => select(b.id));
      list.append(open);
    }
    side.append(field("Its buttons", list, "Open one to change its label, keys or voice phrases."));
    if (isGrid()) return;
    const row = make("div", { className: "row" });
    for (const k of ["x", "y", "w", "h"]) {
      const n = make("input", { type: "number", value: c[k], title: { x: "Left", y: "Top", w: "Width", h: "Height" }[k] });
      n.addEventListener("change", change(() => { c[k] = Math.max(k === "w" || k === "h" ? 44 : -2000, Math.round(Number(n.value) || 0)); }));
      row.append(n);
    }
    side.append(field("Left, top, width, height", row, "In layout pixels. You can also drag it, or drag the yellow corner, in the preview."));
  }

  // Nothing selected on a grid layout: the panel in focus, then how the editor works.
  function renderPanelProps(side) {
    const id = currentPanel();
    const p = id && layout.panels[id];
    if (p) {
      side.append(make("h2", { textContent: p.title || id }), make("div", { className: "id", textContent: `Panel · id: ${id}` }));
      side.append(field("Title", textInput(p.title, (v) => { p.title = v; side.querySelector("h2").textContent = v || id; renderLibraryLater(); })));
      side.append(labelsField(p, "panel"));
      const track = make("select");
      for (const [t, title] of TRACKS) track.append(make("option", { value: t, textContent: title, selected: trackOf(id) === t }));
      if (!trackOf(id)) track.prepend(make("option", { value: "", textContent: "Not shown", selected: true }));
      track.addEventListener("change", () => {
        if (!track.value) return;
        snapshot();
        setTrack(id, track.value);
        if (track.value === "full") preview.mode = "full";
        rebuild();
        showPanel(id);
      });
      side.append(field("Shows in", track, "Halves show in the two-halves view and, in order, in the one-panel view too. One-panel-only panels are for wide dashboards."));
      const order = make("div", { className: "row" });
      const up = make("button", { type: "button", textContent: "◀ Earlier" });
      const down = make("button", { type: "button", textContent: "Later ▶" });
      const shiftPanel = (by) => {
        const t = trackOf(id);
        if (!t) return;
        const l = trackList(t), i = l.indexOf(id), j = i + by;
        if (j < 0 || j >= l.length) return;
        snapshot();
        l.splice(i, 1);
        l.splice(j, 0, id);
        rebuild();
        renderProps();
        renderLibrary();
      };
      up.onclick = () => shiftPanel(-1);
      down.onclick = () => shiftPanel(1);
      order.append(up, down);
      side.append(field("Order in its list", order));
      const cols = make("select");
      for (const n of [6, 12]) cols.append(make("option", { value: n, textContent: n === 6 ? "6 (a half)" : "12 (wide)", selected: (p.cols || 6) === n }));
      cols.addEventListener("change", change(() => { p.cols = Number(cols.value); }));
      side.append(field("Columns it's made on", cols, "Spans count in these columns. On a screen with fewer, everything shrinks to match; with more, more fits on a row."));
      const wideBox = make("label", { className: "check" });
      const wide = make("input", { type: "checkbox", checked: Boolean(p.wide) });
      wide.addEventListener("change", change(() => { if (wide.checked) p.wide = true; else delete p.wide; if (wide.checked) preview.mode = "full"; }));
      wideBox.append(wide, make("span", { textContent: "Wide: only in the one-panel view" }));
      side.append(wideBox);
      // Things this panel shows only on the other size class, which the preview leaves out.
      const cls = sizeClass();
      const hidden = (p.elements || []).filter((e) => e && (e.only === "small" || e.only === "large") && e.only !== cls);
      if (hidden.length) {
        const list = make("div", { className: "ed-hidden" });
        for (const e of hidden) {
          const r = make("div", { className: "row" });
          const show = make("button", { type: "button", textContent: "Show here too" });
          show.onclick = change(() => { delete e.only; });
          r.append(make("span", { textContent: itemName(e) }), show);
          list.append(r);
        }
        side.append(field(`Hidden on ${cls} screens`, list, `Shown only on ${cls === "small" ? "large" : "small"} screens.`));
      }
      // The panel a two-finger swipe (or a deck gesture) can jump to.
      const primBox = make("label", { className: "check" });
      const prim = make("input", { type: "checkbox", checked: layout.grid.primary === id });
      prim.addEventListener("change", change(() => { if (prim.checked) layout.grid.primary = id; else delete layout.grid.primary; }));
      primBox.append(prim, make("span", { textContent: "Primary panel" }));
      side.append(primBox, make("div", { className: "hint", textContent: "The panel a deck gesture set to \"Go to the primary panel\" jumps to (Deck settings on each tablet or phone)." }));
      const row = make("div", { className: "row ed-gap" });
      const reflow = make("button", { type: "button", textContent: "Reflow panel" });
      reflow.onclick = reflowPanel;
      const del = make("button", { type: "button", className: "danger", textContent: "Delete panel" });
      del.onclick = () => deletePanel(id);
      row.append(reflow, del);
      side.append(row);
    }
    const help = make("div", { className: "help" });
    help.innerHTML = `<h3>How it works</h3>
      <p>Each panel is a grid. Things flow in order and fill the rows; on a screen with fewer columns they shrink and wrap, so they always stay lined up.</p>
      <p>Click something to select it. Drag it to reorder (the rest moves out of the way), or hold Shift (or pick Pin) to pin it to a cell. Drag its corner to resize it by whole cells.</p>
      <p>Add (on the left) puts new buttons, groups and headers on the panel in focus, and shows clusters and buttons already in the layout again as copies.</p>
      <p>Check both screen sizes and both views at the top. Saving makes your own copy; the built-in layouts never change.</p>`;
    side.append(help);
    const starts = info.layouts.filter((l) => !l.custom && l.grid && !l.hidden && l.file !== file);
    if (starts.length) {
      const box = make("div", { className: "parts" });
      for (const l of starts) {
        const b = make("button", { type: "button", textContent: l.name });
        b.onclick = () => { $("layoutSelect").value = l.file; open(l.file); };
        box.append(b);
      }
      side.append(field("Start from a layout", box, "Opens a built-in layout to change and save as your own."));
    }
  }
  let libTimer = 0;
  const renderLibraryLater = () => { clearTimeout(libTimer); libTimer = setTimeout(renderLibrary, 300); };

  // ---------- loading and saving ----------

  const isGridInfo = (l) => Boolean(l.grid);
  const kindOf = (l) => (Grid && Grid.isGrid(l) ? "any" : l.canvas && l.canvas[1] < 500 ? "small" : "large");
  const useText = (l) => ({ any: "Use on tablets and phones", small: "Use on small screens", large: "Use on large screens" }[kindOf(l)]);

  function fillLayoutList(current) {
    const select = $("layoutSelect");
    select.innerHTML = "";
    for (const l of info.layouts) {
      // Hidden copies (kept so saved choices keep working) aren't worth opening.
      if (l.hidden && !l.custom && l.file !== current) continue;
      const where = l.active ? (isGridInfo(l) ? "in use" : `in use on ${l.active === "phone" ? "small" : "large"} screens`) : "";
      const tags = [l.custom ? "yours" : "built-in", isGridInfo(l) || !l.canvas ? "" : "2.0", where].filter(Boolean).join(", ");
      const o = make("option", { value: l.file, textContent: `${l.name} (${tags})`, selected: l.file === current });
      if (!editable(l)) { o.disabled = true; o.textContent += " - can't be edited here yet"; }
      select.append(o);
    }
  }

  function loadInfo() {
    return fetch(api("layouts")).then((r) => r.json().then((data) => (r.ok ? data : Promise.reject(data.error))));
  }

  // Shows a layout that was just opened, imported or converted.
  function begin(data, saveName) {
    layout = data;
    undoStack.length = redoStack.length = 0;
    dirty = false;
    markDirty();
    dirty = false;
    selectedId = null;
    focusPanel = null;
    $("saveName").value = saveName;
    $("useLabel").textContent = useText(layout);
    document.body.classList.toggle("grid-layout", isGrid());
    $("lib").hidden = !isGrid(); // before the first draw, which fits the pane
    document.title = `${layout.name || saveName} - SpoolUp layout editor`;
    $("canvas").innerHTML = "";
    if (isGrid()) {
      preview.mode = (layout.grid.start && layout.grid.start[sizeClass()]) || (sizeClass() === "small" ? "full" : "halves");
      renderPreviewBar();
      deck = null;
      rebuild();
    } else {
      delete D.preview;
      renderPreviewBar();
      fitStage();
      deck = window.renderCanvas(layout, D);
    }
    renderProps();
    renderLibrary();
  }

  function open(nextFile) {
    if (dirty && !confirm("Discard your unsaved changes?")) { $("layoutSelect").value = file; return; }
    fetch(api(`layout?file=${encodeURIComponent(nextFile)}`))
      .then((r) => r.json().then((data) => (r.ok ? data : Promise.reject(data.error))))
      .then((data) => {
        if (!Array.isArray(data.canvas) && !(Grid && Grid.isGrid(data))) return Promise.reject("it isn't a HUD-style or grid layout, so the editor can't show it");
        file = nextFile;
        const base = file.replace(/^layouts\//, "").replace(/\.json$/, "");
        dirty = false;
        begin(data, data.custom ? base : `my-${base}`);
        $("useIt").checked = true;
      })
      .catch((err) => status(`Couldn't open the layout: ${err}`, true));
  }

  // The layout as saved: "_scAction" only remembers an unticked "Follow game keybind"
  // while editing, and scancodes come from the keys.
  const cleaned = () => JSON.parse(JSON.stringify(layout, (k, v) => (k.startsWith("_") || k === "scancodes" ? undefined : v)));

  function exportLayout() {
    if (!layout) return;
    const clean = cleaned();
    delete clean.custom;
    delete clean.hidden;
    // The note on generated layouts is about this repository, not the shared file.
    if (/^Generated by tools\//.test(clean.notes || "")) delete clean.notes;
    const name = ($("saveName").value.trim().toLowerCase() || "layout").replace(/^my-/, "");
    const a = make("a", { href: URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2) + "\n"], { type: "application/json" })), download: `${name}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status(`Exported as ${name}.json. Send that file to share the layout.`);
  }

  // A free name for an imported layout: the file's own, with -2, -3... if it's taken.
  function freeName(base) {
    const taken = new Set(info.layouts.map((l) => l.file.replace(/^layouts\//, "").replace(/\.json$/, "")));
    base = String(base).toLowerCase().replace(/\.json$/, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "imported";
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    return name;
  }

  function importLayout(picked) {
    if (!picked) return;
    if (dirty && !confirm("Discard your unsaved changes?")) return;
    if (picked.size > 4e6) { status("That file is too big to be a layout.", true); return; }
    picked.text().then((text) => {
      let data;
      try { data = JSON.parse(text); } catch { status("That file isn't a layout (it isn't JSON).", true); return; }
      const ok = data && typeof data === "object" && data.panels && (Array.isArray(data.canvas) || (Grid && Grid.isGrid(data)));
      if (!ok) {
        status("That file isn't a layout this editor can open (it needs a HUD-style or grid layout).", true);
        return;
      }
      delete data.custom;
      delete data.hidden;
      file = "";
      $("layoutSelect").value = ""; // not one of the saved layouts yet
      begin(data, freeName(picked.name));
      $("useIt").checked = false;
      // An imported layout presses whatever keys it says; look before saving.
      status(`Opened ${picked.name}, not saved yet. Check its buttons and keys, then Save to add it to your layouts.`);
    }).catch((err) => status(`Couldn't read that file: ${err}`, true));
  }

  function save() {
    if (!layout) return;
    const name = $("saveName").value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) { status("Use letters, numbers and dashes for the name.", true); $("saveName").focus(); return; }
    const clean = cleaned();
    delete clean.hidden;
    clean.name = layout.custom || !layout.name ? layout.name : `${layout.name} (mine)`;
    fetch(api("save"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, layout: clean, use: $("useIt").checked }) })
      .then((r) => r.json().then((data) => (r.ok ? data : Promise.reject(data.error))))
      .then((data) => {
        dirty = false;
        layout.custom = true;
        layout.name = clean.name;
        const who = { any: "Tablets and phones", small: "Small screens", large: "Large screens" }[kindOf(layout)];
        status(data.active ? `Saved as ${data.file}. ${who} now use it and reload by themselves.` : `Saved as ${data.file}.`);
        return loadInfo().then((i) => { info = i; file = data.file; fillLayoutList(file); });
      })
      .catch((err) => status(`Not saved: ${err}`, true));
  }

  $("layoutSelect").addEventListener("change", (e) => open(e.target.value));
  $("addBtn").onclick = add;
  $("dupBtn").onclick = duplicate;
  $("delBtn").onclick = remove;
  $("undoBtn").onclick = undo;
  $("redoBtn").onclick = redo;
  $("saveBtn").onclick = save;
  $("exportBtn").onclick = exportLayout;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").addEventListener("change", (e) => { importLayout(e.target.files[0]); e.target.value = ""; });

  // The list says which layouts are grid layouts (an older server doesn't; open() checks).
  const editable = (l) => Boolean(l.canvas || l.grid || !("grid" in l));
  loadInfo()
    .then((data) => {
      info = data;
      const wanted = new URLSearchParams(location.search).get("file");
      const start = (wanted && info.layouts.find((l) => l.file === wanted && editable(l)))
        || info.layouts.find((l) => l.active && editable(l) && !l.hidden) || info.layouts.find((l) => editable(l) && !l.hidden);
      if (!start) { status("No layouts to edit.", true); return; }
      fillLayoutList(start.file);
      open(start.file);
    })
    .catch((err) => {
      $("props").innerHTML = `<div class="help"><h2>Can't open the editor</h2><p></p></div>`;
      $("props").querySelector("p").textContent = String(err || "The PC didn't answer.");
    });
})();
