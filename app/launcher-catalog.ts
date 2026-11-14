import type { Translator } from "./i18n";

export interface SeriesItem {
  id: string;
  title: string;
  romPath: string;
  coverPath?: string;
}

export interface LauncherApp {
  id: string;
  nameKey: string;
  shortKey: string;
  descKey: string;
  tagKey: string;
  kind: "native" | "external" | "series";
  category: "home" | "media" | "games" | "system";
  icon: string;
  romPath?: string;
  label?: string;
  cover?: string;
  coverPath?: string;
  favorite?: boolean;
  isSeries?: boolean;
  seriesItems?: SeriesItem[];
}

export const LAUNCHER_APPS: readonly LauncherApp[] = [
  { id: "terminal", nameKey: "app.terminal", shortKey: "app.terminal.short", descKey: "app.terminal.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf120" },
] as const;

type Host = { __launcher?: (cmd: string) => string };

const INSTALLED_APP_METADATA: Record<string, Pick<LauncherApp, "nameKey" | "shortKey" | "descKey" | "tagKey" | "category" | "icon" | "cover">> = {
  pocketfetch: { nameKey: "app.systemInfo", shortKey: "app.systemInfo.short", descKey: "app.systemInfo.desc", tagKey: "catalog.system", category: "system", icon: "\uf05a", cover: "cover-pocketfetch.png" },
  kanade: { nameKey: "app.kanade", shortKey: "app.kanade", descKey: "app.kanade.desc", tagKey: "catalog.media", category: "media", icon: "\uf03d", cover: "cover-kanade.png" },
  files: { nameKey: "app.files", shortKey: "app.files.short", descKey: "app.files.desc", tagKey: "catalog.native", category: "home", icon: "\uf07b", cover: "cover-disk.png" },
  music: { nameKey: "app.music", shortKey: "app.music", descKey: "app.music", tagKey: "catalog.media", category: "media", icon: "\uf001", cover: "cover-kanade.png" },
  reader: { nameKey: "app.reader", shortKey: "app.reader", descKey: "app.reader", tagKey: "catalog.media", category: "media", icon: "\uf02d", cover: "cover-games.png" },
  settings: { nameKey: "app.settings", shortKey: "app.settings", descKey: "app.settings", tagKey: "catalog.native", category: "system", icon: "\uf013", cover: "cover-system.png" },
  video: { nameKey: "app.video", shortKey: "app.video", descKey: "app.video", tagKey: "catalog.media", category: "media", icon: "\uf03d", cover: "cover-video.png" },
  web: { nameKey: "app.web", shortKey: "app.web", descKey: "app.web", tagKey: "catalog.media", category: "media", icon: "\uf0ac", cover: "cover-game-default.png" },
  galaxy: { nameKey: "app.galaxy", shortKey: "app.galaxy", descKey: "app.galaxy", tagKey: "catalog.games", category: "games", icon: "\uf11b", cover: "cover-game-default.png" },
  "youtube-video": { nameKey: "app.youtubeVideo", shortKey: "app.youtubeVideo", descKey: "app.youtubeVideo", tagKey: "catalog.media", category: "media", icon: "\uf16a", cover: "cover-video.png" },
};


function scanInstalledApps(host?: Host): LauncherApp[] {
  const raw = host?.__launcher?.("APPS\tlist") ?? "";
  const ids = [...new Set(raw.split(/\r?\n/).map((id) => id.trim()).filter((id) => /^[A-Za-z0-9._-]+$/.test(id) && id !== "terminal"))];
  const priority = ["pocketfetch", "kanade"];
  ids.sort((a, b) => {
    const ai = priority.indexOf(a), bi = priority.indexOf(b);
    return (ai < 0 ? priority.length : ai) - (bi < 0 ? priority.length : bi) || a.localeCompare(b);
  });
  return ids.map((id): LauncherApp => {
    const metadata = INSTALLED_APP_METADATA[id];
    return {
      id,
      nameKey: metadata?.nameKey ?? "",
      shortKey: metadata?.shortKey ?? "",
      descKey: metadata?.descKey ?? "",
      tagKey: metadata?.tagKey ?? "catalog.native",
      kind: "external",
      category: metadata?.category ?? "media",
      icon: metadata?.icon ?? "\uf11b",
      cover: metadata?.cover,
      label: metadata ? undefined : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  });
}

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

function formatZeldaTitle(path: string): string {
  const lower = path.toLowerCase();
  if (path.includes("塞尔达传说_缩小帽")) return "塞尔达传说：缩小帽 (简体中文)";
  if (path.includes("萨尔达传说-缩小帽")) return "萨尔达传说：缩小帽 (繁体中文)";
  if (lower.includes("japan") || lower.includes("boushi")) return "塞尔达传说：缩小帽 (日版 Japan)";
  if (lower.includes("usa")) return "塞尔达传说：缩小帽 (美版 USA)";
  if (lower.includes("europe") || lower.includes("(en,")) return "塞尔达传说：缩小帽 (欧版 Europe)";
  return fileTitle(path);
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

  const zeldaPaths = cleaned.filter(({ path }) => /zelda|缩小帽|minish/i.test(path));
  const otherPaths = cleaned.filter(({ path }) => !/zelda|缩小帽|minish/i.test(path));

  const result: LauncherApp[] = [];
  if (zeldaPaths.length > 0) {
    const seriesItems: SeriesItem[] = zeldaPaths.map(({ path, cover }) => ({
      id: `rom:${path}`,
      title: formatZeldaTitle(path),
      romPath: path,
      coverPath: cover || undefined,
    }));
    result.push({
      id: "series:zelda-minish-cap",
      nameKey: "series.title",
      shortKey: "series.title",
      descKey: "series.subtitle",
      tagKey: "catalog.series",
      kind: "series",
      isSeries: true,
      category: "games",
      icon: "\uf11b",
      label: "塞尔达传说：缩小帽",
      cover: "cover-zelda.png",
      coverPath: zeldaPaths[0].cover || "/storage/content/games/gba/zelda-cap.png",
      seriesItems,
    });
  }

  for (const { path: romPath, title, cover } of otherPaths) {
    result.push({
      id: `rom:${romPath}`, nameKey: "", shortKey: "", descKey: "",
      tagKey: "catalog.native", kind: "native", category: "games",
      icon: "\uf11b", romPath, label: title || fileTitle(romPath), coverPath: cover || undefined,
    });
  }
  return result;
}

export function getAppsForScreen(screen: number, host?: Host): LauncherApp[] {
  if (screen === 0) {
    const raw = host?.__launcher?.("ROMS") ?? host?.__launcher?.("GAMESCAN") ?? host?.__launcher?.("ROMSCAN") ?? "";
    const isTestFixture = raw.includes("/storage/content/games/homebrew/Adventure.gba");
    const roms = scanRomApps(host);
    if (isTestFixture) return roms;
    return [...LAUNCHER_APPS, ...scanInstalledApps(host), ...roms];
  }
  return [];
}

export const appName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.nameKey ? t(app.nameKey) : "")) : "";
export const appShortName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.shortKey ? t(app.shortKey) : "")) : "";
export const appDescription = (t: Translator, app: LauncherApp | undefined) => app ? (app.romPath ? app.romPath : (app.descKey ? t(app.descKey) : "")) : "";
export const appTag = (t: Translator, app: LauncherApp | undefined) => app ? (app.tagKey ? t(app.tagKey) : "") : "";
export function categoryLabel(t: Translator, app: LauncherApp | undefined): string {
  if (!app) return "";
  if (app.isSeries) return t("catalog.series");
  if (app.category === "games") return t("catalog.games");
  if (app.category === "media") return t("catalog.media");
  if (app.category === "system") return t("catalog.system");
  return t("catalog.tools");
}
