# Code signing policy

Tablet Deck's releases are signed with
[Azure Artifact Signing](https://learn.microsoft.com/azure/artifact-signing/),
Microsoft's code signing service, with a certificate issued to the project
owner's Microsoft-verified identity, and timestamped. The installer's
**Properties → Digital Signatures** shows the publisher. (The workflow can also
sign with [SignPath Foundation](https://signpath.org), which Tablet Deck may
apply to once it's widely known.)

> Status: signed from 1.7.0. Earlier releases are unsigned and Windows shows an
> "unknown publisher" warning for them (see Troubleshooting in the README).
> Each release lists its installer's SHA-256 checksum.

## What is signed

Each release's Windows files, all built from this repository:

- `TabletDeck-Setup-<version>.exe`, the installer
- `TabletDeck.exe`, the app window
- `TabletDeckServer.exe`, the server (Node.js packed with `server.js` and the
  files in `public/`, `layouts/` and `keybinds/`)
- `native/keysender.exe`, the key sender (`native/keysender.cs`)
- `native/voice.exe`, the voice listener (`native/voice.cs`)
- `native/sound.exe`, the sound player for button sounds on the PC (`native/sound.cs`)

They're built only by the **Release** workflow (`.github/workflows/release.yml`)
on GitHub-hosted runners, from this repository's `main` branch, when a release
is published (a version tag, or the workflow run by hand with **Publish**).
Test builds and anything built on a personal computer are never signed, and a
release with no signing set up stops before it's built. The signing credentials
are the repository's own secrets, which only the two build steps that sign can
read; with SignPath instead, every signing request is approved by hand there.

## Team

- Committers and reviewers: [nodieCode](https://github.com/nodieCode)
- Approvers: [nodieCode](https://github.com/nodieCode)

Team members use multi-factor authentication on GitHub and SignPath.

## Privacy

Tablet Deck doesn't collect or send any personal data, and it has no accounts,
ads or tracking. Its network use is:

- **Your home network:** it serves the deck to tablets and phones on your
  network. Only devices with the pairing code can press keys.
- **Update checks:** the app window asks GitHub
  (`api.github.com/repos/nodieCode/tablet-deck/releases/latest`) whether
  there's a newer version, when it starts and once a day. Untick **Check for
  updates automatically** to turn this off. Updates download only when you
  click **Update now**.
- **Fonts:** the tablet's browser loads the theme fonts from Google Fonts.

Fan project. Not affiliated with or endorsed by Cloud Imperium Games.
