import type { Translator } from "./i18n";

export interface LauncherApp {
  id: string;
  /** i18n keys, resolved at render: the catalog itself holds no prose. */
  nameKey: string;
  shortKey: string;
  descKey: string;
  tagKey: string;
  kind: "native" | "fetch";
  category: "home" | "media" | "games" | "system";
  icon: string;
}

export const LAUNCHER_APPS: readonly LauncherApp[] = [
  {
    id: "pocketfetch",
    nameKey: "app.systemInfo",
    shortKey: "app.systemInfo.short",
    descKey: "app.systemInfo.desc",
    tagKey: "catalog.fetch",
    kind: "fetch",
    category: "home",
    icon: "\uf120",
  },
  {
    id: "disk",
    nameKey: "app.files",
    shortKey: "app.files.short",
    descKey: "app.files.desc",
    tagKey: "catalog.native",
    kind: "native",
    category: "home",
    icon: "\uf07b",
  },
  {
    id: "xmplayer",
    nameKey: "app.player",
    shortKey: "app.player",
    descKey: "app.player.desc",
    tagKey: "catalog.native",
    kind: "native",
    category: "media",
    icon: "\uf001",
  },
  {
    id: "gamehub",
    nameKey: "app.gamehub",
    shortKey: "app.gamehub.short",
    descKey: "app.gamehub.desc",
    tagKey: "catalog.native",
    kind: "native",
    category: "games",
    icon: "\uf11b",
  },
] as const;

// Only the built-in information panel runs: the others shelled out to binaries
// BaseOS does not ship (pocketjs-native-launch, XMPlayer) and the bridge's LAUNCH
// arm needs systemd-run, which BaseOS does not have either. Those entries stay
// in the catalog for the day their binaries ship, but are not offered.
const RUNNABLE: Record<string, true> = { pocketfetch: true, gamehub: true };

export function getAppsForScreen(screen: number): LauncherApp[] {
  if (screen !== 0) return [];
  return ["home", "media", "games"].flatMap((category) =>
    LAUNCHER_APPS.filter((app) => app.category === category && RUNNABLE[app.id]),
  );
}

export const appName = (t: Translator, app: LauncherApp | undefined) => (app ? t(app.nameKey) : "");
export const appShortName = (t: Translator, app: LauncherApp | undefined) => (app ? t(app.shortKey) : "");
export const appDescription = (t: Translator, app: LauncherApp | undefined) => (app ? t(app.descKey) : "");
export const appTag = (t: Translator, app: LauncherApp | undefined) => (app ? t(app.tagKey) : "");

// Label for the left side of the footer: the selected app's category.
export function categoryLabel(t: Translator, app: LauncherApp | undefined): string {
  if (!app) return "";
  if (app.category === "games") return t("catalog.games");
  if (app.category === "media") return t("catalog.media");
  if (app.category === "system") return t("catalog.system");
  return t("catalog.tools");
}
