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
| `docs/device/device-launcher-tools-720x480.png` | the package that was installed before (TOOLS tab) |
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
- screenshot: `dist/hx90-desktop.png` — APPS tab, status bar, help line (pre-PocketFetch build)

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



## Touch and pointer behavior (current source)

- The `rocknix-h700-kms` build passes `scripts/build.sh` (`pocketshell.pocket`,
  3,968,520 bytes, SHA-256 `5b1359f409011f656f060f974ea27152854060475a2c67819289f5413ae7aba5`).
- KMS evdev contacts use PocketJS gestures. The desktop runtime patch forwards
  mouse clicks and winit touch contacts to that same contact path; app controls
  do not join the gamepad focus graph. Existing d-pad, A/Circle and B/Cross
  handlers remain in place, and devices without touch keep physical-button
  behavior.
- App cards select on the first tap and open on the next tap; the carousel also
  has swipe and arrow navigation. Wi-Fi rows connect/open password entry on tap,
  with explicit back, refresh and list paging controls. Settings rows and the
  Wi-Fi enable pill are separate tap targets. Brightness/volume preview follows
  the gesture and sends one bridge command on release; cancelling reads the
  hardware value back.
- Wi-Fi password entry no longer uses `TextField`. That field renders the value
  it edits, which would put the passphrase on the panel in clear; the page now
  draws `·` for each character and the real text lives in an `createOsk` session
  owned by `main.tsx`. The keyboard is rendered against the page root (a padded
  container clipped it by exactly the padding). START commits, ×/B cancels,
  □ backspaces. This replaced the earlier `TextField` path recorded above.

Desktop input review used the real compiled native host, including the contact
patch, rather than the HTML preview. Scripted pointer clicks switched tabs,
opened Wi-Fi, returned, and mixed with one Down button press to move exactly one
row. System page arrows and PocketFetch return were also exercised. In an
isolated SDK copy with a synthetic bridge (no real network/settings writes):

- A multi-move brightness drag issued exactly one `CONTROL brightness 85` on
  release and the UI read back 85%.
- Ten Wi-Fi rows could advance past the six-row window to select row eight.
- Tapping a protected network and its password field opened the OSK. Tapping
  the underlying refresh location while it was open did not rescan. Tapping
  `q` and the OSK submit key issued one connection request and closed the OSK.
- With three fixture apps enabled, a swipe selected the next card without
  launching; a selected card tap issued one native launch request.

`bridge/desktop-contacts.rs` has standalone Rust tests for fast down/up in one
host batch, cancellation, drag identity/multiple contacts, and the last movement
before release. The desktop patch is applied automatically by desktop scripts;
it can also be applied with `python3 scripts/patch-desktop-touch.py SDK_ROOT`.
Physical touchscreen hardware has not been exercised; native winit touch
forwarding was compiled and the shared contact/gesture path was exercised with
scripted mouse input. No handheld deployment was performed for this change.



## Wi-Fi picker against the system contract (2026-10-31)

The Wi-Fi screen was rewritten against `docs/WIFI-BRIDGE-CONTRACT.md` and
exercised three ways: the pure protocol model, a headless replay of the real
bundle, and a device deploy.

**Protocol model** (`app/wifi-model.ts`, `bun app/verify-wifi-model.mjs`):
duplicate SSIDs keep the strongest sample, hidden/over-long SSIDs are dropped,
association sorts first then signal, `error:`/`empty` are distinguished,
`connected:`/`need-psk`/`auth-failed`/`not-found`/`timeout`/`error:` are
classified, `on:<ssid>` and `wpa_state=` both parse, and the passphrase rule is
8–63 printable ASCII.

**Headless replay** of the compiled bundle with a synthetic `__launcher`
(wasm host, no device): opening SETTINGS → Wi-Fi issued `WIFI saved`, `WIFI
status`, `WIFI scan` in that order once; joining an open network produced
exactly one `WIFI connect`; a wrong passphrase returned `auth-failed` with the
keyboard and typed text still up; retyping and submitting produced a second
connect and then one rescan; `△` on the associated row issued
`WIFI disconnect` and `△` on a saved row issued `WIFI forget`. Nothing was
issued twice, and no `setTimeout` is involved — the scan/connect calls are
dispatched from `onFrame` after the busy frame paints.

**Device**: `make check` admitted the package, `scripts/deploy.sh` installed it
(`d48d699e…`), the launcher respawned and the captured framebuffer shows the
new build running. The scan/connect round trip against the real supplicant is
**not** verified end to end: the runtime on the card predates Wi-Fi 2.0 (no
`saved`/`forget`/`disconnect` arms), and the deployed bridge kills `udhcpc`
after 2 s. Both are recorded in `docs/WIFI-BRIDGE-CONTRACT.md` §10.3 for the
system side; the launcher needs no change for either.

## Installed-app switching (device, 2026-10-31)

Runtime rebuilt as musl aarch64 with the BaseOS bridge (`sha256 a3be425f…`, 3,126,048 B) and
installed on the card. Ten PocketJS ports live in `/storage/apps/*.pocket`.

- `pocket-linux-kms --check` admits both `boot.pocket` and `apps/files.pocket`
  (`rocknix-h700-kms`).
- Writing the launch marker and exiting the launcher makes the supervisor start
  `/mnt/sdcard/apps/files.pocket`; the Files UI renders on the panel — `docs/device/app-files-launch.png`.
- Killing the child clears the marker and the launcher comes back — `docs/device/returned-to-launcher.png`.

The launcher itself never forks a runtime: it asks the bridge for `LAUNCH <id>` and the
supervisor (`System/launch_frontend.sh`) owns the display. Contract:
`docs/WIFI-BRIDGE-CONTRACT.md`.