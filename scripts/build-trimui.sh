#!/usr/bin/env bash
# Build PocketShell package specifically for TrimUI Smart Pro (1280x720 / 640x360).
# Uses Sarasa Gothic (更纱黑体) with anti-aliasing for smooth, high-fidelity typography.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
SDK=${POCKETJS_SDK:-$HOME/development/.pocketjs-star-drift-sdk}
BUN=${BUN:-$HOME/.bun/bin/bun}
APP_DIR="$SDK/apps/pocketshell"
TARGET="trimui-tsp-fbdev"
OUT="/tmp/pocketshell-trimui.pocket"

[ -x "$BUN" ] || { echo "build: bun not found at $BUN" >&2; exit 1; }
[ -d "$SDK/contracts" ] || { echo "build: PocketJS SDK not found at $SDK" >&2; exit 1; }

FONT_REGULAR="$REPO/app/fonts/SarasaUiSC-Regular.ttf"
FONT_BOLD="$REPO/app/fonts/SarasaUiSC-Bold.ttf"

mkdir -p "$APP_DIR"
python3 "$REPO/scripts/patch-pocketjs-font-args.py" "$SDK"
python3 "$REPO/scripts/patch-pocketjs-bitmap-font.py" "$SDK"
rsync -a --delete "$REPO/app/" "$APP_DIR/"

# Update pocket.json for 640x360 viewport
python3 -c "
import json
path = '$APP_DIR/pocket.json'
with open(path) as f:
    d = json.load(f)
d['app']['viewport'] = {'fixed': {'logical': [640, 360], 'presentation': 'integer-fit'}}
with open(path, 'w') as f:
    json.dump(d, f, indent=2)
"

"$BUN" "$REPO/scripts/stage-library-glyphs.ts" "$APP_DIR"

cd "$SDK"
echo "== check"
"$BUN" tools/pocket.ts check \
  --runtime-config "programs/trimui-tsp/pocket.runtime-config.ts" \
  --target "$TARGET" \
  --manifest "apps/pocketshell/pocket.json"

echo "== compile (anti-aliased Sarasa Gothic)"
POCKETJS_FONT_ANTIALIAS=1 "$BUN" tools/pocket.ts compile \
  --runtime-config "programs/trimui-tsp/pocket.runtime-config.ts" \
  --target "$TARGET" \
  --manifest "apps/pocketshell/pocket.json" \
  --font-regular "$FONT_REGULAR" \
  --font-bold "$FONT_BOLD" \
  --font-mono "$FONT_REGULAR" \
  --output "$OUT"

echo "== inspect"
"$BUN" tools/pocket-pack.ts inspect "$OUT"
sha256sum "$OUT"
ls -l "$OUT"
