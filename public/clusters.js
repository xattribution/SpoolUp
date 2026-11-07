// Cockpit clusters (SpoolUp 2.1): each grouping of controls drawn as one instrument you can
// place on any panel or dashboard. Shields, targeting, the hull's lights and doors,
// turrets, countermeasures, the quantum spool, the mining head, the salvage head and the
// switch banks.
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

  // Ship silhouettes, in a 100 x 100 box: from above (nose up), from the side (nose right),
  // and from behind.
  const SHIP_TOP = "M50 6L55 26L58 40L84 58L88 70L60 64L58 78L67 87L66 93L50 89L34 93L33 87L42 78L40 64L12 70L16 58L42 40L45 26Z";
  const SHIP_SIDE = "M4 56L18 50L34 47L46 36L62 36L72 45L90 50L97 54L92 58L70 62L22 63L8 61Z";
  const SHIP_SIDE_FIN = "M14 50L10 36L20 36L28 48Z";
  const SHIP_BACK = "M50 38C58 38 62 44 62 50C62 56 58 62 50 62C42 62 38 56 38 50C38 44 42 38 50 38ZM38 50L6 54L6 58L40 56ZM62 50L94 54L94 58L60 56ZM50 38L47 22L53 22Z";
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

  // A reticle: corner brackets cycle attackers, friendlies, anything and what's in view;
  // the center pip (or a swipe right across it) is the next hostile, a swipe left the
  // previous one; the inner ring cycles sub-targets.
  const CORNERS = [
    ["attacker", "tl", "Attacker"], ["friendly", "tr", "Friendly"], ["any", "bl", "Any"], ["view", "br", "In view"],
  ];
  const CORNER_GLYPH = {
    attacker: `<path d="M12 3L21 12L12 21L3 12Z"/><path d="M12 8V13M12 16V16.5"/>`,
    friendly: `<circle cx="12" cy="12" r="8"/><path d="M8 12.5L11 15L16 9.5"/>`,
    any: `<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="2"/>`,
    view: `<path d="M2 12C5 6.5 19 6.5 22 12C19 17.5 5 17.5 2 12Z"/><circle cx="12" cy="12" r="3"/>`,
  };

  function targeting(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small";
    const look = looks();
    const corners = e.corners || {};
    const root = ctx.make("div", "cl-cluster cl-targeting");
    const S = Math.max(60, Math.min(W, H));
    const x0 = (W - S) / 2, y0 = (H - S) / 2, cx = W / 2, cy = H / 2;
    const arm = S * 0.2, inset = 4;
    const ringR = S * 0.2, pipR = clamp(S * 0.08, 18, 34);
    const bracket = (k) => {
      const l = x0 + inset, r = x0 + S - inset, t = y0 + inset, b = y0 + S - inset;
      return { tl: `M${f1(l)} ${f1(t + arm)}V${f1(t)}H${f1(l + arm)}`, tr: `M${f1(r - arm)} ${f1(t)}H${f1(r)}V${f1(t + arm)}`,
        bl: `M${f1(l)} ${f1(b - arm)}V${f1(b)}H${f1(l + arm)}`, br: `M${f1(r - arm)} ${f1(b)}H${f1(r)}V${f1(b - arm)}` }[k];
    };
    const chev = (x, dir) => `<path class="cl-chev" d="M${f1(x - dir * 5)} ${f1(cy - 9)}L${f1(x + dir * 5)} ${f1(cy)}L${f1(x - dir * 5)} ${f1(cy + 9)}"/>`;
    root.innerHTML = svg(W, H, `
      ${CORNERS.map(([k, pos]) => `<path class="cl-bracket c-${k}" d="${bracket(pos)}"/>`).join("")}
      <path class="cl-ret-ring" d="${ringPath(cx, cy, ringR, look.facet, 12)}"/>
      ${[0, 90, 180, 270].map((a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return `<path class="cl-ret-tick" d="M${f1(cx + c * (ringR + 4))} ${f1(cy + s * (ringR + 4))}L${f1(cx + c * (ringR + S * 0.07))} ${f1(cy + s * (ringR + S * 0.07))}"/>`; }).join("")}
      <circle class="cl-pip" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(pipR * 0.42)}"/>
      ${chev(x0 + S * 0.12, -1)}${chev(x0 + S * 0.88, 1)}`);

    const cs = clamp(S * 0.32, 44, 150);
    const cornerZones = CORNERS.map(([k, pos, word]) => {
      const def = corners[k];
      if (!def) return null;
      const z = zone(ctx, root, `cl-corner c-${k}`, def.label, def.id, () => send(ctx, def, z));
      const x = pos[1] === "l" ? x0 : x0 + S - cs, y = pos[0] === "t" ? y0 : y0 + S - cs;
      put(z, x, y, cs, cs);
      z.innerHTML = `<span class="cl-glyph"><svg viewBox="0 0 24 24">${CORNER_GLYPH[k]}</svg></span>${small ? "" : `<span class="cl-word"></span>`}`;
      if (!small) z.querySelector(".cl-word").textContent = ctx.tr(word);
      return z;
    });
    // Previous and next: the reticle's sides, out to the cluster's edges on a wide box.
    const sideH = S * 0.3;
    const prevZ = put(zone(ctx, root, "cl-prev", e.prev && e.prev.label, e.prev && e.prev.id, () => send(ctx, e.prev, prevZ)), 0, cy - sideH / 2, x0 + S * 0.24, sideH);
    const nextZ = put(zone(ctx, root, "cl-next", e.next && e.next.label, e.next && e.next.id, () => send(ctx, e.next, nextZ)), x0 + S * 0.76, cy - sideH / 2, W - x0 - S * 0.76, sideH);
    const subZ = put(zone(ctx, root, "cl-sub", e.sub && e.sub.label, e.sub && e.sub.id, () => send(ctx, e.sub, subZ)), cx - ringR - 6, cy - ringR - 6, ringR * 2 + 12, ringR * 2 + 12);
    const pipZ = put(zone(ctx, root, "cl-pipz", e.next && e.next.label, e.next && e.next.id, () => send(ctx, e.next, pipZ)), cx - pipR, cy - pipR, pipR * 2, pipR * 2);
    if (ctx.editing) { ctx.place(root, e); return root; }

    denials(ctx, root, idsOf(e.next, e.prev, e.sub, Object.values(corners)));
    // A swipe across the reticle: right is the next hostile, left the previous, once per
    // swipe, on lift.
    track(root, ctx, {
      drag(z, axis) {
        if (axis !== "x") return { end() {} };
        root.classList.add("cl-swiping");
        return {
          move(dx) { root.classList.toggle("cl-going-next", dx >= 40); root.classList.toggle("cl-going-prev", dx <= -40); },
          end(dx, dy, ok) {
            root.classList.remove("cl-swiping", "cl-going-next", "cl-going-prev");
            if (ok && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) send(ctx, dx > 0 ? e.next : e.prev, dx > 0 ? nextZ : prevZ);
          },
        };
      },
    });
    void cornerZones;
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr("Targeting"));
    return root;
  }

  // ---------- hull: lights and doors ----------

  // The ship from the side: a headlight cone at the nose (lights), a ramp under the hull
  // (tap to toggle the doors, pull it down to open them, push it up to close them, once
  // per drag) and a padlock (locks, or unlocks while they're locked).
  function hull(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const doors = e.doors || {}, lock = e.lock || {};
    const root = ctx.make("div", "cl-cluster cl-hull");
    // The side view is drawn at one scale (SHIP_SIDE spans y 36 to 63 of its 100 box), so
    // the ramp and the lamp sit on the hull wherever the box puts it.
    const sw = Math.min(W * 0.66, H * 1.55), sh = sw * 0.27;
    const x0 = W * 0.04, yb = H * 0.5 - sw * 0.5 + (H < 200 ? 0 : sh * 0.15);
    const y0 = yb + sw * 0.36;
    const noseX = x0 + sw * 0.97, noseY = yb + sw * 0.54;
    const bottom = yb + sw * 0.625;
    const rampX = x0 + sw * 0.22, rampW = sw * 0.22;
    const rampLen = Math.max(10, Math.min(H - bottom - 6, sh * 0.9));
    const coneW = W - noseX - 4;
    const lockS = clamp(Math.min(H * 0.28, sw * 0.16), 26, 60);
    const lockX = x0 + sw * 0.5, lockY = Math.max(2, y0 - lockS - 6);
    root.innerHTML = svg(W, H, `
      <path class="cl-cone" d="M${f1(noseX + 2)} ${f1(noseY - 3)}L${f1(noseX + coneW)} ${f1(noseY - sh * 0.75)}Q${f1(noseX + coneW + 8)} ${f1(noseY)} ${f1(noseX + coneW)} ${f1(noseY + sh * 0.75)}L${f1(noseX + 2)} ${f1(noseY + 3)}Z"/>
      ${[0.25, 0.5, 0.75].map((t) => `<path class="cl-beam" d="M${f1(noseX + 4)} ${f1(noseY)}L${f1(noseX + coneW * 0.92)} ${f1(noseY + (t - 0.5) * sh * 1.3)}"/>`).join("")}
      ${ship(SHIP_SIDE, x0, yb, sw, sw)}${ship(SHIP_SIDE_FIN, x0, yb, sw, sw)}
      <circle class="cl-lamp" cx="${f1(noseX - 2)}" cy="${f1(noseY)}" r="3"/>
      <g class="cl-ramp" style="transform-origin:${f1(rampX + rampW)}px ${f1(bottom)}px"><path d="M${f1(rampX)} ${f1(bottom)}H${f1(rampX + rampW)}"/></g>
      <path class="cl-ramp-open" d="M${f1(rampX + rampW)} ${f1(bottom)}L${f1(rampX + rampW * 0.08)} ${f1(bottom + rampLen * 0.9)}"/>
      <path class="cl-hatch" d="M${f1(rampX)} ${f1(bottom - sh * 0.42)}H${f1(rampX + rampW)}V${f1(bottom)}H${f1(rampX)}Z"/>
      <g class="cl-lock" transform="translate(${f1(lockX)} ${f1(lockY)}) scale(${f1(lockS / 24)})">
        <path class="cl-shackle" d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v2.5"/></g>`);

    const cone = put(zone(ctx, root, "cl-lights", e.lights && e.lights.label, e.lights && e.lights.id, () => send(ctx, e.lights, cone)), noseX - 10, Math.max(0, noseY - sh * 0.9), W - noseX + 10, Math.min(H, sh * 1.8));
    const hatch = put(zone(ctx, root, "cl-doors", doors.toggle && doors.toggle.label, idsOf(doors.toggle, doors.open, doors.close), () => send(ctx, doors.toggle, hatch)), rampX - 8, bottom - sh * 0.38, rampW + 16, Math.max(44, sh * 0.38 + rampLen));
    let locked = false;
    const lockZ = put(zone(ctx, root, "cl-padlock", "Lock or unlock the doors", idsOf(lock.lock, lock.unlock), () => send(ctx, locked ? lock.unlock : lock.lock, lockZ)), lockX - 6, lockY - 6, Math.max(44, lockS + 12), Math.max(44, lockS + 12));

    lit(ctx, cone, e.lights && e.lights.state && e.lights.state.group, (on, lights) => root.classList.toggle("lights-on", on && lights));
    const dg = (doors.toggle || doors.open || {}).state;
    lit(ctx, hatch, dg && dg.group, (on, lights) => { root.classList.toggle("doors-open", on); root.classList.toggle("doors-lit", on && lights); });
    const lg = (lock.lock || lock.unlock || {}).state;
    lit(ctx, lockZ, lg && lg.group, (on, lights) => {
      locked = on;
      root.classList.toggle("locked", on);
      root.classList.toggle("lock-lit", on && lights);
      lockZ.setAttribute("aria-label", ctx.tr(on ? (lock.unlock || {}).label || "Unlock Doors" : (lock.lock || {}).label || "Lock Doors"));
    });
    if (ctx.editing) { ctx.place(root, e); return root; }

    denials(ctx, root, idsOf(e.lights, doors.toggle, doors.open, doors.close, lock.lock, lock.unlock));
    track(root, ctx, {
      drag(z, axis) {
        if (z !== hatch || axis !== "y") return null;
        return {
          move(dx, dy) { root.classList.toggle("cl-pull-open", dy >= 24); root.classList.toggle("cl-pull-close", dy <= -24); },
          end(dx, dy, ok) {
            root.classList.remove("cl-pull-open", "cl-pull-close");
            if (ok && Math.abs(dy) >= 24) send(ctx, dy > 0 ? doors.open : doors.close, hatch);
          },
        };
      },
    });
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Lights and doors"));
    return root;
  }

  // ---------- turrets ----------

  // The ship from behind with a pod per remote turret (dorsal, ventral, port, starboard);
  // each pod is the seat's own button.
  function turrets(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const seats = (e.seats || []).slice(0, 4);
    const root = ctx.make("div", "cl-cluster cl-turrets");
    const cx = W / 2, cy = H / 2;
    const d = clamp(Math.min(H * 0.36, W * 0.17), 44, 76);
    const cross = H >= d * 2.4 + 24;
    const span = Math.min(W / 2 - d / 2 - 4, d * 3.2);
    const fus = Math.min(cross ? H * 0.5 : H * 0.9, W * 0.24);
    const spots = cross
      ? [[cx, d / 2 + 2], [cx, H - d / 2 - 2], [cx - span, cy], [cx + span, cy]]
      : [[cx - span * 0.42, cy - (H / 2 - d / 2 - 2)], [cx + span * 0.42, cy + (H / 2 - d / 2 - 2)], [cx - span, cy], [cx + span, cy]];
    root.innerHTML = svg(W, H, `
      ${seats.map((_, i) => `<path class="cl-mount" d="M${f1(cx)} ${f1(cy)}L${f1(spots[i][0])} ${f1(spots[i][1])}"/>`).join("")}
      ${ship(SHIP_BACK, cx - fus * 1.5, cy - fus * 0.75, fus * 3, fus * 1.5)}`);
    seats.forEach((s, i) => {
      const b = button(ctx, root, s, "cl-pod", spots[i][0] - d / 2, spots[i][1] - d / 2, d, d);
      const lbl = b.querySelector(".hud-lbl");
      if (lbl) lbl.textContent = String(i + 1);
    });
    if (ctx.editing) ctx.place(root, e);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", ctx.tr(e.label || "Turrets"));
    return root;
  }

  // ---------- countermeasures ----------

  // Two launcher tubes (decoy, noise), Panic under a flip cover in the middle, the missile
  // trigger, and Fewer Missiles and the pips below. The cover's first tap only lifts it;
  // it drops again after 4 s or a touch anywhere else (the picture only).
  function countermeasures(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const small = ctx.sizeClass === "small" || H < 220;
    const root = ctx.make("div", "cl-cluster cl-cm");
    const g = small ? 6 : 10;
    const tw = clamp(W * 0.2, 52, 120);
    const mx = tw + g, mw = W - 2 * (tw + g);
    button(ctx, root, e.decoy, "cl-tube t-decoy", 0, 0, tw, H);
    button(ctx, root, e.noise, "cl-tube t-noise", W - tw, 0, tw, H);
    let panicBox, missileBox, rowY, rowH;
    root.classList.toggle("stacked", small); // Panic and Launch side by side: icons over labels
    if (small) {
      const h1 = (H - g) * 0.58;
      panicBox = [mx, 0, (mw - g) / 2, h1];
      missileBox = [mx + (mw + g) / 2, 0, (mw - g) / 2, h1];
      rowY = h1 + g; rowH = H - rowY;
    } else {
      const h1 = (H - 2 * g) * 0.4, h2 = (H - 2 * g) * 0.33;
      panicBox = [mx, 0, mw, h1];
      missileBox = [mx, h1 + g, mw, h2];
      rowY = h1 + h2 + 2 * g; rowH = H - rowY;
    }
    const panic = button(ctx, root, e.panic, "cl-panic", ...panicBox);
    button(ctx, root, e.missile, "cl-missile", ...missileBox);
    button(ctx, root, e.fewer, "cl-small", mx, rowY, (mw - g) / 2, rowH);
    button(ctx, root, e.pips, "cl-small", mx + (mw + g) / 2, rowY, (mw - g) / 2, rowH);
    if (panic) {
      const cover = ctx.make("div", "cl-cover", `<i class="cl-cover-hinge"></i><span class="cl-cover-word"></span>`);
      cover.querySelector(".cl-cover-word").textContent = ctx.tr("Panic Decoys");
      cover.setAttribute("role", "button");
      cover.setAttribute("aria-label", ctx.tr("Lift the cover"));
      cover.tabIndex = 0;
      put(cover, ...panicBox);
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
  // and the ring fills while it's held (CSS only). Flight Ready is the arc beside it.
  function quantum(e, ctx) {
    const { w: W, h: H } = ctx.size;
    const root = ctx.make("div", "cl-cluster cl-quantum");
    const g = ctx.sizeClass === "small" ? 6 : 10;
    const rd = Math.max(48, Math.min(H, W * 0.5));
    const rcx = rd / 2, rcy = H / 2, rr = rd / 2 - 4;
    const circ = 2 * Math.PI * (rr - 4);
    root.style.setProperty("--circ", f1(circ));
    root.innerHTML = svg(W, H, `
      <circle class="cl-spool-track" cx="${f1(rcx)}" cy="${f1(rcy)}" r="${f1(rr - 4)}"/>
      <circle class="cl-spool-fill" cx="${f1(rcx)}" cy="${f1(rcy)}" r="${f1(rr - 4)}" transform="rotate(-90 ${f1(rcx)} ${f1(rcy)})" style="stroke-dasharray:${f1(circ)};stroke-dashoffset:${f1(circ)}"/>
      ${Array.from({ length: 24 }, (_, k) => { const a = rad(k * 15), c = Math.cos(a), s = Math.sin(a); return `<path class="cl-spool-tick" d="M${f1(rcx + c * (rr + 1))} ${f1(rcy + s * (rr + 1))}L${f1(rcx + c * (rr - (k % 6 ? 2 : 5)))} ${f1(rcy + s * (rr - (k % 6 ? 2 : 5)))}"/>`; }).join("")}`);
    const hd = Math.max(44, rd * 0.6);
    // Under about 110 px the hub has no room for "Hold to engage" below its label.
    root.classList.toggle("tight", hd < 110);
    button(ctx, root, e.engage, "cl-qhub", rcx - hd / 2, rcy - hd / 2, hd, hd);
    if (e.ready) {
      // It starts inside the ring's box, and its left edge is hollowed to follow the ring.
      const x = rcx + rd * 0.36, rh = Math.min(H, Math.max(44, H * 0.72));
      const b = button(ctx, root, e.ready, "cl-arc", x, (H - rh) / 2, Math.max(44, W - x), rh, "std");
      if (b) b.style.setProperty("--hollow", `radial-gradient(circle at ${f1(rcx - x)}px 50%, transparent ${f1(rr + g)}px, #000 ${f1(rr + g + 1)}px)`);
      if (b) b.style.paddingLeft = `${f1(rr + g - rd * 0.36 + 14)}px`;
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
    mods.forEach((m, i) => button(ctx, root, m, "cl-cart", i * (cw + g), H - botH, cw, botH));
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

  const reg = (type, label, category, icon, small, large, min, drag, buttons, render) =>
    DW.register(type, { label, category, icon, spans: { small, large }, min, max: [12, 8], drag, buttons, render });
  const parts = (pairs) => pairs.filter(([, d]) => d && typeof d.id === "string");

  reg("shields", "Shields", "shields", "power-shields", [6, 5], [6, 6], [3, 3], "xy",
    (e) => parts([...Object.entries(e.faces || {}).map(([k, d]) => [k[0].toUpperCase() + k.slice(1), d]), ["Reset", e.reset], ["Power", e.power]]), shields);
  reg("targeting", "Targeting", "targeting", "target", [6, 5], [6, 6], [3, 3], "x",
    (e) => parts([["Next", e.next], ["Previous", e.prev], ...Object.entries(e.corners || {}).map(([k, d]) => [k[0].toUpperCase() + k.slice(1), d]), ["Sub-target", e.sub]]), targeting);
  reg("hull", "Lights and doors", "crew", "doors", [6, 3], [6, 4], [3, 2], "xy",
    (e) => parts([["Lights", e.lights], ["Toggle doors", (e.doors || {}).toggle], ["Open", (e.doors || {}).open], ["Close", (e.doors || {}).close], ["Lock", (e.lock || {}).lock], ["Unlock", (e.lock || {}).unlock]]), hull);
  reg("turrets", "Turrets", "crew", "turret", [6, 2], [6, 3], [3, 2], "",
    (e) => parts((e.seats || []).map((d, i) => [`Seat ${i + 1}`, d])), turrets);
  reg("countermeasures", "Countermeasures", "combat", "decoy", [6, 4], [6, 5], [3, 3], "",
    (e) => parts([["Decoy", e.decoy], ["Noise", e.noise], ["Panic", e.panic], ["Missile", e.missile], ["Fewer missiles", e.fewer], ["Pips", e.pips]]), countermeasures);
  reg("quantum", "Quantum spool", "quantum", "quantum-jump", [6, 2], [6, 3], [3, 2], "",
    (e) => parts([["Engage", e.engage], ["Flight ready", e.ready]]), quantum);
  reg("mining", "Mining head", "mining", "mining", [6, 5], [6, 6], [4, 4], "",
    (e) => parts([["Mode", e.mode], ["Fire", e.fire], ["Fracture / Extract", e.laserType], ["Power +", e.up], ["Power −", e.down], ...(e.modules || []).map((d, i) => [`Module ${i + 1}`, d])]), mining);
  reg("salvage", "Salvage head", "salvage", "salvage", [6, 4], [6, 5], [3, 3], "xy",
    (e) => parts([["Modifier left", e.left], ["Modifier right", e.right], ["Wider", e.wider], ["Narrower", e.narrower]]), salvage);
  DW.register("switchbank", {
    label: "Switch bank", category: "systems", icon: "power", spans: { small: [6, 1], large: [6, 1] }, min: [2, 1], max: [12, 2], drag: "",
    buttons: (e) => parts((e.buttons || []).map((d) => [d.label, d])), render: switchbank,
  });
})();
