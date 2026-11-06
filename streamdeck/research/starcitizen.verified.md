# Star Citizen 4.x keyboard binds for the Stream Deck mega pack (verified)

Fact-checked version of `starcitizen.md` (kept unchanged next to this file). Checked 2026-11-06.

Machine-readable companion, corrected: `<scratch>/streamdeck-research/starcitizen-actions.verified.json`
(the draft's `starcitizen-actions.json` is kept; see change 13).

Verification scripts (independent of the draft's Python, Node only):
`<scratch>/streamdeck-research/verify-sc/scripts/`
(`parse.js` parser, `q.js` query, `diff.js` version diff, `checkprofile.js` checks `tools/make-profile.js` and
`keybinds/TabletDeck-StarCitizen.xml` against 4.10, `fixjson.js` writes the corrected JSON). Fresh downloads are in
`.../verify-sc/dl/` (game files) and `.../verify-sc/dl/hist/` (every 4.x version of the file).

## Changes from the first draft

**Corrections (the draft was wrong or incomplete):**

1. **Default-bind count.** The summary says "about 95 of the 190 listed actions" have a default.
   The draft's own JSON says otherwise:
   - 127 have a keyboard default.
   - 15 more have a mouse input written in the `keyboard` attribute (`mouse1`, `lalt+mwheel_up`…).
   - 48 have none.
   Of the 127, **106 fire from a quick tap** and **21 need the key held** (list in §9).
2. **Hold actions may not work with the built-in Hotkey action at all.** The draft (§2, §9) relies on
   `profiles.md` §6, which says Elgato's Hotkey holds the key while the Stream Deck key is held. That
   source is a third-party converter's comment. Two other sources say the opposite:
   - The [streamdeck-keyhold README](https://github.com/johnbindel/streamdeck-keyhold) says the stock
     Hotkey "Presses and releases immediately. A tap."
   - An Elgato Marketplace listing ("Better Hotkeys & Mouse Lite", quoted on the
     [Hotkey Hold listing page](https://marketplace.elgato.com/product/hotkey-hold-3df017b8-52d3-4ee1-aaad-34cce691c52c),
     Mar 2026) says it "adds the one thing Stream Deck's stock Hotkey action can't do: hold a key down".

   Elgato's own help pages returned 403 here. **Status: contested, needs a hardware test.** It decides
   whether push to talk, freelook, look behind, SCM/NAV, autoland, docking camera, max/min power,
   radar ping and quantum engage work in a built-in-only profile.
3. **`cam_toggle_cinematic` (Backspace tap) has no UI label.** It has `UILabel` absent and doesn't
   appear in the keybinding menu, so "Backspace toggles the cinematic camera" is downgraded from High
   to **Low**. The advice is unchanged: never put Backspace on a Stream Deck key.
4. **RAlt+N is two actions.** It is `v_toggle_docking_request` (Docking, `spaceship_docking`, tap)
   **and** `v_atc_loading_area_request` (Request Cargo Loading, `spaceship_movement`, tap). Both are
   in the vehicle context, so a Docking key also requests cargo loading.
5. **Numpad 5 is two actions on foot.** It is `emote_cs_forward` (Forward hand signal, `player_emotes`)
   and also `headtrack_recenter_device` + `hmd_recenter` in the always-active
   `player_input_optical_tracking` map. A hand-signal key also recenters head tracking.
6. **Numpad + and Numpad − also zoom 3D displays.** They are
   `ui_3d_display_zoom_in_button` / `_zoom_out_button` in `player` and `vehicle_mobiglas`
   (`onPress`/`onHold`, `holdTriggerDelay="0.4"`). Push to talk zooms an open 3D map or display.
7. **X is three actions in a ship.** The Spacebrake key (`v_space_brake`, press and release) also fires
   `v_strafe_trim_reset_short` (tap) or `v_strafe_trim_reset_long` (hold ≥ 0.25 s), "Throttle - Trim -
   Release". This was added to the tap/hold table.
8. **Tab and chat.** `cycle_chat_lobby` (Tab) is in the `default` map, which is always active. The
   draft's "only while chat is focused" is an inference, so it is downgraded to Medium.
9. **When the 4.x changes landed:**
   - `v_toggle_docking_request` first appears in tracker commit dc372fb "4.7TransitTP2"
     (17 Apr 2026, a tech preview), before 4.8.0 PTU.
   - The draft's "4.9" changes appear in a5c4bd5 "instancingTP" (16 Jun 2026, a tech preview) and
     carry into 4.9.0 PTU and 4.10.
   - The 4.10.0 file is byte-identical to that tech-preview file (md5 `75f63dc5…`).
10. **New problems in the current deck (§8):**
    - **The "Launch Missile" button doesn't launch.** `cb-missile` in `hud.json`, `combat.json`,
      `mining-salvage.json`, `vulture*.json` and `prospector-phone.json` uses
      `v_weapon_launch_missile_cinematic`. The game labels that action "Enable Cinematic Camera
      (Toggle)", in **both** 3.22.1 and 4.10, so the button never launched a missile.
      - Launch actions: `v_weapon_toggle_launch_missile` ("Launch Missiles (Tap)", `press`, default
        `mouse1`) or `v_weapon_launch_missile` ("Launch Missiles (Hold)", `delayed_press`, no default).
    - **`v_toggle_all_doors` is missing a map.** It exists in `spaceship_general` **and**
      `vehicle_general` in 4.10, but `ACTIONMAPS` binds only `spaceship_general`, so ground vehicles
      don't get the profile key.
    - **"Engage Quantum" (hold B) actively switches modes.** Holding B ≥ 0.25 s fires
      `v_master_mode_cycle_long`, so the button toggles SCM/NAV rather than doing nothing.
11. **RCtrl emote binds share combos with two internal maps.** Several profile emote binds match the
    `debug` map (RCtrl+P `pause_and_fly`, RCtrl+O `debug_pause_alt`, RCtrl+− `debug_time_slower`,
    RCtrl+T `teleport_to_camera`) and `IFCS_controls` (RCtrl+B, RCtrl+Y). Neither map has UI labels,
    and `debug` also holds `godmode` on F9, so both are almost certainly inactive in public builds.
    Low risk. A defaults check should skip these maps.
12. **`smart_toggle` meaning is inferred.** The game file gives only `onPress=1 onRelease=1
    releaseTriggerDelay=0.25`. "Tap toggles, hold is momentary" comes from labels such as "(Toggle /
    Hold)", so it is Medium.
13. **Gaps in the JSON** (fixed in `starcitizen-actions.verified.json`; 26 entries updated):
    - Seven actions had `activationMode: null` because the game file writes `ActivationMode` with a
      capital A (`v_salvage_reset_gimbal`, `v_salvage_focus_*`, `v_salvage_toggle_beam_spacing_axis`).
      They are now `"press"`.
    - Actions defined by raw attributes (Decoy, Spacebrake, F5–F7 max/min, …) had a null mode and
      timing. They now carry `rawActivation` and a timing note.
    - `focus_on_chat_textinput` gains `np_enter` in `defaultKeyboardAlt`.
    - Each entry now lists `sharedDefaults`, the other actions whose default is the same combo.
    - `y` (`zgt_detach`) was added to `defaultCombosInUse.onFoot`.
14. **The draft's `global_4.10.ini` is not byte-identical to the file at the cited commit.** It is
    10,278,385 bytes; commit 908b76a's `P4kContents/Data/Localization/english/global.ini` is
    10,401,084 bytes. Every label quoted in the draft matched the fresh download, so content is
    unaffected. Cite the fresh file.

**Additions:**

15. **Screenshots.** The community wiki [Guide:Bug reporting](https://starcitizen.tools/Guide:Bug_reporting)
    (edited 6 Aug 2025) says Print Screen saves to `Roberts Space Industries\StarCitizen\LIVE\screenshots`.
    That is still community-only (Medium-Low).
    - **Windows 11 caveat:** a setting "Use the Print screen key to open screen capture" can route
      PrtScn to the Snipping Tool. Third-party coverage says it became default-on in 2023 builds; the
      [Microsoft Snipping Tool page](https://support.microsoft.com/en-us/windows/use-snipping-tool-to-capture-screenshots-00246869-1843-655f-f220-97299b865f6b)
      doesn't state the default. Medium.
16. **Rebinds can carry an activation mode.** User `actionmaps.xml` files can put `activationMode` on a
    `<rebind>`. Real exports show it: a [3.0.0-LIVE keyboard export](https://gist.github.com/an3k/1fe4a6782e1d21e7821f64af208a22b5)
    has `<rebind input="kb1_lalt+l" activationMode="double_tap"/>` and `kb1_g` with `"press"`, and a
    [gamepad export](https://gist.github.com/kendrikat/92111cbf1427222942963489d727ebea) has
    `press` / `hold` / `double_tap`.
    - This could let the Tablet Deck profile make hold-only actions fire from a tap.
    - **Untested in 4.x**, and the ground rules (one press per tap) allow only `press` / `tap`
      overrides, not `double_tap`.
17. **Windows extended keys.** Any key sender (Stream Deck Hotkey, our plugin, `server.js`) must set the
    extended-key flag for RAlt, RCtrl, Numpad /, Numpad Enter, Insert, Delete, Home, End, PgUp, PgDn,
    the arrows and Print Screen ([Microsoft: Keyboard Input Overview, Extended-Key Flag](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input)).
    Without it, RAlt reads as LAlt and Numpad / as `/`, which matters because many 4.x defaults are
    RAlt combos.
    - On layouts with AltGr (German, French…), Windows reports AltGr as LCtrl+RAlt (general Windows
      behaviour; how Star Citizen treats it is unverified).
18. **No per-app mobiGlas binds.** The only ones are F1 mobiGlas, F2 map, F11 CommLink and the PIT
    category `pc_pit_mobiglas_actions` (no default). High, from absence in the 4.10 file.
19. **Party invites and party launches confirmed on `[` / `]`.** Game strings
    `Frontend_PartyInviteMessage` and `mobiGlas_ui_notification_Party_Launch` say "Press
    ~action(ui_notification|ui_notification_accept) to join". Calls are still unconfirmed.
20. **F9 / F10 power throttle** (`spaceship_power`): `v_power_throttle_down` / `_up` on press or hold,
    and `_min` / `_max` on **double tap**. Double tap is off-limits under the one-press-per-tap rule.
21. **The community wiki's other errors.** [starcitizen.tools/Keybinds](https://starcitizen.tools/Keybinds)
    (edited 13 Jul 2026) also swaps decoupled and cruise: it lists decoupled as LAlt+C and cruise as
    C, wrong in both 3.22.1 and 4.10.

**Confirmed unchanged** (re-checked against my own parse): every action name, map, keyboard default and
mode in the draft's §3–§6 tables, the activation-mode thresholds, the 3.22.1 → 4.3.2 diff table, the
within-4.x table (with the date refinements above), the five dead actions and the look-behind map error
in `make-profile.js`, all raw-key problems in §8.3, and the 4.10.0 = 4.10.2 equivalence.

## 0. TL;DR for the generator

- **Ground truth is the game's `Data/Libs/Config/defaultProfile.xml`.**
  - 4.10.0: build `4.10.193.11644`, `sc-alpha-4.10.0`, built 15 Sep 2026, md5 `75f63dc55b840cf7a1176bc6b12d9360`.
  - An independent extraction of **4.10.2** (`4.10.196.36804`, `sc-alpha-4.10.2`, built 7 Oct 2026,
    committed 10 Oct 2026) has **zero** keyboard-default or activation-mode differences (my diff, all
    1103 actions).
  - No newer file exists in either tracker as of 2026-11-06. High.
- **VoIP / FOIP** is actionmap `player_input_optical_tracking`, which is always active:
  - push to talk: Numpad + (hold); proximity: LAlt+Numpad + (hold)
  - cycle channel: Numpad .
  - FOIP recalibrate: Numpad \*; selfie cam: hold Numpad − ≥ 0.25 s
  - head tracking toggle: Numpad /; recenter: Numpad 5
- **No keybind exists for VoIP on/off, mic mute or voice-activated mode.** They are Options-only. A
  mute key has to be Discord or Windows mute. High.
- **Comms UI:**
  - F11 = CommLink app; F12 = chat; Enter / Numpad Enter = focus chat
  - `[` / `]` = accept / reject invite (party invites, party launch); hold `]` = ignore
  - 9 = hail target; LAlt+F = PIT wheel
- **Screenshots aren't an actionmap action.** Print Screen to `LIVE\screenshots` is community-only, and
  Windows 11 may grab PrtScn for the Snipping Tool.
- **The existing deck's 3.x keys are wrong in 4.x:**
  - Decoy is H; Noise is J; Flight Ready is RAlt+R.
  - Quantum engage is hold Mouse1; hold B switches SCM/NAV.
  - Docking is RAlt+N (shared with Request Cargo Loading).
  - Five `scAction`s are dead.
  - "Launch Missile" is really the missile cinematic camera.
- **Tap vs hold:** `tap` fires only if released within 0.25 s, `delayed_press` needs ≥ 0.25 s,
  `delayed_press_medium` ≥ 0.5 s. **Whether the stock Hotkey action can hold at all is contested**
  (change 2); test it before relying on any hold.

## 1. Sources and method

| # | Source | Verified how | Confidence |
|---|---|---|---|
| S1 | [x3nnnonn/StarCitizenDiff `P4kContents/Data/Libs/Config/defaultProfile.xml` @908b76a](https://github.com/x3nnnonn/StarCitizenDiff/blob/908b76a0485036161ba700d369c7d92aca1c847b/P4kContents/Data/Libs/Config/defaultProfile.xml) | Re-downloaded raw at the commit; md5 matches the draft's copy. Same commit's [`build_manifest.json`](https://github.com/x3nnnonn/StarCitizenDiff/blob/908b76a0485036161ba700d369c7d92aca1c847b/build_manifest.json): `"Branch": "sc-alpha-4.10.0"`, `"Version": "4.10.193.11644"`, `"BuildDateStamp": "Tue Sep 15 2026"`, `"Tag": "public"`. Fresh clone: last commit 908b76a (22 Sep 2026); the file's last change is a5c4bd5 "instancingTP" (16 Jun 2026), byte-identical. | High |
| S2 | [hamlet2k/sc-mapper `data/game/defaultProfile.xml` @01b0cff](https://github.com/hamlet2k/sc-mapper/blob/01b0cff125178018ced91db3e18f391ed1b07f1d/data/game/defaultProfile.xml) + [`build_manifest.json`](https://github.com/hamlet2k/sc-mapper/blob/01b0cff125178018ced91db3e18f391ed1b07f1d/data/game/build_manifest.json) | Re-downloaded; manifest `"Branch": "sc-alpha-4.10.2"`, `"Version": "4.10.196.36804"`, `"BuildDateStamp": "Wed Oct 07 2026"`. Fresh clone: commit 79d9f2c, 2026-10-10, "Default bindings: Star Citizen 4.10.2 LIVE from committed data/game"; no later change to `data/game/`. | High |
| S3 | StarCitizenDiff history, every commit that touched the file: fef3dd0 4.3.2-ptu, a7074b0 / 7cc6eb7 4.5.0-ptu, b960c55 / 6ad8db4 4.6.0-ptu, 27bcc0c 4.7.0-ptu, 6305d32 4.7.1, dc372fb 4.7TransitTP2, b27f529 4.8.0-ptu, a5c4bd5 instancingTP | Downloaded each and diffed with my own script | High for contents; Medium for "which public patch" |
| S4 | [itrew/sc-keybinding-tools `defaultProfile.xml` @599134c](https://github.com/itrew/sc-keybinding-tools/blob/599134c9dbb7749e256ba22452e4c7d5f9d9fb5a/data/game-files/defaultProfile.xml) | Re-downloaded; md5 matches. Fresh clone: de41c94 (2024-04-20) "update data for 3.22.1-LIVE.9097523". | High |
| S5 | `P4kContents/Data/Localization/english/global.ini` @908b76a (10,401,084 bytes) | Fresh download; every label below quoted from it | High |
| S6 | `CVar/cvar_dump.json` @908b76a | Fresh download, md5 matches the draft. `r_GetScreenShot`: "Capture a single screenshot (variable is set to 0 after capturing)\n1: Take screenshot immediately…" | High |
| W1 | [starcitizen.tools/Keybinds](https://starcitizen.tools/Keybinds), edited 13 Jul 2026 | Fetched. Flight Ready "R", quantum "Hold B", decoupled "Left ALT + C", cruise "C", ping "Hold V". All contradicted by S1/S2. **Don't use.** | Low |
| W2 | [starcitizen.tools/Guide:Bug_reporting](https://starcitizen.tools/Guide:Bug_reporting), edited 6 Aug 2025 | Fetched: Print Screen → `Roberts Space Industries\StarCitizen\LIVE\screenshots` | Medium-Low |
| W3 | [Spectrum "[3.23] Keybind change summary"](https://robertsspaceindustries.com/spectrum/community/SC/forum/4/thread/3-23-ptu-keybind-change-summary) | Body is JS-rendered; a search snippet says cruise became a "relative or sticky throttle" and gravity-comp toggles were added in 3.23 | Low (supports dating some changes to 3.23) |
| W4 | [streamdeck-keyhold](https://github.com/johnbindel/streamdeck-keyhold), [Hotkey Hold on Elgato Marketplace](https://marketplace.elgato.com/product/hotkey-hold-3df017b8-52d3-4ee1-aaad-34cce691c52c) | Fetched; both state or imply that the stock Hotkey can't hold | Medium (third-party; contradicts `profiles.md`) |
| W5 | [Microsoft: Keyboard Input Overview](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input) (updated 2026-07-08) | Fetched; extended-key list | High |

Notation as in the draft:
- Star Citizen input names (`lalt`, `np_add`, `lbracket`…); user profiles write `kb1_<keys>`.
- The game file writes modifiers in either order (`f6+lalt`, `u+lshift`) and once with a capital letter
  (`ralt+K`).
- It uses `activationMode`, `ActivationMode` (salvage) or raw `onPress/onHold/onRelease/holdTriggerDelay`.
- **Always-active maps:** `default`, `player_input_optical_tracking` and `ui_notification` are active
  in every context. `debug`, `IFCS_controls`, `server_renderer`, `flycam`, `spectator`,
  `character_customizer`, `RemoteRigidEntityController` and `hacking` have no UI labels (or are
  minigame-only) and are excluded from clash checks.

## 2. Activation modes

Thresholds re-read from `<ActivationModes>` in S1, identical in S2:

| mode | attributes in the file | Stream Deck meaning |
|---|---|---|
| `press` | onPress=1, thresholds −1 | any press works |
| `tap` | onRelease=1, `releaseTriggerThreshold="0.25"` | quick tap only (Tablet Deck's tap is 60 ms, `config.tapMs`) |
| `tap_quicker` | onRelease=1, release ≤ 0.15 s | quicker tap |
| `delayed_press` | onPress=1, `pressTriggerThreshold="0.25"` | hold ≥ 0.25 s |
| `delayed_press_quicker` | press threshold 0.15 | hold ≥ 0.15 s |
| `delayed_press_medium` | press threshold 0.5 | hold ≥ 0.5 s |
| `delayed_press_long` | press threshold 1.5 | hold ≥ 1.5 s |
| `hold` | onPress=1, onRelease=1, retriggerable=1 | active while held |
| `hold_no_retrigger` / `hold_toggle` | onPress=1, onRelease=1 | active while held |
| `delayed_hold` | press threshold 0.25, onRelease=1 | active after 0.25 s until release |
| `delayed_hold_long` | press threshold 1.5, onRelease=1 | active after 1.5 s |
| `delayed_hold_no_retrigger` | press threshold 0.15, onRelease=1 | active after 0.15 s |
| `smart_toggle` | onPress=1, onRelease=1, `releaseTriggerDelay="0.25"` | tap toggles; hold acting as momentary is **inferred** from labels (Medium) |
| `double_tap` / `double_tap_nonblocking` | multiTap=2 | **not allowed** (one press per tap) |
| `all` | onPress, onHold, onRelease | — |

Keys that do **different things by press length or context** (4.10, vehicle / on-foot / global maps;
complete list from my scan, UI-only rows omitted):

| key | quick tap | held | also (same key, other action) |
|---|---|---|---|
| `n` | `v_toggle_landing_system` (gear) | ≥ 0.25 s `v_autoland` | — |
| `b` | nothing in a ship | ≥ 0.25 s `v_master_mode_cycle_long` (SCM ↔ NAV) | on foot: `weapon_change_firemode`, `tractor_beam_detach` |
| `0` | `v_target_remove_all_pins` | ≥ 0.25 s `v_dock_toggle_view` | — |
| `x` **[new]** | `v_strafe_trim_reset_short` | ≥ 0.25 s `v_strafe_trim_reset_long` | `v_space_brake` (press + release) on the same key |
| `f5` / `f6` / `f7` | +1 weapons / engines / shields | ≥ 0.25 s (`holdTriggerDelay`) max | — |
| `lalt+f5/f6/f7` | −1 | hold: min | — |
| `rbracket` | `ui_notification_decline` (tap); `notification_decline` (press) | ≥ 0.25 s `ui_notification_ignore` | — |
| `r` | ship: next sub-target; on foot: reload | on foot ≥ 0.5 s holster | — |
| `t` | ship: next target in view (`_fwd` and `_reset`, both tap) | ≥ 0.25 s auto-targeting | on foot: flashlight |
| `i` | ship: power thrusters; on foot: inventory | on foot ≥ 0.25 s loot | — |
| `backspace` | `cam_toggle_cinematic` (unlabelled) | ≥ 0.5 s `v_self_destruct` / `force_respawn`; ≥ 1.5 s `incapacitatedRespawn` | — |
| `f1` | mobiGlas | on foot ≥ 0.5 s scoreboard (`holdTriggerDelay`) | ship: `v_hud_open_scoreboard` (`all`) |
| `f9` / `f10` | power throttle − / + | — | **double tap** = min / max (off-limits) |
| `m` | mining / salvage / refuel operator mode (one per ship type) | on foot ≥ 1.5 s rescue request | — |
| `np_add` | push to talk (hold) | — | 3D display zoom in (`holdTriggerDelay` 0.4) |
| `np_subtract` | — | ≥ 0.25 s FOIP selfie cam | 3D display zoom out |
| `np_5` | VR / head-tracking recenter (global) | — | on foot: Forward hand signal |
| `ralt+n` | Docking (tap) | — | Request Cargo Loading (tap) |
| `lalt+1..3` | ship: pin index 1–3 (tap) | — | mining modules 1–3 (press, mining mode) |

## 3. Comms page (all re-verified, S1 = S2)

| What | action | map | default | mode | Confidence |
|---|---|---|---|---|---|
| VoIP push to talk | `foip_pushtotalk` | `player_input_optical_tracking` | `np_add` | hold | High. Also zooms open 3D displays |
| Push to talk, proximity only | `foip_pushtotalk_proximity` | same | `lalt+np_add` | hold | High |
| Cycle voice channel | `foip_cyclechannel` | same | `np_period` | press | High. Only channel bind |
| FOIP recalibrate | `foip_recalibrate` | same | `np_multiply` | press | High |
| FOIP selfie cam | `foip_viewownplayer` | same | `np_subtract` | delayed_hold | High |
| Head tracking on/off | `headtrack_enabled` | same | `np_divide` | press | High. Shares with `hmd_toggle` |
| Head tracking (hold) | `headtrack_hold` | same | — | hold | High |
| Recenter head tracking | `headtrack_recenter_device` | same | `np_5` | press | High. Shares with `hmd_recenter` and on-foot `emote_cs_forward` |
| 3rd-person head tracking | `headtrack_camera_enabled` | same | — | press | High |
| VR toggle / recenter / theater / visor | `hmd_toggle` / `hmd_recenter` / `hmd_theater_mode_toggle` / `hmd_lens_display_toggle` | same | `np_divide` / `np_5` / `lalt+np_5` / — | press | High ("[Experimental]") |
| CommLink app | `toggle_contact` | `default` | `f11` | press | High. "CommLink App (Toggle)"; F11 also fires unlabelled `toggle_cursor_input` / `v_toggle_cursor_input` |
| Chat window | `toggle_chat` | `default` | `f12` | press | High |
| Focus chat | `focus_on_chat_textinput` | `default` | `enter`, `np_enter` | press | High |
| Cycle chat lobby | `cycle_chat_lobby` | `default` | `tab` | press | High for the bind; **Medium** that it only acts while chat is open |
| Accept invite | `ui_notification_accept` | `ui_notification` | `lbracket` | onPress=1 | High. Party invite, party launch, "go to last instance" |
| Reject / ignore invite | `ui_notification_decline` / `_ignore` | `ui_notification` | `rbracket` tap / hold | tap / delayed_hold | High |
| Accept / decline prompt | `notification_accept` / `_decline` | `default` | `lbracket` / `rbracket` | press | High for the bind; **Medium-Low** that it answers calls |
| Hail target | `v_target_hail` | `spaceship_target_hailing` | `9` | tap | High |
| MFD comms page | `v_mfd_select_view_comms_short` / `_long` | `vehicle_mfd` | — | tap / delayed_press | High |
| PIT wheel | `pc_personal_thought` | `player_choice` | `lalt+f` | press | High |
| PIT emotes / mobiGlas category | `pc_pit_emotes` / `pc_pit_mobiglas_actions` | `player_choice` | — | press | High |
| Hand signals Forward / Left / Right / Stop / Yes / No | `emote_cs_forward` / `_left` / `_right` / `_stop` / `_yes` / `_no` | `player_emotes` | `np_5` / `np_1` / `np_3` / `np_2` / `np_4` / `np_6` | press | High. On foot; Forward also recenters head tracking |
| 34 emotes | `emote_*` | `player_emotes` | — | press | High |
| Wipe visor | `visor_wipe` | `player`, `spaceship_hud`, `vehicle_general` | `lalt+x` | press | High |
| Precanned ship comms | `v_comm_*` | `spaceship_hud` | `empty` | onPress/onRelease | High that they're unlabelled; skip |

Not bindable (High, from absence in the 4.10 file; strings from S5): VoIP off (`pause_OptionsDisableVOIP`
"Disable VOIP"), mic mute (`pause_OptionsMuteMicrophone` "Mute Microphone"), voice activation
(`pause_OptionsLevelActivatedVoiceTx`), volumes, calls-from setting (`pause_OptionsCommsCallsNotifications`),
all under `pause_ForegroundOptionMenuButtonCommsSettings` "COMMS, FOIP, VR & HEAD TRACKING". The CommLink
call UI has its own mute hint (`mobiGlas_hint_Microphone_Mute` "Microphone feed muted") with no bind.
Party create/invite and on-foot ping have no bind.

## 4. Camera and screenshots

| What | action | map | default | mode | Notes |
|---|---|---|---|---|---|
| Cycle camera (ship) | `v_view_cycle_fwd` | `spaceship_view`, `vehicle_general` | `f4` | tap | High |
| 3rd person (on foot) | `thirdperson` | `player` | `f4` | tap | High |
| Freelook | `v_view_freelook_mode` / `free_thirdperson_camera` / `eva_toggle_headlook_mode` | ship / `player` / `zero_gravity_eva` | `z` | hold | High |
| Look behind | `v_view_look_behind` | `seat_general` | `comma` | delayed_hold_no_retrigger (≥ 0.15 s) | High; unbound in 3.22.1 |
| Orbit mode | `v_view_mode` | `spaceship_view` | — | onPress | High |
| 3rd-person zoom | `v_view_zoom_in` / `_out` | `spaceship_view`, `vehicle_general` | mouse wheel only | onPress/onHold | High (draft said "—"; the default is the wheel) |
| Dynamic zoom | `v_view_dynamic_zoom_rel_in` / `_out`, `_abs_toggle` | `spaceship_view` (+ `vehicle_driver`) | — | all / smart_toggle | High |
| Precision targeting | `v_ads_toggle` | `spaceship_view` | `mouse2` | tap | High |
| Look ahead | `v_look_ahead_enable` | `spaceship_targeting` | `lalt+l` | smart_toggle | High |
| Padlock / auto zoom | `v_look_ahead_start_target_tracking` / `v_target_tracking_auto_zoom` | `spaceship_targeting` | — | smart_toggle | High |
| Cinematic camera | `cam_toggle_cinematic` | `default` | `backspace` | tap | **Low** (no UI label). Don't map Backspace |
| Missile cinematic cam | `v_weapon_launch_missile_cinematic` / `_hold` | `spaceship_missiles` | — | tap / onPress+onHold+onRelease | High. "Enable Cinematic Camera (Toggle / Hold)" |
| Advanced camera modifier | `view_enable_camview_mode` | `view_director_mode` | `f4` | onPress/onRelease | High for the bind ("Advanced Camera Controls Modifier (Hold)"); Medium on exact behaviour |
| Load / save view 1–9 | `view_load_view_N` / `view_save_view_N` | `view_director_mode` | `np_1`…`np_9` | tap / delayed_press | High |
| Clear saved view; reset view | `view_reset_saved` / `view_restore_defaults` | same | `np_0` / `np_multiply` | delayed_press / onPress+onRelease | High |
| FOV ±, DoF ±, offsets | `view_fov_in/out`, `view_fstop_in/out`, `view_move_target_*` | same | `np_add`/`np_subtract`, `home`/`end`, arrows, `pgup`/`pgdn` | onPress(/onHold) | High |
| **Screenshot** | *(none)* | — | — | — | No action (High). `r_GetScreenShot` cvar exists (S6). PrtScn → `LIVE\screenshots` per W2 (Medium-Low). Windows 11 may intercept PrtScn (Medium) |
| AR mode / trackview | `toggle_ar_mode` / `toggle_trackview` | `spaceship_hud`, `player` / `default` | `empty` / literal `]` | press | Unlabelled; skip. `]` isn't Star Citizen's usual `rbracket` name |

## 5. Ship actions worth a key

Every row below was re-checked against S1; only rows that changed or gained a note are annotated.

### 5.1 Systems, power, quantum

| What | action | map | default | mode |
|---|---|---|---|---|
| Flight / Systems Ready | `v_flightready` | `spaceship_general`, `vehicle_general` | `ralt+r` | press |
| Toggle power all / thrusters / shields / weapons | `v_power_toggle` / `_thrusters` / `_shields` / `_weapons` | `spaceship_power` | `u` / `i` / `o` / `p` | press (`o` also fires unlabelled global `objectives`) |
| Set power on/off | `v_power_set_on/off`, `…_thrusters_on/off`, `…_shields_on/off`, `…_weapons_on/off` | `spaceship_power` | — | press |
| Power assignment +1 / max | `v_engineering_assignment_{engine,shields,weapons}_increase` / `_max` | `spaceship_power` | `f6` / `f7` / `f5` | tap / onHold, `holdTriggerDelay` 0.25 |
| Power assignment −1 / min | `…_decrease` / `_min` | `spaceship_power` | `lalt+f6/f7/f5` (written `f6+lalt`) | tap / onHold 0.25 |
| Reset assignments | `v_engineering_assignment_reset` | `spaceship_power` | `f8` | press |
| Power throttle − / + **[new]** | `v_power_throttle_down` / `_up` | `spaceship_power` | `f9` / `f10` | onPress+onHold (double tap = min / max) |
| Cooler rate ± | `v_cooler_throttle_up` / `_down` | `spaceship_general` | — | onPress+onHold |
| SCM ↔ NAV | `v_master_mode_cycle_long` | `spaceship_movement` | hold `b` ≥ 0.25 s | delayed_press |
| Cycle master mode (short) | `v_master_mode_cycle` | `spaceship_movement` | — | tap |
| Set NAV / SCM | `v_master_mode_set_nav` / `_scm` | `spaceship_movement` | — | press |
| Quantum operator mode | `v_toggle_quantum_mode` / `v_set_quantum_mode` | `seat_general` | — | press |
| Engage / exit quantum | `v_toggle_qdrive_engagement` | `spaceship_quantum` | `mouse1` (in the `keyboard` attribute) | delayed_press ("Engage Quantum Drive (Hold)") |
| Next / previous operator mode | `v_operator_mode_cycle_forward` / `_back` | `seat_general` | `mouse3` / — | tap |
| Jump drive request | `v_toggle_jump_request` | `spaceship_movement` | `mouse1` (`mouse` attribute) | tap |
| Spool / quantum target | *(none)* | — | — | High. Spooling is automatic; targets are set in the star map |

The quantum tutorial string (`Tut03_Part03_Hint01_EnterQT`) is quoted verbatim in the draft and was
re-confirmed in S5.

### 5.2 Flight assists

Re-confirmed as in the draft: decoupled `v_ifcs_vector_decoupling_toggle` `c` tap; cruise
`v_ifcs_throttle_swap_mode` `lalt+c` onPress; ESP `v_ifcs_toggle_esp` / `v_ifcs_esp_hold` no default;
G-safety, speed limiter toggle/on/off, proximity / gravity / wind compensation, auto precision,
stability, IFCS core and advanced HUD have no default (tap); speed limiter step `lalt+mwheel_up/down`
and up/down hold (no default); accel limiter `ralt+mwheel_up/down`; boost `lshift` (all); lock rotation
`rshift` (smart_toggle); reset accelerometer `ralt+c` tap. **Spacebrake** `v_space_brake` `x`
(onPress+onRelease) **also fires the throttle-trim release** (§2).

### 5.3 Landing, docking, lights, doors, emergency

Re-confirmed, with these notes:
- `v_toggle_docking_request` (`spaceship_docking`, `ralt+n`, tap; label "Docking\n(Initiate)", states
  Dock / Cancel Docking / Undock) **shares `ralt+n` with `v_atc_loading_area_request`** ("Request Cargo
  Loading", `spaceship_movement`).
- `v_atc_request` "Request Landing" is `lalt+n` (tap).
- `v_toggle_all_doors` and `v_toggle_all_doorlocks` exist in **both** `spaceship_general` and
  `vehicle_general` with no default.
- `v_toggle_all_portlocks` is `ralt+K` in both maps.
- `v_light_amplification_toggle` (`seat_general`, `ralt+l`, tap) first appears in 4.6.0-ptu.
- Refuel mode `v_toggle_refuel_mode` (`m`) first appears in 4.8.0-ptu.
- `v_scanning_trigger_scan` (`spaceship_scanning`) has a `mouse1` default in the `mouse` attribute
  (hold) and no keyboard default.
- `v_invoke_ping` (`spaceship_radar`) is `tab` (hold), "Activate Ping (Hold & Release)".
- All other rows (`n`, `k`, `lalt+k`, `0` hold, `l`, `ralt+y` eject, `lshift+u` (written `u+lshift`)
  emergency exit, `y` exit, `lalt+j` jettison, `f1`/`f2`, `v` scan mode, MFD pages, stopwatch) are as
  in the draft.
- Stopwatch: `stopwatch_trigger` is tap, `stopwatch_reset` delayed_press (the draft had "—").

### 5.4 Combat

Re-confirmed as in the draft:
- Gimbals and aim: `g` gimbal lock (tap), `ralt+g` aim cycle.
- Weapon presets: wheel; preset setters have no default.
- Missiles:
  - Operator mode has no default.
  - `v_weapon_toggle_launch_missile` is `mouse1` (press), "Launch Missiles (Tap)".
  - `v_weapon_launch_missile` has no default (delayed_press), "Launch Missiles (Hold)".
  - Armed missiles: `g` +1, `lalt+g` reset.
  - Missile type: wheel.
- Countermeasures:
  - Decoy `h` (onPress, onHold, onRelease, `holdTriggerDelay` 0.25): "Launch Burst (tap), Set and
    Launch Burst (hold)".
  - Burst size: `ralt+h` / `lalt+h`.
  - Panic decoys have no default.
  - Noise `j` (press), "Noise - Deploy (Tap)".
- Shield faces have no default.
- Targeting:
  - `t` (tap; hold = auto targeting)
  - `4`/`5`/`6`/`7` (each fires both `_fwd` and `_reset`, tap)
  - `r` / `lalt+r` sub-target; `lalt+t` unlock
  - `1`–`3` lock pinned, `lalt+1`–`3` pin; `0` remove all pins
- Turret: `turret_recenter` `c` (`hold_no_retrigger`), `turret_esp_toggle` no default,
  `turret_remote_exit` `y`.
- Missile lock has no separate bind (Medium, from absence).

### 5.5 Mining and salvage

Re-confirmed:
- Mining:
  - `m` toggles mining or salvage mode; setters have no default.
  - `lalt+4` high/low beam ("Toggle Laser Beam (High / low)"); `lalt+1..3` modules.
  - Laser fire `mouse1` (smart_toggle); laser type `lalt+mouse1`.
- Salvage:
  - Fire: `ralt+a` / `ralt+d` / `ralt+w` / `ralt+s` (smart_toggle); fire focused `mouse1` (`mouse`
    attribute).
  - Focus: `lalt+s` / `lalt+a` / `lalt+d` / `lalt+w` (**press**, written `ActivationMode`).
  - Gimbal: `g` / `lalt+g` (press).
  - Beam axis: `lalt+mouse2` (press).
  - Modifiers left / right / structural have no default; focused uses `mouse2`.
  - Beam spacing ± and nudges have no default.
- Tractor beam distance (vehicle): mouse wheel (`mouse` attribute).

### 5.6 On foot

Re-confirmed:
- Inventory / loot: `i` tap / hold.
- Flashlight: `t`. Helmet: `ralt+h` (tap). Attach helmet: `lalt+h` (tap).
- Fire mode: `b`. Stance: `lalt+r`. Holster: hold `r` 0.5 s.
- Consumables and throwables wheels: `4` / `g`.
- Rescue: hold `m` 1.5 s. Force respawn: hold `backspace` 0.5 s.
- Customize weapon: `j` (tap).

## 6. What changed in 4.x

**3.22.1 → 4.3.2:** the draft's table is correct row for row (my diff `verify-sc/diff_322_432.txt`).
Two extra details:
- `v_ifcs_toggle_vector_decoupling` was `smart_toggle` in 3.22.1; its replacement is `tap`.
- `pl_hud_open_scoreboard` also moved Tab → F1.

Patch attribution is still Low. W3 hints that 3.23 made the cruise and gravity-compensation changes.

**Within 4.x** (tracker commit → change; "first seen" means the first tracker build with it):

| first seen | change |
|---|---|
| 4.5.0-ptu.10800284 (a7074b0, 29 Nov 2025) | `headtrack_recenter_device` → `np_5`; wind-compensation actions; `v_ifcs_toggle_gravity_compensation` → `v_ifcs_gravity_compensation_toggle`; MFD "repair all"; UI actions in `default` (`ui_select` enter, `ui_focus_increment` tab, `ui_primaryTab_increment/decrement` e/q) |
| 4.5.0-ptu.10957089 (7cc6eb7, 16 Dec 2025) | `hmd_*` moved from `default` (`np_1`/`np_2`) to `player_input_optical_tracking` (`np_divide`, `np_5`, `lalt+np_5`, lens toggle) |
| 4.6.0-ptu.11019052 (b960c55, 12 Jan 2026) | `v_light_amplification_toggle` `ralt+l`, `_on`, `_off` |
| 4.7TransitTP2 (dc372fb, 17 Apr 2026) | `v_toggle_docking_request` `ralt+n` in `spaceship_movement` |
| 4.8.0-ptu.11689568 (b27f529, 23 Apr 2026) | `v_toggle_refuel_mode` `m`, `v_set_refuel_mode` |
| instancingTP (a5c4bd5, 16 Jun 2026) → 4.9.0 PTU → 4.10 | docking request moves to `spaceship_docking`; `v_toggle_docking_mode` / `v_invoke_docking` (`n`) removed; `pc_qs_weapons_pit_secondary` / `_sidearm` → `2` / `3`; `debug` map gains RCtrl+O / − / = / T and `pause_and_fly` RCtrl+P |
| 4.10.0 → 4.10.2 | none (all 1103 actions) |

## 7. Default combos in use

`starcitizen-actions.verified.json` → `defaultCombosInUse` (vehicle / onFoot / global). My recomputation
from S1 matches the draft's except that `y` (`zgt_detach`, `zero_gravity_traversal`) was missing from
onFoot (now added; it was already in `global` via `pl_exit`). Mouse inputs are deliberately left out.

**Whether a profile bind and a default on the same combo both fire** is an inference (Medium). The
in-game binding UI warns about conflicts, but an XML profile doesn't unbind the other action, and the
game's own defaults overlap (`lalt+1` = pin 1 and mining module 1).

## 8. Problems in Tablet Deck's current layouts and profile

**8.1 Dead `scAction`s (High; absent from every file 4.3.2 → 4.10.2):**

| scAction | deck key | replacement in 4.10 |
|---|---|---|
| `v_ifcs_toggle_speed_limiter` | `lalt+minus` | `v_ifcs_speed_limiter_toggle` (tap, no default) |
| `v_ifcs_speed_limiter_reset_scm` | `lalt+s` | none |
| `v_speed_range_up` / `_down` | `lalt+y` / `lctrl+y` | `v_ifcs_speed_limiter_increment` / `_decrement` (press) or `_up` / `_down` (hold) |
| `v_target_match_vel` | `lctrl+v` | none |

**8.2 Actionmap errors in `ACTIONMAPS`:**
- `v_view_look_behind` is listed under `vehicle_general` but is in **`seat_general`** in 4.10. High that
  the map is wrong; Medium that the game ignores the rebind.
- **[new]** `v_toggle_all_doors` is listed only under `spaceship_general`; 4.10 also has it in
  `vehicle_general`.

**8.3 Buttons that do something else in 4.10** (60 ms taps, `config.tapMs`):

| button (layouts) | sends | what happens |
|---|---|---|
| Decoy (all) | `g` tap | gimbal lock toggle / +1 armed missile / salvage gimbal. **Decoy is `h`** |
| Noise (all) | `h` tap | fires a decoy burst. **Noise is `j`** |
| Toggle Flight Ready (hud family), Flight Ready (`star-citizen.json`) | `r` tap | next sub-target. **Flight Ready is `ralt+r`** |
| SCM/NAV | `b` tap | nothing (needs ≥ 0.25 s) |
| Engage Quantum (hud family), Quantum Jump (`star-citizen.json`) | `b` hold | **switches SCM/NAV**. Quantum engage is hold `mouse1` (no keyboard default) |
| Request Docking | `lalt+n` | Request Landing. **Docking is `ralt+n`** (also Request Cargo Loading) |
| Docking Camera | `0` tap | **clears all pinned targets**; the camera needs ≥ 0.25 s |
| **[new] Launch Missile** (`cb-missile`, scAction `v_weapon_launch_missile_cinematic`) | `ralt+backslash` | toggles the **missile cinematic camera** ("Enable Cinematic Camera (Toggle)", same in 3.22.1). Use `v_weapon_toggle_launch_missile` |
| Contacts | `f11` | still right ("CommLink App") |

Buttons confirmed fine in 4.10: Engage Auto Land (`n` 1500 ms), Max/Min power (`f5`–`f7` 900 ms), Exit
Seat (`y` 1200 ms), Self-D (`backspace` hold), Eject (`ralt+y` 600 ms), `u/i/o/p`, `f5`–`f8` taps, Gear,
VTOL, Lights, F1/F2/F4/F12, Inventory.

**8.4 Profile binds sharing a combo with a 4.10 default** (my `checkprofile.js`, every profile bind vs
every default):

| profile bind | profile action | 4.10 default on the same combo | context |
|---|---|---|---|
| `ralt+r` | `v_salvage_cycle_modifiers_right` | `v_flightready` | same (vehicle) |
| `ralt+l` | `v_salvage_cycle_modifiers_left` | `v_light_amplification_toggle` | same |
| `ralt+g` | `v_set_guns_mode` | `v_weapon_aim_type_cycle` | same |
| `ralt+s` | `v_set_salvage_mode` | `v_salvage_toggle_fire_disintegrate` | same |
| `np_period` | `v_toggle_all_doors` | `foip_cyclechannel` | global |
| `lalt+s` | dead `v_ifcs_speed_limiter_reset_scm` | `v_salvage_focus_all_heads` | same |
| `lalt+4` | `v_target_cycle_attacker_back` | `v_mining_use_permanent_modifier` | same (mining mode) |
| `np_1` / `np_2` / `np_3` **[new]** | `v_enter_remote_turret_1..3` | `view_load_view_N` (only while F4 held); `emote_cs_*` (on foot) | low |
| `ralt+d` / `ralt+w` **[new]** | on-foot `drop` / `walk` | salvage fire right / fracture | different contexts, no clash |
| `rctrl+p/o/minus/t/b/y` **[new]** | emotes, `v_toggle_mining_laser_type` | `debug` / `IFCS_controls` | internal maps, Low |
| `lctrl+v` | dead `v_target_match_vel` | `ui_paste` (`default`) | — |

## 9. What a "built-in actions only" Stream Deck pack can rely on

From `starcitizen-actions.verified.json` (190 curated actions):

- **106 actions fire from a quick tap** with a default keyboard bind. These work with a plain Hotkey key
  if it sends the right key (extended-key flag for RAlt / RCtrl / Numpad / / Numpad Enter / navigation
  keys, §change 17).
- **21 need the key held:**
  - comms: `foip_pushtotalk`, `foip_pushtotalk_proximity`, `foip_viewownplayer`, `ui_notification_ignore`
  - camera: freelook ×3, `v_view_look_behind`, `view_save_view_N`, `view_reset_saved`
  - ship: `v_engineering_assignment_*_max/_min`, `v_master_mode_cycle_long`, `v_invoke_ping`,
    `v_autoland`, `v_dock_toggle_view`, `v_self_destruct`, `v_auto_targeting_toggle_long`
  - on foot: `pc_pit_looting`, `holster`, `downedRevivalRequest`, `force_respawn`

  **If the stock Hotkey only taps (change 2), none of these work from it.** They then need one of:
  - the Tablet Deck plugin or server path, which can hold a key for a set time (`mode: "timed"` /
    `"hold"`), going through `tapButton()` and `gameFocused()`;
  - a press-mode alternative bound by the Tablet Deck Keyboard profile: `v_master_mode_set_nav` /
    `_set_scm` instead of hold B;
  - an `activationMode` override on the profile's `<rebind>` (change 16, untested).
- **15 have only a mouse default** (quantum engage, missile launch, operator cycle, ADS, speed /
  accel limiter steps, weapon presets, missile type, mining fire / type, salvage axis), plus scan and
  jump in the `mouse` attribute. They need a keyboard bind from the profile.
- **48 have no default** (ESP, Set NAV/SCM, operator-mode setters, shield faces, panic decoys, MFD
  pages, emotes, doors, power set on/off, cooler, …). They need the profile or the player's own binds.
- **Never** give Backspace, `double_tap` actions (F9/F10 double = power min/max) or self destruct a
  plain Hotkey key.

## 10. Open questions

1. **Does Elgato's built-in Hotkey hold the key while the Stream Deck key is held?** Sources conflict
   (change 2). Test on a Stream Deck with a key-event viewer. Critical for push to talk and every
   hold action.
2. Does Star Citizen 4.10 honour `activationMode` on a user `<rebind>` (e.g. `press` on
   `v_master_mode_cycle_long`)? The format exists; 4.x behaviour is untested.
3. Is the screenshot key Print Screen, and is the folder `StarCitizen\LIVE\screenshots`? Does Windows
   11's "Print screen opens screen capture" setting stop the game from seeing PrtScn?
4. Are CommLink **calls** answered with `[` / `]`? Party invites and launches are confirmed; calls
   aren't named in any string.
5. Does `cam_toggle_cinematic` (Backspace tap) do anything in LIVE?
6. How does Star Citizen read RAlt sent by SendInput (extended flag) and AltGr on European layouts?
   Many 4.x defaults are RAlt combos.
7. Do always-active co-binds (O → `objectives`, F11 → `toggle_cursor_input`, Tab →
   `ui_focus_increment` / `cycle_chat_lobby`, Numpad +/− → 3D zoom) have visible side effects in flight?
8. Does a profile bind fire alongside a default on the same combo? (Inferred yes; Medium.)
9. Which public patch (3.23 … 4.2) made each 3.22.1 → 4.3.2 change? No 4.0–4.2 dump was found.
10. Nothing newer than 4.10.2 exists in either tracker as of 2026-11-06. Rerun `verify-sc/scripts/parse.js`
    + `diff.js` (or the draft's `sc-scripts/`) on the next patch.
11. Nothing here was run in the game. All values come from the game's data files.
