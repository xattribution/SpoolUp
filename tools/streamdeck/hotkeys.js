// SpoolUp key combos ("lalt+n", "np_1", "rctrl+lbracket") as the Hotkeys Stream Deck's
// built-in Hotkey action stores on Windows (research/profiles.md section 6): the Windows
// virtual-key code (VKeyCode = NativeCode), the Qt key code the app shows the key name
// with, and a KeyModifiers bitmask that keeps left and right modifiers apart, as Star
// Citizen does.
"use strict";

// Modifier bits: generic Shift 0x1, Ctrl 0x2, Alt 0x4, Win 0x8; left 0x10/0x20/0x40/0x80,
// right 0x100/0x200/0x400/0x800, plus 0x10000 whenever a side is named; numpad keys 0x4000.
const MODS = {
  lshift: 0x10 | 0x1, rshift: 0x100 | 0x1,
  lctrl: 0x20 | 0x2, rctrl: 0x200 | 0x2,
  lalt: 0x40 | 0x4, ralt: 0x400 | 0x4,
};
const SIDED = 0x10000, KEYPAD = 0x4000;
const QT = 0x01000000; // Qt's special keys (Escape, Tab, F1...) start here

// name -> [VK, Qt key code, numpad]
const KEYS = {
  space: [32, 32], tab: [9, QT + 0x01], enter: [13, QT + 0x04], escape: [27, QT + 0x00],
  backspace: [8, QT + 0x03], insert: [45, QT + 0x06], delete: [46, QT + 0x07],
  home: [36, QT + 0x10], end: [35, QT + 0x11], pgup: [33, QT + 0x16], pgdn: [34, QT + 0x17],
  left: [37, QT + 0x12], up: [38, QT + 0x13], right: [39, QT + 0x14], down: [40, QT + 0x15],
  print: [44, QT + 0x09], capslock: [20, QT + 0x24], numlock: [144, QT + 0x25], scrolllock: [145, QT + 0x26],
  // US layout punctuation (OEM keys); a different layout only changes the name the app shows.
  semicolon: [186, 59], equals: [187, 61], comma: [188, 44], minus: [189, 45], period: [190, 46],
  slash: [191, 47], grave: [192, 96], lbracket: [219, 91], backslash: [220, 92], rbracket: [221, 93],
  apostrophe: [222, 39],
  np_multiply: [106, 42, true], np_add: [107, 43, true], np_subtract: [109, 45, true],
  np_period: [110, 46, true], np_divide: [111, 47, true], np_enter: [13, QT + 0x05, true],
  // A modifier on its own (as the main key).
  lshift: [160, QT + 0x20], rshift: [161, QT + 0x20], lctrl: [162, QT + 0x21], rctrl: [163, QT + 0x21],
  lalt: [164, QT + 0x23], ralt: [165, QT + 0x23],
};
for (let c = 0; c < 26; c++) KEYS[String.fromCharCode(97 + c)] = [65 + c, 65 + c];
for (let d = 0; d <= 9; d++) {
  KEYS[String(d)] = [48 + d, 48 + d];
  KEYS[`np_${d}`] = [96 + d, 48 + d, true];
  KEYS[`num${d}`] = KEYS[`np_${d}`];
}
for (let f = 1; f <= 24; f++) KEYS[`f${f}`] = [111 + f, QT + 0x30 + f - 1];

// The empty slot every real Windows export pads Hotkeys with.
const EMPTY = { KeyCmd: false, KeyCtrl: false, KeyModifiers: 0, KeyOption: false, KeyShift: false, NativeCode: 146, QTKeyCode: 33554431, VKeyCode: -1 };

// "lalt+n" -> one Hotkeys entry. Modifiers may come in any order; the last other key is the
// key that's pressed.
function hotkey(combo) {
  const parts = String(combo).toLowerCase().split("+").map((k) => k.trim()).filter(Boolean);
  if (!parts.length) throw new Error(`Empty key combo "${combo}"`);
  let mods = 0, main = null;
  parts.forEach((k, i) => {
    if (MODS[k] && i < parts.length - 1) mods |= MODS[k] | SIDED;
    else if (main) throw new Error(`"${combo}" presses two keys (${main} and ${k})`);
    else main = k;
  });
  const key = KEYS[main];
  if (!key) throw new Error(`Unknown key "${main}" in "${combo}"`);
  const [vk, qt, numpad] = key;
  if (numpad) mods |= KEYPAD;
  return {
    KeyCmd: (mods & 0x8) !== 0, KeyCtrl: (mods & 0x2) !== 0, KeyModifiers: mods, KeyOption: (mods & 0x4) !== 0,
    KeyShift: (mods & 0x1) !== 0, NativeCode: vk, QTKeyCode: qt, VKeyCode: vk,
  };
}

// Settings for Hotkey (one combo, slot 0) or Hotkey Switch (the same combo in slots 0 and 1:
// each tap sends it once and flips the key's picture).
function hotkeySettings(combo, { slots = 1 } = {}) {
  const k = combo ? hotkey(combo) : EMPTY;
  const list = Array.from({ length: 4 }, (_, i) => (i < slots ? { ...k } : { ...EMPTY }));
  return { Coalesce: true, Hotkeys: list };
}

module.exports = { hotkey, hotkeySettings, EMPTY, KEYS };
