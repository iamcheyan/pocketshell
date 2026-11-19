#!/usr/bin/env python3
"""Rescale PocketShell class literals from 720x480 to a 360x240 logical canvas.

Only utility literals are changed. Geometry halves; text classes are scaled to
logical font slots for 2x presentation. Use --fonts-only to correct typography
in an app whose geometry has already been converted.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

FONT_ONLY = "--fonts-only" in sys.argv[1:]
ROOT_ARGS = [arg for arg in sys.argv[1:] if arg != "--fonts-only"]
ROOT = Path(ROOT_ARGS[0]).resolve() if ROOT_ARGS else Path.cwd()

SPACING = {
    "p": "p", "px": "px", "py": "py", "pt": "pt", "pb": "pb", "pl": "pl", "pr": "pr",
    "m": "m", "mx": "mx", "my": "my", "mt": "mt", "mb": "mb", "ml": "ml", "mr": "mr",
    "gap": "gap",
}
SIZING = {"w", "h", "min-w", "min-h", "max-w", "max-h", "basis", "translate-x", "translate-y"}
EDGE = {"left", "right", "top", "bottom", "inset", "inset-x", "inset-y"}
# The launcher is rendered on a 360x240 logical canvas and presented at 2x.
# Clamp small classes to the readable 12px bitmap slot and halve larger classes.
TEXT = {"2xs": "xs", "xs": "xs", "sm": "xs", "base": "xs", "lg": "xs",
        "xl": "xs", "2xl": "xs", "4xl": "lg", "5xl": "2xl"}

KEYWORDS = {
    "flex", "flex-row", "flex-col", "flex-wrap", "flex-1", "grow", "shrink-0",
    "items-center", "items-start", "items-end", "items-stretch", "items-baseline",
    "justify-center", "justify-between", "justify-start", "justify-end",
    "self-center", "self-start", "self-end", "absolute", "relative", "fixed",
    "hidden", "overflow-hidden", "rounded", "rounded-full", "border", "font-bold",
    "font-mono", "tracking-wide", "w-full", "h-full", "text-center", "text-left",
    "text-right", "shadow", "shadow-md", "shadow-lg", "opacity-0", "opacity-40",
    "text-white", "text-transparent", "bg-transparent", "uppercase", "truncate",
}
FAMILY = re.compile(
    r"^(?:w|h|min-w|min-h|max-w|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|"
    r"left|right|top|bottom|inset|inset-x|inset-y|rounded|text|bg|border|z|opacity|"
    r"leading|tracking|basis|translate-x|translate-y|duration|delay|scale|rotate|"
    r"fill|ring|outline)-"
    r"(?:\[[^\]]+\]|[A-Za-z0-9.#%_-]+)$"
)
VARIANT = re.compile(r"^(?:focus|active|hover|disabled|focus-within|group-hover|selected):")


def known(token: str) -> bool:
    if VARIANT.match(token) and token.count(":") == 1:
        return known(token.split(":", 1)[1])
    if token in KEYWORDS:
        return True
    if token.startswith("bg-gradient"):
        return True
    return bool(FAMILY.match(token))


def half(n: float) -> int:
    return 0 if n == 0 else max(1, int(round(n / 2)))


def convert_token(tok: str) -> str:
    prefix = ""
    base = tok
    if VARIANT.match(tok):
        prefix, base = tok.split(":", 1)
        prefix += ":"
    m = re.fullmatch(r"rounded-\[([0-9.]+)(?:px)?\]", base)
    if m:
        v = float(m.group(1))
        return prefix + f"rounded-[{999 if v >= 999 else half(v)}px]"
    m = re.fullmatch(r"([\w-]+)-\[([0-9.]+)(px)?\]", base)
    if m:
        fam, val = m.group(1), float(m.group(2))
        if fam in SIZING or fam in EDGE:
            return prefix + f"{fam}-[{half(val)}px]"
        if fam in SPACING:
            return prefix + f"{SPACING[fam]}-[{half(val)}px]"
        return tok
    m = re.fullmatch(r"(w|h|min-w|min-h|max-w|max-h)-([0-9]+)", base)
    if m:
        return prefix + f"{m.group(1)}-[{half(float(m.group(2)) * 4)}px]"
    m = re.fullmatch(r"text-(2xs|xs|sm|base|lg|xl|2xl|4xl|5xl)", base)
    if m:
        return prefix + "text-" + TEXT[m.group(1)]
    for fam, tag in SPACING.items():
        m = re.fullmatch(re.escape(fam) + r"-([0-9]+)", base)
        if m:
            return prefix + f"{tag}-[{half(float(m.group(1)) * 4)}px]"
    return tok


def convert_literal(lit: str) -> str:
    toks = [t for t in lit.split(" ") if t]
    if not toks or not all(known(t) for t in toks):
        return lit
    out = [convert_token(t) for t in toks]
    return " ".join(out) if out != toks else lit


def convert_font_literal(lit: str) -> str:
    """Convert typography tokens only, after geometry has already been scaled."""
    out = []
    for token in lit.split(" "):
        prefix, base = "", token
        if VARIANT.match(token):
            prefix, base = token.split(":", 1)
            prefix += ":"
        match = re.fullmatch(r"text-(2xs|xs|sm|base|lg|xl|2xl|4xl|5xl)", base)
        out.append(prefix + "text-" + TEXT[match.group(1)] if match else token)
    return " ".join(out)


STYLE_KEYS = ("width", "height", "insetL", "insetT", "left", "top", "right", "bottom",
              "gap", "padding", "paddingX", "paddingY", "margin", "marginX", "marginY",
              "radius", "borderWidth")


def main() -> None:
    touched = []
    paths = set(ROOT.glob("app/**/*.tsx")) | set(ROOT.glob("app/**/*.ts"))
    for path in sorted(paths):
        if "showcase" in path.parts:
            continue
        src = path.read_text()
        before = src

        def repl(m: re.Match[str]) -> str:
            lit = m.group(1)
            conv = convert_font_literal(lit) if FONT_ONLY else convert_literal(lit)
            return m.group(0)[:1] + conv + m.group(0)[-1:]

        src = re.sub(r'"([^"\n]*)"', repl, src)
        if not FONT_ONLY:
            src = re.sub(
                r"\b(" + "|".join(STYLE_KEYS) + r"):\s*([0-9.]+)(?![\w.])",
                lambda m: f"{m.group(1)}: {half(float(m.group(2)))}",
                src,
            )
            src = re.sub(r"(\d+)\s*\*\s*\((props\.scale \|\| 1)\)",
                         lambda m: f"{half(float(m.group(1)))} * ({m.group(2)})", src)
        if src != before:
            path.write_text(src)
            touched.append(path.name)
    print(f"rescaled {len(touched)} file(s): {', '.join(touched)}")


if __name__ == "__main__":
    main()
