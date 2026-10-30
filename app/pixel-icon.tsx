import { For } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";

type IconKind = "cpu" | "ram" | "storage" | "network";

const PATTERNS: Record<IconKind, string[]> = {
  cpu: [
    "........",
    ".XX..XX.",
    "XXXXXXXX",
    "X.X..X.X",
    "X.X..X.X",
    "XXXXXXXX",
    ".XX..XX.",
    "........",
  ],
  ram: [
    "........",
    "XXXXXXXX",
    "X.X.X.X.",
    "X.X.X.X.",
    "XXXXXXXX",
    "X.X.X.X.",
    "........",
    "........",
  ],
  storage: [
    "........",
    ".XXXXXX.",
    ".X....X.",
    ".XXXXXX.",
    ".X.X.X..",
    ".XXXXXX.",
    "........",
    "........",
  ],
  network: [
    "..XXXX..",
    ".X....X.",
    "X..XX..X",
    "...XX...",
    "..X..X..",
    "..X..X..",
    "...XX...",
    "........",
  ],
};

export function PixelIcon(props: { kind: IconKind; color: string }) {
  const pixels = () =>
    PATTERNS[props.kind].flatMap((row, y) =>
      [...row].flatMap((cell, x) => (cell === "X" ? [{ x, y }] : [])),
    );
  return (
    <View class="w-[16px] h-[16px] relative">
      <For each={pixels()}>
        {(pixel) => (
          <View
            class="absolute w-[2px] h-[2px]"
            style={{
              translateX: pixel.x * 2,
              translateY: pixel.y * 2,
              bgColor: props.color,
            }}
          />
        )}
      </For>
    </View>
  );
}
