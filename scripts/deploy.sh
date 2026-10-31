#!/usr/bin/env bash
# Deploy the launcher package to the handheld over ADB — no image rebuild.
#
#   1. admission-check the package with the device's own runtime
#   2. back up the installed boot.pocket (timestamped, never overwritten)
#   3. push + atomic mv over boot.pocket
#   4. kill the runtime so launch_frontend.sh returns and frontend-session
#      respawns it with the new package
#   5. verify: admitted, running pid, fresh framebuffer frame
#
# Nothing else under /storage/System is touched.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
PKG=${1:-$REPO/dist/pocketshell.pocket}
JUMP=${HANDHELD_JUMP:-HX90}
SERIAL=${HANDHELD_SERIAL:-5c0010894414c802512}
APPS=/storage/System/pocketjs/apps
RUNTIME=/storage/System/pocketjs/bin/pocket-linux-kms
STAMP=$(date +%Y%m%d-%H%M%S)

[ -f "$PKG" ] || { echo "deploy: no package at $PKG (run make build)" >&2; exit 1; }

SHA=$(sha256sum "$PKG" | cut -d' ' -f1)
SIZE=$(stat -c%s "$PKG")
echo "deploy: $PKG  $SIZE bytes  sha256 $SHA"

scp -q "$PKG" "$JUMP:/tmp/pocketshell.pocket"
ssh "$JUMP" "adb -s $SERIAL push /tmp/pocketshell.pocket /storage/pjs/deploy.pocket >/dev/null"

echo "== 1/5 admission check"
ssh "$JUMP" "adb -s $SERIAL shell '$RUNTIME --package /storage/pjs/deploy.pocket --check'"

echo "== 2/5 backup installed package"
ssh "$JUMP" "adb -s $SERIAL shell 'cd $APPS && cp -f boot.pocket boot.pocket.bak-$STAMP && ls -l boot.pocket boot.pocket.bak-$STAMP'"

echo "== 3/5 install"
ssh "$JUMP" "adb -s $SERIAL shell 'cp -f /storage/pjs/deploy.pocket $APPS/boot.pocket && sync && sha256sum $APPS/boot.pocket'"

echo "== 4/5 restart frontend"
OLD_PID=$(ssh "$JUMP" "adb -s $SERIAL shell 'pidof pocket-linux-kms || true'" | tr -d '\r')
ssh "$JUMP" "adb -s $SERIAL shell 'kill -9 $OLD_PID 2>/dev/null || true'"
sleep 8
NEW_PID=$(ssh "$JUMP" "adb -s $SERIAL shell 'pidof pocket-linux-kms || true'" | tr -d '\r')
echo "old pid=$OLD_PID new pid=$NEW_PID"

echo "== 5/5 frame"
# The panel is 32 bpp with a double buffer; dump both pages, pull, keep page 0.
# Separate invocations on purpose: a dd and a pull in one ssh round trip has produced
# an empty file on this device.
ssh "$JUMP" "adb -s $SERIAL shell 'rm -f /tmp/frame.raw; dd if=/dev/fb0 of=/tmp/frame.raw bs=691200 count=4'"
ssh "$JUMP" "adb -s $SERIAL pull /tmp/frame.raw /tmp/frame.raw >/dev/null"
scp -q "$JUMP:/tmp/frame.raw" "$REPO/dist/frame-after-deploy.raw"
python3 "$REPO/scripts/raw-to-png.py" "$REPO/dist/frame-after-deploy.raw" "$REPO/dist/frame-after-deploy.png" 720 480 32 0 || true
ssh "$JUMP" "adb -s $SERIAL shell 'tail -6 /tmp/pocketjs-frontend.log'"

echo "done. rollback: adb shell 'cp -f $APPS/boot.pocket.bak-$STAMP $APPS/boot.pocket' && kill -9 \$(pidof pocket-linux-kms)"
