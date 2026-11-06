# Stream Deck pack: the contract between the generator and the plugin

Both are being written at the same time by different agents. Stick to this exactly.

## Shared sources (in the repo, read-only for both)

- `streamdeck/catalog.js`: `{ actions, byId, categories }`. Action kinds: `deck` (a Tablet Deck
  button: `keys`, `mode` tap|hold|timed, `ms`, `anim`, `state`, `scAction`), `system`
  (`system.uuid`, `system.settings`), `plugin` (`plugin.uuid/name/version/action/settings/states`,
  `dial: true` for dial actions), `website` (`url`), `nav` (`nav`: next|prev|back|home|folder:id),
  `tabletdeck` (`tabletdeck`: talk|status|lights-reset|theme|scene).
- `streamdeck/scenes.js`: `{ MODELS, SCENES, FOLDERS, BLOCKS, DIAL, layoutFor(modelId), refsIn(layout) }`.
  `layoutFor(id)` returns `{ pages: [{ scene, keys: {"c,r": ref}, dials: [dial|null] }], folders: { id: [ { keys, themes? } ] } }`.
  Refs: a catalog id, `@scene:<id>`, `@folder:<id>`, `@back`, `@next`, `@prev`, `@more:<folder>:<n>`
  (the folder's page n), `@theme:<id>` (and a themes folder page has `themes: [[c,r], ...]`, the
  slots to fill with the 12 theme keys in THEMES order), or null. A dial is
  `{ label, icon, color, ccw, cw, press }` (refs) or `{ action: "<catalog id of a dial plugin action>" }`.
  Pages are in `SCENES` order (page index = scene index).
- `streamdeck/keyart.js`: `{ SIZE: 144, parseThemes(css), theme(tokens, id), key(opts), blank(theme), ... }`.
  `key({ theme, icon, label, color, status, lit, pressed, blocked, offline, anim: {kind, t}, keys, showLabel, badge, font })`
  returns a 144x144 SVG string. `font: "live"` uses Windows fonts only (for the plugin).
- `public/icons.js` (window.DECK_ICONS, svg bodies on a 48x48 grid), `public/themes.css`
  (12 themes; ids in order: rsi drake aegis anvil origin misc crusader banu aopoa argo cnou esperia,
  the same order as THEMES in public/app.js, whose `name` is the short display name).
- Research with exact formats: `streamdeck/research/*.md` (prefer `*.verified.md`).

Icons not yet in icons.js (being designed) fall back to `DECK_ICONS.default`.

## The plugin

- UUID **`com.nodiecode.tabletdeck`**; source folder in the repo:
  `streamdeck/plugin/com.nodiecode.tabletdeck.sdPlugin/` (manifest.json, bin/, pi/, layouts/,
  en.json/es.json/fr.json/de.json). Windows only, `SDKVersion` 3, `Software.MinimumVersion` "7.3" (the + XL profile and the `switchToProfile` fix need it),
  `Nodejs.Version` "24" (global WebSocket), no npm dependencies, no bundler.
- At runtime the plugin reads generated data from its own folder: `data/catalog.json` (the catalog's
  `actions`, JSON), `data/icons.json` (DECK_ICONS), `data/themes.json` (keyart.parseThemes output),
  `data/scenes.json` (`{ SCENES, MODELS, DIAL }`), and `bin/keyart.js` (a copy of streamdeck/keyart.js).
  The generator writes these when it packs the plugin. For tests, the plugin agent may write them with
  a tiny script of its own (same shapes). They are NOT committed in the plugin source folder.
- Action UUIDs and their Settings (the generator writes these into the plugin's bundled profiles):

| action UUID | controller | Settings |
|---|---|---|
| `com.nodiecode.tabletdeck.key` | Keypad | `{ "action": "<catalog id>" }` |
| `com.nodiecode.tabletdeck.dial` | Encoder | `{ "dial": { "label", "icon", "color", "ccw", "cw", "press" } }` (catalog ids) |
| `com.nodiecode.tabletdeck.scene` | Keypad | `{ "scene": "<scene id>" }` |
| `com.nodiecode.tabletdeck.theme` | Keypad | `{ "theme": "<theme id>" }` |
| `com.nodiecode.tabletdeck.talk` | Keypad | `{}` |
| `com.nodiecode.tabletdeck.status` | Keypad (and Neo infobar if the agent adds it) | `{}` |
| `com.nodiecode.tabletdeck.lights` | Keypad | `{}` |

- Bundled profiles (written by the generator, one per model that has profiles): file
  `profiles/Tablet Deck <MODELS[id].name>.streamDeckProfile`, manifest `Profiles[]` entry
  `{ "Name": "profiles/Tablet Deck <name>", "DeviceType": MODELS[id].type, "Readonly": false,
  "DontAutoSwitchWhenInstalled": true, "AutoInstall": false }` (research: AutoInstall false = prompt on
  first switchToProfile). The plugin's scene action calls `switchToProfile` with that Name for the
  device's type and `page` = the scene's index (0-based). Built-in actions (media, websites,
  page/folder navigation) and other plugins' actions (Discord, OBS) appear in these profiles exactly
  as in the standalone ones.
- The generator adds the manifest's `Profiles` array to a copy of the source manifest when packing;
  the source manifest in the repo has no `Profiles` key.

## Talking to Tablet Deck (the plugin)

The Tablet Deck server (`server.js`, run `node server.js --dry-run --port <n>` to test without
pressing keys) speaks JSON over `ws://127.0.0.1:<port>/ws?t=<pairing code>&device=streamdeck&layout=layouts/hud.json`.
Port and pairing code: read `%APPDATA%\TabletDeck\config.json` (`port`, `token`) when present, else
`config.json` next to a source checkout is not reachable, so fall back to global settings set in the
property inspector (host 127.0.0.1, port 8765, code). Messages, client -> server: `{t:"hb", n}` every
1.5 s (the server answers `{t:"hb", n}` with the same n; give up on the link after 5 s without any
message, as public/app.js does), `{t:"tap", id}`, `{t:"down", id}` / `{t:"up", id}` for hold buttons,
`{t:"voice", on}` for hold to talk, `{t:"reset-states"}`, `{t:"scene", scene, left, right}` (below).
Server -> client: `{t:"hello", states, voiceStatus, ...}`,
`{t:"state", group, on}`, `{t:"states", states}`, `{t:"blocked", id}` (press skipped: Star Citizen not
in front), `{t:"listening", on}`, `{t:"heard"...}`, `{t:"unheard"}`, `{t:"reload"}`,
`{t:"panel", side, panel}` (below). Read public/app.js's
connect() and server.js's upgrade handler for the exact behaviour. A press must always be released:
send "up" for every "down" on keyUp, willDisappear, deviceDidDisconnect, systemDidWakeUp and when
either socket closes. One press per tap: no repeats or sequences; a dial detent counts as one tap
(at most 5 per dialRotate event).

server.js logs `device=streamdeck` connections as "Stream Deck connected". Scenes go both ways, and
neither direction answers the other, so they can't page each other back and forth:

- **Stream Deck to tablets:** the plugin sends `{t:"scene", scene, left, right}` when a device's scene
  changes and **Tablets follow scenes** is on (`left`/`right`: the scene's `tablet` panels). The
  server passes it to every other client; tablets with Follow Stream Deck scenes on page their HUD
  halves to those panels (`showPanels` in public/canvas.js) and send nothing for it.
- **Tablets to Stream Decks:** a tablet sends `{t:"panel", side, panel}` (`side` "left" or "right",
  `panel` the id of the panel in its layout) when the player pages that HUD half (its arrows, a
  two-finger swipe), once paging has stopped for 400 ms, and only if the half moved: never for a
  scene, a layout loading or a reconnect, and never from a grid layout. The server passes it only to
  `device=streamdeck` clients. With **Follow the tablet** on (global setting `followTablet`, on unless
  set to false), the plugin takes each device that shows a scene page of its bundled profile (a
  visible key carries `settings.page`) to the one scene whose `tablet[side]` is that panel, with
  `switchToProfile` as its own scene keys do, at most once per 250 ms per device, and sends no
  `scene` for it. A panel matches as tablets match scenes (the id, a word of it or its start, so a
  phone layout's `landing`, `power` and `systems` count). The device stays where it is when its scene
  has that panel already, when no scene or several do (`modes` is Mining's and Salvage's,
  `power-landing` Flight's and Hauling's), and while it shows a folder or a profile of the player's own.

The server checks both: scene names and panel ids are `^[a-z0-9-]{1,40}$`, `side` is left or right,
and nothing else passes through. Don't edit server.js yourself; tell the main session what you need.
