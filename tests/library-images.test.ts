import { describe, expect, test } from "bun:test";
import { decodeBase64 } from "../app/base64";
import { pixelateRgba } from "../app/pixelate-image";

describe("cover data decoding", () => {
  test("decodes RGBA bytes and rejects malformed data", () => {
    expect(Array.from(decodeBase64("AAEC/w==") ?? [])).toEqual([0, 1, 2, 255]);
    expect(decodeBase64("broken!")).toBeNull();
    expect(decodeBase64("AAAA=")).toBeNull();
  });

  test("pixelates RGBA buffer into uniform blocks with sharp pixel contrast", () => {
    // 4x4 image, 2x2 blocks (blockSize = 2)
    const src = new Uint8Array(4 * 4 * 4);
    // Fill block (0,0)-(1,1) with smooth gradient
    src[0] = 100; src[1] = 100; src[2] = 100; src[3] = 255;
    src[4] = 110; src[5] = 110; src[6] = 110; src[7] = 255;
    src[16] = 105; src[17] = 105; src[18] = 105; src[19] = 255;
    src[20] = 115; src[21] = 115; src[22] = 115; src[23] = 255;

    const out = pixelateRgba(src, 4, 4, 2);
    expect(out.length).toBe(src.length);
    // All 4 pixels in block 0 must have the exact same color
    const r0 = out[0], g0 = out[1], b0 = out[2], a0 = out[3];
    expect(out[4]).toBe(r0);
    expect(out[5]).toBe(g0);
    expect(out[16]).toBe(r0);
    expect(out[20]).toBe(r0);
    expect(a0).toBe(255);
  });
});
