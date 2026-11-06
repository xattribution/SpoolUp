// Renders SVG and HTML to PNG with an installed Microsoft Edge or Google Chrome, driven over
// the DevTools protocol, so the pack's images need no npm packages. Like tools/record-demo.js
// it starts the browser without a window; it talks to it over a pipe instead of a WebSocket,
// which works on every Node version the build supports.
//
// Many images are drawn on one page ("a sheet") and captured in one screenshot, then cut
// apart in Node: one capture per sheet instead of one per key.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const png = require("./png");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --browser, then SPOOLUP_BROWSER, then Edge or Chrome where Windows installs them (and
// the usual places on macOS and Linux, for building elsewhere).
function findBrowser(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw Object.assign(new Error(`No browser at ${explicit}`), { usage: true });
    return explicit;
  }
  const env = process.env;
  const under = (root, ...parts) => (root ? path.join(root, ...parts) : null);
  const candidates = [
    env.SPOOLUP_BROWSER,
    env.BROWSER,
    under(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    under(env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    under(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    under(env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    under(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw Object.assign(new Error("Microsoft Edge or Google Chrome is needed: pass --browser <path> or set SPOOLUP_BROWSER."), { usage: true });
  return found;
}

// Starts the browser and opens one page. Returns { send(method, params), close() }.
async function launch(exe) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "spoolup-sd-"));
  const args = [
    "--headless=new", "--remote-debugging-pipe", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
    "--hide-scrollbars", "--mute-audio", "--force-color-profile=srgb", "about:blank",
  ];
  // Chromium refuses to start as root on Linux (containers, CI) without this.
  if (process.platform === "linux" && process.getuid && process.getuid() === 0) args.push("--no-sandbox");
  const proc = spawn(exe, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  proc.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  const out = proc.stdio[3], inp = proc.stdio[4];

  let nextId = 1, buffered = "", exited = null;
  const pending = new Map(), waiters = [];
  const fail = (err) => { for (const { reject } of pending.values()) reject(err); pending.clear(); };
  proc.on("exit", (code) => { exited = code; fail(new Error(`The browser stopped (exit ${code}). ${stderr.trim().split("\n").slice(-3).join(" ")}`)); });
  proc.on("error", (err) => fail(err));
  // Messages are JSON, each ended by a NUL byte.
  inp.on("data", (d) => {
    buffered += d.toString("utf8");
    let end;
    while ((end = buffered.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buffered.slice(0, end));
      buffered = buffered.slice(end + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, method } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
      } else if (msg.method) {
        const i = waiters.findIndex((w) => w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId));
        if (i >= 0) waiters.splice(i, 1)[0].resolve(msg.params);
      }
    }
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (exited !== null) { reject(new Error("The browser isn't running.")); return; }
    const id = nextId++;
    pending.set(id, { resolve, reject, method });
    out.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
  const event = (method, sessionId) => new Promise((resolve) => waiters.push({ method, sessionId, resolve }));

  const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  await send("Page.enable");
  const close = async () => {
    try { await Promise.race([raw("Browser.close"), sleep(2000)]); } catch { /* already gone */ }
    if (exited === null) proc.kill();
    for (let i = 0; i < 20 && exited === null; i++) await sleep(100);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch { /* the OS cleans temp */ }
  };
  return { send, event: (method) => event(method, sessionId), close };
}

// The renderer: one page with the theme fonts loaded, reused for every sheet.
class Renderer {
  constructor(exe, { fontsCss = "", families = [], log = () => {} } = {}) {
    this.exe = exe;
    this.fontsCss = fontsCss;
    this.families = families;
    this.log = log;
    this.captures = 0;
  }

  async start() {
    this.browser = await launch(this.exe);
    const { send } = this.browser;
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    const { frameTree } = await send("Page.getFrameTree");
    const html = `<!doctype html><html><head><meta charset="utf-8">${this.fontsCss ? `<link rel="stylesheet" href="${this.fontsCss}">` : ""}
<style>html,body{margin:0;padding:0;background:transparent}#sheet{position:relative}#sheet>svg{position:absolute;display:block;overflow:hidden}</style>
</head><body><div id="sheet"></div></body></html>`;
    await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    // Wait for the font stylesheet, then ask for every face so they're all in memory before
    // the first capture; a font that can't load leaves its theme on the fallback stack.
    const result = await this.evaluate(`(async () => {
      const link = document.querySelector("link[rel=stylesheet]");
      if (link && !link.sheet) await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 20000); });
      const wanted = ${JSON.stringify(this.families)};
      await Promise.race([Promise.all(wanted.map((f) => document.fonts.load(f).catch(() => []))), new Promise((r) => setTimeout(r, 30000))]);
      await document.fonts.ready;
      const loaded = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
      return wanted.map((f) => f.replace(/^\\S+ \\S+ "(.*)"$/, "$1")).filter((name, i, all) => all.indexOf(name) === i && !loaded.has(name));
    })()`);
    return { missingFonts: result || [] };
  }

  async evaluate(expression) {
    const r = await this.browser.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`In the page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }

  // Captures the top-left w x h of the page after `html` replaces the sheet's contents.
  async capture(html, w, h) {
    const { send } = this.browser;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await this.evaluate(`(async () => {
      document.getElementById("sheet").innerHTML = ${JSON.stringify(html)};
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    })()`);
    const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 }, captureBeyondViewport: false });
    this.captures++;
    return Buffer.from(data, "base64");
  }

  // jobs: [{ svg, w, h }] -> PNG buffers in the same order. Jobs are packed onto sheets of at
  // most `sheet` px square, with a gap so nothing bleeds between neighbours. With `encoder`
  // (an EncoderPool) the images are encoded on worker threads while the next sheet is drawn.
  async renderSvgs(jobs, { sheet = 2048, gap = 4, onProgress, encoder } = {}) {
    const out = new Array(jobs.length);
    const encoding = [];
    let i = 0;
    while (i < jobs.length) {
      // Shelf packing in job order: rows of images, a new row when one is full.
      const placed = [];
      let x = 0, y = 0, rowH = 0, width = 0;
      while (i < jobs.length) {
        const j = jobs[i];
        if (j.w > sheet || j.h > sheet) throw new Error(`An image of ${j.w}x${j.h} is larger than a sheet`);
        if (x + j.w > sheet) { x = 0; y += rowH + gap; rowH = 0; }
        if (y + j.h > sheet) break;
        placed.push({ index: i, x, y, w: j.w, h: j.h, svg: j.svg });
        width = Math.max(width, x + j.w);
        x += j.w + gap; rowH = Math.max(rowH, j.h);
        i++;
      }
      const height = Math.max(...placed.map((p) => p.y + p.h));
      const html = placed.map((p, n) => positioned(p.svg, p.x, p.y, p.w, p.h, `s${n}_`)).join("");
      const shot = png.decode(await this.capture(html, width, height));
      for (const p of placed) {
        const tile = png.crop(shot, p.x, p.y, p.w, p.h);
        if (encoder) encoding.push(encoder.encode(tile).then((buf) => { out[p.index] = buf; }));
        else out[p.index] = png.encodeBest(tile);
      }
      if (onProgress) onProgress(i, jobs.length);
    }
    await Promise.all(encoding);
    return out;
  }

  // A whole HTML fragment (previews): measured, then captured at its own size.
  async renderHtml(html) {
    await this.browser.send("Emulation.setDeviceMetricsOverride", { width: 4000, height: 1000, deviceScaleFactor: 1, mobile: false });
    await this.evaluate(`(async () => { document.getElementById("sheet").innerHTML = ${JSON.stringify(html)}; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); })()`);
    const box = await this.evaluate(`(() => { const r = document.getElementById("sheet").firstElementChild.getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
    return this.capture(html, box.w, box.h);
  }

  async close() { if (this.browser) await this.browser.close(); }
}

// An SVG placed at (x, y) and drawn at w x h, with its ids renamed so gradients from different
// images on one sheet can't collide.
function positioned(svg, x, y, w, h, prefix) {
  const s = String(svg)
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
  return s.replace(/^\s*<svg\b/, `<svg style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"`);
}

module.exports = { findBrowser, launch, Renderer };
