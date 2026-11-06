// Button sounds (a switch under Display in Deck settings, off unless turned on): short HUD
// tones made on the tablet with Web Audio, so there are no sound files and nothing goes
// over the network. They play on this device only; the PC and the game never hear them.
//
// DeckSound.play(name, colour) plays a one-off sound (see SOUNDS); DeckSound.spool(kind, ms)
// plays the rising sound of a hold (a quantum charge, self-destruct arming) and returns a
// function that stops it early. Without the switch on, both do nothing.
(() => {
  const KEY = "sounds";
  const isOn = () => { try { return localStorage.getItem(KEY) === "on"; } catch { return false; } };
  let ctx = null, out = null;

  // Browsers only start audio after a touch, and iOS pauses it in the background, so each
  // touch makes sure it's running. Nothing is created until the switch is on.
  function wake() {
    if (!isOn()) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        out = ctx.createGain();
        out.gain.value = 0.3;
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
  const ready = () => isOn() && ctx !== null && ctx.state === "running";

  // One tone: f in Hz, or [from, to] to sweep; len and at (delay) in seconds.
  function tone(f, len, { type = "sine", level = 0.4, at = 0, dest = out } = {}) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    const [f0, f1] = Array.isArray(f) ? f : [f, f];
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + len);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + len + 0.03);
  }

  // A press chirps at a pitch that follows the button's colour, so weapons sound lower
  // than navigation, the way the colours already read.
  const PITCH = { "": 784, green: 880, blue: 988, amber: 659, red: 523 };
  const SOUNDS = {
    press(colour) {
      const f = PITCH[colour] || PITCH[""];
      tone([f * 1.5, f], 0.07, { type: "triangle", level: 0.5 });
      tone(f * 2, 0.035, { level: 0.12 });
    },
    page: () => tone([1400, 900], 0.05, { level: 0.22 }),
    deny() {
      tone(196, 0.09, { type: "square", level: 0.16 });
      tone(196, 0.09, { type: "square", level: 0.16, at: 0.12 });
    },
    listen: () => tone([440, 880], 0.09, { level: 0.32 }),
    heard() { tone(660, 0.09, { level: 0.32 }); tone(990, 0.14, { level: 0.32, at: 0.08 }); },
    unheard() { tone(520, 0.09, { level: 0.3 }); tone(347, 0.16, { level: 0.3, at: 0.08 }); },
    online() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, { level: 0.26, at: i * 0.07 })); },
    offline: () => tone([600, 300], 0.25, { level: 0.24 }),
    engaged() {
      tone(392, 0.5, { level: 0.24 });
      tone(587, 0.5, { level: 0.2 });
      tone(784, 0.6, { level: 0.18, at: 0.02 });
      tone([1568, 2093], 0.4, { level: 0.05, at: 0.05 });
    },
    armed() {
      for (const at of [0, 0.28]) {
        tone(880, 0.12, { type: "square", level: 0.14, at });
        tone(660, 0.12, { type: "square", level: 0.14, at: at + 0.14 });
      }
    },
    eject: () => tone([900, 60], 0.45, { type: "sawtooth", level: 0.18 }),
  };

  function spool(kind, ms) {
    if (!ready()) return () => {};
    const bus = ctx.createGain();
    bus.connect(out);
    const t0 = ctx.currentTime, len = ms / 1000;
    if (kind === "charge") {
      // Quantum spool: a filtered hum rising in pitch, with ticks that come faster.
      const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = "sawtooth";
      lp.type = "lowpass";
      osc.frequency.setValueAtTime(70, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + len);
      lp.frequency.setValueAtTime(300, t0);
      lp.frequency.exponentialRampToValueAtTime(2400, t0 + len);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.15);
      g.gain.setValueAtTime(0.32, t0 + len);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.12);
      osc.connect(lp);
      lp.connect(g);
      g.connect(bus);
      osc.start(t0);
      osc.stop(t0 + len + 0.15);
      for (let at = 0.1, gap = 0.16; at < len; at += gap, gap = Math.max(0.045, gap * 0.82)) {
        tone(1200 + (at / len) * 900, 0.03, { level: 0.1, at, dest: bus });
      }
    } else {
      // Arming: alarm beeps that come faster as the bar fills.
      for (let at = 0, gap = 0.3; at < len; at += gap, gap = Math.max(0.08, gap * 0.85)) {
        tone(740, Math.min(0.08, gap * 0.6), { type: "square", level: 0.11, at, dest: bus });
      }
    }
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

  window.DeckSound = {
    get on() { return isOn(); },
    set(on) {
      try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* not kept */ }
      if (!on) return;
      // Turned on with a tap, which may be the first: confirm once audio is running.
      wake();
      ctx?.resume().then(() => SOUNDS.press("")).catch(() => {});
    },
    play(name, colour) { if (ready()) SOUNDS[name]?.(colour || ""); },
    spool,
  };
})();
