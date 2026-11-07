# Stream Deck plugin SDK and wire protocol (verified, state as of 2026-11-06)

Research for the Tablet Deck Stream Deck pack. Scope: manifest, image rules, the raw
WebSocket protocol (plugin and property inspector), encoder / touch strip / Neo layouts,
packaging, localization.

This is the fact-checked version of `sdk.md` (the first draft is kept unchanged next to it).
On 2026-11-06 I re-fetched every primary source myself and rechecked each claim our build
depends on:

- the live schemas `manifest@0.6.0` and `layout@0.6.0`, diffed branch by branch;
- a fresh clone of `elgatosf/streamdeck` (same commit, `9d9636e`, 2026-11-05);
- 23 docs.elgato.com pages (all "Version 3.0.0");
- the npm registry, nodejs.org, and the Node docs.

I validated the examples with ajv and re-ran the plugin skeleton against the fake server.
My working files are under
`<scratch>/verify/`.

## Changes from the first draft

**Corrections**

1. **Plugin skeleton argument parsing** (§5.1, §5.4).
   - The draft read `process.argv` in fixed pairs from index 2. A single unpaired flag breaks
     that: it then sends `{"event": undefined}` and never registers. I reproduced this against
     the fake server.
   - `@elgato/streamdeck` scans for the four known flags and skips anything else; its own
     tests include a stray `-bool`.
   - The skeleton below now scans the same way. **[tested locally]**
2. **Dial titles** (§5.3). The official SDK sets a dial's title with `setFeedback({ title })`,
   not `setTitle` (`packages/plugin/src/actions/dial.ts`). What raw `setTitle` does on an
   Encoder context is undocumented. **[primary: SDK source]**
3. **`showOk` is key-only** (§5.3). The SDK exposes `showOk` only on key actions. Dials have
   `showAlert` (shown on the touch strip); Neo actions have neither. **[primary: SDK source]**
4. **`setTriggerDescription`** (§5.3). The draft said an omitted field hides that line. The two
   primary sources disagree about an empty payload:
   - the wire docs: "when undefined, the description will not be shown";
   - the SDK's `dial.ts`: calling it with no descriptions sends `{}` and "the descriptions will
     be reset to the values provided as part of the manifest".

   Which one wins for `{}` is **unconfirmed**.
5. **Neo layouts must be a file** (§6). The SDK says a Neo Infobar's `setFeedbackLayout` "must be
   a path to a local layout JSON file". Built-in `$X1`…`$C1` layouts are for dials only.
   **[primary: SDK source]**
6. **Dial `setImage`** sets the image shown in the Stream Deck app (the dial's canvas), not
   the touch strip. It takes no `target`/`state`. **[primary: SDK source]**
7. **Example manifest** (§2.5). The dial action now also sets
   `"SupportedInKeyLogicActions": false`, matching the draft's own ground-rule note. I added a
   validated 7.6 variant with a Neo action (§2.5).
8. **Citations**:
   - The `timerUpdate` removal is in the elgato.com 7.6 article, not the WebSocket changelog.
   - Message identifiers (7.1) come from the "Upgrading to v3" page; the 7.1 changelog doesn't
     list them.
   - "SDK 3.0" is the npm package (`@elgato/streamdeck` 3.0.0), not a changelog line.
9. **7.6 release date**, downgraded. The draft said "came out on 22 Sep 2026", but that is the
   article's "Last updated" date. `@elgato/streamdeck` 3.0.0 and `@elgato/cli` 1.10.0 were
   published to npm the same day, so it's very likely but **not stated** as the release date.
10. **"Plugin refuses to load on 7.1–7.5 with a Neo action"**, downgraded to **[inferred]**. The
    schema forces `MinimumVersion` 7.6; what the app does with an older version isn't documented
    here.
11. **Real sample packages** (§9.1). Elgato's prebuilt `.streamDeckPlugin` files are **older
    builds** (`SDKVersion 2`, `MinimumVersion 6.5`), unlike their SDK 3 / 7.1 source manifests.
    So they don't by themselves prove an SDK 3 package installs by double-click. Better
    evidence: the current CLI template (`streamdeck create`) emits SDK 3 / 7.1 / Node 24, which
    `streamdeck pack` turns into exactly this ZIP. **[primary + inferred]**
12. **PI `context`** (§7.2).
    - The docs describe it as "the action instance identifier" (settings, `sendToPlugin`) and
      "the plugin's identifier, as provided by Stream Deck" (global settings).
    - sdpi-components 4.0.1, which Elgato bundles in its own product-viewer example, sends the
      registration `uuid` as `context` for **every** command. The draft's advice stands, now
      labeled **[real files]**.
    - Whether `uuid === actionInfo.context` is **undocumented**.

**Upgrades**

- "Have a 'Save' button" in the PI guidelines is a confirmed **don't**: it sits in the HTML's
  `bad_` list. **[primary]**
- The Node patch versions (20.20.2, 24.22.1, 26.12.1) are real nodejs.org releases from
  2026-03-24, 2026-10-20 and 2026-10-21. Newer ones exist (24.22.2, 26.13.0), so the
  auto-updated runtime moves. **[primary]**

**Gaps filled**

- **Galleon 100 SD dials take dial actions.** Elgato's Dial Stack article (2026-07-09) says
  "Dial Stack only works on Stream Decks with a dial, such as Stream Deck +, Stream Deck + XL,
  or GALLEON 100 SD", and "Dial Stacks work with actions that support Stream Deck + dials".
  Layouts on its LCD remain unconfirmed. **[primary]**
- **Elgato's docs PI sample is broken.** The "Manually" sample is a **SyntaxError**
  (`const actionInfo = JSON.parse(actionInfo)` redeclares a parameter); `node --check` fails.
  Don't copy it.
- **CLI template defaults** (`packages/cli/template`): SDKVersion 3, MinimumVersion "7.1",
  Nodejs "24", `bin/package.json` `{"type":"module"}`. **[primary]**
- **A ZIP from Node built-ins is valid.** A ~30-line writer (`zlib.deflateRawSync` +
  `zlib.crc32`) produces a ZIP that `unzip -t` and Python's `zipfile` accept, shaped like
  Elgato's: deflate, file entries only, UTF-8 flag, plus a fixed valid DOS date.
  `zlib.crc32` needs Node ≥ 20.15 / 22.2. Install by Stream Deck is still untested.
  **[tested locally]**
- **Re-confirmed** with no change:
  - every schema rule;
  - the 7.1→7.6 branch table;
  - the built-in layout definitions;
  - the wire types of every event and command;
  - the image sizes and formats, and the 10-per-second guideline;
  - the localization format;
  - the CLI's pack and validate behavior, and its default ignore list;
  - the install paths and the developer-mode registry key;
  - the Node `WebSocket` and EOL facts;
  - the hardware pixel sizes.

**Confidence labels**

- **[primary]**: confirmed in a primary Elgato source (docs.elgato.com, schemas.elgato.com,
  elgatosf GitHub source code).
- **[real files]**: seen in real files (Elgato sample plugins, third-party repos) but not
  stated as a rule.
- **[inferred]**: my conclusion from the evidence. Not confirmed.
- **[tested locally]**: I ran it here on Linux with Node 22 against a fake Stream Deck
  server. **This is not a test against the real Stream Deck app.**

## 0. TL;DR

1. **The raw protocol is still official and documented.** docs.elgato.com has a "WebSocket API"
   reference for plugins and for the property inspector (docs version 3.0.0). It describes
   native plugins (C#, C++…) that speak it directly. Elgato's own Node SDK (`@elgato/streamdeck`
   3.0.4) is a thin layer over the same JSON messages, sent with the `ws` package. A Node plugin
   that does this itself, using only built-in modules, is fully possible. **[primary]**
2. **Current versions**:
   - Stream Deck app 7.6. Elgato's 7.6 article is dated 22 Sep 2026, the same day
     `@elgato/streamdeck` 3.0.0 reached npm; the exact release date isn't stated.
   - Manifest schema 0.6.0 accepts `Software.MinimumVersion` "6.4"…"7.6" (exact strings; "7.6.0"
     fails).
   - `SDKVersion` is 2 or 3 (3 recommended, and the CLI template's default).
   - `Nodejs.Version` is "20" | "24" | "26"; 24 and 26 need `MinimumVersion` ≥ "7.1".
   - Bundled runtimes on 7.1–7.6: Node 20.20.2, 24.22.1 and 26.12.1, which are real nodejs.org
     releases and auto-update. Property inspectors run in Chromium 130 (140 on 7.6).

   **[primary]**
3. **Global `WebSocket` in Node**:
   - Node 22.0 and later: on by default.
   - Node 20.10–20.x: only with `--experimental-websocket`. Stream Deck does not pass that flag.
   - So use **`"Nodejs": {"Version": "24"}` with `MinimumVersion "7.1"`** and the global
     `WebSocket` works. Choose Node 20 only if you must, and then write your own tiny client with
     `net` + `crypto`.
   - Node 20 itself reached end of life on 2026-04-30.

   **[primary + inferred]**: the Node versions and flags are confirmed. That Stream Deck passes
   no extra flags is my reading of the documented flag list.
4. **Images**:
   - Key images are 72×72 with an `@2x` version at 144×144, as PNG, SVG or GIF in the manifest.
   - `setImage` takes a file path, a data URL (SVG, PNG, JPEG or WEBP) or SVG text.
     **It does not accept animated formats.** Animated GIFs work only as images in the
     manifest or icon pack, so plugin animation means sending frames with `setImage`.
   - Elgato's guidelines: **at most 10 programmatic updates per second**, for keys and touch
     strips alike.

   **[primary]**
5. **Layouts**:
   - The canvas is 200×100 per dial on Stream Deck + and + XL, and 232×50 on the Neo Infobar
     (Stream Deck 7.6 and later; display only, no input events).
   - Built-in layouts: `$X1`, `$A0`, `$A1`, `$B1`, `$B2` and `$C1`. Their exact item keys and
     `rect`s are in §6.
   - A layout will not render if any item goes out of bounds, or if two items overlap on the
     same `zOrder`.

   **[primary]**
6. **Packaging**:
   - A `.streamDeckPlugin` file is a plain ZIP. Every entry sits under the folder
     `<uuid>.sdPlugin/`, compressed with deflate.
   - The CLI only validates the folder, then zips it, removing `Nodejs.Debug` from the manifest.
   - A hand-made ZIP with the same layout should install: a third-party tool does exactly this.

   **[primary for the CLI behavior; real files for the hand-made ZIP]**

---

## 1. Where things live now (2025–2026 changes)

| Fact | Source | Conf. |
|---|---|---|
| `elgatosf/schemas` and `elgatosf/cli` repos now say "This repository has now moved to the Stream Deck SDK repository": everything (CLI, schemas, Node SDK, samples) is the monorepo `elgatosf/streamdeck` (`packages/cli`, `packages/core`, `packages/plugin`, `packages/schemas`, `examples/`). Last commit I cloned: `9d9636e`, 2026-11-05. | https://github.com/elgatosf/schemas (README), https://github.com/elgatosf/cli (README), https://github.com/elgatosf/streamdeck | primary |
| Package versions in the monorepo: `@elgato/streamdeck` 3.0.4, `@elgato/cli` 1.10.4, `@elgato/schemas` 0.6.0. The wire types are in a new internal package `@streamdeck/core` (`packages/core/src`). | `packages/*/package.json` | primary |
| Schema `$id`: `@elgato/schemas/streamdeck/plugins/manifest@0.6.0` and `…/layout@0.6.0`. | https://schemas.elgato.com/streamdeck/plugins/manifest.json, https://schemas.elgato.com/streamdeck/plugins/layout.json | primary |
| Stream Deck 7.6: Neo Infobar actions; manifest `Controllers` may include `"Neo"` (WebSocket changelog). The 7.6 article ("Last updated: September 22, 2026") adds: "the undocumented `timerUpdate` event has been removed from WebEngine SDK" (the old HTML-plugin runtime). `@elgato/streamdeck` 3.0.0 and `@elgato/cli` 1.10.0 were published to npm on 2026-09-22. | https://docs.elgato.com/streamdeck/sdk/references/websocket/changelog, https://www.elgato.com/us/en/explorer/products/stream-deck/stream-deck-76-infobar-actions-for-stream-deck-neo/, https://registry.npmjs.org/@elgato/streamdeck | primary (exact app release date: inferred) |
| 7.1 (changelog): embedded `resources` (`setResources`/`getResources`/`didReceiveResources`), Node.js 24 in the manifest, in-app developer tools for the property inspector, "Fixed device type mapping for Stream Deck Scissor Keys and Corsair keyboards". Message identifiers (`id` on get*/didReceive*) are dated to 7.1 by the v3 upgrade guide, not the changelog. | changelog; https://docs.elgato.com/streamdeck/sdk/upgrading/v3 | primary |
| The CLI template (`packages/cli/template`) emits `"SDKVersion": 3`, `"MinimumVersion": "7.1"`, `"Nodejs": {"Version": "24", "Debug": "enabled"}` and a `bin/package.json` of `{ "type": "module" }`. Elgato's example sources use SDK 3 / 7.1 / Node "20". | `packages/cli/template/com.elgato.template.sdPlugin/manifest.json.ejs`, `rollup.config.mjs.ejs`, `examples/*/manifest.json` | primary |
| 7.0: `deviceDidChange` event, passive deep links (`?streamdeck=hidden`), `SupportedInKeyLogicActions`, Virtual Stream Deck device type 11, and device `size` now reflects the visible size (Mobile / Virtual). | same changelog | primary |
| `@elgato/streamdeck` 3.0.0 (SDK "v3"): Neo Infobar support. `onDidReceiveSettings` / `onDidReceiveGlobalSettings` fire only when the property inspector changes something (needs 7.1). `getSecrets` removed. `useExperimentalMessageIdentifiers` removed (now always on). | `packages/plugin/CHANGELOG.md` | primary |
| Device types now run 0–13. **New in 2025–26: 12 = Galleon 100 SD** (Corsair keyboard: 12 LCD keys in 3×4, an LCD screen and 2 dials) and **13 = Stream Deck + XL** (36 keys in 9×4, 6 dials, touch strip). Stream Deck Scissor Keys reports as type 0. | `packages/schemas/src/streamdeck/plugins/device-type.ts`; https://docs.elgato.com/streamdeck/sdk/guides/devices | primary |
| Naming trap: manifest `"SDKVersion": 3` is unrelated to npm `@elgato/streamdeck` v3. | inferred from the two sources | inferred |

---

## 2. manifest.json

Official schema: **https://schemas.elgato.com/streamdeck/plugins/manifest.json** (draft-07,
`$id …manifest@0.6.0`). Human docs: https://docs.elgato.com/streamdeck/sdk/references/manifest.
Put `"$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json"` at the top; the
schema allows it.

The schema is an `allOf` of `if Software.MinimumVersion == X then {…}` branches, with
**`additionalProperties: false`**. That means:

- A misspelled key is a validation error.
- Which features are allowed depends on `MinimumVersion`.

I diffed the branches. This is what changes **[primary, from the schema]**:

| MinimumVersion | Changes |
|---|---|
| 6.4–6.5 | `SDKVersion` const 2; `Nodejs.Version` const "20" |
| 6.6 | adds `Actions[].OS`, `Profiles[].AutoInstall` |
| 6.9 | `SDKVersion` 2 or 3; adds `SupportURL` (root and action) |
| 7.0 | adds `Actions[].SupportedInKeyLogicActions` |
| 7.1–7.5 | `Nodejs.Version` enum `"20","24","26"` |
| 7.6 | `Controllers` may include `"Neo"` (maxItems 3) |

I validated variants with ajv against the live schema **[tested locally]**:

- `"Neo"` with MinimumVersion 7.1: INVALID.
- `"Nodejs.Version": "24"` with MinimumVersion 7.0: INVALID.
- `Profiles[].ReadOnly` (capital O): INVALID.
- A 3-part `Version`: INVALID.
- An uppercase UUID: INVALID.
- `Icon` with a `.png` extension: INVALID.

### 2.1 Root properties

Required (every branch): `Actions, Author, CodePath, Description, Icon, Name, OS, SDKVersion, Software, UUID, Version`.

| Key | Req | Rule (quoted / paraphrased from schema) |
|---|---|---|
| `UUID` | ✔ | pattern `^([a-z0-9-]+)(\.[a-z0-9-]+)+$`, "reverse DNS format… lowercase alphanumeric characters (a-z, 0-9), hyphens (-), and periods (.)". The CLI makes it an **error** if the folder name `<UUID>.sdPlugin` doesn't match. Guidelines: include the author and plugin name, and never change it after publishing. |
| `Name` | ✔ | Display name. |
| `Version` | ✔ | pattern `^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`: "{major}.{minor}.{patch}.{build}" (4 parts). |
| `Author`, `Description` | ✔ | Strings. |
| `Icon` | ✔ | **PNG only**, extension omitted, 256×256 plus `@2x` 512×512. "displayed within Stream Deck's preferences". |
| `CodePath` | ✔ | File in the plugin folder, **with** its extension (e.g. `bin/plugin.js`). `.cjs`/`.mjs` are supported since 6.5. |
| `CodePathWin` / `CodePathMac` | – | Per-OS entry point. |
| `SDKVersion` | ✔ | `2` or `3` ("version 3 is recommended"). 3 is needed for DRM on Marketplace, together with MinimumVersion ≥ 6.9. |
| `Software.MinimumVersion` | ✔ | One of `"6.4"…"7.6"` (exact string; sets the schema branch). |
| `OS` | ✔ | 1–2 entries, each `{ "Platform": "windows" \| "mac", "MinimumVersion": "10" }`. |
| `Nodejs` | – | `{ Version (req): "20"\|"24"\|"26", Debug?: string, GenerateProfilerOutput?: bool }`, `additionalProperties:false`. `Debug`: `"enabled"` → `--inspect=127.0.0.1:{PORT}`, `"break"` → `--inspect-brk`, or literal args. It applies only in debug mode, and `streamdeck pack` **removes** it. Every Node plugin runs with `--enable-source-maps --no-global-search-paths` (plus `--no-addons` on 6.4 only). |
| `Category` | – | Action-list group. The CLI **warns** if it differs from `Name`. |
| `CategoryIcon` | – | PNG/SVG, extension omitted, 28×28 plus `@2x` 56×56, **monochrome white #FFFFFF on transparent**. |
| `PropertyInspectorPath` | – | `.htm`/`.html` **with** extension. Used by every action that has no own path. |
| `DefaultWindowSize` | – | `[w,h]` for `window.open()` from the property inspector. Default `[500,650]`. |
| `ApplicationsToMonitor` | – | `{ "windows": ["StarCitizen.exe"], "mac": [...] }`. Emits `applicationDidLaunch`/`applicationDidTerminate`. |
| `Profiles` | – | See 2.4. |
| `URL`, `SupportURL` | – | The CLI does a live HEAD request on `URL` (error if the DNS lookup fails). `SupportURL` needs 6.9. |

### 2.2 `Actions[]`

Required: `UUID, Name, Icon, States`.

| Key | Rule |
|---|---|
| `UUID` | Same pattern as the plugin UUID. The CLI makes duplicates an error, and **warns** if the UUID isn't prefixed with `<pluginUUID>.`. |
| `Name`, `Tooltip` | Strings (both localizable). |
| `Icon` | Action-list icon. PNG/SVG, extension omitted, 20×20 plus `@2x` 40×40, monochrome white on transparent. |
| `Controllers` | Array of `"Keypad"`, `"Encoder"` and, from 7.6, `"Neo"`; unique, 1–3 items (1–2 before 7.6). The default when omitted isn't stated in the schema, docs or TS types; Keypad is the traditional default **[inferred]**. A Neo-only action still needs `Icon` and `States` (both required on every action). |
| `States` | minItems 1. "When two states are defined the action will act as a toggle"; `setState` takes "0, or 1". Each state: `Image` (req), `MultiActionImage`, `Name`, `Title`, `ShowTitle`, `TitleColor` (hex), `TitleAlignment` ("top"\|"middle"\|"bottom"), `FontFamily`, `FontSize` (number), `FontStyle` (""\|"Regular"\|"Bold"\|"Italic"\|"Bold Italic"), `FontUnderline`. |
| `States[].Image` | **GIF, PNG or SVG**, extension omitted, 72×72 plus `@2x` 144×144. |
| `States[].MultiActionImage` | PNG/SVG, 72/144. |
| `DisableAutomaticStates` | Default false. Set true when the plugin drives `setState` itself (live state). |
| `SupportedInMultiActions` | Default **true**. |
| `SupportedInKeyLogicActions` | Default **true** (from 7.0). |
| `UserTitleEnabled` | Default true. false = the plugin owns the title. |
| `VisibleInActionsList` | Default true. false = only usable from bundled profiles. |
| `DisableCaching` | Default false (image caching). |
| `PropertyInspectorPath` | Per-action property inspector. |
| `OS` | `["windows"]` / `["mac"]` (from 6.6). |
| `SupportURL` | From 6.9. |
| `Encoder` | `{ layout, background, Icon, StackColor, TriggerDescription }`, see below. |

`Actions[].Encoder` **[primary, schema]**:

- `layout`: `"$X1"|"$A0"|"$A1"|"$B1"|"$B2"|"$C1"`, or a path to a `.json` file **with** its
  extension, e.g. `layouts/dial.json`.
- `background`: PNG/SVG, extension omitted, **200×100 plus `@2x` 400×200**, drawn behind the
  layout on the touch strip.
- `Icon`: PNG/SVG, extension omitted, 72/144. Shown "in the circular canvas that represents the
  dial" in the app.
- `StackColor`: hex. The background color in the app when the action is the current one in a
  dial stack.
- `TriggerDescription`: `{ Rotate, Push, Touch, LongTouch }` (strings, localizable).

> **Tablet Deck note.** The ground rule is "one press per tap, no macros". Set
> `"SupportedInMultiActions": false` and `"SupportedInKeyLogicActions": false` on every action
> that presses game keys. Otherwise users can chain them into Stream Deck multi-actions (macros).
> Both default to `true`. **[inferred recommendation]**

### 2.3 Image path rules

Some properties take extension-less paths: `Icon`, `CategoryIcon`, `States[].Image`,
`Encoder.Icon`, `Encoder.background` and `Profiles[].Name`. Stream Deck resolves the extension
itself. The CLI resolves `<path>.png` / `<path>.svg` / `<path>.gif`:

- If two files match, it warns.
- For a `.png` it **warns** if `<path>@2x.png` is missing.

`CodePath` and `PropertyInspectorPath` need the extension. **[primary: schema +
`packages/cli/src/validation/plugin/rules/manifest-files-exist.ts`]**

### 2.4 `Profiles[]`

Required: `Name, DeviceType`.

```json
"Profiles": [
  { "Name": "profiles/combat-xl", "DeviceType": 2, "Readonly": false,
    "DontAutoSwitchWhenInstalled": true, "AutoInstall": false }
]
```

- **`Name`**: the path to `<Name>.streamDeckProfile`, extension omitted.
- **`DeviceType`**: an integer 0–13.
- **`Readonly`**: lowercase "o". `ReadOnly` fails the schema. Default false.
- **`DontAutoSwitchWhenInstalled`**: default false.
- **`AutoInstall`** (from 6.6): default true. When false, "the profile will be installed the first
  time the plugin attempts to switch to it".
- Users are prompted to install bundled profiles.
- **Plugins can only switch to their own bundled profiles, never to user profiles.**

**[primary]** Sources: https://docs.elgato.com/streamdeck/sdk/guides/profiles and the schema.
Real example: `examples/lights-out/com.elgato.lightsout.sdPlugin/manifest.json`, which bundles
6 profiles for device types 0, 2, 1, 9, 7 and 3.

Inside, a `.streamDeckProfile` is itself a ZIP: `<UUID>.sdProfile/manifest.json`,
`Profiles/<ID>/manifest.json`, `Profiles/<ID>/Images/`. **[real files]**, from the
lights-out sample. The profile format is a separate research topic.

### 2.5 Recommended manifest for Tablet Deck (validated against the live schema)

This file is **VALID** against `manifest@0.6.0` **[tested locally with ajv]**. The UUID and paths
are placeholders. It is the draft's file with one change: the dial action also sets
`"SupportedInKeyLogicActions": false`. Copy:
`<scratch>/verify/examples/manifest.json`.

```json
{
	"$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
	"UUID": "com.example.tablet-deck",
	"Name": "Tablet Deck",
	"Version": "1.0.0.0",
	"Author": "Tablet Deck",
	"Description": "Live Star Citizen controls from Tablet Deck.",
	"Icon": "imgs/plugin/icon",
	"Category": "Tablet Deck",
	"CategoryIcon": "imgs/plugin/category",
	"CodePath": "bin/plugin.mjs",
	"SDKVersion": 3,
	"Software": { "MinimumVersion": "7.1" },
	"OS": [{ "Platform": "windows", "MinimumVersion": "10" }],
	"Nodejs": { "Version": "24" },
	"PropertyInspectorPath": "ui/inspector.html",
	"Actions": [
		{
			"UUID": "com.example.tablet-deck.button",
			"Name": "Deck button",
			"Icon": "imgs/actions/button/list",
			"Tooltip": "Presses a Tablet Deck button, with live state.",
			"Controllers": ["Keypad"],
			"DisableAutomaticStates": true,
			"SupportedInMultiActions": false,
			"SupportedInKeyLogicActions": false,
			"States": [
				{ "Image": "imgs/actions/button/off", "Name": "Off", "TitleAlignment": "bottom", "ShowTitle": true, "FontSize": 10 },
				{ "Image": "imgs/actions/button/on", "Name": "On", "TitleAlignment": "bottom", "ShowTitle": true, "FontSize": 10 }
			]
		},
		{
			"UUID": "com.example.tablet-deck.dial",
			"Name": "Deck dial",
			"Icon": "imgs/actions/dial/list",
			"Tooltip": "Turn for one press per detent.",
			"Controllers": ["Encoder"],
			"SupportedInMultiActions": false,
			"SupportedInKeyLogicActions": false,
			"States": [{ "Image": "imgs/actions/dial/key" }],
			"Encoder": {
				"layout": "layouts/dial.json",
				"background": "imgs/actions/dial/strip",
				"Icon": "imgs/actions/dial/icon",
				"StackColor": "#0E1A24",
				"TriggerDescription": { "Rotate": "Adjust", "Push": "Toggle", "Touch": "Toggle", "LongTouch": "Reset" }
			}
		}
	],
	"Profiles": [
		{ "Name": "profiles/combat-xl", "DeviceType": 2, "Readonly": false, "DontAutoSwitchWhenInstalled": true, "AutoInstall": false }
	]
}
```

**Neo Infobar decision.**

- Adding `"Neo"` to any action's `Controllers` fails the schema unless
  `"MinimumVersion": "7.6"` **[primary, tested with ajv]**.
- The manifest has only one `MinimumVersion`, so the whole plugin then targets 7.6. The app most
  likely won't load or install it on 7.1–7.5 **[inferred: the app's behavior isn't documented
  in what I read]**.
- So there are two options: ship one plugin at 7.6, or leave the Neo action out.

This 7.6 variant is **VALID** (ajv): the manifest above with `"MinimumVersion": "7.6"` plus this
action. The same action under `"MinimumVersion": "7.1"` is **INVALID**. Copy:
`<scratch>/verify/examples/manifest-neo-7.6.json`.

```json
{
	"UUID": "com.example.tablet-deck.status",
	"Name": "Deck status",
	"Icon": "imgs/actions/status/list",
	"Tooltip": "Shows the Tablet Deck link on the Neo Infobar.",
	"Controllers": ["Neo"],
	"SupportedInMultiActions": false,
	"SupportedInKeyLogicActions": false,
	"States": [{ "Image": "imgs/actions/status/key" }]
}
```

Other negative cases I checked with ajv: `"Nodejs": {"Version": "22"}` and `"MinimumVersion":
"7.6.0"` are both INVALID.

---

## 3. Node.js runtime facts

Source: https://docs.elgato.com/streamdeck/sdk/introduction/plugin-environment **[primary]**

| Stream Deck | Node.js (application) | Chromium (property inspector) |
|---|---|---|
| 7.6 | 20.20.2, 24.22.1, 26.12.1 | 140.0.0.0 |
| 7.1–7.5 | 20.20.2, 24.22.1, 26.12.1 | 130.0.0.0 |
| 7.0 / 6.9 | 20.19.0 | 122.0.6261.171 |
| 6.8 | 20.18.0 | 118 |
| 6.7 | 20.15.0 | 118 |
| 6.5–6.6 | 20.8.1 | 108 / 112 |
| 6.4 | 20.5.1 | 102 |

The page also says: "From Stream Deck 7.1, Node.js versions are automatically updated to the
latest versions supported by Stream Deck." That is why 7.1 lists Node 26 although 7.1 came out
before Node 26 existed.

**Patch numbers verified** against https://nodejs.org/dist/index.json:

- 20.20.2 (2026-03-24), 24.22.1 (2026-10-20) and 26.12.1 (2026-10-21) are all real releases.
- Newer ones already exist: 24.22.2 (2026-10-27) and 26.13.0 (2026-10-28).
- So treat the table as "latest supported at the time", not a pin.

**[primary]**

**Node release lines** (https://github.com/nodejs/Release/blob/main/schedule.json) **[primary]**:

| Line | End of life / status |
|---|---|
| v20 | EOL **2026-04-30** |
| v24 | LTS since 2025-10-28; maintenance from 2026-10-20; EOL 2028-04-30 |
| v26 | LTS since 2026-10-28; EOL 2029-04-30 |

**Global `WebSocket`** (https://github.com/nodejs/node/blob/main/doc/api/globals.md#class-websocket)
**[primary]**:

- Added in v21.0.0 and v20.10.0, **behind `--experimental-websocket`**.
- v22.0.0: "No longer behind `--experimental-websocket` CLI flag".
- v22.4.0: "No longer experimental".

What this means for the plugin:

- **Node 24/26 runtime**: `new WebSocket(url)` works with no flags.
- **Node 20 runtime**: not available. Stream Deck documents only `--enable-source-maps` and
  `--no-global-search-paths` as the flags it passes. `Nodejs.Debug` arguments apply only in debug
  mode and are removed when packing. So you can't add `--experimental-websocket` for users.
  **[inferred from the primary sources]**
- **Decision**: `"Nodejs": {"Version": "24"}` + `"MinimumVersion": "7.1"`. This is exactly what
  Elgato's current CLI template generates **[primary]**. If Node 20 must be supported, write a
  ~100-line RFC 6455 client on `net` + `crypto`. Client frames must be masked; server frames
  are not.
- **Build-time note**: our generator's ZIP writer needs `zlib.crc32`, which arrived in Node
  20.15.0 / 22.2.0 (https://github.com/nodejs/node/blob/main/doc/api/zlib.md) **[primary]**.
  AGENTS.md says the build needs "Node 20 or newer", so either require 20.15+ or ship a
  256-entry CRC table.

**Other runtime facts**

- **Working directory is the plugin folder** **[inferred, high; the official SDK depends on it]**. The official SDK reads
  `manifest.json` and `<lang>.json` from `process.cwd()`, and writes logs to `cwd/logs`. Its
  plugin UUID helper is `path.basename(process.cwd())` minus `.sdPlugin`. Source:
  `packages/plugin/src/manifest.ts`, `i18n.ts`, `logging/index.ts`, `common/utils.ts`.
- **ESM**: Elgato's template writes `bin/package.json` = `{ "type": "module" }` next to
  `bin/plugin.js` **[real files]**. A `.mjs` `CodePath` works without that file (`.cjs`/`.mjs`
  supported since 6.5) **[primary]**.
- **DRM** (Marketplace only, after the upload is processed in Maker Console):
  - Files are encrypted and "Your plugin's manifest is a protected asset… Don't: Access the
    manifest JSON file at runtime".
  - "Files distributed with your plugin are immutable".
  - "DRM protection is available to all Stream Deck SDK libraries, such as C#, C++, and Go".

  So never read `manifest.json` at runtime, and never write inside the plugin folder (logs
  excepted). Source: https://docs.elgato.com/streamdeck/sdk/introduction/distribution
  **[primary]**
- **Log locations**:
  - The SDK writes `<plugin>.sdPlugin/logs/<uuid>.N.log` (rotates, 10 files of 50 MB).
  - Stream Deck's own logs are at `%appdata%\Elgato\StreamDeck\logs\StreamDeck0.log`.
    **[primary]**
- **Installed plugins**:
  - Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\<uuid>.sdPlugin`.
  - macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins`.
  - `streamdeck link` makes a **junction** there.
  - Developer mode = registry `HKCU\Software\Elgato Systems GmbH\StreamDeck` `developer_mode`=1.
  - CLI restart/stop use the deep links `streamdeck://plugins/restart/<uuid>` and
    `streamdeck://plugins/stop/<uuid>`.

  **[primary: `packages/cli/src/stream-deck.ts`, `commands/dev.ts`, `commands/restart.ts`]**

---

## 4. Image rules

| Image | Formats | Size (1x / @2x) | Notes | Source |
|---|---|---|---|---|
| Plugin `Icon` | PNG only | 256 / 512 | – | schema |
| `CategoryIcon` | PNG, SVG | 28 / 56 | white #FFFFFF on transparent | schema, guidelines |
| `Actions[].Icon` | PNG, SVG | 20 / 40 | white on transparent; "auto-adjusted by Stream Deck" | schema, guidelines |
| `States[].Image` | **GIF**, PNG, SVG | 72 / 144 | key image | schema |
| `States[].MultiActionImage` | PNG, SVG | 72 / 144 | – | schema |
| `Encoder.Icon` | PNG, SVG | 72 / 144 | dial circle in the app | schema |
| `Encoder.background` | PNG, SVG | **200×100 / 400×200** | touch-strip slot | schema |
| `setImage` (keys; on a dial it sets the image shown in the Stream Deck app, not the strip) | path, or data URL `image/svg+xml` (recommended), `image/png`, `image/jpeg`, `image/webp`, or raw SVG text | one size only; "provide an image that uses the higher DPI dimensions; Stream Deck will scale" (i.e. 144×144) | **"The `setImage` function does not support animated image formats, such as GIF."** | https://docs.elgato.com/streamdeck/sdk/guides/keys, https://docs.elgato.com/guidelines/stream-deck/plugins |
| `pixmap` layout item | path, base64 data URL with MIME type, or SVG | item rect | – | layout schema |
| Icon pack icons | SVG, PNG, JPEG (static); **GIF, WEBP (animated)** | **144×144** | file name ≤ 80 chars; animations **10–20 fps**, ≤ 5 s, ideally ≤ 1 MB | https://docs.elgato.com/stream-deck/icons/getting-started |

- **@2x naming** is `name.png` + `name@2x.png`. The CLI warns when the `@2x` file is missing; an
  SVG needs no `@2x`. **[primary: CLI rule]**
- **Animated GIF in the manifest**: "animated (GIF) images may also be specified within the
  manifest, but cannot be used when programmatically updating actions." **[primary]** (plugin
  guidelines, "Key Icons").
- **Rate limit**: "programmatic flooding — keys are not intended for rendering high frame rate
  videos; **limit programmatic calls to a maximum of 10 per second**". The same sentence appears
  for touch-strip layouts. **[primary]**: https://docs.elgato.com/guidelines/stream-deck/plugins.
  No hard server-side limit is documented. The safe plan:
  - animate at ≤ 10 fps per key;
  - animate only visible contexts (between `willAppear` and `willDisappear`);
  - keep everything else static. **[inferred]**
- **Display precedence**: user image/title > `setImage`/`setTitle` > manifest. "The image can only
  be set by the plugin when the user has not specified a custom image." **[primary]**
- **No size limit is documented** for `setImage` payloads or WebSocket messages. Keep SVG data
  URLs small (a few KB). **[unconfirmed]**
- **Hardware pixel sizes**, from Elgato's HID docs (Stream Deck scales; useful for design)
  **[primary]**:

  | Device | Key image | Strip / infobar |
  |---|---|---|
  | Classic / MK.2 / Scissor | 72×72 | – |
  | XL | 96×96 | – |
  | Neo | 96×96 | infobar 248×58 on hardware; SDK layout canvas 232×50 |
  | Stream Deck + | 120×120 | strip 800×100 = 4 × 200×100 |
  | Stream Deck + XL | 112×112 | strip 1200×100 = 6 × 200×100 |

  Sources: https://docs.elgato.com/streamdeck/hid/stream-deck-classic, …/stream-deck-xl,
  …/stream-deck-neo, …/stream-deck-plus, …/stream-deck-plus-xl. Mini isn't on those pages.

---

## 5. The raw WebSocket protocol (plugin side)

Primary references:

- https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin ("Stream Deck provides an
  API for distributing plugins as native console apps… with communication being handled by a
  dedicated WebSocket connection")
- The TypeScript wire types in `elgatosf/streamdeck/packages/core/src/{command.ts, events/*.ts,
  registration/*.ts, layout.ts, device.ts, target.ts}`
- `packages/plugin/src/connection.ts`, which shows the official SDK just does
  `new WebSocket("ws://127.0.0.1:" + port)` (npm `ws`) and `send(JSON.stringify(cmd))`.

### 5.1 Launch arguments and registration **[primary]**

Stream Deck runs the `CodePath`:

```
node [--enable-source-maps --no-global-search-paths] bin/plugin.mjs -port 28196 -pluginUUID <opaque id> -registerEvent registerPlugin -info "<json>"
```

The arguments `-port`, `-pluginUUID`, `-registerEvent` and `-info` each come with a value, in no
guaranteed order. The Node flags go to `process.execArgv`, not `process.argv`.

How the SDK parses them (`packages/plugin/src/connection.ts`):

- It walks the whole `argv`, takes the next value after each of the four known flags, and
  steps over anything else one item at a time.
- Its tests feed it an extra pair (`-other "Hello world"`) and a lone flag (`-bool`), and it
  still connects.
- **So don't parse in fixed pairs**: one unpaired flag shifts every later pair. I reproduced the
  draft skeleton failing to register this way. **[primary + tested locally]**

The value of `-registerEvent`:

- The current docs only call it "Name of the registration event" and don't give the value.
- Older docs and native samples used `registerPlugin` **[real files / older docs]**. The
  property inspector's value is `registerPropertyInspector` (sdpi-components source comment).
- Always echo whatever you were given.

Connect to `ws://127.0.0.1:<port>`, then send:

```json
{ "event": "<-registerEvent value>", "uuid": "<-pluginUUID value>" }
```

`-info` (RegistrationInfo):

```json
{
  "application": { "font": "…", "language": "en", "platform": "windows", "platformVersion": "10", "version": "7.6.0.xxxx" },
  "colors": { "buttonMouseOverBackgroundColor": "#…", "buttonPressedBackgroundColor": "#…", "buttonPressedBorderColor": "#…", "buttonPressedTextColor": "#…", "highlightColor": "#…" },
  "devicePixelRatio": 1,
  "devices": [ { "id": "…", "name": "Stream Deck +", "size": { "columns": 4, "rows": 2 }, "type": 7 } ],
  "plugin": { "uuid": "com.example.tablet-deck", "version": "1.0.0.0" }
}
```

- `language` ∈ `de, en, es, fr, ja, ko, zh_CN, zh_TW`.
- `devices` "may include devices that are not currently connected. Use `deviceDidConnect`".

**`context` values**:

- An action instance's `context` "is not guaranteed to persist across app cycles". Don't store it.
- For plugin-wide commands (`getGlobalSettings`, `setGlobalSettings`, `switchToProfile`), set
  `context` to the **`-pluginUUID` value**. That is what the SDK does: `settings.ts` and
  `profiles.ts` send `context: connection.registrationParameters.pluginUUID`. The WebSocket
  reference itself only gives the generic "Defines the context of the command" text for these.
  **[primary: SDK source]**
- `openUrl` and `logMessage` have no `context`.

### 5.2 Events (Stream Deck → plugin) **[primary]**

Common fields on action events: `action` (manifest action UUID), `context` (instance id),
`device` (device id), `payload`.

```jsonc
// keyDown / keyUp — single action
{ "event": "keyDown", "action": "com.example.tablet-deck.button", "context": "…", "device": "…",
  "payload": { "controller": "Keypad", "coordinates": { "column": 0, "row": 0 },
               "isInMultiAction": false, "resources": {}, "settings": {}, "state": 0 } }
// keyDown / keyUp — inside a multi-action: no coordinates, has userDesiredState
{ "event": "keyUp", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Keypad", "isInMultiAction": true, "resources": {}, "settings": {}, "state": 0, "userDesiredState": 1 } }

// willAppear / willDisappear — controller "Keypad" | "Encoder" | "Neo"
{ "event": "willAppear", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Encoder", "coordinates": { "column": 2, "row": 0 },
               "isInMultiAction": false, "resources": {}, "settings": {}, "state": 0 } }

// dialRotate (ticks: + clockwise / − counter-clockwise; pressed = rotated while held)
{ "event": "dialRotate", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Encoder", "coordinates": { "column": 0, "row": 0 }, "resources": {}, "settings": {}, "ticks": -2, "pressed": false } }
// dialDown / dialUp (dialPress was removed in 6.5)
{ "event": "dialDown", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Encoder", "coordinates": { "column": 0, "row": 0 }, "resources": {}, "settings": {} } }
// touchTap (tapPos relative to the 200×100 slot; hold = long touch)
{ "event": "touchTap", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Encoder", "coordinates": { "column": 1, "row": 0 }, "resources": {}, "settings": {}, "tapPos": [112, 54], "hold": false } }

// didReceiveSettings — id is present only when answering getSettings{id} (message ids, 7.1+)
{ "event": "didReceiveSettings", "action": "…", "context": "…", "device": "…", "id": "optional",
  "payload": { "controller": "Keypad", "coordinates": {…}, "isInMultiAction": false, "resources": {}, "settings": {…}, "state": 0 } }
// didReceiveResources (7.1+) — same shape as didReceiveSettings
// didReceiveGlobalSettings
{ "event": "didReceiveGlobalSettings", "id": "optional", "payload": { "settings": { … } } }

// titleParametersDidChange
{ "event": "titleParametersDidChange", "action": "…", "context": "…", "device": "…",
  "payload": { "controller": "Keypad", "coordinates": {…}, "resources": {}, "settings": {}, "state": 0,
               "title": "QT",
               "titleParameters": { "fontFamily": "", "fontSize": 9, "fontStyle": "", "fontUnderline": false,
                                    "showTitle": true, "titleAlignment": "bottom", "titleColor": "#ffffff" } } }

// property inspector lifecycle and messages
{ "event": "propertyInspectorDidAppear",    "action": "…", "context": "…", "device": "…" }
{ "event": "propertyInspectorDidDisappear", "action": "…", "context": "…", "device": "…" }
{ "event": "sendToPlugin", "action": "…", "context": "…", "payload": <any JSON> }   // no "device"

// devices
{ "event": "deviceDidConnect", "device": "…", "deviceInfo": { "name": "…", "size": { "columns": 8, "rows": 4 }, "type": 2 } }
{ "event": "deviceDidChange",  "device": "…", "deviceInfo": { … } }   // 7.0+
{ "event": "deviceDidDisconnect", "device": "…" }

// system
{ "event": "systemDidWakeUp" }
{ "event": "applicationDidLaunch",    "payload": { "application": "StarCitizen.exe" } }
{ "event": "applicationDidTerminate", "payload": { "application": "StarCitizen.exe" } }
{ "event": "didReceiveDeepLink", "payload": { "url": "/whatever?x=1" } }   // 6.5+
```

**Notes on the payload fields**

- `coordinates`: "When the device is Stream Deck +, the row can be 0 for keys (`Keypad`), and will
  *always* be 0 for dials (`Encoder`); to differentiate between action types, cross-check the
  `controller`."
- `size` = "Number of action slots, excluding dials / touchscreens".
- Device `type`: see §1.

**Deep links**

- `streamdeck://plugins/message/<PLUGIN_UUID>/{MESSAGE}` delivers `didReceiveDeepLink` to the
  plugin.
- Appending `?streamdeck=hidden` (7.0+) does not bring Stream Deck to the front.
- A local app (e.g. the Tablet Deck server) could use this to "poke" the plugin. The WebSocket
  link from plugin to Tablet Deck is simpler. **[primary + inferred]**

**Neo Infobar actions** get `willAppear`, `willDisappear`, settings, resources,
property-inspector, `sendToPlugin` and `titleParametersDidChange` events, but **no input
events**.

- Their `willAppear` payload has `controller: "Neo"` and `coordinates`.
- They must call `setFeedbackLayout` on every `willAppear`, with a custom layout file.

**[primary]**: https://docs.elgato.com/streamdeck/sdk/guides/neo-infobar and
`packages/plugin/src/actions/neo-infobar.ts`.

### 5.3 Commands (plugin → Stream Deck) **[primary]**

```jsonc
{ "event": "setTitle",  "context": "…", "payload": { "title": "QT", "state": 0, "target": 0 } }   // title omitted → reset to user/manifest title
{ "event": "setImage",  "context": "…", "payload": { "image": "data:image/svg+xml,%3Csvg…", "state": 0, "target": 0 } } // image omitted → manifest image
{ "event": "setState",  "context": "…", "payload": { "state": 1 } }
{ "event": "showAlert", "context": "…" }      // yellow triangle; on dials it shows on the touch strip
{ "event": "showOk",    "context": "…" }      // green check (keys)
{ "event": "setFeedback",       "context": "…", "payload": { "title": "SHIELDS", "value": "72%", "gauge": 72, "bg": { "value": "data:image/svg+xml,…", "opacity": 0.8 } } }
{ "event": "setFeedbackLayout", "context": "…", "payload": { "layout": "$B1" } }   // or "layouts/dial.json"
{ "event": "setTriggerDescription", "context": "…", "payload": { "rotate": "Throttle", "push": "Boost", "touch": "…", "longTouch": "…" } } // omitted field → "not shown" (wire docs); {} → reset to manifest (SDK dial.ts) — conflict, unconfirmed
{ "event": "setSettings",       "context": "…", "payload": { … } }
{ "event": "getSettings",       "context": "…", "id": "optional-correlation-id" }
{ "event": "setGlobalSettings", "context": "<pluginUUID>", "payload": { … } }
{ "event": "getGlobalSettings", "context": "<pluginUUID>", "id": "optional" }
{ "event": "setResources",      "context": "…", "payload": { "name": "C:\\path\\file.png" } }    // 7.1+
{ "event": "getResources",      "context": "…", "id": "optional" }                               // 7.1+
{ "event": "sendToPropertyInspector", "context": "…", "payload": <any JSON> }
{ "event": "switchToProfile", "context": "<pluginUUID>", "device": "<device id>", "payload": { "profile": "profiles/combat-xl", "page": 0 } }
{ "event": "openUrl",    "payload": { "url": "https://…" } }
{ "event": "logMessage", "payload": { "message": "…" } }
```

**What each command does**

- **`target`**: `0` = hardware and software, `1` = hardware only, `2` = software only
  (`packages/core/src/target.ts`).
- **Which command goes with which controller** (`packages/plugin/src/actions/{key,dial,neo-infobar}.ts`)
  **[primary: SDK source]**:

  | Controller | SDK methods |
  |---|---|
  | Keypad | `setImage`, `setTitle`, `setState`, `showAlert`, `showOk` |
  | Encoder | `setFeedback`, `setFeedbackLayout`, `setImage`, `setTitle`, `setTriggerDescription`, `showAlert` |
  | Neo | `setFeedback`, `setFeedbackLayout` |

  - On a dial, `setTitle` is implemented as **`setFeedback({ title })`**. What a raw
    `setTitle` command does on an Encoder context is undocumented, so use `setFeedback`.
  - A dial's `setImage` "Sets the image to be display for this action instance within Stream
    Deck app", i.e. the dial's canvas in the app, with no `state`/`target`.
  - There is no `showOk` and no `setState` for dials or Neo, and dial events carry no
    `state`/`isInMultiAction`.
  - On Neo, `setFeedbackLayout`'s layout "must be a path to a local layout JSON file within the
    plugin's folder". For dials it may also be a built-in id.
- **`state`** on `setTitle`/`setImage`: "when no state is supplied, the image is set for both
  states".
- **`setFeedback` values**:
  - A **string** sets the `value` of a `text`/`pixmap` item.
  - A **number** sets the `value` of a `bar`/`gbar` item.
  - An **object** updates any property except `key`, `rect` and `type`.
- **`switchToProfile`**:
  - `profile` must equal the manifest `Profiles[].Name` exactly.
  - Omitting `profile` switches back to the previous profile.
  - `page` (0-based) needs 6.5 or later.
  - It only works on bundled profiles, and prompts the user to install one that isn't installed
    yet.
  - It also temporarily disables Smart Profile switching (changelog 4.2).
- **Settings round trips**:
  - With 7.1 message identifiers, `getSettings` with an `id` comes back as `didReceiveSettings`
    with the same `id`.
  - A settings change made in the property inspector arrives **without** an `id`.
  - A plugin `setGlobalSettings` is pushed to the open property inspector as
    `didReceiveGlobalSettings` (since v5.0).
- **Settings storage**: "Action settings are stored as plain-text and are included when exporting
  Stream Deck profiles". Global settings are "stored securely on the user's local machine". So
  the Tablet Deck pairing code belongs in **global settings**, never in action settings.
  Source: https://docs.elgato.com/streamdeck/sdk/guides/settings **[primary]**

### 5.4 Can a plugin skip `@elgato/streamdeck`? Yes

- The WebSocket API reference is current (docs version 3.0.0) and describes plugins built
  without the SDK. Its warning: "Creating native plugins is an advanced technique, and is not
  recommended". It is a recommendation, not a ban.
- DRM "is available to all Stream Deck SDK libraries… not limited to Node.js".
- The official Node SDK's `connection.ts` is ~40 lines of the same protocol.

**[primary]**

Corrected skeleton (built-ins only, Node ≥ 22 for the global `WebSocket`; ship it on the Node 24
runtime). **[tested locally]**

I ran it under Node 22.23.4 against the fake Stream Deck server (`net`/`crypto`, RFC 6455), which
launched it with the real argument format **and with a stray unpaired `-bool` flag**. It:

- registered;
- sent `getGlobalSettings` with the plugin UUID as context;
- answered `willAppear` (Keypad → `setImage` with an SVG data URL; Encoder → `setFeedback`;
  Neo → `setFeedbackLayout`);
- answered `dialRotate` → `setFeedback` and `sendToPlugin` → `sendToPropertyInspector`;
- exited cleanly when the socket closed.

With the same stray flag, the draft's pairwise parser never registered and the run timed out.
**Not tested against the real Stream Deck app.** File:
`<scratch>/verify/examples/com.example.tablet-deck.sdPlugin/bin/plugin.mjs`.

```js
// bin/plugin.mjs — minimal Stream Deck plugin speaking the raw WebSocket protocol.
// Scan argv the way @elgato/streamdeck does (connection.ts): take the value after each known flag, skip anything else.
const KNOWN = new Set(["-port", "-pluginUUID", "-registerEvent", "-info"]);
const args = {};
for (let i = 2; i < process.argv.length - 1; i++) if (KNOWN.has(process.argv[i])) args[process.argv[i]] = process.argv[++i];
const port = args["-port"], pluginUUID = args["-pluginUUID"], registerEvent = args["-registerEvent"];
const info = JSON.parse(args["-info"] ?? "{}");
if (!port || !pluginUUID || !registerEvent) process.exit(1);

const ws = new WebSocket(`ws://127.0.0.1:${port}`); // global since Node 22; not on Node 20 without a flag
const send = (msg) => ws.send(JSON.stringify(msg));
const visible = new Map(); // context -> { action, device, controller, coordinates, settings }

ws.onopen = () => {
	send({ event: registerEvent, uuid: pluginUUID });
	send({ event: "getGlobalSettings", context: pluginUUID, id: "boot" }); // plugin-wide: -pluginUUID as context
};
ws.onmessage = (ev) => {
	const msg = JSON.parse(ev.data);
	switch (msg.event) {
		case "willAppear":
			visible.set(msg.context, { action: msg.action, device: msg.device, ...msg.payload });
			if (msg.payload.controller === "Neo") send({ event: "setFeedbackLayout", context: msg.context, payload: { layout: "layouts/neo.json" } }); // every willAppear
			break;
		case "willDisappear": visible.delete(msg.context); break; // release anything this key or dial still holds
		case "keyDown": /* press via Tablet Deck */ break;
		case "keyUp": /* release via Tablet Deck */ break;
		case "dialRotate": /* one press per tick */ break;
	}
};
ws.onclose = () => process.exit(0); // Stream Deck closed the socket: stop
```

Tablet Deck ground rules mapped to events **[inferred]**:

- Press on `keyDown`/`dialDown` and release on `keyUp`/`dialUp`.
- Also release everything still held on these events:
  - `willDisappear` (page or profile change while held);
  - `deviceDidDisconnect`;
  - `systemDidWakeUp`;
  - WebSocket close (both the Stream Deck socket and the Tablet Deck socket).

---

## 6. Encoder (touch strip) and Neo Infobar layouts

Schema: https://schemas.elgato.com/streamdeck/plugins/layout.json. Docs:
https://docs.elgato.com/streamdeck/sdk/references/layouts and
https://docs.elgato.com/streamdeck/sdk/guides/dials. **[primary]**

### 6.1 Canvas size

- **Stream Deck + and + XL**: 200×100 per dial. "Plugins cannot render across the entire touch
  strip."
- **Neo Infobar**: 232×50.
- The schema clamps each `rect` number on its own: x,w ≤ 200 and y,h ≤ 100 (Encoder), or 232 / 50
  (Neo). So `x + w` overflow passes the schema; only the CLI rule (Encoder only) and the app
  catch it.
- Both layouts in §6.5 pass the CLI's bounds/overlap logic: I re-ran it with 200×100 and
  232×50. Touching edges are allowed (the CLI uses `<=`/`>=`). **[tested locally]**

### 6.2 Layout file

- Required keys: `id`, `items`.
- `controller` is optional for Encoder layouts and **required, `"Neo"`**, for Neo layouts.
- `additionalProperties: false`.

### 6.3 Items

All items (`type` ∈ `text`, `pixmap`, `bar`, `gbar`) share:

- `key`: required; `^[A-Za-z0-9\-_]+$`; unique; can't change at runtime.
- `type`: required; can't change.
- `rect`: required; `[x,y,w,h]`; can't change.
- `zOrder`: 0–700, default 0.
- `enabled`: bool.
- `opacity`: 0, 0.1 … 1 (one decimal).
- `background`: named color, hex, or gradient `"0:#ff0000,0.5:yellow,1:#00ff00"`.

Per type:

- **`text`**:
  - `value` (string); `color`; `alignment` ("left"\|"center"\|"right", default center);
    `font` `{ size, weight 100–1000 }`; `"text-overflow"` ("clip"\|"ellipsis"\|"fade").
  - Defaults to watch: the schema says the default is `ellipsis`, while the description says
    clip.
  - An item keyed `"title"` follows the user's title settings.
- **`pixmap`**: `value` = a plugin-relative path, a base64 data URL with MIME type, or an SVG
  string. An item keyed `"icon"` can be overridden by the user.
- **`bar`** (required: `key, rect, type, value`):
  - `value` (number); `range` `{min,max}` (default 0..100).
  - `subtype`: 0 Rectangle, 1 DoubleRectangle, 2 Trapezoid, 3 DoubleTrapezoid, 4 Groove
    (default).
  - `bar_bg_c` (default darkGray, gradient allowed); `bar_fill_c` (default white, gradient
    allowed); `bar_border_c` (default white); `border_w` (default 2).
- **`gbar`**: the same as `bar`, plus `bar_h` (indicator height, default 10). It draws a triangle
  indicator under the bar.

**Layout rules**

- "Layouts will not render when a layout item is outside the allotted bounds… or layout items
  overlap on the same `zOrder`."
- The CLI enforces both rules, plus unique keys, but only for layouts referenced in the
  manifest's `Encoder.layout`. Layouts set only through `setFeedbackLayout` (e.g. Neo) are not
  validated. **[primary: CLI rules `layout-item-bounds.ts`, `layout-item-keys.ts`, `plugin.ts`]**
- Note that the CLI bounds rule hard-codes 200×100.

### 6.4 Built-in layouts: exact definitions **[primary, dials guide]**

| id | items (key: type, rect) |
|---|---|
| `$X1` | `title`: text [16,10,136,24] (16px/600, left); `icon`: pixmap [76,40,48,48] |
| `$A0` | `full-canvas`: pixmap [0,0,200,100]; `title`: text [16,10,136,24] zOrder 1; `canvas`: pixmap [16,34,136,54] zOrder 1 |
| `$A1` | `title`: text [16,10,136,24]; `icon`: pixmap [16,40,48,48]; `value`: text [76,40,108,32] (24px/600, right) |
| `$B1` | as `$A1` + `indicator`: bar [76,74,108,12] value 0, subtype 4, border_w 0 |
| `$B2` | as `$A1` + `indicator`: gbar [76,74,108,20] subtype 4, bar_h 12, border_w 0, bar_bg_c `"0:#ff0000,0.33:#a6d4ec,0.66:#f4b675,1:#00ff00"` |
| `$C1` | `title`: text [16,10,136,24]; `icon1`: pixmap [16,40,24,24]; `icon2`: pixmap [16,68,24,24]; `indicator1`: bar [48,46,136,12]; `indicator2`: bar [48,74,136,12] (both subtype 4, border_w 0) |

Example from Elgato's sample (`examples/layouts/src/actions/built-in-layout.ts`):

```js
setFeedbackLayout("$B2");
setFeedback({ title: "Layout $B2", value: "50",
  indicator: { value: "50", bar_bg_c: "0:#ffffff,0.33:#000a98,0.66:#ffffff,1:#000a98" } });
```

### 6.5 Custom layouts used here (both VALID against `layout@0.6.0`) **[tested locally with ajv]**

`layouts/dial.json` (Stream Deck + / + XL):

```json
{
	"$schema": "https://schemas.elgato.com/streamdeck/plugins/layout.json",
	"id": "td-dial",
	"items": [
		{ "key": "bg", "type": "pixmap", "rect": [0, 0, 200, 100], "zOrder": 0 },
		{ "key": "title", "type": "text", "rect": [12, 6, 176, 22], "zOrder": 1, "font": { "size": 15, "weight": 600 }, "alignment": "left" },
		{ "key": "value", "type": "text", "rect": [12, 30, 176, 36], "zOrder": 1, "font": { "size": 26, "weight": 700 }, "alignment": "right", "color": "#7FE7FF", "text-overflow": "clip" },
		{ "key": "gauge", "type": "gbar", "rect": [12, 72, 176, 20], "zOrder": 1, "value": 50, "range": { "min": 0, "max": 100 }, "subtype": 4, "bar_h": 10, "border_w": 0, "bar_bg_c": "0:#12303d,1:#2aa7c9", "bar_fill_c": "#7FE7FF" }
	]
}
```

`layouts/neo.json` (Neo Infobar; set it with `setFeedbackLayout` on every `willAppear`):

```json
{
	"$schema": "https://schemas.elgato.com/streamdeck/plugins/layout.json",
	"id": "td-neo",
	"controller": "Neo",
	"items": [
		{ "key": "icon", "type": "pixmap", "rect": [6, 9, 32, 32] },
		{ "key": "title", "type": "text", "rect": [44, 4, 182, 20], "font": { "size": 13, "weight": 600 }, "alignment": "left" },
		{ "key": "status", "type": "text", "rect": [44, 26, 182, 20], "font": { "size": 15, "weight": 700 }, "alignment": "left", "color": "#7FE7FF" }
	]
}
```

### 6.6 Animation and update rate

- A full-slot `pixmap` (like `bg` above) updated with SVG data URLs is the way to do animated
  touch-strip art. Keep it at **≤ 10 updates per second** (guidelines) **[primary]**.
- Pixmaps and `Encoder.background` don't list GIF, so there's no native animated strip art
  **[primary: formats listed; inferred: no GIF]**.
- Guidelines also ask for touch targets ≥ 35×35 px on the strip.

### 6.7 Which devices have encoders

- **Stream Deck + (type 7)**: 4 dials plus a 4-slot strip.
- **Stream Deck + XL (type 13)**: 6 dials plus a 6-slot strip.
- **Stream Deck Studio (type 10)**: 2 dials, no touch strip. Its 32 keys are 16 × 2.
- **Galleon 100 SD (type 12)**: 2 dials plus an LCD screen. Its 12 keys are "3 x 4".

Sources: `packages/schemas/src/streamdeck/plugins/device-type.ts` and the devices guide.

**Galleon 100 SD dials take dial actions** **[primary]**. Elgato's Dial Stack article (last
updated 2026-07-09) says:

- "Dial Stack only works on Stream Decks with a dial, such as Stream Deck +, Stream Deck + XL,
  or GALLEON 100 SD";
- "Dial Stacks work with actions that support Stream Deck + dials".

Source: https://www.elgato.com/us/en/explorer/products/stream-deck/what-is-a-dial-stack-for-stream-deck/

So `Encoder` actions work on Galleon dials. Still **unconfirmed**:

- whether layouts render on the Galleon's LCD screen, and at what size;
- whether Stream Deck Studio dials take `Encoder` actions at all. The article doesn't list
  Studio, and no Elgato page I found says either way.

The layouts reference lists canvas sizes only for Stream Deck +, + XL and the Neo.

---

## 7. Property inspector (PI)

Docs: https://docs.elgato.com/streamdeck/sdk/references/websocket/ui and
https://docs.elgato.com/streamdeck/sdk/guides/ui. Wire types:
`packages/core/src/registration/ui.ts`. **[primary]**

### 7.1 How it connects

Stream Deck loads the HTML in Chromium (130, or 140 on 7.6). "Once the DOM has loaded, Stream
Deck will invoke" `window.connectElgatoStreamDeckSocket(port, uuid, registerEvent, info,
actionInfo)`:

- `info` and `actionInfo` are JSON **strings**.
- `actionInfo` = `{ action, context, device, payload: { settings, controller, coordinates?,
  isInMultiAction, state?, resources? } }`.

The PI opens `ws://127.0.0.1:<port>` and sends `{ "event": registerEvent, "uuid": uuid }`.

> **Don't copy Elgato's "Manually" sample verbatim.** It does
> `const actionInfo = JSON.parse(actionInfo);` inside a function whose parameter is also named
> `actionInfo`. That is a SyntaxError, and `node --check` rejects it. Name the parsed object
> differently, as §7.6 does. **[tested locally]**

### 7.2 Property inspector commands

Send the **`uuid` argument** as `context` and `actionInfo.action` as `action`.

- **What the docs say about `context`**: "The action instance identifier" for
  `getSettings`/`setSettings`/`sendToPlugin`, and "The plugin's identifier, as provided by
  Stream Deck" for `get/setGlobalSettings`.
- **What real code does**: sdpi-components 4.0.1 (`src/stream-deck/stream-deck-client.ts`)
  sends `{event, context: propertyInspectorUUID, payload, action: actionInfo.action}` for
  **every** command, global settings included. Elgato ships that library inside its own
  product-viewer example.
- **Still undocumented**: whether `uuid` always equals `actionInfo.context`.

**[real files; the docs' wording is compatible but not explicit]**

- `getSettings` (`action`, `context`, `id?`) → `didReceiveSettings`
- `setSettings` (`action`, `context`, `payload`). This notifies the plugin with
  `didReceiveSettings`.
- `getGlobalSettings` / `setGlobalSettings` (`context` = "The plugin's identifier, as provided by
  Stream Deck", i.e. the `uuid` argument). This notifies the plugin.
- `sendToPlugin` (`action`, `context`, `payload`). The plugin receives `sendToPlugin` with
  `action` and `context`.
- `getResources` / `setResources` (7.1+)
- `openUrl`

### 7.3 Events the property inspector receives

- `didReceiveSettings`
- `didReceiveGlobalSettings`
- `didReceiveResources`
- `sendToPropertyInspector` (`{action, context, event, payload}`)

### 7.4 sdpi-components is optional

- Plain HTML works: the docs' "Manually" tab shows registration with a bare `WebSocket`.
- sdpi-components (v4.0.1; https://github.com/GeekyEggo/sdpi-components) is a helper library.
- If you use it, the docs say to **bundle it locally**: "Referencing the UI library from the
  remote CDN is no longer recommended… When distributing your plugin, you should always
  reference the UI library locally."
- Elgato's CLI template still points at `https://sdpi-components.dev/releases/v4/sdpi-components.js`.

For Tablet Deck: **no remote script** (the "No tracking / no new network calls" rule). Use plain
HTML/CSS/JS in the plugin folder. **[primary + inferred]**

### 7.5 Stream Deck 7 changes for property inspectors

- 7.1 added "in-app developer tools that track the current property inspector".
- Since 6.9 (Chromium 122), `beforeunload` is no longer emitted when the PI disappears. Save on
  every change.
- The guidelines require "automatically save settings on change". "Have a 'Save' button for
  action settings" is on the **don't** side: in the page HTML it sits in the `bad_…` list.
  **[primary, checked in the HTML]**
- Remote debugging is at `http://localhost:23654/` with developer mode on (`streamdeck dev`).

**[primary]**

### 7.6 Minimal plain-HTML property inspector **[inferred from the documented protocol; script passes `node --check`; not run in Stream Deck]**

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tablet Deck</title><link rel="stylesheet" href="inspector.css"></head>
<body>
<label>Button <select id="button"></select></label>
<script>
let ws, uuid, actionInfo;
window.connectElgatoStreamDeckSocket = (port, inUUID, registerEvent, infoJson, actionInfoJson) => {
	uuid = inUUID;
	actionInfo = JSON.parse(actionInfoJson);
	const lang = JSON.parse(infoJson).application.language; // pick strings for en/de/es/fr
	ws = new WebSocket(`ws://127.0.0.1:${port}`);
	ws.onopen = () => {
		ws.send(JSON.stringify({ event: registerEvent, uuid }));
		ws.send(JSON.stringify({ event: "sendToPlugin", action: actionInfo.action, context: uuid, payload: { type: "list-buttons" } }));
	};
	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (msg.event === "sendToPropertyInspector") { /* fill the select from msg.payload */ }
		if (msg.event === "didReceiveSettings") { /* refresh form from msg.payload.settings */ }
	};
};
document.getElementById("button").addEventListener("change", (e) => {
	ws.send(JSON.stringify({ event: "setSettings", action: actionInfo.action, context: uuid, payload: { button: e.target.value } }));
});
</script>
</body></html>
```

---

## 8. Localization files **[primary]**

Docs: https://docs.elgato.com/streamdeck/sdk/guides/i18n.

### 8.1 Files

- `<lang>.json` sits next to `manifest.json` in the `.sdPlugin` root.
- Supported languages: `de`, `en`, `es`, `fr`, `ja`, `ko`, `zh_CN`, `zh_TW`. `zh_TW` needs 6.8.
- A language file overrides the manifest strings, even for English.

### 8.2 What can be localized

- Root: `Name`, `Description`.
- Per action, under a key equal to the action UUID: `Name`, `Tooltip`, `States[].Name`,
  `Encoder.TriggerDescription.{Push,Rotate,Touch,LongTouch}`.

### 8.3 Custom strings

- Put them under a `"Localization"` object.
- The Node SDK reads `process.cwd()/<lang>.json` and requires that object. A raw plugin can
  simply read its own file.
- The docs say property-inspector strings are "handled slightly differently in sdpi-components
  … placed directly in the HTML file". With plain HTML, embed the strings in the PI's script.

### 8.4 Example (`de.json`)

```json
{
	"Name": "Tablet Deck",
	"Description": "Live-Steuerung für Star Citizen über Tablet Deck.",
	"com.example.tablet-deck.button": {
		"Name": "Deck-Taste",
		"Tooltip": "Drückt eine Tablet-Deck-Taste, mit Live-Status.",
		"States": [{ "Name": "Aus" }, { "Name": "An" }]
	},
	"com.example.tablet-deck.dial": {
		"Name": "Deck-Drehregler",
		"Tooltip": "Ein Druck pro Raste.",
		"Encoder": { "TriggerDescription": { "Rotate": "Anpassen", "Push": "Umschalten", "Touch": "Umschalten", "LongTouch": "Zurücksetzen" } }
	},
	"Localization": { "Not connected": "Nicht verbunden" }
}
```

---

## 9. Packaging (`.streamDeckPlugin`)

### 9.1 What the file is **[primary + real files]**

- A ZIP whose every entry is prefixed `<uuid>.sdPlugin/`. The CLI writes it with `@zip.js`
  `ZipWriter`, adding each file as `join(basename(sourcePath), relative)` with `\` turned into
  `/`. Source: `packages/cli/src/commands/pack.ts`.
- Real files: I re-inspected all five prebuilt sample packages in `elgatosf/streamdeck/examples`
  (cat-keys, hello-world, layouts, lightsout, product-viewer) with Python's `zipfile`:
  - every entry is a file entry (no directory entries) under one root `<uuid>.sdPlugin/`;
  - all use **compression method 8 (deflate)**;
  - general-purpose flags are `0x0808` (data descriptor + UTF-8 names);
  - `create_system` is 0;
  - cat-keys even ships a stray `.DS_Store`, so extra files are tolerated.

  **Caveat:** these prebuilt packages are **older builds**. Their packed manifests say
  `SDKVersion 2`, `MinimumVersion 6.5`, Node "20", while the matching source manifests say SDK
  3 / 7.1. Example entries:

```
com.elgato.lightsout.sdPlugin/manifest.json
com.elgato.lightsout.sdPlugin/sd.streamDeckProfile
com.elgato.lightsout.sdPlugin/imgs/plugin/marketplace.png
com.elgato.lightsout.sdPlugin/imgs/plugin/marketplace@2x.png
com.elgato.lightsout.sdPlugin/bin/package.json
com.elgato.lightsout.sdPlugin/bin/plugin.js
```

### 9.2 What `streamdeck pack` does

1. Optionally rewrites `Version`, padding it to 4 parts.
2. Runs `validate` (stops on errors unless `--ignore-validation`).
3. Zips every file in the folder except `.sdignore`, `.git`, `/.env*`, `*.log`, `*.js.map` and
   the patterns in `.sdignore` (gitignore syntax).
4. Removes `Nodejs.Debug` from the packed `manifest.json`.
5. Names the output `<uuid>.streamDeckPlugin`.

There is no signing step. DRM happens only on Elgato's side after a Maker Console upload.
**[primary: `pack.ts`, `system/fs.ts`, distribution docs]**

### 9.3 What `streamdeck validate` checks

Source: `packages/cli/src/validation/plugin/index.ts` and its rules. **[primary]**

| Check | Result |
|---|---|
| The path is a directory | error |
| The folder name ends in `.sdPlugin` | error |
| The folder name is a valid reverse-DNS id | error |
| `manifest.json` exists and is schema-valid (latest schema, refreshed daily unless `--no-update-check`) | error |
| Every manifest file path resolves to an existing file of an allowed extension | error |
| The resolved file is not ignored by `.sdignore` | error |
| Two files match the same extension-less path | warning |
| A PNG has no `@2x` version | warning |
| Manifest `UUID` doesn't match the folder name | error |
| Duplicate action UUIDs | error |
| An action UUID isn't prefixed with the plugin UUID | warning |
| `URL` doesn't parse, isn't http(s), or its DNS lookup fails | error |
| `URL` HEAD request doesn't return 2xx | warning |
| `Category` ≠ `Name` | warning |
| Each custom `Encoder.layout` file exists and is schema-valid | error |
| Layout item keys aren't unique | error |
| Layout items are out of bounds (200×100) or overlap on the same zOrder | error |

**Image dimensions are NOT checked.** The schema's `imageDimensions` keyword is collected but no
rule uses it.

### 9.4 A hand-made ZIP

- I found no Elgato statement that the ZIP must come from the CLI. The format has no extra
  metadata, and third-party tooling builds the file with a generic ZIP library: `fnando/streamdeck`
  uses `zip-dir` (`src/cli/bundle.ts`, 2024).
- `zip-dir` uses JSZip, which by default also writes directory entries. That suggests
  directory entries are tolerated too **[inferred, weak]**. Our writer should simply match the
  CLI's output: file entries only.
- So a ZIP written by our own Node script should install by double-click. The entries should
  be `<uuid>.sdPlugin/<path>` with forward slashes, compressed with deflate via
  `zlib.deflateRawSync`, with `zlib.crc32` (Node ≥ 20.15 / 22.2) and the UTF-8 flag (0x0800).
- **SDK 3 packages:** the strongest evidence is that `streamdeck create` now emits SDK 3 / 7.1 /
  Node 24, and `streamdeck pack` turns that into exactly this ZIP format.
  **[primary + inferred]**
- **Tested locally:** a ~30-line built-ins-only writer
  (`<scratch>/verify/zipwrite.js`)
  produced a `.streamDeckPlugin` that passes `unzip -t` and Python's `zipfile.testzip()`, with
  method 8, flag 0x0800, file entries only, and a fixed valid DOS timestamp of 1980-01-01 00:00
  (date `0x0021`, time `0x0000`), which keeps builds reproducible. Install by the real app is
  **untested**.
- **Unconfirmed**:
  - whether Stream Deck accepts *stored* (method 0) entries (use deflate to match the CLI);
  - whether it needs anything beyond a correct `manifest.json`.

**[real files + inferred + tested ZIP validity]**

### 9.5 Installing

- Double-clicking `.streamDeckPlugin` installs it. That's the documented way to try Elgato's
  samples: "open it to install the sample into Stream Deck without building"
  (`examples/README.md`).
- Installing through the `streamdeck://` scheme has been deprecated since 6.4.

**[primary]**

### 9.6 Icon packs (standalone, separate format)

`.streamDeckIconPack`, built with Elgato's "Icon Pack Man" (https://iconpackman.elgato.com/).

Structure:

- `icons/` (144×144 SVG/PNG/JPG/GIF/WEBP);
- `icons.json` = `[{ "path", "name", "tags": [] }]`;
- `manifest.json` = `{ Name, Version, Description?, Author, URL?, Icon (56×56), License? }`. The
  docs' table spells it "Licence", but their example uses `"License"`;
- `icon.svg`;
- `license.txt`.

The docs mark this glossary "for reference purposes only — to create icon packs, please use Icon
Pack Man". The container format is not documented. Source:
https://docs.elgato.com/stream-deck/icons/api. **[primary for the structure; container
unconfirmed]**. Icon packs are a separate research topic.

---

## 10. Things I could not confirm (open questions after verification)

Nothing here was tested against the real Stream Deck app, which needs Windows or macOS.

**Devices**

- Whether **Stream Deck Studio** dials take `Encoder` actions at all.
- Whether layouts render on the **Galleon 100 SD**'s LCD, and at what canvas size. Its dials do
  take dial actions (§6.7).

**Commands**

- What `setTriggerDescription` with `{}` does: hide every line (wire docs) or reset to the
  manifest (SDK `dial.ts`).
- What a raw `setTitle` does on an Encoder context. The SDK avoids it and uses
  `setFeedback({ title })`.
- Whether the PI's `uuid` argument always equals `actionInfo.context`. Using `uuid` for every PI
  command is what sdpi-components does.

**Manifest and versions**

- The default of `Controllers` when it is omitted.
- What the app does with a plugin whose `MinimumVersion` (e.g. "7.6" for a Neo action) is newer
  than the installed app: refuse to install, or install but not load.
- The exact 7.6 release date. The article is dated 2026-09-22 and npm SDK 3.0.0 is from the
  same day.
- Node 26 support appears in the schema and the runtime table but not in the changelog text.

**Limits**

- Maximum `setImage` / `setFeedback` payload size, and any hard rate limit enforced by the app.
  Only the "≤ 10 per second" guideline exists.
- Whether a `pixmap` accepts GIF (the docs list "PNG, JPEG, etc." and SVG).

**Packaging and installing**

- Whether a hand-made ZIP installs by double-click. ZIP validity is tested, install is not.
- Whether *stored* (method 0) entries or directory entries are accepted.
- Whether the app needs anything beyond a correct `manifest.json`.

**Other**

- The help-center release notes for 7.0–7.6: help.elgato.com still returns 403 (rechecked
  2026-11-06). I used docs.elgato.com's changelog, elgato.com articles and npm publish dates
  instead.
- How Stream Deck restarts a crashing plugin. The docs only say it "provides automatic failure
  recovery"; the lifecycle diagram didn't render server-side.

## 11. Source index

- Schemas:
  - https://schemas.elgato.com/streamdeck/plugins/manifest.json
  - https://schemas.elgato.com/streamdeck/plugins/layout.json
- SDK monorepo, https://github.com/elgatosf/streamdeck (commit 9d9636e, 2026-11-05):
  - `packages/core/src/command.ts`, `events/*.ts`, `registration/*.ts`, `layout.ts`,
    `device.ts`, `target.ts`, `i18n.ts`
  - `packages/plugin/src/connection.ts`, `settings.ts`, `profiles.ts`, `manifest.ts`,
    `validation.ts`, `actions/{key,dial,neo-infobar}.ts`, `CHANGELOG.md`
  - `packages/cli/src/commands/{pack,dev,link}.ts`, `src/stream-deck.ts`,
    `src/validation/plugin/**`, `template/**`
  - `packages/schemas/src/streamdeck/plugins/device-type.ts`
  - `examples/layouts`, `examples/lights-out`
- Docs (all "Version 3.0.0"):
  - https://docs.elgato.com/streamdeck/sdk/introduction/plugin-environment
  - https://docs.elgato.com/streamdeck/sdk/references/manifest
  - https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin
  - https://docs.elgato.com/streamdeck/sdk/references/websocket/ui
  - https://docs.elgato.com/streamdeck/sdk/references/websocket/changelog
  - https://docs.elgato.com/streamdeck/sdk/references/changelog
  - https://docs.elgato.com/streamdeck/sdk/references/layouts
  - https://docs.elgato.com/streamdeck/sdk/guides/keys
  - https://docs.elgato.com/streamdeck/sdk/guides/dials
  - https://docs.elgato.com/streamdeck/sdk/guides/neo-infobar
  - https://docs.elgato.com/streamdeck/sdk/guides/ui
  - https://docs.elgato.com/streamdeck/sdk/guides/i18n
  - https://docs.elgato.com/streamdeck/sdk/guides/profiles
  - https://docs.elgato.com/streamdeck/sdk/guides/devices
  - https://docs.elgato.com/streamdeck/sdk/guides/settings
  - https://docs.elgato.com/streamdeck/sdk/guides/logging
  - https://docs.elgato.com/streamdeck/sdk/introduction/distribution
  - https://docs.elgato.com/streamdeck/sdk/upgrading/v3
  - https://docs.elgato.com/guidelines/stream-deck/plugins
  - https://docs.elgato.com/stream-deck/icons/getting-started
  - https://docs.elgato.com/stream-deck/icons/api
  - https://docs.elgato.com/streamdeck/cli/commands/pack
  - https://docs.elgato.com/streamdeck/cli/commands/validate
  - https://docs.elgato.com/streamdeck/hid/stream-deck-classic, …/stream-deck-xl,
    …/stream-deck-neo, …/stream-deck-plus, …/stream-deck-plus-xl
- Elgato articles:
  - https://www.elgato.com/us/en/explorer/products/stream-deck/stream-deck-76-infobar-actions-for-stream-deck-neo/
    ("Last updated: September 22, 2026")
  - https://www.elgato.com/us/en/explorer/products/stream-deck/what-is-a-dial-stack-for-stream-deck/
    ("Last updated: July 09, 2026"; Galleon dials)
- npm registry (publish dates and versions):
  - https://registry.npmjs.org/@elgato/streamdeck: latest 3.0.4 (2026-10-29); 3.0.0 on
    2026-09-22.
  - https://registry.npmjs.org/@elgato/cli: latest 1.10.4; 1.10.0 on 2026-09-22.
  - https://registry.npmjs.org/@elgato/schemas: 0.6.0 on 2026-10-29.
- SDK source for the controller-specific behavior: `packages/plugin/src/actions/{key,dial,neo-infobar,service}.ts`
  and `packages/plugin/src/__tests__/connection.test.ts` (argv parsing).
- Node release list: https://nodejs.org/dist/index.json
- Node.js:
  - https://github.com/nodejs/node/blob/main/doc/api/globals.md#class-websocket
  - https://github.com/nodejs/node/blob/main/doc/api/zlib.md (`zlib.crc32`)
  - https://github.com/nodejs/Release/blob/main/schedule.json
- Third party:
  - https://github.com/GeekyEggo/sdpi-components (`src/stream-deck/stream-deck-client.ts`, v4.0.1)
  - https://github.com/fnando/streamdeck (`src/cli/bundle.ts`)

Local working copies, all under
`<scratch>/`:

- First draft's files:
  - validated examples: `examples/manifest.json`, `examples/dial.json`, `examples/neo.json`;
  - skeleton with the pairwise parser: `examples/com.example.tablet-deck.sdPlugin/bin/plugin.mjs`;
  - fake Stream Deck server: `tools/fake-sd.js`;
  - schema validator: `tools/validate.js`.
- Verification files (`verify/`):
  - `verify/schemas/` (live schemas) and `verify/docs/` (the docs pages I fetched);
  - `verify/repo/sd` (monorepo clone) and `verify/repo/sdpi` (sdpi-components clone);
  - corrected examples `verify/examples/manifest.json` and `verify/examples/manifest-neo-7.6.json`
    (both VALID), plus `verify/examples/neg-*.json`;
  - corrected skeleton `verify/examples/com.example.tablet-deck.sdPlugin/bin/plugin.mjs`;
  - `verify/fake-sd-loneflag.js` (the fake server with a stray `-bool`);
  - `verify/argparse-test.mjs`, `verify/bounds.js` (the CLI's bounds/overlap logic) and
    `verify/val.js` (ajv);
  - `verify/zipwrite.js` (built-ins ZIP writer) and its output
    `verify/out/com.example.tablet-deck.streamDeckPlugin`.
