// Animated keys for the icon packs: how each press effect plays as a looping GIF, the SVG of
// every frame (drawn by streamdeck/keyart.js, like every other key), and the GIF made from
// those frames once they're PNGs. Elgato's rules for animated icon-pack icons: a GIF with a
// PNG of the same name next to it, 144 x 144, 10-20 fps, at most 5 s and 1 MB
// (streamdeck/research/iconpacks.verified.md 6 and 13).
//
//   const animate = require("./streamdeck/animate");
//   animate.kindOf(action)                -> the catalog action's effect if it gets a GIF, or null
//   animate.framesFor({ keyart, theme, icon, label, color, anim }) -> [{ svg, delay }] (delay in cs)
//   animate.gifFromPngs(pngs, delays)     -> the GIF (Buffer); options { maxBytes, colors, fuzz }
//   animate.gifProblems(buffer)           -> how a GIF breaks Elgato's limits ([] if it doesn't)
//
// Wiring it into tools/make-streamdeck.js:
// - planIconPack: for each catalog action with kindOf(a), push an item named
//   `${nameOf(a)} (animated)`, file `${slug(`${a.id}-animated`)}.gif`, the action's tags plus
//   "animated", and frames = framesFor({ keyart, theme: th, icon: art.icon(a.icon), label:
//   a.label, color: a.color, anim }).map((f) => ({ img: store.add(f.svg), delay: f.delay })),
//   with img = frames[0].img. Frames are just more SVGs for the one ImageStore/Renderer batch;
//   the first is the idle key, the same SVG as the static icon, so it's drawn once.
// - After env.store.render: it.gif = gifFromPngs(it.frames.map((f) => store.get(f.img)),
//   it.frames.map((f) => f.delay)).
// - writeIconPack: write icons/<slug>.gif (it.gif) and icons/<slug>.png (store.get(it.img), the
//   first frame). icons.json lists the .gif and not the .png: Elgato's DistributionTool lets an
//   unlisted x.png through only when x.gif is next to it. packPreviewHtml skips these items
//   (their picture is the static key's), and the manifest's Description mentions the GIFs.
// - checkBuilt: a listed .gif gets gifProblems() instead of the PNG size check and must have its
//   .png; that .png is exempt from "has no icons.json entry".
"use strict";
const crypto = require("crypto");
const gif = require("./gif");
const png = require("./png");

// Elgato's limits for an animated icon-pack icon. 10-20 fps is 5-10 cs a frame.
const LIMITS = { size: 144, fps: [10, 20], seconds: 5, bytes: 1024 * 1024 };

// What each effect (keyart's anim kinds) plays. Frames show for `cs` centiseconds (7 is 14
// fps). The idle key comes first for `rest` frames: the beat between presses that makes the
// loop read, and the picture the PNG companion shows. Then the effect, as runs of its t:
// [from, to, frames] with both ends drawn, "lit" where the deck lights the key once it's
// done (gear down, Quantum engaged, armed, locked, lights on). Effects last 0.35-1 s, close
// to the plugin's live keys (bin/actions.js ANIM_MS, 0.4-0.9 s for taps); charge and arming
// are shorter than there (1.2 s and 2 s) so that no loop runs past 2 s. Keys are never drawn
// pressed: a GIF loops for ever, and a key that looked pressed every second or two would
// look as if it pressed itself.
const MOTION = {
  //        cs   rest  runs of t
  charge: { cs: 7, rest: 8, runs: [[1 / 14, 1, 14], [1, 1, 6, "lit"]] }, // the ring fills; engaged
  hazard: { cs: 8, rest: 8, runs: [[0.1, 1, 10], [1, 1, 6, "lit"]] }, // a stripe a frame; armed
  timed: { cs: 7, rest: 10, runs: [[1 / 9, 1, 9]] }, // the bar under the label fills
  ripple: { cs: 7, rest: 11, runs: [[0.1, 0.9, 9]] }, // two rings (there are none at 0 and 1)
  gear: { cs: 7, rest: 8, runs: [[1 / 9, 1, 9], [1, 1, 6, "lit"], [0.8, 0.2, 4]] }, // down, deployed, back up
  doors: { cs: 7, rest: 8, runs: [[0.8, 0, 5], [0, 0, 3], [1 / 9, 1, 9]] }, // slide shut, then open
  lock: { cs: 7, rest: 8, runs: [[1 / 9, 1, 9], [1, 1, 6, "lit"]] }, // brackets close in; locked
  burst: { cs: 7, rest: 9, runs: [[0, 10 / 11, 11]] }, // sparks fly out and fade
  recoil: { cs: 7, rest: 13, runs: [[0, 0.4, 5]] }, // the flash under the icon (gone by t 0.5)
  streak: { cs: 7, rest: 9, runs: [[0, 1, 9]] }, // lines rush past
  glow: { cs: 7, rest: 8, runs: [[0.05, 0.25, 5], [1, 1, 8, "lit"]] }, // flickers on, off, on...; lights on
  flash: { cs: 7, rest: 12, runs: [[0, 5 / 6, 6]] }, // a circle grows and fades
};

// A catalog action gets a GIF when it names an effect (its anim field, from layouts/hud.json).
const kindOf = (a) => (a && a.kind === "deck" && MOTION[a.anim] ? a.anim : null);

// The frames of one key: [{ svg, delay }], idle first. Repeated frames repeat the same SVG, so
// an ImageStore draws each picture once.
function framesFor({ keyart = require("../../streamdeck/keyart"), theme, icon, label, color, anim }) {
  const m = MOTION[anim];
  if (!m) throw new Error(`No GIF for the "${anim}" effect (there are: ${Object.keys(MOTION).join(", ")})`);
  const draw = (look) => keyart.key({ theme, icon, label, color, ...look });
  const idle = draw({});
  const out = Array.from({ length: m.rest }, () => ({ svg: idle, delay: m.cs }));
  for (const [from, to, frames, look] of m.runs) {
    for (let k = 0; k < frames; k++) {
      const t = frames > 1 ? from + ((to - from) * k) / (frames - 1) : from;
      out.push({ svg: draw({ lit: look === "lit", anim: { kind: anim, t } }), delay: m.cs });
    }
  }
  return out;
}

// ---------- GIF from PNG frames ----------

// How far (per channel, 0-255) a pixel may drift between frames and still count as unchanged.
// Chromium dithers gradients by screen position, so a frame drawn at another spot on the
// sheet has slightly different noise in its backdrop, and each PNG has its own palette;
// without some give, every pixel would change every frame (shimmer, and no saving from
// drawing only what changed). Anything under it is invisible on a key.
const FUZZ = 3;

// What gives way when a GIF is over the size limit: colors first, then frames (each kept
// frame shows as long as the ones it stands for, so the timing holds even though the frame
// rate drops). Keys at 144 px come nowhere near 1 MB; a long, busy animation might.
const SQUEEZE = [[1, 1], [2, 1], [2, 2], [4, 2], [4, 3], [8, 4]]; // [colors divided by, keep every nth frame]

// Distance between colors as png.js weighs it for the static keys: green counts most.
const dist = (p, r, g, b) => { const dr = r - p[0], dg = g - p[1], db = b - p[2]; return 2 * dr * dr + 4 * dg * dg + 3 * db * db; };
function nearest(pal, r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) { const d = dist(pal[i], r, g, b); if (d < bestD) { bestD = d; best = i; } }
  return best;
}

// Every color in the frames as [r, g, b, weight], a pixel weighing as long as its frame shows.
function histogram(images, shown) {
  const w = new Map();
  images.forEach((img, n) => {
    const px = img.rgba;
    for (let i = 0; i < px.length; i += 4) {
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      w.set(k, (w.get(k) || 0) + shown[n]);
    }
  });
  return [...w].map(([k, n]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255, n]);
}

// One palette for all frames, which GIF needs (the static keys get one per image). Median cut
// as in png.js, weighted by time on screen, then a few rounds of k-means: median cut alone
// leaves too few steps in the smooth backdrop gradients when an effect's bright colors take
// boxes of their own, and the rounds move colors back to where most pixels are. No
// dithering, as on the static keys: it would crawl from frame to frame.
function palette(colors, max) {
  if (colors.length <= max) return colors.map((c) => [c[0], c[1], c[2]]);
  const stats = (items) => {
    let n = 0;
    const lo = [255, 255, 255], hi = [0, 0, 0];
    for (const c of items) { n += c[3]; for (let j = 0; j < 3; j++) { if (c[j] < lo[j]) lo[j] = c[j]; if (c[j] > hi[j]) hi[j] = c[j]; } }
    const range = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const axis = range.indexOf(Math.max(...range));
    return { items, n, axis, score: items.length > 1 ? range[axis] * Math.sqrt(n) : -1 };
  };
  const boxes = [stats(colors.slice())];
  while (boxes.length < max) {
    let best = 0;
    for (let b = 1; b < boxes.length; b++) if (boxes[b].score > boxes[best].score) best = b;
    const box = boxes[best];
    if (box.score <= 0) break;
    const ax = box.axis;
    box.items.sort((p, q) => p[ax] - q[ax]);
    // Split where half the box's weight falls on each side.
    let acc = 0, cut = 1;
    for (; cut < box.items.length - 1; cut++) { acc += box.items[cut - 1][3]; if (acc >= box.n / 2) break; }
    boxes.splice(best, 1, stats(box.items.slice(0, cut)), stats(box.items.slice(cut)));
  }
  let pal = boxes.map(({ items, n }) => [0, 1, 2].map((j) => items.reduce((s, c) => s + c[j] * c[3], 0) / n));
  // Weights are whole numbers, so these sums are exact and every machine gets the same palette.
  for (let round = 0; round < 4; round++) {
    const sum = pal.map(() => [0, 0, 0, 0]);
    for (const c of colors) {
      const s = sum[nearest(pal, c[0], c[1], c[2])];
      s[0] += c[0] * c[3]; s[1] += c[1] * c[3]; s[2] += c[2] * c[3]; s[3] += c[3];
    }
    pal = pal.map((p, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : p));
  }
  return pal.map((p) => p.map(Math.round));
}

// Keys are opaque; anything that isn't is laid on black (GIF has no partial transparency).
function opaque(img) {
  const px = img.rgba;
  let solid = true;
  for (let i = 3; i < px.length && solid; i += 4) solid = px[i] === 255;
  if (solid) return img;
  const out = Buffer.from(px);
  for (let i = 0; i < out.length; i += 4) { const a = out[i + 3]; for (let j = 0; j < 3; j++) out[i + j] = Math.round((out[i + j] * a) / 255); out[i + 3] = 255; }
  return { width: img.width, height: img.height, rgba: out };
}

// Frames as { image, delay }, keeping every nth (each kept one shows for those it replaces).
function thin(of, delays, every) {
  const out = [];
  of.forEach((image, i) => { if (i % every === 0) out.push({ image, delay: delays[i] }); else out[out.length - 1].delay += delays[i]; });
  return out;
}

// The GIF at one palette size: the first frame whole, then each frame only the box of pixels
// that changed by more than `fuzz` from what's showing, the rest of the box transparent.
function build(images, frames, colors, max, fuzz) {
  const { width: W, height: H } = images[0];
  const moving = frames.some((f) => f.image !== frames[0].image);
  const pal = palette(colors, moving ? max - 1 : max);
  const T = pal.length; // the transparent index, just after the colors
  const cache = new Map();
  const indexed = images.map((img) => {
    const px = img.rgba, out = new Uint8Array(W * H);
    for (let i = 0; i < out.length; i++) {
      const k = (px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2];
      let v = cache.get(k);
      if (v === undefined) { v = nearest(pal, px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); cache.set(k, v); }
      out[i] = v;
    }
    return out;
  });
  const close = new Uint8Array(pal.length * pal.length);
  for (let a = 0; a < pal.length; a++) for (let b = 0; b < pal.length; b++) {
    const p = pal[a], q = pal[b];
    close[a * pal.length + b] = Math.abs(p[0] - q[0]) <= fuzz && Math.abs(p[1] - q[1]) <= fuzz && Math.abs(p[2] - q[2]) <= fuzz ? 1 : 0;
  }
  const canvas = indexed[frames[0].image].slice();
  const out = [{ pixels: canvas.slice(), delay: frames[0].delay }];
  const changed = new Uint8Array(W * H);
  for (let n = 1; n < frames.length; n++) {
    const f = frames[n], want = indexed[f.image];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    changed.fill(0);
    // The same picture again changes nothing: every pixel already shows it, or close to it.
    if (f.image !== frames[n - 1].image) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, a = want[i], b = canvas[i];
        if (a === b || close[a * pal.length + b]) continue;
        changed[i] = 1;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
    // Nothing changed: one pixel redrawn as it is, so the frame keeps its place and delay.
    if (x1 < 0) { out.push({ pixels: [canvas[0]], width: 1, height: 1, delay: f.delay }); continue; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y0 + y) * W + x0 + x;
      if (changed[i]) { px[y * w + x] = want[i]; canvas[i] = want[i]; } else px[y * w + x] = T;
    }
    out.push({ pixels: px, x: x0, y: y0, width: w, height: h, transparent: T, delay: f.delay });
  }
  return gif.encode({ width: W, height: H, palette: moving ? [...pal, [0, 0, 0]] : pal, frames: out });
}

// PNG frames (from the renderer) and their delays in centiseconds -> a looping GIF that fits
// in maxBytes, with fewer colors, then fewer frames, if it has to.
function gifFromPngs(pngs, delays, { maxBytes = LIMITS.bytes, colors = 256, fuzz = FUZZ } = {}) {
  if (!Array.isArray(pngs) || !pngs.length || !Array.isArray(delays) || delays.length !== pngs.length) throw new Error("gifFromPngs needs PNG frames and one delay for each");
  if (!(Number.isInteger(colors) && colors >= 2 && colors <= 256)) throw new Error(`A GIF has 2 to 256 colors, not ${colors}`);
  // The idle key held for several frames is one picture: decoded, weighed and mapped once.
  const ids = new Map(), images = [], of = [];
  for (const buf of pngs) {
    const id = crypto.createHash("sha1").update(buf).digest("hex");
    if (!ids.has(id)) { ids.set(id, images.length); images.push(opaque(png.decode(buf))); }
    of.push(ids.get(id));
  }
  const { width, height } = images[0];
  if (images.some((img) => img.width !== width || img.height !== height)) throw new Error("A GIF's frames must all be the same size");
  const shown = images.map(() => 0);
  of.forEach((n, i) => { shown[n] += Math.max(1, delays[i]); });
  const weighed = histogram(images, shown);
  let size = 0;
  for (const [less, every] of SQUEEZE) {
    const buf = build(images, thin(of, delays, every), weighed, Math.max(2, Math.floor(colors / less)), fuzz);
    if (buf.length <= maxBytes) return buf;
    size = buf.length;
  }
  throw new Error(`A ${width}x${height} GIF of ${pngs.length} frames is still ${size} bytes at its smallest (at most ${maxBytes})`);
}

// How a GIF breaks Elgato's limits for icon packs, or [] when it doesn't.
function gifProblems(buf) {
  let g;
  try { g = gif.info(buf); } catch (err) { return [`isn't a GIF (${err.message})`]; }
  const out = [];
  if (g.width !== LIMITS.size || g.height !== LIMITS.size) out.push(`is ${g.width}x${g.height}, not ${LIMITS.size}x${LIMITS.size}`);
  const off = g.delays.filter((d) => d < 100 / LIMITS.fps[1] || d > 100 / LIMITS.fps[0]);
  if (off.length) out.push(`has ${off.length} frame(s) outside ${LIMITS.fps.join("-")} fps (${[...new Set(off)].join(", ")} cs)`);
  if (g.duration > LIMITS.seconds * 100) out.push(`plays for ${(g.duration / 100).toFixed(2)} s, over ${LIMITS.seconds} s`);
  if (buf.length > LIMITS.bytes) out.push(`is ${(buf.length / 1048576).toFixed(2)} MB, over 1 MB`);
  if (g.loop !== 0) out.push(g.loop === null ? "doesn't loop" : `loops ${g.loop} times, not for ever`);
  if (g.frames < 2) out.push("has one frame");
  return out;
}

module.exports = { MOTION, LIMITS, kindOf, framesFor, gifFromPngs, gifProblems };
