// The pictures: keys (144x144 SVG, which Stream Deck scales to each model's keys) drawn
// with streamdeck/keyart.js in the global theme, and the touch-strip segments of the dial
// layout (layouts/dial.json, 200x100 each). Live keys use Windows' fonts (font: "live").
//
// Touch strips: Stream Deck + and + XL split their strip into one 200x100 canvas per dial,
// and a plugin can't draw across them. Each segment knows its place (dial column and the
// model's dial count), so the strip still reads as one HUD panel: rules run edge to edge,
// thin dividers with ticks sit between dials, and the corner brackets close it only at its
// two ends: four segments on Stream Deck +, six on + XL.
"use strict";
const { THEMES, emblem } = require("./emblems");

const W = 200, H = 100;

function createDraw(data) {
  const { keyart, icons, t } = data;
  const themes = new Map();
  const iconOf = (name) => icons[name] || icons.default || "";

  function theme(id) {
    if (!keyart) return null;
    const key = data.themeTokens[id] ? id : data.themeTokens.rsi ? "rsi" : Object.keys(data.themeTokens)[0];
    if (!key) return null;
    if (!themes.has(key)) themes.set(key, keyart.theme(data.themeTokens[key], key));
    return themes.get(key);
  }

  // keyart draws the status line at 11 px; long words (German, mostly) get a smaller size so
  // they stay on the key.
  function fitStatus(svg, status) {
    const n = String(status || "").length;
    if (n <= 14) return svg;
    const size = Math.max(7.5, 11 * 14 / n).toFixed(1);
    return svg.replace('font-size="11" font-weight="700" letter-spacing="1.6"', `font-size="${size}" font-weight="700" letter-spacing="${n > 18 ? 0.6 : 1}"`);
  }

  function key(opts) {
    if (!opts.theme) return null;
    const status = opts.status ? t(opts.status) : "";
    return fitStatus(keyart.key({ ...opts, status, label: opts.label, font: "live" }), status);
  }

  // A Tablet Deck button. look: { lit, pressed, blocked, offline, anim, status }
  function deck(th, def, look) {
    return key({ theme: th, icon: iconOf(def.icon), label: t(def.label), color: def.color || "", ...look });
  }

  // A key whose action hasn't been picked yet.
  function unset(th, text) {
    return key({ theme: th, icon: iconOf("default"), label: t(text), color: "", offline: false, status: "" });
  }

  function scene(th, sc, look) {
    return key({ theme: th, icon: iconOf(sc.icon), label: t(sc.short || sc.name), color: sc.color || "", ...look });
  }

  // A theme key shows its own theme: its face, emblem and name, lit while it's the one in use.
  function themeKey(id, active) {
    const th = theme(id);
    const info = THEMES.find((x) => x.id === id);
    if (!th || !info) return null;
    const art = emblem(id, { cx: 72, cy: active ? 54 : 58, size: active ? 56 : 62, accent: th.accent, text: th.text, tiny: keyart.arcsToCubics || ((d) => d) });
    // A blank face from keyart (no icon), then the emblem on top of the icon's place.
    const svg = key({ theme: th, icon: "", label: info.name, color: "", lit: active, status: active ? "ACTIVE" : "" });
    return svg.replace("</svg>", `${art}</svg>`);
  }

  // The touch-strip segment behind a dial's text. place: { column, count }; flash 0..1
  // fades out after a turn; blocked rings it red; offline adds the offline mark.
  function strip(th, { color = "", place = {}, flash = 0, blocked = false, offline = false } = {}) {
    const c = blocked ? th.colors.red : th.colors[color] || th.accent;
    const count = place.count || 1;
    const col = Math.max(0, Math.min(count - 1, place.column || 0));
    const first = col === 0, last = col === count - 1;
    const id = `s${th.id}${col}`;
    const top = th.light ? th.panel : keyart.mix(th.panelHi, th.bg, 0.55);
    const p = [];
    p.push(`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${th.bg}"/></linearGradient></defs>`);
    p.push(`<rect width="${W}" height="${H}" fill="url(#${id})"/>`);
    if (th.stripes) for (let y = 6; y < H; y += 5) p.push(`<rect x="0" y="${y}" width="${W}" height="1.2" fill="#fff" opacity=".025"/>`);
    if (th.grid) for (let x = 22; x < W; x += 22) p.push(`<rect x="${x}" y="0" width="1" height="${H}" fill="#fff" opacity=".03"/>`);
    // Rules along the top and bottom, unbroken from segment to segment.
    const x0 = first ? 6 : 0, x1 = last ? W - 6 : W;
    p.push(`<rect x="${x0}" y="4" width="${x1 - x0}" height="1" fill="${th.lineHi}" opacity=".7"/><rect x="${x0}" y="95" width="${x1 - x0}" height="1" fill="${th.lineHi}" opacity=".7"/>`);
    // The dial's colour over its icon, like a key's top strip.
    p.push(`<rect x="14" y="3" width="48" height="3" fill="${c}"/>`);
    // Between dials: a thin divider with ticks.
    if (!first) p.push(`<rect x="0" y="16" width="1" height="68" fill="${th.line}"/><rect x="0" y="4" width="5" height="1" fill="${th.lineHi}"/><rect x="0" y="95" width="5" height="1" fill="${th.lineHi}"/>`);
    // Corner brackets at the strip's two ends only.
    const br = (d) => `<path d="${d}" fill="none" stroke="${th.accent}" stroke-width="2" stroke-linecap="square" opacity=".75"/>`;
    if (first) p.push(br("M3 18V3H18"), br("M3 82V97H18"));
    if (last) p.push(br("M197 18V3H182"), br("M197 82V97H182"));
    if (flash > 0) p.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${c}" opacity="${(0.28 * flash).toFixed(2)}"/>`);
    if (blocked) p.push(`<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="${th.colors.red}" stroke-width="3"/>`);
    if (offline) p.push(`<path d="M178 14l10 10m0-10-10 10" stroke="${th.colors.red}" stroke-width="2.4" stroke-linecap="round"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join("")}</svg>`;
  }

  // A dial's icon for the strip (48x48 slot, drawn at 96 for sharpness).
  function stripIcon(th, name, color, { offline = false, strength = 1 } = {}) {
    const c = offline ? th.dim : th.colors[color] || th.accent;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${keyart.icon(iconOf(name), th, 48, 48, 84, c, { strength })}</svg>`;
  }

  return { theme, deck, unset, scene, themeKey, strip, stripIcon };
}

const svgUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
// Layout pixmaps take a base64 data URL with its MIME type (layouts reference).
const svgBase64 = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

module.exports = { createDraw, svgUrl, svgBase64 };
