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

// A --key-clip polygon's points, read with nested calc() kept whole.
const POLYGON = /polygon\(((?:[^()]|\([^()]*\))*)\)/;
const clipPoints = (clip) => {
  const m = POLYGON.exec(clip || "");
  return m ? m[1].split(/,(?![^(]*\))/).map((p) => p.trim().split(/\s+(?![^(]*\))/)) : null;
};
// One clip coordinate as keyart reads it: calc(100% - Npx), a percentage, or px (x 0.9).
function clipValue(e, full) {
  const calc = /calc\(100% - ([\d.]+)px\)/.exec(e.trim());
  if (calc) return full - parseFloat(calc[1]) * 0.9;
  if (e.trim().endsWith("%")) return (parseFloat(e) / 100) * full;
  return parseFloat(e) * 0.9;
}

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

  // A catalog action. `mark`: a word under the label when not lit, such as PLUGIN on a key
  // that only works through the SpoolUp plugin.
  function actionKey(th, a, { lit = false, mark } = {}) {
    const status = lit ? (a.state && a.state.on) || "ON" : mark;
    return keyart.key({ theme: th, icon: icon(a.icon), label: a.keyLabel || a.label, color: a.color, lit, status });
  }
  // Navigation (scene tabs, the Scenes folder, Back, Next...) is drawn as tabs: quiet, with
  // the current scene the one lit. `tab`: a folder key in a tab row (the XLs' Themes and
  // Emotes) is a tab too.
  const sceneKey = (th, scene, lit) => keyart.key({ theme: th, icon: icon(scene.icon), label: scene.short || scene.name, color: scene.color, lit, tab: true });
  const folderKey = (th, folder, { tab = false } = {}) => keyart.key({ theme: th, icon: icon(folder.icon), label: folder.name, color: folder.color, badge: "folder", tab: tab || folder.items === "@scenes" });
  const navKey = (th, kind) => {
    const k = { back: ["back", "Back"], next: ["page-next", "Next"], prev: ["page-prev", "Previous"], more: ["page-next", "More"], home: ["home", "Home"] }[kind];
    return keyart.key({ theme: th, icon: icon(k[0]), label: k[1], badge: kind === "more" ? "folder" : undefined, tab: true });
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
    const points = clipPoints(th.clip);
    if (points) return `M${points.map(([px, py]) => [x + clipValue(px, w), y + clipValue(py, h)].map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
    const [tl, tr, br, bl] = th.radius.map((r) => Math.min(r, w / 2, h / 2));
    return keyart.arcsToCubics(`M${x + tl} ${y}H${x + w - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : ""}V${y + h - br}${br ? `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : ""}H${x + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : ""}V${y + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : ""}Z`);
  }

  // Text that fits `width` at no more than `size` (the theme font's glyph widths, as keys use).
  function fitText(text, th, width, size, min = 8) {
    const t = th.font.upper ? String(text).toUpperCase() : String(text);
    const em = (s) => keyart.textWidth(s, th);
    let s = size;
    while (s > min && em(t) * s > width) s -= 0.5;
    let out = t;
    while (out.length > 1 && em(out) * s > width) out = out.slice(0, -1);
    return { text: out === t ? t : `${out.slice(0, -1)}…`, size: s };
  }
  const text = (th, x, y, t, { size, anchor = "start", fill, weight = th.font.weight, font = th.font.family }) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${esc(font)}" font-size="${size}" font-weight="${weight}" letter-spacing="${(th.font.track * size).toFixed(2)}" fill="${fill}">${esc(t)}</text>`;
  // One title size for a strip's dials (the largest every label fits at), so the strip
  // reads as one panel rather than titles shrinking one by one.
  const titleSize = (th, labels) => labels.reduce((s, l) => Math.min(s, fitText(l, th, 112, 18, 11).size), 18);

  // One dial's 200x100 panel: theme frame, the dial's icon and name, and what turning and
  // pushing do. `id` keeps gradient ids apart when panels share one strip. `d.titleSize`:
  // the strip's title size (titleSize()); `d.external`: another plugin draws over this
  // part (Discord's volume), so it gets the frame in its colour and nothing else.
  function panelBody(th, d, id, { x = 0 } = {}) {
    const c = d ? colorOf(th, d.color) : th.dim;
    const W = 200, H = 100, f = 3, shape = outline(th, x + f, f, W - 2 * f, H - 2 * f);
    // An unused dial is flat, in its blank keys' (page) colour: a face there would read
    // as a control, and a white one glares on a lit strip.
    const flat = !d && th.bg;
    const bgTop = flat || th.faceHi;
    const bgBottom = flat || th.faceLo;
    const parts = [`<defs><linearGradient id="pb${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
      <radialGradient id="pg${id}" cx="0.2" cy="0.1" r="0.9"><stop offset="0" stop-color="${c}" stop-opacity="${d ? 0.22 : 0.06}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>`];
    parts.push(`<rect x="${x}" width="${W}" height="${H}" fill="${th.bg}"/>`);
    parts.push(`<path d="${shape}" fill="url(#pb${id})"/>`);
    if (d) parts.push(`<path d="${shape}" fill="url(#pg${id})"/>`, keyart.material(th, { x: x + f, y: f, w: W - 2 * f, h: H - 2 * f, shape }, c, { id: `${id}m` }));
    if (th.stripes) for (let y = f + 4; y < H - f; y += 5) parts.push(`<rect x="${x + f}" y="${y}" width="${W - 2 * f}" height="1.2" fill="#fff" opacity=".025"/>`);
    if (th.grid) for (let v = f + 20; v < W - f; v += 20) parts.push(`<rect x="${x + v}" y="${f}" width="1" height="${H - 2 * f}" fill="#fff" opacity=".035"/>`);
    if (d) {
      if (th.top.kind !== "none" && th.top.height) parts.push(`<rect x="${x + 14}" y="${f + 1}" width="${th.top.kind === "centre" ? 172 : 64}" height="${Math.max(th.top.height * 0.9, 1.5)}" fill="${c}" opacity=".9"/>`);
      if (th.edge) parts.push(`<rect x="${x + f}" y="${f + 8}" width="${th.edge}" height="${H - 2 * f - 16}" fill="${c}"/>`);
    }
    parts.push(`<path d="${shape}" fill="none" stroke="${d ? keyart.mix(th.lineHi, c, 0.6) : keyart.mix(th.inkDim, th.bg, 0.25)}" stroke-width="1.6" opacity=".9"/>`);
    if (!d || d.external) return parts.join("");
    parts.push(keyart.icon(icon(d.icon), th, x + 40, 56, 50, c));
    const title = fitText(d.label, th, 112, d.titleSize || 18, 11);
    parts.push(text(th, x + 76, 31, title.text, { size: title.size, fill: th.text }));
    // What turning left and right and pushing do. Symbols ("−", "+") share a line, large;
    // words share it smaller, or get a line each. A pair is drawn alike, so "DOWN" and "UP"
    // match. Arrows are drawn, since not every theme font has them.
    const per = (th.font.upper ? 0.7 : 0.6) + th.font.track;
    const sym = (t) => String(t || "").length <= 2;
    const wide = (t, size) => String(t || "").length * size * per;
    const small = { fill: th.dim, weight: 700, font: th.font.body };
    const { ccw: l, cw: r, press } = d.hints;
    const big = [l, r].filter(Boolean).every(sym);
    const oneLine = (!l || !r || wide(l, big ? 18 : 13) + wide(r, big ? 18 : 13) + 34 <= 112);
    const arrow = (ax, y, dir) => `<path d="M${ax} ${y - 5}L${ax + dir * 6} ${y}L${ax} ${y + 5}Z" fill="${c}"/>`;
    // A push or turn that only works through the SpoolUp plugin says so, as its keys do.
    const via = new Set(d.plugin || []);
    const tag = (tx, y) => text(th, tx, y, "PLUGIN", { ...small, size: 9, anchor: "end" });
    if (via.has("ccw") || via.has("cw")) parts.push(tag(x + 188, 17));
    if (oneLine) {
      const look = { ...small, size: big ? 18 : 13, fill: big ? th.text : th.dim }, room = l && r ? 46 : 92;
      if (l) { const t = fitText(l, th, room, look.size, 9); parts.push(arrow(x + 82, 56, -1), text(th, x + 87, big ? 62 : 60, t.text, { ...look, size: t.size })); }
      if (r) { const t = fitText(r, th, room, look.size, 9); parts.push(arrow(x + 184, 56, 1), text(th, x + 179, big ? 62 : 60, t.text, { ...look, size: t.size, anchor: "end" })); }
    } else {
      const a = fitText(l, th, 100, 12, 8), b = fitText(r, th, 100, 12, 8);
      parts.push(arrow(x + 82, 49, -1), text(th, x + 88, 53, a.text, { ...small, size: a.size }));
      parts.push(arrow(x + 76, 66, 1), text(th, x + 88, 70, b.text, { ...small, size: b.size }));
    }
    if (press) {
      const t = fitText(press, th, via.has("press") ? 54 : 96, 13, 8), y = oneLine ? 84 : 88;
      parts.push(`<circle cx="${x + 80}" cy="${y - 4}" r="4.5" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${x + 80}" cy="${y - 4}" r="1.6" fill="${c}"/>`);
      parts.push(text(th, x + 91, y, t.text, { ...small, size: t.size, fill: th.text }));
      if (via.has("press")) parts.push(tag(x + 188, y));
    }
    if (th.material === "glass" && !th.clip) parts.push(`<path d="M${x + 8} 20V8H${x + 20}" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/><path d="M${x + 192} 80V92H${x + 180}" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/>`);
    return parts.join("");
  }
  // d: { label, icon, color, hints: { ccw, cw, press }, plugin: [hints that need the plugin] }
  // or null for an unused dial.
  // (Drawn at any size: the renderer scales the viewBox, e.g. to 400x200 for @2x.)
  const dialPanel = (th, d) => svg(200, 100, panelBody(th, d, `${th.id}d`));
  // The whole strip: every dial's panel side by side.
  const strip = (th, dials) => svg(200 * dials.length, 100, dials.map((d, i) => panelBody(th, d, `${th.id}s${i}`, { x: i * 200 })).join(""));
  // What a folder's strip shows: its name and the way out, since dials rest while it's open.
  // `hint` says where Back goes (a folder's later pages go back a page).
  function folderStrip(th, folder, count, hint = "Back to leave") {
    const W = 200 * count, c = colorOf(th, folder.color), shape = outline(th, 3, 3, W - 6, 94);
    const title = fitText(folder.name, th, W - 260, 24, 12);
    return svg(W, 100, `<defs><linearGradient id="fb${th.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.faceHi}"/><stop offset="1" stop-color="${th.faceLo}"/></linearGradient></defs>
      <rect width="${W}" height="100" fill="${th.bg}"/><path d="${shape}" fill="url(#fb${th.id})"/>
      ${keyart.material(th, { x: 3, y: 3, w: W - 6, h: 94, shape }, c, { id: `${th.id}f` })}
      <path d="${shape}" fill="none" stroke="${keyart.mix(th.lineHi, c, 0.6)}" stroke-width="1.6"/>
      ${keyart.icon(icon(folder.icon), th, 50, 50, 56, c)}
      ${text(th, 96, 58, title.text, { size: title.size, fill: th.text })}
      ${keyart.icon(icon("back"), th, W - 150, 50, 30, th.accent)}
      ${text(th, W - 126, 56, hint, { size: 14, fill: th.dim, font: th.font.body, weight: 700 })}`);
  }
  // The dial's picture in Stream Deck's editor (its circle), on transparent.
  const dialIcon = (th, d) => svg(144, 144, keyart.icon(icon(d.icon), th, 72, 72, 112, colorOf(th, d.color)));

  // ---------- Stream Deck's action list (white on transparent) ----------

  const listIcon = (name, size) => svg(size, size, `<g transform="scale(${size / 48})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${icon(name).replace(/currentColor/g, "#fff")}</g>`);
  // SpoolUp's own mark (public/icon.svg, without its backdrop) for the category.
  const tabletMark = (size) => svg(size, size, `<g transform="scale(${size / 48})" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="11" width="38" height="27" rx="4"/><rect x="10" y="16" width="11" height="7" rx="1.5"/><rect x="10" y="27" width="11" height="7" rx="1.5" fill="#fff" fill-opacity=".4"/>
    <circle cx="32" cy="24.5" r="6"/><circle cx="32" cy="24.5" r="1.8" fill="#fff" stroke="none"/></g>`);

  return { theme, icon, colorOf, actionKey, sceneKey, folderKey, navKey, themeKey, blankKey, dialPanel, strip, titleSize, folderStrip, dialIcon, listIcon, tabletMark };
}

module.exports = { createArt, TEXT };
