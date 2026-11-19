#!/usr/bin/env python3
"""Expose PocketJS build.ts font overrides through the pocket compile CLI."""
from pathlib import Path
import sys

sdk = Path(sys.argv[1]).resolve()
pocket_cli = sdk / "tools/pocket.ts"
build_cli = sdk / "tools/build.ts"

def patch(path: Path, old: str, new: str, marker: str) -> None:
    text = path.read_text()
    if marker in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"expected one patch anchor in {path.name}")
    path.write_text(text.replace(old, new, 1))

patch(
    pocket_cli,
    '  const dependencies = takeOption("depfile");\n',
    '  const dependencies = takeOption("depfile");\n'
    '  const fontRegular = takeOption("font-regular");\n'
    '  const fontBold = takeOption("font-bold");\n'
    '  const fontMono = takeOption("font-mono");\n',
    'const fontMono = takeOption("font-mono")',
)
patch(
    pocket_cli,
    '...(dependencies ? [`--inputs-file=${inputsFile}`] : [])], { cwd: projectRoot, stdout: "inherit", stderr: "inherit" });',
    '...(dependencies ? [`--inputs-file=${inputsFile}`] : []),\n'
    '    ...(fontRegular ? [`--font-regular=${fontRegular}`] : []),\n'
    '    ...(fontBold ? [`--font-bold=${fontBold}`] : []),\n'
    '    ...(fontMono ? [`--font-mono=${fontMono}`] : [])], { cwd: projectRoot, stdout: "inherit", stderr: "inherit" });',
    'fontMono ? [`--font-mono=${fontMono}`]',
)
patch(
    build_cli,
    'let boldFontPath: string | undefined;\n',
    'let boldFontPath: string | undefined;\nlet monoFontPath: string | undefined;\n',
    'let monoFontPath: string | undefined',
)
patch(
    build_cli,
    '  else if (a.startsWith("--font-bold=")) boldFontPath = resolvePath(a.slice("--font-bold=".length));\n',
    '  else if (a.startsWith("--font-bold=")) boldFontPath = resolvePath(a.slice("--font-bold=".length));\n'
    '  else if (a.startsWith("--font-mono=")) monoFontPath = resolvePath(a.slice("--font-mono=".length));\n',
    'a.startsWith("--font-mono=")',
)
patch(
    build_cli,
    '  boldTtf: boldFontPath,\n',
    '  boldTtf: boldFontPath,\n  monoTtf: monoFontPath,\n',
    'monoTtf: monoFontPath',
)
print("PocketJS compile now forwards regular, bold and mono font faces")
