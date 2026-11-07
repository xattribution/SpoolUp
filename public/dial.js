// The operator-mode dial (SpoolUp 2.1). The modes sit on the maker's own shape (a ring, a
// hex nut, a V, a crescent...), set per theme in makers.css as --dial-shape, and the dial
// keeps that shape's proportions inside its cell, centered, so it's never squished. The
// hub in the middle is its own button (SCM/NAV).
//
// Tapping a mode presses it as any button does. Dragging on the face aims at a mode and
// letting go is one tap of that mode (D.tapStep). The needle, or the lit spoke on the
// polygon shapes, shows the mode last picked on this deck, since SpoolUp can't see the
// game's.
//
// DeckDial.layout() is pure (no DOM), so tools can check the geometry under Node.
(function () {
  "use strict";
  const DW = (typeof window !== "undefined" && window.DeckWidgets) || null;

  const SHAPES = ["circle", "hex", "chevron", "octagon", "oval", "rect", "arc", "bloom", "crescent", "triangle", "sunrise", "diamond"];
  // Shapes that keep a needle; the others light the spoke from the hub to the mode.
  const NEEDLE = new Set(["circle", "oval", "hex", "octagon", "arc", "bloom"]);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rad = (d) => (d * Math.PI) / 180;

  // ---------- geometry, in unit coordinates (y down, angles clockwise from 3 o'clock) ----------

  // Points along an ellipse from angle a0 to a1 (degrees), inclusive.
  function ellipse(rx, ry, a0, a1, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = rad(a0 + ((a1 - a0) * i) / steps);
      pts.push([rx * Math.cos(a), ry * Math.sin(a)]);
    }
    return pts;
  }
  // A regular polygon's corners, the first at `start` degrees.
  const corners = (n, start, r = 1) => Array.from({ length: n }, (_, k) => {
    const a = rad(start + (k * 360) / n);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  // A closed outline that starts halfway along its first edge (a flat top's middle).
  const fromMid = (v) => [[(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2], ...v.slice(1), v[0]];
  function roundRect(a, r) {
    const pts = [[0, -1]];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const t = rad(a0 + i * 15); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
    corner(a - r, -1 + r, -90); corner(a - r, 1 - r, 0); corner(-a + r, 1 - r, 90); corner(-a + r, -1 + r, 180);
    return pts;
  }

  // Each shape: the rail the modes sit on (`line`, `closed` or open), the hub and its
  // radius, decorations (`deco`, polylines) and extra points the dial must leave room for.
  // `A` is the box's shape (width / height of the room for chips), so the open shapes can
  // stand taller in a narrow cell instead of crowding their chips.
  function shapeDef(shape, A) {
    switch (shape) {
      case "oval": return { line: ellipse(A, 1, -90, 270, 120), closed: true, hub: [0, 0], hubR: 0.48 };
      case "hex": return { line: corners(6, -90), closed: true, hub: [0, 0], hubR: 0.44 };
      case "octagon": return { line: fromMid(corners(8, -112.5)), closed: true, hub: [0, 0], hubR: 0.46 };
      case "rect": return { line: roundRect(A, 0.42), closed: true, hub: [0, 0], hubR: 0.5 };
      case "triangle": return { line: corners(3, -90).map(([x, y]) => [x * 1.08, y]), closed: true, hub: [0, 0.06], hubR: 0.33 };
      case "diamond": {
        const a = clamp(1.28 * A, 0.95, 1.28);
        return { line: [[0, -1], [a, 0], [0, 1], [-a, 0]], closed: true, hub: [0, 0], hubR: 0.4,
          deco: [[[0, -0.66], [0.13, -0.13], [0.84, 0], [0.13, 0.13], [0, 0.66], [-0.13, 0.13], [-0.84, 0], [-0.13, -0.13], [0, -0.66]]] };
      }
      case "chevron": {
        const a = clamp(1.6 * A, 0.75, 1.3);
        return { line: [[-a, -0.72], [0, 0.86], [a, -0.72]], closed: false, hub: [0, -0.46], hubR: 0.36 };
      }
      case "arc": return { line: ellipse(1, 1, 135, 405, 108), closed: false, hub: [0, 0], hubR: 0.46, deco: [[[-1.12, 0], [1.12, 0]]] };
      case "crescent": return { line: ellipse(1, 1, -52, -308, 108), closed: false, hub: [0.1, 0], hubR: 0.44, deco: [ellipse(0.78, 0.78, -64, -296, 90)] };
      case "sunrise": {
        const ry = clamp(1.4 / A, 1, 1.7);
        return { line: ellipse(1, ry, 180, 360, 90), closed: false, hub: [0, 0], hubR: 0.4, extra: [[0, 0.46]], deco: [[[-1.32, 0], [1.32, 0]]] };
      }
      case "bloom":
      case "circle":
      default: return { line: ellipse(1, 1, -90, 270, 120), closed: true, hub: [0, 0], hubR: shape === "bloom" ? 0.42 : 0.46 };
    }
  }

  // n points spread evenly along a polyline (by length): a closed rail gets n equal gaps,
  // an open one has a mode at each end.
  function spread(line, closed, n) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < line.length; i++) { const l = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); seg.push(l); total += l; }
    if (closed) { const l = Math.hypot(line[0][0] - line[line.length - 1][0], line[0][1] - line[line.length - 1][1]); if (l > 1e-6) { seg.push(l); total += l; } }
    const at = (d) => {
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) {
          const a = line[i], b = line[(i + 1) % line.length], t = seg[i] ? clamp(d / seg[i], 0, 1) : 0;
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        }
        d -= seg[i];
      }
      return line[0];
    };
    if (n <= 0) return [];
    if (!closed && n === 1) return [at(total / 2)];
    return Array.from({ length: n }, (_, k) => at(closed ? (k * total) / n : (k * total) / (n - 1)));
  }

  const DeckDial = {
    SHAPES,
    NEEDLE,
    // The dial in a w x h box: { shape, needle, aspect, d (mode chip size), hub: {x, y, r},
    // chips: [{ x, y, angle }], path (the rail), deco: [paths] }, all in box pixels.
    // `labelH` leaves room under the chips for their names; `chipW` makes chips that many
    // times wider than tall.
    layout(shape, n, w, h, labelH = 0, chipW = 1) {
      if (!SHAPES.includes(shape)) shape = "circle";
      let d = clamp(Math.min(w, h) * 0.2, 44, 72);
      let def, pts, s, bx0, by0, bw, bh;
      for (let pass = 0; pass < 4; pass++) {
        const aw = Math.max(1, w - d * chipW), ah = Math.max(1, h - d - labelH);
        const boxA = aw / ah;
        def = shapeDef(shape, ["oval", "rect"].includes(shape) ? clamp(boxA, 1.25, 1.6) : clamp(boxA, 0.5, 2));
        pts = spread(def.line, def.closed, n);
        const all = [...def.line, ...(def.extra || []),
          [def.hub[0] - def.hubR, def.hub[1] - def.hubR], [def.hub[0] + def.hubR, def.hub[1] + def.hubR]];
        bx0 = Math.min(...all.map((p) => p[0])); by0 = Math.min(...all.map((p) => p[1]));
        bw = Math.max(...all.map((p) => p[0])) - bx0; bh = Math.max(...all.map((p) => p[1])) - by0;
        s = Math.min(aw / bw, ah / bh);
        // Neighboring chips mustn't touch: smaller chips on a crowded rail, down to 40 px.
        let gap = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          if (!def.closed && j === 0) break;
          if (i !== j) gap = Math.min(gap, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * s);
        }
        if (!(gap < d * chipW * 1.1) || d <= 40) break;
        d = Math.max(40, gap / chipW / 1.1);
      }
      const ox = (w - bw * s) / 2 - bx0 * s, oy = (h - labelH - bh * s) / 2 - by0 * s;
      const map = ([x, y]) => [ox + x * s, oy + y * s];
      const [hx, hy] = map(def.hub);
      const chips = pts.map((p) => { const [x, y] = map(p); return { x, y, angle: (Math.atan2(y - hy, x - hx) * 180) / Math.PI }; });
      const near = chips.reduce((m, c) => Math.min(m, Math.hypot(c.x - hx, c.y - hy)), Infinity);
      const r = Math.max(22, Math.min(clamp(def.hubR * s, 26, 64), near - (d * chipW) / 2 - 6));
      const poly = (line, closed) => line.map((p, i) => { const [x, y] = map(p); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + (closed ? "Z" : "");
      return {
        shape, needle: NEEDLE.has(shape), aspect: bw / bh, d, s,
        hub: { x: hx, y: hy, r },
        chips,
        path: poly(def.line, def.closed),
        deco: (def.deco || []).map((l) => poly(l, false)),
      };
    },
  };

  // ---------- the widget ----------

  // Only the mutation of a shared memory is done once per press: a dial shown twice (a ref
  // on a dashboard) hears every press twice.
  const seen = new Set();
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); setTimeout(() => seen.delete(k), 0); return true; };
  const before = new Map(); // dial id -> the mode before the last pick, if the PC skips it

  function render(e, ctx) {
    const { D, make, tr } = ctx;
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const canvas = document.getElementById("canvas") || document.documentElement;
    const cs = getComputedStyle(canvas);
    const shape = (cs.getPropertyValue("--dial-shape") || "").trim().replace(/["']/g, "") || "circle";
    // A maker's chips can be wider than tall (pills, cargo modules): --dial-chip-w.
    const chipW = clamp(parseFloat(cs.getPropertyValue("--dial-chip-w")) || 1, 1, 1.6);
    const opts = Array.isArray(e.options) ? e.options : [];
    const labelH = small ? 0 : 16;
    const g = DeckDial.layout(shape, opts.length, W, H, labelH, chipW);
    const el = make("div", `hud-dial dl-${g.shape}${g.needle ? " dl-needled" : " dl-spoked"}`);
    el.dataset.shape = g.shape;
    el.style.setProperty("--chip", `${g.d}px`);
    el.style.setProperty("--hub", `${g.hub.r * 2}px`);

    const spokes = g.needle ? "" : g.chips.map((c, i) => {
      const len = Math.hypot(c.x - g.hub.x, c.y - g.hub.y), k = (len - g.d / 2 - 2) / len, k0 = (g.hub.r + 3) / len;
      return `<line class="dl-spoke" data-i="${i}" x1="${(g.hub.x + (c.x - g.hub.x) * k0).toFixed(1)}" y1="${(g.hub.y + (c.y - g.hub.y) * k0).toFixed(1)}" x2="${(g.hub.x + (c.x - g.hub.x) * k).toFixed(1)}" y2="${(g.hub.y + (c.y - g.hub.y) * k).toFixed(1)}"/>`;
    }).join("");
    const ticks = g.chips.map((c) => {
      const len = Math.hypot(c.x - g.hub.x, c.y - g.hub.y) || 1, ux = (c.x - g.hub.x) / len, uy = (c.y - g.hub.y) / len;
      const a = g.d / 2 + 3, b = g.d / 2 + 9;
      return `<line class="dl-tick" x1="${(c.x + ux * a).toFixed(1)}" y1="${(c.y + uy * a).toFixed(1)}" x2="${(c.x + ux * b).toFixed(1)}" y2="${(c.y + uy * b).toFixed(1)}"/>`;
    }).join("");
    el.innerHTML = `<svg class="dl-art" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" aria-hidden="true">
      <path class="dl-face" d="${g.path}"/>${g.deco.map((d) => `<path class="dl-deco" d="${d}"/>`).join("")}
      <path class="dl-rail" d="${g.path}"/>${ticks}${spokes}
      <circle class="dl-collar" cx="${g.hub.x.toFixed(1)}" cy="${g.hub.y.toFixed(1)}" r="${(g.hub.r + 5).toFixed(1)}"/></svg>
      ${g.needle ? `<i class="dl-needle"></i>` : ""}`;
    const needle = el.querySelector(".dl-needle");
    if (needle) Object.assign(needle.style, { left: `${g.hub.x}px`, top: `${g.hub.y}px` });

    // Names under the chips only where neighbors leave room for them; the hub always says
    // which mode is picked.
    let spacing = Infinity;
    g.chips.forEach((c, i) => g.chips.forEach((o, j) => { if (j > i) spacing = Math.min(spacing, Math.hypot(c.x - o.x, c.y - o.y)); }));
    const roomy = !small && spacing >= g.d * chipW * 1.75;
    const chips = opts.map((o, i) => {
      const c = g.chips[i];
      const b = ctx.hudButton(o, "std");
      b.classList.add("dl-chip");
      b.style.setProperty("--rot", `${(c.angle + 90).toFixed(1)}deg`);
      Object.assign(b.style, { left: `${c.x - (g.d * chipW) / 2}px`, top: `${c.y - g.d / 2}px`, width: `${g.d * chipW}px`, height: `${g.d}px` });
      el.appendChild(b);
      if (roomy) {
        const cap = make("span", "dl-cap");
        cap.textContent = tr(o.label);
        cap.setAttribute("aria-hidden", "true");
        Object.assign(cap.style, { left: `${c.x - g.d * 0.85}px`, top: `${c.y + g.d / 2 + 2}px`, width: `${g.d * 1.7}px` });
        el.appendChild(cap);
      }
      return b;
    });
    let hub = null;
    if (e.hub) {
      hub = ctx.hudButton(e.hub, "std");
      hub.classList.add("dl-hub");
      hub.insertAdjacentHTML("beforeend", `<span class="dl-now" aria-hidden="true"></span>`);
      Object.assign(hub.style, { left: `${g.hub.x - g.hub.r}px`, top: `${g.hub.y - g.hub.r}px`, width: `${g.hub.r * 2}px`, height: `${g.hub.r * 2}px` });
      el.appendChild(hub);
    }
    if (ctx.editing) { ctx.place(el, e); paint(-1, -1); return el; }

    const mem = ctx.mem(e);
    const current = () => opts.findIndex((o) => o.id === mem.mode);
    function point(i, angle) {
      if (needle) {
        const c = g.chips[i] || null;
        const a = angle !== undefined ? angle : c ? c.angle : -90;
        const len = c ? Math.hypot(c.x - g.hub.x, c.y - g.hub.y) - g.d / 2 - 3 : Math.min(W, H) / 3;
        needle.style.width = `${Math.max(8, len)}px`;
        needle.style.transform = `rotate(${a}deg)`;
      }
    }
    function paint(on, aim) {
      chips.forEach((b, j) => { b.classList.toggle("dl-on", j === on); b.classList.toggle("dl-aim", j === aim); });
      el.querySelectorAll(".dl-spoke").forEach((s, j) => { s.classList.toggle("on", j === on); s.classList.toggle("aim", j === aim); });
      el.querySelectorAll(".dl-cap").forEach((s, j) => s.classList.toggle("on", j === on));
      el.classList.toggle("unset", on < 0);
      if (hub) hub.querySelector(".dl-now").textContent = on >= 0 ? tr(opts[on].label) : "";
    }
    const show = (aim = -1) => { const i = current(); paint(i, aim); if (aim < 0) point(i); };

    // A mode pressed on this deck (its chip, the drag, or the same button elsewhere) is
    // the one the dial shows.
    opts.forEach((o) => ctx.follow(o.id, () => {
      if (once(`${e.id}:${o.id}`) && mem.mode !== o.id) { before.set(e.id, mem.mode || null); mem.mode = o.id; ctx.save(); }
      show();
    }));
    D.bindControl(el, {
      ids: opts.map((o) => o.id),
      // A pick the PC skipped (Star Citizen not in front) didn't happen.
      deny(id) {
        if (mem.mode === id && once(`${e.id}:deny:${id}`)) { mem.mode = before.get(e.id) || null; ctx.save(); }
        show();
        el.classList.remove("denied"); void el.offsetWidth; el.classList.add("denied");
      },
    });

    // Turning: drag on the face (away from the chips and the hub) to aim, let go to pick.
    const angleAt = (ev) => {
      const r = el.getBoundingClientRect(), s = ctx.scale();
      return (Math.atan2((ev.clientY - r.top) / s - g.hub.y, (ev.clientX - r.left) / s - g.hub.x) * 180) / Math.PI;
    };
    const nearest = (a) => {
      let best = -1, bestD = 999;
      g.chips.forEach((c, i) => { const dd = Math.abs(((a - c.angle + 540) % 360) - 180); if (dd < bestD) { bestD = dd; best = i; } });
      return best;
    };
    let turn = null;
    el.addEventListener("pointerdown", (ev) => {
      if (turn || ctx.swiping() || ev.target.closest(".hud-btn") || ev.button > 0) return;
      try { el.setPointerCapture(ev.pointerId); } catch { /* already gone */ }
      turn = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false, aim: -1 };
      el.classList.add("turning");
    });
    el.addEventListener("pointermove", (ev) => {
      if (!turn || ev.pointerId !== turn.id) return;
      if (!turn.moved && Math.hypot(ev.clientX - turn.x, ev.clientY - turn.y) / ctx.scale() < 10) return;
      turn.moved = true;
      const a = angleAt(ev);
      turn.aim = nearest(a);
      paint(current(), turn.aim);
      point(turn.aim, a);
    });
    const end = (ev) => {
      if (!turn || ev.pointerId !== turn.id) return;
      const t = turn;
      turn = null;
      el.classList.remove("turning");
      if (ev.type === "pointerup" && t.moved && !ctx.swiping() && t.aim >= 0 && t.aim !== current()) {
        const b = chips[t.aim];
        if (D.tapStep(opts[t.aim])) {
          b.classList.add("pressed");
          setTimeout(() => b.classList.remove("pressed"), 160);
        }
      }
      show();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());

    // From a keyboard: the arrows aim, Enter or Space picks the mode aimed at.
    let keyAim = -1;
    el.tabIndex = 0;
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", `${tr(e.label || "Operator mode")}. ${tr("Arrow keys aim, Enter picks")}`);
    el.addEventListener("keydown", (ev) => {
      if (ev.target !== el || !opts.length) return;
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (dir) {
        ev.preventDefault();
        const from = keyAim >= 0 ? keyAim : Math.max(0, current());
        keyAim = (from + dir + opts.length) % opts.length;
        paint(current(), keyAim);
        point(keyAim);
      } else if ((ev.key === "Enter" || ev.key === " ") && !ev.repeat && keyAim >= 0) {
        ev.preventDefault();
        if (keyAim !== current()) D.tapStep(opts[keyAim]);
        keyAim = -1;
        show();
      }
    });
    el.addEventListener("blur", () => { keyAim = -1; show(); });
    show();
    return el;
  }

  if (DW) {
    DW.register("rotary", {
      label: "Mode dial",
      category: "flight",
      icon: "scm-nav",
      spans: { small: [6, 5], large: [6, 6] },
      min: [4, 4], max: [12, 8],
      drag: "xy",
      buttons: (e) => [...(e.hub ? [["Hub", e.hub]] : []), ...(e.options || []).map((o) => [o.label, o])],
      render,
    });
  }
  if (typeof window !== "undefined") window.DeckDial = DeckDial;
  if (typeof module !== "undefined" && module.exports) module.exports = { DeckDial };
})();
