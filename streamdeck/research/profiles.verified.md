# Stream Deck profile file format (`.streamDeckProfile`): verified, for a Node generator

This is the fact-checked version of `profiles.md`, which is kept unchanged in the same folder.
Checked on 2026-11-06. It covers profiles that the Stream Deck app (6.x and 7.x) imports by
double-click and that a plugin can bundle. It also covers the built-in Hotkey and navigation actions,
and how a plugin bundles profiles.

**How each claim was checked**

- **Elgato's documentation.** The docs pages, the live manifest schema, `@elgato/streamdeck` 3.0.4
  and `@elgato/cli` 1.10.4 were fetched again.
- **Elgato's sample repos.** Both were cloned with full history.
- **Help-center articles.** They were read in full through Zendesk's public JSON API at
  `https://help.elgato.com/api/v2/help_center/en-us/articles/<id>.json`. The HTML pages still return
  403, which is why the first draft only had search excerpts. That route also gave all 43 release
  notes from 5.x to 7.6.1.
- **Real profiles.** They were downloaded again, and the SHA-256 of every file matched the draft's
  copies. They were then parsed with new scripts in `verify-profiles/scripts/` (see section 12).

Confidence tags:

- **[C]** confirmed in a primary source: docs.elgato.com, schemas.elgato.com, an elgatosf repo, the
  `@elgato/*` npm packages, help.elgato.com (now read in full), or elgato.com.
- **[C-UI]** shown in an Elgato screenshot or animation of the app's own UI.
- **[R]** seen in real exported or on-disk profile files that were parsed here.
- **[R-]** reported only by a third party: a tool author, a plugin README or a forum post.
- **[I]** inferred from the evidence; needs a hardware test.
- **[?]** not confirmed.

Device model strings, grids and pixel sizes are covered in `devices.verified.md`. This file only
repeats what a profile writer needs.

---

## Changes from the first draft

### Corrections (the draft was wrong or overstated)

1. **The built-in Hotkey taps; it does not hold.** The draft said the app holds the key down while
   the Stream Deck key is held, which would make the Hotkey action suitable for push-to-talk. Its
   only source was elgato2streamcontroller, and that tool's `hold_until_release` is how *it* maps the
   action, not a description of Elgato's app. Third-party evidence says the opposite:
   - The `johnbindel/streamdeck-keyhold` README says the Hotkey "Presses and releases immediately.
     A tap."
   - The Marketplace listing for "Better Hotkeys & Mouse Lite" says it "adds the one thing Stream
     Deck's stock Hotkey action can't do: hold a key down".
   - voji's "Hotkey Hold" plugin (March 2026) exists for the same reason. [R-]

   Elgato doesn't say it either way. This fits the "one press per tap" rule. It also means hold-type
   Star Citizen binds can't be made with standalone profiles.
2. **Image file names: "any name works" is not shown.**
   - The only app re-export of a script-written file is phew-blue's `usethisone`, from 7.4.0.
   - It kept 87 of the script's 119 image names. Every one is 26 hex digits plus `Z`, which already
     fits the app's own alphabet.
   - Free-form names such as `HOMEOPSZ.png`, `GEAR.png` and `dial_intensity-coarse-48.png` occur only
     in script-written files that were never shown to have gone through the app.
   - The v3 diagram in the draft also said `<27 base32 chars>Z.png`. App names are 26 characters
     plus `Z`, 27 in total.

   Use app-style names. [R]
3. **v2 files can carry `Plugin` blocks.**
   - The draft said v2 action entries never have `Plugin` or `Resources`.
   - Twelve JustaDevOnTheMove v2 exports (XL `20GAT9902`, committed 2025-07-24, before 7.0 came out)
     have `Plugin` on every action: 1,132 of 1,132. None has `Resources`. [R]
   - This matches the 6.9 release note: "If a profile uses actions from plugins you don't have,
     you'll be prompted to install them automatically… Note: This only applies to profiles created
     with Stream Deck 6.9 or later." [C]
   - So there are three generations: v2 without `Plugin` (6.8 and earlier), v2 with `Plugin` (6.9)
     and v3 (7.x). [I]
4. **Elgato's v2 sample files are from 2024 and were copied, not re-made.**
   - `elgatosf/streamdeck` HEAD (`9d9636e`, 2026-11-05) is the repo's latest commit, not the
     example's.
   - The six `.streamDeckProfile` files reached that repo in `b6e9b39` ("chore: migrate examples",
     2026-10-27).
   - They are byte-for-byte the files added to `streamdeck-plugin-samples` on 2024-09-25 (`cbc9780`),
     when that plugin required Stream Deck 6.5.
   - The manifest now says `MinimumVersion "7.1"` and `SDKVersion 3`.

   So the fact that Elgato *ships* v2 files with a 7.1+ plugin is [C]. That 7.x installs them is
   likely [I-strong], but nobody showed it.
5. **`0x4000` is not `Qt::KeypadModifier`.** Qt's docs give `KeypadModifier = 0x20000000`,
   `ShiftModifier 0x02000000`, `ControlModifier 0x04000000`, `AltModifier 0x08000000` and
   `MetaModifier 0x10000000` [C, doc.qt.io]. `KeyModifiers` is Elgato's own bitmask.
   jlgabriel's commit message calls `0x4000` "Qt::KeypadModifier", but that is wrong. Only
   `0x40000000` happens to equal a Qt value (`GroupSwitchModifier`).
6. **+ XL `Device.Model` `20GBX9901` is weak [R-weak], not [R].** As `devices.verified.md`
   found, it occurs only in a streamdeck-mcp test fixture and in Aputure's files. Aputure's README
   says its Standard profile is "a genuine Stream Deck 7.5.1 macOS export" and that the XL, Plus and
   XL Plus files were "re-encoded to match that export". So three of the four were made by a tool.
   The draft called all four tool-generated.
7. **The v2 root `Images/` folder is optional.** Elgato's six samples and the Gimp export don't have
   one. The DCS, Phobic and DKlaper exports do. [R]
8. **Privacy.** The draft quoted a real device serial from a `.bak` file in a third-party repo, and
   the Derail Valley backup's on-disk `Device.UUID` holds another. Both are replaced with
   placeholders here.

### Upgrades (inferred before, now confirmed)

9. **Dial Hotkey slot order is confirmed: `[0]` turn counter-clockwise, `[1]` turn clockwise, `[2]`
   press, `[3]` unused.**
   - The help article "Stream Deck + — Hotkeys" includes a GIF (`3.gif`). Its last frame shows the
     dial Hotkey Property Inspector with exactly three fields: "Rotate CCW: Ctrl+Z",
     "Rotate CW: Ctrl+Shift+Z" and "Press / Tap: Ctrl+Alt+Z" [C-UI].
   - Elgato's default Stream Deck + profile stores the same pair for its "Undo/Redo" dial:
     `Hotkeys[0]` = Ctrl+Z (`KeyModifiers 2`) and `[1]` = Ctrl+Shift+Z (`3`) [R].
   - There is no touch field. The draft's guess "[3] = touch?" was wrong.
10. **Action Trigger slot order is confirmed in the UI as [counter-clockwise, press, clockwise].**
    The help article's screenshot shows three slots from left to right: Previous Page (CCW icon),
    Page 1 (press) and Next Page (CW icon) [C-UI]. That the `Actions` array follows the UI order is
    still only shown by the Derail Valley file [R].
11. **Help-center facts are now [C]** (read in full, see the dates in section 1):
    - up to 10 pages per profile, and Pages since 5.1
    - key image types PNG, JPEG, GIF, BMP, WEBP and animated WEBP, minimum 72×72, larger images
      resized
    - the Marketplace import flow: double-click the file, then "Are you sure you want to install this
      profile?"
    - 7.0 (12 Aug 2025) and 7.1 (3 Dec 2025)
12. **Import gives new IDs [R, one case].**
    - phew-blue's script-written file had profile `943A6338-…` and page `f570b178-…`. After the
      round trip through the app (import, then export from 7.4.0) they were profile `7AB35742-…` and
      page `ae651c12-…`.
    - None of the 45 page-folder UUIDs survived, but 87 image names did.
    - So nobody can know a pack profile's UUID ahead of time, which is what Switch Profile would need.
      The draft had this as [I].
13. **Meaning of the left/right modifier bits.**
    - Self-labeled DCS keys confirm them: "L-Ctrl+L-Shift+P" = `0x10033`, "R-Alt+R-Shift+M" and
      "R-Alt+R-Shift+W" = `0x10505`, "L-Ctrl+L-Alt+W" = `0x10066` [R].
    - `0x10000` matches the Hotkey's "differentiate left/right modifiers" option. That option arrived
      in Stream Deck 3.2 (2018) according to a Softpedia changelog, and DCS forum users describe it
      [R-, search excerpts only].
    - Right Ctrl `0x200` is still inferred from the bit pattern alone.
14. **Dial icon size.** The default dial layout `$X1` draws its icon at `rect [76, 40, 48, 48]`
    [C, dials guide]. Elgato's default + profile uses a 48×48 `Encoder.Icon` [R].

### Gaps filled

15. **Latest app: 7.6.1 (3 Nov 2026).** It says "(Windows) Reworked hotkey handling so hotkeys work
    again in applications running with administrator privileges, including many fullscreen games"
    [C]. `devices.verified.md` stopped at 7.6.
16. **Release notes that matter for generated profiles** [C]:
    - **6.0.4:** fixed importing profiles made before 6.x.
    - **6.5:** "choose which device to apply an imported profile to".
    - **6.6:** page backgrounds behind the keys, pinned actions, and per-device default profiles.
    - **6.7:** page names and page icons on every device.
    - **6.9:** missing-plugin prompt on import.
    - **7.0:** import dialog pre-selects the current device.
    - **7.3.0:** fixed "auto-installed profiles from plugins couldn't be switched to another profile
      from within the plugin".
    - **7.4:** fixed "nested Switch Profile actions inside a Multi Action could lose their internal
      references when imported".
    - **7.4.2:** fixed "assigning Right-Alt as a Hotkey would incorrectly register as Ctrl+Alt when
      using an English (UK) keyboard layout".
    - **7.5.0:** clearer message when a required plugin version isn't on Marketplace.
17. **Profiles on a mismatched device.** A forum post says a 32-key profile imported onto a 15-key
    deck shows only the 15 actions in the top-left [R-, AVSIM, search excerpt]. Elgato only says
    profiles "do not auto-scale" [C].
18. **Page `Icon` is an image path, and SVG works.** Real 6.9-era pages have
    `"Icon":"Images/<id>.svg","Name":"DV - Diesel Homepage"`. 24 SVG key images were also seen. [R]
19. **Hotkey Switch is a documented built-in action with two hotkey fields** [C, Elgato Explorer
    "How to set up Stream Deck hotkeys", updated 18 June 2026]. Its JSON is still unverified.
20. **`@elgato/cli` 1.10.4 checks bundled profile paths.** `streamdeck validate` and `pack` report an
    error when a `Profiles[].Name` doesn't resolve to `<Name>.streamDeckProfile` in the plugin folder
    [C, CLI source].
21. **No GIF or WEBP was found in any real profile** (5,958 image entries: PNG, JPG, SVG). Animation from a
    profile state is still [I].

Confirmed unchanged:

- the ZIP container and both layouts
- the base32 page-folder algorithm (it round-trips all 12 sample pages, 19 more real v2 profiles and 5 of
  data-enabler's test vectors)
- the empty Default page
- `page.goto` `PageIndex` counts from 1
- the 4-slot Hotkey array and its empty-slot marker
- VK and Qt key codes (checked against learn.microsoft.com and doc.qt.io)
- the manifest `Profile` schema and the `DeviceType` enum 0–13
- the `switchToProfile` message, with a page index that counts from 0 (6.5+), and the rule that
  plugins can only switch to their own bundled profiles
- `AutoInstall` (6.6+)
- `Encoder.background` (lower-case b) is 200×100 and the controller `Background` is 800×100 on
  Stream Deck +
- `backtoparent` sits at `0,0` on every folder page (165 of 165)

---

## 0. TL;DR for the generator

1. **The container.** A `.streamDeckProfile` is a plain ZIP. Two layouts are in use [C/R]:
   - **v2** (`"Version":"2.0"`): `<PROFILE-UUID>.sdProfile/manifest.json` and
     `<PROFILE-UUID>.sdProfile/Profiles/<base32 page id>/manifest.json`, plus images in each page's
     `Images/`. This is what 6.x exports and what Elgato's sample plugin bundles.
   - **v3** (`"Version":"3.0"`, 7.x exports): a root `package.json`, then
     `Profiles/<PROFILE-UUID>.sdProfile/…`, with page folders named by the page UUID in upper case.
2. **Generate v2.**
   - Elgato bundles v2 in a plugin that needs 7.1 [C].
   - A script-written **v3** file is known to import into 7.4.0 [R].
   - No v2 file is known first-hand to import into 7.x. v2 is still the only layout 6.x is known to
     read. [I-strong]
   - Add `Plugin` blocks to every action even in v2. Real 6.9-era v2 exports have them, and they
     drive the missing-plugin prompt [R/C].
3. **v2 page folder names.** Take the page UUID's 128 bits, shift left by 2, and write 26 base32
   digits from `0123456789ABCDEFGHIJKLMNOPQRSTVW`. Then add a literal `Z`. [R; verified on Elgato's 6 samples,
   19 other real v2 profiles and 5 of data-enabler's test vectors]
4. **Pages.**
   - Every profile has an empty Default page, which is not listed in `Pages.Pages`.
   - Content pages are `Pages.Pages`, shown as pages 1 to n, with at most 10 per profile [C].
   - Folder pages are extra page folders, not listed anywhere. They are reached only through
     `openchild`'s `Settings.ProfileUUID` [R].
5. **Links within a profile.**
   - `com.elgato.streamdeck.page.goto` with `Settings.PageIndex` counting from 1 [R].
   - `page.next` and `page.previous` [R].
   - Folders with `profile.openchild` and `profile.backtoparent` [R].
   - Don't use **Switch Profile** (`profile.rotate`) between pack profiles: import gives profiles
     new UUIDs [R, one case].
   - To link scenes across profiles, have the **plugin** call `switchToProfile`. It only reaches the
     plugin's own bundled profiles [C], and its `page` counts from 0 [C].
6. **Built-in Hotkey (`com.elgato.streamdeck.system.hotkey`).**
   - `Settings = {"Coalesce":true,"Hotkeys":[4 slots]}` [R].
   - On keys only `[0]` is used. On dials the slots are `[0]` CCW, `[1]` CW, `[2]` press, `[3]`
     empty [C-UI + R].
   - Empty slot on Windows: `NativeCode 146, QTKeyCode 33554431, VKeyCode -1, KeyModifiers 0`, all
     flags false [R].
   - **It taps**: press and release on a key press, with no hold [R-].
   - `KeyModifiers` bitmask (section 6.2):
     - Shift `0x1`, Ctrl `0x2`, Alt `0x4`, Win `0x8`
     - Left Shift `0x10`, Left Ctrl `0x20`, Left Alt `0x40`
     - Right Shift `0x100`, Right Ctrl `0x200`, Right Alt `0x400`
     - `0x10000` whenever any side bit is set
     - Numpad `0x4000`
7. **Bundling in a plugin.**
   - One manifest `Profiles[]` entry per file: `{Name (path without .streamDeckProfile), DeviceType
     0–13, AutoInstall (6.6+), DontAutoSwitchWhenInstalled, Readonly}` [C].
   - Users are prompted on install, or on the first `switchToProfile` when `AutoInstall:false` [C].
   - Set `Software.MinimumVersion ≥ "7.3"` if the plugin switches profiles. 7.3.0 fixed switching
     away from auto-installed plugin profiles [C].

---

## 1. Sources checked

### Primary (Elgato), re-read for this check

| What | URL | Notes |
|---|---|---|
| SDK guide: Profiles | https://docs.elgato.com/streamdeck/sdk/guides/profiles | Docs version 3.0.0. `Name` without extension, `AutoInstall`, "Plugins can only switch to profiles distributed with the plugin", and making a profile by exporting it from the app |
| Manifest reference | https://docs.elgato.com/streamdeck/sdk/references/manifest | `Profile` type, `DeviceType` list 0–13, `MinimumVersion` "6.4"…"7.6", `VisibleInActionsList` |
| Manifest schema (live) | https://schemas.elgato.com/streamdeck/plugins/manifest.json | `$id` `@elgato/schemas/streamdeck/plugins/manifest@0.6.0`, last-modified 29 Oct 2026, 391,089 bytes |
| WebSocket reference | https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin | `SwitchToProfile` type |
| SDK changelog | https://docs.elgato.com/streamdeck/sdk/references/changelog | 6.5 `switchToProfile` page; 6.6 `AutoInstall`; 7.0 VSD type, Mobile and VSD sizes no longer fixed at 8×8; 7.1 resources; 7.6 Neo |
| Embedded resources | https://docs.elgato.com/streamdeck/sdk/guides/resources | 7.1+, packed into exported profiles |
| Dials guide (built-in layouts) | https://docs.elgato.com/streamdeck/sdk/guides/dials | `$X1` icon `rect [76,40,48,48]` |
| Profiles for makers: getting started / packaging | https://docs.elgato.com/stream-deck/profiles/getting-started and https://docs.elgato.com/stream-deck/profiles/packaging | Profiles are tied to an OS and a device type; they "do not auto-scale"; no auto-update; include a device name in the profile name |
| `@elgato/streamdeck` 3.0.4 (`dist/plugin/profiles.js`) | https://www.npmjs.com/package/@elgato/streamdeck | Raw `switchToProfile` message; `context` = plugin UUID |
| `@elgato/cli` 1.10.4 | https://www.npmjs.com/package/@elgato/cli | Checks that `filePath` references exist |
| Sample plugin (current) | https://github.com/elgatosf/streamdeck/tree/main/examples/lights-out (repo HEAD `9d9636e`, 2026-11-05; profiles added `b6e9b39`, 2026-10-27) | Six v2 files, types 0, 1, 2, 3, 7 and 9 |
| Sample plugin (original) | https://github.com/elgatosf/streamdeck-plugin-samples/tree/main/lights-out (`cbc9780`, 2024-09-25, `MinimumVersion "6.5"`, `SDKVersion 2`) | Same six files |
| Help: Hotkeys on Stream Deck + (created 2022-11-23, edited 2026-06-25) | https://help.elgato.com/hc/en-us/articles/10870947641741 | "Press / Tap, Rotate Clockwise, Rotate Counterclockwise". GIF `https://elgato-edge.s3.amazonaws.com/zendesk/Knowledge/StreamDeck%2B/Hotkeys/3.gif`, last frame: "Rotate CCW / Rotate CW / Press / Tap" |
| Help: Pages (edited 2026-06-23) | https://help.elgato.com/hc/en-us/articles/4410312027277 | "Stream Deck update 5.1 introduced… Pages"; "You can create up to 10 pages per Profile"; Next and Previous Page are placed automatically when pages are created |
| Help: Action Trigger (edited 2026-06-23) | https://help.elgato.com/hc/en-us/articles/29655069662609 | 6.8+; screenshot `article_attachments/29775699809041` shows the slot order CCW, press, CW |
| Help: Download and use Profiles | https://help.elgato.com/hc/en-us/articles/33556495589905 | 6.4+; double-click the file, then "Are you sure you want to install this profile?"; "?" keys mean a plugin is missing |
| Help: Customizing Key Icons (edited 2026-06-24) | https://help.elgato.com/hc/en-us/articles/360028237271 | PNG, JPEG, GIF, BMP, WEBP, animated WEBP; minimum 72×72 |
| Help: release notes 5.0 … 7.6.1 (43 articles) | e.g. 6.9 https://help.elgato.com/hc/en-us/articles/34904105205777, 7.0 …/38011940576273, 7.1 …/41533810232721, 7.3.0 …/44411141578001, 7.4 …/45347482546193, 7.4.2 …/46818420770321, 7.6.1 …/52643738310417 | See section 9 |
| Explorer: How to set up hotkeys (updated 18 June 2026) | https://www.elgato.com/explorer/products/stream-deck/how-to-set-up-stream-deck-hotkeys/ | Dial hotkeys on +, + XL and Galleon; Hotkey Switch has two hotkey fields |
| Explorer: Profiles at scale | https://www.elgato.com/us/en/explorer/products/stream-deck/stream-deck-profiles-at-scale/ | `custom_default_profiles`; file names `StreamDeck`, `StreamDeckNeo`, `StreamDeckMini`, `StreamDeckXL`, `StreamDeckPlus`; "not officially supported" |
| Qt key and modifier enums | https://doc.qt.io/qt-6/qt.html | `Key_*` values; `Key_unknown 0x01ffffff`; modifier values |
| Windows virtual-key codes | https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes | All VK values in section 6.3; `0x92`–`0x96` "OEM specific" |

### Real profile files (downloaded again, hashes match the draft's copies)

| Repo / source | Format, app | Used for |
|---|---|---|
| https://github.com/John-Mack/HeirOfgaia-StreamDeck-Profile (`f7ad698`, 2026-03-27) | v3, `AppVersion 7.3.1.22604`, Windows, MK.2 `20GBA9901` | `package.json`, uppercase page folders, `page.indicator`, Switch Profile |
| https://github.com/phew-blue/streamdeck-home-ops (full history) | v3: app exports from 7.4.0 (`7145092`, `usethisone`) and script-written files (`f1dd80b`, `5df9d77`) | Script file imported and re-exported; new UUIDs; image names kept; `" copy 1"` |
| https://github.com/Nagaimo355/StreamDeckPlusController_for_DerailValley (`2465760`, 2026-03-18) | `.streamDeckProfilesBackup`, v3 on disk, Stream Deck + | Elgato's default + profile (Tutorials folder with `com.elgato.tutorial.*` actions); dial Hotkeys; `Encoder.Icon` 48×48; `Encoder.background` 200×100; controller `Background` 800×100; Action Trigger |
| https://github.com/DKlaper/ga-msfs2024-stream-deck-plus (`3e15963`, 2025-02-01) | v2 without `Plugin`, Stream Deck + | `PageIndex` counts from 1, checked against page names |
| https://github.com/bitwrestler/DCS-StreamDeckProfiles (`c5ccc4f`, 2024-01-13) | v2 without `Plugin` or `Pages.Default`, XL | Self-labeled left/right modifier keys; numpad with modifiers |
| https://github.com/JustaDevOnTheMove/StreamDeckProfiles (`5615b63`, 2025-07-24) | v2 **with `Plugin` on every action**, XL `20GAT9902` | 6.9-era v2; numpad keys with `VKeyCode -1`; SVG page icons |
| https://github.com/phobicdotno/Stream-Deck-XL-.streamDeckProfile-by-Phobic | v2, XL | Real `page.next` / `page.previous` JSON |
| Aputure Sidus Link Pro pack v1.7 (https://help.aputure.com/en/sidus-link-pro/stream-deck-profile) | v3, `AppVersion 7.5.1.22901`, macOS; Standard is a genuine export, XL / + / + XL re-encoded | macOS key codes; + XL keypad 9×4 with 4 dials filled |

No public Star Citizen profile with readable JSON was found. They are sold on the Marketplace and in
stores (this was not checked again). The DCS files are the closest stand-in, because DCS also binds
left and right modifiers separately.

### Open-source tools (spot-checked)

| Tool | Checked |
|---|---|
| https://github.com/data-enabler/streamdeck-profile-generator (`62c75f5`, 2024-11-09) | README: "simply double-click the resulting `.streamDeckProfile` file to load it"; `actionId()` returns all zeros ("so I guess they don't matter?"); `profileFolderId()` test vectors match our algorithm |
| https://github.com/jlgabriel/StreamDeck-Profile-Generator (`a81cb4d`, 2026-04-02) | README: "V3 format, compatible with Stream Deck software v7.3+". `528d53a`: "Default page must be empty… explicit Prev/Next Page buttons are needed for hardware navigation… Maximum 10 pages". `65775da`: `key_modifiers \|= 16384` for numpad, misnamed `Qt::KeypadModifier`. Known issue: punctuation keys display wrong on non-US layouts, but "The hotkeys still function correctly" |
| https://github.com/verygoodplugins/streamdeck-mcp (`dd3e58d`, 2026-07-19) | `SKILL.md`: `Encoder.Icon` and `Encoder.background` "only survive a profile write when the action's plugin declares `Controllers: ["Encoder"]`"; + XL full-strip `Background` is 1200×100; + XL keypad 9×4 (PR #18) |
| https://github.com/ydmw74/elgato2streamcontroller | Maps `system.hotkeyswitch` to `Hotkeys[0]` and `[1]`. Its "held while pressed" is its own StreamController mapping, not Elgato's behavior |
| https://github.com/BarRaider/streamdeck-foldereditor | Reads `%APPDATA%\Elgato\StreamDeck\ProfilesV2` |

---

## 2. Container and layouts

### 2.1 The ZIP [R]

- **The app's own zips.** Every entry has "version made by" 10/45 (NTFS, zip 4.5) and the UTF-8
  name flag `0x800`.
  - Elgato's v2 samples: directories are stored with flags `0x802`; files are deflated with `0x80a`
    (a data descriptor and the "max compression" bit).
  - 7.x exports: `0x800` for directories and `0x808` for files.
  - There are explicit directory entries, with external attributes `0x10` for directories and `0x20`
    for files.
- **Other zips import too.** phew-blue's Python zip has "made by" 3/20 (Unix), no directory flags,
  and JSON pretty-printed with `", "` and `": "`. It imported into 7.4.0 [R].

  So the zip details evidently don't matter. Writing directory entries costs nothing.
- **JSON:** UTF-8 without a BOM. The app writes it compact, with keys in alphabetical order
  (Qt's `QJsonObject` sorts them) [R].
- **Node built-ins are enough:** `zlib.deflateRawSync`, plus `zlib.crc32` (Node 20.15+ / 22.2+)
  or a small CRC table. The draft's `scripts/proto/make-sample-profile.js` output passed `unzip -t` and
  this check's folder-id and controller checks. It writes "made by" 0/20 and no data descriptor, which
  is fine according to the evidence above.

### 2.2 v2 layout [C/R]

```
<PROFILE-UUID-UPPER>.sdProfile/
  manifest.json                     top-level manifest, "Version": "2.0"
  Images/                           optional (absent in Elgato's samples)
  Profiles/
    <26 base32 chars + Z>/          one folder per page: content pages, the Default page, folder pages
      manifest.json
      Images/                       always present, may be empty
        <26 base32 chars + Z>.png   referenced as "Images/<name>" from this page's manifest
```

Elgato `sd.streamDeckProfile` (type 0, from 2024-09-25), all nine entries:

```
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/manifest.json
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/                 <- Default (empty)
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/Images/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/B00IVBB5AP2299JIA60KWIPPDGZ/manifest.json
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/                 <- page 1
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/Images/
C784B6DB-FB59-49BF-A19A-B1C5FE8170C6.sdProfile/Profiles/PIH1N4R4OL2NH2IOKR1LRVD5V8Z/manifest.json
```

```json
{"Device":{"Model":"20GAA9901","UUID":""},"Name":"Lights Out","Pages":{"Current":"cca21b93-64c5-4578-8a58-a6c35df9a5f2","Default":"58012f2d-6556-4424-a672-51814fcb396c","Pages":["cca21b93-64c5-4578-8a58-a6c35df9a5f2"]},"Version":"2.0"}
```

Default page manifests in Elgato's samples, verbatim:

- 15-key, Mini, XL, Mobile: `{"Controllers":[{"Actions":{},"Type":"Keypad"}],"Icon":"","Name":""}`
- Stream Deck +: `{"Controllers":[{"Actions":{},"Type":"Keypad"},{"Actions":{},"Type":"Encoder"}],"Icon":"","Name":""}`
- Neo: `{"Controllers":[{"Actions":{},"Type":"Keypad"},{"Actions":{},"Type":"Neo"}],"Icon":"","Name":""}`

Older v2 exports (DCS, January 2024) have **no `Pages.Default`** at all, only `Current` and `Pages`
[R]. Always write it anyway: every 2024+ file has it.

Some user exports also include `manifest.json.bak` files that hold the real device ID
(`"UUID":"@(1)[4057/<pid>/<serial>]"`, redacted here). Never ship `.bak` files.

### 2.3 v3 layout (Stream Deck 7.x exports) [R]

```
package.json
Profiles/
  <PROFILE-UUID-UPPER>.sdProfile/
    manifest.json                   "Version": "3.0"
    Images/
    Profiles/
      <PAGE-UUID-UPPER>/            e.g. 1C2D10FC-B5A4-4197-A483-245EC7068A11
        manifest.json
        Images/<26 base32 chars>Z.png
```

`package.json` from the HeirOfGaia export (7.3.1, Windows), verbatim:

```json
{"AppVersion":"7.3.1.22604","DeviceModel":"20GBA9901","DeviceSettings":null,"FormatVersion":1,"OSType":"Windows","OSVersion":"10.0.26200","RequiredPlugins":["com.elgato.streamdeck.page","com.elgato.streamdeck.profile.backtoparent","com.elgato.streamdeck.profile.openchild","com.elgato.streamdeck.profile.rotate","com.elgato.streamdeck.multiactions","com.elgato.streamdeck.system.text"]}
```

Top-level manifest from the same export (`AppIdentifier` replaced):

```json
{"AppIdentifier":"<full path to a game .exe on the exporting PC>","Device":{"Model":"20GBA9901","UUID":"f57d956d-052e-4a2b-bcae-ca0684877148"},"Name":"HeirOfGaia Commands","Pages":{"Current":"00000000-0000-0000-0000-000000000000","Default":"81888262-27ae-4591-b8b7-a01b632dd6b6","Pages":["1c2d10fc-b5a4-4197-a483-245ec7068a11"]},"Version":"3.0"}
```

What the v3 files show [R]:

- **`RequiredPlugins` is built from the actions' `Plugin.UUID` values.**
  - phew-blue's script wrongly set `Plugin.UUID` to *action* UUIDs (`com.phew.blue.homeops.cluster`).
  - The app's re-export then listed exactly those strings in `RequiredPlugins`.
  - So our own actions must use our **plugin** UUID in `Plugin.UUID`.
- **`Pages.Current` is all zeros in exports.**
- **`Device.UUID`** is a random GUID in exports and `@(1)[<VID>/<PID>/<serial>]` on disk.
  jlgabriel writes `""` in v3.
- **A script-written v3 file imports into 7.4.0.**
  - phew-blue's Python-made file (`f1dd80b`, "made by" Unix, with its own hex image names and
    `Plugin.Name` values such as "Age" and "CPU") went through the app and came back as `usethisone`.
    That is an app export: "made by" NTFS 4.5, `AppVersion 7.4.0.22712`.
  - The round trip kept the script's names but gave every profile and page a new UUID. It also
    renamed the profile to `"Default Profile copy 1"`, because a profile of that name already existed.
- **When v3 started.**
  - The last v2 exports seen were committed in July 2025, before 7.0.
  - The 7.1 notes say "With Stream Deck 7.0, profiles now tell you which plugins you'll need when
    importing a profile" [C].
  - So v3 most likely arrived in 7.0 (12 Aug 2025) [I-strong]. The earliest v3 file seen is from 7.3.1.
- **Can 6.x read v3?** Unknown [?].

### 2.4 `.streamDeckProfilesBackup` [R]

A ZIP holding `Profiles/<UUID>.sdProfile/…` in the on-disk v3 form plus `Resources/manifest.json`
(`{"resources": null}`, pretty-printed). It restores every profile, so it is not a way to distribute
one.

### 2.5 v1 (before 5.x) [R]

These are 2021 files in `Centralize/StreamdeckProfiles`:

- Entry names use **backslashes**, e.g. `<GUID>.sdProfile\0,0\CustomImages\`.
- There is one folder per key, plus a single manifest with top-level `Actions`, `DeviceModel`,
  `DeviceUUID` and `"Version":"1.0"`.
- 6.0.4 "Fixed importing Stream Deck profiles prior to 6.x" [C].

Don't generate v1.

---

## 3. IDs and case rules [R]

| Thing | Form |
|---|---|
| Profile folder | `<UUID>.sdProfile`, UUID in upper case (every sample, v2 and v3) |
| Page UUIDs inside JSON (`Pages.*`, `openchild` `ProfileUUID`, Switch Profile `ProfileUUID`) | lower case, with hyphens |
| v2 page folder | base32 of the page UUID plus `Z` (27 characters) |
| v3 page folder | page UUID in upper case |
| `ActionID` | Random lower-case UUID per action instance. data-enabler wrote all zeros; use unique ones |
| Image file names | App-made: 26 base32 characters plus `Z`, then `.png` / `.svg` / `.jpg`. Script-made 26 hex characters plus `Z` survive an import [R]. Other names are not shown to survive [?] |

v2 folder ID (Node). Checked against Elgato's 12 sample pages, all pages of 19 other real v2
profiles and 5 of data-enabler's 9 test vectors:

```js
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTVW';      // base32hex with U skipped
function v2FolderId(uuid) {                            // 'cca21b93-64c5-…' -> 'PIH1N4R4OL2NH2IOKR1LRVD5V8Z'
  let n = BigInt('0x' + uuid.replace(/-/g, '')) << 2n;  // 128 bits -> 130 bits = 26 x 5
  let s = '';
  for (let i = 0; i < 26; i++) { s = ALPHA[Number(n & 31n)] + s; n >>= 5n; }
  return s + 'Z';
}
```

Image names in the same style: `v2FolderId(crypto.randomUUID()) + '.png'`. Or derive them from a hash
(phew-blue: the first 26 hex digits of a SHA-1, upper case, plus `Z`) so rebuilds are reproducible.

---

## 4. Top-level manifest

### 4.1 Fields [R]

| Field | v2 | v3 | Notes |
|---|---|---|---|
| `Device.Model` | yes | yes | See 4.2 |
| `Device.UUID` | `""` in exports | random GUID in exports | Write `""` |
| `Name` | yes | yes | Shown in the profile list; gets `" copy 1"` when the name clashes |
| `Pages.Current` | a page UUID (Elgato: `Pages[0]`) | all zeros | v2: write the first content page |
| `Pages.Default` | UUID of an **empty** page not in `Pages.Pages` | same | Missing in January 2024 DCS exports; always write it |
| `Pages.Pages` | Ordered content pages 1…n | same | At most 10 [C] |
| `Version` | `"2.0"` | `"3.0"` | |
| `AppIdentifier` | optional | optional | Smart Profile binding: a full local `.exe` path, including the user name. **Never write it.** |

### 4.2 `Device.Model` per target (see `devices.verified.md` for detail)

| Device (`DeviceType`) | Grid (cols × rows) | Model string to write | Confidence |
|---|---|---|---|
| Stream Deck / MK.2 / Scissor Keys / Module 15 (0) | 5×3 | `20GAA9901` (Elgato's type-0 sample). Real MK.2 exports carry `20GBA9901` | [C] / [R] |
| Mini / Module 6 (1) | 3×2 | `20GAI9901` | [C] |
| XL / Module 32 (2) | 8×4 | `20GAT9901` (XL 2022 exports carry `20GAT9902`) | [C] / [R] |
| Mobile (3) | sample is 8×8; real sizes vary since 7.0 [C changelog] | `VSD2/WiFi` | [C] |
| Pedal (5) | 3×1 | not seen | [?] |
| Stream Deck + (7) | 4×2 keys + 4×1 `Encoder` | `20GBD9901` (Aputure's re-encoded file says `20GBC9901`, unexplained) | [C] |
| Neo (9) | 4×2 keys + `Neo` controller | `20GBJ9901` | [C] |
| Studio (10) | – | Profile docs: "does not currently support Stream Deck app profiles" | [C] |
| Virtual Stream Deck (11), Galleon 100 SD (12) | ?, 3×4 + 2 dials | not seen | [?] |
| Stream Deck + XL (13) | 9×4 keys + 6×1 `Encoder` | `20GBX9901` | [R-weak] |

Profiles are tied to an OS and a device type and "do not auto-scale when imported to a smaller
device" [C]. Since 6.5 the import dialog lets the user choose the target device, and since 7.0 it
pre-selects the current one [C]. One forum report says a larger profile imported onto a smaller deck
shows only the keys that fit, starting top-left [R-].

**Ship one file per model.** Include the device in the profile `Name`; Elgato's packaging doc
recommends it.

---

## 5. Page manifest (`Profiles/<page>/manifest.json`)

```json
{"Controllers":[{"Actions":{"<col>,<row>":{}},"Type":"Keypad"},{"Actions":{"<dial>,0":{}},"Background":"Images/<strip>.png","Type":"Encoder"}],"Icon":"","Name":"COMBAT"}
```

Details [R]:

- **Controller types.** `Controllers[].Type` is `"Keypad"`, `"Encoder"` (+ and + XL) or `"Neo"` (Neo;
  `{"Actions":{}}` in Elgato's sample).
- **Write every controller the model has**, even when it is empty. Elgato's + pages always have
  both controllers.
- **Action keys are `"col,row"`, counted from 0 at the top left.**
  - The XL sample's last key is `"7,3"`, the Mini's `"2,1"` and Mobile's `"7,7"`.
  - Dials are `"0,0"`…`"3,0"` on Stream Deck +.
  - The + XL should be `"0,0"`…`"5,0"`. Aputure's + XL file fills only `0,0`…`3,0`. [I]
- **Empty controllers.** `Actions` may be `{}` (v2) or `null` (the app's v3 on-disk files) when
  empty.
- **Strip backgrounds.** The `Encoder` controller's `Background` (capital B) is the whole touch strip
  for that page.
  - It is an 800×100 PNG in Elgato's default + profile.
  - It should be 1200×100 on + XL: the strip size is [C] (`devices.verified.md`), and
    streamdeck-mcp uses 1200×100 [R-].
  - Strip backgrounds can differ per page and per folder since 6.0.3 [C].
- **Page name and icon.** `Name` is the page name, and `Icon` is an image path such as
  `"Images/<id>.svg"`. Both are shown on every device since 6.7 [C]. Both may be `""`.
- **Key-area backgrounds** (6.6 "page backgrounds", one image behind all keys) appear in **no**
  real file here, so their JSON field is unknown [?]. Don't rely on them.

### 5.1 Action entry

The form a 7.x / 6.9 export uses (`Plugin` and `Resources` included):

```json
{"ActionID":"c70b1a1f-ee7d-4963-9791-db82ec461a79","LinkedTitle":true,"Name":"Hotkey","Plugin":{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"},"Resources":null,"Settings":{},"State":0,"States":[{}],"UUID":"com.elgato.streamdeck.system.hotkey"}
```

- **`Plugin`.**
  - ≤6.8 v2 exports and Elgato's samples don't have it.
  - 6.9-era v2 exports have it on 100% of actions, and v3 on nearly all.
  - For a third-party action it is `{Name, UUID: <plugin UUID>, Version: <plugin version>}`, e.g.
    `{"Name":"Volume Controller","UUID":"com.elgato.volume-controller","Version":"2.0.2.166"}` [R].
- **`Resources`** is v3 only. It is `null`, or a map of files (7.1+) [C/R].
- **`Name`** is only a label; localized exports contain `"Raccourci"` [R].
- **`State` and `States`.** `State` is the current state index. `States` has one entry per state.
- **Optional extras seen:**
  - `AutoExit: {"Delay":1,"Enabled":false}` on `backtoparent`
  - `Encoder: {…}` on dial actions
  - `Actions: [...]` on containers (Multi Action, Key Logic, Action Trigger, Dial Stack)

### 5.2 State object [R]

| Field | Values seen |
|---|---|
| `Title` | string; `\n` for line breaks; `" "` forces an empty title |
| `ShowTitle` | bool |
| `TitleAlignment` | `"top"`, `"middle"`, `"bottom"` (the same enum as manifest states [C schema]) |
| `TitleColor` | `"#rrggbb"`, lower case |
| `FontFamily` | `""` (default font), `"Tahoma"`, `"Arial"`, … |
| `FontSize` | integer, 6–18 seen |
| `FontStyle` | `""`, `"Regular"`, `"Bold"`, `"Italic"`, `"Bold Italic"` (manifest schema enum [C]) |
| `FontUnderline` | bool |
| `OutlineThickness` | always `2` (not a manifest field; profiles only) |
| `Image` | `"Images/<file>.<ext>"` **with** the extension, relative to the **page** folder (the manifest schema leaves the extension off; profiles keep it) |

Every field is optional. `{}` and `{"Image":"Images/X.png"}` are both real.

### 5.3 Dial (Encoder) extras [R]

From Elgato's default Stream Deck + profile (on-disk v3; IDs shortened):

```json
{"Background":"Images/R3K7QCRT9D7B32760VA106P984Z.png","Type":"Encoder","Actions":{
 "0,0":{"ActionID":"7e57b416-…","Encoder":{"Icon":"Images/WSNHTJI8OP7F79W252IB6PSJO4Z.png"},
        "LinkedTitle":true,"Name":"Hotkey",
        "Plugin":{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"},
        "Resources":null,
        "Settings":{"Coalesce":true,"Hotkeys":[
          {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":2,"KeyOption":false,"KeyShift":false,"NativeCode":90,"QTKeyCode":90,"VKeyCode":90},
          {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":3,"KeyOption":false,"KeyShift":true,"NativeCode":90,"QTKeyCode":90,"VKeyCode":90},
          {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,"NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1},
          {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,"NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1}]},
        "State":0,"States":[{"Title":"Undo/Redo"}],"UUID":"com.elgato.streamdeck.system.hotkey"},
 "3,0":{"Encoder":{"IconVisible":false,"background":"Images/H31F4DK4K906N84M7G9Q2LA57GZ.png"},
        "Settings":{"Coalesce":true,"Hotkeys":["…VK 38 Up…","…VK 40 Down…","…empty…","…empty…"]},
        "States":[{"Title":" "}],"UUID":"com.elgato.streamdeck.system.hotkey","…":"…"}}}
```

Measured image sizes:

- `R3K7…` (controller `Background`) is **800×100**.
- `WSNH…` (`Encoder.Icon`) is **48×48**.
- `H31F…` (`Encoder.background`, lower-case b) is **200×100**.
- The keys on the same page are **144×144**.

`IconVisible:false` hides the dial icon.

streamdeck-mcp says `Encoder.Icon` and `Encoder.background` are dropped when the app rewrites the
profile, unless the action's plugin declares `Controllers` that include `"Encoder"` [R-]. Built-in
Hotkey supports dials, so it keeps them. Our plugin's dial actions must declare `"Encoder"`.

### 5.4 Images

- **Formats.** The app supports PNG, JPEG, GIF, BMP, WEBP and animated WEBP, at a minimum of 72×72;
  larger images are resized, and non-square ones fit with their aspect ratio kept [C, help].
  Real profiles also contain SVG [R].
- **What real files use.** In 5,958 image entries (some files counted twice): PNG 5,898, JPG 36, SVG 24. **No GIF or WEBP** [R]. That
  an animated GIF or WEBP referenced from a profile state animates after import is not proven [I].
- **Recommended sizes:**
  - 144×144 PNG for keys on every model. Elgato's own default + profile uses 144.
  - 48×48 for `Encoder.Icon`. The `$X1` icon slot is 48×48 [C].
  - 200×100 for `Encoder.background`.
  - 800×100 (+) or 1200×100 (+ XL) for the controller `Background`.
- **Where images go.** Store each image in its page's own `Images/` folder.

---

## 6. Built-in Hotkey (`com.elgato.streamdeck.system.hotkey`)

### 6.1 Settings [R]

```json
"Settings":{"Coalesce":true,"Hotkeys":[
  {"KeyCmd":false,"KeyCtrl":true,"KeyModifiers":6,"KeyOption":true,"KeyShift":false,"NativeCode":84,"QTKeyCode":84,"VKeyCode":84},
  {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,"NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1},
  {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,"NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1},
  {"KeyCmd":false,"KeyCtrl":false,"KeyModifiers":0,"KeyOption":false,"KeyShift":false,"NativeCode":146,"QTKeyCode":33554431,"VKeyCode":-1}]}
```

The first slot above is Ctrl+Alt+T.

- **Always four slots.**
  - Windows empty slot: `NativeCode 146` (`0x92`, a Windows "OEM specific" VK), `QTKeyCode 33554431`
    (`0x01ffffff` = `Qt::Key_unknown` [C Qt]), `VKeyCode -1`.
  - macOS exports use `NativeCode -1` instead.
- **`Coalesce`.** It is `true` in every occurrence found (about 1,700, some files counted twice). Its meaning is
  undocumented [?]. Always write `true`.
- **Slot use.**
  - **Keys:** only `[0]` (no key action with `[1]`–`[3]` filled in any file) [R].
  - **Dials:** `[0]` Rotate CCW, `[1]` Rotate CW, `[2]` Press / Tap, `[3]` stays empty
    [C-UI + R].
- **What happens on a press.** The action **taps**: press and release when the key is pressed. It
  does not hold for the time the key is held [R-]. A hold-type or modifier-only bind can't be done
  with the built-in action.

### 6.2 `KeyModifiers` bitmask (Windows) [R]

| Bit | Meaning | Real example (title as stored in the file) |
|---|---|---|
| `0x0001` | Shift (any) = `KeyShift` | `1` |
| `0x0002` | Ctrl (any) = `KeyCtrl` | `2`; `3` = Ctrl+Shift (Elgato "Undo/Redo" CW) |
| `0x0004` | Alt (any) = `KeyOption` | `6` = Ctrl+Alt |
| `0x0008` | Win = `KeyCmd` | `8` = Win+D "Show Desktop", `9` = Win+Shift+S "Screen Shot" (Elgato default) |
| `0x0010` | Left Shift | `0x10011` + F10 "Labels"; `0x10033` + P **"L-Ctrl+L-Shift+P"** |
| `0x0020` | Left Ctrl | `0x10022` + P "Panel" |
| `0x0040` | Left Alt | `0x10066` + W **"L-Ctrl+L-Alt+W"**; `0x10044` + 2 "AP Head" |
| `0x0080` | Left Win | not seen [I] |
| `0x0100` | Right Shift | `0x10505` + M **"R-Alt+R-Shift+M"** |
| `0x0200` | Right Ctrl | `0x10202` + C "Cockpit" (Ka-50). Inferred from the bit pattern; no self-labeled key [I-strong] |
| `0x0400` | Right Alt | `0x10505` + W **"R-Alt+R-Shift+W"** |
| `0x0800` | Right Win | not seen [I] |
| `0x4000` | numpad key | `16384` with VK 96–111; `0x4001` = Shift+Num+; `0x14202` = RCtrl+Num0; `0x14044` = LAlt+Num+ |
| `0x10000` | "differentiate left/right modifiers" on; set whenever a `0x10`–`0x800` bit is used | every side-specific example |
| `0x20000` | seen in one combination (8 keys): `0x24000`, `VKeyCode -1`, `NativeCode 111` (Num /, an extended key) | [?] |
| `0x40000000` | seen once with `NativeCode 192`, `VKeyCode -1` (equals `Qt::GroupSwitchModifier`) | [?] |

Rules for a writer [R]:

- **Generic bits stay set.** Keep the generic bit beside each side bit: Right Ctrl is
  `0x10000 | 0x200 | 0x2` = `66050`.
- **The booleans follow the bits.** Set `KeyShift`, `KeyCtrl`, `KeyOption` and `KeyCmd` from the
  generic bits.
- **No mixing.** When side-specific mode is on, every modifier in the hotkey is side-specific. No
  file mixes generic and side bits.
- **Untested.** Whether the app sends the **right-hand** key for `0x200` and `0x400` was not tested
  first-hand. DCS players rely on it. 7.4.2 fixed Right-Alt being *recorded* as Ctrl+Alt on UK
  layouts [C]. On layouts with AltGr, Windows itself may add Left Ctrl when Right Alt is sent [I].
  Test it with the dry-run showcase.

Writer helper, built from the rules above:

```js
const EMPTY = { KeyCmd: false, KeyCtrl: false, KeyModifiers: 0, KeyOption: false, KeyShift: false, NativeCode: 146, QTKeyCode: 33554431, VKeyCode: -1 };
const MOD = { shift: 0x1, ctrl: 0x2, alt: 0x4, win: 0x8, lshift: 0x11, lctrl: 0x22, lalt: 0x44, lwin: 0x88, rshift: 0x101, rctrl: 0x202, ralt: 0x404, rwin: 0x808 };
function hotkeySlot(vk, qt, mods = [], numpad = false) {
  let m = 0;
  for (const x of mods) m |= MOD[x];
  if (m & 0xff0) m |= 0x10000;   // side-specific modifiers in use
  if (numpad) m |= 0x4000;
  return { KeyCmd: !!(m & 8), KeyCtrl: !!(m & 2), KeyModifiers: m, KeyOption: !!(m & 4), KeyShift: !!(m & 1),
           NativeCode: vk, QTKeyCode: qt, VKeyCode: vk };
}
// dial: Hotkeys = [ccwSlot, cwSlot, pressSlot, EMPTY]; key: [slot, EMPTY, EMPTY, EMPTY]
```

### 6.3 Key codes

On Windows, `VKeyCode` = `NativeCode` = the virtual-key code [C learn.microsoft.com, R].
`QTKeyCode` is the Qt key code [C doc.qt.io, R]. On macOS both carry the mac key code (e.g. 125 =
down arrow).

| Key | VK / Native | QTKeyCode |
|---|---|---|
| A–Z / 0–9 (top row) / Space | 65–90 / 48–57 / 32 | same as VK |
| Esc / Tab / Backspace / Enter | 27 / 9 / 8 / 13 | 16777216 / 16777217 / 16777219 / 16777220 (`Key_Return`) |
| Insert / Delete / Home / End / PgUp / PgDn | 45 / 46 / 36 / 35 / 33 / 34 | 16777222 / 16777223 / 16777232 / 16777233 / 16777238 / 16777239 |
| Left / Up / Right / Down | 37 / 38 / 39 / 40 | 16777234 / 16777235 / 16777236 / 16777237 |
| F1…F12, F13…F24 | 112…123, 124…135 | 16777264 + (n−1) (`Key_F1 = 0x01000030`, `F24 = 0x01000047`) |
| Numpad 0–9 | 96–105 | 48–57 (the character), plus `KeyModifiers \|= 0x4000` |
| Num * + − . / | 106 / 107 / 109 / 110 / 111 | 42 / 43 / 45 / 46 / 47 (plus `0x4000`) |
| Num Enter | 13 (plus `0x4000`) | 16777221 (`Key_Enter`) [I, not seen in a real file] |
| ; = , − . / ` [ \ ] ' (US layout) | 186 187 188 189 190 191 192 219 220 221 222 | 59 61 44 45 46 47 96 91 92 93 39 |

- **`QTKeyCode` follows the exporting PC's layout.** One file has VK 192 with Qt 39 (`'`). A Qt code
  that doesn't match only changes the key name *shown* in the Property Inspector [R-, jlgabriel].
- **`NativeCode` alone seems to be enough.** Some Windows exports have `VKeyCode -1` with a real
  `NativeCode` (numpad keys in JustaDevOnTheMove's files) [R]. That suggests the app only needs
  `NativeCode` [I]. Write both.
- **Windows only.** Hotkeys are tied to the OS, so generate Windows files only.

### 6.4 Hotkey Switch (`com.elgato.streamdeck.system.hotkeyswitch`)

- The UUID comes from two converters (elgato2streamcontroller and tuxcast) [R-].
- Elgato documents the action as "If you want one key to switch between two shortcuts… enter the
  first hotkey in the first field, then the second hotkey in the second field" [C].
- elgato2streamcontroller reads it as `Hotkeys[0]` / `[1]` [R-]. No real file has one, so its JSON is
  unverified [?].
- Each tap sends one hotkey, but the key's local on/off state can drift from the game. Prefer
  separate keys, or plugin-driven state.

---

## 7. Navigation and linking ("scenes")

Every row below was seen in real files [R]. In v3, `Plugin` is added as shown.

| Purpose | Action `UUID` | v3 `Plugin` | `Settings` | Notes |
|---|---|---|---|---|
| Next page | `com.elgato.streamdeck.page.next` | `{"Name":"Pages","UUID":"com.elgato.streamdeck.page","Version":"1.0"}` [I from goto/indicator] | `{}` | v2 real: `{"ActionID":"…","Name":"Next Page","Settings":{},"State":0,"States":[{}],"UUID":"com.elgato.streamdeck.page.next"}` |
| Previous page | `com.elgato.streamdeck.page.previous` | same | `{}` | |
| **Go to page** | `com.elgato.streamdeck.page.goto` | `{"Name":"Pages","UUID":"com.elgato.streamdeck.page","Version":"1.0"}` | `{"PageIndex":N}` | **Counts from 1.** DKlaper: the "GNS530" key has `PageIndex 4` and `Pages.Pages[3]` is named "GNS 530"; "HOME" keys have `PageIndex 1`. Derail Valley uses `PageIndex 8` on an 8-page profile |
| Page indicator | `com.elgato.streamdeck.page.indicator` | same | `{}` | Shows the page number |
| Open folder | `com.elgato.streamdeck.profile.openchild` | `{"Name":"Create Folder","UUID":"com.elgato.streamdeck.profile.openchild","Version":"1.0"}` | `{"ProfileUUID":"<child page uuid, lower case>"}` | All 165 seen point to a page folder **not** in `Pages` |
| Back from folder | `com.elgato.streamdeck.profile.backtoparent` | `{"Name":"Open Parent Folder","UUID":"com.elgato.streamdeck.profile.backtoparent","Version":"1.0"}` | `{}` | At `0,0` on every folder page (165 of 165); optional `AutoExit` |
| Switch profile | `com.elgato.streamdeck.profile.rotate` | `{"Name":"Switch Profile","UUID":"com.elgato.streamdeck.profile.rotate","Version":"1.0"}` | `{"DeviceUUID":"","PageIndex":1,"ProfileUUID":"<profile uuid, lower case>"}` | Points at a profile UUID, and import gives profiles new UUIDs [R, one case]. `PageIndex` base unknown [?] |
| Action Trigger (dial → key actions) | `com.elgato.streamdeck.keys.adaptor` | `{"Name":"Keys","UUID":"com.elgato.streamdeck.keys","Version":"1.0"}` | `{}` + `Actions:[ccw, press, cw]` + `Encoder:{…}` | 6.8+ [C]; UI order CCW, press, CW [C-UI]; array order [R] |
| Key Logic | `com.elgato.streamdeck.keys.logic` | same as Action Trigger | `{}` + `Actions:[press, double, hold]` | 7.0+ [C] |
| Dial Stack | `com.elgato.streamdeck.dial.stack` | – | `{"CurrentIdx":0,"FastNavigation":false,"ShowStackIcon":true}` + `Actions` | |
| Multi Action, Delay, Text | `multiactions.routine` / `.routine2` / `.delay`, `system.text` | – | – | **Not allowed under the "one press per tap" rule** |

### How to link scenes

- **Within one profile (standalone).** Each scene (Combat, Mining, Salvage, Flight, …) is a **page** of
  one profile per model, up to 10 pages [C].
  - Put a navigation row on every page using `page.goto` (counts from 1), `page.next` and
    `page.previous`.
  - Use folders (`openchild` + `backtoparent` at `0,0`) for overflow. Folder pages don't appear in
    `Pages`, so they probably don't count toward the 10 [I].
  - All of this survives import, because it only refers to pages inside the same file [R]. The app's
    rewrite to new page UUIDs also remapped the `openchild` references (phew-blue) [R].
  - The app adds Next and Previous Page keys when a user creates pages in the UI [C]. It is unknown
    whether it adds them on import [?]. Always write explicit navigation keys (jlgabriel says the same).
- **Across profiles:**
  - Don't use Switch Profile in a distributed pack.
  - The plugin's `switchToProfile` (8.3) works only for its **bundled** profiles, addressed by
    manifest `Name`.
- **Ground rules for the owner.**
  - Don't emit Multi Action, Delay, Text, or Key Logic's double press or hold (they automate presses).
  - A dial Hotkey fires one hotkey per rotation step. Does that count as "one press per tap"?
  - Standalone profiles press keys through Elgato's app, **not** Tablet Deck. Tablet Deck's
    `onlyWhenGameFocused` check doesn't apply to them; the hotkey goes to whatever window has focus.
  - The built-in Hotkey taps; it cannot hold.
  - Hotkeys reach elevated (administrator) games again only from 7.6.1 [C].

---

## 8. Bundling profiles in a plugin

### 8.1 Manifest entries [C]

Live schema `definitions.Profile` (`@0.6.0`): `required: ["DeviceType","Name"]`,
`additionalProperties: false`.

```json
"Profiles": [
  {"Name": "profiles/tabletdeck-xl",   "DeviceType": 2, "AutoInstall": false, "DontAutoSwitchWhenInstalled": true, "Readonly": false},
  {"Name": "profiles/tabletdeck-plus", "DeviceType": 7, "AutoInstall": false, "DontAutoSwitchWhenInstalled": true, "Readonly": false}
]
```

- **`Name`** is the path relative to the manifest, **without** `.streamDeckProfile`.
  - Examples from the docs: `assets/main-profile`, `profiles/super-cool-profile`.
  - The schema pattern rejects a trailing `.streamDeckProfile` and a leading `../` or `/`.
  - `@elgato/cli` 1.10.4 reports an error if the file isn't there.
- **`DeviceType`** is an enum from 0 to 13:
  - 0 Stream Deck, 1 Mini, 2 XL, 3 Mobile
  - 4 Corsair GKeys, 5 Pedal, 6 Corsair Voyager
  - 7 Stream Deck +, 8 SCUF Controller, 9 Neo, 10 Studio
  - 11 Virtual Stream Deck, 12 Galleon 100 SD, 13 Stream Deck + XL
- **The other fields:**
  - `AutoInstall` defaults to `true` and needs 6.6+.
  - `DontAutoSwitchWhenInstalled` defaults to `false`.
  - `Readonly` defaults to `false` and decides "whether the profile is read-only, or if the user is
    able to customize it".
- **Elgato's samples** use a distinct file per `DeviceType`. Whether one `Name` can serve several
  device types is untested [?].
- **Hidden actions.** `Actions[].VisibleInActionsList: false` keeps an action out of the action list
  while still allowing it in bundled profiles [C]. That's useful for plugin-only scene keys.

### 8.2 What the user sees

- **Default (`AutoInstall` true):** "users are prompted to install bundled Stream Deck profiles when
  the plugin is first installed" [C]. If `DontAutoSwitchWhenInstalled` is false, the app also switches
  to the profile.
- **`AutoInstall:false` (6.6+):** "the user will instead then be prompted to install the bundled
  profile the next time your plugin attempts to switch to it" [C].

  **Recommended:** `AutoInstall:false` and `DontAutoSwitchWhenInstalled:true`. This avoids a wall of
  prompts from a pack that spans many devices.
- **Name clashes.** Installed profiles take the `Name` from inside the `.streamDeckProfile`. On a
  clash, the app adds `" copy 1"` [R]. Duplicates also appear when a plugin re-installs its profiles
  [R-, community].
- **Updates.** Profiles don't update when the plugin updates [C].

### 8.3 `switchToProfile` [C]

The WebSocket reference type, and what `@elgato/streamdeck` 3.0.4 sends:

```json
{"event":"switchToProfile","context":"<pluginUUID from registration>","device":"<device id>","payload":{"profile":"profiles/tabletdeck-xl","page":0}}
```

- **`profile`** "must be identical to the one provided in the manifest". If it's left out, the app
  switches back to the previous profile.
- **`page`** is optional, "indexed from 0", and needs 6.5+. Without it, the page that was visible last
  time is shown. Profile JSON `PageIndex` counts from 1, so don't mix them up.
- **`context`.** The docs describe it as "the context of the command". The SDK fills in
  `connection.registrationParameters.pluginUUID` (`dist/plugin/profiles.js`).
- **Only bundled profiles.** "Plugins may only switch to profiles distributed with the plugin, as
  defined within the manifest, and cannot access user-defined profiles." The plugin can't jump into a
  profile the user imported by double-click. Standalone and plugin scenes are separate copies.
- **7.3.0** fixed switching away from auto-installed plugin profiles [C]. Set `MinimumVersion` to at
  least `"7.3"` if the plugin relies on it.
- **Don't edit `ProfilesV2` / `ProfilesV3` on disk.** The app caches the profiles and rewrites them on
  quit [R-, streamdeck-mcp]. It's unsupported.

---

## 9. Version timeline (what matters for generated profiles)

| App version (date) | Change | Source |
|---|---|---|
| 3.2 (2018) | Hotkey can tell left and right modifiers apart (`0x10000` and the side bits) | [R-] Softpedia changelog excerpt |
| 5.1 | Pages | [C] help |
| 6.0 (Nov 2022) | Stream Deck +; dial Hotkeys; animated WEBP icons | [C] |
| 6.0.3 | Touch-strip background per page and per folder | [C] |
| 6.0.4 | Fixed importing profiles made before 6.x | [C] |
| 6.4 (Oct 2023) | Marketplace profile flow (help article: "Stream Deck 6.4 or newer") | [C] |
| 6.5 (Dec 2023) | Choose the device on import; Folder Auto Exit; `switchToProfile` `page` | [C] |
| 6.6 (Apr 2024) | `Profiles[].AutoInstall`; page backgrounds (key area); pinned actions; default profiles | [C] |
| 6.7 (Jul 2024) | Page names and icons on every device | [C] |
| 6.8 (Nov 2024) | Action Trigger; action export (`.streamDeckAction`) | [C] |
| 6.9 (6 May 2025) | Missing-plugin prompt "only… for profiles created with Stream Deck 6.9 or later"; v2 exports gain `Plugin` blocks | [C] / [R] |
| 7.0 (12 Aug 2025) | Virtual Stream Deck; Key Logic; hotkey presets; import pre-selects the device; required plugins on import; v3 probably starts here | [C] / [I-strong] |
| 7.1 (3 Dec 2025) | Embedded resources in exported profiles | [C] |
| 7.3.0 (3 Mar 2026) | + XL; fixed switching away from auto-installed plugin profiles | [C] |
| 7.3.1 / 7.4.0 / 7.5.1 | v3 exports seen | [R] |
| 7.4 (1 Apr 2026) | Fixed Switch Profile references inside Multi Actions being lost on import | [C] |
| 7.4.2 (18 May 2026) | Fixed Right-Alt recorded as Ctrl+Alt on UK layout | [C] |
| 7.5.0 (30 Jun 2026) | Clear message when a required plugin version isn't on Marketplace | [C] |
| 7.6 (22 Sep 2026) | Neo Infobar actions (SDK 3.0) | [C] |
| **7.6.1 (3 Nov 2026)** | (Windows) "Reworked hotkey handling so hotkeys work again in applications running with administrator privileges, including many fullscreen games" | [C] |

| | v1 (`"1.0"`) | v2 (`"2.0"`) | v3 (`"3.0"`) |
|---|---|---|---|
| Zip root | `<UUID>.sdProfile\` (backslash entries) | `<UUID>.sdProfile/` | `package.json` + `Profiles/<UUID>.sdProfile/` |
| Pages | none | `Pages{Current,Default,Pages}`; page folders base32 + `Z` | same; page folders are upper-case UUIDs |
| Device | `DeviceModel`, `DeviceUUID` | `Device{Model,UUID:""}` | `Device{Model,UUID:<guid>}` |
| Action extras | – | ≤6.8: none; 6.9: `Plugin` | `Plugin`, `Resources` |
| Required-plugins prompt | – | 6.9: from `Plugin` blocks [I] | `package.json.RequiredPlugins` |
| On-disk folder | – | `%APPDATA%\Elgato\StreamDeck\ProfilesV2` | `…\ProfilesV3` |

---

## 10. Generator recipe (Node, built-ins only)

For each model, work from its `DeviceType`, model string, keypad columns × rows and dial count.

1. **IDs.**
   - `profileUuid` is an upper-case UUID used for the folder name.
   - Each content page, the Default page and each folder page gets a lower-case UUID.
   - Derive them from a hash so rebuilds are reproducible. Any UUID-shaped string works.
2. **Top-level manifest (v2).** Leave out `AppIdentifier`.

   ```json
   {"Device":{"Model":"<M>","UUID":""},"Name":"Tablet Deck — Stream Deck XL","Pages":{"Current":"<p1>","Default":"<def>","Pages":["<p1>","<p2>"]},"Version":"2.0"}
   ```
3. **Page manifests.** Write every controller the model has.
   - `{"Controllers":[{"Actions":{…},"Type":"Keypad"}],"Icon":"","Name":"COMBAT"}`
   - Add `{"Actions":{…},"Background":"Images/<strip>.png","Type":"Encoder"}` for + and + XL.
   - Add `{"Actions":{},"Type":"Neo"}` for Neo.
   - The Default page has the same controllers with empty `Actions` (and `"Icon":""`, `"Name":""`).
4. **Key actions.**
   - Use the built-in Hotkey from 6.1 (`hotkeySlot()` plus three `EMPTY` slots).
   - Add the v3-style `Plugin` block. Leave out `Resources` in v2.
   - Each image goes in that page's `Images/` with an app-style name.
   - Navigation keys follow section 7.
5. **Dial actions** (+ / + XL).
   - The Hotkey sits on the `Encoder` controller at `"<dial>,0"`, with
     `Hotkeys = [ccw, cw, press, EMPTY]`.
   - Add `Encoder:{"Icon":"Images/<48x48>.png"}` and/or
     `{"background":"Images/<200x100>.png"}`. `IconVisible:false` hides the icon.
   - The dial's title goes in `States[0].Title`.
6. **Zip.** Write directory entries and files, deflate them, and set the UTF-8 flag. Folder names come
   from `v2FolderId()`.
7. **Optional v3 variant** (only if 7.x testing shows a reason):
   - Add a root `package.json` with `FormatVersion 1`, `DeviceModel`, `OSType "Windows"` and
     `RequiredPlugins` = the distinct `Plugin.UUID`s. Whether `AppVersion` and `OSVersion` are checked
     is unknown.
   - Prefix every path with `Profiles/`.
   - Name page folders with upper-case UUIDs, set `Current` to all zeros, and add `"Resources":null`.
8. **Plugin bundle.**
   - Copy the per-model files to `<plugin>.sdPlugin/profiles/…` and list them in `Profiles[]`, one per
     `DeviceType`.
   - Our own actions in those profiles use `UUID` = our action UUID and
     `Plugin = {Name, UUID: <our plugin UUID>, Version}`.
   - Dial actions declare `Controllers` including `"Encoder"`.
   - **Standalone packs contain only built-in actions.** A user without our plugin would otherwise get
     a missing-plugin prompt, and the plugin isn't on Marketplace.

Privacy (AGENTS.md): never copy fields from a real export into generated files. Exports can carry:

- `AppIdentifier` paths that include user names
- device serials in `.bak` files and in on-disk `Device.UUID`
- export-machine `OSVersion` values

---

## 11. Open questions (need Windows hardware with Stream Deck 6.x and 7.6.1)

1. Does a script-made **v2** file import by double-click on current 7.x (7.6.1) and on late 6.x?
   Nobody has shown either first-hand.
2. Does a **v3** file import on 6.x?
3. What happens on a **model mismatch** (e.g. `20GAA9901` on an MK.2, Scissor Keys or Module 15, and
   bundled `DeviceType` 0 on those devices)? Does a larger profile get cropped on a smaller deck?
4. Do **left and right modifier bits** really press the right-hand key (`0x10202`, `0x10404`)? Do
   numpad `0x4000` keys reach Star Citizen as numpad keys?
5. Does an **animated GIF or WEBP** referenced from `States[].Image` animate after import?
6. Do **arbitrary image file names** (non-base32) survive import?
7. **Key-area page background** (6.6): what is its JSON field? (Not seen in any real file.)
8. Is the + XL controller `Background` 1200×100? What are the dial positions `"4,0"` and `"5,0"`? What
   are the model strings for + XL, Virtual Stream Deck, Galleon, Scissor Keys and Pedal?
9. Does the app add Next/Previous Page keys to imported multi-page profiles?
10. What JSON does the Hotkey Switch use? Does Switch Profile's `PageIndex` count from 1?
11. What do `Coalesce`, `0x20000` and `0x40000000` mean?
12. With many `Profiles[]` entries and `AutoInstall:false`: what does the prompt look like, can one
    `Name` serve several `DeviceType`s, and do re-installs make `" copy"` duplicates?
13. Does a profile without `Pages.Default` still import on 7.x? (Old DCS files lack it.)
14. **Modifier-only binds** (e.g. a bind that is just Right Alt): no real example exists, so their
    encoding is unknown.

---

## 12. Verification scripts and data (this check)

- **Folder:** `verify-profiles/` next to this file.
  - `dl/` holds fresh clones and the extracted profiles.
  - `dl/web/` holds the fetched docs, the help-center JSON (`z*.json`, `rn/*.json`, `rn-all.txt`), the
    live schema, the Qt and Microsoft pages, and the help screenshots
    (`img/29775699809041` = Action Trigger, `img/hk3-last.png` = dial Hotkey Property Inspector).
- **Scripts** (Node, built-ins only), in `verify-profiles/scripts/`:

  | Script | What it does |
  |---|---|
  | `check-lo.js` | Folder IDs and controllers |
  | `zipcd.js` | Zip central-directory flags |
  | `walk.js` | Shared walker |
  | `goto.js` | `PageIndex` checks |
  | `hotkeys.js` | Hotkey slot table |
  | `folders.js` | `openchild` / `backtoparent` |
  | `pluginblocks.js` | `Plugin` / `Resources` counts |
  | `catalog.js` | Format version per file |
  | `pngsize.js` | Image sizes |
  | `zd.js` | Zendesk article to text |
  | `h2t.js` | HTML to text |
