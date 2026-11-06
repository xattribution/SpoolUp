// Builds the "Tablet Deck Keyboard" Star Citizen control profile from the layouts, so
// every button with an scAction has a keyboard bind without any third-party profile.
//
//   node tools/make-profile.js           write keybinds/TabletDeck-StarCitizen.xml
//   node tools/make-profile.js --check   exit 1 if that file is missing or out of date
//
// Each button's `keys` becomes the bind for its `scAction`, unless DEFAULTS says that's
// already the game's own key. Star Citizen looks actions up per actionmap, so every
// action must be listed in ACTIONMAPS below; an unknown action stops the build instead
// of being guessed into the wrong map.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "keybinds", "TabletDeck-StarCitizen.xml");
const PROFILE_NAME = "Tablet Deck Keyboard";

// Star Citizen actionmap(s) for each action the layouts use. Some actions exist in more
// than one map (doors work in ships and ground vehicles) and are bound in each.
const ACTIONMAPS = {
  // On foot
  drop: ["player"],
  inspect: ["player"],
  pc_pit_inventory: ["player_choice"],
  thirdperson: ["player"],
  walk: ["player"],
  ...Object.fromEntries([
    "agree", "angry", "atease", "attention", "blah", "bored", "bow", "burp", "cheer", "chicken",
    "clap", "come", "cry", "dance", "disagree", "failure", "flex", "flirt", "gasp", "gloat",
    "greet", "laugh", "launch", "point", "rude", "salute", "sit", "sleep", "smell", "taunt",
    "threaten", "wait", "wave", "whistle",
  ].map((e) => [`emote_${e}`, ["player_emotes"]])),

  // UI and social (global: in a seat and on foot)
  pl_exit: ["default"],
  toggle_chat: ["default"],
  toggle_contact: ["default"],

  // mobiGlas and star map (ships, vehicles and on foot)
  mobiglas: ["spaceship_hud", "player", "vehicle_general"],
  v_starmap: ["spaceship_hud", "player", "vehicle_general"],

  // Seat (operator modes, remote turrets, eject, look behind)
  v_eject: ["seat_general"],
  v_enter_remote_turret_1: ["seat_general"],
  v_enter_remote_turret_2: ["seat_general"],
  v_enter_remote_turret_3: ["seat_general"],
  v_set_flight_mode: ["seat_general"],
  v_set_guns_mode: ["seat_general"],
  v_set_mining_mode: ["seat_general"],
  v_set_missile_mode: ["seat_general"],
  v_set_quantum_mode: ["seat_general"],
  v_set_salvage_mode: ["seat_general"],
  v_set_scan_mode: ["seat_general"],
  v_view_look_behind: ["seat_general"],

  // Ship systems, power, doors and lights
  v_close_all_doors: ["spaceship_general", "vehicle_general"],
  v_engineering_assignment_engine_decrease: ["spaceship_power"],
  v_engineering_assignment_engine_increase: ["spaceship_power"],
  v_engineering_assignment_engine_max: ["spaceship_power"],
  v_engineering_assignment_engine_min: ["spaceship_power"],
  v_engineering_assignment_reset: ["spaceship_power"],
  v_engineering_assignment_shields_decrease: ["spaceship_power"],
  v_engineering_assignment_shields_increase: ["spaceship_power"],
  v_engineering_assignment_shields_max: ["spaceship_power"],
  v_engineering_assignment_shields_min: ["spaceship_power"],
  v_engineering_assignment_weapons_decrease: ["spaceship_power"],
  v_engineering_assignment_weapons_increase: ["spaceship_power"],
  v_engineering_assignment_weapons_max: ["spaceship_power"],
  v_engineering_assignment_weapons_min: ["spaceship_power"],
  v_flightready: ["spaceship_general", "vehicle_general"],
  v_lights: ["lights_controller"],
  v_lock_all_doors: ["spaceship_general", "vehicle_general"],
  v_open_all_doors: ["spaceship_general", "vehicle_general"],
  v_power_toggle: ["spaceship_power"],
  v_power_toggle_shields: ["spaceship_power"],
  v_power_toggle_thrusters: ["spaceship_power"],
  v_power_toggle_weapons: ["spaceship_power"],
  v_self_destruct: ["spaceship_general"],
  v_toggle_all_doors: ["spaceship_general", "vehicle_general"],
  v_unlock_all_doors: ["spaceship_general", "vehicle_general"],

  // Flight
  v_atc_request: ["spaceship_movement"],
  v_autoland: ["spaceship_movement"],
  v_ifcs_speed_limiter_decrement: ["spaceship_movement"],
  v_ifcs_speed_limiter_increment: ["spaceship_movement"],
  v_ifcs_speed_limiter_toggle: ["spaceship_movement"],
  v_ifcs_toggle_esp: ["spaceship_movement"],
  v_ifcs_toggle_gforce_safety: ["spaceship_movement"],
  v_master_mode_cycle_long: ["spaceship_movement"],
  v_master_mode_set_nav: ["spaceship_movement"],
  v_master_mode_set_scm: ["spaceship_movement"],
  v_toggle_landing_system: ["spaceship_movement"],
  v_vtol_toggle: ["spaceship_movement"],
  v_ifcs_throttle_swap_mode: ["spaceship_movement"],
  v_ifcs_vector_decoupling_toggle: ["spaceship_movement"],

  // Comms (Star Citizen 4.10's own binds; the Comms panel)
  foip_cyclechannel: ["player_input_optical_tracking"],
  foip_pushtotalk: ["player_input_optical_tracking"],
  foip_pushtotalk_proximity: ["player_input_optical_tracking"],
  pc_personal_thought: ["player_choice"],
  ui_notification_accept: ["ui_notification"],
  ui_notification_decline: ["ui_notification"],
  v_target_hail: ["spaceship_target_hailing"],
  visor_wipe: ["player", "spaceship_hud", "vehicle_general"],

  // Quantum and docking
  v_dock_toggle_view: ["spaceship_docking"],
  v_toggle_docking_request: ["spaceship_docking"],
  v_toggle_qdrive_engagement: ["spaceship_quantum"],

  // Shields and countermeasures
  v_shield_raise_level_back: ["spaceship_defensive"],
  v_shield_raise_level_down: ["spaceship_defensive"],
  v_shield_raise_level_forward: ["spaceship_defensive"],
  v_shield_raise_level_left: ["spaceship_defensive"],
  v_shield_raise_level_right: ["spaceship_defensive"],
  v_shield_raise_level_up: ["spaceship_defensive"],
  v_shield_reset_level: ["spaceship_defensive"],
  v_weapon_countermeasure_decoy_launch: ["spaceship_defensive"],
  v_weapon_countermeasure_decoy_launch_panic: ["spaceship_defensive"],
  v_weapon_countermeasure_noise_launch: ["spaceship_defensive"],

  // Weapons and missiles
  v_weapon_decrease_max_missiles: ["spaceship_missiles"],
  v_weapon_launch_missile: ["spaceship_missiles"],
  v_weapon_pip_toggle_lead_lag: ["spaceship_weapons"],

  // Targeting
  v_target_cycle_all_back: ["spaceship_targeting_advanced"],
  v_target_cycle_attacker_back: ["spaceship_targeting_advanced"],
  v_target_cycle_friendly_back: ["spaceship_targeting_advanced"],
  v_target_cycle_hostile_back: ["spaceship_targeting_advanced"],
  v_target_cycle_hostile_fwd: ["spaceship_targeting_advanced"],
  v_target_cycle_in_view_back: ["spaceship_targeting_advanced"],
  v_target_cycle_subitem_back: ["spaceship_targeting_advanced"],

  // Salvage
  v_salvage_cycle_modifiers_left: ["spaceship_salvage"],
  v_salvage_cycle_modifiers_right: ["spaceship_salvage"],
  v_salvage_decrease_beam_spacing: ["spaceship_salvage"],
  v_salvage_increase_beam_spacing: ["spaceship_salvage"],

  // Mining
  v_decrease_mining_throttle: ["spaceship_mining"],
  v_increase_mining_throttle: ["spaceship_mining"],
  v_mining_use_consumable1: ["spaceship_mining"],
  v_mining_use_consumable2: ["spaceship_mining"],
  v_mining_use_consumable3: ["spaceship_mining"],
  v_toggle_mining_laser_fire: ["spaceship_mining"],
  v_toggle_mining_laser_type: ["spaceship_mining"],
};

// Buttons that send Star Citizen 4.10's own default keys (Data/Libs/Config/defaultProfile.xml).
// The profile writes nothing for these. The game pairs some of them on one key by press length
// (F5 tap = +1, held = max; N tap = gear, held = autoland), so they aren't clashes with each other.
const DEFAULTS = {
  mobiglas: "f1",
  pc_pit_inventory: "i",
  pl_exit: "y",
  thirdperson: "f4",
  toggle_chat: "f12",
  toggle_contact: "f11",
  v_atc_request: "lalt+n",
  v_autoland: "n",
  v_dock_toggle_view: "0",
  v_eject: "ralt+y",
  v_engineering_assignment_engine_decrease: "lalt+f6",
  v_engineering_assignment_engine_increase: "f6",
  v_engineering_assignment_engine_max: "f6",
  v_engineering_assignment_engine_min: "lalt+f6",
  v_engineering_assignment_reset: "f8",
  v_engineering_assignment_shields_decrease: "lalt+f7",
  v_engineering_assignment_shields_increase: "f7",
  v_engineering_assignment_shields_max: "f7",
  v_engineering_assignment_shields_min: "lalt+f7",
  v_engineering_assignment_weapons_decrease: "lalt+f5",
  v_engineering_assignment_weapons_increase: "f5",
  v_engineering_assignment_weapons_max: "f5",
  v_engineering_assignment_weapons_min: "lalt+f5",
  v_flightready: "ralt+r",
  v_lights: "l",
  v_master_mode_cycle_long: "b",
  v_mining_use_consumable1: "lalt+1",
  v_mining_use_consumable2: "lalt+2",
  v_mining_use_consumable3: "lalt+3",
  v_power_toggle: "u",
  v_power_toggle_shields: "o",
  v_power_toggle_thrusters: "i",
  v_power_toggle_weapons: "p",
  v_self_destruct: "backspace",
  v_starmap: "f2",
  v_toggle_docking_request: "ralt+n",
  v_toggle_landing_system: "n",
  v_view_look_behind: "comma",
  v_vtol_toggle: "k",
  v_weapon_countermeasure_decoy_launch: "h",
  v_weapon_countermeasure_noise_launch: "j",
  // Comms, decoupled, throttle mode and next hostile: all on their 4.10 defaults.
  foip_cyclechannel: "np_period",
  foip_pushtotalk: "np_add",
  foip_pushtotalk_proximity: "lalt+np_add",
  pc_personal_thought: "lalt+f",
  ui_notification_accept: "lbracket",
  ui_notification_decline: "rbracket",
  v_ifcs_throttle_swap_mode: "lalt+c",
  v_ifcs_vector_decoupling_toggle: "c",
  v_target_cycle_hostile_fwd: "5",
  v_target_hail: "9",
  visor_wipe: "lalt+x",
};

// Maps that are active together. A key combo bound to two actions in the same context
// would fire both in-game, so that fails the build; across contexts it is only reported.
const CONTEXTS = {
  player: "on foot",
  player_choice: "on foot",
  player_emotes: "on foot",
  seat_general: "vehicle",
  lights_controller: "vehicle",
  spaceship_defensive: "vehicle",
  spaceship_docking: "vehicle",
  spaceship_general: "vehicle",
  spaceship_hud: "vehicle",
  spaceship_mining: "vehicle",
  spaceship_missiles: "vehicle",
  spaceship_movement: "vehicle",
  spaceship_power: "vehicle",
  spaceship_quantum: "vehicle",
  spaceship_salvage: "vehicle",
  spaceship_targeting_advanced: "vehicle",
  spaceship_weapons: "vehicle",
  vehicle_general: "vehicle",
  spaceship_target_hailing: "vehicle",
  // UI, social and voice maps work in a seat and on foot alike.
  default: "global",
  player_input_optical_tracking: "global",
  ui_notification: "global",
};

// Star Citizen keyboard key names (the same names server.js sends).
const KEY_NAMES = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789",
  ...Array.from({ length: 24 }, (_, i) => `f${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `np_${i}`),
  "np_period", "np_add", "np_subtract", "np_multiply", "np_divide", "np_enter",
  "lalt", "ralt", "lctrl", "rctrl", "lshift", "rshift",
  "space", "tab", "enter", "escape", "backspace", "insert", "delete", "home", "end", "pgup", "pgdn",
  "up", "down", "left", "right", "minus", "equals", "lbracket", "rbracket", "semicolon", "apostrophe",
  "grave", "backslash", "comma", "period", "slash", "capslock", "numlock", "scrolllock", "print",
]);

// Modifier order doesn't matter to the game: lalt+n == n+lalt.
const comboKey = (keys) => keys.split("+").sort().join("+");
const atDefault = (action, keys) => Boolean(DEFAULTS[action]) && comboKey(DEFAULTS[action]) === comboKey(keys);

function fail(lines) {
  console.error([].concat(lines).join("\n"));
  process.exit(1);
}

// Returns { action: { keys, from: ["layout:button", ...] } } for every button with an scAction.
function collectBinds() {
  const binds = {};
  const errors = [];
  const dir = path.join(ROOT, "layouts");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const layout = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    (function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== "object") return;
      if (typeof node.id === "string" && typeof node.keys === "string" && node.scAction) {
        const where = `${file}:${node.id}`;
        const keys = node.keys.trim().toLowerCase();
        const bad = keys.split("+").filter((k) => !KEY_NAMES.has(k));
        if (!keys || bad.length) errors.push(`${where}: unknown key "${bad.join("+") || keys}" in "${node.keys}"`);
        const bind = binds[node.scAction];
        if (!bind) binds[node.scAction] = { keys, from: [where] };
        else if (bind.keys !== keys) errors.push(`${where}: ${node.scAction} is "${keys}" here but "${bind.keys}" in ${bind.from[0]}`);
        else bind.from.push(where);
      }
      for (const v of Object.values(node)) if (v && typeof v === "object") walk(v);
    })(layout);
  }
  const unknown = Object.keys(binds).filter((a) => !ACTIONMAPS[a]);
  for (const a of unknown) {
    errors.push(`${binds[a].from[0]}: no actionmap known for "${a}". Add it to ACTIONMAPS in tools/make-profile.js ` +
      `(find the map in StarCitizen\\LIVE\\user\\client\\0\\Profiles\\default\\actionmaps.xml after rebinding it in-game).`);
  }
  if (errors.length) fail(["Can't build the keybind profile:", ...errors.map((e) => `  ${e}`)]);
  return binds;
}

// Reports combos shared by different actions; returns the ones that clash in one context.
function findConflicts(binds) {
  const byCombo = {};
  for (const [action, { keys }] of Object.entries(binds)) {
    const combo = comboKey(keys);
    (byCombo[combo] = byCombo[combo] || []).push(action);
  }
  const clashes = [];
  for (const [combo, actions] of Object.entries(byCombo)) {
    if (actions.length < 2) continue;
    if (actions.every((a) => atDefault(a, binds[a].keys))) continue; // the game's own pairing
    const contexts = actions.map((a) => new Set(ACTIONMAPS[a].map((m) => CONTEXTS[m] || m)));
    const meet = (c, d) => c.has("global") || d.has("global") || [...c].some((x) => d.has(x));
    const shared = contexts.some((c, i) => contexts.slice(i + 1).some((d) => meet(c, d)));
    const keys = binds[actions[0]].keys;
    if (shared) clashes.push(`  ${keys}: ${actions.join(", ")}`);
    else console.warn(`Note: ${keys} is used by ${actions.join(", ")} (different contexts, so no clash).`);
  }
  return clashes;
}

function buildXml(binds) {
  const maps = {};
  for (const [action, { keys }] of Object.entries(binds)) {
    if (atDefault(action, keys)) continue; // already the game's default
    for (const map of ACTIONMAPS[action]) (maps[map] = maps[map] || []).push([action, keys]);
  }
  const lines = [
    `<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="${PROFILE_NAME}">`,
    ` <CustomisationUIHeader label="${PROFILE_NAME}" description="" image="">`,
    "  <devices>",
    '   <keyboard instance="1"/>',
    "  </devices>",
    "  <categories />",
    " </CustomisationUIHeader>",
    " <modifiers />",
  ];
  for (const map of Object.keys(maps).sort()) {
    lines.push(` <actionmap name="${map}">`);
    for (const [action, keys] of maps[map].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`  <action name="${action}">`, `   <rebind input="kb1_${keys}"/>`, "  </action>");
    }
    lines.push(" </actionmap>");
  }
  lines.push("</ActionMaps>");
  return lines.join("\r\n") + "\r\n";
}

const binds = collectBinds();
const clashes = findConflicts(binds);
if (clashes.length) fail(["Key conflicts (these would fire together in-game):", ...clashes]);
const xml = buildXml(binds);
const rel = path.relative(ROOT, OUT).replace(/\\/g, "/");
const count = Object.entries(binds).filter(([a, b]) => !atDefault(a, b.keys)).length;

if (process.argv.includes("--check")) {
  // Ignore line endings: git or a ZIP download may have turned CRLF into LF.
  const lf = (s) => s.replace(/\r\n/g, "\n");
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  if (current === null || lf(current) !== lf(xml)) fail(`${rel} is out of date; run: node tools/make-profile.js`);
  console.log(`${rel} is up to date (${count} actions).`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, xml);
  console.log(`Wrote ${rel}: "${PROFILE_NAME}", ${count} actions.`);
}
