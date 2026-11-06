# Stream Deck built-in actions in profile manifests: navigation, system, dials, images

Researched 2026-11-06. Scope: how the Stream Deck app (6.x and 7.x, current 7.6.1) stores its own
built-in actions inside a profile's page manifests, with the exact UUIDs and `Settings` JSON taken from
real exported profiles. Profile container format (zip layout, `package.json`, `Device.Model`) belongs to
`profiles.md` / `devices.md`; it is repeated here only where navigation depends on it.

Confidence tags:

- **[C] confirmed**: Elgato primary source, or seen in several real app-written exports and consistent.
- **[R] real-file evidence**: seen in at least one real export written by the Stream Deck app, not documented by Elgato.
- **[I] inference**: reasoned from evidence, not observed directly.
- **[?] unconfirmed**: could not be verified; needs a test on real hardware.

JSON below is copied from the files (re-indented only). The app writes object keys in alphabetical
order (`ActionID`, `AutoExit`, `Encoder`, `LinkedTitle`, `Name`, `Plugin`, `Resources`, `Settings`,
`State`, `States`, `UUID`) [R]. The generator should do the same, though nothing suggests it is required.

---

## 0. Short version for the generator

| Need | Action UUID | Settings | Conf. |
|---|---|---|---|
| Open a folder | `com.elgato.streamdeck.profile.openchild` | `{"ProfileUUID": "<child page uuid, lowercase>"}` | C/R |
| Back out of a folder | `com.elgato.streamdeck.profile.backtoparent` | `{}` (v3; `null` in old v2 files) | R |
| Next page | `com.elgato.streamdeck.page.next` | `{}` | R |
| Previous page | `com.elgato.streamdeck.page.previous` | `{}` | R |
| Go to page N | `com.elgato.streamdeck.page.goto` | `{"PageIndex": N}`, **1-based** (1 = first entry of `Pages.Pages`) | R (strong) |
| Page number on a key | `com.elgato.streamdeck.page.indicator` | `{}` | R |
| Page indicator on the Neo Infobar | `com.elgato.streamdeck.system.pagination` | `{}` (in the `Neo` controller) | R (one source) |
| Switch to another profile | `com.elgato.streamdeck.profile.rotate` | `{"DeviceUUID": "", "PageIndex": 1, "ProfileUUID": "<target .sdProfile uuid, lowercase>"}` | R |
| Hotkey | `com.elgato.streamdeck.system.hotkey` | `{"Coalesce": true, "Hotkeys": [4 entries]}` on 7.x | R |
| Hotkey Switch (2 states) | `com.elgato.streamdeck.system.hotkeyswitch` | same `Hotkeys` shape; slot 0 = state 1, slot 1 = state 2 | R |
| Media key | `com.elgato.streamdeck.system.multimedia` | `{"actionIdx": n}`: 0 prev, 1 play/pause, 2 next, 3 stop, 4 mute, 5 vol+, 6 vol-; 18 = "System Volume" dial | C (order) + R |
| Website | `com.elgato.streamdeck.system.website` | `{"openInBrowser": true, "path": "<url>"}`; `false` = background GET | R + C |
| Open file/app | `com.elgato.streamdeck.system.open` | `{"path": "\"C:\\...\\app.exe\""}` (path wrapped in quotes) | R |
| Page navigation on a dial | `com.elgato.streamdeck.keys.adaptor` ("Action Trigger") | `{}` plus top-level `"Actions": [left, press, right]` | R |

Structural facts that matter most:

1. **Folders are extra page directories inside the same `.sdProfile`**, named by the child's UUID, and
   **not** listed in `Pages.Pages`. The folder key's `Settings.ProfileUUID` is that page UUID. No nested
   `.sdProfile` in current formats. Folders nest without limit. [C/R]
2. **Pages are ordered by `Pages.Pages`**, max **10 per profile** [C]. `Go to Page` and `Switch Profile`
   use a 1-based `PageIndex` [R]. The SDK's `switchToProfile(..., page)` is **0-based** [C]. Do not mix them up.
3. **Switch Profile identifies the target by its `.sdProfile` UUID.** Whether that UUID survives when the
   user imports profiles one by one on another PC is **not documented** [?]. See §5 for evidence, a test
   plan and the fallbacks.
4. **Stream Deck + pages carry a second controller `{"Type": "Encoder"}`** with dial slots `"0,0"`…`"3,0"`,
   and an optional controller-level `"Background"` (touch strip, 800×100 PNG). [R]
5. Key images are files in the page's `Images/` folder, referenced as `"Image": "Images/<name>.png"`
   in `States[i]`. PNG 144×144 in every 7.x export; arbitrary file names work. [R]

---

## 1. Where navigation lives in a profile (v3 and v2)

### 1.1 Version 3.0 (Stream Deck 6.x late / 7.x exports, `ProfilesV3` on disk) [R]

Real export, Stream Deck 7.2.1 on Windows, Elgato's own "Default Profile" on a Stream Deck +
(`andresharpe/dotbot-aether-console`, `docs/exported-profile/extracted/`, committed 2026-03-16,
https://github.com/andresharpe/dotbot-aether-console/tree/main/docs/exported-profile):

```
package.json
Profiles/145F4E4C-0D9B-410F-91B0-144E702F3B37.sdProfile/manifest.json      <- profile manifest
Profiles/145F4E4C-...sdProfile/Profiles/43FD45D1-36CB-4F4D-AC2D-06E1DFF4FB08/manifest.json  <- page 1
Profiles/145F4E4C-...sdProfile/Profiles/5EB3B727-8B84-40B8-9AF5-0C2522D64AAA/manifest.json  <- page 2
Profiles/145F4E4C-...sdProfile/Profiles/81C2A4D1-C2B0-4893-A9E0-EF70DA059513/manifest.json  <- "Default" page (empty)
Profiles/145F4E4C-...sdProfile/Profiles/B3155C01-9BD7-42FC-9676-05D857C43F99/manifest.json  <- folder "Apps"
Profiles/145F4E4C-...sdProfile/Profiles/C00978F1-.../manifest.json   <- folder "Links"
Profiles/145F4E4C-...sdProfile/Profiles/1CDC9806-.../manifest.json   <- folder "Emojis"
Profiles/145F4E4C-...sdProfile/Profiles/7CA29515-.../manifest.json   <- folder "Tutorials" (contains a sub-folder)
Profiles/145F4E4C-...sdProfile/Profiles/69CFCFA4-.../manifest.json   <- sub-folder "Advanced"
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

Rules seen in every v3 file (about 20 real v3 profiles from 7.2.1, 7.3.1, 7.4.0, 7.4.2, 7.5.1, 7.6.0):

- Page directory name = page UUID in **upper case**; UUIDs inside JSON are **lower case**. [R]
- `Pages.Pages` = the normal pages, in order. This order is what `PageIndex` counts. [R]
- `Pages.Default` = an extra page that is **never** in `Pages.Pages` and is **empty in every real export**
  (`{"Controllers":[{"Actions":null,"Type":"Keypad"}],"Icon":"","Name":""}` or with empty `Encoder`/`Neo`
  controllers too). [R] Its purpose is not documented. Stream Deck 6.6 added a per-profile "pinned page"
  ("Select your profile's pinned page to start adding actions", 6.6 release notes), and the only
  non-empty Default pages seen are in hand-edited files (a Neo profile whose Default page holds an Infobar
  clock; a Stream Deck + dotfiles profile), so it is probably the pinned layer whose actions show on every
  page where that key is empty. [I] Generate it empty.
- `Pages.Current` is `"00000000-0000-0000-0000-000000000000"` in exports; live `ProfilesV3` folders hold a
  real page UUID. Either imports. [R]
- Folder pages are sibling directories, not listed anywhere except in the folder key. [R]
- Page manifest = `{"Controllers": [...], "Icon": "", "Name": "<page name>"}`. 7.x lets the user name pages;
  `Name` holds it (e.g. `"Director"`, `"OBS"`, `"LIGHTS"` in the SD 7.6 export below). [R]
- `"Plugin": {"Name", "UUID", "Version"}` and `"Resources": null` appear on actions written by 7.x;
  older actions in the same files lack `Plugin`, so it is optional on import. [R]

### 1.2 Version 2.0 (Stream Deck 5.x/6.x exports, `ProfilesV2`) [R]

Same model (`Pages.Current/Default/Pages`, folder pages as unlisted siblings) but page directories have
opaque 27-character names. They are **derived from the page UUID**: base32hex of the 128-bit UUID (26
digits), then `U`→`V` and `V`→`W`, plus a literal `Z`. Verified on every page and folder directory of
`danexrc/Streamdeck-Profiles` (8 exports) and `illixion/StreamDeck-Animated-Screensaver`; the formula was
published by `data-enabler/streamdeck-profile-generator` (`lib/ids.js`,
https://github.com/data-enabler/streamdeck-profile-generator/blob/main/lib/ids.js). Node version, tested:

```js
function v2PageDir(uuid) {
  const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
  let v = BigInt('0x' + uuid.replace(/-/g, '')) << 2n; // 130 bits = 26 x 5
  let out = '';
  for (let i = 0; i < 26; i++) { out = digits[Number(v & 31n)] + out; v >>= 5n; }
  return out.replace(/V/g, 'W').replace(/U/g, 'V') + 'Z';
}
// v2PageDir('3ab260f7-656a-41a4-ae87-d8af1ccee21a') === '7AP61TR5D90Q9BK7R2NHPJN238Z'
// v2PageDir('67c80257-1ea5-49f5-aa0d-629afd3fd9a4') === 'CW404LOVKL4WBAGDCADFQFVPKGZ'  (a folder page)
```

Image file names in exports use the same 27-character style, but they are random: `Images/GEN_simdeck.png`
and `Images/segment_0_0.webp` work too (generated profiles in use). [R]

### 1.3 Old v1 format (Stream Deck 4.x) - only for reading old files

Actions sit directly in the `.sdProfile/manifest.json` under `"Actions"` keyed `"col,row"`, folders are
nested `Profiles/<UUID>.sdProfile/` directories, Multi Action steps are in `Settings.Routine`
(`jameswhite/streamdeck-config`, 2021; `Rukshin/dotfiles` ProfilesV2 on macOS). Do not generate this.

---

## 2. Folders ("Create Folder")

### 2.1 Folder key [R, 4 sources]

Stream Deck 7.2.1 export (Elgato Default Profile, Stream Deck +), page `43FD45D1…`, key `0,0`:

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

`ProfileUUID` = UUID of the child page directory `B3155C01-9BD7-42FC-9676-05D857C43F99` in the same
`.sdProfile`. The name `ProfileUUID` is historical (in v1 a folder was a nested profile). `Name` is
localised (`"Ordner erstellen"` in German exports) and carries no meaning. [R]

v2 export (Stream Deck 6.x, `danexrc/Streamdeck-Profiles`, "Affinity Designer (32 Key)", 2024,
https://github.com/danexrc/Streamdeck-Profiles):

```json
{"ActionID": "105394fc-4ed0-463e-900a-4786f92e322f", "LinkedTitle": false, "Name": "Create Folder",
 "Settings": {"ProfileUUID": "67c80257-1ea5-49f5-aa0d-629afd3fd9a4"}, "State": 0,
 "States": [{"FontFamily": "", "FontSize": 7, "FontStyle": "", "FontUnderline": false,
             "Image": "Images/5HK7H6LO9L7N5FEQ9NRTTJOPDKZ.png", "OutlineThickness": 2, "ShowTitle": true,
             "Title": "More\nAdjustments", "TitleAlignment": "bottom", "TitleColor": "#ffffff"}],
 "UUID": "com.elgato.streamdeck.profile.openchild"}
```

→ child directory `Profiles/CW404LOVKL4WBAGDCADFQFVPKGZ/` (= `v2PageDir("67c80257-…")`).

### 2.2 Back key ("Parent Folder") [R, 6 sources]

The app puts it at `"0,0"` of every folder page. v3 (7.2.1):

```json
{"ActionID": "c083f4f5-3fee-4bd6-aa22-7b57cfe56b84", "LinkedTitle": true, "Name": "Parent Folder",
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.profile.backtoparent"}
```

v3 (7.4.x, `WeisAir/weisair`, with the Auto Folder Exit settings and a Plugin block; path
`devices/streamdeck/profiles/Profiles/2B9F5A6E-D1FB-4181-9615-01DE7114734D.sdProfile/Profiles/06D979E5-D883-465D-B782-5EA8BE14BBAF/manifest.json`,
https://github.com/WeisAir/weisair):

```json
{"ActionID": "bb4a415e-c55f-41ce-8205-a79d1bb5fef8", "AutoExit": {"Delay": 3, "Enabled": false},
 "LinkedTitle": true, "Name": "Übergeordnete Ordner", "Resources": null, "Settings": {}, "State": 0,
 "States": [{}], "UUID": "com.elgato.streamdeck.profile.backtoparent"}
```

```json
{"ActionID": "7bffe98f-f95e-47e1-a951-f8c9d75e2418", "LinkedTitle": true, "Name": "Parent Folder",
 "Plugin": {"Name": "Open Parent Folder", "UUID": "com.elgato.streamdeck.profile.backtoparent", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.profile.backtoparent"}
```

v2 (6.x): `"Name": "Open Folder", "Settings": null` with a normal title-style `States[0]`. [R]

Behaviour (Elgato help "Using Folders", updated 2026-11-02,
https://help.elgato.com/hc/en-us/articles/360027957912): "You can create unlimited subfolders within
folders"; "press and hold the return key to return to the top level". [C] So a tap goes up one level, a
hold goes to the top. A folder page has no pages of its own (one layout per folder) [I: no folder in any
export has a page list; 6.6 added "copy and paste your folder as a new page" to convert between the two [C]].

Auto Folder Exit (help article 22589649057933, "Stream Deck 6.5 or later" [C]): leave the folder 0–60 s
after an action runs. The folder-wide setting is the back key's `"AutoExit": {"Delay": n, "Enabled": bool}`;
individual actions can carry their own `AutoExit` object to override it ("Follow folder settings") [R].
Default exported value `{"Delay": 3, "Enabled": false}`. Useful for a "theme picker" or "emote" folder that
should pop back after one press.

Nesting example (7.2.1): folder page `7CA29515…` holds an `openchild` key with
`"ProfileUUID": "69cfcfa4-5ad9-4b47-a8c4-4de2fc8304b7"`; that sub-folder page has its own back key at `0,0`. [R]

On Stream Deck +, every folder page also has an `Encoder` controller (empty or with its own dials), so a
folder can re-map the dials. [R]

---

## 3. Pages: Next, Previous, Go to Page, Page Indicator

Elgato help "Pages" (updated 2026-10-27, https://help.elgato.com/hc/en-us/articles/4410312027277) [C]:
"You can create up to 10 pages per Profile." Pages arrived in Stream Deck 5.1 with "Next/Previous Page",
"Go To Page: go to a specific page number" and "Page Indicator: displays the current page number"
(5.1 release notes). When the user adds pages in the app it auto-places Next/Previous keys; a generated
profile can put them anywhere or leave them out [R: many exports move or delete them].

### 3.1 Next / Previous [R]

7.x form (`Benge21/steam-link`, `zalewskigrzegorz/dotfiles`, the 7.2.1 default profile):

```json
{"ActionID": "edd6e7d9-ccee-4abc-bffa-f98f33193b4c", "LinkedTitle": true, "Name": "Previous Page",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.page.previous"}
```

Next Page is identical with `"Name": "Next Page"` and `"UUID": "com.elgato.streamdeck.page.next"`.
v2 form (danexrc): same without `Plugin`/`Resources`. An empty `States: [{}]` shows Elgato's built-in
arrow icon. Wrap-around at the last page is [?] (the help article says the last page normally has only
Previous Page).

### 3.2 Go to Page [R, strong]

Stream Deck 7.6.0 export (newest seen; `simracecenter/streamdeck`, `profiles/sim-racecenter/`,
committed 2026-11-01, https://github.com/simracecenter/streamdeck):

```json
{"ActionID": "bd8e9f2d-a91b-493b-b9c8-54cec026cf79", "LinkedTitle": true, "Name": "Go to Page",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {"PageIndex": 2}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.page.goto"}
```

**`PageIndex` is 1-based, counting `Pages.Pages`:**

- That profile has 4 pages (`"Pages": ["184291b9…" (Director), "ecdc4c75…" (OBS), "1e064052…" (Services),
  "6a0efcbc…" (LIGHTS)]`) and its tab bar keys use `PageIndex` 1, 2, 3, 4.
- `WeisAir` "WeisAirMainPanel" (7.4.2): `Pages = [ce9c8c03 (aircraft picker), 1a24a5f2 (control area)]`;
  the "Control Area" key on the first page has `{"PageIndex": 2}`, and the first page is reached with `{"PageIndex": 1}`.
- Across ~400 real Go to Page keys, values are 1–7 and once 10; **never 0**.
- Third-party readers implement it as `PageIndex - 1` (`adblocker-1/FreeStream`, `freestream/actions.py`).

Use a localised name freely; `"Name": "Gehe zu Seite"` imports fine. [R]

### 3.3 Page Indicator [R]

```json
{"ActionID": "e7221c62-8c6e-4b82-88a3-d50b46aed21b", "LinkedTitle": true, "Name": "Page Indicator",
 "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.page.indicator"}
```

"This action will show the current Page number on a key. The action has no other function when pressed."
[C, help "Pages"]. It accepts a custom title and image (`"Title": "Player"` with an `Image`, phew-blue
7.4.0 export) [R]; whether the number still draws over a custom image is [?].

### 3.4 Device-specific paging

- **Stream Deck +**: "Move a finger quickly across the touch strip left or right to change between pages.
  Two or more pages are required for swiping." [C, help "Stream Deck + — Touch Strip", 10567698991629].
  Nothing to store.
- **Stream Deck Neo**: two capacitive touch points either side of the Infobar flip pages ("Tap between
  pages to reveal more actions", 6.6 notes; "2 capacitive touch buttons for paging", SDK devices guide) [C].
  They are not stored in the manifest and cannot be re-assigned [I: no export or doc shows a slot for them].
- **Neo Infobar** (Stream Deck 7.6+ accepts actions there, "Drag an action onto it the way you would onto a
  key", 7.6 notes [C]). In a manifest it is a third controller (one source, a Neo profile physically
  tested by its author, `y5862000/threaddeck-for-codex`) [R]:

```json
{"Actions": {"1,0": {"ActionID": "b78afc19-af9d-4a5f-9b71-585678fdcb1b", "LinkedTitle": true,
   "Name": "Page Indicator",
   "Plugin": {"Name": "Page Indicator", "UUID": "com.elgato.streamdeck.system.pagination", "Version": "1.0"},
   "Resources": null, "Settings": {}, "State": 0, "States": [{}],
   "UUID": "com.elgato.streamdeck.system.pagination"}},
 "Type": "Neo"}
```

  Its Default page holds `com.elgato.streamdeck.system.digitaltime` at `"1,0"` with
  `{"24HourFormat": false, "layout": "digital_time_07", "location": "", "theme": "white"}` (that file was
  edited by hand, upper-case ActionID). Elgato's own Lights Out sample has an empty `{"Actions": {}, "Type": "Neo"}`
  controller on Neo pages (see `devices.md` §5.1). Slot `"1,0"` and these settings are [R, one source].
- **Dial page knob**: a common real pattern is an "Action Trigger" on one dial: turn left = Previous Page,
  press = Page Indicator, turn right = Next Page (§7.4).

---

## 4. Device and page count limits

| Item | Limit | Conf. |
|---|---|---|
| Pages per profile | 10 | C (help "Pages") |
| Folders | unlimited, nestable | C (help "Using Folders") |
| Pages inside a folder | none (a folder is one layout) | I |
| Pinned actions | Stream Deck 6.6+, show "on every page with an empty key" | C (help 26638431612429) |

A 9-activity deck (flight, combat, mining, salvage, hauling, on foot, emotes, comms + a home page) fits in
10 pages; anything more must go into folders.

---

## 5. Switch Profile (`com.elgato.streamdeck.profile.rotate`)

### 5.1 Stored form [R, 5 sources]

7.4.2 export, `WeisAir/weisair`, "WeisAirMainPanel.streamDeckProfile", page `CE9C8C03…`, key `5,1`:

```json
{"ActionID": "…", "LinkedTitle": false, "Name": "Profil wechseln",
 "Plugin": {"Name": "Switch Profile", "UUID": "com.elgato.streamdeck.profile.rotate", "Version": "1.0"},
 "Resources": null,
 "Settings": {"DeviceUUID": "", "PageIndex": 1, "ProfileUUID": "fef111da-9005-4e94-b111-6791870bcf86"},
 "State": 0,
 "States": [{"FontFamily": "", "FontSize": 12, "FontStyle": "", "FontUnderline": false,
             "Image": "Images/GOKBV07HI93HHCHTIDA6OGD1G0Z.png", "OutlineThickness": 2, "ShowTitle": true,
             "Title": "\nBeechcraft\nB58", "TitleAlignment": "top", "TitleColor": "#ffffff"}],
 "UUID": "com.elgato.streamdeck.profile.rotate"}
```

- `ProfileUUID` = the **target profile's `.sdProfile` UUID**, lower case in v3 (upper case in old v2/v1
  files). Here `fef111da-…` is the UUID of the separately exported
  "X-Plane Ops Panel Beechcraft B58 Minimal.streamDeckProfile" (`Profiles/FEF111DA-9005-4E94-B111-6791870BCF86.sdProfile`)
  in the same repo, and that profile's own "back" key targets `022db8e9-…` = the separately exported
  "Standardprofil". So the author runs a launcher profile plus one profile per aircraft, each its own
  `.streamDeckProfile`, cross-linked by Switch Profile. [R] This is exactly the "theme switch" pattern.
- `DeviceUUID` = `""` in every export seen (= the device the key is on). The help article "Switch Profiles
  On One Stream Deck using Another Stream Deck" (updated 2026-11-01) says the key's inspector selects a
  device and a profile [C]; a non-empty value would target another deck. Keep `""`.
- `PageIndex` = page to open in the target. Seen values: `1` (7.x default), `0` (older 6.x exports), absent
  (v1). Assumed 1-based like Go to Page [I]; a value > 1 was not seen in a real export [?].
- `ProfileUUID: ""` (unset) is written by several generators as a placeholder. Two third-party sources say an
  unset target cycles to the next profile (illixion README: "set to switch to the next preset"; FreeStream
  implements `rotate_profile(+1)`) [?]. Do not rely on it.

The 7.4 / 7.4.1 release notes say: "Fixed a bug where nested Switch Profile actions inside a Multi Action
could lose their internal references when imported" [C, https://help.elgato.com/hc/en-us/articles/45347482546193].
So the importer does track Switch Profile references, but the notes don't say how.

### 5.2 Does it work across profiles imported from separate files? [?]

**Not confirmed by any primary source.** What is known:

- The link is a bare UUID. It works when the target `.sdProfile` with that UUID is installed on the device.
- Exports keep the on-disk UUID (`.sdProfile` folder name). The same UUIDs reappear across re-exports
  and across the v2→v3 migration in WeisAir's repo (`7831B093…` in a 6.x v2 export and in a 7.4 v3 export). [R]
- Whether **importing** a `.streamDeckProfile` keeps its `.sdProfile` UUID (and what happens when a profile
  with that UUID already exists, e.g. on re-import of an update) is not documented, and no forum or vendor
  page answers it. Commercial packs (Flight Panels, SideshowFX) only tell users how to set the target in the
  inspector.

Test on a real install before relying on it (one evening's work):

1. Generate two profiles A (UUID a) and B (UUID b) for the same model, with a Switch Profile key in A
   targeting b at `PageIndex` 3 and one in B targeting a.
2. Import B, then A, on a PC that has never seen them. Press the keys. Check
   `%APPDATA%\Elgato\StreamDeck\ProfilesV3\` for folder names a and b.
3. Re-import A (simulates an update): see whether it duplicates, replaces, or gets a new UUID, and whether
   B's key still works.

Fallbacks if UUIDs are not kept:

- **Plugin route (reliable, optional plugin only):** ship the theme profiles inside the plugin
  (`"Profiles"` array in the plugin manifest) and switch with
  `streamDeck.profiles.switchToProfile(deviceId, "<profile name>", page)`. That call uses the **profile name**
  from the manifest and a **0-based** page: "page Optional page to show when switching to the profile,
  indexed from 0" (`@elgato/streamdeck` 3.0.4, `dist/plugin/profiles.d.ts`) [C]. Limits: "Plugins may only
  switch to profiles distributed with the plugin" [C]. See `sdk.md`.
- **Built-in-only route:** keep Switch Profile keys but tell the user to re-pick the target once per key
  (`ProfileUUID: ""` placeholder, as `SantosMaxime/Streamdeck-Steam-Achievements` does), or
- put the vendor themes into **one profile per device** as folders (folder links are internal to the
  `.sdProfile`, so they always survive import). Cost: one theme gets the 10 real pages; other themes live in
  folders, which have no pages of their own.

---

## 6. System actions as stored

### 6.1 Hotkey (cross-check with the keys research) [R]

7.x writes **four** `Hotkeys` entries plus `"Coalesce": true` even on keys (only slot 0 is used on a key);
6.x wrote two (combo + one empty). Empty slot (Windows export):
`{"KeyCmd": false, "KeyCtrl": false, "KeyModifiers": 0, "KeyOption": false, "KeyShift": false, "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1}`
(a macOS export writes `"NativeCode": -1` for the empty slot). Key example (7.2.1, Windows, Ctrl+Z):

```json
{"KeyCmd": false, "KeyCtrl": true, "KeyModifiers": 2, "KeyOption": false, "KeyShift": false,
 "NativeCode": 90, "QTKeyCode": 90, "VKeyCode": 90}
```

Plugin block: `{"Name": "Activate a Key Command", "UUID": "com.elgato.streamdeck.system.hotkey", "Version": "1.0"}`.
On dials the four slots mean something else (§7.3). Profiles are per OS (help "Getting Started" for
profiles: "Profiles are specific to both operating system (macOS, Windows) and Stream Deck device type") [C].

### 6.2 Hotkey Switch [R]

7.4.0 export (`blackcarburning/live_controller`, `MESH LIVE TTDM 2026/`, https://github.com/blackcarburning/live_controller):

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
 "States": [{"Image": "Images/E0A1C8N6553SP0VR3KS6DGJNRKZ.png", "Title": "I LOST\nA FRIEND\nTODAY\n"},
            {"Image": "Images/VSJT5T6LVL1R5BG1DDWWS8T0RKZ.png"}],
 "UUID": "com.elgato.streamdeck.system.hotkeyswitch"}
```

Two `States`, each with its own image; top-level `State` is the current one (0 or 1 seen). Slot 0 is sent in
state 0, slot 1 in state 1 [I: FreeStream catalog; this file uses the same key in both]. "Toggles between two
hotkeys" [C, help "System Actions"]. Note for Tablet Deck: the state flips on every press whatever the game
did, so a Hotkey Switch for e.g. landing gear can show the wrong state; still one press per tap.

### 6.3 Multimedia [C order, R values]

Help "System Actions (Hotkey, Open, Website, Multimedia)" (updated 2026-11-06,
https://help.elgato.com/hc/en-us/articles/360028234471) lists the options in this order: Previous Track,
Play / Pause, Next Track, Stop, Mute, Increase Volume, Decrease Volume. `actionIdx` is that position:

| actionIdx | Function | Evidence |
|---|---|---|
| 0 | Previous Track | help order; Elgato default-profile key order prev/play/next |
| 1 | Play / Pause | help order; `{}` (no actionIdx) on the middle key of a default profile → probably the default |
| 2 | Next Track | help order; dial Action Trigger `[0, 1, 2]` = left/press/right |
| 3 | Stop | `bro69noscope/streamdeck-version-control`: titled "stop any multimedia track" |
| 4 | Mute | `Linedev-Web/OBS` 7.x Default Profile: icon is a crossed speaker |
| 5 | Volume Up | same file: speaker with two waves |
| 6 | Volume Down | same file: speaker with one wave |
| 13 / 14 | Fast forward / Rewind | FreeStream catalog only [?] |
| 18 | "System Volume" (dial: turn = volume) | Elgato 7.2.1 default profile, Stream Deck + dial `1,0`, `"Title": "System Volume"` |

```json
{"ActionID": "d55e52c5-4366-4ebe-ba55-a02c08588104", "LinkedTitle": true, "Name": "Multimedia",
 "Plugin": {"Name": "Multimedia", "UUID": "com.elgato.streamdeck.system.multimedia", "Version": "1.0"},
 "Resources": null, "Settings": {"actionIdx": 4}, "State": 0,
 "States": [{"Image": "Images/PN2J1QQES12PJER48SBA3A6QWKZ.png"}],
 "UUID": "com.elgato.streamdeck.system.multimedia"}
```

(`Linedev-Web/OBS`, `sauvegarde/streamdeck/ProfilesV3/303D8BA9-2D5A-4F21-8098-E973490B406B.sdProfile/Profiles/EB35F0CE-6832-4202-986D-30E831E974EB/manifest.json`,
committed 2026-11-05.) Always write `actionIdx` explicitly. Two community tables on GitHub
(`jefftriplett/dotfiles` docs: "0=mute, 1=play/pause, 3=prev…"; `Graham42/windows-dot-files` ACTIONS.md:
"0 Play/Pause, 1 Stop…") contradict the help order and the icons: ignore them.

### 6.4 Website [R + C]

```json
{"ActionID": "ad702ac5-7b23-4b6a-92cd-3ea17f944073", "LinkedTitle": true, "Name": "Website",
 "Resources": null, "Settings": {"openInBrowser": true, "path": "microsoft-edge:"}, "State": 0,
 "States": [{"Image": "Images/RIM6MMFIWH4GN426EAD0RNIK2SZ.png"}],
 "UUID": "com.elgato.streamdeck.system.website"}
```

- `path`: URL or URI. [R]
- `"openInBrowser": false` = the "GET request in background" option ("can be used to trigger webhook URLs
  such as IFTTT applets", help "System Actions" [C]). Real use: `{"openInBrowser": false, "path": "http://127.0.0.1:21311/jeu/suivant"}`
  in `Linedev-Web/OBS` (a local HTTP control server) [R].
- Optional `"browser": "C:\\Program Files\\Mozilla Firefox\\firefox.exe"` picks a browser (WeisAir). [R]
- 7.0 fixed "the Website action would send a GET request upon entering a URL", 7.6: "The Website action now
  updates its icon whenever the URL changes." [C]

Tablet Deck note: a background GET to the Tablet Deck server is a built-in-only way to reach it, but the URL
would have to carry the pairing code inside the profile (privacy rule: no real codes in files) and any
key-pressing route must keep the `gameFocused()` / `tapButton()` path. Raise with the owner before using.

### 6.5 Open, Open Application, Close [R]

```json
{"path": "\"C:\\Program Files\\W3Booster\\W3Booster.exe\""}
```
`com.elgato.streamdeck.system.open`: `path` is wrapped in literal double quotes (bro69noscope, zalewski on
macOS: `"\"/Users/…/script.sh\""`). Old files also carry `"openInBrowser": true`. Plugin block
`{"Name": "Open", …}`. "Opens an Application, Files, or Folders" [C].

`com.elgato.streamdeck.system.openapp` ("Open Application", 7.x):
```json
{"app_name": "OBS Studio", "args": "", "bring_to_front": true,
 "bundle_id": "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
 "bundle_path": "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
 "exec": "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe", "is_bundle": false,
 "long_press": "quit", "source": "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe"}
```
(7.0 notes: long press can "do nothing, close, or force quit" [C].) Machine-specific paths: only useful for
well-known install paths (e.g. the RSI Launcher); otherwise leave for the user.

`com.elgato.streamdeck.system.close` ("Close"): `{"forceQuit": false, "path": ""}` [R].

### 6.6 Text [R]

`com.elgato.streamdeck.system.text`: `{"isSendingEnter": true, "pastedText": "/h1"}` (128 real keys, always
exactly these two keys). Help mentions a "Text Mode" (typing vs paste) [C]; its key name is not in any export
(FreeStream guesses `isTypingMode`) [?]. Typing into Star Citizen chat by key is a "sequence", so check the
one-press rule before using it on the Comms page.

### 6.7 Multi Action (not used, ground rules) [R]

`com.elgato.streamdeck.multiactions.routine` (Plugin `com.elgato.streamdeck.multiactions`), steps in a
**top-level** `"Actions": [{"Actions": [ …step actions… ]}, …]` array, `Settings: {}`; delays are
`com.elgato.streamdeck.multiactions.delay`. Also `routine2` (Multi Action Switch), `random`. Tablet Deck's
"one press per tap" rule rules these out.

### 6.8 Others seen

| UUID | Settings seen | Source |
|---|---|---|
| `com.elgato.streamdeck.system.timer` | `{"actionIdx": 0, "duration": 1500, "lastUserFile": ""}` | AngelCruzL (Elgato default profile, v2) [R] |
| `com.elgato.streamdeck.system.keybrightness` | `{"actionIdx": 0}` (key: "Brighter"; `1` "Darker"; on a dial: "SD+ Brightness") | AngelCruzL, 7.2.1 default [R]; other indices conflict between sources [?] |
| `com.elgato.streamdeck.system.sleep` | `{}` or `{"DeviceUUID": ""}` | WeisAir, AngelCruzL [R] |
| `com.elgato.streamdeck.system.digitaltime` | see §3.4 | threaddeck [R, one source] |
| `com.elgato.streamdeck.vsdtoggle` | Plugin "Toggle Virtual Stream Deck" | WeisAir [R] |

No built-in clock/timer is needed for the pack. **Volume Controller is no longer built in**: "The Volume
Controller plugin is no longer bundled by default" (7.1 notes, https://help.elgato.com/hc/en-us/articles/41533810232721) [C];
its actions are `com.elgato.volume-controller.output-device-control` / `.input-device-control` (Plugin
version `2.0.1.155`, settings `{"deviceId": "default", "friendlyName": "", "style": "vertical", "volume": "50", "volumeStep": "3"}`,
zalewskigrzegorz/dotfiles) [R]. Discord is a Marketplace plugin, not built in (help 4422740578189: install
"Discord" from the store) [C]; its action UUIDs belong to the comms research.

---

## 7. Stream Deck + / + XL dials and touch strip

### 7.1 Controller layout [R]

A Stream Deck + page always has two controllers, even when empty:

```json
{"Controllers": [
   {"Actions": { "0,0": {…}, "1,1": {…} }, "Type": "Keypad"},
   {"Actions": { "0,0": {…}, "1,0": {…}, "2,0": {…}, "3,0": {…} },
    "Background": "Images/S410LKL5356F3DT8B2HFGNJIACZ.png",
    "Type": "Encoder"}],
 "Icon": "", "Name": ""}
```

- Dial slots are `"<dial>,0"`: `0,0`…`3,0` on Stream Deck + (20GBD9901, also 20GBC9901 in an aputure 7.5.1
  export), `0,0`…`5,0` on + XL (20GBX9901; the aputure + XL export fills only 0–3). [R]
- Controller-level `"Background"` = the whole touch strip image, **800×100 PNG** in the export; Elgato:
  "The resolution of the touch strip is 800 x 100 pixels" [C]. The strip has three layers: dial icon, dial
  background, touch strip background [C, help 10567698991629].

### 7.2 Per-dial `Encoder` object [R, 7.2.1 Elgato default profile]

```json
"Encoder": {"Icon": "Images/QP3VH6G0A17RPD625MJPKB5C50Z.png"}
```
```json
"Encoder": {"IconVisible": false, "background": "Images/32S7LPEQ2D3NF7CP6K2A92LW4SZ.png"}
```

`Icon` (48×48 PNG in that export; plugin docs ask 72/144 for the same slot), `IconVisible`, `background`
(200×100 PNG = one dial's strip segment, lower-case `b`). Plugin actions can also carry `"layout": "$A0"`.
The title shown on the strip is `States[0].Title`.

### 7.3 Hotkey on a dial [R, 2 sources]

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

Slot order **[turn left / counter-clockwise, turn right / clockwise, press, touch]**: Undo = Ctrl+Z in slot 0
and Redo = Ctrl+Shift+Z in slot 1 (Elgato's own default profile); another default-profile dial has Up in 0
and Down in 1; a macOS user dial has Left arrow / Right arrow / "1" in slots 0/1/2 (zalewski). FreeStream's
catalog names them "Rotate left, Rotate right, Press, Touch". [R] One detent = one press, so a dial is a
natural fit for SC's stepwise binds (power triangle, zoom, scanner range) within the one-press rule.

### 7.4 Action Trigger (`com.elgato.streamdeck.keys.adaptor`) [R, 3 sources]

Built-in "Keys" plugin; three child actions in a top-level `Actions` array = **[turn left, press, turn right]**.
Real 7.x user profile (`zalewskigrzegorz/dotfiles`, `dot_config/streamdeck/1.Main.sdProfile/Profiles/F16C597E-D683-4F80-A64A-1D1F96828615/manifest.json`,
dial `3,0`), repeated on every page:

```json
{"ActionID": "ae0f99e4-bef0-44bd-acc3-2349842bd1f8",
 "Actions": [
   {"ActionID": "edd6e7d9-ccee-4abc-bffa-f98f33193b4c", "LinkedTitle": true, "Name": "Previous Page",
    "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"}, "Resources": null,
    "Settings": {}, "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.page.previous"},
   {"ActionID": "e7221c62-8c6e-4b82-88a3-d50b46aed21b", "LinkedTitle": true, "Name": "Page Indicator",
    "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"}, "Resources": null,
    "Settings": {}, "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.page.indicator"},
   {"ActionID": "93805f91-180a-473b-b163-79d76bda5e94", "LinkedTitle": true, "Name": "Next Page",
    "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"}, "Resources": null,
    "Settings": {}, "State": 0, "States": [{}], "UUID": "com.elgato.streamdeck.page.next"}],
 "LinkedTitle": true, "Name": "Action Trigger",
 "Plugin": {"Name": "Keys", "UUID": "com.elgato.streamdeck.keys", "Version": "1.0"},
 "Resources": null, "Settings": {}, "State": 0, "States": [{}],
 "UUID": "com.elgato.streamdeck.keys.adaptor"}
```

A Linux re-implementation's test fixture (`JackSkellet/deckforge`, `streamdeck-linux/src/action_trigger.rs`)
has the same shape with `[Previous Page, Go to Page {"PageIndex":1}, Next Page]` and
`[Multimedia 0, Multimedia 1, Multimedia 2]` (= prev track / play-pause / next track).

### 7.5 Dial Stack (`com.elgato.streamdeck.dial.stack`) [R, one v2 source]

`DKlaper/ga-msfs2024-stream-deck-plus` (v2): `"Settings": {"CurrentIdx": 0, "FastNavigation": false, "ShowStackIcon": true}`,
`"Name": "Dial Stack"`, children in a top-level `"Actions": [ … ]` list. Lets one dial cycle through several
dial actions by pressing; useful for a "mode" dial, but the cycling happens in the Stream Deck app only.

### 7.6 Other built-in dial actions

Multimedia `actionIdx` 18 ("System Volume"), Brightness `actionIdx` 0 ("SD+ Brightness") [R, §6.3/6.8].
`com.elgato.streamdeck.system.mouse-wheel` (settings `{"horizontal": false, "invert": false}`) appears only
in FreeStream's catalog [?].

---

## 8. Key images inside a profile

| Fact | Conf. | Source |
|---|---|---|
| Per-state image = `States[i].Image`, path relative to the **page** directory: `"Images/<file>.<ext>"`; file in `<page>/Images/` | R | every export |
| 7.x exports: all key images **PNG 144×144 RGBA** (8,427 PNG files across the exports read; no other type) | R | all v3 exports |
| Accepted when the user sets an icon: "PNG, JPEG, GIF, BMP, WEBP, Animated WEBP"; "minimum resolution of 72 x 72 pixels (1:1 ratio)"; larger images are resized | C | help "Customizing Key Icons" 360028237271, updated 2026-11-05 |
| Animated: "Action icons now support animated webp images alongside GIFs" (6.0) | C | 6.0 release notes |
| A generated profile with **animated WebP 144 px** key images (`"Image": "Images/segment_0_0.webp"`) imports and plays; its author says the app converts GIF to WebP itself | R | illixion/StreamDeck-Animated-Screensaver (2025-11) |
| SVG in a profile `Images/` folder renders | ? | only a generated profile claims it (opendeck-factory); plugin manifests accept SVG, which is a different path. Use PNG. |
| File names are free (`GEN_simdeck.png`, `segment_0_0.webp`) | R | chaseplane testbed, illixion |
| Dial icon 48×48 (export) / 72–144 (SDK); dial background 200×100; touch strip 800×100 | R/C | §7 |
| Page wallpaper (6.6+, "a custom background image that covers every key"): Keypad controller `"Background": "Images/SHPVCE17W54MJ25PSGAKC3V3RSZ.png"`, a **1024×600** PNG on an XL | R (one source) / C (feature) | WeisAir backup (v2); 6.6 notes |
| Neo Infobar art is drawn by actions/layouts (232×50); "background library now includes backgrounds sized for the Stream Deck Neo Infobar" (7.6) | C | 7.6 notes, SDK Neo guide |

Two states (Hotkey Switch, plugin toggles) = two entries in `States`, each with its own `Image`. Title fields
(`FontFamily`, `FontSize`, `FontStyle`, `FontUnderline`, `OutlineThickness`, `ShowTitle`, `Title`,
`TitleAlignment` `top|middle|bottom`, `TitleColor` `#rrggbb`) sit next to `Image`; `ShowTitle: false` hides
the title when the art already carries the label.

---

## 9. Real exported profiles used (with folders and page switching)

| # | Repo / file | App / format | Device | What it shows |
|---|---|---|---|---|
| 1 | andresharpe/dotbot-aether-console `docs/exported-profile/` ("Default Profile.streamDeckProfile" + extracted) | 7.2.1, v3, Windows | Stream Deck + | 4 folders + nested folder, back keys, Encoder controller, touch strip and dial backgrounds, dial Hotkey, Multimedia 18, Brightness |
| 2 | WeisAir/weisair `devices/streamdeck/profiles/` (35 exports + 2 backups) | 6.x v2 and 7.3.1–7.4.2 v3, Windows | XL | dozens of folders with back keys and AutoExit, Go to Page 1/2/7, **Switch Profile between separately exported profiles** with `PageIndex` |
| 3 | simracecenter/streamdeck `profiles/sim-racecenter/` | 7.6.0, v3, Windows | 15-key | 4 named pages, Go to Page 1–4 tab bar |
| 4 | danexrc/Streamdeck-Profiles (8 exports) | 6.x, v2 | 15-key layouts | folders + back key, Next/Previous Page, Text, Open; v2 directory encoding verified |
| 5 | Linedev-Web/OBS `sauvegarde/streamdeck/ProfilesV3/` | 7.x live folder | 15-key | folders, Multimedia 4/5/6 with Elgato icons, Website background GET, Open Application |
| 6 | blackcarburning/live_controller `MESH LIVE TTDM 2026/` | 7.4.0, v3 | XL (20GAT9902) | Hotkey Switch (34), Close, pages |
| 7 | zalewskigrzegorz/dotfiles `dot_config/streamdeck/1.Main.sdProfile/` | 7.x live folder | Stream Deck + | Action Trigger page knob on every page, Volume Controller dials |
| 8 | DKlaper/ga-msfs2024-stream-deck-plus | v2 | Stream Deck + | Dial Stack, Go to Page "HOME" keys |
| 9 | y5862000/threaddeck-for-codex `profiles/source/unpacked/` | v3 (partly hand-made) | Neo | `Neo` controller, `system.pagination`, `digitaltime` |

Generated (not app-written) profiles that import fine and are useful as proof that hand-written JSON works:
illixion/StreamDeck-Animated-Screensaver (v2, Switch Profile + animated WebP), data-enabler/streamdeck-profile-generator
(v2, folders), WX4JCW/chaseplane-streamdeck `tools/testbed.cjs` (writes Switch Profile keys into ProfilesV3).

Sources to **avoid**: `thisis-romar/opendeck-factory` `docs/obsidian-vault/File Format/Action Types.md`
claims UUIDs such as `com.elgato.streamdeck.system.webpage`, `…system.mediaplayback`,
`…profiles.nextpage`, and Go to Page `{"page": 0}`; none of them appear in any real export. The same
repo's reference-profile table (multimedia 0–6, brightness, page actions) is closer to reality. The
verygoodplugins/streamdeck-mcp model-name table is partly wrong (see `devices.md`).

---

## 10. Open questions (test on hardware before release)

1. Switch Profile across separately imported `.streamDeckProfile` files: is the `.sdProfile` UUID kept on
   import, and on re-import? (§5.2 test plan.) Highest risk for the "same page in another theme" folder.
2. Switch Profile `PageIndex` > 1: confirm it opens that page (1-based assumed).
3. Does Next Page wrap from the last page to the first?
4. `Pages.Default`: confirm it is the pinned page (put one action on it, import, see if it shows on every page).
5. Neo Infobar slot `"1,0"` and `system.pagination` on an app-written Neo export.
6. SVG images inside profile `Images/` (use PNG until checked).
7. Multimedia `actionIdx` values for fast forward / rewind, and what pressing the "System Volume" dial does.

## 11. Sources

Elgato (primary):
- Pages: https://help.elgato.com/hc/en-us/articles/4410312027277 (API: https://help.elgato.com/api/v2/help_center/en-us/articles/4410312027277.json)
- Using Folders: https://help.elgato.com/hc/en-us/articles/360027957912
- Auto Folder Exit: https://help.elgato.com/hc/en-us/articles/22589649057933
- Pinned Actions and Folders: https://help.elgato.com/hc/en-us/articles/26638431612429
- System Actions (Hotkey, Open, Website, Multimedia): https://help.elgato.com/hc/en-us/articles/360028234471
- Switch Profiles on another Stream Deck: https://help.elgato.com/hc/en-us/articles/360059908112
- Stream Deck + Touch Strip: https://help.elgato.com/hc/en-us/articles/10567698991629
- Customizing Key Icons: https://help.elgato.com/hc/en-us/articles/360028237271
- Release notes 5.1 (5162770312717), 6.0 (10632177443725), 6.6 (26005306818701), 6.9 (34904105205777),
  7.0 (38011940576273), 7.1 (41533810232721), 7.4 (45347482546193), 7.4.1 (45744678572817),
  7.5.0 (48328697898897), 7.6 (51156609278737)
- Discord plugin setup: https://help.elgato.com/hc/en-us/articles/4422740578189
- SDK profiles guide https://docs.elgato.com/streamdeck/sdk/guides/profiles ; `@elgato/streamdeck` 3.0.4
  `dist/plugin/profiles.d.ts` (switchToProfile page "indexed from 0")
- Profiles getting started / packaging: https://docs.elgato.com/stream-deck/profiles/ (copies in `dl/docs/profiles-*.txt`)

GitHub evidence (real exports): see §9; URLs https://github.com/<owner>/<repo>.
Third-party readers used only as corroboration: https://github.com/adblocker-1/FreeStream
(`freestream/catalog.py`, `freestream/actions.py`), https://github.com/achedon12/tuxcast
(`docs/reference/elgato-actions.md`), https://github.com/auuruum/Deckly (`crates/deckly/src/official.rs`),
https://github.com/data-enabler/streamdeck-profile-generator (`lib/ids.js`, `lib/actions.js`).

Local copies of everything read: `<scratch>/nav/`
(`repos/`, `ex/`, `ex2/`, `raw/`, `scripts/dump3.py`, `scripts/find.py`, `scripts/findany.py`, `scripts/v2dir.js`).
