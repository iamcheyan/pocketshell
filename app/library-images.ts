import { getOps } from "@pocketjs/framework/host";
import { decodeBase64 } from "./base64";

type ImageHost = { __launcher?: (command: string) => string };
const cache = new Map<string, number>();
const CACHE_LIMIT = 24;

export function libraryTexture(host: ImageHost | undefined, path: string | undefined, variant: "cover" | "background"): number | undefined {
  if (!path || /[\t\r\n]/.test(path)) return undefined;
  const key = `${variant}\t${path}`;
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
  const handle = getOps().uploadTexture(pixels, width, height, 3);
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
