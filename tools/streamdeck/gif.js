// A small GIF89a writer on plain Node, for the icon packs' animated keys: Elgato animates
// icon-pack icons from GIF only (streamdeck/research/iconpacks.verified.md 6.2). Every frame
// is palette indices into one global color table. A frame may cover only the box that
// changed, with a transparent index for the pixels in it that didn't, because each frame is
// left in place for the next to draw over (disposal "do not dispose"). The same input always
// gives the same bytes: nothing here reads the clock or depends on the platform.
//
//   const gif = require("./gif");
//   gif.encode({ width, height, palette: [[r, g, b], ...], frames, loop: 0 })   -> Buffer
//     palette: 1 to 256 colors; loop: how many times to play, 0 (the default) for ever
//     frames: [{ pixels, delay, x, y, width, height, transparent }]
//       pixels: palette indices, row by row (an array, Buffer or Uint8Array)
//       delay: how long the frame shows, in centiseconds
//       x, y, width, height: the box the frame covers (the whole picture by default)
//       transparent: an index that leaves the pixel below showing (none by default)
//   gif.info(buffer) -> { width, height, frames, delays, duration, loop }   (duration in cs;
//     loop is null without a NETSCAPE2.0 block; no pixels are decoded)
"use strict";

// Codes are at most 12 bits, so the string table holds 4096 entries. When it's full the
// encoder sends a clear code and starts a new table.
const MAX_CODES = 4096;

const u16 = (n) => [n & 255, (n >> 8) & 255];
const isU16 = (n) => Number.isInteger(n) && n >= 0 && n <= 65535;

// LZW as GIF uses it: codes packed least significant bit first, one bit wider than the
// minimum code size at the start, widening as the table passes each power of two.
function lzw(pixels, minSize) {
  const clear = 1 << minSize, end = clear + 1;
  const out = [];
  let acc = 0, bits = 0, size = minSize + 1, next = end + 1, table = new Map();
  const put = (code) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  };
  put(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const p = pixels[i], key = (prefix << 8) | p, code = table.get(key);
    if (code !== undefined) { prefix = code; continue; }
    put(prefix);
    // The decoder adds this string when it reads the next code, then widens once its table
    // reaches a power of two, so the next code is written as wide as it will be read.
    if (next === 1 << size && size < 12) size++;
    if (next < MAX_CODES) table.set(key, next++);
    else { put(clear); table = new Map(); size = minSize + 1; next = end + 1; }
    prefix = p;
  }
  put(prefix);
  if (next === 1 << size && size < 12) size++;
  put(end);
  if (bits) out.push(acc & 255);
  return Buffer.from(out);
}

// Image data travels in sub-blocks of at most 255 bytes, each after its length, then a 0.
function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) {
    const n = Math.min(255, data.length - i);
    parts.push(Buffer.from([n]), data.subarray(i, i + n));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function encode({ width, height, palette, frames, loop = 0 }) {
  if (!isU16(width) || !isU16(height) || !width || !height) throw new Error(`A GIF is 1 to 65535 pixels a side, not ${width}x${height}`);
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > 256) throw new Error(`A GIF palette holds 1 to 256 colors, not ${Array.isArray(palette) ? palette.length : palette}`);
  if (!Array.isArray(frames) || !frames.length) throw new Error("A GIF needs at least one frame");
  if (!isU16(loop)) throw new Error(`A GIF's loop count is 0 (for ever) to 65535, not ${loop}`);
  // The color table holds a power of two colors; the unused ones stay black.
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  const table = Buffer.alloc(3 << bits);
  palette.forEach((c, i) => {
    for (let j = 0; j < 3; j++) {
      if (!Number.isInteger(c[j]) || c[j] < 0 || c[j] > 255) throw new Error(`Palette color ${i} isn't [r, g, b] in 0-255: ${JSON.stringify(c)}`);
      table[i * 3 + j] = c[j];
    }
  });
  const minSize = Math.max(2, bits); // GIF's smallest LZW code size is 2, even for 2 colors
  const parts = [
    Buffer.from("GIF89a", "ascii"),
    // Logical screen: global color table, 8 bits a channel, background color 0, square pixels.
    Buffer.from([...u16(width), ...u16(height), 0x80 | 0x70 | (bits - 1), 0, 0]),
    table,
    // NETSCAPE2.0 application extension: the loop count.
    Buffer.from([0x21, 0xff, 11]), Buffer.from("NETSCAPE2.0", "ascii"), Buffer.from([3, 1, ...u16(loop), 0]),
  ];
  frames.forEach((f, n) => {
    const x = f.x || 0, y = f.y || 0, w = f.width ?? width - x, h = f.height ?? height - y;
    const at = `GIF frame ${n}`;
    if (!isU16(x) || !isU16(y) || !isU16(w) || !isU16(h) || !w || !h || x + w > width || y + h > height) throw new Error(`${at}: the box ${w}x${h} at ${x},${y} isn't inside ${width}x${height}`);
    if (!isU16(f.delay)) throw new Error(`${at}: delay ${f.delay} isn't a whole number of centiseconds (0-65535)`);
    const t = f.transparent;
    if (t !== undefined && !(Number.isInteger(t) && t >= 0 && t < palette.length)) throw new Error(`${at}: transparent index ${t} isn't in the palette`);
    const px = f.pixels;
    if (!px || px.length !== w * h) throw new Error(`${at}: ${px ? px.length : 0} pixels for a ${w}x${h} box`);
    for (let i = 0; i < px.length; i++) if (!(px[i] >= 0 && px[i] < palette.length && Number.isInteger(px[i]))) throw new Error(`${at}: pixel ${i} is ${px[i]}, not an index into ${palette.length} colors`);
    // Graphic control: disposal 1 ("do not dispose", so later frames draw over this one),
    // the delay and the transparent index if there is one.
    parts.push(Buffer.from([0x21, 0xf9, 4, (1 << 2) | (t === undefined ? 0 : 1), ...u16(f.delay), t === undefined ? 0 : t, 0]));
    parts.push(Buffer.from([0x2c, ...u16(x), ...u16(y), ...u16(w), ...u16(h), 0]));
    parts.push(Buffer.from([minSize]), subBlocks(lzw(px, minSize)));
  });
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

// Size, frame delays and loop count, read from the blocks without decoding any pixels: what a
// check needs to hold a GIF to Elgato's limits.
function info(buf) {
  const sig = buf.toString("ascii", 0, 6);
  if (sig !== "GIF89a" && sig !== "GIF87a") throw new Error("not a GIF");
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8), screen = buf[10];
  let pos = 13 + (screen & 0x80 ? 3 << ((screen & 7) + 1) : 0);
  // Past a run of sub-blocks and the 0 that ends it.
  const skip = () => { while (buf[pos]) pos += buf[pos] + 1; if (pos >= buf.length) throw new Error("the GIF is cut short"); pos++; };
  const delays = [];
  let delay = 0, loop = null;
  while (pos < buf.length) {
    const block = buf[pos++];
    if (block === 0x3b) return { width, height, frames: delays.length, delays, duration: delays.reduce((s, d) => s + d, 0), loop };
    if (block === 0x21) {
      const label = buf[pos++];
      if (label === 0xf9) delay = buf.readUInt16LE(pos + 2);
      else if (label === 0xff && buf.toString("ascii", pos + 1, pos + 12) === "NETSCAPE2.0" && buf[pos + 12] >= 3 && buf[pos + 13] === 1) loop = buf.readUInt16LE(pos + 14);
      skip();
    } else if (block === 0x2c) {
      const flags = buf[pos + 8];
      pos += 9 + (flags & 0x80 ? 3 << ((flags & 7) + 1) : 0) + 1; // descriptor, local colors, LZW code size
      skip();
      delays.push(delay);
      delay = 0;
    } else throw new Error(`unexpected byte 0x${block.toString(16)} at ${pos - 1}`);
  }
  throw new Error("the GIF has no trailer");
}

module.exports = { encode, info };
