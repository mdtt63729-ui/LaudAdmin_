# LAUDA Admin — Native Android (Kotlin + Jetpack Compose + Material 3) APK Project

This directory contains the complete Native Android Clean Architecture project structure for **LAUDA Admin**, including:

- **Gradle Kotlin DSL** (`settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, `app/build.gradle.kts`)
- **Encrypted PAT Storage** (`KeystoreTokenStore.kt`) using Android Keystore + `EncryptedSharedPreferences`
- **GitHub REST API & Version History** (`GitHubApiService.kt`) with SHA conflict detection and commit history retrieval
- **Type-Safe JSON Engine & Undo/Redo Stack** (`JsonTreeEngine.kt`, `UndoRedoManager.kt`)
- **Material 3 Expressive Spring Compose UI** (`MainActivity.kt`, `JsonDashboardScreen.kt`, `JsonEditorScreen.kt`)
- **Automated APK CI Workflow** (`.github/workflows/build-apk.yml`)

## How to Build the APK
1. Open `lauda-admin-android/` in **Android Studio Ladybug+** (or push to GitHub with `.github/workflows/build-apk.yml` to produce the APK artifact automatically).
2. Run:
   ```bash
   ./gradlew assembleDebug
   ```
   Output APK path: `app/build/outputs/apk/debug/app-debug.apk`
3. For release APK:
   ```bash
   ./gradlew assembleRelease
   ```
