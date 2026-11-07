// Renders "canvas" layouts: a fixed-size HUD (e.g. 1024x768) scaled to fit the screen,
// with regions that page through panels. Element coordinates are canvas pixels;
// panel elements are relative to their region.
//
// It also renders grid layouts (layout.grid, SpoolUp 2.1): there the canvas is the screen
// itself, at 1:1, and every panel is packed on a grid of cells (grid.js) that follows the
// screen's size class, its density and the halves or one-panel view. Each placed cell
// becomes an ordinary box, so the 2.0 controls below and the widgets registered with
// DeckWidgets draw in it unchanged.
(() => {
  const NS = "deck-canvas";
  // Shown text goes through the deck's language (i18n.js); English when it isn't loaded.
  const tr = (s, ...a) => (window.DeckI18n ? window.DeckI18n.t(s, ...a) : s);

  let current = null; // the deck drawn last; a new one replaces it (switching layouts)

  window.renderCanvas = function renderCanvas(layout, D) {
    if (current) current.dispose();
    const DG = window.DeckGrid, DW = window.DeckWidgets;
    const GRID = Boolean(DG && DG.isGrid(layout));
    // A grid layout's canvas is the stage (or the editor's preview), measured below.
    let [W, H] = GRID ? [1024, 768] : layout.canvas;
    const stage = document.getElementById("stage");
    const canvas = document.getElementById("canvas");
    stage.hidden = false;
    canvas.classList.toggle("grid-mode", GRID);
    // Small canvases (phone layouts) get tighter menus; wide ones ask phones to turn sideways.
    // Grid layouts fit any shape, so they never ask.
    if (!GRID) canvas.classList.toggle("compact", H < 500);
    stage.classList.toggle("landscape-only", !GRID && W > H * 1.5);
    stage.querySelector(".hud-rotate")?.remove(); // its text follows the language
    stage.insertAdjacentHTML("beforeend", `<div class="hud-rotate"><span class="hud-ico">${D.deckIcon("swap")}</span>${tr("Turn your phone sideways")}</div>`);

    // Separate stores per canvas size, so phone and tablet keep their own page positions;
    // grid layouts keep one per size class ("deck-grid-small", "deck-grid-large"), which
    // starts from the 2.0 store of the same screen's sliders, dials and switches. The old
    // stores are only read, never removed.
    let cls = "large"; // the grid's size class
    let key = GRID ? "" : `${NS}-${W}x${H}`;
    const readKey = (k) => { try { return JSON.parse(D.store.get(k) || "null"); } catch { return null; } };
    let state = null;
    function loadState() {
      let saved = readKey(key) || {};
      if (GRID) {
        key = `deck-grid-${cls}`;
        saved = readKey(key);
        if (!saved || typeof saved !== "object") {
          const old = readKey(`${NS}-${cls === "small" ? "734x372" : "1024x768"}`) || {};
          saved = { levels: old.levels, dials: old.dials, groups: old.groups };
        }
      }
      const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
      state = {
        groups: obj(saved.groups), panels: obj(saved.panels), levels: obj(saved.levels), split: saved.split || 0,
        dials: obj(saved.dials), widgets: obj(saved.widgets),
      };
      if (GRID && (saved.mode === "halves" || saved.mode === "full")) state.mode = saved.mode;
    }
    if (!GRID) loadState();
    // Drawn controls that follow other buttons' presses (a slider's Max and Min), by button
    // id, and the ones Center sliders puts back; both refilled at every redraw.
    const followers = new Map();
    let recentered = [];
    // The layout editor's preview shows other screens; it never saves their state.
    const save = () => { if (!(GRID && D.preview)) D.store.set(key, JSON.stringify(state)); };

    // Fill the whole stage (which CSS keeps inside the safe area, clear of the iPhone's
    // Dynamic Island and home indicator). Text and icons scale uniformly by `s`; when the
    // screen's shape differs from the layout's, element boxes stretch along the longer
    // axis by kx/ky so there are no empty bands.
    let s = 1, kx = 1, ky = 1;
    let rkx = 1; // extra horizontal stretch of the half being drawn (Edit layout's seam)
    const scaleNow = () => s;
    function measure() {
      if (GRID) return measureGrid();
      const aw = stage.clientWidth || W, ah = stage.clientHeight || H;
      s = Math.min(aw / W, ah / H);
      const nkx = aw / s / W, nky = ah / s / H;
      const changed = Math.abs(nkx - kx) > 0.002 || Math.abs(nky - ky) > 0.002;
      kx = nkx; ky = nky;
      canvas.style.width = `${W * kx}px`;
      canvas.style.height = `${H * ky}px`;
      canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
      return changed;
    }
    // A grid layout draws at the stage's own size, so nothing is scaled or stretched; the
    // editor's preview (D.preview) draws another screen's size, shrunk to fit its pane.
    // ?viewport=small|large (D.viewport) or the preview can force the size class.
    function measureGrid() {
      const pv = D.preview || null;
      const aw = stage.clientWidth || 1024, ah = stage.clientHeight || 768;
      const vp = pv && Array.isArray(pv.viewport) ? pv.viewport : null;
      const vw = Math.round(vp ? vp[0] : aw), vh = Math.round(vp ? vp[1] : ah);
      const forced = (pv && pv.sizeClass) || (D.viewport === "small" || D.viewport === "large" ? D.viewport : null);
      const next = forced || DG.sizeClass(vw, vh);
      const ns = vp ? Math.min(1, aw / vw, ah / vh) : 1;
      const changed = vw !== W || vh !== H || next !== cls || ns !== s || !state;
      W = vw; H = vh; s = ns;
      if (next !== cls || !state) { cls = next; loadState(); }
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
      canvas.classList.toggle("compact", cls === "small");
      canvas.dataset.size = cls;
      return changed;
    }
    const fit = () => { if (measure()) render(); };
    const turned = () => setTimeout(fit, 250);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", turned);
    measure();

    // Layout coordinates are in design pixels; place them on the stretched canvas.
    const box = (el, e) => {
      el.style.left = `${e.x * kx * rkx}px`;
      el.style.top = `${e.y * ky}px`;
      if (e.w !== undefined) el.style.width = `${e.w * kx * rkx}px`;
      if (e.h !== undefined) el.style.height = `${e.h * ky}px`;
      return el;
    };
    const make = (tag, cls, html) => {
      const el = document.createElement(tag);
      el.className = cls;
      if (html !== undefined) el.innerHTML = html;
      return el;
    };
    const text = (el, sel, value) => { el.querySelector(sel).textContent = tr(value); return el; };
    // Each switch group starts on the first value its switch lists.
    const groupDefaults = {};
    (function scan(node) {
      if (Array.isArray(node)) { node.forEach(scan); return; }
      if (!node || typeof node !== "object") return;
      if (node.type === "switch" && !(node.group in groupDefaults)) groupDefaults[node.group] = node.values[0];
      for (const v of Object.values(node)) if (v && typeof v === "object") scan(v);
    })(layout);
    const groupValue = (g, values) => state.groups[g] || groupDefaults[g] || (values && values[0]);

    // ---------- element renderers ----------

    // A button's keys as its key label shows them ("lalt+np_1" is LALT+NUM1); CSS adds the
    // capitals. Only shown with Key labels on (Deck settings).
    const KEY_NAMES = {
      escape: "esc", backspace: "bksp", capslock: "caps", numlock: "numlk", scrolllock: "scrlk", print: "prtsc",
      insert: "ins", delete: "del", minus: "-", equals: "=", lbracket: "[", rbracket: "]", semicolon: ";",
      apostrophe: "'", grave: "`", backslash: "\\", comma: ",", period: ".", slash: "/",
      np_add: "num+", np_subtract: "num−", np_multiply: "num*", np_divide: "num/", np_period: "num.", np_enter: "num enter",
      up: "↑", down: "↓", left: "←", right: "→",
    };
    const keyText = (keys) => String(keys).split("+")
      .map((k) => KEY_NAMES[k] || k.replace(/^(?:np_|num)(\d)$/, "num$1")).join("+");

    // Button labels: Deck settings' default (labels, or icons only), then a panel's, a
    // group's or cluster's (a copy's own first), then the button's own "labels" ("show" or
    // "hide"): the most specific one wins. renderItem and the regions set labelsNow while
    // they draw. A hidden label stays the button's accessible name, title and voice phrase,
    // and a button without an icon always keeps its label, so none is ever blank.
    const deckLabels = () => (D.store && D.store.get && D.store.get("labels") === "icons" ? "hide" : "show");
    const pickLabels = (v, outer) => (v === "show" || v === "hide" ? v : outer);
    let labelsNow = "show";
    const withLabels = (mode, fn) => { const was = labelsNow; labelsNow = mode; try { return fn(); } finally { labelsNow = was; } };

    function hudButton(def, style) {
      const el = make("button", `hud-btn s-${style || def.style || "std"}`);
      el.type = "button";
      el.dataset.color = def.color || "";
      const icon = def.icon ? `<span class="hud-ico">${D.deckIcon(def.icon)}</span>` : "";
      const s = style || def.style || "std";
      if (s === "top" || s === "chev") {
        el.innerHTML = icon || `<span class="hud-lbl"></span>`;
        if (!def.icon) text(el, ".hud-lbl", def.label);
      } else if (s === "dial") {
        el.innerHTML = `<span class="hud-lbl"></span><span class="dial"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><path d="M20 4a16 16 0 0 1 16 16"/></svg></span>`;
        text(el, ".hud-lbl", def.label);
      } else {
        // "short" is a shorter word for the button's face; its name stays the full label.
        el.innerHTML = `${icon}<span class="hud-lbl"></span>`;
        text(el, ".hud-lbl", def.short || def.label);
      }
      // The top bar's icon buttons are too small for one.
      if (def.keys && s !== "top") {
        const key = make("span", "hud-key");
        key.setAttribute("aria-hidden", "true"); // the title and aria-label already say it
        key.textContent = keyText(def.keys);
        el.appendChild(key);
      }
      el.setAttribute("aria-label", tr(def.label));
      el.title = `${tr(def.label)} — ${def.keys}`;
      if (def.icon && s !== "top" && s !== "chev" && pickLabels(def.labels, labelsNow) === "hide") el.classList.add("lbl-off");
      D.bindButton(el, def);
      return el;
    }

    const R = {
      button: (e) => box(hudButton(e), e),

      action(e) {
        // icon "emblem" shows the current manufacturer emblem (updated when the theme changes).
        const ico = e.icon === "emblem"
          ? `<span class="hud-ico hud-emblem js-emblem">${D.emblemHtml()}</span>`
          : `<span class="hud-ico">${D.deckIcon(e.icon)}</span>`;
        const el = box(make("button", "hud-btn s-top", ico), e);
        el.type = "button";
        el.onclick = e.action === "theme" ? D.openPicker : D.toggleFullscreen;
        el.setAttribute("aria-label", tr(e.action === "theme" ? "Deck settings" : "Fullscreen"));
        return el;
      },

      // Hold-to-talk mic for voice commands; hidden when they're turned off on the PC.
      // An optional "label" shows next to the mic.
      talk(e) {
        const el = box(make("button", "hud-btn s-top js-talk", `<span class="hud-ico">${D.deckIcon("mic")}</span>${e.label ? `<span class="hud-lbl"></span>` : ""}`), e);
        if (e.label) text(el, ".hud-lbl", e.label);
        el.type = "button";
        el.setAttribute("aria-label", tr("Hold to talk"));
        D.bindTalk(el);
        return el;
      },

      // Opens the list of voice commands; hidden with the mic when voice is off on the PC.
      voicehelp(e) {
        const el = box(make("button", "hud-btn s-top js-voice", `<span class="hud-ico">${D.deckIcon("help")}</span>`), e);
        el.type = "button";
        el.setAttribute("aria-label", tr("Voice commands list"));
        el.onclick = D.openVoiceHelp;
        return el;
      },

      status: (e) => box(make("div", "hud-status", `<span class="js-dot dot"></span><span class="js-status">Connecting…</span>`), e),

      rule: (e) => box(make("div", "hud-rule", "<i></i><i></i>"), e),
      divider: (e) => box(make("div", "hud-divider"), seamAt(e)),

      header: (e) => text(box(make("div", "hud-header", `<b>//</b><span></span>`), e), "span", e.text),

      "state-header"(e) {
        const values = Object.keys(e.labels);
        const cur = groupValue(e.group, values);
        const el = box(make("div", "hud-header state", `<div><b>//</b><span class="a"></span> <em>_ :${tr("ENABLED")}</em></div><div class="b"></div>`), e);
        text(el, ".a", e.labels[cur]);
        text(el, ".b", values.filter((v) => v !== cur).map((v) => e.labels[v]).join(" · "));
        // Narrow (a dashboard on a phone): the mode's name alone, without "_ :ENABLED".
        el.classList.toggle("tight", e.w * kx * rkx < 230);
        return el;
      },

      switch(e) {
        const el = box(make("button", "hud-btn s-switch", `<span class="hud-lbl"></span>`), e);
        el.type = "button";
        text(el, ".hud-lbl", e.label);
        el.onclick = () => {
          window.DeckSound?.play("page");
          const cur = groupValue(e.group, e.values);
          state.groups[e.group] = e.values[(e.values.indexOf(cur) + 1) % e.values.length];
          save();
          render();
        };
        return el;
      },

      vlabel: (e) => text(box(make("div", "hud-vlabel", "<span></span>"), e), "span", e.text),

      caption(e) {
        const el = box(make("div", "hud-caption", `<span class="hud-ico">${D.deckIcon(e.icon)}</span><span class="t"></span>`), e);
        el.dataset.color = e.color || "";
        return text(el, ".t", e.text);
      },

      bracket: (e) => box(make("div", "hud-bracket",
        `<svg viewBox="0 0 380 24" preserveAspectRatio="none"><path d="M2 2v8h120l10 10h116l10-10h120V2"/><path d="m184 12 6 6 6-6Z" class="f"/></svg>`), e),

      "danger-zone": (e) => box(make("div", "hud-danger"), e),

      slider(e) {
        const el = box(make("div", "hud-slider", `<div class="track"><span class="txt"></span></div><div class="knob"></div>`), e);
        text(el, ".txt", e.label);
        const knob = el.querySelector(".knob");
        el.dataset.drag = "x";
        const max = e.w * kx * rkx - 26;
        let start = null, pos = 0;
        const setPos = (p) => { pos = Math.max(0, Math.min(max, p)); knob.style.transform = `translateX(${pos}px)`; el.style.setProperty("--fill", `${(pos / max) * 100}%`); };
        knob.addEventListener("pointerdown", (ev) => {
          if (swipingNow()) return;
          knob.setPointerCapture(ev.pointerId);
          start = ev.clientX - pos * scaleNow();
          el.classList.add("dragging");
        });
        knob.addEventListener("pointermove", (ev) => { if (start !== null) setPos((ev.clientX - start) / scaleNow()); });
        const end = () => {
          if (start === null) return;
          start = null;
          el.classList.remove("dragging");
          if (pos >= max * 0.94) {
            D.send({ t: "tap", id: e.id });
            D.buzz(40);
            window.DeckSound?.play("eject");
            window.DeckFX.pulse(el, "eject");
            el.classList.add("fired");
            setTimeout(() => el.classList.remove("fired"), 600);
          }
          knob.style.transition = "transform .25s ease";
          setPos(0);
          setTimeout(() => (knob.style.transition = ""), 260);
        };
        knob.addEventListener("pointerup", end);
        knob.addEventListener("pointercancel", end);
        return el;
      },

      menu(e) {
        const el = box(make("button", "hud-btn s-std s-menu", `<span class="hud-lbl"></span><span class="caret">▾</span>`), e);
        el.type = "button";
        text(el, ".hud-lbl", e.label);
        el.onclick = () => openMenu(e);
        return el;
      },

      // Landing-gear lever: pull the knob down to deploy, push it up to retract. A pull or
      // push past halfway is one tap of its button (the gear key); the knob then travels and
      // the three lamps show red until the PC's state for the gear says it's there (green
      // down, dark up). The lamps follow Button lights; the knob always shows the state.
      lever(e) {
        const b = e.button;
        const el = box(make("div", "hud-lever",
          `<div class="lv-slot"><i class="lv-end up"></i><i class="lv-end down"></i><div class="lv-knob"><span class="hud-ico">${D.deckIcon(e.icon || b.icon || "gear")}</span></div></div>
           <div class="lv-lamps" aria-hidden="true"><i></i><i></i><i></i></div>
           <div class="lv-lbl"><span class="t"></span><span class="lv-state"></span></div>`), e);
        el.dataset.color = b.color || "";
        el.dataset.drag = "y";
        // A short box (a phone) gets a smaller knob and lamps, so its label stays inside.
        el.classList.toggle("short", e.h * ky < 150);
        text(el, ".t", e.label || b.label);
        text(el, ".lv-state", "RETRACTED");
        if (b.keys) {
          const key = make("span", "hud-key");
          key.setAttribute("aria-hidden", "true");
          key.textContent = keyText(b.keys);
          el.appendChild(key);
        }
        if (D.placeControl) { D.placeControl(el, e); return el; }
        lever(el, b);
        return el;
      },

      // Level slider (the power triangle's Weapons, Thrusters, Shields): each step up or down
      // taps its Step up or Step down button once. It shows the steps SpoolUp sent from the
      // center, not the game's value, which SpoolUp can't read; Center sliders sets it back
      // without pressing anything, and the buttons in "follows" (Max, Min, Reset All) move
      // it to the end or the center when they're pressed.
      level(e) {
        const el = box(make("div", "hud-level",
          `<div class="lvl-read" aria-hidden="true"></div>
           <div class="lvl-track"><i class="lvl-zero"></i><i class="lvl-fill"></i><div class="lvl-knob"></div></div>
           <div class="lvl-cap"><span class="hud-ico">${e.icon ? D.deckIcon(e.icon) : ""}</span><span class="t"></span></div>`), e);
        el.dataset.color = e.color || "";
        el.dataset.drag = "y";
        text(el, ".t", e.label);
        ticks(el.querySelector(".lvl-track"), e.steps || 5, "y");
        if (D.placeControl) { D.placeControl(el, e); showLevel(el, e, 0); return el; }
        stepper(el, e, "y");
        return el;
      },

      // Speed-range fader: the same as a level slider, lying down; each step is one tap of
      // Speed Range + or −.
      fader(e) {
        const el = box(make("div", "hud-fader",
          `<div class="fd-head"><span class="hud-ico">${e.icon ? D.deckIcon(e.icon) : ""}</span><span class="t"></span><span class="lvl-read" aria-hidden="true"></span></div>
           <div class="fd-row"><span class="fd-end" aria-hidden="true">−</span>
           <div class="lvl-track"><i class="lvl-zero"></i><i class="lvl-fill"></i><div class="lvl-knob"></div></div>
           <span class="fd-end" aria-hidden="true">+</span></div>`), e);
        el.dataset.color = e.color || "";
        el.dataset.drag = "x";
        text(el, ".t", e.label);
        ticks(el.querySelector(".lvl-track"), e.steps || 5, "x");
        if (D.placeControl) { D.placeControl(el, e); showLevel(el, e, 0); return el; }
        stepper(el, e, "x");
        return el;
      },

      // Puts every level slider and fader back in the center. Sends nothing: they only count
      // what SpoolUp sent, so this is for when they no longer match the game. 2.0 layouts
      // call it "recentre" (and their label "Centre sliders"); both still work.
      recenter(e) {
        const el = box(make("button", "hud-btn s-std s-recenter", `<span class="hud-ico">${D.deckIcon("power-reset")}</span><span class="hud-lbl"></span><span class="fx-state"></span>`), e);
        el.type = "button";
        text(el, ".hud-lbl", !e.label || e.label === "Centre sliders" ? "Center sliders" : e.label);
        text(el, ".fx-state", "Sends no keys");
        el.title = tr("The sliders count the taps SpoolUp sent; SpoolUp can't read the game.");
        if (D.placeControl) { D.placeControl(el, e); return el; }
        el.addEventListener("click", () => {
          state.levels = {};
          save();
          window.DeckSound?.play("page");
          D.buzz?.();
          for (const fn of recentered) fn();
        });
        return el;
      },

      // Operator-mode dial: the modes sit round a face with a needle, and the hub in the
      // middle is its own button (SCM/NAV). Turning the needle to a mode and letting go, or
      // tapping the mode, is one tap of that mode's button. The needle shows the mode last
      // picked here, since SpoolUp can't see the game's.
      rotary(e) {
        const el = box(make("div", "hud-rotary", `<div class="rt-face"><svg class="rt-ticks" aria-hidden="true"></svg><i class="rt-needle"></i></div>`), e);
        el.dataset.drag = "xy";
        const W = e.w * kx * rkx, H = e.h * ky;
        const n = e.options.length;
        const bw = Math.max(64, Math.min(100, W * 0.21)), bh = Math.max(44, Math.min(52, H * 0.19));
        const cx = W / 2, cy = H / 2, rx = W / 2 - bw / 2 - 2, ry = H / 2 - bh / 2 - 2;
        const hub = Math.max(64, Math.min(110, Math.min(rx, ry) * 0.9));
        const face = el.querySelector(".rt-face");
        const fr = Math.min(cx, cy) - 2;
        Object.assign(face.style, { left: `${cx - fr}px`, top: `${cy - fr}px`, width: `${fr * 2}px`, height: `${fr * 2}px` });
        el.style.setProperty("--needle", `${Math.max(20, fr - 14)}px`);
        // Each mode's angle (degrees, 0 to the right, counter-clockwise), first at the top.
        const angles = e.options.map((_, i) => 90 - (i * 360) / n);
        const ticks = el.querySelector(".rt-ticks");
        ticks.setAttribute("viewBox", `0 0 ${fr * 2} ${fr * 2}`);
        ticks.innerHTML = angles.map((a) => {
          const r = (a * Math.PI) / 180, c = Math.cos(r), s2 = Math.sin(r);
          return `<line x1="${fr + c * (fr - 12)}" y1="${fr - s2 * (fr - 12)}" x2="${fr + c * (fr - 3)}" y2="${fr - s2 * (fr - 3)}"/>`;
        }).join("");
        const opts = e.options.map((o, i) => {
          const r = (angles[i] * Math.PI) / 180;
          const b = hudButton(o, "std");
          b.classList.add("rt-opt");
          Object.assign(b.style, { left: `${cx + Math.cos(r) * rx - bw / 2}px`, top: `${cy - Math.sin(r) * ry - bh / 2}px`, width: `${bw}px`, height: `${bh}px` });
          el.appendChild(b);
          return b;
        });
        if (e.hub) {
          const h = hudButton(e.hub, "std");
          h.classList.add("rt-hub");
          Object.assign(h.style, { left: `${cx - hub / 2}px`, top: `${cy - hub / 2}px`, width: `${hub}px`, height: `${hub}px` });
          el.appendChild(h);
        }
        if (D.placeControl) { D.placeControl(el, e); return el; }
        dial(el, e, opts, angles, { cx, cy, rx, ry });
        return el;
      },

      grid(e) {
        const wrap = box(make("div", `hud-grid${e.compact ? " compact" : ""}`), e);
        const rows = Math.ceil(e.buttons.length / e.cols);
        const gap = e.compact ? 8 : 12;
        const cellH = Math.min((e.compact ? 64 : 120) * ky, (e.h * ky - gap * (rows - 1)) / rows);
        wrap.style.gridTemplateColumns = `repeat(${e.cols}, 1fr)`;
        wrap.style.gridAutoRows = `${cellH}px`;
        wrap.style.gap = `${gap}px`;
        for (const b of e.buttons) wrap.appendChild(hudButton(b, e.compact ? "std" : "cell"));
        return wrap;
      },

      // A framed sub-panel that is one unit on the grid (grid layouts): its items are laid
      // out on its own columns by the same rules, sized to fit its box, so the group keeps
      // its arrangement wherever it's placed (a half panel, a dashboard).
      group(e) {
        const small = cls === "small";
        const el = box(make("div", `hud-group${e.style === "danger" ? " danger" : ""}`), e);
        const th = e.title ? (small ? 18 : 24) : 0;
        if (e.title) el.appendChild(text(make("div", "hud-header hud-group-title", `<b>//</b><span></span>`), "span", e.title));
        const ac = Math.max(1, Math.round(e.cols) || 6);
        const gap = DG ? DG.CLASSES[cls].gap : 8;
        const pad = e.style === "danger" ? gap : 0;
        const items = visible(e.elements || []);
        const p = DG.place(items.map((item) => ({ item, span: spanFor(item) })), { cols: ac, authoredCols: ac, sizeClass: cls });
        const iw = e.w * kx * rkx - pad * 2, ih = e.h * ky - th - pad * 2;
        const cw = (iw - gap * (ac - 1)) / ac, ch = (ih - gap * (Math.max(1, p.rows) - 1)) / Math.max(1, p.rows);
        for (const c of p.cells) {
          const child = renderItem(c.item, { x: pad + c.col * (cw + gap), y: th + pad + c.row * (ch + gap), w: c.w * cw + (c.w - 1) * gap, h: c.h * ch + (c.h - 1) * gap });
          if (child) el.appendChild(child);
        }
        return el;
      },
    };
    R.recentre = R.recenter; // the 2.0 name

    // An element type nothing draws yet (a widget whose script didn't load, or one from a
    // newer SpoolUp): its buttons, as a plain grid, so every key stays reachable.
    function fallback(e) {
      const defs = [], seen = new Set();
      (function walk(n, top) {
        if (Array.isArray(n)) { n.forEach((v) => walk(v)); return; }
        if (!n || typeof n !== "object") return;
        if (!top && typeof n.id === "string" && typeof n.keys === "string") { if (!seen.has(n.id)) { seen.add(n.id); defs.push(n); } return; }
        for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
      })(e, true);
      if (!defs.length) return null;
      const w = e.w * kx * rkx, h = e.h * ky;
      const cols = Math.max(1, Math.min(defs.length, Math.round(Math.sqrt((defs.length * w) / (h * 1.6))) || 1));
      return R.grid({ ...e, cols, compact: cls === "small" || h / Math.ceil(defs.length / cols) < 80, buttons: defs });
    }

    // ---------- grid layouts: items and widgets ----------

    // Every element by id, for refs; refreshed at every redraw (the editor changes layouts).
    let index = new Map();
    const visible = (els) => (els || []).filter((e) => e && typeof e === "object" && !(e.when && groupValue(e.when[0]) !== e.when[1])
      && !(e.type === "ref" && !index.has(e.ref)) && !(GRID && !DG.shows(e, cls)));
    // A ref takes its own span when it has one, else the span of what it shows.
    const spanFor = (e) => {
      if (e.type === "ref" && !e.span && !e.size && index.has(e.ref)) return DG.spanOf(index.get(e.ref), cls);
      return DG.spanOf(e, cls);
    };
    const swipingNow = () => Boolean(D.swiping && D.swiping());

    // The context a widget's render(e, ctx) gets (the contract in DEVELOPMENT.md). `e` is
    // the element with its box (x, y, w, h); a ref's copy has the id of what it shows, so
    // its memory and its buttons are the same as the original's.
    function widgetCtx(e) {
      const labels = labelsNow; // a widget that draws buttons later (a new tab) keeps its own
      return {
        D, tr, make, text, keyText,
        hudButton: (def, style) => withLabels(labels, () => hudButton(def, style)),
        labels: () => labels,
        size: { w: e.w * kx * rkx, h: e.h * ky },
        sizeClass: GRID ? cls : H < 500 ? "small" : "large",
        scale: scaleNow,
        editing: Boolean(D.placeControl),
        place: (el, item) => { if (D.placeControl) D.placeControl(el, item || e); },
        mem(item) {
          const id = (item && item.id) || e.id;
          if (!state.widgets[id] || typeof state.widgets[id] !== "object") {
            state.widgets[id] = {};
            // The 2.0 dial's pick carries over to a mode dial widget.
            if (state.dials[id]) state.widgets[id].mode = state.dials[id];
          }
          return state.widgets[id];
        },
        save,
        follow(id, fn) { if (!followers.has(id)) followers.set(id, []); followers.get(id).push(fn); },
        onRecenter(fn) { recentered.push(fn); },
        swiping: swipingNow,
        steps: { PER_DRAG: STEPS_PER_DRAG, GAP_MS: STEP_GAP_MS },
        stepper, ticks, showLevel,
        renderChild: (item, b) => renderItem(item, b),
      };
    }

    // Draws one element. With a box (grid layouts, groups) it's drawn there; without one,
    // at its own x, y, w, h (2.0 layouts). A widget registered for its type wins over the
    // built-in renderer, so a newer control replaces a 2.0 one in every layout.
    function renderItem(e, b) {
      let item = e;
      if (e.type === "ref") {
        item = index.get(e.ref);
        if (!item || item.type === "ref") return null;
      }
      // A copy's own labels setting wins over its original's.
      return withLabels(pickLabels(e.labels, pickLabels(item.labels, labelsNow)), () => drawItem(e, item, b));
    }
    function drawItem(e, item, b) {
      const it = b ? { ...item, x: b.x, y: b.y, w: b.w, h: b.h } : item;
      const def = DW && DW.get(item.type);
      let el = null;
      if (def) {
        el = def.render(it, widgetCtx(it));
        if (!el) return null;
        box(el, it);
        el.classList.add("hud-widget");
        if (def.drag && !el.dataset.drag) el.dataset.drag = def.drag;
      } else if (R[item.type]) el = R[item.type](it);
      else if (GRID) el = fallback(it);
      if (el && GRID) {
        if (typeof e.id === "string") el.dataset.item = e.id;
        if (item !== e) el.dataset.ref = item.id;
      }
      // Controls' and clusters' own words (a level's name, the reticle's corners, the
      // dial's captions) follow the setting too; plain buttons mark themselves.
      if (el && !el.classList.contains("hud-btn") && item.type !== "group") el.classList.toggle("lbl-off", labelsNow === "hide");
      return el;
    }


    // ---------- cockpit controls: gestures ----------

    // How long the gear lever's knob travels, and its lamps stay red, after a pull: about
    // what the game's gear takes. Only the picture waits; the key was tapped at the pull.
    const TRANSIT_MS = 2600;
    const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

    function lever(el, b) {
      const knob = el.querySelector(".lv-knob");
      const slot = el.querySelector(".lv-slot");
      const word = el.querySelector(".lv-state");
      let actual = false;  // the PC's state for the gear: true while deployed
      let lit = true;      // Button lights (Deck settings)
      let shown = false;   // where the knob rests: true at the bottom (deployed)
      let transit = null;  // { target, confirmed, timer } while the gear travels
      const label = () => tr(el.querySelector(".t").textContent);
      const setPos = (frac) => el.style.setProperty("--pos", String(frac));
      const paint = () => {
        el.classList.toggle("transit", Boolean(transit));
        el.classList.toggle("down", !transit && shown);
        el.classList.toggle("lit", lit);
        const w = transit ? "IN TRANSIT" : shown ? "DEPLOYED" : "RETRACTED";
        word.textContent = tr(w);
        el.setAttribute("aria-label", `${label()}: ${tr(w)}. ${tr(shown ? "Push up to retract" : "Pull down to deploy")}`);
      };
      const settle = (to) => {
        if (transit) clearTimeout(transit.timer);
        transit = null;
        shown = to;
        setPos(to ? 1 : 0);
        paint();
      };
      // Travel toward `target`; settles when the time is up and the PC agrees, or after a
      // while regardless, on whatever the PC last said.
      const travel = (target, confirmed) => {
        if (transit) clearTimeout(transit.timer);
        transit = { target, confirmed, timer: 0 };
        shown = target;
        setPos(target ? 1 : 0);
        paint();
        const t = transit;
        t.timer = setTimeout(() => {
          if (transit !== t) return;
          if (t.confirmed) { settle(t.target); return; }
          t.timer = setTimeout(() => { if (transit === t) settle(actual); }, 3000);
        }, still() ? 600 : TRANSIT_MS);
      };
      D.bindControl(el, {
        group: b.state && b.state.group,
        ids: [b.id],
        show(on, animate, lights) {
          actual = on;
          lit = lights !== false;
          if (transit && transit.target === on) { transit.confirmed = true; paint(); return; }
          if (animate && on !== shown) travel(on, true);
          else if (!transit) settle(on);
          else paint();
        },
        deny() {
          settle(actual);
          el.classList.remove("denied"); void el.offsetWidth; el.classList.add("denied");
        },
      });
      // The knob starts traveling first, so a state that comes back at once (demo mode)
      // finds it on its way.
      const pull = (target) => {
        travel(target, false);
        if (!D.tapStep(b)) settle(actual);
      };

      // Drag the knob (or anywhere on the lever) along the slot.
      let drag = null;
      el.addEventListener("pointerdown", (ev) => {
        if (drag || swipingNow()) return;
        el.setPointerCapture(ev.pointerId);
        const span = Math.max(1, slot.clientHeight - knob.offsetHeight);
        drag = { id: ev.pointerId, y: ev.clientY, from: shown ? 1 : 0, span, frac: shown ? 1 : 0 };
        el.classList.add("dragging");
      });
      el.addEventListener("pointermove", (ev) => {
        if (!drag || ev.pointerId !== drag.id) return;
        drag.frac = Math.max(0, Math.min(1, drag.from + (ev.clientY - drag.y) / scaleNow() / drag.span));
        setPos(drag.frac);
      });
      const end = (ev) => {
        if (!drag || ev.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        el.classList.remove("dragging");
        const target = d.frac > d.from;
        if (ev.type === "pointerup" && Math.abs(d.frac - d.from) >= 0.5) pull(target);
        else setPos(shown ? 1 : 0);
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("contextmenu", (ev) => ev.preventDefault());
      // From a keyboard: Enter or Space moves it to the other end, the arrows to theirs.
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.addEventListener("keydown", (ev) => {
        const to = ev.key === "ArrowDown" ? true : ev.key === "ArrowUp" ? false : (ev.key === "Enter" || ev.key === " ") ? !shown : null;
        if (to === null) return;
        ev.preventDefault();
        if (to !== shown) pull(to);
      });
      paint();
    }

    // ---------- cockpit controls: steps ----------

    // At most this many taps per drag, and at least this long between two, so a fast swipe
    // can't run a slider off: the key presses stay ones the player made, one per step.
    const STEPS_PER_DRAG = 5;
    const STEP_GAP_MS = 140;
    const levelOf = (e) => Math.max(-(e.steps || 5), Math.min(e.steps || 5, Number(state.levels[e.id]) || 0));
    // Tick marks at every step, the center one longer.
    function ticks(track, steps, axis) {
      for (let i = 0; i <= steps * 2; i++) {
        const t = make("i", `lvl-tick${i === steps ? " mid" : ""}`);
        t.style.setProperty("--at", String(i / (steps * 2)));
        track.appendChild(t);
      }
      track.dataset.axis = axis;
    }
    function showLevel(el, e, n) {
      const steps = e.steps || 5;
      el.style.setProperty("--pos", String((n + steps) / (steps * 2)));
      el.style.setProperty("--from", String((Math.min(n, 0) + steps) / (steps * 2)));
      el.style.setProperty("--to", String((Math.max(n, 0) + steps) / (steps * 2)));
      el.classList.toggle("at-max", n === steps);
      el.classList.toggle("at-min", n === -steps);
      el.querySelector(".lvl-read").textContent = n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
      el.setAttribute("aria-valuenow", String(n));
      el.setAttribute("aria-valuetext", tr("{0} steps sent", n > 0 ? `+${n}` : String(n)));
    }

    // Drag (or tap the track beside the knob, or use the arrow keys) to step a level slider
    // or fader. Each step is one tap of e.up or e.down; the knob moves only for taps sent.
    function stepper(el, e, axis) {
      const steps = e.steps || 5;
      const track = el.querySelector(".lvl-track");
      const knob = el.querySelector(".lvl-knob");
      const get = () => levelOf(e);
      const set = (n) => { state.levels[e.id] = n; save(); showLevel(el, e, n); };
      let last = 0;
      const step = (dir) => {
        const cur = get(), next = cur + dir;
        if (next > steps || next < -steps) return false;
        if (performance.now() - last < STEP_GAP_MS) return false;
        if (!D.tapStep(dir > 0 ? e.up : e.down)) return null;
        last = performance.now();
        set(next);
        return true;
      };
      el.setAttribute("role", "slider");
      el.setAttribute("aria-label", tr(e.label));
      el.setAttribute("aria-valuemin", String(-steps));
      el.setAttribute("aria-valuemax", String(steps));
      el.setAttribute("aria-orientation", axis === "y" ? "vertical" : "horizontal");
      el.tabIndex = 0;
      showLevel(el, e, get());
      D.bindControl(el, {
        ids: [e.up.id, e.down.id],
        // A step the PC skipped (Star Citizen not in front) didn't happen: take it back.
        deny(id) {
          const n = get() + (id === e.up.id ? -1 : 1);
          set(Math.max(-steps, Math.min(steps, n)));
          el.classList.remove("denied"); void el.offsetWidth; el.classList.add("denied");
        },
      });
      for (const [to, id] of Object.entries(e.follows || {})) {
        if (!followers.has(id)) followers.set(id, []);
        followers.get(id).push(() => set(to === "max" ? steps : to === "min" ? -steps : 0));
      }
      recentered.push(() => showLevel(el, e, 0));

      const along = (ev) => (axis === "y" ? -ev.clientY : ev.clientX);
      let drag = null;
      el.addEventListener("pointerdown", (ev) => {
        if (drag || swipingNow()) return;
        el.setPointerCapture(ev.pointerId);
        const len = axis === "y" ? track.clientHeight - knob.offsetHeight : track.clientWidth - knob.offsetWidth;
        drag = { id: ev.pointerId, p: along(ev), from: get(), sent: 0, moved: false, onKnob: ev.target === knob, per: Math.max(8, len / (steps * 2)), ev };
        el.classList.add("dragging");
      });
      const follow = (ev) => {
        const d = drag;
        const delta = (along(ev) - d.p) / scaleNow();
        if (Math.abs(delta) > 6) d.moved = true;
        const want = Math.max(-steps, Math.min(steps, d.from + Math.round(delta / d.per)));
        const cur = get();
        if (want === cur) return;
        if (d.sent >= STEPS_PER_DRAG) { el.classList.add("capped"); return; }
        const r = step(want > cur ? 1 : -1);
        if (r) d.sent++;
        else if (r === null) d.sent = STEPS_PER_DRAG; // offline: no more from this drag
      };
      el.addEventListener("pointermove", (ev) => { if (drag && ev.pointerId === drag.id) follow(ev); });
      const end = (ev) => {
        if (!drag || ev.pointerId !== drag.id) return;
        const d = drag;
        if (ev.type === "pointerup") {
          if (d.moved) follow(ev);
          else if (!d.onKnob) {
            // A tap on the track: one step toward it.
            const r = knob.getBoundingClientRect();
            const toward = axis === "y" ? ev.clientY < r.top : ev.clientX > r.right;
            const away = axis === "y" ? ev.clientY > r.bottom : ev.clientX < r.left;
            if (toward || away) { last = 0; step(toward ? 1 : -1); }
          }
        }
        drag = null;
        el.classList.remove("dragging", "capped");
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("contextmenu", (ev) => ev.preventDefault());
      el.addEventListener("keydown", (ev) => {
        const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
        if (!dir) return;
        ev.preventDefault();
        step(dir);
      });
    }

    // ---------- cockpit controls: the mode dial ----------

    function dial(el, e, opts, angles, g) {
      const needle = el.querySelector(".rt-needle");
      const point = (deg) => { needle.style.transform = `rotate(${90 - deg}deg)`; };
      const index = () => e.options.findIndex((o) => o.id === state.dials[e.id]);
      const show = () => {
        const i = index();
        el.classList.toggle("unset", i < 0);
        point(i < 0 ? 90 : angles[i]);
        opts.forEach((b, j) => b.classList.toggle("rt-on", j === i));
      };
      let before = null; // the mode before the last pick, in case the PC skipped it
      const pick = (i) => {
        before = state.dials[e.id] || null;
        state.dials[e.id] = e.options[i].id;
        save();
        show();
      };
      D.bindControl(el, {
        ids: e.options.map((o) => o.id),
        deny(id) { if (state.dials[e.id] === id) { state.dials[e.id] = before; save(); show(); } },
      });
      // Tapping a mode presses it as any button does (bindButton); the needle follows.
      opts.forEach((b, i) => b.addEventListener("pointerdown", () => { if (b.classList.contains("pressed") && D.canPress()) pick(i); }));

      // Turning: drag on the face, away from the buttons. Angles are measured on the ellipse
      // the modes sit on, so the nearest mode is the one the needle points between.
      const angleAt = (ev) => {
        const r = el.getBoundingClientRect(), s = scaleNow();
        const x = (ev.clientX - r.left) / s - g.cx, y = (ev.clientY - r.top) / s - g.cy;
        return (Math.atan2(-y / g.ry, x / g.rx) * 180) / Math.PI;
      };
      const nearest = (a) => {
        let best = 0, bestD = 999;
        angles.forEach((b, i) => { const d = Math.abs(((a - b + 540) % 360) - 180); if (d < bestD) { bestD = d; best = i; } });
        return best;
      };
      let turn = null;
      el.addEventListener("pointerdown", (ev) => {
        if (turn || swipingNow() || ev.target.closest(".hud-btn")) return;
        el.setPointerCapture(ev.pointerId);
        turn = { id: ev.pointerId, a0: angleAt(ev), moved: false };
        el.classList.add("turning");
      });
      el.addEventListener("pointermove", (ev) => {
        if (!turn || ev.pointerId !== turn.id) return;
        const a = angleAt(ev);
        if (Math.abs(((a - turn.a0 + 540) % 360) - 180) > 8) turn.moved = true;
        if (!turn.moved) return;
        point(a);
        const i = nearest(a);
        opts.forEach((b, j) => b.classList.toggle("rt-aim", j === i));
      });
      const end = (ev) => {
        if (!turn || ev.pointerId !== turn.id) return;
        const t = turn;
        turn = null;
        el.classList.remove("turning");
        opts.forEach((b) => b.classList.remove("rt-aim"));
        if (ev.type === "pointerup" && t.moved) {
          const i = nearest(angleAt(ev));
          if (i !== index() && D.tapStep(e.options[i])) {
            pick(i);
            opts[i].classList.add("pressed");
            setTimeout(() => opts[i].classList.remove("pressed"), 160);
            return;
          }
        }
        show();
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("contextmenu", (ev) => ev.preventDefault());
      el.setAttribute("role", "group");
      el.setAttribute("aria-label", tr(e.label || "Operator mode"));
      show();
    }

    function openMenu(e) {
      window.DeckSound?.play("page");
      const overlay = make("div", "hud-menu", `<div class="sheet"><div class="hud-header"><b>//</b><span></span></div><div class="opts"></div></div>`);
      text(overlay, ".hud-header span", e.title || e.label);
      const opts = overlay.querySelector(".opts");
      for (const o of e.options) {
        const b = hudButton(o, "cell");
        b.addEventListener("pointerup", () => setTimeout(() => overlay.remove(), 120));
        opts.appendChild(b);
      }
      overlay.addEventListener("pointerdown", (ev) => { if (ev.target === overlay) overlay.remove(); });
      canvas.appendChild(overlay);
    }

    function renderElements(parent, elements) {
      for (const e of elements) {
        if (e.when && groupValue(e.when[0]) !== e.when[1]) continue;
        const el = renderItem(e, null);
        if (el) parent.appendChild(el);
      }
    }

    // Set while paging, so the region's new panel slides in from that side.
    let slide = null;

    // ---------- grid layouts: the frame ----------

    // What a grid layout shows on this screen: the size class's measures, the density, the
    // view (two halves, or one panel) and the regions it puts under the top bar. Small
    // screens open on one panel, large ones on two halves (grid.start can say otherwise);
    // a phone held upright always shows one.
    let frameNow = null;
    let gridInfo = {}; // region id -> what gridOf() says about it
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    function frame() {
      const c = DG.CLASSES[cls];
      const g = layout.grid;
      const pv = D.preview || {};
      const pick = (v) => (DG.DENSITIES.includes(v) ? v : null);
      const density = pick(pv.density) || pick(D.store.get(`grid-density-${cls}`)) || pick(g.density && g.density[cls]) || "default";
      const tracks = DG.tracks(layout);
      const portrait = cls === "small" && H > W;
      let mode = pv.mode || state.mode || (g.start && g.start[cls]) || c.mode;
      if (portrait || !tracks.left.length || !tracks.right.length) mode = "full";
      const small = cls === "small";
      const y = c.bar + (small ? 6 : 16);
      const h = H - y - (small ? 0 : 14);
      const regions = [];
      let seam = null;
      if (mode === "halves") {
        const half = (W - c.margin * 2 - c.between) / 2;
        const limit = Math.round(half * 0.2);
        const d = clamp(Math.round(Number(state.split) || 0), -limit, limit);
        regions.push({ id: "left", x: c.margin, y, w: half + d, h, pager: c.pager, panels: tracks.left });
        regions.push({ id: "right", x: c.margin + half + c.between + d, y, w: half - d, h, pager: c.pager, panels: tracks.right });
        seam = { limit, d, mid: c.margin + half + d + c.between / 2, top: y, height: h };
      } else {
        regions.push({ id: "full", x: c.margin, y, w: W - c.margin * 2, h, pager: c.pager, panels: tracks.full });
      }
      return { c, density, mode, portrait, tracks, regions, seam, canToggle: !portrait && tracks.left.length > 0 && tracks.right.length > 0 };
    }
    // The panel a region shows: the one it was left on, else its first.
    const shownIn = (r) => (r.panels.includes(state.panels[r.id]) ? state.panels[r.id] : r.panels[0]);
    // The half a panel belongs to, for Stream Decks (which know halves only).
    const sideOf = (id) => (frameNow && frameNow.tracks.left.includes(id) ? "left" : frameNow && frameNow.tracks.right.includes(id) ? "right" : null);
    function tell(regionId, panel, from) {
      if (!D.paged) return;
      if (regionId !== "full") { D.paged(regionId, panel, from); return; }
      const side = sideOf(panel);
      if (side) D.paged(side, panel, sideOf(from) === side ? from : undefined);
    }

    // The top bar: chrome items marked "bar": "left" flow from the left, "right" ones from
    // the right, in their order. The status line takes the room left between; on a narrow
    // screen the mic loses its words first, then the buttons shrink a little.
    function renderBar(f) {
      const small = cls === "small";
      const ih = small ? 36 : 52, iy = small ? 4 : 6, mx = small ? 4 : f.c.margin, gap = 6;
      const items = (layout.chrome || []).filter((e) => e && !["rule", "divider", "vlabel", "bracket"].includes(e.type) && (R[e.type] || e.type === "button"));
      const flex = (e) => e.type === "status";
      let sq = small ? 40 : 58, label = true;
      const talkW = small ? 150 : 196;
      const widthOf = (e) => (flex(e) ? 0 : e.type === "talk" && e.label && label ? talkW : sq);
      const fixed = () => items.reduce((n, e) => n + widthOf(e), 0) + gap * Math.max(0, items.length - 1);
      const avail = W - mx * 2;
      if (avail - fixed() < 140) label = false;
      const squares = items.filter((e) => !flex(e)).length;
      if (avail - fixed() < 28) sq = Math.max(30, Math.floor((avail - 28 - gap * Math.max(0, items.length - 1)) / Math.max(1, squares)));
      const statusW = Math.max(24, avail - fixed());
      const put = (e, x, w) => {
        const it = { ...e, x, y: iy, w, h: ih };
        if (e.type === "talk" && !label) delete it.label;
        const el = e.type === "button" ? R.button(it) : R[e.type](it);
        if (flex(e)) el.classList.toggle("dot-only", w < 110);
        canvas.appendChild(el);
      };
      let x = mx;
      for (const e of items.filter((e) => e.bar !== "right")) { const w = flex(e) ? statusW : widthOf(e); put(e, x, w); x += w + gap; }
      x = W - mx;
      for (const e of items.filter((e) => e.bar === "right").reverse()) { const w = flex(e) ? statusW : widthOf(e); x -= w; put(e, x, w); x -= gap; }
      canvas.appendChild(R.rule({ x: mx, y: f.c.bar - 2, w: W - mx * 2 }));
    }

    // One region of a grid layout: its panel packed on the grid, then the pager. Rows grow
    // to fill the body up to the class's tallest cell; a panel that needs more rows than
    // fit scrolls up and down (sideways swipes still page). Content narrower than the
    // body (a half panel shown alone) is centered.
    function renderGridRegion(region, f) {
      const el = box(make("div", "hud-region"), region);
      el.dataset.region = region.id;
      el.style.setProperty("--pager-h", `${region.pager}px`);
      const ids = region.panels;
      const pid = shownIn(region);
      const idx = Math.max(0, ids.indexOf(pid));
      const panel = layout.panels[pid] || { title: "", elements: [] };
      const body = make("div", "hud-panel");
      body.dataset.panel = pid || "";
      if (slide && slide.region === region.id) body.classList.add(slide.dir > 0 ? "enter-next" : "enter-prev");
      const bodyW = region.w, bodyH = region.h - region.pager - 8;
      body.style.height = `${bodyH}px`;
      const m = DG.metrics({ width: bodyW, sizeClass: cls, density: f.density });
      const authored = Math.max(1, Math.round(panel.cols) || (panel.wide ? 12 : 6));
      const items = visible(panel.elements);
      const placed = DG.place(items.map((item) => ({ item, span: spanFor(item), min: DG.minWidth(item.type === "ref" ? index.get(item.ref) : item) })), { cols: m.cols, authoredCols: authored, sizeClass: cls });
      // A panel of clusters alone (no plain buttons) may grow its rows to fill the body: a
      // cluster scales its drawing, while a button stretched tall would only look odd. So
      // Shields on a phone held upright fills the screen instead of its top half.
      const typeOf = (it) => (it.type === "ref" ? (index.get(it.ref) || {}).type : it.type);
      const clustersOnly = placed.cells.length > 0 && placed.cells.every((c) => { const t = typeOf(c.item); return t === "rotary" || Boolean(DW && DW.get(t)); });
      const cs = DG.cellSize({ bodyW, bodyH, cols: m.cols, rows: placed.rows, gap: m.gap, minH: m.minH, maxH: clustersOnly ? Infinity : m.maxH });
      const used = placed.cells.reduce((n, c) => Math.max(n, c.col + c.w), 0);
      const shift = Math.max(0, Math.floor((m.cols - used) / 2));
      const pitchX = cs.cellW + m.gap, pitchY = cs.cellH + m.gap;
      body.classList.toggle("scrolls", cs.scrolls);
      withLabels(pickLabels(panel.labels, deckLabels()), () => {
        for (const c of placed.cells) {
          const node = renderItem(c.item, { x: (c.col + shift) * pitchX, y: c.row * pitchY, w: c.w * cs.cellW + (c.w - 1) * m.gap, h: c.h * cs.cellH + (c.h - 1) * m.gap });
          if (node) body.appendChild(node);
        }
      });
      gridInfo[region.id] = {
        panelId: pid, cols: m.cols, authoredCols: authored, rows: placed.rows, cellW: cs.cellW, cellH: cs.cellH, gap: m.gap,
        x: region.x + shift * pitchX, y: region.y, scrolls: cs.scrolls,
        items: placed.cells.map((c) => ({ id: c.item.id, col: c.col, row: c.row, w: c.w, h: c.h, pinned: c.pinned })),
      };
      el.appendChild(body);

      const last = region === f.regions[f.regions.length - 1];
      const toggle = last && f.canToggle && !D.preview;
      const pager = make("div", `hud-pager${toggle ? " has-mode" : ""}`,
        `<button type="button" class="hud-btn s-pg prev" aria-label="${tr("Previous panel")}">${D.deckIcon("chev-left")}</button>
         <div class="title"><span></span><div class="dots"></div></div>
         <button type="button" class="hud-btn s-pg next" aria-label="${tr("Next panel")}">${D.deckIcon("chev-right")}</button>`);
      text(pager, ".title span", panel.title || "");
      pager.querySelector(".dots").innerHTML = ids.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("");
      pager.querySelector(".prev").onclick = () => page(region.id, -1);
      pager.querySelector(".next").onclick = () => page(region.id, 1);
      if (toggle) {
        const one = f.mode === "halves";
        const b = make("button", "hud-btn s-pg mode", D.deckIcon(one ? "view-one" : "view-two"));
        b.type = "button";
        b.setAttribute("aria-label", tr(one ? "Show one panel" : "Show two panels"));
        b.title = b.getAttribute("aria-label");
        b.onclick = () => setMode(one ? "full" : "halves");
        pager.appendChild(b);
      }
      el.appendChild(pager);
      return el;
    }

    // Switches between two halves and one panel, keeping what was showing: one panel shows
    // the left half's panel; two halves put the panel shown alone in its half.
    function setMode(m) {
      if (!GRID || (m !== "halves" && m !== "full")) return;
      const f = frameNow || frame();
      if (m === f.mode) return;
      if (m === "full") {
        const left = f.regions.find((r) => r.id === "left");
        if (left) state.panels.full = shownIn(left);
      } else {
        const full = f.regions.find((r) => r.id === "full");
        const id = full && shownIn(full);
        const side = sideOf(id);
        if (side) state.panels[side] = id;
      }
      state.mode = m;
      save();
      window.DeckSound?.play("page");
      render();
    }

    // Moves a region (one half of the HUD, or the one-panel view) d panels on, as its
    // pager arrows do.
    function page(regionId, d) {
      if (GRID) {
        const region = (frameNow || frame()).regions.find((r) => r.id === regionId);
        if (!region || !region.panels.length) return;
        const ids = region.panels, n = ids.length;
        const from = Math.max(0, ids.indexOf(shownIn(region)));
        state.panels[regionId] = ids[(from + d + n) % n];
        save();
        window.DeckSound?.play("page");
        slide = { region: regionId, dir: d };
        render();
        slide = null;
        tell(regionId, state.panels[regionId], ids[from]);
        return;
      }
      const region = layout.regions.find((r) => r.id === regionId);
      if (!region) return;
      const n = region.panels.length;
      const from = Math.min(state.panels[regionId] || 0, n - 1);
      state.panels[regionId] = (from + d + n) % n;
      save();
      window.DeckSound?.play("page"); // sound.js isn't loaded in the layout editor
      slide = { region: regionId, dir: d };
      render();
      slide = null;
      // The player paged it (a Stream Deck scene goes through showPanels), so the deck may
      // tell Stream Decks; the layout editor doesn't.
      D.paged?.(regionId, region.panels[state.panels[regionId]], region.panels[from]);
    }

    // ---------- Edit layout: the seam between the halves ----------

    // A layout with two halves side by side can move the seam between them (Deck settings,
    // Edit layout): one half gets wider and its panels stretch (grid layouts: get more or
    // fewer columns), the other narrower. It's only layout, kept per device with the page
    // positions; nothing is pressed.
    const halves = GRID ? null : (() => {
      const [a, b] = layout.regions || [];
      if (!a || !b || layout.regions.length !== 2 || a.x + a.w > b.x) return null;
      return { a, b, limit: Math.round(Math.min(a.w, b.w) * 0.2), gap: b.x - (a.x + a.w) };
    })();
    let editing = false;
    // The seam now: how far it may move, and where it is in canvas px; null without halves.
    function seamInfo() {
      if (GRID) return frameNow && frameNow.seam;
      if (!halves) return null;
      const d = split();
      return { limit: halves.limit, d, mid: (halves.a.x + halves.a.w + halves.gap / 2 + d) * kx, top: halves.a.y * ky, height: halves.a.h * ky };
    }
    const split = () => {
      const lim = GRID ? (frameNow && frameNow.seam ? frameNow.seam.limit : 0) : halves ? halves.limit : 0;
      return Math.max(-lim, Math.min(lim, Math.round(Number(state.split) || 0)));
    };
    // A region as the seam leaves it, and how much wider its panels are drawn.
    function placed(region) {
      const d = split();
      if (!d) return { r: region, f: 1 };
      if (region === halves.a) return { r: { ...region, w: region.w + d }, f: (region.w + d) / region.w };
      if (region === halves.b) return { r: { ...region, x: region.x + d, w: region.w - d }, f: (region.w - d) / region.w };
      return { r: region, f: 1 };
    }
    // Chrome between the halves (the divider) moves with the seam.
    function seamAt(e) {
      const d = split();
      if (!d || !halves) return e;
      const lo = halves.a.x + halves.a.w - 4, hi = halves.b.x + 4;
      return e.x >= lo && e.x <= hi ? { ...e, x: e.x + d } : e;
    }
    // The seam handle and the Reset / Lock bar, kept across redraws so a drag survives them.
    let seamEl = null, barEl = null;
    function editChrome() {
      const seam = seamInfo();
      if (!editing || !seam) return;
      if (!seamEl) {
        seamEl = make("div", "plates-seam", `<i></i>`);
        seamEl.setAttribute("role", "slider");
        seamEl.setAttribute("aria-label", tr("Drag to resize the halves"));
        seamEl.tabIndex = 0;
        seamEl.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          const start = { x: ev.clientX, d: split() };
          seamEl.classList.add("dragging");
          let frameReq = 0;
          const move = (m) => {
            const lim = (seamInfo() || { limit: 0 }).limit;
            state.split = Math.max(-lim, Math.min(lim, Math.round(start.d + (m.clientX - start.x) / scaleNow() / (GRID ? 1 : kx))));
            if (!frameReq) frameReq = requestAnimationFrame(() => { frameReq = 0; render(); });
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            seamEl.classList.remove("dragging");
            save();
            render();
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        });
        seamEl.addEventListener("keydown", (ev) => {
          const by = { ArrowLeft: -8, ArrowRight: 8 }[ev.key];
          if (!by) return;
          ev.preventDefault();
          state.split = split() + by;
          state.split = split();
          save();
          render();
          seamEl.focus();
        });
        barEl = make("div", "plates-bar",
          `<span class="t"></span><button type="button" class="reset"></button><button type="button" class="lock"></button>`);
        barEl.querySelector(".t").textContent = tr("Edit layout: drag the seam");
        barEl.querySelector(".reset").textContent = tr("Reset");
        barEl.querySelector(".lock").textContent = tr("Lock");
        barEl.querySelector(".reset").onclick = () => { state.split = 0; save(); render(); };
        barEl.querySelector(".lock").onclick = () => editPlates(false);
      }
      Object.assign(seamEl.style, { left: `${seam.mid - 22}px`, top: `${seam.top}px`, height: `${seam.height}px` });
      seamEl.setAttribute("aria-valuenow", String(seam.d));
      canvas.append(make("div", "plates-veil"), seamEl, barEl);
    }
    function editPlates(on) {
      if (on && !seamInfo()) return false;
      editing = Boolean(on);
      if (!editing) { seamEl = null; barEl = null; }
      window.DeckSound?.play("page");
      render();
      return true;
    }

    function renderRegion(original) {
      const { r: region, f } = placed(original);
      const el = box(make("div", "hud-region"), region);
      el.dataset.region = region.id;
      const pagerH = region.pager || 44; // pager bar height; phone layouts use a slimmer one
      el.style.setProperty("--pager-h", `${pagerH}px`);
      const ids = region.panels;
      const idx = Math.min(state.panels[region.id] || 0, ids.length - 1);
      const panel = layout.panels[ids[idx]];
      const body = make("div", "hud-panel");
      if (slide && slide.region === region.id) body.classList.add(slide.dir > 0 ? "enter-next" : "enter-prev");
      body.style.height = `${region.h * ky - pagerH - 8}px`;
      rkx = f;
      try { withLabels(pickLabels(panel.labels, deckLabels()), () => renderElements(body, panel.elements)); } finally { rkx = 1; }
      el.appendChild(body);

      const pager = make("div", "hud-pager",
        `<button type="button" class="hud-btn s-pg prev" aria-label="${tr("Previous panel")}">${D.deckIcon("chev-left")}</button>
         <div class="title"><span></span><div class="dots"></div></div>
         <button type="button" class="hud-btn s-pg next" aria-label="${tr("Next panel")}">${D.deckIcon("chev-right")}</button>`);
      text(pager, ".title span", panel.title);
      pager.querySelector(".dots").innerHTML = ids.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("");
      const go = (d) => page(region.id, d);
      pager.querySelector(".prev").onclick = () => go(-1);
      pager.querySelector(".next").onclick = () => go(1);
      el.appendChild(pager);
      return el;
    }

    function render() {
      // A scrolled panel stays where it was when the deck redraws (a switch flipped, the
      // other half paged), as long as it's still the same panel.
      const scrolled = {};
      for (const b of canvas.querySelectorAll(".hud-panel.scrolls")) if (b.scrollTop) scrolled[b.dataset.panel] = b.scrollTop;
      canvas.innerHTML = "";
      followers.clear();
      recentered = [];
      labelsNow = deckLabels();
      if (GRID) {
        index = DG.index(layout);
        frameNow = frame();
        gridInfo = {};
        canvas.dataset.mode = frameNow.mode;
        renderBar(frameNow);
        for (const region of frameNow.regions) canvas.appendChild(renderGridRegion(region, frameNow));
        for (const b of canvas.querySelectorAll(".hud-panel.scrolls")) if (scrolled[b.dataset.panel]) b.scrollTop = scrolled[b.dataset.panel];
      } else {
        index = new Map();
        delete canvas.dataset.mode;
        delete canvas.dataset.size;
        renderElements(canvas, layout.chrome || []);
        for (const region of layout.regions) canvas.appendChild(renderRegion(region));
      }
      canvas.classList.toggle("plates-edit", editing);
      editChrome();
      D.refreshStatus();
      if (D.afterRender) D.afterRender();
    }

    // ---------- panels by id: gestures, Stream Deck scenes ----------

    // Every panel the deck can show, in order (for Deck settings' gesture choices).
    function panelList() {
      const ids = GRID ? DG.tracks(layout).full : [...new Set(layout.regions.flatMap((r) => r.panels))];
      return ids.filter((id) => layout.panels[id]).map((id) => ({ id, title: layout.panels[id].title || id }));
    }
    // The layout's primary panel (grid.primary, set in the layout editor), else its first.
    function primaryPanel() {
      const list = panelList();
      const want = GRID && layout.grid.primary;
      return (list.find((p) => p.id === want) || list[0] || {}).id || null;
    }
    // Shows one panel by id, as if the player had paged to it: in its half, or alone (a
    // wide dashboard switches to the one-panel view). False if the layout hasn't got it.
    function showPanel(id) {
      if (!id || !layout.panels[id]) return false;
      if (GRID) {
        const f = frameNow || frame();
        let regionId = "full";
        if (f.mode === "halves") {
          const side = sideOf(id);
          if (side) regionId = side;
          else state.mode = "full"; // a dashboard shows alone
        }
        const region = f.regions.find((r) => r.id === regionId);
        const from = region ? shownIn(region) : null;
        if (from === id) return true;
        state.panels[regionId] = id;
        save();
        window.DeckSound?.play("page");
        render();
        tell(regionId, id, from);
        return true;
      }
      for (const region of layout.regions) {
        const i = region.panels.indexOf(id);
        if (i < 0) continue;
        const from = Math.min(state.panels[region.id] || 0, region.panels.length - 1);
        if (from === i) return true;
        state.panels[region.id] = i;
        save();
        window.DeckSound?.play("page");
        render();
        D.paged?.(region.id, id, region.panels[from]);
        return true;
      }
      return false;
    }
    // Every button in the layout by id.
    function buttonsById() {
      const byId = new Map();
      (function walk(n) {
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (!n || typeof n !== "object") return;
        if (typeof n.id === "string" && typeof n.keys === "string" && !byId.has(n.id)) byId.set(n.id, n);
        for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
      })(layout);
      return byId;
    }
    // Quick actions (a two-finger swipe can open it): the top bar's buttons, a few that
    // matter in a hurry, and the emotes starred on this device, in one sheet. Each is an
    // ordinary button: one press per tap, then the sheet closes.
    const QUICK = ["qt-flight-ready", "pl-gear", "pl-autoland", "pl-request-dock", "fa-lights", "cr-doors-toggle", "cb-decoy", "cb-noise", "fa-exit", "ft-inventory"];
    function quickActions() {
      const byId = buttonsById();
      const defs = [];
      const add = (d) => { if (d && !defs.includes(d)) defs.push(d); };
      for (const c of layout.chrome || []) if (c && c.type === "button" && byId.has(c.id)) add(byId.get(c.id));
      for (const id of QUICK) add(byId.get(id));
      const emotes = readKey("spoolup-emotes");
      if (emotes && Array.isArray(emotes.favorites)) emotes.favorites.slice(0, 8).forEach((id) => add(byId.get(id)));
      if (!defs.length) return false;
      canvas.querySelector(".hud-menu")?.remove();
      openMenu({ title: "Quick actions", options: defs });
      canvas.querySelector(".hud-menu")?.classList.add("quick");
      return true;
    }

    // canvas px of a screen point
    const toCanvas = (x, y) => { const r = canvas.getBoundingClientRect(); return { x: (x - r.left) / scaleNow(), y: (y - r.top) / scaleNow() }; };

    render();
    // The layout editor redraws after changing the layout, and asks which panels are showing.
    current = {
      render,
      panelShown(regionId) {
        if (!GRID) return state.panels[regionId] || 0;
        const r = (frameNow || frame()).regions.find((x) => x.id === regionId);
        return r ? Math.max(0, r.panels.indexOf(shownIn(r))) : 0;
      },
      // Pages the half at screen point (x, y), for swipes; false if none is there.
      pageAt(x, y, d) {
        for (const el of canvas.querySelectorAll(".hud-region")) {
          const r = el.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { page(el.dataset.region, d); return true; }
        }
        // Grid layouts: anywhere else (the top bar) pages the one-panel view.
        if (GRID && frameNow && frameNow.mode === "full") { page("full", d); return true; }
        return false;
      },
      // Pages each half to a panel by id, for a Stream Deck scene ({ left, right }), without
      // telling Stream Decks (that would page them back). Phone layouts name some panels
      // differently ("landing" for "power-landing", "emotes-1"), so a panel matches by its
      // id, a word of it, or its start. A half with no match stays. The one-panel view of
      // a grid layout shows the scene's left panel (or its right one, if it has no left).
      showPanels(want) {
        let changed = false;
        const match = (ids, id) => {
          const words = id.split("-");
          let i = ids.indexOf(id);
          if (i < 0) i = ids.findIndex((p) => words.includes(p) || p.startsWith(id));
          return i;
        };
        if (GRID) {
          for (const region of (frameNow || frame()).regions) {
            const id = want && (region.id === "full" ? want.left || want.right : want[region.id]);
            if (!id) continue;
            const i = match(region.panels, id);
            if (i < 0 || region.panels[i] === shownIn(region)) continue;
            state.panels[region.id] = region.panels[i];
            changed = true;
          }
          if (changed) { save(); render(); }
          return changed;
        }
        for (const region of layout.regions) {
          const id = want && want[region.id];
          if (!id) continue;
          const idx = match(region.panels, id);
          if (idx < 0 || Math.min(state.panels[region.id] || 0, region.panels.length - 1) === idx) continue;
          state.panels[region.id] = idx;
          changed = true;
        }
        if (changed) { save(); render(); }
        return changed;
      },
      showPanel, panelList, primaryPanel, quickActions,
      scale: scaleNow,
      // Deck settings' Edit layout: unlocks the seam between the halves (false if the layout
      // has no two halves side by side).
      editPlates,
      editing: () => editing,
      // A button was pressed on this deck: controls that follow it update.
      pressed(id) { for (const fn of followers.get(id) || []) fn(); },
      // ----- grid layouts -----
      grid: GRID,
      sizeClass: () => (GRID ? cls : H < 500 ? "small" : "large"),
      mode: () => (GRID && frameNow ? frameNow.mode : "halves"),
      setMode,
      // Where a region's grid is: its panel, columns, cell size and origin (canvas px of
      // column 0, row 0, before scrolling), and each placed item. Null for 2.0 layouts.
      gridOf(regionId) {
        const g = GRID && gridInfo[regionId];
        if (!g) return null;
        return { ...g, items: g.items.map((i) => ({ ...i })) };
      },
      // The grid cell under a screen point, in the region's columns as drawn.
      cellAt(clientX, clientY) {
        if (!GRID) return null;
        const p = toCanvas(clientX, clientY);
        for (const el of canvas.querySelectorAll(".hud-region")) {
          const g = gridInfo[el.dataset.region];
          if (!g) continue;
          const r = (frameNow.regions.find((x) => x.id === el.dataset.region)) || {};
          if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h - r.pager) continue;
          const body = el.querySelector(".hud-panel");
          const sy = body ? body.scrollTop : 0;
          const col = clamp(Math.floor((p.x - g.x) / (g.cellW + g.gap)), 0, g.cols - 1);
          const row = Math.max(0, Math.floor((p.y - g.y + sy) / (g.cellH + g.gap)));
          return { regionId: el.dataset.region, panelId: g.panelId, col, row };
        }
        return null;
      },
      // One-finger swipes anywhere page this deck (Deck settings), a grid layout's option.
      claimsSwipes: () => Boolean(GRID && D.swipeMode && D.swipeMode().one),
      swiping: swipingNow,
      // Stops this deck redrawing itself, before another layout is drawn or a grid layout shown.
      dispose() {
        window.removeEventListener("resize", fit);
        window.removeEventListener("orientationchange", turned);
        if (current === this) current = null;
      },
    };
    return current;
  };
})();
