# Stream Deck hardware lineup, SDK device types and profile model IDs (as of 2026-11-06)

Research for the Tablet Deck Stream Deck pack: icon pack, generated profiles for every model,
and an optional plugin (raw WebSocket, no `@elgato/streamdeck`).

Confidence tags used throughout:

- **[C]** confirmed in a primary source (docs.elgato.com, an official `elgatosf` repo, or the official npm packages `@elgato/schemas` / `@elgato/streamdeck`)
- **[R]** seen in real files or real code (third-party repos and libraries, retailer listings)
- **[I]** inferred from the facts above; not stated anywhere
- **[?]** unconfirmed or conflicting; don't build on it without testing on real hardware

Versions checked: `@elgato/streamdeck` 3.0.4 (published 2026-10-29), `@elgato/schemas` 0.6.0
(2026-10-29), `elgatosf/schemas` main, `elgatosf/streamdeck` main (commit `9d9636e`, 2026-11-05),
`elgatosf/streamdeck-plugin-samples` main (commit `8cc82ba`, 2026-05-26),
`@elgato-stream-deck/core` 7.8.0 (2026-10-03). Latest Stream Deck app: 7.6 (22 Sept 2026).

---

## 1. Short version (what the generator needs)

- The SDK `DeviceType` enum runs **0 to 13**. 13 is **Stream Deck + XL**; 12 is **Galleon 100 SD**;
  11 is **Virtual Stream Deck**. Nothing newer exists in the enum on `elgatosf/schemas` main
  or in `@elgato/schemas` 0.6.0 [C].
- **Key art:** the SDK only documents **72×72 and 144×144 (@2x)** for key images, in PNG, SVG
  or (manifest only) GIF [C]. The app scales to each device. Real panel sizes run from
  72×72 (15-key) to 160×160 (Galleon), and Studio keys aren't square (144×112) [C/R]. **Draw
  at 144×144 (or SVG) and let the app scale.**
- **Dial/touch strip canvas:** one **200×100** layout per dial on Stream Deck + (800×100 strip,
  4 dials) and on Stream Deck + XL (1200×100 strip, 6 dials). Encoder backgrounds are
  200×100 and 400×200 @2x. **Plugins can't draw across the whole strip** [C].
- **Neo Infobar:** plugins can draw on it from **Stream Deck 7.6** with `"Controllers": ["Neo"]`
  actions and a **232×50** layout. These actions get no input events. The Neo's two
  capacitive touch points do paging only; there's no plugin API for them [C/I].
- **Profile model IDs** (`Device.Model` in an exported `.streamDeckProfile`), confirmed in
  Elgato's own sample profiles [C]:
  `20GAA9901` Stream Deck (15-key), `20GAI9901` Mini, `20GAT9901` XL, `20GBD9901` Stream Deck +,
  `20GBJ9901` Neo, `VSD2/WiFi` Stream Deck Mobile.
  Seen in real files [R]: `20GBA9901` MK.2 (USB PID 128 = 0x0080), `20GBX9901` Stream Deck + XL
  (USB PID 198 = 0x00C6), plus legacy `VSD/WiFi` (Mobile, old v1 profiles).
  Pedal, Studio, Galleon, Virtual Stream Deck, Corsair and SCUF profile model strings are **not confirmed**.
- **Studio:** Elgato's profile docs say Stream Deck Studio "runs on Companion and does not
  currently support Stream Deck app profiles". **Don't generate a Studio profile** [C].
- Bundled profiles are keyed by `DeviceType` in the plugin manifest, not by model string [C].
  Elgato ships one sample profile per type (0, 1, 2, 3, 7, 9).

---

## 2. Master matrix

"Key px" is the native panel pixel size the device firmware takes (HID level). A **plugin**
never sends at that size: it sends 72/144 px or SVG and the app scales (section 4).
"Grid" is columns × rows, which is how the SDK's `size` and profile coordinates `"col,row"` work.

| Model (official name) | SDK `DeviceType` | Released | Keys / grid (cols × rows) | Key px (HW) | Dials | Touch strip / other display | Plugin-drawable surfaces | Profile `Device.Model` | USB VID:PID |
|---|---|---|---|---|---|---|---|---|---|
| Stream Deck (original 15-key, gen 1) | 0 [C] | 2017 [I] | 15, 5×3 [C] | 72×72 (own legacy protocol) [R] | – | – | keys | `20GAA9901` [C] | 0FD9:0060 [R] |
| Stream Deck (2019 revision) | 0 [C] | 2019 [I] | 15, 5×3 [C] | 72×72 JPEG, rot 180° [C] | – | (whole panel 480×272) | keys | `20GAA9902` (HW model [C]; seen in ScriptDeck mapping [R]) | 0FD9:006D [C] |
| Stream Deck MK.2 | 0 [C] | 2021 [I] | 15, 5×3 [C] | 72×72 [C] | – | – | keys | `20GBA9901` [R] (HW model [C]) | 0FD9:0080 [C] |
| Stream Deck Scissor Keys (MK.2 Scissor) | 0 [C] (docs list it under 0; the 7.1 SDK fixed its type mapping) | May/June 2025 [R] | 15, 5×3 [C] | 72×72 [C] | – | – | keys | `20GBL9901` = HW model [C]; profile string not seen [?] | 0FD9:00A5 [C] |
| Stream Deck Module 15 / 15 Scissor | 0 [I] | May 2025 [R] | 15, 5×3 [C] | 72×72 [C] | – | – | keys | HW model `20GBA9901` [C]; profile not seen [?] | 0FD9:00B9 [C] / 0FD9:00E4 [R] |
| Stream Deck Mini (incl. 2022, Discord Edition, Module 6) | 1 [C] | 2018; 2022 rev; Discord ed. Nov 2025 [R] | 6, 3×2 [C] | 80×80 **BMP**, rot 90° CW [C] | – | – | keys | `20GAI9901` [C] (2022 rev HW model `20GAI9902` [C]) | 0063, 0090 (2022), 00B3 (Discord), 00B8 (Module 6) [C] |
| Stream Deck XL (incl. 2022, Module 32) | 2 [C] | May 2019 [R]; 2022 rev; Module May 2025 | 32, 8×4 [C] | 96×96 JPEG, rot 180° [C] | – | (whole panel 1024×600) | keys | `20GAT9901` [C] (2022 rev and Module 32 HW model `20GAT9902` [C]) | 006C, 008F (2022), 00BA (Module 32) [C] |
| Stream Deck Mobile (iOS/Android app) | 3 [C] | May 2019; Mobile 2.0 in 2023 [R] | Free: 6. Pro: presets or custom up to **8×8 = 64**; iPad: two keypads side by side, up to 128 [R] | phone renders | – | – | keys | `VSD2/WiFi` [C]; legacy `VSD/WiFi` [R] | n/a |
| Corsair G-Keys (K55/K95/K100, Vanguard 96 etc.) | 4 [C] | – | 6 G-keys, no screens [C] | none | – | none; mapped keys appear in the app's floating Action Bar [C] | none (no images) | [?] | Corsair |
| Stream Deck Pedal | 5 [C] | Jan 2022 [R] | 3 pedals (3×1 [I]) [C] | none (no display) | – | – | none (no images) | `20GBF9901` is the HW model per retailer R/N [R]; profile string not seen [?] | 0FD9:0086 [R] |
| Corsair Voyager laptop | 6 [C] | 2022 [I] | SDK: "10 buttons in a horizontal line" / "up to 10 capacitive keys"; Elgato compatibility page: "6 S-Keys" [C, conflicting] | none | – | – | none | [?] | built-in |
| Stream Deck + | 7 [C] | 2022 [I] | 8, 4×2 [C] | 120×120 JPEG, no rotation [C] | 4, rotate + push [C] | touch strip **800×100**, touch: tap/press(long)/flick [C]; full LCD 800×480 [C] | keys + 4 encoder layouts of **200×100** [C] | `20GBD9901` [C] | 0FD9:0084 [C] |
| SCUF controller (Envision / Envision Pro / Pro v2) | 8 [C] | 2023 [I] | 5 G-keys [C] | none | – | – | none | [?] | – |
| Stream Deck Neo | 9 [C] | 2023 [I] | 8, 4×2 [C] | 96×96 JPEG, rot 180° [C] | – | Infobar window **248×58** (not touch) [C]; 2 capacitive touch sensors (paging), each with a 96×16 RGB sensor image at HID level [C]; full LCD 480×320 [C] | keys + **Infobar layout 232×50** (Stream Deck **7.6+**) [C]; touch points not drawable [I] | `20GBJ9901` [C] | 0FD9:009A [C] |
| Stream Deck Studio (1U rack) | 10 [C] | Sept 2024 [I] | 32, **16×2** [C] | **144×112** (not square) [R] | 2 (one each side), 360°, push, LED ring with 24 steps [C/R] | no touch strip; NFC reader; Ethernet PoE+ and USB-C [C] | keys [I]; dial and LED feedback through the SDK not documented [?] | HW model `20GBO9901` per retailer R/N [R]; **no Stream Deck app profile support** [C] | 0FD9:00AA [R] |
| Virtual Stream Deck (on-screen) | 11 [C] | Stream Deck 7.0, 2025 [C/R] | 1 to 64 keys, up to **8×8**; several panels [C] | on-screen | – | – | keys | [?] (streamdeck-mcp reports `"UI Stream Deck"` / `"AI Stream Deck"` emulator strings; their link to VSD is unverified) | n/a |
| Corsair GALLEON 100 SD (keyboard) | 12 [C] | CES Jan 2026; ships 29 Jan 2026; support added in Stream Deck 7.2.0 (6 Jan 2026) [R] | 12, **3×4** [C] | 160×160 [R] | 2 physical dials with push; holding a dial 3 s switches layer, giving 4 dial actions [R] | **5" LCD** that shows the dial functions and other info; screen region 720×384 [R] | keys [C]; dial actions on the screen: canvas size **not documented** [?] | [?] | Corsair 1B1C:2B18 [R] |
| Stream Deck + XL | 13 [C] | announced 3 Mar 2026; support in Stream Deck 7.3.0 (3 Mar 2026) [R] | **36, 9×4** [C] | 112×112 JPEG, rot 90° CCW [C] | **6**, 360°, push [C] | touch strip **1200×100** (161×14 mm), touch [C]; full LCD 1280×800 [C] | keys + 6 encoder layouts of **200×100** [C] | `20GBX9901` [R] (Elgato's HID page says `20GBD9901`, which looks like a copy error; see section 7) | 0FD9:00C6 [C] |

Works with the Stream Deck app but missing from the `DeviceType` enum (type reported to plugins unknown) [?]:
**Yamaha CC1 USB Controller** (12 LCD keys; its fader and knobs aren't Stream Deck controls),
**Corsair Scimitar Elite Wireless SE** mouse (12 programmable keys),
**Nightsword V2 Wireless SD** mouse (8 programmable buttons) and
**Vanguard Air 99** keyboard (6 SD keys). These come from Elgato's compatible-hardware page [C].
Elgato's profile docs also list "Corsair Scimitar Elite: 12 (G Keys)" and "Corsair K100: 1 (G Keys)" as devices with profile support [C].
The mice and keyboards are probably reported as type 4 (Corsair G-Keys) [I].

Not an input device: **Stream Deck Network Dock** (SKU 10GBW9901, 2025; supported from Stream Deck 7.0.1,
23 Sept 2025) runs a deck over Ethernet. It's not compatible with the gen-1 Stream Deck
(`20GAA9901`) or Studio (`20GBO9901`), and retailers disagree about the Pedal (`20GBF9901`) [R].

Retail SKUs follow the hardware model with `10G` in place of `20G`: `10GBD9901` Stream Deck +, `10GBX9901` + XL,
`10GBJ9901` Neo, `10GBF9901` Pedal, `10GBO9901` Studio, `10GAT9901` XL, `10GBA9901` MK.2 [R]. Don't
confuse the two: profiles carry the **20G** model.

---

## 3. SDK `DeviceType` enum (verbatim source)

From `elgatosf/schemas` `src/streamdeck/plugins/device-type.ts` (main), identical in `@elgato/schemas`
0.6.0 `dist/streamdeck/plugins/device-type.d.ts`. `@elgato/streamdeck` 3.0.4 re-exports it [C]:

```ts
export enum DeviceType {
	/** Stream Deck, comprised of 15 customizable LCD keys in a 5 x 3 layout. */
	StreamDeck = 0,
	/** Stream Deck Mini, comprised of 6 customizable LCD keys in a 3 x 2 layout. */
	StreamDeckMini = 1,
	/** Stream Deck XL, comprised of 32 customizable LCD keys in an 8 x 4 layout. */
	StreamDeckXL = 2,
	/** Stream Deck Mobile, for iOS and Android. */
	StreamDeckMobile = 3,
	/** Corsair G Keys, available on select Corsair keyboards. */
	CorsairGKeys = 4,
	/** Stream Deck Pedal, comprised of 3 customizable pedals. */
	StreamDeckPedal = 5,
	/** Corsair Voyager laptop, comprising 10 buttons in a horizontal line above the keyboard. */
	CorsairVoyager = 6,
	/** Stream Deck +, comprised of 8 customizable LCD keys in a 4 x 2 layout, a touch strip, and 4 dials. */
	StreamDeckPlus = 7,
	/** SCUF controller G keys, available on select SCUF controllers, for example SCUF Envision. */
	SCUFController = 8,
	/** Stream Deck Neo, comprised of 8 customizable LCD keys in a 4 x 2 layout, an info bar, and 2 touch points for page navigation. */
	StreamDeckNeo = 9,
	/** Stream Deck Studio, comprised of 32 customizable LCD keys in a 16 x 2 layout, and 2 dials (1 on either side). */
	StreamDeckStudio = 10,
	/** Virtual Stream Deck, comprised of 1 to 64 action (on-screen) on a scalable canvas, with a maximum layout of 8 x 8. */
	VirtualStreamDeck = 11,
	/** High-performance gaming keyboard, with a built-in Stream Deck comprised of 12 customizable LCD keys in a 3 x 4 layout, an LCD screen, and 2 dials. */
	Galleon100SD = 12,
	/** Stream Deck + XL, comprised of 36 customizable LCD keys in a 9 x 4 layout, a touch strip, and 6 dials. */
	StreamDeckPlusXL = 13
}
```

The docs' Devices page has the same table and lists **"Stream Deck, Stream Deck Scissor Keys"** under 0 [C].
The manifest reference allows `Profiles[].DeviceType: 0 … 13` [C].

When the enum entries were added (SDK changelog [C]):

| App version | Added |
|---|---|
| 6.6 | Stream Deck Neo (9), SCUF controllers (8) |
| 6.9 | Stream Deck Studio type (10) |
| 7.0 | Virtual Stream Deck type (11); `deviceDidChange` event; "Device `size` now reflects the visual size of the device" |
| 7.1 | "Fixed device type mapping for Stream Deck Scissor Keys and Corsair keyboards" |
| 7.6 | Neo Infobar actions; `Neo` controller in the manifest |

Galleon (12) and + XL (13) aren't in the SDK changelog. The app release notes add Galleon
in 7.2.0 (6 Jan 2026) and + XL in 7.3.0 (3 Mar 2026) [R: help.elgato.com search snippets; the pages
return 403 to fetches].

### How a raw-WebSocket plugin sees a device

Event shape from `@elgato/streamdeck` 3.0.4 `dist/api/events/device.d.ts` and `dist/api/device.d.ts` [C]
(the values below are illustrative [I]):

```json
{
  "event": "deviceDidConnect",
  "device": "7B8C2C9B4F0D4E1A9E0C1B2A3D4E5F60",
  "deviceInfo": {
    "name": "Stream Deck +",
    "type": 7,
    "size": { "columns": 4, "rows": 2 }
  }
}
```

`size` is "Number of action slots, excluding dials / touchscreens" [C]. `deviceDidChange` (7.0+)
has the same shape. `deviceDidDisconnect` has only `device`. The registration info passed at
startup carries `devices: [{ id, name, type, size }]`, which can include devices that aren't
connected [C].

---

## 4. What a plugin can draw on, and at what size

| Surface | Controller in manifest | Canvas | Image specs | Source |
|---|---|---|---|---|
| LCD key | `"Keypad"` | The app scales to each device's key | `States[].Image`: **GIF, PNG or SVG**, **72×72 and 144×144 (@2x)**. `setImage` at runtime: file path, base64 data URL or SVG string; SVG is recommended; JPG/PNG/WEBP. **`setImage` "does not support animated image formats, such as GIF"** | [C] manifest ref, keys guide |
| Dial icon (in the app UI) | `"Encoder"` | – | `Encoder.Icon`: PNG/SVG, 72×72 and 144×144 | [C] |
| Touch strip segment (Stream Deck + / + XL) | `"Encoder"` | **200×100 per dial**; "Plugins cannot render across the entire touch strip" | `Encoder.background`: PNG/SVG, **200×100 and 400×200 (@2x)**; layouts `$X1 $A0 $A1 $B1 $B2 $C1` or a custom layout JSON | [C] dials guide, layouts ref |
| Neo Infobar | `"Neo"` (7.6+) | **232×50** (hardware window is 248×58) | layout JSON only; no input events; call `setFeedbackLayout` on every `willAppear` | [C] Neo Infobar guide |
| Neo touch points | – | – | not exposed to plugins | [I] |
| Studio dials / LED rings | – | – | no SDK docs | [?] |
| Galleon 5" screen (dial area) | probably `"Encoder"` [I] | not documented | – | [?] |
| Pedal, G-keys, S-keys, SCUF | `"Keypad"` | no display | images aren't shown on the device | [C/I] |

Native key sizes, so you know how much the app will scale a 144 px image [C, except Studio and Galleon R]:
72 (15-key family), 80 (Mini), 96 (XL, Neo), 112 (+ XL), 120 (+), 144×112 (Studio), 160 (Galleon).
A 144×144 source is downscaled on everything except Galleon, which upscales it slightly. Studio's
non-square key means a square image is fitted or cropped somehow; how isn't documented [?].

Neo Infobar layout, verbatim from the docs [C]:

```json
{
    "$schema": "https://schemas.elgato.com/streamdeck/plugins/layout.json",
    "id": "neo",
    "controller": "Neo",
    "items": [
        { "type": "pixmap", "key": "leading", "rect": [10, 15, 20, 20] },
        { "key": "title", "type": "text", "rect": [40, 15, 152, 20], "font": { "size": 15 } },
        { "key": "trailing", "type": "pixmap", "rect": [202, 15, 20, 20] }
    ]
}
```

Encoder (touch strip) custom layout, verbatim from the docs [C]:

```json
{
    "$schema": "https://schemas.elgato.com/streamdeck/plugins/layout.json",
    "id": "custom-layout",
    "controller": "Encoder",
    "items": [
        { "type": "pixmap", "key": "leading", "rect": [10, 40, 20, 20] },
        { "key": "title", "type": "text", "rect": [40, 40, 120, 20], "font": { "size": 20 } },
        { "key": "trailing", "type": "pixmap", "rect": [170, 40, 20, 20] }
    ]
}
```

Layout rules [C]: every item needs a unique `key`, a `type` and a `rect`; items must stay
within the bounds; items on the same `zOrder` must not overlap. If any of these fail, nothing renders.

Manifest `Controllers` type (`@elgato/schemas` manifest `latest.d.ts`) [C]:
`Controllers?: [Controller, Controller?, Controller?]` where `Controller = "Encoder" | "Keypad" | "Neo"`.
Docs: "Keypad refers to a standard action on a Stream Deck device … Encoder refers to a dial /
touchscreen on the Stream Deck + … Neo refers to the infobar found on Stream Deck Neo
(available from Stream Deck 7.6)."

---

## 5. Profile `Device.Model` identifiers

### 5.1 Evidence from official Elgato sample profiles [C]

`elgatosf/streamdeck-plugin-samples` (and the copy in `elgatosf/streamdeck`)
`lights-out/com.elgato.lightsout.sdPlugin/*.streamDeckProfile`. Each one is a ZIP with
`<UUID>.sdProfile/manifest.json` plus `Profiles/<PAGEID>/manifest.json` and `Images/`. I read them
directly. The plugin manifest pairs each file with its `DeviceType`:

| File | Manifest `DeviceType` | `Device.Model` | Page controllers | Used key coordinates |
|---|---|---|---|---|
| `sd.streamDeckProfile` | 0 | `20GAA9901` | Keypad | `0,0` … `4,2` (5×3) |
| `sd-mini.streamDeckProfile` | 1 | `20GAI9901` | Keypad | `0,0` … `2,1` (3×2) |
| `sdxl.streamDeckProfile` | 2 | `20GAT9901` | Keypad | `0,0` … `7,3` (8×4) |
| `sd-mobile.streamDeckProfile` | 3 | `VSD2/WiFi` | Keypad | `0,0` … `7,7` (8×8) |
| `sdp.streamDeckProfile` | 7 | `20GBD9901` | Keypad + **Encoder** | `0,0` … `3,1` (4×2) |
| `sd-neo.streamDeckProfile` | 9 | `20GBJ9901` | Keypad + **Neo** | `0,0` … `3,1` (4×2) |

Coordinates are `"column,row"`, starting at 0 at the top left.

Top-level manifest of `sdp.streamDeckProfile` (verbatim):

```json
{"Device": {"Model": "20GBD9901", "UUID": ""}, "Name": "Lights Out",
 "Pages": {"Current": "37aea345-7227-420a-bff0-988d1b05aeaa",
           "Default": "75560e74-1759-4cf4-8cfb-91d738b906c4",
           "Pages": ["37aea345-7227-420a-bff0-988d1b05aeaa"]},
 "Version": "2.0"}
```

Page manifest of the Neo profile (actions cut to one):

```json
{
 "Controllers": [
  { "Actions": { "0,0": {
      "ActionID": "70f2d0c3-3570-4242-b48c-1e26158dae80",
      "LinkedTitle": true, "Name": "Reset", "Settings": {}, "State": 0,
      "States": [ { "FontFamily": "", "FontSize": 9, "FontStyle": "", "FontUnderline": false,
                    "OutlineThickness": 2, "ShowTitle": true, "TitleAlignment": "middle",
                    "TitleColor": "#ffffff" } ],
      "UUID": "com.elgato.lightsout.reset" } },
    "Type": "Keypad" },
  { "Actions": {}, "Type": "Neo" }
 ],
 "Icon": "",
 "Name": ""
}
```

The Stream Deck + page has the same shape, with `{ "Actions": {}, "Type": "Encoder" }` as its second controller.

### 5.2 Other real-world evidence [R]

- `danexrc/Streamdeck-Profiles` (8 exported profiles, 2024): all `"Device": {"Model": "20GAT9901", "UUID": ""}`,
  `"Version": "2.0"`. The "(15 Key)" files are XL exports too, so file names prove nothing; read the Model.
- `verygoodplugins/streamdeck-mcp` test fixtures (2026) copy on-disk `ProfilesV3` manifests that carry
  `"Version": "3.0"` and a real device UUID of the form `@(1)[VID/PID/serial]`:
  - `"Model": "20GBA9901", "UUID": "@(1)[4057/128/…]"`: VID 4057 = 0x0FD9, PID 128 = 0x0080 = **MK.2**
  - `"Model": "20GBD9901", "UUID": "@(1)[4057/132/…]"`: PID 132 = 0x0084 = **Stream Deck +**
  - `"Model": "20GBX9901", "UUID": "@(1)[4057/198/…]"`: PID 198 = 0x00C6 = **Stream Deck + XL**

  That project's own name table is **partly wrong**. It calls `20GBA9901` "Original" and `20GAA9901` "MK.2",
  which is the reverse of Elgato's HID docs and the Elgato sample above. It also lists `20GAI9501` (Mini) and
  `20GBA9902` (XL rev2), which nothing corroborates. Trust its raw Model/PID pairs, not its labels.
- ScriptDeck (PowerShell) and `streamdeck_prof` (Ruby), both for the old v1 profile format with a top-level
  `"DeviceModel"` key and `"Version": "1.0"`: `20GAI9901` Mini, `20GAT9901` XL, `20GAA9901` / `20GAA9902` Stream Deck,
  `VSD/WiFi` Mobile.
- `data-enabler/streamdeck-profile-generator` types the v2 top-level manifest as
  `{ Device?: { Model, UUID: '' }, Name, Pages: { Current, Pages[] }, Version: '2.0' }`.

### 5.3 Model ID → device

| `Device.Model` | Device | `DeviceType` | Confidence |
|---|---|---|---|
| `20GAA9901` | Stream Deck (15-key; Elgato's own type-0 sample) | 0 | [C] |
| `20GAA9902` | Stream Deck 2019 revision | 0 | [C] HW model; [R] in profiles |
| `20GBA9901` | Stream Deck MK.2 (also the HW model of Module 15) | 0 | [C] HW model; [R] in profiles |
| `20GBL9901` | Stream Deck Scissor Keys | 0 | [C] HW model; not seen in a profile [?] |
| `20GAI9901` | Stream Deck Mini (also Mini Discord, Module 6) | 1 | [C] |
| `20GAI9902` | Stream Deck Mini 2022 | 1 | [C] HW model; not seen in a profile [?] |
| `20GAT9901` | Stream Deck XL | 2 | [C] |
| `20GAT9902` | Stream Deck XL 2022 / Module 32 | 2 | [C] HW model; [R] streamdeck-mcp says it's observed |
| `VSD2/WiFi` | Stream Deck Mobile (current) | 3 | [C] |
| `VSD/WiFi` | Stream Deck Mobile (legacy, v1 profiles) | 3 | [R] |
| `20GBF9901` | Stream Deck Pedal | 5 | [R] HW model from retailer R/N; profile string not seen [?] |
| `20GBD9901` | Stream Deck + | 7 | [C] |
| `20GBJ9901` | Stream Deck Neo | 9 | [C] |
| `20GBO9901` | Stream Deck Studio | 10 | [R] HW model; Studio doesn't take app profiles [C] |
| `20GBX9901` | Stream Deck + XL | 13 | [R] (PID 0x00C6 in the same manifest; SKU 10GBX9901) |
| ? | Virtual Stream Deck, Galleon 100 SD, Corsair G-keys/Voyager, SCUF | 11, 12, 4, 6, 8 | not found |

[I] For a **plugin-bundled** profile the app picks the profile by the manifest's `DeviceType`
(Elgato's sample uses `20GAA9901` for "any type-0 device"). The docs don't say whether a hand-imported
`.streamDeckProfile` with `20GAA9901` installs on an MK.2 or Scissor (same type 0), so test it.
For a generator: **one profile per `DeviceType`**, using the Model strings from 5.1 where Elgato
gives one, `20GBX9901` for type 13, and only after testing on real hardware for 5, 11 and 12.

Bundling in a plugin manifest [C]:

```json
"Profiles": [
  { "Name": "profiles/tabletdeck-sd",    "DeviceType": 0,  "Readonly": false, "DontAutoSwitchWhenInstalled": true, "AutoInstall": true },
  { "Name": "profiles/tabletdeck-xl",    "DeviceType": 2,  "DontAutoSwitchWhenInstalled": true },
  { "Name": "profiles/tabletdeck-plus",  "DeviceType": 7,  "DontAutoSwitchWhenInstalled": true },
  { "Name": "profiles/tabletdeck-plusxl","DeviceType": 13, "DontAutoSwitchWhenInstalled": true }
]
```

`Name` is the path to the `.streamDeckProfile` without its extension. `AutoInstall` needs app 6.6+.
Plugins can only switch to the profiles they bundle (`switchToProfile`), never to the user's own [C].

---

## 6. Per-device notes

**Stream Deck + (type 7).** 8 keys (4×2) at 120×120, 4 encoders with rotate and push, and an 800×100
touch strip split into four 200×100 plugin canvases. At HID level the touch strip reports tap, press
(long) and flick, each sent once the gesture ends [C]. SDK events: `dialRotate`, `dialDown`, `dialUp`,
`touchTap` [C]. Trigger descriptions use the keys `Push`, `Rotate`, `Touch` and `LongTouch` (manifest),
or `push`, `rotate`, `touch` and `longTouch` at runtime [C].

**Stream Deck + XL (type 13).** 36 keys (9×4) at 112×112 and 6 encoders. The 1200×100 touch strip
(161×14 mm) gives six 200×100 canvases, the same as the Stream Deck +, so encoder layouts carry over
unchanged [C]. The 6 dials can't line up under 9 key columns: they sit 216 px apart about the centre [R].
Elgato's profile docs say "38 keys, 4 x 9", but every other Elgato source says 36 (9×4), so 38 is a
typo [C]. Supported from Stream Deck 7.3.0. USB 3.0 Type-C; Windows 11+ / macOS 13+ [C product page].

**Stream Deck Neo (type 9).** 8 keys (4×2) at 96×96. The Infobar (248×58 hardware window, not touch)
showed a clock and the page indicator until 7.6. From **Stream Deck 7.6 (22 Sept 2026)** users can drag
actions onto it. Plugin actions declare `"Controllers": ["Neo"]`, draw a 232×50 layout, must set the
layout on every `willAppear`, and receive no key, dial or touch events (only settings, resources, PI
and `titleParametersDidChange` events) [C]. The 2 capacitive touch points are page-left and page-right.
At HID level they're extra buttons 8 and 9 with 96×16 RGB-colourable sensor images [C/R], but the SDK
has nothing for them [I].

**Stream Deck Studio (type 10).** 1U 19" rack unit. 32 keys in a 16×2 grid at 144×112 [R], 2 encoders
(push, LED ring with 24 steps [R]), NFC reader, Ethernet PoE+ or USB-C PD [C]. Powered by
**Bitfocus Companion / Buttons**. Elgato's profile docs: "The Stream Deck Studio runs on Companion
and does not currently support Stream Deck app profiles." [C]. The SDK enumerates it (since 6.9), but
treat it as a non-target for profiles. For Studio, the icon pack (plain PNGs) is the useful deliverable [I].

**Stream Deck Pedal (type 5).** 3 pedals, no display, released Jan 2022 [R]. A profile needs actions only;
the images never show on the device. A good fit for push-to-talk-style keys, but **Tablet Deck's
one-press-per-tap rule still applies** [I].

**Stream Deck Mobile (type 3).** Free: 6 keys. Pro: preset layouts (e.g. 5×3, 8×8, a single large
button) or custom, up to 64 keys. Two keypads side by side on iPad, up to 128 keys. Mobile 2.0 and
Stream Deck 6.3+ are needed to change the layout [R help-center snippet]. Elgato's sample profile is
8×8 [C]. When the layout shrinks, keys are used "in order starting from the upper left" [R].

**Virtual Stream Deck (type 11).** Stream Deck 7.0+. On-screen panels, each up to 8×8 (64 keys), with
several panels and per-panel hotkeys. Fixed or Dynamic (opens at the cursor). Unlocking it needs a
supported Stream Deck or Corsair device connected within the last 30 days, or Mobile Pro [R Elgato
VSD page]. Still labelled beta on Elgato's compatible-hardware page (updated 7 July 2026) [C].

**Corsair GALLEON 100 SD (type 12).** Full-size keyboard; the Stream Deck replaces the numpad.
12 LCD keys (3×4), 2 dials with push, and a 5" LCD. Corsair: two dials "support four dial actions";
holding a dial for 3 s switches layer (white border); the screen shows the current dial functions and
other info while the Stream Deck app runs [R Corsair blog via search; corsair.com returns 403 to
fetches]. Hardware: keys 160×160, a 720×1280 portrait panel whose top 720×384 is the screen; Corsair
USB 1B1C:2B18 [R node-elgato-stream-deck 7.8.0]. **The SDK canvas for its dial actions isn't
documented** (the layout docs list only + and + XL at 200×100). Probably the Encoder system, but untested [?].

**Corsair G-Keys (4), Voyager (6), SCUF (8).** Screenless macro keys; the app shows their assignments
in a floating Action Bar [C]. Key images are irrelevant there. Profiles for them are low priority.

**Stream Deck Modules (6/15/32, May 2025).** Bare boards for makers [R]. Same HID families and model
numbers as Mini, MK.2 and XL 2022 [C], so they're almost certainly reported as types 1, 0 and 2 [I].

---

## 7. Conflicts and gaps

1. **+ XL model number.** The Elgato HID page (`/streamdeck/hid/stream-deck-plus-xl`) lists
   "Stream Deck + XL | 20GBD9901 | 0x0FD9 | 0x00C6". 20GBD9901 is the Stream Deck + model (Elgato's own
   sample profile and the + HID page). A real profile manifest pairs `20GBX9901` with PID 0x00C6, and
   the retail SKU is 10GBX9901. **Use `20GBX9901`** and check it against one real export if you can.
2. **+ XL key count.** Elgato's profile docs say "38 / 4 x 9"; everything else says 36 (9×4).
3. **Grid orientation wording.** The HID docs sometimes say "2×4" and sometimes "4 × 2" for the same
   device. The SDK enum, `size`, and profile coordinates are all **columns × rows**: XL 8×4, + XL 9×4,
   Galleon 3×4, Studio 16×2.
4. **Voyager key count.** The SDK says 10 keys; Elgato's compatible-hardware page says "6 S-Keys".
5. **Studio and the Stream Deck app.** The SDK has type 10 (6.9+), but the profile docs say there's no
   app profile support. How well the app supports Studio beyond that is unclear.
6. **Not found:** profile `Device.Model` strings for Pedal, Scissor, Mini 2022, Studio, Virtual Stream
   Deck, Galleon, Corsair and SCUF; the Galleon dial-display canvas size; how Studio fits a square image
   on a 144×112 key; what `DeviceType` the Yamaha CC1 and Corsair mice report.
7. **Profile format version.** Exports seen are `"Version": "2.0"`. On-disk `ProfilesV3` manifests in
   recent apps use `"Version": "3.0"` [R]. Whether 7.x **exports** 3.0, and whether 2.0 still imports
   cleanly, wasn't checked here; that belongs to the profile-format research.
8. **Animation.** The manifest allows GIF for `States[].Image`, but `setImage` doesn't animate GIFs [C].
   Plugin-driven animation would have to send a series of `setImage` frames [I]. Separate topic.

---

## 8. Sources

Primary (Elgato / official):
- SDK Devices guide (DeviceType table and hardware list): https://docs.elgato.com/streamdeck/sdk/guides/devices
- SDK Keys guide (image formats; no animated `setImage`): https://docs.elgato.com/streamdeck/sdk/guides/keys
- SDK Dials & Touch Strip guide (200×100, Encoder): https://docs.elgato.com/streamdeck/sdk/guides/dials
- SDK Neo Infobar guide (7.6+, 232×50, `"Neo"` controller): https://docs.elgato.com/streamdeck/sdk/guides/neo-infobar
- SDK Layouts reference (canvas sizes; "cannot render across the entire touch strip"): https://docs.elgato.com/streamdeck/sdk/references/layouts
- SDK Manifest reference (image sizes, Controllers, Profiles.DeviceType 0–13): https://docs.elgato.com/streamdeck/sdk/references/manifest
- SDK Profiles guide: https://docs.elgato.com/streamdeck/sdk/guides/profiles
- SDK changelog (6.4 → 7.6): https://docs.elgato.com/streamdeck/sdk/references/changelog
- Profiles docs (device table; Studio has no app profiles; "+ XL 38" typo): https://docs.elgato.com/stream-deck/profiles/getting-started
- HID API pages (model, VID/PID, pixel sizes): https://docs.elgato.com/streamdeck/hid/stream-deck-classic ,
  https://docs.elgato.com/streamdeck/hid/mini , https://docs.elgato.com/streamdeck/hid/stream-deck-xl ,
  https://docs.elgato.com/streamdeck/hid/stream-deck-neo , https://docs.elgato.com/streamdeck/hid/stream-deck-plus ,
  https://docs.elgato.com/streamdeck/hid/stream-deck-plus-xl
- DeviceType source: https://raw.githubusercontent.com/elgatosf/schemas/main/src/streamdeck/plugins/device-type.ts
- npm `@elgato/schemas` 0.6.0 and `@elgato/streamdeck` 3.0.4 (registry.npmjs.org), files
  `dist/streamdeck/plugins/device-type.d.ts`, `dist/streamdeck/plugins/layout/*.d.ts`, `dist/api/device.d.ts`, `dist/api/events/device.d.ts`
- Official sample profiles: https://github.com/elgatosf/streamdeck-plugin-samples/tree/main/lights-out/com.elgato.lightsout.sdPlugin (commit 8cc82ba)
- Elgato compatible hardware page (updated 7 July 2026): https://www.elgato.com/us/en/explorer/products/stream-deck/stream-deck-hardware-device-models/
- Stream Deck + XL product page: https://www.elgato.com/us/en/p/stream-deck-plus-xl
- Virtual Stream Deck overview: https://www.elgato.com/us/en/explorer/products/stream-deck/virtual-stream-deck-beta-overview/
- Release notes (seen through search snippets only; the pages return 403): Stream Deck 7.2.0, 6 Jan 2026,
  https://help.elgato.com/hc/en-us/articles/42580529279377-Elgato-Stream-Deck-7-2-0-Release-Notes ;
  7.3.0, 3 Mar 2026, https://help.elgato.com/hc/en-us/articles/44411141578001-Elgato-Stream-Deck-7-3-0-Release-Notes ;
  7.6, 22 Sept 2026, https://help.elgato.com/hc/en-us/articles/51156609278737-Elgato-Stream-Deck-7-6-Release-Notes ;
  7.0.1, 23 Sept 2025 (Network Dock), https://help.elgato.com/hc/en-us/articles/39330355624977-Stream-Deck-7-0-1-Release-Notes ;
  Mobile layout: https://help.elgato.com/hc/en-us/articles/16549072466445-Elgato-Stream-Deck-Mobile-2-0-How-to-change-Keypad-Layout

Real-world code and files:
- node-elgato-stream-deck (`@elgato-stream-deck/core` 7.8.0): `dist/models/definitions.js` and
  `dist/modelInfo.js` (pixel sizes for Studio 144×112, Galleon 160×160 and 720×384, + XL geometry; USB PIDs).
  https://github.com/Julusian/node-elgato-stream-deck
- verygoodplugins/streamdeck-mcp (`profile_manager.py`, `tests/test_profile_manager.py`): 20GBX9901/PID 198,
  20GBA9901/PID 128, 20GBD9901/PID 132, ProfilesV3 "Version 3.0". https://github.com/verygoodplugins/streamdeck-mcp
- danexrc/Streamdeck-Profiles (exported XL profiles, Model 20GAT9901): https://github.com/danexrc/Streamdeck-Profiles
- data-enabler/streamdeck-profile-generator `lib/profile.js` (v2 manifest typedef): https://github.com/data-enabler/streamdeck-profile-generator
- ScriptDeck `get_DeviceName.ps1` (legacy model map incl. `VSD/WiFi`): https://www.powershellgallery.com/packages/ScriptDeck/0.4.6/Content/Types%5CStreamDeck.Profile%5Cget_DeviceName.ps1
- streamdeck_prof Ruby gem DeviceData: https://www.rubydoc.info/gems/streamdeck_prof/StreamdeckProf/DeviceData

Press and retail (dates, SKUs, R/N):
- Engadget, + XL announced 3 Mar 2026: https://www.engadget.com/computing/elgatos-stream-deck--xl-adds-a-touch-strip-and-dials-to-an-already-massive-array-of-buttons-195200129.html
- Corsair newsroom, Galleon 100 SD at CES (6 Jan 2026): https://corsair-newsroom.prgloo.com/news/corsair-introduces-first-gaming-keyboard-with-built-in-stream-deck-controller
- KitGuru, Galleon 100 SD ($349.99, end of Jan 2026): https://www.kitguru.net/channel/generaltech/matthew-wilson/ces-2026-corsairs-latest-full-size-keyboard-replaces-numpad-with-elgato-stream-deck/
- Corsair blog, Galleon LCD and dials (4 dial actions, layers): https://www.corsair.com/us/en/explorer/gamer/keyboards/galleon-100-sd-understanding-the-lcd-screen-and-dials/ (403 to fetch; content from search snippets)
- Network Dock R/N incompatibility list: https://avlgear.com/collections/live-stream-devices/products/elgato-stream-deck-xl-and-stream-deck-network-dock-1
- Computex 2025 "Stream Deck Everywhere" (Modules, Scissor Keys, Network Dock, VSD): https://www.newscaststudio.com/2025/05/20/elgato-expands-stream-deck-platform-with-modular-and-virtual-control-tools ,
  https://appleinsider.com/articles/25/05/20/elgatos-new-stream-deck-lineup-goes-way-beyond-the-desktop
- Stream Deck Pedal launch (Jan 2022): https://www.vortez.net/news_story/elgato_launches_stream_deck_pedal.html
- Yamaha CC1 (12 LCD keys for Stream Deck): https://usa.yamaha.com/products/music_production/controllers/cc1/
