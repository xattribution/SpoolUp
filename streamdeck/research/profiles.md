# Stream Deck profile file format (`.streamDeckProfile`): research for a Node generator

Researched 2026-11-06. Scope: generating profiles that the Stream Deck app (6.x and 7.x) imports by
double-click and that a plugin can bundle; the built-in Hotkey and navigation actions; plugin bundling.

Confidence tags:

- **[C]** confirmed in a primary source (docs.elgato.com, schemas.elgato.com, elgatosf GitHub, the
  `@elgato/streamdeck` package, Elgato help center / product pages). Help-center articles
  (help.elgato.com) answer HTTP 403 to direct fetches, so those were read through search-engine
  excerpts only. Treat them as [C-] (primary, but not read in full).
- **[R]** seen in real exported or on-disk profile files (the files were downloaded and parsed, not
  just described).
- **[I]** inferred from the evidence; needs a hardware test.
- **[?]** could not be confirmed.

Device model strings, grid sizes, key and touch-strip pixel sizes and the `DeviceType` enum are covered
in detail in `devices.md` (same folder). Section 4.2 below only repeats what a profile writer needs.

---

## 0. TL;DR for the generator

1. A `.streamDeckProfile` is a **plain ZIP** [C/R]. Two internal layouts are in circulation:
   - **v2** (`"Version": "2.0"`; Stream Deck 5.x/6.x exports, and **Elgato's own current SDK sample
     plugin still bundles v2 files** with `Software.MinimumVersion: "7.1"`, `SDKVersion: 3`, repo updated
     2026-11-05) [C]:
     `<PROFILE-UUID>.sdProfile/manifest.json` and `.../Profiles/<base32 page id>/manifest.json`,
     plus `.../Images/*.png`.
   - **v3** (`"Version": "3.0"`; what Stream Deck 7.x exports: 7.3.1, 7.4.0 and 7.5.1 files were seen) [R]:
     `package.json` at the zip root, then `Profiles/<PROFILE-UUID>.sdProfile/manifest.json` and
     `.../Profiles/<PAGE-UUID uppercase>/manifest.json`.
2. **Recommendation: generate v2** for standalone double-click profiles *and* for plugin-bundled profiles.
   It is the only layout that is known to work on 6.x, and Elgato's maintained 7.1+ sample relies on 7.x
   importing it [C]. A v3 writer is optional; real files show the app accepts script-written v3 zips
   too [R] (section 2.3). v3's only practical extra is `package.json.RequiredPlugins`, which drives the 7.x
   "you need these plugins" prompt on import [C-/R].
3. **v2 page folder name = the page UUID, base32-encoded.** Take the 128 bits, shift left by 2, write 26
   digits from the alphabet `0123456789ABCDEFGHIJKLMNOPQRSTVW`, then add a literal `Z`. This was verified
   by round-tripping every page in Elgato's sample profiles. Three independent tools use the same
   algorithm (BarRaider C#, data-enabler JS, ydmw74 Python) [R]. In **v3** the folder name is simply the
   page UUID in upper case [R].
4. Each profile has an **empty "Default" page** that is *not* listed in `Pages.Pages`. Content pages are
   listed in `Pages.Pages` (shown as pages 1…n, **max 10 pages per profile** [C-]). Folder pages
   (`openchild` targets) are extra page folders that appear in no list; they are reached only through
   `Settings.ProfileUUID` [R].
5. Page links inside one profile: `com.elgato.streamdeck.page.goto` with `Settings.PageIndex` **1-based**,
   plus `page.next`, `page.previous`, folders (`profile.openchild` / `profile.backtoparent`) [R]. Avoid the
   built-in **Switch Profile** (`com.elgato.streamdeck.profile.rotate`) between pack profiles. It points
   at a profile UUID that is very likely different after import [I]. For cross-profile "scenes", have the
   **plugin** call `switchToProfile`, which works only on **its own bundled** profiles [C] and takes a
   **0-based** page [C].
6. Built-in Hotkey (`com.elgato.streamdeck.system.hotkey`): `Settings = { Coalesce: true, Hotkeys: [4 entries] }`.
   Each entry is `{KeyCmd, KeyCtrl, KeyModifiers, KeyOption, KeyShift, NativeCode, QTKeyCode, VKeyCode}`.
   The empty slot is `{…false…, KeyModifiers: 0, NativeCode: 146, QTKeyCode: 33554431, VKeyCode: -1}` [R].
   `KeyModifiers` on Windows is a bitmask [R]:
   - generic modifiers: Shift `0x1`, Ctrl `0x2`, Alt `0x4`, Win `0x8`
   - **left side**: LShift `0x10`, LCtrl `0x20`, LAlt `0x40`
   - **right side**: RShift `0x100`, RCtrl `0x200`, RAlt `0x400`
   - **side-specific flag** `0x10000`, set whenever a side bit is used
   - **numpad** `0x4000`

   On Windows `VKeyCode` = `NativeCode` = the virtual-key code. `QTKeyCode` = the Qt key code (ASCII for
   letters, digits and numpad characters; `0x01000000+` for F-keys, arrows and similar) [R]. Details in
   section 6.
7. Plugin bundling: one manifest `Profiles[]` entry per file. `Name` is the path relative to the manifest
   **without** `.streamDeckProfile`, and `DeviceType` is 0…13 [C]. Users are prompted to install the
   bundled profiles when the plugin is installed. With `AutoInstall: false` (6.6+) the prompt comes on the
   first `switchToProfile` instead [C]. Same-named profiles already installed get a " copy" twin [R
   (community)].

---

## 1. Sources actually examined

### Primary (Elgato)

| What | URL | Notes |
|---|---|---|
| SDK guide: Profiles | https://docs.elgato.com/streamdeck/sdk/guides/profiles | bundling, `Name` without extension, AutoInstall prompt, "plugins can only switch to profiles distributed with the plugin" |
| Manifest reference | https://docs.elgato.com/streamdeck/sdk/references/manifest | `Profile` type, `DeviceType` 0–13, `Software.MinimumVersion` "6.4"…"7.6" |
| Manifest JSON schema (fetched live, 391 KB, identical to `@elgato/schemas` 0.6.0, modified 2026-10-29) | https://schemas.elgato.com/streamdeck/plugins/manifest.json | `definitions.Profile` (quoted in section 8) |
| SDK changelog | https://docs.elgato.com/streamdeck/sdk/references/changelog | 6.5 page param for `switchToProfile`; 6.6 `AutoInstall`; 7.1 embedded resources; 7.6 Neo controller |
| Embedded resources guide | https://docs.elgato.com/streamdeck/sdk/guides/resources | 7.1+; resources are packed into exported `.streamDeckProfile` / `.streamDeckAction` |
| Profiles for makers: getting started | https://docs.elgato.com/stream-deck/profiles/getting-started | device table, "profiles are specific to OS and device type", "do not auto-scale", Studio has no app profiles |
| Profiles for makers: packaging | https://docs.elgato.com/stream-deck/profiles/packaging | Marketplace ZIP bundles, no auto-update |
| SDK sample with bundled profiles | https://github.com/elgatosf/streamdeck/tree/main/examples/lights-out/com.elgato.lightsout.sdPlugin (HEAD `9d9636e`, 2026-11-05) and https://github.com/elgatosf/streamdeck-plugin-samples/tree/main/lights-out | six v2 `.streamDeckProfile` files (types 0, 1, 2, 3, 7, 9), unzipped and parsed |
| `@elgato/streamdeck` 3.0.4 (`dist/plugin/profiles.js`, `dist/api/command.d.ts`) | https://www.npmjs.com/package/@elgato/streamdeck | raw `switchToProfile` message |
| Help: Pages ("up to 10 pages per Profile") | https://help.elgato.com/hc/en-us/articles/4410312027277-Elgato-Stream-Deck-Pages | [C-] |
| Help: Action Trigger (6.8+, dials) | https://help.elgato.com/hc/en-us/articles/29655069662609-Elgato-Stream-Deck-Action-Trigger | [C-] |
| Help: Hotkeys on Stream Deck + (press, clockwise, counter-clockwise) | https://help.elgato.com/hc/en-us/articles/10870947641741-Elgato-Stream-Deck-Hotkeys | [C-] |
| Help: Download and use profiles (6.4+, double-click the file) | https://help.elgato.com/hc/en-us/articles/33556495589905-Elgato-Stream-Deck-Download-and-use-Profiles | [C-] |
| Help: Customizing key icons (GIF and animated WEBP supported, min 72×72) | https://help.elgato.com/hc/en-us/articles/360028237271-Elgato-Stream-Deck-Customizing-Key-Icons | [C-] |
| Help: 7.0 release notes (12 Aug 2025; device dropdown on import; Key Logic; Virtual Stream Deck) | https://help.elgato.com/hc/en-us/articles/38011940576273-Elgato-Stream-Deck-7-0-Release-Notes | [C-] |
| Help: 7.1 release notes (3 Dec 2025; exports include configured files; plugin resources; 7.0 "profiles tell you which plugins you'll need") | https://help.elgato.com/hc/en-us/articles/41533810232721-Elgato-Stream-Deck-7-1-Release-Notes | [C-] |
| Profiles at scale (7.0; `custom_default_profiles`; per-device file names) | https://www.elgato.com/us/en/explorer/products/stream-deck/stream-deck-profiles-at-scale/ | [C] |
| Key Logic (7.0+) | https://www.elgato.com/explorer/products/stream-deck/key-logic-stream-deck/ | [C-] |

### Real profile files (downloaded and parsed with my own scripts)

| Repo / source | Format, app version | Why it matters |
|---|---|---|
| https://github.com/John-Mack/HeirOfgaia-StreamDeck-Profile | **v3, AppVersion 7.3.1.22604**, Windows, MK.2 (`20GBA9901`), Mar 2026 | `package.json`, uppercase page folders, page.indicator, Switch Profile, Multi Action, folders |
| https://github.com/phew-blue/streamdeck-home-ops | **v3, AppVersion 7.4.0.22712**, Windows, XL; plus a Python v3 writer | app re-export that keeps the **script-written** image names and `Plugin.Name` values |
| https://github.com/Nagaimo355/StreamDeckPlusController_for_DerailValley | `.streamDeckProfilesBackup` (v3 on-disk), Stream Deck + (`20GBD9901`), Mar 2026 | **Elgato's own default SD+ profile** (dial Hotkeys, `Encoder.Icon`, `Encoder.background`, controller `Background` 800×100), Action Trigger order |
| https://github.com/DKlaper/ga-msfs2024-stream-deck-plus | v2, Stream Deck +, Jan 2025 | `page.goto` PageIndex base, page `Name`s, Dial Stack |
| https://github.com/bitwrestler/DCS-StreamDeckProfiles | v2, XL, 2024 | **left/right modifier bits, numpad + modifiers** (DCS binds use RCtrl/RShift/LAlt…) |
| https://github.com/JustaDevOnTheMove/StreamDeckProfiles | v2, XL (`20GAT9902`) | numpad keys, `AppIdentifier` |
| https://github.com/danexrc/Streamdeck-Profiles | v2, XL, 2023 | images 288×288, folders, includes `manifest.json.bak` with a real device serial |
| https://github.com/phobicdotno/Stream-Deck-XL-.streamDeckProfile-by-Phobic | v2, XL | |
| Aputure Sidus Link Pro pack v1.7: https://help.aputure.com/en/sidus-link-pro/stream-deck-profile (zip link on that page) | **v3, "AppVersion 7.5.1.22901", macOS**, Standard/XL/+/**+ XL**, Sept 2026 | looks **tool-generated** (zip dates 1980, human-readable image names); first + XL sample (`20GBX9901`, 9×4 keypad) |
| Elgato sample `lights-out` (see above) | v2 | the reference for bundled profiles |

No public Star Citizen `.streamDeckProfile` with readable JSON was found on GitHub. Star Citizen profiles
exist only as paid Marketplace or store downloads, e.g.
https://marketplace.elgato.com/product/star-citizen-quantum-command-for-stream-deck-xl-ea8a7018-bfaa-4ca3-86ad-22dba1b4fd01
and https://store.streamspell.com/products/star-citizen-stream-deck-profile-icon-pack. Known Star Citizen
repos (mhwlng, Jarex985/SCStreamDeck, korneliusvontastik/sck3-sd-plugin, SCCP-FR) are plugins or plans and
ship no profiles. The DCS profiles above are the best stand-in, because DCS (like Star Citizen) binds
left- and right-side modifiers separately.

### Open-source tools that read or write profiles (and what they learned)

| Tool | Lang, date | Learned |
|---|---|---|
| https://github.com/data-enabler/streamdeck-profile-generator | Node + jszip, 2024 | v2 writer; `profileFolderId()` = base32 algorithm; README: "double-click the resulting `.streamDeckProfile` file to load it"; uses `ActionID` all zeros ("so I guess they don't matter?") |
| https://github.com/jlgabriel/StreamDeck-Profile-Generator | Python, v0.9.2, Apr 2026 | **v3 writer, "compatible with Stream Deck software v7.3+"**; commit `528d53a` "V3 multi-page fix: empty default page + content in Pages array"; commit `65775da` "Fix hotkey display… use proper Qt key codes… Add Qt::KeypadModifier flag (0x4000) for numpad keys so Stream Deck shows 'Teclado numérico: X'"; README known issue: punctuation keys *display* wrong on non-US layouts, "the hotkeys still function correctly" |
| https://github.com/verygoodplugins/streamdeck-mcp | Python, Jul 2026 | edits `%APPDATA%\Elgato\StreamDeck\ProfilesV3` (fallback `ProfilesV2`) on disk; **the app caches profiles and rewrites the manifests when it quits, so the app must be closed while editing**; **`Encoder.Icon` / `Encoder.background` are stripped on quit unless the action's plugin declares `Controllers: ["Encoder"]`**; + XL keypad is 9 columns (hardware-checked) |
| https://github.com/BarRaider/streamdeck-foldereditor | C#, v2.1, Feb 2025 | base32 alphabet `0123456789ABCDEFGHIJKLMNOPQRSTVW`; "supports new 6.x profile structure", tested on 6.8.1 (ProfilesV2) |
| https://github.com/ydmw74/elgato2streamcontroller | Python, Oct 2026 | the same base32 function (via `base64.b32hexencode` with U→V, V→W); handles `system.hotkeyswitch` (`Hotkeys[0]`, `[1]`); "the key is held while pressed" for the Hotkey action |
| https://github.com/achedon12/tuxcast/wiki/Elgato-Actions | wiki | UUID list including `system.hotkeyswitch`, `profile.switchprofile`, `multiactions.routine2`, `system.delay`; "rotate works only when the target profile is in the same backup" |
| ScriptDeck (PowerShell): https://www.powershellgallery.com/packages/ScriptDeck/0.1/Content/New-StreamDeckProfile.ps1 | 2021 | v1 format: single manifest with `Actions`, `DeviceModel`, `DeviceUUID`, `Version: "1.0"` in `<GUID>.sdProfile` |
| `streamdeck_prof` Ruby gem: https://www.rubydoc.info/gems/streamdeck_prof/StreamdeckProf/Profile | | v1 era |

My parsing scripts are in `scripts/` next to this file: `dump_actions.py`, `scan_hotkeys.py`, `catalog.py`,
`imgstats.py` and `pageid.js`. There is also a working Node prototype writer,
`scripts/proto/make-sample-profile.js`. Its output passes `unzip -t` and JSON parsing, but **it has not
been imported into a real Stream Deck app** (no Windows machine here).

---

## 2. Container and layouts

### 2.1 The ZIP itself [R]

- Plain ZIP, deflate, entry names with `/`, UTF-8 name flag (`0x800`). The app writes zip version 4.5,
  "create system" 10, a data descriptor (`0x8`) and **explicit directory entries** (even for empty
  `Images/`), with external attributes `0x10` (dir) and `0x20` (file).
- Script-made zips **without directory entries** and with `indent=2` JSON are also in the wild and are
  reported to import (jlgabriel v3, data-enabler v2) [R]. Directory entries are cheap, so write them.
- JSON: UTF-8 **without BOM**. The app writes it compact, with **object keys in alphabetical order**
  (Qt's `QJsonObject` does this; the field `QTKeyCode` shows the app is Qt-based) [R/I]. Key order is
  almost certainly irrelevant on read, but mirroring it costs nothing.
- File name: anything ending in `.streamDeckProfile`. For a plugin bundle the file name must equal the
  manifest `Name` + extension (section 8) [C].
- Node built-ins are enough: `zlib.deflateRawSync`, plus `zlib.crc32` (Node ≥ 20.15 / 22.2) or a 10-line
  CRC table. See `scripts/proto/make-sample-profile.js`.

### 2.2 v2 layout (Stream Deck ~5.x–6.x exports; Elgato's bundled sample) [C/R]

```
<PROFILE-UUID-UPPER>.sdProfile/
  manifest.json                      top-level manifest, "Version": "2.0"
  Images/                            (present, usually empty)
  Profiles/
    <26 base32 chars + Z>/           one folder per page (content pages, the Default page, folder pages)
      manifest.json                  page manifest
      Images/
        <anything>.png               images referenced as "Images/<name>" from this page
```

Elgato `sd.streamDeckProfile` (type 0), exact entry list:

```
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/manifest.json
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/          <- Default (empty) page
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/Images/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/manifest.json
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/          <- page 1
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/Images/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/manifest.json
```

```json
{"Device":{"Model":"20GAA9901","UUID":""},"Name":"Lights Out",
 "Pages":{"Current":"cca21b93-64c5-4578-8a58-a6c35df9a5f2",
          "Default":"58012f2d-6556-4424-a672-51814fcb396c",
          "Pages":["cca21b93-64c5-4578-8a58-a6c35df9a5f2"]},
 "Version":"2.0"}
```

`PIH1N4R4OL2NH2IOKR1LRVD5V8Z` decodes to `cca21b93-…` (Current, page 1). `B00IVBB5AP2299JIA60KWIPPDGZ`
decodes to `58012f2d-…` (Default). The Default page manifest is exactly
`{"Controllers":[{"Actions":{},"Type":"Keypad"}],"Icon":"","Name":""}` (68 bytes).

User exports (danexrc, 2023) also contain `manifest.json.bak` files. The `.bak` keeps the **real device
id** (`"UUID":"@(1)[4057/108/CL35J1A02790]"`, i.e. VID/PID/serial), while the exported `manifest.json`
has `"UUID":""` [R]. Never ship `.bak` files.

### 2.3 v3 layout (Stream Deck 7.x exports) [R]

```
package.json
Profiles/
  <PROFILE-UUID-UPPER>.sdProfile/
    manifest.json                    "Version": "3.0"
    Images/
    Profiles/
      <PAGE-UUID-UPPER>/             e.g. 1C2D10FC-B5A4-4197-A483-245EC7068A11
        manifest.json
        Images/<27 base32 chars>Z.png   (any file name works, see below)
```

`package.json` (HeirOfGaia, 7.3.1 Windows export), verbatim:

```json
{"AppVersion":"7.3.1.22604","DeviceModel":"20GBA9901","DeviceSettings":null,"FormatVersion":1,
 "OSType":"Windows","OSVersion":"10.0.26200",
 "RequiredPlugins":["com.elgato.streamdeck.page","com.elgato.streamdeck.profile.backtoparent",
  "com.elgato.streamdeck.profile.openchild","com.elgato.streamdeck.profile.rotate",
  "com.elgato.streamdeck.multiactions","com.elgato.streamdeck.system.text"]}
```

Top-level manifest (same file, `AppIdentifier` shortened):

```json
{"AppIdentifier":"C:\\Users\\<user>\\…\\HytaleClient.exe",
 "Device":{"Model":"20GBA9901","UUID":"f57d956d-052e-4a2b-bcae-ca0684877148"},
 "Name":"HeirOfGaia Commands",
 "Pages":{"Current":"00000000-0000-0000-0000-000000000000",
          "Default":"81888262-27ae-4591-b8b7-a01b632dd6b6",
          "Pages":["1c2d10fc-b5a4-4197-a483-245ec7068a11"]},
 "Version":"3.0"}
```

v3 observations [R]:

- `RequiredPlugins` lists the `Plugin.UUID`s used, including built-in "plugins" such as
  `com.elgato.streamdeck.page`. This is presumably what powers 7.0's "profiles tell you which plugins
  you'll need … install them with one click" [C-].
- In exports `Pages.Current` is all zeros. `Device.UUID` is a random GUID in v3 exports (empty in v2
  exports); on disk it is `@(1)[VID/PID/serial]`. jlgabriel writes `""` in v3 and reports success.
- **Script-written v3 imports** [R]: phew-blue's `usethisone.streamDeckProfile` is an *app* export (7.4.0,
  Stream Deck's zip signature). It still contains the image names their Python script invented
  (`5D9352EC47593FD285FA58E493Z.png`, 26 hex + `Z`), the script's `Plugin.Name` values (`"Down"`,
  `"sonarr"`) and the script's settings for their own plugin actions. So a script-written v3 zip was
  imported into 7.4 and re-exported, and the app kept arbitrary image names and `Plugin.Name`s. (The
  backtoparent `Plugin.Name` was normalised to "Open Parent Folder" in one place.)
- The same export shows `"Name":"Default Profile copy 1"`. The app appends " copy N" when a profile of
  the same name already exists [R].
- **When v3 started:** not documented. BarRaider tested 6.8.1 with `ProfilesV2`; a 2026 forum post notes
  the on-disk folder "changed … from ProfilesV2 to ProfilesV3"; the earliest v3 export seen is 7.3.1.
  It is probably 7.0 (Aug 2025), the release that added required-plugin prompts [I]. Whether **6.x** can
  import a v3 zip is unknown [?]; v2 is the safe common denominator.
- **7.1+ resources:** actions carry `"Resources": null` (or a map of files, which the 7.1 resources
  guide says are packed into the exported `.streamDeckProfile`) [C/R]. Not needed for hotkeys.

### 2.4 `.streamDeckProfilesBackup` [R]

The app's full backup is also a ZIP:
`Profiles/<UUID>.sdProfile/…` (v3 on-disk form, page folders = uppercase UUIDs) plus
`Resources/manifest.json` (`{"resources": null}`). It restores every profile, so it's not a distribution
format, but it is the best source of **on-disk** v3 JSON (Elgato's default SD+ profile came from one).

### 2.5 v1 (pre-5.x) [R]

A single `<GUID>.sdProfile/manifest.json` with `Actions` at the top level, `DeviceModel`, `DeviceUUID`,
`Name`, optional `AppIdentifier` and `"Version": "1.0"` (ScriptDeck, streamdeck_prof). It has no pages.
Don't generate it.

---

## 3. IDs and case rules

| Thing | Form | Evidence |
|---|---|---|
| Profile folder | `<UUID>.sdProfile`, UUID **upper case** (all samples, v2 and v3) | [R] |
| Page UUIDs inside JSON (`Pages.*`, `ProfileUUID`) | **lower case** with hyphens | [R] |
| v2 page folder | base32 of the page UUID + `Z` (27 chars), see below | [R], 3 tools agree |
| v3 page folder | page UUID **upper case** | [R] |
| `ActionID` | random lower-case UUID per action instance. data-enabler wrote all zeros and it imported [R]; use unique ones anyway | [R] |
| Image file names | app-made: 27-char base32 + `Z.png` of a random UUID. **Any name works** (app keeps them: `HOMEOPSZ.png`, `GEAR.png`-style names, `dial_intensity-coarse-48.png`) | [R] |

v2 folder id (Node, tested against Elgato's files):

```js
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTVW';      // base32hex without 'U'
function v2FolderId(uuid) {                            // 'cca21b93-64c5-…' -> 'PIH1N4R4OL2NH2IOKR1LRVD5V8Z'
  let n = BigInt('0x' + uuid.replace(/-/g, '')) << 2n;  // 128 bits -> 130 bits = 26 x 5
  let s = '';
  for (let i = 0; i < 26; i++) { s = ALPHA[Number(n & 31n)] + s; n >>= 5n; }
  return s + 'Z';
}
```

---

## 4. Top-level manifest (`<UUID>.sdProfile/manifest.json`)

### 4.1 Fields [R]

| Field | v2 | v3 | Notes |
|---|---|---|---|
| `Device.Model` | yes | yes | model string, see 4.2 |
| `Device.UUID` | `""` in exports | GUID in exports, `@(1)[VID/PID/serial]` on disk | write `""` |
| `Name` | yes | yes | name shown in the profile list; the installed name gets " copy N" on a clash |
| `Pages.Current` | a page UUID | zeros in exports | v2: first content page |
| `Pages.Default` | UUID of an **empty** page that is *not* in `Pages.Pages` | same | absent in some 2021–23 exports; always write it |
| `Pages.Pages` | ordered content page UUIDs (pages 1…n, max 10 [C-]) | same | |
| `Version` | `"2.0"` | `"3.0"` | |
| `AppIdentifier` | optional | optional | Smart Profile binding = the full exe path (`"C:\\…\\DerailValley.exe"`); `"*"` appears in streamdeck-mcp fixtures. **Leave it out**: it would put a local path in the file, and Smart Profiles are a per-user choice |

jlgabriel's note ("Default page must be empty, content pages in `Pages.Pages`, explicit Prev/Next
buttons are needed for hardware navigation") matches every real file.

### 4.2 `Device.Model` for each target (full table in `devices.md`)

| Device (`DeviceType`) | Grid cols×rows | Model string to write | Confidence |
|---|---|---|---|
| Stream Deck / MK.2 / Scissor / Module 15 (0) | 5×3 | `20GAA9901` (Elgato's own type-0 sample); MK.2 exports carry `20GBA9901` | [C] / [R] |
| Mini / Module 6 (1) | 3×2 | `20GAI9901` | [C] |
| XL / Module 32 (2) | 8×4 | `20GAT9901` (2022 rev exports `20GAT9902`) | [C] / [R] |
| Mobile (3) | sample uses 8×8 | `VSD2/WiFi` | [C] |
| Pedal (5) | 3×1 | `20GBF9901`? | [?] |
| Stream Deck + (7) | 4×2 keys + 4×1 Encoder | `20GBD9901` (Aputure's generated file says `20GBC9901`, unexplained) | [C] |
| Neo (9) | 4×2 keys + `Neo` controller | `20GBJ9901` | [C] |
| Studio (10) | – | no app profiles | [C] |
| Virtual Stream Deck (11), Galleon 100 SD (12) | ?, 3×4 + 2 dials | unknown | [?] |
| Stream Deck + XL (13) | **9×4 keys** + 6×1 Encoder | `20GBX9901` | [R] |

Elgato's getting-started table lists + XL as "38 keys, 4 x 9"; 4×9 is 36, so 38 is a doc typo. Hardware
and streamdeck-mcp say 36 keys in 9 columns × 4 rows.

Profiles are device-type specific, OS specific, and "do not auto-scale when imported to a smaller
device" [C]. Since 7.0 the import dialog has a device dropdown that pre-selects the current device [C-].
Whether it refuses or adapts a mismatched model was not confirmed [?]. **Ship one file per model**,
named for it. Elgato's own convention is `StreamDeck`, `StreamDeckMini`, `StreamDeckXL`, `StreamDeckPlus`
and `StreamDeckNeo`, used for the `custom_default_profiles` mechanism [C].

---

## 5. Page manifest (`Profiles/<page>/manifest.json`)

```json
{"Controllers":[{"Actions":{ "<col>,<row>": { …action… } },"Type":"Keypad"},
                {"Actions":{ "<dial>,0":     { …action… } },"Background":"Images/X.png","Type":"Encoder"}],
 "Icon":"","Name":"G1000"}
```

[R] details:

- `Controllers[].Type`: `"Keypad"`, `"Encoder"` (Stream Deck + and + XL), `"Neo"` (Neo; always
  `{"Actions":{}}` in Elgato's sample; Neo plugin actions need 7.6+ [C]).
- `Actions` keys are `"col,row"`, 0-based from the top left. Encoder keys are `"0,0"`…`"3,0"` (SD+) or
  `"0,0"`…`"5,0"` (+ XL). `Actions` may be `{}` or **`null`** when empty; the app writes `null` in v3 [R].
- The SD+ page always has **both** controllers, even when the Encoder is empty; Neo pages carry `Keypad`
  plus `Neo` [R]. Write every controller the model has.
- `Encoder.Background` (capital B, controller level) = the full touch-strip background for the page:
  `Images/…png`, **800×100** on SD+ [R]. On + XL it is presumably 1200×100 [I].
- Page `Name` (e.g. `"NAV"`, `"G1000"`) and `Icon` are optional. Old v2 exports had only `Controllers` [R].

### 5.1 Action entry [R]

```json
{
 "ActionID": "c70b1a1f-ee7d-4963-9791-db82ec461a79",
 "LinkedTitle": true,
 "Name": "Hotkey",
 "Plugin": {"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"},
 "Resources": null,
 "Settings": { … },
 "State": 0,
 "States": [ { …state… } ],
 "UUID": "com.elgato.streamdeck.system.hotkey"
}
```

- `Plugin` and `Resources` appear only in v3 (and not even always). v2 has neither [R]. For third-party
  actions, `Plugin` is `{Name, UUID: <plugin UUID>, Version: <plugin version>}`, e.g.
  `{"Name":"Volume Controller","UUID":"com.elgato.volume-controller","Version":"2.0.2.166"}` [R].
- `Name` is only a label (localised exports have `"Raccourci"` and `"Créer un dossier"`) [R].
- `State` is the current state index; `States` has one entry per state (1 or 2 seen). For our own plugin
  actions, match the state count in our manifest [R].
- `LinkedTitle`: true (4781×) or false (1001×); sometimes absent [R].
- Optional extras seen [R]: `AutoExit: {"Delay":1,"Enabled":false}` on backtoparent;
  `MultiActionDelays` and `OverrideState` on actions nested in multi-actions; `Encoder: {…}` on dial actions;
  `Actions: [...]` on container actions (multi action, Key Logic, Action Trigger, Dial Stack).

### 5.2 State object [R] (value frequencies from about 6,700 real states)

| Field | Values seen | Notes |
|---|---|---|
| `Title` | string, `\n` for line breaks | `" "` is used to force an empty title |
| `ShowTitle` | true / false | |
| `TitleAlignment` | `"bottom"` (2419), `"middle"` (2046), `"top"` (341) | |
| `TitleColor` | `"#rrggbb"`, lower case | |
| `FontFamily` | `""` (default font), `"Tahoma"`, `"Arial"`, … | |
| `FontSize` | integers 6–18 (9 and 12 most common) | |
| `FontStyle` | `""`, `"Regular"`, `"Bold"`, `"Italic"`, `"Bold Italic"` (schema) | localised and garbage values exist in user files |
| `FontUnderline` | bool | |
| `OutlineThickness` | always `2` | |
| `Image` | `"Images/<file>"` relative to the **page** folder | |

All fields are optional. Minimal real states: `{}` or `{"Image": "Images/X.png"}` or `{"Title": "Mic"}`.
The common full form is
`{FontFamily, FontSize, FontStyle, FontUnderline, Image, OutlineThickness, ShowTitle, Title, TitleAlignment, TitleColor}`.

### 5.3 Dial (Encoder) action extras [R]

From Elgato's default Stream Deck + profile (on-disk v3):

```json
{"Background":"Images/R3K7QCRT9D7B32760VA106P984Z.png","Type":"Encoder","Actions":{
 "0,0":{"ActionID":"7e57b416-…","Encoder":{"Icon":"Images/WSNHTJI8OP7F79W252IB6PSJO4Z.png"},
        "LinkedTitle":true,"Name":"Hotkey",
        "Plugin":{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"},
        "Resources":null,
        "Settings":{"Coalesce":true,"Hotkeys":[
          {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":2,"KeyOption":false,"KeyShift":false,"NativeCode":90,"QTKeyCode":90,"VKeyCode":90},
          {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":3,"KeyOption":false,"KeyShift":true,"NativeCode":90,"QTKeyCode":90,"VKeyCode":90},
          {…empty…},{…empty…}]},
        "State":0,"States":[{"Title":"Undo/Redo"}],"UUID":"com.elgato.streamdeck.system.hotkey"},
 "3,0":{"ActionID":"5f302d4e-…","Encoder":{"IconVisible":false,"background":"Images/H31F4DK4K906N84M7G9Q2LA57GZ.png"},
        "Name":"Hotkey", …, "Settings":{"Coalesce":true,"Hotkeys":[ {…VK 38 Up…}, {…VK 40 Down…}, {…empty…}, {…empty…} ]},
        "States":[{"Title":" "}], …}}}
```

- `Encoder.Icon`: dial icon, 48×48 PNG. `Encoder.IconVisible`: false hides it.
  `Encoder.background` (**lower-case b**): that dial's own 200×100 touch-strip segment [R].
- streamdeck-mcp found that the app strips `Encoder.Icon` / `Encoder.background` on quit **unless the
  action's plugin declares `Controllers` including `"Encoder"`** [R (tool author)]. Built-in Hotkey
  supports dials (it is in Elgato's own default profile), so it keeps them. Our plugin's dial actions
  must declare `"Encoder"`.

### 5.4 Images [R]

Observed sizes and formats (about 4,100 images in the parsed files): key images are mostly PNG at
144×144 (about 1,600), 288×288 (about 1,460), 72×72 (about 580), 100 and 200, with a few JPEG
(18) and SVG (24). Any square size is accepted and the app
scales [C-: "larger images are scaled down automatically", minimum 72×72]. Dial icons are 48×48 and touch
strips 800×100 (page) or 200×100 (dial). Elgato's help lists **GIF and animated WEBP** as supported key
images [C-]. A GIF referenced from a profile state should animate, but no real profile with a GIF was
found to prove it [I].

**Recommendation:** 144×144 PNG for keys on every model (the largest native key is 120×120 on SD+ and
112×112 on + XL, so 144 covers all). Use 288×288 if the image must stay sharp on the Stream Deck Mobile
or Virtual Stream Deck, and 200×100 / 800×100 / 1200×100 for touch-strip art. Store images in the page's
own `Images/` folder and reference them as `"Images/<name>.png"`. Use the base32 naming for safety; it
isn't required.

---

## 6. Built-in Hotkey (`com.elgato.streamdeck.system.hotkey`)

### 6.1 Settings shape [R]

```json
"Settings": {
  "Coalesce": true,
  "Hotkeys": [
    {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":6,"KeyOption":true,"KeyShift":false,
     "NativeCode":84,"QTKeyCode":84,"VKeyCode":84},                                   // Ctrl+Alt+T
    {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,
     "NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1},                            // empty slot
    {…empty…}, {…empty…}
  ]
}
```

- Real Windows exports always have **4 entries** (older generators wrote 2). The empty marker is
  `NativeCode 146, QTKeyCode 33554431` (= `0x01FFFFFF`, Qt::Key_unknown), `VKeyCode -1`,
  `KeyModifiers 0`. A Mac-made file (Aputure) uses `NativeCode -1` for empty slots.
- `Coalesce: true` in every real file (about 1,900 actions). Its meaning is undocumented [?]. Always
  write `true`.
- `Plugin` (v3): `{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"}`.
- **Key slot use on keys**: only `Hotkeys[0]` was ever filled on Keypad actions [R]. The app presses the
  key down when the Stream Deck key goes down and releases it when the key is released ("Taste wird
  gehalten, solange gedrückt", elgato2streamcontroller) [R, widely relied on for push-to-talk].
- **Dial slot use** (Hotkey placed directly on an Encoder; Elgato: "Hotkeys can be used for press/tap,
  clockwise rotation and counterclockwise rotation" [C-]):
  - Elgato's default SD+ profile: `[0]` = Ctrl+Z (Undo), `[1]` = Ctrl+Shift+Z (Redo), title "Undo/Redo".
  - Aputure's + XL file: `[0]` = Shift+Down, `[1]` = Shift+Up, `[2]` = `.`, title "intensity coarse".

  So the slot order is **`[0]` counter-clockwise, `[1]` clockwise, `[2]` press, `[3]` touch?** [I; the
  first three are consistent across two sources; touch is a guess]. Test it on hardware.

### 6.2 `KeyModifiers` bitmask (Windows) [R + I]

Decoded from DCS profiles, whose titles match DCS default binds (e.g. "Labels" = LShift+F10 →
`0x10011`), and from numpad keys in Derail Valley and Transport Fever profiles:

| Bit | Meaning | Real example |
|---|---|---|
| `0x0001` | Shift (any) | `1` = Shift |
| `0x0002` | Ctrl (any) | `2` = Ctrl |
| `0x0004` | Alt (any) = `KeyOption` | `6` = Ctrl+Alt |
| `0x0008` | Win = `KeyCmd` | `8` = Win+D ("Show Desktop" in Elgato's default profile), `9` = Win+Shift+S |
| `0x0010` | **Left Shift** | `0x10011` = LShift+F10 ("Labels") |
| `0x0020` | **Left Ctrl** | `0x10022` = LCtrl+P |
| `0x0040` | **Left Alt** | `0x10044` = LAlt+2 ("AP Head") |
| `0x0080` | Left Win | not seen [I] |
| `0x0100` | **Right Shift** | `0x10101` = RShift+R ("Night", F-16) |
| `0x0200` | **Right Ctrl** | `0x10202` = RCtrl+C ("Cockpit", Ka-50) |
| `0x0400` | **Right Alt** | `0x10606` = RCtrl+RAlt+C, `0x10505` = RShift+RAlt+H |
| `0x0800` | Right Win | not seen [I] |
| `0x4000` | **Keypad (numpad) key** | `16384` = Num0…Num9, Num* + - . /; `16385` = Shift+Num+; `0x14202` = RCtrl+Num0; `0x14044` = LAlt+Num+ |
| `0x10000` | **side-specific modifiers in use**, set together with any `0x10`–`0x800` bit | all of the above |
| `0x20000` | seen once with VK 111 (Num /, an extended key): `147456` = `0x24000` | [?] |
| `0x40000000` | seen once (`NativeCode 192`, `VKeyCode -1`) | [?] (Qt::GroupSwitchModifier value) |

Rules for a writer [R]:

- Set the booleans to match: `KeyShift` = any shift bit, `KeyCtrl` = any ctrl bit, `KeyOption` = any alt
  bit, `KeyCmd` = any win bit. Real files always keep the generic bits (1/2/4/8) set alongside the side
  bits (e.g. RCtrl = `0x10000|0x200|0x2` = 66050).
- Whether the app really presses the **right-hand** key for `0x200` / `0x400` is not documented. DCS
  users rely on it, and Star Citizen also separates `lalt` / `ralt` [I]. Test with the dry-run showcase
  or a key logger before relying on it.

### 6.3 Key codes [R]

`VKeyCode` = `NativeCode` = Windows VK code; `QTKeyCode` = Qt key code. Verified pairs:

| Key | VK / Native | QTKeyCode |
|---|---|---|
| A–Z | 65–90 | same (65–90) |
| 0–9 (top row) | 48–57 | same |
| Space | 32 | 32 |
| Tab / Enter / Esc / Backspace | 9 / 13 / 27 / 8 | 16777217 / 16777220 / 16777216 / 16777219 |
| Insert / Delete / Home / End / PgUp / PgDn | 45 / 46 / 36 / 35 / 33 / 34 | 16777222 / 16777223 / 16777232 / 16777233 / 16777238 / 16777239 |
| Left / Up / Right / Down | 37 / 38 / 39 / 40 | 16777234 / 16777235 / 16777236 / 16777237 |
| F1…F12 (F13…F24) | 112…123 (124…135) | 16777264 + n−1 (`0x01000030`+) |
| Numpad 0–9 | 96–105 | **48–57** (character) + `KeyModifiers \|= 0x4000` |
| Num * + − . / | 106 / 107 / 109 / 110 / 111 | 42 / 43 / 45 / 46 / 47 (+`0x4000`) |
| Num Enter | 13 (+`0x4000`) | 16777221 (Qt::Key_Enter) per jlgabriel [I] |
| ; = , − . / ` [ \ ] ' (US layout) | 186 187 188 189 190 191 192 219 220 221 222 | 59 61 44 45 46 47 96 91 92 93 39 |

- Some Windows profiles have `VKeyCode: -1` with a real `NativeCode` (numpad keys in JustaDevOnTheMove's
  files). So `NativeCode` alone appears to be enough for playback on Windows [I]. Write both.
- A `QTKeyCode` that doesn't match the layout only breaks the **displayed** key name in the Property
  Inspector ("the hotkeys still function correctly", jlgabriel README) [R].
- A Mac-made Windows profile has mac key codes (`NativeCode 19` = kVK_ANSI_2) [R]. Hotkeys are OS
  specific, so generate Windows profiles only.

Example (DCS Ka-50, v2, real file):

```json
{"ActionID":"b5577e6d-1745-43dc-8559-d335fdf99b3a","LinkedTitle":false,"Name":"Raccourci",
 "Settings":{"Coalesce":true,"Hotkeys":[{"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":66050,"KeyOption":false,
   "KeyShift":false,"NativeCode":67,"QTKeyCode":67,"VKeyCode":67}, "…3 empty…"]},
 "State":0,"States":[{"FontFamily":"","FontSize":10,"FontStyle":"","FontUnderline":false,
   "Image":"Images/72VDM5NEFH6B9B73789VNVFETOZ.png","OutlineThickness":2,"ShowTitle":true,
   "Title":"Cockpit","TitleAlignment":"bottom","TitleColor":"#ffaaff"}],
 "UUID":"com.elgato.streamdeck.system.hotkey"}
```

`66050` = `0x10202` = Right Ctrl, so this is RCtrl+C.

### 6.4 Hotkey Switch (`com.elgato.streamdeck.system.hotkeyswitch`)

UUID confirmed by two converters (elgato2streamcontroller, tuxcast) [R]. The settings use the same
`Hotkeys` array: `[0]` = first press, `[1]` = second press [R (converter code)]. Two states toggle
locally [C-, help]. No real file containing one was found, so the exact JSON is unverified [?]. Each tap
still sends one hotkey, but the local state can drift out of sync with the game. Prefer separate keys or
plugin-driven state.

---

## 7. Navigation and linking ("scenes")

Catalog compiled from all parsed files [R] (Plugin block = v3 `Plugin`):

| Purpose | Action `UUID` | v3 `Plugin` | `Settings` | Notes |
|---|---|---|---|---|
| Next page | `com.elgato.streamdeck.page.next` | `{"Name":"Pages","UUID":"com.elgato.streamdeck.page","Version":"1.0"}` | `{}` | States `[{}]` |
| Previous page | `com.elgato.streamdeck.page.previous` | same | `{}` | |
| **Go to page** | `com.elgato.streamdeck.page.goto` | same | `{"PageIndex": N}` | **1-based**: on a 5-page profile, PageIndex 1 = page 0 ("HOME") and 4 = the 4th entry of `Pages.Pages` (verified against page names) |
| Page indicator | `com.elgato.streamdeck.page.indicator` | same | `{}` | shows the page number or name |
| Open folder | `com.elgato.streamdeck.profile.openchild` | `{"Name":"Create Folder","UUID":"com.elgato.streamdeck.profile.openchild","Version":"1.0"}` | `{"ProfileUUID":"<child page uuid, lower>"}` | the child is a page folder **not** listed in `Pages` |
| Back from folder | `com.elgato.streamdeck.profile.backtoparent` | `{"Name":"Open Parent Folder","UUID":"com.elgato.streamdeck.profile.backtoparent","Version":"1.0"}` | `{}` | the app places it at `0,0` of every folder page (BarRaider's tool exists only to move it); optional `AutoExit` |
| Switch profile | `com.elgato.streamdeck.profile.rotate` (Name "Switch Profile") | `{"Name":"Switch Profile","UUID":"com.elgato.streamdeck.profile.rotate","Version":"1.0"}` | `{"DeviceUUID":"","PageIndex":1,"ProfileUUID":"<profile uuid, lower>"}` | points at a profile UUID on *this* machine; `PageIndex` presumably 1-based too [I]. tuxcast also lists `profile.switchprofile` [R?] |
| Action Trigger (dial → key actions) | `com.elgato.streamdeck.keys.adaptor` | `{"Name":"Keys","UUID":"com.elgato.streamdeck.keys","Version":"1.0"}` | `{}` + `Actions: [ccw, press, cw]` + `Encoder:{…}` | 6.8+ [C-]; the **array order is [CCW, press, CW]**, inferred from a Derail Valley profile whose keybind screenshots show T = throttle down, G = throttle up, giving [T, reset-script, G] [I-strong] |
| Key Logic | `com.elgato.streamdeck.keys.logic` | same as above | `{}` + `Actions: [press, double, hold]` | 7.0+ [C-] |
| Dial Stack | `com.elgato.streamdeck.dial.stack` | – | `{"CurrentIdx":0,"FastNavigation":false,"ShowStackIcon":true}` + `Actions` | |
| Multi Action | `com.elgato.streamdeck.multiactions.routine` (+ `.routine2` = Multi Action Switch, `.delay`) | `{"Name":"Multi Action","UUID":"com.elgato.streamdeck.multiactions","Version":"1.0"}` | `{}` + `Actions:[{Actions:[…]},{Actions:[]}]`; delay `{"delay":3000}` | **forbidden by the AGENTS.md ground rule "one press per tap"** |
| Text | `com.elgato.streamdeck.system.text` | `{"Name":"Text",…}` | `{"Hotkey":{…},"isSendingEnter":true,"isTypingMode":false,"pastedText":"…"}` | types text: also a sequence, so don't use it |
| Open / Website | `com.elgato.streamdeck.system.open` / `.website` | | `{"path":"\"C:\\…\""}` / `{"openInBrowser":true,"path"\|"url":"https://…"}` | |
| Multimedia, Brightness, Sleep | `com.elgato.streamdeck.system.multimedia` `{"actionIdx":N}`, `.keybrightness`, `.sleep {"DeviceUUID":""}` | | | |

Action Trigger, real excerpt (Derail Valley SD+, v3):

```json
{"ActionID":"0a2615b9-…","Actions":[ {…system.hotkey VK 84 "T" (throttle down)…},
   {…system.open "t_12.ahk"…}, {…system.hotkey VK 71 "G" (throttle up)…} ],
 "Encoder":{"IconVisible":false},"LinkedTitle":true,"Name":"Action Trigger",
 "Plugin":{"Name":"Keys","UUID":"com.elgato.streamdeck.keys","Version":"1.0"},
 "Resources":null,"Settings":{},"State":0,"States":[{"Title":"スロットル"}],
 "UUID":"com.elgato.streamdeck.keys.adaptor"}
```

Nested actions inside `Actions` are full action objects (`ActionID`, `Plugin`, `Settings`, `States`, …).

### How to link scenes

- **Inside one profile (standalone, recommended):** make each scene (Combat, Mining, Salvage, Flight, …) a
  **page** of one per-model profile (≤ 10 pages [C-]). Put a navigation row on each page using
  `page.goto` (1-based) / `page.next` / `page.previous` / `page.indicator`. Use folders (`openchild` +
  `backtoparent`) for overflow; folder pages don't count against the 10-page limit (they're not in
  `Pages`) [I]. All of this survives import because it refers to page UUIDs inside the same file [R].
- **Across profiles:** don't use the built-in Switch Profile in a distributed pack. It stores the
  target's profile UUID. Copy or import may produce new UUIDs: vMix users report that IDs change when a
  profile is copied to another deck, and tuxcast notes the target must be "in the same backup" [I].
- **With the plugin:** a plugin action calls `switchToProfile` (section 8.3), which works for the
  plugin's **bundled** profiles by **manifest `Name`**, on a given device, with an optional page index.
- The ground rules also rule out Multi Action, Delay, Text, and Key Logic's double or hold presses
  (they automate), so don't emit those. Each dial-rotation tick fires one hotkey per detent. That needs
  the owner's sign-off as "one press per tap".
- Standalone profiles press keys through Elgato's app, **not** Tablet Deck, so Tablet Deck's
  `onlyWhenGameFocused` check does not apply to them. The Stream Deck app sends hotkeys to whatever
  window has focus. Flag this to the owner.

---

## 8. Bundling profiles in a plugin

### 8.1 Manifest entries [C]

Schema (`definitions.Profile`, verbatim excerpt from schemas.elgato.com):

```json
"Profile": {"type":"object","required":["DeviceType","Name"],"additionalProperties":false,"properties":{
  "AutoInstall": {"type":"boolean", "description":"…installed when the plugin is installed. When `false`, the profile will be installed the first time the plugin attempts to switch to it. Default is `true`. Available from Stream Deck 6.6."},
  "DeviceType": {"type":"number","enum":[0,1,2,3,4,5,6,7,8,9,10,11,12,13]},
  "DontAutoSwitchWhenInstalled": {"type":"boolean", "description":"…automatically switch to the profile when it is first installed. Default value is `false`."},
  "Name": {"type":"string","filePath":{"extensions":[".streamDeckProfile"],"includeExtension":false},
           "pattern":"^(?![~\\.]*[\\\\\\/]+)(?!.*\\.(([Ss][Tt][Rr][Ee][Aa][Mm][Dd][Ee][Cc][Kk][Pp][Rr][Oo][Ff][Ii][Ll][Ee]))$).*$",
           "errorMessage":"String must reference .streamDeckProfile file in the plugin directory, with the file extension omitted."},
  "Readonly": {"type":"boolean", "description":"…read-only, or if the user is able to customize it… Default value is `false`."}}}
```

DeviceType enum (docs): 0 Stream Deck, 1 Mini, 2 XL, 3 Mobile, 4 Corsair GKeys, 5 Pedal, 6 Corsair
Voyager, 7 Stream Deck +, 8 SCUF Controller, 9 Neo, 10 Studio, 11 Virtual Stream Deck, 12 Galleon 100 SD,
13 Stream Deck + XL [C].

Elgato's sample (`examples/lights-out`, current): `"Software":{"MinimumVersion":"7.1"}`, `"SDKVersion":3`:

```json
"Profiles": [
  {"Name":"sd","DeviceType":0,"Readonly":false,"DontAutoSwitchWhenInstalled":false},
  {"Name":"sdxl","DeviceType":2,"Readonly":false,"DontAutoSwitchWhenInstalled":false},
  {"Name":"sd-mini","DeviceType":1,"Readonly":false,"DontAutoSwitchWhenInstalled":false},
  {"Name":"sd-neo","DeviceType":9,"Readonly":false,"DontAutoSwitchWhenInstalled":false},
  {"Name":"sdp","DeviceType":7,"Readonly":false,"DontAutoSwitchWhenInstalled":false},
  {"Name":"sd-mobile","DeviceType":3,"Readonly":false,"DontAutoSwitchWhenInstalled":false}
]
```

Each `Name` is `<dir>/<file>` relative to the `.sdPlugin` folder, without the extension
(`profiles/combat-xl` → `profiles/combat-xl.streamDeckProfile`) [C]. Those files are **v2** zips whose
`Device.Model` is the type's representative model (`20GAA9901` for type 0, …) [C]. Use **one distinct
file per `DeviceType`**. Whether one `Name` may appear with several `DeviceType`s is untested [?]; the
plugin then picks the name that fits `device.type`.

### 8.2 What the user sees [C / R-community]

- Default (`AutoInstall` true): "users are prompted to install bundled Stream Deck profiles when the
  plugin is first installed" [C]. If `DontAutoSwitchWhenInstalled` is false, the app also switches to it.
- `AutoInstall: false` (6.6+): no prompt at install; "the user will instead then be prompted to install
  the bundled profile the next time your plugin attempts to switch to it" [C]. For a big pack (14 device
  types × several profiles) this avoids a wall of prompts. **Recommended:** `AutoInstall:false`,
  `DontAutoSwitchWhenInstalled:true`, `Readonly:false`.
- Installed bundled profiles get the `Name` from *inside* the `.streamDeckProfile`. If a profile with the
  same name already exists, a second "<name> copy" appears; makers have to delete originals to avoid
  duplicates. Mismatched or missing names make switching "very buggy". One plugin reports that on first
  install the device didn't switch back to the previous profile [R: Keyboard Maestro forum
  https://forum.keyboardmaestro.com/t/change-stream-deck-profile-from-macro/15542?page=4,
  https://github.com/f1-tools/MVF1-Streamdeck, Simflight PilotsDeck thread].
- Profiles do not auto-update when the plugin updates [C, packaging doc]. Re-bundled profiles likely
  install as new copies [I].

### 8.3 `switchToProfile` [C]

The raw WebSocket message, exactly as `@elgato/streamdeck` 3.0.4 sends it (`dist/plugin/profiles.js`):

```json
{"event":"switchToProfile","context":"<pluginUUID from registration>","device":"<device id>",
 "payload":{"profile":"profiles/combat-xl","page":0}}
```

- `profile` must be "identical to the one provided in the manifest" (the `Name` path). If omitted, the
  app switches back to the previous profile [C].
- `page` is **0-based**, optional, and needs Stream Deck 6.5+ [C]. Note that profile JSON `PageIndex` is
  1-based.
- "Plugins may only switch to profiles distributed with the plugin, as defined within the manifest, and
  cannot access user-defined profiles." [C]. So the plugin cannot jump into a profile the user imported
  by double-click. Standalone and plugin-integrated scenes are separate copies.
- Plugins cannot read or modify profiles through the SDK [C]. Editing `ProfilesV2` / `V3` on disk works
  only while the app is closed, because the app rewrites them on quit [R, streamdeck-mcp]. It is
  unsupported; don't do it.

---

## 9. Version differences summary

| | v1 (`"1.0"`) | v2 (`"2.0"`) | v3 (`"3.0"`) |
|---|---|---|---|
| Era | ≤ 4.x | 5.x – 6.x exports (pages since 5.1 [C-]); still accepted by 7.x (Elgato 7.1+ sample) | 7.x exports (7.3.1, 7.4.0, 7.5.1 seen) |
| Zip root | `<UUID>.sdProfile/` | `<UUID>.sdProfile/` | `package.json` + `Profiles/<UUID>.sdProfile/` |
| Pages | none (top-level `Actions`) | `Pages{Current,Default,Pages}`, page folders base32+Z | same, page folders uppercase UUID |
| Device | `DeviceModel`, `DeviceUUID` | `Device{Model,UUID:""}` | `Device{Model,UUID:<guid>}` |
| Action extras | – | – | `Plugin{Name,UUID,Version}`, `Resources` (7.1) |
| Required plugins prompt | – | – | `package.json.RequiredPlugins` (7.0+) |
| On-disk folder | `ProfilesV2`?/older | `%APPDATA%\Elgato\StreamDeck\ProfilesV2` | `%APPDATA%\Elgato\StreamDeck\ProfilesV3` |

---

## 10. Generator recipe (Node, built-ins only)

For each model (`DeviceType` → model string, keypad cols×rows, encoder count):

1. `profileUuid = crypto.randomUUID().toUpperCase()`. For each content page, the Default page and each
   folder page, generate `pageUuid = crypto.randomUUID()` (lower case in JSON). Generate fresh UUIDs per
   build, or derive them deterministically from a hash, so rebuilds are reproducible (UUID v4/v8 shape
   from SHA-1; any UUID string works).
2. Top-level manifest (v2):
   `{"Device":{"Model":M,"UUID":""},"Name":N,"Pages":{"Current":p1,"Default":def,"Pages":[p1..pn]},"Version":"2.0"}`.
   No `AppIdentifier`.
3. Page manifest:
   `{"Controllers":[{"Actions":{…},"Type":"Keypad"}, (SD+/+XL) {"Actions":{…},"Type":"Encoder","Background":"Images/strip.png"?}, (Neo) {"Actions":{},"Type":"Neo"}],"Icon":"","Name":"COMBAT"}`.
   The Default page has the same controllers with empty `Actions`.
4. Key action: built-in Hotkey as in 6.1, four slots with the three empty markers, booleans consistent
   with `KeyModifiers`, image `Images/<id>.png` in that page's `Images/`. Navigation actions as in
   section 7 (v2 form: no `Plugin` / `Resources`; adding them is harmless in 7.x [I]).
5. Dial action (SD+/+XL): built-in Hotkey on the Encoder controller with
   `Hotkeys[0]=CCW, [1]=CW, [2]=press` [I], `Encoder:{"Icon":"Images/x48.png"}` or
   `{"IconVisible":false,"background":"Images/x200x100.png"}`, title in `States[0].Title`.
6. Write the zip: dir entries plus files, deflate, UTF-8 flag. Folder names come from `v2FolderId()`.
   For a v3 variant: add a root `package.json`
   `{"AppVersion":"7.4.0.22712","DeviceModel":M,"DeviceSettings":null,"FormatVersion":1,"OSType":"Windows","OSVersion":"10.0.26200","RequiredPlugins":[…]}`,
   prefix everything with `Profiles/`, use uppercase page UUIDs as folder names, set `Current` to zeros
   and add `Plugin` / `Resources` to every action. (`AppVersion` / `OSVersion` are copied from real
   exports; whether they're checked is unknown [?].)
7. Plugin bundle: copy the same per-model files into `<plugin>.sdPlugin/profiles/…` and list them in
   `Profiles[]` (one per DeviceType). Our plugin's own actions in those profiles use `UUID` = our action
   UUID and, in v3, `Plugin` = our plugin. Dial actions must be declared `Controllers:["Encoder"]` (or
   `["Keypad","Encoder"]`) in our manifest so `Encoder.*` images aren't stripped.

Privacy (AGENTS.md): never copy fields from a real export into generated files. Exports leak
`AppIdentifier` paths with user names, the device serial in `.bak` files and `Device.UUID`. Leave
`AppIdentifier` out and write `Device.UUID` as `""`.

---

## 11. Unknowns to test on real hardware (Windows, Stream Deck 6.x and 7.x)

1. That a script-made v2 zip imports by double-click on 6.x and on current 7.x. The Elgato sample bundles
   v2 for 7.1+ [C], and data-enabler reports success, but no first-hand import was done here.
2. Whether a v3 zip imports on 6.x [?].
3. Whether a model mismatch (e.g. `20GAA9901` on an MK.2 or Scissor Keys) imports cleanly by double-click
   (it does for bundled profiles keyed by DeviceType [I]).
4. Dial Hotkey slot order `[CCW, CW, press, touch?]` and Action Trigger order `[CCW, press, CW]`.
5. That L/R modifier bits (`0x10000|0x200`, …) really press the right-hand modifier, and that numpad
   `0x4000` keys reach Star Citizen as numpad keys.
6. That an animated GIF referenced from `States[].Image` animates after import.
7. The touch-strip `Background` size on + XL (1200×100 expected) and the Model strings for Virtual
   Stream Deck / Galleon 100 SD.
8. Bundled-profile behaviour with many entries and `AutoInstall:false`: what the prompt looks like, and
   whether the same `Name` can appear for several `DeviceType`s.
9. Whether `PageIndex` in Switch Profile is 1-based (Go to Page is, as verified above).
10. The meaning of `Coalesce`, and of `KeyModifiers` bits `0x20000` and `0x40000000`.
