// The 12 manufacturer themes, in the order of THEMES in public/app.js, with their short
// names and emblems. The emblems are copied from public/app.js (keep them in step): the
// tablet doesn't export them and the plugin can't load the deck's scripts. They're original
// badge designs on a 64x64 grid, not the manufacturers' logos.
//
// There, `F` is a solid accent fill and T(...) a group in the theme's text colour through
// CSS; Stream Deck's SVG renderer has no CSS variables, so here both get real colours.
"use strict";

const THEMES = [
  { id: "rsi", name: "RSI", emblem: (F, T) => `<circle cx="32" cy="32" r="27"/><circle cx="32" cy="32" r="20" opacity=".3"/>
    <path d="M32 8 40 34 32 28 24 34Z" ${F}/>
    <path d="M5 41c12-9 36-17 54-15" stroke-width="3.5"/>
    ${T(`<path d="M21 47h22"/><path d="M25 53h14" opacity=".6"/>`)}` },
  { id: "drake", name: "Drake", emblem: (F) => `<path d="M32 4 56 18v28L32 60 8 46V18Z" stroke-width="3.5"/>
    <path d="M32 12 49 22v20L32 52 15 42V22Z" opacity=".3"/>
    <path d="M19 15c9 8 12 18 10 33l-5-3c1-11-1-20-5-30Z" ${F}/>
    <path d="M29 13c9 9 12 19 10 35l-5-3c1-12-1-22-5-32Z" ${F}/>
    <path d="M40 17c6 7 9 16 7 27l-4-3c0-9-1-16-3-24Z" ${F} opacity=".75"/>` },
  { id: "aegis", name: "Aegis", emblem: (F, T) => `<path d="M27 24 4 40h23Z" ${F} opacity=".55"/><path d="M37 24l23 16H37Z" ${F} opacity=".55"/>
    <path d="M27 31 12 44h15M37 31l15 13H37"/>
    <path d="M32 3 38 30 32 54 26 30Z" ${F}/>
    ${T(`<path d="M21 50h22M27 59h10"/>`)}` },
  { id: "anvil", name: "Anvil", emblem: (F, T) => `<path d="M32 4 56 12v18c0 14-10 24-24 30C18 54 8 44 8 30V12Z" stroke-width="3.5"/>
    <path d="M32 10 50 16v14c0 11-8 19-18 24-10-5-18-13-18-24V16Z" opacity=".3"/>
    <path d="M15 17h34v6H15Z" ${F}/>
    ${T(`<path d="M20 30l12 8 12-8M20 40l12 8 12-8" stroke-width="3.5"/>`)}` },
  { id: "origin", name: "Origin", emblem: (F, T) => `<circle cx="32" cy="32" r="26" stroke-width="1.6"/>
    <path d="M40 10a22 22 0 1 0 0 44a30 30 0 0 1 0-44Z" ${F}/>
    <circle cx="45" cy="21" r="2.2" ${F}/>
    ${T(`<path d="M32 1v9M32 54v9" stroke-width="1.6"/>`)}` },
  { id: "misc", name: "MISC", emblem: (F, T) => `<path d="M18 8h28l14 24-14 24H18L4 32Z" stroke-width="3"/>
    <rect x="19" y="19" width="26" height="6" rx="1" ${F}/>
    <rect x="14" y="29" width="36" height="6" rx="1" ${F}/>
    <rect x="19" y="39" width="26" height="6" rx="1" ${F} opacity=".6"/>
    ${T(`<path d="M8 32h3M53 32h3"/>`)}` },
  { id: "crusader", name: "Crusader", emblem: (F, T) => `<circle cx="32" cy="32" r="27"/>
    <path d="M19 46C23 28 35 16 51 12c-6 10-9 22-9 34Z" ${F}/>
    <path d="M13 46c3-10 8-17 15-22-2 7-3 14-3 22Z" ${F} opacity=".45"/>
    ${T(`<path d="M8 46h48"/><path d="M15 52h34" opacity=".4"/>`)}` },
  { id: "banu", name: "Banu", emblem: (F, T) => `<circle cx="32" cy="32" r="28" stroke-dasharray="1 5"/>
    ${[0, 90, 180, 270].map((r) => `<path d="M32 5c7 8 7 15 0 21-7-6-7-13 0-21Z" ${F} transform="rotate(${r} 32 32)"/>`).join("")}
    ${[45, 135, 225, 315].map((r) => `<path d="M32 12c4 5 4 9 0 13-4-4-4-8 0-13Z" ${F} opacity=".5" transform="rotate(${r} 32 32)"/>`).join("")}
    ${T(`<circle cx="32" cy="32" r="4.5"/>`)}` },
  { id: "aopoa", name: "Aopoa", emblem: (F, T) => `<path d="M12 52C9 31 22 13 45 8 32 18 27 31 29 52Z" ${F}/>
    <path d="M52 12c3 21-10 38-33 44 13-10 18-24 16-44Z" ${F} opacity=".5"/>
    ${T(`<circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none"/>`)}` },
  { id: "argo", name: "Argo", emblem: (F, T) => `<path d="M32 5 59 55H5Z" stroke-width="3.5"/><path d="M32 19 47 47H17Z" opacity=".3"/>
    <circle cx="14" cy="50" r="2.4" ${F}/><circle cx="50" cy="50" r="2.4" ${F}/>
    ${T(`<path d="M32 15v15a5 5 0 1 1-5 5" stroke-width="3.5"/>`)}` },
  { id: "cnou", name: "CO", emblem: (F, T) => `<path d="M48 14a24 24 0 1 0 0 36" stroke-width="6"/>
    <path d="M33 41a9 9 0 0 1 18 0Z" ${F}/>
    ${T(`<path d="M29 41h30"/><path d="M42 26v-4M32 30l-3-3M52 30l3-3" opacity=".7"/>`)}` },
  { id: "esperia", name: "Esperia", emblem: (F, T) => `<path d="M8 32A24 24 0 0 1 32 8" opacity=".4"/>
    <path d="M10 52C14 27 30 10 55 8 39 16 29 30 27 54Z" ${F}/>
    ${T(`<path d="M45 30l2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5Z" fill="currentColor" stroke="none"/>`)}` },
];
const byId = new Map(THEMES.map((t) => [t.id, t]));

// A theme's emblem as SVG, `size` px wide and centred on (cx, cy), drawn in `accent` with
// the T parts in `text`. `tiny` turns arcs into curves for Stream Deck's renderer.
function emblem(id, { cx, cy, size, accent, text, tiny = (d) => d }) {
  const t = byId.get(id);
  if (!t) return "";
  const F = `fill="${accent}" stroke="none"`;
  const T = (body) => `<g stroke="${text}">${body.replace(/currentColor/g, text)}</g>`;
  const body = t.emblem(F, T).replace(/\sd="([^"]*)"/g, (m, d) => ` d="${tiny(d)}"`);
  const s = size / 64;
  return `<g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2).toFixed(2)}) scale(${s.toFixed(4)})" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

module.exports = { THEMES, emblem };
