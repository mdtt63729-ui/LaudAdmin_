#!/usr/bin/env bash
# Build a signed release APK for LAUD Admin (native Android, no Gradle).
# Needs: JDK 17+, Android SDK build-tools 34.0.0 + platforms/android-34.
set -euo pipefail
ulimit -v unlimited 2>/dev/null || true
export JAVA_OPTS="${JAVA_OPTS:--Xmx1024m}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app/src/main"
WORK="$HERE/build"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"

KEYSTORE="${KEYSTORE:-$HERE/keystore/laudadmin-release.jks}"
KS_PASS="${KS_PASS:-laudadmin2026}"
KS_ALIAS="${KS_ALIAS:-laudadmin}"
VERSION_CODE="${VERSION_CODE:-2}"
VERSION_NAME="${VERSION_NAME:-2.0.0}"

[ -f "$PLATFORM" ] || { echo "Missing $PLATFORM"; exit 1; }
echo "SDK: $SDK"

rm -rf "$WORK"
mkdir -p "$WORK/res" "$WORK/gen" "$WORK/classes" "$WORK/dex"

# 1. Resources
"$BT/aapt2" compile --dir "$APP/res" -o "$WORK/res/resources.zip"
LINK_ARGS=(
  -o "$WORK/app-unsigned.apk"
  -I "$PLATFORM"
  --manifest "$APP/AndroidManifest.xml"
  -R "$WORK/res/resources.zip"
  --java "$WORK/gen"
  --min-sdk-version 24
  --target-sdk-version 34
  --version-code "$VERSION_CODE"
  --version-name "$VERSION_NAME"
  --auto-add-overlay
)
if [ -d "$APP/assets" ]; then LINK_ARGS+=(-A "$APP/assets"); fi
"$BT/aapt2" link "${LINK_ARGS[@]}"

# 2. Java
find "$APP/java" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
set +e
javac -nowarn -source 11 -target 11 -classpath "$PLATFORM" \
  -d "$WORK/classes" @"$WORK/sources.txt" 2>&1 | grep -v 'bootstrap class path'
JAVAC_STATUS=${PIPESTATUS[0]}
set -e
if [ "$JAVAC_STATUS" -ne 0 ]; then
  echo "Compilation failed"; exit 1
fi

# 3. Dex
find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
"$BT/d8" --lib "$PLATFORM" --min-api 24 --output "$WORK/dex" @"$WORK/classes.txt"

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

# 4. Align + sign
"$BT/zipalign" -f -p 4 "$WORK/app-unsigned.apk" "$WORK/app-aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -v -keystore "$KEYSTORE" -storetype PKCS12 \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=LAUD Admin, OU=Mobile, O=LAUD, L=Kolkata, ST=West Bengal, C=IN" >/dev/null
  echo "Created keystore: $KEYSTORE"
fi

OUT="${OUT_APK:-$WORK/LAUD-Admin-$VERSION_NAME-release.apk}"
"$BT/apksigner" sign \
  --ks "$KEYSTORE" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" "$WORK/app-aligned.apk"

"$BT/apksigner" verify --print-certs "$OUT" | head -3
echo "APK: $OUT"
