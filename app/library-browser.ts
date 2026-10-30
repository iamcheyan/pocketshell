import { ROOTS, WINDOW_BYTES, type FileSystem } from "./library-model";

export type BrowserBridgeOptions = { dataRoot: string; roots?: string[] };
export function createBrowserBridge(options: BrowserBridgeOptions) {
  const rootMap = new Map((options.roots ?? ROOTS).map((root, index) => [root, `/fixture-${index}`]));
  const state = new Map<string, string>();
  const bridge = async (command: string): Promise<string> => {
    const [op, path = "", arg = "", length = ""] = command.split("\t", 4);
    if (op === "STATE_GET") return state.get(path) ?? "";
    if (op === "STATE_SET") { state.set(path, arg); return "ok"; }
    const root = [...rootMap.keys()].find((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (!root) return op === "LIST" ? "[]" : "";
    const virtualPath = path.replace(root, rootMap.get(root)!);
    if (op === "LIST") {
      const entries = await fetch(`/fixture-api/list?root=${encodeURIComponent(virtualPath)}`).then((response) => response.json());
      return JSON.stringify(entries);
    }
    if (op === "READ") {
      const offset = Number(arg);
      const size = Math.min(Number(length), WINDOW_BYTES);
      return fetch(`/fixture-api/read?path=${encodeURIComponent(virtualPath)}&offset=${offset}&length=${size}`).then((response) => response.text());
    }
    return "";
  };
  return { bridge, dataRoot: options.dataRoot };
}

export function createLocalFileSystem(files: Map<string, Uint8Array>): FileSystem {
  return {
    list(path) { return [...files.keys()].filter((name) => name.startsWith(`${path}/`)); },
    stat(path) { const bytes = files.get(path); return bytes ? { size: bytes.length, isDirectory: false } : undefined; },
    read(path, offset, length) { const bytes = files.get(path); return bytes?.subarray(offset, offset + Math.min(length, WINDOW_BYTES)) ?? new Uint8Array(); },
    write(_path, _value) { throw new Error("browser local fixture filesystem is read only"); },
  };
}
