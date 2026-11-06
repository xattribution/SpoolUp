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

- **Where it lives:** `streamdeck/` in this repo (sources) and `tools/make-streamdeck.js`
  (generator, planned). Built packs go to `dist/streamdeck/` (not committed: the mega
  pack is large). Same branch and PR as the rest of this session's work.
- **No new runtime dependencies**, as for the server: the plugin is plain Node (no
  `@elgato/streamdeck`, no bundler) if the raw Stream Deck WebSocket protocol allows it
  (being confirmed by research). The generator renders PNGs by driving an installed
  Edge/Chrome over the DevTools protocol, like `tools/record-demo.js`, so no npm
  packages either.
- **Key art:** `streamdeck/keyart.js` (done, committed). 144x144 SVG keys from simple
  shapes only (Stream Deck's SVG renderer is limited: no filters/masks/CSS; glows are
  layered strokes). Reads each theme's tokens straight from `public/themes.css`.
  Pre-rendered images use the theme's Google font (fetched at build time, like the
  tablet does); live plugin keys use Windows fonts (Bahnschrift, Georgia, Impact...).
- **New icons** go into `public/icons.js`, so the tablet's layout editor gets them too.
  Original designs only: no Discord/OBS/brand logos (docs/DESIGN.md).
- **Ground rule to confirm with the owner:** "one press per tap". Plan: a dial detent
  counts as one tap (one press per detent). No macros/multi-actions in the pack.
- **Standalone vs integrated themes:** without the plugin, images are static, so each
  theme is its own profile per model and the Themes folder's keys switch profiles; with
  the plugin, the Themes keys re-skin every key live.

## Status

| piece | state | where |
|---|---|---|
| Key art renderer | done (first pass), previewed across all 12 themes | `streamdeck/keyart.js` |
| New icons (~70: emotes, ship, comms/media, scenes/navigation) | being designed by a workflow (designers, art director, fix pass); not merged yet | scratch `icons-new/*.json` → merge into `public/icons.js` |
| Research: SDK/protocol, devices, profile format, icon packs, navigation actions, Discord & standard plugins, Star Citizen comms binds | drafts written, fact-checks running | scratch `streamdeck-research/*.md` → to be copied to `streamdeck/research/` |
| Action catalog (every action, with icon, colour, keys, category) | not started | planned `streamdeck/catalog.js` |
| Scene layouts per model | not started (waiting for the verified device matrix) | planned `streamdeck/scenes.js` |
| Plugin | not started | planned `streamdeck/plugin/` |
| Generator (icon pack, mega pack, plugin package) | not started | planned `tools/make-streamdeck.js` |
| Server support for the plugin | not started | `server.js` (a `device=streamdeck` client, scene messages) |
| Docs (README, CHANGELOG, DEVELOPMENT, DESIGN) | not started | |

Scratch paths are under this session's scratchpad, which goes away with the container:
copy anything worth keeping into the repo (the research notes especially).

## Next steps

1. Read the verified research (`streamdeck/research/*.verified.md` once copied) and fix
   the formats: plugin manifest and protocol, device grids and key sizes, profile file
   layout and the Hotkey/folder/page/switch-profile action settings, icon pack layout.
2. Merge the new icons into `public/icons.js` (check names don't collide; the editor
   lists them all).
3. Write the catalog and the scene layouts per model (Mini 3x2 ... XL 8x4, Plus with 4
   dials and touch strip, Studio, Neo, Pedal, Mobile), with navigation keys, a Themes
   folder and a Comms page.
4. Write the generator; build the icon pack and one model's profile first, then check
   the files against the research's real exported profiles before generating all of
   them.
5. The plugin, then the server support, then docs; commit as each piece works.

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
