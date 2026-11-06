# Design

How SpoolUp looks, and the rules that keep the deck, the layout editor, the
website and the Windows app looking like one product. For running and building
the code, see [DEVELOPMENT.md](DEVELOPMENT.md).

- [Themes are different, not recoloured](#themes-are-different-not-recoloured)
- [Theme tokens](#theme-tokens)
- [Maker drawings](#maker-drawings)
- [Adding a theme](#adding-a-theme)
- [Button colours](#button-colours)
- [HUD style](#hud-style)
- [The other surfaces](#the-other-surfaces)
- [Motion, night mode and layering](#motion-night-mode-and-layering)
- [Accessibility](#accessibility)

## Themes are different, not recoloured

The owner's rule, and the first test for any theme: **if it's different, be
different.** A manufacturer theme that is the same theme with another stripe of
colour or another background shade is not a theme. Each one needs its own
character, the way the "Tablet Deck 2" design did it:

- **Solid, committed colours**, not one shared dark panel tinted per theme.
- **Its own shapes:** buttons, frames, corners, dividers and headers that only
  that manufacturer would draw (Drake's industrial plates, Origin's light
  luxury, Aegis's military hard edges, Banu's and Esperia's alien forms...).
- **Its own widgets:** how a dial, a gauge, a switch, a lit state or a state
  header looks, not only what colour it is.
- **Its own type and motion**, where the manufacturer calls for it.

The tokens below carry the colours, type and material; `public/makers.css`
carries each maker's drawing (see [Maker drawings](#maker-drawings)). When a
theme needs something neither can say yet, add it (and its drawing in the deck
and in the Stream Deck key art) rather than settling for a recolour.

## Theme tokens

Every theme is a block of CSS custom properties in `public/themes.css`, keyed by
`[data-theme="<id>"]`. The deck's styles only read these variables, so a new
theme never needs changes anywhere else in the CSS. A theme sets **all** of the
tokens below, except the two marked optional.

| token | controls | example (RSI) |
|---|---|---|
| `--bg` | page background colour | `#05090f` |
| `--bg-art` | backdrop drawn over `--bg`: glows, stripes, `var(--stars)` | radial glow + stars |
| `--panel` | button and panel fill | `#0b1420` |
| `--panel-hi` | raised or pressed fill | `#122236` |
| `--line` | borders and dividers | `#1c2c40` |
| `--line-hi` | highlighted borders | `#35598a` |
| `--text` | text on buttons and panels | `#e8f2fc` |
| `--dim` | secondary text on buttons: states ("OFF", "RETRACTED") | `#8ea4bc` |
| `--ink`, `--ink-dim` | text straight on the page and the HUD's plates: section titles, captions, the status line, the intro | `#e8f2fc`, `#8197b0` |
| `--face-hi`, `--face-lo` | a button face's top and bottom colour (HUD buttons, Stream Deck keys) | `#1e2d42`, `#111b29` |
| `--material` | the maker's surface, one word that the Stream Deck key art draws (`glass`, `plate`, `carbon`, `armour`, `gloss`, `enamel`, `pearl`, `lacquer`, `shell`, `hazard`, `clay`, `silk`) | `glass` |
| `--plate`, `--plate-line` | the plate each half of the HUD sits on, and its border | translucent navy |
| `--accent` | the theme's signature colour; buttons without a `color` | `#4fb3ff` |
| `--green`, `--amber`, `--red`, `--blue` | the four button colours (see [Button colours](#button-colours)) | `#46d79a` … |
| `--font-display` | headings, big labels | `"Exo 2", system-ui, sans-serif` |
| `--font-body` | button labels and everything else | same |
| `--label-case` | `text-transform` of labels | `uppercase` |
| `--label-track` | letter spacing of labels | `.06em` |
| `--label-weight` | font weight of labels | `600` |
| `--key-radius` | grid-layout button and Stream Deck key corner radius | `6px` |
| `--key-clip` | `clip-path` for cut corners on those, or `none` | `none` |
| `--btn-radius`, `--btn-clip` | the same for the HUD's (smaller) buttons | `5px`, `none` |
| `--key-edge` | width of the coloured bar on a button's left edge (`0` for none) | `3px` |
| `--key-bg` | grid-layout button fill (usually a gradient) | `linear-gradient(...)` |
| `--key-top`, `--key-top-h` | highlight strip along a grid button's top, and its height | gradient, `2px` |
| `--key-shadow` | button shadow; optional | `0 8px 22px …` |
| `--icon-stroke` | stroke width of the line icons | `2.2` |
| `--icon-glow` | filter on icons: a `drop-shadow` glow, or `none` | `drop-shadow(...)` |
| `--tab-radius` | tab shape in the tabbed grid layout | `8px 8px 0 0` |
| `--label-shadow`, `--state-shadow` | shadow behind labels and state text; optional | dark blur by default |

`:root` also defines `--stars`, `--grid` and `--scratches`, shared backdrop
pieces that themes can use inside `--bg-art`, `--plate` and `--key-bg`.

**Light pages** (Origin, Crusader, Aopoa, Argo, Consolidated Outland) set
`color-scheme: light`, and their `--ink` is dark while `--text` stays whatever
reads on their buttons (Origin's are black, Crusader's white). A theme with
**light buttons** (Crusader) must also set `--label-shadow` and
`--state-shadow`: the default dark blur makes text look smudged on them;
Crusader uses `0 1px 0 rgba(255,255,255,.8)` and `none`.

## Maker drawings

`public/makers.css` has a section per maker that draws what tokens can't: the
plates' edges and marks (Drake's hazard strip and rivets, Anvil's screws,
CO's sunset stripe), the bezel over the whole HUD (`--bezel`, `--bezel-art`),
the section-title mark that replaces `//`, and each widget: the dial (Origin's
cream ball, Anvil's knurled knob, MISC's gauge), the framed buttons' shape, the
mode switch, the eject slider's knob, the danger zone, the pager.

Buttons are drawn from variables set on the button itself, which `.hud-btn` in
`hud.css` reads, so a maker's look keeps the button's colour (`--c`) in every
state:

| variable | what it is |
|---|---|
| `--face` | the face's layers (gradient, texture) |
| `--mark` | layers drawn over it: rivets, tabs, sheen, a slot bar |
| `--edge`, `--bevel` | border colour, and the box-shadow that gives it depth |
| `--lit`, `--lit-ring` | layers and shadow while lit: Drake's hazard band, Anvil's lamp, Origin's gold bar |
| `--press`, `--press-ring`, `--press-move` | the same while pressed, and how it moves (Drake's slab sinks, Banu's squashes) |
| `--deny` | the flash of a press the PC skipped (Drake's red hazard, Aegis's red scanlines) |
| `--veil` (on `#canvas`) | what covers the plates while the PC is offline |

Keep it to gradients and borders: no filters or animations per frame, so the
deck stays smooth on an iPad. Marks go where the state text and key labels
aren't (a slot bar sits on the very bottom edge, under "RETRACTED"). High
contrast resets every maker at the end of the file; a new drawing with its own
colours needs a line there.

## Adding a theme

1. **Copy a block** in `public/themes.css`, give it a new id, and set every
   token in the table. Start from a theme with a similar feel: a dark one for a
   dark theme, Crusader or Origin for a light one. Then give it its own section
   in `public/makers.css`, and its `--material` a drawing in `material()` and
   `litMark()` in `streamdeck/keyart.js` if no existing one fits.
2. **Fonts:** if the theme uses a new Google font, add it to the Google Fonts
   link in both `public/index.html` and `public/editor.html`, and end the font
   stack with a system fallback (`system-ui, sans-serif`). The deck also has to
   look right with the fallback, since it works offline too.
3. **Register it** in `THEMES` at the top of `public/app.js`: `id`, `name`
   (short, for the picker), `full` (the manufacturer's full name), `tag` (a
   short tagline) and `emblem`.
4. **The emblem** is an original badge design on a 64×64 SVG grid that suggests
   the maker's character. Never copy or trace a real company logo. Strokes use
   `currentColor`; `${F}` marks solid accent fills and `T(...)` wraps parts drawn
   in the theme's text colour. Keep a one-line comment describing the idea, as
   the existing emblems do.
5. **Check it:**
   - the theme picker card;
   - the deck on a tablet and a phone (the showcase in `docs/DEVELOPMENT.md` has
     both frames);
   - pressed buttons and every button colour;
   - night mode, and the intro screen (it draws the emblem);
   - the text contrast rules under [Accessibility](#accessibility).
6. **Update the counts:** "12 manufacturer themes" appears in the README,
   `CHANGELOG.md`, the website (`site/index.html`) and the theme gallery image
   `docs/themes.jpg`.

## Button colours

Layouts give a button one of four colours, or none for the theme's accent. Use
them by meaning, so a colour tells you what a button does in every theme:

| colour | meaning | examples |
|---|---|---|
| `green` | power, systems on, flight | Flight mode, Master: SCM, shield power |
| `amber` | work modes and caution | Mining, Salvage, Fracture/Extract, G-Safety |
| `red` | weapons and danger | Guns, Missiles, Fire Laser, Exit Seat, Self-destruct |
| `blue` | navigation, scanning and info | Quantum, Scanning, mining modules |
| none | everything else | most buttons |

Use colours sparingly. A panel where every button is coloured has no colours.

## HUD style

The deck should feel like a ship's display, not a web page:

- **Labels** are short and in Title Case in the layout JSON ("Landing Gear",
  "Engage Quantum"); themes decide upper or lower case through `--label-case`.
  Keep them to two or three words that fit a button on a phone.
- **State text** under a label is one short word or two in capitals: "OFF",
  "RETRACTED", "HOLD TO ENGAGE".
- **Section headers** start with `//` and use underscores between words:
  `// POWER_MANAGEMENT`, `// SHIP_SYSTEMS`.
- **Lines are thin** (1px), corners are bracketed (the intro screen, the
  banner, the website), and glow comes from a `drop-shadow` of the element's own
  colour, not from a separate colour.
- **Lit buttons** (a `state` that's on) use the "on" look from `fx.css`: the
  border and glow in the button's colour, and a one-word status (ON, OPEN,
  DEPLOYED, LOCKED). In button grids the status sits top right, elsewhere under
  the label. Buttons that only switch something off never stay lit.
- **Key labels** (Deck settings, `data-keys` on `<html>`, styles in `hud.css`) put
  a button's key in a free corner in small capitals, in `--dim`: top right, under
  a top-right status line in tablet grids, bottom right in phone grids, top
  centre on the framed hero and quantum buttons. A new button style needs a
  corner that's free in every theme, including the cut corners of `--key-clip`.
- **Icons** are line icons on a 48×48 grid in `public/icons.js`, drawn with
  `currentColor`, using the theme's `--icon-stroke`. Add new ones in the same
  style, not as images.

## The other surfaces

The layout editor, the showcase, the website and the Windows app window don't
switch themes. They use the RSI look as the house style:

| role | colour | used for |
|---|---|---|
| background | `#05090f` | page and window background |
| panel | `#0b1726` | cards, panels |
| panel, raised | `#12253b` | hover, selected |
| line | `#1f3a58` | borders |
| accent | `#4fb3ff` | links, buttons, focus, highlights |
| text | `#e8eef5` | main text |
| dim | `#8aa0b8` | secondary text |

Fonts: **Oxanium** for display text, **Exo 2** for everything else, with
`system-ui, sans-serif` as the fallback.

The website keeps these as tokens in `site/style.css` (`--bg`, `--panel`,
`--accent`, `--display`, `--body` …); reuse them there instead of new hex
values. The Windows app (`native/launcher.cs`) sets the same colours in code
(`Hud`), with its own status colours for good, warning and error states. When
you change the house colours, change them in both.

The app's main window is drawn in the deck's HUD style (`HudView`): panels with
a thin border, accent corner brackets, a `// HEADING` and a ruler, over a slowly
drifting starfield. The stars pass behind the panels, which keep the text on a
solid layer so it can use ClearType; text drawn over a see-through layer can't,
and looks soft. Windows doesn't ship Oxanium or Exo 2, so its display font
is **Bahnschrift** (Windows 10 and later), falling back to Segoe UI, with
Consolas for the address and pairing code. Its readouts show only real data,
never decoration made to look like data.

The app's other windows (Settings, Voice commands, Install keybind profile) use
the same panels, buttons and switches (`HudDialog`) over the same stars, standing
still. Fields you type into or pick from stay real Windows controls, in the
house colours inside a drawn frame that lights up in the accent colour while it
has focus.

## Stream Deck keys

The Stream Deck pack's keys (`streamdeck/keyart.js`) are the deck's buttons
redrawn as 144×144 pictures, in the theme's own tokens, so a key looks like the
same button on the tablet:

- **Built from `public/themes.css`**: the key's face (`--face-hi`, `--face-lo`)
  on the page colour, frame, corner radius or cut, top strip (Drake's hazard
  stripes, CO's segment), backdrop glow, icon stroke and fonts all come from the
  theme's tokens, and `--material` picks the maker's surface and lit mark in
  `material()` and `litMark()` (the same ideas as makers.css draws on the deck:
  rivets, weave, lamp, gloss, tabs...). Don't draw one theme's keys by hand;
  add a token or a material, and every key gets it.
- **Icon above, label below, one status word under it** (DEPLOYED, ON, PLUGIN).
  Labels wrap to two lines and shrink to fit 110 px, clear of the frame and the
  accent bars; status words stay short (the plugin's translations have their
  own short forms).
- **Colours mean the same as on the deck**: red danger and combat, green power and
  on, amber mining and salvage, blue the rest. A lit key takes its colour's tint
  and ring and its maker's lit mark; a skipped press flashes red; offline keys
  go dim with a red cross.
- **Badges sit top right**: a folder for keys that open a folder, an arrow for Back.
- **Empty slots are blank keys** in the page colour with a small cross, so a page
  reads as one panel, light themes too (never a white face).
- **Touch strips** (Stream Deck + and + XL) are one HUD panel across all the
  dials: each dial's 200×100 part has its label, icon and colour, and says what
  turning each way and pushing do.
- **Simple SVG only**: paths, strokes and gradients, no filters or arcs (Stream
  Deck's SVG renderer is SVG Tiny), with glows drawn as layered strokes.
- **Original icons**, no brand logos: the Discord and OBS keys use the deck's own
  icons, and theme keys use each manufacturer's emblem from the deck.

## Motion, night mode and layering

- **Keep motion short.** UI transitions (paging, sheets, toasts) take about
  200 ms. Longer effects are only for moments the player triggers: press
  animations, the quantum charge, the intro.
- **Every animation respects "reduce motion".** `fx.css`, `hud.css` and
  `intro.css` each turn their animations off under
  `@media (prefers-reduced-motion: reduce)`. A new animation needs the same.
  The app window follows Windows' "Show animations" setting instead.
- **The app window never animates behind the game.** Its stars move only while
  the window is in front; minimized, in the tray or behind Star Citizen, it
  draws nothing.
- **Sound** (Button sounds, on unless turned off) is made from tones, never from
  files. Each sound in `BANK` in `public/sound.js` is a list of tones; the
  tablet plays it with Web Audio, or sends it to the PC, where
  `native/sound.cs` synthesizes the same tones on the output the player picked.
  Keep the two renderers in step: a tone field means the same in both. Sounds
  are short and quiet, follow the same moments as the press animations, and use
  the button colours' meaning: a press's pitch drops from blue to green, the
  accent, amber and red. `fx.js` and `canvas.js` reach it through
  `window.DeckSound?.`, since the layout editor doesn't load it.
- **Night mode** is a black overlay (`#night`) over the deck. Anything that must
  stay readable at night goes above it.
- **Layering** (`z-index`), from bottom to top: deck content and its menus (up
  to 5), the night overlay (9), the theme picker (10), toasts (20), the intro
  screen (50). Put a new overlay in this order rather than picking a large
  number.

## Accessibility

- **Contrast:** `--text` on `--face-hi`, `--face-lo` and `--panel` should
  reach at least 4.5:1, and `--dim` on them at least 3:1; `--ink` on `--bg` at
  least 4.5:1 and `--ink-dim` at least 3:1, in every theme. All 12 themes do
  today (text 6.2:1 or more, dim 4.0:1, ink 8.6:1, ink-dim 4.5:1; MISC's
  lighter face and Origin's cream page are the lowest). Check a new theme with
  any contrast checker.
- **Colour is never the only signal:** a button's label says what it does,
  and its state text says whether it's on. Colour adds to that.
- **Touch targets:** the smallest buttons are the phone's top bar, 44×36
  points. Don't make anything tappable smaller than that, and give new buttons
  at least 44 points in both directions where there's room.
- **Messages** (toasts, the theme picker, "Star Citizen not focused") must stay
  readable with night mode on.
- **Large text, high contrast and button lights off** (switches in Deck
  settings, `data-large`, `data-contrast` and `data-no-lights` on `<html>`,
  styles at the end of `deck.css`) must keep working: check new button styles with both on, at tablet and phone size.
  High contrast overrides the theme tokens, so a new style that only uses the
  tokens follows it by itself; one with its own colours or glows needs an
  override there.
- Buttons without a text label, like the icon-only top bar, need an
  `aria-label`.
