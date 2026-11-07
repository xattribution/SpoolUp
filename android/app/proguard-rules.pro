# The deck and the launch page call these by name through window.SpoolUpApp and
# window.SpoolUpLaunch.
-keepattributes JavascriptInterface
-keepclassmembers class dev.xattribution.spoolup.DeckBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class dev.xattribution.spoolup.LaunchBridge {
    @android.webkit.JavascriptInterface <methods>;
}
