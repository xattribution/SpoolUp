# Third-party software

SpoolUp itself is [MIT licensed](LICENSE). This page lists the third-party
software it ships or uses, and where their licenses are.

## Shipped with SpoolUp

| software | where | license |
|---|---|---|
| [Node.js](https://nodejs.org) | inside `TabletDeckServer.exe`, which packs the Node.js runtime with the server | [Node.js license](https://github.com/nodejs/node/blob/main/LICENSE): MIT, plus the licenses of the libraries Node.js bundles (OpenSSL, V8, ICU, libuv, zlib and others) |

The installer puts the full license text of the exact Node.js version it
contains in `THIRD-PARTY-NOTICES.txt`, next to `LICENSE.txt` in SpoolUp's
install folder. The build writes that file from the Node.js it packs (see
[Building the installer](docs/DEVELOPMENT.md#building-the-installer)).

The key sender, voice listener, sound player and app window (`native/*.cs`)
contain no third-party code. They use parts of Windows (`SendInput`, WinMM's
`waveOut`, the .NET Framework and its speech recognition), which come with
Windows and aren't shipped.

### The Android app

The Android app (`android/`, `SpoolUp-<version>.apk`) includes these libraries,
all under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0):
[AndroidX](https://developer.android.com/jetpack/androidx) (Core, Activity,
SplashScreen and CameraX, by Google) and [ZXing](https://github.com/zxing/zxing)
core (QR code reading, on the device only), plus the
[Kotlin standard library](https://kotlinlang.org) (Apache 2.0). The iPhone and
iPad app (`ios/`) uses only Apple's frameworks.

### Star Citizen data

`data/sc-actions-4.10.json` lists Star Citizen 4.10's action names, English
labels and default keys, as the game's own `defaultProfile.xml` and
`global.ini` give them; they belong to Cloud Imperium Games. SpoolUp uses them
only to check and place its own keybinds, and never shows them to players.

## Used, but not shipped

- **Theme fonts:** Black Ops One, Chakra Petch, Cinzel, Comfortaa, Exo 2,
  Marcellus, Montserrat, Oxanium, Rajdhani, Saira Condensed and Saira Stencil One,
  under the [SIL Open Font License](https://openfontlicense.org). The tablet
  loads them from [Google Fonts](https://fonts.google.com); SpoolUp doesn't
  include the font files.
- **Build tools:** [postject](https://github.com/nodejs/postject) and
  [rcedit](https://github.com/electron/rcedit) (the `devDependencies` in
  `package.json`) and [Inno Setup](https://jrsoftware.org/isinfo.php) are used
  to build the installer, but aren't part of it.
