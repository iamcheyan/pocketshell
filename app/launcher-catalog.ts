import type { Translator } from "./i18n";

export interface SeriesItem { id: string; title: string; romPath: string; coverPath?: string; }
export interface LauncherApp {
  id: string; nameKey: string; shortKey: string; descKey: string; tagKey: string;
  kind: "native" | "external" | "series"; category: "home" | "games"; icon: string;
  romPath?: string; label?: string; coverPath?: string; favorite?: boolean;
  isSeries?: boolean; seriesItems?: SeriesItem[];
}

// The only built-in item. Games are discovered from the card library.
export const LAUNCHER_APPS: readonly LauncherApp[] = [
  { id: "terminal", nameKey: "app.terminal", shortKey: "app.terminal.short", descKey: "app.terminal.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf120" },
] as const;

type Host = { __launcher?: (cmd: string) => string };
type RomItem = { path: string; title?: string; cover?: string };
type LibrarySeries = { kind: "series"; id: string; title: string; cover?: string; variants: Array<{ id: string; title: string; path: string; cover?: string }> };
type LibraryItem = RomItem | LibrarySeries;

function displayAppId(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Installed programs are data-driven: a package at /storage/apps/<id>.pocket
// appears as a card, and the optional sibling /storage/apps/<id>.png is its cover.
// The runtime validates the same id syntax before launch.
function scanInstalledApps(host?: Host): LauncherApp[] {
  const raw = host?.__launcher?.("APPS\tlist") ?? "";
  const ids = [...new Set(raw.split(/\r?\n/)
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id) && id !== "terminal"))]
    .sort((a, b) => a.localeCompare(b));
  return ids.map((id): LauncherApp => ({
    id, nameKey: "", shortKey: "", descKey: "", tagKey: "catalog.native",
    kind: "external", category: "home", icon: "\uf11b", label: displayAppId(id),
    coverPath: `/storage/apps/${id}.png`,
  }));
}

function fileTitle(path: string): string {
  const base = path.split("/").pop() || path;
  return base.replace(/\.(gba|gbc?)$/i, "").trim() || base;
}

function collectLibraryItems(node: unknown, out: LibraryItem[]): void {
  if (!node) return;
  if (Array.isArray(node)) { for (const value of node) collectLibraryItems(value, out); return; }
  if (typeof node !== "object") return;
  const value = node as Record<string, unknown>;
  if (value.kind === "series" && typeof value.id === "string" && typeof value.title === "string" && Array.isArray(value.variants)) {
    out.push(value as unknown as LibrarySeries);
    return;
  }
  if (typeof value.path === "string") out.push({ path: value.path, title: typeof value.title === "string" ? value.title : undefined, cover: typeof value.cover === "string" ? value.cover : undefined });
  for (const child of Object.values(value)) collectLibraryItems(child, out);
}

function gameLibrary(host?: Host): LibraryItem[] {
  const raw = host?.__launcher?.("ROMS") ?? host?.__launcher?.("GAMESCAN") ?? host?.__launcher?.("ROMSCAN") ?? "";
  if (!raw) return [];
  try {
    const library = JSON.parse(raw);
    const items: LibraryItem[] = [];
    collectLibraryItems(library?.sections?.games ?? library, items);
    return items;
  } catch { return []; }
}

function scanRomApps(host?: Host): LauncherApp[] {
  const entries = gameLibrary(host);
  const series = entries.filter((entry): entry is LibrarySeries => "kind" in entry)
    .filter((entry) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id))
    .map((entry): LauncherApp => ({
      id: `series:${entry.id}`, nameKey: "", shortKey: "", descKey: "", tagKey: "catalog.series",
      kind: "series", category: "games", icon: "\uf11b", isSeries: true, label: entry.title, coverPath: entry.cover,
      seriesItems: entry.variants
        .filter((variant) => typeof variant.id === "string" && typeof variant.title === "string" && typeof variant.path === "string")
        .map((variant) => ({ id: variant.id, title: variant.title, romPath: variant.path, coverPath: variant.cover })),
    }))
    .filter((entry) => (entry.seriesItems?.length || 0) > 0);
  const seen = new Set<string>();
  const roms = entries.filter((entry): entry is RomItem => "path" in entry)
    .filter((entry) => /\.(gba|gbc?)$/i.test(entry.path) && !seen.has(entry.path) && !!seen.add(entry.path))
    .sort((a, b) => (a.title || fileTitle(a.path)).localeCompare(b.title || fileTitle(b.path)))
    .map((entry): LauncherApp => ({
      id: `rom:${entry.path}`, nameKey: "", shortKey: "", descKey: "", tagKey: "catalog.native",
      kind: "native", category: "games", icon: "\uf11b", romPath: entry.path,
      label: entry.title || fileTitle(entry.path), coverPath: entry.cover,
    }));
  return [...series, ...roms];
}

export function getAppsForScreen(screen: number, host?: Host): LauncherApp[] {
  return screen === 0 ? [...LAUNCHER_APPS, ...scanInstalledApps(host), ...scanRomApps(host)] : [];
}
export const appName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.nameKey ? t(app.nameKey) : "")) : "";
export const appShortName = (t: Translator, app: LauncherApp | undefined) => app ? (app.label || (app.shortKey ? t(app.shortKey) : "")) : "";
export const appDescription = (t: Translator, app: LauncherApp | undefined) => app ? (app.romPath || (app.descKey ? t(app.descKey) : "")) : "";
export const appTag = (t: Translator, app: LauncherApp | undefined) => app ? (app.tagKey ? t(app.tagKey) : "") : "";
export function categoryLabel(t: Translator, app: LauncherApp | undefined): string {
  if (!app) return "";
  if (app.isSeries) return t("catalog.series");
  return app.category === "games" ? t("catalog.games") : t("catalog.tools");
}
