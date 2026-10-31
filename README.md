# PocketShell

The launcher / shell of **PJOS Linux** on the Anbernic RG34XX, written as a
**PocketJS program**: Solid TSX compiled into a `.pocket` package that
`pocket-linux-kms` renders straight to the panel framebuffer.

It is one self-contained program, independent of the OS build:

- edit the UI here, `make build`, `make deploy` over ADB — **no image rebuild**
- BaseOS/PJOS-LINUX packaging just copies the built `.pocket` into the card image

## What runs

```
frontend-session                     (BaseOS /mnt/sdcard frontend contract)
└── System/launch_frontend.sh
    └── pocket-linux-kms --package System/pocketjs/apps/boot.pocket --fb /dev/fb0 …
        └── boot.pocket  ← this repository's dist/pocketshell.pocket
```

The runtime is native Rust with an embedded QuickJS guest. This package is the
guest: 360×240 logical canvas scaled 2× onto the 720×480 panel, 60 Hz tick,
capabilities `input.buttons` + `text.glyphs.baked`.

**There is no network, filesystem or database API in the guest.** Every piece of
data (battery, volume, brightness, services, library rows, launching apps) comes
through the Rust host bridge compiled into the runtime:
`host.__launcher("<CMD>\t…")` / `host.__pocketshell(…)` — tab-separated commands
such as `STATE`, `LEVEL`, `CONTROL`, `SERVICE`, `LAUNCH`, `ROMS`, `ROMSCAN`,
`LANGUAGE`, `SLEEP`. See `app/main.tsx` for the call sites and the ROCKNIX
`pocketjs-runtime` package (`scripts/pocketshell-*.rs`) for the host side.

## Layout

| path | what |
|---|---|
| `app/` | the PocketJS application: `main.tsx`, `card-carousel.tsx`, `pages/`, fonts, `pocket.json` |
| `app/fonts/` | Sarasa UI SC Regular/Bold + Symbols Nerd Font Mono (baked into the package, see `fonts.json`); FusionPixel files are the previous face and are currently unused |
| `config/profile.ts` | the `rocknix-h700-kms` runtime profile (720×480 / 360×240 @2×, 60 Hz, capabilities) |
| `config/pocket.runtime-config.ts` | runtime config the compiler binds the package to (this hash is what admission checks) |
| `scripts/build.sh` | stages the app into the PocketJS SDK, compiles, prints sections + sha256 |
| `scripts/check.sh` | pushes to `/storage/pjs/` and runs `pocket-linux-kms --check` on the device |
| `scripts/deploy.sh` | backup → install → restart frontend → capture a frame |
| `app/browser-preview.html` | browser harness for layout/colour work (no device needed) |

## Build

Needs the PocketJS SDK checkout and `bun`:

```sh
make build                                  # POCKETJS_SDK=~/development/.pocketjs-star-drift-sdk
```

The CLI only compiles apps that live inside the SDK tree, so the build stages
`app/` into `$POCKETJS_SDK/apps/rocknix-h700/` and `config/` into
`$POCKETJS_SDK/programs/rocknix-h700/`, then compiles with
`--target rocknix-h700-kms`. The SDK tree is a build input, not a dependency you
edit — this repository is the source of truth.

## Deploy to the handheld (no image rebuild)

The device is reachable over ADB on the jump host `HX90`:

```sh
make check     # admission only, writes nothing to System/
make deploy    # backs up boot.pocket, installs, restarts, captures a frame
```

Rollback is printed at the end of `deploy.sh`; the timestamped
`boot.pocket.bak-*` stays on the card.

## Serialising device access

The handheld is shared with other agent sessions. `pocket-linux-kms` stops with
`completed N logical ticks` + exit 0 only when something signals it, so a launcher
that "restarts by itself" is almost always a second runtime that took
`/dev/fb0` (`ps | grep 'package /storage/pjs'`). Take the lock before deploying,
screenshotting or key-injecting:

```sh
flock /tmp/pocketjs-device.lock -c 'make deploy'
flock /tmp/pocketjs-device.lock -c ./scripts/check.sh
```

## Running on a Linux desktop (no device)

The same `app/` compiles for the `linux-app` profile and runs under
`programs/desktop` (winit + wgpu), which is the fastest way to look at the UI
without a handheld:

```sh
cd "$POCKETJS_SDK"
bun tools/pocket.ts compile --runtime-config programs/desktop/linux/pocket.runtime-config.ts \
  --target linux-app --manifest apps/pocketshell/pocket.json --output /tmp/pocketshell-desktop.pocket
bun tools/pocket.ts build --config programs/desktop/linux/pocket.runtime-config.ts \
  --target linux-app --pocket /tmp/pocketshell-desktop.pocket --out /tmp/pocketshell-desktop
/tmp/pocketshell-desktop/program/run
```

On NixOS the host needs the desktop libraries on the loader path — winit dlopens
Wayland and fails with `The wayland library could not be loaded` otherwise:

```sh
export LD_LIBRARY_PATH=$(nix eval --raw nixpkgs#wayland)/lib:$(nix eval --raw nixpkgs#libxkbcommon)/lib:\
$(nix eval --raw nixpkgs#libGL)/lib:$(nix eval --raw nixpkgs#vulkan-loader)/lib:$(nix eval --raw nixpkgs#mesa)/lib
```

## Working on the desktop host (HX90)

The repository is also cloned on HX90 (`~/development/pocketshell`), which has the
PocketJS SDK at `~/development/pjs-app-build` and the Hyprland session. Edit there
and run:

```sh
make desktop-local     # stage into the local SDK, compile, restart the window, capture dist/desktop.png
```

From another machine, `make desktop` does the same by rsyncing `app/` to HX90 first.
Either way the source of truth is this git repository: commit and push from HX90,
pull elsewhere.

## Packaging into a BaseOS image

PJOS-LINUX ships the built artifact, not this source tree:

```sh
make build && cp dist/pocketshell.pocket \
  ~/development/PJOS-LINUX/overlay/usr/share/pocketshell/System/pocketjs/apps/boot.pocket
```

and `overlay/usr/share/pocketshell/System/pocketjs/version` records its sha256.
A launcher change therefore needs **only** `make deploy`; regenerating the image
is required only when the runtime binary or the OS itself changes.

## Runtime/package pairing

The package embeds the profile hash it was built against and the runtime admits
only that profile. Replace one without the other and every package is refused
with `Package(Admission(ProfileHashMismatch))`. Rebuild both, or neither.

## Provenance

`app/` was lifted from the ROCKNIX `pocketjs-runtime` launcher baseline
(`feat/pocketshell-cards`, horizontal `CardCarousel`) plus the Wi-Fi / Settings /
System pages that were only living in the payload snapshot. Details, including
the on-device package hash it corresponds to, are in `ORIGIN.md`.
