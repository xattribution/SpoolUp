# Stream Deck icon packs: precise enough to generate one with a script (verified, 2026-11-06)

This is the fact-checked version of `iconpacks.md`, which stays unchanged next to this file. I
re-read every claim the build depends on from the primary source or from real files. The working
files are in `verify-iconpacks/`:

- `web/`: the downloaded Elgato pages, Icon Pack Man's JavaScript (raw and pretty-printed), and
  the Stream Deck release notes from 6.9.0 to 7.6.1;
- `dt.asm` and `dt2.asm`: the DistributionTool disassemblies;
- `scripts/`: the checks I wrote.

Labels:

- **[primary]**: confirmed in an Elgato source. That covers docs.elgato.com, elgato.com,
  schemas.elgato.com, the elgatosf repos and npm packages, the code of Icon Pack Man 1.2.4, and
  the machine code of Elgato's DistributionTool.
- **[real files]**: seen in real packs, profiles or tools on GitHub, but not stated by Elgato.
- **[inferred]**: my conclusion; nothing states it.
- **[snippet only]**: seen only in a search-engine summary of a page I can't open (404 or 403).
- **[tested locally]**: run here on Linux with Node 22. **Not a test against the Stream Deck app**:
  the app, Icon Pack Man and DistributionTool were never run.

---

## Changes from the first draft

### Corrections

1. **`@elgato/cli` is at 1.10.4** (npm, 2026-10-29), not 1.8.1. The draft read an August clone.
   I searched the 1.10.4 tarball: it still has **no icon-pack support**.
2. **The GIF companion rule is now confirmed in Elgato's code, and it covers GIF only.** The draft
   rated it "snippet only + inferred". I disassembled DistributionTool's
   `CheckFilesFromFolderExistInIconsJson`. When a file in `icons/` has no `icons.json` entry, the
   tool accepts it only if two things hold: the extension is exactly `.png`, and a **file** with the
   same name and `.gif` exists on disk (checked with `_wstat64`; it does not look in `icons.json`).
   Every other unlisted file fails with "The file '%s' has no entry in the icons.json file."
   - So an **unlisted `x.png` next to `x.webp` fails DistributionTool.**
   - **Use GIF for animated icons, not WEBP.**
   - The 2026 binary that a Marketplace pack still runs in CI has the same code.
3. **Which tool checks what was mis-attributed.**
   - Only DistributionTool checks that every file in `icons/` is listed, and that the `License`
     file exists. Icon Pack Man checks neither: I searched its code for both messages and found
     nothing.
   - "The tags for '%s' is not a json array." is in **both** tools. The draft gave it to
     DistributionTool only.
   - Only Icon Pack Man reports a GIF without its PNG, and it does not fail on it.
4. **Icon Pack Man's reverse-DNS regex isn't a real check.** The regex is
   `^([a-z0-9-]+)(.[a-z0-9-]+)+$`. Its `.` isn't escaped, so it matches any character and does not
   require two dot-separated parts. It is also only logged, never enforced.
   - The enforced rule, in both tools, is: lowercase `a-z 0-9 - .`, and no `..`.
   - Reverse-DNS form is a Marketplace guideline.
5. **Sub-folders in `icons.json` `path` fail Icon Pack Man's validator.** It looks up each `path`
   among the direct children of `icons/`, by name. "Keep `icons/` flat" was **[inferred]**; it is
   now **[primary]**.
6. **Images in real profiles are not "all 144×144".** I recounted `profiles-x/`. All 540 images are
   named with 26 characters plus `Z`. Their sizes vary:
   - key images: 258 at 144×144, 236 at 72×72, 31 at 288×288;
   - **dial icons are stored at 48×48 under `"Encoder": {"Icon": …}`**;
   - per-dial strip backgrounds are 200×100 (`Encoder.background`);
   - whole-strip backgrounds are 800×100 (the controller's `Background`).

   So the app does not always store the original file. Dial icons are clearly resized
   **[real files]**.
7. **Elgato's hello-world sample SVG uses a live `<text>` element** (`font-family:sans-serif`).
   The draft said its text was converted to paths. The advice to outline text stays, because fonts
   are still not guaranteed, but `<text>` is not known to fail.
8. **Title-size counts.** I found `FontSize` 12 on 652 states, all as numbers. The draft had 658
   numbers plus 39 strings `"12"`. The other counts match: 9 → 271, 10 → 54, 6 → 28; bottom 679,
   middle 295, top 32. This doesn't change the advice.
9. **Pack-icon sizes in real packs**:
   - PNG: 56×56, 144, 288, 800 and a non-square 891×568;
   - SVG: 28×28 (Elgato template) and 40×32.

   The draft's "1024" was not found.
10. **Preview size is contested.** A snippet of the removed "Create your icon pack" guide says
    previews are **1920×960 PNG, non-transparent, up to 10** **[snippet only]**. Against that,
    Elgato's template and Icon Pack Man's placeholder use 1280×800, and Icon Pack Man keeps at most
    3 previews **[primary]**. Nothing enforces a size. The recommendation changes (section 7).
11. **Smaller corrections:**
    - The "thumbnails must be static PNG images" sentence sits in the **App Icon** section of the
      product guidelines. Thumbnails and gallery images are PNG at 1920×960.
    - The Explorer guide's format list has no SVG; the Key Creator FAQ does list SVG.
    - DistributionTool's tag message says "list of string", Icon Pack Man's says "list of strings".
    - Icon Pack Man fits the generated companion PNG into 144×144 with "contain" on one code path
      and "cover" on the other. For a square 144 GIF the two give the same result.

### Added

- Icon Pack Man's ZIP reader **expects the file name to match the root folder**, and logs
  "Note: Filename mismatch" when it doesn't. It also logs whether `manifest.json`, `license.txt`,
  `icons.json`, `icons/` and `previews/` are each present **[primary]**.
- **JSZip 3.10.1 opens our Node-built ZIP.** That is the version bundled in Icon Pack Man. The ZIP
  also passes a port of Icon Pack Man's ZIP-reader checks **[tested locally]**.
- **All manifest and `icons.json` values must be strings** (arrays for `tags`). Icon Pack Man calls
  string methods on them, so a numeric `Version` would throw **[primary code, inferred effect]**.
- **DistributionTool skips only `.` and `..` when it scans `icons/`.** A stray `.DS_Store` or
  `Thumbs.db` may therefore fail validation. Whether its directory lister hides those files wasn't
  determined **[inferred from code]**.
- **DistributionTool won't overwrite**: "A file already exists in the export folder" **[primary]**.
- **Elgato's device comparison** (updated 2026-04-10) marks **Custom icons ✅ and Icon Packs ✅ for
  every model** it lists: Mini, Neo, Stream Deck, MK.2, +, + XL, XL, Pedal, Mobile and Studio
  **[primary]**. Whether GIFs animate on each model is not stated.
- **In the plugin manifest schema, `Encoder.Icon` accepts PNG or SVG only, no GIF.** It is shown in
  the app's dial canvas **[primary]**.
- **`@elgato/icons` glyphs use `fill="currentColor"`.** Used as a standalone pack SVG, that resolves
  to black, which disappears on a black key. Write an explicit color **[inferred]**.
- From the legacy docs **[snippet only]**: "icon.gif is the animated icon shown on Stream Deck, and
  icon.png is what appears in the Image Library".

### Downgraded or still unconfirmed

- The 7.4 "only one icon pack could be installed when multiple were present" fix is still
  **[snippet only]**. Elgato's help-center article (dated 1 April 2026) returns 403, and the
  edge.elgato.com 7.4.0 notes don't mention it.
- That the app imports a Node-built ZIP is still not tested against the app.

---

## 0. TL;DR (verified)

1. **Container.**
   - A `.streamDeckIconPack` file is a ZIP holding **one** root folder, `<id>.sdIconPack/`.
   - The folder holds `manifest.json`, `icons.json`, the pack icon, `license.txt` (optional),
     `icons/` and `previews/` (optional).
   - Both tools accept STORE and DEFLATE ZIPs. Icon Pack Man writes STORE; DistributionTool writes
     DEFLATE.
   - There is no signature.
   - Name the file `<id>.streamDeckIconPack` **[primary + real files]**.
2. **ID** = the folder name without `.sdIconPack`.
   - Hard rule: lowercase `a-z 0-9 - .` with no `..` **[primary: both validators]**.
   - Guideline: use reverse-DNS form, for example `com.iconpack.elgato` **[primary: icon
     guidelines]**.
   - The manifest has no `UUID` field.
3. **`manifest.json`.**
   - Required: `Name`, `Version`, `Author`, `Icon`. Optional: `Description`, `URL`, `License`.
   - `Version` must contain only digits and dots.
   - `URL`, if present, must start with `http://` or `https://`.
   - If `License` is set, the file must exist (DistributionTool checks).
   - There is no `Tags` field **[primary]**.
4. **`icons.json`.**
   - An array of `{path, name, tags}`, all three required; `tags` is an array and may be empty.
   - `path` is relative to `icons/` and must be flat.
   - Every file in `icons/` must be listed, except `x.png` when `x.gif` exists **[primary:
     DistributionTool code]**.
5. **Icon files.**
   - 144 × 144 px.
   - Static: SVG, PNG or JPEG. Animated: GIF or WEBP, by the docs.
   - File names at most 80 characters.
   - Animation: 10–20 fps, at most 5 s, ideally at most 1 MB.
   - One size serves every device **[primary]**.
   - **Animate with GIF plus a same-name PNG.** WEBP has no companion exemption, and Icon Pack Man
     doesn't accept WEBP at all **[primary]**.
6. **Install.**
   - Double-click the file and it lands in the Icon Library. Marketplace packs install directly
     **[primary]**.
   - Folders: `%APPDATA%\Elgato\StreamDeck\IconPacks\` on Windows,
     `~/Library/Application Support/com.elgato.StreamDeck/IconPacks/` on macOS **[real files]**.
7. **Tools.**
   - Icon Pack Man is the documented packager (1.2.4, build 120; the docs sidebar links
     "Packaging" to it).
   - DistributionTool (`-b -i <id>.sdIconPack -o <dir>`) still works and was run in CI in October
     2026.
   - `@elgato/cli` 1.10.4 and `@elgato/schemas` 0.6.0 have no icon-pack support or schema
     **[primary]**.
8. **Animation.**
   - GIFs play on keys when set from a pack, a file or drag-and-drop **[primary]**.
   - A plugin manifest may name GIF state images, but `setImage` cannot send animated images.
   - Plugins may make at most 10 image calls a second **[primary]**.
9. **A user's custom icon replaces a plugin's live display** **[primary]**.
10. **No safe area or title zone is documented**; section 12 proposes one **[inferred]**.

---

## 1. Sources (all fetched 2026-11-06)

| # | Source | Type | Used for |
|---|---|---|---|
| S1 | https://docs.elgato.com/stream-deck/icons/getting-started | primary | formats, 144 px, ≤ 80 chars, 10–20 fps, ≤ 5 s, ≤ 1 MB, "keys and dials", double-click install |
| S2 | https://docs.elgato.com/stream-deck/icons/api ("API Glossary") | primary | file tree, manifest and `icons.json` fields, "reference only — use Icon Pack Man" |
| S3 | https://docs.elgato.com/guidelines/stream-deck/icons | primary | 144 px, formats, ≤ 80 chars, reverse-DNS, content rules, description advice |
| S4 | https://iconpackman.elgato.com/js/app.3dd256bc.js (version constant `{major:1,minor:2,patch:4,build:120}`), with JSZip 3.10.1 in `chunk-vendors.25e4c9f5.js` | primary (Elgato tool code) | validator, export layout, ZIP reader, tag normalization, previews, accepted types |
| S5a | DistributionTool.exe in `L1cardo/WebIcons-StreamDeckIconPack` (2023), disassembled with `objdump` | primary (Elgato binary) | `CheckFilesFromFolderExistInIconsJson` logic, error strings |
| S5b | DistributionTool.exe in `mackenly/simple-icons-stream-deck/script/` (repo commit 2026-10-26; `release.yml` runs it on `windows-latest` every week) | primary binary, real use | same companion-check code; extra strings |
| S6 | `sdk-template.sdIconPack` in https://github.com/AdamJ/stream-deck-icon-packs (README: "example template (downloaded from Elgato)"; license "Copyright 2020 Corsair/Elgato") | primary via a third party | reference files |
| S7 | https://www.elgato.com/ww/en/s/keycreator (FAQ JSON inside the page) | primary | formats incl. animated WEBP, "Animated GIFs … will play on the key", double-click install, custom icons replace plugin displays, submission contents, 70/30 |
| S8 | https://www.elgato.com/uk/en/explorer/products/stream-deck/customize-stream-deck-with-icons-and-icon-packs/ (dateModified 2025-09-05) | primary | 144×144, PNG/JPEG/GIF/BMP/WEBP/animated WEBP, automatic resize, Icon Library steps |
| S9 | https://docs.elgato.com/guidelines/stream-deck/plugins and https://docs.elgato.com/streamdeck/sdk/guides/keys | primary | GIF in the manifest only; `setImage` has no animation; ≤ 10 calls/s; custom image rule |
| S10 | https://docs.elgato.com/maker-console/submitting-products, …/managing-products, https://docs.elgato.com/guidelines/products, …/branding, …/stream-deck/profiles | primary | Marketplace media, icon previews, naming, AI policy, branding |
| S11 | https://edge.elgato.com/egc/sd_content/releasenotes/<ver>.html, 6.9.0–7.6.1 (7.2.0, 7.3.0 and 7.6.2+ return 403) | primary | 7.x icon-library changes |
| S12 | `@elgato/icons` 2.5.1 (npm 2026-07-08, MIT © 2025 Corsair Memory Inc.) and https://docs.elgato.com/resources/icons | primary | glyph library |
| S13 | `@elgato/schemas` 0.6.0 and `@elgato/cli` 1.10.4 (npm, both 2026-10-29); `schemas.elgato.com/streamdeck/{iconpacks,icon-packs,iconpack}/manifest.json` all 404 | primary | no icon-pack schema or CLI support; `State`/`Encoder` image fields |
| S14 | https://www.elgato.com/uk/en/explorer/products/stream-deck/stream-deck-device-comparison/ (dateModified 2026-04-10) | primary | icon packs on every model |
| R1–R4 | jolicoeurneonicons (Icon Pack Man, STORE), GlowGato (STORE, 2025), Hope-IT-Works bootstrap (DistributionTool, DEFLATE, on Marketplace), Nasc pixel art (DEFLATE) | real files | ZIP layout, manifests |
| R5 | https://github.com/dcramer/streamdeck-icons (last commit 2026-10-05) | real files | fflate STORE build with 1980 dates; 56×56 icon; install folders; update workaround; assigned icons copied into profiles |
| R6 | https://github.com/mackenly/simple-icons-stream-deck (on Marketplace) | real files | DistributionTool in CI in 2026; tags with capitals; SVGs with only a 24-unit viewBox |
| R7 | czottmann system-uicons, the Nasc README, chasemsutton `PackPaths.cs` | real files | sideload folders |
| R8 | `profiles-x/` (real exported profiles, 5 sets) | real files | image names and sizes, title settings |

These pages could not be read:

- the legacy `docs.elgato.com/{sdk,en/stream-deck}/icon-packs/*` pages: all 404;
- `web.archive.org`: blocked here;
- `help.elgato.com`: 403, including the 7.4 release notes and article 360028237271;
- Key Creator's iframe and the Figma templates: 403 in the first pass, not retried.

---

## 2. The container: `.streamDeckIconPack`

### 2.1 Format **[primary: S4, S5]**

- **The file is a ZIP.** Icon Pack Man builds it with JSZip
  (`new JSZip(); …; generateAsync({type:"blob"})`, default STORE) and saves it as
  `` `${uid}.streamDeckIconPack` ``.
- **The export creates three folder entries:** `s`, `s+"/icons"` and `s+"/previews"`, where
  `s = uid + ".sdIconPack"`.
  - `previews/` is created even when it is empty.
  - Into `s` it writes `icons.json`, `icon.<ext>`, `manifest.json` and `license.txt`.
- **Reading a ZIP**, Icon Pack Man does the following:
  - It skips entries whose path or base name starts with `__` or `.` (`/^(__|\.)/`), which covers
    `__MACOSX` and `.DS_Store`.
  - It takes the root folder from the first entry.
  - It logs "Note: Filename mismatch: '%s' should be named '%s'" when the ZIP's name (with
    `.streamDeckIconPack` changed to `.sdIconPack`) differs from that folder.
  - It then logs `exists` or `missing` for each of `manifest.json`, `license.txt`, `icons.json`,
    `icons/` and `previews/`.
- **Names that work**: `sebastianrau`'s "Monitor Control Icons.streamDeckIconPack" has a different
  root folder, so mismatched names occur in the wild **[real files]**. Whether the app minds is
  unknown. Name the file `<id>.streamDeckIconPack`.

### 2.2 Real packs **[real files]**

| Pack | Built by | Method | Flags | Folder entries | "Version needed" |
|---|---|---|---|---|---|
| jolicoeurneonicons (2023) | Icon Pack Man | STORE only | 0 | root, `icons/`, `previews/` | 1.0 |
| GlowGato (2025-03-26) | Icon Pack Man | STORE only | 0 | same | 1.0 |
| Hope-IT-Works bootstrap (entries 2024-03 to 2025-06) | DistributionTool | DEFLATE | 0x0A (bit 3: data descriptor) | same | 2.0 |
| Nasc pixel art (2022) | DistributionTool | DEFLATE | 0x0A | same | 2.0 |
| sebastianrau Monitor Control | unknown | STORE + DEFLATE | – | root, `previews/` | – |

- No pack has a ZIP comment, extra fields or a checksum file.
- Every pack uses forward slashes.

### 2.3 Building with Node built-ins **[tested locally]**

`scripts/iconpack-zip-proof.js` uses only `fs`, `path` and `zlib`, with its own CRC-32.

- It writes DEFLATE (`zlib.deflateRawSync`) for files and STORE for folder entries, with the UTF-8
  flag and a fixed 1980-01-01 date.
- Its output, `dl/com.example.tabletdeck-proof.streamDeckIconPack` (1,904 bytes), passes:
  - `unzip -t` ("No errors detected");
  - Python `zipfile`;
  - **JSZip 3.10.1**, the version Icon Pack Man bundles, through
    `verify-iconpacks/scripts/jszip-load.js`. That script repeats the checks of Icon Pack Man's
    ZIP reader: the root folder matches the file name, all five items exist, and both JSON files
    parse.
- **Still not tested: the Stream Deck app itself.** Both STORE and DEFLATE packs from three
  different writers install for real users, so a correct ZIP should be fine **[inferred]**.

Practical rules:

- STORE PNG and GIF, which are already compressed. DEFLATE JSON, SVG and text when that makes them
  smaller.
- `zlib.crc32` exists only from Node 20.15 / 22.2. A table-based CRC works on Node 18, which the
  server must support.
- ZIP64 is not needed.

---

## 3. Folder layout

The docs' "recommended structure" **[primary: S2]**:

```
.
├── icons/
│   └── ...
├── icon.svg
├── icons.json
├── license.txt
└── manifest.json
```

What to generate:

```
<id>.streamDeckIconPack                 (ZIP; file name = folder name)
└── <id>.sdIconPack/
    ├── manifest.json                   required
    ├── icons.json                      required
    ├── icon.png | icon.svg             required; referenced by manifest "Icon"
    ├── license.txt                     write it (Icon Pack Man always does; DistributionTool checks it when "License" is set)
    ├── icons/                          required, FLAT (no sub-folders)
    │   ├── shields-front.svg           static: .svg .png .jpg/.jpeg
    │   ├── quantum-spool.gif           animated: .gif (listed in icons.json)
    │   └── quantum-spool.png           companion of the .gif (NOT listed; exempt only because the .gif exists)
    └── previews/                       optional; at most 3 images are kept by Icon Pack Man
        └── 1-preview.png …
```

Notes:

- **Pack icon.**
  - Icon Pack Man writes it as `icon.<ext>` and sets `"Icon"` to that name **[primary]**.
  - When it loads a ZIP, it finds the pack icon as the first file whose **name** matches
    `^icon.*.(png|jpg|jpeg|svg|gif)$`, wherever it is **[primary]**. So **don't start icon file
    names with `icon`**, or Icon Pack Man may pick the wrong file **[inferred]**.
  - A path into `icons/` works when the folder is copied by hand (czottmann uses
    `"Icon": "icons/create.png"`) **[real files]**.
- **Paths** containing `/./` or `/../` are rejected **[primary]**.

---

## 4. `manifest.json`

### 4.1 Fields

**[primary: S2 for the field table; S4/S5 for the rules]**

| Field | Required | Docs | Enforced by validators |
|---|---|---|---|
| `Name` | yes | "visible in Stream Deck" | non-empty (both tools) |
| `Version` | yes | "typically … 1.0.2 … we recommend following semantic versioning" | non-empty; **only `0-9` and `.`** (both tools). `"1.0"` passes; `"1.0.0-beta"` fails |
| `Author` | yes | "Name of the Maker, visible in Stream Deck" | non-empty (both tools) |
| `Icon` | yes | "Relative path … for best results … 56 × 56 px" | non-empty; file exists; no `/./` or `/../` (both tools) |
| `Description` | no | "visible within Stream Deck; this can differ to Marketplace" | – |
| `URL` | no | "URL to get more info" | if non-empty, starts with `https://` or `http://` (both tools) |
| `License` | no | "Relative path to a txt file". The table spells it "Licence"; the JSON key is `License` | DistributionTool only: "has a license "%s" that does not exist" / "with an invalid path" |

Rules:

- **Write every value as a JSON string.** Icon Pack Man calls string methods (`.empty()`) on
  `Version`, `Name`, `Author` and `URL`. A number would throw, and that ends in "Validation
  failed…" **[primary code; effect inferred]**.
- **Fields that don't exist:**
  - `UUID`: the ID comes from the folder name. Icon Pack Man keeps a `UUID` internally, but its
    `compile()` writes only `Name, Version, Description, Author, URL, Icon, License`, in that
    order **[primary]**.
  - `Tags`: not in the docs and not written by Icon Pack Man. One sideloaded pack has
    `"Tags": "system uicons"`, apparently ignored **[real files]**.
- **Indentation**: Icon Pack Man writes 4 spaces (`JSON.stringify(…, null, 4)`) **[primary]**.
  Formatting doesn't matter to the validators.

### 4.2 Examples

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

Elgato SDK template (S6), verbatim:

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

Real Icon Pack Man export (R1), in its key order:

```json
{
    "Name": "Adam's neon icons",
    "Version": "2.0",
    "Description": "A collection of icons for applications, controls, and websites that I used on my Elgato Stream Deck.",
    "Author": "AdamJ",
    "URL": "https://www.github.com/AdamJ/stream-deck-icon-packs/com.elgato.jolicoeur.sdIconPack",
    "Icon": "icon.png",
    "License": "license.txt"
}
```

Proposed for Tablet Deck.

- The ID is the owner's choice, and **it must never change**.
- The URL is the project site from the repo README, and the license is MIT as in `package.json`.
- `Author` is a placeholder.

```json
{
    "Name": "Tablet Deck HUD Icons",
    "Version": "1.0.0",
    "Description": "HUD-style key icons for Star Citizen ship controls: flight, combat, mining, salvage and more. Static and animated. Works with any Stream Deck action.",
    "Author": "Tablet Deck",
    "URL": "https://nodiecode.github.io/tablet-deck/",
    "Icon": "icon.png",
    "License": "license.txt"
}
```

---

## 5. `icons.json`

### 5.1 Structure **[primary: S2, S4, S5]**

A top-level JSON array. Each entry:

| Key | Required | Docs | Enforced |
|---|---|---|---|
| `path` | yes | "Path to the file, relatives to the icons folder" | non-empty ("Missing path"); file exists; no `/./` or `/../`; **must name a direct child of `icons/`**, because Icon Pack Man matches entries of `icons/` by name |
| `name` | yes | "Display name of the icon" | non-empty ("Missing name … for '%s'"); a missing key throws in Icon Pack Man |
| `tags` | yes | "Searchable tags" | must be an array ("The tags for '%s' is not a json array."; both tools). A tag containing `", "` fails. Empty strings are dropped; `[]` is fine |

The listing rule **[primary: S5 disassembly]**:

- DistributionTool walks `icons/` recursively, skipping only `.` and `..`.
- For each file with no `icons.json` entry:
  - if the extension is `.png` **and** `<same name>.gif` exists on disk → accepted (the companion);
  - otherwise → "The file '%s' has no entry in the icons.json file." and the build fails.

Other notes:

- **Icon Pack Man normalizes tags** when it builds a pack **[primary]**:
  - array tags: lowercased, trimmed, all whitespace removed (`"Road Sign"` → `"roadsign"`);
  - a comma string: also stripped to `[a-z0-9]`.
- DistributionTool accepts capitals and spaces: Simple Icons ships
  `"tags": ["<Title>", "logo"]` **[real files]**.
- Use lowercase, single-word, `[a-z0-9-]` tags **[inferred]**.
- No icon-count limit is documented. One real pack has 2,079 icons **[real files]**.

### 5.2 Examples

Elgato SDK template (S6). `4.gif` is listed; `4.png` exists but is not listed:

```json
[
    { "path": "1.svg", "name": "One", "tags": ["numbers", "firstTag"] },
    { "path": "2.png", "name": "Two", "tags": ["numbers", "otherTag"] },
    { "path": "3.jpg", "name": "Three", "tags": ["numbers"] },
    { "path": "4.gif", "name": "4", "tags": ["numbers", "digit", "road-sign"] }
]
```

Tablet Deck shape. `icons/quantum-spool.png` exists and is not listed:

```json
[
    { "path": "shields-front.svg", "name": "Shields Front", "tags": ["shields", "defense", "combat", "starcitizen"] },
    { "path": "quantum-spool.gif", "name": "Quantum Spool", "tags": ["quantum", "travel", "animated", "starcitizen"] },
    { "path": "landing-gear.svg",  "name": "Landing Gear",  "tags": ["landing", "gear", "flight", "starcitizen"] }
]
```

---

## 6. Icon files

### 6.1 Requirements

| Rule | Value | Source |
|---|---|---|
| Size | **144 × 144 px** ("All images must be 144 × 144 px") | S1, S3 **[primary]** |
| Static | **SVG, PNG, JPEG** | S1, S3 **[primary]**. S2 lists SVG, PNG, JPG, GIF, WEBP |
| Animated | **GIF, WEBP** by the docs; **use GIF** (6.2) | S1, S3 **[primary]** |
| File name | **≤ 80 characters** | S1, S3 **[primary]** |
| Animation | "use a frame rate of 10–20 fps", "keep animated icons ≤5 seconds", "preferably ≤1 MB" | S1 **[primary]** |
| Scaling | "you do not need to provide different sized images for different Stream Deck devices" | S1 **[primary]** |
| Content | no low-res images or screenshots, no copyrighted or 1:1 app images you don't own, nothing hateful, violent or explicit | S3 **[primary]** |

What Icon Pack Man does **[primary: S4]**:

- **It accepts** `png, jpg, jpeg, svg, gif`. The bundle has no WEBP support anywhere.
- **It renames** files: `< > : " / \ | ? * # &` become `_`, and the extension is lowercased.
- **It warns** when width or height isn't a multiple of 36 (`Te = 36`): "To avoid scaling or
  blurred edges…". 144 is 4 × 36.
- **Its GIF check is case-sensitive** (`".gif" === ext`). Keep extensions lowercase.

Elgato's template icons (S6), measured:

- `1.svg`: `width="144" height="144" viewBox="0 0 144 144"`, a circle with `r=64` and
  `stroke-width=16`, so the art reaches the edge;
- `2.png`: 144×144 RGBA;
- `3.jpg`: 144×144;
- `4.gif`: 144×144, **17 frames, 13 cs each (≈ 7.7 fps), 2.21 s, NETSCAPE loop 0, 35,526 bytes**;
- `4.png`: 144×144 RGBA.

Real Marketplace SVGs (Simple Icons) have only `viewBox="0 0 24 24"` plus an inline
`style="…height:576px;width:576px"`, so the app scales unsized SVG **[real files]**. Still, write
`width="144" height="144" viewBox="0 0 144 144"` as the template does.

### 6.2 Animated icons and the PNG companion

- **DistributionTool:** an unlisted `x.png` passes only when `x.gif` is on disk **[primary, from
  the disassembly]**.
  - The code compares the extension against `.png`, builds the `.gif` name, and calls `_wstat64`.
  - The same code shape is in the 2023 and the 2026 binaries.
- **Icon Pack Man, when validating a folder**, logs "Error: The GIF file '%s' should have a
  complementary '%s'" for a listed `.gif` without its `.png`. Validation continues **[primary]**.
- **Icon Pack Man, when exporting**, generates the missing PNG itself **[primary]**:
  - it logs "Creating complementary png for …";
  - it draws the GIF (the browser draws the first frame) onto a 144×144 canvas;
  - it writes `<name>.png` into `icons/`.
- **What the PNG is for**: "icon.gif is the animated icon shown on Stream Deck, and icon.png is
  what appears in the Image Library" **[snippet only, legacy docs]**. So make the PNG the most
  readable frame **[inferred]**.
- **WEBP**: no tool creates or exempts a WEBP companion **[primary]**. A WEBP pack would need its
  PNG listed as a separate icon or left out, and the Icon Library's handling is unknown. **Don't
  ship WEBP.**

---

## 7. Pack icon, license and previews

| Item | Spec | Evidence |
|---|---|---|
| Pack icon | "for best results … 56 × 56 px" | S2 **[primary]**. Real: PNG 56, 144, 288, 800, 891×568; SVG 28×28, 40×32 **[real files]** |
| `license.txt` | plain text | Icon Pack Man always writes it and logs whether it exists in a ZIP; DistributionTool checks it when `License` is set **[primary]**. Template text: "Copyright 2020 Corsair/Elgato / Licensed under the MIT License: http://opensource.org/licenses/MIT" |
| `previews/` | optional: "It is not required, but allows users to get an idea of what's in the iconpack" | both tools **[primary]** |

About previews:

- **What the tools do** **[primary]**:
  - Icon Pack Man shows 3 slots with a 1280×800 placeholder, and **drops anything past 3**.
  - It keeps each preview's file name.
- **What exists** **[real files]**:
  - Elgato's template has `preview_1.png`–`preview_3.png` at 1280×800.
  - Real packs use 1280×800, 1280×640, 1920×960, 832×516, 2000×1544 and 891×568.
- **What the removed docs said**: "1920 x 960 px, PNG, non-transparent", up to 10 **[snippet
  only]**. That may have meant the Marketplace previews.
- **Recommendation** **[inferred]**: 1 to 3 opaque PNGs named `1-preview.png`…, at **1920×960**,
  so the same images can be uploaded to Maker Console. Nothing enforces a size.
- **Where the app shows `previews/`**: not documented.

---

## 8. Validation checklist for a `--check` script

This merges both tools. Messages are verbatim **[primary]**.

1. The folder ends with `.sdIconPack` ("The icon pack should have the extension .sdIconPack.").
2. The ID (folder name minus the extension) is non-empty, and every character is in `a-z 0-9 - .`
   with no `..` ("…contains only lowercase alphanumeric characters (a-z, 0-9), hyphen (-), and
   period (.)."). Also enforce reverse-DNS form ourselves (guideline).
3. `manifest.json` exists and is valid JSON; all values are strings.
4. `Version`: non-empty, only `0-9` and `.`.
5. `Name` and `Author` are non-empty.
6. `URL` is empty or starts with `http://` or `https://`.
7. `Icon` is non-empty, the file exists, and the path has no `/./` or `/../`.
8. If `License` is set, the file exists and the path is valid.
9. `icons.json` exists and parses to an array.
10. Each entry:
    - `path`: non-empty, an existing direct child of `icons/`, path valid;
    - `name`: non-empty;
    - `tags`: an array of strings, none containing `", "`.
11. Every file under `icons/` is listed, except `x.png` where `x.gif` exists. Also fail on
    dot-files and `Thumbs.db` (our rule: DistributionTool may not skip them).
12. Every listed `.gif` has `x.png` (Icon Pack Man's warning; we make it an error).
13. Our own rules on top of Elgato's:
    - PNG and GIF are 144×144 (read the IHDR / the logical screen descriptor);
    - SVG root has `width="144" height="144"`;
    - file names are 80 characters or fewer, lowercase `[a-z0-9-]`, lowercase extension, and don't
      start with `icon`;
    - GIF frame delays are 5–10 cs (10–20 fps), total at most 5 s, size at most 1 MB, loop count 0;
    - no `.webp`;
    - previews: at most 3 files.

On success the tools print "Validating and exporting the %s %s", "%s %s successfully validated"
and "The %s has been successfully exported". DistributionTool's usage line is
`DistributionTool [-h] [-b] [-v] [-i FILE] [-o DIRECTORY]`. It refuses to overwrite: "A file
already exists in the export folder: %s" **[primary]**.

---

## 9. Elgato's tools

- **Icon Pack Man** (https://iconpackman.elgato.com/, 1.2.4 build 120) **[primary]**:
  - The docs' sidebar entry "Packaging" links to it, and the API page says "to create icon packs,
    please use Icon Pack Man".
  - It runs fully in the browser and uses JSZip 3.10.1.
  - It opens a `.sdIconPack` folder, a `.streamDeckIconPack` file or a `.zip`.
- **DistributionTool**, Elgato's native packager for macOS and Windows:
  `DistributionTool -b -i com.example.pack.sdIconPack -o out/` **[primary]**. It still runs in
  Simple Icons' weekly CI on `windows-latest` (commit 2026-10-26) **[real files]**. It can't run on
  Linux CI **[inferred]**.
- **`@elgato/cli` 1.10.4**: no icon-pack code anywhere in the package **[primary]**.
- **No schema**: `@elgato/schemas` 0.6.0 has only `streamdeck/plugins/manifest.json` and
  `layout.json`, and the icon-pack URLs on schemas.elgato.com return 404 **[primary]**.

---

## 10. Install, test, update

- **Testing a single image**: "Add any action … select the down chevron and choose Set from
  file" **[primary: S1]**. Dragging an image onto a key also works **[primary: S7]**.
- **Installing**: "install the icon pack into Stream Deck by double-clicking the file" (S1). "Double-click
  the .streamDeckIconPack file and the Stream Deck app will open and install it automatically"
  (S7) **[primary]**.
- **Using an icon**: the chevron → "Open Stream Deck Icon Library" → the pack → the icon
  **[primary: S1, S8]**. Packs are "for Stream Deck keys and dials" **[primary: S1]**.
- **Marketplace**: "Icon packs downloaded from Marketplace will be installed directly to Stream
  Deck" **[primary: S8]**.
- **Every model in Elgato's comparison table** supports Custom icons and Icon Packs **[primary:
  S14]**.
- **Folders** **[real files: R5, R7, Hope-IT-Works README, `PackPaths.cs`]**:
  - Windows: `%APPDATA%\Elgato\StreamDeck\IconPacks\<id>.sdIconPack\`
  - macOS: `~/Library/Application Support/com.elgato.StreamDeck/IconPacks/<id>.sdIconPack/`
- **Sideloading**: with Stream Deck closed, copy the unzipped folder into `IconPacks/`
  **[real files]**.
- **Assigned icons are copied into the profile** as `Images/<26 chars>Z.png`. Keys never point at
  the pack **[real files: R5, R8]**.
  - Stored sizes vary: keys at 144, 72 or 288; dial icons at 48×48 in `Encoder.Icon`.
  - Updating or removing a pack doesn't change keys that are already set.
- **Updating a pack**: "Stream Deck does not reliably replace a sideloaded icon pack that has the
  same ID" **[real files: R5]**. Workaround:
  1. Quit Stream Deck.
  2. Delete only `<id>.sdIconPack`.
  3. Reopen Stream Deck.
  4. Double-click the new file.
- **Hiding packs** exists. 7.0 "Fixed an issue where hidden icon packs would still appear in the
  icon library" **[primary: S11]**.
- **Plugins** have no documented way to bundle or install a pack. Ship it as its own file
  **[inferred]**.

---

## 11. Marketplace (only if the owner ever lists it)

- **What to submit**: "a packaged .streamDeckIconPack file, which includes your icons, a
  manifest.json …, an icons.json …, and preview images" **[primary: S7]**. Icons are submitted
  through Maker Console; screensavers by email **[primary: S10]**.
- **Media** **[primary: S10]**:
  - thumbnail: 1920×960 PNG;
  - gallery: 3 items required, up to 10, as 1920×960 PNG or 1920×1080 MP4 under 250 MB;
  - "icon previews (Stream Deck icons)" are uploaded in the Media step, size not documented;
  - the 288×288 app icon is for plugins only (its section also says "thumbnails must be static
    PNG images").
- **Details** **[primary: S10]**:
  - Name: ideally 30 characters or fewer, in English, no emojis, "&" rather than "+".
  - Description: at least 250 and at most 1,500 characters; the first 250 must be unformatted;
    list any requirements.
  - Tags (devices, OS, theme, color) are set in Maker Console.
  - Name and monetization "cannot be changed in Maker Console"; changes go to maker@elgato.com.
  - Revenue split: 70/30 **[primary: S7]**.
- **Icon-pack description advice** **[primary: S3]**:
  - list the types of icons;
  - give the total and the color variants;
  - say whether icons are static, animated or blank.
- **Trademarks**: "use language such as 'inspired by' or 'from the world of'". The profile
  guidelines use "Star Citizen Profile, macOS.streamDeckProfile" as a naming example
  **[primary]**.
- **AI**: "products deemed to have been created entirely with AI are not eligible for
  publication"; AI use must be declared **[primary]**. Our own GitHub or website distribution is
  unaffected.
- **Wording**: "Stream Deck", "Stream Deck +" (with the space), "key", "dial", "touch strip",
  "plugin", "Marketplace", "Maker Console" **[primary]**.

---

## 12. Designing key art

### 12.1 Sizes

- **Draw at 144×144**, or as SVG with a 144 viewBox **[primary]**.
  - "Images with larger pixel sizes will be resized automatically… Images with an aspect ratio
    other than 1:1 will be resized to fit the key, with the original aspect ratio unchanged" (S8).
  - "scaling up a small image causes blurring. SVG files avoid this entirely" (S7).
- **Native key sizes**, from `devices.verified.md`:
  - 72 px: the 15-key family;
  - 80: Mini;
  - 96: XL and Neo;
  - 112: + XL;
  - 120: +;
  - 144×112: Studio, not square;
  - 160: Galleon 100 SD, which upscales a 144 source slightly.
- **On a dial**:
  - Real Stream Deck + profiles store the user's dial icon at **48×48** **[real files]**.
  - The built-in strip layouts place `icon` at 48×48 in `$X1`, `$A1`, `$B1` and `$B2`, and at
    24×24 in `$C1` (`icon1`/`icon2`) **[primary, see `sdk.verified.md`]**.
  - Whether a pack icon chosen for a dial appears in that strip slot is **[inferred]**.
- **Consequences** **[inferred]**:
  - lines at least ~6 px thick at 144;
  - no text smaller than a ~20 px cap height at 144;
  - every glyph legible at 48.

### 12.2 Titles

- **The app draws the title over the image**, and the user controls it. The manifest-schema `State`
  fields **[primary: S13]** are:
  - `TitleAlignment`: `bottom | middle | top`;
  - `FontStyle`: `"" | "Bold Italic" | "Bold" | "Italic" | "Regular"`;
  - `FontSize` (number), `FontFamily`, `FontUnderline`, `ShowTitle`, `TitleColor`.

  Each is a default that "Can be overridden by the user in the Stream Deck application".
- **Packs carry no title data** **[primary: S2]**.
- **What real profiles use** **[real files: R8, 1,457 states, 451 without title keys]**:
  - `FontSize`: 12 (652), 9 (271), 10 (54), 6 (28);
  - `TitleAlignment`: bottom (679), middle (295), top (32);
  - `OutlineThickness`: 2 on every state that sets it (1,006).
- **Layout proposal** **[inferred]**:
  - A one-line bottom title covers roughly the bottom 30–36 px at 144.
  - For icons meant to carry a title, keep the glyph in the top ~100 px.
  - For "no-title" icons, center the glyph. dcramer's 2026 pack does this: an 84-px glyph,
    titles off.

### 12.3 Safe area

- **None is documented.** Elgato's template `1.svg` runs to the edge **[primary]**.
- **Proposal** **[inferred]**:
  - backgrounds may be full-bleed;
  - keep meaningful content at least 8 px from each edge at 144;
  - keep corner details inside a ~16 px radius.

### 12.4 Elgato style resources

- **Style advice**: "use similar color palettes, art styles, and icon proportions". GIFs and
  gradients are welcome **[primary: S8]**.
- **`@elgato/icons` 2.5.1** (MIT © 2025 Corsair Memory Inc.): "Mix, match, and curate your own icon
  packs based on our design language" **[primary: S12]**.
  - Grids: `svg/s` 87 files (16 px), `svg/m` 431 (20 px), `svg/l` 1,148 (24 px).
  - 341 `--filled` variants, plus `--color` brand logos. **Skip the brand logos**, for trademark
    reasons.
  - Present: `rocket`, `shield`, `shield-off`, `crosshair`, `compass`, `power`, `power-off`,
    `warning`, `lock`, `lock-open`, `flash`, `microphone`, `microphone-off`, `heat-sink`,
    `starbursts`.
  - **They use `fill="currentColor"`. Replace it with an explicit color** in pack SVGs
    **[inferred]**.
  - Credit with the MIT notice in `license.txt` **[inferred from the license]**.
- **Action-list icons** (plugins only) are a different thing: 20/40 px (category 28/56),
  monochrome, white `#FFFFFF` on transparent **[primary: S9]**.

### 12.5 SVG rendering **[inferred, plus one primary data point]**

- Elgato doesn't document which SVG features the app supports.
- Elgato's samples use plain shapes, paths, fills, strokes and opacity. **The hello-world `key.svg`
  has a live `<text>` element with `font-family:sans-serif`** **[primary]**. None of the 19 sample
  SVGs uses filters, masks, clip paths or gradients.
- **Safe**: paths, basic shapes, groups, transforms, solid fills and strokes, opacity. Gradients are
  probably fine; test them.
- **Avoid or test on a device**: `<text>` (outline it; fonts vary), filters, masks and clip paths,
  external `<image>`, `<style>` blocks.
- **Glows and other HUD effects: use PNG.**

---

## 13. Animation, end to end

| Where | Animated? | How | Source |
|---|---|---|---|
| Icon pack | yes | GIF plus a same-name PNG; 10–20 fps, ≤ 5 s, ≤ 1 MB | S1, S5, S6 **[primary]** |
| User image on a key | yes | "Animated GIFs are fully supported and will play on the key"; formats include animated WEBP | S7, S8 **[primary]** |
| Plugin `States[].Image` | yes, GIF | "animated (GIF) images may also be specified within the manifest, but cannot be used when programmatically updating actions" | S9 **[primary]** |
| Plugin `setImage` | no | "The `setImage` function does not support animated image formats, such as GIF"; send frames yourself, at most 10 calls/s | S9 **[primary]** |
| `Encoder.Icon` (dial canvas in the app) | no | PNG or SVG only | S13 **[primary]** |
| Touch strip | only plugin `setFeedback` frames, at most 10/s | "touch strips are not intended for rendering high frame rate videos" | S9 **[primary]** |
| Profiles | a GIF on a key is presumably stored like any image | – | **[inferred]**; no GIF in the real profiles |
| Screensavers | a separate Marketplace product (email submission); on Neo, MK.2, +, XL and Studio per the comparison table | – | S10, S14 **[primary]** |

GIF generation with Node built-ins **[inferred]**:

- **Format limits**: 256 colors per frame and 1-bit transparency. Render animated icons on an
  opaque dark background.
- **Timing**: delays are in centiseconds, so 10–20 fps means 5–10. Set the NETSCAPE loop count to
  0.
- **What has to be written**:
  - an LZW encoder plus palette quantisation (~150 lines);
  - PNG needs only `zlib.deflateSync`, a CRC and three chunk types;
  - rasterising vector art needs our own small rasteriser, or a build-only devDependency (an owner
    decision under AGENTS.md).
- **Static icons can stay SVG.** Only the GIFs, their companion PNGs and maybe the pack icon need
  pixels.
- **Keep animations few and short.** "Large animated icons can affect system performance"
  **[primary: S1]**.

---

## 14. Key Creator and other Elgato assets

- **Key Creator**: "Design icons for your Stream Deck, right here in your browser. No account
  needed." It is embedded from `https://keycreator.elgato.com/key-creator/index.html`, and the
  app's "Create Your Own" opens it **[primary: S7, S8]**. The pipeline Elgato describes is
  "Design your icons → Package using IconPackMan → Share or sell on Marketplace" **[primary]**.
- **Formats the app accepts** **[primary]**:
  - the Key Creator FAQ: "SVG, PNG, JPG, GIF, WEBP, and animated WEBP … 144 × 144px at a 1:1 ratio.
    SVG is recommended";
  - the Explorer guide: "PNG, JPEG, GIF, BMP, WEBP, Animated WEBP".
- **Custom icons and plugins**: "When you apply a custom icon, it replaces that display" (S7). The
  SDK puts it as "The image can only be set by the plugin when the user has not specified a custom
  image" **[primary]**.
  - **Consequence for Tablet Deck**: profiles meant for the live plugin must not put pack images
    on plugin keys. Profiles for the built-in Hotkey action carry the images.
- **Other resources** linked from the docs: Elgato Icons (`/resources/icons`), Badges, the Figma
  "Stream Deck Templates" and the Media Room **[primary]**.

---

## 15. How the pack relates to profiles and the plugin

- **The pack stands alone.** It installs into the Icon Library and works with any action,
  including Hotkey **[primary]**.
- **Profiles embed their own copies of images**, so they work without the pack installed **[real
  files]**.
- **The plugin uses its own manifest images** (GIF allowed) plus `setImage` (no animation)
  **[primary]**.
- **Render all three from one set of source art** **[inferred]**.

---

## 16. What's new in 2025–2026 (icon-related)

I read every edge.elgato.com page from 7.0.0 to 7.6.1; 7.2.0 and 7.3.0 return 403. No change to
the pack format appears in any of them **[primary]**. The latest version is 7.6.x; there is no 7.7
page.

| Version | Icon-related change | Source |
|---|---|---|
| 7.0.0–7.0.3 | "Fixed an issue where hidden icon packs would still appear in the icon library." | **[primary]** |
| 7.1 | Refreshed desktop app icon (not relevant) | **[primary]** |
| 7.4 (1 April 2026) | "only one icon pack could be installed when multiple were present", fixed | **[snippet only]**: help-center 403, not on the edge page |
| 7.4.2 (May 2026, inferred from a promo on the page) | "Fixed a bug where pressing Delete while the Icon Library search field was focused would clear a key's custom icon" | **[primary]** |
| 7.6 / 7.6.1 | "The background library now includes backgrounds sized for the Stream Deck Neo Infobar"; Neo Infobar actions (SDK 3.0) | **[primary]** |

Elsewhere:

- The icon docs moved to `docs.elgato.com/stream-deck/icons/*`. The old
  `/sdk/icon-packs/*` and `/en/stream-deck/icon-packs/*` pages return 404, and the new pages
  dropped the companion-PNG and preview text **[primary]**.
- `@elgato/icons` reached 2.5.1 (2026-07-08) **[primary]**.
- `@elgato/cli` reached 1.10.4 and `@elgato/schemas` 0.6.0 (2026-10-29); neither covers icon packs
  **[primary]**.
- The Explorer guide was updated 2025-09-05, and the device comparison 2026-04-10 **[primary]**.

---

## 17. Open questions

1. **Does the Stream Deck app (7.6) import a ZIP built with Node's own modules?** The ZIP passes
   `unzip`, Python and JSZip 3.10.1, but the app itself wasn't tested.
2. **How does the Icon Library treat animated WEBP**, with or without a PNG? DistributionTool would
   reject an unlisted companion. Avoided by shipping GIF only.
3. **Does DistributionTool's directory lister hide dot-files?** If it doesn't, a stray `.DS_Store`
   in `icons/` fails validation. Avoided by generating a clean tree.
4. **What does the app do with `previews/`**, and what size does Maker Console want for "icon
   previews"? The old 1920×960 figure is snippet only.
5. **Which SVG features does the app's renderer support?** Filters, masks, `<style>` and font
   fallback for `<text>` are all unknown.
6. **Exact title metrics**: the pixel height of each font size per device, and the outline width.
7. **Physical safe area per device.**
8. **Do GIFs animate on Stream Deck Mobile, the Neo and the + strip**, and how fast does the
   hardware actually refresh? The comparison table only confirms icon-pack support on every model.
9. **Does a pack icon chosen for a dial show in the touch-strip layout's `icon` slot?** It is stored
   at 48×48 as `Encoder.Icon`, but whether a GIF survives there is unknown.
10. **Is the 7.4 multiple-pack install fix real?** Seen in a snippet only.
11. **Does the app accept a file name that doesn't match the root folder?** Real packs do this, but
    it's unverified.
12. **Which product uses DistributionTool's 2026 "must be in reverse-DNS format" message?** It
    wasn't traced to the icon-pack path.

---

## 18. Generator spec for Tablet Deck

**Output**: `dist/streamdeck/<id>.streamDeckIconPack`, a ZIP whose single root folder is
`<id>.sdIconPack/`, containing:

- `manifest.json`: string values, keys in Icon Pack Man's order (`Name, Version, Description,
  Author, URL, Icon, License`), indented 4 spaces.
- `icons.json`: `[{ "path", "name", "tags": [] }]`, with one entry per static icon and per `.gif`,
  and no entries for companion PNGs.
- `icon.png`, 56×56 (or `icon.svg`).
- `license.txt`: Tablet Deck's MIT license, plus the `@elgato/icons` MIT notice if any glyph is
  used.
- `icons/<slug>.svg|png`: 144×144. In SVG, `width`/`height` are 144 and every fill is explicit.
- `icons/<slug>.gif` + `icons/<slug>.png`:
  - 144×144, opaque background;
  - delay 5–10 cs, NETSCAPE loop 0, at most 5 s, at most 1 MB;
  - the PNG is the most readable frame.
- `previews/1-preview.png` …: optional, at most 3, opaque 1920×960 PNG.

**Rules**:

- The ID is chosen once, lowercase reverse-DNS, and never changes.
- Slugs match `^[a-z0-9][a-z0-9-]{0,75}$`, don't start with `icon`, and use lowercase extensions.
- `icons/` is flat, with no dot-files.
- No WEBP.
- `--check` runs the section 8 list.
- The ZIP is reproducible: sorted entries, fixed 1980-01-01 dates, folder entries for the root,
  `icons/` and `previews/`. PNG and GIF are STORED; JSON, SVG and text are DEFLATED when smaller.

**Docs for users**:

- Install: double-click the file.
- Update: quit Stream Deck, delete `IconPacks/<id>.sdIconPack`, reopen it, double-click the new
  file. Keys keep the old image until the icon is chosen again.
- Don't put pack icons on live-plugin keys.
