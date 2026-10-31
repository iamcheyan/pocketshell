#!/usr/bin/env bash
# Push app/ to the build host, compile the desktop variant, restart the window
# there and grab a screenshot. Use this after editing the UI.
#
#   scripts/desktop-run.sh            # build + run + capture
#   scripts/desktop-run.sh --no-shot  # build + run only
#
# Defaults target HX90 (NixOS, Hyprland). Override with DESKTOP_HOST,
# DESKTOP_SDK_DIR, DESKTOP_WAYLAND_DISPLAY.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
HOST=${DESKTOP_HOST:-HX90}
REMOTE_HOME=${DESKTOP_HOME:-$(ssh "$HOST" 'echo $HOME')}
SDK=${DESKTOP_SDK_DIR:-$REMOTE_HOME/development/pjs-app-build}
SHOT=1
[ "${1:-}" = "--no-shot" ] && SHOT=0

echo "== sync app -> $HOST:$SDK/apps/pocketshell"
rsync -a --delete "$REPO/app/" "$HOST:$SDK/apps/pocketshell/"

echo "== compile (linux-app)"
ssh "$HOST" "cd $SDK && export PATH=\$HOME/.bun/bin:\$PATH && \
  export POCKETJS_FONT_REGULAR=\$PWD/apps/pocketshell/fonts/FusionPixel-12px-monospaced-zh_hans.ttf \
         POCKETJS_FONT_BOLD=\$PWD/apps/pocketshell/fonts/FusionPixel-12px-monospaced-zh_hans.ttf \
         POCKETJS_FONT_MONO=\$PWD/apps/pocketshell/fonts/FusionPixel-12px-monospaced-zh_hans.ttf && \
  bun tools/pocket.ts compile --runtime-config programs/desktop/linux/pocket.runtime-config.ts \
    --target linux-app --manifest apps/pocketshell/pocket.json --output /tmp/pocketshell-desktop.pocket 2>&1 | tail -3"

echo "== build host (cargo cache reused)"
ssh "$HOST" "cd $SDK && export PATH=\$HOME/.bun/bin:\$PATH && \
  bun tools/pocket.ts build --config programs/desktop/linux/pocket.runtime-config.ts \
    --target linux-app --pocket /tmp/pocketshell-desktop.pocket --out /tmp/pocketshell-desktop 2>&1 | tail -2"

echo "== restart window"
ssh "$HOST" 'ps -eo pid,args | grep "[p]ocket-desktop-host" | awk "{print \$1}" | while read p; do kill "$p" 2>/dev/null; done; sleep 1'
ssh "$HOST" 'export XDG_RUNTIME_DIR=/run/user/1000; export WAYLAND_DISPLAY=$(basename "$(ls /run/user/1000/wayland-? 2>/dev/null | head -1)"); \
  export LD_LIBRARY_PATH=$(nix eval --raw nixpkgs#wayland)/lib:$(nix eval --raw nixpkgs#libxkbcommon)/lib:$(nix eval --raw nixpkgs#libGL)/lib:$(nix eval --raw nixpkgs#vulkan-loader)/lib:$(nix eval --raw nixpkgs#mesa)/lib; \
  cd /tmp/pocketshell-desktop/program && (setsid nohup ./run > /tmp/pocketshell-desktop.log 2>&1 &); sleep 8; tail -2 /tmp/pocketshell-desktop.log'

if [ "$SHOT" = 1 ]; then
	mkdir -p "$REPO/dist"
	ssh "$HOST" 'export XDG_RUNTIME_DIR=/run/user/1000; export WAYLAND_DISPLAY=$(basename "$(ls /run/user/1000/wayland-? 2>/dev/null | head -1)"); grim -t png /tmp/pocketshell-desktop.png'
	scp -q "$HOST:/tmp/pocketshell-desktop.png" "$REPO/dist/desktop.png"
	echo "screenshot: $REPO/dist/desktop.png"
fi
