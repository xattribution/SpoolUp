import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The app's version is SpoolUp's: "version" in the repository's package.json. The version
// code counts up with it (2.2.0 -> 20200), which Google Play needs for every upload.
val spoolUpVersion: String = run {
    val json = rootProject.file("../package.json").readText()
    Regex("\"version\"\\s*:\\s*\"(\\d+\\.\\d+\\.\\d+)\"").find(json)?.groupValues?.get(1)
        ?: error("No x.y.z \"version\" in package.json")
}
val spoolUpVersionCode: Int = spoolUpVersion.split(".").map { it.toInt() }.let { (a, b, c) -> a * 10000 + b * 100 + c }

// Release signing, from either:
//  - environment variables (the Release workflow): SPOOLUP_KEYSTORE (a path),
//    SPOOLUP_KEYSTORE_PASSWORD, SPOOLUP_KEY_ALIAS, SPOOLUP_KEY_PASSWORD, or
//  - keystore/keystore.properties (storeFile, storePassword, keyAlias, keyPassword), gitignored.
// With neither, the release build is unsigned. docs/ANDROID.md says how to make the key.
val signing: Map<String, String>? = run {
    val env = System.getenv()
    if (!env["SPOOLUP_KEYSTORE"].isNullOrBlank()) {
        mapOf(
            "storeFile" to env.getValue("SPOOLUP_KEYSTORE"),
            "storePassword" to env["SPOOLUP_KEYSTORE_PASSWORD"].orEmpty(),
            "keyAlias" to env["SPOOLUP_KEY_ALIAS"].orEmpty(),
            "keyPassword" to env["SPOOLUP_KEY_PASSWORD"].orEmpty(),
        )
    } else {
        val f = rootProject.file("keystore/keystore.properties")
        if (!f.exists()) null else Properties().apply { f.inputStream().use { load(it) } }
            .let { p -> listOf("storeFile", "storePassword", "keyAlias", "keyPassword").associateWith { p.getProperty(it).orEmpty() } }
            .let { it + ("storeFile" to rootProject.file(it.getValue("storeFile")).path) }
    }
}

android {
    namespace = "dev.xattribution.spoolup"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.xattribution.spoolup"
        minSdk = 26
        targetSdk = 36
        versionCode = spoolUpVersionCode
        versionName = spoolUpVersion
    }

    signingConfigs {
        if (signing != null) {
            create("release") {
                storeFile = file(signing.getValue("storeFile"))
                storePassword = signing.getValue("storePassword")
                keyAlias = signing.getValue("keyAlias")
                keyPassword = signing.getValue("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            // Installs next to the release build, which is signed with a different key.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        // New library versions come with SpoolUp releases, not from lint.
        disable += setOf("GradleDependency", "NewerVersionAvailable", "AndroidGradlePluginVersion", "OldTargetApi")
    }

    // No dependency metadata blob: it's only readable by Google, and the APK on GitHub
    // doesn't need it. Play builds don't either.
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    // The QR code scanner: CameraX for the preview and frames, ZXing to read the code.
    // Both work on the device alone; nothing is sent anywhere.
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    implementation("com.google.zxing:core:3.5.3")

    testImplementation("junit:junit:4.13.2")
}
