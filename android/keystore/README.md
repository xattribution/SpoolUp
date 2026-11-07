# Signing key

Put the app's signing key here as `spoolup-upload.jks`, with its passwords in
`keystore.properties`. Both are gitignored; back them up somewhere safe. How to make them,
and the matching repository secrets for the Release workflow:
[docs/ANDROID.md, Signing](../../docs/ANDROID.md#signing).

Without `keystore.properties` the release build still builds, unsigned.
