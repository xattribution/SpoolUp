// Stream Deck profiles in the v2 format (research/profiles.md section 2.2): a ZIP holding
// <PROFILE-UUID>.sdProfile/manifest.json and one Profiles/<page id>/ folder per page,
// folder page and the empty Default page, each with its manifest and its own Images/.
// Stream Deck 6.x and 7.x both import it, and Elgato's current SDK sample bundles it.
"use strict";
const crypto = require("crypto");
const { zip } = require("./zip");

// Stable ids from a name, so rebuilding gives the same profile, page and action UUIDs, and
// keys in one theme's profile can name another theme's profile (Switch Profile).
function uuidFrom(name) {
  const h = crypto.createHash("sha1").update(`tabletdeck-streamdeck:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; // version 5 (name-based, SHA-1)
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// A v2 page folder is its page UUID in base32 (digits, then letters without U), plus "Z":
// the 128 bits shifted left by 2 make 26 five-bit digits. Checked against Elgato's samples.
const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTVW";
function pageDir(uuid) {
  let n = BigInt(`0x${uuid.replace(/-/g, "")}`) << 2n;
  let s = "";
  for (let i = 0; i < 26; i++) { s = ALPHA[Number(n & 31n)] + s; n >>= 5n; }
  return `${s}Z`;
}
// Image file names in the same style as the app's, from the image's content.
function imageName(buf) {
  const h = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 32);
  return `${pageDir(`${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`)}.png`;
}

// JSON as the app writes it: compact, object keys in alphabetical order.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

// The built-in "plugins" the app names in the Plugin block of each action (as 7.x writes it).
const BUILTIN = {
  "com.elgato.streamdeck.system.hotkey": { Name: "Activate a Key Command", UUID: "com.elgato.streamdeck.system.hotkey" },
  "com.elgato.streamdeck.system.hotkeyswitch": { Name: "Hotkey Switch", UUID: "com.elgato.streamdeck.system.hotkeyswitch" },
  "com.elgato.streamdeck.page.next": { Name: "Pages", UUID: "com.elgato.streamdeck.page" },
  "com.elgato.streamdeck.page.previous": { Name: "Pages", UUID: "com.elgato.streamdeck.page" },
  "com.elgato.streamdeck.page.goto": { Name: "Pages", UUID: "com.elgato.streamdeck.page" },
  "com.elgato.streamdeck.profile.openchild": { Name: "Create Folder", UUID: "com.elgato.streamdeck.profile.openchild" },
  "com.elgato.streamdeck.profile.backtoparent": { Name: "Open Parent Folder", UUID: "com.elgato.streamdeck.profile.backtoparent" },
  "com.elgato.streamdeck.profile.rotate": { Name: "Switch Profile", UUID: "com.elgato.streamdeck.profile.rotate" },
  "com.elgato.streamdeck.keys.adaptor": { Name: "Keys", UUID: "com.elgato.streamdeck.keys" },
  "com.elgato.streamdeck.system.multimedia": { Name: "Multimedia", UUID: "com.elgato.streamdeck.system.multimedia" },
  "com.elgato.streamdeck.system.website": { Name: "Website", UUID: "com.elgato.streamdeck.system.website" },
  "com.elgato.streamdeck.system.keybrightness": { Name: "Brightness", UUID: "com.elgato.streamdeck.system.keybrightness" },
};
const NAMES = {
  "com.elgato.streamdeck.system.hotkey": "Hotkey", "com.elgato.streamdeck.system.hotkeyswitch": "Hotkey Switch",
  "com.elgato.streamdeck.page.next": "Next Page", "com.elgato.streamdeck.page.previous": "Previous Page",
  "com.elgato.streamdeck.page.goto": "Go to Page", "com.elgato.streamdeck.profile.openchild": "Create Folder",
  "com.elgato.streamdeck.profile.backtoparent": "Parent Folder", "com.elgato.streamdeck.profile.rotate": "Switch Profile",
  "com.elgato.streamdeck.keys.adaptor": "Action Trigger", "com.elgato.streamdeck.system.multimedia": "Multimedia",
  "com.elgato.streamdeck.system.website": "Website", "com.elgato.streamdeck.system.keybrightness": "Brightness",
};

// An image reference that becomes "Images/<name>.png" when the page is written.
const img = (key) => (key ? { $img: key } : undefined);

// A key's state: its picture, its name kept as the (hidden) title, since the art draws the
// label in the theme's own font.
function keyState(image, title = "") {
  const s = { FontFamily: "", FontSize: 9, FontStyle: "", FontUnderline: false, OutlineThickness: 2, ShowTitle: false, Title: title, TitleAlignment: "bottom", TitleColor: "#ffffff" };
  if (image) s.Image = img(image);
  return s;
}

// One action instance. `plugin` is { Name, UUID, Version } (another plugin, or ours); for the
// app's own actions it comes from BUILTIN.
function action(id, uuid, { name, plugin, settings = {}, states = [{}], extra = {} } = {}) {
  const p = plugin || (BUILTIN[uuid] && { ...BUILTIN[uuid], Version: "1.0" });
  return { ActionID: id, LinkedTitle: true, Name: name || NAMES[uuid] || uuid, ...(p ? { Plugin: p } : {}), Settings: settings, State: 0, States: states, UUID: uuid, ...extra };
}

// The controllers a page of this model has; every page lists all of them, even empty.
function controllers(model, { keys = {}, dials = null, background = null } = {}) {
  const list = [{ Actions: keys, Type: "Keypad" }];
  if (model.dials) list.push({ Actions: dials || {}, ...(background ? { Background: img(background) } : {}), Type: "Encoder" });
  if (model.nav === "corner" && model.touchPaging) list.push({ Actions: {}, Type: "Neo" });
  return list;
}

// profile: { uuid, name, model, pages: [page], defaultPage: page, folders: [page] }
// page: { uuid, name, controllers }. `images(key)` returns the PNG for an image reference.
function profileZip(profile, images) {
  const root = `${profile.uuid.toUpperCase()}.sdProfile/`;
  const manifest = {
    Device: { Model: profile.model.model, UUID: "" },
    Name: profile.name,
    Pages: { Current: profile.pages[0].uuid, Default: profile.defaultPage.uuid, Pages: profile.pages.map((p) => p.uuid) },
    Version: "2.0",
  };
  const entries = [{ name: root, dir: true }, { name: `${root}manifest.json`, data: stable(manifest) }, { name: `${root}Images/`, dir: true }, { name: `${root}Profiles/`, dir: true }];
  const all = [...profile.pages, profile.defaultPage, ...profile.folders].map((p) => ({ page: p, dir: pageDir(p.uuid) })).sort((a, b) => (a.dir < b.dir ? -1 : 1));
  let imageCount = 0;
  for (const { page, dir } of all) {
    const files = new Map();
    // Replace every image reference with its file, one file per distinct picture per page.
    const json = stable({ Controllers: page.controllers, Icon: "", Name: page.name || "" }).replace(/\{"\$img":"([^"]+)"\}/g, (m, key) => {
      const buf = images(key);
      if (!buf) throw new Error(`No image for ${key}`);
      const name = imageName(buf);
      files.set(name, buf);
      return JSON.stringify(`Images/${name}`);
    });
    const base = `${root}Profiles/${dir}/`;
    entries.push({ name: base, dir: true }, { name: `${base}Images/`, dir: true });
    for (const name of [...files.keys()].sort()) entries.push({ name: `${base}Images/${name}`, data: files.get(name) });
    entries.push({ name: `${base}manifest.json`, data: json });
    imageCount += files.size;
  }
  return { buffer: zip(entries), pages: all.length, images: imageCount };
}

module.exports = { uuidFrom, pageDir, imageName, stable, action, keyState, controllers, profileZip, img, BUILTIN };
