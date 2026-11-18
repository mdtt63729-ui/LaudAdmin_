# LAUD Admin

A Material 3 GitHub JSON administration console: browse a repository's JSON files, edit them in a
type-safe tree editor, validate against SHA conflicts, review commit history and commit straight
back to GitHub.

This repository contains the original React + Vite web app **and** an Android wrapper project that
ships the same UI as a signed, installable APK.

```
.
├── src/                  React + TypeScript app (Material 3 UI, i18n: en / bn / hi)
├── server.ts             Express backend used when running on the web (GitHub REST proxy)
├── android-app/          Android APK project (WebView shell + on-device API shim)
└── .github/workflows/    CI: builds the web bundle and the APK
```

## Run the web app

```bash
npm install --legacy-peer-deps
echo "GEMINI_API_KEY=your-key" > .env.local   # only needed for the Deep Think feature
npm run dev                                    # http://localhost:3000
npm run build                                  # production bundle in dist/
```

## Build the Android APK

The APK is built **without Gradle** — the script drives `aapt2`, `javac`, `d8`, `zipalign` and
`apksigner` from the Android SDK directly. Requirements: JDK 17+, Android SDK
`build-tools;34.0.0` and `platforms;android-34`.

```bash
npm install --legacy-peer-deps
npm run build                       # produces dist/
export ANDROID_HOME=/path/to/android-sdk
bash android-app/build-apk.sh       # -> android-app/build/LAUD-Admin-1.0.0-release.apk
```

The signing keystore is **not** committed. Put yours at `android-app/keystore/laudadmin-release.jks`
and pass the password with `KS_PASS=...` (see `android-app/README.md`).

## How the Android build works

* `android-app/app/src/main/java/com/laudadmin/MainActivity.java` hosts the web bundle in a WebView.
  The bundle is served from a virtual origin (`https://lauda.local`) through
  `shouldInterceptRequest`, so ES modules, `localStorage` and `fetch` behave exactly as they do in
  a browser — no `file://` quirks.
* `android-app/app/src/main/assets/lauda-shim.js` re-implements the `/api/...` endpoints of
  `server.ts` directly against `api.github.com`, so the phone does not need a Node server. The
  Personal Access Token you paste in stays on the device (WebView `localStorage`).
* Deep Think (`/api/ai/think`) needs a Gemini key on a server; in the APK it returns a clear
  "not available in this build" error and the rest of the app keeps working.

## Security notes

* The token is stored in the WebView's `localStorage` for the app's private data directory. Uninstall
  the app to erase it, or use **Settings → Disconnect**.
* `usesCleartextTraffic` is off and mixed content is blocked; only HTTPS traffic leaves the device.
