# Desktop preview: building, running, and not stealing focus

The launcher runs two ways: as a `.pocket` package on the RG34XX, and as a
`linux-app` build under `programs/desktop` (`pocket-desktop-host`, winit + wgpu)
on the development machine. The desktop build is the fast loop — edit, build,
look — but until 2026-10-31 it also **took the keyboard away from whatever the
developer was doing**, because the window maps focused and nothing handed focus
back.

This document records the workflow and the focus fix. Nothing here patches the
PocketJS SDK: the fix lives entirely in `scripts/desktop-local.sh`.

## Commands

```sh
make desktop-local                 # stage -> compile -> rebuild host -> run -> screenshot
./scripts/desktop-local.sh --no-shot
make desktop                       # same, but rsync app/ to HX90 first
```

Both scripts stop any earlier preview whose working directory is
`/tmp/pocketshell-desktop/program` before building. That check is on `comm` +
`cwd`, not on the binary path alone, so previews of other PocketJS apps and
other checkouts keep running.

## Why the preview needs a bridge

The device runtime gets `host.__launcher` from `pocketshell-launcher.rs`, which
ROCKNIX's `patch-runtime.py` copies into the guest crate. The PocketJS SDK ships
no such module, so a stock desktop build has `host.__launcher === undefined` and
every SYSTEM / LEVEL read answers `""` — the panel renders a page of `--`.

Two files close that gap:

| path | role |
|---|---|
| `bridge/local-sysinfo.rs` | the same command surface (`SYSTEM`, `LEVEL battery/ip/wifi/brightness/volume`, `LANGUAGE`, `STATUS`) read from the machine the host actually runs on |
| `scripts/patch-desktop-bridge.py` | idempotent: copies the module into `engine/guest-rquickjs/src/` and exposes it as `ui.__launcher` |

`desktop-local.sh` and `desktop-run.sh` run the patcher on every build, so a
stale copy cannot silently answer with old data. Both are idempotent; re-running
them after an SDK update reapplies the copy and skips an already-patched
`lib.rs`.

The bridge is read-only and runs on the guest's single render thread, so every
probe is a `/proc` or `/sys` file read, a `df`/`ip` call, or a missing file
turned into an absent field. Nothing blocks the UI.

## The focus fix

`pocket-desktop-host` creates its window in `resumed()` with winit's default
attributes; a freshly mapped Wayland toplevel is activated, so the compositor
gives it the keyboard. A build-and-run therefore interrupts typing in another
window, and while a capture harness is holding the preview open the interruption
lasts as long as the preview does.

`scripts/desktop-local.sh` now:

1. reads the active window's Hyprland address **before** launching,
2. starts the preview under `setsid nohup` and keeps its PID,
3. polls `hyprctl -j clients` every 50 ms (120 tries, 6 s ceiling) until a client
   carries that PID,
4. dispatches `hl.dsp.focus({ window = "address:<saved>" })` once, then stops.

Measured result: the steal is a few tens of milliseconds at window-map time
instead of the whole preview session, and the developer's window keeps the
keyboard. The preview stays mapped and usable — clicking it focuses it normally.

Guard rails: the block is skipped entirely when `hyprctl` is absent, when nothing
had focus (`0x0`), or on a compositor whose dispatch syntax differs; in all three
cases the preview simply behaves as it did before. `desktop-run.sh` runs on the
remote host over SSH and cannot see the developer's focused window, so it keeps
its previous behaviour and only the local script restores focus.

### Why focus is restored, not suppressed at creation

winit 0.30 offers `WindowAttributes::with_active(false)`, and a compositor
windowrule can suppress initial focus. Both were rejected for this workflow:

- the preview must still be *usable*: it is the thing being tested, and the
  capture harness injects A/B presses into it, which requires it to be
  focusable on demand;
- `with_active` is a hint the compositor may ignore, so it would not guarantee
  the behaviour the developer asked for;
- suppressing focus at creation in a checkout that also builds other PocketJS
  apps would change them all, from a repository that does not own that code.

Restoring the previous window is the only option that is both reversible (one
`hyprctl` dispatch) and scoped to this repository.

## Capturing screens without touching the device

`desktop-local.sh` captures `dist/desktop.png` with `grim` after the window is
up. For a specific panel, capture by window geometry so the shot is exactly the
360×240 logical canvas:

```sh
hyprctl -j clients | python3 -c '
import json, sys
client = next(c for c in json.load(sys.stdin) if "PocketJS" in c["title"])
print(f"{client[\"at\"][0]},{client[\"at\"][1]} {client[\"size\"][0]}x{client[\"size\"][1]}")'
grim -g "<that geometry>" shot.png
```

`--press NAME@TICK` accepted by `run` scripts single button presses at a virtual
tick (`z` = CROSS/A, `x` = CIRCLE/B, `w` = R trigger, `down`/`up`/`left`/`right`),
which is how a panel is opened for a screenshot without an interactive session.

## Device deploys are a different path

`make deploy` pushes over ADB and restarts the device runtime; it does not touch
the desktop preview, and it does not need focus at all. Serialise device access
with the lock (see the repository README) because the handheld is shared with
other sessions.

## Settings: one row model, two transports

`app/settings-model.ts` is the only place the row list lives: key, label, kind
(`level` / `toggle` / `enum` / `text` / `action`), group. `app/pages/settings-page.tsx`
renders it and knows nothing about the host.

`app/setting-bridge.ts` decides how a key is read and written:

1. `SETTING\t<key>` (and `SETTING\t<key>\t<value>` to write) is the unified
   protocol. `bridge/settings.rs` implements it for the desktop host.
2. When that answers nothing — which is exactly what today's device runtime does,
   because it predates the protocol and replies `Unknown launcher action` — the
   per-key fallback runs: `LEVEL`/`STATE`/`STATUS` to read,
   `CONTROL`/`SERVICE`/`SLEEP`/`LANGUAGE` to write.

A key that neither path answers stays `null`, and the row renders `--` and refuses
to toggle. That is deliberate: a capability the runtime lacks must not look
switched off.

The response to `Unknown launcher action` is the load-bearing detail. Treating it
as a value made every row on the handheld show `--`, because the fallback never
ran; `isUnknownArm` in `setting-bridge.ts` is what keeps the two transports from
shadowing each other.

## Power menu: why the long press needs three pieces

A guest cannot power the machine off, and on the handheld it cannot even see the
power key. Three layers cooperate:

| layer | file | what it does |
|---|---|---|
| OS hotkey daemon | `PJOS-LINUX/src/baseos-hotkeys/main.go` | 2 s hold writes `/run/power-menu.request` and returns; it powers off only when no launcher is running |
| runtime bridge | `PJOS-LINUX/src/apply-pocketjs-bridge.py` | `POWER\tmenu` consumes the marker (`menu` / `none`); `POWER\tpoweroff|reboot` spawns `/usr/sbin/baseos-{poweroff,reboot}` and answers `ok:<action>` |
| launcher | `app/power-menu.tsx`, `app/main.tsx` | polls `POWER\tmenu` at 4 Hz, shows the modal, sends the chosen action |

Details that matter:

- **The marker is consumed by the bridge, not by the launcher.** One press, one
  dialog: a stale file would otherwise make the dialog reappear on the next boot.
- **The OS falls back to a real poweroff when no launcher answers.** A held power
  button must never leave the handheld unable to shut down.
- **`poweroff`/`reboot` go through BaseOS's wrappers**, not BusyBox: they set or
  clear `/run/poweroff-requested` so `rcK` can tell the two apart.
- **The preview never powers anything off.** `bridge/settings.rs` answers
  `error:preview` for both actions and `none` for the menu request.

Rebuilding either side: the hotkey daemon is a static Go binary
(`CGO_ENABLED=0 GOARCH=arm64 GOOS=linux go build -buildvcs=false -trimpath`), and
the runtime is `PJOS-LINUX/build-pocketjs-runtime-musl.sh` with
`PJOS_BRIDGE_SCRIPTS=~/development/pjos-bridge-scripts` — the ROCKNIX checkout's
copy is the small variant and the patch anchors do not match it.
