# RG34XX GBA 3× UI

The 720×480 panel is exactly 240×160 at integer scale 3. PocketShell now uses
that logical viewport and raster density in `config/profile.ts` and the app
manifest. One logical line or icon pixel covers a 3×3 physical square.

The home card is 83×83 logical pixels, with an 80×80 cover; pitch is 93 and the
first card begins at x=79 including the page inset. The selected name remains
below the art and wraps to two lines. Status glyphs were redrawn on 9×9 masks;
the battery is a compact 12×7 four-cell icon. All six status indicators remain
visible, with inactive services gray. The page body, footer, settings rows,
system meters and modal use the same integer grid. System information keeps
all unique fields across overview, device and network pages, removing only
duplicate OS/kernel/display rows. Wi-Fi shows seven rows at once so its footer
stays visible.

The framework's smallest built-in font slot is 10 logical pixels. Text uses
that slot, with the 12px slot reserved for the selected card title. Narrow
controls were widened to fit two Chinese characters. The degree sign was added
to the baked glyph list so temperatures render as `43°C` rather than tofu.

Local verification on 2026-11-13: SDK check and compile passed, then the
240×160 layout was rendered with the PocketJS WASM core at 3×. Mock bridge data
was used only for screenshots. The ARM64 runtime and final package also booted
for 12 ticks under `qemu-aarch64-static --headless`. Screenshots in this folder
show home, settings and all three system pages. They are emulator captures, not
device framebuffer captures.

Profile hash: `sha256:b4eff018558f29f58bf10d76a81e1cbb1a5e7dfb965b59a020562ac797a24241`.
PocketShell package SHA256: `30d12b3a696de81f56bd98721604f44de3c003c5aef0b2c57dbfb130d1055041`.
This package was rebuilt after the settings/Wi-Fi review, polling reduction
and shared PJOS keyboard theme. SDK check and compile passed; the screenshots
above predate these data-path and keyboard-theme changes.

Hardware deployment remains pending because ADB has no device and the previous
Wi-Fi address does not answer. Update the boot package and both runtime copies
as one matched set, after backing up the active files. Then capture the actual
720×480 framebuffer and check title wrapping, font legibility and controls.
