// Button sounds (Deck settings → Sounds, on unless turned off): short HUD tones built from
// lists of tones (BANK), never from sound files. They play on this device with Web Audio, or,
// with "Play on" set to the PC, on the gaming PC's output of the player's choice (a headset,
// to hear them over the game): the tablet sends the same tone list over its connection and
// native/sound.exe synthesizes it there. Nothing goes anywhere else.
//
// DeckSound.play(name, color) plays a one-off sound; DeckSound.spool(kind, ms) plays the
// rising sound of a hold (a quantum charge, self-destruct arming) and returns a function that
// stops it early. With sounds off, both do nothing.
(() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* not kept */ } },
  };
  // All kept per device, like the rest of Deck settings.
  const isOn = () => store.get("sounds") !== "off";
  const toPC = () => store.get("sound-out") === "pc";
  const device = () => store.get("sound-device") || ""; // the PC's output; "" = its default
  const volume = () => {
    const v = Number(store.get("sound-volume") ?? 60);
    return v >= 0 && v <= 100 ? v : 60;
  };
  const master = () => 0.5 * (volume() / 100);

  // One tone of a sound. The fields and what they mean are shared with native/sound.cs, so a
  // sound is the same here and on the PC: an exponential sweep from f0 to f1 over len, a
  // short attack, then a decay to silence at len, or with sustain a hold until len and a
  // decay over release; lp0/lp1 sweep a lowpass the same way (0 = none).
  const T = (type, f, len, level, at = 0, more = {}) => {
    const [f0, f1] = Array.isArray(f) ? f : [f, f];
    return { type, f0, f1, len, level, at, attack: 0.005, sustain: 0, release: 0, lp0: 0, lp1: 0, ...more };
  };

  // A press chirps at a pitch that follows the button's color, so weapons sound lower than
  // navigation, the way the colors already read.
  const PITCH = { "": 784, green: 880, blue: 988, amber: 659, red: 523 };
  const MOST_TICKS = 40; // a long hold's ticks stop here, well inside what the PC accepts
  const BANK = {
    press(color) {
      const f = PITCH[color] || PITCH[""];
      return [T("triangle", [f * 1.5, f], 0.07, 0.5), T("sine", f * 2, 0.035, 0.12)];
    },
    page: () => [T("sine", [1400, 900], 0.05, 0.22)],
    deny: () => [T("square", 196, 0.09, 0.16), T("square", 196, 0.09, 0.16, 0.12)],
    listen: () => [T("sine", [440, 880], 0.09, 0.32)],
    heard: () => [T("sine", 660, 0.09, 0.32), T("sine", 990, 0.14, 0.32, 0.08)],
    unheard: () => [T("sine", 520, 0.09, 0.3), T("sine", 347, 0.16, 0.3, 0.08)],
    online: () => [523, 659, 784].map((f, i) => T("sine", f, 0.12, 0.26, i * 0.07)),
    offline: () => [T("sine", [600, 300], 0.25, 0.24)],
    engaged: () => [T("sine", 392, 0.5, 0.24), T("sine", 587, 0.5, 0.2), T("sine", 784, 0.6, 0.18, 0.02), T("sine", [1568, 2093], 0.4, 0.05, 0.05)],
    armed: () => [0, 0.28].flatMap((at) => [T("square", 880, 0.12, 0.14, at), T("square", 660, 0.12, 0.14, at + 0.14)]),
    eject: () => [T("sawtooth", [900, 60], 0.45, 0.18)],
    // Quantum spool: a filtered hum rising in pitch, with ticks that come faster.
    charge(ms) {
      const len = ms / 1000;
      const tones = [T("sawtooth", [70, 420], len, 0.32, 0, { attack: 0.15, sustain: 1, release: 0.12, lp0: 300, lp1: 2400 })];
      for (let at = 0.1, gap = 0.16; at < len && tones.length <= MOST_TICKS; at += gap, gap = Math.max(0.045, gap * 0.82)) {
        tones.push(T("sine", 1200 + (at / len) * 900, 0.03, 0.1, at));
      }
      return tones;
    },
    // Arming: alarm beeps that come faster as the bar fills.
    arming(ms) {
      const len = ms / 1000, tones = [];
      for (let at = 0, gap = 0.3; at < len && tones.length < MOST_TICKS; at += gap, gap = Math.max(0.08, gap * 0.85)) {
        tones.push(T("square", 740, Math.min(0.08, gap * 0.6), 0.11, at));
      }
      return tones;
    },
  };
  // How long a sound lasts, in s.
  const length = (tones) => Math.max(...tones.map((k) => k.at + k.len + (k.sustain ? k.release : 0)));

  // ---------- on this device ----------

  let ctx = null, out = null;
  // Browsers only start audio after a touch, and iOS pauses it in the background, so each
  // touch makes sure it's running. Nothing is created while sounds are off.
  function wake() {
    if (!isOn()) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        out = ctx.createGain();
        out.gain.value = master();
        // Keeps overlapping taps and chords from clipping, without squashing single tones.
        const limit = ctx.createDynamicsCompressor();
        limit.threshold.value = -12;
        limit.ratio.value = 6;
        out.connect(limit);
        limit.connect(ctx.destination);
      }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    } catch { ctx = null; }
  }
  for (const type of ["pointerdown", "pointerup", "touchend", "keydown"]) {
    document.addEventListener(type, wake, { capture: true, passive: true });
  }
  // Sounds only play on a running context: one still suspended would save them all up and
  // play them at once on the next touch.
  const ready = () => ctx !== null && ctx.state === "running";

  // Plays a tone list into `dest` from now, the way native/sound.cs renders it on the PC.
  function schedule(c, dest, tones) {
    const now = c.currentTime;
    for (const k of tones) {
      const t0 = now + k.at, level = Math.max(k.level, 0.0002);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = k.type;
      // Set before the automation too, or Chromium runs the oscillator at its default 440 Hz
      // until t0, and a delayed tone starts at whatever phase that left (the PC starts at 0).
      osc.frequency.value = k.f0;
      osc.frequency.setValueAtTime(k.f0, t0);
      if (k.f1 !== k.f0) osc.frequency.exponentialRampToValueAtTime(k.f1, t0 + k.len);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + Math.min(k.attack, k.len / 2));
      let end = t0 + k.len;
      if (k.sustain) {
        g.gain.setValueAtTime(level, t0 + k.len);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + k.len + k.release);
        end += k.release;
      } else {
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + k.len);
      }
      let src = osc;
      if (k.lp0 > 0) {
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(k.lp0, t0);
        lp.frequency.exponentialRampToValueAtTime(k.lp1, t0 + k.len);
        osc.connect(lp);
        src = lp;
      }
      src.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(end + 0.03);
    }
  }

  // ---------- on the PC ----------

  // app.js hands over a function that sends a message to the PC and says whether it went.
  let sender = null;
  let pcWorks = true; // false while the PC says it can't play sounds: they play here then
  let nextId = 1;
  // Sends a sound to the PC when this device plays them there; false means play it here,
  // e.g. while the connection is down, so a "not connected" buzz is still heard.
  function toThePC(name, tones, id) {
    if (!toPC() || !pcWorks || !sender) return false;
    return sender({ t: "sound", id, name, device: device(), volume: volume() / 100, tones });
  }
  const newId = () => { const id = nextId; nextId = nextId >= 2147483646 ? 1 : nextId + 1; return id; };

  function play(name, color) {
    if (!isOn() || !BANK[name]) return;
    const tones = BANK[name](color || "");
    if (!toThePC(name, tones, newId()) && ready()) schedule(ctx, out, tones);
  }

  function spool(kind, ms) {
    if (!isOn() || !BANK[kind]) return () => {};
    const tones = BANK[kind](Math.min(ms, 4000));
    const id = newId();
    if (toThePC(kind, tones, id)) {
      // Only worth a message while it's still playing.
      const ends = performance.now() + length(tones) * 1000;
      return () => { if (performance.now() < ends) sender({ t: "sound-stop", id }); };
    }
    if (!ready()) return () => {};
    const bus = ctx.createGain();
    bus.connect(out);
    schedule(ctx, bus, tones);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      bus.gain.setValueAtTime(1, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.08);
      setTimeout(() => bus.disconnect(), 150);
    };
  }

  // A press sound where sounds play now, to try a setting. Called from a tap, so audio on
  // this device may only just be starting: it plays once it runs.
  function test() {
    if (!isOn()) return;
    const tones = BANK.press("");
    if (toThePC("press", tones, newId())) return;
    wake();
    ctx?.resume().then(() => schedule(ctx, out, tones)).catch(() => {});
  }
  // Tells the PC whether this device plays sounds there, so it can get ready before the first.
  const announce = () => sender?.({ t: "sound-out", pc: isOn() && toPC() });

  window.DeckSound = {
    get on() { return isOn(); },
    get out() { return toPC() ? "pc" : "device"; },
    get device() { return device(); },
    get volume() { return volume(); },
    set(on) {
      store.set("sounds", on ? "on" : "off");
      announce();
      test();
    },
    // "device" or "pc", with the PC's output name ("" = its default).
    route(where, name) {
      store.set("sound-out", where === "pc" ? "pc" : "");
      store.set("sound-device", where === "pc" ? name || "" : "");
      announce();
      test();
    },
    setVolume(v) {
      store.set("sound-volume", String(Math.round(Math.max(0, Math.min(100, v)))));
      if (out) out.gain.value = master();
      test();
    },
    // From app.js: how to reach the PC, and what the PC says about playing sounds.
    connect(send) { sender = send; },
    announce,
    status(s) { pcWorks = !s || s.state !== "unavailable"; },
    play,
    spool,
    // The tone lists and the renderer, for checking that the PC sounds the same.
    tones: (name, arg) => (BANK[name] ? BANK[name](arg) : null),
    schedule,
  };
})();
