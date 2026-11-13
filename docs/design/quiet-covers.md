# Quiet covers · 2026-11-12

360×240 logical / 720×480 panel. Equal 124×124 cover tiles, centered selection,
140px pitch. Selection uses a fine sage border; no scaling or spring easing.
Only the selected title appears beneath the carousel, capped at 28 characters.
Paths, type badges, repeated descriptions and connection-service icons are removed.

Minish Cap Japan cover source:
https://thumbnails.libretro.com/Nintendo%20-%20Game%20Boy%20Advance/Named_Boxarts/Zelda%20no%20Densetsu%20-%20Fushigi%20no%20Boushi%20(Japan).png

Artwork is letterboxed without stretching into a 256×256 runtime texture.
Unknown games retain a neutral game symbol until positively matched artwork is available.

Second pass: full photographic covers for system/video/generic games; two-line
selected title with CJK-aware width budget. Settings uses six 28px rows and the
same sage/ivory/warm charcoal palette as system, Wi-Fi and Bluetooth pages.

Photo sources:
- https://unsplash.com/photos/close-up-of-a-green-circuit-board-with-components-mrTVz_fosMY
- https://images.unsplash.com/photo-1478720568477-152d9b164e26
- https://images.unsplash.com/photo-1493711662062-fa541adb3fc8

Device validation: package admitted and deployed over SSH. Captured app carousel,
Minish Cap cover, six-row settings and system overview at native 720×480.
Screenshots are in quiet-covers/. Repeated ROM basenames are collapsed so copied
files do not create repeated covers. Full filenames remain available to launch
logic; only presentation titles are formatted.
