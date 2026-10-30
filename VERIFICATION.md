# Device verification — 2026-10-31

Rebuilt launcher, installed over ADB, verified on the RG34XX without touching the
BaseOS image.

## Artifact

- `dist/pocketshell.pocket` — 4,649,320 bytes, sha256 `b932d9dd77c326085b2343d54e836ca3cfc6253d8ec3b13b6eaba55b87bab2eb`
- variant `rocknix-h700-kms` (abi 12), package hash `7264ef1cf6b87be8`, profile sha256 `85385701…`
- sections: identity 71 B · plan 1,173 B · js 309,251 B · pak 4,338,016 B (9 font slots baked)
- build: `make build` → 78 app modules, 242 codepoints, 3 fallback faces

## Admission

```
package admitted: /storage/pjs/pocketshell.pocket (rocknix-h700-kms)
```
checked by the device's own runtime (`pocket-linux-kms --check`), i.e. the profile
hash matches the installed runtime.

## Install

- previous package backed up to
  `/storage/System/pocketjs/apps/boot.pocket.bak-20261031-084017`
  (4,203,976 B, sha256 `6ed41612…`, the 2026-10-30 18:30 build)
- new package copied over `boot.pocket`, `sync`ed, sha256 re-read from the card:
  `b932d9dd…` (matches the build)
- runtime killed → `launch_frontend.sh` returned → `frontend-session` respawned it;
  log confirms `admission … exit=0`, `display: fbdev (timer pacing)`

## Evidence frames (720×480, `/dev/fb0`, 32 bpp double buffer, page 0)

| file | what it proves |
|---|---|
| `docs/device/device-launcher-tools-720x480.png` | the package that was installed before (TOOLS / Terminal) |
| `docs/device/device-rebuilt-tools-720x480.png` | the rebuilt package rendering the same screen |
| `docs/device/device-launcher-settings-720x480.png` | input works: R1 (evdev code 309, `sendkey` on `/dev/input/event1`) switched TOOLS → SETTINGS |

Settings page renders brightness / volume / Wi-Fi / language / timeout / SSH rows,
so the Wi-Fi and Settings pages that only existed in the payload snapshot are part
of this build too.

## Rollback

```sh
adb shell 'cp -f /storage/System/pocketjs/apps/boot.pocket.bak-20261031-084017 \
                  /storage/System/pocketjs/apps/boot.pocket && sync'
adb shell 'kill -9 $(pidof pocket-linux-kms)'
```

## Not verified here

- No input sweep over every key (only R1 and the page it opens).
- No visual diff against the previous package beyond the two frames above; font
  slots bake more sizes than the previous build (pak 4.34 MB vs 3.89 MB), which
  changes bytes but not the captured layout.
