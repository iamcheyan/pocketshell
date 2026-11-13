import type { Translator } from "./i18n";

export interface LauncherApp {
  id: string;
  nameKey: string;
  shortKey: string;
  descKey: string;
  tagKey: string;
  kind: "native" | "fetch";
  category: "home" | "media" | "games" | "system";
  icon: string;
  romPath?: string;
  label?: string;
  cover?: string;
  coverPath?: string;
  favorite?: boolean;
}

export const LAUNCHER_APPS: readonly LauncherApp[] = [
  { id: "pocketfetch", nameKey: "app.systemInfo", shortKey: "app.systemInfo.short", descKey: "app.systemInfo.desc", tagKey: "catalog.fetch", kind: "fetch", category: "home", icon: "\uf120" },
  { id: "terminal", nameKey: "app.terminal", shortKey: "app.terminal.short", descKey: "app.terminal.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf120" },
  { id: "disk", nameKey: "app.files", shortKey: "app.files.short", descKey: "app.files.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf07b" },
  { id: "xmplayer", nameKey: "app.player", shortKey: "app.player", descKey: "app.player.desc", tagKey: "catalog.native", kind: "native", category: "media", icon: "\uf001" },
  { id: "kanade", nameKey: "app.kanade", shortKey: "app.kanade", descKey: "app.kanade.desc", tagKey: "catalog.native", kind: "native", category: "media", icon: "\uf03d" },
] as const;

const RUNNABLE: Record<string, true> = { pocketfetch: true, kanade: true, terminal: true };
type Host = { __launcher?: (cmd: string) => string };

function fileTitle(path: string): string {
  const base = path.split("/").pop() || path;
  return base.replace(/\.(gba|gbc?|nes|smc|sfc|md|gen|bin|iso|chd|zip|7z)$/i, "").trim() || base;
}

type LibraryItem = { path: string; title?: string; cover?: string };

function collectLibraryPaths(node: any, out: LibraryItem[]) {
  if (!node) return;
  if (Array.isArray(node)) { for (const v of node) collectLibraryPaths(v, out); return; }
  if (typeof node === "object") {
    if (typeof node.path === "string") out.push({ path: node.path, title: typeof node.title === "string" ? node.title : undefined, cover: typeof node.cover === "string" ? node.cover : undefined });
    for (const v of Object.values(node as any)) collectLibraryPaths(v, out);
  }
}

function romPriority(path: string): number {
  const p = path.toLowerCase();
  if (p.includes("/homebrew/")) return 0;
  if (p.includes("/storage/apps/") || p.includes("/mnt/sdcard/apps/")) return 1;
  if (p.includes("/content/games/")) return 2;
  return 3;
}

function scanRomApps(host?: Host): LauncherApp[] {
  const raw = host?.__launcher?.("ROMS") ?? host?.__launcher?.("GAMESCAN") ?? host?.__launcher?.("ROMSCAN") ?? "";
  if (!raw) return [];
  let paths: LibraryItem[] = [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const library = JSON.parse(trimmed);
      collectLibraryPaths(library?.sections?.games ?? library, paths);
    } catch { paths = []; }
  } else if (!/unknown|error|failed/i.test(trimmed) || trimmed.includes("/")) {
    paths = trimmed.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.startsWith("/")).map((path) => ({ path }));
  }
  const seen = new Set<string>();
  const cleaned = paths.filter(({ path: romPath }) => {
    if (!romPath || seen.has(romPath)) return false;
    const lower = romPath.toLowerCase();
    if (!/\.(gba|gbc?)$/.test(lower)) return false;
    seen.add(romPath);
    return true;
  });
  cleaned.sort((a, b) => romPriority(a.path) - romPriority(b.path) || fileTitle(a.path).localeCompare(fileTitle(b.path)));
  return cleaned.map(({ path: romPath, title, cover }) => ({
    id: `rom:${romPath}`, nameKey: "", shortKey: "", descKey: "",
    tagKey: "catalog.native", kind: "native", category: "games",
    icon: "\uf11b", romPath, label: title || fileTitle(romPath), coverPath: cover || undefined,
  }));
}

export function getAppsForScreen(screen: number, host?: Host): LauncherApp[] {
  if (screen === 0) {
    const roms = scanRomApps(host);
    const nativeApps = LAUNCHER_APPS.filter((app) => RUNNABLE[app.id]);
    return [...nativeApps, ...roms];
  }
  return [];
}

export const appName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.nameKey ? t(app.nameKey) : "")) : "";
export const appShortName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.shortKey ? t(app.shortKey) : "")) : "";
export const appDescription = (t: Translator, app: LauncherApp | undefined) => app ? (app.romPath ? app.romPath : (app.descKey ? t(app.descKey) : "")) : "";
export const appTag = (t: Translator, app: LauncherApp | undefined) => app ? (app.tagKey ? t(app.tagKey) : "") : "";
export function categoryLabel(t: Translator, app: LauncherApp | undefined): string {
  if (!app) return "";
  if (app.category === "games") return t("catalog.games");
  if (app.category === "media") return t("catalog.media");
  if (app.category === "system") return t("catalog.system");
  return t("catalog.tools");
}
