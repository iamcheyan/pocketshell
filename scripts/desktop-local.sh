#!/usr/bin/env bash
# Same as desktop-run.sh, but for a checkout that lives ON the build/desktop host:
# no ssh, no rsync over the network — stage into the local PocketJS SDK, compile,
# restart the window here.
#
#   scripts/desktop-local.sh            # build + run + capture
#   scripts/desktop-local.sh --no-shot  # build + run only
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
SDK=${POCKETJS_SDK:-$HOME/development/pjs-app-build}
BUN=${BUN:-$(command -v bun || echo "$HOME/.bun/bin/bun")}
SHOT=1
[ "${1:-}" = "--no-shot" ] && SHOT=0

# Leave independent previews and other PocketJS apps running.
stop_desktop() {
  python3 - <<'PY'
import os
from pathlib import Path
import signal
for entry in Path('/proc').glob('[0-9]*'):
    try:
        if (entry / 'comm').read_text().strip().startswith('pocket-desktop') and (entry / 'cwd').resolve() == Path('/tmp/pocketshell-desktop/program'):
            os.kill(int(entry.name), signal.SIGTERM)
    except (OSError, ValueError):
        pass
PY
}

[ -d "$SDK/contracts" ] || { echo "desktop-local: no PocketJS SDK at $SDK (set POCKETJS_SDK=…)" >&2; exit 1; }

echo "== stage app -> $SDK/apps/pocketshell"
rsync -a --delete "$REPO/app/" "$SDK/apps/pocketshell/"
"$BUN" "$REPO/scripts/stage-library-glyphs.ts" "$SDK/apps/pocketshell"
"$BUN" -e 'const path = process.argv[1]; const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(path, "utf8")); manifest.app.viewport.fixed.presentation = "native"; fs.writeFileSync(path, JSON.stringify(manifest, null, 2));' "$SDK/apps/pocketshell/pocket.json"

# The SDK has no host bridge: the device build gets ui.__launcher from
# pocketshell-launcher.rs via ROCKNIX's patch-runtime.py. Install this repo's
# local equivalent every time, or a stale copy silently answers with old data.
python3 "$REPO/scripts/patch-desktop-bridge.py" "$SDK"
python3 "$REPO/scripts/patch-desktop-touch.py" "$SDK"
(cd "$SDK" && cargo metadata --offline --no-deps --format-version 1 >/dev/null)

export PATH="$(dirname "$BUN"):$PATH"
export POCKETJS_FONT_REGULAR="$REPO/app/fonts/FusionPixel-12px-monospaced-zh_hans.ttf"
export POCKETJS_FONT_BOLD="$POCKETJS_FONT_REGULAR"
export POCKETJS_FONT_MONO="$POCKETJS_FONT_REGULAR"

echo "== compile (linux-app)"
cd "$SDK"
"$BUN" tools/pocket.ts compile \
  --runtime-config programs/desktop/linux/pocket.runtime-config.ts \
  --target linux-app --manifest apps/pocketshell/pocket.json \
  --output /tmp/pocketshell-desktop.pocket 2>&1 | tail -3

echo "== build host (cargo cache reused)"
# The build copies the binary over the previous one; a running window keeps it
# busy (ETXTBSY), so stop it first.
stop_desktop
sleep 1
"$BUN" tools/pocket.ts build \
  --config programs/desktop/linux/pocket.runtime-config.ts \
  --target linux-app --pocket /tmp/pocketshell-desktop.pocket \
  --out /tmp/pocketshell-desktop 2>&1 | tail -2

echo "== restart window"
stop_desktop
sleep 1

export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
if [ -z "${WAYLAND_DISPLAY:-}" ] && [ "${WINIT_UNIX_BACKEND:-}" != x11 ]; then
	WAYLAND_DISPLAY=$(basename "$(ls "$XDG_RUNTIME_DIR"/wayland-? 2>/dev/null | head -1)" 2>/dev/null || true)
	export WAYLAND_DISPLAY
fi
# NixOS does not put the desktop libraries on the loader path and winit dlopens
# them; prepend them to whatever LD_LIBRARY_PATH already exists.
if command -v nix >/dev/null 2>&1; then
	extra="$(nix eval --raw nixpkgs#wayland)/lib:$(nix eval --raw nixpkgs#libxkbcommon)/lib:$(nix eval --raw nixpkgs#libGL)/lib:$(nix eval --raw nixpkgs#vulkan-loader)/lib:$(nix eval --raw nixpkgs#mesa)/lib"
	export LD_LIBRARY_PATH="$extra${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

# The window maps focused, which takes the keyboard away from whatever the user
# was doing. Remember the window that had focus, then hand it back as soon as the
# preview's own window appears — the steal is a few milliseconds, not the seconds
# the shader and atlas work take. Clicking the preview focuses it as usual.
previous=""
if command -v hyprctl >/dev/null 2>&1; then
	previous=$(hyprctl -j activewindow 2>/dev/null | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("address") or "")
except Exception:
    print("")' 2>/dev/null || true)
fi

cd /tmp/pocketshell-desktop/program
setsid nohup ./run > /tmp/pocketshell-desktop.log 2>&1 &
launched=$!

if [ -n "$previous" ] && [ "$previous" != "0x0" ] && command -v hyprctl >/dev/null 2>&1; then
	for _ in $(seq 1 120); do
		if hyprctl -j clients 2>/dev/null | python3 -c "
import json, os, sys
wanted = $launched
for client in json.load(sys.stdin):
    if client.get('pid') == wanted:
        sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
			hyprctl dispatch "hl.dsp.focus({ window = \"address:$previous\" })" >/dev/null 2>&1 || true
			break
		fi
		sleep 0.05
	done
fi

sleep 8
tail -2 /tmp/pocketshell-desktop.log

if [ "$SHOT" = 1 ]; then
	mkdir -p "$REPO/dist"
	if command -v grim >/dev/null 2>&1; then
		grim -t png "$REPO/dist/desktop.png" && echo "screenshot: $REPO/dist/desktop.png"
	fi
fi
