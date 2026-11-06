// Draws the plugin's manifest images into its imgs/ folder: the action list icons (white
// line icons, 20x20 and 40x40 @2x as SVG), each action's key image (shown until the plugin
// draws the key, and in the action list's previews), the dial's icon, the category icon,
// and the plugin icon, which Stream Deck wants as PNG (256x256 and 512x512 @2x).
//
//   node streamdeck/plugin/make-images.js
//
// The SVGs come from streamdeck/keyart.js and public/icons.js in the RSI (house) theme. The
// PNGs need a browser: Playwright if it can be required (NODE_PATH), else they're left as
// they are. Rerun after changing an icon used here; the results are committed.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO = path.join(__dirname, "..", "..");
const IMGS = path.join(__dirname, "com.xattribution.spoolup.sdPlugin", "imgs");
const keyart = require(path.join(REPO, "streamdeck", "keyart.js"));
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(REPO, "public", "icons.js"), "utf8"), { window });
const ICONS = window.DECK_ICONS;
const theme = keyart.theme(keyart.parseThemes(fs.readFileSync(path.join(REPO, "public", "themes.css"), "utf8")).rsi, "rsi");

// A dial: the knob, its pointer and the two ways it turns.
const DIAL = `<circle cx="24" cy="29" r="11"/><path d="M24 29v-7"/><path d="M7 23a17 17 0 0 1 34 0"/><path d="M3 19l4 4 4-4"/><path d="M37 19l4 4 4-4"/>`;
const ACTIONS = {
  key: { icon: ICONS["flight-ready"], color: "" },
  dial: { icon: DIAL, color: "" },
  scene: { icon: ICONS.grid, color: "" },
  theme: { icon: ICONS.palette, color: "" },
  talk: { icon: ICONS.mic, color: "red" },
  status: { icon: ICONS.sliders, color: "green" },
  lights: { icon: ICONS["power-reset"], color: "" },
};

const tiny = (body) => body.replace(/\sd="([^"]*)"/g, (m, d) => ` d="${keyart.arcsToCubics(d)}"`);
// Action list icons: white on transparent, as Stream Deck asks; it tints them itself.
const listIcon = (body, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><g fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${tiny(body.replace(/currentColor/g, "#FFFFFF"))}</g></svg>`;
// The category icon: a deck of keys in HUD brackets.
const CATEGORY = `<path d="M5 14V5h9M43 34v9h-9"/><rect x="11" y="13" width="11" height="9" rx="1.5"/><rect x="26" y="13" width="11" height="9" rx="1.5" fill="#FFFFFF"/><rect x="11" y="26" width="11" height="9" rx="1.5"/><rect x="26" y="26" width="11" height="9" rx="1.5"/>`;

// The plugin icon: a lit key on a deck, in the house colours, at any size.
function pluginIcon(size) {
  const key = (x, y, lit) => `<rect x="${x}" y="${y}" width="112" height="112" rx="14" fill="${lit ? "#12253b" : "#0b1726"}" stroke="${lit ? "#4fb3ff" : "#1f3a58"}" stroke-width="${lit ? 6 : 4}"/>${lit ? `<rect x="${x - 8}" y="${y - 8}" width="128" height="128" rx="20" fill="none" stroke="#4fb3ff" stroke-width="10" opacity=".18"/>` : ""}`;
  const ship = keyart.icon(ICONS["flight-ready"], { ...theme, stroke: 2.6 }, 316, 196, 92, "#4fb3ff", { glow: true, strength: 1.6 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1d30"/><stop offset="1" stop-color="#05090f"/></linearGradient></defs>
<rect x="16" y="16" width="480" height="480" rx="72" fill="url(#bg)"/>
<rect x="16" y="16" width="480" height="480" rx="72" fill="none" stroke="#1f3a58" stroke-width="6"/>
<path d="M60 128V60h68M452 384v68h-68" fill="none" stroke="#4fb3ff" stroke-width="12" stroke-linecap="square"/>
${key(140, 140, false)}${key(260, 140, true)}${key(140, 260, false)}${key(260, 260, false)}
${ship}
<path d="M168 196h56M196 168v56" stroke="#8aa0b8" stroke-width="8" stroke-linecap="round" opacity=".7"/>
<path d="M168 316h56" stroke="#8aa0b8" stroke-width="8" stroke-linecap="round" opacity=".7"/>
<circle cx="316" cy="316" r="22" fill="none" stroke="#46d79a" stroke-width="8"/>
</svg>`;
}

function write(rel, text) {
  const file = path.join(IMGS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

for (const [id, a] of Object.entries(ACTIONS)) {
  write(`actions/${id}/icon.svg`, listIcon(a.icon, 20));
  write(`actions/${id}/key.svg`, keyart.key({ theme, icon: a.icon, color: a.color, showLabel: false, font: "live" }));
}
// The dial in the Stream Deck app's dial circle.
write("actions/dial/dial.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><circle cx="72" cy="72" r="70" fill="#0b1726"/><circle cx="72" cy="72" r="66" fill="none" stroke="#1f3a58" stroke-width="3"/>${keyart.icon(DIAL, theme, 72, 72, 84, "#4fb3ff")}</svg>`);
write("plugin/category.svg", listIcon(CATEGORY, 28));

(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { console.log("Playwright not found: the plugin icon PNGs weren't redrawn."); return; }
  const browser = await chromium.launch();
  for (const [size, name] of [[256, "icon.png"], [512, "icon@2x.png"]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${pluginIcon(size)}</body></html>`);
    await page.screenshot({ path: path.join(IMGS, "plugin", name), omitBackground: true });
    await page.close();
  }
  await browser.close();
  console.log("Drew the plugin icon PNGs.");
})();
console.log(`Wrote the SVG images in ${IMGS}`);
