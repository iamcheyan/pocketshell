import { Image, View, Text, type NodeMirror } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import { appShortName, appTag, type LauncherApp } from "./launcher-catalog";
import type { Translator } from "./i18n";
import { TouchTarget } from "./touch-target";
import { createGesture } from "@pocketjs/framework/gesture";

export interface CardCarouselProps {
  apps: LauncherApp[];
  t: Translator;
  selectedIndex: number;
  onMountCarousel?: (node: NodeMirror) => void;
  onMountCard?: (index: number, node: NodeMirror) => void;
  onCardPress?: (index: number) => void;
  onMove?: (delta: -1 | 1) => void;
}

export function CardCarousel(props: CardCarouselProps) {
  let viewport: NodeMirror | undefined;
  createGesture({ region: { node: () => viewport }, axis: "x", onPanEnd: (contact) => {
    if (contact.dx <= -24) props.onMove?.(1);
    else if (contact.dx >= 24) props.onMove?.(-1);
  } });
  return (
    <View ref={(node: NodeMirror) => { viewport = node; }} class="w-[360px] h-[116px] overflow-hidden relative">
      <View
        ref={(node: NodeMirror) => props.onMountCarousel?.(node)}
        class="flex-row items-center absolute left-0 top-0 h-[116px] px-4"
      >
        <Index each={props.apps}>
          {(app, index) => {
            const isSelected = () => props.selectedIndex === index;
            return (
              <TouchTarget
                onPress={() => props.onCardPress?.(index)}
                onMount={(node) => props.onMountCard?.(index, node)}
                class={
                  isSelected()
                    ? "w-[104px] h-[108px] rounded-lg mr-2 p-1 flex-col items-center justify-between bg-[#1e3042] border-2 border-[#38bdf8]"
                    : "w-[104px] h-[108px] rounded-lg mr-2 p-1 flex-col items-center justify-between bg-[#14202c] border border-[#273a4b] opacity-80"
                }
              >
                {/* Icon box */}
                <View
                  class={
                    isSelected()
                      ? "w-[44px] h-[44px] rounded-md items-center justify-center mt-1 bg-[#0b1622]"
                      : "w-[44px] h-[44px] rounded-md items-center justify-center mt-1 bg-[#0f1923]"
                  }
                >
                  {/* PocketFetch carries the kernel's Tux, not a font glyph. */}
                  {app().id === "pocketfetch" ? (
                    <Image class="w-[36px] h-[36px]" src="tux.png" />
                  ) : (
                    <Text class={isSelected() ? "text-2xl text-[#38bdf8]" : "text-2xl text-slate-400"}>
                      {app().icon}
                    </Text>
                  )}
                </View>

                {/* App Name */}
                <View class="w-[96px] items-center justify-center">
                  <Text class="text-xs font-bold text-center text-slate-100">
                    {appShortName(props.t, app())}
                  </Text>
                </View>

                {/* Kind / Tag badge */}
                <View
                  class={
                    app().kind === "native"
                      ? "px-1 rounded-sm mb-1 bg-emerald-950"
                      : "px-1 rounded-sm mb-1 bg-sky-950"
                  }
                >
                  <Text
                    class={
                      app().kind === "native"
                        ? "text-xs font-bold text-emerald-400"
                        : "text-xs font-bold text-sky-400"
                    }
                  >
                    {appTag(props.t, app())}
                  </Text>
                </View>
              </TouchTarget>
            );
          }}
        </Index>
      </View>
    </View>
  );
}
