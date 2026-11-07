# Publishing on the Elgato Marketplace and in winget / the Microsoft Store

Checked against the vendors' own pages on 2026-11-06. Legal, trademark and Cloud Imperium questions are left out, since you're reviewing those yourself.

## TL;DR

- **Elgato Marketplace:** it's free and there's no application. You create a Maker organization at https://maker.elgato.com, sign the Maker Agreement and upload each product. **Recommendation:** publish the **plugin first**, then the profiles, then the icon packs, and make every listing **free**. The "price match" rule requires that, because the pack is free on GitHub.
- **winget / Microsoft Store:** these are two separate routes:
  - a manifest pull request to `microsoft/winget-pkgs`;
  - a Microsoft Store "EXE or MSI app" listing, which winget can also install from its `msstore` source.
  
  **Recommendation:** use **winget-pkgs now**, starting with **1.8.0**, the first signed release, and update it automatically from `release.yml`. Hold off on the Store until Partner Center support answers two questions: whether it accepts Artifact Signing, and whether the app counts as a "game product".
- **Before either one:** publish the v1.8.0 release. GitHub has no v1.8.0 release yet, and every existing 1.7.0 build is unsigned.

---

## 1. Elgato Marketplace

### Steps

1. **Settle the identity first.** Product names can't be changed in Maker Console (only by emailing maker@elgato.com), and a plugin UUID can never change once it's published. What the repo has today:
   - Plugin: `UUID com.xattribution.spoolup`, `Name`/`Category` "SpoolUp", `Author` "xattribution", in `streamdeck/plugin/com.xattribution.spoolup.sdPlugin/manifest.json`.
   - Generator: `AUTHOR = "SpoolUp"` (line 39), `PLUGIN_UUID` (line 41) and `ICONPACK_ID = com.xattribution.spoolup.icons.<theme>` (line 43), in `tools/make-streamdeck.js`.
   - **These two Author values disagree.** Elgato wants both to be your Marketplace organization name.
2. **Create the Maker account.**
   - Sign in at https://maker.elgato.com with an Elgato account.
   - Create the organization. It gets a public `@handle`, and an alias is fine.
   - Sign the Maker Agreement. You can only read its text inside Maker Console, so read it before signing.
   - Set the support method to a link, for example https://github.com/xattribution/SpoolUp/issues.
   - Skip Stripe. It's only needed for paid products.
3. **Test on real hardware.**
   - The rules: don't list an OS you haven't **tested** on, and don't list a device the profile wasn't **built for**.
   - Elgato reviewers also check that the product works.
   - What still needs testing is listed in the README section "Not tried on a real Stream Deck yet" and in `streamdeck/HANDOFF.md`.
4. **Rebuild and validate.** The local `dist/streamdeck` is a stale 1.6.0.0 `com.nodiecode.tabletdeck` build, so rebuild it.
   ```
   node tools/make-streamdeck.js --release
   node tools/make-streamdeck.js --check
   npx @elgato/cli@1.10.4 validate dist/streamdeck/plugin/com.xattribution.spoolup.sdPlugin --force-update-check
   ```
   - Running it with `npx` adds no dependency to the repo.
   - Elgato has no validator for profiles.
   - For icon packs, `--check` already applies the rules of Icon Pack Man and the old DistributionTool. DistributionTool's downloads now return 404.
5. **Make the listing media.** None of the existing images are the right size.
   - Thumbnail: a **1920×960 PNG**.
   - Gallery: **3–10 items**, either 1920×960 PNG or 1920×1080 MP4 under 250 MB.
   - Plugin app icon: a **288×288 static PNG**. The artwork can come from `imgs/plugin/icon@2x.png`.
   - Icon packs: icon previews. Elgato doesn't document the count or size.
   - Plugin: a **demo video**, very likely required, because the plugin needs the SpoolUp app and Star Citizen.
   - Everything in English. Show only keys that are actually in the product.
6. **Write the listing text.** Base it on the README's "Stream Deck" section.
   - **Name:** about 30 characters or fewer, no "Plugin", no Maker name, and "&" rather than "+" for "and".
   - **Description:** 250–1,500 characters, with the first 250 unformatted.
     - Requirements: Windows 10+, Stream Deck 7.3+ (+ XL), the SpoolUp app, the keybind profile, and Elgato's Discord and OBS plugins for the Comms page.
     - Icon packs: 222 icons plus 21 animated GIFs per theme, lit variants, 12 themes.
   - **Release notes:** generate them from CHANGELOG.md with `scripts/release-notes.js`.
   - **AI use:** declare it with the "AI Content" tag. Elgato won't publish products "created entirely with AI".
7. **Submit the plugin.**
   - Go to Home > Create product > Stream Deck plugin.
   - Upload `dist/streamdeck/com.xattribution.spoolup.streamDeckPlugin`.
   - Price: **Free**.
   - Tags: Type Gaming; Language English/Spanish/French/German; Dial support Yes; Neo Infobar No; Profiles Yes; OS Windows.
   - Additional links: Support, Setup Guide (README#stream-deck), and Related Download (the releases page).
   - **Untick "Automatically publish after being approved".**
8. **Test the DRM build before you release it.**
   - Elgato applies DRM to plugins with SDKVersion 3 and MinimumVersion 6.9 or newer, so this one qualifies.
   - In the product's Versions tab, download the protected build and install it on Windows.
   - Check that `data/*.json`, `<lang>.json` and `bin/*.js` load, that the 7 bundled profiles appear, and that `switchToProfile` works.
   - Then press Release.
   - ⚠ Elgato's DRM page lists "Node.js plugins must be using @elgato/streamdeck v2 or higher". Our plugin talks to Stream Deck directly and doesn't use that library at all. It never reads `manifest.json`, which is the reason for the rule, but it doesn't literally meet it. Test the protected build, or ask maker@elgato.com.
9. **Line up versions, then submit the profiles.**
   - The standalone profiles name the plugin as `Version: ${VERSION}.0` (`tools/make-streamdeck.js` around line 593). That version must be published on Marketplace: since Stream Deck 7.5.0, the import says so when a required version is missing. Rebuild the profiles after the plugin is approved.
   - Upload one ZIP per model: `dist/streamdeck/release/SpoolUp-StreamDeck-Profiles-<model>.zip`. Each holds that model's 12 theme profiles, a README and the keybind XML.
   - Tags per listing: only that model's Device tag, OS Windows, Type Gaming, Icons Yes, and Dial support Yes for + and + XL.
   - Profiles that use Ctrl/Alt shortcuts should be labelled Windows. Our profile names give the model but not the OS (naming is around `tools/make-streamdeck.js` line 1116).
10. **Submit the icon packs.** Each Icons listing takes one `.streamDeckIconPack` file, from `dist/streamdeck/icons/SpoolUp <Theme>.streamDeckIconPack`. Pick one of three options:
    - **(a)** 12 listings, one per theme. Rename each file to `<id>.streamDeckIconPack`, because Icon Pack Man flags a name that doesn't match the ID.
    - **(b)** One merged pack. This needs a generator change.
    - **(c)** Bundle the packs inside the profile ZIPs only. If they're also listed on their own, the bundled copies need different IDs.
    
    Tags: Type Gaming, Theme, Style, Color Multicolor, Animated Yes.
11. **Review.** Elgato documents **4–10 working days**. Feedback comes by email from maker@elgato.com. Approved products appear within 3 hours. To fix a rejected version, submit a revision of it from the Versions tab.
12. **Every release:** use **Create version** on each listing, keep it free, and never change the UUIDs. Then add the Marketplace links to the README and CHANGELOG (and `site/index.html` if it lists the pack). Elgato's badge is at docs.elgato.com/resources/badges.

### Gotchas

- **The plugin dependency.**
  - Listings have no dependency field. List SpoolUp, the plugin, Discord and OBS in each description and link them as "Related Download".
  - In the Stream Deck app, a missing plugin shows as a "?" key with a one-click install. That install only works for plugins published on Marketplace, so publish the plugin first.
  - Featuring other Makers' plugins is allowed. Elgato says both Makers should "come to an agreement".
- **Bundling themes.**
  - A profile ZIP may hold many themes and models. Real listings already do that.
  - An Icons listing is one pack. Of 900 listings checked, none had more than one variant.
  - An all-models ZIP would be about 310 MB. Elgato documents no upload size limit.
- **Free vs paid** is a store setting chosen at upload, and it can't be changed in Maker Console afterwards. Free products need no Stripe, tax or bank setup. Paid would be a 70/30 split, but price match rules it out here.
- **Updates.**
  - Plugin users signed in to Marketplace get updates automatically.
  - Profiles **never** auto-update, so users have to download them again.
  - Whether icon packs auto-update is unconfirmed. Say "download again" in the release notes.
- **Users need a Marketplace account and Stream Deck 6.4+** to download, even free items. The GitHub downloads stay account-free.

---

## 2. winget and the Microsoft Store

### The two routes

| | winget community repo (`microsoft/winget-pkgs`) | Microsoft Store "EXE or MSI app" |
|---|---|---|
| Install command | `winget install xattribution.SpoolUp` | `winget install <XP…StoreId> -s msstore`, or the Store app |
| What you submit | A pull request with 3 YAML files per version | A Partner Center listing, with a versioned HTTPS installer URL |
| Signing | Not required | Required: the certificate must chain to a CA in the Microsoft Trusted Root Program (policy 10.2.9) |
| Review | 10 automated checks plus a moderator. New packages waited **3–61 days** (two PRs merged 2026-11-06) | Up to **3 business days** of review (certification) |
| Updates | Automatic PR from `release.yml` via wingetcreate | A new submission per release (by hand, or through the API). The Store never updates existing users; the app's own updater does |
| GitHub release URL | Accepted | Likely rejected: it redirects (302). Q&A threads from 2023–24 show rejections, but no Learn page states the rule |
| Account | GitHub account and Microsoft CLA | Free Partner Center account at storedeveloper.microsoft.com (ID plus selfie) |

**Recommendation:** go with winget-pkgs. It has no signing or policy blockers and can be automated.

Do the Store later, and only once Partner Center support has answered both of these:
- **Artifact Signing.** Microsoft's Artifact Signing page (2026-10-01) says its CAs are "no longer" in the Trusted Root Program. The CCADB list still shows the root as Included, so whether the Store accepts these signatures is unknown. The fallback is an OV certificate.
- **Game product.** Policy 10.1 says products that mainly offer "control functionality of games" must be listed as games, and games can't use the EXE route. There is a precedent: Elgato Stream Deck is listed under Productivity as an MSI.

### What the project must change or settle first

1. **Publish v1.8.0, and skip 1.7.0.**
   - Both 1.7.0 installers are unsigned.
   - Two *different* files are named `TabletDeck-Setup-1.7.0.exe`:
     - nodieCode/tablet-deck, SHA-256 `C6419E21…8940`;
     - xattribution/SpoolUp, SHA-256 `80081EEB…7891`.
   - The 1.7.0 build's update check points at `nodieCode/tablet-deck`. Today's tree (launcher.cs, the .iss `RepoUrl`, the site) points at `xattribution/SpoolUp`.
   - Listing 1.7.0 from nodieCode while 1.8.0 lives in xattribution would mix two publishers and two repos under one package.
2. **Pick the final PackageIdentifier now.** For example `xattribution.SpoolUp`, matching `AppName` "SpoolUp" and `AppPublisher` "xattribution". Changing it after the first merge means the two-identifier migration described in the winget-pkgs FAQ.
3. **Silent install copies the keybind profile.**
   - The `scprofile` task (`installer/TabletDeck.iss` line 64) has no `unchecked` flag. So every silent install, winget and Store included, copies the profile into the game's Mappings folder without the player asking. That breaks the ground rule that the profile is copied only when the player asks.
   - The manifests below add `/MERGETASKS=!scprofile` to fix it.
   - The cleaner long-term fix is in the installer: skip the copy on silent first installs.
4. **Silent upgrade over a running app.**
   - winget's silent mode lets Inno close the app through Restart Manager.
   - `CloseRunningApp()`, which releases held keys, only runs with `/RELAUNCH=1`.
   - Test on Windows that held keys still come up after a winget upgrade, or call `CloseRunningApp()` for every silent install.
5. **Privacy policy URL.**
   - winget: optional. The drafts point at the README's "Safety and privacy" section.
   - Store: **mandatory** for Win32 apps (policy 10.5.1). Adapt the Privacy section of `CODE_SIGNING.md`.
6. **Store only:** host a byte-identical copy of each installer at a versioned URL that doesn't redirect. GitHub Pages under the new repo currently returns 404, and whether Partner Center accepts a github.io URL is untested.

### Steps for winget (recommended)

1. Publish v1.8.0 with the Release workflow. **Never replace a release asset afterwards**: that breaks the hash.
2. Fill in the 1.8.0 manifests:
   - Start from the drafts in [`docs/publishing/winget/`](publishing/winget/) (the SpoolUp 1.8.0 manifests; the installer hash is filled in once the release exists).
   - Fill in `InstallerSha256` (upper case, from the release's `.sha256` asset) and `ReleaseDate`.
   - The changes from the 1.7.0 set below are listed after it.
3. Test on Windows:
   - Run `winget settings --enable LocalManifestFiles` as admin.
   - Run `winget validate --manifest <folder>`.
   - From a **non-elevated** terminal, run `winget install --manifest <folder>`. Expect one UAC prompt, no setup wizard, no profile copied into the game, and the firewall rule present.
   - Then run `winget list`, an upgrade over a running copy, and `winget uninstall`.
   - Repeat in Windows Sandbox with `Tools\SandboxTest.ps1` from winget-pkgs.
   - Scan the installer with Defender. Any antivirus or unwanted-software flag (Binary-Validation-Error) can't be waived.
4. Fork `microsoft/winget-pkgs` and add the three files under `manifests/x/xattribution/SpoolUp/1.8.0/` (one version, manifest files only). You can also run `wingetcreate submit <folder>` or `komac submit`.
   - PR title: `New package: xattribution.SpoolUp version 1.8.0`.
   - Sign the Microsoft CLA when the bot asks.
5. In the PR description, say:
   - the installer is machine-wide and admin-only;
   - it adds a Windows Firewall rule for Private networks only, removed on uninstall;
   - the app serves a local web page to the user's own devices;
   - `scprofile` is deselected on purpose;
   - the app works on its own, so it doesn't read as hardware-bound. A "Hardware" label closes the PR.
6. Watch the PR's Checks tab. If **Needs-Author-Feedback** appears, reply within 5 days: No-Recent-Activity is added after 5 days, and the PR is closed 3 days later.
7. After the merge, the package goes live within about an hour.
8. Turn on automatic updates:
   - Create a **classic** token with the `public_repo` scope. Fine-grained tokens don't work.
   - Use a separate bot account that owns the fork and has signed the CLA, because the token can write to all of that account's public repos.
   - Store it as the `WINGET_TOKEN` secret, and set the repository variable `WINGET_PACKAGE_ID=xattribution.SpoolUp`.
   - Add the job below.
9. For any later rename or change of publisher, repo or asset name, submit that version by hand.

### For reference: the manifests for Tablet Deck 1.7.0

Use the SpoolUp 1.8.0 set in [`docs/publishing/winget/`](publishing/winget/) instead; these show the format against the old release.

These are complete, with the hash filled in for the **nodieCode/tablet-deck** v1.7.0 asset. They were checked against the 1.28.0 JSON schemas. `winget validate` wasn't run, because it needs Windows. **I recommend submitting 1.8.0 instead; see the field changes below.** Files: `docs/publishing/winget/`.

`manifests/n/nodieCode/TabletDeck/1.7.0/nodieCode.TabletDeck.yaml`
```yaml
# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.1.28.0.schema.json

PackageIdentifier: nodieCode.TabletDeck
PackageVersion: 1.7.0
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.28.0
```

`nodieCode.TabletDeck.installer.yaml`
```yaml
# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.1.28.0.schema.json

PackageIdentifier: nodieCode.TabletDeck
PackageVersion: 1.7.0
InstallerLocale: en-US
Platform:
- Windows.Desktop
MinimumOSVersion: 10.0.0.0
InstallerType: inno
Scope: machine
InstallModes:
- interactive
- silent
- silentWithProgress
InstallerSwitches:
  Custom: /MERGETASKS=!scprofile
UpgradeBehavior: install
ProductCode: '{A7A9440D-F358-4D02-81DE-04193AAA6A52}_is1'
ReleaseDate: 2026-10-26
ElevationRequirement: elevationRequired
InstallationMetadata:
  DefaultInstallLocation: '%ProgramFiles%\Tablet Deck'
Installers:
- Architecture: x64
  InstallerUrl: https://github.com/nodieCode/tablet-deck/releases/download/v1.7.0/TabletDeck-Setup-1.7.0.exe
  InstallerSha256: C6419E211D6E78A4CC0E69A4E95256B5C67D6F59768E3201CDBB5248041C8940
ManifestType: installer
ManifestVersion: 1.28.0
```

`nodieCode.TabletDeck.locale.en-US.yaml`
```yaml
# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.1.28.0.schema.json

PackageIdentifier: nodieCode.TabletDeck
PackageVersion: 1.7.0
PackageLocale: en-US
Publisher: nodieCode
PublisherUrl: https://github.com/nodieCode
PublisherSupportUrl: https://github.com/nodieCode/tablet-deck/issues
PrivacyUrl: https://github.com/nodieCode/tablet-deck#safety-and-privacy
Author: nodieCode
PackageName: Tablet Deck
PackageUrl: https://github.com/nodieCode/tablet-deck
License: MIT
LicenseUrl: https://github.com/nodieCode/tablet-deck/blob/v1.7.0/LICENSE
Copyright: Copyright (c) 2026 nodieCode
ShortDescription: Turns a tablet or phone on your home network into a touch control panel for Star Citizen.
Description: |-
  Tablet Deck is a HUD-style button deck that runs in the web browser of a tablet or phone on the same network as the gaming PC. Each button press is sent to the PC, which presses that button's key once, and only while Star Citizen is the window in front.
  The PC app serves the deck, pairs devices with a QR code and pairing code, follows the player's own keybinds and offers hold-to-talk voice commands, a layout editor and 12 manufacturer themes. No account is needed and nothing is installed on the tablet.
  Setup adds a Windows Firewall rule so tablets can connect on private networks.
  Fan project. Not affiliated with or endorsed by Cloud Imperium Games.
Moniker: tabletdeck
Tags:
- button-box
- control-panel
- hotkeys
- hud
- keybinds
- phone
- star-citizen
- tablet
- touchscreen
- voice-commands
ReleaseNotesUrl: https://github.com/nodieCode/tablet-deck/releases/tag/v1.7.0
InstallationNotes: |-
  Open Tablet Deck from the Start menu: its window shows the QR code, address and pairing code for your tablet.
  WinGet doesn't copy the Star Citizen keybind profile into the game; add it with Settings > Install keybind profile... in the Tablet Deck window, then load "Tablet Deck Keyboard" in the game.
Documentations:
- DocumentLabel: Get started
  DocumentUrl: https://github.com/nodieCode/tablet-deck#get-started
ManifestType: defaultLocale
ManifestVersion: 1.28.0
```

**For 1.8.0 (recommended), change these fields.** Everything else stays the same.
- `PackageIdentifier: xattribution.SpoolUp`, in the folder `manifests/x/xattribution/SpoolUp/1.8.0/`.
- `Publisher: xattribution` and `PackageName: SpoolUp`.
- Every `nodieCode/tablet-deck` URL becomes `xattribution/SpoolUp`, and `v1.7.0` becomes `v1.8.0`.
- `InstallerUrl: https://github.com/xattribution/SpoolUp/releases/download/v1.8.0/SpoolUp-Setup-1.8.0.exe`
- `InstallerSha256: <SHA256 of SpoolUp-Setup-1.8.0.exe, upper case>` and `ReleaseDate: <YYYY-MM-DD>`. Neither can be known until the release exists.
- `Moniker: spoolup`. The InstallationNotes name the "SpoolUp Keyboard" profile.

### Release-workflow step that keeps it updated

The job has to live **inside** `.github/workflows/release.yml`. The release is created with `GITHUB_TOKEN`, and a release made that way doesn't start a separate `on: release` workflow. The job only runs once the first version has been merged by hand.

First, in the existing `build` job, expose the tag:
```yaml
  build:
    outputs:
      release-tag: ${{ steps.release.outputs.tag }}
    # in the "Work out the release" step (id: release), also write:
    #   "tag=$tag" >> $env:GITHUB_OUTPUT
```
Then add this job:
```yaml
  winget:
    needs: build
    if: needs.build.outputs.release-tag != '' && vars.WINGET_PACKAGE_ID != ''
    runs-on: windows-latest
    permissions:
      contents: read
    steps:
      - name: Submit the release to WinGet
        shell: pwsh
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ needs.build.outputs.release-tag }}
          PACKAGE_ID: ${{ vars.WINGET_PACKAGE_ID }}
          WINGET_CREATE_GITHUB_TOKEN: ${{ secrets.WINGET_TOKEN }}
        run: |
          if (-not $env:WINGET_CREATE_GITHUB_TOKEN) { throw "Set the WINGET_TOKEN secret." }
          $version = $env:TAG.TrimStart("v")
          $setup = gh release view $env:TAG --repo "${{ github.repository }}" --json assets --jq '.assets[].name' |
            Where-Object { $_ -match '-Setup-.+\.exe$' } | Select-Object -First 1
          if (-not $setup) { throw "Release $env:TAG has no *-Setup-*.exe." }
          $url = "https://github.com/${{ github.repository }}/releases/download/$env:TAG/$setup"
          # wingetcreate pinned by version and SHA-256, like jsign
          $exe = Join-Path $env:RUNNER_TEMP "wingetcreate.exe"
          Invoke-WebRequest "https://github.com/microsoft/winget-create/releases/download/v1.12.13.0/wingetcreate.exe" -OutFile $exe
          if ((Get-FileHash $exe -Algorithm SHA256).Hash -ne "24042BD37915805615E6CF969AC57C6439124C3FE85823327F5F3FB24BD9FFEA") { throw "wingetcreate.exe doesn't match its SHA-256" }
          & $exe update $env:PACKAGE_ID --version $version --urls $url `
            --release-notes-url "https://github.com/${{ github.repository }}/releases/tag/$env:TAG" `
            --submit --no-open
          if ($LASTEXITCODE -ne 0) { throw "wingetcreate update failed with exit code $LASTEXITCODE" }
```
Notes:
- wingetcreate 1.12.13.0 writes schema 1.12.0, which is still accepted; 1.28.0 is recommended. It also has telemetry on by default.
- Komac 2.17.2 writes 1.28.0 and has no telemetry. It's available through WinGet Releaser; pin that action to a commit SHA.
- The full draft, with comments, is in [`docs/publishing/winget/release-workflow-step.yml`](publishing/winget/release-workflow-step.yml).

### Microsoft Store: the short version

1. Get answers from Partner Center support on Artifact Signing (policy 10.2.9) and on the game-product question (policy 10.1).
2. Open a free account at https://storedeveloper.microsoft.com. Other entry points show the old flow, which has fees.
   - Individual accounts publish "under your own name" and can't become Company accounts later.
   - Policy 10.14 requires a Company account if the app or publisher name reads like a business.
3. Reserve the name "SpoolUp": Partner Center (https://aka.ms/submitwindowsapp) > New product > EXE or MSI app. An unused reservation lapses after 3 months.
4. Fill in the submission:
   - Free; category **Utilities + tools**; the IARC age-rating questionnaire; a privacy policy; support = GitHub issues.
   - Package: the versioned, non-redirecting HTTPS URL, x64, en-us, EXE.
   - Installer parameters: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /MERGETASKS=!scprofile`. Use `/VERYSILENT`, because `/SILENT` still shows a progress window.
   - Return codes: 2 and 5 = cancelled; 8 = reboot required. That's the closest match: Inno's 8 means setup stopped *before* installing and needs a restart. Codes 1, 3, 4 and 7 go under miscellaneous, with the Inno exit-code page as the documentation URL.
5. Notes for certification:
   - the deck needs a second device's browser, or a browser on the same PC;
   - presses only reach Star Citizen while it's the focused window;
   - the Private-network firewall rule;
   - the optional updater;
   - a silent uninstall keeps `%APPDATA%\TabletDeck`, which the clean-uninstall test checks.
6. Certification takes up to 3 business days, and the listing is live about 15 minutes after it passes. Then `winget install <XP-ID> -s msstore` works. That it works without the Store app is backed only by community reports.
7. Each release needs an Update submission with a new versioned URL. It can be automated through the Store submission API or `msstore`, which need a Microsoft Entra tenant and work only for free apps that are already live.
   - Keep the in-app updater: the Store never updates existing EXE users.
   - If the app is in both sources, `winget install SpoolUp` asks users to choose a source.

---

## 3. Things to decide or check

**Decide**
- The final name, UUIDs, Maker organization name and winget PackageIdentifier, before the first upload anywhere.
- Make one Author value for Elgato: the manifest says "xattribution" and the icon packs say "SpoolUp".
- Icon packs: 12 listings, one merged pack, or bundled in the profile ZIPs only.
- Profiles: one listing per model, or one combined ZIP of about 310 MB.
- Whether to fix `scprofile` in the installer, rather than relying on `/MERGETASKS=!scprofile` in every manifest.
- Whether to list 1.7.0 at all. I recommend not; if you do, decide which repo's binary is canonical.

**Check (needs Windows or real hardware)**
- Stream Deck: every model and OS you will tag.
- The Elgato DRM build: data and JS loading, bundled profiles, `switchToProfile`.
- `winget validate`, the non-elevated install, the upgrade over a running copy (held keys released), and the uninstall.
- Defender and other antivirus engines on the signed installer, `keysender.exe` and the server executable.

**Couldn't be confirmed**
- Whether the Store accepts Artifact Signing–signed EXEs. Microsoft's two sources conflict.
- Whether a Store reviewer treats SpoolUp as a game product.
- Whether Partner Center accepts a GitHub or github.io Package URL.
- Whether an Individual Store account can show "xattribution" as publisher, or link an Entra tenant for automation.
- Elgato:
  - the Maker Agreement text;
  - upload size limits;
  - the full tag lists and icon-preview sizes;
  - whether Marketplace icon packs auto-update;
  - whether 12 theme listings would be seen as duplicates.
- The third-party claim that Maker Console has required DRM plugins since 2026-01-19. No Elgato page says so; our manifest meets it anyway.
- What the profile import shows for a plugin that isn't on Marketplace, and how it matches `Plugin.Version`.
- The ~3-day median Elgato review time. It comes from a sample of the Marketplace API; plan on 4–10 working days.
