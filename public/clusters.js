// Cockpit clusters (SpoolUp 2.1): each grouping of controls drawn as one instrument you can
// place on any panel or dashboard. Shields, targeting, the hull's lights and doors, the
// turret seats, countermeasures, the quantum spool, the mining head, the salvage head and
// the switch banks.
//
// The rule that holds for all of them: every gesture step is one tap of one existing
// button. A tap on a part sends its button once, on lift, when the finger stayed put and
// no page swipe took the touch. A drag that steps sends one tap per step, at most
// ctx.steps.PER_DRAG per drag and ctx.steps.GAP_MS apart. Timers only ever change the
// picture (a cover dropping, a ring filling). The art shows what SpoolUp sent ("steps
// sent"), never a reading of the game, which SpoolUp can't see.
//
// Parts that are plain buttons are real bound buttons (ctx.hudButton). Parts that are
// shapes (a shield arc, a reticle corner) are zones: role="button", a translated label,
// and Enter or Space from a keyboard.
//
// Registering touches no page, so tools/check-grid.js can load this under Node.
(function () {
  "use strict";
  const DW = (typeof window !== "undefined" && window.DeckWidgets) || null;
  if (!DW) return;

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rad = (d) => (d * Math.PI) / 180;
  const f1 = (n) => n.toFixed(1);
  const put = (el, x, y, w, h) => {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    return el;
  };

  // A widget shown twice (a ref on a dashboard) hears every press twice; what it remembers
  // changes once per press.
  const seen = new Set();
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); setTimeout(() => seen.delete(k), 0); return true; };

  // How the theme draws arcs: smooth curves, or straight facets (--arc-style in makers.css),
  // and the gap between an arc's segments in degrees.
  function looks() {
    const cs = getComputedStyle(document.getElementById("canvas") || document.documentElement);
    const style = (cs.getPropertyValue("--arc-style") || "").trim().replace(/["']/g, "");
    return { facet: style === "facet", gap: parseFloat(cs.getPropertyValue("--arc-gap")) || 5 };
  }

  // An arc (or its facet) from a0 to a1 degrees, clockwise from 3 o'clock.
  function arcPath(cx, cy, r, a0, a1, facet) {
    const p = (a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    if (facet) return `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
    return `M${f1(x0)} ${f1(y0)}A${f1(r)} ${f1(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
  }
  // A ring: a circle, or a polygon of `sides` facets.
  function ringPath(cx, cy, r, facet, sides = 16) {
    if (!facet) return `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
    let d = "";
    for (let k = 0; k <= sides; k++) { const a = rad(-90 + 180 / sides + (k * 360) / sides); d += `${k ? "L" : "M"}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`; }
    return `${d}Z`;
  }
  // `n` segments of an arc centered on `mid` degrees, `span` wide: each its own path, so a
  // count can light the first few.
  function segments(cx, cy, r, mid, span, n, look, cls) {
    const each = (span - look.gap * (n - 1)) / n;
    let out = "";
    for (let i = 0; i < n; i++) {
      const a0 = mid - span / 2 + i * (each + look.gap);
      out += `<path class="${cls}" data-k="${i}" d="${arcPath(cx, cy, r, a0, a0 + each, look.facet)}"/>`;
    }
    return out;
  }

  // Ship silhouettes, in a 100 x 100 box: from above (nose up) and from the side (nose
  // right), for the shields.
  const SHIP_TOP = "M50 6L55 26L58 40L84 58L88 70L60 64L58 78L67 87L66 93L50 89L34 93L33 87L42 78L40 64L12 70L16 58L42 40L45 26Z";
  const SHIP_SIDE = "M4 56L18 50L34 47L46 36L62 36L72 45L90 50L97 54L92 58L70 62L22 63L8 61Z";
  const SHIP_SIDE_FIN = "M14 50L10 36L20 36L28 48Z";
  const ship = (d, x, y, w, h, cls = "cl-ship") => `<path class="${cls}" transform="translate(${f1(x)} ${f1(y)}) scale(${f1(w / 100)} ${f1(h / 100)})" d="${d}"/>`;

  // ---------- shared plumbing ----------

  // A shape that is a part of a cluster: a zone with a label and a keyboard path.
  function zone(ctx, parent, cls, label, ids, fn) {
    const z = ctx.make("div", `cl-zone ${cls}`);
    z.dataset.zone = cls;
    if (ids) z.dataset.for = [].concat(ids).join(" ");
    if (label) {
      z.setAttribute("role", "button");
      z.setAttribute("aria-label", ctx.tr(label));
      z.title = ctx.tr(label);
      z.tabIndex = 0;
    }
    z._tap = fn;
    if (fn && !ctx.editing) {
      z.addEventListener("keydown", (ev) => {
        if ((ev.key === "Enter" || ev.key === " ") && !ev.repeat) { ev.preventDefault(); ev.stopPropagation(); fn(); }
      });
    }
    parent.appendChild(z);
    return z;
  }
  const hit = (z) => {
    if (!z) return;
    z.classList.remove("cl-hit"); void z.offsetWidth; z.classList.add("cl-hit");
    clearTimeout(z._ht);
    z._ht = setTimeout(() => z.classList.remove("cl-hit"), 220);
  };
  const flash = (z) => { if (z) { z.classList.remove("denied"); void z.offsetWidth; z.classList.add("denied"); } };

  // One tap of `btn`, shown on `z`. Returns whether it went (offline it doesn't).
  const send = (ctx, btn, z) => {
    if (!btn || !ctx.D.tapStep(btn)) return false;
    hit(z);
    return true;
  };

  // Touch, pen and mouse on a cluster: a tap on a zone runs its action on lift; a drag
  // goes to spec.drag(zone, axis), which returns { move(dx, dy), end(dx, dy, ok) }.
  // The axis locks after 12 px. A touch a page swipe took (pointercancel, or
  // ctx.swiping() on lift) does nothing. Bound buttons inside press themselves.
  function track(root, ctx, spec = {}) {
    let p = null;
    const delta = (ev) => { const s = ctx.scale() || 1; return [(ev.clientX - p.x) / s, (ev.clientY - p.y) / s]; };
    root.addEventListener("pointerdown", (ev) => {
      if (p || ev.button > 0 || ctx.swiping() || ev.target.closest(".hud-btn, .cl-cover")) return;
      const z = ev.target.closest("[data-zone]");
      p = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, z, moved: false, drag: null };
      try { root.setPointerCapture(ev.pointerId); } catch { /* the element went */ }
      if (z) z.classList.add("cl-down");
    });
    root.addEventListener("pointermove", (ev) => {
      if (!p || ev.pointerId !== p.id) return;
      const [dx, dy] = delta(ev);
      if (!p.moved && Math.hypot(dx, dy) >= 12) {
        p.moved = true;
        if (p.z) p.z.classList.remove("cl-down");
        p.drag = spec.drag ? spec.drag(p.z, Math.abs(dx) >= Math.abs(dy) ? "x" : "y") : null;
        if (p.drag) root.classList.add("cl-dragging");
      }
      if (p.drag && p.drag.move) p.drag.move(dx, dy);
    });
    const end = (ev) => {
      if (!p || ev.pointerId !== p.id) return;
      const q = p;
      const [dx, dy] = delta(ev);
      p = null;
      root.classList.remove("cl-dragging");
      if (q.z) q.z.classList.remove("cl-down");
      const ok = ev.type === "pointerup" && !ctx.swiping();
      if (q.drag) { if (q.drag.end) q.drag.end(dx, dy, ok); return; }
      if (ok && !q.moved && q.z && q.z._tap) q.z._tap();
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }

  // Steps along a drag: one call of step(dir) each time the finger passes another `per`
  // canvas px, one per move event, at most PER_DRAG per drag and GAP_MS apart. step()
  // returns false when nothing went (offline): the drag then sends no more.
  function stepper(ctx, per, step) {
    let base = 0, sent = 0, last = 0;
    return (along) => {
      const want = Math.trunc(along / per);
      if (want === base || sent >= ctx.steps.PER_DRAG) return;
      const now = performance.now();
      if (now - last < ctx.steps.GAP_MS) return;
      const dir = want > base ? 1 : -1;
      if (!step(dir)) { sent = ctx.steps.PER_DRAG; return; }
      base += dir; sent++; last = now;
    };
  }

  // A state group drawn on a part (lights on, doors open): show(on) with Button lights.
  function lit(ctx, el, group, fn) {
    if (!group) return;
    ctx.D.bindControl(el, { group, show(on, animate, lights) { fn(Boolean(on), lights !== false); } });
  }

  // Deny flashes for zones: a press the PC skipped flashes the zones that sent it, and
  // `undo(id)` takes back what it changed.
  function denials(ctx, root, ids, undo) {
    ctx.D.bindControl(root, {
      ids: ids.filter(Boolean),
      deny(id) {
        for (const z of root.querySelectorAll("[data-for]")) if (z.dataset.for.split(" ").includes(id)) flash(z);
        if (undo) undo(id);
      },
    });
  }

  const svg = (W, H, inner) => `<svg class="cl-art" viewBox="0 0 ${f1(W)} ${f1(H)}" aria-hidden="true">${inner}</svg>`;
  const button = (ctx, parent, def, cls, x, y, w, h, style) => {
    if (!def) return null;
    const b = ctx.hudButton(def, style || "std");
    b.classList.add("cl-btn");
    if (cls) for (const c of cls.split(" ")) b.classList.add(c);
    put(b, x, y, w, h);
    parent.appendChild(b);
    return b;
  };
  const idsOf = (...defs) => defs.flat().filter((d) => d && typeof d.id === "string").map((d) => d.id);

  // ---------- shields ----------

  // Top-down ship ringed by four arcs (front, right, back, left), a side view with the top
  // and bottom arcs, and an outer ring that is the power switch. Slide a finger toward a
  // face to shift strength there, one tap of that face per step; tap a face for one; tap
  // the ship to reset; tap the ring for power. Each face shows its taps since the reset.
  const FACES = [["front", -90], ["right", 0], ["back", 90], ["left", 180]];
  const FACE_LABEL = { front: "Shields front", back: "Shields back", left: "Shields left", right: "Shields right", top: "Shields top", bottom: "Shields bottom" };

  function shields(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const faces = e.faces || {};
    const look = looks();
    const root = ctx.make("div", "cl-cluster cl-shields");
    const g = small ? 6 : 10;
    // The side view sits beside the main ring on a wide box, under it on a tall one.
    const wide = W >= H;
    const sideW = wide ? clamp(W * 0.22, 52, 120) : W, sideH = wide ? H : clamp(H * 0.22, 48, 100);
    const mw = wide ? W - sideW - g : W, mh = wide ? H : H - sideH - g;
    const S = Math.max(40, Math.min(mw, mh));
    const cx = mw / 2, cy = mh / 2, R = S / 2 - 2;
    const band = clamp(S * 0.075, 12, 26);
    const ra = R - band - (small ? 8 : 12);
    const shipR = clamp(ra * 0.42, 18, 90);
    const gx = wide ? mw + g : 0, gy = wide ? 0 : mh + g;

    const mem = ctx.editing ? {} : ctx.mem(e);
    if (!mem.counts || typeof mem.counts !== "object") mem.counts = {};
    const count = (f) => clamp(Number(mem.counts[f]) || 0, 0, 99);

    const sideShip = { w: Math.min(sideW * 0.86, sideH * 1.6), h: 0 };
    sideShip.h = sideShip.w * 0.42;
    const sx = gx + (sideW - sideShip.w) / 2, sy = gy + (sideH - sideShip.h) / 2;
    const sideArcR = sideShip.w * 0.62;
    const sideArc = (top) => {
      // A flat arc over (or under) the side view, in five segments.
      const ccx = sx + sideShip.w / 2, ccy = top ? sy + sideShip.h / 2 + sideArcR * 0.62 : sy + sideShip.h / 2 - sideArcR * 0.62;
      return segments(ccx, ccy, sideArcR, top ? -90 : 90, 70, 5, look, `cl-seg f-${top ? "top" : "bottom"}`);
    };

    root.innerHTML = svg(W, H, `
      <path class="cl-ring-track" d="${ringPath(cx, cy, R - band / 2, look.facet)}" style="stroke-width:${f1(band)}px"/>
      <path class="cl-ring" d="${ringPath(cx, cy, R - band / 2, look.facet)}" style="stroke-width:${f1(band * 0.5)}px"/>
      <g class="cl-power-glyph" transform="translate(${f1(cx)} ${f1(cy + R - band / 2)})"><path d="M-4.5 -3.2A5.5 5.5 0 1 0 4.5 -3.2M0 -6V0"/></g>
      ${FACES.map(([f, mid]) => `<path class="cl-guide f-${f}" d="${arcPath(cx, cy, ra + (small ? 9 : 13), mid - 30, mid + 30, look.facet)}"/>${segments(cx, cy, ra, mid, 64, 5, look, `cl-seg f-${f}`)}`).join("")}
      <circle class="cl-hull-ring" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(shipR)}"/>
      ${ship(SHIP_TOP, cx - shipR * 0.78, cy - shipR * 0.78, shipR * 1.56, shipR * 1.56)}
      <g class="cl-side">${ship(SHIP_SIDE, sx, sy - sideShip.h * 0.18, sideShip.w, sideShip.h * 1.36)}${ship(SHIP_SIDE_FIN, sx, sy - sideShip.h * 0.18, sideShip.w, sideShip.h * 1.36)}
      ${sideArc(true)}${sideArc(false)}</g>`);

    const ring = put(zone(ctx, root, "cl-power", "Shields on and off", e.power && e.power.id, () => send(ctx, e.power, ring)), cx - R, cy - R, R * 2, R * 2);
    const faceZones = {};
    for (const [f, mid] of FACES) {
      const z = put(zone(ctx, root, `cl-face f-${f}`, FACE_LABEL[f], faces[f] && faces[f].id, () => send(ctx, faces[f], z)), cx - (R - band), cy - (R - band), (R - band) * 2, (R - band) * 2);
      // Each face's zone is the quarter of the inner disc toward it.
      const pts = { front: "50% 50%, 0 0, 100% 0", right: "50% 50%, 100% 0, 100% 100%", back: "50% 50%, 100% 100%, 0 100%", left: "50% 50%, 0 100%, 0 0" }[f];
      z.style.clipPath = `polygon(${pts})`;
      z.dataset.mid = String(mid);
      faceZones[f] = z;
    }
    const hull = put(zone(ctx, root, "cl-reset", "Reset shields", e.reset && e.reset.id, () => send(ctx, e.reset, hull)), cx - shipR, cy - shipR, shipR * 2, shipR * 2);
    const topZ = put(zone(ctx, root, "cl-face f-top cl-side-zone", FACE_LABEL.top, faces.top && faces.top.id, () => send(ctx, faces.top, topZ)), gx, gy, sideW, sideH / 2);
    const botZ = put(zone(ctx, root, "cl-face f-bottom cl-side-zone", FACE_LABEL.bottom, faces.bottom && faces.bottom.id, () => send(ctx, faces.bottom, botZ)), gx, gy + sideH / 2, sideW, sideH / 2);
    faceZones.top = topZ; faceZones.bottom = botZ;

    const paint = () => {
      for (const f of Object.keys(FACE_LABEL)) {
        const n = count(f);
        root.querySelectorAll(`.cl-seg.f-${f}`).forEach((s) => s.classList.toggle("on", Number(s.dataset.k) < n));
        root.style.setProperty(`--n-${f}`, String(Math.min(n, 5)));
        if (faceZones[f]) faceZones[f].setAttribute("aria-description", ctx.tr("{0} steps sent", String(n)));
      }
    };
    lit(ctx, ring, e.power && e.power.state && e.power.state.group, (on, lights) => root.classList.toggle("powered", on && lights));
    paint();
    if (ctx.editing) { ctx.place(root, e); return root; }

    // Every tap of a face on this deck counts, from here or from anywhere else.
    for (const f of Object.keys(FACE_LABEL)) {
      const b = faces[f];
      if (!b) continue;
      ctx.follow(b.id, () => { if (once(`${e.id}:${b.id}`)) { mem.counts[f] = count(f) + 1; ctx.save(); } paint(); });
    }
    if (e.reset) ctx.follow(e.reset.id, () => { if (once(`${e.id}:${e.reset.id}`)) { mem.counts = {}; ctx.save(); } paint(); });
    const byId = {};
    for (const f of Object.keys(FACE_LABEL)) if (faces[f]) byId[faces[f].id] = f;
    denials(ctx, root, idsOf(Object.values(faces), e.reset, e.power), (id) => {
      const f = byId[id];
      if (f && once(`${e.id}:deny:${id}`)) { mem.counts[f] = Math.max(0, count(f) - 1); ctx.save(); }
      paint();
    });

    const per = small ? 28 : 36;
    track(root, ctx, {
      drag(z, axis) {
        if (z === ring) return null;
        if (z === topZ || z === botZ) {
          if (axis !== "y") return null;
          const go = stepper(ctx, per, (dir) => send(ctx, dir > 0 ? faces.top : faces.bottom, dir > 0 ? topZ : botZ));
          return { move: (dx, dy) => go(-dy) };
        }
        const go = stepper(ctx, per, (dir) => {
          const f = axis === "y" ? (dir > 0 ? "front" : "back") : (dir > 0 ? "right" : "left");
          return send(ctx, faces[f], faceZones[f]);
        });
        return { move: (dx, dy) => go(axis === "y" ? -dy : dx) };
      },
    });
    // From a keyboard on the cluster itself: arrows for the faces, Page Up and Page Down
    // for top and bottom, Enter resets, Space toggles power.
    root.tabIndex = 0;
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", `${ctx.tr("Shields")}. ${ctx.tr("Arrow keys shift shields, Enter resets, Space turns them on or off")}`);
    root.addEventListener("keydown", (ev) => {
      if (ev.target !== root || ev.repeat) return;
      const f = { ArrowUp: "front", ArrowDown: "back", ArrowLeft: "left", ArrowRight: "right", PageUp: "top", PageDown: "bottom" }[ev.key];
      if (f) { ev.preventDefault(); send(ctx, faces[f], faceZones[f]); }
      else if (ev.key === "Enter") { ev.preventDefault(); send(ctx, e.reset, hull); }
      else if (ev.key === " ") { ev.preventDefault(); send(ctx, e.power, ring); }
    });
    return root;
  }

  // ---------- targeting ----------

  // A reticle between two columns of cycle buttons: attackers and anything on the left,
  // friendlies and what's in view on the right, the previous and next hostile between
  // them. The center pip (or a swipe right across the reticle) is the next hostile, a
  // swipe left the previous one; the inner ring cycles sub-targets. On a box taller than
  // wide the cycles sit in a row above and below the reticle instead.
  const GLYPH = {
    attacker: `<path d="M24 5 43 24 24 43 5 24Z"/><path d="M24 15v12M24 33v.5"/>`,
    friendly: `<circle cx="24" cy="24" r="17"/><path d="m15 25 6.5 6.5L34 18"/>`,
    any: `<rect x="8" y="8" width="32" height="32" rx="4"/><circle cx="24" cy="24" r="5"/>`,
    view: `<path d="M4 24c7-12 33-12 40 0-7 12-33 12-40 0Z"/><circle cx="24" cy="24" r="6.5"/>`,
    fewer: `<path d="M8 33 27 14l7-2-2 7-19 19Z"/><path d="m12 29-5-.5 3.5-3.5M19 36l.5 5 3.5-3.5" opacity=".65"/><path d="M33 37h11"/>`,
    pips: `<circle cx="19" cy="29" r="11"/><path d="M19 22.5v-3M19 38.5v-3M12.5 29h-3M28.5 29h-3" opacity=".65"/><path d="m27 21 6-5" stroke-dasharray="2 3"/><circle cx="37.5" cy="12.5" r="4.5" fill="currentColor" stroke="none"/>`,
    open: `<path d="M24 9v30" opacity=".5"/><path d="M19 24H6m0 0 5-5m-5 5 5 5M29 24h13m0 0-5-5m5 5-5 5"/>`,
    close: `<path d="M24 9v30" opacity=".5"/><path d="M6 24h13m0 0-5-5m5 5-5 5M42 24H29m0 0 5-5m-5 5 5 5"/>`,
  };
  const glyphSvg = (k) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${GLYPH[k]}</svg>`;
  // A button's visible word, and its picture where the layout kept the HUD's own icon
  // (several parts share one, like every targeting cycle's crosshair); the button's name,
  // title and voice phrase stay its full label.
  function face(b, ctx, word, glyph, keepIcon) {
    if (!b) return b;
    const lbl = b.querySelector(".hud-lbl");
    if (lbl && word) lbl.textContent = ctx.tr(word);
    const ico = b.querySelector(".hud-ico");
    if (ico && glyph && GLYPH[glyph] && !keepIcon) ico.innerHTML = glyphSvg(glyph);
    return b;
  }

  const CORNERS = [["attacker", "Attacker", "target"], ["friendly", "Friendly", "target"], ["any", "Any", "target"], ["view", "In view", "target"]];

  function targeting(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const look = looks();
    const corners = e.corners || {};
    const root = ctx.make("div", "cl-cluster cl-targeting");
    const g = small ? 6 : 10;
    const side = W >= H * 1.2; // columns beside the reticle; else rows above and below it
    const tile = (k, x, y, w, h) => {
      const def = corners[k];
      const meta = CORNERS.find(([n]) => n === k);
      const b = button(ctx, root, def, `cl-cycle c-${k}`, x, y, w, h);
      return face(b, ctx, meta[1], k, def && def.icon && def.icon !== meta[2]);
    };
    let rx, ry, rw, rh; // the reticle's area
    if (side) {
      const cw = clamp(W * 0.26, 64, 170);
      const th = clamp((H - 2 * g) * 0.34, 44, 120);
      const mh = H - 2 * th - 2 * g;
      tile("attacker", 0, 0, cw, th);
      tile("any", 0, H - th, cw, th);
      tile("friendly", W - cw, 0, cw, th);
      tile("view", W - cw, H - th, cw, th);
      face(button(ctx, root, e.prev, "cl-hostile h-prev", 0, th + g, cw, mh), ctx, null, null, true);
      face(button(ctx, root, e.next, "cl-hostile h-next", W - cw, th + g, cw, mh), ctx, null, null, true);
      rx = cw + g; ry = 0; rw = W - 2 * (cw + g); rh = H;
    } else {
      // A tall box (a phone held upright) gives the spare height to the cycle buttons.
      const th = clamp(Math.max(H * 0.16, (H - W) / 2 - g), 44, 130);
      const hw = (W - g) / 2;
      tile("attacker", 0, 0, hw, th);
      tile("friendly", hw + g, 0, hw, th);
      tile("any", 0, H - th, hw, th);
      tile("view", hw + g, H - th, hw, th);
      const mh = H - 2 * th - 2 * g;
      const sw = clamp(W * 0.17, 44, 92), sh = clamp(mh * 0.62, 44, mh);
      face(button(ctx, root, e.prev, "cl-hostile h-prev narrow", 0, th + g + (mh - sh) / 2, sw, sh), ctx, null, null, true);
      face(button(ctx, root, e.next, "cl-hostile h-next narrow", W - sw, th + g + (mh - sh) / 2, sw, sh), ctx, null, null, true);
      rx = sw + g; ry = th + g; rw = W - 2 * (sw + g); rh = mh;
    }
    for (const b of root.querySelectorAll(".cl-hostile")) {
      const ico = b.querySelector(".hud-ico");
      if (ico) ico.innerHTML = ctx.D.deckIcon(b.classList.contains("h-prev") ? "chev-left" : "chev-right");
    }

    // The reticle: corner brackets around it, a ring (round or faceted, by maker), four
    // ticks and the pip.
    const S = Math.max(40, Math.min(rw, rh));
    const cx = rx + rw / 2, cy = ry + rh / 2, x0 = cx - S / 2, y0 = cy - S / 2;
    const ringR = S * 0.27, pipR = clamp(S * 0.1, 18, 40), arm = S * 0.16, ins = 2;
    const br = (l, t, dx, dy) => `<path class="cl-bracket" d="M${f1(l)} ${f1(t + dy * arm)}V${f1(t)}H${f1(l + dx * arm)}"/>`;
    root.insertAdjacentHTML("afterbegin", svg(W, H, `
      ${br(x0 + ins, y0 + ins, 1, 1)}${br(x0 + S - ins, y0 + ins, -1, 1)}${br(x0 + ins, y0 + S - ins, 1, -1)}${br(x0 + S - ins, y0 + S - ins, -1, -1)}
      <path class="cl-ret-cross" d="M${f1(cx)} ${f1(y0 + S * 0.08)}V${f1(cy - ringR - 6)}M${f1(cx)} ${f1(cy + ringR + 6)}V${f1(y0 + S * 0.92)}M${f1(x0 + S * 0.08)} ${f1(cy)}H${f1(cx - ringR - 6)}M${f1(cx + ringR + 6)} ${f1(cy)}H${f1(x0 + S * 0.92)}"/>
      <path class="cl-ret-ring" d="${ringPath(cx, cy, ringR, look.facet, 12)}"/>
      ${[0, 90, 180, 270].map((a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return `<path class="cl-ret-tick" d="M${f1(cx + c * (ringR - 5))} ${f1(cy + s * (ringR - 5))}L${f1(cx + c * (ringR + 5))} ${f1(cy + s * (ringR + 5))}"/>`; }).join("")}
      <circle class="cl-pip" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(pipR * 0.42)}"/>`));
    const subZ = put(zone(ctx, root, "cl-sub", e.sub && e.sub.label, e.sub && e.sub.id, () => send(ctx, e.sub, subZ)), cx - ringR - 8, cy - ringR - 8, ringR * 2 + 16, ringR * 2 + 16);
    const pipZ = put(zone(ctx, root, "cl-pipz", e.next && e.next.label, e.next && e.next.id, () => send(ctx, e.next, pipZ)), cx - pipR, cy - pipR, pipR * 2, pipR * 2);
    // The ring's job, said on the ring while there's room for it.
    if (!small && S >= 150 && e.sub) {
      const cap = ctx.make("span", "cl-word cl-ring-word");
      cap.textContent = ctx.tr("Sub-target");
      cap.setAttribute("aria-hidden", "true");
      put(cap, cx - ringR, cy + ringR + 8, ringR * 2, 16);
      root.appendChild(cap);
    }
    if (ctx.editing) { ctx.place(root, e); return root; }

    denials(ctx, root, idsOf(e.next, e.sub));
    const nextB = root.querySelector(".h-next"), prevB = root.querySelector(".h-prev");
    // A swipe across the reticle: right is the next hostile, left the previous, once per
    // swipe, on lift.
    track(root, ctx, {
      drag(z, axis) {
        if (axis !== "x") return { end() {} };
        return {
          move(dx) { root.classList.toggle("cl-going-next", dx >= 40); root.classList.toggle("cl-going-prev", dx <= -40); },
          end(dx, dy, ok) {
            root.classList.remove("cl-going-next", "cl-going-prev");
            if (ok && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) send(ctx, dx > 0 ? e.next : e.prev, dx > 0 ? nextB : prevB);
          },
        };
      },
    });
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr("Targeting"));
    return root;
  }

  // ---------- hull: lights and doors ----------

  // The ship's outside, as a panel of three: Lights; the doors, drawn as a pair of sliding
  // leaves that part while they're open (tap them to toggle the doors) with Open and Close
  // under them; and Lock and Unlock. Every part is one press of its own button.
  function hull(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const doors = e.doors || {}, lock = e.lock || {};
    const root = ctx.make("div", "cl-cluster cl-hull");
    const g = small ? 6 : 10;
    const wide = W >= H * 1.5;
    let doorBox, oc, lights, locks;
    if (wide) {
      // Lights | doors over Open and Close | Lock over Unlock
      const sw = clamp(W * 0.26, 56, 190), mw = W - 2 * (sw + g);
      const rowH = clamp((H - g) * 0.36, 40, 72);
      lights = [0, 0, sw, H];
      doorBox = [sw + g, 0, mw, H - rowH - g];
      oc = [sw + g, H - rowH, mw, rowH];
      locks = [W - sw, 0, sw, H];
    } else {
      // Lights | Lock | Unlock, the doors, Open | Close
      const rowH = clamp(H * 0.2, 44, 84);
      lights = [0, 0, (W - g) * 0.4, rowH];
      locks = [(W - g) * 0.4 + g, 0, (W - g) * 0.6, rowH, "row"];
      oc = [0, H - rowH, W, rowH];
      doorBox = [0, rowH + g, W, H - 2 * (rowH + g)];
    }
    button(ctx, root, e.lights, "cl-lights", ...lights.slice(0, 4));
    // Lock and Unlock: stacked in a column, side by side in a row.
    {
      const [x, y, w, h, row] = locks;
      const bw = row ? (w - g) / 2 : w, bh = row ? h : (h - g) / 2;
      const tight = bw < 120; // "Lock" and "Unlock" where "Unlock Doors" won't fit
      face(button(ctx, root, lock.lock, "cl-lockb", x, y, bw, bh), ctx, tight ? "Lock" : null, null, true);
      face(button(ctx, root, lock.unlock, "cl-lockb", row ? x + bw + g : x, row ? y : y + bh + g, bw, bh), ctx, tight ? "Unlock" : null, null, true);
    }
    {
      const [x, y, w, h] = oc;
      const hw = (w - g) / 2;
      const tight = hw < 140;
      face(button(ctx, root, doors.open, "cl-doorb", x, y, hw, h), ctx, tight ? "Open" : null, "open", doors.open && doors.open.icon !== "doors");
      face(button(ctx, root, doors.close, "cl-doorb", x + hw + g, y, hw, h), ctx, tight ? "Close" : null, "close", doors.close && doors.close.icon !== "doors");
    }

    // The doors: a frame, two leaves and a sill; the leaves slide apart while the doors are
    // open (by the doors' lit state), and the word under them says which.
    const [dx, dy, dw, dh] = doorBox;
    const dz = put(zone(ctx, root, "cl-doors", doors.toggle && doors.toggle.label, idsOf(doors.toggle), () => send(ctx, doors.toggle, dz)), dx, dy, dw, dh);
    const capH = dh >= 96 ? (small ? 16 : 20) : 0;
    const fh = Math.max(24, Math.min(dh - capH - 12, dw * 0.46)), fw = Math.min(dw - 16, fh * 1.3);
    const fx = (dw - fw) / 2, fy = Math.max(6, (dh - capH - fh) / 2);
    const lw = fw / 2 - 4;
    dz.innerHTML = `<svg class="cl-art" viewBox="0 0 ${f1(dw)} ${f1(dh)}" aria-hidden="true">
      <rect class="cl-door-gap" x="${f1(fx + 4)}" y="${f1(fy + 4)}" width="${f1(fw - 8)}" height="${f1(fh - 8)}"/>
      <g class="cl-leaf l-left"><rect x="${f1(fx + 4)}" y="${f1(fy + 4)}" width="${f1(lw)}" height="${f1(fh - 8)}"/><rect class="cl-slit" x="${f1(fx + 4 + lw * 0.2)}" y="${f1(fy + fh * 0.16)}" width="${f1(lw * 0.6)}" height="${f1(Math.max(3, fh * 0.07))}" rx="2"/><path d="M${f1(fx + 4 + lw - 7)} ${f1(fy + fh * 0.42)}v${f1(fh * 0.16)}"/></g>
      <g class="cl-leaf l-right"><rect x="${f1(fx + fw / 2)}" y="${f1(fy + 4)}" width="${f1(lw)}" height="${f1(fh - 8)}"/><rect class="cl-slit" x="${f1(fx + fw / 2 + lw * 0.2)}" y="${f1(fy + fh * 0.16)}" width="${f1(lw * 0.6)}" height="${f1(Math.max(3, fh * 0.07))}" rx="2"/><path d="M${f1(fx + fw / 2 + 7)} ${f1(fy + fh * 0.42)}v${f1(fh * 0.16)}"/></g>
      <path class="cl-door-frame" d="M${f1(fx)} ${f1(fy + fh)}V${f1(fy + 6)}Q${f1(fx)} ${f1(fy)} ${f1(fx + 6)} ${f1(fy)}H${f1(fx + fw - 6)}Q${f1(fx + fw)} ${f1(fy)} ${f1(fx + fw)} ${f1(fy + 6)}V${f1(fy + fh)}"/>
      <path class="cl-door-sill" d="M${f1(fx - 6)} ${f1(fy + fh)}H${f1(fx + fw + 6)}"/></svg>`;
    dz.style.setProperty("--leaf", `${f1(lw - 6)}px`);
    if (capH) {
      const cap = ctx.make("span", "cl-word cl-door-word");
      cap.setAttribute("aria-hidden", "true");
      put(cap, 0, dh - capH, dw, capH);
      dz.appendChild(cap);
    }
    const word = dz.querySelector(".cl-door-word");
    const say = (open) => { if (word) word.textContent = `${ctx.tr("Doors")} · ${ctx.tr(open ? "OPEN" : "CLOSED")}`; };
    say(false);
    const dg = (doors.toggle || doors.open || {}).state;
    lit(ctx, dz, dg && dg.group, (on, lights) => { root.classList.toggle("doors-open", on); root.classList.toggle("doors-lit", on && lights); say(on); });
    if (ctx.editing) { ctx.place(root, e); return root; }

    denials(ctx, root, idsOf(doors.toggle));
    track(root, ctx, {});
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Lights and doors"));
    return root;
  }

  // ---------- turrets ----------

  // One plain button per remote turret seat, with the turret icon and its number: in a row,
  // or two rows when one row would be too tight.
  function turrets(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const seats = (e.seats || []).filter(Boolean);
    const root = ctx.make("div", "cl-cluster cl-turrets");
    const g = ctx.sizeClass === "small" ? 6 : 10;
    const n = Math.max(1, seats.length);
    const cols = W / n < 64 && n > 2 ? Math.ceil(n / 2) : n; // two rows only when one is too tight
    const rows = Math.ceil(n / cols);
    const bw = (W - g * (cols - 1)) / cols, bh = (H - g * (rows - 1)) / rows;
    seats.forEach((s, i) => {
      const b = button(ctx, root, s, "cl-turret", (i % cols) * (bw + g), Math.floor(i / cols) * (bh + g), bw, bh);
      if (!b) return;
      face(b, ctx, `T${i + 1}`, null, true);
      // With labels hidden the number stays, on the icon.
      b.insertAdjacentHTML("beforeend", `<span class="cl-num" aria-hidden="true">${i + 1}</span>`);
    });
    if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Turrets"));
    return root;
  }

  // ---------- countermeasures ----------

  // Defense on top: Decoy and Noise flank Panic, which sits under a flip cover. Weapons
  // under it: the missile trigger, then Fewer Missiles and the lead / lag pips. On a wide,
  // low box it's one row. The cover's first tap only lifts it; it drops again after 4 s or
  // a touch anywhere else (the picture only).
  function countermeasures(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const root = ctx.make("div", "cl-cluster cl-cm");
    const g = small ? 6 : 10;
    const boxes = {};
    const extra = Boolean(e.more || e.reset); // the missile count's More and Reset (2.2)
    if (W >= H * 2.2) {
      // [Decoy][Panic][Noise] | [Missile][Fewer / Pips]
      const u = (W - 4 * g) / 6.4;
      let x = 0;
      for (const [k, w] of [["decoy", u], ["panic", u * 1.2], ["noise", u], ["missile", u * 1.6]]) { boxes[k] = [x, 0, w, H]; x += w + g; }
      const hh = (H - g) / 2;
      boxes.fewer = [x, 0, W - x, hh];
      boxes.pips = [x, hh + g, W - x, hh];
      // More and Reset share Fewer's row: [Fewer][More][Reset] over Pips.
      if (extra) {
        const cw = (W - x - 2 * g) / 3;
        boxes.fewer = [x, 0, cw, hh];
        boxes.more = [x + cw + g, 0, cw, hh];
        boxes.reset = [x + 2 * (cw + g), 0, cw, hh];
      }
      root.classList.add("cm-row");
    } else {
      const h1 = (H - 2 * g) * 0.42, h2 = (H - 2 * g) * 0.32, h3 = H - h1 - h2 - 2 * g;
      const tw = (W - 2 * g) * 0.3, pw = W - 2 * (tw + g);
      boxes.decoy = [0, 0, tw, h1];
      boxes.panic = [tw + g, 0, pw, h1];
      boxes.noise = [W - tw, 0, tw, h1];
      boxes.missile = [0, h1 + g, W, h2];
      const hw = (W - g) / 2;
      boxes.fewer = [0, H - h3, hw, h3];
      boxes.pips = [hw + g, H - h3, hw, h3];
      // More and Reset share the bottom row: [Fewer][More][Reset][Pips].
      if (extra) {
        const qw = (W - 3 * g) / 4;
        ["fewer", "more", "reset", "pips"].forEach((k, i) => { boxes[k] = [i * (qw + g), H - h3, qw, h3]; });
      }
    }
    // The two groups, drawn as a backing plate each.
    const plate = (cls, ks) => {
      const bs = ks.map((k) => boxes[k]).filter(Boolean);
      if (!bs.length) return;
      const x = Math.min(...bs.map((b) => b[0])), y = Math.min(...bs.map((b) => b[1]));
      const r = Math.max(...bs.map((b) => b[0] + b[2])), b = Math.max(...bs.map((b) => b[1] + b[3]));
      root.appendChild(put(ctx.make("i", `cl-plate ${cls}`), x - 3, y - 3, r - x + 6, b - y + 6));
    };
    plate("p-defense", ["decoy", "panic", "noise"]);
    plate("p-weapons", ["missile", "fewer", "more", "reset", "pips"]);
    button(ctx, root, e.decoy, "cl-tube t-decoy", ...boxes.decoy);
    button(ctx, root, e.noise, "cl-tube t-noise", ...boxes.noise);
    const panic = button(ctx, root, e.panic, "cl-panic", ...boxes.panic);
    button(ctx, root, e.missile, "cl-missile", ...boxes.missile);
    // Short words where the buttons are narrow; their names stay the full labels.
    const roomy = boxes.fewer[2] >= 150;
    face(button(ctx, root, e.fewer, "cl-small", ...boxes.fewer), ctx, roomy ? null : "Fewer", "fewer", e.fewer && e.fewer.icon !== "missile");
    face(button(ctx, root, e.pips, "cl-small", ...boxes.pips), ctx, roomy ? null : "Pips", "pips", e.pips && e.pips.icon !== "power-weapons");
    if (extra) {
      face(button(ctx, root, e.more, "cl-small", ...boxes.more), ctx, roomy ? null : "More", null, true);
      face(button(ctx, root, e.reset, "cl-small", ...boxes.reset), ctx, roomy ? null : "Reset", null, true);
      // Four in a row on a narrow cluster: icons only (each keeps its name and title).
      if (boxes.fewer[2] < 76) for (const b of root.querySelectorAll(".cl-small")) b.classList.add("lbl-off");
    }
    if (panic) {
      const cover = ctx.make("div", "cl-cover", `<i class="cl-cover-hinge"></i><span class="cl-cover-word"></span>`);
      cover.querySelector(".cl-cover-word").textContent = ctx.tr(boxes.panic[2] >= 120 ? "Panic Decoys" : "Panic");
      cover.setAttribute("role", "button");
      cover.setAttribute("aria-label", ctx.tr("Lift the cover"));
      cover.tabIndex = 0;
      put(cover, ...boxes.panic);
      root.appendChild(cover);
      if (ctx.editing) { ctx.place(root, e); return root; }
      let timer = 0;
      const away = (ev) => { if (!ev.target.closest || (!ev.target.closest(".cl-cover") && ev.target.closest(".cl-panic") !== panic)) drop(); };
      const drop = () => {
        clearTimeout(timer);
        root.classList.remove("cover-up");
        document.removeEventListener("pointerdown", away, true);
      };
      const lift = () => {
        if (root.classList.contains("cover-up")) return;
        root.classList.add("cover-up");
        window.DeckSound?.play("page");
        ctx.D.buzz?.();
        timer = setTimeout(drop, 4000);
        setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
      };
      cover.addEventListener("click", lift);
      cover.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && !ev.repeat) { ev.preventDefault(); lift(); panic.focus(); } });
      // The cover drops back after the press (picture only).
      ctx.follow(e.panic.id, () => { clearTimeout(timer); timer = setTimeout(drop, 500); });
      root._drop = drop;
    } else if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Countermeasures"));
    return root;
  }

  // ---------- quantum ----------

  // The spool ring: its hub is Engage Quantum (held while the finger is down, as always),
  // and the ring fills while it's held (CSS only). The HUD keeps Flight Ready with the
  // power switches, since it's pressed once at start-up; a layout that puts it here
  // (`ready`) gets a plain button beside the ring.
  function quantum(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const root = ctx.make("div", "cl-cluster cl-quantum");
    const g = ctx.sizeClass === "small" ? 6 : 10;
    const readyW = e.ready ? clamp(W * 0.32, 72, 170) : 0;
    const area = W - (readyW ? readyW + g : 0);
    const rd = Math.max(48, Math.min(H, area));
    const rcx = area / 2, rcy = H / 2, rr = rd / 2 - 4;
    const circ = 2 * Math.PI * (rr - 4);
    root.style.setProperty("--circ", f1(circ));
    // Wide boxes get the drive's two rails out to the sides, so the ring sits in a frame.
    const rails = area - rd > 80 ? `<path class="cl-spool-rail" d="M${f1(8)} ${f1(rcy)}H${f1(rcx - rr - 10)}M${f1(rcx + rr + 10)} ${f1(rcy)}H${f1(area - 8)}"/>
      ${[-1, 1].map((s) => [0.25, 0.5, 0.75].map((t) => { const x = s < 0 ? 8 + (rcx - rr - 18) * t : rcx + rr + 10 + (area - rcx - rr - 18) * t; return `<path class="cl-spool-rail-tick" d="M${f1(x)} ${f1(rcy - 6)}V${f1(rcy + 6)}"/>`; }).join("")).join("")}` : "";
    root.innerHTML = svg(W, H, `${rails}
      <circle class="cl-spool-track" cx="${f1(rcx)}" cy="${f1(rcy)}" r="${f1(rr - 4)}"/>
      <circle class="cl-spool-fill" cx="${f1(rcx)}" cy="${f1(rcy)}" r="${f1(rr - 4)}" transform="rotate(-90 ${f1(rcx)} ${f1(rcy)})" style="stroke-dasharray:${f1(circ)};stroke-dashoffset:${f1(circ)}"/>
      ${Array.from({ length: 24 }, (_, k) => { const a = rad(k * 15), c = Math.cos(a), s = Math.sin(a); return `<path class="cl-spool-tick" d="M${f1(rcx + c * (rr + 1))} ${f1(rcy + s * (rr + 1))}L${f1(rcx + c * (rr - (k % 6 ? 2 : 5)))} ${f1(rcy + s * (rr - (k % 6 ? 2 : 5)))}"/>`; }).join("")}`);
    const hd = Math.max(44, rd * 0.62);
    // Under about 110 px the hub has no room for "Hold to engage" below its label.
    root.classList.toggle("tight", hd < 110);
    button(ctx, root, e.engage, "cl-qhub", rcx - hd / 2, rcy - hd / 2, hd, hd);
    if (e.ready) {
      const rh = clamp(H * 0.5, 44, 72);
      button(ctx, root, e.ready, "cl-ready", W - readyW, (H - rh) / 2, readyW, rh, "std");
    }
    if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Quantum"));
    return root;
  }

  // ---------- mining ----------

  // The mining head: Mining Mode across the top, a power rocker (its gauge fills while a
  // side is held: the picture only), the fire trigger, the Fracture/Extract switch (it
  // shows the side last sent from here) and the three module cartridges.
  function mining(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const root = ctx.make("div", "cl-cluster cl-mining");
    const g = small ? 6 : 10;
    const topH = e.mode ? clamp(H * 0.14, 36, 52) : 0;
    const mods = (e.modules || []).slice(0, 4);
    const botH = mods.length ? clamp(H * 0.17, 40, 60) : 0;
    const my = topH ? topH + g : 0, mh = H - my - (botH ? botH + g : 0);
    const rw = clamp(W * 0.2, 48, 100), swW = clamp(W * 0.26, 64, 130);
    button(ctx, root, e.mode, "cl-wide", 0, 0, W, topH);
    const bh = Math.max(44, (mh - g) * 0.36);
    button(ctx, root, e.up, "cl-rock r-up", 0, my, rw, bh);
    button(ctx, root, e.down, "cl-rock r-down", 0, my + mh - bh, rw, bh);
    const gauge = ctx.make("div", "cl-gauge", `<i class="cl-gauge-fill"></i>`);
    gauge.setAttribute("aria-hidden", "true");
    put(gauge, rw / 2 - 5, my + bh + 4, 10, Math.max(4, mh - 2 * bh - 8));
    root.appendChild(gauge);
    const fd = Math.max(56, Math.min(mh, W - rw - swW - 4 * g));
    button(ctx, root, e.fire, "cl-fire", rw + (W - rw - swW - fd) / 2, my + (mh - fd) / 2, fd, fd);
    const sw = button(ctx, root, e.laserType, "cl-throw", W - swW, my, swW, mh);
    if (sw) {
      sw.querySelector(".hud-lbl").innerHTML = `<b class="t-a"></b><i class="cl-throw-knob"></i><b class="t-b"></b>`;
      sw.querySelector(".t-a").textContent = ctx.tr("Fracture");
      sw.querySelector(".t-b").textContent = ctx.tr("Extract");
      sw.title = `${ctx.tr(e.laserType.label)} (${ctx.tr("as last sent")}) — ${e.laserType.keys}`;
    }
    const cw = (W - g * (mods.length - 1)) / Math.max(1, mods.length);
    mods.forEach((m, i) => {
      const b = button(ctx, root, m, "cl-cart", i * (cw + g), H - botH, cw, botH);
      // The modules share an icon: with labels hidden their number stays.
      if (b) b.insertAdjacentHTML("beforeend", `<span class="cl-num" aria-hidden="true">${i + 1}</span>`);
    });
    if (sw && !ctx.editing && e.laserType) {
      const mem = ctx.mem(e);
      const paint = () => { sw.classList.toggle("side-b", mem.side === "extract"); };
      ctx.follow(e.laserType.id, () => { if (once(`${e.id}:${e.laserType.id}`)) { mem.side = mem.side === "extract" ? "fracture" : "extract"; ctx.save(); } paint(); });
      paint();
    }
    if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Mining"));
    return root;
  }

  // ---------- salvage ----------

  // The salvage head and its two beams. Swipe sideways on it for the next modifier left
  // or right (once per swipe); drag up or down to widen or narrow the beams, one tap per
  // step. The gap between the beams shows the steps sent. The chevrons at the edges are
  // one press each.
  function salvage(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const root = ctx.make("div", "cl-cluster cl-salvage");
    const cz = 44;
    const hw = Math.min(W * 0.34, 170), hh = clamp(H * 0.2, 22, 56);
    const cx = W / 2, hy = 6;
    const beamTop = hy + hh, beamBot = H - cz - 10;
    const mem = ctx.editing ? {} : ctx.mem(e);
    const gap = () => clamp(Number(mem.gap) || 0, -5, 5);
    root.innerHTML = svg(W, H, `
      <path class="cl-head" d="M${f1(cx - hw / 2)} ${f1(hy)}H${f1(cx + hw / 2)}L${f1(cx + hw * 0.32)} ${f1(hy + hh)}H${f1(cx - hw * 0.32)}Z"/>
      <path class="cl-head-line" d="M${f1(cx - hw * 0.38)} ${f1(hy + hh * 0.45)}H${f1(cx + hw * 0.38)}"/>
      <path class="cl-beam b-l"/><path class="cl-beam b-r"/>
      <path class="cl-plate" d="M${f1(cx - W * 0.3)} ${f1(beamBot)}H${f1(cx + W * 0.3)}"/>
      ${[-1, 1].map((s) => `<path class="cl-chev" d="M${f1(s < 0 ? 26 : W - 26)} ${f1(H / 2 - 12)}L${f1(s < 0 ? 16 : W - 16)} ${f1(H / 2)}L${f1(s < 0 ? 26 : W - 26)} ${f1(H / 2 + 12)}"/>`).join("")}`);
    const beams = () => {
      const spread = Math.max(0.12, 0.5 + gap() * 0.08) * Math.min(W * 0.4, 220);
      const l = root.querySelector(".b-l"), r = root.querySelector(".b-r");
      l.setAttribute("d", `M${f1(cx - hw * 0.18)} ${f1(beamTop)}L${f1(cx - spread / 2)} ${f1(beamBot)}`);
      r.setAttribute("d", `M${f1(cx + hw * 0.18)} ${f1(beamTop)}L${f1(cx + spread / 2)} ${f1(beamBot)}`);
      root.setAttribute("aria-description", ctx.tr("{0} steps sent", gap() > 0 ? `+${gap()}` : String(gap())));
    };
    const leftZ = put(zone(ctx, root, "cl-mod m-l", e.left && e.left.label, e.left && e.left.id, () => send(ctx, e.left, leftZ)), 0, H * 0.25, cz, H * 0.5);
    const rightZ = put(zone(ctx, root, "cl-mod m-r", e.right && e.right.label, e.right && e.right.id, () => send(ctx, e.right, rightZ)), W - cz, H * 0.25, cz, H * 0.5);
    const bw = small ? 48 : 64;
    const wideZ = put(zone(ctx, root, "cl-space s-up", e.wider && e.wider.label, e.wider && e.wider.id, () => send(ctx, e.wider, wideZ)), cx - bw - 4, H - cz, bw, cz);
    const narZ = put(zone(ctx, root, "cl-space s-down", e.narrower && e.narrower.label, e.narrower && e.narrower.id, () => send(ctx, e.narrower, narZ)), cx + 4, H - cz, bw, cz);
    wideZ.innerHTML = `<span class="cl-glyph"><svg viewBox="0 0 24 24"><path d="M9 5L3 12L9 19M15 5L21 12L15 19"/></svg></span>`;
    narZ.innerHTML = `<span class="cl-glyph"><svg viewBox="0 0 24 24"><path d="M3 5L9 12L3 19M21 5L15 12L21 19"/></svg></span>`;
    beams();
    if (ctx.editing) { ctx.place(root, e); return root; }

    const bump = (id, d) => ctx.follow(id, () => { if (once(`${e.id}:${id}`)) { mem.gap = clamp(gap() + d, -5, 5); ctx.save(); } beams(); });
    if (e.wider) bump(e.wider.id, 1);
    if (e.narrower) bump(e.narrower.id, -1);
    denials(ctx, root, idsOf(e.left, e.right, e.wider, e.narrower), (id) => {
      const d = e.wider && id === e.wider.id ? -1 : e.narrower && id === e.narrower.id ? 1 : 0;
      if (d && once(`${e.id}:deny:${id}`)) { mem.gap = clamp(gap() + d, -5, 5); ctx.save(); }
      beams();
    });
    track(root, ctx, {
      drag(z, axis) {
        if (axis === "x") {
          return {
            end(dx, dy, ok) { if (ok && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) send(ctx, dx > 0 ? e.right : e.left, dx > 0 ? rightZ : leftZ); },
          };
        }
        const go = stepper(ctx, 32, (dir) => send(ctx, dir > 0 ? e.wider : e.narrower, dir > 0 ? wideZ : narZ));
        return { move: (dx, dy) => go(-dy) };
      },
    });
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Salvage"));
    return root;
  }

  // ---------- switch bank ----------

  // A row of rocker switches, one button each, each lit by its own state.
  function switchbank(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const list = e.buttons || [];
    const root = ctx.make("div", "cl-cluster cl-bank");
    const g = ctx.sizeClass === "small" ? 4 : 8;
    const w = (W - g * (list.length - 1)) / Math.max(1, list.length);
    root.classList.toggle("narrow", w < 72); // toggle over word, in smaller type
    list.forEach((b, i) => {
      const el = button(ctx, root, b, "cl-rocker", i * (w + g), 0, w, H);
      if (el) el.insertAdjacentHTML("afterbegin", `<i class="cl-toggle" aria-hidden="true"></i>`);
    });
    if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Switches"));
    return root;
  }

  // ---------- registration ----------

  const reg = (type, label, category, icon, small, large, min, drag, buttons, render, more) =>
    DW.register(type, { label, category, icon, spans: { small, large }, min, max: [12, 8], drag, buttons, render, ...more });
  const parts = (pairs) => pairs.filter(([, d]) => d && typeof d.id === "string");

  reg("shields", "Shields", "shields", "power-shields", [6, 5], [6, 6], [3, 3], "xy",
    (e) => parts([...Object.entries(e.faces || {}).map(([k, d]) => [k[0].toUpperCase() + k.slice(1), d]), ["Reset", e.reset], ["Power", e.power]]), shields);
  reg("targeting", "Targeting", "targeting", "target", [6, 4], [6, 5], [3, 3], "x",
    (e) => parts([["Next", e.next], ["Previous", e.prev], ...Object.entries(e.corners || {}).map(([k, d]) => [k[0].toUpperCase() + k.slice(1), d]), ["Sub-target", e.sub]]), targeting);
  reg("hull", "Lights and doors", "crew", "doors", [6, 3], [6, 4], [3, 2], "",
    (e) => parts([["Lights", e.lights], ["Toggle doors", (e.doors || {}).toggle], ["Open", (e.doors || {}).open], ["Close", (e.doors || {}).close], ["Lock", (e.lock || {}).lock], ["Unlock", (e.lock || {}).unlock]]), hull);
  reg("turrets", "Turrets", "crew", "turret", [6, 1], [6, 1], [2, 1], "",
    (e) => parts((e.seats || []).map((d, i) => [`Seat ${i + 1}`, d])), turrets, { grows: false });
  reg("countermeasures", "Countermeasures", "combat", "decoy", [6, 4], [6, 5], [3, 3], "",
    (e) => parts([["Decoy", e.decoy], ["Noise", e.noise], ["Panic", e.panic], ["Missile", e.missile], ["Fewer missiles", e.fewer], ["More missiles", e.more], ["Reset missiles", e.reset], ["Pips", e.pips]]), countermeasures);
  reg("quantum", "Quantum spool", "quantum", "quantum-jump", [6, 2], [6, 3], [3, 2], "",
    (e) => parts([["Engage", e.engage], ["Flight ready", e.ready]]), quantum);
  reg("mining", "Mining head", "mining", "mining", [6, 5], [6, 6], [4, 4], "",
    (e) => parts([["Mode", e.mode], ["Fire", e.fire], ["Fracture / Extract", e.laserType], ["Power +", e.up], ["Power −", e.down], ...(e.modules || []).map((d, i) => [`Module ${i + 1}`, d])]), mining);
  reg("salvage", "Salvage head", "salvage", "salvage", [6, 4], [6, 5], [3, 3], "xy",
    (e) => parts([["Modifier left", e.left], ["Modifier right", e.right], ["Wider", e.wider], ["Narrower", e.narrower]]), salvage);
  DW.register("switchbank", {
    label: "Switch bank", category: "systems", icon: "power", spans: { small: [6, 1], large: [6, 1] }, min: [2, 1], max: [12, 2], drag: "", grows: false,
    buttons: (e) => parts((e.buttons || []).map((d) => [d.label, d])), render: switchbank,
  });
})();
