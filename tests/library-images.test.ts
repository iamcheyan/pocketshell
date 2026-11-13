import { describe, expect, test } from "bun:test";
import { decodeBase64 } from "../app/base64";

describe("cover data decoding", () => {
  test("decodes RGBA bytes and rejects malformed data", () => {
    expect(Array.from(decodeBase64("AAEC/w==") ?? [])).toEqual([0, 1, 2, 255]);
    expect(decodeBase64("broken!")).toBeNull();
    expect(decodeBase64("AAAA=")).toBeNull();
  });
});
