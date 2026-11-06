// The property inspector for every Tablet Deck action: what the key or dial does, and the
// shared Connection and Options (global settings). Plain HTML and script, nothing loaded
// from the network. Stream Deck calls connectElgatoStreamDeckSocket once the page has
// loaded; the plugin answers "init" with the buttons, scenes, themes and the text in
// Stream Deck's language. Every change is saved at once (there's no Save button).
(() => {
  const UUID = "com.nodiecode.tabletdeck";
  const $ = (id) => document.getElementById(id);
  let ws = null, uuid = "", action = "", kind = "", settings = {}, globals = {}, init = null;
  let strings = {};
  const t = (text, arg) => { const s = strings[text] !== undefined ? strings[text] : text; return arg === undefined ? s : String(s).replace("{0}", arg); };

  const send = (msg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
  const toPlugin = (payload) => send({ event: "sendToPlugin", action, context: uuid, payload });
  const saveSettings = () => send({ event: "setSettings", action, context: uuid, payload: settings });
  const saveGlobals = (patch) => {
    globals = { ...globals, ...patch };
    send({ event: "setGlobalSettings", context: uuid, payload: globals });
  };

  window.connectElgatoStreamDeckSocket = (port, inUUID, registerEvent, infoJson, actionInfoJson) => {
    uuid = inUUID;
    const actionInfo = JSON.parse(actionInfoJson || "{}");
    action = actionInfo.action || "";
    kind = action.startsWith(`${UUID}.`) ? action.slice(UUID.length + 1) : "";
    settings = (actionInfo.payload && actionInfo.payload.settings) || {};
    try { document.documentElement.lang = JSON.parse(infoJson).application.language || "en"; } catch { /* stays en */ }
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.onopen = () => {
      send({ event: registerEvent, uuid });
      send({ event: "getGlobalSettings", context: uuid });
      toPlugin({ type: "init" });
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.event === "didReceiveGlobalSettings") { globals = (msg.payload && msg.payload.settings) || {}; showGlobals(); }
      else if (msg.event === "didReceiveSettings") { settings = (msg.payload && msg.payload.settings) || {}; renderAction(); }
      else if (msg.event === "sendToPropertyInspector") fromPlugin(msg.payload || {});
    };
  };

  function fromPlugin(p) {
    if (p.type === "init") {
      init = p;
      strings = p.strings || {};
      for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
      renderAction();
      showLink(p.link);
    } else if (p.type === "link") showLink(p.link);
    else if (p.type === "test") {
      $("test").disabled = false;
      showLink(p.result, true);
      clearTimeout(showLink.timer);
      showLink.timer = setTimeout(() => showLink(lastLink), 4000);
    }
  }

  // ---------- Connection and Options ----------

  let lastLink = null;
  function showLink(link, test = false) {
    if (!link) return;
    if (!test) lastLink = link;
    const words = {
      connected: link.rtt ? t("Connected · {0} ms", link.rtt) : t("Connected · {0} ms", "…"),
      connecting: t("Connecting…"),
      offline: t("Tablet Deck isn't running on this PC."),
      "wrong-code": t("Wrong pairing code."),
      locked: t("Too many wrong codes: wait a minute."),
      unpaired: t("No pairing code yet: enter the one the Tablet Deck window shows."),
    };
    const box = $("link");
    box.className = `link ${link.state === "connected" ? (link.rtt > 120 ? "on slow" : "on") : link.state === "connecting" ? "wait" : ""}`;
    $("linkText").textContent = words[link.state] || words.offline;
    if (!test && link.found !== undefined) {
      $("code").placeholder = link.found ? t("From Tablet Deck on this PC") : "";
      $("found").textContent = link.found
        ? t("Found Tablet Deck's settings on this PC; leave these empty to use them.")
        : t("Tablet Deck's settings weren't found on this PC: enter its port and pairing code.");
    }
  }

  function showGlobals() {
    if (document.activeElement !== $("port")) $("port").value = globals.port || "";
    if (document.activeElement !== $("code")) $("code").value = globals.code || "";
    $("follow").checked = Boolean(globals.follow);
    $("motion").checked = globals.motion !== false;
  }

  let typing = null;
  const typed = () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const port = parseInt($("port").value, 10);
      saveGlobals({ port: port > 0 && port < 65536 ? port : 0, code: $("code").value.trim() });
    }, 500);
  };
  $("port").addEventListener("input", typed);
  $("code").addEventListener("input", typed);
  $("follow").addEventListener("change", (e) => saveGlobals({ follow: e.target.checked }));
  $("motion").addEventListener("change", (e) => saveGlobals({ motion: e.target.checked }));
  $("test").addEventListener("click", () => {
    $("test").disabled = true;
    $("linkText").textContent = t("Connecting…");
    toPlugin({ type: "test", port: parseInt($("port").value, 10) || 0, code: $("code").value.trim() });
  });

  // ---------- the action ----------

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) if (k.includes("-") || k === "role") n.setAttribute(k, v); else n[k] = v;
    for (const k of kids) if (k !== null && k !== undefined) n.append(k);
    return n;
  };
  const heading = (word) => el("h2", {}, el("span", { className: "slashes", textContent: "//" }), " ", el("span", { textContent: t(word) }));
  const iconSvg = (body) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 48 48");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2.4");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.innerHTML = body || ""; // the plugin's own icons (public/icons.js)
    return s;
  };
  const MODE = { hold: "Hold", timed: "Timed" };

  function renderAction() {
    if (!init) return;
    const box = $("action");
    box.hidden = false;
    box.replaceChildren();
    const note = (text) => el("p", { className: "note", textContent: t(text) });
    if (kind === "key") renderKey(box);
    else if (kind === "dial") renderDial(box);
    else if (kind === "scene") {
      box.append(heading("SCENE"), choice(init.scenes.map((s) => [s.id, s.name]), settings.scene, (v) => { settings = { ...settings, scene: v }; saveSettings(); }, "Choose a scene"),
        note("Goes to this scene's page in the Tablet Deck profile for this Stream Deck."));
    } else if (kind === "theme") {
      box.append(heading("THEME"), choice(init.themes.map((x) => [x.id, x.name]), settings.theme, (v) => { settings = { ...settings, theme: v }; saveSettings(); }, "Choose a theme"),
        note("Every Tablet Deck key and dial is drawn in the theme you press."));
    } else {
      const text = { talk: "Hold to speak a voice command; let go to stop listening.", status: "Shows the link to Tablet Deck: its round trip, or what's wrong. Press it to try again.", lights: "Turns off every lit key. Tablet Deck can't see the game, so lights only show what was pressed." }[kind];
      const name = { talk: "Hold to Talk", status: "Tablet Deck", lights: "Reset Lights" }[kind];
      if (text) box.append(heading(name ? t(name).toUpperCase() : ""), note(text)); else box.hidden = true;
    }
  }

  function choice(options, value, onChange, prompt) {
    const s = el("select", { "aria-label": t(prompt) });
    if (!options.some(([id]) => id === value)) s.append(el("option", { value: "", textContent: t(prompt), disabled: true, selected: true }));
    for (const [id, name] of options) s.append(el("option", { value: id, textContent: name, selected: id === value }));
    s.addEventListener("change", () => onChange(s.value));
    return s;
  }

  // Deck Button: a searchable list of every Tablet Deck button, grouped like the catalog.
  function renderKey(box) {
    const search = el("input", { type: "search", className: "search", placeholder: t("Search buttons"), "aria-label": t("Search buttons") });
    const list = el("div", { className: "list", role: "listbox", "aria-label": t("BUTTON") });
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren();
      let shown = 0;
      for (const cat of init.categories) {
        const items = init.actions.filter((a) => a.category === cat.id && (!q || a.label.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q) || a.id.includes(q)));
        if (!items.length) continue;
        list.append(el("p", { className: "group", textContent: cat.name }));
        for (const a of items) {
          const item = el("button", { type: "button", className: "item", role: "option" },
            iconSvg(a.icon), el("span", { className: "name", textContent: a.label }), MODE[a.mode] ? el("span", { className: "tag", textContent: t(MODE[a.mode]) }) : null);
          item.dataset.color = a.color || "";
          item.setAttribute("aria-selected", String(a.id === settings.action));
          item.addEventListener("click", () => {
            settings = { ...settings, action: a.id };
            saveSettings();
            for (const other of list.querySelectorAll(".item")) other.setAttribute("aria-selected", String(other === item));
          });
          list.append(item);
          shown++;
        }
      }
      if (!shown) list.append(el("p", { className: "empty", textContent: t("No buttons match.") }));
    };
    search.addEventListener("input", fill);
    box.append(heading("BUTTON"), search, list, el("p", { className: "note", textContent: t("Presses go through Tablet Deck, which only sends keys while Star Citizen is in front.") }));
    fill();
    const picked = list.querySelector('[aria-selected="true"]');
    if (picked) picked.scrollIntoView({ block: "center" });
  }

  // Deck Dial: a preset (streamdeck/scenes.js DIAL), or a button for each way.
  function renderDial(box) {
    const d = settings.dial && typeof settings.dial === "object" ? settings.dial : {};
    const presetOf = () => init.dials.find((p) => ["ccw", "cw", "press"].every((r) => (p[r] || "") === (d[r] || "")));
    // preset "" is the player choosing Custom: keep the pickers even while they match a preset.
    const current = settings.preset === "" ? null : settings.preset !== undefined ? init.dials.find((p) => p.id === settings.preset) : presetOf();
    const preset = el("select", { "aria-label": t("Preset") });
    for (const p of init.dials) preset.append(el("option", { value: p.id, textContent: p.name, selected: current && current.id === p.id }));
    preset.append(el("option", { value: "", textContent: t("Custom"), selected: !current }));
    const byId = new Map(init.actions.map((a) => [a.id, a]));
    const pick = (ref, onChange, label) => {
      const s = el("select", { "aria-label": t(label) });
      s.append(el("option", { value: "", textContent: t("None"), selected: !ref }));
      for (const cat of init.categories) {
        const g = el("optgroup", { label: cat.name });
        for (const a of init.actions.filter((x) => x.category === cat.id)) g.append(el("option", { value: a.id, textContent: a.label, selected: a.id === ref }));
        s.append(g);
      }
      s.addEventListener("change", () => onChange(s.value));
      return el("label", { className: "field" }, el("span", { textContent: t(label) }), s);
    };
    // The label a custom dial gets unless one is typed: the words its two turns share
    // ("Shields −" and "Shields +" make "Shields"), else the clockwise button's label.
    const autoLabel = (x) => {
      const a = byId.get(x.ccw), b = byId.get(x.cw), c = byId.get(x.press);
      if (a && b) { const shared = a.label.split(/\s+/).filter((w) => b.label.split(/\s+/).includes(w)); if (shared.length) return shared.join(" "); }
      return (b || a || c || {}).label || "";
    };
    const saveCustom = (patch) => {
      const next = { ...(settings.dial || {}), ...patch };
      const lead = byId.get(next.cw) || byId.get(next.press) || byId.get(next.ccw);
      settings = { ...settings, preset: "", dial: { label: next.typed ? next.label : autoLabel(next), typed: Boolean(next.typed), icon: lead ? lead.iconName : next.icon || "", color: lead ? lead.color : "", ccw: next.ccw || "", cw: next.cw || "", press: next.press || "" } };
      saveSettings();
    };
    const rows = el("div", { className: "rows" });
    if (!current) {
      const label = el("input", { type: "text", value: d.typed ? d.label || "" : "", placeholder: autoLabel(d), maxLength: 24 });
      label.addEventListener("change", () => saveCustom({ label: label.value.trim(), typed: Boolean(label.value.trim()) }));
      rows.append(el("label", { className: "field" }, el("span", { textContent: t("Label") }), label),
        pick(d.ccw, (v) => saveCustom({ ccw: v }), "Turn left"), pick(d.cw, (v) => saveCustom({ cw: v }), "Turn right"), pick(d.press, (v) => saveCustom({ press: v }), "Push and touch"));
    }
    preset.addEventListener("change", () => {
      const p = init.dials.find((x) => x.id === preset.value);
      settings = p ? { ...settings, preset: p.id, dial: { label: p.label, icon: p.icon || "", color: p.color || "", ccw: p.ccw || "", cw: p.cw || "", press: p.press || "" } } : { ...settings, preset: "", dial: { ...d } };
      saveSettings();
      renderAction();
    });
    box.append(heading("DIAL"), el("label", { className: "field" }, el("span", { textContent: t("Preset") }), preset), rows,
      el("p", { className: "note", textContent: t("One press per detent, at most 5 per turn.") }),
      el("p", { className: "note", textContent: t("Presses go through Tablet Deck, which only sends keys while Star Citizen is in front.") }));
  }
})();
