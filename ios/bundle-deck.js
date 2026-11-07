// Copies the deck into ios/Deck/ for the app's offline demo (DemoSchemeHandler.swift),
// the same files the website's "Try it" page gets (scripts/build-site.js):
//
//   node ios/bundle-deck.js
//
// The editor and showcase need the PC server, so they stay out. Xcode runs this before
// each build when it can find node; ios/Deck/ is never committed.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "Deck");

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "public"), OUT, {
  recursive: true,
  filter: (src) => !/^(editor|showcase)\./.test(path.basename(src)),
});
fs.cpSync(path.join(ROOT, "layouts"), path.join(OUT, "layouts"), { recursive: true });

if (!fs.existsSync(path.join(OUT, "index.html"))) throw new Error("public/index.html is missing.");
const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`Bundled the deck in ios/Deck/: ${count(OUT)} files.`);
