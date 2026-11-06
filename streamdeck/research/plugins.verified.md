# Comms-page plugins as they appear inside Stream Deck profiles (verified)

Fact-checked version of `plugins.md` (kept unchanged next to this file). Topic: the official and
third-party plugins a Comms page would use (Discord, audio, OBS, Twitch, Spotify, Hue,
clocks/timers, Camera Hub, ...), with exact plugin UUIDs, action UUIDs and `Settings` JSON as stored
in profile manifests, and what Stream Deck does when a profile uses a plugin that isn't installed.
Checked 2026-11-06.

Companion notes in this folder: `sdk.md`, `devices.md`, `profiles.md`, `iconpacks.md`,
`navigation.md`. Built-in action details (Multimedia, Hotkey, Website, page/folder keys) belong to
`navigation.md` / `profiles.md`; this file only repeats what a Comms page needs.

Raw evidence I fetched is under `verify-plugins/` in this folder: Marketplace pages and API
answers (`mp/`, `api/`), help-centre articles as JSON and text (`help/`), plugin manifests, PI
scripts and state images (`gh/`), and the help article's screenshots (`img/`).

---

## Changes from the first draft

### Wrong in the first draft (fixed below)

1. **Fred Emmott Audio Mute, state order inverted.** State **0 is muted** (image `mic-off`) and
   state **1 is live** (`mic-on`). The source says `SetState(isMuted ? 0 : 1)`
   (`fredemmott/StreamDeck-AudioMute` `Sources/ToggleMuteAction.cpp`), and the manifest's
   `States` are `["mic-off","mic-on"]` (`sdPlugin/manifest.in.json`). The draft's template put
   "MIC" first and "MIC OFF" second, so it showed the opposite of the truth. This is the
   **opposite of Discord**, where state 0 is unmuted. Fixed in §7.
2. **The "real OBS 3.0.3.31 export" was written by a script.** `Linedev-Web/OBS` builds its OBS
   pages with its own `streamdeck/generer.mjs`. That script hard-codes
   `{Name:'OBS Studio', UUID:'com.elgato.obsstudio', Version:'3.0.3.31'}`, the settings
   (`{isInMultiAction:false}`, `{isInMultiAction:false, longpress:true}`,
   `{scene, target:'program'}`, `{source, type:'mute', mode:'toggle', isInMultiAction:false}`) and
   the number of images per key. So those keys are not evidence of what Stream Deck writes.
   - The claim "Replay Buffer Save has 1 state in 3.0.3.31" was only that script giving it one
     image. It is **withdrawn**: the plugin manifest declares **2** states.
   - `longpress` on Stream is now confirmed from the plugin's own source instead (§8).
   - Record `{"isInMultiAction": false}` and the Scene, Source, Filter and Audio Mixer setting
     shapes are confirmed by a second, app-made source (`bro69noscope/streamdeck-version-control`).
   - The Linedev **Default page** (Multimedia, Weather) and its **Voicemod page** are app-made
     and remain valid evidence.
3. **OBS state meaning wasn't stated, and it's counter-intuitive.** `EActionStateOn = 0`,
   `EActionStateOff = 1` (OBS plugin 2.2.4 `source/actions/iaction.js`). For Record, Stream,
   Replay Buffer, Virtual Camera and Studio Mode, **state 0 means active** (recording, live,
   connected and on), and **state 1 means idle or disconnected**. The manifest's state names
   "Start" (0) / "Stop" (1) are misleading. Generated OBS keys need their live art in `States[0]`,
   their idle art in `States[1]`, and an initial `"State": 1`.
4. **Streamlabs is not an Elgato plugin.** `com.elgato.streamlabs` redirects to the "Streamlabs"
   listing, which is owned by the **Streamlabs** organisation; its last version is 1.5.1
   (2023-01-13). It is removed from the Elgato-maintained list.
5. **The Elgato-maintained list was incomplete.** The Marketplace API lists **23** plugins for
   Elgato's organisation (§15). Added: Zoom, Slack, Philips Hue Sync, ChatGPT & Codex, Window
   Mover, Wave Cast, Elgato Studio, PowerPoint, Adobe Photoshop, Cam Link Pro. YouTube is now
   3.0.2.7 (2026-10-22, min SD 7.1).
6. **Release dates and quotes.**
   - 6.9 was released **6 May 2025**, not April (the beta was April).
   - 7.5.0 was released **30 June 2026**, not July.
   - The 6.9 sentence about being prompted to install plugins sits under "Importing profiles from
     Marketplace?".
   - "You can skip this step and come back to it later… actions will stay in place but won't work
     until the plugin is installed" is from the **6.9 beta changelog**, not the 6.9 release notes.
7. **Volume Controller citation.**
   - The dial example is `FE101857-…/manifest.json.tmpl`, a chezmoi template. Both dials there
     use `"volumeStep":"3"`.
   - The `"volumeStep":"5"` Input Device Control is on a **Keypad key** on page `F16C597E-…`. So
     Input/Output Device Control also works on keys, with the same settings shape.
   - The non-empty `friendlyName` (a device's name) was on a dial on F16C, and `deviceId` was still
     `"default"` there.
8. **Control Center action UUIDs.** They are now taken from the plugin's own 1.9.3.274 manifest
   (§6). `com.elgato.controlcenter.toggle` (Graham42) is **wrong**. The real list is
   `lights-on-off`, `brightness-slider`, `brightness-stepper`, `temperature-slider`,
   `temperature-stepper`, `color-picker`, `battery` and `scene`.
9. **`RequiredPlugins` order.** "In order of first appearance" can't be verified (my traversal gave
   a different order). Only **set equality** is confirmed, in both samples.
   - The 7.4.0 sample (home-ops) also contains actions with **no** `Plugin` block. Its
     `RequiredPlugins` still matched the set of blocks present.
   - Write a `Plugin` block on every action anyway.
10. **Discord Voice Channel / Text Channel** don't set `DisableAutomaticStates`, so it defaults to
    false. The draft table implied every Discord action had automatic states turned off.

### Resolved or upgraded

11. **What a "?" (missing plugin) key looks like** is now answered by Elgato's own screenshots in
    the help article, updated 2026-10-19 (`verify-plugins/img/`).
    - The key shows a white **"?" glyph on black, with the action's text over it**.
    - The text shown ("On / Off", "Set Brightness", "Adjust Brightness", "Set Temperature",
      "Adjust Temperature", "Set Color", "Battery") is exactly Control Center's action `Name`s.
    - **Custom key art is not shown.**
    - The property inspector says *"You're missing a plugin for this action"* with a **Check now**
      button.
    - The "?" next to the bell/Marketplace icons opens **"Install missing plugins — One or more
      actions require the following plugin: Control Center — Ready to install — [Install all]
      [Not now]"**.
    - Still unconfirmed: whether a custom `States[].Title` replaces the `Name` text.
12. **Custom images on plugin keys.** Elgato SDK docs, "Display Precedence": *"User defined titles
    and/or images"* > *"set at runtime using setTitle/setImage"* > *"defined within the
    manifest"*, and *"The image can only be set by the plugin when the user has not specified a
    custom image."*
    - So images we write into `States[].Image` win over the plugin's own art.
    - The plugin still drives the state index (`setState`), so per-state art works.
    - Downside: custom art hides plugin-drawn live content (Discord's dynamic voice-channel and
      volume icons, OBS and Volume Controller meters).
    - Confidence: High for the rule. Medium that imported-profile images count as "user defined";
      they're stored the same way.
13. **Discord Mute: state 0 = unmuted** is confirmed by the plugin's own art. `mute_0.svg` is
    `<g id="unmuted">`; `mute_1.svg` is `<g id="muted">` with a red slash (`#f44841`).
14. **Multimedia `actionIdx`** is settled in `navigation.md` §6.3, and I re-checked it against the
    help article, updated 2026-11-06: 0 Previous, 1 Play/Pause, 2 Next, 3 Stop, 4 Mute, 5 Volume
    Up, 6 Volume Down.
15. **Discord keyboard shortcuts** are confirmed from Discord's support centre (§16).
    - Defaults are Ctrl+Shift+M (mute) and Ctrl+Shift+D (deafen); ⌘ replaces Ctrl on Mac. They are
      "only available for the browser and desktop version".
    - Custom keybinds (desktop only) are: Push to Talk, Push to Mute, Toggle Mute, Toggle Deafen,
      Toggle VAD, Toggle Streamer Mode, Toggle Overlay, Toggle Overlay Lock.
    - Discord's experimental "System Helper" exists because games running elevated can stop Discord
      keybinds from registering.
    - Stream Deck **7.6.1** (3 Nov 2026): *"Reworked hotkey handling so hotkeys work again in
      applications running with administrator privileges, including many fullscreen games."*
16. **Discord Notifications** has no settings in the 2.0.3 property inspector (`notificationsPI.js`:
    *"Temporarily(?) disable configuration"*, then `return`). So `Settings: {}` is portable.
    Medium, since 2.4 may differ.
17. **Elgato Spotify:** 7.6 notes (22 Sep 2026): *"All of the new actions built on Spotify's Web API
    require signing in with a Spotify Premium account."*
18. **The `apps.elgato.com/plugins/<uuid>` 404 doesn't mean a UUID is wrong.** Real, in-use UUIDs
    also answer 404: `com.elgato.slack` (real export) and `com.elgato.weather` (real export). So
    the Wave Link 3 `com.elgato.wave-link` 404 tells us nothing. It stays Medium.
19. **Encrypted manifests are real but not universal.** An open-source decrypter exists
    (`FroggMaster/Elgato-Plugin-Decrypter`: "Decrypts Elgato Stream Deck plugin packages … and
    their encrypted `manifest.json` files"). But one macOS 7.5.0 user quotes a readable
    Volume Controller `manifest.json` (contents elided; `brahle/stream-deck-agents`).
20. **Discord RPC quote verified and extended:** *"When an app that has previously set voice
    settings connects, the client will swap to that app's configured voice settings and lock voice
    settings again."*
21. **New settings and action details:**
    - Discord User Volume dial settings are `user`, `usernick`, `user_mode` (`"specific"`/`"any"`)
      and `volume`.
    - Discord Volume Control key `volAdjustValue` ranges −25…24.
    - Clocks 0.9.2.38 actions are `com.elgato.clocks.action` ("Dynamic Clocks") and
      `com.elgato.worldclock.action` (different prefix).
    - The OBS Audio Mixer has more real settings: `step`, `style`, `type: "set"`, `volume`.

### Downgraded

22. **Digital Time settings** drop from High to **Medium**: the `threaddeck-for-codex` source is a
    "partly hand-made" profile (per `navigation.md`).
23. **Discord Video Toggle / Stream Toggle UUIDs** drop to **Low-Medium**.
    - The actions certainly exist (they're in the Marketplace description).
    - But `deckforge` is an AI-made clone, and it gives every action 2 states and Multi Action
      support, which contradicts the real 2.0.3 manifest.
    - `brunofgmag` only maps `streamtoggle`, in a converter.
24. **Timer `duration`:** probably **seconds**. Elgato's own default profile uses 1500, which is
    25 min, a Pomodoro. This is inference only.

---

## How to read this

**Confidence**

- **High:** an Elgato primary source (help.elgato.com, marketplace.elgato.com and its API,
  docs.elgato.com, elgatosf), or the plugin's own manifest, source or PI, with nothing against it.
- **Medium:** one real, app-made source, or an inference from two primary facts.
- **Low:** third-party docs, tests, clones or script-written profiles only.
- **Unconfirmed:** don't generate it.

**Method**

- **Plugin UUID → listing:** `https://apps.elgato.com/plugins/<pluginUUID>` returns `301` to the
  listing for plugins Elgato's old store knew. A `404` is **not** evidence of a wrong UUID (see
  change 18).
- **Versions:** each Marketplace product page embeds its full history (`version_number`,
  `publish_date`, `min_app_version`, `os_versions`, release notes). The public API returns the
  same data: `https://mp-gateway.elgato.com/products/<productId>` and
  `https://mp-gateway.elgato.com/products?organization_id=<org>&extension=plugins`. Neither
  exposes plugin UUIDs.
- **Help articles:** fetched through the Zendesk API
  (`https://help.elgato.com/api/v2/help_center/en-us/articles/<id>.json`). Discord's support
  centre was fetched the same way (`support.discord.com/api/v2/...`).
- **Plugin files:** plain copies of older plugin folders committed to GitHub dotfiles. Discord
  2.0.3 and Control Center 1.9.3.274 come from `Qu3ntinS/dotfiles` and `joshmedeski/dotfiles`; OBS
  2.2.4 and Clocks 0.9.2.38 come from `joshmedeski/dotfiles`. Their manifests, property-inspector
  JS, `en.json` and state images were all read. Current packages can't be downloaded without
  signing in (the Marketplace download answers 401 to anonymous requests, per `deckforge`
  `docs/MARKETPLACE.md`).
- **Privacy:** quotes are trimmed. City names, device names, IDs and paths from the sources are
  left out.

---

## 0. TL;DR for the generator

1. **Every action gets a `Plugin` block** `{"Name","UUID","Version"}` next to its action `UUID`.
   The export's `package.json` `RequiredPlugins` must be the **set** of those `Plugin.UUID`s;
   build it from the same data. (Medium-High: two real 7.x samples match as sets.)
2. **A missing plugin doesn't break the profile.**
   - The key shows **"?" with the action's `Name` text**, and custom art is hidden.
   - The settings are kept.
   - Pressing the key, using "Check now", or using the top-bar "?" offers to install the plugin
     (§2).
   - So **give every plugin action a short, meaningful `Name`**, because it's the only thing the
     user sees until they install the plugin.
3. **Discord**, `com.elgato.discord` (Elgato, free, current **2.4.0.123**, 2026-09-29, min SD
   **7.1**; 2.3.0.116 for SD 6.9–7.0):
   - **Mute** `com.elgato.discord.mute` and **Deafen** `com.elgato.discord.deafen` take
     `Settings: {}` and have 2 states. **State 0 = unmuted / undeafened, state 1 = muted /
     deafened.**
   - **Push to Talk** `com.elgato.discord.pushto.talk` and **Push to Mute**
     `com.elgato.discord.pushto.mute` have 2 states, no settings, and are **not allowed inside
     Multi Actions**.
   - **Voice Input Mode Toggle** `com.elgato.discord.pushtotalktoggle`: state 0 Voice Activity,
     state 1 Push to Talk.
   - **Notifications** `com.elgato.discord.notifications` takes `{}` (Medium).
   - Needs the Discord **desktop** app running and a one-time **Authorize** in Discord (§3).
4. **Our own art wins over the plugin's art** (SDK display precedence). So we can theme Discord,
   OBS and Audio Mute keys per vendor. The plugin still flips the state.
5. **Don't pre-fill anything user-specific:** Discord server/channel/user/sound IDs, Twitch
   `accountId`, OBS scene/source/filter names, audio device IDs, Hue/Control Center device IDs,
   Spotify devices, Weather location. Portable with empty or fixed settings:
   - Discord: Mute, Deafen, PTT, PTM, Voice Input Mode Toggle, Notifications.
   - OBS: Record, Stream (`longpress` optional), Replay Buffer, Replay Buffer Save, Virtual
     Camera, Studio Mode, Screenshot (state rule in §8).
   - Volume Controller: Input/Output Device Control with `"deviceId":"default"`, on a key or a dial.
   - Fred Emmott Audio Mute: Toggle with `{}`, which picks the Windows communications mic, or else
     the default mic. **State 0 = muted.**
   - Voicemod: Mute Mic On/Off, Mute Sounds for Me, Stop All Sounds, with `{}`.
   - Built-ins: Multimedia (`actionIdx`), Digital Time, Timer.
6. **A Comms page with no plugins** is possible with built-ins (§16):
   - Multimedia for system volume/mute and media keys.
   - Digital Time and Timer.
   - **Hotkey** keys for Discord keybinds. They default to Ctrl+Shift+M / Ctrl+Shift+D, which only
     work while Discord is focused. **Global** use needs a custom keybind the user sets in Discord,
     on a combo Star Citizen doesn't use.
   - Only plugins (Discord, Audio Mute, Voicemod) show the real mute **state**.
7. **Elgato-maintained in 2026:** 23 plugins (§15), all one-click from the in-app Marketplace once
   the user is signed in (7.1+). **No content plugin is bundled.** Volume Controller stopped being
   bundled in 7.1.

---

## 1. How a plugin action is stored in a profile

### 1.1 Shape (Stream Deck 6.9+/7.x, profile `Version: "3.0"`)

This is an app-made Voicemod key from a 7.x profile (`Linedev-Web/OBS`
`sauvegarde/streamdeck/ProfilesV3/303D8BA9-….sdProfile/Profiles/98C29EC2-…/manifest.json`; the
Voicemod page is user-made, not script-made). Images are trimmed.

```json
{
  "ActionID": "<uuid>",
  "LinkedTitle": true,
  "Name": "Mute Mic On/Off",
  "Plugin": { "Name": "Voicemod", "UUID": "net.voicemod.windowsdesktop", "Version": "6.0.8" },
  "Resources": null,
  "Settings": {},
  "State": 0,
  "States": [ { "Image": "" }, { "Image": "" } ],
  "UUID": "net.voicemod.windowsdesktop.muteswitch"
}
```

The same page's back key carries the built-in block
`{"Name":"Open Parent Folder","UUID":"com.elgato.streamdeck.profile.backtoparent","Version":"1.0"}`.

- `UUID` is the **action** UUID (the plugin manifest's `Actions[].UUID`). `Plugin.UUID` is the
  **plugin** UUID. The action UUID doesn't always start with the plugin UUID, for example:
  - `com.barraider.spotifyplaypause` (plugin `com.barraider.spotify`);
  - `com.nicollasr.streamdeckvsc.executecommand` (plugin `com.nicollasr.streamdeckvsc.mac`);
  - `com.elgato.worldclock.action` (plugin `com.elgato.clocks`).

  (High: real exports and manifests.)
- `States` should have as many entries as the manifest declares for that action. (High.)
- `Settings` is the plugin's own JSON. `isInMultiAction` is added at runtime by the app or the
  property inspector, and can be left out. (Medium.)
- Older ProfilesV2 exports (≤6.8) have no `Plugin` block. Elgato says the 6.9 install prompt "works
  with profiles created using Stream Deck 6.9 or later". (Medium inference that the block is what
  makes this work.)

### 1.2 `RequiredPlugins` in the export package

From a real 7.3.1 export (`profiles-x/heir/package.json`, from the parallel researcher):

```json
{"AppVersion":"7.3.1.22604","DeviceModel":"20GBA9901","DeviceSettings":null,"FormatVersion":1,
 "OSType":"Windows","OSVersion":"10.0.26200",
 "RequiredPlugins":["com.elgato.streamdeck.page","com.elgato.streamdeck.profile.backtoparent",
  "com.elgato.streamdeck.profile.openchild","com.elgato.streamdeck.profile.rotate",
  "com.elgato.streamdeck.multiactions","com.elgato.streamdeck.system.text"]}
```

- In this sample and in a 7.4.0 one (home-ops), `RequiredPlugins` **as a set** equals the set of
  `Plugin.UUID`s in every page manifest, including actions nested in Multi Actions. I checked this
  myself with `verify-plugins-scripts/rp.py`. The order matches neither page nor position order, so
  it's **unknown**. (Medium-High for the set.)
- The 7.4.0 sample also has some actions with no `Plugin` block (they were written by a script and
  then re-exported by the app).

**Generator rule:** derive `RequiredPlugins` from your own `Plugin` blocks; order doesn't matter as
far as anyone can tell.

### 1.3 `Plugin.Version`

Stream Deck 7.5.0 (30 Jun 2026): *"When importing a profile, Stream Deck now clearly distinguishes
when a required plugin version isn't available on Marketplace — rather than showing a generic error
message."*
([7.5.0 notes](https://help.elgato.com/hc/en-us/articles/48328697898897), High.)

- **Use a version that is published on Marketplace.**
- Every old version I looked at still has `"status":"published"` in the version history. That
  includes Discord 1 (2022) through 2.4.0.123. So a version that is current at build time should
  stay valid. (Medium.)
- Unconfirmed: what is installed when the profile names an older version (that one or the
  latest), and what happens for a plugin that isn't on Marketplace at all.

### 1.4 Plugin manifests on disk may be encrypted

- Some Elgato and BarRaider packages ship a `manifest.json` that starts with `ELGATO` and is
  encrypted (`feletoch/Dock-Bridge` `engine/plugins.py`: "closed source, encrypted manifest only").
- A public decrypter exists (`FroggMaster/Elgato-Plugin-Decrypter`; it pulls keys from
  `StreamDeck.exe` at runtime).
- Not universal: a macOS 7.5.0 user quotes a readable Volume Controller manifest
  (`$schema`, `"SDKVersion": 2`, `"CodePath": "bin/plugin.js"`, `"Nodejs": {"Version": "20"}`,
  `"Software": {"MinimumVersion": "6.6"}`; action list elided) in `brahle/stream-deck-agents`
  `docs/plans/stream-deck-agents.md`.
- So current action lists come only from old plain copies or from real profiles. (Medium.)

---

## 2. What Stream Deck does when a plugin isn't installed

All High: Elgato help centre and release notes, fetched through the API.

| Version | Behaviour | Source |
|---|---|---|
| any (current) | *"When Stream Deck keys are configured with an action and the plugin from which those actions came from is uninstalled or otherwise not found, those keys will display a question mark icon. This can occur when moving a Stream Deck profile from one computer to another."* Fixes: install from Marketplace; *"Press the key showing the '?'"*; *"Click a key with the '?' and then click 'Check Now'"*; *"Click the '?' located at the top of the software to perform a mass install or select specific ones"* | [Question mark icon on keys](https://help.elgato.com/hc/en-us/articles/360056747291) (updated 2026-10-19) |
| (screenshots in that article, Stream Deck Neo, 7.x) | The "?" key is a white "?" on black with the action `Name` overlaid ("On / Off", "Set Brightness", ...), with **no custom art**. The PI shows *"You're missing a plugin for this action"* and **Check now**. The dialog shows *"Install missing plugins — One or more actions require the following plugin"*, lists the plugin by name, then **Install all** / **Not now** | same article, images saved in `verify-plugins/img/` |
| 6.9 beta (Apr 2025) | *"When importing a profile or action that uses plugins you don't have, Stream Deck now helps you download them directly from the app. This works with profiles created using Stream Deck 6.9 or later. Just click the Question Mark icon near the Marketplace button. You'll be prompted to log in… You can skip this step and come back to it later—actions will stay in place but won't work until the plugin is installed."* Streamlabs: *"they'll show a Question Mark icon at first… your existing settings will carry over."* | [6.9 beta changelog](https://help.elgato.com/hc/en-us/articles/34177552106385) |
| 6.9 (6 May 2025) | Under "Importing profiles from Marketplace?": *"If a profile uses actions from plugins you don't have, you'll be prompted to install them automatically… Note: This only applies to profiles created with Stream Deck 6.9 or later."* Streamlabs actions *"may show a ❓ until you install the new plugin… your settings will be preserved."* | [6.9 notes](https://help.elgato.com/hc/en-us/articles/34904105205777) |
| 7.0 (12 Aug 2025) | (as recapped in 7.1) *"profiles now tell you which plugins you'll need when importing a profile, and you can install them with one click."* | [7.1 notes](https://help.elgato.com/hc/en-us/articles/41533810232721) |
| 7.0.1 (23 Sep 2025) | *"When pressing an action where the plugin is missing (❓ icon), Stream Deck software will now prompt you to download the plugin from Marketplace."* | [7.0.1 notes](https://help.elgato.com/hc/en-us/articles/39330355624977) |
| 7.1 (3 Dec 2025) | *"Once you're signed in with your Marketplace account, installing plugins takes just one click."* *"The Volume Controller plugin is no longer bundled by default. When setting up Stream Deck for the first time, the default profile will notify that the plugin is missing, and you can optionally install it, or not."* | [7.1 notes](https://help.elgato.com/hc/en-us/articles/41533810232721) |
| 7.3.0 (3 Mar 2026) | *"Fixed an issue where installing plugins via in-app search or the missing plugins dialog failed on the first attempt."* | [7.3.0 notes](https://help.elgato.com/hc/en-us/articles/44411141578001) |
| 7.5.0 (30 Jun 2026) | The import distinguishes a required plugin **version** that isn't on Marketplace | [7.5.0 notes](https://help.elgato.com/hc/en-us/articles/48328697898897) |
| Action Sharing (6.8+) | *"If a plugin is missing for an action you just installed, a question mark (?) icon will appear on that action."* | [Action Sharing](https://help.elgato.com/hc/en-us/articles/29655138607505) |

Also:

- Installing and auto-updating plugins needs a **signed-in Marketplace account**.
  ([Updating plugins](https://help.elgato.com/hc/en-us/articles/360050819312), High)
- Elgato's profile guidelines: *"Plugins used within a Profile are not transferred when the profile
  is shared. Users will need to download any required plugins separately… if a plugin changes
  price, becomes deprecated, or is unpublished, it will affect users of that profile."*
  (docs.elgato.com, saved in `dl/docs/profiles-gs.txt`, High)

**Still not confirmed**

- Whether a custom `States[].Title` replaces the `Name` on a "?" key. The screenshot text equals
  the `Name`s, which suggests `Name` is used, but the titles in that demo may have been empty.
- What the import says, and whether it completes, for a plugin that **isn't on Marketplace** (our
  own plugin, sideloaded).

**Generator rules that follow**

- Core navigation never depends on a plugin; page, folder and profile keys are built-ins.
- Give every plugin action a meaningful short `Name` ("Discord Mute", "OBS Record"), and set the
  same text as `States[].Title`.
- For our own plugin: either keep its keys out of the built-ins-only pack, or **bundle the
  plugin-variant profiles inside our plugin** (manifest `Profiles[]`, `AutoInstall`). Elgato's SDK
  guide says users are "prompted to install bundled Stream Deck profiles when the plugin is first
  installed" (`dl/docs/sdk-guides-profiles.txt`, High). That avoids the Marketplace lookup entirely.

---

## 3. Elgato Discord plugin, `com.elgato.discord`

### 3.1 Identity and status

| Field | Value | Conf. |
|---|---|---|
| Plugin UUID | `com.elgato.discord` | High (redirect → [listing](https://marketplace.elgato.com/product/discord-e3559f36-d31d-4529-ab1f-739955e2ac7a); manifest) |
| `Plugin` block | `{"Name": "Discord", "UUID": "com.elgato.discord", "Version": "2.4.0.123"}` | High (manifest `"Name": "Discord"`; current published version) |
| Maker / price | Elgato (org "Elgato"), free | High (API `is_free: true`) |
| OS | macOS 10.15+, Windows 10+ | High |
| Needs | Discord **desktop** app running; one-time authorization; SD **7.1+** for 2.4.0.123, **6.9+** for 2.1.1.79–2.3.0.116 | High |

Version history (from the Marketplace data, re-pulled):

| Version | Published | Min SD | Notes (quoted, trimmed) |
|---|---|---|---|
| **2.4.0.123** | 2026-09-29 | **7.1** | "Fixed an issue on macOS that caused authentication failures when connecting to user accounts linked to a large number of servers." |
| 2.3.0.116 | 2026-08-05 | 6.9 | "Fixed an issue where Discord authorization would be occasionally lost for some users. When switching accounts in Discord, updates on Stream Deck keys happen quicker." |
| 2.2.0.98 | 2026-03-17 | 6.9 | "Fixed an issue on macOS where some users would occasionally be logged out during plugin start-up." |
| 2.2.0.84 | 2025-09-30 | 6.9 | "Updated icons to match Discord blurple - shiny! Added information prompt for actions that require a voice channel" |
| 2.1.1.79 | 2025-06-04 | 6.9 | "Improved authentication reliability for macOS users. Fixed user volume control not working after re-authenticating. Fixed volume display to match Discord." |
| 2.1.0.73 | 2024-12-06 | 6.1 | "Removed the Read Messages permission requirement from all actions, except for the Server Stats action" |
| 2.1.0.62 | 2024-10-24 | 6.1 | (notes not captured; the listing names Video Toggle and Stream Toggle among its actions) |
| 2.0.3 | 2024-04-01 | 6.1 | "Fixed an issue where Discord was not authorizing Stream Deck." |
| 2 | 2023-05-24 | 6.1 | New: Soundboard, Set Audio Device, Server Stats, Voice Input Mode toggle |

- The Marketplace description (current) lists Mute, Deafen, Voice Channel, Text Channel, Push to
  Talk, Push to Mute, **Video Toggle**, **Stream Toggle**, and says "15 powerful actions". (High
  that they exist.)
- 2025–26: only authorization and reliability fixes, the icon refresh and the 7.1 minimum. Stream
  Deck **7.3.1** (6 Mar 2026): *"Fixed an issue where some plugins, like Discord, were not working
  correctly. Fixed an issue where starting Discord via the Open Application action did not work."*
  I found no Discord-side change that broke the plugin. (High for the notes; Medium for "nothing
  broke".)

### 3.2 Authorization and Discord limits

- **First use and lost access** ([Discord Plugin Setup](https://help.elgato.com/hc/en-us/articles/4422740578189),
  updated 2026-11-04, High):
  - *"drag any action to a blank key… press it, and a Discord Authorization message will pop up.
    Click on 'Authorize.'"*
  - *"Note actions have a rate limit. This means spamming actions can cause them to become
    unresponsive."*
  - *"Drag any action to a key and if a 'Request Access' button appears, click it."*
- **Property inspector messages** (2.0.3 `en.json`, High): `AppWarning` "Please launch Discord",
  `AuthWarning` "Discord authorization required", `AccessButton` "Request access". The button sends
  `{"grantAccess": true}` to the plugin (`inspectors/pi.js`).
- **Discord RPC rules** ([docs.discord.com/developers/topics/rpc](https://docs.discord.com/developers/topics/rpc),
  High):
  - *"In the current release, we only support a single modifier of voice settings at a time over
    RPC. If an app changes voice settings, it will lock voice settings so that other apps connected
    simultaneously lose the ability to change voice settings. Settings reset to what they were
    before being changed after the controlling app disconnects. When an app that has previously set
    voice settings connects, the client will swap to that app's configured voice settings and lock
    voice settings again."*
  - Effects (Medium): another RPC mute tool can conflict, and a mute set from Stream Deck can undo
    itself when Stream Deck quits.

### 3.3 Actions (from the plugin's own 2.0.3 manifest, PI scripts and `en.json`)

Source: `Qu3ntinS/dotfiles` `opendeck/.config/opendeck/plugins/com.elgato.discord.sdPlugin/`
(`manifest.json`, `en.json`, `inspectors/*.js`, `images/actions/*.svg`). Manifest header:
`"Author":"Elgato"`, `"Version":"2.0.3"`, `"Software":{"MinimumVersion":"6.1"}`, `"SDKVersion":2`.

- "Multi" is `SupportedInMultiActions`; missing means true.
- "Auto-states off" is `DisableAutomaticStates: true`.
- Controllers default to Keypad unless shown otherwise.
- Settings keys come from the property-inspector JS. The base PI also re-saves settings 1 s after
  opening.

All action UUIDs are High for 2.0.3. The current package is encrypted, so they are **Medium for
2.4.0.123**, because no later rename is known.

| Action UUID | Name | States (index: name / image) | Multi | Auto-states off | Settings keys |
|---|---|---|---|---|---|
| `com.elgato.discord.mute` | Mute | 0 "Mute" `mute_0` (**unmuted** art), 1 "Unmute" `mute_1` (**muted** art) | yes | yes | none: `{}` |
| `com.elgato.discord.deafen` | Deafen | 0 "Deafen" `deafen_0`, 1 "Undeafen" `deafen_1` | yes | yes | none: `{}` |
| `com.elgato.discord.pushto.talk` | Push to Talk | 2 (`pushtotalk_0/1`) | **no** | yes | none |
| `com.elgato.discord.pushto.mute` | Push to Mute | 2 (`pushtomute_0/1`) | **no** | yes | none |
| `com.elgato.discord.pushtotalktoggle` | Voice Input Mode Toggle | 0 "Voice Activity", 1 "Push to Talk" | yes | yes | none |
| `com.elgato.discord.channel.voice` | Voice Channel | 0 "Enter", 1 "Leave" | yes | **no** (automatic) | `server`, `serverName`, `channel`, `icon` (`"static"`/`"dynamic"`) |
| `com.elgato.discord.channel.text` | Text Channel | 1 "Enter" | yes | no | `server`, `serverName`, `channel` |
| `com.elgato.discord.setaudiodevice` | Set Audio Device | 2 | yes | yes | `mode` (`"input"`/`"output"`/`"both"`), `input`, `inputname`, `output`, `outputname` |
| `com.elgato.discord.soundboard` | Soundboard | 1 | yes | yes | `sound_id`, `guild_id`, `sound_name`, `emoji_path` |
| `com.elgato.discord.serverstats` | Server Stats | 1 | **no** | yes | `server`, `serverName`, `select-messages` (`"nothing"`/`"display"`), `select-users` (`"nothing"`/`"online"`/`"active"`), `select-press`, `select-longpress` (`"nothing"`/`"open"`/`"clear"`) |
| `com.elgato.discord.notifications` | Notifications | 1 | **no** | yes | **none** (the PI's configuration is disabled in 2.0.3), so `{}` |
| `com.elgato.discord.volumecontrolbutton` | Volume Control (key) | 1 | yes | yes | `device` (`"input"`/`"output"`), `mode` (`"adjust"`/`"set"`), `volAdjustValue` (int −25…24), `volSetValue` (int), `icon` (`"static"`/`"dynamic_h"`/`"dynamic_v"`) |
| `com.elgato.discord.volumecontrol` | Volume Control (**dial**, `["Encoder"]`) | 1 | no | — | `device`, `volValue`; Rotate "Adjust Volume", Push/Touch "Mute/Deafen" |
| `com.elgato.discord.uservolumecontrolbutton` | User Volume Control (key) | 1 | yes | yes | `user`, `usernick`, `mode` (`"mute"`/`"adjust"`/`"set"`), `muteType` (`"toggle"`/`"mute"`/`"unmute"`), `icon`, `volAdjustValue`, `volSetValue` |
| `com.elgato.discord.uservolumecontroldial` | User Volume Control (**dial**) | 1 | no | — | `user`, `usernick`, `user_mode` (`"specific"`/`"any"`), `volume`; Rotate "Adjust Volume", Push "Next User", Touch "Mute" |
| `com.elgato.discord.videotoggle` | Video Toggle (2.1+) | ? | ? | ? | **Low-Medium** UUID (`deckforge` clone only) |
| `com.elgato.discord.streamtoggle` | Stream Toggle (2.1+) | ? | ? | ? | **Low-Medium** UUID (`deckforge`; `brunofgmag` converter) |

**Wrong UUIDs that circulate:** `com.elgato.discord.pushtotalk`, `.pushtomute`, `.voicechannel` and
`.textchannel` (`tuxcast` docs, FreeStream). The manifest has `pushto.talk`, `pushto.mute`,
`channel.voice` and `channel.text`.

### 3.4 Templates

Mute (portable). State 0 is live and state 1 is muted, matching the plugin's own art:

```json
{
  "ActionID": "<uuid-v4>",
  "LinkedTitle": true,
  "Name": "Discord Mute",
  "Plugin": { "Name": "Discord", "UUID": "com.elgato.discord", "Version": "2.4.0.123" },
  "Resources": null,
  "Settings": {},
  "State": 0,
  "States": [
    { "Image": "Images/<mic-live>.png",  "Title": "MIC" },
    { "Image": "Images/<mic-muted>.png", "Title": "MUTED" }
  ],
  "UUID": "com.elgato.discord.mute"
}
```

- `Name`: the draft used the manifest name "Mute". Any string is accepted there (real exports
  carry custom names, e.g. home-ops). A clear name helps on "?" keys. (Medium: `Name` is not
  validated against the manifest as far as any sample shows.)
- **Deafen:** the same shape with `"UUID": "com.elgato.discord.deafen"`; state 0 live, state 1
  deafened.
- **Push to Talk:** `"UUID": "com.elgato.discord.pushto.talk"`, 2 `States`, `Settings: {}`, and
  never inside a Multi Action.
- **Notifications:** `"UUID": "com.elgato.discord.notifications"`, 1 state, `Settings: {}`
  (Medium).
- Because auto-states are off, the plugin sets the state from Discord's real state. Our images are
  "user defined", so they win over plugin art (SDK display precedence, §0.4); `setState` still
  picks which of our two images shows. (High for the rule; Medium in practice, not tried on a
  real PC.)
- Voice Channel, Text Channel, Soundboard, Server Stats, Set Audio Device, and user volume: leave
  them **out** or `{}`, so the user picks; generated values would be someone else's IDs.

---

## 4. Elgato Volume Controller, `com.elgato.volume-controller`

| Field | Value | Conf. |
|---|---|---|
| Plugin UUID | `com.elgato.volume-controller` | High (redirect; real exports) |
| `Plugin` block (real) | `{"Name": "Volume Controller", "UUID": "com.elgato.volume-controller", "Version": "2.0.1.155"}` (zalewski export) | High |
| Current | **2.0.5.201**, 2026-10-22, min SD **7.1**, Win 10 / macOS 10.15, Elgato, free ([listing](https://marketplace.elgato.com/product/volume-controller-34d9aa59-a41a-4a4c-a853-202ca91409e1)). 2.0.4.196 (2026-08-11) and 2.0.3.187 (2026-06-25) need min 6.9 | High |
| Bundled? | **No, since 7.1** (quote in §2) | High |
| Description | "Profile: Create a profile using current apps / App / Input / Output … *App control only supported on Windows at this time*" | High |

Help ([Volume Controller Plugin](https://help.elgato.com/hc/en-us/articles/10568396413965), updated
2026-11-05): *"Auto Detection: Generates a dynamic profile with your currently running apps… Manual
Detection: Control specific applications, toggle mute, or adjust the volume in step sizes… Stream
Deck + … Press the dial or LCD screen to toggle mute."*

| Action UUID | What | Seen on | Settings (real) | Conf. |
|---|---|---|---|---|
| `com.elgato.volume-controller.input-device-control` | mic/input volume and mute | **Keypad** and Encoder | `{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"5"}` (key) / `"volumeStep":"3"` (dial) | High (`zalewskigrzegorz/dotfiles`, pages `F16C597E-…` and `FE101857-…`) |
| `com.elgato.volume-controller.output-device-control` | output volume and mute | Encoder (and keys, by analogy) | `{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"3"}` | High |
| `com.elgato.volume-controller.manual-detection` | one app's volume | Keypad + Encoder | `application` {`executableFile`, `shortName`, `displayName`}, `volumeStep` | Low-Medium (converter code only) |
| Auto Detection / "Profile" | dynamic app profile | Keypad | UUID **unconfirmed** | — |

Real dial, exactly as stored (`FE101857-…/manifest.json.tmpl`, Encoder controller):

```json
{"ActionID":"5be31221-7634-44c4-b11c-2e096134cacb","LinkedTitle":true,"Name":"Output Device Control",
 "Plugin":{"Name":"Volume Controller","UUID":"com.elgato.volume-controller","Version":"2.0.1.155"},
 "Resources":null,
 "Settings":{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"3"},
 "State":0,
 "States":[{"FontFamily":"Comic Sans MS","FontSize":12,"FontStyle":"Bold","FontUnderline":false,
            "OutlineThickness":2,"ShowTitle":true,"TitleAlignment":"bottom","TitleColor":"#ffffff"}],
 "UUID":"com.elgato.volume-controller.output-device-control"}
```

- The numbers are **strings**.
- `"deviceId":"default"` is used even where `friendlyName` names a specific device, so it presumably
  follows the OS default (Medium).
- What a key press does on a Keypad instance (mute toggle?) is **unconfirmed**.
- `Graham42`'s keypad `action` key (`"adjust"`/`"set"`/`"mute"`/…) is Low; not seen in a real export.
- For a generated pack, write `Plugin.Version` as **2.0.5.201**, the current version (published
  2026-10-22).

---

## 5. Wave Link (Elgato): two plugins

| | Legacy (Wave Link 2) | New (Wave Link 3) |
|---|---|---|
| Listing | [Wave Link (Legacy)](https://marketplace.elgato.com/product/wave-link-1baa435a-c623-406d-b53c-53338c6d95d3) | [Wave Link](https://marketplace.elgato.com/product/wave-link-aa41150f-9645-4275-b064-7642ba6a17ae) (product created 2025-11-11) |
| Plugin UUID | `com.elgato.wavelink` (High: redirect) | `com.elgato.wave-link`: **Medium**. The installed folder `com.elgato.wave-link.sdPlugin` was seen on a Mac with SD 7.5.0 (`JonathanRReed/Waves` evidence note). Test fixtures use `{"Name":"Wave Link","UUID":"com.elgato.wave-link"}`. The redirect's 404 tells us nothing (change 18) |
| Status | 2.3.0.120 (2026-03-02): *"This plugin has been archived. - Update name to reflect release of new Wave Link plugin"* | 3.4.0.320 (2026-09-16, min SD 7.1, macOS 13 / Win 10; adds a Soundboard action); 3.0.0.263 (2026-03-03) was the first release; 7.3.0: *"Requires Wave Link 3.0, and is not backwards compatible with Wave Link 2.0"* and *"Add to Stream Deck lets you generate a ready-made Wave Link profile"* |
| Actions | 2.3.0.60 manifest copy (`Nevylish/com.elgato.wavelink.sdPlugin`): `.inputaction`, `.mixermute`, `.setvolumemixer`, `.adjustvolumemixer`, `.outputaction`, `.monitormute`, `.setvolumemonitor`, `.adjustvolumemonitor`, `.switchmonitoring`, `.hardwareaction`, `.setmonitormixoutput`, `.togglemonitormixoutput`, `.setmicsettings`, `.effectaction`, `.seteffect`, `.seteffectchain`, `.switchprofiles` (not re-checked; draft) | Release notes name Channel Level, Channel Audio Effect, Main Output Device toggle, Output Volume, Soundboard. The only UUID seen is `com.elgato.wave-link.wavecontrol` with `{"channelId":"mic"}`, in **test fixtures** (`verygoodplugins/streamdeck-mcp`). **Low; don't generate** |

**Recommendation:** no Wave Link keys in generated profiles; mention Wave Link 3's own "Add to
Stream Deck" in the docs.

---

## 6. Elgato Control Center (Key Light etc.), `com.elgato.controlcenter`

- Plugin UUID `com.elgato.controlcenter` (High: redirect; `Marketplace/mapping.json` maps it to
  ProductID `39a4fa43-…`).
- Current **1.12.1.315** (2026-07-23, min SD 6.9; adds Key Light Air MK.2), Elgato, free.
- Actions from the plugin's own **1.9.3.274** manifest (`joshmedeski/dotfiles`
  `…/Plugins/com.elgato.controlcenter.sdPlugin/manifest.json`; High for 1.9.3, Medium for 1.12):

| Action UUID | Name | States | Controllers |
|---|---|---|---|
| `com.elgato.controlcenter.lights-on-off` | On / Off | 2 | Keypad |
| `com.elgato.controlcenter.brightness-slider` | Set Brightness | 1 | Keypad |
| `com.elgato.controlcenter.brightness-stepper` | Adjust Brightness | 1 | Keypad, Encoder |
| `com.elgato.controlcenter.temperature-slider` | Set Temperature | 1 | Keypad |
| `com.elgato.controlcenter.temperature-stepper` | Adjust Temperature | 1 | Keypad, Encoder |
| `com.elgato.controlcenter.color-picker` | Set Color | 1 | Keypad |
| `com.elgato.controlcenter.battery` | Battery | 1 | Keypad |
| `com.elgato.controlcenter.scene` | Scene | 1 | Keypad, Encoder |

`com.elgato.controlcenter.toggle` (Graham42) does not exist. Settings hold a light's ID
(`deviceID`, `name` per jefftriplett, Low), so **don't generate these**.

---

## 7. Windows audio device switching and system mic mute (Fred Emmott, open source)

| Plugin | UUID | Actions (from the manifest) | Settings | Current | Conf. |
|---|---|---|---|---|---|
| **Audio Mute** | `com.fredemmott.micmutetoggle` (manifest `"Name": "Audio Mute"`) | `com.fredemmott.micmutetoggle.toggle` "Toggle Mute": **state 0 `mic-off` (muted), state 1 `mic-on` (live)**, not in Multi Actions. `.mute` "Mute" (2 states, both `mic-off`, Multi ok). `.unmute` "Unmute" (2 states, both `mic-on`, Multi ok) | `deviceID` (special IDs `com.fredemmott.sdmute.deviceIds.defaultInput` / `.defaultOutput` / `.communicationsInput` / `.communicationsOutput`), `feedbackSounds` (bool, **default true**), `fuzzyMatching` (bool, default false), `toggleKind` (`"ToggleOnly"` / `"TogglePressPttPtmHold"` / `"PttPtmOnly"`), legacy `ptt`. **No `deviceID` → the communications input if Windows reports one, else the default input**, so `{}` is portable | 3.3.0.187, 2024-01-22, min SD 4.1, Win + mac ([listing](https://marketplace.elgato.com/product/audio-mute-705c5433-1e05-4d8a-844f-b5914b7f642f)) | High (`Sources/BaseMuteAction.cpp` `from_json`, `Sources/ToggleMuteAction.cpp`, `sdPlugin/manifest.in.json`) |
| **Audio Switcher** | `com.fredemmott.audiooutputswitch` (manifest `"Name": "Audio Switcher"`) | `com.fredemmott.audiooutputswitch.toggle` "Toggle Audio Device" (2 states, not Multi); `.set` "Set Audio Device" (2 states) | device IDs are per-PC, so **leave unset** (draft's keys `direction`, `role`, `primary`, `secondary`, `matchStrategy` not re-checked) | 3.2.0.90, 2024-01-22, min SD 4.1 | High for UUIDs (`sdPlugin/manifest.json.cmake`) |
| Discord "Set Audio Device" | `com.elgato.discord.setaudiodevice` | changes Discord's own devices, not Windows' | §3.3 | — | High |
| Win Tools (BarRaider) | `com.barraider.wintools` | Windows toolbox | not researched | 2.4.1, 2026-08-07, min SD 7.1, Windows only | High for UUID/version |

Portable system-mic toggle (corrected state order):

```json
{"ActionID":"<uuid-v4>","LinkedTitle":true,"Name":"Mic Mute",
 "Plugin":{"Name":"Audio Mute","UUID":"com.fredemmott.micmutetoggle","Version":"3.3.0.187"},
 "Resources":null,"Settings":{},"State":1,
 "States":[{"Image":"Images/<mic-muted>.png","Title":"MIC OFF"},
           {"Image":"Images/<mic-live>.png","Title":"MIC"}],
 "UUID":"com.fredemmott.micmutetoggle.toggle"}
```

- The plugin sets the real state when the key appears, so the initial `State` matters little.
- Leaving `feedbackSounds` out means it plays a sound on every toggle. Write
  `{"feedbackSounds": false}` if that's unwanted (Medium: it still defaults to the communications
  mic, because `deviceID` is absent).

---

## 8. Elgato OBS Studio plugin, `com.elgato.obsstudio`

- Plugin UUID `com.elgato.obsstudio`. `Plugin` block
  `{"Name": "OBS Studio", "UUID": "com.elgato.obsstudio", "Version": "3.0.3.31"}`. High: seen in
  app-made `bro69noscope` templates. The 2.2.4 manifest also carries
  `"StreamdeckID":"com.elgato.obsstudio"`, `"MpProductID":"35615969-…"` and
  `"Author":"Corsair Memory Inc."`.
- Current **3.0.3.31**, 2026-06-03, min SD **6.9**: *"Reverted to a previous version to resolve an
  issue whereby sources and scenes were not correctly loading…"*. The 3.0.0.25 rewrite
  (2026-05-26) and 3.0.1.29 needed SD 7.1; 2.2.9.9 (2025-09-23) added OBS 32 stability.
- Chapter Marker was added in 2.2.7 (2024-07-25; needs SD 6.7+ and OBS 30.2+). Its **UUID is
  unconfirmed**, and it isn't in the 2.2.4 manifest.
- OBS-side component: *"The OBS Studio plugin is installed when you install the Stream Deck app"*.
  OBS 30.1+ needs SD 6.5.2+.
  ([Waiting for OBS](https://help.elgato.com/hc/en-us/articles/7262866127757), High)

**Action UUIDs.** From the plugin's 2.2.4 manifest (`joshmedeski/dotfiles`
`…/com.elgato.obsstudio.sdPlugin/manifest.json`). Every action has `DisableAutomaticStates: true`.
High for 2.2.4; Medium for 3.0.3.31, given the "reverted to a previous version" note.

**State rule (High, `source/actions/iaction.js`):** `const EActionStateOn = 0;`,
`const EActionStateOff = 1;`. For on/off actions, state **0 = active**, state **1 = idle or OBS
disconnected**.

| Action UUID | Name | States (manifest names) | Settings (real, app-made unless noted) |
|---|---|---|---|
| `com.elgato.obsstudio.record` | Record | 2 ("Start", "Stop"); **0 = recording** | `{"isInMultiAction": false}` (bro69noscope 3.0.3.31); plugin source also reads `longpress` |
| `com.elgato.obsstudio.record.pause` | Record Pause | 2 ("Pause", "Unpause") | — |
| `com.elgato.obsstudio.stream` | Stream | 2 ("Start", "Stop"); **0 = live** | `longpress`: bool, default false. Source: *"Make the request, right now or in 3s if long-press is enabled"*, ignored inside Multi Actions. PI label "Long Press" (2.2.4 `action_stream.js`, inspector). High |
| `com.elgato.obsstudio.virtualcam` | Virtual Camera | 2 ("Start", "Stop") | reads `longpress` too |
| `com.elgato.obsstudio.replaybuffer` | Replay Buffer | 2 ("Start", "Stop") | — |
| `com.elgato.obsstudio.replaybuffer.save` | Replay Buffer Save | **2** (unnamed); calls `showOk` on success | — |
| `com.elgato.obsstudio.scene` | Scene | 2 | `{"scene": "<name>", "target": "preview"}` (bro69noscope); `"program"` also used |
| `com.elgato.obsstudio.source` | Source Visibility | 2 ("Show", "Hide") | `{"collection","icon":"scene","scene","sceneitemid":<int>,"sceneitemname","sceneitemscene","toplevelscene"}` (bro69noscope) |
| `com.elgato.obsstudio.mixeraudio` | Audio Mixer | 2 | `{"isInMultiAction": true, "mode": "toggle", "source": "<input>", "step": -15, "style": "static", "type": "set", "volume": 0.558}` (bro69noscope); `type` `"mute"` also used |
| `com.elgato.obsstudio.mixeraudio.volume` | Audio Mixer Volume, **Encoder**, not Multi | 1 | — |
| `com.elgato.obsstudio.source.media` | Media Source Control | 4 ("Play", "Pause", "Stop", "Restart") | — |
| `com.elgato.obsstudio.studiomode` | Studio Mode | 2 ("Enable", "Disable") | — |
| `com.elgato.obsstudio.transitionstudio` | Transition | 2 | — |
| `com.elgato.obsstudio.transition` | Scene Transition | 2 | — |
| `com.elgato.obsstudio.filter.state` | Filter | 2 ("Enable", "Disable") | `{"filter": "<name>", "source": "<name>"}` (bro69noscope) |
| `com.elgato.obsstudio.screenshot` | Screenshot | 2 | — |
| `com.elgato.obsstudio.scenecollection` | Scene Collection | 2 | `{"collection": "<name>"}` (script-written in Linedev; Low) |
| `com.elgato.obsstudio.profile` | Profile | 2 | `{"profile": "<name>"}` (script-written in Linedev; Low) |

- **Caveat on bro69noscope:** every action there has `"State": 1`, including 1-state BarRaider
  actions. The repo normalises its "vcs templates", so trust its **Settings**, not its `State`.
- `tuxcast`'s `com.elgato.obsstudio.savereplay` is **wrong**; the real UUID is `replaybuffer.save`.

Generated Stream key (live art at index 0, idle at index 1, starting idle; long press as a safety):

```json
{"ActionID":"<uuid-v4>","LinkedTitle":true,"Name":"OBS Stream",
 "Plugin":{"Name":"OBS Studio","UUID":"com.elgato.obsstudio","Version":"3.0.3.31"},
 "Resources":null,"Settings":{"longpress":true},"State":1,
 "States":[{"Image":"Images/<on-air>.png","Title":"LIVE"},
           {"Image":"Images/<off-air>.png","Title":"GO LIVE"}],
 "UUID":"com.elgato.obsstudio.stream"}
```

Portable OBS keys: Record, Record Pause, Stream, Virtual Camera, Replay Buffer, Replay Buffer Save,
Studio Mode, Screenshot (all `{}` or `{"longpress":…}`). Scene, Source, Mixer, Filter, Collection
and Profile need the user's own names.

---

## 9. Elgato Twitch plugin, `com.elgato.twitch`

- Plugin UUID `com.elgato.twitch` (High). Current **1.11.6.15**, 2026-01-20, min SD 6.9. 1.11.4.7
  (2025-10-16) added moderator support. 1.10.0.4 (2025-01-27) *"changes the stream title/game
  action into two separate actions"* (Stream Title, Stream Category) and added Open Dashboard.
- Account setup ([Twitch Integration](https://help.elgato.com/hc/en-us/articles/360028233511),
  High): Preferences → Account tab → + → Twitch → browser login; each action then has an
  **Account** dropdown.
- Help lists these actions: Chat Message, Viewers, Play Ad, Stream Title, Sub Chat, Slow Chat,
  Follower Chat, Emote Chat, Create Stream Marker, Create Clip, Open Last Clip, Shield Mode, Open
  Dashboard, Stream Category.
- Action UUIDs are **Low**:
  - `com.elgato.twitch.chatmessage` `{"accountId","msg"}` and the pre-1.10
    `com.elgato.twitch.streamtitle`, from `data-enabler/streamdeck-profile-generator` (2024).
  - `.clip`, `.marker`, `.viewers` and `.ad`, from `tuxcast`.
- **Don't generate Twitch keys** (per-user `accountId`).

---

## 10. Spotify

| | Elgato **Spotify** | BarRaider **Spotify Integration** |
|---|---|---|
| Plugin UUID | `com.elgato.spotify` (High) | `com.barraider.spotify` (High) |
| Current | **2.5.0.86**, 2026-09-22, min SD 6.9, macOS 12 / **Windows 10**. 2.0.2.32 (2026-01-26) was a rebuild that added Windows; 1.x was macOS-only | **3.3.2**, 2026-08-12, min SD 7.1, **Windows only**; listing says *"A Spotify Premium account is required."* The listing slug is now `spotify-integration-windows-5e3a6d60-…` (old URL redirects) |
| Account | 7.6 notes: the new Web-API actions *"require signing in with a Spotify Premium account"* | Premium |
| Real `Plugin` block | `{"Name":"Spotify","UUID":"com.elgato.spotify","Version":"2.5.0.86"}`; Low-Medium: from the `jovalle/spotifi` tool's config (`conf/streamdeck/dials.json`), whose values look copied from a real key | `{"Name":"Spotify Integration","UUID":"com.barraider.spotify","Version":"3.3.2"}` (bro69noscope, High) |
| Action UUIDs | `com.elgato.spotify.multimedia` (dial), settings `{"config":{},"doublePress":"nextTrack","preferVolume":false,"showArtwork":true,"triplePress":"previousTrack","volumeStep":5}` (Low-Medium, same source). `com.elgato.spotify.shuffle` and `.queue` are referenced by the same tool (Low). 1.x (macOS, 2023) had `.play`, `.next`, `.previous`, `.shuffle`, `.volume` (`Rukshin/dotfiles` ProfilesV2, Low for 2.x) | `com.barraider.spotifyplaypause`, `.spotifynext`, `.spotifyprev`, `.spotifyshuffle` (3 states), `.spotifyrepeat` (4 states), `.spotifylikesong` (3 states), `.spotifyvolup` / `.spotifyvoldown` (`"volumeParam":"10"`), `.spotifyvolset` (`"volumeParam":"100"`), `.spotifyplayuri`. Settings carry `tokenExists` and per-user `devices`, so **don't generate them** |

For media keys without a plugin, use the built-in Multimedia action (§16).

---

## 11. Philips Hue (UUIDs only)

- **Legacy:** `com.elgato.philips-hue`. The redirect goes to product `a670a2ef-…`, which is now
  not found (page and API). It's archived. Action UUIDs `.power`, `.scene`, `.color` are Low.
- **Current:** [Philips Hue](https://marketplace.elgato.com/product/philips-hue-27f49792-2de3-455f-8892-fd382716f548)
  by Elgato. Its first version, "2" (2024-11-14), says *"Initial release for new Philips Hue
  plugin."* Current **2.2.99.72** (2026-10-22), min SD 6.9. **Plugin UUID unconfirmed.** Also new:
  **Philips Hue Sync** (Elgato, 2026-10-22).
- Bridge and light IDs are per home, so **don't generate Hue keys**.

---

## 12. Clocks, timers, stopwatches

| What | Plugin / UUID | Settings | Conf. |
|---|---|---|---|
| **Digital Time** (built-in) | action `com.elgato.streamdeck.system.digitaltime`, `Plugin` `{"Name":"Digital Time","UUID":"com.elgato.streamdeck.system.digitaltime","Version":"1.0"}` | `{"24HourFormat": false, "layout": "digital_time_07", "location": "", "theme": "white"}` | **Medium** (single, partly hand-made source `y5862000/threaddeck-for-codex`). 7.6.1 confirms the action exists ("the Digital Time action could show the wrong time in some recently added timezones") |
| **Timer** (built-in) | action `com.elgato.streamdeck.system.timer`, `Plugin` `{"Name":"Timer","UUID":"com.elgato.streamdeck.timer","Version":"1.0"}` (the plugin UUID differs from the action prefix) | `{"actionIdx": 0, "duration": 1500, "lastUserFile": ""}` (Elgato default profile, per `navigation.md`); `duration` 30 and 3000 also seen. Unit **probably seconds** (1500 = 25 min); `actionIdx` meaning unknown | Medium (several independent captures agree on the UUIDs) |
| **Clocks** (Elgato) | plugin `com.elgato.clocks` | 0.9.2.38 manifest: `com.elgato.clocks.action` "Dynamic Clocks" and `com.elgato.worldclock.action` "World Clock", both Keypad + Encoder | High for the plugin UUID (redirect, `mapping.json`); Medium-Low for actions in current **1.2.0.44** (2025-04-15, min SD 6) |
| Analog Clock / Counter (Elgato, old) | `com.elgato.analogclock` / `com.elgato.counter` | — | Redirects still resolve, but the products are not found in the API: **retired** |
| **Stopwatch** (BarRaider) | plugin `com.barraider.stopwatch`; action `com.barraider.stopwatch` (demo manifest v1.1) | — | Plugin High: 1.9.1, 2026-08-07, min SD 7.1, **Windows only**. Action Medium |

For a portable Comms page, use the built-in **Digital Time** (and maybe **Timer**).

---

## 13. Elgato Camera Hub, `com.elgato.camerahub`

- Plugin UUID `com.elgato.camerahub` (High). Current **2.2.0.164**, 2025-10-08, min SD 6.9, macOS
  14.2 / Win 10. 2.0.0.137 needs Camera Hub 2.0+.
- Action UUIDs are **unconfirmed** (none found on GitHub). The plugin is only useful with Elgato
  cameras, so leave it out.

---

## 14. Other comms-adjacent plugins

**Voicemod** `net.voicemod.windowsdesktop` (maker Voicemod). Current **6.0.8** (2025-12-02), min SD
5, Win 10 / macOS 10.15.

- Real block: `{"Name":"Voicemod","UUID":"net.voicemod.windowsdesktop","Version":"6.0.8"}`.
- Real actions (app-made page, High):
  - `net.voicemod.windowsdesktop.muteswitch` (2 states, `{}`).
  - `.muteforme` (2 states, `{}`).
  - `.stopallsounds` (1 state, `{}`).
  - `.pushtomemesound` (1 state, settings `selected-soundboard`, `selected-sound`, `button-images`,
    which are per user).
- 6.0's Push-to-Talk action UUID is unconfirmed.

**Weather** `com.elgato.weather` (Elgato). Current **1.4.0.6** (2026-09-22, adds the Neo Infobar).
Real block seen: `{"Name":"Weather","UUID":"com.elgato.weather","Version":"1.2.0.100"}`; actions
`com.elgato.weather.weather` and `com.elgato.weather.forecast`. Settings hold a location, so
**never generate**.

**Zoom** (Elgato): current **1.1.0.128** (2026-09-22, min SD 7.1). Plugin UUID unconfirmed
(`com.elgato.zoom` gives a 404, which is uninformative). A second, paid, Elgato "Zoom" listing
(`c0fd6839-…`) also exists.

**Slack** (Elgato): plugin `com.elgato.slack`, actions `com.elgato.slack.open-channel` and
`.open-direct-message`; settings hold team and channel IDs (zalewski export). Not for generation.

**Microsoft Teams:** `com.microsoft.teams` redirects to a listing that the API no longer returns
(gone).

**YouTube** `com.elgato.youtube` (Elgato, 3.0.2.7, 2026-10-22, min SD 7.1). **Streamlabs**
`com.elgato.streamlabs` is maintained by **Streamlabs**, last 1.5.1 (2023-01-13).

---

## 15. Who maintains what, and what's pre-installed (2026)

**Elgato's own plugins.** The Marketplace API (`products?organization_id=1807efeb-…`) returned 23
on 2026-11-06:

> ChatGPT & Codex, Wave Cast, Wave Link, Window Mover, Weather, Elgato Studio, Zoom, Philips Hue,
> Philips Hue Sync, Adobe Photoshop, Slack, Clocks, Volume Controller, Camera Hub, PowerPoint,
> Discord, OBS Studio, Twitch, YouTube, Cam Link Pro, Control Center, Wave Link (Legacy), Spotify.

| Plugin | UUID | Maker | Latest (date) | Min SD | Notes |
|---|---|---|---|---|---|
| Discord | `com.elgato.discord` | Elgato | 2.4.0.123 (2026-09-29) | 7.1 | 2.3.0.116 for 6.9–7.0 |
| Volume Controller | `com.elgato.volume-controller` | Elgato | 2.0.5.201 (2026-10-22) | 7.1 | not bundled since 7.1 |
| Wave Link (WL3) | `com.elgato.wave-link` (Medium) | Elgato | 3.4.0.320 (2026-09-16) | 7.1 | |
| Wave Link (Legacy) | `com.elgato.wavelink` | Elgato | 2.3.0.120 (2026-03-02) | 6.9 | archived |
| Control Center | `com.elgato.controlcenter` | Elgato | 1.12.1.315 (2026-07-23) | 6.9 | |
| OBS Studio | `com.elgato.obsstudio` | Elgato | 3.0.3.31 (2026-06-03) | 6.9 | OBS-side part ships with the SD installer |
| Twitch | `com.elgato.twitch` | Elgato | 1.11.6.15 (2026-01-20) | 6.9 | |
| Spotify | `com.elgato.spotify` | Elgato | 2.5.0.86 (2026-09-22) | 6.9 | new actions need Premium |
| Camera Hub | `com.elgato.camerahub` | Elgato | 2.2.0.164 (2025-10-08) | 6.9 | |
| Philips Hue (new) | unconfirmed | Elgato | 2.2.99.72 (2026-10-22) | 6.9 | |
| Clocks | `com.elgato.clocks` | Elgato | 1.2.0.44 (2025-04-15) | 6 | |
| Weather | `com.elgato.weather` | Elgato | 1.4.0.6 (2026-09-22) | 6.9 | |
| Zoom | unconfirmed | Elgato | 1.1.0.128 (2026-09-22) | 7.1 | |
| YouTube | `com.elgato.youtube` | Elgato | 3.0.2.7 (2026-10-22) | 7.1 | |
| Streamlabs | `com.elgato.streamlabs` | **Streamlabs** | 1.5.1 (2023-01-13) | 4.9 | not Elgato's |
| Stopwatch | `com.barraider.stopwatch` | BarRaider | 1.9.1 (2026-08-07) | 7.1 | Windows only |
| Spotify Integration | `com.barraider.spotify` | BarRaider | 3.3.2 (2026-08-12) | 7.1 | Windows only, Premium |
| Win Tools | `com.barraider.wintools` | BarRaider | 2.4.1 (2026-08-07) | 7.1 | Windows only |
| Audio Switcher | `com.fredemmott.audiooutputswitch` | Fred Emmott | 3.2.0.90 (2024-01-22) | 4.1 | |
| Audio Mute | `com.fredemmott.micmutetoggle` | Fred Emmott | 3.3.0.187 (2024-01-22) | 4.1 | |
| Voicemod | `net.voicemod.windowsdesktop` | Voicemod | 6.0.8 (2025-12-02) | 5 | |

- All the plugins above that I checked are free (`is_free: true`). The exception is the second,
  paid Elgato "Zoom" listing (`c0fd6839-…`). (High.)
- **Pre-installed:** no content plugin. The "Stream Deck", "System", "Multi Action" and "Pages"
  categories are built in. The draft's note that `com.elgato.keycreator` and `com.elgato.tutorial`
  ship inside the app is from one user and was not re-checked (Low-Medium).
- **Install mechanics:** one click needs a signed-in Marketplace account (7.1).
  `Marketplace/mapping.json` maps plugin UUIDs to ProductID/VariantID (seen for `com.elgato.clocks`
  and `com.elgato.controlcenter`). Profiles only need the UUID. (Medium.)

---

## 16. Built-in fallbacks for a plugin-free Comms page

`navigation.md` and `profiles.md` own the full details. Comms-relevant summary:

| Built-in | Action UUID | `Plugin` block | Use on the Comms page |
|---|---|---|---|
| Multimedia | `com.elgato.streamdeck.system.multimedia` | `{"Name":"Multimedia","UUID":"com.elgato.streamdeck.system.multimedia","Version":"1.0"}` (High, many exports) | `{"actionIdx": n}`: 0 Previous, 1 Play/Pause, 2 Next, 3 Stop, 4 Mute, 5 Volume Up, 6 Volume Down (help order, updated 2026-11-06, plus icons in a real export; see `navigation.md` §6.3). Always write `actionIdx` |
| Hotkey | `com.elgato.streamdeck.system.hotkey` | `{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"}` (High, 112 instances in local samples) | sends a combo the user has bound as a Discord keybind |
| Hotkey Switch | `com.elgato.streamdeck.system.hotkeyswitch` | see `navigation.md` §6.2 | help: *"a great way to switch between actions such as … muting/unmuting your microphone"*. Its state flips on every press whatever Discord did, so it can drift |
| Website | `com.elgato.streamdeck.system.website` | `Plugin.Name` "Website" not confirmed from an app-made export (my local samples are script-named) | `{"openInBrowser": true, "path": "<url or URI>"}`; a URI like `discord://` should work (Medium) |
| Open Application | `com.elgato.streamdeck.system.openapp` | — | settings are absolute exe paths (per PC), so leave unset. 6.9: works with Store (UWP) apps "like Discord" |
| Digital Time / Timer | §12 | §12 | clock and countdown |

**Discord keybinds** (Discord support, High):

- [Commands, Shortcuts, and Navigation Guide](https://support.discord.com/hc/en-us/articles/31232432266647),
  updated 2026-11-04:
  - "Mute/unmute microphone **Ctrl + Shift + M**" and "Deafen/undeafen audio
    **Ctrl + Shift + D**" (⌘ on Mac).
  - *"These keyboard shortcuts are only available for the browser and desktop version of the
    Discord app."*
- [Windows Hotkeys](https://support.discord.com/hc/en-us/articles/225977308): "Toggle Mute
  Control + Shift + M", "Toggle Deafen Control + Shift + D".
- [How do I add different Keybinds?](https://support.discord.com/hc/en-us/articles/217083547)
  (desktop only):
  - Actions: Push to Talk, Push To Mute, Toggle Mute, Toggle Deafen ("Also disables your mic"),
    Toggle VAD, Toggle Streamer Mode, Toggle Overlay, Toggle Overlay Lock.
  - *"When you're editing keybinds, keybinds are disabled."*
- Whether the defaults work while Discord isn't focused isn't stated, so treat them as
  focused-only (Medium). Custom keybinds are what PTT relies on in games, so they work globally
  (Medium-High).
- [Discord System Helper](https://support.discord.com/hc/en-us/articles/34853435033367):
  *"games with elevated permissions may prevent Discord keybinds from registering"*. It's
  experimental, for a limited number of Windows users.

**Caveats for Tablet Deck**

- A Stream Deck Hotkey goes to the **focused window**, which is the game. Discord's global keybind
  sees it as well. Pick combos Star Citizen doesn't bind, and say so in the docs.
- Stream Deck 7.6.1 reworked Windows hotkeys so they *"work again in applications running with
  administrator privileges, including many fullscreen games"*.
- Stream Deck's built-in hotkeys are pressed by Stream Deck, **not** by Tablet Deck's
  `tapButton()`. They aren't covered by Tablet Deck's focus check, so state that in our docs.

---

## 17. Open questions (don't generate these without a real install)

- **Discord 2.1+ action UUIDs:** Video Toggle, Stream Toggle, and whether anything was renamed
  after 2.0.3. The current manifest is encrypted. A sign-in-free check: export a profile on a PC
  with the current plugin.
- **Wave Link 3:** plugin UUID (Medium) and all action UUIDs.
- **New Philips Hue and Zoom:** plugin UUIDs.
- **Camera Hub:** all action UUIDs.
- **OBS:** Chapter Marker UUID; whether 3.0.3.31 is internally 2.2.x (state meaning assumed the
  same).
- **Volume Controller:** Auto Detection UUID; what a **key** press does on Input/Output Device
  Control.
- **Elgato Spotify 2.5:** action UUIDs beyond `multimedia` (Low-Medium).
- **Twitch:** post-1.10 action UUIDs.
- **"?" keys:** whether a custom `States[].Title` replaces the action `Name`.
- **Import:** behaviour for a plugin that isn't on Marketplace (sideloaded Tablet Deck plugin), and
  for a `Plugin.Version` that is older or newer than what is installed.
- **Discord mute after Stream Deck quits:** whether it survives. Discord's RPC doc says controlled
  voice settings reset when the controlling app disconnects.
- **Timer:** the `duration` unit and the meaning of `actionIdx`.
- **Multimedia:** 13/14 (fast forward/rewind) and dial index 18 behaviour, per `navigation.md`.
- **Website and Open Application:** `Plugin.Name` from an app-made 7.x export.

---

## Sources

Elgato (primary)

- Marketplace listings (page data and `mp-gateway.elgato.com/products/<id>`):
  - Discord <https://marketplace.elgato.com/product/discord-e3559f36-d31d-4529-ab1f-739955e2ac7a>
  - Volume Controller <https://marketplace.elgato.com/product/volume-controller-34d9aa59-a41a-4a4c-a853-202ca91409e1>
  - Wave Link <https://marketplace.elgato.com/product/wave-link-aa41150f-9645-4275-b064-7642ba6a17ae>
  - Wave Link (Legacy) <https://marketplace.elgato.com/product/wave-link-1baa435a-c623-406d-b53c-53338c6d95d3>
  - Control Center <https://marketplace.elgato.com/product/control-center-39a4fa43-1afe-457a-8a19-b5d386e77d53>
  - OBS Studio <https://marketplace.elgato.com/product/obs-studio-35615969-830f-45c9-ba0a-1a295bba7fec>
  - Twitch <https://marketplace.elgato.com/product/twitch-54e38b3b-89ab-4400-b55f-645378785709>
  - Spotify <https://marketplace.elgato.com/product/spotify-17f49e8b-09a0-4209-95ed-6dee2469f97b>
  - Camera Hub <https://marketplace.elgato.com/product/camera-hub-c2dc2cc4-a75b-43e8-be87-6ba81cdfc325>
  - Philips Hue <https://marketplace.elgato.com/product/philips-hue-27f49792-2de3-455f-8892-fd382716f548>
  - Clocks <https://marketplace.elgato.com/product/clocks-a150a62e-0e32-4d9c-9443-60b8b398e83a>
  - Weather <https://marketplace.elgato.com/product/weather-info-5c3b5556-febc-4a3d-939d-469c15057407>
  - Zoom `e91a9e9f-d6f8-42b5-afa8-cdbd4dc46ef2`
  - YouTube `1aff8623-89a4-456e-88a8-76724ae7cb4b`
  - Streamlabs `5cc181ff-8949-41b6-b724-3365176b2ec5`
  - Third-party:
    - Stopwatch <https://marketplace.elgato.com/product/stopwatch-637dd05d-6f95-4f19-9df7-0fcee0b9845b>
    - Spotify Integration `5e3a6d60-570a-40f3-b186-dbcd122216a2`
    - Audio Switcher <https://marketplace.elgato.com/product/audio-switcher-cf41cd3d-ef80-4122-bef2-7f4fb82fcaac>
    - Audio Mute <https://marketplace.elgato.com/product/audio-mute-705c5433-1e05-4d8a-844f-b5914b7f642f>
    - Voicemod <https://marketplace.elgato.com/product/voicemod-ec172e17-7e9a-43a5-841f-2d91a87589d5>
    - Win Tools <https://marketplace.elgato.com/product/win-tools-c17abe0e-f565-4d86-a80a-73b1d31c0c7d>
- Elgato org plugin list: `https://mp-gateway.elgato.com/products?organization_id=1807efeb-c394-4dcb-98a5-e9bbda06285e&extension=plugins&limit=100`
- UUID → listing redirector: `https://apps.elgato.com/plugins/<pluginUUID>`
- Help centre (via `help.elgato.com/api/v2/help_center/en-us/articles/<id>.json`):
  - Question mark icon on keys 360056747291 (and its screenshots)
  - Discord plugin setup 4422740578189
  - Volume Controller 10568396413965
  - System Actions 360028234471
  - Waiting for OBS 7262866127757
  - Twitch Integration 360028233511
  - Action Sharing 29655138607505
  - Updating plugins 360050819312
  - Release notes:
    - 6.9 34904105205777
    - 6.9 beta 34177552106385
    - 7.0 38011940576273
    - 7.0.1 39330355624977
    - 7.1 41533810232721
    - 7.3.0 44411141578001
    - 7.3.1 44515628024209
    - 7.5.0 48328697898897
    - 7.6 51156609278737
    - 7.6.1 52643738310417
- SDK docs (saved by the parallel researcher): keys guide "Display Precedence" and `setImage`
  (`dl/docs/sdk-guides-keys.txt`, <https://docs.elgato.com/streamdeck/sdk/guides/keys>); profiles
  guide (`dl/docs/sdk-guides-profiles.txt`); profile guidelines (`dl/docs/profiles-gs.txt`).

Discord

- RPC: <https://docs.discord.com/developers/topics/rpc>
- Support articles 31232432266647, 225977308, 217083547, 34853435033367 (via
  `support.discord.com/api/v2/help_center/en-us/articles/<id>.json`)

Plugin copies and source (GitHub)

- Discord 2.0.3 (manifest, `en.json`, all `inspectors/*.js`, `images/actions/mute_*.svg`):
  `Qu3ntinS/dotfiles` `opendeck/.config/opendeck/plugins/com.elgato.discord.sdPlugin/`
- OBS 2.2.4 (manifest, `source/actions/iaction.js`, `stream/action_stream.js`, inspector),
  Control Center 1.9.3.274 and Clocks 0.9.2.38 manifests, `Marketplace/mapping.json`:
  `joshmedeski/dotfiles` `app_support_legacy/com.elgato.StreamDeck/`
- Fred Emmott: `fredemmott/StreamDeck-AudioMute` (`Sources/BaseMuteAction.cpp`,
  `Sources/ToggleMuteAction.cpp`, `sdPlugin/manifest.in.json`); `fredemmott/StreamDeck-AudioSwitcher`
  (`sdPlugin/manifest.json.cmake`)
- BarRaider Stopwatch demo: `BarRaider/streamdeck-stopwatchdemo` `Stopwatch/manifest.json`
- Manifest decrypter: `FroggMaster/Elgato-Plugin-Decrypter`

Real profiles (GitHub)

- App-made:
  - Voicemod, Weather and Multimedia pages: `Linedev-Web/OBS` `sauvegarde/streamdeck/ProfilesV3/303D8BA9-….sdProfile/Profiles/98C29EC2-…`, `EB35F0CE-…`
  - OBS 3.0.3.31 settings and BarRaider Spotify 3.3.2: `bro69noscope/streamdeck-version-control` (templates; `State` normalised)
  - Volume Controller dials and key, Slack: `zalewskigrzegorz/dotfiles` `dot_config/streamdeck/1.Main.sdProfile/Profiles/{F16C597E-…,FE101857-…}`
  - Old Elgato Spotify 1.x: `Rukshin/dotfiles` `os/mac/streamdeck/ProfilesV2/`
  - RequiredPlugins samples: `profiles-x/heir` (7.3.1), `profiles-x/homeops-use` (7.4.0) in this folder
- **Script-written (not evidence of app output):** the `Linedev-Web/OBS` OBS pages
  (`streamdeck/generer.mjs`); `jovalle/spotifi` (`src/spotifi/streamdeck.py`,
  `conf/streamdeck/dials.json`)
- Clones, converters and tests (Low): `JackSkellet/deckforge`, `brunofgmag/flightsim-on-linux`,
  `verygoodplugins/streamdeck-mcp`, `data-enabler/streamdeck-profile-generator`, `achedon12/tuxcast`,
  `Graham42/windows-dot-files`, `jefftriplett/dotfiles`
- Other: `JonathanRReed/Waves` (Wave Link 3 folder name), `feletoch/Dock-Bridge` (encrypted
  manifests), `brahle/stream-deck-agents` (readable Volume Controller manifest on 7.5.0)
