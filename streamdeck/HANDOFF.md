# Stream Deck pack: handoff notes

Working notes for whoever (human or AI agent) continues this work. Updated at each
milestone; the newest status is at the top of each section. Read the repo's
[AGENTS.md](../AGENTS.md) first: its ground rules apply here too.

Last updated: 2026-11-06, session https://claude.ai/code/session_01SQ9wwRmoeXnyjC52PRNx5s
Branch: `gen/sweet-einstein-7mguuf`, PR: xattribution/tablet-deck-spooned#1 (open).

## What the owner asked for

An Elgato Stream Deck "mega pack" based on Tablet Deck's designs and icons:

1. **Icons** for every Tablet Deck action, in the HUD style, usable on their own
   (an icon pack), including actions too niche for a ready-made page, so players can
   build their own pages.
2. **Scenes**: ready-made Stream Deck profiles with pages per activity (flight,
   combat, mining, salvage, hauling/exploration, on foot, emotes, **comms**), with keys
   to move between pages, and a **folder of controls to swap vendor themes**.
   - **Every Stream Deck model**, smallest to largest, including the dial/touch strip
     models (Stream Deck +, Studio) with designs and animations for knobs and screens.
   - **Every page in every one of the 12 manufacturer themes**, all in one mega pack.
   - Usable **without** Tablet Deck (Stream Deck's own Hotkey actions plus the Tablet
     Deck Keyboard keybind profile), and optionally **fully integrated** with the app.
   - The Comms page offers Discord mute/deafen and other standard Stream Deck uses
     (media, volume, OBS, timers...).
3. **Integration** (optional): a Stream Deck plugin that talks to the Tablet Deck
   server, so presses go through its focus check and keybinds, keys show the shared
   lit states (gear DEPLOYED, doors OPEN), skipped presses flash red, keys animate, and
   scenes can follow / drive the tablet's panels.
4. Clever, intuitive, good-looking layouts in line with each vendor's theme.

The owner also asked to be kept updated, and for this file to stay current so another
agent can pick up the work.

## Decisions so far

Facts behind these are in [research/](research/README.md) (sources and confidence for each).

- **Where it lives:** `streamdeck/` (sources), `tools/make-streamdeck.js` (generator,
  planned). Built packs go to `dist/streamdeck/` (not committed: the mega pack is large).
  Same branch and PR as the rest of this session's work.
- **Models** (`research/devices.verified.md`). Profiles are generated for 7, keyed by SDK
  `DeviceType` and profile `Device.Model`:
  - Mini 3x2 (1, `20GAI9901`)
  - Neo 4x2 + Infobar (9, `20GBJ9901`)
  - 15-key MK.2/Scissor 5x3 (0, `20GAA9901`)
  - Stream Deck + 4x2 + 4 dials + 800x100 strip (7, `20GBD9901`)
  - **Stream Deck + XL** 9x4 + 6 dials + 1200x100 strip (13, `20GBX9901`, new in 2026; the
    owner asked for it to get extra love: treat it as the flagship layout)
  - XL 8x4 (2, `20GAT9901`)
  - Mobile (3, `VSD2/WiFi`)
  
  No profiles for Studio (Elgato: not supported by Stream Deck app profiles), Pedal,
  Galleon 100 SD and Virtual Stream Deck (model IDs unconfirmed); the plugin's actions still
  work on them, and the docs suggest uses (pedals: push to talk, PTT; Studio: Companion).
- **Profiles:** v2 format (plain ZIP: `<UUID>.sdProfile/manifest.json`,
  `Profiles/<base32 page id>/manifest.json`, `Images/*.png`), which Stream Deck 6.x and 7.x
  both import (`research/profiles.md` sections 0, 2.2, 10). Key images **PNG 144x144**
  (SVG in profiles isn't confirmed; animated GIF/WebP are, see navigation.md 8). At most 10
  pages per profile; folders don't count (they're extra page folders reached by
  `profile.openchild`). In-profile links: `page.goto` (1-based `PageIndex`), `page.next`,
  `page.previous`, `profile.openchild` / `profile.backtoparent`.
- **Scenes** = pages of one profile per model: Flight, Combat, Mining, Salvage, Hauling &
  Exploration, On Foot, Comms, plus folders (Emotes, more actions, Themes). Each page has a
  consistent navigation zone.
- **Themes without the plugin:** one profile per model per theme (7 x 12 = 84). The Themes
  folder's keys are Switch Profile (`profile.rotate`) with fixed, generated profile UUIDs.
  Whether a UUID survives import isn't confirmed (navigation.md 5.2); document "if a theme
  key doesn't switch, pick the target in the key's settings once".
- **Themes with the plugin:** one bundled profile per model; Theme keys re-skin every
  plugin key live (global setting), reliable.
- **The built-in Hotkey only taps** (`research/profiles.verified.md` correction 1): it
  can't hold a key. Star Citizen actions that need a hold or a >= 0.25 s press (voice push
  to talk, Engage Quantum, Look Behind, the `delayed_press` binds such as SCM/NAV, docking
  camera, Max/Min power) can't work as standalone Hotkeys. In the standalone pack they use
  the Tablet Deck plugin's key action instead, drawn with a "PLUGIN" mark, rather than a
  tap that silently does nothing. (Possible later: the keybind profile could rebind those
  actions with a press activation mode, if Star Citizen's actionmaps accept that; unverified.)
- **Animated icon pack images must be GIF**, with a PNG of the same name next to each
  (`research/iconpacks.verified.md` correction 2); WebP fails Elgato's tool.
- **Standalone hotkeys don't pass Tablet Deck's focus check** (Elgato's app presses them,
  into whatever window has focus). Say so in the docs; the plugin route goes through Tablet
  Deck and keeps the check.
- **Plugin:** plain Node with the raw Stream Deck WebSocket protocol, no `@elgato/streamdeck`
  and no bundler (officially supported: `research/sdk.verified.md` 0, 5.4). `Nodejs.Version`
  "24" (global `WebSocket`), `Software.MinimumVersion` "7.3" (a + XL profile needs 7.3, which also fixed `switchToProfile`), `SDKVersion` 3, Windows only.
  `setImage` takes SVG/PNG data URLs but no animated formats, at most ~10 updates a second:
  animation = frames from `streamdeck/keyart.js`.
- **Scenes sync both ways** (`CONTRACT.md`, "Talking to Tablet Deck"): a scene picked on the
  Stream Deck pages tablets (the plugin's **Tablets follow scenes**, off by default, and the
  tablet's **Follow Stream Deck scenes**, on by default); a HUD half paged on a tablet sends
  `{t:"panel"}` (400 ms after paging stops, only to `device=streamdeck` clients) and the Stream Deck
  goes to the one scene with that panel (**Follow the tablet**, on by default). Neither direction
  answers the other, so they can't page each other back. Panels two scenes share (Power/Landing,
  Operator Modes) don't move it, and a device on a folder, on the player's own profile or with a key
  held stays. Hardware question: whether `switchToProfile` with a page moves an already-shown
  profile promptly.
- **No new npm dependencies.** The generator renders PNGs by driving an installed
  Edge/Chrome over the DevTools protocol, like `tools/record-demo.js`, with the theme's Google
  font (the tablet already loads those fonts); writes ZIPs with Node's zlib.
- **Key art:** `streamdeck/keyart.js` (done). Simple SVG shapes only, glows as layered
  strokes; reads each theme's tokens from `public/themes.css`.
- **Icons:** new ones go into `public/icons.js` (the layout editor lists them too). Original
  designs only, no brand logos.
- **Comms page** (`research/plugins.md` 0, 16): Discord Mute/Deafen/Push to Talk/Push to Mute
  from Elgato's Discord plugin (`com.elgato.discord.mute` etc., empty settings, a one-time
  Authorize in Discord); built-in Multimedia (volume, media keys), timer/clock, websites
  (UEX, Erkul, SPViewer, SCMDB); Star Citizen's own comms binds (`research/starcitizen.md` 3:
  push to talk Numpad +, proximity PTT LAlt+Numpad +, chat F12, CommLink F11, hail 9...).
  There's no game bind for VoIP mute. Missing plugins show "?" and offer an install; they
  never break the import.
- **Ground rules:** no Multi Action, Text, Delay or Key Logic double/hold actions (they
  automate). A dial detent counts as one tap (one press per detent): approved by the owner.
- **Star Citizen 4.x keys:** research found the deck still sends several 3.x defaults (Decoy
  `g` → `h`, Noise `h` → `j`, Flight Ready `r` → `ralt+r`, Request Docking → `ralt+n`, five
  scActions that no longer exist, profile binds that collide with 4.10 defaults). Verified
  against the game's 4.10 `defaultProfile.xml`. A workflow is fixing `layouts/hud.json` and
  `tools/make-profile.js` (audit, skeptic, apply, re-audit); the pack's hotkeys come from the
  fixed keys.

## Status

**Merged into main as Tablet Deck 1.7.0** (PR #1, merge commit 5da2ebd, 2026-11-06). package.json,
the lockfile, the plugin's source manifest and CHANGELOG (`## 1.7.0 (2026-11-06)`) all say 1.7.0.
**Not released yet:** this session's GitHub access couldn't push the `v1.7.0` tag or start the
Release workflow (403), so the owner publishes it: Actions > Release > Run workflow on `main`
with "Publish" ticked (it creates the tag), or `git tag v1.7.0 origin/main` and push the tag.

| piece | state | where |
|---|---|---|
| Key art | done: cut-corner themes fixed, quiet tabs, labels sized from each font's real letter widths, Origin contrast | `streamdeck/keyart.js` |
| Catalog (172 actions) and scenes for 7 models | done, after a five-lens critique (6976b22): fixed slots on the + XL, knob-rule dials, Emergency kept apart | `streamdeck/catalog.js`, `streamdeck/scenes.js` |
| Generator | done: 84 profiles at 144 px, 12 icon packs (222 icons plus 21 animated GIFs each, 059a805), keybinds, plugin, previews, `--check`, `--release` | `tools/make-streamdeck.js`, `tools/streamdeck/` |
| Plugin | done: all tests pass (rules 30 with two-way scene sync), MinimumVersion 7.3 | `streamdeck/plugin/` |
| Two-way scene sync | done (6cb89c8, f3ade20): tablets follow Stream Deck scenes and Stream Decks follow tablet pages, no echo | `server.js`, `public/`, plugin |
| Server press safety | done: mixing taps take turns, presses against a held modifier are skipped, half-open sockets dropped, a held tablet button lets go across HUD redraws (cf09b53) | `server.js`, `public/app.js` |
| Release workflow | builds the pack after the installer (non-blocking) and attaches 9 downloads | `.github/workflows/release.yml` |
| Docs | README section with a + XL picture, DEVELOPMENT, DESIGN, CHANGELOG, site card | |

## Next steps

1. Publish 1.7.0 (above), then check the run: the Stream Deck step is new on GitHub's runner. If
   it fails, the release still goes out without the pack; fix and attach the zips by hand.
2. Hardware checks (README "Not tried on a real Stream Deck yet", the plugin's and generator's
   reports): profile import, theme keys after import, dial order and one press per notch, the
   + XL model id and strip, right-hand modifiers, the plugin's first switch to its profiles,
   the brightness dial inside an Action Trigger, GIFs playing from the icon packs.
3. In game (Star Citizen 4.10): the buttons marked `"verify": true` in `layouts/hud.json`.
4. Possible simplification: the plugin queues all its presses strictly; the server now schedules
   only presses that could mix, so the plugin could send non-clashing taps at once.
5. Small leftovers from the critique: the + XL On Foot and Comms pages leave one or two dials
   empty (the knob rule left nothing that sets a level or cycles there); the plugin lists two
   presets called "Voice Channel" (`channel`, `channelFoot`); `actions.js` and `pi.js` still use
   red as Hold to Talk's fallback colour (the catalog now makes it blue).

## Earlier work in this session (for context)

Committed and pushed on the same branch, all in PR #1: connection fixes (heartbeat
answers, dead-link detection, latency readout, pairing-code change handling), HUD
offline/blocked feedback, Key labels, button sounds on by default with **Play on: PC**
(a tablet's sounds can play on one of the PC's outputs, e.g. a headset, through
`native/sound.exe`).

A five-lens review of PC sounds (each lens checked by a skeptic) confirmed 19 low/medium
findings. The server, tablet and docs ones are fixed and committed ("Fix the PC sounds
review findings..."): ids taken after validation and wrapped, no control characters in
output names, the player built at start, stopped sounds still counting against the
limits, a cap across all tablets, half level and 8 tone-seconds at most, no duplicate
push-to-talk chimes, tone phase, Sounds list language and labels, docs. The player
(`native/sound.cs`) ones were being fixed by a workflow at the time of writing: skip
sounds stopped before rendering, answer `devices` without waiting for renders, overall
caps, a lower limiter ceiling, fall back to the default output when a named one can't be
opened. Check `git log -- native/sound.cs` for whether that landed.

How to re-test PC sounds without Windows (scripts were in the scratchpad, recreate if
gone): copy the repo, put a fake `native/sound.exe` (a Node script that prints `ready`,
answers `devices\t<pref>\t<names>` and logs every line) with a newer mtime than
`native/sound.cs`, run `node server.js --dry-run --port 8797` there and drive the deck
with Playwright; compile `native/sound.cs` with Mono's `mcs -langversion:5` to check
C# 5, and render its `Synth` under Mono to compare with the tablet's Web Audio.
