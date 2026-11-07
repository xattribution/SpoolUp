// PNG in and out with zlib only: decodes the browser's screenshots, cuts them into key
// images and writes each one as an 8-bit RGBA PNG (what Stream Deck's own exports hold).
"use strict";
const zlib = require("zlib");
const { crc32 } = require("./zip");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

// An 8-bit RGB, RGBA or palette PNG (non-interlaced: what Chromium and encode() write) ->
// { width, height, rgba }.
function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, channels = 0, plte = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 3, 6].includes(data[9]) || data[12] !== 0) throw new Error("unexpected PNG format");
      channels = { 2: 3, 3: 1, 6: 4 }[data[9]];
    } else if (type === "PLTE") plte = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels, rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1), filter = raw[base];
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = raw[base + 1 + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[i] = v & 255;
    }
    const row = y * width * 4;
    if (channels === 4) cur.copy(rgba, row);
    else if (channels === 1) for (let x = 0; x < width; x++) { plte.copy(rgba, row + x * 4, cur[x] * 3, cur[x] * 3 + 3); rgba[row + x * 4 + 3] = 255; }
    else for (let x = 0; x < width; x++) { rgba[row + x * 4] = cur[x * 3]; rgba[row + x * 4 + 1] = cur[x * 3 + 1]; rgba[row + x * 4 + 2] = cur[x * 3 + 2]; rgba[row + x * 4 + 3] = 255; }
    [prev, cur] = [cur, prev];
  }
  return { width, height, rgba };
}

// The w x h area at (x0, y0) of an RGBA image `W` pixels wide.
function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.rgba.copy(out, y * w * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4);
  return { width: w, height: h, rgba: out };
}

// RGBA pixels -> PNG. Each row takes whichever filter leaves the smallest residue, the usual
// heuristic, which keeps key images small without a palette (gradients and glows stay smooth).
function encode({ width, height, rgba }) {
  const stride = width * 4, rows = Buffer.alloc((stride + 1) * height);
  const line = Buffer.alloc(stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const cur = rgba.subarray(y * stride, (y + 1) * stride);
    let bestF = 0, bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      let score = 0;
      for (let i = 0; i < stride && score < bestScore; i++) {
        const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (cur[i] - p) & 255;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; bestF = f; }
    }
    const base = y * (stride + 1);
    rows[base] = bestF;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      const p = bestF === 0 ? 0 : bestF === 1 ? a : bestF === 2 ? b : bestF === 3 ? (a + b) >> 1 : paeth(a, b, c);
      line[i] = (cur[i] - p) & 255;
    }
    line.copy(rows, base + 1);
    prev = cur;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows, { level: 6, memLevel: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// Chromium dithers gradients, so a key's dark backdrop comes out as fine noise that PNG
// can't squeeze (15-20 KB a key), and a profile repeats its keys on every page. So an opaque
// image first has that noise smoothed away where the picture is flat (never across an edge),
// then is stored with a palette of at most 256 colors (median cut, no dithering): keys
// shrink about 2.5x and look the same. Images with transparency (list icons) stay RGBA.
function smoothFlat({ width: w, height: h, rgba }, threshold = 3) {
  const out = Buffer.from(rgba);
  const near = [-4, 4, -w * 4, w * 4, -w * 4 - 4, -w * 4 + 4, w * 4 - 4, w * 4 + 4];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    let flat = true;
    for (let n = 0; n < 8 && flat; n++) for (let c = 0; c < 3; c++) if (Math.abs(rgba[i + c] - rgba[i + near[n] + c]) > threshold) { flat = false; break; }
    if (!flat) continue;
    for (let c = 0; c < 3; c++) {
      let sum = rgba[i + c];
      for (let n = 0; n < 8; n++) sum += rgba[i + near[n] + c];
      out[i + c] = Math.round(sum / 9);
    }
  }
  return { width: w, height: h, rgba: out };
}

function quantize(rgba, max = 256) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const colors = [...counts].map(([k, n]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255, n]);
  let palette;
  if (colors.length <= max) palette = colors.map((c) => c.slice(0, 3));
  else {
    const stats = (items) => {
      let n = 0;
      const lo = [255, 255, 255], hi = [0, 0, 0];
      for (const c of items) { n += c[3]; for (let j = 0; j < 3; j++) { if (c[j] < lo[j]) lo[j] = c[j]; if (c[j] > hi[j]) hi[j] = c[j]; } }
      const range = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      const axis = range.indexOf(Math.max(...range));
      return { items, n, axis, score: items.length > 1 ? range[axis] * Math.sqrt(n) : -1 };
    };
    const boxes = [stats(colors)];
    while (boxes.length < max) {
      let best = 0;
      for (let b = 1; b < boxes.length; b++) if (boxes[b].score > boxes[best].score) best = b;
      const box = boxes[best];
      if (box.score <= 0) break;
      const ax = box.axis;
      box.items.sort((p, q) => p[ax] - q[ax]);
      // Split where half the box's pixels fall on each side.
      let acc = 0, cut = 1;
      for (; cut < box.items.length - 1; cut++) { acc += box.items[cut - 1][3]; if (acc >= box.n / 2) break; }
      boxes.splice(best, 1, stats(box.items.slice(0, cut)), stats(box.items.slice(cut)));
    }
    palette = boxes.map(({ items, n }) => [0, 1, 2].map((j) => Math.round(items.reduce((s, c) => s + c[j] * c[3], 0) / n)));
  }
  const index = new Map();
  for (const [k] of counts) {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    let best = 0, bestD = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    index.set(k, best);
  }
  return { palette, index };
}

function encodeIndexed({ width, height, rgba }) {
  const { palette, index } = quantize(rgba);
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rows[y * (width + 1) + 1 + x] = index.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 3; // 8-bit palette
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// Opaque images get a palette (see smoothFlat), others stay full RGBA.
function encodeBest(img) {
  for (let i = 3; i < img.rgba.length; i += 4) if (img.rgba[i] !== 255) return encode(img);
  return encodeIndexed(smoothFlat(img));
}

// Width and height from a PNG's header, without decoding it.
function size(buf) {
  if (!buf || buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

module.exports = { decode, encode, encodeIndexed, encodeBest, crop, size };
