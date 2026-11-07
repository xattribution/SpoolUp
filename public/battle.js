// Battle alerts (SpoolUp 2.2): what the PC reads from Star Citizen's Game.log (gamelog.js),
// shown quietly. A thin strip at the top says when your ship is under fire, disabled or
// destroyed, when you die and when you get a kill; the "Last hits" readout, a widget you
// can place like a cluster, lists who hit you last, your ship and its state, and your kills.
//
// Nothing here presses anything: it only shows what the server sends ({ t: "battle" }).
// Deck settings has a switch for it, on unless turned off on this device ("battle").
//
// Registering touches no page, so tools/check-grid.js can load this under Node.
(function () {
  "use strict";
  const W = (typeof window !== "undefined" && window.DeckWidgets) || null;
  const hasPage = typeof document !== "undefined";
  const tr = (s, ...a) => (typeof window !== "undefined" && window.DeckI18n ? window.DeckI18n.t(s, ...a) : s);
  const KEY = "battle";
  const STRIP_MS = 4500; // how long a one-off alert (disabled, destroyed, died, kill) stays

  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* not kept */ } },
  };
  const on = () => store.get() !== "off";

  let state = null;   // the last state from the PC
  let skew = 0;       // this device's clock minus the PC's
  const readouts = new Set();

  // ---------- the strip ----------

  let strip = null, stripTimer = null;
  function stripEl() {
    if (!strip && hasPage && document.body) {
      strip = document.createElement("div");
      strip.id = "battleStrip";
      strip.setAttribute("role", "status");
      strip.setAttribute("aria-live", "polite");
      strip.innerHTML = `<i aria-hidden="true"></i><span></span>`;
      document.body.appendChild(strip);
    }
    return strip;
  }
  function show(kind, text, ms) {
    const el = stripEl();
    if (!el) return;
    clearTimeout(stripTimer);
    el.dataset.kind = kind;
    el.querySelector("span").textContent = text;
    el.classList.add("show");
    if (ms) stripTimer = setTimeout(hide, ms);
  }
  function hide() {
    clearTimeout(stripTimer);
    if (strip) strip.classList.remove("show");
  }

  // What the strip says for each event; "hit" and "clear" follow the fight.
  function alert(event, st) {
    if (!on()) { hide(); return; }
    if (event === "hit" || (event === "sync" && st.fire)) {
      show("fire", st.from ? `${tr("Under fire")} · ${tr(st.from)}${st.hits > 1 ? ` ×${st.hits}` : ""}` : tr("Under fire"));
    } else if (event === "clear" || event === "reset") {
      if (strip && strip.dataset.kind === "fire") hide();
    } else if (event === "ship-1") show("disabled", tr("Ship disabled"), STRIP_MS);
    else if (event === "ship-2") show("destroyed", tr("Ship destroyed"), STRIP_MS);
    else if (event === "dead") show("dead", st.by ? `${tr("You died")} · ${tr(st.by)}` : tr("You died"), STRIP_MS);
    else if (event === "kill") show("kill", `${tr("Kill")} · ${tr(st.killed)}${st.kills > 1 ? ` (${st.kills})` : ""}`, STRIP_MS);
  }

  // ---------- the Last hits readout ----------

  const ago = (at) => {
    const s = Math.max(0, Math.round((Date.now() - skew - at) / 1000));
    return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
  };
  const LEVEL = ["OK", "DISABLED", "DESTROYED"];

  function fill(r) {
    const { root, list, ship, stat, kills, rows } = r;
    const st = state;
    root.classList.toggle("off", !on());
    root.classList.toggle("fire", Boolean(on() && st && st.fire));
    root.dataset.level = String(st && on() ? (st.dead ? 2 : st.level) : 0);
    ship.textContent = st && st.ship ? st.ship : tr("No ship");
    // One row high: the latest hit takes the ship's place for a minute.
    const last = st && on() && st.recent[0];
    if (r.compact && last && Date.now() - skew - last.at < 60000) {
      ship.textContent = `${tr(last.from)}${last.n > 1 ? ` ×${last.n}` : ""} · ${ago(last.at)}`;
    }
    ship.classList.toggle("hit", Boolean(r.compact && st && st.fire && on()));
    stat.textContent = st && st.dead ? tr("DEAD") : tr(LEVEL[st ? st.level : 0] || "OK");
    stat.hidden = !st || (!st.ship && !st.dead);
    kills.textContent = tr("Kills: {0}", st ? st.kills : 0);
    list.innerHTML = "";
    const note = (text) => { const p = document.createElement("li"); p.className = "bt-note"; p.textContent = text; list.appendChild(p); };
    if (!on()) { note(tr("Battle alerts are off in Deck settings.")); return; }
    if (!st) { note(tr("Waiting for the PC")); return; }
    if (!st.reading) { note(tr("Waiting for Star Citizen's Game.log")); return; }
    if (!st.recent.length) { note(tr("No hits yet")); return; }
    st.recent.slice(0, rows).forEach((h, i) => {
      const li = document.createElement("li");
      if (i === 0 && st.fire) li.className = "now";
      const who = document.createElement("span"); who.className = "bt-who"; who.textContent = tr(h.from);
      const n = document.createElement("b"); n.textContent = h.n > 1 ? `×${h.n}` : "";
      const t = document.createElement("time"); t.textContent = ago(h.at);
      li.append(who, n, t);
      list.appendChild(li);
    });
  }

  // Keeps "12s" ticking while a readout is on screen.
  let ticker = null;
  function refresh() {
    for (const r of readouts) if (!r.root.isConnected) readouts.delete(r);
    for (const r of readouts) fill(r);
    if (!readouts.size && ticker) { clearInterval(ticker); ticker = null; }
  }
  function watch(r) {
    readouts.add(r);
    if (!ticker) ticker = setInterval(refresh, 5000);
  }

  if (W) {
    W.register("lasthits", {
      label: "Last hits",
      category: "combat",
      icon: "target",
      spans: { small: [6, 1], large: [6, 2] },
      min: [3, 1], max: [12, 4],
      drag: "",
      buttons: () => [],
      render(e, ctx) {
        const { w: Wd, h: H } = ctx.size;
        const small = ctx.sizeClass === "small";
        const root = ctx.make("div", `cl-cluster bt-hits${small ? " small" : ""}`);
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", ctx.tr(e.label || "Last hits"));
        const head = ctx.make("div", "bt-head");
        const title = ctx.make("span", "cl-word bt-title");
        title.textContent = ctx.tr(e.label || "Last hits");
        const ship = ctx.make("span", "bt-ship");
        const stat = ctx.make("span", "bt-stat");
        const kills = ctx.make("span", "bt-kills");
        head.append(title, ship, stat, kills);
        const list = ctx.make("ol", "bt-list");
        root.append(head, list);
        // Too short for a list (one row on a phone): the head alone, filling the cell.
        const compact = H < (small ? 24 : 30) + 24;
        const headH = compact ? H : small ? 24 : 30;
        root.classList.toggle("compact", compact);
        Object.assign(head.style, { left: "0", top: "0", width: `${Wd}px`, height: `${headH}px` });
        Object.assign(list.style, { left: "0", top: `${headH}px`, width: `${Wd}px`, height: `${Math.max(0, H - headH)}px` });
        list.hidden = compact;
        const rows = Math.max(1, Math.floor((H - headH - 4) / (small ? 22 : 26)));
        const r = { root, list, ship, stat, kills, rows, compact };
        if (hasPage) fill(r);
        if (ctx.editing) { ctx.place(root, e); return root; }
        watch(r);
        return root;
      },
    });
  }

  // ---------- from the PC ----------

  function update(msg) {
    if (!msg || !msg.state || typeof msg.state !== "object") return;
    const st = msg.state;
    st.recent = Array.isArray(st.recent) ? st.recent : [];
    if (Number.isFinite(st.now)) skew = Date.now() - st.now;
    state = st;
    alert(String(msg.event || ""), st);
    refresh();
  }
  // Disconnected: what was shown may be out of date.
  function offline() { hide(); }

  // ---------- Deck settings ----------

  function hookSwitch() {
    const btn = hasPage && document.getElementById("battleBtn");
    if (!btn) return;
    btn.setAttribute("aria-checked", String(on()));
    btn.onclick = () => {
      store.set(on() ? "off" : "");
      btn.setAttribute("aria-checked", String(on()));
      if (!on()) hide();
      else if (state && state.fire) alert("sync", state);
      refresh();
    };
  }
  if (hasPage) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookSwitch);
    else hookSwitch();
  }

  if (typeof window !== "undefined") window.DeckBattle = { update, offline, on };
})();
