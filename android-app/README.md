# android-app — native Android client

Plain Android (Java) with no third-party libraries, no WebView and no Gradle: the build script
drives the SDK tools directly.

```
app/src/main/
├── AndroidManifest.xml          minSdk 24, targetSdk 34, package com.laudadmin
├── java/com/laudadmin/
│   ├── MainActivity.java        sign-in, repository picker, JSON file browser
│   ├── EditorActivity.java      editor, validation, commit, history
│   ├── Api.java                 GitHub REST client (HttpURLConnection + org.json)
│   ├── Store.java               token encrypted with an Android Keystore AES-GCM key
│   └── Ui.java                  programmatic Material-ish widgets (dark theme)
└── res/                         launcher icon + app name
build-apk.sh                     aapt2 + javac + d8 + zipalign + apksigner
```

## Build

```bash
export ANDROID_HOME=/path/to/android-sdk   # build-tools;34.0.0 + platforms;android-34
KS_PASS='your-keystore-password' bash android-app/build-apk.sh
```

Output: `android-app/build/LAUD-Admin-2.0.0-release.apk`.

`VERSION_CODE` and `VERSION_NAME` environment variables override the version baked into the
manifest — remember to bump `versionCode` for every release, or Android refuses the update.

## Signing

`build-apk.sh` signs with `android-app/keystore/laudadmin-release.jks` (alias `laudadmin`,
password from `KS_PASS`, default `laudadmin2026`). The keystore is **not** committed: whoever holds
it can push updates that Android will accept over your installed copy. If the file is missing the
script generates a new one on the first run.

Keep the `.jks` and its password safe. Lose them and you cannot update an installed copy — you have
to uninstall first.

## CI

`.github/workflows/build-apk.yml` builds and signs on every push. Add these repository secrets for a
stable signature:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 laudadmin-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |

Without them the workflow still builds, signing with a throwaway key.

## How the GitHub calls work

| Action | Endpoint |
| --- | --- |
| Verify token | `GET /user` |
| Repositories | `GET /user/repos?sort=updated&per_page=100&page=n` |
| Branches | `GET /repos/{o}/{r}/branches` |
| JSON files | `GET /repos/{o}/{r}/git/trees/{branch}?recursive=1` (filtered to `.json` blobs) |
| Read file | `GET /repos/{o}/{r}/contents/{path}?ref={branch}` |
| Commit | `PUT /repos/{o}/{r}/contents/{path}` with the previous blob `sha` |
| History | `GET /repos/{o}/{r}/commits?path={path}&sha={branch}` |

A `409` on commit means someone else changed the file first; the app offers **Reload** or
**Overwrite** (which re-reads the remote SHA and retries).
