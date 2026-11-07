# Stream Deck icon packs: precise enough to generate one with a script (state as of 2026-11-06)

Research for the Tablet Deck Stream Deck pack. Scope:

- the `.streamDeckIconPack` container and its `<id>.sdIconPack/` folder;
- `manifest.json`, `icons.json`, the icon files, the pack icon, `license.txt` and `previews/`;
- the exact validation rules Elgato's own tools apply;
- installing locally and through Marketplace;
- key-image design guidance (sizes, title over the icon, safe area);
- animation on keys;
- Key Creator and Elgato's other design assets.

Related files in this folder:

- `sdk.md` covers plugins, `setImage` and layouts;
- `devices.md` covers per-model key sizes.

## Confidence labels

- **[primary]**: confirmed in a primary Elgato source. That means docs.elgato.com, elgato.com, Elgato's help or Explorer pages, or Elgato's own tools: Icon Pack Man's JavaScript, the DistributionTool binary, and the SDK template Elgato distributed.
- **[real files]**: seen in real, working packs or tools on GitHub, but not stated as a rule by Elgato.
- **[inferred]**: my conclusion from the evidence. Not confirmed.
- **[tested locally]**: I ran it here on Linux with Node 22.23.4. **This is not a test against the real Stream Deck app.** The Stream Deck app, Icon Pack Man and DistributionTool were not run.
- **[snippet only]**: seen only in a search-engine snippet of a page I could not open.

---

## 0. TL;DR

1. **Container.**
   - A `.streamDeckIconPack` file is a plain **ZIP**. Inside is exactly one top-level folder, `<id>.sdIconPack/`.
   - That folder holds `manifest.json`, `icons.json`, the pack icon (`icon.png` or `icon.svg`), `license.txt` (optional), `icons/` and `previews/` (optional).
   - Real packs use both STORE and DEFLATE compression, and both include folder entries.
   - There is no signature or extra metadata file.
   - **[primary: Icon Pack Man export code + DistributionTool strings; real files: 4 packs inspected byte-by-byte]**
2. **Pack ID.**
   - The ID is the folder name without `.sdIconPack`.
   - It must be lowercase `a-z 0-9 - .` in reverse-DNS form, with no `..`. Example: `com.example.tablet-deck`.
   - There is no `UUID` field in the manifest.
   - **[primary: DistributionTool and Icon Pack Man validators; icon guidelines "use reverse DNS format"]**
3. **`manifest.json`.**
   - Required: `Name`, `Version`, `Author`, `Icon`.
   - Optional: `Description`, `URL`, `License`.
   - `Version` may contain only digits and dots. `URL` must be http(s).
   - There is **no `Tags` field** in the manifest. Marketplace tags are set in Maker Console.
   - **[primary]**
4. **`icons.json`.**
   - A JSON array of `{ "path", "name", "tags" }`. All three are required.
   - `path` is relative to `icons/`. `tags` must be a JSON array, which may be empty.
   - Every file in `icons/` needs an entry, except the PNG companion of an animated icon.
   - **[primary]**, with the companion exemption **[snippet only + Elgato template]**.
5. **Icon files.**
   - All icons are **144 × 144 px**.
   - Static icons: SVG, PNG or JPEG. Animated icons: GIF or WEBP.
   - File names are at most 80 characters.
   - Animation: recommended **10–20 fps** and **≤ 5 s**. Files are "preferably ≤ 1 MB".
   - One size fits every device: there is no `@2x` in icon packs.
   - **[primary]**
6. **Animated icons need a static PNG companion with the same name.** For example, `quantum.gif` goes with `quantum.png`.
   - Elgato's template ships `4.gif` + `4.png`.
   - Icon Pack Man flags a missing companion and creates one itself on export.
   - The companion PNG is not listed in `icons.json`.
   - **[primary: template + Icon Pack Man code; "not listed" is snippet only + the template]**
7. **Install.**
   - **Double-click** the `.streamDeckIconPack` file and Stream Deck installs it into the Icon Library.
   - Packs from Marketplace install straight into the app.
   - Installed packs live in these folders:
     - Windows: `%APPDATA%\Elgato\StreamDeck\IconPacks\<id>.sdIconPack\`
     - macOS: `~/Library/Application Support/com.elgato.StreamDeck/IconPacks/`
   - **[primary for double-click and Marketplace; real files for the paths]**
8. **Tools.**
   - Elgato says to build packs with **Icon Pack Man** (https://iconpackman.elgato.com/). The old **DistributionTool** (`-b -i <id>.sdIconPack -o <dir>`) also still validates and builds packs.
   - The current Elgato CLI (`@elgato/cli` 1.8.1) has **no icon-pack support**.
   - There is **no official JSON schema** for icon packs.
   - A Node script with only built-in modules can write the ZIP (`zlib.deflateRawSync` plus a 10-line CRC-32). **[tested locally]** for ZIP validity only.
9. **Animation in general.**
   - Animated GIFs (and animated WEBP) play on the keys when the user puts them there from an icon pack, "Set from File" or drag-and-drop. **[primary]**
   - Plugins can declare GIFs as manifest state images. **[primary]**
   - Plugin `setImage` **cannot** send animated formats, and Elgato asks plugins to make **≤ 10 image calls per second**. **[primary]** (Details in `sdk.md`.)
10. **Titles and plugin images.** A user icon or title always wins over a plugin's `setImage`, so a pack icon put on a live plugin key hides the live state. **[primary]**
11. **No safe-area spec exists.** Elgato documents no safe area and no title zone for key art. Section 12 gives evidence-based margins. **[inferred]**

---

## 1. Sources (all fetched 2026-11-06 unless noted)

| # | Source | Type | What it gave |
|---|---|---|---|
| S1 | https://docs.elgato.com/stream-deck/icons/getting-started | primary (docs) | formats, 144 px, ≤80 chars, fps/duration, ≤1 MB, testing, double-click install, Marketplace |
| S2 | https://docs.elgato.com/stream-deck/icons/api | primary (docs) | file structure, manifest fields and which are required, icons.json fields |
| S3 | https://docs.elgato.com/guidelines/stream-deck/icons | primary (Marketplace guidelines) | reverse-DNS ID, do/don't for content and descriptions |
| S4 | https://iconpackman.elgato.com/ (`js/app.3dd256bc.js`, Icon Pack Man **1.2.4 (build 120)**) | primary (Elgato tool source) | exact export layout, validator rules, GIF companion handling, preview placeholder 1280×800, the "multiple of 36" hint |
| S5 | DistributionTool (macOS universal + Windows `.exe`) committed in `L1cardo/WebIcons-StreamDeckIconPack` (2023) | primary (Elgato binary; validator strings read with `strings`) | the same validator as S4, plus the "license missing", "file has no entry" and "tags not an array" checks; CLI usage |
| S6 | `sdk-template.sdIconPack` in https://github.com/AdamJ/stream-deck-icon-packs ("example template (downloaded from Elgato)", license "Copyright 2020 Corsair/Elgato") | primary (Elgato sample, via third party) | reference manifest, icons.json, `4.gif` + `4.png`, three 1280×800 previews, a 28×28 `icon.svg` |
| S7 | https://www.elgato.com/ww/en/s/keycreator (FAQ JSON embedded in the page) | primary (elgato.com) | supported formats incl. animated WEBP, double-click install, what a pack must contain, "GIFs play on the key", custom icons hide plugin displays |
| S8 | https://www.elgato.com/uk/en/explorer/products/stream-deck/customize-stream-deck-with-icons-and-icon-packs/ | primary (Elgato Explorer guide) | 144×144, PNG/JPEG/GIF/BMP/WEBP/animated WEBP, auto-resize, Icon Library steps, Marketplace packs install directly |
| S9 | https://docs.elgato.com/guidelines/stream-deck/plugins | primary | key icon sizes, GIF in the manifest but not via `setImage`, ≤10 calls/s, action-list icon rules |
| S10 | https://docs.elgato.com/maker-console/submitting-products, …/managing-products, https://docs.elgato.com/guidelines/products, https://docs.elgato.com/guidelines/branding, https://docs.elgato.com/guidelines/stream-deck/profiles | primary | Marketplace media sizes, "Icon previews (icon packs only)", naming, AI policy, branding words |
| S11 | Stream Deck release notes, https://edge.elgato.com/egc/sd_content/releasenotes/<ver>.html (7.0.0–7.6.1, 6.9.0) | primary | icon-library changes in 7.x (section 16) |
| S12 | `@elgato/icons` **2.5.1** on npm (repo `elgatosf/icons`, modified 2026-07-08, MIT © 2025 Corsair Memory Inc.), plus https://docs.elgato.com/resources/icons | primary | Elgato's own glyph library and design language |
| R1 | `com.elgato.jolicoeurneonicons.streamDeckIconPack` (AdamJ, zip dated 2023-10-09) | real files | Icon Pack Man-style ZIP (STORE) |
| R2 | `com.blazewheeler.glowgato.streamDeckIconPack` (BlazeWheeler/GlowGato, 2025-03-26, 316 icons) | real files | STORE ZIP, empty `tags` arrays, `name` = file name |
| R3 | `com.hope-it-works.bootstrap.streamDeckIconPack` (2025-06-22, 2,079 SVG icons, on Marketplace) | real files | DEFLATE ZIP from DistributionTool, **no `License` field** |
| R4 | `com.nasc.pixelarticonpack.*.streamDeckIconPack` (Nasc, 2022) | real files | DEFLATE ZIP, 56×56 `icon.png`, 1280×800 preview |
| R5 | https://github.com/dcramer/streamdeck-icons (last commit 2026-10-05) | real files | Node build with fflate STORE ZIP, fixed 1980 mtime, 56×56 icon; install and update notes; how assigned icons are copied into profiles |
| R6 | https://github.com/mackenly/simple-icons-stream-deck (last commit 2026-10-26, on Marketplace) | real files | Python generator + **DistributionTool.exe still used in CI in 2026**; SVGs with only a 24×24 `viewBox`; tags with capitals and spaces |
| R7 | czottmann/streamdeck-iconpack-system-uicons, Hope-IT-Works README, chasemsutton/StreamDeckIconManager `PackPaths.cs` | real files | sideload folder paths on Windows and macOS |

Pages that no longer exist, all 404 now: the old SDK icon-pack pages at `docs.elgato.com/sdk/icon-packs/...`, `docs.elgato.com/en/stream-deck/icon-packs/create-your-icon-pack` and `developer.elgato.com/.../icon-specs`. web.archive.org is blocked from this environment, so their old text is known only from search snippets ([snippet only]).

Pages I could not read:

- the help-center article https://help.elgato.com/hc/en-us/articles/360028237271 (403);
- Key Creator itself, https://keycreator.elgato.com/key-creator/index.html (403);
- the Figma "Stream Deck Templates" file (403).

---

## 2. The container: `.streamDeckIconPack`

### 2.1 What it is

- The file is a ZIP archive with the extension `.streamDeckIconPack`. Icon Pack Man saves it as `` `${id}.streamDeckIconPack` ``. **[primary: S4]**
- At the root of the ZIP there is **one folder**, `<id>.sdIconPack/`. Everything else lives inside it. **[primary: S4]**
  - Icon Pack Man's export creates the folder entries `s`, `s+"/icons"` and `s+"/previews"`, where `s = uid + ".sdIconPack"`.
  - It writes `icons.json`, the pack icon, `manifest.json` and `license.txt` into `s`.
  - It writes icons into `icons/` and previews into `previews/`.
  - It always creates `previews/` and `icons/`, even when they are empty.
- When it opens a pack, Icon Pack Man maps `X.streamDeckIconPack` to the folder `X.sdIconPack`. **[primary: S4]** Naming the ZIP after the ID is the convention: `name.replace(".streamDeckIconPack", ".sdIconPack")`.
- When it reads a ZIP, Icon Pack Man ignores entries whose name starts with `__` or `.`. That covers `__MACOSX` and `.DS_Store`. **[primary: S4]**

### 2.2 Byte-level evidence from real packs **[real files]**

| Pack | Built by (inferred) | Method | Folder entries | Root entries | Date in ZIP |
|---|---|---|---|---|---|
| R1 jolicoeurneonicons (43 icons) | Icon Pack Man (JSZip) | **STORE** (0), "version needed" 1.0 | `id.sdIconPack/`, `icons/`, `previews/` | `icons.json`, `icon.png`, `manifest.json`, `license.txt`, `previews/1..3-preview.png` | 2023-10-09 |
| R2 glowgato (316 icons) | Icon Pack Man | STORE | same | same | 2025-03-26 |
| R3 bootstrap (2,079 icons) | DistributionTool | **DEFLATE** (8), flag bit 3 (data descriptor) | `id.sdIconPack/`, `icons/`, `previews/` | `icon.svg`, `icons.json`, `license.txt`, `manifest.json`, `previews/1-preview.png` | 2025-06-22 |
| R4 nasc pixel art (336 icons) | DistributionTool | DEFLATE | same | `icon.png`, `icons.json`, `license.txt`, `manifest.json`, `previews/0-preview.png` | 2022-11-22 |
| R5 dcramer (2026) | fflate `zipSync(…, {level:0})` | STORE, mtime 1980-01-01 | `id.sdIconPack/`, `icons/`, `previews/` (empty) | `manifest.json`, `icons.json`, `license.txt`, `icon.png` | 1980-01-01 |

- No pack has a ZIP comment, extra fields, a signature or a checksum file.
- Forward slashes are used throughout, with no leading `./`.

### 2.3 Building one with Node built-ins **[tested locally]**

I wrote a proof script, `<scratch>/streamdeck-research/scripts/iconpack-zip-proof.js`. It uses only `fs`, `path` and `zlib`, plus its own CRC-32 table.

- It writes local headers and the central directory, with the UTF-8 flag (0x0800) and a fixed 1980-01-01 date so builds are reproducible.
- It deflates with `zlib.deflateRawSync` (method 8). Folder entries are stored (method 0) with attribute 0x10.
- Its output (`dl/com.example.tabletdeck-proof.streamDeckIconPack`, 1,904 bytes) passes Python `zipfile.testzip()` and `unzip -t` ("No errors detected").
- **Not tested: whether the Stream Deck app imports it.** Real packs show both STORE and DEFLATE work, so either method should be fine **[inferred]**.

Practical notes:

- **Store a file when deflating would not make it smaller.** Tiny files grow, for example `license.txt` 4 → 6 bytes. PNG and GIF are already compressed, so STORE them.
- `zlib.crc32()` exists only from Node 20.15 / 22.2. A hand-rolled table works on every Node ≥ 18. **[primary: Node docs, general knowledge]**
- ZIP64 is not needed: packs are far below 4 GB and 65,535 entries.

---

## 3. Folder layout

The docs give this as the "recommended structure". **[primary: S2]**

```
.
├── icons/
│   └── ...
├── icon.svg
├── icons.json
├── license.txt
└── manifest.json
```

What Elgato's own tools produce, and what a generator should write:

```
<id>.streamDeckIconPack                 (ZIP)
└── <id>.sdIconPack/
    ├── manifest.json                   required
    ├── icons.json                      required
    ├── icon.png | icon.svg             required (name is free; referenced by manifest "Icon")
    ├── license.txt                     optional (required if manifest "License" is set)
    ├── icons/                          required
    │   ├── shields-front.svg           static: .svg .png .jpg/.jpeg
    │   ├── quantum-spool.gif           animated: .gif (or .webp)
    │   └── quantum-spool.png           static companion of the animated file (no icons.json entry)
    └── previews/                       optional ("not required, but allows users to get an idea…")
        ├── 1-preview.png
        └── …
```

Sources:

- Icon Pack Man's export writes the pack icon as `icon.<ext>`, where ext is png, jpg, jpeg, tiff or svg, and sets `manifest.Icon` to that name. **[primary: S4]**
- Real packs use `icon.png` or `icon.svg` at the root. **[real files]**
- One sideloaded pack uses `"Icon": "icons/create.png"` (czottmann), so a path into `icons/` works when copying the folder by hand. **[real files]**
- Validators reject icon paths containing `/./` or `/../`. **[primary: S4/S5]**

---

## 4. `manifest.json`

### 4.1 Fields

The docs (S2) list these fields, with what they say:

| Field | Required | What the docs say |
|---|---|---|
| `Name` | yes | "Name of the icon pack, visible in Stream Deck." |
| `Version` | yes | "typically represented as three numerical digits, for example 1.0.2 … we recommend following semantic versioning" |
| `Author` | yes | "Name of the Maker, visible in Stream Deck." |
| `Icon` | yes | "Relative path to the image that represents your icon pack in Stream Deck — for best results, this should be 56 × 56 px." |
| `Description` | no | "visible within Stream Deck; this can differ to Marketplace." |
| `URL` | no | "URL to get more info about the icon pack." |
| `License` | no | "Relative path to a txt file containing license information." The table spells it "Licence", but the JSON key is `License`. |

What the validators (S4/S5) add to that:

| Field | Rule |
|---|---|
| `Name` | non-empty |
| `Version` | non-empty, **only digits and `.`**: `"1.0"` and `"1.0.0"` pass, `"1.0.0-beta"` fails |
| `Author` | non-empty |
| `Icon` | file must exist; no `/./` or `/../` |
| `Description` | – |
| `URL` | if present, must start with `http://` or `https://` |
| `License` | if present, the file must exist ("has a license … that does not exist") |

**Not fields:**

- **`UUID`/ID:** the pack's identity is the folder name. Icon Pack Man's manifest class keeps a `UUID` internally, but `compile()` writes only Name, Version, Description, Author, URL, Icon and License. **[primary: S4]**
- **`Tags`:** the docs never mention it, and Icon Pack Man does not write it. One sideloaded pack has `"Tags": "system uicons"`, and the app seems to ignore it. **[real files]**
- Marketplace tags (devices, OS, theme, color) are set in Maker Console. **[primary: S10]**

### 4.2 Exact examples

Elgato docs (S2):

```json
{
    "Name": "Awesome Icons",
    "Version": "1.0.0",
    "Description": "Awesome icons for making your Stream Deck look... awesome!",
    "Author": "John Doe",
    "URL": "https://www.elgato.com",
    "Icon": "icon.svg",
    "License": "license.txt"
}
```

Elgato SDK template (S6), verbatim. Note `"Version": "1.0"` and the `\n` in `Description`:

```json
{
    "Name": "SDK sample icon pack",
    "Version": "1.0",
    "Author": "Elgato",
    "URL": "https://www.elgato.com",
    "Icon": "icon.svg",
    "License": "license.txt",
    "Description": "This is a description from the SDK sample icon pack...\n\nEdit manifest.json to create something meaningful."
}
```

Icon Pack Man's defaults (S4): `{Name:"My Cool Icons", Version:"1.0.0", Description:"A collection of my favourite icons for Stream Deck.", Author:"Jane Doe", URL:"https://example.com", Icon:"", License:"MIT"}`. It writes JSON with 4-space indent (`JSON.stringify(…, null, 4)`) and writes the license text to `license.txt`.

Marketplace pack without `License` (R3, works on Marketplace):

```json
{ "Author": "Hope-IT-Works", "Name": "Bootstrap Icons",
  "Description": "Unofficial open source SVG icon library from Bootstrap for Stream Deck.",
  "Icon": "icon.svg", "URL": "https://github.com/Hope-IT-Works/bootstrap-icons-stream-deck",
  "Version": "1.13.1" }
```

Proposed for Tablet Deck. The ID and URL are placeholders, and the owner chooses the real ID once, because it must never change:

```json
{
    "Name": "Tablet Deck HUD Icons",
    "Version": "1.0.0",
    "Description": "HUD-style key icons for Star Citizen ship controls: flight, combat, mining, salvage and more. Static and animated. Works with any Stream Deck action.",
    "Author": "Tablet Deck",
    "URL": "https://example.github.io/tablet-deck/",
    "Icon": "icon.png",
    "License": "license.txt"
}
```

---

## 5. `icons.json`

### 5.1 Structure

A top-level JSON **array** of objects. **[primary: S2, S4, S5]**

| Key | Required | Meaning | Validator rule |
|---|---|---|---|
| `path` | yes | "Path to the file, relative to the icons folder." | non-empty; file must exist in `icons/`; no `/./` or `/../` |
| `name` | yes | "Display name of the icon." | non-empty |
| `tags` | yes | "Searchable tags" | must be a **JSON array** ("The tags for '%s' is not a json array."); a tag containing `", "` is rejected ("shouldn't be a list of strings. Please use instead a json array like '"tags": ["tag1", "tag2", "tag3"]'"); `[]` is fine |

More rules:

- **Every file in `icons/` must have an entry.** DistributionTool runs `CheckFilesFromFolderExistInIconsJson` and fails with "The file '%s' has no entry in the icons.json file." **[primary: S5]**
- The legacy docs exempt the animated icon's companion PNG: "The PNG file does NOT need an entry in the icons.json file." **[snippet only]**
  - Elgato's own template has `4.png` next to `4.gif` with no `4.png` entry. **[primary: S6]**
  - So the companion is exempt, but I could not run DistributionTool to prove it. **[inferred]**
- **Icon Pack Man normalizes tags.** It lowercases and trims them and removes whitespace. Tags typed as a comma string are also stripped of non-alphanumerics. **[primary: S4]**
  - Real Marketplace packs ship tags with capitals and spaces ("Simple Icons"), and DistributionTool accepts them. **[real files: R6]**
  - Lowercase single words are the safe form.
- **Sub-folders in `path`:** the validator only forbids `/./` and `/../`. No real pack uses sub-folders. Keep `icons/` flat. **[inferred]**
- **No documented icon-count limit.** R3 has 2,079 icons. **[real files]**

### 5.2 Exact examples

Elgato docs (S2):

```json
[
    { "path": "icon_1.svg", "name": "Train", "tags": ["travel"] },
    { "path": "icon_2.svg", "name": "Salad", "tags": ["food"] },
    { "path": "icon_3.svg", "name": "Bike",  "tags": ["travel", "sport"] }
]
```

Elgato SDK template (S6), verbatim. Note that the animated `4.gif` is listed and its companion `4.png` is not:

```json
[
    { "path": "1.svg", "name": "One", "tags": ["numbers", "firstTag"] },
    { "path": "2.png", "name": "Two", "tags": ["numbers", "otherTag"] },
    { "path": "3.jpg", "name": "Three", "tags": ["numbers"] },
    { "path": "4.gif", "name": "4", "tags": ["numbers", "digit", "road-sign"] }
]
```

Proposed shape for Tablet Deck (illustrative names):

```json
[
    { "path": "shields-front.svg",   "name": "Shields Front",   "tags": ["shields", "defense", "combat", "starcitizen"] },
    { "path": "quantum-spool.gif",   "name": "Quantum Spool",   "tags": ["quantum", "travel", "animated", "starcitizen"] },
    { "path": "landing-gear.svg",    "name": "Landing Gear",    "tags": ["landing", "gear", "flight", "starcitizen"] }
]
```

Here `icons/quantum-spool.png` also exists, as the companion of `quantum-spool.gif`, and it is not listed.

---

## 6. The icon files

### 6.1 Requirements

| Rule | Value | Source |
|---|---|---|
| Size | **144 × 144 px** ("All images must be 144 × 144 px"; the API page says "For best results, icons should also be 144 × 144 px") | S1, S2, S3 **[primary]** |
| Static formats | **SVG, PNG, JPEG** (the API page lists JPG too) | S1, S2, S3 **[primary]** |
| Animated formats | **GIF, WEBP** | S1, S3 **[primary]** |
| File name length | **≤ 80 characters** | S1, S3 **[primary]** |
| Animation | **10–20 fps**, **≤ 5 s** recommended; "Keep both image dimensions and file size small (preferably ≤1 MB)" | S1 **[primary]** |
| Scaling | "One size fits all … you do not need to provide different sized images for different Stream Deck devices." There is no `@2x` naming in packs. | S1 **[primary]** |
| Content | no low-resolution images or screenshots, no copyrighted or 1:1 replica app images unless you own them, no hateful, violent or explicit imagery | S3 **[primary]** |

More detail:

- **File-name characters.** Icon Pack Man replaces `< > : " / \ | ? * # &` with `_` and lowercases the extension when it builds a pack. **[primary: S4]** Use `[a-z0-9-]+\.(svg|png|gif)`. **[inferred]**
- **Size check in Icon Pack Man.** It only warns when width or height is not a multiple of 36: "To avoid scaling or blurred edges, image width or height should be a multiple of 36". **[primary: S4]** 144 = 4 × 36.
- **Icon Pack Man accepts** `png, jpg, jpeg, svg, gif`. **WEBP is missing from its file filter**, even though the docs allow WEBP. **[primary: S4]** A script-built pack can include WEBP, but Icon Pack Man would not accept it in its UI. **[inferred]**
- **SVG without a size.** Simple Icons (on Marketplace) ships SVGs with only `viewBox="0 0 24 24"` plus an inline style. Unsized SVGs are therefore scaled to the key. **[real files: R6]**
  - Give every SVG `width="144" height="144" viewBox="0 0 144 144"`, like Elgato's template `1.svg`. **[primary: S6 shows that form]**
- **Elgato's own sample icons** (S6):
  - `1.svg`: 144×144 viewBox, a circle `r=64` with `stroke-width=16`, so the art reaches the edge.
  - `2.png`: 144×144 RGBA.
  - `3.jpg`: 144×144.
  - `4.gif`: 144×144 GIF89a, **17 frames, 130 ms/frame (~7.7 fps), NETSCAPE loop 0 (forever), 2.21 s, 35.5 KB**.
  - `4.png`: 144×144 companion.

### 6.2 Animated icons: the static companion

- **Icon Pack Man's validator** checks every `.gif` listed in `icons.json` for a file with the same name ending in `.png`. If it is missing, it logs "Error: The GIF file '%s' should have a complementary '%s'". It does **not** stop the build. **[primary: S4]**
- **Icon Pack Man's importer** marks GIFs without a PNG as `orphanedGifs`. On export it generates the missing PNG itself: a 144×144 "cover"-scaled canvas thumbnail of the GIF, written as `<name>.png` into `icons/`. **[primary: S4]**
- **The legacy docs** said: "Animated icons require an additional preview PNG file (with the same name) alongside the original file in the icons folder. The PNG file does NOT need an entry in the icons.json file." **[snippet only]**
- Likely use of the companion: the Icon Library's grid and the static fallback. **[inferred]** Make it a representative frame, the most readable one, not necessarily frame 0.
- **WEBP companions**: undocumented. Use the same rule (`x.webp` + `x.png`). **[inferred]**

---

## 7. Pack icon, license and previews

| Item | Spec | Evidence |
|---|---|---|
| Pack icon (`Icon`) | "for best results … 56 × 56 px". SVG or PNG. | S2 **[primary]**. Real sizes: SVG 28×28 (Elgato template), PNG 56 (Nasc, dcramer), 144, 288, 800, 1024 (all work) **[real files]** |
| `license.txt` | plain text; referenced by `License`; optional | S2, S5 **[primary]**. The template text is "Copyright 2020 Corsair/Elgato / Licensed under the MIT License…" |
| `previews/` | optional | Validator note: "No 'previews' folder was found. It is not required, but allows users to get an idea of what's in the iconpack." **[primary: S4, S5]** The Key Creator FAQ says a submitted pack includes "preview images" **[primary: S7]** |

More about previews:

- **Size and count.**
  - Icon Pack Man shows **3 preview slots** with a **1280 × 800** placeholder. **[primary: S4]**
  - The Elgato template has 3 previews at 1280×800 (`preview_1.png`…). **[primary: S6]**
  - Real packs vary: 1280×800, 1280×640, 1920×960, 1248×780, 891×568, and even 244×244 tiles. **[real files]**
  - So nothing enforces a size. Use **1280 × 800 PNG, 1–3 images, named `1-preview.png`…** **[inferred]**
- **Where previews are shown** is undocumented. Marketplace media are uploaded separately in Maker Console (section 11). **[primary: S10]**

---

## 8. Validation checklist to port into a `--check` script

This combines DistributionTool (S5) and Icon Pack Man's port of the same C++ validator (S4). All error texts are verbatim from the tools. **[primary]**

1. The folder name ends with `.sdIconPack`.
2. ID = folder name without the extension. It is lowercase `a-z`, `0-9`, `-`, `.` with no `..`. Icon Pack Man's UI also tests `^([a-z0-9-]+)(.[a-z0-9-]+)+$`, i.e. at least two dot-separated parts.
3. `manifest.json` exists and is valid JSON.
4. `Version` is non-empty and contains only `0-9` and `.`.
5. `Name` is non-empty. `Author` is non-empty.
6. `URL` is empty or starts with `http://` or `https://`.
7. `Icon` is non-empty, the file exists, and the path has no `/./` or `/../`.
8. `License`, if set, points to an existing file with a valid path.
9. `icons.json` exists and is valid JSON (an array).
10. Each entry:
    - `path` is non-empty, the file exists in `icons/`, and the path is valid;
    - `name` is non-empty;
    - `tags` is an array, and no tag contains `", "`.
11. Every file in `icons/` has an entry, except `X.png` when `X.gif` is listed (and, by inference, `X.webp`).
12. Every `.gif` (and, by inference, `.webp`) has a same-name `.png`.
13. Elgato rules not checked by the tools, worth enforcing ourselves:
    - 144×144 for PNG/GIF (read the IHDR / logical screen size);
    - file name ≤ 80 characters;
    - animated files ≤ 1 MB and ≤ 5 s, frame delay 50–100 ms;
    - extensions lowercase.

What the tools print on success: "Validating and exporting the %s %s" and "The %s has been successfully exported". DistributionTool usage: `DistributionTool [-h] [-b] [-v] [-i FILE] [-o DIRECTORY]`. **[primary: S5]**

---

## 9. Elgato's tools for building packs

- **Icon Pack Man** (https://iconpackman.elgato.com/) is the documented way: "to create icon packs, please use Icon Pack Man" (S2). Steps on the Key Creator page: "Design your icons → Package using IconPackMan → Share or sell on Marketplace" (S7). **[primary]**
  - It is a browser app (Vue + JSZip) that runs fully client-side. It can load a folder or a `.streamDeckIconPack`, validate it, edit the manifest and export.
  - It is still online. I saw version 1.2.4 (build 120).
- **DistributionTool** is Elgato's legacy native packager.
  - It validates and builds `.sdIconPack` folders: `DistributionTool -b -i com.example.pack.sdIconPack -o out/`. Its upload endpoint string is `https://appstoreconnect.elgato.com/upload/streamDeckIconPack/`. **[primary: S5]**
  - It is still used in CI by a Marketplace pack in Oct 2026 (Windows runner). **[real files: R6]**
  - Its binaries are macOS/Windows only, so it can't run on our Linux CI without Windows or macOS. **[inferred]**
- **`@elgato/cli` 1.8.1** (elgatosf/cli, last commit 2026-08-19): no mention of icon packs anywhere in its source. It packs plugins only. **[primary: source search]**
- **No official schema**: `@elgato/schemas` 0.6.0 (2026-10-29) contains only `streamdeck/plugins/manifest.json` and `layout.json`. `schemas.elgato.com/streamdeck/iconpacks/…` returns 404. **[primary]**

---

## 10. Installing, testing, updating, removing

- **Before packaging**, test single images with Set from File. The steps from S1: add any action → "In the lower half of Stream Deck, select the down chevron and choose Set from file". Dragging an image onto a key also works (S7). **[primary]**
- **Installing**: "you can then install the icon pack into Stream Deck by double-clicking the file" (S1). "Double-click the .streamDeckIconPack file and the Stream Deck app will open and install it automatically. Your icons will then appear in the Stream Deck Icon Library" (S7). **[primary]**
- **Using a pack icon**: select a key → the chevron under the icon → "Open Stream Deck Icon Library" → pick the pack and icon (S1, S8). **[primary]**
  - Packs work "for Stream Deck keys and dials" (S1). **[primary]**
  - On a dial, the chosen icon shows in the touch-strip layout's `icon` slot (48×48 in `$X1`/`$A1`/`$B1`/`$B2`, 24×24 in `$C1`; see `sdk.md`). **[inferred]**
- **Marketplace**: "Icon packs downloaded from Marketplace will be installed directly to Stream Deck and can be found in the Stream Deck Icon Library" (S8). **[primary]**
- **Folder locations** of installed packs **[real files: R5, R7; several independent READMEs and code]**:
  - Windows: `%APPDATA%\Elgato\StreamDeck\IconPacks\<id>.sdIconPack\`
  - macOS: `~/Library/Application Support/com.elgato.StreamDeck/IconPacks/<id>.sdIconPack/`
- **Sideloading** means copying the unzipped `<id>.sdIconPack` folder into `IconPacks/` while Stream Deck is closed, then starting it.
  - The legacy docs described this. **[snippet only]**
  - Community READMEs describe the same. **[real files]**
- **Assigned icons are copied.** Stream Deck copies the image into the profile, under `Profiles/<page>/Images/<26 chars>Z.png`. Keys never reference the pack, so removing or updating a pack does not change keys that are already set. **[real files: R5]**
  - That name format matches the real profiles in `profiles-x/`: 540 images, all 144×144 PNG, named like `5D9352EC47593FD285FA58E493Z.png`. **[real files]**
- **Updating a pack.** "Stream Deck does not reliably replace a sideloaded icon pack that has the same ID". The workaround: quit Stream Deck, delete only that `<id>.sdIconPack` folder, restart, then double-click the new file. Keys keep the old copy until the icon is picked again. **[real files: R5]**
- **Hiding packs**: Stream Deck 7.0 "Fixed an issue where hidden icon packs would still appear in the icon library", so users can hide packs. **[primary: S11]**
- **Plugins**: no documented way for a plugin to bundle or install an icon pack. Ship the pack as its own file. **[inferred: absent from SDK docs and schema]**

---

## 11. Marketplace (Maker Console)

- **Submission package**: "a packaged .streamDeckIconPack file, which includes your icons, a manifest.json with pack details, an icons.json with names and tags, and preview images" (S7). **[primary]**
- **Media** (S10) **[primary]**:
  - **Thumbnail**: 1920 × 960 PNG, **static** ("thumbnails must be static PNG images").
  - **Gallery**: 3 to 10 items, as 1920 × 960 PNG images or 1920 × 1080 MP4 videos (< 250 MB).
  - **"Icon previews (icon packs only)"** are uploaded in the Media step. Their size is not documented.
  - The app icon (288×288) is for plugins only.
- **Details** (S10) **[primary]**:
  - **Name**: ≤ 30 characters ideally; English; no emojis; no "+" for "and".
  - **Description**: 250–1,500 characters. The first 250 characters must be unformatted text, and the description must list requirements.
  - **Tags** for supported devices, OS, theme and color are set in Maker Console.
  - Name and monetisation can't be changed later without emailing maker@elgato.com.
  - Revenue split 70/30 (S7).
- **Icon-pack description advice** (S3) **[primary]**:
  - list the icon types;
  - give the total count and the color variants;
  - say whether icons are static, animated or include blank icons;
  - use the color, style and theme tags.
- **Trademarks** (S10) **[primary]**: "do not infringe trademarks or copyright material". When referring to IP, use phrasing like "inspired by" or "from the world of". The profile guidelines even use "Star Citizen Profile, macOS.streamDeckProfile" as a naming example.
- **AI policy** (S10) **[primary]**:
  - You must declare AI usage.
  - "products deemed to have been created entirely with AI are not eligible for publication".
  - This matters if the icons are AI-designed. It does not affect distributing the pack ourselves (GitHub releases, the website).
- **Branding words** (S10) **[primary]**: "Stream Deck" (two words), "Stream Deck +" (with the space), "key", "dial", "touch strip", "plugin", "Marketplace", "Maker Console".

---

## 12. Designing key art (for the pack and for profile images)

### 12.1 Sizes and scaling

- Draw at **144 × 144**, or as SVG with a 144 viewBox. **[primary: S1, S8]**
  - "Images with larger pixel sizes will be resized automatically to fit the key. Images with an aspect ratio other than 1:1 will be resized to fit the key, with the original aspect ratio unchanged." **[primary: S8]**
  - "scaling up a small image causes blurring. SVG files avoid this entirely" **[primary: S7]**
- The app scales to each device's native key, from `devices.md` **[primary/real files]**:

  | Device | Key size | Scale from 144 |
  |---|---|---|
  | 15-key family (Stream Deck, MK.2, Scissor Keys, Module 15) | 72 | 50 % |
  | Mini | 80 | – |
  | XL, Neo | 96 | – |
  | Stream Deck + XL | 112 | – |
  | Stream Deck + | 120 | – |
  | Studio | 144×112 (not square) | – |
  | Galleon 100 SD | 160 | slight upscale |

- On a dial, the same icon is drawn at **48×48** (or 24×24 in `$C1`) inside the 200×100 touch-strip segment. **[primary for the layouts, from `sdk.md`]**
- **Consequences** **[inferred]**:
  - Lines thinner than about **6 px at 144** (3 px on a 72-px key, 2 px at 48) break up.
  - Text smaller than about **20 px cap height at 144** is unreadable on 15-key and Mini devices.
  - Keep every glyph legible at 48 px.

### 12.2 Titles over the icon

- **The title is drawn by the Stream Deck app on top of the image.** The user sets it per key: Show Title on/off, top/middle/bottom, font, size, color, style, underline. A plugin can only set defaults. **[primary: manifest schema State.TitleAlignment `bottom|middle|top`, FontSize, FontFamily, FontStyle `""|Bold Italic|Bold|Italic|Regular`, ShowTitle, TitleColor — each "Can be overridden by the user"]**
- **Icon packs carry no title data.** They are images only; titles live in profiles and actions. **[primary: S2 has no such fields]**
- **What real profiles use** (counted across the profiles in `profiles-x/`, about 1,070 states) **[real files]**:
  - `FontSize` 12 (697 states; 658 as a number and 39 as the string `"12"`), 9 (271), 10 (54), 6 (28), and 16–24 for a few;
  - `TitleAlignment` bottom 679, middle 295, top 32;
  - typical extra keys: `"OutlineThickness": 2` and `"TitleColor": "#ffffff"`.
- **Layout rule** **[inferred]**:
  - Font sizes are in the 72-pt key's coordinate space, so size 12 is about 24 px at 144. With the outline, a one-line bottom title covers roughly the **bottom 30–36 px of a 144 icon**, and two lines about 60 px.
  - **Icons meant to carry a title**: keep the glyph inside the top ~100 px, centered around y ≈ 58, and keep the bottom band calm and dark.
  - **Icons meant to stand alone** ("no-title" style, with any label baked in): center the glyph and tell users to switch Show Title off.
  - dcramer's 2026 pack does exactly this: an 84 px glyph centered on 144, used without titles. **[real files: R5]**
  - A good split is to ship both kinds, or one glyph-only set and use profile titles.

### 12.3 Safe area

- **Elgato documents no safe area and no bleed for key art.** Elgato's own sample `1.svg` runs to the edge of the canvas. **[primary: S6; absence across S1–S3, S8, S9]**
- Physical key openings round the corners, and the LCD edge can sit slightly under the bezel on some models. **[inferred, not measured]**
- **Proposal** **[inferred]**:
  - backgrounds and frames may go **full-bleed**;
  - keep meaningful content **≥ 8 px from each edge at 144** (≈ 4 px on 72-px keys);
  - keep corner details clear of a ~16 px radius.

### 12.4 Style guidance from Elgato

- "For a cohesive and professional look, use similar color palettes, art styles, and icon proportions." Gradients, GIFs and photos are allowed. **[primary: S8]**
- Elgato's design language is the **Elgato Icons** library, `@elgato/icons` 2.5.1 on npm, MIT © 2025 Corsair Memory Inc. **[primary: S12]**
  - The docs say: "Mix, match, and curate your own icon packs based on our design language".
  - Formats: SVG glyphs on 16/20/24 px grids (`svg/s` 87 files, `svg/m` 431, `svg/l` 1,148) with `fill="currentColor"`, outline and `--filled` variants, and some `--color` logos. It also ships JS strings, React components and a font.
  - Useful glyphs for a ship HUD: `rocket`, `shield`/`shield-off`, `crosshair`, `compass`, `power`/`power-off`, `warning`, `signal*`, `lock`/`lock-open`, `flash`, `microphone`/`microphone-off`, `volume*`, `heat-sink`, `starbursts`, `wifi*`.
  - Using them needs only the MIT notice in `license.txt`. **[inferred from the license]**
- **Action-list icons are a different thing** (plugin only): 20/40 px (category 28/56), monochrome white `#FFFFFF` on a transparent background, no solid backgrounds and no colors. **[primary: S9]** Key icons have no such limit.
- Figma "Stream Deck Templates" (https://www.figma.com/community/file/1315040482142393672/stream-deck-templates) and the Elgato Media Room (https://www.elgato.com/s/media-room) are Elgato's recommended sources for gallery mock-ups. I could not open the Figma file (403). **[primary for the links]**

### 12.5 SVG and rendering caveats **[inferred]**

- **Elgato does not document which SVG features the app renders.** Elgato's examples use only plain shapes, paths, fills, strokes and opacity:
  - the SDK template;
  - the hello-world sample, whose text is converted to paths by Inkscape.
- **Safe subset**: `path`, `rect`, `circle`, `line`, `polygon`, `g`, `transform`, solid fills and strokes, `opacity`, and `linearGradient`/`radialGradient`.
- **Risky** (convert or pre-render to PNG and test on a device):
  - `<text>`, because fonts are not guaranteed: outline text to paths;
  - filters (blur, glow, drop shadow);
  - masks and clip paths with complex content;
  - `<image>` with external references;
  - CSS in `<style>`.
- For glows and other HUD effects, **PNG is the dependable format**. SVG is fine for flat vector art.

---

## 13. Animation on Stream Deck, end to end

| Where | Animated? | How | Source |
|---|---|---|---|
| Icon pack icons | **yes** | GIF or WEBP (+ same-name PNG); 10–20 fps, ≤ 5 s, ≤ 1 MB | S1, S4, S6 **[primary]** |
| User image on a key (Set from File, drag-and-drop) | **yes** | "Animated GIFs are fully supported and will play on the key"; formats include "animated WEBP" | S7, S8 **[primary]** |
| Plugin manifest `States[].Image` | **yes (GIF)** | "animated (GIF) images may also be specified within the manifest" | S9 **[primary]** |
| Plugin `setImage` at runtime | **no** | "does not support animated image formats, such as GIF"; animate by sending frames, **≤ 10 calls/second** | S9, `sdk.md` **[primary]** |
| Touch strip (Stream Deck +, + XL) | only through plugin `setFeedback` frames (≤ 10/s) | – | `sdk.md` **[primary]** |
| Profiles (`.streamDeckProfile`) | a GIF assigned to a key is copied into the profile like any image | – | **[inferred]**; no GIF seen in the real profiles examined |
| Screensavers (MK.2/XL/Neo) | separate feature and Marketplace product type ("Screensavers", email submission) | – | S10 **[primary]**; format not researched |

Notes for a generator using only Node built-ins **[inferred]**:

- **GIF facts.** The format has a 256-color palette per frame and 1-bit transparency.
  - Soft glows over transparency get jagged edges. Render animated icons on an **opaque dark background**, which suits black LCD keys anyway.
  - Frame delays are in centiseconds. 10–20 fps means **delay 5–10**. Elgato's template uses 13 (≈ 7.7 fps).
  - Set the NETSCAPE2.0 loop count to 0 (forever), as the template does.
- **What has to be written by hand.**
  - Encoding GIF needs an LZW encoder (~100 lines) plus palette quantisation, because Node has no image codecs.
  - PNG needs only `zlib.deflateSync`, a CRC-32 and an IHDR/IDAT/IEND writer (~40 lines).
  - WEBP has no practical built-in path, so use GIF.
- **Rasterising.** Rendering SVG to pixels is the real cost: no built-in module does it. There are two ways:
  - (a) draw the animated frames with our own small vector rasteriser, or
  - (b) use a rasteriser as a build-only devDependency.

  AGENTS.md currently limits devDependencies to the installer build. That is an owner decision.
- **Static icons can stay SVG.** That needs no rasteriser. Only the GIFs, their PNG companions and the pack icon need pixels, and the pack icon can also be SVG.
- **Keep the animation count modest.** Elgato warns that "Large animated icons can affect system performance" (S1). Use short loops of a few frames each, and only for icons where motion means something:
  - quantum spool-up;
  - an alert or warning pulse;
  - a scanning sweep;
  - a power-up.

---

## 14. Key Creator and other Elgato assets

- **Key Creator** is a "web-based image editor by Elgato" for key icons. **[primary: S7, S8]**
  - Its page says "Design icons for your Stream Deck, right here in your browser. No account needed."
  - It is embedded from `https://keycreator.elgato.com/key-creator/index.html`.
  - The app's icon menu opens it ("Create Your Own", per the Explorer guide; "Create new icon", per a search summary).
  - Images are saved locally, not stored by Elgato. **[snippet only: help article 360028237271]**
  - It is good for single icons and wallpapers. It is not a pack builder: the pipeline is Key Creator → Icon Pack Man → Marketplace.
- **Formats the app accepts on keys**:
  - the Key Creator FAQ: "SVG, PNG, JPG, GIF, WEBP, and animated WEBP … 144 × 144px at a 1:1 ratio. SVG is recommended" **[primary: S7]**;
  - the Explorer guide also lists **BMP**. **[primary: S8]**
- **Elgato's Key Creator FAQ on icons and plugins**: "Icon packs change how your keys look, not what they do … some plugin actions display dynamic information directly on the key … When you apply a custom icon, it replaces that display." **[primary: S7]**
  - The SDK rule behind it: "The image can only be set by the plugin when the user has not specified a custom image." **[primary: in `sdk.md`]**
  - **For Tablet Deck**: profiles meant to work with the live plugin must *not* put custom images on plugin keys. Let the plugin's manifest images and `setImage` show. Profiles for the standalone Hotkey action carry the pack images.
- **Other Elgato resources**, all linked from the guidelines (S3):
  - Elgato Icons (https://marketplace.elgato.com/resources/icons, returned HTTP 500 when fetched; the same set is at https://docs.elgato.com/resources/icons);
  - Badges (https://marketplace.elgato.com/resources/badges);
  - the Figma Stream Deck Templates;
  - the Media Room.

---

## 15. How the pack relates to profiles and the plugin

- The **icon pack** is standalone. It installs into the Icon Library and is used with any action, including the built-in Hotkey. **[primary]**
- **Profiles embed copies of their images** (`Images/*.png` inside each page), so the profiles work without the pack installed. **[real files]** The profile format is in a separate research file.
- The **plugin** uses its own images: manifest state images (GIF allowed) and `setImage` (SVG/PNG data, no animation). It does not need the pack. **[primary]**
- **Reuse the same source art** for all three outputs: pack PNG/SVG/GIF, profile key PNG, and plugin state images and `setImage` SVG. **[inferred]** That gives one look everywhere and keeps each piece usable alone.

---

## 16. What's new in 2025–2026 (icon-related)

**Stream Deck app 7.x** (S11, edge.elgato.com release notes) **[primary]**. No change to the icon-pack format was found in 7.0–7.6.1.

| Version | Change |
|---|---|
| 7.0 | "Fixed an issue where hidden icon packs would still appear in the icon library." |
| 7.1 | The app's own desktop icon was refreshed (not relevant to packs). |
| 7.4 | "fixed a bug where only one icon pack could be installed when multiple were present" **[snippet only]**: in a search summary of the 7.4 help-center notes, but not in the edge.elgato.com 7.4.0 page. |
| 7.4.2 (May 2026) | "Fixed a bug where pressing Delete while the Icon Library search field was focused would clear a key's custom icon." |
| 7.6 (22 Sep 2026) | "The background library now includes backgrounds sized for the Stream Deck Neo Infobar." Neo Infobar actions arrived, using SDK 3.0 layouts. The background library is a separate feature from icon packs, and its format was not researched. |

Other 2025–2026 changes:

- **Docs**: the icon-pack pages moved from `docs.elgato.com/sdk/icon-packs/*` (now 404) to `docs.elgato.com/stream-deck/icons/{getting-started,api}` plus `guidelines/stream-deck/icons`. The new pages dropped the explicit text about the GIF companion and the previews folder. **[primary: current pages; old ones known from snippets]**
- **Elgato Icons**: `@elgato/icons` reached 2.5.1 (2026-07-08). **[primary]**
- **Marketplace**: the product guidelines added an AI-usage section. **[primary]** I can't date when that section appeared.

---

## 17. Not confirmed / open questions

1. Whether the Stream Deck app (7.6) imports a Node-built ZIP. ZIP validity was tested; the app was not. Likely yes, because STORE and DEFLATE packs from three different writers all work.
2. Whether DistributionTool's "has no entry in icons.json" check really exempts GIF companion PNGs. The legacy docs and Elgato's template say yes; I could not run the tool.
3. Whether WEBP animated icons need a PNG companion, and whether the Icon Library shows WEBP. Icon Pack Man's UI does not accept WEBP.
4. What the app does with `previews/` locally, and the pixel size Maker Console wants for "Icon previews".
5. Which SVG features (filters, text, masks) the app's renderer supports.
6. The exact title metrics: pixel height of size 12 at each device, and the outline width.
7. Any physical safe area per device.
8. Whether animated GIFs play on Stream Deck Mobile, the Neo or the touch strip, and at what maximum frame rate the hardware actually updates.
9. The 7.4 "only one icon pack could be installed" fix, seen only in a search snippet.
10. The help-center article 360028237271 (403 here) may have more current specs. The Explorer guide (S8) appears to mirror it.

---

## 18. Recommended generator spec for Tablet Deck (summary)

**Output**: `dist/streamdeck/<id>.streamDeckIconPack`, a ZIP with one root folder, `<id>.sdIconPack/`:

- `manifest.json`: 4-space JSON with `Name`, `Version` (x.y.z), `Description`, `Author`, `URL`, `Icon`, `License`.
- `icons.json`: `[{ path, name, tags[] }]`, one entry per static or animated icon, with lowercase single-word tags.
- `icon.png`, 56×56 (or `icon.svg`).
- `license.txt`: our license, plus the MIT notice for any Elgato Icons glyphs used.
- `icons/<slug>.svg|png`: 144×144.
- `icons/<slug>.gif` + `icons/<slug>.png`: animated icon and its companion; 144×144, delay 5–10 cs, loop 0, ≤ 5 s, ≤ 1 MB, opaque background.
- `previews/1-preview.png` (1280×800, optional, 1–3 files).

**Rules**:

- The ID is fixed forever: lowercase reverse-DNS.
- File names match `[a-z0-9-]{1,76}\.(svg|png|gif)`.
- Run the section 8 checks in `--check` mode.
- Make the ZIP reproducible: fixed 1980 dates and sorted entries.
- STORE PNG and GIF files; DEFLATE JSON, SVG and text.

**Users install it by double-clicking.** For updates, document "quit Stream Deck, delete the old folder in IconPacks, double-click the new file".
