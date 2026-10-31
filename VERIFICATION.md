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

## "Self-exit" after the deploy was framebuffer contention, not a regression

The rebuilt package was blamed for exiting after 19 s to 4 min. That diagnosis was
wrong, and the evidence is on the device:

```
ps → pocket-linux-kms --package /storage/pjs/pocket-galaxy/app.pocket --fb /dev/fb0 --input /dev/input/event3
     /bin/sh -c echo SQUARE > /tmp/pocketjs-keys
     /storage/pjs/uinputd
```

A concurrent agent session was deploying and driving **pocket-galaxy** on the same
handheld: it killed the launcher runtime (which exits gracefully with
`completed N logical ticks` — the runtime only stops on SIGINT/SIGTERM, there is no
self-exit path in `programs/linux-kms/src/main.rs`), took `/dev/fb0`, and injected
keys through a FIFO. The launcher then looked like it "restarted by itself".

Lessons for this repo:

- `pocket-linux-kms` stopping with `completed N logical ticks` + exit 0 **always**
  means a signal from outside. Check `ps` for another runtime holding `--fb /dev/fb0`
  before suspecting the package.
- The handheld is shared. Serialise device access with a lock (see README,
  "Serialising device access") before deploying or screenshotting.

No change to the package was needed for stability; it ran correctly whenever it
owned the framebuffer, including on the HX90 desktop host (below).

## Desktop run on HX90 (same source, real runtime GPU path)

Compiled the same app for the `linux-app` profile and ran it under
`programs/desktop` (`pocket-desktop-host`, winit + wgpu) on the Hyprland session:

- build: `bun tools/pocket.ts build --config programs/desktop/linux/pocket.runtime-config.ts --target linux-app --pocket … --out …`
  → `pocket-desktop-host` in 1m25s
- runtime needed `LD_LIBRARY_PATH` for wayland/xkbcommon/libglvnd/vulkan-loader/mesa
  (NixOS does not put them on the loader path)
- adapter: `AMD Radeon Graphics (RADV RENOIR)`, surface `Bgra8Unorm`
- screenshot: `dist/hx90-desktop.png` — APPS tab, Terminal card, status bar, help line

This is the same TSX source and the same package plan, rendered by the real runtime
rather than by the browser harness.

## Device state after this session

- `boot.pocket` on the card: restored to `6ed41612…` (the 2026-10-30 build); the
  approved copy `d2836f45…` was never removed, and PJOS-LINUX still ships it.
- The rebuilt package is proven rendering + input, but is **not** installed as the
  boot launcher yet: another agent owns the framebuffer for its own device runs.
- Next: re-install the rebuilt package once the device is free, leave it idle for
  10 minutes with nothing else touching `/dev/fb0`, and confirm a single uninterrupted
  run before switching the payload over.


