# Pixel handheld · 2026-11-12

User correction: replace all photographic launcher art with coherent GBA-inspired
pixel illustration. Square corners everywhere. Restore Wi-Fi/Bluetooth/SSH/ADB/
file-transfer/battery indicators; disabled services remain visible in gray.

Palette: background #19172b, panel #242039, selected #39304e, line #433c5b,
ivory #f5eddb, secondary #9893ad, selection and active indicators #f2ce76.
Chinese UI font: Fusion Pixel 12px, Nerd symbols fallback. No card scaling.
Selected title uses up to two lines below the fixed 124px square covers.

Four original generated pixel illustrations are packaged as pixel-system.png,
pixel-video.png, pixel-blocks.png, pixel-games.png. The generation source sheet
is preserved under the local generated_images directory. Supersedes the previous
photographic visual direction. Existing matched game box art is retained.

Build: scripts/build.sh. Device admission: runtime --package PATH --check.
Backup before this redesign: boot.pocket.before-quiet-ui on the device.

Validated on RG34XX: native screenshots of launcher, settings, and system overview
saved under pixel-handheld/. Package admission and TypeScript checks passed;
git diff --check passed. Deployed package SHA256:
33071fb7139b5f1322a08f2c365a346e392dbbc941992427e69d724cde24721e.

## Unified pixel symbols and Tux

System cover now uses original pixel Tux illustration (`pixel-tux.png`).
Status symbols are original 13×11 grid masks rendered as integer-aligned
rectangles, shared by status bar, Wi-Fi/Bluetooth headers, network lock and
power/reboot actions. No font-dependent icon shapes remain in these controls.
Horizontal battery has five discrete cells: ceil(clamp(percent)/20), zero at
0%, empty/dim for unknown, lightning when charging/full-plugged. Low battery
retains warning colors. Disabled service icons remain gray.

Visual references consulted (original masks, no SVG copied):
https://pixelarticons.com/icon/battery/
https://pixelarticons.com/icon/wifi/

TypeScript/build and device package admission passed. Deployed SHA256:
0c6a8934d571daa990d90a70c98b44c05da7dafda700d5cafcf8033c81c34736.
Native screenshot: pixel-handheld/status-and-tux.png, active framebuffer y=480.
Verified current full battery shows all five cells; lower battery levels and
charging display have not been observed on physical device during this pass.

Compact battery correction: footprint now 13×11 logical pixels, matching every
other status icon. Five one-pixel cells; normal color matches active gold.
Charging bolt stays inside the outline, so charging never widens the status bar.
Build/admission/deployment and native screenshot checked (compact-battery.png).

Four-cell battery redraw supersedes cramped five-cell version: 16×9 logical
footprint, 2×5 solid cells separated by one pixel, one-pixel interior margin
on both ends, restrained terminal on the right. Each cell represents 25%.
Normal color remains the shared active gold. Charging symbol stays inside.
Four-cell redraw compiled, admitted and installed. Final framebuffer capture
found Kanade open; launcher battery screenshot remains pending return to launcher.

Force-quit integration (2026-11-13): genuine Select+Start hold from Kanade was
injected via its evdev pad node. Returned to PocketShell, consumed the marker
once and displayed the localized notice. Width corrected to 320 logical pixels
so localized names fit; screenshot forcequit.png catches the fade-in transition.
