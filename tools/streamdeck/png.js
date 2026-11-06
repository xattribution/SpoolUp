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

// An 8-bit RGB or RGBA PNG (non-interlaced, what Chromium writes) -> { width, height, rgba }.
function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6) || data[12] !== 0) throw new Error("unexpected PNG format");
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
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

// Width and height from a PNG's header, without decoding it.
function size(buf) {
  if (!buf || buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

module.exports = { decode, encode, crop, size };
