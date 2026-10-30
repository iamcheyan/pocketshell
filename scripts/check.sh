#!/usr/bin/env bash
# Admission-check the built package on the real handheld without touching the
# installed launcher. Pushes to /storage/pjs/ and runs the runtime's --check.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
PKG=${1:-$REPO/dist/pocketshell.pocket}
JUMP=${HANDHELD_JUMP:-HX90}
SERIAL=${HANDHELD_SERIAL:-5c0010894414c802512}
REMOTE=/storage/pjs/pocketshell.pocket

[ -f "$PKG" ] || { echo "check: no package at $PKG (run make build)" >&2; exit 1; }

scp -q "$PKG" "$JUMP:/tmp/pocketshell.pocket"
ssh "$JUMP" "adb -s $SERIAL push /tmp/pocketshell.pocket $REMOTE >/dev/null && \
  adb -s $SERIAL shell '/storage/System/pocketjs/bin/pocket-linux-kms --package $REMOTE --check'"
