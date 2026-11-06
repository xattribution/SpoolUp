// Encodes PNGs on worker threads: squeezing each key image (png.encodeBest) takes far longer
// than the browser takes to draw it, so the pack's thousands of images are spread over the
// PC's cores while the browser draws the next sheet.
"use strict";
const os = require("os");
const { Worker, isMainThread, parentPort } = require("worker_threads");
const png = require("./png");

if (!isMainThread && parentPort) {
  parentPort.on("message", ({ id, width, height, rgba }) => {
    try {
      const out = png.encodeBest({ width, height, rgba: Buffer.from(rgba) });
      parentPort.postMessage({ id, out });
    } catch (err) {
      parentPort.postMessage({ id, error: err.message });
    }
  });
}

class EncoderPool {
  constructor(size = Math.max(1, Math.min(8, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1))) {
    this.workers = [];
    this.queue = [];
    this.waiting = new Map();
    this.nextId = 1;
    for (let i = 0; i < size; i++) {
      const w = new Worker(__filename);
      w.busy = false;
      w.on("message", ({ id, out, error }) => {
        const job = this.waiting.get(id);
        this.waiting.delete(id);
        w.busy = false;
        if (error) job.reject(new Error(error)); else job.resolve(Buffer.from(out));
        this.pump();
      });
      w.on("error", (err) => { for (const job of this.waiting.values()) job.reject(err); this.waiting.clear(); });
      this.workers.push(w);
    }
  }
  // img: { width, height, rgba } -> Promise<PNG buffer>
  encode(img) {
    return new Promise((resolve, reject) => { this.queue.push({ img, resolve, reject }); this.pump(); });
  }
  pump() {
    for (const w of this.workers) {
      if (w.busy || !this.queue.length) continue;
      const job = this.queue.shift();
      const id = this.nextId++;
      this.waiting.set(id, job);
      w.busy = true;
      w.postMessage({ id, width: job.img.width, height: job.img.height, rgba: job.img.rgba });
    }
  }
  async close() { await Promise.all(this.workers.map((w) => w.terminate())); }
}

module.exports = { EncoderPool };
