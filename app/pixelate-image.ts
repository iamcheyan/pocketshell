/**
 * High-clarity retro pixel art converter.
 *
 * Designed specifically for handheld game covers:
 * 1. Pre-sharpens high-frequency details (eyes, character outlines, logo text) so
 *    features do not blur away during block pooling.
 * 2. 2x2 block pooling (64x64 grid on 128x128 texture) matches the RG34XX 720x480
 *    panel's native 3x3 GBA pixel scale (240x160 -> 720x480).
 * 3. 5-bit GBA color quantization (32 discrete tonal steps per channel) and contrast
 *    enhancement creates authentic, vibrant, recognizable retro pixel art.
 */
export function pixelateRgba(src: Uint8Array, width: number, height: number, blockSize = 2): Uint8Array {
  const b = Math.max(1, Math.floor(blockSize));
  const len = width * height * 4;
  if (src.length !== len || width < 2 || height < 2) return src;

  // Step 1: High-frequency unsharp sharpening buffer
  const sharpR = new Float32Array(width * height);
  const sharpG = new Float32Array(width * height);
  const sharpB = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = y;
    const y2 = Math.min(height - 1, y + 1);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = x;
      const x2 = Math.min(width - 1, x + 1);

      const iCenter = (y1 * width + x1) * 4;
      const rCenter = src[iCenter];
      const gCenter = src[iCenter + 1];
      const bCenter = src[iCenter + 2];

      // 3x3 Gaussian-weighted blur kernel: [1, 2, 1; 2, 4, 2; 1, 2, 1] / 16
      const i00 = (y0 * width + x0) * 4;
      const i01 = (y0 * width + x1) * 4;
      const i02 = (y0 * width + x2) * 4;
      const i10 = (y1 * width + x0) * 4;
      const i12 = (y1 * width + x2) * 4;
      const i20 = (y2 * width + x0) * 4;
      const i21 = (y2 * width + x1) * 4;
      const i22 = (y2 * width + x2) * 4;

      const rBlur = (
        (src[i00] + src[i02] + src[i20] + src[i22]) +
        ((src[i01] + src[i10] + src[i12] + src[i21]) << 1) +
        (rCenter << 2)
      ) / 16;

      const gBlur = (
        (src[i00 + 1] + src[i02 + 1] + src[i20 + 1] + src[i22 + 1]) +
        ((src[i01 + 1] + src[i10 + 1] + src[i12 + 1] + src[i21 + 1]) << 1) +
        (gCenter << 2)
      ) / 16;

      const bBlur = (
        (src[i00 + 2] + src[i02 + 2] + src[i20 + 2] + src[i22 + 2]) +
        ((src[i01 + 2] + src[i10 + 2] + src[i12 + 2] + src[i21 + 2]) << 1) +
        (bCenter << 2)
      ) / 16;

      const idx = y * width + x;
      // Unsharp mask with detail boost
      sharpR[idx] = Math.max(0, Math.min(255, rCenter + (rCenter - rBlur) * 1.3));
      sharpG[idx] = Math.max(0, Math.min(255, gCenter + (gCenter - gBlur) * 1.3));
      sharpB[idx] = Math.max(0, Math.min(255, bCenter + (bCenter - bBlur) * 1.3));
    }
  }

  // Step 2: Block pooling + contrast boost + 5-bit GBA palette quantization
  const dst = new Uint8Array(len);

  for (let by = 0; by < height; by += b) {
    const bh = Math.min(b, height - by);
    for (let bx = 0; bx < width; bx += b) {
      const bw = Math.min(b, width - bx);
      const count = bw * bh;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const idx = (by + y) * width + (bx + x);
          rSum += sharpR[idx];
          gSum += sharpG[idx];
          bSum += sharpB[idx];
          aSum += src[idx * 4 + 3];
        }
      }

      let r = rSum / count;
      let g = gSum / count;
      let bVal = bSum / count;
      const a = Math.round(aSum / count);

      // Contrast enhancement: punchy retro dynamic range
      r = (r - 128) * 1.18 + 128;
      g = (g - 128) * 1.18 + 128;
      bVal = (bVal - 128) * 1.18 + 128;

      // 5-bit GBA color quantization (32 steps per channel, step size = 8)
      const rQuant = Math.max(0, Math.min(255, Math.round(r / 8) * 8));
      const gQuant = Math.max(0, Math.min(255, Math.round(g / 8) * 8));
      const bQuant = Math.max(0, Math.min(255, Math.round(bVal / 8) * 8));

      // Fill all pixels in this block with the crisp pixel-art color
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const outIdx = ((by + y) * width + (bx + x)) * 4;
          dst[outIdx] = rQuant;
          dst[outIdx + 1] = gQuant;
          dst[outIdx + 2] = bQuant;
          dst[outIdx + 3] = a;
        }
      }
    }
  }

  return dst;
}
