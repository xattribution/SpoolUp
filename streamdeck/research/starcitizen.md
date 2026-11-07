# Star Citizen 4.x keyboard binds for the Stream Deck mega pack

Topic: action names, actionmaps and **default keyboard keys** for comms, camera, and the
other ship / on-foot actions worth a Stream Deck key, as of Star Citizen **4.10** (Nov 2026).

Companion file (machine-readable, generated from the game file, not typed by hand):
`<scratch>/streamdeck-research/starcitizen-actions.json`
(190 curated actions with `group`, `action`, `maps`, `label`, `defaultKeyboard`,
`activationMode`, `timing`, plus `defaultCombosInUse` per context, for clash checks).
Full dump of all 1103 actions: `.../streamdeck-research/dl-sc/all_4.10.tsv`
(map, action, keyboard default, activation mode, English label).

## 0. TL;DR for the generator

- **Ground truth = the game's own `Data/Libs/Config/defaultProfile.xml`** from 4.10.0
  (build `4.10.193.11644`, 15 Sep 2026). A second, independent extraction of **4.10.2 LIVE**
  (10 Oct 2026) has **identical keyboard defaults** (only `empty` vs `-` placeholder differences).
  No dump newer than 4.10.2 was found. Confidence: **High**.
- **VoIP/FOIP** binds live in actionmap `player_input_optical_tracking` (UI group
  "VOIP, FOIP and Head Tracking"). PTT = **Numpad +** (hold), proximity PTT = **LAlt+Numpad +**
  (hold), cycle audio channel = **Numpad .**, FOIP recalibrate = **Numpad \***, selfie cam =
  **hold Numpad −**, head tracking toggle = **Numpad /**, recenter = **Numpad 5**.
- **There is no keybind for "VoIP on/off", "mute mic" or "voice-activated mode".** Those are
  Options-menu settings only (`Disable VOIP`, `Mute Microphone`, `Enable Level-Activated Voice
  Transmission`). A Stream Deck "mute" key for game voice is not possible with game binds; use
  Discord/OS mute (see `plugins.md`).
- Comms UI: **F11 = CommLink app** (was labeled "Contacts"), **F12 = chat**, **Enter** = focus
  chat, **Tab** = cycle chat lobby (while chat is open), **[ / ]** = accept / reject invite,
  **hold ]** = ignore invite, **9** = hail target, **LAlt+F** = PIT wheel.
- **Screenshots are not an actionmap action.** No `print`/screenshot action exists in
  `defaultProfile.xml`; the engine cvar `r_GetScreenShot` exists. Print Screen as the in-game
  screenshot key is community knowledge only (Medium-Low).
- Many 3.x binds the existing deck still sends are **wrong in 4.x** (Decoy is **H** not G,
  Noise is **J** not H, Flight Ready is **RAlt+R** not R, quantum is **hold LMB** in NAV mode,
  not B). Five `scAction` names in `tools/make-profile.js` **no longer exist**, and several of the
  profile's chosen combos **collide with 4.10 defaults** (e.g. RAlt+R = Flight Ready). See §8.
- Stream Deck relevance of activation modes: `tap` actions fire only if released within
  **0.25 s**; `delayed_press` needs a hold of **≥ 0.25 s**, `delayed_press_medium` **≥ 0.5 s**.
  Several keys carry a tap action and a different hold action on the same key (N, B, 0, F5–F7,
  `]`, R, Backspace). See §2.

## 1. Sources and method

| # | Source | What it is | Version evidence | Confidence |
|---|---|---|---|---|
| S1 | [x3nnnonn/StarCitizenDiff `P4kContents/Data/Libs/Config/defaultProfile.xml` @908b76a](https://github.com/x3nnnonn/StarCitizenDiff/blob/908b76a0485036161ba700d369c7d92aca1c847b/P4kContents/Data/Libs/Config/defaultProfile.xml) | Raw file extracted from `Data.p4k` by a patch-diff tracker | Same commit's [`build_manifest.json`](https://github.com/x3nnnonn/StarCitizenDiff/blob/908b76a0485036161ba700d369c7d92aca1c847b/build_manifest.json): `"Branch": "sc-alpha-4.10.0"`, `"Version": "4.10.193.11644"`, `"BuildDateStamp": "Tue Sep 15 2026"`, `"Tag": "public"` | High |
| S2 | [hamlet2k/sc-mapper `data/game/defaultProfile.xml` @01b0cff](https://github.com/hamlet2k/sc-mapper/blob/01b0cff125178018ced91db3e18f391ed1b07f1d/data/game/defaultProfile.xml) | Independent extraction | Commit 79d9f2c, 2026-10-10: "Default bindings: Star Citizen 4.10.2 LIVE from committed data/game" | High (keyboard defaults identical to S1) |
| S3 | S1 history: 4.3.2-ptu (fef3dd0, 2025-10-08), 4.5.0-ptu (7cc6eb7), 4.6.0 RC1 (6ad8db4), 4.7.1 (6305d32), 4.8.0-ptu (b27f529), last change a5c4bd5 (2026-06-16, carried unchanged into 4.9/4.10) | Same tracker, older commits | commit messages | High |
| S4 | [itrew/sc-keybinding-tools `defaultProfile.xml` @599134c](https://github.com/itrew/sc-keybinding-tools/blob/599134c9dbb7749e256ba22452e4c7d5f9d9fb5a/data/game-files/defaultProfile.xml) | 3.x baseline for "what changed in 4.x" | Commit de41c94, 2024-04-20 "update data for 3.22.1-LIVE.9097523" | High for content, Medium for the exact version label |
| S5 | `Localization/global.ini` from S1 (4.10.0) | English labels for `@ui_…` keys, tutorial/hint strings that name actions | same build as S1 | High |
| S6 | `CVar/cvar_dump.json` from S1 | Console variables (screenshot cvar) | same build | High |
| S7 | [heresandyboy/starcitizen-controller-viewer sc-4.5 / sc-4.7](https://github.com/heresandyboy/starcitizen-controller-viewer/tree/212414d89737880cd32836379e8d276a215f2439/apps/viewer/public/configs) | Cross-check copies | folder names | Medium (used only as a cross-check) |
| W1 | [starcitizen.tools/Keybinds](https://starcitizen.tools/Keybinds) (last modified 13 Jul 2026) | Community wiki | none stated | **Low: out of date.** Still lists Flight Ready = R, quantum = B, decoupled = LAlt+C, cruise = C, ping = hold V, all contradicted by S1/S2. Don't use. |
| W2 | [magicgameworld controls guide](https://www.magicgameworld.com/?p=125549) | Community list | none stated | Low; agrees on Numpad + / LAlt+Numpad + for PTT |
| W3 | [Spectrum: "[3.23] Keybind change summary"](https://robertsspaceindustries.com/spectrum/community/SC/forum/4/thread/3-23-ptu-keybind-change-summary) | Player summary of the 3.23 rebinds | page is JS-rendered; could not read the body | n/a |

How the tables were made (reproducible): `sc-scripts/dump_dp.py` parses `defaultProfile.xml`,
resolves `UILabel` through `global.ini`, and writes `actions_<ver>.json`; `sc-scripts/diffkb.py`
diffs versions; `sc-scripts/curate.py` builds `starcitizen-actions.json`. Scripts are in
`<scratch>/sc-scripts/`.
Downloaded game files are in `.../streamdeck-research/dl-sc/`.

Notation: keys are Star Citizen input names (`lalt`, `ralt`, `np_add`, `np_period`, `lbracket`,
`comma`, `f11`…). In a user `actionmaps.xml` they are written `kb1_<keys>` with `+` between keys
(Tablet Deck's `tools/make-profile.js` already does this). The game file writes modifiers in either
order (`f6+lalt`, `u+lshift`); order doesn't matter. `-` = no default keyboard bind. The game file
uses both `activationMode` and `ActivationMode` (salvage actions) and sometimes raw
`onPress/onHold/onRelease` attributes instead of a named mode.

## 2. Activation modes (why some keys need a hold on the Stream Deck)

From the `<ActivationModes>` block of S1 (exact thresholds):

| mode | fires | Stream Deck meaning |
|---|---|---|
| `press` | on key down | any tap works |
| `tap` | on release, **only if released within 0.25 s** (`releaseTriggerThreshold="0.25"`) | a quick tap works; a slow press (> 0.25 s) does nothing |
| `delayed_press` | after **0.25 s** held | must hold ≥ 0.25 s |
| `delayed_press_medium` | after **0.5 s** held | must hold ≥ 0.5 s |
| `delayed_press_long` | after **1.5 s** held | must hold ≥ 1.5 s |
| `hold` | down → active, up → inactive | active while the key is held |
| `delayed_hold` | active after 0.25 s, until release | hold |
| `delayed_hold_no_retrigger` | active after 0.15 s, until release | hold |
| `smart_toggle` | tap toggles; held > 0.25 s acts as momentary | both |
| `all` | press, hold and release | — |

Keys that carry **two different actions by press length** (4.10 defaults):

| key | quick tap | hold |
|---|---|---|
| `n` | `v_toggle_landing_system` (gear) | ≥ 0.25 s `v_autoland` |
| `b` | nothing in a ship | ≥ 0.25 s `v_master_mode_cycle_long` (SCM ↔ NAV) |
| `0` | `v_target_remove_all_pins` | ≥ 0.25 s `v_dock_toggle_view` (docking camera) |
| `f5`/`f6`/`f7` | +1 power to weapons/engines/shields | ≥ 0.25 s (`holdTriggerDelay="0.25"`) set to max |
| `lalt+f5/f6/f7` | −1 | hold: set to min |
| `rbracket` | `ui_notification_decline` | `ui_notification_ignore` (`delayed_hold`) |
| `r` | (vehicle) next sub-target; (on foot) reload | (on foot) ≥ 0.5 s holster |
| `backspace` | `cam_toggle_cinematic` | ≥ 0.5 s `v_self_destruct` (ship) / `force_respawn` (on foot) |
| `i` (on foot) | inventory | ≥ 0.25 s loot screen |
| `t` | next target in view | ≥ 0.25 s auto-targeting on/off |

The sibling note `profiles.md` §6 records that the built-in Hotkey action holds the key while the
Stream Deck key is held, so hold actions work if the player holds the Stream Deck key.

## 3. Comms page

All from S1/S2 (4.10.0 = 4.10.2). "Map" is the actionmap name to use in `actionmaps.xml`.

| What | action | map (UI group) | default key | mode | Notes / confidence |
|---|---|---|---|---|---|
| VoIP push to talk (all channels) | `foip_pushtotalk` | `player_input_optical_tracking` ("VOIP, FOIP and Head Tracking") | `np_add` | hold | Label "VOIP Push To Talk". High |
| VoIP push to talk, proximity only | `foip_pushtotalk_proximity` | same | `lalt+np_add` | hold | High |
| Cycle voice channel | `foip_cyclechannel` | same | `np_period` | press | Label "Cycle through audio channels". The only channel-select bind; there are no per-channel binds. High |
| FOIP recalibrate | `foip_recalibrate` | same | `np_multiply` | press | High |
| FOIP selfie cam | `foip_viewownplayer` | same | `np_subtract` | delayed_hold (≥ 0.25 s) | High |
| Head tracking on/off | `headtrack_enabled` | same | `np_divide` | press | Shares `np_divide` with `hmd_toggle` (VR, experimental). High |
| Head tracking (hold) | `headtrack_hold` | same | — | hold | High |
| Recenter head tracking | `headtrack_recenter_device` | same | `np_5` | press | "except TrackIR". Default since 4.5. Shares `np_5` with `hmd_recenter`. High |
| Head tracking for 3rd-person cam | `headtrack_camera_enabled` | same | — | press | High |
| VR toggle / recenter / theater | `hmd_toggle` / `hmd_recenter` / `hmd_theater_mode_toggle` | same | `np_divide` / `np_5` / `lalt+np_5` | press | "[Experimental]"; added 4.5. High |
| CommLink app (friends, party, calls) | `toggle_contact` | `default` ("Social - General") | `f11` | press | 4.10 label "CommLink App (Toggle)". High |
| Chat window | `toggle_chat` | `default` | `f12` | press | High |
| Focus chat input | `focus_on_chat_textinput` | `default` | `enter` (also `np_enter`) | press | High |
| Cycle chat lobby | `cycle_chat_lobby` | `default` | `tab` | press | Only while chat is focused (Tab is ping in a ship). High |
| Accept invite (party/group/launch) | `ui_notification_accept` | `ui_notification` ("Social - Invites") | `lbracket` | — | Game strings: "Press ~action(ui_notification\|ui_notification_accept) to join". High |
| Reject invite | `ui_notification_decline` | `ui_notification` | `rbracket` | tap | High |
| Ignore invite | `ui_notification_ignore` | `ui_notification` | `rbracket` | delayed_hold | High |
| Accept / decline prompt | `notification_accept` / `notification_decline` | `default` | `lbracket` / `rbracket` | press | Generic prompts. Strings `ui_controlhint_call_accept` "Accept Call" / `…_decline` exist, but no string ties calls to a specific action: **Medium** that calls use these |
| Hail target (ship) | `v_target_hail` | `spaceship_target_hailing` ("Flight - Target Hailing") | `9` | tap | High |
| MFD → Comms page | `v_mfd_select_view_comms_short` | `vehicle_mfd` | — | tap | Long-press variant `…_long`. High |
| Personal Inner Thought wheel | `pc_personal_thought` | `player_choice` | `lalt+f` | press | High |
| PIT → Emotes category | `pc_pit_emotes` | `player_choice` | — | press | Opens the emote section of the PIT wheel. High |
| Hand signals: Forward / Left / Right / Stop / Yes / No | `emote_cs_forward` / `_left` / `_right` / `_stop` / `_yes` / `_no` | `player_emotes` ("Social - Emotes") | `np_5` / `np_1` / `np_3` / `np_2` / `np_4` / `np_6` | press | On foot only. Good "squad comms" keys. High |
| 34 full emotes (`emote_agree` … `emote_whistle`) | `emote_*` | `player_emotes` | — (none) | press | No defaults in 4.x; Tablet Deck's profile binds them (RCtrl+…). High |
| Wipe visor | `visor_wipe` | `player`, `spaceship_hud`, `vehicle_general` | `lalt+x` | press | High |
| Precanned ship comms | `v_comm_open_precanned`, `v_comm_select_precanned_1..5`, `v_comm_open_chat`, `v_comm_show_chat` | `spaceship_hud` | none (`empty`) | — | No labels in localization; likely unused. Don't ship keys for them. Medium |

Not bindable (checked: no matching action anywhere in 4.10 `defaultProfile.xml`):

- **VoIP on/off, mic mute, open-mic vs PTT, volumes.** Only in Options → "COMMS, FOIP, VR & HEAD
  TRACKING" (`pause_ForegroundOptionMenuButtonCommsSettings`): `pause_OptionsDisableVOIP`
  "Disable VOIP", `pause_OptionsMuteMicrophone` "Mute Microphone",
  `pause_OptionsLevelActivatedVoiceTx` "Enable Level-Activated Voice Transmission",
  `pause_OptionsVOIPVolume`, `pause_OptionsMicrophoneVolume`, plus
  `pause_OptionsCommsCallsNotifications` (calls from anyone / friends only). The CommLink call UI
  has its own mute (`mobiGlas_hint_Microphone_Mute` "Microphone feed muted"), but no keybind.
  Confidence **High** that no keybind exists; Medium on where each toggle sits in the UI.
- **Party invite / create party, Spectrum.** Only through the CommLink app (F11) and chat (F12).
  Spectrum itself is RSI's website; a Stream Deck "Website" key could open it, but that is outside
  the game (and outside Tablet Deck's "no network calls" rule only if the pack itself does it).
- **On-foot ping.** None; `v_invoke_ping` is vehicle-only.

## 4. Camera and screenshots

| What | action | map | default key | mode | Notes |
|---|---|---|---|---|---|
| Cycle camera view (ship) | `v_view_cycle_fwd` | `spaceship_view`, `vehicle_general` | `f4` | tap | High |
| 3rd person (on foot) | `thirdperson` | `player` | `f4` | tap | High |
| Freelook (ship) | `v_view_freelook_mode` | `spaceship_view`, `vehicle_general` | `z` | hold | High |
| Free view camera (on foot) | `free_thirdperson_camera` | `player` | `z` | hold | High |
| Freelook (EVA) | `eva_toggle_headlook_mode` | `zero_gravity_eva` | `z` | hold | High |
| Look behind | `v_view_look_behind` | **`seat_general`** | `comma` | delayed_hold_no_retrigger (≥ 0.15 s) | Default since 4.x; in 3.22 it was unbound. High |
| Cycle orbit mode (3rd person) | `v_view_mode` | `spaceship_view` | — | — | High |
| 3rd-person zoom in / out | `v_view_zoom_in` / `v_view_zoom_out` | `spaceship_view`, `vehicle_general` | — | — | High |
| Dynamic zoom (rel.) in / out, toggle | `v_view_dynamic_zoom_rel_in` / `_out`, `v_view_dynamic_zoom_abs_toggle` | `spaceship_view` | — | all / smart_toggle | High |
| Precision targeting (ADS) toggle | `v_ads_toggle` | `spaceship_view` | `mouse2` | tap | Mouse only by default. High |
| Look ahead on/off | `v_look_ahead_enable` | `spaceship_targeting` | `lalt+l` | smart_toggle | High |
| Target padlock / auto zoom | `v_look_ahead_start_target_tracking` / `v_target_tracking_auto_zoom` | `spaceship_targeting` | — | smart_toggle | High |
| Cinematic camera | `cam_toggle_cinematic` | `default` | `backspace` | **tap** | Same key as self-destruct (hold 0.5 s) and on-foot force respawn (hold 0.5 s). Don't put it on a Stream Deck key as Backspace; a slow press risks self-destruct. High |
| Missile cinematic cam | `v_weapon_launch_missile_cinematic` (toggle) / `…_hold` | `spaceship_missiles` | — | tap | Tablet Deck profile binds the toggle. High |
| Advanced Camera Controls modifier | `view_enable_camview_mode` | `view_director_mode` ("Camera - Advanced Camera Controls") | `f4` (hold) | — | The rest of this map works while F4 is held. Medium on exact modifier behavior |
| Load view 1–9 / save view 1–9 | `view_load_view_N` / `view_save_view_N` | `view_director_mode` | `np_1`…`np_9` (tap) / same (≥ 0.25 s) | tap / delayed_press | High |
| Clear saved view | `view_reset_saved` | `view_director_mode` | `np_0` | delayed_press | High |
| FOV + / − | `view_fov_in` / `view_fov_out` | `view_director_mode` | `np_add` / `np_subtract` | — | High |
| DoF + / − | `view_fstop_in` / `view_fstop_out` | `view_director_mode` | `home` / `end` | — | High |
| Camera offset X/Y/Z | `view_move_target_{X,Y,Z}_{pos,neg}` | `view_director_mode` | arrows, `pgup`/`pgdn` | — | High |
| Reset view | `view_restore_defaults` | `view_director_mode` | `np_multiply` | — | High |
| **Screenshot** | *(none)* | — | — | — | No screenshot action in `defaultProfile.xml` (High). Cvar `r_GetScreenShot` exists: "Capture a single screenshot … 1: Take screenshot immediately" (S6, High). Print Screen saving to `StarCitizen\LIVE\ScreenShots` is from old community posts only (**Medium-Low**; verify on a PC). A Stream Deck key can send `PrintScreen`; Windows' Win+PrtScn / Game Bar (Win+Alt+PrtScn) are OS alternatives. |
| Visor HUD / AR mode | `toggle_ar_mode` | `spaceship_hud`, `player` | none | — | Unlabeled; skip. Medium |

## 5. Ship actions worth a key (beyond the deck's current set)

Defaults are 4.10. "**No default**" means the pack needs the Tablet Deck Keyboard profile (or a user
bind) for a plain Hotkey key to work. Labels are the English UI labels from S5.

### 5.1 Systems, power, quantum, nav

| What | action | map | default | mode |
|---|---|---|---|---|
| Flight / Systems Ready | `v_flightready` | `spaceship_general` **and** `vehicle_general` | **`ralt+r`** | press |
| Toggle Power - All / Thrusters / Shields / Weapons | `v_power_toggle` / `_thrusters` / `_shields` / `_weapons` | `spaceship_power` | `u` / `i` / `o` / `p` | press |
| Set power on/off (all, thrusters, shields, weapons) | `v_power_set_on/off`, `v_power_set_thrusters_on/off`, `…shields_on/off`, `…weapons_on/off` | `spaceship_power` | no default | press |
| Power assignment +1 / max (engines, shields, weapons) | `v_engineering_assignment_{engine,shields,weapons}_increase` / `_max` | `spaceship_power` | `f6`/`f7`/`f5` tap / hold | tap / hold 0.25 s |
| Power assignment −1 / min | `…_decrease` / `_min` | `spaceship_power` | `lalt+f6/f7/f5` tap / hold | tap / hold |
| Reset assignments | `v_engineering_assignment_reset` | `spaceship_power` | `f8` | press |
| Cooler rate + / − | `v_cooler_throttle_up` / `_down` | `spaceship_general` | no default | onPress+onHold |
| Cycle master mode SCM ↔ NAV | `v_master_mode_cycle_long` | `spaceship_movement` | **hold `b`** (≥ 0.25 s) | delayed_press |
| Cycle master mode (short press variant) | `v_master_mode_cycle` | `spaceship_movement` | no default | tap |
| Set NAV / Set SCM | `v_master_mode_set_nav` / `v_master_mode_set_scm` | `spaceship_movement` | no default | press |
| Quantum operator mode toggle / set | `v_toggle_quantum_mode` / `v_set_quantum_mode` | `seat_general` | no default | press |
| **Engage quantum drive** (also exits QT) | `v_toggle_qdrive_engagement` | `spaceship_quantum` | **hold `mouse1`** (≥ 0.25 s), no keyboard default | delayed_press |
| Next / previous operator mode | `v_operator_mode_cycle_forward` / `_back` | `seat_general` | `mouse3` / no default | tap |
| Quantum route (in the star map) | `mapui_action_planroute` / `_clearroute` / `_togglepin` / `_mylocation` | `mapui` (map open) | `r` / `c` / `t` / `2` | — |
| Jump drive request | `v_toggle_jump_request` | `spaceship_movement` | `mouse1` (mouse attr) | tap |
| Spool quantum | *(none)* | — | — | No spool action exists; the 4.10 tutorial says "align to the destination and when spooled, hold [v_toggle_qdrive_engagement] to engage". High |
| Quantum target selection | *(none outside the map)* | — | — | Done in the star map (F2) with `mapui_action_planroute`. High |

Official flow, verbatim from S5 (`Tut03_Part03_Hint01_EnterQT`): "For longer travel, first switch
to NAV mode [~action(spaceship_movement|v_master_mode_cycle_long)]. QTM operation
[~action(seat_general|v_operator_mode_cycle_forward)] is on by default. Next, align to the
destination and when spooled, hold [~action(spaceship_quantum|v_toggle_qdrive_engagement)] to
engage." Exit: "To exit Quantum Travel Mode, press [~action(spaceship_quantum|v_toggle_qdrive_engagement)]."

### 5.2 Flight assists

| What | action | map | default | mode |
|---|---|---|---|---|
| Decoupled mode toggle | `v_ifcs_vector_decoupling_toggle` | `spaceship_movement` | `c` | tap |
| Cruise mode toggle ("Throttle - Cruise Mode - Toggle") | `v_ifcs_throttle_swap_mode` | `spaceship_movement` | `lalt+c` | onPress |
| E.S.P. toggle / hold | `v_ifcs_toggle_esp` / `v_ifcs_esp_hold` | `spaceship_movement` | no default | smart_toggle / hold |
| G-force safety | `v_ifcs_toggle_gforce_safety` | `spaceship_movement` | no default | tap |
| Speed limiter on/off | `v_ifcs_speed_limiter_toggle` | `spaceship_movement` | no default | tap |
| Speed limiter step up / down | `v_ifcs_speed_limiter_increment` / `_decrement` | `spaceship_movement` | `lalt+mwheel_up/down` (mouse) | press |
| Acceleration limiter step up / down | `v_accel_range_increment` / `_decrement` | `spaceship_movement` | `ralt+mwheel_up/down` (mouse) | press |
| Proximity assist / gravity comp. / wind comp. / auto precision / stability / IFCS core | `v_ifcs_proximity_assist_toggle`, `v_ifcs_gravity_compensation_toggle`, `v_ifcs_wind_compensation_toggle`, `v_auto_precision_mode_toggle`, `v_ifcs_stability_toggle`, `v_ifcs_core_toggle` | `spaceship_movement` | no default | tap |
| Advanced HUD toggle | `v_flight_advanced_hud_toggle` | `spaceship_movement` | no default | tap |
| Spacebrake | `v_space_brake` | `spaceship_movement` | `x` | press+release |
| Boost | `v_afterburner` | `spaceship_movement` | `lshift` | all |
| Lock pitch/yaw | `v_lock_rotation` | `spaceship_movement` | `rshift` | smart_toggle |
| Reset flight accelerometer | `v_ifcs_reset_gmeter_max` | `spaceship_movement` | `ralt+c` | tap |

### 5.3 Landing, docking, lights, doors, emergency

| What | action | map | default | mode |
|---|---|---|---|---|
| Landing gear | `v_toggle_landing_system` | `spaceship_movement` | `n` | tap |
| Autoland | `v_autoland` | `spaceship_movement` | hold `n` | delayed_press |
| VTOL | `v_vtol_toggle` | `spaceship_movement` | `k` | tap |
| Cycle configuration (transforming ships) | `v_transform_cycle` | `spaceship_movement` | `lalt+k` | tap |
| Request landing (ATC) | `v_atc_request` | `spaceship_movement` | `lalt+n` | tap |
| Request cargo loading | `v_atc_loading_area_request` | `spaceship_movement` | `ralt+n` | tap |
| **Docking (initiate / cancel / undock)** | `v_toggle_docking_request` | `spaceship_docking` (moved here in 4.9; was `spaceship_movement` in 4.8) | `ralt+n` | tap |
| Docking camera | `v_dock_toggle_view` | `spaceship_docking` | hold `0` (≥ 0.25 s) | delayed_press |
| Headlights | `v_lights` | `lights_controller` | `l` | press |
| Running lights / cabin lights | `v_toggle_running_lights` / `v_toggle_cabin_lights` | `lights_controller` | no default, no label | smart_toggle (Medium: unlabeled, may be unused) |
| Light amplification (night vision) | `v_light_amplification_toggle` | `seat_general` | `ralt+l` | tap (added 4.6) |
| Doors toggle / lock toggle / ports | `v_toggle_all_doors`, `v_toggle_all_doorlocks`, `v_toggle_all_portlocks` | `spaceship_general`, `vehicle_general` | no default / no default / `ralt+K` (written with a capital K in the game file) | press |
| Self destruct | `v_self_destruct` | `spaceship_general` | hold `backspace` ≥ 0.5 s | delayed_press_medium |
| Eject | `v_eject` | `seat_general` | `ralt+y` | press |
| Emergency exit seat | `v_emergency_exit` | `seat_general` | `lshift+u` | tap |
| Exit seat | `pl_exit` | `default` | `y` (tutorial: "hold") | onPress+onHold |
| Jettison cargo (mining) | `v_jettison_volatile_cargo` | `spaceship_mining` | `lalt+j` | press |
| mobiGlas / Map | `mobiglas` / `v_starmap` | `player`, `spaceship_hud`, `vehicle_general` | `f1` / `f2` | press |
| Recall last vehicle | `ship_recall` | `player` | no default | press |
| Refuel operator mode | `v_toggle_refuel_mode` / `v_set_refuel_mode` | `seat_general` | `m` / no default | press (added 4.8) |
| Scanning operator mode | `v_toggle_scan_mode` / `v_set_scan_mode` | `seat_general` | `v` / no default | press |
| Scan (in scan mode) | `v_scanning_trigger_scan` | `spaceship_scanning` | `mouse1` (hold), no keyboard | hold |
| Scan angle + / − | `v_inc_scan_focus_level` / `v_dec_scan_focus_level` | `spaceship_scanning` | `mwheel_up/down` | press |
| **Radar ping** | `v_invoke_ping` | `spaceship_radar` | **`tab`** hold & release | hold |
| MFD pages (self status, target, scanning, config, comms, IFCS, diagnostics, resource network) | `v_mfd_select_view_*_short` / `_long` | `vehicle_mfd` | no default | tap / delayed_press |
| MFD quick action: self repair all | `v_mfd_quick_action_repair_all` | `vehicle_mfd` | no default | tap |
| Stopwatch start/pause, reset | `stopwatch_trigger` / `stopwatch_reset` | `stopwatch` | no default | — |

### 5.4 Combat

| What | action | map | default | mode |
|---|---|---|---|---|
| Gimbal locked / unlocked | `v_weapon_gimbals_state_toggle` | `spaceship_weapons` | `g` | tap |
| Aim mode cycle (PIP / painting / auto) | `v_weapon_aim_type_cycle` | `spaceship_weapons` | `ralt+g` | tap |
| Staggered fire toggle | `v_weapon_staggered_fire_toggle` | `spaceship_weapons` | no default | tap |
| Weapon preset next / prev | `v_weapon_preset_next` / `_prev` | `spaceship_weapons` | `mwheel_down` / `mwheel_up` | press |
| Weapon preset: EMP / QED (jammer, snare) / QIDs | `v_weapon_preset_emp`, `v_weapon_preset_qid_jammer`, `v_weapon_preset_qid_pulse`, `v_weapon_preset_qid` | `spaceship_weapons` | no default | press |
| Missile operator mode | `v_toggle_missile_mode` / `v_set_missile_mode` | `seat_general` | no default (3.22: `mouse3`) | press |
| Launch missiles | `v_weapon_toggle_launch_missile` (tap) / `v_weapon_launch_missile` (hold) | `spaceship_missiles` | `mouse1` / no default | press / delayed_press |
| Armed missiles + / − / reset | `v_weapon_increase_max_missiles` / `_decrease_` / `_reset_` | `spaceship_missiles` | `g` / no default / `lalt+g` | tap |
| Missile type next / prev | `v_weapon_cycle_missile_fwd` / `_back` | `spaceship_missiles` | `mwheel_down` / `mwheel_up` | press |
| Missile lock | *(none)* | — | — | Locking follows the selected target; no separate bind. Medium |
| **Decoy** (tap = burst, hold = set and launch) | `v_weapon_countermeasure_decoy_launch` | `spaceship_defensive` | **`h`** | onPress/onHold/onRelease, `holdTriggerDelay="0.25"` |
| Decoy burst size + / − | `…_decoy_burst_increase` / `_decrease` | `spaceship_defensive` | `ralt+h` / `lalt+h` | press |
| Panic decoys | `v_weapon_countermeasure_decoy_launch_panic` | `spaceship_defensive` | no default | press |
| **Noise** | `v_weapon_countermeasure_noise_launch` | `spaceship_defensive` | **`j`** | press |
| Shield face raise / reset | `v_shield_raise_level_{forward,back,left,right,up,down}`, `v_shield_reset_level` | `spaceship_defensive` | no default (3.22: numpad) | press |
| Auto targeting on/off | `v_auto_targeting_toggle_long` | `spaceship_targeting` | hold `t` | delayed_press |
| Next target in view / under reticle | `v_target_cycle_in_view_fwd` / `_reset` | `spaceship_targeting_advanced` | `t` | tap |
| Next attacker / hostile / friendly / any | `v_target_cycle_{attacker,hostile,friendly,all}_fwd` | `spaceship_targeting_advanced` | `4` / `5` / `6` / `7` | tap |
| Next sub-target / reset sub-target | `v_target_cycle_subitem_fwd` / `_reset` | `spaceship_targeting_advanced` | `r` / `lalt+r` | tap |
| Unlock target | `v_target_unlock` | `spaceship_targeting` | `lalt+t` | tap |
| Pin 1–3: lock pinned / pin selected | `v_target_toggle_lock_index_N` / `v_target_toggle_pin_index_N` | `spaceship_targeting` | `1`–`3` / `lalt+1`–`lalt+3` | tap |
| Remove all pins | `v_target_remove_all_pins` | `spaceship_targeting` | `0` | tap |
| Turret: recenter / ESP / exit remote turret | `turret_recenter` / `turret_esp_toggle` / `turret_remote_exit` | `turret_advanced` / `turret_movement` | `c` hold / no default / `y` | — |

### 5.5 Mining and salvage extras

| What | action | map | default | mode |
|---|---|---|---|---|
| Mining / salvage operator mode | `v_toggle_mining_mode` / `v_toggle_salvage_mode` | `seat_general` | `m` (contextual) | press |
| Mining laser high/low beam | `v_mining_use_permanent_modifier` | `spaceship_mining` | `lalt+4` | press |
| Mining modules 1–3 | `v_mining_use_consumable1..3` | `spaceship_mining` | `lalt+1..3` | press |
| Fire mining laser / switch laser | `v_toggle_mining_laser_fire` / `v_toggle_mining_laser_type` | `spaceship_mining` | `mouse1` / `lalt+mouse1` | smart_toggle / press |
| Salvage fire left / right / fracture / disintegrate | `v_salvage_toggle_fire_left/right/fracture/disintegrate` | `spaceship_salvage` | `ralt+a` / `ralt+d` / `ralt+w` / `ralt+s` | smart_toggle |
| Salvage focus all / left / right / fracture | `v_salvage_focus_all_heads/left/right/fracture` | `spaceship_salvage` | `lalt+s` / `lalt+a` / `lalt+d` / `lalt+w` | press |
| Salvage gimbal toggle / reset | `v_salvage_toggle_gimbal_mode` / `v_salvage_reset_gimbal` | `spaceship_salvage` | `g` / `lalt+g` | press |
| Salvage beam axis toggle | `v_salvage_toggle_beam_spacing_axis` | `spaceship_salvage` | `lalt+mouse2` | — |
| Tractor beam distance + / − (vehicle) | `tractor_beam_vehicle_increase_distance` / `_decrease_` | `spaceship_salvage` | no default | press |

### 5.6 On foot extras

| What | action | map | default | mode |
|---|---|---|---|---|
| Inventory / loot | `pc_pit_inventory` / `pc_pit_looting` | `player_choice` | `i` tap / hold | tap / delayed_press |
| Flashlight | `toggle_flashlight` | `player` | `t` | press |
| Helmet on/off | `toggleEquipHelmet` | `player` | `ralt+h` | tap |
| Fire mode | `weapon_change_firemode` | `player` | `b` | press |
| Weapon stance / holster | `toggle_lowered` / `holster` | `player` | `lalt+r` / hold `r` 0.5 s | tap / delayed_press_medium |
| Consumables / throwables wheel | `pc_qs_consumables` / `pc_qs_grenades` | `player_choice` | `4` / `g` | all |
| Request rescue (downed) | `downedRevivalRequest` | `player` | hold `m` 1.5 s | delayed_hold_long |

## 6. What changed in 4.x (3.22.1 → 4.3.2, then within 4.x)

From diffs of S4 (3.22.1) → S3 (4.3.2), and S3 version to version. I don't have 4.0/4.1/4.2
dumps, so changes listed under "3.22.1 → 4.3.2" happened somewhere in 3.23–4.3.2 (most in
3.23's Master Modes rework, per the title of W3). Confidence: High for the before/after values,
Low for which patch made each change.

3.22.1 → 4.3.2 (keyboard-relevant):

| action | 3.22.1 | 4.3.2+ |
|---|---|---|
| `v_invoke_ping` | hold `v` | hold `tab` |
| `v_toggle_qdrive_engagement` | hold `b` | hold `mouse1` |
| `v_toggle_quantum_mode` | tap `b` | no default |
| `v_master_mode_cycle` | tap `b` | no default; new `v_master_mode_cycle_long` = hold `b` |
| `v_ifcs_toggle_vector_decoupling` (`c`) | existed | **removed** → `v_ifcs_vector_decoupling_toggle` (`c`) |
| `v_ifcs_toggle_cruise_control` (`lalt+c`) | existed | **removed** → `v_ifcs_throttle_swap_mode` (`lalt+c`) |
| `v_toggle_vtol` (`k`) | existed | **removed** → `v_vtol_toggle` (`k`) |
| `v_ifcs_toggle_speed_limiter`, `v_ifcs_speed_limiter_reset_scm`, `v_speed_range_up/down/abs/rel` | existed | **removed** (replacements: `v_ifcs_speed_limiter_toggle`, `…_increment/_decrement`, `…_up/_down`) |
| `v_target_match_vel` | existed | **removed**, no replacement found |
| gimbal modes (`v_weapon_gimbal_mode_*`, `g` = fixed/auto cycle) | existed | **removed** → `v_weapon_gimbals_state_toggle` (`g`), `v_weapon_aim_type_cycle` (`ralt+g`) |
| `v_attack_all/group1/group2`, `v_weapon_change_firemode` (ship) | existed | removed (weapon presets instead) |
| `v_shield_raise_level_*` / `v_shield_reset_level` | `np_8/2/4/6/7/1`, `np_5` | **no default** |
| `v_toggle_missile_mode` | tap `mouse3` | no default |
| `v_view_look_behind` | no default | `comma` (in `seat_general`) |
| `v_self_destruct` | press `backspace` | hold `backspace` 0.5 s |
| `v_hud_open_scoreboard` | `tab` | `f1` |
| `v_atc_loading_area_request` | `lalt+l` | `ralt+n` |
| `v_target_cycle_*_reset` | `lalt+4..8` | `4..7`, sub-target `lalt+r` |
| `v_target_cycle_subitem_fwd` | `8` | `r` |
| `v_weapon_cycle_missile_fwd/back` | `mouse2` / — | `mwheel_down` / `mwheel_up` |
| `v_weapon_bombing_toggle_desired_impact_point` / `…_hold` | — / hold `t` | tap `lalt+b` / — |
| power keys F5–F8 | map `vehicle_capacitor_assignment`: `v_capacitor_assignment_{weapon,engine,shield}_combined_increase_max` (`f5`/`f6`/`f7`), `v_capacitor_assignment_reset` (`f8`) | map `spaceship_power`: `v_engineering_assignment_*` (`f5`–`f7` tap +1 / hold max, `lalt+` −1 / min, `f8` reset); the old map and actions are gone |
| `v_auto_targeting_toggle_long` | — | hold `t` (new) |
| `v_target_unlock_selected` → `v_target_unlock` | `lalt+t` | `lalt+t` |
| `notification_accept/decline`, `cycle_chat_lobby` | — | `[` / `]`, `tab` (new) |

Unchanged since 3.22.1: PTT `np_add`, proximity PTT `lalt+np_add`, `foip_*`, `headtrack_enabled`
`np_divide`, F1/F2/F11/F12, `[`/`]` invites, hail `9`, decoy `h`, noise `j`, Flight Ready `ralt+r`,
power `u/i/o/p`, landing `n`, lights `l`, eject `ralt+y`, F4/Z cameras.

Within 4.x:

| version | change |
|---|---|
| 4.5 | `headtrack_recenter_device` gets `np_5`; VR actions added (`hmd_toggle` `np_divide`, `hmd_recenter` `np_5`, `hmd_theater_mode_toggle` `lalt+np_5`, `hmd_lens_display_toggle`); old `default.hmd_toggle` (`np_1`) / `hmd_center` (`np_2`) removed; wind compensation actions added; `v_ifcs_toggle_gravity_compensation` renamed `v_ifcs_gravity_compensation_toggle` |
| 4.6 | `v_light_amplification_toggle` (`ralt+l`) / `_on` / `_off` added |
| 4.8 | refuel operator mode (`v_toggle_refuel_mode` `m`, `v_set_refuel_mode`); `v_toggle_docking_request` (`ralt+n`) added in `spaceship_movement` |
| 4.9 | `v_toggle_docking_request` moves to `spaceship_docking`; `v_invoke_docking` (`n`) and `v_toggle_docking_mode` (`n`) removed; weapon radial `pc_qs_weapons_pit_secondary/sidearm` → `2`/`3` |
| 4.10.0 → 4.10.2 | no keyboard default changes |

## 7. Default combos already in use (for picking new binds)

`starcitizen-actions.json` → `defaultCombosInUse` lists every keyboard combo bound by default, split
into `vehicle` (seat_general, spaceship_*, vehicle_*, lights, MFD, turret maps), `onFoot`
(player, player_choice, player_emotes, prone, EVA, tractor beam) and `global` (`default`,
`player_input_optical_tracking`, `ui_notification`, active in both). A new bind for an action in one
context should avoid that context's set **and** `global`. Profiles applied from `Controls\Mappings`
add to the defaults; they don't unbind other actions that share the combo (the game's own defaults
contain contextual overlaps such as `lalt+1` = mining module 1 and pin index 1).

## 8. Problems found in Tablet Deck's current layouts and profile (4.10 defaults)

Checked every button in `layouts/*.json` and every entry in `ACTIONMAPS` in
`tools/make-profile.js` against S1. These affect the Stream Deck pack because it reuses the same
action catalog.

**8.1 `scAction` names that no longer exist** (absent from 4.3.2 through 4.10.2; the game ignores
them, so these buttons press nothing useful):

| scAction in make-profile.js | deck key | 4.x replacement |
|---|---|---|
| `v_ifcs_toggle_speed_limiter` | `lalt+minus` | `v_ifcs_speed_limiter_toggle` (spaceship_movement, no default) |
| `v_ifcs_speed_limiter_reset_scm` | `lalt+s` | none found |
| `v_speed_range_up` / `v_speed_range_down` | `lalt+y` / `lctrl+y` | `v_ifcs_speed_limiter_increment` / `_decrement` (step, tap) or `_up`/`_down` (hold) |
| `v_target_match_vel` | `lctrl+v` | none found |

**8.2 Wrong actionmap:** `v_view_look_behind` is in **`seat_general`** in 4.x (default `comma`);
`ACTIONMAPS` puts it in `vehicle_general`, which has no such action in 4.10. High that the map is
wrong; Medium that the game then ignores the rebind.

**8.3 Raw-key buttons that do something else in 4.10:**

| button | sends | 4.10 reality |
|---|---|---|
| Decoy | `g` | `g` = gimbal lock toggle (guns), +1 armed missile (missiles), salvage gimbal. **Decoy is `h`** |
| Noise | `h` | `h` = decoy. **Noise is `j`** |
| Flight Ready / Toggle Flight Ready | `r` | `r` = next sub-target (ship), reload (on foot). **Flight Ready is `ralt+r`** |
| Engage Quantum / Quantum Jump (hold) | `b` | tap `b` does nothing in a ship; hold `b` cycles SCM/NAV. **Quantum engage is hold `mouse1`** (no keyboard default) |
| SCM/NAV | `b` | needs a hold ≥ 0.25 s (`delayed_press`) |
| Request Docking | `lalt+n` | `lalt+n` = request landing. **Docking is `ralt+n`** (`v_toggle_docking_request`) |
| Docking Camera | `0` | tap `0` = remove all pinned targets; camera needs a hold ≥ 0.25 s |
| Contacts | `f11` | still F11; now called "CommLink App" |

**8.4 Profile combos that collide with 4.10 defaults in the same context** (both actions fire):

| deck bind | deck action | 4.10 default on the same combo |
|---|---|---|
| `ralt+r` | `v_salvage_cycle_modifiers_right` | **`v_flightready`** (spaceship_general, vehicle_general): pressing Modifier Right also toggles Flight Ready |
| `ralt+l` | `v_salvage_cycle_modifiers_left` | `v_light_amplification_toggle` (seat_general, 4.6+) |
| `ralt+g` | `v_set_guns_mode` | `v_weapon_aim_type_cycle` (spaceship_weapons) |
| `ralt+s` | `v_set_salvage_mode` | `v_salvage_toggle_fire_disintegrate` (spaceship_salvage) |
| `np_period` | `v_toggle_all_doors` | `foip_cyclechannel` (global VoIP map) |
| `lalt+s` | (dead) `v_ifcs_speed_limiter_reset_scm` | `v_salvage_focus_all_heads` |
| `lalt+4` | `v_target_cycle_attacker_back` | `v_mining_use_permanent_modifier` (mining mode only) |

`make-profile.js`'s clash check only compares the deck's own binds with each other, not with the
game defaults; the JSON's `defaultCombosInUse` makes a defaults check easy.

## 9. What a "built-in actions only" Stream Deck pack can rely on

A Stream Deck profile using only Elgato's Hotkey action works out of the box for actions with a
default keyboard bind (sections 3–5, `defaultKeyboard` non-null in the JSON). Actions with **no
default** (ESP, speed limiter toggle, Set NAV/SCM, operator-mode setters, quantum mode, shield
faces, panic decoys, staggered fire, weapon-preset setters, MFD pages, emotes, doors, missile
cinematic cam, power set on/off, cooler rate) need either the Tablet Deck Keyboard profile imported
in-game or the player's own binds. Mouse-only defaults (quantum engage `mouse1`, scan `mouse1`,
missile launch `mouse1`, operator cycle `mouse3`, speed limiter steps `lalt+mwheel`) can't be sent
by a keyboard Hotkey and also need a keyboard bind from the profile.

## 10. Not confirmed / open

- In-game screenshot key and folder (Print Screen → `LIVE\ScreenShots`): community-only; verify on
  a Windows PC.
- Whether incoming CommLink **calls** are answered with `notification_accept` / `[`. The "Accept
  Call"/"Decline Call" hint strings exist; their binding isn't named in any string.
- Which exact patch (3.23 … 4.2) made each 3.22.1 → 4.3.2 change; no 4.0–4.2 dump was found.
- `v_toggle_running_lights`, `v_toggle_cabin_lights`, `v_comm_*precanned*`, `toggle_ar_mode`,
  `toggle_trackview` have no English label and may be unused; don't build keys on them without a test.
- Nothing newer than 4.10.2 LIVE (10 Oct 2026); re-run `sc-scripts/dump_dp.py` on the next patch's
  `defaultProfile.xml` and diff with `diffkb.py`.
- Nothing here was tested in the running game (Windows-only); all values come from the game's data
  files.
