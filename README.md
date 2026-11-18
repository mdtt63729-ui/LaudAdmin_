# LAUD Admin

A GitHub JSON administration console for Android: sign in with a personal access token, pick a
repository and branch, browse every `.json` file in the tree, edit it with validation and
pretty-printing, and commit straight back to GitHub with SHA-conflict protection and full commit
history.

```
.
├── android-app/        Native Android app (Java, no WebView) — this is the real APK
├── android-webview/    Older WebView wrapper around the React build (kept for reference)
├── src/, server.ts     Original React + Vite + Express version of the app
└── .github/workflows/  CI that builds and signs the APK
```

## Download the APK

Grab the latest release from the **Releases** page (or the `android-app/build` artifact from CI),
copy it to your phone and install it. minSdk 24 (Android 7+), targetSdk 34.

## What the native app does

| Screen | Features |
| --- | --- |
| Sign in | Personal access token, verified against `/user`, encrypted at rest with an AES-256-GCM key held in the Android Keystore |
| Repositories | All repos you can push to, live filter, paging, "load more" |
| Files | Branch switcher, every `.json` blob in the branch, path + size |
| Editor | Monospace JSON editor, Validate, Format (2-space), commit with message, SHA-conflict detection with Reload / Overwrite |
| History | Last 25 commits for the file, tap to read that version read-only |

The token never leaves the device: all requests go straight to `api.github.com` over HTTPS from the
app, with no backend in between.

## Build from source

Needs JDK 17+, Android SDK `build-tools;34.0.0` and `platforms;android-34`. No Gradle.

```bash
export ANDROID_HOME=/path/to/android-sdk
KS_PASS='your-keystore-password' bash android-app/build-apk.sh
# -> android-app/build/LAUD-Admin-2.0.0-release.apk
```

The script drives `aapt2` → `javac` → `d8` → `zipalign` → `apksigner` and produces a release APK
signed with v1 + v2 + v3 signatures. See `android-app/README.md` for signing details.

## Web version (original)

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:3000, needs GEMINI_API_KEY for the Deep Think feature
npm run build    # dist/
```

The Deep Think AI feature only exists in the web/Express version — the native app does not ship a
Gemini key, so that button is not part of the APK.

## Security notes

* The token is encrypted with a Keystore key (AES-256-GCM) and stored in the app's private
  SharedPreferences. Uninstalling the app destroys the key, so the ciphertext becomes useless.
* Cleartext traffic is disabled; only HTTPS is allowed.
* Use a fine-grained token limited to the repositories you actually administer.
