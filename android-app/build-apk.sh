#!/usr/bin/env bash
# Build a signed release APK for LAUD Admin without Gradle.
# Needs: JDK 17+, Android SDK build-tools 34.0.0 + platforms/android-34,
#        and the built web app (npm run build in the repo root -> dist/).
set -euo pipefail
ulimit -v unlimited 2>/dev/null || true
export JAVA_OPTS="${JAVA_OPTS:--Xmx1024m}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
APP="$HERE/app/src/main"
WORK="$HERE/build"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
DIST="${DIST_DIR:-$ROOT/dist}"

KEYSTORE="${KEYSTORE:-$HERE/keystore/laudadmin-release.jks}"
KS_PASS="${KS_PASS:-laudadmin2026}"
KS_ALIAS="${KS_ALIAS:-laudadmin}"

echo "SDK: $SDK"
[ -f "$PLATFORM" ] || { echo "Missing $PLATFORM"; exit 1; }
[ -d "$DIST" ] || { echo "Missing web build at $DIST (run: npm run build)"; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK/res" "$WORK/gen" "$WORK/classes" "$WORK/dex" "$WORK/assets"

# 1. Bundle the web build + on-device API shim into assets/
cp -r "$DIST"/. "$WORK/assets"/
cp "$APP/assets/lauda-shim.js" "$WORK/assets/lauda-shim.js"
python3 - "$WORK/assets/index.html" <<'PY'
import sys, re
p = sys.argv[1]
html = open(p, encoding='utf-8').read()
if 'lauda-shim.js' not in html:
    tag = '<script src="/lauda-shim.js"></script>'
    # inject before the first module script so fetch() is patched before app code runs
    html = re.sub(r'(<script[^>]*type="module")', tag + r'\1', html, count=1)
    open(p, 'w', encoding='utf-8').write(html)
PY

# 2. Compile + link resources
"$BT/aapt2" compile --dir "$APP/res" -o "$WORK/res/resources.zip"
"$BT/aapt2" link \
  -o "$WORK/app-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" \
  -R "$WORK/res/resources.zip" \
  -A "$WORK/assets" \
  --java "$WORK/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 --version-name 1.0.0 \
  --auto-add-overlay

# 3. Compile Java
find "$APP/java" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
javac -nowarn -source 11 -target 11 -classpath "$PLATFORM" \
  -d "$WORK/classes" @"$WORK/sources.txt" 2>&1 | grep -v 'bootstrap class path' || true

# 4. Dex
find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
"$BT/d8" --lib "$PLATFORM" --min-api 24 --output "$WORK/dex" @"$WORK/classes.txt"

# 5. Pack classes.dex into the APK
python3 - "$WORK/app-unsigned.apk" "$WORK/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
apk, dex = sys.argv[1], sys.argv[2]
tmp = apk + '.tmp'
with zipfile.ZipFile(apk) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        zout.writestr(item, zin.read(item.filename))
    zout.write(dex, 'classes.dex')
shutil.move(tmp, apk)
PY

# 6. Align
"$BT/zipalign" -f -p 4 "$WORK/app-unsigned.apk" "$WORK/app-aligned.apk"

# 7. Keystore (created once, reused afterwards)
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -storetype PKCS12 \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=LAUD Admin, OU=Mobile, O=LAUD, L=Kolkata, ST=West Bengal, C=IN" >/dev/null
  echo "Created keystore: $KEYSTORE"
fi

# 8. Sign (v1 + v2 + v3)
OUT="${OUT_APK:-$HERE/build/LAUD-Admin-1.0.0-release.apk}"
"$BT/apksigner" sign \
  --ks "$KEYSTORE" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" "$WORK/app-aligned.apk"

"$BT/apksigner" verify --print-certs "$OUT" | head -5
echo "APK: $OUT"
