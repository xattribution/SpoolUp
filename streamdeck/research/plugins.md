# Comms-page plugins as they appear inside Stream Deck profiles

Research for the Tablet Deck Stream Deck mega pack. Topic: the official and third-party
plugins a Comms page would use (Discord, audio, OBS, Twitch, Spotify, Hue, clocks/timers,
Camera Hub, ...), with exact plugin UUIDs, action UUIDs and `Settings` JSON as stored in
profile manifests, plus what Stream Deck does when a profile references a plugin that isn't
installed. Researched 2026-11-06.

Companion notes from the parallel researcher (read them for the overall file format):
`sdk.md`, `devices.md`, `profiles.md`, `iconpacks.md` in this folder. This file covers
the plugin-specific parts only, plus the parts of the profile format that matter for
missing plugins.

## How to read this

**Confidence**

- **High**: Elgato primary source (help.elgato.com, marketplace.elgato.com, docs.elgato.com,
  the elgatosf GitHub org), or a real exported profile / a copy of the plugin's own
  `manifest.json`, with nothing contradicting it.
- **Medium**: one real-world source (e.g. one user's export or one open-source clone that
  says it keeps "original profile action identities"), or an inference from two primary
  facts.
- **Low**: third-party docs or tool code only, not seen in a real export.
- **Unconfirmed**: couldn't find it. Don't generate it.

**How I checked things**

- **Plugin UUID → Marketplace listing.** `https://apps.elgato.com/plugins/<pluginUUID>`
  answers `301` to the plugin's Marketplace page when Elgato knows that UUID, and `404`
  when it doesn't. I used this to confirm UUIDs (High). New plugins published after the old
  store closed (Wave Link 3, the new Hue, Weather) don't resolve this way.
- **Version history.** Marketplace product pages embed the full version history (number,
  date, minimum Stream Deck version, OS, release notes) in their Next.js data. I pulled it
  directly; dates are publish dates.
- **Help articles.** I fetched help.elgato.com through its public Zendesk API
  (`/api/v2/help_center/en-us/articles/<id>.json`), because the HTML pages answer 403 to
  scripts.
- **Real profile JSON** came from public dotfiles/backups on GitHub (code search, then
  `raw.githubusercontent.com`):
  - `Linedev-Web/OBS`: a ProfilesV3 backup with OBS 3.0.3.31, Voicemod, Weather and
    Multimedia actions.
  - `bro69noscope/streamdeck-version-control`: OBS, BarRaider Spotify, page and profile
    navigation.
  - `zalewskigrzegorz/dotfiles`: Volume Controller dials.
  - `jovalle/spotifi`: Elgato Spotify and Volume Controller dials.
  - `Qu3ntinS/dotfiles`: a full copy of `com.elgato.discord.sdPlugin` 2.0.3, including
    its property inspector JS. This is the only readable copy I found, because newer
    Elgato plugin manifests on disk are encrypted (see §1.4).
- **Privacy.** The quotes below are trimmed. Personal data in the sources (IP addresses,
  city names, account names, device serials, user paths) has been removed.

---

## 0. TL;DR for the generator

1. **Every plugin action needs a `Plugin` block** `{"Name","UUID","Version"}` next to its
   action `UUID`. The `.streamDeckProfile` export's `package.json` lists
   `RequiredPlugins`, which is exactly the set of those `Plugin.UUID`s. Stream Deck 7.x
   uses this to offer a one-click install of missing plugins. Write both, consistently
   (§1).
2. **Missing plugins never break an import.** Keys show a **"?"** icon and keep their
   settings; pressing one, or the "?" next to the Marketplace button, offers the install.
   The automatic prompt only works for profiles in the 6.9+ format (§2). So you can put
   optional plugin keys on a Comms page, but make the page usable without them.
3. **Discord:** plugin `com.elgato.discord` (Elgato, free, current **2.4.0.123**, 29 Sep
   2026, needs **Stream Deck 7.1+**).
   - Mute is `com.elgato.discord.mute` and Deafen is `com.elgato.discord.deafen`; both
     take `Settings: {}`, have 2 states and need no per-user setup.
   - Push to Talk / Push to Mute are `com.elgato.discord.pushto.talk` /
     `com.elgato.discord.pushto.mute`. They have **no settings** and **can't go inside
     Multi Actions**.
   - It needs the Discord desktop app running and a **one-time "Authorize"** in Discord
     (§3).
4. **Don't pre-fill anything user-specific.** That includes Discord server/channel IDs,
   Twitch `accountId`, OBS scene names, audio device IDs, Hue bridge IDs and Spotify device
   IDs. Leave those settings empty so the user picks in the property inspector. Actions that
   work with empty settings on any PC:
   - Discord Mute / Deafen / PTT / PTM / Voice-Input-Mode toggle.
   - OBS Record / Stream / Replay Buffer / Replay Save / Virtual Cam / Studio Mode /
     Screenshot.
   - Volume Controller Input/Output Device Control with `"deviceId": "default"`.
   - Fred Emmott Audio Mute with no `deviceID`, which defaults to the Windows
     communications mic.
   - Built-in Multimedia, Digital Time and Timer.
5. **A Comms page with no plugins at all** is possible with built-ins (§16):
   - Multimedia (system volume/mute, media keys), Digital Time, Timer.
   - Website / Open Application to launch Discord etc.
   - Hotkey actions for the user's own Discord global keybinds.

   Only the Discord plugin gives a real mute *state* on the key.
6. **Elgato-maintained and one-click in 2026:** Discord, Volume Controller, Wave Link
   (new, for Wave Link 3), Control Center, OBS Studio, Twitch, Spotify (rebuilt in 2026),
   Camera Hub, Philips Hue (new v2), Clocks, Weather, YouTube, Streamlabs.

   **Nothing third-party is pre-installed.** Since Stream Deck 7.1 even Volume Controller
   is no longer bundled (§15).

---

## 1. How a plugin action is stored in a profile

### 1.1 Shape (Stream Deck 6.9+/7.x, ProfilesV3, profile `Version: "3.0"`)

Real export (OBS Studio plugin; Stream Deck 7.x; trimmed images/titles). Source:
`Linedev-Web/OBS`, `sauvegarde/streamdeck/ProfilesV3/303D8BA9-...sdProfile/Profiles/2476D4B5-.../manifest.json`:

```json
{
  "ActionID": "d5e0c10d-3e1a-468c-abb4-652443208fbb",
  "LinkedTitle": true,
  "Name": "Record",
  "Plugin": {
    "Name": "OBS Studio",
    "UUID": "com.elgato.obsstudio",
    "Version": "3.0.3.31"
  },
  "Resources": null,
  "Settings": {
    "isInMultiAction": false
  },
  "State": 1,
  "States": [
    { "Image": "Images/<hash>.png", "ShowTitle": false, "Title": "" },
    { "Image": "Images/<hash>.png", "ShowTitle": false, "Title": "" }
  ],
  "UUID": "com.elgato.obsstudio.record"
}
```

- `UUID` is the **action** UUID from the plugin manifest's `Actions[].UUID`; `Plugin.UUID`
  is the **plugin** UUID. Built-in actions carry a `Plugin` block too, e.g. Pages is
  `{"Name":"Pages","UUID":"com.elgato.streamdeck.page","Version":"1.0"}` (§16). (High: seen
  in every ProfilesV3 export I opened.)
- `States` must have as many entries as the plugin manifest declares for that action
  (2 for toggles like Mute/Record). (High: matches manifests below.)
- `Settings` is the plugin's own JSON, which its property inspector saves. `isInMultiAction`
  is added by the app/PI and can be omitted when generating (an OpenDeck copy of Discord
  Mute stores `{"isInMultiAction": false}`). (Medium.)
- Older ProfilesV2 exports (Stream Deck ≤6.8) had **no** `Plugin` block (checked
  `joshmedeski/dotfiles` ProfilesV2: OBS actions without `Plugin`). That matches Elgato's
  note that the missing-plugin prompt "only applies to profiles created with Stream Deck
  6.9 or later" (§2). (Medium inference.)

### 1.2 `RequiredPlugins` in the export package

Stream Deck 7.x `.streamDeckProfile` exports contain a `package.json`. Real example
(Stream Deck 7.3.1, Windows; from the parallel researcher's `profiles-x/heir/package.json`):

```json
{"AppVersion":"7.3.1.22604","DeviceModel":"20GBA9901","DeviceSettings":null,"FormatVersion":1,
 "OSType":"Windows","OSVersion":"10.0.26200",
 "RequiredPlugins":["com.elgato.streamdeck.page","com.elgato.streamdeck.profile.backtoparent",
  "com.elgato.streamdeck.profile.openchild","com.elgato.streamdeck.profile.rotate",
  "com.elgato.streamdeck.multiactions","com.elgato.streamdeck.system.text"]}
```

I checked two exports (7.3.1 and 7.4.0). In both, `RequiredPlugins` equals the set of
every `Plugin.UUID` in all page manifests, including actions nested in Multi Actions, in
order of first appearance. (Medium-High: two real samples, exact match.)

**Generator rule:** compute `RequiredPlugins` from your own `Plugin` blocks, so the two can
never disagree. See `profiles.md` for the rest of `package.json`.

### 1.3 `Plugin.Version`

Stream Deck 7.5.0: *"When importing a profile, Stream Deck now clearly distinguishes when a
required plugin version isn't available on Marketplace — rather than showing a generic error
message."*
([7.5.0 notes](https://help.elgato.com/hc/en-us/articles/48328697898897-Elgato-Stream-Deck-7-5-0-Release-Notes))

So the version is looked up on Marketplace. **Use a version number that is actually
published on Marketplace** (tables below give the current ones). Whether an older-but-
published version installs that version or the latest is **unconfirmed**. What happens with
an unknown or made-up version beyond "a clearer message" is also **unconfirmed**. (Medium.)

### 1.4 Plugin manifests on disk are often encrypted

Recent Elgato plugins (Volume Controller, Discord, Control Center, and some BarRaider ones)
ship a `manifest.json` that starts with the bytes `ELGATO` and is encrypted. Their action
list can't be read from an installed copy, only from profiles that use them.
- Source: `feletoch/Dock-Bridge` `engine/plugins.py`: "closed source, encrypted manifest
  only".
- Confidence: Medium (third-party observation, consistent with my not finding any plain
  2.1+ Discord manifest).

That's why some UUIDs below are Medium or Unconfirmed.

---

## 2. What Stream Deck does when a plugin isn't installed

All High (Elgato help center / release notes) unless marked.

| Version | Behavior | Source |
|---|---|---|
| any | "When Stream Deck keys are configured with an action and the plugin from which those actions came from is uninstalled or otherwise not found, those keys will display a **question mark icon**." Common after moving a profile to another PC. | [Question mark icon on keys](https://help.elgato.com/hc/en-us/articles/360056747291-Elgato-Stream-Deck-Question-mark-icon-on-keys) (updated 2026-10-19) |
| any (current text) | Fixes: install from Marketplace; **press the "?" key** to install that plugin; click a "?" key then **"Check Now"**; **click the "?" at the top of the software** for a mass install of the missing plugins. | same article |
| 6.9 (Apr 2025) | "If a profile uses actions from plugins you don't have, you'll be prompted to install them automatically… *This only applies to profiles created with Stream Deck 6.9 or later.*" Also: "You can skip this step and come back to it later — **actions will stay in place but won't work until the plugin is installed**." When Streamlabs actions moved into a plugin, they showed "?" until installed and "your settings will be preserved". | [6.9 notes](https://help.elgato.com/hc/en-us/articles/34904105205777-Elgato-Stream-Deck-6-9-Release-Notes), [6.9 beta changelog](https://help.elgato.com/hc/en-us/articles/34177552106385-Stream-Deck-6-9-Beta-Changelog) |
| 7.0 (2025) | "profiles now tell you which plugins you'll need when importing a profile, and you can install them with one click" (as recapped in the 7.1 notes) | [7.1 notes](https://help.elgato.com/hc/en-us/articles/41533810232721-Elgato-Stream-Deck-7-1-Release-Notes) |
| 7.0.1 (Sep 2025) | "When pressing an action where the plugin is missing (❓ icon), Stream Deck software will now prompt you to download the plugin from Marketplace." | [7.0.1 notes](https://help.elgato.com/hc/en-us/articles/39330355624977-Elgato-Stream-Deck-7-0-1-Release-Notes) |
| 7.1 (Dec 2025) | In-app Marketplace search; "Once you're signed in with your Marketplace account, installing plugins takes just one click." Volume Controller "is no longer bundled by default". | [7.1 notes](https://help.elgato.com/hc/en-us/articles/41533810232721-Elgato-Stream-Deck-7-1-Release-Notes) |
| 7.3.0 (Mar 2026) | "Fixed an issue where installing plugins via in-app search or the **missing plugins dialog** failed on the first attempt." | [7.3.0 notes](https://help.elgato.com/hc/en-us/articles/44411141578001-Elgato-Stream-Deck-7-3-0-Release-Notes) |
| 7.5.0 (Jul 2026) | Import distinguishes "when a required plugin version isn't available on Marketplace". | [7.5.0 notes](https://help.elgato.com/hc/en-us/articles/48328697898897-Elgato-Stream-Deck-7-5-0-Release-Notes) |
| Action Sharing (6.8+) | "If a plugin is missing for an action you just installed, a question mark (?) icon will appear on that action." | [Action Sharing](https://help.elgato.com/hc/en-us/articles/29655138607505-Elgato-Stream-Deck-Action-Sharing) |

Also:
- Installing plugins needs a **Marketplace account** (signed in in the app). Updates
  happen automatically on launch when signed in.
  ([Updating plugins](https://help.elgato.com/hc/en-us/articles/360050819312-Elgato-Stream-Deck-Software-Updating-Plugins-and-Integrations))
- Elgato's maker guidance: "Plugins used within a Profile are not transferred when the
  profile is shared. Users will need to download any required plugins separately."
  If a featured plugin is deprecated or unpublished, that affects the profile.
  (docs.elgato.com profile guidelines, saved by the parallel researcher in
  `dl/docs/profiles-gs.txt`.)

**Not confirmed**

- Whether a "?" key still shows the profile's own custom image/title, or only the "?"
  glyph. The help article only says it "will display the question mark icon".
- What the import dialog says for a plugin that isn't on Marketplace at all (e.g. a
  sideloaded Tablet Deck plugin). Per 7.5 there is a specific message.
- Whether the import itself still succeeds in that case. Per 6.9, actions "stay in place".

**Generator rules that follow**

- Don't make core navigation depend on any plugin. Page/folder/profile keys are built-ins.
- Give every plugin key a clear title in `States[].Title`, so the user can tell what it
  was meant to be even while it shows "?". This is not confirmed to show; it costs
  nothing.
- For our own plugin: if it isn't on Marketplace, users will see "?" until they install the
  `.streamDeckPlugin`, and then the keys should come alive with settings kept. That is
  Medium confidence, by analogy with Streamlabs.
- Alternative: ship the profiles **inside** our plugin. A plugin's manifest can list
  bundled profiles, and the user is prompted to install them when the plugin is installed
  (see `sdk.md` / `dl/docs/sdk-guides-profiles.txt`).

---

## 3. Elgato Discord plugin, `com.elgato.discord`

### 3.1 Identity and status

| Field | Value | Conf. |
|---|---|---|
| Plugin UUID | `com.elgato.discord` | High (apps.elgato.com 301 → [Marketplace](https://marketplace.elgato.com/product/discord-e3559f36-d31d-4529-ab1f-739955e2ac7a); manifest copy) |
| `Plugin` block | `{"Name": "Discord", "UUID": "com.elgato.discord", "Version": "2.4.0.123"}` | High for Name/UUID (manifest `"Name": "Discord"`); Version = current Marketplace version |
| Maker / price | Elgato, free | High |
| OS | macOS 10.15+, Windows 10+ (no Linux) | High |
| Needs | Discord **desktop** app running; one-time authorization in Discord; Stream Deck **7.1+** for 2.4.0.123 (6.9+ for 2.1.1–2.3.0) | High |

Version history from the Marketplace page (`publish_date`, `min_app_version`):

| Version | Date | Min SD | Notes (quoted) |
|---|---|---|---|
| **2.4.0.123** | 2026-09-29 | **7.1** | "Fixed an issue on macOS that caused authentication failures when connecting to user accounts linked to a large number of servers." |
| 2.3.0.116 | 2026-08-05 | 6.9 | "Fixed an issue where Discord authorization would be occasionally lost for some users. When switching accounts in Discord, updates on Stream Deck keys happen quicker." |
| 2.2.0.98 | 2026-03-17 | 6.9 | "Fixed an issue on macOS where some users would occasionally be logged out during plugin start-up." |
| 2.2.0.84 | 2025-09-30 | 6.9 | "Updated icons to match Discord blurple… Added information prompt for actions that require a voice channel" |
| 2.1.1.79 | 2025-06-04 | 6.9 | "Improved authentication reliability for macOS users. Fixed user volume control not working after re-authenticating. Fixed volume display to match Discord." |
| 2.1.0.73 | 2024-12-06 | 6.1 | "Fixed connectivity issues. Removed the Read Messages permission requirement from all actions, except for the Server Stats action" |
| 2.1.0.62 | 2024-10-24 | 6.1 | "What's new in Discord 2.1": **Video Toggle** and **Stream Toggle** actions, macOS auth fixes |
| 2.0.3 | 2024-04-01 | 6.1 | "Fixed an issue where Discord was not authorizing Stream Deck." |
| 2 | 2023-05-24 | 6.1 | New: Soundboard, Set Audio Device, Server Stats, Voice Input Mode toggle |

What changed in 2025–2026: only authorization and reliability fixes, the blurple icon
refresh, and the 7.1 minimum. I found **no** Discord-side API change that broke the plugin.
Users reported Mute/Deafen trouble on macOS and lost authorization (r/elgato, Apr 2025);
2.1.1.79, 2.3.0.116 and 2.4.0.123 target exactly that. Stream Deck 7.3.1 also notes
"Fixed an issue where some plugins, like Discord, were not working correctly."
([7.3.1 notes](https://help.elgato.com/hc/en-us/articles/44515628024209)) (High for the
notes; Medium for "no breaking change".)

### 3.2 Authorization and Discord limits

- **First use:** after installing, "drag any action to a blank key… press it, and a
  Discord Authorization message will pop up. Click on 'Authorize.'"
- **If it stops working:** "Drag any action to a key and if a 'Request Access' button
  appears, click it." The PI also shows "Please launch Discord" when Discord isn't running
  and "Discord authorization required" when it isn't authorized (strings `AppWarning`,
  `AuthWarning`, `AccessButton: "Request access"` in the plugin's `en.json`).
- **Rate limit:** "actions have a rate limit. This means spamming actions can cause them to
  become unresponsive."
- Source:
  [Pedal: Discord Plugin Setup](https://help.elgato.com/hc/en-us/articles/4422740578189-Elgato-Stream-Deck-Pedal-Discord-Plugin-Setup)
  (High), plus the plugin's `en.json` (High).
- **Discord's RPC limits** ([docs.discord.com/developers/topics/rpc](https://docs.discord.com/developers/topics/rpc)):
  - RPC for unapproved apps is restricted (Elgato's app is approved).
  - "we only support a single modifier of voice settings at a time over RPC… it will lock
    voice settings so that other apps connected simultaneously lose the ability to change
    voice settings", and settings **reset when the controlling app disconnects**.

  Practical effects: another mute tool (Logitech applet, an old StreamDeck-Discord plugin,
  OBS tools) can fight with it, and a mute set from Stream Deck may undo itself if Stream
  Deck quits. Fred Emmott's retired plugin documents the same: "mute/deafen only apply
  while the application is running"
  ([StreamDeck-Discord README](https://github.com/fredemmott/StreamDeck-Discord)).
  (High for Discord's statement; Medium for applying it to Elgato's plugin.)

### 3.3 Actions

The source is the plugin's own `manifest.json` v2.0.3 (`Qu3ntinS/dotfiles`,
`opendeck/.config/opendeck/plugins/com.elgato.discord.sdPlugin/manifest.json`), plus its
property-inspector JS for the settings keys. All action UUIDs and states below are **High**
unless marked. "Multi" means `SupportedInMultiActions` (omitted means `true`). Every action
except the two dials is Keypad-only.

| Action UUID | Name | States (index: name) | Multi | Settings keys (from PI) |
|---|---|---|---|---|
| `com.elgato.discord.mute` | Mute | 0 "Mute", 1 "Unmute" (`DisableAutomaticStates`) | yes | none, `{}` |
| `com.elgato.discord.deafen` | Deafen | 0 "Deafen", 1 "Undeafen" (auto-states off) | yes | none, `{}` |
| `com.elgato.discord.pushto.talk` | Push to Talk | 2 states | **no** | none |
| `com.elgato.discord.pushto.mute` | Push to Mute | 2 states | **no** | none |
| `com.elgato.discord.pushtotalktoggle` | Voice Input Mode Toggle | 0 "Voice Activity", 1 "Push to Talk" | yes | none |
| `com.elgato.discord.channel.voice` | Voice Channel | 0 "Enter", 1 "Leave" | yes | `server` (guild id), `serverName`, `channel` (channel id), `icon` (`"static"` / `"dynamic"`) |
| `com.elgato.discord.channel.text` | Text Channel | 1: "Enter" | yes | `server`, `serverName`, `channel` |
| `com.elgato.discord.setaudiodevice` | Set Audio Device | 2 states | yes | `mode` (`"input"` / `"output"` / `"both"`), `input`, `inputname`, `output`, `outputname` |
| `com.elgato.discord.soundboard` | Soundboard | 1 | yes | `sound_id`, `guild_id`, `sound_name`, `emoji_path` |
| `com.elgato.discord.serverstats` | Server Stats | 1 | **no** | `server`, `serverName`, plus display/press options; needs the Read Messages permission and "Server widget must be enabled to track online users" |
| `com.elgato.discord.notifications` | Notifications | 1 | **no** | on-press options; uses `rpc.notifications.read` |
| `com.elgato.discord.volumecontrolbutton` | Volume Control (key) | 1 | yes | `device` (`"input"` / `"output"`), `mode` (`"adjust"` / `"set"`), `volAdjustValue` (int), `volSetValue` (int), `icon` (`"static"` / `"dynamic_h"` / `"dynamic_v"`) |
| `com.elgato.discord.volumecontrol` | Volume Control (**dial**, `Controllers:["Encoder"]`, layout `volume_layout.json`) | 1 | no | `device`, `volValue`; Rotate = adjust, Push/Touch = Mute/Deafen |
| `com.elgato.discord.uservolumecontrolbutton` | User Volume Control (key) | 1 | yes | `user`, `usernick`, `mode`, `muteType`, `icon`, `volAdjustValue`, `volSetValue` |
| `com.elgato.discord.uservolumecontroldial` | User Volume Control (**dial**) | 1 | no | Rotate = volume, Push = next user, Touch = mute |
| `com.elgato.discord.videotoggle` | Video Toggle (added 2.1) | ? | ? | **Medium**: from `JackSkellet/deckforge`, a Linux clone that says it keeps "original profile action identities"; scopes `rpc.video.read` / `rpc.video.write` |
| `com.elgato.discord.streamtoggle` | Stream Toggle (added 2.1) | ? | ? | **Medium**: deckforge, and `brunofgmag/flightsim-on-linux` (converts real Elgato exports); scopes `rpc.screenshare.*` |

**Wrong UUIDs circulating:** `tuxcast` docs list `com.elgato.discord.pushtotalk`,
`.pushtomute`, `.voicechannel` and `.textchannel`, and FreeStream uses `.voicechannel` too.
Those are **wrong**; the manifest has `pushto.talk`, `pushto.mute`, `channel.voice` and
`channel.text`.

### 3.4 Templates (constructed from the manifest and the real export shape)

Mute, which is portable and has no per-user settings:

```json
{
  "ActionID": "<uuid-v4>",
  "LinkedTitle": true,
  "Name": "Mute",
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

For **Deafen** use the same shape with `"Name": "Deafen"` and
`"UUID": "com.elgato.discord.deafen"`. Push to Talk is
`"Name": "Push to Talk", "UUID": "com.elgato.discord.pushto.talk"` with 2 `States`; never
put it inside a Multi Action.

State 0 is "not muted" (image `mute_0`), state 1 is "muted". Because
`DisableAutomaticStates` is true, the plugin sets the state from Discord's real state.
Whether the plugin keeps our custom per-state images or draws its own is **unconfirmed**:
the voice-channel action has a `"dynamic"` icon option, so the plugin does draw icons for
some actions. Check on a real PC.

Voice Channel: leave it **unset** and let the user pick. A generated value would be
another person's server ID. Use `"Settings": {}` and Stream Deck/PI fills in
`server` / `channel`.

---

## 4. Elgato Volume Controller, `com.elgato.volume-controller`

| Field | Value | Conf. |
|---|---|---|
| Plugin UUID | `com.elgato.volume-controller` (also Elgato's own example of a plugin UUID in the SDK guidelines) | High |
| `Plugin` block (real) | `{"Name": "Volume Controller", "UUID": "com.elgato.volume-controller", "Version": "2.0.1.155"}` (zalewski export) / `"2.0.4.196"` (jovalle) | High |
| Current | **2.0.5.201**, 2026-10-22, min SD **7.1**, Win 10 + macOS 10.15; free; Elgato ([Marketplace](https://marketplace.elgato.com/product/volume-controller-34d9aa59-a41a-4a4c-a853-202ca91409e1)) | High |
| Bundled? | **No longer bundled since Stream Deck 7.1**: "When setting up Stream Deck for the first time, the default profile will notify that the plugin is missing, and you can optionally install it, or not." | High ([7.1 notes](https://help.elgato.com/hc/en-us/articles/41533810232721-Elgato-Stream-Deck-7-1-Release-Notes)) |
| Platform note | "App control only supported on Windows at this time" (Marketplace text) | High |

The Marketplace text lists four actions: "Profile: Create a profile using current apps",
"App", "Input", "Output". 2.0.0 (Jul 2024) added Input Device and Output Device actions;
2.0.3 (Jun 2026) added Stream Deck + XL support to Auto Software Detection.

| Action UUID | What | Controllers | Settings (real) | Conf. |
|---|---|---|---|---|
| `com.elgato.volume-controller.input-device-control` | Mic/input volume and mute | Keypad + Encoder | `{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"5"}` | High (real export; `friendlyName` was a device name in a second instance, keep `""`) |
| `com.elgato.volume-controller.output-device-control` | Speaker/headset volume and mute | Keypad + Encoder | `{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"3"}` | High |
| `com.elgato.volume-controller.manual-detection` | App volume (Discord.exe, game…) | Keypad + Encoder | `{"application":{"executableFile":"…\\Discord.exe","shortName":…,"displayName":…},"volumeStep":…}` | Medium (keys from `brunofgmag` converter code that reads real exports) |
| auto-detection / "Profile" action | builds a dynamic profile of running apps | Keypad | **UUID unconfirmed** | — |

Real dial export, values exactly as stored (`zalewskigrzegorz/dotfiles`, `1.Main.sdProfile/Profiles/F16C.../manifest.json`, Encoder controller):

```json
{"ActionID":"3c0db4ca-cf70-4c8d-a02f-c02f1abf6f64","LinkedTitle":true,"Name":"Output Device Control",
 "Plugin":{"Name":"Volume Controller","UUID":"com.elgato.volume-controller","Version":"2.0.1.155"},
 "Resources":null,
 "Settings":{"deviceId":"default","friendlyName":"","style":"vertical","volume":"50","volumeStep":"3"},
 "State":0,
 "States":[{"FontFamily":"Comic Sans MS","FontSize":12,"FontStyle":"Bold","FontUnderline":false,
            "OutlineThickness":2,"ShowTitle":true,"TitleAlignment":"bottom","TitleColor":"#ffffff"}],
 "UUID":"com.elgato.volume-controller.output-device-control"}
```

The number-like values are **strings** (`"50"`, `"3"`). `"deviceId":"default"` follows the
OS default device, so this is portable.

A third-party skill doc lists a keypad `action` key with values
`"adjust"` / `"set"` / `"mute"` / `"unmute"` / `"toggle"`
(`Graham42/windows-dot-files` `ACTIONS.md`). That is **Low**; I didn't see it in a real
export. Prefer the dial form, or leave the key unset.

Known issue: on macOS 2026-09 a user saw the plugin's CoreAudio addon crash on
audio-device changes (`zalewskigrzegorz/dotfiles` `docs/streamdeck.md`). (Low, one report.)

---

## 5. Wave Link (Elgato): two plugins

| | Legacy (Wave Link 2 only) | New (Wave Link 3) |
|---|---|---|
| Marketplace | [Wave Link (Legacy)](https://marketplace.elgato.com/product/wave-link-1baa435a-c623-406d-b53c-53338c6d95d3) | [Wave Link](https://marketplace.elgato.com/product/wave-link-aa41150f-9645-4275-b064-7642ba6a17ae) |
| Plugin UUID | `com.elgato.wavelink` (High: apps.elgato.com redirect; Elgato SDK schema uses it as the example) | **`com.elgato.wave-link`** (Medium: installed folder `com.elgato.wave-link.sdPlugin` observed on a Mac with Stream Deck 7.5.0 and Wave Link 3.2.2, `JonathanRReed/Waves` `.audit/evidence/2026-09-04-mac-mini-inventory.md`; several import tools use the same plugin UUID) |
| Status | 2.3.0.120 (2026-03-02): "This plugin has been archived… *compatible with Wave Link 2 only… will not receive any further updates*" | 3.4.0.320 (2026-09-16), min SD **7.1**, macOS 13+/Win 10; 3.0.0.263 official release 2026-03-03 (Stream Deck 7.3) |
| Actions | `com.elgato.wavelink.inputaction`, `.mixermute`, `.setvolumemixer`, `.adjustvolumemixer`, `.outputaction`, `.monitormute`, `.setvolumemonitor`, `.adjustvolumemonitor`, `.switchmonitoring`, `.hardwareaction`, `.setmonitormixoutput`, `.togglemonitormixoutput`, `.setmicsettings`, `.effectaction`, `.seteffect`, `.seteffectchain`, `.switchprofiles` (High-ish: copy of the 2.3.0.60 manifest, `Nevylish/com.elgato.wavelink.sdPlugin`) | Names from release notes: Channel Level, Channel Audio Effect, Mix Output Device, Toggle Main Output, Output Volume, Soundboard (3.4). **Action UUIDs unconfirmed** (`channellevel`, `volume`, `wavecontrol` all appear in third-party test fixtures) |

Elgato's upgrade note says actions do not carry over from 2 to 3. The Wave Link 3 app can
push its own generated profile to Stream Deck ("Add to Stream Deck").

**Recommendation:** don't put Wave Link actions in generated profiles. Mention it in
docs instead.

---

## 6. Elgato Control Center (Key Light etc.), `com.elgato.controlcenter`

- Plugin UUID `com.elgato.controlcenter` (High: redirect, and Stream Deck's own
  `Marketplace/mapping.json` maps it to ProductID `39a4fa43-…`).
- Current **1.12.1.315**, 2026-07-23, min SD 6.9, Elgato, free
  ([Marketplace](https://marketplace.elgato.com/product/control-center-39a4fa43-1afe-457a-8a19-b5d386e77d53)).
- Actions per Marketplace: Power, Set/Adjust Brightness, Set/Adjust Temperature, Set Color,
  Battery; dials for Brightness and Temperature.
- Action UUIDs seen only in third-party notes, so **Low**:
  - `com.elgato.controlcenter.lights-on-off` (settings `deviceID`, `name`),
    `jefftriplett/dotfiles` `docs/stream-deck.md`.
  - `com.elgato.controlcenter.toggle` and `com.elgato.controlcenter.brightness-slider`,
    Graham42.

  They conflict, and all settings hold a device's MAC/ID, so don't generate them.

---

## 7. Windows audio device switching and system mic mute

| Plugin | UUID | Actions | Settings | Current | Conf. |
|---|---|---|---|---|---|
| **Audio Switcher**, Fred Emmott, open source | `com.fredemmott.audiooutputswitch` | `com.fredemmott.audiooutputswitch.toggle` (2 states: headphones/speakers; **not** in Multi Actions); `com.fredemmott.audiooutputswitch.set` (2 states active/inactive) | `direction` (input/output), `role` (default/communication), `primary`, `secondary` (device id or device object), `matchStrategy` (`"ID"` / `"Fuzzy"`). Device IDs are per-PC, so **leave unset** | 3.2.0.90, 2024-01-22, min SD 4.1, Win + mac; [Marketplace](https://marketplace.elgato.com/product/audio-switcher-cf41cd3d-ef80-4122-bef2-7f4fb82fcaac) | High (source `fredemmott/StreamDeck-AudioSwitcher` `sdPlugin/manifest.json.cmake`, `Sources/ButtonSettings.cpp`) |
| **Audio Mute**, Fred Emmott, open source | `com.fredemmott.micmutetoggle` | `com.fredemmott.micmutetoggle.toggle` (2 states mic-off/mic-on; not in Multi Actions), `.mute`, `.unmute` | `deviceID` (special ids `com.fredemmott.sdmute.deviceIds.defaultInput` / `.defaultOutput` / `.communicationsInput` / `.communicationsOutput`), `feedbackSounds` (bool, default true), `fuzzyMatching` (bool), `toggleKind` (`"ToggleOnly"` / `"TogglePressPttPtmHold"` / `"PttPtmOnly"`). **With no `deviceID` it defaults to the communications input, falling back to the default input, so `{}` is portable.** | 3.3.0.187, 2024-01-22, min SD 4.1; [Marketplace](https://marketplace.elgato.com/product/audio-mute-705c5433-1e05-4d8a-844f-b5914b7f642f) | High (source `fredemmott/StreamDeck-AudioMute` `Sources/BaseMuteAction.cpp`, `DefaultAudioDevices.cpp`) |
| Discord "Set Audio Device" | `com.elgato.discord.setaudiodevice` | changes Discord's own in/out device, not the OS one | §3.3 | — | High |
| Win Tools, BarRaider | `com.barraider.wintools` | big Windows toolbox incl. "App Playback Device" and app/device volume | per action, not researched | 2.4.1, 2026-08-07, min SD 7.1, Windows only | High for UUID/version |
| Volume Controller | §4 | input/output volume and mute, not device switching | | | |

Portable "system mic mute" key (Fred Emmott Audio Mute) as it would be generated
(constructed from the manifest and the shape in §1.1). The `Plugin.Name` is the manifest
`Name` "Audio Mute" (Medium):

```json
{"ActionID":"<uuid-v4>","LinkedTitle":true,"Name":"Toggle Mute",
 "Plugin":{"Name":"Audio Mute","UUID":"com.fredemmott.micmutetoggle","Version":"3.3.0.187"},
 "Resources":null,"Settings":{},"State":0,
 "States":[{"Title":"MIC"},{"Title":"MIC OFF"}],
 "UUID":"com.fredemmott.micmutetoggle.toggle"}
```

---

## 8. Elgato OBS Studio plugin, `com.elgato.obsstudio`

- Plugin UUID `com.elgato.obsstudio`; `Plugin` block (real, 2026)
  `{"Name": "OBS Studio", "UUID": "com.elgato.obsstudio", "Version": "3.0.3.31"}` (High).
- Current **3.0.3.31**, 2026-06-03, min SD **6.9**, Win 10 / macOS 10.11, Elgato, free
  ([Marketplace](https://marketplace.elgato.com/product/obs-studio-35615969-830f-45c9-ba0a-1a295bba7fec)).
  - 3.0.0.25 (2026-05-26) was a rewrite that needed SD 7.1.
  - 3.0.3.31 "Reverted to a previous version to resolve an issue whereby sources and
    scenes were not correctly loading".
  - 2.2.7 (2024-07) added **Chapter Marker** (needs SD 6.7+ and OBS 30.2+); its **action
    UUID is unconfirmed**.
- **Two parts:** the Stream Deck plugin, plus an OBS-side plugin that "is installed when
  you install the Stream Deck app". OBS 30.1+ needs Stream Deck 6.5.2+.
  ([Waiting for OBS](https://help.elgato.com/hc/en-us/articles/7262866127757-Elgato-Stream-Deck-How-to-fix-Waiting-for-OBS-error-message)) (High.)

**Action UUIDs.** The list comes from the plugin's own 2.2.4 manifest
(`joshmedeski/dotfiles` `.../com.elgato.obsstudio.sdPlugin/manifest.json`; all
`DisableAutomaticStates: true`). Rows marked "real 3.0.3.31" were also seen in 2026
exports. All High.

| Action UUID | Name | States | Real `Settings` (2026 exports) |
|---|---|---|---|
| `com.elgato.obsstudio.record` | Record | 0 Start, 1 Stop | `{"isInMultiAction": false}` (real 3.0.3.31) |
| `com.elgato.obsstudio.record.pause` | Record Pause | 0 Pause, 1 Unpause | `{}` (ProfilesV2) |
| `com.elgato.obsstudio.stream` | Stream | 0 Start, 1 Stop | `{"isInMultiAction": false, "longpress": true}`; `longpress` presumably means "long-press to start/stop" as a safety (meaning inferred) (real 3.0.3.31) |
| `com.elgato.obsstudio.virtualcam` | Virtual Camera | 2 | — |
| `com.elgato.obsstudio.replaybuffer` | Replay Buffer | 0 Start, 1 Stop | — |
| `com.elgato.obsstudio.replaybuffer.save` | Replay Buffer Save | 2 in 2.2.4, **1 in the 3.0.3.31 export** | `{"isInMultiAction": false}` (real 3.0.3.31) |
| `com.elgato.obsstudio.scene` | Scene | 2 | `{"scene": "<scene name>", "target": "program"}` (`"preview"` in older exports) (real 3.0.3.31) |
| `com.elgato.obsstudio.source` | Source Visibility | 0 Show, 1 Hide | `{"collection","icon":"scene","scene","sceneitemid":<int>,"sceneitemname","sceneitemscene","toplevelscene"}` (real 3.0.3.31) |
| `com.elgato.obsstudio.mixeraudio` | Audio Mixer (mute) | 2 | `{"source": "<input name>", "type": "mute", "mode": "toggle", "isInMultiAction": false}` (real 3.0.3.31) |
| `com.elgato.obsstudio.mixeraudio.volume` | Audio Mixer Volume, **Encoder** | 1 | — |
| `com.elgato.obsstudio.source.media` | Media Source Control | 4 Play/Pause/Stop/Restart | — |
| `com.elgato.obsstudio.studiomode` | Studio Mode | 0 Enable, 1 Disable | `{}` |
| `com.elgato.obsstudio.transitionstudio` | Transition (Preview → Program) | 2 | — |
| `com.elgato.obsstudio.transition` | Scene Transition | 2 | — |
| `com.elgato.obsstudio.filter.state` | Filter | 0 Enable, 1 Disable | `{"filter": "<name>", "source": "<name>"}` (real 3.0.3.31) |
| `com.elgato.obsstudio.screenshot` | Screenshot | 2 | — |
| `com.elgato.obsstudio.scenecollection` | Scene Collection | 2 | `{"collection": "<name>"}` (real 3.0.3.31) |
| `com.elgato.obsstudio.profile` | Profile | 2 | `{"profile": "<name>"}` (real 3.0.3.31) |

`tuxcast` lists `com.elgato.obsstudio.savereplay`. That is **wrong**; the real UUID is
`replaybuffer.save`.

For a Comms or streaming folder, only **Record, Stream, Replay Buffer, Replay Save,
Virtual Cam, Studio Mode and Screenshot** are portable. Scene, Source and Mixer need the
user's names.

Real Stream key (3.0.3.31, trimmed):

```json
{"ActionID":"54f5c28c-6c8a-4fdc-afea-76046165d68b","LinkedTitle":true,"Name":"Stream",
 "Plugin":{"Name":"OBS Studio","UUID":"com.elgato.obsstudio","Version":"3.0.3.31"},
 "Resources":null,"Settings":{"isInMultiAction":false,"longpress":true},"State":1,
 "States":[{"Image":"Images/<hash>.png","ShowTitle":false,"Title":""},
           {"Image":"Images/<hash>.png","ShowTitle":false,"Title":""}],
 "UUID":"com.elgato.obsstudio.stream"}
```

---

## 9. Elgato Twitch plugin, `com.elgato.twitch`

- Plugin UUID `com.elgato.twitch` (High). Current **1.11.6.15**, 2026-01-20, min SD 6.9,
  Elgato, free
  ([Marketplace](https://marketplace.elgato.com/product/twitch-54e38b3b-89ab-4400-b55f-645378785709)).
  1.11.4.7 (2025-10) added moderator support.
- Needs a Twitch account added under Preferences → Accounts; actions then pick the account
  ([Twitch Integration](https://help.elgato.com/hc/en-us/articles/360028233511-Elgato-Stream-Deck-Twitch-Integration)).
  (High.)
- Actions per help/Marketplace: Chat Message, Clear Chat, Emote / Follower / Sub-only chat,
  Slow Mode, Ad Break, Stream Title, Stream Category (title and category were split into
  two actions in 1.10.0.4, Jan 2025), Marker, Viewer Count, Create Clip, Open Clip, Shield
  Mode, Open Dashboard.
- Known action UUIDs. **Low-Medium**: these come from `data-enabler/streamdeck-profile-generator`
  (2024), a generator whose output was imported by its author.
  - `com.elgato.twitch.chatmessage` with `{"accountId": "<id>", "msg": "<text>"}`.
  - `com.elgato.twitch.streamtitle` with
    `{"accountId","ChannelGameID","ChannelGameTitle","ChannelStatus"}`. This is the
    **pre-1.10 combined action**; whether it still exists is unconfirmed.
  - `tuxcast` adds `com.elgato.twitch.clip`, `.marker`, `.viewers`, `.ad` (Low).
- `accountId` is per user. **Don't generate Twitch keys**; mention them in docs.

---

## 10. Spotify

| | Elgato **Spotify** | BarRaider **Spotify Integration** |
|---|---|---|
| Plugin UUID | `com.elgato.spotify` (High) | `com.barraider.spotify` (High) |
| Current | **2.5.0.86**, 2026-09-22, min SD 6.9, macOS 12+ / **Windows** (Windows added in the 2.0.2.32 rebuild, 2026-01-26; 7.6 "rebuilt on Spotify's official Web API", Infobar "Now Playing") | 3.3.2, 2026-08-12, min SD 7.1, **Windows only**, Spotify Premium required |
| Real `Plugin` block | `{"Name":"Spotify","UUID":"com.elgato.spotify","Version":"2.5.0.86"}` (`jovalle/spotifi` `conf/streamdeck/dials.json`, Medium: config built from an export) | `{"Name":"Spotify Integration","UUID":"com.barraider.spotify","Version":"3.3.2"}` (real export, High) |
| Example action | `com.elgato.spotify.multimedia` (dial: playback and volume), settings `{"config":{},"doublePress":"nextTrack","preferVolume":false,"showArtwork":true,"triplePress":"previousTrack","volumeStep":5}` | `com.barraider.spotifyplaypause`, `.spotifynext`, `.spotifyprev`, `.spotifyshuffle`, `.spotifyrepeat`, `.spotifylikesong`, `.spotifyvolup`, `.spotifyvoldown`, `.spotifyvolset` (`{"volumeParam":"100","showVolumeLevel":true,…}`), `.spotifyplayuri` |
| Note | Other action UUIDs (Playback, Shuffle, Repeat, Volume, Save to Liked, Add to, Play Collection, Saved Search, Queue) are unconfirmed | Action UUIDs are **not** prefixed with the plugin UUID (`com.barraider.spotifyplaypause` etc.). Settings carry `tokenExists` and per-user `devices`, so don't generate them |

For media keys without any plugin, use the built-in Multimedia action (§16).

---

## 11. Philips Hue (UUIDs only)

- **Legacy**: `com.elgato.philips-hue`. The apps.elgato.com redirect points to product
  `a670a2ef-…`, which now returns not-found. A search snippet calls it "Philips Hue
  (Legacy)… archived". Its open-source mirror is `OpenActionMirrors/com.elgato.philips-hue`.
  - Action UUIDs from third-party notes (Low): `com.elgato.philips-hue.power`, `.scene`,
    `.color`, with settings `bridge`, `light` (+`scene` / `color`).
  - A fork uses `com.elgato.philipshue`, which is not Elgato's.
- **Current**: [Philips Hue](https://marketplace.elgato.com/product/philips-hue-27f49792-2de3-455f-8892-fd382716f548)
  by Elgato, v2, created 2024-11-14, current **2.2.99.72** (2026-10-22), min SD 6.9.
  **Plugin UUID unconfirmed.** It's a new product, so it may be a new UUID.
- Bridge, light and scene IDs are per home, so **don't generate Hue keys**.

---

## 12. Clocks, timers, stopwatches

| What | Plugin / UUID | Settings | Conf. |
|---|---|---|---|
| **Digital Time** (built-in, no install) | action `com.elgato.streamdeck.system.digitaltime`, `Plugin` `{"Name":"Digital Time","UUID":"com.elgato.streamdeck.system.digitaltime","Version":"1.0"}` | `{"24HourFormat": false, "layout": "digital_time_07", "location": "", "theme": "white"}` | High (real export in `y5862000/threaddeck-for-codex` `profiles/source/unpacked/...`; Stream Deck 7.6.1 notes mention "the Digital Time action" timezones fix) |
| **Timer** (built-in) | action `com.elgato.streamdeck.system.timer`, `Plugin` `{"Name":"Timer","UUID":"com.elgato.streamdeck.timer","Version":"1.0"}` | `{"actionIdx": <int>, "duration": <int>, "lastUserFile": ""}` (seen with `duration` 30 and 3000; unit and `actionIdx` meaning **unconfirmed**) | Medium (two independent reverse-engineering projects: `troystaylor/Control-Deck-for-ZoomIt` `scripts/layout.config.json` and `thisis-romar/opendeck-factory` `scripts/expand-reference-profile.js`) |
| **Clocks** (Elgato) | plugin `com.elgato.clocks` (My Clock, World Clock; dial actions; countdown timer) | action UUIDs unconfirmed | High for plugin UUID (Stream Deck's `Marketplace/mapping.json`) and [Marketplace](https://marketplace.elgato.com/product/clocks-a150a62e-0e32-4d9c-9443-60b8b398e83a): 1.2.0.44, 2025-04-15, min SD 6, Win + mac |
| Analog Clock (Elgato, old) | `com.elgato.analogclock`, action `com.elgato.analogclock.action` | — | High for UUIDs (manifest copy), but its Marketplace page is gone, so treat it as **retired** |
| Counter (Elgato, old) | `com.elgato.counter`, action `com.elgato.counter.action` | — | same: page gone |
| **Stopwatch** (BarRaider) | plugin `com.barraider.stopwatch`; action probably `com.barraider.stopwatch` | — | Plugin High: 1.9.1, 2026-08-07, min SD 7.1, **Windows only**. Action Medium: BarRaider's demo-repo manifest |

For a portable Comms page, use the built-in **Digital Time** (and maybe **Timer**). They
need no install.

---

## 13. Elgato Camera Hub, `com.elgato.camerahub`

- Plugin UUID `com.elgato.camerahub` (High). Current **2.2.0.164**, 2025-10-08, min SD 6.9,
  macOS 14.2+ / Win 10
  ([Marketplace](https://marketplace.elgato.com/product/camera-hub-c2dc2cc4-a75b-43e8-be87-6ba81cdfc325)).
- Actions per Marketplace: Select / Set / Adjust / Reset / Display Camera, Refocus, Effect,
  Background, LUT, Preview to Prompter, Window to Prompter, Snapshot, Prompter Control /
  Display / Mode / Appearance / Scroll / Overlay; dial actions too.
- Action UUIDs **unconfirmed**. Only useful with Elgato cameras, so leave it out.

---

## 14. Other comms-adjacent plugins seen in real 2026 exports

**Voicemod** `net.voicemod.windowsdesktop`, maker Voicemod.
- Current 6.0.8, 2025-12-02, min SD 5, Win + mac.
- Real `Plugin` block: `{"Name":"Voicemod","UUID":"net.voicemod.windowsdesktop","Version":"6.0.8"}`.
- Real actions, all `Settings: {}`, from the Linedev export (High):
  - `net.voicemod.windowsdesktop.muteswitch`, "Mute Mic On/Off", 2 states.
  - `.muteforme`, "Mute Sounds for Me On/Off", 2 states.
  - `.stopallsounds`, 1 state.
  - `.pushtomemesound`, "Play Sound"; settings embed a sound id and a base64 image, so
    it's per user.
- 6.0 (2025-10) added a Push-to-Talk action; its UUID is unconfirmed.

**Weather** (Elgato, introduced with Stream Deck 7.0).
- `Plugin` block (real) `{"Name":"Weather","UUID":"com.elgato.weather","Version":"1.2.0.100"}`;
  actions `com.elgato.weather.weather`, `com.elgato.weather.forecast`.
- Settings contain the user's location (and an IP address in one export), so **never
  generate them**.
- Listing: [Weather](https://marketplace.elgato.com/product/weather-info-5c3b5556-febc-4a3d-939d-469c15057407).

**YouTube** `com.elgato.youtube` and **Streamlabs** `com.elgato.streamlabs` exist as Elgato
plugins (redirects resolve). Not researched further.

---

## 15. Who maintains what, and what's pre-installed (2026)

| Plugin | UUID | Maker | Latest (date) | Min SD | One-click from Marketplace / in-app search |
|---|---|---|---|---|---|
| Discord | `com.elgato.discord` | Elgato | 2.4.0.123 (2026-09-29) | 7.1 | yes |
| Volume Controller | `com.elgato.volume-controller` | Elgato | 2.0.5.201 (2026-10-22) | 7.1 | yes. **Was bundled; not since 7.1** |
| Wave Link (WL3) | `com.elgato.wave-link` (Medium) | Elgato | 3.4.0.320 (2026-09-16) | 7.1 | yes |
| Wave Link (Legacy, WL2) | `com.elgato.wavelink` | Elgato | 2.3.0.120 (archived 2026-03-02) | 6.9 | archived |
| Control Center | `com.elgato.controlcenter` | Elgato | 1.12.1.315 (2026-07-23) | 6.9 | yes |
| OBS Studio | `com.elgato.obsstudio` | Elgato | 3.0.3.31 (2026-06-03) | 6.9 | yes (the OBS-side part comes with the Stream Deck installer) |
| Twitch | `com.elgato.twitch` | Elgato | 1.11.6.15 (2026-01-20) | 6.9 | yes |
| Spotify | `com.elgato.spotify` | Elgato | 2.5.0.86 (2026-09-22) | 6.9 | yes |
| Camera Hub | `com.elgato.camerahub` | Elgato | 2.2.0.164 (2025-10-08) | 6.9 | yes |
| Philips Hue (v2) | unconfirmed | Elgato | 2.2.99.72 (2026-10-22) | 6.9 | yes |
| Clocks | `com.elgato.clocks` | Elgato | 1.2.0.44 (2025-04-15) | 6 | yes |
| Stopwatch | `com.barraider.stopwatch` | BarRaider | 1.9.1 (2026-08-07) | 7.1 | yes, Windows only |
| Spotify Integration | `com.barraider.spotify` | BarRaider | 3.3.2 (2026-08-12) | 7.1 | yes, Windows only |
| Win Tools | `com.barraider.wintools` | BarRaider | 2.4.1 (2026-08-07) | 7.1 | yes, Windows only |
| Audio Switcher | `com.fredemmott.audiooutputswitch` | Fred Emmott | 3.2.0.90 (2024-01-22) | 4.1 | yes |
| Audio Mute | `com.fredemmott.micmutetoggle` | Fred Emmott | 3.3.0.187 (2024-01-22) | 4.1 | yes |
| Voicemod | `net.voicemod.windowsdesktop` | Voicemod | 6.0.8 (2025-12-02) | 5 | yes |

All of these are **free** (Marketplace `is_free: true`). (High.)

**Pre-installed in 2026**
- No content plugin. Volume Controller stopped being bundled in 7.1 (High).
- `com.elgato.keycreator` (icon library) and `com.elgato.tutorial` ship inside the app
  and reinstall themselves (Medium: one macOS user's notes, 2026-09).
- Everything in the app's own "Stream Deck", "System", "Multi Action" and "Pages"
  categories is built in and needs no install (§16).

**Install mechanics:** one click needs a signed-in Marketplace account (7.1). Stream Deck
keeps `Marketplace/mapping.json` (plugin UUID → `ProductID` / `VariantID`), and older plugin
manifests carry `MpProductID` / `MpVariantID`, so lookup goes by plugin UUID. Profiles only
need the UUID. (Medium.)

---

## 16. Built-in fallbacks for a plugin-free Comms page

The parallel researcher's `profiles.md` covers the built-in actions in full. These are the
ones that matter here, with their real `Plugin` blocks from 2026 exports:

| Built-in | Action UUID | `Plugin` block (real) | Use on Comms page |
|---|---|---|---|
| Multimedia | `com.elgato.streamdeck.system.multimedia` | `{"Name":"Multimedia","UUID":"com.elgato.streamdeck.system.multimedia","Version":"1.0"}` | system volume up/down, mute, play/pause/next/prev. `Settings: {"actionIdx": n}` |
| Hotkey | `com.elgato.streamdeck.system.hotkey` | `{"Name":"Activate a Key Command","UUID":"com.elgato.streamdeck.system.hotkey","Version":"1.0"}` | send a key combo the user has bound as a **Discord global keybind** (Settings → Keybinds: Toggle Mute / Toggle Deafen / PTT) |
| Website | `com.elgato.streamdeck.system.website` | `{"Name":"Website",…,"Version":"1.0"}` | `{"openInBrowser": true, "path": "<url>"}`. Elgato's own default profile uses a protocol URL (`"path": "microsoft-edge:"`), so `discord://` style links should work (Medium). `openInBrowser: false` sends a background HTTP GET (a real export uses it against `http://127.0.0.1:<port>/...`) (Medium) |
| Open Application | `com.elgato.streamdeck.system.openapp` | `{"Name":"Open Application",…,"Version":"1.0"}` | launch Discord/OBS. Settings hold absolute exe paths (`app_name`, `bundle_path`, `exec`, `source`, `long_press`…), so they are per-PC. Leave unset |
| Digital Time / Timer | §12 | §12 | clock and countdown |

Caveats:

- **`actionIdx` for Multimedia: sources disagree.**
  - Graham42 says 0 Play/Pause, 1 Stop, 2 Prev, 3 Next, 4 Vol+, 5 Vol−, 6 Mute.
  - jefftriplett says 0 mute, 1 play/pause, 3 prev, 4 next, 5 vol+, 6 vol−.
  - opendeck-factory says 5 Vol+, 6 Vol−.
  - A real export titled "stop any multimedia track" uses `3`.

  **Treat the mapping as unconfirmed; verify in the app** or take it from `profiles.md`
  if that settles it.
- **Discord's default in-app shortcuts** are Ctrl+Shift+M (mute) and Ctrl+Shift+D (deafen).
  Discord's blog presents them as shortcuts for when Discord is open, and whether they work
  globally is unconfirmed. Global control needs a user-defined keybind. Pick combos Star
  Citizen doesn't use, because a Stream Deck hotkey is delivered to the focused window
  (the game) too. (Medium.)
- Stream Deck built-in hotkeys are pressed by Stream Deck itself, not by Tablet Deck's
  `tapButton()`. They aren't subject to Tablet Deck's focus check. Worth stating in our docs.

---

## 17. Not confirmed (don't generate these without checking on a real install)

- Action UUIDs for:
  - Discord: Video Toggle and Stream Toggle (Medium only: `videotoggle` / `streamtoggle`).
  - Volume Controller: auto-detection / Profile.
  - OBS: Chapter Marker.
  - Twitch: post-2025 Stream Title / Stream Category and most others.
  - Elgato Spotify (except `multimedia`), Control Center, Camera Hub.
  - Wave Link 3, Elgato Clocks, the new Philips Hue (plugin UUID as well), Voicemod PTT.
- Whether a "?" (missing-plugin) key shows the profile's custom image and title.
- The exact import behavior for a plugin that isn't on Marketplace (our own plugin if
  sideloaded), and how `Plugin.Version` older or newer than Marketplace's is treated.
- Whether Discord Mute/Deafen keep custom per-state images or get redrawn by the plugin.
- Built-in Timer `actionIdx` and `duration` semantics; Multimedia `actionIdx` mapping.
- Whether the Elgato Discord plugin's mute survives Stream Deck quitting. Discord's RPC
  doc says controlled voice settings reset when the controlling app disconnects.

---

## Sources

Elgato (primary)
- Discord plugin listing and version history: <https://marketplace.elgato.com/product/discord-e3559f36-d31d-4529-ab1f-739955e2ac7a>
- Volume Controller: <https://marketplace.elgato.com/product/volume-controller-34d9aa59-a41a-4a4c-a853-202ca91409e1>
- Wave Link (new): <https://marketplace.elgato.com/product/wave-link-aa41150f-9645-4275-b064-7642ba6a17ae>; Wave Link (Legacy): <https://marketplace.elgato.com/product/wave-link-1baa435a-c623-406d-b53c-53338c6d95d3>
- Control Center: <https://marketplace.elgato.com/product/control-center-39a4fa43-1afe-457a-8a19-b5d386e77d53>
- OBS Studio: <https://marketplace.elgato.com/product/obs-studio-35615969-830f-45c9-ba0a-1a295bba7fec>
- Twitch: <https://marketplace.elgato.com/product/twitch-54e38b3b-89ab-4400-b55f-645378785709>
- Spotify: <https://marketplace.elgato.com/product/spotify-17f49e8b-09a0-4209-95ed-6dee2469f97b>
- Camera Hub: <https://marketplace.elgato.com/product/camera-hub-c2dc2cc4-a75b-43e8-be87-6ba81cdfc325>
- Philips Hue (v2): <https://marketplace.elgato.com/product/philips-hue-27f49792-2de3-455f-8892-fd382716f548>
- Clocks: <https://marketplace.elgato.com/product/clocks-a150a62e-0e32-4d9c-9443-60b8b398e83a>
- Weather: <https://marketplace.elgato.com/product/weather-info-5c3b5556-febc-4a3d-939d-469c15057407>
- Third-party listings: Stopwatch <https://marketplace.elgato.com/product/stopwatch-637dd05d-6f95-4f19-9df7-0fcee0b9845b>, Spotify Integration <https://marketplace.elgato.com/product/spotify-integration-5e3a6d60-570a-40f3-b186-dbcd122216a2>, Audio Switcher <https://marketplace.elgato.com/product/audio-switcher-cf41cd3d-ef80-4122-bef2-7f4fb82fcaac>, Audio Mute <https://marketplace.elgato.com/product/audio-mute-705c5433-1e05-4d8a-844f-b5914b7f642f>, Voicemod <https://marketplace.elgato.com/product/voicemod-ec172e17-7e9a-43a5-841f-2d91a87589d5>, Win Tools <https://marketplace.elgato.com/product/win-tools-c17abe0e-f565-4d86-a80a-73b1d31c0c7d>
- UUID → listing redirector: `https://apps.elgato.com/plugins/<pluginUUID>`
- Question mark icon on keys: <https://help.elgato.com/hc/en-us/articles/360056747291-Elgato-Stream-Deck-Question-mark-icon-on-keys>
- Discord plugin setup: <https://help.elgato.com/hc/en-us/articles/4422740578189-Elgato-Stream-Deck-Pedal-Discord-Plugin-Setup>
- Volume Controller plugin: <https://help.elgato.com/hc/en-us/articles/10568396413965-Elgato-Stream-Deck-Volume-Controller-Plugin>
- Waiting for OBS: <https://help.elgato.com/hc/en-us/articles/7262866127757-Elgato-Stream-Deck-How-to-fix-Waiting-for-OBS-error-message>
- Twitch Integration: <https://help.elgato.com/hc/en-us/articles/360028233511-Elgato-Stream-Deck-Twitch-Integration>
- Action Sharing: <https://help.elgato.com/hc/en-us/articles/29655138607505-Elgato-Stream-Deck-Action-Sharing>
- Updating plugins: <https://help.elgato.com/hc/en-us/articles/360050819312-Elgato-Stream-Deck-Software-Updating-Plugins-and-Integrations>
- Release notes:
  - 6.6 <https://help.elgato.com/hc/en-us/articles/26005306818701>
  - 6.8 <https://help.elgato.com/hc/en-us/articles/29844501142801>
  - 6.9 <https://help.elgato.com/hc/en-us/articles/34904105205777>
  - 6.9 beta <https://help.elgato.com/hc/en-us/articles/34177552106385>
  - 7.0 <https://help.elgato.com/hc/en-us/articles/38011940576273>
  - 7.0.1 <https://help.elgato.com/hc/en-us/articles/39330355624977>
  - 7.1 <https://help.elgato.com/hc/en-us/articles/41533810232721>
  - 7.3.0 <https://help.elgato.com/hc/en-us/articles/44411141578001>
  - 7.3.1 <https://help.elgato.com/hc/en-us/articles/44515628024209>
  - 7.5.0 <https://help.elgato.com/hc/en-us/articles/48328697898897>
  - 7.6 <https://help.elgato.com/hc/en-us/articles/51156609278737>
  - 7.6.1 <https://help.elgato.com/hc/en-us/articles/52643738310417>
- SDK manifest schema (UUID examples `com.elgato.wavelink`, `com.elgato.discord`): `elgatosf/streamdeck` `packages/schemas/src/streamdeck/plugins/manifest/latest.ts`

Discord
- RPC (single voice-settings modifier, approval): <https://docs.discord.com/developers/topics/rpc>

Real profiles, plugin copies, plugin source (GitHub)
- Discord plugin 2.0.3 copy (manifest, PI JS, `en.json`): `Qu3ntinS/dotfiles` @ `fdd8a0ff`, `opendeck/.config/opendeck/plugins/com.elgato.discord.sdPlugin/`
- OBS 3.0.3.31, Voicemod 6.0.8, Weather, Multimedia, Open Application, Website exports: `Linedev-Web/OBS` @ `02800531`, `sauvegarde/streamdeck/ProfilesV3/`
- OBS source/filter, BarRaider Spotify, navigation exports: `bro69noscope/streamdeck-version-control` @ `91032311`
- Volume Controller dials, Action Trigger: `zalewskigrzegorz/dotfiles` @ `ed6d825d`, `dot_config/streamdeck/1.Main.sdProfile/`
- Elgato Spotify and Volume Controller dial configs: `jovalle/spotifi` @ `4d7c79d7`, `conf/streamdeck/dials.json`
- OBS plugin 2.2.4 manifest and legacy ProfilesV2, Stream Deck `Marketplace/mapping.json`: `joshmedeski/dotfiles` @ `dd877b8a`, `app_support_legacy/com.elgato.StreamDeck/`
- Wave Link 2.3.0.60 manifest copy: `Nevylish/com.elgato.wavelink.sdPlugin` @ `60fdfaad`
- Wave Link 3 plugin folder name: `JonathanRReed/Waves` @ `80474572`, `.audit/evidence/2026-09-04-mac-mini-inventory.md`
- Digital Time export: `y5862000/threaddeck-for-codex` @ `8cc04f41`
- Timer action: `troystaylor/Control-Deck-for-ZoomIt` @ `80ae26b9`, `scripts/layout.config.json`; `thisis-romar/opendeck-factory` @ `309e59e9`
- Audio Switcher / Audio Mute source: `fredemmott/StreamDeck-AudioSwitcher` @ `f0b5bcc7`, `fredemmott/StreamDeck-AudioMute` @ `ea6dfdf0`
- Retired community Discord plugin (limitations): <https://github.com/fredemmott/StreamDeck-Discord>
- Discord clone with video/stream toggles: `JackSkellet/deckforge` @ `f3bc459c`, `streamdeck-linux/plugins/discord/manifest.json`
- Elgato-export converter (streamtoggle, manual-detection keys): `brunofgmag/flightsim-on-linux` @ `2d6fd29d`, `addons/opendeck/parts/convert.py`
- Profile generator (Twitch/OBS settings, 2024): `data-enabler/streamdeck-profile-generator` @ `62c75f5b`, `lib/actions.js`
- Encrypted manifests note: `feletoch/Dock-Bridge` @ `6191b516`, `engine/plugins.py`
- Low-confidence references (contain errors, used only for leads): `achedon12/tuxcast` `docs/reference/elgato-actions.md`; `Graham42/windows-dot-files` `claude/skills/streamdeck-editor/ACTIONS.md`; `jefftriplett/dotfiles` `docs/stream-deck.md`
