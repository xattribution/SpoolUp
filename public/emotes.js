// The emote board (grid layouts, SpoolUp 2.1): every emote in the layout, with favorites
// and groups of this device's own. Hold an emote to star it, tap to play it, and Arrange
// to reorder the favorites and groups or drag an emote onto a tab to add it there.
//
// One press per tap: a tap sends one D.tapStep on lift, and only when the finger stayed
// put, lifted before the hold time and no page swipe took it. A hold, Arrange and the tabs
// press nothing. The 34 em-* buttons stay ordinary button definitions in the layout, so
// voice, the Stream Deck catalog and the keybind profile find them as before.
//
// Favorites, groups and the open tab are kept per device in localStorage under
// "spoolup-emotes" (canvas.js's Quick actions reads the favorites). Ids from another
// layout are kept but not shown, so switching layouts loses nothing.
(function () {
  "use strict";
  const W = window.DeckWidgets;
  if (!W) return;

  const KEY = "spoolup-emotes";
  const HOLD_MS = 450;   // hold this long to star or unstar
  const MOVE_PX = 12;    // a finger that moved further isn't a tap
  const DRAG_PX = 8;     // in Arrange, moving this far picks the emote up
  const NAME_MAX = 24;
  const tr = (s, ...a) => (window.DeckI18n ? window.DeckI18n.t(s, ...a) : s);
  const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- this device's favorites and groups ----------

  const uniq = (a) => [...new Set((Array.isArray(a) ? a : []).filter((id) => typeof id === "string" && id))];
  function read(D) {
    let raw = null;
    try { raw = JSON.parse(D.store.get(KEY) || "null"); } catch { raw = null; }
    const s = { v: 1, favorites: [], groups: [], view: "" };
    if (!raw || typeof raw !== "object") return s;
    s.favorites = uniq(raw.favorites);
    if (Array.isArray(raw.groups)) {
      const seen = new Set();
      for (const g of raw.groups) {
        if (!g || typeof g.id !== "string" || seen.has(g.id)) continue;
        seen.add(g.id);
        s.groups.push({ id: g.id, name: String(g.name || "").slice(0, NAME_MAX), ids: uniq(g.ids) });
      }
    }
    if (typeof raw.view === "string") s.view = raw.view;
    return s;
  }
  function write(D, s) {
    try { D.store.set(KEY, JSON.stringify(s)); } catch { /* storage off: still works until reload */ }
  }

  // Every board on screen (a dashboard can show the board twice), so a change shows on all.
  const live = new Set();
  function changed(from) {
    for (const b of live) {
      if (!b.root.isConnected) { live.delete(b); continue; }
      if (b !== from) b.paint();
    }
  }
  // Set once the player picks a tab, so an empty Favorites they chose stays open.
  let picked = false;

  // The board's buttons: the emotes it lists, in order, each once.
  function buttonsOf(e) {
    const out = [], seen = new Set();
    for (const b of Array.isArray(e.buttons) ? e.buttons : []) {
      if (b && typeof b.id === "string" && typeof b.keys === "string" && !seen.has(b.id)) { seen.add(b.id); out.push(b); }
    }
    return out;
  }
  // The emote's own picture: its icon, or the emote-<name> icon icons.js has for em-<name>.
  function iconOf(def, D) {
    const icons = window.DECK_ICONS || {};
    const name = def.icon || (icons[`emote-${def.id.replace(/^em-/, "")}`] ? `emote-${def.id.replace(/^em-/, "")}` : "emote");
    return D.deckIcon ? D.deckIcon(name) : "";
  }

  // ---------- a small sheet: a name to type, or a choice ----------

  function sheet({ title, value, placeholder, actions }) {
    const veil = document.createElement("div");
    veil.className = "em-veil";
    const box = document.createElement("div");
    box.className = "em-sheet";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const h = document.createElement("h3");
    h.id = `em-sheet-${Date.now()}`;
    h.textContent = title;
    box.setAttribute("aria-labelledby", h.id);
    box.append(h);
    let input = null;
    if (value !== undefined) {
      input = document.createElement("input");
      input.type = "text";
      input.maxLength = NAME_MAX;
      input.value = value;
      input.placeholder = placeholder || "";
      input.setAttribute("aria-label", placeholder || title);
      input.autocomplete = "off";
      input.spellcheck = false;
      box.append(input);
    }
    const acts = document.createElement("div");
    acts.className = "em-acts";
    const prevFocus = document.activeElement;
    const close = () => {
      veil.remove();
      document.removeEventListener("keydown", onKey, true);
      if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
    };
    let primary = null;
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `em-act${a.primary ? " primary" : ""}${a.danger ? " danger" : ""}`;
      b.textContent = a.label;
      b.onclick = () => {
        const v = input ? input.value.trim().slice(0, NAME_MAX) : undefined;
        if (a.needsText && !v) return;
        close();
        if (a.run) a.run(v);
      };
      if (a.primary) primary = { b, a };
      acts.append(b);
    }
    box.append(acts);
    veil.append(box);
    const sync = () => { if (primary && primary.a.needsText) primary.b.disabled = !input.value.trim(); };
    if (input) input.addEventListener("input", sync);
    sync();
    function onKey(ev) {
      if (ev.key === "Escape") { ev.preventDefault(); close(); }
      else if (ev.key === "Enter" && input && document.activeElement === input && primary) { ev.preventDefault(); primary.b.click(); }
    }
    document.addEventListener("keydown", onKey, true);
    veil.addEventListener("pointerdown", (ev) => { if (ev.target === veil) close(); });
    document.body.append(veil);
    (input || acts.querySelector("button")).focus();
    return close;
  }

  // ---------- the board ----------

  W.register("emotes", {
    label: "Emotes",
    category: "emotes",
    icon: "emote",
    spans: { small: [6, 4], large: [6, 7] },
    min: [3, 3], max: [12, 8],
    // The board scrolls up and down by itself and claims no drag, so swipes still page
    // over it. Only Arrange claims the finger (it sets data-drag while it's on).
    drag: "",
    buttons: (e) => buttonsOf(e).map((b) => ["emote", b]),
    render(e, ctx) {
      const { D, make } = ctx;
      const defs = buttonsOf(e);
      const byId = new Map(defs.map((d) => [d.id, d]));
      const small = ctx.sizeClass === "small";
      const root = make("div", `em-board${small ? " small" : ""}`);
      root.setAttribute("role", "group");
      root.setAttribute("aria-label", tr(e.label || "Emotes"));

      // Columns from the cell's width: 4 to 5 on small screens, 5 to 6 on large, fewer
      // only when the cell is too narrow for that many.
      const w = Math.max(1, ctx.size.w), h = Math.max(1, ctx.size.h);
      const gap = small ? 6 : 8;
      const barH = small ? 36 : 44;
      const lo = small ? 4 : 5, hi = small ? 5 : 6;
      let cols = Math.round(w / (small ? 76 : 104));
      cols = Math.max(lo, Math.min(hi, cols));
      while (cols > 2 && (w - gap * (cols - 1)) / cols < (small ? 56 : 72)) cols--;
      const tileW = (w - gap * (cols - 1)) / cols;
      const rowH = Math.round(Math.max(48, Math.min(small ? 72 : 104, tileW * 0.86, h - barH - gap)));
      root.style.setProperty("--em-cols", String(cols));
      root.style.setProperty("--em-row", `${rowH}px`);
      root.style.setProperty("--em-gap", `${gap}px`);
      root.style.setProperty("--em-bar", `${barH}px`);
      root.classList.toggle("tight", rowH < 62);

      const bar = make("div", "em-bar");
      const tabs = make("div", "em-tabs");
      tabs.setAttribute("role", "tablist");
      tabs.dataset.drag = "x"; // a row of tabs wider than the board scrolls, not pages
      const tool = make("button", "em-tool");
      tool.type = "button";
      const list = make("div", "em-list");
      list.setAttribute("role", "tabpanel");
      const hint = make("div", "em-hint");
      hint.hidden = true;
      bar.append(tabs, tool);
      root.append(bar, hint, list);
      root.addEventListener("contextmenu", (ev) => ev.preventDefault());

      const tile = (def) => {
        const t = make("button", "hud-btn s-tile em-tile");
        t.type = "button";
        t.dataset.emote = def.id;
        t.dataset.color = def.color || "";
        t.innerHTML = `<span class="hud-ico">${iconOf(def, D)}</span><span class="hud-lbl"></span><span class="em-star" aria-hidden="true">★</span><span class="em-hold" aria-hidden="true"></span>`;
        t.querySelector(".hud-lbl").textContent = tr(def.label);
        if (def.keys) {
          const k = make("span", "hud-key");
          k.setAttribute("aria-hidden", "true");
          k.textContent = ctx.keyText(def.keys);
          t.append(k);
        }
        t.setAttribute("aria-label", tr(def.label));
        t.title = `${tr(def.label)} — ${def.keys}`;
        // Icons only (Deck settings or the layout): every emote has its own picture.
        const own = def.labels === "show" || def.labels === "hide" ? def.labels : ctx.labels ? ctx.labels() : "show";
        if (own === "hide") t.classList.add("lbl-off");
        return t;
      };

      // In the layout editor: the board as it looks, nothing bound.
      if (ctx.editing) {
        for (const [name, on] of [["Favorites", false], ["All", true]]) {
          const t = make("span", `em-tab${on ? " on" : ""}`);
          t.textContent = name === "Favorites" ? `★ ${tr(name)}` : tr(name);
          tabs.append(t);
        }
        tool.textContent = tr("Arrange");
        for (const d of defs) list.append(tile(d));
        ctx.place(root, e);
        return root;
      }

      let data = read(D);
      let arranging = false;
      let deferred = false; // a repaint waiting for the finger on this board to lift
      let busy = false;     // a finger is on a tile here
      const board = { root, paint: () => { if (busy) deferred = true; else paint(); } };
      live.add(board);

      const save = () => { write(D, data); changed(board); };
      const known = (ids) => ids.filter((id) => byId.has(id));
      const groupOf = (id) => data.groups.find((g) => g.id === id);
      // The tab to show: the saved one if it still exists. Without one (or with Favorites
      // saved but nothing starred here, and the player hasn't picked it since loading), the
      // board opens on Favorites when it has something here, else All. Kept per board, so
      // starring an emote doesn't switch tabs under the finger.
      let view = (() => {
        const v = data.view;
        if (v === "all" || (v && v !== "favorites" && groupOf(v))) return v;
        if (v === "favorites" && picked) return v;
        return known(data.favorites).length ? "favorites" : "all";
      })();
      const viewNow = () => (view === "all" || view === "favorites" || groupOf(view) ? view : (view = "all"));
      const listOf = (view) => (view === "favorites" ? data.favorites : view === "all" ? null : (groupOf(view) || {}).ids || null);
      const nameOf = (view) => (view === "favorites" ? tr("Favorites") : (groupOf(view) || {}).name || "");
      const starred = (id) => data.favorites.includes(id);

      // Adds an emote to Favorites or a group (from a drop onto its tab).
      function addTo(view, id) {
        const ids = listOf(view);
        if (!ids) return;
        if (ids.includes(id)) { D.toast(view === "favorites" ? tr("Added to favorites") : tr("Added to {0}", nameOf(view))); return; }
        ids.push(id);
        save();
        D.buzz && D.buzz();
        D.toast(view === "favorites" ? tr("Added to favorites") : tr("Added to {0}", nameOf(view)));
      }
      function removeFrom(view, id) {
        const ids = listOf(view);
        if (!ids) return;
        const i = ids.indexOf(id);
        if (i >= 0) ids.splice(i, 1);
        save();
        paint();
      }
      // Writes the order the tiles now show into the list, keeping the ids of other layouts.
      function keepOrder(view) {
        const ids = listOf(view);
        if (!ids) return;
        const shown = [...list.querySelectorAll(".em-tile")].map((t) => t.dataset.emote);
        const others = ids.filter((id) => !byId.has(id));
        ids.splice(0, ids.length, ...shown, ...others);
        save();
      }

      function toggleStar(id, t) {
        const on = !starred(id);
        if (on) data.favorites.push(id);
        else data.favorites.splice(data.favorites.indexOf(id), 1);
        write(D, data);
        changed(board);
        D.buzz && D.buzz([12, 40, 12]);
        D.toast(on ? tr("Added to favorites") : tr("Removed from favorites"));
        for (const el of root.querySelectorAll(".em-tile")) if (el.dataset.emote === id) el.classList.toggle("starred", on);
        if (t && on && !still()) {
          const burst = make("span", "em-burst", "★");
          burst.setAttribute("aria-hidden", "true");
          t.append(burst);
          burst.addEventListener("animationend", () => burst.remove(), { once: true });
          setTimeout(() => burst.remove(), 900);
        }
        // Unstarring on Favorites takes the tile away, once the finger is off it.
        if (viewNow() === "favorites") board.paint();
      }

      function newGroup() {
        sheet({
          title: tr("New group"), value: "", placeholder: tr("Group name"),
          actions: [
            { label: tr("Cancel") },
            { label: tr("Create"), primary: true, needsText: true, run(name) {
              let id = `g-${Date.now()}`;
              while (groupOf(id)) id += "1";
              data.groups.push({ id, name, ids: [] });
              data.view = view = id;
              picked = true;
              save();
              paint();
            } },
          ],
        });
      }
      function groupMenu(g) {
        sheet({
          title: g.name,
          actions: [
            { label: tr("Delete group"), danger: true, run() {
              data.groups = data.groups.filter((x) => x.id !== g.id);
              if (data.view === g.id) data.view = "all";
              if (view === g.id) view = "all";
              save();
              paint();
            } },
            { label: tr("Rename"), run() {
              sheet({
                title: tr("Rename"), value: g.name, placeholder: tr("Group name"),
                actions: [
                  { label: tr("Cancel") },
                  { label: tr("Rename"), primary: true, needsText: true, run(name) { g.name = name; save(); paint(); } },
                ],
              });
            } },
            { label: tr("Cancel"), primary: true },
          ],
        });
      }

      // ---------- tabs ----------

      function tab(v, label, opts = {}) {
        const t = make("button", `em-tab${opts.on ? " on" : ""}${opts.add ? " em-add" : ""}`);
        t.type = "button";
        t.setAttribute("role", opts.add ? "button" : "tab");
        if (!opts.add) t.setAttribute("aria-selected", opts.on ? "true" : "false");
        t.innerHTML = `${v === "favorites" ? `<span class="em-tab-star" aria-hidden="true">★</span>` : ""}<span class="em-tab-name"></span>`;
        t.lastChild.textContent = label;
        if (opts.add) t.setAttribute("aria-label", tr("New group"));
        // Favorites and groups other than the open tab take an emote dropped in Arrange.
        if (v === "favorites" || groupOf(v)) t.dataset.drop = v;
        // A group's tab held (or right-clicked) offers Rename and Delete group.
        let timer = 0, heldTab = false, x0 = 0, y0 = 0;
        const g = groupOf(v);
        if (g) {
          t.addEventListener("pointerdown", (ev) => {
            heldTab = false; x0 = ev.clientX; y0 = ev.clientY;
            clearTimeout(timer);
            timer = setTimeout(() => { heldTab = true; D.buzz && D.buzz(); groupMenu(g); }, HOLD_MS);
          });
          t.addEventListener("pointermove", (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > MOVE_PX) clearTimeout(timer); });
          for (const type of ["pointerup", "pointercancel", "pointerleave"]) t.addEventListener(type, () => clearTimeout(timer));
          t.addEventListener("contextmenu", (ev) => { ev.preventDefault(); clearTimeout(timer); heldTab = true; groupMenu(g); });
          t.title = `${g.name} — ${tr("Rename")} / ${tr("Delete group")}`;
        }
        t.addEventListener("click", () => {
          if (heldTab) { heldTab = false; return; }
          if (opts.add) { newGroup(); return; }
          data.view = view = v;
          picked = true;
          write(D, data);
          paint();
        });
        return t;
      }

      // ---------- tiles: tap to play, hold to star; in Arrange, drag ----------

      function bindTile(t, def, view) {
        const fx = window.DeckFX ? window.DeckFX.attach(t, def) : null;
        t.dataset.btn = def.id; // a press the PC skipped flashes here too
        t._deny = fx ? fx.deny : () => {};
        let p = null; // { id, x0, y0, timer, held, dead, drag }

        const end = () => {
          if (p) clearTimeout(p.timer);
          p = null;
          listen(false);
          busy = false;
          t.classList.remove("pressed", "em-holding");
          if (deferred) { deferred = false; paint(); }
        };
        const kill = () => { if (p) { p.dead = true; clearTimeout(p.timer); t.classList.remove("pressed", "em-holding"); } };
        function play() {
          if (ctx.swiping()) return;
          if (!D.tapStep(def)) return;
          if (fx) { fx.down(); fx.up(); }
        }

        t.addEventListener("pointerdown", (ev) => {
          if (ev.pointerType === "mouse" && ev.button !== 0) return;
          // A second finger isn't a tap: the press under the first is called off too.
          if (p || (ev.pointerType !== "mouse" && !ev.isPrimary)) { kill(); return; }
          if (ev.target.closest(".em-x")) return;
          p = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, timer: 0, held: false, dead: false, drag: null };
          busy = true;
          listen(true);
          try { t.setPointerCapture(ev.pointerId); } catch { /* synthetic event */ }
          if (arranging) return;
          t.classList.add("pressed", "em-holding");
          p.timer = setTimeout(() => {
            if (!p || p.dead || ctx.swiping()) return;
            p.held = true;
            t.classList.remove("pressed", "em-holding");
            toggleStar(def.id, t);
          }, HOLD_MS);
        });
        // Moves and lifts are heard on the document while a finger is on the tile: in
        // Arrange the tile itself moves through the list, which ends its pointer capture.
        const onMove = (ev) => {
          if (!p || ev.pointerId !== p.id) return;
          const dx = ev.clientX - p.x0, dy = ev.clientY - p.y0;
          if (arranging) {
            if (!p.drag && Math.hypot(dx, dy) > DRAG_PX) p.drag = pickUp(t, view, ev);
            if (p.drag) p.drag.move(ev);
            return;
          }
          if (ctx.swiping() || Math.hypot(dx, dy) > MOVE_PX) kill();
        };
        const onUp = (ev) => {
          if (!p || ev.pointerId !== p.id) return;
          const q = p;
          if (q.drag) { q.drag.drop(); end(); return; }
          const tap = !arranging && !q.dead && !q.held && !ctx.swiping()
            && Math.hypot(ev.clientX - q.x0, ev.clientY - q.y0) <= MOVE_PX;
          end();
          if (tap) {
            play();
            // The pressed look stays a moment, so a quick tap still shows.
            t.classList.add("pressed");
            setTimeout(() => t.classList.remove("pressed"), 120);
          }
        };
        const onCancel = (ev) => {
          if (!p || ev.pointerId !== p.id) return;
          if (p.drag) p.drag.cancel();
          end();
        };
        const listen = (on) => {
          const f = on ? "addEventListener" : "removeEventListener";
          document[f]("pointermove", onMove);
          document[f]("pointerup", onUp);
          document[f]("pointercancel", onCancel);
        };
        t.addEventListener("lostpointercapture", (ev) => { if (p && !p.drag && !arranging) onCancel(ev); });

        t.addEventListener("keydown", (ev) => {
          if (ev.repeat) return;
          if (!arranging && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); play(); }
          else if (ev.key === "f" || ev.key === "F" || ev.key === "*") { ev.preventDefault(); toggleStar(def.id, t); }
          else if (arranging && listOf(view) && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
            ev.preventDefault();
            const tiles = [...list.querySelectorAll(".em-tile")];
            const i = tiles.indexOf(t);
            const step = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : ev.key === "ArrowUp" ? -cols : cols;
            const j = Math.max(0, Math.min(tiles.length - 1, i + step));
            if (j === i) return;
            if (j > i) tiles[j].after(t); else tiles[j].before(t);
            keepOrder(view);
            t.focus();
          } else if (arranging && listOf(view) && (ev.key === "Delete" || ev.key === "Backspace")) {
            ev.preventDefault();
            removeFrom(view, def.id);
          }
        });
      }

      // Arrange: the emote follows the finger as a ghost; over another tile of a list it
      // takes that place, over a tab it's added there on lift.
      function pickUp(t, view, ev) {
        const ordered = Boolean(listOf(view));
        const r0 = root.getBoundingClientRect();
        const k = r0.width / (root.offsetWidth || r0.width) || 1; // the canvas's scale
        const tr0 = t.getBoundingClientRect();
        const ghost = t.cloneNode(true);
        ghost.classList.add("em-ghost");
        ghost.classList.remove("pressed");
        ghost.removeAttribute("data-btn");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${tr0.width / k}px`;
        ghost.style.height = `${tr0.height / k}px`;
        const offX = (ev.clientX - tr0.left) / k, offY = (ev.clientY - tr0.top) / k;
        root.append(ghost);
        t.classList.add("em-placeholder");
        let over = null, moved = false;
        const place = (e2) => {
          const r = root.getBoundingClientRect();
          ghost.style.left = `${(e2.clientX - r.left) / k - offX}px`;
          ghost.style.top = `${(e2.clientY - r.top) / k - offY}px`;
        };
        place(ev);
        return {
          move(e2) {
            place(e2);
            const hit = document.elementFromPoint(e2.clientX, e2.clientY);
            const tabHit = hit && hit.closest && hit.closest(".em-tab[data-drop]");
            const next = tabHit && root.contains(tabHit) && tabHit.dataset.drop !== view ? tabHit : null;
            if (next !== over) {
              if (over) over.classList.remove("drop");
              over = next;
              if (over) over.classList.add("drop");
            }
            if (!over && ordered) {
              const other = hit && hit.closest && hit.closest(".em-tile");
              if (other && other !== t && list.contains(other)) {
                const tiles = [...list.children];
                if (tiles.indexOf(other) > tiles.indexOf(t)) other.after(t); else other.before(t);
                moved = true;
              }
            }
            // Near the list's top or bottom edge, it scrolls along.
            const lr = list.getBoundingClientRect();
            if (e2.clientY > lr.bottom - 24) list.scrollTop += 8;
            else if (e2.clientY < lr.top + 24 && e2.clientY > lr.top) list.scrollTop -= 8;
          },
          drop() {
            ghost.remove();
            t.classList.remove("em-placeholder");
            if (over) { over.classList.remove("drop"); addTo(over.dataset.drop, t.dataset.emote); board.paint(); return; }
            if (moved) keepOrder(view);
          },
          cancel() {
            ghost.remove();
            t.classList.remove("em-placeholder");
            if (over) over.classList.remove("drop");
            if (moved) deferred = true; // put the tiles back as saved
          },
        };
      }

      // ---------- drawing ----------

      function paint() {
        data = read(D);
        const view = viewNow();
        const ids = listOf(view);
        root.classList.toggle("arranging", arranging);
        if (arranging) root.dataset.drag = "xy"; else delete root.dataset.drag;

        tabs.textContent = "";
        tabs.append(tab("favorites", tr("Favorites"), { on: view === "favorites" }));
        tabs.append(tab("all", tr("All"), { on: view === "all" }));
        for (const g of data.groups) tabs.append(tab(g.id, g.name, { on: view === g.id }));
        tabs.append(tab("add", "+", { add: true }));
        const onTab = tabs.querySelector(".em-tab.on");
        if (onTab && onTab.scrollIntoView && tabs.scrollWidth > tabs.clientWidth) {
          tabs.scrollLeft = Math.max(0, onTab.offsetLeft - (tabs.clientWidth - onTab.offsetWidth) / 2);
        }
        for (const t of tabs.querySelectorAll(".em-tab[data-drop]")) t.classList.toggle("drop-ok", arranging && t.dataset.drop !== view);

        tool.textContent = tr(arranging ? "Done" : "Arrange");
        tool.classList.toggle("on", arranging);
        tool.setAttribute("aria-pressed", arranging ? "true" : "false");

        list.textContent = "";
        const shown = ids ? known(ids) : defs.map((d) => d.id);
        hint.hidden = !arranging;
        hint.textContent = arranging ? tr(ids ? "Drag to reorder, or onto a tab to add it there." : "Drag an emote onto a tab to add it there.") : "";
        for (const id of shown) {
          const def = byId.get(id);
          const t = tile(def);
          t.classList.toggle("starred", starred(id));
          if (arranging && ids) {
            const x = make("span", "em-x", "×");
            x.setAttribute("role", "button");
            x.setAttribute("aria-label", tr("Remove"));
            x.addEventListener("pointerdown", (ev) => ev.stopPropagation());
            x.addEventListener("click", (ev) => { ev.stopPropagation(); removeFrom(view, id); });
            t.append(x);
          }
          bindTile(t, def, view);
          list.append(t);
        }
        if (!shown.length) {
          const empty = make("div", "em-empty");
          empty.textContent = view === "favorites" ? tr("Hold an emote to star it") : tr("In All, tap Arrange and drag emotes onto this tab.");
          list.append(empty);
        }
      }

      tool.addEventListener("click", () => { arranging = !arranging; paint(); });
      paint();
      return root;
    },
  });
})();
