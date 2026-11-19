# CPR-163 — bitmap font rendering evidence

Work-in-progress evidence for issue #163. The interface now renders on a
360×240 logical canvas presented 2× on the 720×480 panel, with Fusion Pixel 12 px
glyphs baked at native size (no `rasterDensity` up-sampling).

## Device main screen

![Device main screen](device-main.png)

Captured from `/dev/fb0` on the handheld after deploying the new runtime and
package. The text is a 12 px bitmap glyph doubled by the 2× presentation; the
card and covers draw at half the old 720-width coordinates.

## Library render (six-item fixture)

![Library render](render-library-6.png)

Headless render of the same package with a six-item game library, used to check
card spacing and the carousel offsets without touching the device.

## Text at 1:1

![Text zoom](text-zoom.png)

Unscaled crop of the title/footer line: every glyph pixel is a uniform 2×2
block, i.e. the framebuffer doubles the whole 360×240 canvas instead of smoothing
glyph outlines.

## Still open

- Settings and system pages have not been re-captured since the layout rescale.
- A few rows still crowd the right/bottom edge; spacing needs a second pass.
- The launcher's own library listing on the device shows the cards, but the
  capture above was taken while the previous frame was still on screen.
