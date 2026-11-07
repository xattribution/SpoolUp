// Line icons for the deck, drawn on a 48x48 grid with currentColor.
// Strokes use the theme's --icon-stroke width; `fill="currentColor"` parts are solid accents.
window.DECK_ICONS = {
  ship: `<path d="M24 5 30 21 42 28v4l-13-2-2 11h-6l-2-11-13 2v-4l12-7Z"/><path d="M24 13v9" opacity=".6"/>`,

  "flight-ready": `<path d="M24 9 28.5 21 37 26v3l-9.5-1.5L26 35h-4l-1.5-7.5L11 29v-3l8.5-5Z"/>
    <path d="M9 39a19 19 0 0 1-3-6M39 39a19 19 0 0 0 3-6"/><path d="M17 43h14"/>
    <circle cx="24" cy="18" r="1.6" fill="currentColor" stroke="none"/>`,

  power: `<path d="M24 6v15"/><path d="M15.5 12.5a14 14 0 1 0 17 0"/>
    <circle cx="24" cy="27" r="3" fill="currentColor" stroke="none" opacity=".35"/>`,

  gear: `<path d="M8 10h32l-5 6H13Z"/><path d="M24 16v12"/><path d="m24 28-9 7m9-7 9 7"/>
    <path d="M10 38h10M28 38h10"/><circle cx="15" cy="35" r="1.5" fill="currentColor" stroke="none"/><circle cx="33" cy="35" r="1.5" fill="currentColor" stroke="none"/>`,

  "request-landing": `<ellipse cx="24" cy="37" rx="17" ry="5"/><path d="M19 37h10M24 34v6" opacity=".6"/>
    <path d="M24 7v18m-6-6 6 6 6-6"/><path d="M33 9a8 8 0 0 1 5 5M34 4a13 13 0 0 1 9 9"/>`,

  vtol: `<path d="M6 18h36l-7 7H13Z"/><path d="M17 25v4M31 25v4"/>
    <path d="M15 32v9M19 32v6M29 32v6M33 32v9" opacity=".75"/><path d="M24 8v6m-3-3 3-3 3 3"/>`,

  lights: `<path d="M16 13a11 11 0 0 0 0 22Z"/><path d="M16 13v22"/>
    <path d="m23 14 18-5M23 24h19M23 34l18 5"/>`,

  "quantum-mode": `<circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/>
    <ellipse cx="24" cy="24" rx="19" ry="7" transform="rotate(-25 24 24)"/>
    <ellipse cx="24" cy="24" rx="19" ry="7" transform="rotate(35 24 24)" opacity=".7"/>
    <circle cx="24" cy="24" r="10" stroke-dasharray="2 4" opacity=".55"/>`,

  "quantum-jump": `<path d="M30 12 42 24 30 36"/><path d="M6 24h30"/>
    <path d="M10 16h16M10 32h16" opacity=".7"/><path d="M4 20h6M4 28h6M16 12h6M16 36h6" opacity=".4"/>`,

  "exit-seat": `<path d="M12 6v21a5 5 0 0 0 5 5h11"/><path d="M12 14h5v12h9"/><path d="M18 32v10M26 32v10M14 42h16"/>
    <path d="M30 18h13m-5-5 5 5-5 5"/>`,

  decoy: `<circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/>
    <path d="M24 6v8M24 34v8M6 24h8M34 24h8M11.3 11.3l5.6 5.6M31.1 31.1l5.6 5.6M11.3 36.7l5.6-5.6M31.1 16.9l5.6-5.6"/>
    <circle cx="36" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="38" r="1.6" fill="currentColor" stroke="none"/>`,

  noise: `<path d="M4 24c3 0 3-12 6-12s3 24 6 24 3-24 6-24 3 24 6 24 3-24 6-24 3 12 6 12"/>
    <path d="M4 40h40M4 8h40" opacity=".35"/>`,

  "power-weapons": `<circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none"/>
    <path d="M24 4v10M24 34v10M4 24h10M34 24h10"/>`,

  "power-engines": `<path d="M14 6h20l-4 15H18Z"/><path d="M16 12h16" opacity=".5"/>
    <path d="M18 26c0 7 6 10 6 17 0-7 6-10 6-17"/><path d="M21 26c0 4 3 6 3 10 0-4 3-6 3-10" opacity=".6"/>`,

  "power-shields": `<path d="M24 5 39 10v11c0 11-6.5 18-15 22-8.5-4-15-11-15-22V10Z"/>
    <path d="M24 13 32 16v6c0 6-3.5 10-8 12.5-4.5-2.5-8-6.5-8-12.5v-6Z" opacity=".55"/>`,

  "power-reset": `<path d="M38 20A15 15 0 0 0 11 14"/><path d="M10 6v8h8"/>
    <path d="M10 28a15 15 0 0 0 27 6"/><path d="M38 42v-8h-8"/>
    <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none"/>`,

  mining: `<path d="m28 18 10 5-3 17H23l-4-12Z"/><path d="m28 18-3 10 10 12M25 28l-6 0" opacity=".55"/>
    <path d="M5 8 21 22"/><path d="M5 14l6-6" opacity=".6"/><circle cx="21" cy="22" r="2" fill="currentColor" stroke="none"/>`,

  // Mining laser: an emitter firing a beam into a rock.
  laser: `<path d="M5 33 15 23l6 6-10 10Z"/><path d="M18 26 31 13" stroke-width="4" opacity=".55"/>
    <path d="m33 7 9 5-2 11-9 2-5-8Z"/><circle cx="31" cy="13" r="2.4" fill="currentColor" stroke="none"/>`,

  // Mining module: a consumable canister.
  module: `<rect x="15" y="10" width="18" height="30" rx="4"/><path d="M19 6h10M24 6v4"/>
    <path d="M15 20h18M15 30h18" opacity=".55"/><circle cx="24" cy="25" r="2.4" fill="currentColor" stroke="none"/>`,

  scanning: `<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="10" opacity=".55"/>
    <path d="M24 24 37 11"/><path d="M24 6v4M24 38v4M6 24h4M38 24h4" opacity=".55"/>
    <circle cx="31" cy="29" r="2" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="1.5" fill="currentColor" stroke="none"/>`,

  turret: `<path d="M8 38h32"/><path d="M13 38a11 11 0 0 1 22 0"/><path d="M19 30h6"/>
    <path d="m27 28 13-12M29 31l13-12"/><path d="M14 42h20" opacity=".5"/>`,

  doors: `<rect x="7" y="6" width="34" height="36" rx="1.5"/><path d="M24 6v36"/>
    <path d="m17 20-4 4 4 4M31 20l4 4-4 4"/><path d="M7 42h34" stroke-width="4" opacity=".45"/>`,

  mobiglas: `<path d="M24 7 38 15v16l-14 8-14-8V15Z"/><path d="M24 15l7 4v8l-7 4-7-4v-8Z" opacity=".6"/>
    <path d="M10 15l14 8 14-8M24 23v16" opacity=".35"/>`,

  starmap: `<circle cx="22" cy="24" r="9"/><ellipse cx="22" cy="24" rx="19" ry="6" transform="rotate(-18 22 24)"/>
    <circle cx="40" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="7" cy="38" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="38" cy="38" r="1" fill="currentColor" stroke="none"/>`,

  inventory: `<path d="M24 5 41 14v20L24 43 7 34V14Z"/><path d="M7 14l17 9 17-9M24 23v20"/>
    <path d="m15.5 9.5 17 9v7" opacity=".55"/>`,

  contacts: `<circle cx="18" cy="16" r="6"/><path d="M6 40c0-8 5-13 12-13s12 5 12 13"/>
    <circle cx="34" cy="14" r="4" opacity=".6"/><path d="M33 23c6 0 10 4 10 11" opacity=".6"/>`,

  camera: `<circle cx="24" cy="18" r="5"/><path d="M15 38c0-7 4-11 9-11s9 4 9 11"/>
    <path d="M5 13V5h8M35 5h8v8M43 35v8h-8M13 43H5v-8"/>`,

  escape: `<path d="M20 8H9v32h11"/><path d="M19 24h22m-7-7 7 7-7 7"/>`,

  speed: `<path d="M8 34a17 17 0 1 1 32 0"/><path d="M24 34 33 19"/><circle cx="24" cy="34" r="3" fill="currentColor" stroke="none"/>
    <path d="M12 26h3M16 17l2 2M24 13v3M32 17l-2 2M36 26h-3" opacity=".6"/>`,

  target: `<path d="M6 16V6h10M32 6h10v10M42 32v10H32M16 42H6V32"/><circle cx="24" cy="24" r="7"/>
    <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/>`,

  missile: `<path d="M34 6c5 0 8 3 8 8L22 34l-8-8Z"/><path d="m14 26-6 2 2-8 8-2M22 34l-2 6 8-2 2-8" opacity=".7"/>
    <path d="m10 38-4 4M14 40l-2 2M8 34l-2 2" opacity=".55"/>`,

  salvage: `<path d="M8 40 20 28"/><path d="M20 28 34 14l4 4-14 14Z"/><path d="m34 14 4-8 4 4-8 4"/>
    <path d="M26 40h14M30 34h10" opacity=".55"/>`,

  eye: `<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24Z"/><circle cx="24" cy="24" r="6"/>
    <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/>`,

  lock: `<rect x="10" y="22" width="28" height="20" rx="3"/><path d="M16 22v-6a8 8 0 0 1 16 0v6"/>
    <circle cx="24" cy="31" r="2.5" fill="currentColor" stroke="none"/><path d="M24 33v4"/>`,

  unlock: `<rect x="10" y="22" width="28" height="20" rx="3"/><path d="M16 22v-6a8 8 0 0 1 15.5-2.8"/>
    <circle cx="24" cy="31" r="2.5" fill="currentColor" stroke="none"/><path d="M24 33v4"/>`,

  emote: `<circle cx="24" cy="24" r="18"/><path d="M16 29c2 4 5 6 8 6s6-2 8-6"/>
    <circle cx="18" cy="19" r="2" fill="currentColor" stroke="none"/><circle cx="30" cy="19" r="2" fill="currentColor" stroke="none"/>`,

  walk: `<circle cx="27" cy="8" r="4"/><path d="m24 15-6 12 8 5 2 12M24 15l6 8 7 2M18 27l-6 14M21 20l-8 3-2 7"/>`,

  drop: `<path d="M24 6v20m-7-7 7 7 7-7"/><path d="M10 30v10h28V30"/><path d="M16 36h16" opacity=".55"/>`,

  "chev-up": `<path d="m12 30 12-12 12 12"/>`,
  "chev-down": `<path d="m12 18 12 12 12-12"/>`,
  "chev-max": `<path d="M10 8h28"/><path d="m12 26 12-12 12 12M12 38l12-12 12 12"/>`,
  "chev-min": `<path d="M10 40h28"/><path d="m12 10 12 12 12-12M12 22l12 12 12-12"/>`,
  "chev-left": `<path d="M30 10 16 24l14 14"/>`,
  "chev-right": `<path d="m18 10 14 14-14 14"/>`,
  chat: `<path d="M7 9h34v24H20l-9 7v-7H7Z"/><circle cx="17" cy="21" r="1.8" fill="currentColor" stroke="none"/><circle cx="24" cy="21" r="1.8" fill="currentColor" stroke="none"/><circle cx="31" cy="21" r="1.8" fill="currentColor" stroke="none"/>`,
  party: `<circle cx="17" cy="17" r="6"/><circle cx="32" cy="18" r="5"/><path d="M5 38c0-7 5-12 12-12s12 5 12 12M29 27c6 0 11 4 11 11"/>`,
  sliders: `<path d="M12 6v36M24 6v36M36 6v36"/><rect x="8" y="12" width="8" height="6" rx="1.5" fill="currentColor" stroke="none"/><rect x="20" y="28" width="8" height="6" rx="1.5" fill="currentColor" stroke="none"/><rect x="32" y="18" width="8" height="6" rx="1.5" fill="currentColor" stroke="none"/>`,
  grid: `<rect x="7" y="7" width="14" height="14" rx="2"/><rect x="27" y="7" width="14" height="14" rx="2"/><rect x="7" y="27" width="14" height="14" rx="2"/><path d="M27 27h6v6h-6zM35 35h6v6h-6z" fill="currentColor" stroke="none"/>`,
  mic: `<rect x="17" y="5" width="14" height="24" rx="7"/><path d="M10 22a14 14 0 0 0 28 0M24 36v7M17 43h14"/>
    <path d="M17 15h6M17 21h6" opacity=".55"/>`,

  // The pager's view button: one panel, or two halves side by side.
  "view-one": `<rect x="8" y="10" width="32" height="28" rx="3"/><path d="M14 17h20M14 23h20M14 29h12" opacity=".6"/>`,
  "view-two": `<rect x="6" y="10" width="16" height="28" rx="3"/><rect x="26" y="10" width="16" height="28" rx="3"/>`,
  swap: `<path d="M8 16h28m-6-6 6 6-6 6M40 32H12m6-6-6 6 6 6"/>`,

  help: `<circle cx="24" cy="24" r="17"/><path d="M18.5 19a5.5 5.5 0 1 1 8 4.9c-1.8.9-2.5 2-2.5 3.6V29"/>
    <circle cx="24" cy="35" r="1.8" fill="currentColor" stroke="none"/>`,

  // ---------- Emotes: a small figure or face for each Star Citizen emote, one family (round head, single-line limbs, dot eyes, the sign top right). ----------

  "emote-agree": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><path d="M15.5 30.5c3 3.6 8 3.6 11 0"/><path d="M38.5 5v10.5M35.5 8l3-3 3 3M35.5 12.5l3 3 3-3"/>`,

  "emote-angry": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="25" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="25" r="1.8" fill="currentColor" stroke="none"/><path d="m12.5 19.5 6 3M29.5 19.5l-6 3"/><path d="M15.5 34.5c3-3.2 8-3.2 11 0"/><path d="M34.5 9c2 0 2.5-.5 2.5-2.5M40 6.5c0 2 .5 2.5 2.5 2.5M42.5 12c-2 0-2.5.5-2.5 2.5M37 14.5c0-2-.5-2.5-2.5-2.5"/>`,

  "emote-atease": `<circle cx="24" cy="9" r="4.5"/><path d="M24 16v13M18 43l6-14 6 14"/><path d="M24 19l-6.5 5.5 4.5 4M24 19l6.5 5.5-4.5 4"/>`,

  "emote-attention": `<circle cx="24" cy="9" r="4.5"/><path d="M24 16v13M21 43l3-14 3 14"/><path d="M24 19l-4.5 2.5V32M24 19l4.5 2.5V32"/><path d="M13 7v8M35 7v8" opacity=".55"/>`,

  "emote-blah": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><ellipse cx="21" cy="32.5" rx="3.4" ry="2.2"/><path d="M32 4.5h10.5c1 0 1.5.5 1.5 1.5v7c0 1-.5 1.5-1.5 1.5h-6l-3.5 3v-3H32c-1 0-1.5-.5-1.5-1.5V6c0-1 .5-1.5 1.5-1.5Z"/><path d="m33.5 11.5 2-3.5 2 3.5 2-3.5 2 3.5" opacity=".7"/>`,

  "emote-bored": `<circle cx="21" cy="27" r="13"/><path d="M13.5 23.5h5M22.5 23.5h5"/><circle cx="16" cy="25.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="25" cy="25.2" r="1.5" fill="currentColor" stroke="none"/><path d="M17 33h8"/><circle cx="33" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="37.5" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="42" cy="11" r="1.5" fill="currentColor" stroke="none"/>`,

  "emote-bow": `<circle cx="35" cy="26" r="4.5"/><path d="M18 29 30 20.5"/><path d="M29 21.5l-.5 9.5"/><path d="M16.5 43 18 29l2.5 14"/><path d="M27 10.5c5-1 10 1 13 5M40.5 16l-.2-4.2M40.5 16l-4-1.3" opacity=".55"/>`,

  "emote-burp": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><ellipse cx="23.5" cy="32.5" rx="2.2" ry="1.8"/><path d="M37 37h4.5c1.2 0 2.2-1 2.2-2.2s-1-2.2-2.2-2.2c0-1.7-1.4-3-3-3s-2.8 1.1-3 2.6c-1.3 0-2.3 1-2.3 2.3S35.6 37 37 37Z"/>`,

  "emote-cheer": `<circle cx="24" cy="9" r="4.5"/><path d="M24 16v13M17 43l7-14 7 14"/><path d="M24 19 14 7.5M24 19 34 7.5"/><path d="m10.5 5-2.5-1M9.5 10h-3M37.5 5l2.5-1M38.5 10h3" opacity=".55"/>`,

  "emote-chicken": `<circle cx="24" cy="27" r="13"/><path d="M18.5 15c-1.3-3.3 2-5.4 4-3.2.6-3 5-3 5.4 0 2-1.8 5 .3 3.6 3.4"/><circle cx="19.5" cy="25" r="2" fill="currentColor" stroke="none"/><circle cx="28.5" cy="25" r="2" fill="currentColor" stroke="none"/><path d="M20 29.5h8l-4 5Z" fill="currentColor" stroke="none"/><path d="M11 32c-3 .3-5.6-1-7-3.5M37 32c3 .3 5.6-1 7-3.5"/><path d="M6 35.5 4 37M42 35.5l2 1.5" opacity=".55"/>`,

  "emote-clap": `<g transform="rotate(-24 35.5 41)"><path d="M30.5 41V26c0-2.8 2.2-5 5-5s5 2.2 5 5v15"/><path d="M33.8 21.6v5M37.2 21.6v5" opacity=".55"/><path d="M29.5 41h12"/><path d="M40.5 35.5l3-3.5"/></g><g transform="matrix(-1 0 0 1 48 0)"><g transform="rotate(-24 35.5 41)"><path d="M30.5 41V26c0-2.8 2.2-5 5-5s5 2.2 5 5v15"/><path d="M33.8 21.6v5M37.2 21.6v5" opacity=".55"/><path d="M29.5 41h12"/><path d="M40.5 35.5l3-3.5"/></g></g><path d="M24 5v5M16.5 7.5l2 3.5M31.5 7.5l-2 3.5"/>`,

  "emote-come": `<circle cx="16" cy="9" r="4.5"/><path d="M16 16v13M11 43l5-14 5 14"/><path d="M16 19l-4 14"/><path d="M16 19l8 3 3-7.5c.6-1.6 2.8-1.6 3 0"/><path d="m37 17-4.5 5 4.5 5"/><path d="m43 17-4.5 5 4.5 5" opacity=".55"/>`,

  "emote-cry": `<circle cx="24" cy="27" r="13"/><path d="M16.5 25c1.5-1.8 3.5-1.8 5 0M26.5 25c1.5-1.8 3.5-1.8 5 0"/><path d="M19 28c-1.5 2.5-2.5 4-2.5 5.2 0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0-1.2-1-2.7-2.5-5.2Z" fill="currentColor" stroke="none"/><path d="M21 36.8c.9-1.4 1.9-1.9 3-1.9s2.1.5 3 1.9"/>`,

  "emote-dance": `<circle cx="22" cy="9" r="4.5"/><path d="M23 16l2 13"/><path d="M23.5 19 34 8.5M23.5 19 18 23.5l5.5 4.5"/><path d="m25 29-5 14M25 29l7 5-2 9"/><ellipse cx="8.5" cy="14" rx="2.8" ry="2.1" transform="rotate(-20 8.5 14)" fill="currentColor" stroke="none"/><path d="M11 13V5c2 1.2 4.5 2.4 4.5 5.5"/>`,

  "emote-disagree": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><path d="M16.5 33c2.8-1.2 6.2-1.2 9 0"/><path d="M32 10h11.5M35 7l-3 3 3 3M40.5 7l3 3-3 3"/>`,

  "emote-failure": `<circle cx="21" cy="17" r="10"/><path d="M16.5 24.2c1.8-1.2 4.2-1.2 6 0"/><g transform="rotate(-18 21 15)"><rect x="16" y="12" width="10" height="6.5" rx="3" fill="currentColor" stroke="none"/><path d="M16.2 13.5V8M19.4 12.5V6M22.6 12.5V6.5M25.8 13.5V8.5"/></g><path d="M27 19.5 32 34l-1 9"/><path d="M6 43c0-6 4-10.5 10-11.5M37 36c1.5 2 2.3 4.5 2.5 7" opacity=".55"/>`,

  "emote-flex": `<circle cx="24" cy="9" r="4.5"/><path d="M24 16v13"/><path d="M24 19h-3.5c-1.2-3.2-4.8-3.2-6 0H13l1.5-9M24 19h3.5c1.2-3.2 4.8-3.2 6 0H35l-1.5-9"/><path d="m24 29-6 7-1 7M24 29l6 7 1 7"/>`,

  "emote-flirt": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><path d="M23 25.2c1.4-1.9 3.6-1.9 5 0"/><path d="M15.5 30.5c3 3.6 8 3.6 11 0"/><path d="M38 15.5c-4-2.7-6-5-6-7.4 0-1.8 1.3-3.1 3-3.1 1.4 0 2.4.8 3 2 .6-1.2 1.6-2 3-2 1.7 0 3 1.3 3 3.1 0 2.4-2 4.7-6 7.4Z" fill="currentColor" stroke="none"/>`,

  "emote-gasp": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><path d="M13.5 19.8c1.4-1.3 3.4-1.5 4.8-.6M23.7 19.2c1.4-.9 3.4-.7 4.8.6" opacity=".55"/><ellipse cx="21" cy="32.5" rx="2.6" ry="3.3"/><path d="M38 5v7"/><circle cx="38" cy="16" r="1.7" fill="currentColor" stroke="none"/>`,

  "emote-gloat": `<circle cx="21" cy="27" r="13"/><path d="M13.5 23.5l5.5.6M22.5 23.3l5.5-.4"/><circle cx="18" cy="25.4" r="1.5" fill="currentColor" stroke="none"/><circle cx="27" cy="25.1" r="1.5" fill="currentColor" stroke="none"/><path d="M13.5 20c1.6-.6 3.5-.6 5 0M23 18.6c1.7-1.2 3.7-1.3 5.3-.4" opacity=".55"/><path d="M16 32.5c3.3 1.1 7 .5 10.5-2.8"/><path d="M38 4c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4Z" fill="currentColor" stroke="none"/>`,

  "emote-greet": `<circle cx="12" cy="9" r="4.5"/><circle cx="36" cy="9" r="4.5"/><path d="M12 16V29M36 16V29"/><path d="M12 19l-3 13M36 19l3 13"/><path d="M12 19l5 7 5.5-1.5M36 19l-5 7-5.5-1.5"/><path d="m12 29-4 14M12 29l4 14M36 29l-4 14M36 29l4 14"/><circle cx="24" cy="24.5" r="2.4" fill="currentColor" stroke="none"/>`,

  "emote-laugh": `<g transform="rotate(-10 21 27)"><circle cx="21" cy="27" r="13"/><path d="M14 25.5l2.5-2.5 2.5 2.5M23 25.5l2.5-2.5 2.5 2.5"/><path d="M14.5 29.5h13c-.6 4.6-3.3 7-6.5 7s-5.9-2.4-6.5-7Z"/></g><path d="M35 11.5l3.5-3M37.5 17l4.5-1M33 8l.8-2.5" opacity=".55"/>`,

  "emote-launch": `<circle cx="16" cy="9" r="4.5"/><path d="M16 16V29"/><path d="M16 19l-7 6"/><path d="M16 19l7-4 4-8"/><path d="m16 29-6 14M16 29l6 6v8"/><path d="M28 6.2c1.2-.6 2.4-1 3.6-1.2M34.6 4.9c1.5.1 2.9.6 4 1.4" opacity=".55"/><circle cx="41.2" cy="10" r="2.6" fill="currentColor" stroke="none"/>`,

  "emote-point": `<circle cx="16" cy="9" r="4.5"/><path d="M16 16V29"/><path d="M16 19l-4 13"/><path d="M16 19 33 17.5"/><path d="m16 29-5 14M16 29l6 14"/><path d="M37 17.2h2M42 17h2" opacity=".55"/>`,

  "emote-rude": `<circle cx="21" cy="27" r="13"/><path d="M13.5 22l3.5 2.5-3.5 2.5M28.5 22 25 24.5l3.5 2.5"/><path d="M14.5 31h13"/><path d="M17.5 31h7v3.5c0 2-1.6 3.5-3.5 3.5s-3.5-1.5-3.5-3.5Z" fill="currentColor" stroke="none"/><path d="M36.5 30.5l4-1.5M37 34.5h4.5M36.5 38.5l3.5 1.5"/>`,

  "emote-salute": `<circle cx="24" cy="9" r="4.5"/><path d="M24 16V29"/><path d="M24 19l4.5 2.5V32"/><path d="M24 19 13.5 18.5l6-11 4-1.5"/><path d="M24 29l-3 14M24 29l3 14"/>`,

  "emote-sit": `<circle cx="24" cy="12" r="4.5"/><path d="M24 19V32h10l1 11"/><path d="M24 22l4.5 6 5.5 1.5"/><rect x="13" y="33" width="15" height="10" rx="1.5"/><path d="M13 38h15" opacity=".55"/>`,

  "emote-sleep": `<circle cx="21" cy="27" r="13"/><path d="M13.5 24.5c1.6 1.6 4.4 1.6 6 0M22.5 24.5c1.6 1.6 4.4 1.6 6 0"/><path d="M19.5 32.5h3"/><path d="M36 4h7l-7 8h7"/><path d="M30.5 12h4l-4 4.5h4"/>`,

  "emote-smell": `<circle cx="21" cy="27" r="13"/><path d="M13.5 23.5l5 .8M28.5 23.5l-5 .8"/><path d="M20.5 26.5c-.8 1.5-.4 2.7 1.5 2.7" opacity=".55"/><path d="M15 33c1.5-1.6 3-1.6 4 0s2.5 1.6 4 0 2.5-1.6 4 0"/><path d="M35 17c-1.6-2 1.6-3.5 0-5.5s1.6-3.5 0-5.5M41 18c-1.6-2 1.6-3.5 0-5.5s1.6-3.5 0-5.5"/>`,

  "emote-taunt": `<circle cx="24" cy="27" r="13"/><circle cx="18.5" cy="24" r="2" fill="currentColor" stroke="none"/><circle cx="29.5" cy="24" r="2" fill="currentColor" stroke="none"/><path d="M18.5 31c3 3.5 8 3.5 11 0"/><g transform="translate(10.8 22) rotate(-15)"><rect x="-3.5" y="-7" width="7" height="7" rx="2.5"/><path d="M-2.2-7.2-3-11.5M0-7.4v-5M2.2-7.2 3-11.5M3.5-3l2.5-2"/></g><g transform="matrix(-1 0 0 1 48 0)"><g transform="translate(10.8 22) rotate(-15)"><rect x="-3.5" y="-7" width="7" height="7" rx="2.5"/><path d="M-2.2-7.2-3-11.5M0-7.4v-5M2.2-7.2 3-11.5M3.5-3l2.5-2"/></g></g>`,

  "emote-threaten": `<path d="M13 25V14c0-2.2 1.3-3.5 3-3.5s3 1.3 3 3.5c0-2.2 1.3-3.5 3-3.5s3 1.3 3 3.5c0-2.2 1.3-3.5 3-3.5s3 1.3 3 3.5c0-2.2 1.3-3.5 3-3.5s3 1.3 3 3.5v12c0 5.5-4 9-9.5 9h-5C17 35 13 31 13 25.5Z"/><path d="M19 14v5M25 14v5M31 14v5" opacity=".55"/><path d="M13 24h11.5c1.9 0 3.5 1.6 3.5 3.5S26.4 31 24.5 31H21"/><path d="M18 33.6V41M32 33.4V41M16.5 41h17"/><path d="M7.5 11.5 10 13.5M6.5 18.5H10M41.5 7.5 39 10"/>`,

  "emote-wait": `<circle cx="19" cy="9" r="4.5"/><path d="M19 16V29"/><path d="M19 19l-4 13"/><path d="M19 19l8 3v-9.5"/><path d="m19 29-5 14M19 29l5 14"/><path d="M35 5h8l-8 12h8Z"/><path d="M37.5 16h3l-1.5-2.2Z" fill="currentColor" stroke="none"/>`,

  "emote-wave": `<circle cx="22" cy="9" r="4.5"/><path d="M22 16V29"/><path d="M22 19l-4 13"/><path d="M22 19l8 1.5 3-10"/><path d="m22 29-5 14M22 29l5 14"/><path d="M37 5c1.6 1.8 2 4.4 1 7"/><path d="M40.5 4c2.2 2.6 2.8 6.2 1.4 9.6" opacity=".55"/>`,

  "emote-whistle": `<circle cx="21" cy="27" r="13"/><circle cx="16.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="25.5" cy="24.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="23.5" cy="32.5" r="1.9"/><circle cx="35.5" cy="14" r="2.4" fill="currentColor" stroke="none"/><path d="M37.9 14V4.5l5 1.8"/>`,

  // ---------- Ship actions the HUD shows as text only, and Stream Deck scenes (cargo for hauling, explore). ----------

  atc: `<path d="M10 14h28l-5 10H15Z"/><path d="M19 14l1.5 10M29 14l-1.5 10" opacity=".5"/>
    <path d="M10 14l3-4h22l3 4"/><path d="M24 10V7"/><circle cx="24" cy="6" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M19 24l-2 18M29 24l2 18M12 42h24"/><path d="M21 32h6M20.5 37h7" opacity=".45"/>`,

  autoland: `<path d="M24 6l4.5 10 6.5 3.6v2.2l-7.2-1.3-1.3 4h-5l-1.3-4-7.2 1.3v-2.2l6.5-3.6Z"/>
    <path d="m19 29 5 3 5-3" opacity=".7"/>
    <ellipse cx="24" cy="39" rx="16" ry="4.5"/><path d="M20 39h8" opacity=".55"/>
    <path d="M11 36.5 16 26M37 36.5 32 26" opacity=".45"/>`,

  cargo: `<rect x="5" y="26" width="18" height="16" rx="1.5"/><rect x="25" y="26" width="18" height="16" rx="1.5"/>
    <rect x="15" y="8" width="18" height="16" rx="1.5"/>
    <path d="M9 30l10 8M19 30 9 38M29 30l10 8M39 30l-10 8M19 12l10 8M29 12l-10 8" opacity=".45"/>`,

  "dock-camera": `<path d="M5 13V5h8M35 5h8v8M43 35v8h-8M13 43H5v-8"/>
    <ellipse cx="24" cy="24" rx="6.5" ry="12"/><ellipse cx="24" cy="24" rx="2.8" ry="6" opacity=".55"/>`,

  docking: `<ellipse cx="24" cy="24" rx="6.5" ry="13"/><ellipse cx="24" cy="24" rx="3" ry="7" opacity=".55"/>
    <path d="M5 24h9m-4-4 4 4-4 4M43 24h-9m4-4-4 4 4 4"/>`,

  eject: `<path d="m17 9.5 7-5.5 7 5.5"/><path d="m19.5 14 4.5-3.5 4.5 3.5" opacity=".55"/>
    <path d="M15 17v11a5 5 0 0 0 5 5h13"/><path d="M15 21h4v7h14"/>
    <path d="M19 37v4M25 37v6M31 37v4" opacity=".55"/>`,

  explore: `<circle cx="19" cy="30" r="10"/>
    <path d="M26.2 23.1A15.5 5 -20 1 1 9 29.3"/>
    <path d="M36 21s-5.5-5.6-5.5-10a5.5 5.5 0 0 1 11 0c0 4.4-5.5 10-5.5 10Z"/><circle cx="36" cy="11" r="1.8" fill="currentColor" stroke="none"/>`,

  hail: `<path d="M8 17a16 16 0 0 0 19 19Z"/><path d="M17.5 26.5 24 20"/><circle cx="25" cy="19" r="2" fill="currentColor" stroke="none"/>
    <path d="M14 33l2 8M10 42h12" opacity=".7"/>
    <path d="M27.4 12.4A7 7 0 0 1 31.6 16.6"/><path d="M29.4 6.8A13 13 0 0 1 37.2 14.6" opacity=".6"/>`,

  headtrack: `<path d="M17 43v-8c-3-2.5-5-6-5-10.5C12 16.5 17.8 11 25 11c6.5 0 11.5 4.6 11.5 11l3 5.5-3 1V33a3 3 0 0 1-3 3H31v7"/>
    <circle cx="30" cy="21" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M11 8.5Q24 3 37 8.5" opacity=".65"/><path d="M14.4 9.2 11 8.5l1.9-3M33.6 9.2 37 8.5l-1.9-3" opacity=".65"/>`,

  "scan-ping": `<circle cx="24" cy="24" r="3" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="8"/>
    <path d="M35.2 16.5a13.5 13.5 0 0 1 0 15M31.5 35.2a13.5 13.5 0 0 1-15 0M12.8 31.5a13.5 13.5 0 0 1 0-15M16.5 12.8a13.5 13.5 0 0 1 15 0" opacity=".6"/>
    <path d="M40.5 14.5a19 19 0 0 1 0 19M33.5 40.5a19 19 0 0 1-19 0M7.5 33.5a19 19 0 0 1 0-19M14.5 7.5a19 19 0 0 1 19 0" opacity=".3"/>`,

  "scm-nav": `<path d="M7 27A17 17 0 0 1 21 10.3" opacity=".5"/><path d="M27 10.3A17 17 0 0 1 41 27"/>
    <path d="M24 27l7.5-9"/><path d="M24 27l-7.5-9" opacity=".45"/><circle cx="24" cy="27" r="3" fill="currentColor" stroke="none"/>
    <path d="M14 36h20m-4-3 4 3-4 3M18 33l-4 3 4 3" opacity=".7"/>`,

  "self-destruct": `<g transform="rotate(-9 14 31) translate(-1.5 1)"><path d="M24 5 25.5 13 22.5 21 25 29 23 41H21L19 30 6 32V28L18 21Z"/></g>
    <g transform="rotate(9 34 31) translate(1.5 1)"><path d="M24 5 30 21 42 28V32L29 30 27 41H23L25 29 22.5 21 25.5 13Z"/></g>
    <path d="M23.8 14.4l.75 2.65 1.45.75-1.45.75-.75 2.65-.75-2.65-1.45-.75 1.45-.75Z" fill="currentColor" stroke="none"/>`,

  voip: `<path d="M8 8h32a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H21l-9 8v-8H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z"/>
    <path d="M14 18v6M19.5 15v12M25 12.5v17M30.5 16v10M36 19v4"/>`,

  // ---------- Comms, audio, streaming and Stream Deck navigation. Generic concepts, never a brand's logo. ----------

  app: `<path d="M26 9H12C10.34 9 9 10.34 9 12V36C9 37.66 10.34 39 12 39H36C37.66 39 39 37.66 39 36V22"/><path d="M8 17h18" opacity=".55"/><path d="M23 25 40 8M31 8h9v9"/>`,

  back: `<path d="M17 9 8 18l9 9"/><path d="M8 18h20C33.52 18 38 22.48 38 28C38 33.52 33.52 38 28 38H17"/>`,

  brightness: `<circle cx="24" cy="24" r="8"/><path d="M24 11L24 5M33.55 14.45L36.37 11.63M37 24L43 24M33.55 33.55L36.37 36.37M24 37L24 43M14.45 33.55L11.63 36.37M11 24L5 24M14.45 14.45L11.63 11.63"/><path d="M24 16C19.58 16 16 19.58 16 24C16 28.42 19.58 32 24 32Z" fill="currentColor" stroke="none"/>`,

  clock: `<circle cx="24" cy="24" r="18"/><path d="M24 13v11l7.5 5"/><circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none"/><path d="M24 8v2M40 24h-2M24 40v-2M8 24h2" opacity=".55"/>`,

  comms: `<path d="M9 27V24C9 15.72 15.72 9 24 9C32.28 9 39 15.72 39 24V27"/><rect x="5" y="24" width="8" height="13" rx="3"/><rect x="35" y="24" width="8" height="13" rx="3"/><circle cx="24" cy="24" r="2.4" fill="currentColor" stroke="none"/><path d="M19.4 27.86C17.53 25.63 17.53 22.37 19.4 20.14M28.6 20.14C30.47 22.37 30.47 25.63 28.6 27.86"/><path d="M9 37C9 41 12 42.5 17 42.5H20"/>`,

  deafen: `<path d="M10 26.5V22.5C10 14.77 16.27 8.5 24 8.5C31.73 8.5 38 14.77 38 22.5V26.5"/><rect x="6" y="22.5" width="8" height="13" rx="3"/><rect x="34" y="22.5" width="8" height="13" rx="3"/><path d="M8 8 40 40"/>`,

  folder: `<path d="M6 11h13l4 5h19v20l-4 4H6Z"/><path d="M6 21h36" opacity=".55"/>`,

  headset: `<path d="M10 26.5V22.5C10 14.77 16.27 8.5 24 8.5C31.73 8.5 38 14.77 38 22.5V26.5"/><rect x="6" y="22.5" width="8" height="13" rx="3"/><rect x="34" y="22.5" width="8" height="13" rx="3"/><path d="M10 35.5C10 39.5 13 41 18 41H20"/><circle cx="22.4" cy="41" r="2.2" fill="currentColor" stroke="none"/>`,

  home: `<path d="M6 23 24 8l18 15"/><path d="M11 19v21h26V19"/><path d="M20 40V30h8v10"/><circle cx="24" cy="18.5" r="1.8" fill="currentColor" stroke="none"/>`,

  link: `<path d="M9.72 31.21L18.21 22.72C20.16 20.77 23.33 20.77 25.28 22.72C27.23 24.67 27.23 27.84 25.28 29.79L16.79 38.28C14.84 40.23 11.67 40.23 9.72 38.28C7.77 36.33 7.77 33.16 9.72 31.21Z"/><path d="M22.72 18.21L31.21 9.72C33.16 7.77 36.33 7.77 38.28 9.72C40.23 11.67 40.23 14.84 38.28 16.79L29.79 25.28C27.84 27.23 24.67 27.23 22.72 25.28C20.77 23.33 20.77 20.16 22.72 18.21Z"/>`,

  live: `<circle cx="24" cy="24" r="3" fill="currentColor" stroke="none"/><path d="M17.87 29.14C15.38 26.17 15.38 21.83 17.87 18.86M30.13 18.86C32.62 21.83 32.62 26.17 30.13 29.14"/><path d="M12.53 32.03C9.16 27.21 9.16 20.79 12.53 15.97M35.47 15.97C38.84 20.79 38.84 27.21 35.47 32.03" opacity=".55"/><path d="M7.2 35C2.9 28.2 2.9 19.8 7.2 13M40.8 13C45.1 19.8 45.1 28.2 40.8 35" opacity=".45"/>`,

  "mic-off": `<rect x="17" y="5" width="14" height="24" rx="7"/><path d="M10 22C10 29.73 16.27 36 24 36C31.73 36 38 29.73 38 22M24 36V43M17 43h14"/><path d="M9 7 39 41"/>`,

  "next-track": `<path d="M8 13v22l13-11Z"/><path d="M21 13v22l13-11Z"/><path d="M39 13v22"/>`,

  "page-next": `<path d="M9 6h30v25L28 42H9Z"/><path d="M39 31H28v11"/><path d="M15 20h15m-5.5-5.5L30 20l-5.5 5.5"/>`,

  "page-prev": `<path d="M39 6H9v25l11 11h19Z"/><path d="M9 31h11v11"/><path d="M33 20H18m5.5-5.5L18 20l5.5 5.5"/>`,

  palette: `<path d="M24 7C33.9 7 42 13.9 42 22.4c0 5.2-4.2 7.6-8.2 6.4-3.1-.9-5.3 1.6-4.5 4.5 1 3.6-1.3 6.7-5.3 6.7C14.1 40 6 32.4 6 23.5S14.1 7 24 7Z"/><circle cx="15" cy="21" r="2.3" fill="currentColor" stroke="none"/><circle cx="21.5" cy="14.5" r="2.3" fill="currentColor" stroke="none"/><circle cx="30.5" cy="15" r="2.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="30" r="2.3" opacity=".55"/>`,

  "play-pause": `<path d="M7 13v22l15-11Z"/><path d="M31 13v22M40 13v22"/>`,

  "prev-track": `<path d="M40 13v22L27 24Z"/><path d="M27 13v22L14 24Z"/><path d="M9 13v22"/>`,

  "push-to-mute": `<rect x="10.84" y="5" width="12.32" height="21.12" rx="6.16"/><path d="M4.68 19.96C4.68 26.76 10.2 32.28 17 32.28C23.8 32.28 29.32 26.76 29.32 19.96M17 32.28V38.44M10.84 38.44h12.32"/><path d="M5.5 8 29.5 39"/><path d="M37.3 5v13m-4-4 4 4 4-4"/><path d="M33.4 24.5h7.8c.6 0 1.1.4 1.2 1L44 34.5c.1.6-.3 1-.9 1H31.5c-.6 0-1-.4-.9-1l1.6-9c.1-.6.6-1 1.2-1Z"/><path d="M34 27.5h6.6l-.6 4.5h-5.4Z" opacity=".55"/>`,

  "push-to-talk": `<rect x="10.84" y="5" width="12.32" height="21.12" rx="6.16"/><path d="M4.68 19.96C4.68 26.76 10.2 32.28 17 32.28C23.8 32.28 29.32 26.76 29.32 19.96M17 32.28V38.44M10.84 38.44h12.32"/><path d="M10.84 13.8h5.28M10.84 19.08h5.28" opacity=".55"/><path d="M37.3 5v13m-4-4 4 4 4-4"/><path d="M33.4 24.5h7.8c.6 0 1.1.4 1.2 1L44 34.5c.1.6-.3 1-.9 1H31.5c-.6 0-1-.4-.9-1l1.6-9c.1-.6.6-1 1.2-1Z"/><path d="M34 27.5h6.6l-.6 4.5h-5.4Z" opacity=".55"/>`,

  record: `<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="6.5" fill="currentColor" stroke="none"/>`,

  replay: `<path d="M10.14 17C6.52 23.27 7.57 31.19 12.69 36.31C17.81 41.43 25.73 42.48 32 38.86C38.27 35.24 41.33 27.85 39.45 20.86C37.58 13.86 31.24 9 24 9"/><path d="M28 5 24 9l4 4"/><path d="M20.5 19v12l9.5-6Z"/>`,

  screenshot: `<path d="M6 14V6h8M34 6h8v8M42 34v8h-8M14 42H6v-8"/><path d="M14 19h5l2-3h6l2 3h5v14H14Z"/><circle cx="24" cy="26" r="4"/><circle cx="31" cy="22" r="1.4" fill="currentColor" stroke="none"/>`,

  "text-channel": `<path d="M10 8H38C40.21 8 42 9.79 42 12V30C42 32.21 40.21 34 38 34H35v7l-8-7H10C7.79 34 6 32.21 6 30V12C6 9.79 7.79 8 10 8Z"/><path d="M21.5 13l-2.5 16M29.5 13 27 29M15 18.5h18M14 23.5h18"/>`,

  timer: `<circle cx="24" cy="27" r="15"/><path d="M20 6h8M24 6v6"/><path d="m35 13 3-3"/><path d="M24 27V19"/><circle cx="24" cy="27" r="2.4" fill="currentColor" stroke="none"/><path d="M24 15v1.5M36 27h-1.5M24 39v-1.5M12 27h1.5" opacity=".55"/>`,

  "voice-channel": `<path d="M13 10h4l6-5v17l-6-5h-4Z"/><path d="M26.21 9.67C27.35 10.62 28 12.02 28 13.5C28 14.98 27.35 16.38 26.21 17.33"/><path d="M29.11 6.22C31.26 8.03 32.5 10.69 32.5 13.5C32.5 16.31 31.26 18.97 29.11 20.78" opacity=".55"/><circle cx="15" cy="30" r="3.36"/><path d="M8.7 41.55C8.7 36.83 11.33 35.25 15 35.25S21.3 36.83 21.3 41.55"/><circle cx="33" cy="30" r="3.36" opacity=".55"/><path d="M26.7 41.55C26.7 36.83 29.33 35.25 33 35.25S39.3 36.83 39.3 41.55" opacity=".55"/>`,

  "volume-down": `<path d="M6 18h7l10-8v28l-10-8H6Z"/><path d="M13 18v12" opacity=".55"/><path d="M30 24h12"/>`,

  "volume-mute": `<path d="M6 18h7l10-8v28l-10-8H6Z"/><path d="M13 18v12" opacity=".55"/><path d="m31 19 10 10m0-10-10 10"/>`,

  "volume-up": `<path d="M6 18h7l10-8v28l-10-8H6Z"/><path d="M13 18v12" opacity=".55"/><path d="M30 24h12M36 18v12"/>`,

  // ---------- 2.2 buttons ----------
  // Missile count: the missile with a plus, or a turn-back arrow.
  "missile-more": `<path d="M30 10c4 0 7 3 7 7L20 34l-6-6Z"/><path d="m14 28-5 1.5 1.5-6 6-1.5M20 34l-1.5 5 6-1.5 1.5-6" opacity=".7"/>
    <path d="M37 33h9M41.5 28.5v9"/>`,
  "missile-reset": `<path d="M30 10c4 0 7 3 7 7L20 34l-6-6Z"/><path d="m14 28-5 1.5 1.5-6 6-1.5M20 34l-1.5 5 6-1.5 1.5-6" opacity=".7"/>
    <path d="M45 37a6 6 0 1 1-2-6"/><path d="M44 27v4h-4"/>`,
  // Decoy burst size: a smaller or bigger spray of decoys.
  "burst-down": `<circle cx="18" cy="24" r="3" fill="currentColor" stroke="none"/>
    <path d="M18 13v4M18 31v4M7 24h4M25 24h4M10.5 16.5l3 3M22.5 28.5l3 3M10.5 31.5l3-3M22.5 19.5l3-3"/><path d="M35 24h9"/>`,
  "burst-up": `<circle cx="18" cy="24" r="3" fill="currentColor" stroke="none"/>
    <path d="M18 7v8M18 33v8M2 24h8M26 24h8M6.7 12.7l5.6 5.6M23.7 29.7l5.6 5.6M6.7 35.3l5.6-5.6M23.7 18.3l5.6-5.6"/><path d="M35 24h9M39.5 19.5v9"/>`,
  // Forward target cycles: each kind's mark from the targeting cluster, then a chevron.
  "next-attacker": `<path d="M18 7 33 22 18 37 3 22Z"/><path d="M18 15v9M18 29v.5"/><path d="m36 14 8 8-8 8"/>`,
  "next-friendly": `<circle cx="17" cy="22" r="13"/><path d="m10.5 23 4.5 4.5 9-9"/><path d="m36 14 8 8-8 8"/>`,
  "next-any": `<rect x="5" y="9" width="25" height="25" rx="3.5"/><circle cx="17.5" cy="21.5" r="4"/><path d="m36 14 8 8-8 8"/>`,
  "next-view": `<path d="M3 22c5.5-9.5 23.5-9.5 29 0-5.5 9.5-23.5 9.5-29 0Z"/><circle cx="17.5" cy="22" r="5"/><path d="m36 14 8 8-8 8"/>`,
  "next-sub": `<circle cx="17" cy="22" r="13" stroke-dasharray="4 3"/><circle cx="17" cy="22" r="5"/><circle cx="17" cy="22" r="1.6" fill="currentColor" stroke="none"/><path d="m36 14 8 8-8 8"/>`,
  // Target pins: a pin with its slot's number, and a reticle with its lock broken.
  "pin-1": `<path d="M14 6h14M17 6v12l-5 6h18l-5-6V6"/><path d="M21 24v14"/><path d="M33 31l4-3v15M33 43h8"/>`,
  "pin-2": `<path d="M14 6h14M17 6v12l-5 6h18l-5-6V6"/><path d="M21 24v14"/><path d="M32 31.5a4.5 4.5 0 0 1 9 0c0 4-9 7-9 11.5h9.5"/>`,
  "pin-3": `<path d="M14 6h14M17 6v12l-5 6h18l-5-6V6"/><path d="M21 24v14"/><path d="M32 28h9l-5 6a4.5 4.5 0 1 1-4 6.5"/>`,
  "target-unlock": `<path d="M6 16V6h10M32 6h10v10M42 32v10H32M16 42H6V32"/><circle cx="24" cy="24" r="7" stroke-dasharray="5 4"/>
    <path d="m35 13-22 22" opacity=".7"/>`,
  // Salvage heads: two heads with a beam (fire) or a frame around the one in focus.
  "salvage-fire-left": `<rect x="5" y="8" width="12" height="9" rx="2" fill="currentColor" stroke="none"/><rect x="31" y="8" width="12" height="9" rx="2"/>
    <path d="M11 17v10M8 27l3 14 3-14Z"/><path d="M37 17v6" opacity=".55"/>`,
  "salvage-fire-right": `<rect x="5" y="8" width="12" height="9" rx="2"/><rect x="31" y="8" width="12" height="9" rx="2" fill="currentColor" stroke="none"/>
    <path d="M37 17v10M34 27l3 14 3-14Z"/><path d="M11 17v6" opacity=".55"/>`,
  "salvage-focus-left": `<rect x="7" y="18" width="12" height="9" rx="2"/><rect x="29" y="18" width="12" height="9" rx="2" opacity=".55"/>
    <path d="M3 14v-4h4M23 14v-4h-4M3 31v4h4M23 31v4h-4"/><path d="M13 27v8M35 27v4" opacity=".55"/>`,
  "salvage-focus-right": `<rect x="7" y="18" width="12" height="9" rx="2" opacity=".55"/><rect x="29" y="18" width="12" height="9" rx="2"/>
    <path d="M25 14v-4h4M45 14v-4h-4M25 31v4h4M45 31v4h-4"/><path d="M35 27v8M13 27v4" opacity=".55"/>`,
  "salvage-focus-all": `<rect x="7" y="18" width="12" height="9" rx="2"/><rect x="29" y="18" width="12" height="9" rx="2"/>
    <path d="M3 14v-4h5M45 14v-4h-5M3 31v4h5M45 31v4h-5"/><path d="M13 27v8M35 27v8" opacity=".55"/>`,
  // Light amplification: a visor seeing in the dark.
  "light-amp": `<path d="M5 20c0-6 8-10 19-10s19 4 19 10v4c0 6-6 10-12 10-4 0-5-4-7-4s-3 4-7 4C11 34 5 30 5 24Z"/>
    <path d="M15 22h4M29 22h4"/><path d="M33 4l1.5 3.5L38 9l-3.5 1.5L33 14l-1.5-3.5L28 9l3.5-1.5Z" fill="currentColor" stroke="none" opacity=".6"/>`,
  // Port locks: a port's ring with a padlock.
  "port-lock": `<circle cx="20" cy="22" r="14"/><circle cx="20" cy="22" r="7" opacity=".55"/>
    <rect x="30" y="31" width="14" height="11" rx="2"/><path d="M33 31v-3a4 4 0 0 1 8 0v3"/>`,
  // Emergency exit: out of the seat fast.
  "emergency-exit": `<path d="M10 8v19a5 5 0 0 0 5 5h9"/><path d="M10 15h4v11h8"/><path d="M15 32v10M23 32v10M12 42h14"/>
    <path d="M28 14h15m-6-6 6 6-6 6M30 24h11m-5-5 5 5-5 5" opacity=".75"/>`,
  // Jettison: a crate falling out of the hold.
  jettison: `<path d="M6 8h36M10 8v8M38 8v8" opacity=".6"/><rect x="15" y="20" width="18" height="16" rx="1.5" transform="rotate(12 24 28)"/>
    <path d="M18 41l-2 4M30 41l2 4M24 41v4" opacity=".55"/>`,
  // Power throttle: the power mark with an up or down arrow.
  "power-up": `<path d="M20 8v13"/><path d="M12.5 13.5a12 12 0 1 0 15 0"/><path d="M40 30V12m-5 5 5-5 5 5"/>`,
  "power-down": `<path d="M20 8v13"/><path d="M12.5 13.5a12 12 0 1 0 15 0"/><path d="M40 12v18m-5-5 5 5 5-5"/>`,

  // A control deck with keys and a dial (the Stream Deck pack; not a product's look).
  keypad: `<rect x="5" y="11" width="38" height="27" rx="4"/><rect x="10" y="16" width="6" height="6" rx="1.2"/><rect x="19" y="16" width="6" height="6" rx="1.2"/><rect x="10" y="26" width="6" height="6" rx="1.2"/><rect x="19" y="26" width="6" height="6" rx="1.2" fill="currentColor" stroke="none" opacity=".55"/><circle cx="34.5" cy="24.5" r="5"/><path d="M34.5 19.5v3"/>`,
  default: `<path d="M24 5 40 14v20L24 43 8 34V14Z"/><circle cx="24" cy="24" r="5" fill="currentColor" stroke="none" opacity=".6"/>`,
};

window.deckIcon = function deckIcon(name) {
  const body = window.DECK_ICONS[name] || window.DECK_ICONS.default;
  return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
};
