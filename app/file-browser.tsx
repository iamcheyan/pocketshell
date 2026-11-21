import { View, Text } from "@pocketjs/framework/solid/components";
import { PxEdge, SegBar } from "./pixel-ui";
import { Index } from "solid-js";
import { THEME_PALETTES, type ThemeColorKey, type FontSizeKey } from "./theme-model";
import { formatFileSize, type FileItem } from "./file-browser-model";
import { isWideScreen } from "./card-carousel";

export type { FileItem };
export { formatFileSize };

export interface FileBrowserProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  entries: FileItem[];
  selectedIndex: number;
  previewContent: string | null;
  previewPath: string | null;
  previewScroll: number;
  themeColor?: ThemeColorKey;
  fontSize?: FontSizeKey;
  language?: string;
}

export function FileBrowser(props: FileBrowserProps) {
  const theme = () => THEME_PALETTES[props.themeColor || "purple"] || THEME_PALETTES.purple;
  const isJa = () => Boolean(props.language?.startsWith("ja"));
  const isZh = () => !isJa() && (!props.language || props.language.startsWith("zh"));
  const isHuge = () => props.fontSize === "huge";
  const isLarge = () => props.fontSize === "large";

  const PAGE_SIZE = isWideScreen() ? 8 : 6;
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

  // Preview lines
  const previewLines = () => {
    if (!props.previewContent) return [];
    return props.previewContent.split("\n");
  };

  const PREVIEW_PAGE_SIZE = isWideScreen() ? 15 : 11;
  const visiblePreviewLines = () => {
    const lines = previewLines();
    const start = props.previewScroll;
    return lines.slice(start, start + PREVIEW_PAGE_SIZE);
  };

  return (
    <View class={isWideScreen() ? "absolute inset-0 w-full h-full bg-[#000000f2] flex-col items-center justify-center z-50" : "absolute left-0 top-0 w-[360px] h-[240px] bg-[#000000f2] flex-col items-center justify-center z-50"}>
      <View
        class={isWideScreen() ? "w-full max-w-[560px] h-full max-h-[320px] relative flex-col p-[10px] justify-between" : "w-[332px] h-[218px] relative flex-col p-[8px] justify-between"}
      >
        <PxEdge fill="#181a20" edge={theme().primary} />
        {/* Header */}
        <View class="flex-col gap-[3px]">
          <View class="flex-row items-center justify-between pb-[1px]">
            <View class="flex-row items-center gap-[5px]">
              <Text class="text-xs font-bold" style={{ textColor: theme().primary }}>
                {"\uf07b"}
              </Text>
              <Text class={isHuge() ? "text-xs font-bold text-[#ffffff]" : "text-xs font-bold text-[#ffffff]"}>
                {isZh() ? "文件管理器" : isJa() ? "ファイルマネージャー" : "File Manager"}
              </Text>
            </View>
            <View class="px-[5px] py-[2px]" style={{ bgColor: theme().container }}>
              <Text class="text-xs font-bold" style={{ textColor: theme().onContainer }}>
                {isZh() ? "按 X 切换盘符 (/storage, /, /data)" : isJa() ? "X ドライブ切替" : "X: Switch Drive"}
              </Text>
            </View>
          </View>

          {/* Current Path Breadcrumb */}
          <View class="flex-row items-center px-[6px] py-[3px] overflow-hidden" style={{ bgColor: theme().activeSurface }}>
            <Text class="text-xs font-mono font-bold flex-1" style={{ textColor: theme().primary }}>
              {props.currentPath || "/"}
            </Text>
            <Text class="text-xs font-bold text-[#938f99]">
              {props.entries.length} {isZh() ? "项" : isJa() ? "項目" : "items"}
            </Text>
          </View>
        </View>

        {/* Content Area */}
        <View class="w-full flex-1 my-[4px] overflow-hidden justify-center">
          {props.previewContent !== null ? (
            /* Text File Preview Window */
            <View class="w-full h-full flex-col p-[6px] bg-[#12141a] border justify-between" style={{ borderColor: theme().activeSurface }}>
              <View class="flex-row items-center justify-between pb-[3px]">
                <Text class="text-xs font-mono font-bold" style={{ textColor: theme().primary }}>
                  {props.previewPath}
                </Text>
                <Text class="text-xs font-bold text-[#8c91a0]">
                  {props.previewScroll + 1} / {previewLines().length}
                </Text>
              </View>
              <View class="w-full h-[1px]" style={{ bgColor: theme().activeSurface }} />
              <View class="flex-1 my-[3px] flex-col overflow-hidden">
                <Index each={visiblePreviewLines()}>
                  {(line) => (
                    <Text class="text-xs font-mono text-[#e6e0e9] leading-[22px]">
                      {line()}
                    </Text>
                  )}
                </Index>
              </View>
              <View class="flex-row justify-end">
                <Text class="text-xs font-bold text-[#cac4d0]">
                  {isJa() ? "↑↓ スクロール · B 一覧に戻る" : isZh() ? "↑↓ 滚动 · 按 B 返回文件列表" : "↑↓ Scroll · B to Back"}
                </Text>
              </View>
            </View>
          ) : props.entries.length === 0 ? (
            /* Empty Directory */
            <View class="w-full h-full items-center justify-center flex-col gap-[4px]">
              <Text class="text-xs" style={{ textColor: theme().primary }}>{"\uf115"}</Text>
              <Text class="text-xs font-bold text-[#8c91a0]">
                {isZh() ? "空目录" : isJa() ? "空のディレクトリ" : "Empty directory"}
              </Text>
            </View>
          ) : (
            /* File and Directory List */
            <View class="w-full h-full flex-col justify-between">
              <Index each={visibleEntries()}>
                {(item, relativeIdx) => {
                  const absoluteIdx = () => scrollOffset() + relativeIdx;
                  const isSelected = () => absoluteIdx() === props.selectedIndex;
                  return (
                    <View
                      class="w-full h-[23px] px-[7px] flex-row items-center justify-between border-2"
                      style={
                        isSelected()
                          ? { bgColor: theme().container, borderColor: theme().primary }
                          : { bgColor: theme().activeSurface, borderColor: theme().activeSurface }
                      }
                    >
                      <View class="flex-row items-center gap-[6px] flex-1 overflow-hidden">
                        <Text
                          class={isHuge() ? "text-xs font-bold" : "text-xs font-bold"}
                          style={{
                            textColor: item().isDir
                              ? theme().primary
                              : isSelected()
                              ? theme().onContainer
                              : theme().primary,
                          }}
                        >
                          {item().name === ".." ? "\uf060" : item().isDir ? "\uf07b" : "\uf15b"}
                        </Text>
                        <Text
                          class={
                            isSelected()
                              ? isHuge() ? "text-xs font-bold text-white flex-1" : "text-xs font-bold text-white flex-1"
                              : isHuge() ? "text-xs font-bold text-[#e6e0e9] flex-1" : "text-xs font-bold text-[#e6e0e9] flex-1"
                          }
                        >
                          {item().name}
                        </Text>
                      </View>
                      <Text
                        class={isHuge() ? "text-xs font-bold ml-[6px]" : "text-xs font-bold ml-[6px]"}
                        style={{
                          textColor: isSelected() ? theme().onContainer : "#938f99",
                        }}
                      >
                        {item().name === ".." ? "" : item().isDir ? (isZh() ? "目录" : "DIR") : formatFileSize(item().size)}
                      </Text>
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
            <View class="flex-row items-center gap-[10px]">
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().primary }}>
                  <Text class="text-xs font-bold" style={{ textColor: theme().switchThumb }}>A</Text>
                </View>
                <Text class="text-xs font-bold text-[#e6e0e9]">
                  {isZh() ? "打开/预览" : isJa() ? "開く" : "Open/View"}
                </Text>
              </View>
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().activeSurface }}>
                  <Text class="text-xs font-bold text-white">B</Text>
                </View>
                <Text class="text-xs font-bold text-[#cac4d0]">
                  {props.previewContent !== null
                    ? (isJa() ? "一覧に戻る" : isZh() ? "返回列表" : "Back to list")
                    : props.currentPath !== "/" && props.currentPath !== "/storage"
                    ? (isJa() ? "上へ" : isZh() ? "上一级" : "Up")
                    : (isJa() ? "戻る" : isZh() ? "退出" : "Exit")}
                </Text>
              </View>
              <View class="flex-row items-center gap-[4px]">
                <View class="w-[11px] h-[11px] items-center justify-center" style={{ bgColor: theme().container }}>
                  <Text class="text-xs font-bold" style={{ textColor: theme().onContainer }}>X</Text>
                </View>
                <Text class="text-xs font-bold text-[#cac4d0]">
                  {isJa() ? "切替" : isZh() ? "切盘" : "Drive"}
                </Text>
              </View>
            </View>
            <Text class="text-xs text-[#938f99]">
              {isJa() ? "▲▼ 選択 · ◀ ▶ ページ" : isZh() ? "▲▼ 选择 · ◀ ▶ 翻页" : "▲▼ Select · ◀ ▶ Page"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
