# Stream Deck built-in actions in profile manifests: navigation, system, dials, images (verified)

Fact-check of `navigation.md`, done 2026-11-06. The original file is unchanged. This version is
meant to replace it as the generator's reference.

How the check was done:

- **Clones checked against GitHub.** For every repo clone used as evidence, `git ls-remote` HEAD
  matched GitHub and the working tree was clean. That covers andresharpe, WeisAir, simracecenter,
  Linedev-Web, blackcarburning and threaddeck.
- **Own scanner, not the first draft's scripts.** I unpacked all 49 `.streamDeckProfile` files from
  those repos again and wrote a new scanner (`navv/scripts/*.py`). It ran over 148 `.sdProfile`
  folders: 30 v1, 78 v2 and 40 v3. App versions 7.2.1, 7.3.1, 7.4.0, 7.4.2, 7.5.1 and 7.6.0 are covered.
- **New real-file sources:**
  - ntanis-dev/essentials-for-spotify: the plugin's bundled profiles, with their whole git history.
  - phew-blue/streamdeck-home-ops: commit `7145092`, the untouched 7.4.0 app export, from before
    their generator rewrote the profile.
  - Nagaimo355/StreamDeckPlusController_for_DerailValley: a full backup.
  - JustaDevOnTheMove README.
  - Aputure's own 7.5.1 exports.
- **Elgato help articles fetched fresh** through the Zendesk API, including four the draft did not
  use: Action Trigger, Dial Stacks, Action Wheel, and Stream Deck + Hotkeys.
- **SDK typings.** `@elgato/streamdeck` 3.0.4 downloaded from npm.

Confidence tags:

| Tag | Meaning |
|---|---|
| **[C]** | Elgato primary source |
| **[R]** | Seen in real files the app wrote (count given where useful) |
| **[R-strong]** | Several independent app-written files agree, and nothing contradicts them |
| **[I]** | Inference |
| **[I-strong]** | Inference from several independent pieces of evidence |
| **[?]** | Unconfirmed; test on hardware |

Real paths and device serials in quoted JSON are redacted to `<path>` / `<serial>`.

---

## Changes from the first draft

### Corrections (the draft was wrong or overstated)

1. **Switch Profile across separately imported profiles: expect it to break.** The draft said
   "unknown". Three independent installs from a profile file show the app gives the installed copy
   **new profile, page and action UUIDs** [I-strong]:
   - **Elgato's Stream Deck + default profile on two PCs.** The layout and dial actions are
     identical, but every ID differs: profile `145F4E4C…` vs `AE1EE7B3…`, pages `43fd45d1/5eb3b727`
     vs `004b304f/5774b1fb`, dial ActionIDs `013b4223…` vs `7e57b416…`.
   - **Elgato's XL default profile.** Three copies exist (AngelCruzL ×2 and phew-blue), all with
     different IDs.
   - **A plugin-bundled profile installed by the app.** zalewski's "SDP" from Essentials for
     Spotify, `InstalledByPluginUUID` + `PreconfiguredName: "SDP"`. Its keys match the bundle
     version from 2025-05-05 slot for slot, but no page UUID or ActionID matches any of the 5
     bundle versions in git history.
   - **The 7.4 / 7.4.1 release notes agree.** They fix "nested Switch Profile actions inside a Multi
     Action could lose their internal references when imported". Rewriting "internal references"
     only makes sense if import assigns new IDs and patches references to the profile itself.
   - **Re-importing makes duplicates.** The app creates a duplicate named "… copy" (Keyboard Maestro
     forum, 2023), and phew-blue's file is named "Default Profile copy 1". A duplicate needs a new
     UUID.

   Folder links survive import: every folder key in the re-installed default profiles points at
   its new page folder. Consequence: **do not ship built-in Switch Profile keys that point at
   another theme's separate file and expect them to work.** See §5 for the options.
2. **Switch Profile `PageIndex` is 1-based** [R]. The draft said "assumed; no real value above 1".
   Phobic's "Fusion 360" export, a 4-page XL profile, has Switch Profile steps that target **its own
   profile UUID**:
   - `PageIndex: 4` and `PageIndex: 2` from page 1.
   - `PageIndex: 1` as the "back" step on pages 2 and 4.
   - 0-based, `4` would be out of range and `1` would point at page 2 itself.
3. **`Pages.Default` is the pinned page, not "always empty"** [R-strong]. 8 v2 app exports have keys
   on it:
   - Transport Fever 2 ×2: a bottom row of 8 Hotkeys on Default. All 3 normal pages leave that
     row empty.
   - Shapez2: rows 0–1 on Default, and the page avoids them.
   - WeisAir: a pinned "Go to Page".
   - DerailValley ×3: a pinned folder plus Hotkeys.

   This matches Elgato's description of pinned actions: "it will appear on every page with an
   empty key", added in 6.6. The Action Trigger help adds "You can pin Action Trigger to keep it
   accessible on all pages" [C]. A generator can put a shared nav row on `Default`; test it once.
4. **Multimedia `actionIdx` 1 and 2 are disputed** [R, conflict]. phew-blue's untouched 7.4.0 export
   of Elgato's XL default profile shows the next-track icon on `actionIdx: 1` and the play/pause
   icon on `actionIdx: 2`. The other evidence supports 1 = Play/Pause and 2 = Next:
   - Elgato's 6.x XL default profile (AngelCruzL) uses the same art with the icons the other way
     round.
   - A 7.x user profile has prev/`{}`/next keys with `{"actionIdx": 2}` on the "next" key.
   - The help article lists the options in that order.

   The mapping stays, with 1/2 marked for a hardware test. 0, 3, 4, 5 and 6 are consistent.
5. **Text action fields.** The draft said there were always two keys and the mode key was
   unknown. A 7.3.1 export (John-Mack, HeirOfGaia) writes
   `{"Hotkey": {"KeyModifiers": 0, "QTKeyCode": 33554431, "VKeyCode": -1}, "isSendingEnter": true, "isTypingMode": true|false, "pastedText": "…"}`
   [R, one source]. `isTypingMode: true` is "Simulate Typing" [I]; 6.9 made "Paste from
   Clipboard" the default [C].
6. **Key images are not all 144×144.** v3 app exports contain **PNG only**, but at 72×72, 144×144
   and **288×288**: 182 and 189 images at 288 in WeisAir's 7.4.x XL exports, and 70 in
   blackcarburning's 7.4.0 export. v2 exports also have JPEG and animated WebP. The safe rule is
   unchanged: PNG at 144×144 or larger.
7. **Open `path` is a command line, not "always quoted".** Elgato's own default profiles store bare
   `"notepad"`, `"calc"` and `"mspaint"` next to `"\"C:\\Program Files\\…\\chrome.exe\""`. A
   7.x user file adds arguments after the quoted exe [R]. Quote the exe path when it has spaces.
8. **Toggle Virtual Stream Deck.** The action UUID is `com.elgato.streamdeck.system.vsdtoggle`, not
   `com.elgato.streamdeck.vsdtoggle`, which is its Plugin UUID. Settings are
   `{"DeviceID": "<id>", "ProfileID": "<uuid>"}` [R]. Not needed for the pack.
9. **Auto Folder Exit, downgraded.** `AutoExit` appears only with `"Enabled": false`: 63 times on
   back keys (`Delay` 3 or 1) and 4 times on plugin actions. How an enabled exit is stored, and the
   per-action "Follow folder settings" flag, are not in any file. The draft's [R] for per-action
   overrides becomes **[?]**, and `{"Delay": n, "Enabled": true}` is **[I]**.
10. **Dial Hotkey slots: three are documented, the fourth is not.** The help article lists dial
    Hotkey functions as "Press / Tap, Rotate Clockwise, Rotate Counterclockwise" [C]. Slot order is
    still inferred from real files, now with a vendor source:
    - Elgato's default profile: Undo / Redo, and Up / Down.
    - Aputure's 7.5.1 Stream Deck + and + XL exports: `[F14, F15, press key, empty]`.

    Slot 0 is counter-clockwise and slot 1 clockwise [I-strong]. Slot 2 is press [R]. Slot 3 is
    **[?]**; leave it empty.
11. **Action Trigger now has an Elgato source.** Help article 29655069662609 (6.8+) says: "three
    options for clockwise, counterclockwise, and press". Its example is CCW → Previous Page,
    CW → Next Page, press → Page 1 [C]. The stored order `Actions: [CCW, press, CW]` is supported by
    three real files and the help example:
    - Nagaimo355's Derail Valley backup: `[T, script, G]` = throttle down / reset / throttle up.
    - zalewski: `[Previous Page, Page Indicator, Next Page]`.
    - The deckforge test fixture: `[Previous Page, Go to Page 1, Next Page]`, which is exactly the
      help example.

    zalewski's live folder is **partly hand-edited** (its pinned page uses ActionID
    `11111111-1111-4111-8111-111111111111`), so it is no longer counted as a clean app-written
    source.
12. **phew-blue is generated, not app-written.** Its `.streamDeckProfile` files are rewritten by a
    Python builder (`generate.py`, CI "regenerate Stream Deck profile" commits). They contain Website
    `{"url": …}` ×164, a fake `com.elgato.streamdeck.multi` "Home" action, and back keys at
    `7,0` / `0,3`. Only the original commit `7145092` is used here as evidence.
13. **Switch Profile `DeviceUUID`.** A real non-empty value exists, from WeisAir's virtual Stream
    Deck controlling an XL: `"DeviceUUID": "@(1)[4057/108/<serial>]"`. It is the app's per-device
    ID (USB vendor/product/serial), so the generator must keep `""` [R].

### Additions

- **`RequiredPlugins`** in `package.json` lists the **`Plugin.UUID`** of the actions used, e.g.
  `com.elgato.streamdeck.page` for any Page action, `com.elgato.streamdeck.multiactions` or
  `com.elgato.streamdeck.keys`, and not each action UUID [R, every v3 export]. This is a cross-check
  for `profiles.md`.
- **Next and Previous Page are optional.** Elgato's own Stream Deck + default profile has 2 pages and
  no Next or Previous key. simracecenter 7.6.0 has 4 pages, also without them [R]. The help article
  contradicts itself: it says they "cannot be deleted/removed" and also "can be deleted".
- **Go to Page inside folders** is used in real files: 27 keys in JustaDev and WeisAir [R]. Whether
  it leaves the folder and opens page N is assumed, not verified [I].
- **Folder links are almost always tree-shaped.** One folder page targeted from 2 different pages
  occurs once in 612 folders (Linedev-Web) [R]. What Back does for a folder reached two ways is
  [?].
- **Built-in dial actions without known UUIDs.** "Action Wheel" (6.7+, key actions on one dial,
  turn to choose and press to run [C]) has a UUID that appears in no file [?]. "Dial Stack" (press
  to cycle [C]) is `com.elgato.streamdeck.dial.stack` [R, v2 only].
- **Plugin-installed profiles** carry `InstalledByPluginUUID` and `PreconfiguredName` (the
  manifest `Profiles[].Name`) in the top manifest. The name stays when the user renames the profile:
  zalewski renamed "SDP" to "1.Main" [R]. Generated bundles also add `ReadOnly` [R]. This is why
  `switchToProfile(name)` keeps working after a rename [I].
- **Action Sharing** (6.8+) exports and imports single keys, dials, folders, Action Triggers and
  Multi Actions as files [C, help 29655138607505]. It could ship building-block panels, but the
  file format was not checked.
- **Numpad Hotkeys** in v2 exports are stored as `NativeCode` 96–111 with `KeyModifiers: 16384`, and
  `VKeyCode` is sometimes `-1` (JustaDev) [R]. This belongs to the hotkey research, which should
  confirm it against 7.x.

### Confirmed as written in the draft

These were re-checked by my own scanner, plus help or SDK where noted:

- Folder key UUID, `Settings.ProfileUUID` (772 keys) and Plugin block.
- Folder pages are sibling folders in the same `.sdProfile` and never listed in `Pages.Pages`
  (0 of 772).
- The v3 folder name is the upper-case UUID.
- The v2 folder-name formula: 180/180 listed pages plus 371/371 folder targets, plus 18/18 in the
  Spotify bundles, checked in Python and Node.
- The back key is at `0,0` in every app-written file, with `{}` (v3) or `null` (v2).
- Next, Previous, Indicator and Go to Page UUIDs. `PageIndex` is 1-based: 49 keys use
  `PageIndex == page count`, e.g. 10 on a 10-page profile, and none use 0.
- A profile can have up to 10 pages [C].
- `switchToProfile` uses a 0-based page and requires Stream Deck 6.5 for the page argument [C,
  3.0.4 source].
- Hotkey stores 4 slots plus `Coalesce` in every 7.x file. The empty slot is
  `NativeCode 146 / QTKeyCode 33554431 / VKeyCode -1` on Windows (8,123 times) and
  `NativeCode -1` on macOS.
- Website `{"openInBrowser", "path"}` plus an optional `browser`.
- Dial and touch-strip shape: `Encoder` controller, `"<n>,0"` slots, `Background` 800×100,
  `Encoder.Icon` 48×48, `Encoder.background` 200×100.
- Keypad `Background` 1024×600 on an XL (3 files, all WeisAir).
- The Neo `"Neo"` controller name [C, SDK]. Slot `"1,0"` comes from one source [R].
- Brightness `actionIdx` 0 = brighter and 1 = darker (icons in the untouched 7.4.0 export).
- The 7.1 note that Volume Controller is no longer bundled [C].
- Discord is a Marketplace plugin [C].

---

## 0. Short version for the generator

| Need | Action UUID | Settings | Conf. |
|---|---|---|---|
| Open a folder | `com.elgato.streamdeck.profile.openchild` | `{"ProfileUUID": "<child page uuid, lowercase>"}` | R-strong |
| Back out of a folder (put at `0,0`) | `com.elgato.streamdeck.profile.backtoparent` | `{}` | R-strong |
| Next page | `com.elgato.streamdeck.page.next` | `{}` | R-strong |
| Previous page | `com.elgato.streamdeck.page.previous` | `{}` | R-strong |
| Go to page N | `com.elgato.streamdeck.page.goto` | `{"PageIndex": N}`, **1-based**, counts `Pages.Pages` | R-strong |
| Page number on a key | `com.elgato.streamdeck.page.indicator` | `{}` | R (2 keys) + C (feature) |
| Page indicator on the Neo Infobar | `com.elgato.streamdeck.system.pagination` | `{}`, controller `"Neo"`, slot `"1,0"` | R (one source) |
| Switch profile | `com.elgato.streamdeck.profile.rotate` | `{"DeviceUUID": "", "PageIndex": N, "ProfileUUID": "<target .sdProfile uuid>"}`, **1-based** | R; **target breaks across separate imports** [I-strong] |
| Hotkey (key) | `com.elgato.streamdeck.system.hotkey` | `{"Coalesce": true, "Hotkeys": [combo, empty, empty, empty]}` | R-strong |
| Hotkey (dial) | same | `Hotkeys: [CCW, CW, press, empty]` | C (3 functions) + I-strong (order) |
| Hotkey Switch | `com.elgato.streamdeck.system.hotkeyswitch` | same 4-slot shape; 2 `States` | R (one source) |
| Media key | `com.elgato.streamdeck.system.multimedia` | `{"actionIdx": n}`: 0 prev, 1 play/pause*, 2 next*, 3 stop, 4 mute, 5 vol+, 6 vol−; 18 "System Volume" dial | R + C (order); *1/2 disputed |
| Website | `com.elgato.streamdeck.system.website` | `{"openInBrowser": true, "path": "<url>"}`; `false` = background GET | R-strong + C |
| Open file/app | `com.elgato.streamdeck.system.open` | `{"path": "<command line>"}`; quote paths with spaces | R-strong |
| Text | `com.elgato.streamdeck.system.text` | `{"isSendingEnter": bool, "isTypingMode": bool, "pastedText": "…"}` (+ `Hotkey` in 7.3.1) | R |
| Several key actions on a dial | `com.elgato.streamdeck.keys.adaptor` ("Action Trigger", 6.8+) | `{}` plus top-level `"Actions": [CCW, press, CW]` | C (feature) + R-strong (order) |
| Cycle dial actions | `com.elgato.streamdeck.dial.stack` | `{"CurrentIdx": 0, "FastNavigation": false, "ShowStackIcon": true}` plus `Actions` | C (feature) + R (v2 only) |

Structural rules:

1. A profile is one `.sdProfile` holding:
   - **pages**: `Pages.Pages`, up to 10 [C], in order;
   - **one pinned page**: `Pages.Default`, never listed in `Pages.Pages` [R-strong];
   - **any number of folder pages**: sibling folders reached only from folder keys [R-strong];
     "unlimited subfolders" [C].
2. Everything **inside one profile survives import**, because the importer remaps page UUIDs and
   folder links [R-strong]. That covers folder keys, Go to Page (index-based), Next and Previous,
   pinned keys, and Switch Profile to *itself* (7.4+) [C/I].
3. **Links between profiles do not reliably survive import** [I-strong]: Switch Profile to another
   `.streamDeckProfile` file.
4. The optional plugin can switch reliably between profiles **it bundles**, by name, with a 0-based
   page [C].

---

## 1. Where navigation lives (v3 and v2)

### 1.1 v3 (Stream Deck 7.x exports; `ProfilesV3` on disk) [R-strong]

Real export, 7.2.1, Elgato's own Stream Deck + "Default Profile" (andresharpe/dotbot-aether-console,
`docs/exported-profile/`):

```
package.json
Profiles/145F4E4C-0D9B-410F-91B0-144E702F3B37.sdProfile/manifest.json          <- profile manifest
Profiles/145F4E4C-….sdProfile/Profiles/43FD45D1-36CB-4F4D-AC2D-06E1DFF4FB08/manifest.json   <- page 1
Profiles/145F4E4C-….sdProfile/Profiles/5EB3B727-8B84-40B8-9AF5-0C2522D64AAA/manifest.json   <- page 2
Profiles/145F4E4C-….sdProfile/Profiles/81C2A4D1-C2B0-4893-A9E0-EF70DA059513/manifest.json   <- Default (pinned) page
Profiles/145F4E4C-….sdProfile/Profiles/B3155C01-…/manifest.json, C00978F1-…, 1CDC9806-…, 7CA29515-…, 69CFCFA4-…  <- folders
Profiles/<page>/Images/*.png
```

```json
{"AppVersion": "7.2.1.22472", "DeviceModel": "20GBD9901", "DeviceSettings": null, "FormatVersion": 1,
 "OSType": "Windows", "OSVersion": "10.0.26200",
 "RequiredPlugins": ["com.elgato.streamdeck.profile.openchild", "com.elgato.streamdeck.system.hotkey",
                     "com.elgato.streamdeck.system.multimedia", "com.elgato.streamdeck.system.keybrightness"]}
```

```json
{"Device": {"Model": "20GBD9901", "UUID": "8d7f9170-c923-43a6-a996-791e396f1c65"},
 "Name": "Default Profile",
 "Pages": {"Current": "00000000-0000-0000-0000-000000000000",
           "Default": "81c2a4d1-c2b0-4893-a9e0-ef70da059513",
           "Pages": ["43fd45d1-36cb-4f4d-ac2d-06e1dff4fb08", "5eb3b727-8b84-40b8-9af5-0c2522d64aaa"]},
 "Version": "3.0"}
```

`RequiredPlugins` here has no `backtoparent` although the profile has back keys. Those back keys
carry no `Plugin` block, which shows the list is built from `Plugin.UUID` values [R].

Rules, checked on all 40 v3 profiles:

- **Folder names and case.** Page folder name = upper-case UUID (507 of 513; the 6 exceptions are generated files), while UUIDs
  inside the JSON are lower case [R-strong]. In v2, folder-key and Switch Profile UUIDs come in
  either case.
- **Top manifest keys.** App exports write `Device`, `Name`, `Pages`, `Version`, plus
  `AppIdentifier` for Smart Profiles. Plugin-installed profiles add `InstalledByPluginUUID` and
  `PreconfiguredName` [R].
- **Page manifest.** It is `{"Controllers": [...], "Icon": "", "Name": "<page name>"}`; 7.x lets
  users name pages [R].
- **`Pages.Current`.** It is the zero UUID in exports (28/28) and a real page UUID in live folders.
  Both import [R].
- **`Pages.Default` (pinned page).**
  - It is never listed in `Pages.Pages` in app-written files (109/109) [R-strong].
  - It is empty in most files, but not all; see §3.5.
  - The generator should write it, empty or with pinned keys.
  - Its controller list matches the device: Keypad, plus Encoder on the Stream Deck + family, or
    plus Neo on a Neo [R].
- **`Plugin` and `Resources` blocks.** 7.x writes `"Plugin": {…}` and `"Resources": null` on
  actions. Older actions in the same files lack them [R]. Write them; they cost nothing.

### 1.2 v2 (Stream Deck 5.x/6.x exports; `ProfilesV2`) [R-strong]

Same model, but page folders have 27-character names derived from the page UUID. Verified on
180/180 pages, 371/371 folder targets and 18/18 pages of the Spotify bundles, with this Node
function, run as written:

```js
function v2PageDir(uuid) {
  const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
  let v = BigInt('0x' + uuid.replace(/-/g, '')) << 2n; // 130 bits = 26 x 5
  let out = '';
  for (let i = 0; i < 26; i++) { out = digits[Number(v & 31n)] + out; v >>= 5n; }
  return out.replace(/V/g, 'W').replace(/U/g, 'V') + 'Z';
}
// v2PageDir('3ab260f7-656a-41a4-ae87-d8af1ccee21a') === '7AP61TR5D90Q9BK7R2NHPJN238Z'  (true)
// v2PageDir('67c80257-1ea5-49f5-aa0d-629afd3fd9a4') === 'CW404LOVKL4WBAGDCADFQFVPKGZ'  (true)
```

Generate v3. v2 matters only for reading old files.

### 1.3 v1 (4.x): actions in the top manifest, folders as nested `.sdProfile`. Read-only.

---

## 2. Folders

### 2.1 Folder key [R-strong: 772 keys]

7.2.1 export, Elgato default profile, Stream Deck +:

```json
{
  "ActionID": "d30c4bcf-9b60-4a4d-a100-da0a5733cacc",
  "LinkedTitle": true,
  "Name": "Create Folder",
  "Plugin": {"Name": "Create Folder", "UUID": "com.elgato.streamdeck.profile.openchild", "Version": "1.0"},
  "Resources": null,
  "Settings": {"ProfileUUID": "b3155c01-9bd7-42fc-9676-05d857c43f99"},
  "State": 0,
  "States": [{"FontFamily": "", "FontSize": 12, "FontStyle": "", "FontUnderline": false,
              "Image": "Images/1GG81S5QBL6F10LQ984BK0GF1OZ.png", "OutlineThickness": 2, "ShowTitle": true,
              "Title": "Apps", "TitleAlignment": "bottom", "TitleColor": "#ffffff"}],
  "UUID": "com.elgato.streamdeck.profile.openchild"
}
```

`ProfileUUID` names the child page folder in the same `.sdProfile`, here `B3155C01-…`. It is never
in `Pages.Pages` (0/772) and never equal to `Default`. `Name` is free text and may be localized
(`"Ordner erstellen"`) [R].

### 2.2 Back key [R-strong]

Every app-written folder page has it at `"0,0"`: 335 v3 and 371 v2 keys. The only other positions
are in phew-blue's generated files, at `7,0`, `0,3` and `4,2`. 7.4.2 export (WeisAir):

```json
{"ActionID": "c3ad9003-ccd3-4d2d-96fb-a6a8199d8a9d", "LinkedTitle": true, "Name": "Parent Folder",
 "Plugin": {"Name": "Open Parent Folder", "UUID": "com.elgato.streamdeck.profile.backtoparent", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.profile.backtoparent"}
```

With Auto Folder Exit settings (WeisAir 7.4.x):
`"AutoExit": {"Delay": 3, "Enabled": false}`, sorted between `ActionID` and `LinkedTitle`.

- Seen values: `Delay` 3 (58 times) or 1 (5 times), always with `Enabled: false` [R].
- An enabled folder exit would be `{"Delay": 0..60, "Enabled": true}` [I]. The 0–60 s range is
  from the help article [C].
- How a single action overrides the folder ("Follow folder settings") is stored is **[?]**. Four
  plugin actions carry `AutoExit` `{"Delay": 1, "Enabled": false}` with no other field.

Behavior, from help "Using Folders" [C]:

- "You can create unlimited subfolders within folders."
- "press and hold the return key to return to the top level".

A folder is one layout and has no pages of its own [I]. Since 6.6 a folder can be pasted as a page
and the other way round [C].

Nesting example from 7.2.1: folder `7CA29515…` contains a key with `"ProfileUUID": "69cfcfa4-…"`,
and that sub-folder has its own back key at `0,0` [R].

On the Stream Deck + family, folder pages also carry an `Encoder` controller (38/39) [R], so a
folder can re-map the dials.

---

## 3. Pages

Help "Pages", updated 2026-10-27 [C]:

- "You can create up to 10 pages per Profile."
- "Pages 2 through 9 will feature two automatically placed actions, Next Page and Previous Page."
- "These actions can be deleted or they can be moved to different keys as desired." A later line
  says they "cannot be deleted/removed".

Real files settle that contradiction: many multi-page profiles have no Next or Previous key,
including Elgato's own Stream Deck + default profile and simracecenter's 7.6.0 profile [R-strong].

### 3.1 Next / Previous [R-strong]

```json
{"ActionID": "76379d28-a3b7-4a3d-83c4-2d1689a4035f", "LinkedTitle": true, "Name": "Next Page",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.page.next"}
```

Previous Page is the same, with `"Name": "Previous Page"` and
`"UUID": "com.elgato.streamdeck.page.previous"`. 5.x/6.x files sometimes hold a leftover
`"Settings": {"ProfileUUID": …}` on Next Page; ignore it and write `{}`.

Whether Next Page wraps from the last page to the first is **[?]**. The help article implies there
is no Next key on the last page, so do not rely on wrapping.

### 3.2 Go to Page [R-strong]

7.6.0 export (simracecenter/streamdeck):

```json
{"ActionID": "bd8e9f2d-a91b-493b-b9c8-54cec026cf79", "LinkedTitle": true, "Name": "Go to Page",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {"PageIndex": 2}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.page.goto"}
```

`PageIndex` is **1-based** and counts `Pages.Pages`. The evidence:

- Across 448 keys, 49 have `PageIndex == number of pages`, and none has 0.
- DerailValley-Diesel has 10 pages and keys 1–10.
- Lancair Evo has 7 pages and keys 1–7.
- simracecenter has 4 pages and a tab bar 1–4.

The only values above the page count are stale copies in WeisAir's one-page "Minimal" exports.

- Go to Page also sits on folder pages (27 keys) and on the pinned page (1) [R].
- A localized `Name` (`"Gehe zu Seite"`) is fine [R].

### 3.3 Page Indicator [R, 2 keys; C feature]

```json
{"ActionID": "f0546d70-361b-42b9-b8c0-19f6c90055da", "LinkedTitle": true, "Name": "Page Indicator",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0,
 "States": [{"FontFamily": "", "FontSize": 12, "FontStyle": "", "FontUnderline": false,
             "Image": "Images/RHIRQCHQG11WB0O0F86P7FW3Q0Z.png", "OutlineThickness": 2, "ShowTitle": true,
             "Title": "Player", "TitleAlignment": "middle", "TitleColor": "#ffffff"}],
 "UUID": "com.elgato.streamdeck.page.indicator"}
```

That is a 7.3.1 export (John-Mack). Help [C]: it "will show the current Page number on a key. The
action has no other function when pressed." Whether the number still draws over a custom image or
title is **[?]**.

### 3.4 Device-specific paging

- **Stream Deck +**: "Move a finger quickly across the touch strip left or right to change between
  pages. Two or more pages are required for swiping." [C, help 10567698991629]. Nothing is stored.
- **Stream Deck Neo**: "2 capacitive touch buttons for paging" [C, SDK devices guide]. The 7.4.1
  notes mention their "previous/next button indicators" [C]. They are not in the manifest and
  cannot be re-assigned [I].
- **Neo Infobar**:
  - Stream Deck 7.6 accepts actions there [C, 7.6 notes]; the SDK controller name is `"Neo"` [C].
  - In a manifest it is a third controller [R, one source: threaddeck, macOS, physically tested]:

  ```json
  {"Actions": {"1,0": {"ActionID": "b78afc19-af9d-4a5f-9b71-585678fdcb1b", "LinkedTitle": true,
     "Name": "Page Indicator",
     "Plugin": {"Name": "Page Indicator", "UUID": "com.elgato.streamdeck.system.pagination", "Version": "1.0"},
     "Resources": null, "Settings": {}, "State": 0, "States": [{}],
     "UUID": "com.elgato.streamdeck.system.pagination"}},
   "Type": "Neo"}
  ```

  - Elgato's Lights Out Neo sample has `{"Actions": {}, "Type": "Neo"}` [R].
  - threaddeck's pinned page holds `com.elgato.streamdeck.system.digitaltime` at `"1,0"`, with
    `{"24HourFormat": false, "layout": "digital_time_07", "location": "", "theme": "white"}`. That
    entry has a hand-made upper-case ActionID [R, weak].
- **Dial page knob**: an Action Trigger with CCW = Previous Page, press = Go to Page 1,
  CW = Next Page is **Elgato's own help example** [C]. See §7.4.

### 3.5 Pinned page (`Pages.Default`) [R-strong + C]

Elgato [C]:

- 6.6 notes: "A pinned action appears on corresponding keys across all pages, as long as it's
  unused … Select your profile's pinned page to start adding actions."
- Help 26638431612429: "it will appear on every page with an empty key for that profile … drag a
  new action over it. This will NOT remove it from other pages."
- Help 29655069662609: "You can pin Action Trigger to keep it accessible on all pages."

Real files [R], all v2 app exports:

| Profile | Default (pinned) page holds | Normal pages |
|---|---|---|
| Transport-Fever-2-01 / -02 (XL) | 8 Hotkeys, row 3 (`0,3`…`7,3`) | 3 pages; none uses row 3 |
| Shapez2 (XL) | 15 Hotkeys, rows 0–1 | 1 page with 17 keys, no overlap |
| WeisAir S340A (XL) | Go to Page at `2,0` | 2 of 3 pages override `2,0`, 1 leaves it empty |
| DerailValley ×3 (XL) | folder at `0,0` + Hotkeys | partly overridden per page |

So `Pages.Default` is the pinned layer [R-strong]. For the pack, pinned keys could carry a nav
strip (Home / Comms / Themes folder) without repeating it on every page:

- Encoder entries in the pinned page should pin dials (zalewski's hand-edited file does that) [I].
- Test once on hardware that a **generated** pinned page shows up.
- Fallback: repeat the nav keys on each page, which is always safe.

### 3.6 Limits

| Item | Limit | Conf. |
|---|---|---|
| Pages per profile | 10 | C |
| Folders | unlimited, nestable | C |
| Pages inside a folder | none (one layout) | I |
| Pinned page | 1 per profile (`Pages.Default`) | R-strong + C |

Flight, combat, mining, salvage, hauling, on foot, emotes, comms and a home page make 9, which fits
in 10 pages. More screens must go into folders.

---

## 4. Switch Profile (`com.elgato.streamdeck.profile.rotate`)

### 4.1 Stored form [R-strong: 204 keys]

7.4.2 export (WeisAir, "X-Plane Ops Panel Lancair_Evo Minimal"):

```json
{"ActionID": "6c3de77c-7028-48b4-8ded-6df9c509b648", "LinkedTitle": false, "Name": "Profil wechseln",
 "Plugin": {"Name": "Switch Profile", "UUID": "com.elgato.streamdeck.profile.rotate", "Version": "1.0"},
 "Resources": null,
 "Settings": {"DeviceUUID": "", "PageIndex": 1, "ProfileUUID": "380b6a04-d582-4f6b-a0aa-1c62a8a5f979"},
 "State": 0,
 "States": [{"FontFamily": "", "FontSize": 12, "FontStyle": "", "FontUnderline": false,
             "Image": "Images/CA45GQIPJH7CP3DG110Q9AJV8SZ.png", "OutlineThickness": 2, "ShowTitle": true,
             "Title": "\nLancair\nEvo", "TitleAlignment": "top", "TitleColor": "#ffffff"}],
 "UUID": "com.elgato.streamdeck.profile.rotate"}
```

- **`ProfileUUID`** is the target `.sdProfile` UUID, lower case in v3 (29/29).
  - `""` (unset) is written by plugin generators as a placeholder (Benge21, Steam Achievements)
    [R]. That user must pick a target.
  - Third-party readers say an unset target cycles to the next profile [?].
- **`PageIndex`** is **1-based** [R]: see the Phobic Fusion 360 evidence below. 7.x always writes
  `1` by default (39/39). Older 6.x exports have `0` (23 keys), meaning not known [?]. Write 1..N.
- **`DeviceUUID`**: `""` = the deck the key is on (203 of 204). The one non-empty value is
  `"@(1)[4057/108/<serial>]"`, a virtual deck driving a physical XL [R]. That form is per-device;
  always write `""`.

Phobic "Fusion 360", v2, XL, 4 pages. Switch Profile steps inside Multi Actions target the profile
itself (`175b7f05…` = its own `.sdProfile`):

```
page 1, key 0,3:  {"DeviceUUID": "", "PageIndex": 2, "ProfileUUID": "175b7f05-7222-4065-96cb-2a8f9a36e410"}
page 1, key 1,3:  {"DeviceUUID": "", "PageIndex": 4, "ProfileUUID": "175b7f05-…"}
page 2, key 0,3:  {"DeviceUUID": "", "PageIndex": 1, "ProfileUUID": "175b7f05-…"}   <- back to page 1
page 4, key 0,3:  {"DeviceUUID": "", "PageIndex": 1, "ProfileUUID": "175b7f05-…"}   <- back to page 1
```

### 4.2 Across separately imported profiles: expect broken links [I-strong]

Evidence that installing from a file gives the copy new IDs:

| Case | File side | Installed side | Same layout? | Any ID equal? |
|---|---|---|---|---|
| Elgato Stream Deck + default profile, PC A vs PC B | `145F4E4C…`, pages `43fd45d1`/`5eb3b727`, dial ActionIDs `013b4223`/`0f74af3e`/… | `AE1EE7B3…`, pages `004b304f`/`5774b1fb`, `7e57b416`/`5fbc61c8`/… | yes (dials: Hotkey, Multimedia 18, Brightness, Hotkey) | none |
| Elgato XL default profile | AngelCruzL `03EF9A83…` / `D2FFE3A9…` ("Factory Profile"), phew-blue `943A6338…` | | yes | none |
| Essentials for Spotify bundled "SDP" (5 versions in git) | e.g. 2025-05-05: pages `cdfb5992`/`7c3597d2`, ActionIDs `48cd9f96`… | zalewski's installed copy: pages `f16c597e`/`4e23c245`/…, ActionIDs `52bfbbfd`… | keys match slot for slot | none |

On top of that:

- The **7.4 / 7.4.1 notes** say: "Fixed a bug where nested Switch Profile actions inside a Multi
  Action could lose their internal references when imported". The importer rewrites references to
  the profile itself, which only makes sense if the copy gets a new UUID [C + I].
- **Re-importing makes a "… copy"** (Keyboard Maestro forum, 2023; phew-blue's "Default Profile
  copy 1").
- Folder links in all re-installed copies point at the copy's new page folders [R]. So the
  importer remaps internal links; links to *other* profiles have nothing to remap to.

Counter-evidence:

- JustaDevOnTheMove ships three cross-linked Derail Valley profiles. The README says they "are
  designed to be installed together to allow you to easily switch between the three fuel type
  profiles"; it is not shown that this was tested on a clean PC.
- WeisAir's own 7.x files hold many dangling targets: 380b6a04 and b9fa7e0f exist in none of his
  exports. That shows how easily these links go stale.
- illixion tells users to paste the UUID of an already-installed profile into the generated file
  before importing. That suggests links to *existing* local profiles survive import [I].

Test on hardware before release (one evening):

1. Generate profiles A and B, each with a Switch Profile key to the other, with `PageIndex` 3.
2. Import B, then A, on a PC that has never seen them.
3. Compare the `%APPDATA%\Elgato\StreamDeck\ProfilesV3\` folder names with the generated UUIDs.
4. Press both keys.
5. Re-import A and record what happens.

Options for "same page, other theme", best first:

1. **Optional plugin**:
   - Bundle every theme profile in the plugin manifest's `Profiles` array.
   - `Name` is the path of the `.streamDeckProfile` without extension [C]. The plugin may set
     `"AutoInstall": true` [C].
   - Switch with `streamDeck.profiles.switchToProfile(deviceId, "<Name>", page)`. `page` is
     "indexed from 0" and needs 6.5+ [C, 3.0.4 source].
   - "Plugins may only switch to profiles distributed with the plugin" [C].
   - This is the only reliable built-in-free way to keep the same page across themes.
2. **Built-ins only**:
   - Ship theme-switch keys as Switch Profile keys with `"ProfileUUID": ""`.
   - Tell users to pick each target once, or ship one "Themes" folder per profile so there are few
     keys to fix.
   - Also generate the "correct" UUIDs, in case the test shows UUIDs are kept on first import.
3. **One profile per device holding all themes as folders**:
   - Every link is internal, so it always survives import.
   - Cost: themes then have no real pages (a folder is one layout), and folders nest deeply.
4. **Same-profile page jump**: Switch Profile to the profile's own UUID with `PageIndex` works after
   import on 7.4+, but Go to Page does the same thing more simply.

---

## 5. System actions as stored

### 5.1 Hotkey [R-strong]

- **Shape.** 7.x: 4 `Hotkeys` entries plus `"Coalesce": true` on keys and dials alike (all 7.x
  files). 6.x: 2 entries, no `Coalesce`.
- **Entry fields.** Every entry has exactly
  `KeyCmd, KeyCtrl, KeyModifiers, KeyOption, KeyShift, NativeCode, QTKeyCode, VKeyCode`.
- **Empty entry:**
  - Windows (8,123 times):
    `{"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1}`
  - macOS: `"NativeCode": -1`.
- **Example**, Ctrl+Z, 7.2.1 Windows:
  `{"KeyCmd": false, "KeyCtrl": true, "KeyModifiers": 2, "KeyOption": false, "KeyShift": false, "NativeCode": 90, "QTKeyCode": 90, "VKeyCode": 90}`.
- **Plugin block:** `{"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"}`.
- Profiles are OS-specific [C].
- Numpad keys: see the note in "Changes".

### 5.2 Hotkey Switch [R, one source: blackcarburning 7.4.0, 34 keys]

```json
{"ActionID": "67d89a02-3717-408c-a843-d94a4ffe7d9f", "LinkedTitle": true, "Name": "Hotkey Switch",
 "Plugin": {"Name": "Hotkey Switch", "UUID": "com.elgato.streamdeck.system.hotkeyswitch", "Version": "1.0"},
 "Resources": null,
 "Settings": {"Coalesce": true, "Hotkeys": [
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 67, "QTKeyCode": 67, "VKeyCode": 67},
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 67, "QTKeyCode": 67, "VKeyCode": 67},
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1},
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1}]},
 "State": 0,
 "States": [{"Image": "Images/E0A1C8N6553SP0VR3KS6DGJNRKZ.png"}, {"Image": "Images/VSJT5T6LVL1R5BG1DDWWS8T0RKZ.png"}],
 "UUID": "com.elgato.streamdeck.system.hotkeyswitch"}
```

- "Hotkey Switch toggles between two hotkeys … muting/unmuting your microphone" [C].
- Every real key uses the **same** combo in slots 0 and 1. So "slot 0 is sent in state 0 and slot 1
  in state 1" is [I].
- The state flips on every press whatever the game did, so it can show the wrong state. It is still
  one press per tap.

### 5.3 Multimedia [C order, R values, 1/2 disputed]

Help 360028234471, updated 2026-11-06, lists in this order: Previous Track, Play / Pause, Next
Track, Stop, Mute, Increase Volume, Decrease Volume [C]. Real values:

| actionIdx | Function | Evidence |
|---|---|---|
| 0 | Previous Track | prev icon in 6.x and 7.4.0 Elgato XL default profiles; Deckly tests |
| 1 | Play / Pause | 6.x Elgato XL default (AngelCruzL): play/pause icon. **7.4.0 Elgato XL default (phew-blue `7145092`): next-track icon** ⚠ |
| 2 | Next Track | AngelCruzL: next icon; bro69 7.x: `0 / {} / 2` = prev / default / next row. **7.4.0: play/pause icon** ⚠ |
| 3 | Stop | bro69: titled "stop any multimedia track" |
| 4 | Mute | crossed-speaker icon in 3 Elgato default profiles (6.x XL, 7.4.0 XL, 7.x MK.2) |
| 5 | Volume Up | two-wave icon in the same 3 |
| 6 | Volume Down | one-wave icon in the same 3 |
| 18 | "System Volume" (dial) | Elgato Stream Deck + default profile, dial `1,0`, on 2 PCs |
| `{}` | probably Play / Pause (the default) | bro69 middle key; Deckly's tests map `{}` to Play/Pause [third-party] |

Notes on the table:

- **The 1/2 conflict** comes from custom art in Elgato's default profiles. In the 7.4.0 file the
  row reads prev, next-icon, play-icon, which is an odd order for a designed profile, so an asset
  mix-up is more likely than a changed mapping [I].
- **Generate** `actionIdx` 1 = Play/Pause and 2 = Next, **ship our own icons**, and test both on
  hardware.
- **Fast forward and rewind** (13/14 in FreeStream's catalog only) are [?].

```json
{"ActionID": "a15e554e-d052-4c9c-b10a-88ccb5a2c7d2", "LinkedTitle": true, "Name": "Multimedia",
 "Plugin": {"Name": "Multimedia", "UUID": "com.elgato.streamdeck.system.multimedia", "Version": "1.0"},
 "Resources": null, "Settings": {"actionIdx": 4}, "State": 0,
 "States": [{"Image": "Images/H17JRQKCQT2LP3VB3194LTNF0CZ.png"}],
 "UUID": "com.elgato.streamdeck.system.multimedia"}
```

That is the 7.4.0 Elgato XL default profile, mute key, as exported unmodified (phew-blue `7145092`;
other keys and `ShowTitle` trimmed). Two community tables are wrong and should be ignored:
jefftriplett ("0=mute …") and Graham42 ("0 Play/Pause …").

### 5.4 Website [R-strong + C]

```json
{"ActionID": "caab0349-db93-43ca-b65b-48a97bd63d71", "LinkedTitle": true, "Name": "Website",
 "Plugin": {"Name": "Website", "UUID": "com.elgato.streamdeck.system.website", "Version": "1.0"},
 "Resources": null,
 "Settings": {"browser": "C:\\Program Files\\Mozilla Firefox\\firefox.exe", "openInBrowser": true,
              "path": "https://dispatch.simbrief.com/home"},
 "State": 0, "States": [{"Title": "Load Simbrief"}], "UUID": "com.elgato.streamdeck.system.website"}
```

That is a WeisAir 7.4.2 export, a step inside a Multi Action.

- The field is `path`, never `url`. `url` appears only in phew-blue's generated files.
- `browser` is optional; it came in 6.9 ("choose your browser") [C]. Leave it out.
- `"openInBrowser": false` is "GET request in background … to trigger webhook URLs" [C]. A real
  example targets a local HTTP server (Linedev-Web, 14 keys) [R].
- For Tablet Deck, a GET to the server would need the pairing code inside the profile and would
  bypass `gameFocused()` / `tapButton()`. That needs the owner's agreement.
- 7.6: "The Website action now updates its icon whenever the URL changes" [C].

### 5.5 Open, Open Application, Close [R]

- **`com.elgato.streamdeck.system.open`**: `{"path": "<command line>"}`.
  - From Elgato's Windows default profiles: `"notepad"`, `"calc"`, `"mspaint"` (bare), and
    `"\"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\""` (quoted).
  - A user file shows arguments after a quoted exe: `"\"C:\\WINDOWS\\System32\\conhost.exe\" --headless powershell.exe …"`.
  - Plugin block: `{"Name": "Open", "UUID": "com.elgato.streamdeck.system.open", "Version": "1.0"}`.
- **`com.elgato.streamdeck.system.openapp`** (7.x, one source, Linedev-Web):
  `{"app_name", "args", "bring_to_front", "bundle_id", "bundle_path", "exec", "is_bundle", "long_press", "source"}`.
  - The only `long_press` value seen is `"quit"`.
  - The paths are machine-specific; leave this to users.
- **`com.elgato.streamdeck.system.close`**: `{"forceQuit": false, "path": "<exe path>"}` [R, 3 keys].

### 5.6 Text [R]

7.3.1 export (John-Mack, HeirOfGaia, 40 keys):

```json
{"ActionID": "10a7a3c5-e93f-4741-bb08-b573949f096d", "LinkedTitle": true, "Name": "Text",
 "Plugin": {"Name": "Text", "UUID": "com.elgato.streamdeck.system.text", "Version": "1.0"},
 "Resources": null,
 "Settings": {"Hotkey": {"KeyModifiers": 0, "QTKeyCode": 33554431, "VKeyCode": -1},
              "isSendingEnter": true, "isTypingMode": true, "pastedText": " "},
 "State": 0, "States": [{"Title": "Enter"}], "UUID": "com.elgato.streamdeck.system.text"}
```

- Older files have only `{"isSendingEnter", "pastedText"}`.
- 6.9 added the mode: "Simulate Typing … useful for … typing out commands in sim games", and the
  default changed to "Paste from Clipboard" [C].
- Map `isTypingMode: true` = Simulate Typing [I].
- Typing into Star Citizen chat is a sequence of key presses, so check it against the one-press rule.

### 5.7 Multi Action, Key Logic (not used: one press per tap) [R]

- **Multi Action**: `com.elgato.streamdeck.multiactions.routine` (Plugin
  `com.elgato.streamdeck.multiactions`). Steps sit in a top-level `"Actions": [{"Actions": [ … ]}]`.
  Delays are `com.elgato.streamdeck.multiactions.delay`. `routine2` is Multi Action Switch.
- **Key Logic** (7.0+, press / double press / hold [C]): `com.elgato.streamdeck.keys.logic`,
  Plugin `{"Name": "Keys", "UUID": "com.elgato.streamdeck.keys", "Version": "1.0"}`, `Settings: {}`,
  `Actions: [3 children]` [R, 4 keys]. The order is probably press / double / hold [I].
  - Each gesture fires one action, so it may fit the one-press rule. Ask the owner before using it.

### 5.8 Others

| UUID | Settings | Conf. |
|---|---|---|
| `com.elgato.streamdeck.system.keybrightness` | `{"actionIdx": 0}` brighter, `1` darker (icons); dial `actionIdx 0` "SD+ Brightness" | R |
| `com.elgato.streamdeck.system.sleep` | `{"DeviceUUID": ""}` (7.4.0), `{}` older | R |
| `com.elgato.streamdeck.system.timer` | `{"actionIdx": 0, "duration": 1500, "lastUserFile": ""}` | R, v2 only |
| `com.elgato.streamdeck.system.vsdtoggle` | `{"DeviceID": …, "ProfileID": …}`; Plugin UUID `com.elgato.streamdeck.vsdtoggle` | R |
| `com.elgato.streamdeck.system.digitaltime` | see §3.4 | R, weak |

Not built in:

- Volume Controller: "no longer bundled by default" (7.1) [C]. Its UUIDs are
  `com.elgato.volume-controller.output-device-control` / `.input-device-control` [R].
- Discord: a Marketplace plugin [C, help 4422740578189].
- With built-ins only, Discord mute and deafen can be Hotkeys bound to Discord's own keybinds. That
  belongs to the comms research.

---

## 6. Stream Deck + / + XL dials and touch strip

### 6.1 Controllers [R-strong]

Every page of a Stream Deck + family profile, including folders and the pinned page, has
`[Keypad, Encoder]` (62 of 63 v3 pages):

```json
{"Controllers": [
   {"Actions": { "0,0": {…} }, "Type": "Keypad"},
   {"Actions": { "0,0": {…}, "1,0": {…}, "2,0": {…}, "3,0": {…} },
    "Background": "Images/S410LKL5356F3DT8B2HFGNJIACZ.png",
    "Type": "Encoder"}],
 "Icon": "", "Name": ""}
```

- **Dial slots** are `"<dial>,0"`: `0,0`…`3,0` on Stream Deck + (`20GBD9901`; Aputure's "Plus"
  export says `20GBC9901`).
- **Stream Deck + XL** has "6 dials" [C], so `0,0`…`5,0` [I]. Real + XL files fill only 0–3.
- **Touch strip `Background`** = 800×100 PNG (11 files) [R]; "The resolution of the touch strip is
  800 x 100 pixels" [C].
- **Three layers**: dial icon, dial background, touch strip background [C].

### 6.2 Per-dial `Encoder` object [R]

Seen key sets:

- `{"Icon"}`
- `{"Icon", "IconVisible"}`
- `{"IconVisible"}`
- `{"IconVisible", "background"}`
- `{"layout"}` (plugin actions)

Sizes: `Icon` 48×48 PNG (14 files, 3 device models); `background` 200×100 PNG (2 files, lower-case
`b`). The strip title is `States[0].Title`.

### 6.3 Hotkey on a dial [C functions, I-strong order]

Help "Stream Deck + — Hotkeys" [C]: "Press / Tap, Rotate Clockwise, Rotate Counterclockwise". Real
slot contents:

| Source | Slot 0 | Slot 1 | Slot 2 | Slot 3 |
|---|---|---|---|---|
| Elgato Stream Deck + default (7.2.1), "Undo/Redo" | Ctrl+Z | Ctrl+Shift+Z | – | – |
| Elgato Stream Deck + default, dial 4 | Up | Down | – | – |
| Aputure Sidus Link (7.5.1, vendor), "Intensity Fine" | F14 | F15 | (vk 47) | – |
| Aputure, "Intensity Coarse" | Shift+F14 | Shift+F15 | (vk 47) | – |

Slot 0 = counter-clockwise and slot 1 = clockwise [I-strong]: undo/back, and decrease. Slot 2 =
press [R]. Slot 3 is unknown [?]. Write slot 3 empty and do not rely on touch.

```json
{"ActionID": "013b4223-75c6-4873-a982-053f4430d603",
 "Encoder": {"Icon": "Images/QP3VH6G0A17RPD625MJPKB5C50Z.png"},
 "LinkedTitle": true, "Name": "Hotkey",
 "Plugin": {"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"},
 "Resources": null,
 "Settings": {"Coalesce": true, "Hotkeys": [
   {"KeyCmd": false, "KeyCtrl": true, "KeyModifiers": 2, "KeyOption": false, "KeyShift": false, "NativeCode": 90, "QTKeyCode": 90, "VKeyCode": 90},
   {"KeyCmd": false, "KeyCtrl": true, "KeyModifiers": 3, "KeyOption": false, "KeyShift": true, "NativeCode": 90, "QTKeyCode": 90, "VKeyCode": 90},
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1},
   {"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1}]},
 "State": 0, "States": [{"Title": "Undo/Redo"}],
 "UUID": "com.elgato.streamdeck.system.hotkey"}
```

One detent is one press. That fits SC's stepwise binds (power, zoom, scanner range) within the
one-press rule.

### 6.4 Action Trigger (`com.elgato.streamdeck.keys.adaptor`) [C feature, R-strong order]

Help 29655069662609 [C]:

- "With Action Trigger, you can assign up to three actions typically used for Keys to any Dial …
  clockwise, counterclockwise, and press".
- Its example: "turning the dial counter-clockwise goes to the Previous Page, clockwise goes to the
  Next Page, and pressing the dial returns to Page 1."
- It needs Stream Deck 6.8+ and a Stream Deck +.

Stored order is `Actions: [CCW, press, CW]`, from 23 real three-slot triggers (plus 7 empty ones). Real backup (Nagaimo355, Derail
Valley, v3), dial `0,0`, Hotkey `Settings` shortened:

```json
{"ActionID": "0a2615b9-29cf-4f2e-afeb-fca071b73c4d",
 "Actions": [
   {"ActionID": "641e1a1b-d787-4db8-bf61-efdfc646071c", "LinkedTitle": true, "Name": "Hotkey",
    "Plugin": {"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"},
    "Resources": null, "Settings": {"Coalesce": true, "Hotkeys": ["<T>", "<empty>", "<empty>", "<empty>"]},
    "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.system.hotkey"},
   {"ActionID": "cbd66777-9472-48f7-be75-aa725fc68887", "LinkedTitle": true, "Name": "Open",
    "Plugin": {"Name": "Open", "UUID": "com.elgato.streamdeck.system.open", "Version": "1.0"},
    "Resources": null, "Settings": {"path": "\"<path>\\t_12.ahk\""},
    "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.system.open"},
   {"ActionID": "e504be6d-6ace-4ea0-8b89-8bbc1ef5eb11", "LinkedTitle": true, "Name": "Hotkey",
    "Plugin": {"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"},
    "Resources": null, "Settings": {"Coalesce": true, "Hotkeys": ["<G>", "<empty>", "<empty>", "<empty>"]},
    "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.system.hotkey"}],
 "Encoder": {"IconVisible": false},
 "LinkedTitle": true, "Name": "Action Trigger",
 "Plugin": {"Name": "Keys", "UUID": "com.elgato.streamdeck.keys", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.keys.adaptor"}
```

The page-knob form, matching Elgato's example:
`Actions: [Previous Page {}, Go to Page {"PageIndex": 1}, Next Page {}]`. Each child uses the
§3.1 / §3.2 JSON. That order also appears in the deckforge fixture and, with Page Indicator in the
middle, in zalewski's file. Empty triggers (`Actions: []`) exist too (7 cases).

### 6.5 Dial Stack and Action Wheel

- **Dial Stack**: "To cycle through the actions, press the dial" [C, help 10843581380109]. Stored as
  `com.elgato.streamdeck.dial.stack` with
  `{"CurrentIdx": 0, "FastNavigation": false, "ShowStackIcon": true}`, `"Name": "Dial Stack"` and
  children in a top-level `Actions` [R, 11 keys, all v2, DKlaper]. 7.x storage is unconfirmed [?].
- **Action Wheel** (6.7+): "activate multiple actions on a single dial … select the Touch Screen or
  press the Dial" [C]. Its UUID and settings are **[?]**.
- **Mouse wheel** (`com.elgato.streamdeck.system.mouse-wheel`) appears only in FreeStream's catalog
  [?].

---

## 7. Images inside a profile

| Fact | Conf. | Source |
|---|---|---|
| Per-state image is `States[i].Image` = `"Images/<file>"`, relative to the **page** folder (resolved for all but stale entries) | R-strong | scan |
| v3 app exports: **PNG only** (4,496 references) at **72×72, 144×144 and 288×288**; XL exports carry many 288×288 | R-strong | scan (WeisAir, blackcarburning, phew-blue, Aputure, andresharpe) |
| v2 exports also hold JPEG (18) and WebP (32, animated, illixion) | R | scan |
| Accepted from the user: "PNG, JPEG, GIF, BMP, WEBP, Animated WEBP"; "minimum resolution of 72 x 72 pixels (1:1 ratio)"; larger images resized | C | help 360028237271 (2026-11-05) |
| "Action icons now support animated webp images alongside GIFs" (6.0) | C | 6.0 notes |
| SVG inside a profile `Images/` folder | ? | only in generated files (streamdex: 2 `.svg`, which do not open as images) |
| File names are free | R | illixion `segment_0_0.webp`, generated testbeds |
| Dial icon 48×48, dial background 200×100, touch strip 800×100 | R/C | §6 |
| Page wallpaper (6.6+): Keypad controller `"Background"`, 1024×600 PNG on an XL | R (3, one author) + C (feature) | WeisAir |
| Neo Infobar art is 232 × 50 px layouts; 7.6 adds Infobar-sized backgrounds | C | SDK Neo guide, 7.6 notes |
| Two states: two `States` entries, each with its own `Image`; the app dims an "off" image if none is given | C | help 360028237271 |

Recommendation: PNG, square, 144×144, or 288×288 for crispness on larger keys (per-device sizes are
in `devices.md`). Use `ShowTitle: false` when the art carries the label.

---

## 8. Real profiles used

| # | Repo / file | App / format | Device | Used for |
|---|---|---|---|---|
| 1 | andresharpe/dotbot-aether-console `docs/exported-profile/` | 7.2.1 v3 | Stream Deck + | Elgato default: folders, nesting, dials, strip art, dial Hotkey, Multimedia 18 |
| 2 | Nagaimo355/StreamDeckPlusController_for_DerailValley (backup) | v3 live | Stream Deck + | 23 Action Triggers; the same Elgato default profile with new IDs (import evidence) |
| 3 | WeisAir/weisair `devices/streamdeck/profiles/` | 6.x v2, 7.3.1–7.4.2 v3 | XL, virtual | folders, AutoExit, Go to Page, Switch Profile (incl. stale and device-targeted), Website `browser`, page wallpaper |
| 4 | simracecenter/streamdeck | 7.6.0 v3 | 15-key | named pages, Go to Page 1–4, no Next/Previous |
| 5 | JustaDevOnTheMove/StreamDeckProfiles | v2 | XL | **pinned page** contents, Go to Page 1–10, cross-linked profiles, numpad hotkeys |
| 6 | phobicdotno Fusion 360 | v2 | XL | **Switch Profile `PageIndex` 2/4/1** to itself |
| 7 | phew-blue/streamdeck-home-ops commit `7145092` (untouched) | 7.4.0 v3 | XL | Elgato XL default: Multimedia icons (1/2 conflict), Brightness 0/1, Sleep |
| 8 | AngelCruzL/.dotfiles | v2 live | XL, MK.2 | Elgato default profiles (Multimedia icons, import evidence) |
| 9 | ntanis-dev/essentials-for-spotify (5 bundle versions) + zalewskigrzegorz/dotfiles | v2 bundle / v3 live | Stream Deck + | plugin-installed profile gets new IDs; `InstalledByPluginUUID`, `PreconfiguredName` |
| 10 | John-Mack/HeirOfgaia-StreamDeck-Profile | 7.3.1 v3 | 15-key | Text `isTypingMode`, Page Indicator with art |
| 11 | blackcarburning/live_controller | 7.4.0 v3 | XL | Hotkey Switch |
| 12 | aputure (Sidus Link Pro exports) | 7.5.1 v3 | +, + XL, XL, 15-key | vendor dial Hotkeys (3 slots) |
| 13 | Linedev-Web/OBS ProfilesV3 | 7.x live | MK.2 | Website background GET, Open with args, Multimedia 4/5/6 |
| 14 | bro69noscope/streamdeck-version-control | 7.x | 15-key | Multimedia 0/{}/2, Stop = 3 |
| 15 | y5862000/threaddeck-for-codex | v3 (partly hand-made) | Neo | `Neo` controller, `system.pagination` |
| 16 | DKlaper/ga-msfs2024-stream-deck-plus | v2 | Stream Deck + | Dial Stack |

Do not use as evidence:

- phew-blue after `7145092`: generator output.
- streamdex, RigReady fixtures, Benge21 and DotBot plugin bundles: generated.
- thisis-romar/opendeck-factory "Action Types.md": invented UUIDs.
- jefftriplett and Graham42 multimedia tables.
- zalewski: only as weak support, because it is hand-edited.

---

## 9. Open questions (hardware tests before release)

1. **Import and UUIDs**, the highest risk. Does importing a `.streamDeckProfile` keep its
   `.sdProfile` UUID on a clean PC, and what happens on re-import? Expected: new UUID, so
   cross-profile Switch Profile breaks. This decides between the plugin route and the
   folder/user-repick route (§4.2).
2. **Multimedia `actionIdx` 1 vs 2**: play/pause vs next (Elgato's own files conflict). Also fast
   forward and rewind values, and what pressing the "System Volume" dial does.
3. **Generated pinned page**: do keys and dials on `Pages.Default` show on every page where the
   slot is empty?
4. **Dial Hotkey slot 3**: is it touch, or unused?
5. **Next Page on the last page**: does it wrap?
6. **Go to Page inside a folder**: does it leave the folder? And Back for a folder reached from two
   places.
7. **Neo Infobar** slot `"1,0"` in an app-written 7.6 export.
8. **Auto Folder Exit**: how `Enabled: true` and per-action "Follow folder settings" are stored
   (export one folder with it on).
9. **Text action**: confirm `isTypingMode: true` = Simulate Typing; meaning of the `Hotkey`
   sub-object.
10. **SVG** in profile `Images/` (use PNG until checked). Action Wheel UUID. Dial Stack in 7.x.
    + XL dial slots 4–5.

---

## 10. Sources

Elgato help, all fetched 2026-11-06 through `help.elgato.com/api/v2/help_center/en-us/articles/<id>.json`:

| Topic | Article ID |
|---|---|
| Pages | 4410312027277 |
| Using Folders | 360027957912 |
| Auto Folder Exit | 22589649057933 |
| Pinned Actions and Folders | 26638431612429 |
| System Actions | 360028234471 |
| Switch Profiles on another Stream Deck | 360059908112 |
| Stream Deck + Touch Strip | 10567698991629 |
| Dials Introduction | 10715833118989 |
| Stream Deck + Hotkeys | 10870947641741 |
| Dial Stacks | 10843581380109 |
| Action Wheel | 28742375481997 |
| Action Trigger | 29655069662609 |
| Action Sharing | 29655138607505 |
| Customizing Key Icons | 360028237271 |
| Back Up and Restore | 360048424432 |
| Download and use Profiles | 33556495589905 |
| Smart Profiles | 360053419071 |
| Discord plugin | 4422740578189 |
| Release notes 5.1 / 6.0 / 6.6 / 6.9 / 7.0 / 7.1 | 5162770312717 / 10632177443725 / 26005306818701 / 34904105205777 / 38011940576273 / 41533810232721 |
| Release notes 7.4 / 7.4.1 / 7.5.0 / 7.6 | 45347482546193 / 45744678572817 / 48328697898897 / 51156609278737 |

Elgato docs:

- https://docs.elgato.com/streamdeck/sdk/guides/profiles/ (bundling, `Name` = path without
  extension, "Plugins can only switch to profiles distributed with the plugin").
- https://docs.elgato.com/streamdeck/sdk/guides/devices/ (Neo "2 capacitive touch buttons for
  paging"; Stream Deck + XL "6 dials").
- https://docs.elgato.com/streamdeck/sdk/guides/neo-infobar/ (`"Controllers": ["Neo"]`, 232 × 50).
- https://docs.elgato.com/stream-deck/profiles/getting-started/ and `/packaging/`.
- https://docs.elgato.com/streamdeck/sdk/guides/deep-linking/ (`streamdeck://plugins/message/<UUID>`;
  it reaches plugins, not built-in profile switching).
- npm `@elgato/streamdeck` 3.0.4, `dist/plugin/profiles.d.ts` and `profiles.js` (page "indexed from
  0"; `requiresVersion(6.5, …)`).

GitHub (real files): see §8, at https://github.com/<owner>/<repo>. Spotify bundle history:
https://github.com/ntanis-dev/essentials-for-spotify, file
`com.ntanis.essentials-for-spotify.sdPlugin/SDP.streamDeckProfile`, commits `b504096`, `b6ea621`,
`52f43b7`, `5b7bfec`, `71cde62`.

Forum: Keyboard Maestro forum, "Change Stream Deck profile from macro", page 4 (2023-11-30: bundled
profiles re-install as "Profile 1 copy").
https://forum.keyboardmaestro.com/t/change-stream-deck-profile-from-macro/15542?page=4

Local copies of the evidence:

- New for this check: `<scratch>/navv/`
  (`help/` article text, `docs/`, `npm/`, `x/` unpacked exports, `repos/` Spotify, phew-blue and
  JustaDev clones, `mmimg/` icon contact sheets, `scripts/` scanner).
- From the first draft: `<scratch>/nav/`.
