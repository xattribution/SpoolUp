// What each of the plugin's actions does and how it looks, driven by Stream Deck's events
// (plugin.js) and SpoolUp's messages (spoolup.js).
//
// The ground rules, as they apply here:
// - One press per tap: a key press sends one "tap" (or one "down" and one "up" for hold
//   buttons); a dial detent is one tap, at most 5 per turn and at most 5 waiting. Taps go
//   one at a time, each once the last one's keys are up, so two never merge into one
//   press or mix their modifiers (see "the press line"). Nothing repeats, and the actions
//   can't go in Multi Actions or Key Logic (manifest).
// - Keys only reach Star Citizen: everything goes to SpoolUp, which runs its focus
//   check; while it isn't connected nothing is sent or saved for later.
// - Releases always go through: a "down" is matched by an "up" on keyUp/dialUp, and on
//   willDisappear, deviceDidDisconnect, systemDidWakeUp, a settings change and when the
//   Stream Deck socket closes. If the SpoolUp link drops, the server has already
//   released everything this client held.
"use strict";
const { THEMES } = require("./emblems");
const { svgUrl, svgBase64 } = require("./draw");

const UUID = "com.xattribution.spoolup";
const KIND = { key: "key", dial: "dial", scene: "scene", theme: "theme", talk: "talk", status: "status", lights: "lights" };
const kindOf = (action) => KIND[String(action).slice(UUID.length + 1)] || null;

const FRAME_MS = 120;   // animation frame spacing; the painter enforces it per key
const BLOCKED_MS = 700; // how long a skipped press stays red
const MAX_DETENTS = 5;  // presses per dialRotate; a dial's turns, and its pushes, waiting at most
const SLOW_MS = 120;    // round trip that turns the status amber, as on the tablet

// Press animations: the effect a button plays (public/fx.js pick()) and how long it lasts.
const BY_ID = { power: "ripple", "flight-ready": "ripple", gear: "gear", lights: "glow", decoy: "burst", noise: "burst", doors: "doors", "quantum-jump": "charge", "power-weapons": "recoil" };
const BY_ICON = { target: "lock", decoy: "burst", lights: "glow", missile: "recoil" };
const animFor = (def) => def.anim || BY_ID[def.id] || BY_ICON[def.icon] || (def.mode === "timed" ? "timed" : "flash");
const ANIM_MS = { flash: 400, ripple: 650, gear: 900, doors: 900, lock: 650, burst: 750, recoil: 420, streak: 450, glow: 600 };
// Effects that show the shared state (lit) rather than only play on a press.
const STATE_ANIMS = new Set(["ripple", "gear", "glow", "doors"]);

// follow: tablets follow this plugin's scenes; followTablet: Stream Decks follow a tablet's panels.
const DEFAULTS = { theme: "rsi", follow: false, followTablet: true, motion: true, port: 0, code: "" };

function createActions({ sd, tablet, data, draw, log }) {
  const { t } = data;
  let G = { ...DEFAULTS };          // global settings
  let gotGlobals = false;
  const contexts = new Map();       // context -> ctx
  const devices = new Map();        // device id -> { type, name, size }
  const sceneOn = new Map();        // device id -> scene index shown there
  const sceneAt = new Map();        // device id -> when the scene last changed (dials flash)
  const switchedAt = new Map();     // device id -> when the plugin last switched its profile page
  const quietUntil = new Map();     // device id -> until when its page changes aren't told to tablets
  const holds = new Map();          // deck action id -> Set of ctx holding it down on SpoolUp
  const talkers = new Set();        // talk ctx held down
  const toggles = new Map();        // deck action id -> on, for effects without a shared state
  const piOpen = new Set();         // contexts whose property inspector is open
  let states = {};                  // SpoolUp's shared states: group -> on
  let voice = { state: "ready" };   // SpoolUp's voice commands
  let listening = false;            // push-to-talk held on the PC
  const animating = new Set();
  let ticker = null;

  const now = () => Date.now();
  const online = () => tablet.connected;
  const sceneIndex = (id) => data.SCENES.findIndex((s) => s.id === id);

  // ---------- devices and scenes ----------

  function modelOf(device) {
    const d = devices.get(device);
    if (!d) return null;
    return Object.values(data.MODELS).find((m) => m.type === d.type) || null;
  }
  // The bundled profile for this device's model (the generator writes one per model).
  const profileFor = (device) => { const m = modelOf(device); return m ? `profiles/SpoolUp ${m.name}` : null; };

  function setScene(device, index, { tell = true } = {}) {
    if (index < 0 || index >= data.SCENES.length || sceneOn.get(device) === index) return;
    sceneOn.set(device, index);
    sceneAt.set(device, now());
    for (const c of contexts.values()) if (c.device === device && (c.kind === "scene" || c.kind === "dial")) { paint(c); if (c.kind === "dial") animate(c); }
    if (tell && G.follow) {
      const sc = data.SCENES[index];
      tablet.send({ t: "scene", scene: sc.id, ...(sc.tablet || {}) });
    }
  }

  // tell: false for a switch that follows a tablet, which mustn't page the tablets back.
  function goToScene(device, index, { tell = true } = {}) {
    const n = data.SCENES.length;
    if (!n) return false;
    const i = ((index % n) + n) % n;
    // A scene picked here is newer than a tablet's panel still waiting to be followed.
    const waiting = tell && sceneSteps.get(device);
    if (waiting) waiting.to = -1;
    const profile = profileFor(device);
    if (profile) {
      sd.send({ event: "switchToProfile", context: sd.pluginUUID, device, payload: { profile, page: i } });
      switchedAt.set(device, now());
    }
    if (!profile && !G.follow) return false;
    setScene(device, i, { tell });
    return true;
  }

  // ---------- global settings ----------

  function saveGlobals(patch) {
    G = { ...G, ...patch };
    sd.send({ event: "setGlobalSettings", context: sd.pluginUUID, payload: { ...G } });
    applyGlobals();
  }
  let applied = { ...DEFAULTS };
  function applyGlobals() {
    const before = applied;
    applied = { ...G };
    if (before.theme !== G.theme || before.motion !== G.motion) for (const c of contexts.values()) paint(c);
    tablet.configure({ port: G.port, code: G.code });
  }

  function setTheme(id) {
    if (!THEMES.some((x) => x.id === id)) return;
    saveGlobals({ theme: id });
  }
  const nextTheme = (step = 1) => {
    const i = THEMES.findIndex((x) => x.id === G.theme);
    setTheme(THEMES[(((i < 0 ? 0 : i) + step) % THEMES.length + THEMES.length) % THEMES.length].id);
  };

  // Stream Deck's alert (a warning sign over the key or strip), at most one per ALERT_MS on
  // each, so a dial spun while offline doesn't send one for every tick.
  const ALERT_MS = 500;
  function alert(ctx) {
    const at = now();
    if (ctx.alertAt && at - ctx.alertAt < ALERT_MS) return;
    ctx.alertAt = at;
    sd.send({ event: "showAlert", context: ctx.context });
  }

  // ---------- the press line ----------

  // Every tap the plugin sends (a key press, a dial detent, a push or a touch) waits its
  // turn and goes once the last one's keys are surely up. SpoolUp holds a tap's keys for
  // its tap time (a timed button's for its ms) and presses a combo's keys 15 ms apart, and
  // presses that overlap reach the game as one (a turn back on Weapons: F5, then LAlt+F5)
  // or under another's modifier (Weapons + while Shields − holds LAlt reads as Weapons −),
  // which two hands on a + XL's keys and six dials would do all the time. Key presses go
  // first, at most KEYS_WAITING of them; then the dial that pressed longest ago, one press
  // at a time, so a timed dial can't keep the others waiting. A press that
  // would go more than STALE_MS late is dropped (with an alert) rather than pressed when
  // the player no longer expects it. Holds don't wait: they go down when pressed and stay
  // down as long as the player wants.
  const KEYS_WAITING = 4;
  const STALE_MS = 2000; // the longest timed button (Autoland, 1.5 s) and its gap still fit
  let freeAt = 0, lineTimer = null;
  const keyTaps = []; // { def, ctx, at }: deck buttons pressed on keys, waiting
  const waiting = new Set(); // dial contexts with presses queued (ctx.queue: { def, dir, ctx, at })
  const keyCount = (def) => String((def && def.keys) || "").split("+").length;
  // SpoolUp's own rule for how long a tap holds: the button's ms, else its tap time.
  const gapFor = (def) => Math.max(120, (Number(def.ms) || tablet.tapMs || 60) + 30 * (keyCount(def) - 1) + 60);
  // A key's press: sent at once when nothing is pressing, else first in line.
  function tapKey(ctx, def) {
    if (!online() || keyTaps.length >= KEYS_WAITING) return false;
    keyTaps.push({ def, ctx, at: Date.now() });
    runLine();
    return true;
  }
  // A dial's n presses of one button; dir 1 or -1 for a turn, 0 for a push or touch.
  function line(ctx, def, dir, n) {
    if (!ctx.queue) ctx.queue = [];
    for (let i = 0; i < n; i++) ctx.queue.push({ def, dir, ctx, at: Date.now() });
    waiting.add(ctx);
    runLine();
  }
  function clearLine() {
    keyTaps.length = 0;
    for (const c of waiting) c.queue = null;
    waiting.clear();
    clearTimeout(lineTimer);
    lineTimer = null;
  }
  function runLine() {
    clearTimeout(lineTimer);
    lineTimer = null;
    for (;;) {
      let dial = null;
      for (const c of waiting) {
        if (!c.queue || !c.queue.length) { waiting.delete(c); continue; }
        if (!dial || (c.pressedAt || 0) < (dial.pressedAt || 0)) dial = c;
      }
      if (!keyTaps.length && !dial) return;
      const wait = freeAt - Date.now();
      if (wait > 0) { lineTimer = setTimeout(runLine, wait); return; }
      let p;
      if (keyTaps.length) p = keyTaps.shift();
      else {
        p = dial.queue.shift();
        dial.pressedAt = Date.now();
        if (!dial.queue.length) { dial.queue = null; waiting.delete(dial); }
      }
      if (Date.now() - p.at > STALE_MS) { if (contexts.has(p.ctx.context)) alert(p.ctx); continue; }
      // Not connected: nothing waits to be pressed later.
      if (!tablet.send({ t: "tap", id: p.def.id })) { clearLine(); return; }
      freeAt = Date.now() + gapFor(p.def);
    }
  }

  // ---------- holds ----------

  // A hold button goes down once however many keys hold it, and up when the last lets go.
  function hold(ctx, id) {
    if (ctx.holding) unhold(ctx); // a second keyDown without a keyUp: let go of the first
    let set = holds.get(id);
    if (!set) {
      if (!tablet.send({ t: "down", id })) return false;
      holds.set(id, set = new Set());
    }
    set.add(ctx);
    ctx.holding = id;
    return true;
  }
  function unhold(ctx) {
    const id = ctx.holding;
    if (!id) return;
    ctx.holding = null;
    const set = holds.get(id);
    if (!set) return;
    set.delete(ctx);
    if (!set.size) {
      holds.delete(id);
      // The next tap waits for its keys to come up too (after its press, 15 ms apart).
      if (tablet.send({ t: "up", id })) freeAt = Math.max(freeAt, Date.now() + 30 * keyCount(data.byId.get(id)) + 30);
    }
  }
  function talk(ctx, on) {
    if (on) {
      if (!talkers.size && !tablet.send({ t: "voice", on: true })) return false;
      talkers.add(ctx);
      ctx.talking = true;
      return true;
    }
    if (!ctx.talking) return false;
    ctx.talking = false;
    talkers.delete(ctx);
    if (!talkers.size) tablet.send({ t: "voice", on: false });
    return true;
  }
  // Lets go of everything a context holds and stops what it would still send.
  function release(ctx) {
    unhold(ctx);
    talk(ctx, false);
    ctx.queue = null;
    ctx.pressed = false;
  }
  function releaseWhere(test) {
    for (const c of contexts.values()) if (test(c)) { release(c); endHoldAnim(c); paint(c); }
  }

  // The SpoolUp link dropped: the server let go of everything already.
  tablet.on("drop", () => {
    holds.clear();
    clearLine();
    talkers.clear();
    listening = false;
    for (const c of contexts.values()) {
      c.holding = null;
      c.talking = false;
      c.queue = null;
      endHoldAnim(c);
      c.pressed = false;
    }
  });

  // ---------- drawing ----------

  const deckDef = (ctx) => {
    const def = data.byId.get(ctx.settings.action);
    return def && def.kind === "deck" ? def : null;
  };
  const catalog = (id, fallback) => data.byId.get(id) || fallback;

  // A deck button's look now: lit from the shared state, its animation frame, status word.
  function deckLook(ctx, def) {
    const s = def.state;
    const at = now();
    const kind = animFor(def);
    const groupOn = s && typeof s.group === "string" ? Boolean(states[s.group]) : Boolean(toggles.get(def.id));
    const stateful = Boolean(s) || STATE_ANIMS.has(kind);
    let lit = stateful && groupOn && !(s && s.set === false);
    let status = "";
    if (stateful) {
      if (kind === "gear") status = groupOn ? "DEPLOYED" : "RETRACTED";
      else if (kind === "ripple") status = groupOn ? "ONLINE" : "OFF";
      else if (kind === "glow") status = groupOn ? "ON" : "OFF";
      else if (kind === "doors") status = s && s.set === false ? "" : groupOn ? "OPEN" : s && s.set === true ? "" : "CLOSED";
      else if (s) status = s.set === false ? "" : groupOn ? s.on || "ON" : s.set === true ? "" : "OFF";
    }
    if (kind === "charge" && def.mode === "hold") status = "HOLD TO ENGAGE";
    if (kind === "hazard" && def.mode === "hold") status = "HOLD TO ARM";
    let anim = null;
    const a = ctx.anim;
    if (a) {
      const p = Math.max(0, Math.min(1, (at - a.start) / a.ms));
      const tt = a.loop ? ((at - a.start) % a.ms) / a.ms : a.dir < 0 ? 1 - p : p;
      anim = { kind: a.kind, t: tt };
      if (a.kind === "charge") { status = p < 1 ? "SPOOLING…" : "ENGAGED"; lit = p >= 1; }
      if (a.kind === "hazard") { status = p < 1 ? "ARMING…" : "ARMED"; lit = p >= 1; }
      if (a.kind === "lock") status = "ACQUIRING…";
      if (a.word) status = p < 1 ? a.word : status;
    }
    const after = ctx.after;
    if (after && after.until > at) { status = after.word; lit = after.lit; if (after.kind) anim = { kind: after.kind, t: 1 }; }
    const blocked = Boolean(ctx.blockedUntil && ctx.blockedUntil > at);
    if (blocked) { anim = null; lit = false; }
    return { lit, status, anim: G.motion === false ? null : anim, pressed: ctx.pressed, blocked, offline: !online() };
  }

  function image(ctx) {
    const th = draw.theme(G.theme);
    if (!th) return null;
    const off = !online();
    switch (ctx.kind) {
      case "key": {
        const def = deckDef(ctx);
        return def ? draw.deck(th, def, deckLook(ctx, def)) : draw.unset(th, "Choose an action");
      }
      case "scene": {
        const i = sceneIndex(ctx.settings.scene);
        if (i < 0) return draw.unset(th, "Choose a scene");
        const lit = sceneOn.get(ctx.device) === i;
        return draw.scene(th, data.SCENES[i], { lit, pressed: ctx.pressed, status: lit ? "ACTIVE" : "" });
      }
      case "theme": {
        const id = ctx.settings.theme;
        return THEMES.some((x) => x.id === id) ? draw.themeKey(id, id === G.theme) : draw.unset(th, "Choose a theme");
      }
      case "talk": {
        const def = catalog("td-talk", { label: "Hold to Talk", icon: "mic", color: "red" });
        const flash = ctx.after && ctx.after.until > now() ? ctx.after : null;
        const lit = !off && (ctx.talking || listening);
        const status = flash ? flash.word : lit ? "LISTENING" : voice.state !== "ready" && !off ? "VOICE OFF" : "";
        return draw.deck(th, def, { lit, pressed: ctx.pressed, blocked: Boolean(flash && flash.bad), offline: off, status });
      }
      case "status": {
        const def = catalog("td-status", { label: "SpoolUp", icon: "sliders" });
        const link = tablet.link;
        const detail = ctx.after && ctx.after.until > now() ? ctx.after.word : "";
        const ok = link.state === "connected";
        const words = { connecting: "CONNECTING…", offline: "OFFLINE", unpaired: "NOT PAIRED", "wrong-code": "WRONG CODE", locked: "LOCKED OUT" };
        const status = detail || (ok ? (link.rtt ? t("{0} MS", link.rtt) : "ONLINE") : words[link.state] || "OFFLINE");
        const color = ok ? (link.rtt > SLOW_MS ? "amber" : "green") : link.state === "connecting" ? "" : "red";
        return draw.deck(th, { ...def, color }, { lit: ok, pressed: ctx.pressed, offline: !ok && link.state !== "connecting", status });
      }
      case "lights": {
        const def = catalog("td-lights-reset", { label: "Reset Lights", icon: "power-reset" });
        const a = ctx.anim;
        const anim = a && G.motion !== false ? { kind: "flash", t: Math.min(1, (now() - a.start) / a.ms) } : null;
        return draw.deck(th, def, { pressed: ctx.pressed, offline: off, anim });
      }
      default: return null;
    }
  }

  function paint(ctx) {
    if (!contexts.has(ctx.context)) return;
    if (ctx.kind === "dial") { paintDial(ctx); return; }
    const svg = image(ctx);
    if (svg) sd.image(ctx.context, svgUrl(svg));
  }

  // ---------- dials ----------

  // A dial's settings: { dial: { label, icon, color, ccw, cw, press } }, or a preset name
  // from DIAL in streamdeck/scenes.js.
  function dialOf(ctx) {
    const s = ctx.settings;
    let d = s.dial;
    if ((!d || typeof d !== "object") && s.preset && data.DIAL[s.preset]) d = data.DIAL[s.preset];
    return d && typeof d === "object" ? d : null;
  }
  // A dial ref: a deck button, or the pack's own scene and theme steps.
  function resolve(ref) {
    if (!ref || typeof ref !== "string") return null;
    if (ref === "@next") return { kind: "scene-step", step: 1 };
    if (ref === "@prev") return { kind: "scene-step", step: -1 };
    if (ref.startsWith("@scene:")) return { kind: "scene", index: sceneIndex(ref.slice(7)) };
    if (ref === "@folder:themes") return { kind: "theme-next" }; // a plugin can't open a folder
    if (ref.startsWith("@theme:")) return { kind: "theme", id: ref.slice(7) };
    const def = data.byId.get(ref);
    return def && def.kind === "deck" ? { kind: "deck", def } : { kind: "unsupported" };
  }
  const LINKS = new Set(["au", "aux", "à", "de", "du", "des", "la", "le", "les", "el", "al", "del", "zum", "zur", "the", "to", "of"]);
  const isSceneDial = (d) => d && [d.ccw, d.cw].some((r) => r === "@next" || r === "@prev");

  // The short word for what a turn or push did: the button's label without the dial's own
  // words ("Weapons +" on the Weapons dial is "+", "Max Weapons" is "MAX"), without the
  // words its two turns share ("Tempobereich −" and "Tempobereich +" are "−" and "+"), and
  // for a push, without the words it shares with a turn ("Vorheriger Angreifer" next to
  // "Vorheriger Feind" is "ANGREIFER"). The strip's value line is only 118 px wide, and a
  // long German or French label would lose its end there, the + or − included.
  function wordFor(ctx, ref) {
    const r = resolve(ref);
    if (!r) return "";
    if (r.kind === "scene-step" || r.kind === "scene") {
      const i = sceneOn.has(ctx.device) && r.kind === "scene-step" ? sceneOn.get(ctx.device) : r.index;
      const sc = data.SCENES[i];
      return sc ? t(sc.short || sc.name) : "";
    }
    if (r.kind === "theme-next") return t("Next theme");
    if (r.kind === "theme") return (THEMES.find((x) => x.id === r.id) || {}).name || "";
    if (r.kind !== "deck") return "";
    const dial = dialOf(ctx);
    const split = (text) => String(text || "").split(/\s+/).filter(Boolean);
    const lower = (id) => { const x = resolve(id); return x && x.kind === "deck" ? split(t(x.def.label).toLowerCase()) : []; };
    // Leaves out the dropped words, unless nothing would be left.
    const without = (words, drop) => { const left = words.filter((w) => !drop.includes(w.toLowerCase())); return left.length ? left : words; };
    let words = without(split(t(r.def.label)), split(t(dial && dial.label).toLowerCase()));
    if (dial) {
      const ccw = lower(dial.ccw), cw = lower(dial.cw);
      words = without(words, ref === dial.ccw || ref === dial.cw ? ccw.filter((w) => cw.includes(w)) : [...ccw, ...cw]);
    }
    // A word left dangling at the end ("Tirer au laser" on the Laser dial) goes too.
    while (words.length > 1 && LINKS.has(words[words.length - 1].toLowerCase())) words = words.slice(0, -1);
    return words.join(" ");
  }

  function paintDial(ctx) {
    const th = draw.theme(G.theme);
    const d = dialOf(ctx);
    if (!th) return;
    const at = now();
    const dev = devices.get(ctx.device);
    const model = modelOf(ctx.device);
    const place = { column: ctx.column || 0, count: model && model.dials ? model.dials : dev && dev.type === 13 ? 6 : dev && dev.type === 7 ? 4 : 1 };
    const off = !online();
    const upper = (s) => (th.font.upper ? String(s).toUpperCase() : String(s));
    let label = "", icon = "default", color = "", value = "", hint = "", valueColor = th.dim;
    const flashP = Math.max(fade(ctx.flashAt, at), isSceneDial(d) ? fade(sceneAt.get(ctx.device), at) : 0);
    const blocked = Boolean(ctx.blockedUntil && ctx.blockedUntil > at);
    const usable = d && ["ccw", "cw", "press"].some((r) => { const x = resolve(d[r]); return x && x.kind !== "unsupported"; });
    if (!d || !usable) {
      label = t(d && d.label ? d.label : "Deck Dial");
      icon = d && d.icon ? d.icon : "default";
      value = t("Not set");
    } else if (isSceneDial(d)) {
      // The scene dial shows where it is: the current scene's icon, colour and name.
      const i = sceneOn.get(ctx.device);
      const sc = i === undefined ? null : data.SCENES[i];
      label = t(d.label || "Scenes");
      icon = sc ? sc.icon : d.icon || "grid";
      color = sc ? sc.color || "" : d.color || "";
      value = sc ? t(sc.short || sc.name) : "‹ ›";
      valueColor = sc ? th.colors[color] || th.accent : th.dim;
      if (!profileFor(ctx.device)) { value = t("NO PROFILE"); valueColor = th.dim; }
      const pw = wordFor(ctx, d.press);
      hint = pw ? `${t("PUSH")} · ${pw}` : "";
    } else {
      label = t(d.label || "");
      icon = d.icon || "default";
      color = d.color || "";
      const last = ctx.last;
      value = last ? last.word + (last.n > 1 ? ` ×${last.n}` : "") : "‹ ›";
      valueColor = last ? (flashP > 0 ? th.colors[color] || th.accent : th.text) : th.dim;
      const pw = wordFor(ctx, d.press);
      hint = pw ? `${t("PUSH")} · ${pw}` : "";
    }
    if (blocked) { value = t("NOT FOCUSED"); valueColor = th.colors.red; }
    else if (off && usable && !isSceneDial(d)) { value = t("OFFLINE"); valueColor = th.dim; }
    // The value line is 118 px wide: long words get a smaller size rather than an ellipsis.
    const size = value.length <= 8 ? 22 : value.length <= 11 ? 17 : value.length <= 14 ? 13 : value.length <= 17 ? 12 : 10;
    const bg = draw.strip(th, { color, place, flash: G.motion === false ? 0 : flashP, blocked, offline: off && !(d && isSceneDial(d)) });
    sd.feedback(ctx.context, {
      bg: svgBase64(bg),
      icon: svgBase64(draw.stripIcon(th, icon, color, { offline: off && !(d && isSceneDial(d)), strength: flashP > 0 ? 1.8 : 1 })),
      label: { value: upper(label), color: th.text },
      value: { value: upper(value), color: valueColor, font: { size, weight: 700 } },
      hint: { value: upper(hint), color: th.dim },
    });
  }
  const FLASH_MS = 600;
  const fade = (since, at) => (since ? Math.max(0, 1 - (at - since) / FLASH_MS) : 0);

  // Shown in the Stream Deck app next to the dial: what turning and pushing do.
  function describeDial(ctx) {
    const d = dialOf(ctx);
    if (!d) return;
    const name = (ref) => { const r = resolve(ref); return r && r.kind === "deck" ? t(r.def.label) : wordFor(ctx, ref); };
    const rotate = isSceneDial(d) ? t(d.label || "Scenes") : [name(d.ccw), name(d.cw)].filter(Boolean).join(" / ");
    const push = name(d.press);
    const payload = {};
    if (rotate) payload.rotate = rotate;
    if (push) Object.assign(payload, { push, touch: push });
    // An empty payload may reset to the manifest's or hide every line (Elgato's docs and
    // SDK disagree), so it's never sent.
    if (Object.keys(payload).length) sd.send({ event: "setTriggerDescription", context: ctx.context, payload });
  }

  // A device switches scene at most once per SCENE_MS, the newest wish winning: a spun scene
  // dial adds up its steps in between, and of a tablet's panels the last one counts. Each
  // switch makes Stream Deck rebuild the page (36 keys and 6 strips on a + XL), and every
  // key on it gets a new picture.
  const SCENE_MS = 250;
  const sceneSteps = new Map(); // device -> { n, ctx, to, timer, at }; to: a tablet's scene, or -1
  function queueScene(device, { ctx = null, n = 0, to = -1 }) {
    let s = sceneSteps.get(device);
    if (!s) sceneSteps.set(device, (s = { n: 0, ctx: null, to: -1, timer: null, at: 0 }));
    if (ctx) { s.n += n; s.ctx = ctx; s.to = -1; } else { s.to = to; s.n = 0; }
    if (s.timer) return;
    const go = () => {
      s.timer = null;
      const { n: steps, ctx: c, to: want } = s;
      s.n = 0;
      s.to = -1;
      if (!steps && want < 0) return;
      s.at = now();
      if (want >= 0) followTo(device, want);
      else {
        const cur = sceneOn.has(device) ? sceneOn.get(device) : 0;
        if (!goToScene(device, cur + steps) && contexts.has(c.context)) alert(c);
        if (contexts.has(c.context)) paint(c);
      }
      s.timer = setTimeout(go, SCENE_MS);
    };
    const wait = s.at + SCENE_MS - now();
    if (wait > 0) s.timer = setTimeout(go, wait); else go();
  }
  function stepScene(ctx, n) { queueScene(ctx.device, { ctx, n }); }

  // ---------- following the tablet ----------

  // A player paged one half of a tablet's HUD ({ t: "panel", side, panel }): each Stream
  // Deck on a scene page of the SpoolUp profile goes to the scene with that panel on
  // that side (SCENES[].tablet), without telling the tablets, which would page back. It
  // stays when its scene has that panel already, or when no scene or several do (Mining and
  // Salvage share Operator Modes), while a key or dial on it is held, and it's never taken
  // out of a folder or a profile of the player's own. A panel matches as when a tablet
  // follows a scene: phone layouts split some ("landing" and "power" for "power-landing",
  // "systems" for "qt-systems").
  const FOLLOW_MS = 1000; // how long a switched page's keys may take to appear
  const panelFits = (panel, id) => panel === id || id.split("-").includes(panel) || panel.startsWith(id);
  function followPanel(side, panel) {
    if (G.followTablet === false || (side !== "left" && side !== "right") || typeof panel !== "string" || !panel) return;
    const fits = [];
    data.SCENES.forEach((sc, i) => { const id = sc.tablet && sc.tablet[side]; if (typeof id === "string" && id && panelFits(panel, id)) fits.push(i); });
    if (fits.length !== 1) return;
    for (const device of devices.keys()) {
      // A switch still waiting there (the scene dial's steps, an earlier panel) gives way to
      // this newer one, even one for the scene it shows.
      const s = sceneSteps.get(device);
      const waits = Boolean(s && (s.n || s.to >= 0));
      if ((waits || sceneOn.get(device) !== fits[0]) && profileFor(device) && onScenePage(device) && !inUse(device)) queueScene(device, { to: fits[0] });
    }
  }

  // A key or dial on the device is down, or a dial's turns are still going out: a new page
  // would take them away mid-press (willDisappear lets go of a hold, push to talk included,
  // and drops the turns still waiting), so a tablet's panel doesn't switch it.
  function inUse(device) {
    for (const c of contexts.values()) if (c.device === device && (c.pressed || c.holding || c.talking || (c.queue && c.queue.length))) return true;
    return false;
  }

  // Whether a device shows a scene page of the SpoolUp profile: the plugin's keys there
  // carry the scene as `page`, a folder's and other profiles' don't. Just after the plugin
  // switched it, the new page's keys may not have appeared yet.
  function onScenePage(device) {
    let others = false;
    for (const c of contexts.values()) {
      if (c.device !== device) continue;
      if (sceneIndex(c.settings.page) >= 0) return true;
      others = true;
    }
    return !others && now() - (switchedAt.get(device) || 0) < FOLLOW_MS;
  }

  // A tablet's scene once its turn comes, checked again: the player may have moved on.
  function followTo(device, i) {
    if (G.followTablet === false || sceneOn.get(device) === i || !onScenePage(device) || inUse(device)) return;
    quietUntil.set(device, now() + FOLLOW_MS);
    goToScene(device, i, { tell: false });
  }

  function rotate(ctx, ticks) {
    const d = dialOf(ctx);
    const n = Math.min(MAX_DETENTS, Math.abs(Math.trunc(ticks) || 0));
    if (!d || !n) return;
    const dir = ticks > 0 ? 1 : -1;
    const ref = dir > 0 ? d.cw : d.ccw;
    const r = resolve(ref);
    if (!r) return;
    if (r.kind === "scene-step") { stepScene(ctx, r.step * n); return; }
    if (r.kind === "theme-next") { nextTheme(dir); return; }
    if (r.kind === "theme") { setTheme(r.id); return; }
    if (r.kind === "scene") { if (!goToScene(ctx.device, r.index)) alert(ctx); return; }
    if (r.kind !== "deck" || !online()) { alert(ctx); paint(ctx); return; }
    // A turn the other way drops what's still waiting from the last one; at most 5 wait.
    if (ctx.queue) ctx.queue = ctx.queue.filter((p) => p.dir !== -dir);
    const queued = ctx.queue ? ctx.queue.filter((p) => p.dir).length : 0;
    line(ctx, r.def, dir, Math.max(0, Math.min(n, MAX_DETENTS - queued)));
    ctx.last = { word: wordFor(ctx, ref), n };
    ctx.flashAt = now();
    paint(ctx);
    animate(ctx);
  }

  // A push (dialDown) or a touch on the strip: the dial's press action. A touch is always a
  // tap; a push holds hold buttons until dialUp.
  function push(ctx, { touch = false } = {}) {
    const d = dialOf(ctx);
    if (!d || !d.press) return;
    const r = resolve(d.press);
    if (!r) return;
    if (r.kind === "theme-next") { nextTheme(1); return; }
    if (r.kind === "theme") { setTheme(r.id); return; }
    if (r.kind === "scene") { if (!goToScene(ctx.device, r.index)) alert(ctx); return; }
    if (r.kind === "scene-step") { const cur = sceneOn.get(ctx.device) || 0; goToScene(ctx.device, cur + r.step); return; }
    if (r.kind !== "deck" || !online()) { alert(ctx); paint(ctx); return; }
    if (!touch && r.def.mode === "hold") { if (!hold(ctx, r.def.id)) { alert(ctx); return; } }
    else if (ctx.queue && ctx.queue.filter((p) => !p.dir).length >= MAX_DETENTS) { alert(ctx); return; } // pushed faster than they go
    else line(ctx, r.def, 0, 1);
    ctx.last = { word: wordFor(ctx, d.press), n: 1 };
    ctx.flashAt = now();
    paint(ctx);
    animate(ctx);
  }

  // ---------- animation ----------

  // One timer runs every animating key and strip at FRAME_MS, and stops when none is left.
  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      const at = now();
      for (const c of [...animating]) {
        if (!contexts.has(c.context)) { animating.delete(c); continue; }
        const a = c.anim;
        if (a && !a.loop && !a.holdAtEnd && at - a.start >= a.ms) {
          c.anim = null;
          if (a.then) a.then(c);
        }
        paint(c);
        if (!busy(c, at)) animating.delete(c);
      }
      if (!animating.size) { clearInterval(ticker); ticker = null; }
    }, FRAME_MS);
  }
  function animate(ctx) { animating.add(ctx); startTicker(); }
  // Still changing: a running effect (a charge or arming bar until it's full), a lingering
  // word, a red flash, or a strip fading after a turn.
  function busy(c, at) {
    const a = c.anim;
    if (a && (a.loop || at - a.start < a.ms + FRAME_MS)) return true;
    if (c.after && c.after.until > at) return true;
    if (c.blockedUntil && c.blockedUntil > at) return true;
    return c.kind === "dial" && (fade(c.flashAt, at) > 0 || fade(sceneAt.get(c.device), at) > 0);
  }
  function play(ctx, anim) {
    ctx.anim = { start: now(), dir: 1, ...anim };
    animate(ctx);
    paint(ctx);
  }
  function linger(ctx, after) {
    ctx.after = { ...after, until: now() + after.ms };
    animate(ctx);
    paint(ctx);
  }
  // Charge, arming and held streaks stop with the press.
  function endHoldAnim(ctx) {
    const a = ctx.anim;
    if (!a || !(a.holdAtEnd || a.loop)) return;
    const full = now() - a.start >= a.ms;
    ctx.anim = null;
    if (a.kind === "charge" && full) linger(ctx, { word: "ENGAGED", lit: true, ms: 1500 });
  }

  // A press's effect on a deck key, as on the tablet. tap: a press nobody holds (voice),
  // so hold effects run once instead of until the key comes up.
  function pressAnim(ctx, def, { tap = false } = {}) {
    const kind = animFor(def);
    const held = def.mode === "hold" && !tap;
    if (kind === "charge") return play(ctx, { kind, ms: def.chargeMs || 1200, holdAtEnd: held });
    if (kind === "hazard") return play(ctx, { kind, ms: def.armMs || def.ms || 2000, holdAtEnd: held });
    if (kind === "timed") return play(ctx, { kind, ms: def.ms || 600 });
    if (kind === "streak") return play(ctx, held ? { kind, ms: ANIM_MS.streak, loop: true } : { kind, ms: ANIM_MS.streak });
    if (kind === "lock") return play(ctx, { kind, ms: ANIM_MS.lock, then: (c) => linger(c, { word: "LOCKED", lit: true, kind: "lock", ms: 1400 }) });
    // With a shared state, the server's answer plays the state's effect (see "state").
    if (STATE_ANIMS.has(kind) && def.state) {
      // Close Doors never stays lit but still shows its doors sliding shut.
      if (kind === "doors" && def.state.set === false) return play(ctx, { kind, ms: ANIM_MS.doors, dir: -1 });
      return paint(ctx);
    }
    if (STATE_ANIMS.has(kind)) {
      const on = !toggles.get(def.id);
      toggles.set(def.id, on);
      for (const c of contexts.values()) if (c !== ctx && c.kind === "key" && deckDef(c) && deckDef(c).id === def.id) paint(c);
      if (kind === "gear" || kind === "doors") return play(ctx, { kind, ms: ANIM_MS[kind], dir: on ? 1 : -1, word: transitional(kind, on) });
      return play(ctx, { kind, ms: ANIM_MS[kind] });
    }
    return play(ctx, { kind: ANIM_MS[kind] ? kind : "flash", ms: ANIM_MS[kind] || ANIM_MS.flash });
  }
  const transitional = (kind, on) => kind === "gear" ? (on ? "DEPLOYING…" : "RETRACTING…") : kind === "doors" ? (on ? "OPENING…" : "CLOSING…") : "";

  // ---------- SpoolUp's messages ----------

  const keysFor = (id) => [...contexts.values()].filter((c) => c.kind === "key" && deckDef(c) && (deckDef(c).id === id || (deckDef(c).aliases || []).includes(id)));
  const dialsFor = (id) => [...contexts.values()].filter((c) => c.kind === "dial" && dialOf(c) && ["ccw", "cw", "press"].some((r) => { const x = resolve(dialOf(c)[r]); return x && x.kind === "deck" && x.def.id === id; }));

  tablet.on("message", (msg) => {
    switch (msg.t) {
      case "hello":
        states = msg.states && typeof msg.states === "object" ? { ...msg.states } : {};
        voice = msg.voiceStatus || { state: msg.voice ? "ready" : "off" };
        repaintAll();
        break;
      case "states":
        states = msg.states && typeof msg.states === "object" ? { ...msg.states } : {};
        repaintAll();
        break;
      case "state": {
        const was = Boolean(states[msg.group]);
        states[msg.group] = Boolean(msg.on);
        if (!msg.on) delete states[msg.group];
        for (const c of contexts.values()) {
          if (c.kind !== "key") continue;
          const def = deckDef(c);
          if (!def || !def.state || def.state.group !== msg.group) continue;
          const kind = animFor(def);
          // The state changed live: play its effect (doors slide, gear struts, a ripple).
          // Buttons that only switch it off (Close Doors) play theirs on their own press.
          if (was !== Boolean(msg.on) && STATE_ANIMS.has(kind) && def.state.set !== false) {
            if (kind === "gear" || kind === "doors") play(c, { kind, ms: ANIM_MS[kind], dir: msg.on ? 1 : -1, word: def.state.set === undefined || kind === "gear" ? transitional(kind, msg.on) : "" });
            else if (msg.on) play(c, { kind, ms: ANIM_MS[kind] });
            else paint(c);
          } else paint(c);
        }
        break;
      }
      case "blocked": {
        // Star Citizen wasn't in front, so the press was skipped: stop the effect and flash red.
        const until = now() + BLOCKED_MS;
        for (const c of keysFor(msg.id)) {
          c.anim = null;
          c.after = null;
          c.blockedUntil = until;
          paint(c);
          animate(c);
        }
        for (const c of dialsFor(msg.id)) {
          c.queue = null; // don't keep turning into the wrong window
          c.blockedUntil = until;
          alert(c);
          paint(c);
          animate(c);
        }
        break;
      }
      case "listening":
        listening = Boolean(msg.on);
        for (const c of contexts.values()) if (c.kind === "talk") paint(c);
        break;
      case "voice-status":
        voice = { state: msg.state || "off" };
        for (const c of contexts.values()) if (c.kind === "talk") paint(c);
        break;
      case "voice-off":
        for (const c of contexts.values()) if (c.kind === "talk") linger(c, { word: "VOICE OFF", bad: true, ms: 1500 });
        break;
      case "heard":
        for (const c of contexts.values()) if (c.kind === "talk") linger(c, { word: "HEARD", ms: 1200 });
        // The heard button was pressed by voice: its keys play their press.
        for (const c of keysFor(msg.id)) { const def = deckDef(c); if (def && !STATE_ANIMS.has(animFor(def))) pressAnim(c, def, { tap: true }); }
        break;
      case "unheard":
        for (const c of contexts.values()) if (c.kind === "talk") linger(c, { word: "NOT HEARD", ms: 1200 });
        break;
      case "reload":
        tablet.reconnect(); // the layout was changed in the editor: get its buttons again
        break;
      case "panel":
        followPanel(msg.side, msg.panel); // a tablet's player paged a HUD half
        break;
      default:
        break;
    }
  });

  // A new link state redraws everything (offline marks); a new round trip only the Status keys.
  let linkState = null;
  tablet.on("link", (link) => {
    if (link.state !== linkState) { linkState = link.state; repaintAll(); }
    else for (const c of contexts.values()) if (c.kind === "status") paint(c);
    for (const context of piOpen) sd.send({ event: "sendToPropertyInspector", context, payload: { type: "link", link } });
  });

  function repaintAll() { for (const c of contexts.values()) paint(c); }

  // ---------- Stream Deck's events ----------

  function addDevice(id, info) {
    if (!id || !info) return;
    devices.set(id, { type: info.type, name: info.name, size: info.size });
    for (const c of contexts.values()) if (c.device === id) paint(c);
  }

  function track(msg) {
    const p = msg.payload || {};
    let ctx = contexts.get(msg.context);
    if (!ctx) {
      ctx = { context: msg.context, action: msg.action, kind: kindOf(msg.action), device: msg.device, settings: {}, pressed: false, holding: null, talking: false };
      contexts.set(msg.context, ctx);
    }
    ctx.device = msg.device || ctx.device;
    if (p.coordinates) { ctx.column = p.coordinates.column; ctx.row = p.coordinates.row; }
    if (p.settings) ctx.settings = p.settings;
    return ctx;
  }

  // Bundled profiles may name the scene page a key sits on ("page": "<scene id>"), so the
  // plugin knows the current scene even after Stream Deck's own page keys moved it. Just
  // after following a tablet it tells the tablets nothing: a page from an earlier switch
  // may still be appearing, and would page them back.
  function noticePage(ctx) {
    const i = sceneIndex(ctx.settings.page);
    if (i >= 0) setScene(ctx.device, i, { tell: !(quietUntil.get(ctx.device) > now()) });
  }

  function onEvent(msg) {
    const p = msg.payload || {};
    switch (msg.event) {
      case "deviceDidConnect":
      case "deviceDidChange":
        addDevice(msg.device, msg.deviceInfo);
        return;
      case "deviceDidDisconnect": {
        releaseWhere((c) => c.device === msg.device);
        const s = sceneSteps.get(msg.device);
        if (s) { clearTimeout(s.timer); sceneSteps.delete(msg.device); }
        return;
      }
      case "systemDidWakeUp":
        releaseWhere(() => true);
        clearLine(); // presses from before the PC slept aren't pressed now
        tablet.retryNow();
        return;
      case "didReceiveGlobalSettings": {
        const s = (p && p.settings) || {};
        G = { ...DEFAULTS, ...s };
        gotGlobals = true;
        applyGlobals();
        return;
      }
      case "propertyInspectorDidAppear": piOpen.add(msg.context); return;
      case "propertyInspectorDidDisappear": piOpen.delete(msg.context); return;
      case "sendToPlugin": onInspector(msg); return;
      default: break;
    }
    if (!kindOf(msg.action)) return;
    if (p.isInMultiAction) return; // not offered there (manifest), and never pressed from one
    switch (msg.event) {
      case "willAppear": {
        sd.forget(msg.context); // a fresh appearance shows the manifest image until redrawn
        const ctx = track(msg);
        noticePage(ctx);
        if (ctx.kind === "dial") describeDial(ctx);
        paint(ctx);
        return;
      }
      case "willDisappear": {
        const ctx = contexts.get(msg.context);
        if (ctx) { release(ctx); contexts.delete(msg.context); animating.delete(ctx); }
        piOpen.delete(msg.context);
        sd.forget(msg.context);
        return;
      }
      case "didReceiveSettings": {
        const ctx = contexts.get(msg.context);
        const before = ctx && JSON.stringify(ctx.settings);
        const c = track(msg);
        if (before !== JSON.stringify(c.settings)) {
          release(c); // a held button changed under the key: let it go
          c.anim = null; c.after = null; c.last = null;
          if (c.kind === "dial") describeDial(c);
        }
        noticePage(c);
        paint(c);
        return;
      }
      case "keyDown": return keyDown(track(msg));
      case "keyUp": return keyUp(track(msg));
      case "dialRotate": return rotate(track(msg), Number(p.ticks) || 0);
      case "dialDown": { const c = track(msg); c.pressed = true; push(c); return; }
      case "dialUp": { const c = track(msg); c.pressed = false; unhold(c); paint(c); return; }
      case "touchTap": return push(track(msg), { touch: true });
      default: return;
    }
  }

  function keyDown(ctx) {
    ctx.pressed = true;
    switch (ctx.kind) {
      case "key": {
        const def = deckDef(ctx);
        if (!def || !online()) { alert(ctx); break; }
        const ok = def.mode === "hold" ? hold(ctx, def.id) : tapKey(ctx, def);
        if (!ok) { alert(ctx); break; }
        ctx.blockedUntil = 0;
        ctx.after = null;
        pressAnim(ctx, def);
        return;
      }
      case "scene": {
        const i = sceneIndex(ctx.settings.scene);
        if (i < 0 || !goToScene(ctx.device, i)) alert(ctx);
        break;
      }
      case "theme":
        if (THEMES.some((x) => x.id === ctx.settings.theme)) setTheme(ctx.settings.theme); else alert(ctx);
        break;
      case "talk":
        if (!online() || !talk(ctx, true)) alert(ctx);
        break;
      case "lights":
        if (!online() || !tablet.send({ t: "reset-states" })) { alert(ctx); break; }
        toggles.clear();
        play(ctx, { kind: "flash", ms: ANIM_MS.flash });
        return;
      case "status": {
        const link = tablet.link;
        if (link.state !== "connected") tablet.retryNow();
        linger(ctx, { word: link.port ? t("PORT {0}", link.port) : "NOT PAIRED", ms: 2000 });
        return;
      }
      default: break;
    }
    paint(ctx);
  }

  function keyUp(ctx) {
    ctx.pressed = false;
    if (ctx.kind === "key") { unhold(ctx); endHoldAnim(ctx); }
    if (ctx.kind === "talk") talk(ctx, false);
    paint(ctx);
  }

  // ---------- property inspector ----------

  function onInspector(msg) {
    const p = msg.payload || {};
    const reply = (payload) => sd.send({ event: "sendToPropertyInspector", context: msg.context, payload });
    if (p.type === "init") {
      const deckActions = data.actions.filter((a) => a.kind === "deck");
      const used = new Set(deckActions.map((a) => a.category));
      reply({
        type: "init",
        lang: data.lang,
        strings: data.strings,
        link: { ...tablet.link },
        categories: data.categories.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: t(c.name) })),
        actions: deckActions.map((a) => ({ id: a.id, label: t(a.label), category: a.category, mode: a.mode, color: a.color || "", iconName: a.icon, icon: data.icons[a.icon] || data.icons.default || "" })),
        scenes: data.SCENES.map((s) => ({ id: s.id, name: t(s.name), icon: data.icons[s.icon] || "" })),
        themes: THEMES.map((x) => ({ id: x.id, name: x.name, accent: (data.themeTokens[x.id] || {}).accent || "" })),
        // Presets whose every part the plugin can press (media and Discord dials are
        // Stream Deck's and Elgato's own actions).
        dials: Object.entries(data.DIAL)
          .filter(([, d]) => d && typeof d === "object" && ["ccw", "cw", "press"].every((r) => !d[r] || ["deck", "scene-step", "theme-next", "scene", "theme"].includes((resolve(d[r]) || {}).kind)))
          .map(([id, d]) => ({ id, ...d, name: t(d.label) })),
      });
    } else if (p.type === "test") {
      tablet.test({ port: p.port, code: p.code }).then((result) => reply({ type: "test", result }));
    } else if (p.type === "retry") {
      tablet.retryNow();
    }
  }

  // Before the global settings arrive (theme, pairing code), keys draw in the default
  // theme; connect anyway if Stream Deck never answers.
  setTimeout(() => { if (!gotGlobals) applyGlobals(); }, 1500);

  // The Stream Deck socket closed (Stream Deck quit or restarts the plugin): let go of
  // everything still held before the plugin exits.
  function releaseAll() { for (const c of contexts.values()) release(c); }

  return { onEvent, addDevice, releaseAll, contexts };
}

module.exports = { createActions, kindOf, animFor, FRAME_MS };
