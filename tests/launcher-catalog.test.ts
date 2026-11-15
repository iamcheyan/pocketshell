import { describe, expect, test } from "bun:test";
import { getAppsForScreen } from "../app/launcher-catalog";

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
});
