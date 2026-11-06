// Renders "canvas" layouts: a fixed-size HUD (e.g. 1024x768) scaled to fit the screen,
// with regions that page through panels. Element coordinates are canvas pixels;
// panel elements are relative to their region.
(() => {
  const NS = "deck-canvas";
  // Shown text goes through the deck's language (i18n.js); English when it isn't loaded.
  const tr = (s) => (window.DeckI18n ? window.DeckI18n.t(s) : s);

  let current = null; // the deck drawn last; a new one replaces it (switching layouts)

  window.renderCanvas = function renderCanvas(layout, D) {
    if (current) current.dispose();
    const [W, H] = layout.canvas;
    const stage = document.getElementById("stage");
    const canvas = document.getElementById("canvas");
    stage.hidden = false;
    // Small canvases (phone layouts) get tighter menus; wide ones ask phones to turn sideways.
    canvas.classList.toggle("compact", H < 500);
    stage.classList.toggle("landscape-only", W > H * 1.5);
    stage.querySelector(".hud-rotate")?.remove(); // its text follows the language
    stage.insertAdjacentHTML("beforeend", `<div class="hud-rotate"><span class="hud-ico">${D.deckIcon("swap")}</span>${tr("Turn your phone sideways")}</div>`);

    // Separate stores per canvas size, so phone and tablet keep their own page positions.
    const key = `${NS}-${W}x${H}`;
    const saved = (() => { try { return JSON.parse(D.store.get(key) || "{}"); } catch { return {}; } })();
    const state = { groups: saved.groups || {}, panels: saved.panels || {}, levels: saved.levels || {}, split: saved.split || 0, dials: saved.dials || {} };
    // Drawn controls that follow other buttons' presses (a slider's Max and Min), by button
    // id, and the ones Centre sliders puts back; both refilled at every redraw.
    const followers = new Map();
    let recentred = [];
    const save = () => D.store.set(key, JSON.stringify(state));

    // Fill the whole stage (which CSS keeps inside the safe area, clear of the iPhone's
    // Dynamic Island and home indicator). Text and icons scale uniformly by `s`; when the
    // screen's shape differs from the layout's, element boxes stretch along the longer
    // axis by kx/ky so there are no empty bands.
    let s = 1, kx = 1, ky = 1;
    const scaleNow = () => s;
    function measure() {
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
    const fit = () => { if (measure()) render(); };
    const turned = () => setTimeout(fit, 250);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", turned);
    measure();

    // Layout coordinates are in design pixels; place them on the stretched canvas.
    const box = (el, e) => {
      el.style.left = `${e.x * kx}px`;
      el.style.top = `${e.y * ky}px`;
      if (e.w !== undefined) el.style.width = `${e.w * kx}px`;
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
        el.innerHTML = `${icon}<span class="hud-lbl"></span>`;
        text(el, ".hud-lbl", def.label);
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
      divider: (e) => box(make("div", "hud-divider"), e),

      header: (e) => text(box(make("div", "hud-header", `<b>//</b><span></span>`), e), "span", e.text),

      "state-header"(e) {
        const values = Object.keys(e.labels);
        const cur = groupValue(e.group, values);
        const el = box(make("div", "hud-header state", `<div><b>//</b><span class="a"></span> <em>_ :${tr("ENABLED")}</em></div><div class="b"></div>`), e);
        text(el, ".a", e.labels[cur]);
        text(el, ".b", values.filter((v) => v !== cur).map((v) => e.labels[v]).join(" · "));
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
        const max = e.w * kx - 26;
        let start = null, pos = 0;
        const setPos = (p) => { pos = Math.max(0, Math.min(max, p)); knob.style.transform = `translateX(${pos}px)`; el.style.setProperty("--fill", `${(pos / max) * 100}%`); };
        knob.addEventListener("pointerdown", (ev) => {
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
      // centre, not the game's value, which SpoolUp can't read; Centre sliders sets it back
      // without pressing anything, and the buttons in "follows" (Max, Min, Reset All) move
      // it to the end or the centre when they're pressed.
      level(e) {
        const el = box(make("div", "hud-level",
          `<div class="lvl-read" aria-hidden="true"></div>
           <div class="lvl-track"><i class="lvl-zero"></i><i class="lvl-fill"></i><div class="lvl-knob"></div></div>
           <div class="lvl-cap"><span class="hud-ico">${e.icon ? D.deckIcon(e.icon) : ""}</span><span class="t"></span></div>`), e);
        el.dataset.color = e.color || "";
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
        text(el, ".t", e.label);
        ticks(el.querySelector(".lvl-track"), e.steps || 5, "x");
        if (D.placeControl) { D.placeControl(el, e); showLevel(el, e, 0); return el; }
        stepper(el, e, "x");
        return el;
      },

      // Puts every level slider and fader back in the centre. Sends nothing: they only count
      // what SpoolUp sent, so this is for when they no longer match the game.
      recentre(e) {
        const el = box(make("button", "hud-btn s-std s-recentre", `<span class="hud-ico">${D.deckIcon("power-reset")}</span><span class="hud-lbl"></span><span class="fx-state"></span>`), e);
        el.type = "button";
        text(el, ".hud-lbl", e.label || "Centre sliders");
        text(el, ".fx-state", "Sends no keys");
        el.title = tr("The sliders count the taps SpoolUp sent; SpoolUp can't read the game.");
        if (D.placeControl) { D.placeControl(el, e); return el; }
        el.addEventListener("click", () => {
          state.levels = {};
          save();
          window.DeckSound?.play("page");
          D.buzz?.();
          for (const fn of recentred) fn();
        });
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
    };


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
      // Travel towards `target`; settles when the time is up and the PC agrees, or after a
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
      // The knob starts travelling first, so a state that comes back at once (demo mode)
      // finds it on its way.
      const pull = (target) => {
        travel(target, false);
        if (!D.tapStep(b)) settle(actual);
      };

      // Drag the knob (or anywhere on the lever) along the slot.
      let drag = null;
      el.addEventListener("pointerdown", (ev) => {
        if (drag) return;
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
    // Tick marks at every step, the centre one longer.
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
      recentred.push(() => showLevel(el, e, 0));

      const along = (ev) => (axis === "y" ? -ev.clientY : ev.clientX);
      let drag = null;
      el.addEventListener("pointerdown", (ev) => {
        if (drag) return;
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
            // A tap on the track: one step towards it.
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
        const fn = R[e.type];
        if (fn) parent.appendChild(fn(e));
      }
    }

    // Set while paging, so the region's new panel slides in from that side.
    let slide = null;

    // Moves a region (one half of the HUD) d panels on, as its pager arrows do.
    function page(regionId, d) {
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

    function renderRegion(region) {
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
      renderElements(body, panel.elements);
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
      canvas.innerHTML = "";
      followers.clear();
      recentred = [];
      renderElements(canvas, layout.chrome || []);
      for (const region of layout.regions) canvas.appendChild(renderRegion(region));
      D.refreshStatus();
      if (D.afterRender) D.afterRender();
    }

    render();
    // The layout editor redraws after changing the layout, and asks which panels are showing.
    current = {
      render,
      panelShown: (regionId) => state.panels[regionId] || 0,
      // Pages the half at screen point (x, y), for the two-finger swipe; false if none is there.
      pageAt(x, y, d) {
        for (const el of canvas.querySelectorAll(".hud-region")) {
          const r = el.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { page(el.dataset.region, d); return true; }
        }
        return false;
      },
      // Pages each half to a panel by id, for a Stream Deck scene ({ left, right }), without
      // telling Stream Decks (that would page them back). Phone layouts name some panels
      // differently ("landing" for "power-landing", "emotes-1"), so a panel matches by its
      // id, a word of it, or its start. A half with no match stays.
      showPanels(want) {
        let changed = false;
        for (const region of layout.regions) {
          const id = want && want[region.id];
          if (!id) continue;
          const words = id.split("-");
          let idx = region.panels.indexOf(id);
          if (idx < 0) idx = region.panels.findIndex((p) => words.includes(p) || p.startsWith(id));
          if (idx < 0 || Math.min(state.panels[region.id] || 0, region.panels.length - 1) === idx) continue;
          state.panels[region.id] = idx;
          changed = true;
        }
        if (changed) { save(); render(); }
        return changed;
      },
      scale: scaleNow,
      // A button was pressed on this deck: controls that follow it update.
      pressed(id) { for (const fn of followers.get(id) || []) fn(); },
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
