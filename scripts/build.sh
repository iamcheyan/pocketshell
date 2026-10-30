#!/usr/bin/env bash
# Build the PocketShell launcher package (.pocket) against the PocketJS SDK.
#
# The PocketJS CLI only compiles an app that lives inside the SDK tree, so this
# script stages the app into $POCKETJS_SDK/apps/rocknix-h700 and the runtime
# profile into $POCKETJS_SDK/programs/rocknix-h700 (the same layout the ROCKNIX
# package uses), compiles, and copies the artifact back to dist/.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
SDK=${POCKETJS_SDK:-$HOME/development/.pocketjs-star-drift-sdk}
BUN=${BUN:-$HOME/.bun/bin/bun}
APP_DIR="$SDK/apps/pocketshell"
PROGRAM_DIR="$SDK/programs/pocketshell"
TARGET=${POCKETJS_TARGET:-rocknix-h700-kms}
OUT="$REPO/dist/pocketshell.pocket"

[ -x "$BUN" ] || { echo "build: bun not found at $BUN (set BUN=...)" >&2; exit 1; }
[ -d "$SDK/contracts" ] || { echo "build: PocketJS SDK not found at $SDK (set POCKETJS_SDK=...)" >&2; exit 1; }

# The package bakes its glyph atlas from these three faces. The device build uses
# the zh_hans subset for all slots, with the ja and Nerd faces as fallbacks via
# fonts.json — keep that identical or the panel loses glyphs.
FONT="$REPO/app/fonts/FusionPixel-12px-monospaced-zh_hans.ttf"
export POCKETJS_FONT_REGULAR="$FONT"
export POCKETJS_FONT_BOLD="$FONT"
export POCKETJS_FONT_MONO="$FONT"

mkdir -p "$APP_DIR" "$PROGRAM_DIR" "$REPO/dist"
rsync -a --delete "$REPO/app/" "$APP_DIR/"
cp "$REPO/config/profile.ts" "$PROGRAM_DIR/profile.ts"
cp "$REPO/config/pocket.runtime-config.ts" "$PROGRAM_DIR/pocket.runtime-config.ts"

cd "$SDK"
echo "== check"
"$BUN" tools/pocket.ts check \
  --runtime-config "programs/pocketshell/pocket.runtime-config.ts" \
  --target "$TARGET" \
  --manifest "apps/pocketshell/pocket.json"

echo "== compile"
"$BUN" tools/pocket.ts compile \
  --runtime-config "programs/pocketshell/pocket.runtime-config.ts" \
  --target "$TARGET" \
  --manifest "apps/pocketshell/pocket.json" \
  --output "$OUT"

echo "== package"
"$BUN" tools/pocket-pack.ts inspect "$OUT"
sha256sum "$OUT"
ls -l "$OUT"
