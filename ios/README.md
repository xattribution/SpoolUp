# SpoolUp for iPhone and iPad

A SwiftUI shell around the deck: Bonjour discovery of the PC, QR pairing, haptics, the
screen kept on, saved PCs and an offline demo. Not built yet (it needs a Mac and the
Apple developer account).

```sh
node ios/bundle-deck.js        # the deck for the offline demo, into ios/Deck/
cd ios && xcodegen generate    # writes SpoolUp.xcodeproj (never committed)
```

Everything else, from certificates to App Review: [docs/IOS.md](../docs/IOS.md).
