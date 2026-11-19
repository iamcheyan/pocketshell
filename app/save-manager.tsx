import { View, Text } from "@pocketjs/framework/solid/components";
import { PxEdge, SegBar } from "./pixel-ui";
import { Index } from "solid-js";
import { THEME_PALETTES, type ThemeColorKey, type FontSizeKey } from "./theme-model";
import {
  formatFileSize,
  formatSaveDate,
  formatSaveProgress,
  type SaveEntry,
} from "./save-manager-model";

export type { SaveEntry };

export interface SaveManagerProps {
  open: boolean;
  onClose: () => void;
  entries: SaveEntry[];
  selectedIndex: number;
  themeColor?: ThemeColorKey;
  fontSize?: FontSizeKey;
  language?: string;
  exportResult?: string | null;
}

export function SaveManager(props: SaveManagerProps) {
  const theme = () => THEME_PALETTES[props.themeColor || "purple"] || THEME_PALETTES.purple;
  const isZh = () => !props.language || props.language.startsWith("zh");
  const isJa = () => Boolean(props.language?.startsWith("ja"));
  const isHuge = () => props.fontSize === "huge";
  const isLarge = () => props.fontSize === "large";

  const PAGE_SIZE = 5;
  const scrollOffset = () => {
    const total = props.entries.length;
    if (total <= PAGE_SIZE) return 0;
    const half = Math.floor(PAGE_SIZE / 2);
    if (props.selectedIndex < half) return 0;
    if (props.selectedIndex >= total - half) return total - PAGE_SIZE;
    return props.selectedIndex - half;
  };

  const visibleEntries = () => {
    const start = scrollOffset();
    return props.entries.slice(start, start + PAGE_SIZE);
  };

  const kindBadge = (kind: SaveEntry["kind"]) => {
    if (kind === "slot") return isZh() ? "快捷槽位" : "SLOT";
    if (kind === "auto_state") return isZh() ? "自动存档" : "AUTO";
    if (kind === "battery") return isZh() ? "卡带记忆" : "SRAM";
    return isZh() ? "即时存档" : "STATE";
  };

  return (
    <View class="absolute left-0 top-0 w-[360px] h-[240px] bg-[#000000f2] flex-col items-center justify-center z-50">
      <View
        class="w-[332px] h-[218px] relative flex-col p-[8px] justify-between"
      >
        <PxEdge fill="#181a20" edge={theme().primary} />
        {/* Header */}
        <View class="flex-col gap-[3px]">
          <View class="flex-row items-center justify-between pb-[1px]">
            <View class="flex-row items-center gap-[5px]">
              <Text class="text-xs font-bold" style={{ textColor: theme().primary }}>
                {"\uf0c7"}
              </Text>
              <Text class={isHuge() ? "text-xs font-bold text-[#ffffff]" : "text-xs font-bold text-[#ffffff]"}>
                {isZh() ? "存档管理与导出" : isJa() ? "セーブデータ管理" : "Save Manager"}
              </Text>
            </View>
            <View class="px-[5px] py-[2px]" style={{ bgColor: theme().container }}>
              <Text class="text-xs font-bold" style={{ textColor: theme().onContainer }}>
                {isZh()
                  ? `共 ${props.entries.length} 个存档 · X: 全部备份`
                  : `${props.entries.length} saves · X: Backup All`}
              </Text>
            </View>
          </View>

          {/* Backup Location Plaque */}
          <View class="flex-row items-center px-[6px] py-[2px] overflow-hidden justify-between" style={{ bgColor: theme().activeSurface }}>
            <Text class="text-xs font-mono font-bold" style={{ textColor: theme().primary }}>
              {isZh() ? "备份目录: /storage/backups/saves/" : "Backup: /storage/backups/saves/"}
            </Text>
            <Text class="text-xs font-bold text-[#938f99]">
              {isZh() ? "即时/SRAM" : "States & SRAM"}
            </Text>
          </View>
        </View>

        {/* Content Area */}
        <View class="w-full flex-1 my-[3px] overflow-hidden justify-center">
          {props.entries.length === 0 ? (
            /* Empty Saves */
            <View class="w-full h-full items-center justify-center flex-col gap-[4px]">
              <Text class="text-xs" style={{ textColor: theme().primary }}>{"\uf115"}</Text>
              <Text class="text-xs font-bold text-[#8c91a0]">
                {isZh() ? "未发现游戏存档文件" : isJa() ? "セーブデータがありません" : "No save files found"}
              </Text>
            </View>
          ) : (
            /* Saves List */
            <View class="w-full h-full flex-col justify-between">
              <Index each={visibleEntries()}>
                {(item, relativeIdx) => {
                  const absoluteIdx = () => scrollOffset() + relativeIdx;
                  const isSelected = () => absoluteIdx() === props.selectedIndex;
                  const progress = () => formatSaveProgress(item().extra);
                  return (
                    <View
                      class="w-full h-[27px] px-[7px] flex-row items-center justify-between border-2"
                      style={
                        isSelected()
                          ? { bgColor: theme().container, borderColor: theme().primary }
                          : { bgColor: theme().activeSurface, borderColor: theme().activeSurface }
                      }
                    >
                      {/* Left: Info */}
                      <View class="flex-col gap-[1px] flex-1 overflow-hidden mr-[5px]">
                        <View class="flex-row items-center gap-[4px]">
                          <Text
                            class={isHuge() ? "text-xs font-bold" : "text-xs font-bold"}
                            style={{ textColor: isSelected() ? "#ffffff" : "#e6e0e9" }}
                          >
                            {item().gameTitle}
                          </Text>
                          <Text
                            class="text-xs font-bold"
                            style={{ textColor: isSelected() ? theme().onContainer : theme().primary }}
                          >
                            {item().label}
                          </Text>
                        </View>
                        {/* Progress or Metadata */}
                        {progress() ? (
                          <Text class="text-xs font-bold" style={{ textColor: isSelected() ? "#ffffff" : "#ffcc00" }}>
                            {progress()}
                          </Text>
                        ) : (
                          <Text class="text-xs text-[#938f99]">
                            {formatFileSize(item().size)} · {formatSaveDate(item().mtime)}
                          </Text>
                        )}
                        <Text class="text-xs font-mono text-[#8c91a0]">
                          {item().path}
                        </Text>
                      </View>

                      {/* Right: Kind Pill Badge */}
                      <View
                        class="px-[4px] py-[2px]"
                        style={{ bgColor: isSelected() ? theme().activeSurface : theme().container }}
                      >
                        <Text
                          class="text-xs font-bold"
                          style={{ textColor: isSelected() ? theme().primary : theme().onContainer }}
                        >
                          {kindBadge(item().kind)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              </Index>
            </View>
          )}
        </View>

        {/* Footer Navigation Bar */}
        <View class="w-full flex-col gap-[4px]">
          <View class="w-full h-[1px]" style={{ bgColor: theme().activeSurface }} />
          <View class="flex-row items-center justify-between pt-[1px]">
            <View class="flex-row items-center gap-[9px]">
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().primary }}>
                  <Text class="text-xs font-bold" style={{ textColor: theme().switchThumb }}>A</Text>
                </View>
                <Text class="text-xs font-bold text-[#e6e0e9]">
                  {isZh() ? "导出选中存档" : "Export"}
                </Text>
              </View>
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().container }}>
                  <Text class="text-xs font-bold" style={{ textColor: theme().onContainer }}>X</Text>
                </View>
                <Text class="text-xs font-bold text-[#e6e0e9]">
                  {isZh() ? "一键全量备份" : "Backup All"}
                </Text>
              </View>
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().activeSurface }}>
                  <Text class="text-xs font-bold text-white">B</Text>
                </View>
                <Text class="text-xs font-bold text-[#cac4d0]">
                  {isZh() ? "退出" : "Exit"}
                </Text>
              </View>
            </View>
            <Text class="text-xs text-[#938f99]">
              {isZh() ? "▲▼ 选择 · ◀ ▶ 翻页" : "▲▼ Select · ◀ ▶ Page"}
            </Text>
          </View>
        </View>
      </View>

      {/* Export Result Toast Popup */}
      {props.exportResult ? (
        <View class="absolute top-[10px] px-[10px] py-[4px] bg-[#181a20] border-2 flex-row items-center gap-[4px]" style={{ borderColor: theme().primary }}>
          <Text class="text-xs font-bold" style={{ textColor: theme().primary }}>✔</Text>
          <Text class="text-xs font-bold text-white">
            {props.exportResult}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
