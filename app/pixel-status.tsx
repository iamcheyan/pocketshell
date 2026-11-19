import { View } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";

// Nine-pixel glyphs on the GBA grid: one logical pixel is exactly 3 panel px.
const MASKS = {
  dpad: ["000111000","000111000","000111000","111111111","111111111","111111111","000111000","000111000","000111000"],
  game: ["001111100","011111110","110101011","111111111","110111011","110101011","101111101","100000001","000000000"],
  music: ["000111110","000100010","000100010","000100010","000100010","011100110","111001110","110001100","000000000"],
  apps: ["111111111","100000001","101000101","100100101","100010101","100100101","101000101","100000001","111111111"],
  star: ["000010000","000111000","000101000","111111111","011000110","001101100","001101100","010000010","010000010"],
  settings: ["000111000","010111010","011111110","111010111","110000011","111010111","011111110","010111010","000111000"],
  info: ["001111100","010000010","100010001","100000001","100110001","100010001","100010001","010000010","001111100"],
  wifi: ["001111100","010000010","100000001","000111000","001000100","000010000","000000000","000010000","000000000"],
  bluetooth: ["000010000","000011000","010010100","001011000","000110000","001011000","010010100","000011000","000010000"],
  ssh: ["111111110","100000010","101000010","100100010","100010010","100100010","101001010","100000010","111111110"],
  usb: ["000010000","000111000","000010000","010010110","011010100","001110100","000111000","000010000","000111000"],
  files: ["011100000","100011110","100000010","111111110","100000010","100000010","100000010","100000010","111111110"],
  lock: ["001111000","010001000","010001000","111111110","100000010","100110010","100110010","100000010","111111110"],
  power: ["000010000","000010000","010010010","100000001","100000001","100000001","010000010","001000100","000111000"],
  reboot: ["001111000","010000100","100000010","100000110","100000000","100000010","010000100","001111000","000000000"],
  bolt: ["00000","00010","00110","01100","11111","00110","01100","01000","00000"],
};
export function PixelStatus(props: { kind: keyof typeof MASKS; color: string; scale?: number }) {
  const scale = () => props.scale || 1;
  const runs = () => MASKS[props.kind].flatMap((row, y) => {
    const result: {x: number; y: number; width: number}[] = [];
    for (let x = 0; x < row.length;) {
      if (row[x] !== "1") { x++; continue; }
      const start = x; while (row[x] === "1") x++;
      result.push({x: start, y, width: x - start});
    }
    return result;
  });
  return (
    <View
      class="relative"
      style={{
        width: (props.kind === "bolt" ? 5 : 9) * scale(),
        height: 9 * scale(),
      }}
    >
      <Index each={runs()}>
        {(run) => (
          <View
            class="absolute"
            style={{
              insetL: run().x * scale(),
              insetT: run().y * scale(),
              width: run().width * scale(),
              height: scale(),
              bgColor: props.color,
            }}
          />
        )}
      </Index>
    </View>
  );
}

export function PixelBattery(props: {
  level: number;
  charging?: boolean;
  color?: string;
  outline?: string;
  scale?: number;
}) {
  const scale = () => props.scale || 1;
  const known = () => props.level >= 0 && props.level <= 100;
  const isLow = () => known() && props.level <= 20;

  // 5 classic cells proportional to battery level:
  // 81-100%: 5 cells
  // 61-80%:  4 cells
  // 41-60%:  3 cells
  // 21-40%:  2 cells
  // 1-20%:   1 cell
  // <=0%:    0 cells
  const activeCells = () => {
    if (!known() || props.level <= 0) return 0;
    if (props.level <= 20) return 1;
    if (props.level <= 40) return 2;
    if (props.level <= 60) return 3;
    if (props.level <= 80) return 4;
    return 5;
  };

  const outlineColor = () =>
    props.outline || (isLow() ? "#ffb4ab" : props.charging ? "#a8e6cf" : "#cac4d0");
  const cellColor = () =>
    props.color || (isLow() ? "#ff5555" : props.charging ? "#a8e6cf" : "#e6e0e9");
  const ghostColor = () => "#2b2735";

  return (
    <View
      class="relative"
      style={{
        width: 19 * scale(),
        height: 9 * scale(),
      }}
    >
      {/* Outer Shell Top (x: 0..17, width 18) */}
      <View
        class="absolute"
        style={{
          insetL: 0,
          insetT: 0,
          width: 18 * scale(),
          height: scale(),
          bgColor: outlineColor(),
        }}
      />
      {/* Outer Shell Bottom (x: 0..17, width 18) */}
      <View
        class="absolute"
        style={{
          insetL: 0,
          insetT: 8 * scale(),
          width: 18 * scale(),
          height: scale(),
          bgColor: outlineColor(),
        }}
      />
      {/* Outer Shell Left Border (y: 0..8, height 9) */}
      <View
        class="absolute"
        style={{
          insetL: 0,
          insetT: 0,
          width: scale(),
          height: 9 * scale(),
          bgColor: outlineColor(),
        }}
      />
      {/* Outer Shell Right Border (y: 0..8, height 9) */}
      <View
        class="absolute"
        style={{
          insetL: 17 * scale(),
          insetT: 0,
          width: scale(),
          height: 9 * scale(),
          bgColor: outlineColor(),
        }}
      />
      {/* Positive Terminal Nipple on right (x: 18, y: 3..5, height 3) */}
      <View
        class="absolute"
        style={{
          insetL: 18 * scale(),
          insetT: 3 * scale(),
          width: scale(),
          height: 3 * scale(),
          bgColor: outlineColor(),
        }}
      />

      {/* 5 Classic Cells (x = 2, 5, 8, 11, 14; width = 2, height = 5, y: 2..6) */}
      <Index each={[0, 1, 2, 3, 4]}>
        {(idx) => {
          const filled = () => idx() < activeCells();
          return (
            <View
              class="absolute"
              style={{
                insetL: (2 + idx() * 3) * scale(),
                insetT: 2 * scale(),
                width: 2 * scale(),
                height: 5 * scale(),
                bgColor: filled() ? cellColor() : ghostColor(),
              }}
            />
          );
        }}
      </Index>
    </View>
  );
}
