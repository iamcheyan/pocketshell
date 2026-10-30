import { View, Text, type NodeMirror } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import type { LauncherApp } from "./launcher-catalog";

export interface CardCarouselProps {
  apps: LauncherApp[];
  selectedIndex: number;
  onMountCarousel?: (node: NodeMirror) => void;
  onMountCard?: (index: number, node: NodeMirror) => void;
}

export function CardCarousel(props: CardCarouselProps) {
  return (
    <View class="w-[360px] h-[116px] overflow-hidden relative">
      <View
        ref={(node: NodeMirror) => props.onMountCarousel?.(node)}
        class="flex-row items-center absolute left-0 top-0 h-[116px] px-4"
      >
        <Index each={props.apps}>
          {(app, index) => {
            const isSelected = () => props.selectedIndex === index;
            return (
              <View
                ref={(node: NodeMirror) => props.onMountCard?.(index, node)}
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
                  <Text class={isSelected() ? "text-2xl text-[#38bdf8]" : "text-2xl text-slate-400"}>
                    {app().icon}
                  </Text>
                </View>

                {/* App Name */}
                <View class="w-[96px] items-center justify-center">
                  <Text class="text-xs font-bold text-center text-slate-100">
                    {app().shortName || app().name}
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
                    {app().tag}
                  </Text>
                </View>
              </View>
            );
          }}
        </Index>
      </View>
    </View>
  );
}
