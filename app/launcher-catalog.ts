import type { Translator } from "./i18n";

export interface SeriesItem {
  id: string; title: string; romPath: string; coverPath?: string;
  seriesId: string; default?: boolean;
  titles?: { en?: string; zh?: string; ja?: string };
}
export interface LauncherApp {
  id: string; nameKey: string; shortKey: string; descKey: string; tagKey: string;
  kind: "native" | "external" | "series"; category: "home" | "games"; icon: string;
  romPath?: string; label?: string; coverPath?: string; favorite?: boolean;
  isSeries?: boolean; seriesItems?: SeriesItem[]; recentVariant?: string;
  titles?: { en?: string; zh?: string; ja?: string };
}

// Built-in multilingual fallback definitions for popular game series
export const KNOWN_SERIES_TITLES: Record<string, {
  titles: { en: string; ja: string; zh: string };
  variants?: Record<string, { en: string; ja: string; zh: string }>;
}> = {
  "fe-binding-blade": {
    titles: {
      zh: "火焰之纹章：封印之剑",
      en: "Fire Emblem: The Binding Blade",
      ja: "ファイアーエムブレム 封印の剣",
    },
    variants: {
      "zh-Hans": { zh: "简体中文（CGP汉化版）", en: "Simplified Chinese (CGP)", ja: "簡体字中国語（CGP版）" },
      "ja": { zh: "日版", en: "Japanese", ja: "日本語版" },
    },
  },
  "fe-blazing-blade": {
    titles: {
      zh: "火焰之纹章：烈火之剑",
      en: "Fire Emblem: The Blazing Blade",
      ja: "ファイアーエムブレム 烈火の剣",
    },
    variants: {
      "zh-Hans": { zh: "简体中文（火花狼组汉化版）", en: "Simplified Chinese (Spark Wolf)", ja: "簡体字中国語（火花狼組版）" },
      "ja": { zh: "日版", en: "Japanese", ja: "日本語版" },
    },
  },
  "fe-sacred-stones": {
    titles: {
      zh: "火焰之纹章：圣魔之光石",
      en: "Fire Emblem: The Sacred Stones",
      ja: "ファイアーエムブレム 聖魔の光石",
    },
    variants: {
      "zh-Hans": { zh: "简体中文（狼组汉化版）", en: "Simplified Chinese (Wolf Team)", ja: "簡体字中国語（狼組版）" },
      "ja": { zh: "日版", en: "Japanese", ja: "日本語版" },
    },
  },
  "golden-sun": {
    titles: {
      zh: "黄金太阳：开启的封印",
      en: "Golden Sun: The Broken Seal",
      ja: "黄金の太陽 開かれし封印",
    },
    variants: {
      "zh-Hans-2024": { zh: "简体中文（2024新汉化版）", en: "Simplified Chinese (2024)", ja: "簡体字中国語（2024年新訳）" },
      "zh-Hans-cgp": { zh: "简体中文（CGP经典汉化版）", en: "Simplified Chinese (CGP)", ja: "簡体字中国語（CGP版）" },
      "ja": { zh: "日版", en: "Japanese", ja: "日本語版" },
      "en-EU": { zh: "欧版（多语言）", en: "Europe (Multi-Language)", ja: "欧州版（多言語）" },
    },
  },
  "zelda-minish-cap": {
    titles: {
      zh: "塞尔达传说：缩小帽",
      en: "The Legend of Zelda: The Minish Cap",
      ja: "ゼルダの伝説 ふしぎのぼうし",
    },
    variants: {
      "zh-Hans": { zh: "简体中文版", en: "Simplified Chinese", ja: "簡体字中国語" },
      "zh-Hant": { zh: "繁体中文版", en: "Traditional Chinese", ja: "繁体字中国語" },
      "ja": { zh: "日版", en: "Japanese", ja: "日本語版" },
      "en-US": { zh: "美版", en: "North America (USA)", ja: "北米版（USA）" },
      "en-EU": { zh: "欧版（多语言）", en: "Europe (Multi-5)", ja: "欧州版（多言語）" },
    },
  },
};

// Built-in native launcher items.
export const LAUNCHER_APPS: readonly LauncherApp[] = [
  { id: "files", nameKey: "app.files", shortKey: "app.files.short", descKey: "app.files.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf07b" },
  { id: "saves", nameKey: "app.saves", shortKey: "app.saves.short", descKey: "app.saves.desc", tagKey: "catalog.native", kind: "native", category: "home", icon: "\uf0c7" },
];

type Host = { __launcher?: (cmd: string) => string };
type RomItem = { path: string; title?: string; cover?: string };
type LibrarySeriesVariant = {
  id: string; title: string; path: string; cover?: string; default?: boolean;
  title_en?: string; title_ja?: string; title_zh?: string;
  titles?: { en?: string; zh?: string; ja?: string };
};
type LibrarySeries = {
  kind: "series"; id: string; title: string; cover?: string;
  title_en?: string; title_ja?: string; title_zh?: string;
  titles?: { en?: string; zh?: string; ja?: string };
  variants: LibrarySeriesVariant[];
};
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
    .map((entry): LauncherApp => {
      const known = KNOWN_SERIES_TITLES[entry.id];
      const entryTitles: { en?: string; zh?: string; ja?: string } = {
        en: entry.title_en || entry.titles?.en || known?.titles.en,
        ja: entry.title_ja || entry.titles?.ja || known?.titles.ja,
        zh: entry.title_zh || entry.titles?.zh || known?.titles.zh || entry.title,
      };

      const variants = entry.variants
        .filter((variant) => typeof variant.id === "string" && typeof variant.title === "string" && typeof variant.path === "string")
        .map((variant) => {
          const knownVar = known?.variants?.[variant.id];
          const variantTitles: { en?: string; zh?: string; ja?: string } = {
            en: variant.title_en || variant.titles?.en || knownVar?.en,
            ja: variant.title_ja || variant.titles?.ja || knownVar?.ja,
            zh: variant.title_zh || variant.titles?.zh || knownVar?.zh || variant.title,
          };
          return {
            id: variant.id, title: variant.title, romPath: variant.path,
            coverPath: variant.cover, seriesId: entry.id, default: variant.default === true,
            titles: variantTitles,
          };
        });
      const saved = host?.__launcher?.(`SETTING\tseries.${entry.id}.lastVariant`)?.trim() ?? "";
      const savedIndex = variants.findIndex((variant) => variant.id === saved);
      let recentVariant: string | undefined;
      if (savedIndex >= 0) {
        recentVariant = saved;
        if (savedIndex > 0) variants.unshift(...variants.splice(savedIndex, 1));
      } else {
        const defaultIndex = variants.findIndex((variant) => variant.default);
        if (defaultIndex > 0) variants.unshift(...variants.splice(defaultIndex, 1));
      }
      return {
        id: `series:${entry.id}`, nameKey: "", shortKey: "", descKey: "", tagKey: "catalog.series",
        kind: "series", category: "games", icon: "\uf11b", isSeries: true, label: entry.title,
        coverPath: entry.cover, seriesItems: variants, recentVariant, titles: entryTitles,
      };
    })
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

export function appName(t: Translator, app: LauncherApp | undefined, lang: string = "zh"): string {
  if (!app) return "";
  const key = lang.startsWith("ja") ? "ja" : lang.startsWith("en") ? "en" : "zh";
  if (app.titles?.[key]) return app.titles[key]!;
  if (app.nameKey && t) return t(app.nameKey);
  return app.label || "";
}

export function seriesItemTitle(item: SeriesItem, lang: string = "zh"): string {
  const key = lang.startsWith("ja") ? "ja" : lang.startsWith("en") ? "en" : "zh";
  if (item.titles?.[key]) return item.titles[key]!;
  return item.title;
}

export const appShortName = (t: Translator, app: LauncherApp | undefined, lang: string = "zh") => appName(t, app, lang);
export const appDescription = (t: Translator, app: LauncherApp | undefined) => app ? (app.romPath || (app.descKey ? t(app.descKey) : "")) : "";
export const appTag = (t: Translator, app: LauncherApp | undefined) => app ? (app.tagKey ? t(app.tagKey) : "") : "";
export function categoryLabel(t: Translator, app: LauncherApp | undefined): string {
  if (!app) return "";
  if (app.isSeries) return t("catalog.series");
  return app.category === "games" ? t("catalog.games") : t("catalog.tools");
}
