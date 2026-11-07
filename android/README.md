# SpoolUp for Android

The Android app: a full-screen window onto the deck the PC serves, which finds SpoolUp PCs
on the network by itself (mDNS, `_spoolup._tcp`), keeps the screen on and gives haptics on
presses. Building, signing, Google Play and testing: [docs/ANDROID.md](../docs/ANDROID.md).

```sh
./gradlew assembleDebug testDebugUnitTest   # needs JDK 17+ and the Android SDK (platform 36)
```

| path | what it is |
|---|---|
| `app/src/main/java/…/MainActivity.kt` | the window, the WebView, connecting, back and full screen |
| `app/src/main/java/…/Discovery.kt` | finds PCs with NsdManager |
| `app/src/main/java/…/Pc.kt` | a PC, and the rules for addresses (home network only) |
| `app/src/main/java/…/Bridges.kt` | `window.SpoolUpApp` (the deck) and `window.SpoolUpLaunch` (the launch page) |
| `app/src/main/java/…/Haptics.kt` | haptic kinds to the device's effects or the vibrator |
| `app/src/main/java/…/ScanActivity.kt` | the QR code scanner (CameraX and ZXing, on the device) |
| `app/src/main/java/…/Prefs.kt` | the PCs opened before |
| `app/src/main/assets/launch/index.html` | the launch page: PCs found, saved PCs, scan, address |
| `app/src/main/res/drawable/ic_launcher_*.xml`, `res/mipmap-anydpi/` | the adaptive icon, from `public/icon.svg` |
| `keystore/` | where the signing key goes (gitignored) |
