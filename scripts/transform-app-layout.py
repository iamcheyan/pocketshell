#!/usr/bin/env python3
"""Move PocketShell from a 720x480 logical canvas to a 360x240 bitmap canvas.

Two mechanical passes:

* geometry: every pixel-valued class token and inline style number halves, so
  the same design keeps the same proportions in half the coordinates;
* typography: class tokens snap to the font's baked 12 px grid. Anything
  off-grid (10/14/18/20) either disappears or lands on 12/16/24/36.

The output is meant to be reviewed as a diff: the app authors in invented
720-wide pixels, and this tool only rescales what already exists.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()

SPACING = {
    "p": ("padding", None), "px": ("padding", "x"), "py": ("padding", "y"),
    "pt": ("padding", "t"), "pb": ("padding", "b"), "pl": ("padding", "l"), "pr": ("padding", "r"),
    "m": ("margin", None), "mx": ("margin", "x"), "my": ("margin", "y"),
    "mt": ("margin", "t"), "mb": ("margin", "b"), "ml": ("margin", "l"), "mr": ("margin", "r"),
    "gap": ("gap", None),
}
SIZING = {"w", "min-w", "max-w", "h", "min-h", "max-h", "basis", "translate-x", "translate-y"}
EDGE = {"left", "right", "top", "bottom", "inset", "inset-x", "inset-y"}
TEXT = {
    "2xs": "xs", "xs": "xs", "sm": "base", "base": "xl", "lg": "xl",
    "xl": "2xl", "2xl": "4xl", "4xl": "4xl", "5xl": "5xl",
}


def half(n: float) -> int:
    if n == 0:
        return 0
    return max(1, int(round(n / 2)))


def rebuild(family: str, axis: str | None, value: float) -> str:
    suffix = "" if axis is None else axis
    return f"{family}{suffix}-[{value}px]"


def convert_class(literal: str) -> str:
    out: list[str] = []
    for tok in literal.split(" "):
        if not tok:
            continue
        m = re.fullmatch(r"(rounded)-\[([0-9.]+)(?:px)?\]", tok)
        if m:
            out.append(f"rounded-[{999 if float(m.group(2)) >= 999 else half(float(m.group(2)))}px]")
            continue
        m = re.fullmatch(r"([\w-]+)-\[([0-9.]+)(px)?\]", tok)
        if m:
            fam, val = m.group(1), float(m.group(2))
            if fam in SIZING or fam in EDGE:
                out.append(f"{fam}-[{half(val)}px]")
                continue
            if fam in SPACING:
                base, axis = SPACING[fam]
                out.append(rebuild(base, axis, half(val)))
                continue
        m = re.fullmatch(r"(w|h|min-w|min-h|max-w|max-h)-([0-9]+)", tok)
        if m:
            out.append(f"{m.group(1)}-[{half(float(m.group(2)) * 4)}px]")
            continue
        matched = False
        for fam, (base, axis) in SPACING.items():
            m = re.fullmatch(re.escape(fam) + r"-([0-9]+)", tok)
            if m:
                out.append(rebuild(base, axis, half(float(m.group(1)) * 4)))
                matched = True
                break
        if matched:
            continue
        m = re.fullmatch(r"text-(2xs|xs|sm|base|lg|xl|2xl|4xl|5xl)", tok)
        if m:
            out.append("text-" + TEXT[m.group(1)])
            continue
        out.append(tok)
    return " ".join(out)


STYLE_KEYS = ("width", "height", "insetL", "insetT", "left", "top", "right", "bottom",
              "gap", "padding", "paddingX", "paddingY", "margin", "marginX", "marginY",
              "radius", "borderWidth")


def convert_text(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        literal = m.group(1)
        return f'class="{convert_class(literal)}"'
    text = re.sub(r'class="([^"]*)"', repl, text)
    text = re.sub(
        r"\b(" + "|".join(STYLE_KEYS) + r"):\s*([0-9.]+)(?![\w.])",
        lambda m: f"{m.group(1)}: {half(float(m.group(2)))}",
        text,
    )
    text = re.sub(
        r"(\d+)\s*\*\s*\((props\.scale \|\| 1)\)",
        lambda m: f"{half(float(m.group(1)))} * ({m.group(2)})",
        text,
    )
    return text


def main() -> None:
    files = []
    for path in sorted(ROOT.glob("app/**/*.tsx")):
        if "showcase" in path.parts:
            continue
        before = path.read_text()
        after = convert_text(before)
        if after != before:
            path.write_text(after)
            files.append(str(path.relative_to(ROOT)))
    print(f"rescaled {len(files)} file(s): " + ", ".join(files))


if __name__ == "__main__":
    main()
