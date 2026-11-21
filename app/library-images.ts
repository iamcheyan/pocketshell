import { getOps } from "@pocketjs/framework/host";
import { decodeBase64 } from "./base64";
import { pixelateRgba } from "./pixelate-image";

type ImageHost = { __launcher?: (command: string) => string };
const cache = new Map<string, number>();
const CACHE_LIMIT = 24;

export function libraryTexture(
  host: ImageHost | undefined,
  path: string | undefined,
  variant: "cover" | "background",
  pixelate?: boolean
): number | undefined {
  if (!path || /[\t\r\n]/.test(path)) return undefined;
  const key = `${variant}\t${pixelate ? "pixel" : "smooth"}\t${path}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const encoded = host?.__launcher?.(`COVER\t${variant}\t${path}`) ?? "";
  const pixels = decodeBase64(encoded);
  const width = 128;
  const height = 128;
  if (!pixels || pixels.length !== width * height * 4) return undefined;
  const finalPixels = variant === "cover" && pixelate ? pixelateRgba(pixels, width, height, 2) : pixels;
  const handle = getOps().uploadTexture(finalPixels, width, height, 3);
  if (handle < 0) return undefined;
  cache.set(key, handle);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const removed = cache.get(oldest);
    cache.delete(oldest);
    if (removed !== undefined) getOps().freeTexture?.(removed);
  }
  return handle;
}
