import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.androidx.room3)
}

android {
    namespace = "com.kairos.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.kairos.app"
        minSdk = 26
        targetSdk = 37
        versionCode = 373
        versionName = "0.321.0"

        // Baked in at build time so the app can show when this build was made.
        val buildDate = SimpleDateFormat("MMM d, yyyy", Locale.US).format(Date())
        buildConfigField("String", "BUILD_DATE", "\"$buildDate\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        // The release key is supplied by CI through environment variables
        // (decoded from GitHub secrets). Kept out of the repo entirely. When the
        // env vars are absent (e.g. a local debug build), this stays empty and
        // the release type simply goes unsigned rather than failing to configure.
        create("release") {
            val keystorePath = System.getenv("KEYSTORE_FILE")
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // Sign with the stable release key when CI provides it, so every
            // build installs over the last one and enrollment persists.
            if (System.getenv("KEYSTORE_FILE") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
            // R8 minify/shrink left off until we can verify on-device that no
            // Compose/serialization/Retrofit member gets stripped; the keep
            // rules in proguard-rules.pro are ready for when we enable it.
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// Kotlin toolchain is a top-level extension (not nested in android {}). This
// sets both the Java and Kotlin compile targets to 17.
kotlin {
    jvmToolchain(17)
}

// Room 3 schema export. The generated schema JSON is checked into app/schemas
// as a record of each version. We use destructive migration for this DB (it's a
// disposable read cache), so these schemas are documentation, not migration
// inputs — but the Room Gradle Plugin requires a directory when exportSchema is on.
room3 {
    schemaDirectory("$projectDir/schemas")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.androidx.datastore.preferences)

    // Room 3 (local persistence) + bundled SQLite so the DB uses one consistent
    // SQLite build across all devices rather than the OS copy. room3-compiler
    // runs via KSP (Room 3 is KSP-only).
    implementation(libs.androidx.room3.runtime)
    implementation(libs.androidx.sqlite.bundled)
    ksp(libs.androidx.room3.compiler)

    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp.logging)
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    debugImplementation(libs.androidx.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
}
