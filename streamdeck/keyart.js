// Draws Stream Deck keys in SpoolUp's HUD style: a key face in a manufacturer theme, a
// line icon from public/icons.js in the button's color, its label, and the deck's lit,
// pressed, blocked and offline looks plus frames of its press animations. Everything is SVG
// built from simple shapes (no filters, masks, CSS or patterns), because Stream Deck draws
// SVG with a small renderer; glows are layered strokes instead.
//
// Used by tools/make-streamdeck.js (which renders the icon pack and profiles to PNG with the
// real theme fonts) and by the plugin (which draws live keys, with Windows fonts).
//
//   const art = require("./keyart");
//   const theme = art.theme(tokens.rsi);           // tokens: art.parseThemes(themes.css)
//   art.key({ theme, icon: icons.gear, label: "Landing Gear", color: "green", lit: true, status: "DEPLOYED" })
"use strict";

const SIZE = 144;

// ---------- themes ----------

// Every [data-theme] block in public/themes.css as { id: { token: value } }.
function parseThemes(css) {
  const out = {};
  for (const m of css.matchAll(/\[data-theme="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    const t = {};
    for (const d of m[2].matchAll(/--([a-z-]+):\s*([^;]+);/g)) t[d[1]] = d[2].replace(/\s+/g, " ").trim();
    const scheme = /(?:^|[;\s])color-scheme:\s*([a-z]+)/.exec(m[2]);
    if (scheme) t["color-scheme"] = scheme[1];
    out[m[1]] = t;
  }
  return out;
}

// Fonts Stream Deck can draw with on Windows, for live keys; the theme's own (Google) fonts
// come first, so the pre-rendered images use them.
const WINDOWS_FONTS = {
  serif: "Georgia, 'Palatino Linotype', serif",
  stencil: "Impact, 'Bahnschrift Condensed', sans-serif",
  condensed: "'Bahnschrift SemiCondensed', 'Bahnschrift', 'Arial Narrow', sans-serif",
  rounded: "'Segoe UI', 'Bahnschrift', sans-serif",
  default: "'Bahnschrift', 'Segoe UI', sans-serif",
};
const FONT_KIND = {
  "Saira Stencil One": "stencil", "Black Ops One": "stencil", "Saira Condensed": "condensed",
  Rajdhani: "condensed", "Chakra Petch": "condensed", Marcellus: "serif", Cinzel: "serif",
  Comfortaa: "rounded", Montserrat: "rounded",
};
const firstFamily = (stack) => (String(stack || "").split(",")[0] || "").replace(/["']/g, "").trim();
// Each display font's glyph widths at the weight a theme draws its labels in, in hundredths
// of an em (rounded up), measured in Chrome with the Google fonts (canvas measureText at
// 100 px, no letter spacing): GLYPHS in order, then LOWER for the fonts a theme keeps in
// mixed case. A label is fitted to its own letters, so QUANTUM gets the room its Q and M
// take and LIGHTS none it doesn't need. Other characters count as the font's average
// letter; other fonts, and the plugin's Windows fonts, a rough 0.64 em in capitals and 0.56
// in mixed case.
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 &+-/:−", LOWER = "abcdefghijklmnopqrstuvwxyz";
const GLYPH_WIDTHS = {
  "Exo 2 600": "64 64 58 68 57 55 64 69 28 36 62 53 90 72 68 61 68 64 58 60 68 63 97 63 60 58 62 42 58 57 63 55 59 53 62 59 22 77 55 43 54 25 59 57 59 50 59 56 40 58 60 27 27 54 32 88 60 58 60 59 42 53 40 59 56 84 56 55 52",
  "Saira Stencil One 700": "69 67 57 68 62 58 66 72 33 43 69 55 89 72 70 65 70 68 62 59 69 67 100 68 64 62 66 41 62 61 66 63 67 58 68 67 26 74 54 38 43 33 54",
  "Rajdhani 700": "56 56 54 56 48 45 55 58 27 53 56 45 73 59 56 53 57 55 54 45 56 53 81 54 52 53 54 34 50 51 55 51 53 44 55 53 22 62 57 32 41 21 57",
  "Black Ops One 600": "74 73 71 73 70 65 73 74 44 67 67 63 91 74 72 72 72 73 73 62 73 67 95 66 64 63 74 57 72 73 68 74 74 64 76 74 26 82 71 62 37 36 62",
  "Montserrat 600": "75 77 72 83 67 64 78 81 32 53 73 60 96 81 85 73 85 74 63 61 79 73 115 70 67 67 68 39 59 59 68 59 63 61 66 63 28 71 59 39 38 25 59",
  "Oxanium 600": "66 65 62 69 60 58 68 71 30 61 66 55 89 74 71 64 71 65 59 61 70 65 95 64 61 61 58 58 58 58 58 58 58 58 58 58 24 67 58 38 42 28 58",
  "Marcellus 400": "68 57 68 72 49 47 75 73 27 25 65 46 102 74 81 52 81 60 46 60 71 66 102 70 63 65 81 30 54 51 58 47 56 49 54 56 30 77 65 41 44 24 65 52 59 51 61 55 32 59 57 25 24 49 25 89 57 61 59 59 40 36 39 57 48 76 53 51 47",
  "Comfortaa 700": "71 73 78 79 70 63 78 88 31 63 67 65 99 83 93 63 93 64 69 67 85 74 94 72 67 75 58 40 59 60 66 63 59 55 59 59 30 74 55 40 47 20 55 68 71 61 71 63 37 68 69 31 29 57 30 94 69 68 71 71 49 55 41 69 55 73 56 54 54",
  "Chakra Petch 700": "65 67 66 69 61 58 68 70 28 58 66 57 81 70 70 65 70 68 64 59 70 65 88 66 64 60 66 39 58 61 58 61 63 53 64 63 28 67 57 44 53 24 57",
  "Montserrat 700": "77 77 73 83 68 64 78 81 33 55 74 61 96 81 85 74 85 74 64 62 79 75 117 72 68 68 68 40 59 60 69 60 64 62 66 64 29 73 60 39 40 27 60",
  "Cinzel 700": "72 68 78 83 64 60 84 87 39 39 76 62 96 87 88 66 89 75 58 67 83 73 98 73 71 67 66 40 62 57 62 56 63 55 61 63 25 81 49 38 43 23 49",
};
const roughWidth = (upper) => (upper ? 0.64 : 0.56);
// ("Exo 2", "600") -> { A: 0.64, ... }, or null for a font not measured.
function glyphWidths(family, weight) {
  const list = GLYPH_WIDTHS[`${family} ${weight}`];
  if (!list) return null;
  const chars = [...GLYPHS, ...LOWER];
  return Object.fromEntries(list.split(" ").map((n, i) => [chars[i], Number(n) / 100]));
}

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
// Relative luminance of a #rrggbb color (0 black, 1 white).
function luminance(c) {
  const h = String(c || "#000").replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b || 0;
}

// Turns a theme's CSS tokens into what a key needs.
function theme(tokens, id = "") {
  const t = tokens;
  const radii = String(t["key-radius"] || "6px").split(/\s+/).map((r) => Math.min(num(r), 34) * 0.9);
  const radius = [radii[0], radii[1] ?? radii[0], radii[2] ?? radii[0], radii[3] ?? radii[1] ?? radii[0]];
  const top = t["key-top"] || "none";
  const display = firstFamily(t["font-display"]), body = firstFamily(t["font-body"]);
  const fallback = WINDOWS_FONTS[FONT_KIND[display] || "default"];
  const upper = (t["label-case"] || "uppercase") === "uppercase", weight = t["label-weight"] || "600";
  const widths = glyphWidths(display, weight);
  const letters = widths ? [...(upper ? GLYPHS.slice(0, 26) : LOWER)].map((ch) => widths[ch]).filter((w) => w !== undefined) : [];
  // The backdrop's first glow: its color and where it sits.
  // Light pages are lit from above, not glowing: only dark ones get it on their keys.
  const light = /light/.test(t["color-scheme"] || "");
  const glow = light ? null : /radial-gradient\(ellipse [^,]*at ([\d.-]+)% ([\d.-]+)%, (rgba?\([^)]+\))/.exec(t["bg-art"] || "");
  const faceHi = t["face-hi"] || t["panel-hi"], faceLo = t["face-lo"] || t.panel;
  return {
    id,
    light, // the page is light (the space around a key, blank keys)
    faceLight: luminance(faceLo) > 0.45, // the key face is light (Crusader's pearl)
    material: t.material || "glass",
    bg: t.bg, panel: t.panel, panelHi: t["panel-hi"], line: t.line, lineHi: t["line-hi"], text: t.text, dim: t.dim,
    faceHi, faceLo, ink: t.ink || t.text, inkDim: t["ink-dim"] || t.dim,
    colors: { "": t.accent, green: t.green, amber: t.amber, red: t.red, blue: t.blue },
    accent: t.accent,
    radius,
    clip: t["key-clip"] && t["key-clip"] !== "none" ? t["key-clip"] : null,
    edge: Math.min(num(t["key-edge"]), 8),
    top: {
      kind: top === "none" ? "none" : /repeating-linear-gradient\(-45deg/.test(top) ? "hazard"
        : /currentColor 0 (\d+)px/.test(top) ? "segment" : /transparent[^,]*, (currentColor|var\(--accent\))/.test(top) ? "center" : "fade",
      length: num((/currentColor 0 (\d+)px/.exec(top) || [])[1], 0) || num((/currentColor 0 (\d+)%/.exec(top) || [])[1], 0) * 1.3,
      height: Math.min(num(t["key-top-h"]), 8),
    },
    stroke: num(t["icon-stroke"], 2.2),
    glow: !/none/.test(t["icon-glow"] || "none"),
    backdrop: glow ? { x: num(glow[1]) / 100, y: num(glow[2]) / 100, color: glow[3] } : null,
    stripes: /repeating-linear-gradient\(0deg/.test(t["bg-art"] || ""),
    grid: /var\(--grid\)/.test(t["bg-art"] || ""),
    font: {
      family: `'${display}', ${fallback}`,
      body: `'${body}', ${fallback}`,
      windows: fallback,
      upper,
      weight,
      track: num(t["label-track"], 0.06),
      // The average letter, for characters the table doesn't have.
      per: letters.length ? letters.reduce((a, b) => a + b, 0) / letters.length : roughWidth(upper),
      widths,
      googleFamilies: [...new Set([display, body])],
    },
  };
}

// ---------- helpers ----------

// Elliptical arcs ("A"/"a" in path data) aren't in SVG Tiny, the profile small renderers
// follow, so every arc in an icon becomes cubic curves (the same shape to well under a
// pixel). Path data is parsed in full: absolute and relative commands, implicit repeats.
function arcsToCubics(d) {
  if (!/[Aa]/.test(d)) return d;
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const out = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
  const n = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const up = cmd.toUpperCase(), rel = cmd !== up, count = ARGS[up];
    if (up === "Z") { out.push("Z"); x = sx; y = sy; continue; }
    if (i >= tokens.length || /[A-Za-z]/.test(tokens[i])) continue;
    const a = Array.from({ length: count }, n);
    if (up === "A") {
      const [rx, ry, rot, large, sweep] = a;
      const ex = rel ? x + a[5] : a[5], ey = rel ? y + a[6] : a[6];
      out.push(...arcSegments(x, y, rx, ry, rot, large, sweep, ex, ey));
      x = ex; y = ey;
      continue;
    }
    // Everything else is written back as it was, absolute, so positions stay tracked.
    const abs = a.map((v, k) => {
      if (!rel) return v;
      if (up === "H") return v + x;
      if (up === "V") return v + y;
      return v + (k % 2 === 0 ? x : y);
    });
    out.push(`${up}${abs.map((v) => +v.toFixed(3)).join(" ")}`);
    if (up === "H") x = abs[0];
    else if (up === "V") y = abs[0];
    else { x = abs[abs.length - 2]; y = abs[abs.length - 1]; }
    if (up === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
  }
  return out.join("");
}
// One arc (SVG endpoint form) as cubic curves of at most 90 degrees each (SVG 1.1 F.6.5).
function arcSegments(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
  if ((x1 === x2 && y1 === y2)) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [`L${x2} ${y2}`];
  const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = Number(large) === Number(sweep) ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (coef * rx * yp) / ry, cyp = (-coef * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  let t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!Number(sweep) && dt > 0) dt -= 2 * Math.PI;
  else if (Number(sweep) && dt < 0) dt += 2 * Math.PI;
  const parts = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / parts, k = (4 / 3) * Math.tan(step / 4);
  const point = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const deriv = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const segs = [];
  for (let p = 0; p < parts; p++) {
    const a = t1 + p * step, b = a + step;
    const [ax, ay] = point(a), [bx, by] = p === parts - 1 ? [x2, y2] : point(b);
    const [dax, day] = deriv(a), [dbx, dby] = deriv(b);
    const f = (v) => +v.toFixed(3);
    segs.push(`C${f(ax + k * dax)} ${f(ay + k * day)} ${f(bx - k * dbx)} ${f(by - k * dby)} ${f(bx)} ${f(by)}`);
  }
  return segs;
}
const tinyPaths = (svg) => String(svg).replace(/\sd="([^"]*)"/g, (m, d) => ` d="${arcsToCubics(d)}"`);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// "rgba(64,150,255,.22)" -> ["rgb(64,150,255)", 0.22]; "#4fb3ff" -> ["#4fb3ff", 1]
function paint(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || "");
  if (!m) return [c || "#000", 1];
  const p = m[1].split(",").map((x) => x.trim());
  return [`rgb(${p[0]},${p[1]},${p[2]})`, p[3] !== undefined ? num(p[3], 1) : 1];
}
// Mixes two #rrggbb colors, a share of `a`.
function mix(a, b, share) {
  const hex = (c) => { const h = String(c).replace("#", ""); const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
  try {
    const x = hex(a), y = hex(b);
    if (x.some(Number.isNaN) || y.some(Number.isNaN)) return a;
    return `#${x.map((v, i) => Math.round(v * share + y[i] * (1 - share)).toString(16).padStart(2, "0")).join("")}`;
  } catch { return a; }
}

// The key face's outline: the theme's rounded corners, or its cut corners (--key-clip).
function outline(th, x, y, w, h) {
  if (th.clip) {
    // Points may hold calc(): a bracket pair inside the polygon's is kept whole.
    const pts = /polygon\(((?:[^()]|\([^()]*\))*)\)/.exec(th.clip);
    if (pts) {
      const ev = (expr, full) => {
        const e = expr.trim();
        const calc = /calc\(100% - ([\d.]+)px\)/.exec(e);
        if (calc) return full - num(calc[1]) * 0.9;
        if (e.endsWith("%")) return (num(e) / 100) * full;
        return num(e) * 0.9;
      };
      const coords = pts[1].split(/,(?![^(]*\))/).map((p) => {
        const [px, py] = p.trim().split(/\s+(?![^(]*\))/);
        return [x + ev(px, w), y + ev(py, h)];
      });
      return `M${coords.map((c) => c.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
    }
  }
  const [tl, tr, br, bl] = th.radius.map((r) => Math.min(r, w / 2, h / 2));
  return arcsToCubics(`M${x + tl} ${y}H${x + w - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : ""}V${y + h - br}${br ? `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : ""}H${x + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : ""}V${y + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : ""}Z`);
}

// An icon from icons.js (48x48, currentColor) placed at (cx, cy), `size` px wide, in `color`.
// Themes with a glow get it as two wider, faint strokes beneath.
function icon(body, th, cx, cy, size, color, { glow = th.glow, strength = 1 } = {}) {
  if (!body) return "";
  const s = size / 48;
  const art = tinyPaths(String(body).replace(/currentColor/g, color));
  const at = `translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2).toFixed(2)}) scale(${s.toFixed(4)})`;
  const layer = (width, opacity) => `<g transform="${at}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">${art}</g>`;
  return (glow ? layer(th.stroke + 6, 0.07 * strength) + layer(th.stroke + 3, 0.14 * strength) : "") + layer(th.stroke, 1);
}

// A line's width in ems with the theme's tracking. `own`: drawn in the theme's display font,
// whose glyph widths theme() knows; else the rough average.
function textWidth(text, th, own = true) {
  const widths = own ? th.font.widths : null, rough = own ? th.font.per : roughWidth(th.font.upper);
  let em = 0;
  for (const ch of String(text)) em += (widths && widths[ch] !== undefined ? widths[ch] : rough) + th.font.track;
  return em;
}

// Splits a label into at most two lines that fit, and picks a font size for them (`own` as
// for textWidth).
function fitLabel(label, th, width, maxSize, own = true) {
  const text = th.font.upper ? String(label).toUpperCase() : String(label);
  const fits = (s, size) => textWidth(s, th, own) * size <= width;
  let size = maxSize;
  if (fits(text, size)) return { lines: [text], size };
  // The split with the narrower longer line.
  const twoLines = (words) => {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      const longest = Math.max(...lines.map((l) => textWidth(l, th, own)));
      if (!best || longest < best.longest) best = { lines, longest };
    }
    let s = maxSize;
    while (s > 11 && best.longest * s > width) s -= 1;
    return { lines: best.lines, size: Math.min(s, maxSize * 0.9) };
  };
  // Short tails ("+", "−", "2") stay with the word before them rather than make a line.
  const raw = text.split(/\s+/);
  const words = raw.reduce((list, w) => {
    if (list.length && w.length <= 2) list[list.length - 1] += ` ${w}`; else list.push(w);
    return list;
  }, []);
  if (words.length > 1) {
    // One line still wins if it fits at the size two lines would get ("ON FOOT" a little
    // over the width).
    const split = twoLines(words);
    while (size > split.size && !fits(text, size)) size -= 1;
    return size >= split.size && fits(text, size) ? { lines: [text], size } : split;
  }
  while (size > 10 && !fits(text, size)) size -= 1;
  // ...unless keeping one would shrink the line below 16 px ("THRUSTERS +"): then it does.
  if (size < 16 && raw.length > 1 && raw[raw.length - 1].length <= 2) {
    const split = twoLines([raw.slice(0, -1).join(" "), raw[raw.length - 1]]);
    if (split.size > size) return split;
  }
  return { lines: [text], size };
}

function label(text, th, cx, bottom, { color, maxSize = 21, width = 110, font = th.font.family } = {}) {
  if (!text) return "";
  const fit = fitLabel(text, th, width, maxSize, font === th.font.family);
  const lh = fit.size * 1.08;
  const y0 = bottom - (fit.lines.length - 1) * lh;
  const track = (th.font.track * fit.size).toFixed(2);
  return fit.lines.map((line, i) => `<text x="${cx}" y="${(y0 + i * lh).toFixed(1)}" text-anchor="middle" font-family="${esc(font)}" font-size="${fit.size}" font-weight="${th.font.weight}" letter-spacing="${track}" fill="${color}">${esc(line)}</text>`).join("");
}

// ---------- the key face ----------

// A short id from a string (FNV-1a), so gradients get ids that are the same for the same
// key every time (generated files don't change between builds) but differ between keys,
// which matters when several keys share one page (previews, the icon pack's sheet).
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

// ---------- materials ----------
// Each maker's surface, drawn over a face in `box` ({ x, y, w, h, shape }), the way
// public/makers.css draws the deck's buttons. Shapes stay clear of cut corners, since
// small renderers have no clipping.

// A few scratches, each a light line with a dark groove beside it, in a unit square.
const SCRATCHES = [[0.1, 0.22, 0.46, 0.3], [0.58, 0.12, 0.9, 0.3], [0.14, 0.78, 0.44, 0.64], [0.56, 0.86, 0.84, 0.8], [0.38, 0.47, 0.6, 0.52], [0.86, 0.44, 0.76, 0.68]];
function scratches({ x, y, w, h }, strength = 1) {
  return SCRATCHES.map(([a, b, c, d]) => {
    const p = `M${(x + a * w).toFixed(1)} ${(y + b * h).toFixed(1)}L${(x + c * w).toFixed(1)} ${(y + d * h).toFixed(1)}`;
    return `<path d="${p}" stroke="#fff" stroke-opacity="${(0.09 * strength).toFixed(3)}" stroke-width="1" fill="none"/><path d="${p}" transform="translate(.8 1)" stroke="#000" stroke-opacity="${(0.32 * strength).toFixed(3)}" stroke-width="1" fill="none"/>`;
  }).join("");
}
const rivet = (cx, cy, r, metal) => `<circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="#000" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${metal}"/><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${(r * 0.4).toFixed(2)}" fill="#fff" opacity=".28"/>`;
const screw = (cx, cy) => `${rivet(cx, cy, 3.4, "#5f6849")}<path d="M${cx - 2.4} ${cy + 1.2}L${cx + 2.4} ${cy - 1.2}" stroke="#262b1e" stroke-width="1.2"/>`;
// A horizontal band of hazard stripes.
const hazard = (x, y, w, h, color, dark = "#14130f") => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${dark}"/>`;
  for (let sx = x - h; sx < x + w; sx += h * 2) {
    const a = Math.max(sx, x), b = Math.min(sx + h, x + w);
    if (b > a) s += `<path d="M${a} ${y + h}L${Math.min(a + h, x + w)} ${y}H${Math.min(b + h, x + w)}L${b} ${y + h}Z" fill="${color}"/>`;
  }
  return s;
};
// 45-degree lines across the box, kept inside it (Aegis's weave).
function weave({ x, y, w, h }, step, inset, color, opacity, dir) {
  const L = x + inset, R = x + w - inset, T = y + inset, B = y + h - inset, out = [];
  for (let k = -(B - T); k < R - L; k += step) {
    const t0 = Math.max(0, -k), t1 = Math.min(B - T, R - L - k);
    if (t1 <= t0) continue;
    const x0 = dir > 0 ? L + k + t0 : R - k - t0, x1 = dir > 0 ? L + k + t1 : R - k - t1;
    out.push(`M${x0.toFixed(1)} ${(T + t0).toFixed(1)}L${x1.toFixed(1)} ${(T + t1).toFixed(1)}`);
  }
  return `<path d="${out.join("")}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.4" fill="none"/>`;
}
// A soft sheen: the shape filled with a gradient of white that fades out.
const sheen = (box, id, stops, { x2 = 0, y2 = 1 } = {}) =>
  `<defs><linearGradient id="m${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, op, col = "#fff"]) => `<stop offset="${o}" stop-color="${col}" stop-opacity="${op}"/>`).join("")}</linearGradient></defs><path d="${box.shape}" fill="url(#m${id})"/>`;
const glowDot = (id, cx, cy, r, color, opacity) =>
  `<defs><radialGradient id="d${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#d${id})"/>`;

function material(th, box, c, { id = "" } = {}) {
  const { x, y, w, h } = box, r = x + w, b = y + h;
  switch (th.material) {
    case "glass": return `<path d="M${x} ${y}H${x + w * 0.55}L${x} ${y + h * 0.6}Z" fill="#fff" opacity=".045"/>`;
    case "plate": return scratches(box) + rivet(x + 8, y + 8, 2, "#7c7461") + rivet(r - 8, y + 8, 2, "#7c7461") + rivet(x + 8, b - 8, 2, "#7c7461");
    case "carbon": return weave(box, 7, 10, "#fff", 0.04, 1) + weave(box, 7, 10, "#000", 0.28, -1);
    case "armour": // the old spelling, still in older theme files
    case "armor": return scratches(box, 0.8) + `<circle cx="${x + 14}" cy="${y + 14}" r="4" fill="#1c2016"/><circle cx="${x + 14}" cy="${y + 14}" r="4.6" fill="none" stroke="#fff" stroke-opacity=".12"/>` + screw(r - 12, b - 12);
    case "gloss": return sheen(box, id, [[0, 0.16], [0.47, 0.03], [0.5, 0]]);
    case "enamel": return `<rect x="${r - 50}" y="${y}" width="36" height="3.5" fill="${th.accent}"/><rect x="${x + w * 0.27}" y="${b - 3}" width="${w * 0.46}" height="2" fill="#000" opacity=".32"/>`;
    case "pearl": return sheen(box, id, [[0, 0.95], [0.45, 0]]) + `<rect x="${x + w * 0.28}" y="${b - 3}" width="${w * 0.44}" height="2" fill="#c3d1de"/>`;
    case "lacquer": return glowDot(id, x + w * 0.28, y + h * 0.16, w * 0.42, "#ffd7af", 0.16);
    case "shell": return glowDot(id, x + w * 0.32, y + 2, w * 0.5, "#8cffd7", 0.2);
    case "hazard": return scratches(box) + rivet(x + 8, y + 8, 1.6, "#555") + rivet(r - 8, y + 8, 1.6, "#555");
    case "clay": return sheen(box, id, [[0, 0.07], [0.4, 0]]);
    case "silk": return sheen(box, id, [[0, 0.06], [0.4, 0]], { x2: 1, y2: 1 })
      + `<defs><linearGradient id="h${id}" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="${th.accent}" stop-opacity="0"/><stop offset="1" stop-color="${th.accent}" stop-opacity=".6"/></linearGradient></defs><rect x="${x}" y="${b - 1.5}" width="${w}" height="1.5" fill="url(#h${id})"/>`;
    default: return "";
  }
}
// What a lit key adds, per maker: Drake's hazard band, Anvil's lamp, Origin's gold bar...
function litMark(th, box, c, { id = "" } = {}) {
  const { x, y, w, h } = box, r = x + w, b = y + h;
  const bar = (bw, bh, by = b - bh) => `<rect x="${(x + (w - bw) / 2).toFixed(1)}" y="${by}" width="${bw.toFixed(1)}" height="${bh}" fill="${c}"/>`;
  switch (th.material) {
    case "glass": return bar(w * 0.4, 2.5);
    case "plate": return hazard(x + 1, y + 1, w - 2, 7, c);
    case "carbon": return [[r, y, -1, 1], [x, b, 1, -1]].map(([cx, cy, sx, sy]) => `<path d="M${cx + sx * 18} ${cy}H${cx}V${cy + sy * 18}" fill="none" stroke="${c}" stroke-width="3"/>`).join("");
    case "armour":
    case "armor": return glowDot(`l${id}`, x + 14, y + 14, 11, c, 0.7) + `<circle cx="${x + 14}" cy="${y + 14}" r="3.4" fill="${c}"/><circle cx="${x + 13}" cy="${y + 13}" r="1.2" fill="#fff"/>`;
    case "gloss": return bar(w * 0.4, 2.5, b - 3);
    case "enamel": return bar(w * 0.46, 2.5, b - 3) + `<rect x="${x + 10}" y="${y}" width="28" height="3.5" fill="${c}"/>`;
    case "pearl": return bar(w * 0.44, 2.5, b - 3);
    case "lacquer": return glowDot(`l${id}`, x + w / 2, b, w * 0.6, c, 0.45);
    case "shell": return glowDot(`l${id}`, r - 16, b - 16, 14, c, 0.75) + `<circle cx="${r - 16}" cy="${b - 16}" r="3.2" fill="${c}"/>`;
    case "hazard": return `<rect x="${x}" y="${b - 7}" width="${w}" height="7" fill="${c}"/>`;
    case "clay": return `<defs><linearGradient id="s${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#ffb03b"/></linearGradient></defs><rect x="${x + 4}" y="${y + 1}" width="${w - 8}" height="5" fill="url(#s${id})"/>`;
    case "silk": return sheen(box, `l${id}`, [[0.3, 0, c], [0.75, 0.24, c], [1, 0, c]], { x2: 1, y2: 0.4 })
      + `<rect x="${x + w * 0.2}" y="${b - 2.5}" width="${w * 0.8}" height="2.5" fill="${c}" opacity=".9"/>`;
    default: return "";
  }
}

// Background, frame, theme decoration; `c` is the button's color. A tab's frame is quiet
// until it's lit.
function face(th, c, { lit = false, pressed = false, blocked = false, dim = false, tab = false } = {}) {
  const id = hash(`${th.id}|${c}|${lit}|${pressed}|${blocked}|${dim}`);
  const f = 6, w = SIZE - 2 * f, h = SIZE - 2 * f;
  const shape = outline(th, f, f, w, h);
  const ring = blocked ? th.colors.red : lit || pressed ? c : tab ? mix(th.dim, th.faceLo, 0.6) : mix(th.lineHi, c, 0.75);
  const bgTop = th.faceHi, bgBottom = th.faceLo;
  const tint = (lit ? 0.26 : pressed ? 0.34 : blocked ? 0.3 : 0) * (th.faceLight ? 0.6 : 1);
  const tintColor = blocked ? th.colors.red : c;
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="k${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
    <radialGradient id="g${id}" cx="${th.backdrop ? th.backdrop.x : 0.7}" cy="${th.backdrop ? Math.max(th.backdrop.y, -0.2) : 0}" r="0.95"><stop offset="0" stop-color="${th.backdrop ? paint(th.backdrop.color)[0] : th.accent}" stop-opacity="${th.backdrop ? Math.min(paint(th.backdrop.color)[1] * 1.4, 0.4) : 0.15}"/><stop offset="1" stop-color="${th.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="t${id}" cx="0.5" cy="0.42" r="0.7"><stop offset="0" stop-color="${tintColor}" stop-opacity="${tint}"/><stop offset="1" stop-color="${tintColor}" stop-opacity="${tint * 0.25}"/></radialGradient>
  </defs>`);
  // The space around the face (the key's corners) in the page color.
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="${th.bg}"/>`);
  parts.push(`<path d="${shape}" fill="url(#k${id})"/>`);
  if (th.backdrop) parts.push(`<path d="${shape}" fill="url(#g${id})"/>`);
  // Theme texture: MISC's brushed enamel, RSI's grid.
  if (th.stripes) for (let y = f + 4; y < SIZE - f; y += 5) parts.push(`<rect x="${f}" y="${y}" width="${w}" height="1.4" fill="#fff" opacity=".025"/>`);
  if (th.grid) for (let v = f + 22; v < SIZE - f; v += 22) parts.push(`<rect x="${v}" y="${f}" width="1" height="${h}" fill="#fff" opacity=".035"/><rect x="${f}" y="${v}" width="${w}" height="1" fill="#fff" opacity=".035"/>`);
  // The maker's material (rivets, weave, gloss...), as on the deck's buttons.
  const box = { x: f, y: f, w, h, shape };
  parts.push(material(th, box, c, { id }));
  if (tint) parts.push(`<path d="${shape}" fill="url(#t${id})"/>`);
  if (lit) parts.push(litMark(th, box, c, { id }));
  // Top strip (--key-top): hazard stripes, a segment, a fading line, or one centered.
  const tk = th.top;
  if (tk.kind !== "none" && tk.height) {
    const ty = f + 1, th2 = Math.max(tk.height * 0.9, 1.5);
    if (tk.kind === "hazard") {
      parts.push(`<path d="${shape}" fill="none"/>`);
      for (let x = f - 14; x < SIZE - f; x += 16) parts.push(`<path d="M${x} ${ty + th2}l${th2} ${-th2}h8l${-th2} ${th2}Z" fill="${c}" opacity=".9"/>`);
    } else if (tk.kind === "segment") {
      parts.push(`<rect x="${f + 10}" y="${ty}" width="${Math.min(tk.length || 50, w - 20)}" height="${th2}" fill="${c}"/>`);
    } else if (tk.kind === "center") {
      parts.push(`<rect x="${f + w * 0.2}" y="${ty}" width="${w * 0.6}" height="${th2}" fill="${c}" opacity=".85"/>`);
    } else {
      parts.push(`<rect x="${f + 8}" y="${ty}" width="${w * 0.6}" height="${th2}" fill="${c}" opacity=".9"/><rect x="${f + 8 + w * 0.6}" y="${ty}" width="${w * 0.2}" height="${th2}" fill="${c}" opacity=".35"/>`);
    }
  }
  // Left edge bar (--key-edge) in the button's color.
  if (th.edge) parts.push(`<rect x="${f}" y="${f + 8}" width="${th.edge}" height="${h - 16}" fill="${c}" opacity="${dim ? 0.4 : 1}"/>`);
  // The frame, with a soft outer glow when lit.
  if (lit || blocked) parts.push(`<path d="${shape}" fill="none" stroke="${ring}" stroke-width="7" opacity=".22"/>`);
  parts.push(`<path d="${shape}" fill="none" stroke="${ring}" stroke-width="${lit || blocked || pressed ? 2.6 : 1.6}" opacity="${lit || blocked || pressed ? 1 : 0.85}"/>`);
  // HUD corner brackets, RSI's mark, in the theme's accent.
  if (th.material === "glass" && !th.clip) {
    const b = 13, o = f + 5, e = SIZE - f - 5, col = lit ? c : th.accent;
    const br = (d) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="square" opacity="${lit ? 0.95 : 0.55}"/>`;
    if (th.radius[0] < 12) parts.push(br(`M${o} ${o + b}V${o}H${o + b}`));
    if (th.radius[2] < 12) parts.push(br(`M${e} ${e - b}V${e}H${e - b}`));
  }
  return parts.join("");
}

// ---------- press animations ----------
// `anim` is { kind, t } with t from 0 to 1 through the effect (the plugin plays them as frames).

function animation(a, th, c, iconBox) {
  if (!a) return "";
  const t = Math.max(0, Math.min(1, a.t));
  const { cx, cy, size } = iconBox;
  switch (a.kind) {
    case "charge": { // quantum spool: a ring fills around the icon
      const r = size * 0.56, len = 2 * Math.PI * r;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="4" opacity=".18"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(len * t).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
        ${t >= 1 ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${c}" stroke-width="2" opacity=".5"/>` : ""}`;
    }
    case "hazard": { // arming bar fills along the bottom, in hazard stripes
      const w = 120 * t;
      let s = `<rect x="12" y="118" width="120" height="10" fill="${th.colors.red}" opacity=".15"/>`;
      for (let x = 12; x < 12 + w; x += 12) s += `<path d="M${x} 128l6 -10h6l-6 10Z" fill="${th.colors.red}"/>`;
      return s;
    }
    case "timed": return `<rect x="16" y="126" width="${(112 * t).toFixed(1)}" height="4" fill="${c}"/>`;
    case "ripple": return [0, 0.25].map((d) => { const p = Math.max(0, Math.min(1, (t - d) / 0.75)); return p > 0 && p < 1 ? `<circle cx="${cx}" cy="${cy}" r="${(size * 0.3 + p * 60).toFixed(1)}" fill="none" stroke="${c}" stroke-width="${(3 * (1 - p)).toFixed(2)}" opacity="${(1 - p).toFixed(2)}"/>` : ""; }).join("");
    case "gear": { // struts drop below the icon
      return [0, 1, 2].map((i) => { const p = Math.max(0, Math.min(1, t * 1.4 - i * 0.2)); return `<rect x="${44 + i * 26}" y="${cy + size * 0.42}" width="4" height="${(16 * p).toFixed(1)}" fill="${c}"/><rect x="${38 + i * 26}" y="${(cy + size * 0.42 + 16 * p).toFixed(1)}" width="16" height="3" rx="1.5" fill="${c}" opacity="${p.toFixed(2)}"/>`; }).join("");
    }
    case "doors": { // doors slide open over the face, then the icon shows
      const open = t * 66;
      return `<rect x="6" y="6" width="${(66 - open).toFixed(1)}" height="132" fill="${th.panelHi}" opacity=".92"/><rect x="${(72 + open).toFixed(1)}" y="6" width="${(66 - open).toFixed(1)}" height="132" fill="${th.panelHi}" opacity=".92"/>
        <rect x="${(70 - open).toFixed(1)}" y="6" width="2" height="132" fill="${c}"/><rect x="${(72 + open).toFixed(1)}" y="6" width="2" height="132" fill="${c}"/>`;
    }
    case "lock": { // brackets converge on the icon, then blink
      const d = 30 * (1 - t), r = size * 0.5 + d, k = 12, col = t >= 1 ? c : th.dim;
      return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => { const x = cx + sx * r, y = cy + sy * r; return `<path d="M${x} ${y - sy * -k}V${y}H${x - sx * k}" fill="none" stroke="${col}" stroke-width="2.6" opacity="${(0.4 + 0.6 * t).toFixed(2)}"/>`; }).join("")
        + (t >= 1 ? `<circle cx="${cx}" cy="${cy}" r="3" fill="${c}"/>` : "");
    }
    case "burst": { // decoy sparks fly out
      let s = "";
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + 0.3, dist = 18 + t * 48;
        s += `<circle cx="${(cx + Math.cos(ang) * dist).toFixed(1)}" cy="${(cy + Math.sin(ang) * dist).toFixed(1)}" r="${(3.2 * (1 - t) + 0.6).toFixed(2)}" fill="${c}" opacity="${(1 - t).toFixed(2)}"/>`;
      }
      return s;
    }
    case "recoil": return t < 0.5 ? `<circle cx="${cx}" cy="${cy + size * 0.35}" r="${(14 + 30 * t).toFixed(1)}" fill="${c}" opacity="${(0.55 * (1 - 2 * t)).toFixed(2)}"/>` : "";
    case "streak": {
      let s = "";
      for (let i = 0; i < 6; i++) { const y = 20 + ((i * 37) % 100), x = 144 - ((t * 180 + i * 41) % 190); s += `<rect x="${x.toFixed(1)}" y="${y}" width="34" height="2" rx="1" fill="${c}" opacity=".55"/>`; }
      return s;
    }
    case "glow": return `<path d="M30 6h84l-10 54H40Z" fill="${th.colors.amber}" opacity="${(0.25 * (t < 0.3 ? (Math.round(t * 20) % 2) : 1)).toFixed(2)}"/>`;
    case "flash": return `<circle cx="${cx}" cy="${cy}" r="${(10 + t * 70).toFixed(1)}" fill="${c}" opacity="${(0.45 * (1 - t)).toFixed(2)}"/>`;
    default: return "";
  }
}

// ---------- a whole key ----------

// opts: theme (from theme()), icon (svg body), label, color ("" | green | amber | red | blue),
// status (small word: DEPLOYED, ON, LOCKED...), lit, pressed, blocked, offline, anim {kind,t},
// keys (a key label like "LALT+N", drawn small), showLabel (default true), badge (a small
// corner glyph: "folder" or "back"), font ("live" uses Windows fonts only), tab (a
// navigation key: scene tabs, Back, Next... drawn quiet and underlined, so the action keys
// and the one lit tab stand out).
function key(opts) {
  const th = opts.theme;
  const c = opts.blocked ? th.colors.red : th.colors[opts.color || ""] || th.accent;
  const showLabel = opts.showLabel !== false && opts.label;
  const font = opts.font === "live" ? th.font.windows : th.font.family;
  const quiet = opts.tab && !opts.lit && !opts.pressed && !opts.blocked;
  const box = showLabel ? { cx: 72, cy: opts.status ? 52 : 56, size: opts.status ? 52 : 58 } : { cx: 72, cy: 72, size: 78 };
  const parts = [face(th, c, opts)];
  // On a light face thin strokes in pale colors fade: heavier and darker there.
  const ink = opts.offline ? th.dim : quiet ? mix(c, th.dim, 0.4) : th.faceLight ? mix(c, th.text, 0.65) : c;
  const ith = th.faceLight ? { ...th, stroke: Math.max(th.stroke, 2.4) } : th;
  parts.push(icon(opts.icon, ith, box.cx, box.cy, box.size, ink, { glow: quiet ? false : th.glow, strength: opts.lit || opts.pressed ? 1.8 : 1 }));
  parts.push(animation(opts.anim, th, c, box));
  if (showLabel) parts.push(label(opts.label, th, 72, opts.status ? 110 : 122, { color: opts.offline || quiet ? th.dim : th.text, font }));
  if (opts.status) parts.push(`<text x="72" y="128" text-anchor="middle" font-family="${esc(font)}" font-size="11" font-weight="700" letter-spacing="1.6" fill="${opts.lit ? c : th.dim}">${esc(opts.status)}</text>`);
  if (opts.tab) parts.push(`<rect x="44" y="131" width="56" height="${quiet ? 2 : 4}" fill="${c}" opacity="${quiet ? 0.55 : 1}"/>`);
  if (opts.keys) parts.push(`<text x="${136 - th.edge}" y="22" text-anchor="end" font-family="${esc(th.font.windows)}" font-size="10" font-weight="600" letter-spacing=".8" fill="${th.dim}">${esc(String(opts.keys).toUpperCase())}</text>`);
  // Badges sit top right, clear of the label and of corners some themes cut (Drake's).
  const bx = 128 - th.edge;
  if (opts.badge === "folder") parts.push(`<path d="M${bx - 20} 15h8l3 3h9v13h-20Z" fill="none" stroke="${th.accent}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`);
  if (opts.badge === "back") parts.push(`<path d="M${bx} 23h-16m5-5-5 5 5 5" fill="none" stroke="${th.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (opts.offline) parts.push(`<path d="M114 20l14 14m0-14-14 14" stroke="${th.colors.red}" stroke-width="2.6" stroke-linecap="round"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${parts.join("")}</svg>`;
}

// A plain backdrop key for empty slots, in the page color, so a page reads as one panel
// (light themes too: a white key face would glare on a lit device).
function blank(th) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="${th.bg}"/><path d="M66 72h12M72 66v12" stroke="${mix(th.inkDim, th.bg, 0.45)}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

module.exports = { SIZE, parseThemes, theme, key, blank, icon, label, textWidth, face, material, litMark, mix, arcsToCubics, outline };
