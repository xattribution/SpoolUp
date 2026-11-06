// The pack's pictures beyond plain keys, in the same HUD style as streamdeck/keyart.js:
// pack keys (scenes, folders, navigation, theme emblems), touch-strip panels for Stream
// Deck + and + XL dials, dial icons, and the white list icons Stream Deck's action list wants.
// All are SVG strings; tools/make-streamdeck.js renders them to PNG.
"use strict";
const keyart = require("../../streamdeck/keyart");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Emblems in public/app.js are drawn on a 64 grid with parts in the theme's text colour;
// keys draw icons on a 48 grid in one colour, so the emblem is scaled and the text-coloured
// parts keep a placeholder that becomes the theme's text colour once the key is drawn.
const TEXT = "__THEME_TEXT__";
const emblemIcon = (emblem) => `<g transform="scale(.75)">${emblem}</g>`;

function createArt({ icons, themes, tokens }) {
  const themeCache = new Map();
  const theme = (id) => {
    if (!themeCache.has(id)) {
      if (!tokens[id]) throw new Error(`No theme "${id}" in public/themes.css`);
      themeCache.set(id, keyart.theme(tokens[id], id));
    }
    return themeCache.get(id);
  };
  const icon = (name) => icons[name] || icons.default;
  const colorOf = (th, color) => th.colors[color || ""] || th.accent;
  const themeInfo = (id) => themes.find((t) => t.id === id);

  // ---------- keys ----------

  // A catalog action. Timed presses become "hold" on a Hotkey key, which can't time them.
  function actionKey(th, a, { lit = false, standalone = true } = {}) {
    const status = lit ? (a.state && a.state.on) || "ON" : standalone && a.mode === "timed" ? "HOLD" : undefined;
    return keyart.key({ theme: th, icon: icon(a.icon), label: a.label, color: a.color, lit, status });
  }
  const sceneKey = (th, scene, lit) => keyart.key({ theme: th, icon: icon(scene.icon), label: scene.short || scene.name, color: scene.color, lit });
  const folderKey = (th, folder) => keyart.key({ theme: th, icon: icon(folder.icon), label: folder.name, color: folder.color, badge: "folder" });
  const navKey = (th, kind) => {
    const k = { back: ["back", "Back"], next: ["page-next", "Next"], prev: ["page-prev", "Previous"], more: ["page-next", "More"], home: ["home", "Home"] }[kind];
    return keyart.key({ theme: th, icon: icon(k[0]), label: k[1], badge: kind === "more" ? "folder" : undefined });
  };
  // A theme's key is drawn in that theme, so the folder previews every look.
  function themeKey(id, lit = false) {
    const th = theme(id), t = themeInfo(id);
    return keyart.key({ theme: th, icon: emblemIcon(t.emblem), label: t.name, lit, status: lit ? "ACTIVE" : undefined }).split(TEXT).join(th.text);
  }
  const blankKey = (th) => keyart.blank(th);

  // ---------- touch strip ----------

  // The key face's outline (rounded or cut corners, per theme) for any box.
  function outline(th, x, y, w, h) {
    if (th.clip) {
      const pts = /polygon\(([^)]*(?:\([^)]*\)[^)]*)*)\)/.exec(th.clip);
      if (pts) {
        const ev = (e, full) => {
          const calc = /calc\(100% - ([\d.]+)px\)/.exec(e.trim());
          if (calc) return full - parseFloat(calc[1]) * 0.9;
          if (e.trim().endsWith("%")) return (parseFloat(e) / 100) * full;
          return parseFloat(e) * 0.9;
        };
        const coords = pts[1].split(/,(?![^(]*\))/).map((p) => {
          const [px, py] = p.trim().split(/\s+(?![^(]*\))/);
          return [x + ev(px, w), y + ev(py, h)];
        });
        return `M${coords.map((c) => c.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
      }
    }
    const [tl, tr, br, bl] = th.radius.map((r) => Math.min(r, w / 2, h / 2));
    return keyart.arcsToCubics(`M${x + tl} ${y}H${x + w - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : ""}V${y + h - br}${br ? `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : ""}H${x + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : ""}V${y + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : ""}Z`);
  }

  // Text that fits `width` at no more than `size` (a rough per-glyph width, like keyart's).
  function fitText(text, th, width, size, min = 8) {
    const t = th.font.upper ? String(text).toUpperCase() : String(text);
    const per = (th.font.upper ? 0.64 : 0.56) + th.font.track;
    let s = size;
    while (s > min && t.length * s * per > width) s -= 0.5;
    let out = t;
    while (out.length > 1 && out.length * s * per > width) out = out.slice(0, -1);
    return { text: out === t ? t : `${out.slice(0, -1)}…`, size: s };
  }
  const text = (th, x, y, t, { size, anchor = "start", fill, weight = th.font.weight, font = th.font.family }) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${esc(font)}" font-size="${size}" font-weight="${weight}" letter-spacing="${(th.font.track * size).toFixed(2)}" fill="${fill}">${esc(t)}</text>`;

  // One dial's 200x100 panel: theme frame, the dial's icon and name, and what turning and
  // pushing do. `id` keeps gradient ids apart when panels share one strip.
  function panelBody(th, d, id, { x = 0 } = {}) {
    const c = d ? colorOf(th, d.color) : th.dim;
    const W = 200, H = 100, f = 3, shape = outline(th, x + f, f, W - 2 * f, H - 2 * f);
    const bgTop = th.light ? th.panel : keyart.mix(th.panelHi, th.bg, 0.55);
    const bgBottom = th.light ? keyart.mix(th.bg, th.panel, 0.45) : th.bg;
    const parts = [`<defs><linearGradient id="pb${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
      <radialGradient id="pg${id}" cx="0.2" cy="0.1" r="0.9"><stop offset="0" stop-color="${c}" stop-opacity="${d ? 0.22 : 0.06}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>`];
    parts.push(`<rect x="${x}" width="${W}" height="${H}" fill="${th.light ? th.bg : "#000"}"/>`);
    parts.push(`<path d="${shape}" fill="url(#pb${id})"/><path d="${shape}" fill="url(#pg${id})"/>`);
    if (th.stripes) for (let y = f + 4; y < H - f; y += 5) parts.push(`<rect x="${x + f}" y="${y}" width="${W - 2 * f}" height="1.2" fill="#fff" opacity=".025"/>`);
    if (th.grid) for (let v = f + 20; v < W - f; v += 20) parts.push(`<rect x="${x + v}" y="${f}" width="1" height="${H - 2 * f}" fill="#fff" opacity=".035"/>`);
    if (d) {
      if (th.top.kind !== "none" && th.top.height) parts.push(`<rect x="${x + 14}" y="${f + 1}" width="${th.top.kind === "centre" ? 172 : 64}" height="${Math.max(th.top.height * 0.9, 1.5)}" fill="${c}" opacity=".9"/>`);
      if (th.edge) parts.push(`<rect x="${x + f}" y="${f + 8}" width="${th.edge}" height="${H - 2 * f - 16}" fill="${c}"/>`);
    }
    parts.push(`<path d="${shape}" fill="none" stroke="${d ? keyart.mix(th.lineHi, c, 0.6) : th.line}" stroke-width="1.6" opacity=".9"/>`);
    if (!d) return parts.join("");
    parts.push(keyart.icon(icon(d.icon), th, x + 40, 56, 50, c));
    const title = fitText(d.label, th, 112, 18, 11);
    parts.push(text(th, x + 76, 31, title.text, { size: title.size, fill: th.text }));
    // Turn left / right on one line, push on the next; small arrows rather than glyphs, which
    // not every theme font has.
    const hint = (t, w) => fitText(t || "", th, w, 12, 8);
    const ccw = hint(d.hints.ccw, 52), cw = hint(d.hints.cw, 52), push = hint(d.hints.press, 78);
    const small = { fill: th.dim, weight: 700, font: th.font.body };
    if (d.hints.ccw) parts.push(`<path d="M${x + 82} 50l-6 4 6 4Z" fill="${c}"/>`, text(th, x + 86, 58, ccw.text, { ...small, size: ccw.size }));
    if (d.hints.cw) parts.push(`<path d="M${x + 184} 50l6 4-6 4Z" fill="${c}"/>`, text(th, x + 180, 58, cw.text, { ...small, size: cw.size, anchor: "end" }));
    if (d.hints.press) {
      parts.push(`<circle cx="${x + 80}" cy="${78}" r="4" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${x + 80}" cy="78" r="1.5" fill="${c}"/>`);
      parts.push(text(th, x + 90, 82, push.text, { ...small, size: push.size, fill: th.text }));
    }
    if (th.radius[0] < 12 && !th.clip) parts.push(`<path d="M${x + 8} 20V8H20" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/><path d="M${x + 192} 80V92H180" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/>`);
    return parts.join("");
  }
  // d: { label, icon, color, hints: { ccw, cw, press } } or null for an unused dial.
  // (Drawn at any size: the renderer scales the viewBox, e.g. to 400x200 for @2x.)
  const dialPanel = (th, d) => svg(200, 100, panelBody(th, d, "0"));
  // The whole strip: every dial's panel side by side.
  const strip = (th, dials) => svg(200 * dials.length, 100, dials.map((d, i) => panelBody(th, d, `s${i}`, { x: i * 200 })).join(""));
  // What a folder's strip shows: its name and the way out, since dials rest while it's open.
  function folderStrip(th, folder, count) {
    const W = 200 * count, c = colorOf(th, folder.color), shape = outline(th, 3, 3, W - 6, 94);
    const title = fitText(folder.name, th, W - 260, 24, 12);
    return svg(W, 100, `<defs><linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.light ? th.panel : keyart.mix(th.panelHi, th.bg, 0.55)}"/><stop offset="1" stop-color="${th.bg}"/></linearGradient></defs>
      <rect width="${W}" height="100" fill="${th.light ? th.bg : "#000"}"/><path d="${shape}" fill="url(#fb)"/>
      <path d="${shape}" fill="none" stroke="${keyart.mix(th.lineHi, c, 0.6)}" stroke-width="1.6"/>
      ${keyart.icon(icon(folder.icon), th, 50, 50, 56, c)}
      ${text(th, 96, 58, title.text, { size: title.size, fill: th.text })}
      ${keyart.icon(icon("back"), th, W - 150, 50, 30, th.accent)}
      ${text(th, W - 126, 56, "Back to leave", { size: 14, fill: th.dim, font: th.font.body, weight: 700 })}`);
  }
  // The dial's picture in Stream Deck's editor (its circle), on transparent.
  const dialIcon = (th, d) => svg(144, 144, keyart.icon(icon(d.icon), th, 72, 72, 112, colorOf(th, d.color)));

  // ---------- Stream Deck's action list (white on transparent) ----------

  const listIcon = (name, size) => svg(size, size, `<g transform="scale(${size / 48})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${icon(name).replace(/currentColor/g, "#fff")}</g>`);
  // Tablet Deck's own mark (public/icon.svg, without its backdrop) for the category.
  const tabletMark = (size) => svg(size, size, `<g transform="scale(${size / 48})" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="11" width="38" height="27" rx="4"/><rect x="10" y="16" width="11" height="7" rx="1.5"/><rect x="10" y="27" width="11" height="7" rx="1.5" fill="#fff" fill-opacity=".4"/>
    <circle cx="32" cy="24.5" r="6"/><circle cx="32" cy="24.5" r="1.8" fill="#fff" stroke="none"/></g>`);

  return { theme, icon, colorOf, actionKey, sceneKey, folderKey, navKey, themeKey, blankKey, dialPanel, strip, folderStrip, dialIcon, listIcon, tabletMark };
}

module.exports = { createArt, TEXT };
