#!/usr/bin/env python3
"""Convert a raw /dev/fb0 dump into a PNG.

Usage: raw-to-png.py <frame.raw> <out.png> [width] [height] [bpp] [page]

The RG34XX panel is a 720x480 RGB565 framebuffer on ROCKNIX, but BaseOS exposes
32 bpp with a double buffer (virtual_size 720,960): a full dump is two pages of
720x480 ARGB8888. Pick the page you want with the `page` argument (default 0);
pass bpp=16 for a 16-bit single page dump.
"""
import struct
import sys
import zlib


def png(width, height, rgb):
    def chunk(tag, data):
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgb[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6))
            + chunk(b"IEND", b""))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 720
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 480
    bpp = int(sys.argv[5]) if len(sys.argv) > 5 else 32
    page = int(sys.argv[6]) if len(sys.argv) > 6 else 0

    data = open(src, "rb").read()
    bpp = bpp or 32
    page_bytes = width * height * bpp // 8
    start = page * page_bytes
    if len(data) < start + page_bytes:
        raise SystemExit(f"{src}: {len(data)} bytes; need {start + page_bytes} for page {page} at {width}x{height}x{bpp}")
    data = data[start:start + page_bytes]

    out = bytearray(width * height * 3)
    if bpp == 32:
        for i in range(width * height):
            b, g, r = data[4 * i], data[4 * i + 1], data[4 * i + 2]
            out[3 * i], out[3 * i + 1], out[3 * i + 2] = r, g, b
    else:
        for i in range(width * height):
            v = data[2 * i] | (data[2 * i + 1] << 8)
            r = (v >> 11) & 0x1F
            g = (v >> 5) & 0x3F
            b = v & 0x1F
            out[3 * i] = (r << 3) | (r >> 2)
            out[3 * i + 1] = (g << 2) | (g >> 4)
            out[3 * i + 2] = (b << 3) | (b >> 2)
    open(dst, "wb").write(png(width, height, bytes(out)))
    print(f"{dst}: {width}x{height} from page {page} ({bpp} bpp)")


if __name__ == "__main__":
    main()
