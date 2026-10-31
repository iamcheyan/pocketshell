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

[ -d "$SDK/contracts" ] || { echo "desktop-local: no PocketJS SDK at $SDK (set POCKETJS_SDK=…)" >&2; exit 1; }

echo "== stage app -> $SDK/apps/pocketshell"
rsync -a --delete "$REPO/app/" "$SDK/apps/pocketshell/"

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
ps -eo pid,args | grep "[p]ocket-desktop-host" | awk '{print $1}' | while read -r p; do kill "$p" 2>/dev/null || true; done
sleep 1
"$BUN" tools/pocket.ts build \
  --config programs/desktop/linux/pocket.runtime-config.ts \
  --target linux-app --pocket /tmp/pocketshell-desktop.pocket \
  --out /tmp/pocketshell-desktop 2>&1 | tail -2

echo "== restart window"
ps -eo pid,args | grep "[p]ocket-desktop-host" | awk '{print $1}' | while read -r p; do kill "$p" 2>/dev/null || true; done
sleep 1

export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
	WAYLAND_DISPLAY=$(basename "$(ls "$XDG_RUNTIME_DIR"/wayland-? 2>/dev/null | head -1)" 2>/dev/null || true)
	export WAYLAND_DISPLAY
fi
# NixOS does not put the desktop libraries on the loader path and winit dlopens them.
if [ -z "${LD_LIBRARY_PATH:-}" ] && command -v nix >/dev/null 2>&1; then
	LD_LIBRARY_PATH=$(nix eval --raw nixpkgs#wayland)/lib:$(nix eval --raw nixpkgs#libxkbcommon)/lib:$(nix eval --raw nixpkgs#libGL)/lib:$(nix eval --raw nixpkgs#vulkan-loader)/lib:$(nix eval --raw nixpkgs#mesa)/lib
	export LD_LIBRARY_PATH
fi

cd /tmp/pocketshell-desktop/program
setsid nohup ./run > /tmp/pocketshell-desktop.log 2>&1 &
sleep 8
tail -2 /tmp/pocketshell-desktop.log

if [ "$SHOT" = 1 ]; then
	mkdir -p "$REPO/dist"
	if command -v grim >/dev/null 2>&1; then
		grim -t png "$REPO/dist/desktop.png" && echo "screenshot: $REPO/dist/desktop.png"
	fi
fi
