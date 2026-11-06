// A small ZIP writer and reader on Node's zlib, for the Stream Deck pack: profiles, icon packs
// and the plugin are all plain ZIP files. Every entry gets the same fixed date, so building
// twice gives byte-identical files.
"use strict";
const zlib = require("zlib");

// zlib.crc32 only exists from Node 20.15 / 22.2; the table works everywhere.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 1980-01-01 00:00, the earliest date a ZIP can hold.
const DOS_TIME = 0, DOS_DATE = 0x0021;
const UTF8 = 0x0800;

// entries: [{ name, data? (Buffer|string), dir? }] in the order they should appear.
// Directory names end in "/". Files are deflated (Stream Deck's own exports and Elgato's CLI
// both deflate); zlib falls back to stored blocks for data that doesn't shrink, like PNGs and
// the profiles and icon packs inside a release zip, which get the quick level.
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.dir && !e.name.endsWith("/") ? `${e.name}/` : e.name, "utf8");
    const data = e.dir ? Buffer.alloc(0) : Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), "utf8");
    const packed = e.dir ? data : zlib.deflateRawSync(data, { level: /\.(png|gif|jpe?g|webp|zip|streamDeck\w+)$/i.test(e.name) ? 1 : 9 });
    const method = e.dir ? 0 : 8;
    const crc = e.dir ? 0 : crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);          // made by: MS-DOS, spec 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(e.dir ? 0x10 : 0x20, 38); // DOS attributes: directory / archive
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  if (entries.length > 0xffff || offset > 0xffffffff) throw new Error("ZIP too large (ZIP64 isn't written)");
  return Buffer.concat([...locals, dir, end]);
}

// Reads a ZIP into [{ name, dir, data }] (for --check and tests). Supports stored and
// deflated entries, which is all this writer and Stream Deck's exports use.
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a ZIP file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lName = buf.readUInt16LE(local + 26), lExtra = buf.readUInt16LE(local + 28);
    const raw = buf.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error(`${name}: compression method ${method} isn't supported`);
    if (!name.endsWith("/") && crc32(data) !== crc) throw new Error(`${name}: CRC mismatch`);
    out.push({ name, dir: name.endsWith("/"), data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

module.exports = { zip, unzip, crc32 };
