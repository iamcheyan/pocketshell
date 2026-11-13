import { describe, expect, test } from "bun:test";
import { getAppsForScreen } from "../app/launcher-catalog";

describe("game library metadata", () => {
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
