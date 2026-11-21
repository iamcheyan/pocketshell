import { describe, expect, test } from "bun:test";
import { getAppsForScreen, appName, seriesItemTitle, recordRecentApp, getRecentAppIds } from "../app/launcher-catalog";

describe("game library metadata", () => {
  test("discovers an installed app and same-name cover without an app-specific rule", () => {
    const host = { __launcher: (command: string) => command === "APPS\tlist"
      ? "kanade\n"
      : JSON.stringify({ sections: { games: [] } }) };
    const app = getAppsForScreen(0, host).find((item) => item.id === "kanade");
    expect(app).toMatchObject({
      id: "kanade", kind: "external", label: "Kanade",
      coverPath: "/storage/apps/kanade.png",
    });
  });

  test("renders scanner-defined series without a title-specific rule", () => {
    const host = { __launcher: () => JSON.stringify({ sections: { games: [{ items: [{
      kind: "series", id: "example-series", title: "Example Series", cover: "/games/example/cover.png",
      variants: [{ id: "en", title: "English", path: "/games/example/gba/example.en.gba", cover: "/games/example/gba/example.en.png" }],
    }] }] } }) };
    const game = getAppsForScreen(0, host).find((item) => item.isSeries);
    expect(game?.id).toBe("series:example-series");
    expect(game?.label).toBe("Example Series");
    expect(game?.seriesItems?.[0]).toMatchObject({ id: "en", title: "English", romPath: "/games/example/gba/example.en.gba" });
  });
  test("moves the saved variant first and marks it recent", () => {
    const library = { sections: { games: [{ items: [{
      kind: "series", id: "example-series", title: "Example Series",
      variants: [
        { id: "zh", title: "Chinese", path: "/games/example/gba/a.gba", default: true },
        { id: "ja", title: "Japanese", path: "/games/example/gba/b.gba" },
      ],
    }] }] } };
    const host = { __launcher: (command: string) => command === "ROMS"
      ? JSON.stringify(library)
      : command === "SETTING\tseries.example-series.lastVariant" ? "ja" : "" };
    const game = getAppsForScreen(0, host).find((item) => item.isSeries);
    expect(game?.seriesItems?.[0].id).toBe("ja");
    expect(game?.recentVariant).toBe("ja");
  });

  test("falls back to the declared default when the saved variant is stale", () => {
    const library = { sections: { games: [{ items: [{
      kind: "series", id: "example-series", title: "Example Series",
      variants: [
        { id: "ja", title: "Japanese", path: "/games/example/gba/b.gba" },
        { id: "zh", title: "Chinese", path: "/games/example/gba/a.gba", default: true },
      ],
    }] }] } };
    const host = { __launcher: (command: string) => command === "ROMS"
      ? JSON.stringify(library)
      : command === "SETTING\tseries.example-series.lastVariant" ? "removed" : "" };
    const game = getAppsForScreen(0, host).find((item) => item.isSeries);
    expect(game?.seriesItems?.[0].id).toBe("zh");
    expect(game?.recentVariant).toBeUndefined();
  });
  test("preserves scanned game titles and cover paths", () => {
    const host = { __launcher: () => JSON.stringify({ sections: { games: [{ items: [
      { path: "/storage/roms/gba/game.gba", title: "游戏名称", cover: "/storage/roms/gba/images/game.png" },
    ] }] } }) };
    const game = getAppsForScreen(0, host).find((item) => item.romPath);
    expect(game?.label).toBe("游戏名称");
    expect(game?.coverPath).toBe("/storage/roms/gba/images/game.png");
  });

  test("keeps distinct paths, including games with test in their names", () => {
    const host = { __launcher: () => JSON.stringify({ sections: { games: [{ items: [
      { path: "/storage/roms/gba/Greatest.gba", title: "Greatest" },
      { path: "/storage/roms/gbc/Greatest.GBC", title: "Greatest" },
      { path: "/storage/roms/nes/Unsupported.nes", title: "Unsupported" },
    ] }], music: [{ items: [{ path: "/storage/music/not-a-game.gba" }] }] } }) };
    const games = getAppsForScreen(0, host).filter((item) => item.romPath);
    expect(games.map((item) => item.romPath)).toEqual([
      "/storage/roms/gba/Greatest.gba", "/storage/roms/gbc/Greatest.GBC",
    ]);
  });

  test("switches series title and variant titles by device language", () => {
    const library = { sections: { games: [{ items: [{
      kind: "series", id: "fe-binding-blade", title: "火焰之纹章：封印之剑",
      title_zh: "火焰之纹章：封印之剑",
      title_en: "Fire Emblem: The Binding Blade",
      title_ja: "ファイアーエムブレム 封印の剣",
      variants: [
        {
          id: "zh-Hans", title: "简体中文（CGP汉化版）",
          title_zh: "简体中文（CGP汉化版）",
          title_en: "Simplified Chinese (CGP)",
          title_ja: "簡体字中国語（CGP版）",
          path: "/storage/games/fe6_cn.gba",
        },
        {
          id: "ja", title: "日版",
          title_zh: "日版",
          title_en: "Japanese",
          title_ja: "日本語版",
          path: "/storage/games/fe6_ja.gba",
        },
      ],
    }] }] } };
    const host = { __launcher: () => JSON.stringify(library) };
    const dummyTranslator = (key: string) => key;

    const game = getAppsForScreen(0, host).find((item) => item.isSeries);
    expect(game).toBeDefined();

    // Chinese
    expect(appName(dummyTranslator, game, "zh")).toBe("火焰之纹章：封印之剑");
    expect(seriesItemTitle(game!.seriesItems![0], "zh")).toBe("简体中文（CGP汉化版）");
    expect(seriesItemTitle(game!.seriesItems![1], "zh")).toBe("日版");

    // English
    expect(appName(dummyTranslator, game, "en")).toBe("Fire Emblem: The Binding Blade");
    expect(seriesItemTitle(game!.seriesItems![0], "en")).toBe("Simplified Chinese (CGP)");
    expect(seriesItemTitle(game!.seriesItems![1], "en")).toBe("Japanese");

    // Japanese
    expect(appName(dummyTranslator, game, "ja")).toBe("ファイアーエムブレム 封印の剣");
    expect(seriesItemTitle(game!.seriesItems![0], "ja")).toBe("簡体字中国語（CGP版）");
    expect(seriesItemTitle(game!.seriesItems![1], "ja")).toBe("日本語版");
  });

  test("places recently played game at index 0 of the carousel", () => {
    const library = { sections: { games: [{ items: [
      {
        kind: "series", id: "fe-binding-blade", title: "FE6",
        variants: [{ id: "ja", title: "FE6 JA", path: "/storage/games/fe6.gba" }],
      },
      {
        kind: "series", id: "zelda-minish-cap", title: "Zelda",
        variants: [
          { id: "zh", title: "Zelda CN", path: "/storage/games/zelda_cn.gba" },
          { id: "ja", title: "Zelda JA", path: "/storage/games/zelda_ja.gba" },
        ],
      },
    ] }] } };
    const host = {
      __launcher: (cmd: string) => {
        if (cmd === "ROMS") return JSON.stringify(library);
        if (cmd === "APPS\tlist") return "";
        if (cmd === "SETTING\tgames.lastPlayed") return encodeURI("/storage/games/zelda_ja.gba");
        return "";
      },
    };
    const apps = getAppsForScreen(0, host);
    expect(apps[0]?.id).toBe("series:zelda-minish-cap");
    expect(apps[0]?.recentlyPlayed).toBe(true);
  });

  test("identifies translation availability and renders badges", () => {
    const library = { sections: { games: [{ items: [
      {
        kind: "series", id: "zelda-minish-cap", title: "Zelda",
        variants: [
          { id: "zh-Hans", title: "Zelda CN", path: "/storage/games/zelda_cn.gba" },
          { id: "ja", title: "Zelda JA", path: "/storage/games/zelda_ja.gba" },
        ],
      },
    ] }] } };
    const host = {
      __launcher: (cmd: string) => cmd === "ROMS" ? JSON.stringify(library) : "",
    };
    const apps = getAppsForScreen(0, host);
    const zelda = apps.find((a) => a.id === "series:zelda-minish-cap");
    expect(zelda?.hasTranslation).toBe(true);
    expect(zelda?.seriesItems?.find((v) => v.id === "ja")?.translation).toBe("ja-zh");
  });

  test("dynamically sorts all apps and games in MRU order", () => {
    const library = { sections: { games: [{ items: [
      {
        kind: "series", id: "golden-sun-the-lost-age", title: "Golden Sun 2",
        variants: [{ id: "ja", title: "GS2 JA", path: "/storage/games/gs2.gba" }],
      },
      {
        kind: "series", id: "zelda-minish-cap", title: "Zelda",
        variants: [{ id: "ja", title: "Zelda JA", path: "/storage/games/zelda.gba" }],
      },
    ] }] } };

    const store: Record<string, string> = {
      "series.recents.lastVariant": "series:golden-sun-the-lost-age,series:zelda-minish-cap",
    };

    const host = {
      __launcher: (cmd: string) => {
        if (cmd === "ROMS") return JSON.stringify(library);
        if (cmd === "APPS\tlist") return "";
        if (cmd.startsWith("SETTING\t")) {
          const parts = cmd.split("\t");
          if (parts.length === 2) return store[parts[1]] || "";
          if (parts.length === 3) {
            store[parts[1]] = parts[2];
            return parts[2];
          }
        }
        return "";
      },
    };

    // Step 1: Golden Sun was played most recently, Zelda was played before it
    let apps = getAppsForScreen(0, host);
    expect(apps[0]?.id).toBe("series:golden-sun-the-lost-age");
    expect(apps[1]?.id).toBe("series:zelda-minish-cap");
    expect(apps[2]?.id).toBe("files");
    expect(apps[3]?.id).toBe("saves");

    // Step 2: User opens File Manager ("files")
    recordRecentApp("files", host);
    apps = getAppsForScreen(0, host);
    expect(apps[0]?.id).toBe("files");
    expect(apps[1]?.id).toBe("series:golden-sun-the-lost-age");
    expect(apps[2]?.id).toBe("series:zelda-minish-cap");
    expect(apps[3]?.id).toBe("saves");

    // Step 3: User opens Save Manager ("saves")
    recordRecentApp("saves", host);
    apps = getAppsForScreen(0, host);
    expect(apps[0]?.id).toBe("saves");
    expect(apps[1]?.id).toBe("files");
    expect(apps[2]?.id).toBe("series:golden-sun-the-lost-age");
    expect(apps[3]?.id).toBe("series:zelda-minish-cap");

    // Step 4: User launches Zelda again
    recordRecentApp("series:zelda-minish-cap", host);
    apps = getAppsForScreen(0, host);
    expect(apps[0]?.id).toBe("series:zelda-minish-cap");
    expect(apps[1]?.id).toBe("saves");
    expect(apps[2]?.id).toBe("files");
    expect(apps[3]?.id).toBe("series:golden-sun-the-lost-age");
  });
});
