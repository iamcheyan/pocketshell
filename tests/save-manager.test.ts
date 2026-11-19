import { describe, expect, it } from "bun:test";
import { parseSaveEntries, formatSaveDate, formatSaveProgress, formatFileSize } from "../app/save-manager-model";

describe("save manager model", () => {
  it("parses tab-separated saves list output", () => {
    const raw = `塞尔达传说：缩小帽\tslot\t快捷存档 槽位1\t/storage/.config/pocketjs/retrobilingual-slot1.state\t397312\t1731761700\thearts=14;rupees=250;loc=海拉鲁镇
黄金太阳：开启的封印\tauto_state\t自动即时存档\t/storage/pocketshell/states/mGBA/golden-sun.state.auto\t36743\t1731761800\t`;

    const entries = parseSaveEntries(raw);
    expect(entries.length).toBe(2);
    expect(entries[0].gameTitle).toBe("塞尔达传说：缩小帽");
    expect(entries[0].kind).toBe("slot");
    expect(entries[0].label).toBe("快捷存档 槽位1");
    expect(entries[0].path).toBe("/storage/.config/pocketjs/retrobilingual-slot1.state");
    expect(entries[0].size).toBe(397312);
    expect(entries[0].mtime).toBe(1731761700);
    expect(entries[0].extra).toBe("hearts=14;rupees=250;loc=海拉鲁镇");

    expect(entries[1].gameTitle).toBe("黄金太阳：开启的封印");
    expect(entries[1].kind).toBe("auto_state");
  });

  it("formats progress string from extra metadata", () => {
    const progress = formatSaveProgress("hearts=14;rupees=250;loc=海拉鲁镇");
    expect(progress).toBe("地点: 海拉鲁镇 · 14颗心 · 250卢比");

    expect(formatSaveProgress("")).toBe(null);
  });

  it("formats file sizes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1048576 * 2.5)).toBe("2.5 MB");
  });
});
