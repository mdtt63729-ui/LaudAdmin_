# Android APK project

A thin native shell that ships the LAUD Admin web bundle as an installable APK.

```
app/src/main/
├── AndroidManifest.xml            minSdk 24, targetSdk 34, package com.laudadmin
├── java/com/laudadmin/MainActivity.java
├── assets/lauda-shim.js           on-device replacement for the Express /api routes
└── res/                           launcher icon + app name
build-apk.sh                       aapt2 + javac + d8 + zipalign + apksigner
```

## Build

```bash
npm install --legacy-peer-deps && npm run build     # repo root, creates dist/
export ANDROID_HOME=/path/to/android-sdk            # needs build-tools;34.0.0, platforms;android-34
KS_PASS='your-keystore-password' bash android-app/build-apk.sh
```

Output: `android-app/build/LAUD-Admin-1.0.0-release.apk` (v1 + v2 + v3 signatures).

## Signing

`build-apk.sh` signs with `android-app/keystore/laudadmin-release.jks` (alias `laudadmin`).
The keystore is deliberately **not** in this repository: whoever holds it can push updates that
Android will accept over your installed copy.

* If the file is missing, the script generates a new keystore on the first run.
* Override the location with `KEYSTORE=/path/to/file.jks`, and the password with `KS_PASS`.

Keep the `.jks` file and its password somewhere safe — losing it means you cannot update an
already-installed copy (you would have to uninstall first).

## CI

`.github/workflows/build-apk.yml` builds the web bundle and the APK on every push. Add these
repository secrets to get a signed artifact:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 laudadmin-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |

Without the secrets the workflow still builds and uploads an APK signed with a throwaway key — fine for testing, not for updates over an installed copy.

## Version bumps

`app/src/main/AndroidManifest.xml` (`android:versionCode` / `android:versionName`) and the
`--version-code` / `--version-name` flags in `build-apk.sh`. `versionCode` must increase for every
release.
