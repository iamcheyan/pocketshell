#!/usr/bin/env python3
"""Add the optional battery charging-state command to a PocketShell device bridge.

Usage: scripts/apply-device-battery-status.py /path/to/pocketshell-launcher.rs

The device bridge lives in the ROCKNIX runtime source, outside this repository.
This idempotent patch keeps that integration explicit and never edits it unless
the caller names the target file.
"""
from __future__ import annotations

import pathlib
import sys


PATCH = '''        // Optional fuel-gauge power state. Older devices without sysfs status
        // report unknown; capacity is never used to infer charging.
        ["LEVEL", "battery-status"] => {
            let status = std::fs::read_dir("/sys/class/power_supply")
                .ok()
                .into_iter()
                .flatten()
                .flatten()
                .find_map(|entry| {
                    let base = entry.path();
                    let kind = std::fs::read_to_string(base.join("type")).ok();
                    let is_battery = kind.as_deref().map(str::trim) == Some("Battery")
                        || base.join("capacity").exists();
                    if !is_battery { return None; }
                    let raw = std::fs::read_to_string(base.join("status")).ok()?;
                    match raw.trim() {
                        "Charging" => Some("charging"),
                        "Full" => Some("full"),
                        "Discharging" | "Not charging" => Some("discharging"),
                        _ => None,
                    }
                });
            status.unwrap_or("unknown").into()
        }
'''
ANCHOR = '        ["LEVEL", "ip"] => {'


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = pathlib.Path(sys.argv[1])
    text = path.read_text()
    if '["LEVEL", "battery-status"] =>' in text:
        print(f"already patched: {path}")
        return 0
    if text.count(ANCHOR) != 1:
        print(f"expected one {ANCHOR.strip()} match in {path}", file=sys.stderr)
        return 1
    path.write_text(text.replace(ANCHOR, PATCH + ANCHOR))
    print(f"patched: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
