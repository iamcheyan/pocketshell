#!/usr/bin/env python3
"""Make PocketJS's baked font coverage 1-bit so text renders as hard pixels.

The compiler supersamples glyph outlines (9x3) into 0..255 grayscale coverage,
which keeps thin Latin stems smooth but shows antialiased gray edges next to
true pixel-art UI. PJOS presents a 360x240 canvas at integer 2x, so gray edges
become 2x2 gray blocks: the text reads as blurry rather than bitmap.

This patch thresholds each coverage cell at 128, giving a crisp 1-bit atlas.
It is idempotent and fails loudly if the compiler anchor moves.

    python3 scripts/patch-pocketjs-bitmap-font.py <sdk-root>
"""
from pathlib import Path
import sys

MARKER = "const coverage = Math.round((counts[x] * 255) / samplesPerPixel);"
ANCHOR = """    for (let x = 0; x < cellW; x++) {
      out[row * cellW + x] = Math.round((counts[x] * 255) / samplesPerPixel);
    }"""
REPLACEMENT = """    for (let x = 0; x < cellW; x++) {
      // 1-bit atlas: PJOS presents the canvas at integer scale, so gray coverage
      // would be magnified into visible 2x2 blocks instead of pixel-art edges.
      const coverage = Math.round((counts[x] * 255) / samplesPerPixel);
      out[row * cellW + x] = coverage > 127 ? 255 : 0;
    }"""

if len(sys.argv) != 2:
    raise SystemExit(__doc__)

sdk = Path(sys.argv[1]).resolve()
path = sdk / "framework/compiler/bake-font.ts"
if not path.is_file():
    raise SystemExit(f"patch-pocketjs-bitmap-font: no compiler at {path}")

source = path.read_text()
if MARKER in source:
    print("PocketJS font baking already thresholds coverage to 1-bit")
    raise SystemExit(0)
if source.count(ANCHOR) != 1:
    raise SystemExit("patch-pocketjs-bitmap-font: coverage anchor not found exactly once")

path.write_text(source.replace(ANCHOR, REPLACEMENT, 1))
print("PocketJS font baking now thresholds coverage to 1-bit")
