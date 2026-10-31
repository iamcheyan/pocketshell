#!/usr/bin/env python3
"""Install the local `ui.__launcher` bridge into a PocketJS SDK checkout.

The device build gets `host.__launcher` from `pocketshell-launcher.rs`, which the
ROCKNIX package injects with `patch-runtime.py`. The SDK ships no such module, so
a desktop run has no bridge and every SYSTEM/LEVEL read answers nothing. This
script copies `bridge/local-sysinfo.rs` into the guest crate and exposes it as
`ui.__launcher`, so the desktop host can be exercised without a handheld.

Idempotent: re-running it after a checkout change reapplies the copy and skips an
already-patched `lib.rs`.

    python3 scripts/patch-desktop-bridge.py <sdk-root>
"""
from pathlib import Path
import shutil
import sys

REPO = Path(__file__).resolve().parent.parent
MODULE = "pocketshell_local_sysinfo"
SETTINGS_MODULE = "pocketshell_settings"
ANCHOR = 'ui.set("__viewport", viewport)?;'
INSTALL = f'''
    ui.set(
        "__launcher",
        Function::new(ctx.clone(), |command: String| {MODULE}::command(&command))?,
    )?;
'''

if len(sys.argv) != 2:
    raise SystemExit(__doc__)

sdk = Path(sys.argv[1]).resolve()
guest = sdk / "engine/guest-rquickjs/src"
lib = guest / "lib.rs"
if not lib.is_file():
    raise SystemExit(f"patch-desktop-bridge: no guest crate at {guest}")

shutil.copyfile(REPO / "bridge/local-sysinfo.rs", guest / f"{MODULE}.rs")
shutil.copyfile(REPO / "bridge/settings.rs", guest / f"{SETTINGS_MODULE}.rs")
source = lib.read_text()
marker = "use rquickjs::{"
if marker not in source:
    raise SystemExit("patch-desktop-bridge: guest lib.rs has no rquickjs import block")
if f"mod {MODULE};" not in source:
    source = source.replace(marker, f"mod {MODULE};\n\n{marker}", 1)
if f"mod {SETTINGS_MODULE};" not in source:
    source = source.replace(f"mod {MODULE};", f"mod {MODULE};\nmod {SETTINGS_MODULE};", 1)
if f'"{MODULE}::command' not in source:
    if ANCHOR not in source:
        raise SystemExit("patch-desktop-bridge: ui.__viewport anchor missing in guest lib.rs")
    source = source.replace(ANCHOR, ANCHOR + INSTALL, 1)
lib.write_text(source)
print(f"patch-desktop-bridge: ui.__launcher -> {guest}/{MODULE}.rs")
