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

export const CARD_WIDTH = 260;
export const CARD_INACTIVE_WIDTH = 204;
export const CARD_GAP = 24;
export const CAROUSEL_STEP = 228; // 204 + 24
// Symmetrical center in 720px: active slot 2 starts at 228 + 228 = 456px inside row.
// Desired active card start: (720 - 260) / 2 = 230px.
// Row offset = 230 - 456 = -226px.
export const CAROUSEL_OFFSET_5 = -226;
export const CAROUSEL_OFFSET_LESS = (idx: number) => 230 - idx * 284;

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
    <View ref={(node: NodeMirror) => { viewport = node; }} class="w-[720px] h-[270px] overflow-hidden relative items-center justify-center">
      <View
        ref={(node: NodeMirror) => props.onMountCarousel?.(node)}
        class="flex-row items-center absolute left-0 top-0 h-[270px]"
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
                    ? "w-[260px] h-[260px] mr-[24px] flex-col items-center justify-center overflow-hidden border-2 p-[2px] relative"
                    : "w-[204px] h-[204px] mr-[24px] flex-col items-center justify-center overflow-hidden bg-[#1d1b20] opacity-40 p-[2px] relative"
                }
                style={isSelected() ? { bgColor: theme().container, borderColor: theme().primary } : undefined}
              >
                {/* Modern Material 3 Square Game Tile (Right-Angled / 直角, No harsh borders) */}
                <View class={isSelected() ? "w-[252px] h-[252px] items-center justify-center overflow-hidden bg-[#141218]" : "w-[200px] h-[200px] items-center justify-center overflow-hidden bg-[#141218]"}>
                  <CoverImage app={app} active={() => true} isSelected={isSelected} />
                </View>

                {/* Favorite Badge if pinned */}
                {app()?.favorite && (
                  <View class="absolute top-[8px] right-[8px] px-[10px] py-[4px] bg-[#7d5260] items-center justify-center">
                    <Text class="text-sm font-bold text-[#ffd8e4]">★</Text>
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
  if (app.cover) return app.cover;
  if (app.id === "terminal") return "cover-terminal.png";
  if (app.id === "pocketfetch") return "cover-pocketfetch.png";
  if (app.id === "kanade") return "cover-kanade.png";
  if (app.id === "disk") return "cover-disk.png";
  const name = `${app.label || ""} ${app.romPath || ""}`;
  if (/zelda|minish|塞尔达|缩小帽|ふしぎのぼうし/i.test(name)) return "cover-zelda.png";
  if (/apotris/i.test(name)) return "cover-apotris.png";
  if (/celeste/i.test(name)) return "cover-celeste.png";
  if (/dino/i.test(name)) return "cover-dino.png";
  if (/snek|snake/i.test(name)) return "cover-snek.png";
  return "cover-game-default.png";
}

export function appBlurBgSrc(app: LauncherApp | undefined): string {
  if (!app) return "bg-blur-default.png";
  if (app.id === "terminal") return "bg-blur-terminal.png";
  if (app.id === "pocketfetch") return "bg-blur-pocketfetch.png";
  if (app.id === "kanade") return "bg-blur-kanade.png";
  if (app.id === "disk") return "bg-blur-disk.png";
  const name = `${app.label || ""} ${app.romPath || ""}`;
  if (/zelda|minish|塞尔达|缩小帽|ふしぎのぼうし/i.test(name)) return "bg-blur-zelda.png";
  if (/apotris/i.test(name)) return "bg-blur-apotris.png";
  if (/celeste/i.test(name)) return "bg-blur-celeste.png";
  if (/dino/i.test(name)) return "bg-blur-dino.png";
  if (/snek|snake/i.test(name)) return "bg-blur-snek.png";
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
      class={props.isSelected() ? "w-[252px] h-[252px]" : "w-[200px] h-[200px]"}
      src={appCoverSrc(props.app())}
    />
  );
}
