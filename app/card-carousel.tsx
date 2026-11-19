import { Image, View, Text, type NodeMirror } from "@pocketjs/framework/solid/components";
import { Index, createEffect } from "solid-js";
import { getOps } from "@pocketjs/framework/host";
import { libraryTexture } from "./library-images";
import type { LauncherApp } from "./launcher-catalog";
import type { Translator } from "./i18n";
import { TouchTarget } from "./touch-target";
import { createGesture } from "@pocketjs/framework/gesture";
import { THEME_PALETTES, type ThemeColorKey } from "./theme-model";

export interface CardCarouselProps {
  apps: LauncherApp[];
  t: Translator;
  selectedIndex: number;
  themeColor: ThemeColorKey;
  windowCenter: number;
  onMountCarousel?: (node: NodeMirror) => void;
  onMountCard?: (index: number, node: NodeMirror) => void;
  onCardPress?: (index: number) => void;
  onMove?: (delta: -1 | 1) => void;
}

export const CARD_WIDTH = 130;
export const CARD_INACTIVE_WIDTH = 102;
export const CARD_GAP = 12;
export const CAROUSEL_STEP = 114; // 102 + 12
// Symmetrical center in 720px: active slot 2 starts at 228 + 228 = 456px inside row.
// Desired active card start: (720 - 260) / 2 = 230px.
// Row offset = 230 - 456 = -226px.
export const CAROUSEL_OFFSET_5 = -113;
export const CAROUSEL_OFFSET_LESS = (idx: number) => 115 - idx * 142;

export function CardCarousel(props: CardCarouselProps) {
  let viewport: NodeMirror | undefined;
  const theme = () => THEME_PALETTES[props.themeColor] || THEME_PALETTES.purple;
  const indices = () => props.apps.map((_, index) => index);

  createGesture({
    region: { node: () => viewport },
    axis: "x",
    onPanEnd: (contact) => {
      if (contact.dx <= -24) props.onMove?.(1);
      else if (contact.dx >= 24) props.onMove?.(-1);
    },
  });

  return (
    <View ref={(node: NodeMirror) => { viewport = node; }} class="w-[360px] h-[135px] overflow-hidden relative items-center justify-center">
      <View
        ref={(node: NodeMirror) => props.onMountCarousel?.(node)}
        class="flex-row items-center absolute left-0 top-0 h-[135px]"
      >
        <Index each={indices()}>
          {(index) => {
            const isSelected = () => props.selectedIndex === index();
            const app = () => props.apps[index()];
            return (
              <TouchTarget
                onPress={() => props.onCardPress?.(index())}
                onMount={(node) => props.onMountCard?.(index(), node)}
                class={
                  isSelected()
                    ? "w-[130px] h-[130px] mr-[12px] flex-col items-center justify-center overflow-hidden border-2 p-[1px] relative"
                    : "w-[102px] h-[102px] mr-[12px] flex-col items-center justify-center overflow-hidden bg-[#1d1b20] opacity-40 p-[1px] relative"
                }
                style={isSelected()
                  ? { bgColor: theme().container, borderColor: theme().primary }
                  : { bgColor: "#1d1b20", borderColor: "#1d1b20" }}
              >
                {/* Modern Material 3 Square Game Tile (Right-Angled / 直角, No harsh borders) */}
                <View class={isSelected() ? "w-[126px] h-[126px] items-center justify-center overflow-hidden bg-[#141218]" : "w-[100px] h-[100px] items-center justify-center overflow-hidden bg-[#141218]"}>
                  <CoverImage app={app} active={() => true} isSelected={isSelected} />
                </View>

                {/* Favorite Badge if pinned */}
                {app()?.favorite && (
                  <View class="absolute top-[4px] right-[4px] px-[5px] py-[2px] bg-[#7d5260] items-center justify-center">
                    <Text class="text-xs font-bold text-[#ffd8e4]">★</Text>
                  </View>
                )}
              </TouchTarget>
            );
          }}
        </Index>
      </View>
    </View>
  );
}

export function appCoverSrc(app: LauncherApp | undefined): string {
  if (!app) return "cover-game-default.png";
  if (app.id === "terminal") return "cover-terminal.png";
  return "cover-game-default.png";
}

export function appBlurBgSrc(app: LauncherApp | undefined): string {
  if (!app) return "bg-blur-default.png";
  if (app.id === "terminal") return "bg-blur-terminal.png";
  return "bg-blur-default.png";
}

function CoverImage(props: { app: () => LauncherApp; active: () => boolean; isSelected: () => boolean }) {
  let node: NodeMirror | undefined;
  createEffect(() => {
    const path = props.app()?.coverPath;
    if (!props.active() || !path || !node) return;
    const host = (globalThis as typeof globalThis & { ui?: { __launcher?: (command: string) => string } }).ui;
    const handle = libraryTexture(host, path, "cover");
    if (handle !== undefined) getOps().setImage(node.id, handle);
  });

  return (
    <Image
      ref={(value: NodeMirror) => { node = value; }}
      class={props.isSelected() ? "w-[126px] h-[126px]" : "w-[100px] h-[100px]"}
      src={appCoverSrc(props.app())}
    />
  );
}
