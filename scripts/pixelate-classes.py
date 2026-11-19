#!/usr/bin/env python3
"""One-shot: strip anti-aliased shapes (rounded corners, blurred shadows) from class literals.

The launcher is a 360x240 logical canvas shown at 2x with nearest-neighbour
sampling. Rounded rects and soft shadows rasterise with grey edge pixels, which
become 2x2 smudges. Square corners and 1-2px borders stay crisp.
"""
import re, sys
from pathlib import Path
root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
TOK = re.compile(r'(?<=[\s"`])(?:rounded(?:-\[[^\]]*\]|-[a-z0-9]+)?|shadow(?:-[a-z]+)?)(?=[\s"`])')
for p in sorted(root.glob("app/**/*.tsx")):
    s = p.read_text(); o = s
    def lit(m):
        t = TOK.sub("", m.group(0)); t = re.sub(r"  +", " ", t)
        t = t.replace('" ', '"').replace(' "', '"')
        return t
    s = re.sub(r'"[^"\n]*(?:rounded|shadow)[^"\n]*"', lit, s)
    s = re.sub(r"\bradius:\s*[0-9.]+", "radius: 0", s)
    if s != o:
        p.write_text(s); print("pixelated", p.name)
