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
  bolt: ["00010","00110","01100","11111","00110","01100","01000"],
};
export function PixelStatus(props: { kind: keyof typeof MASKS; color: string; scale?: number }) {
  const runs = () => MASKS[props.kind].flatMap((row, y) => {
    const result: {x: number; y: number; width: number}[] = [];
    for (let x = 0; x < row.length;) {
      if (row[x] !== "1") { x++; continue; }
      const start = x; while (row[x] === "1") x++;
      result.push({x: start, y, width: x - start});
    }
    return result;
  });
  return <View class="relative" style={{ width: (props.kind === "bolt" ? 5 : 9) * (props.scale || 1), height: 9 * (props.scale || 1) }}>
    <Index each={runs()}>{(run) => <View class="absolute" style={{ insetL: run().x * (props.scale || 1), insetT: run().y * (props.scale || 1), width: run().width * (props.scale || 1), height: props.scale || 1, bgColor: props.color }} />}</Index>
  </View>;
}
export function PixelBattery(props: { level: number; charging: boolean; color: string; outline: string }) {
  const cells = () => props.level < 0 ? 0 : Math.ceil(Math.max(0, Math.min(100, props.level)) / 25);
  return <View class="flex-row items-center">
    <View class="relative w-[12px] h-[7px]">
      <View class="absolute left-0 top-0 w-[11px] h-[1px]" style={{ bgColor: props.outline }} />
      <View class="absolute left-0 top-[6px] w-[11px] h-[1px]" style={{ bgColor: props.outline }} />
      <View class="absolute left-0 top-0 w-[1px] h-[7px]" style={{ bgColor: props.outline }} />
      <View class="absolute left-[10px] top-0 w-[1px] h-[7px]" style={{ bgColor: props.outline }} />
      <View class="absolute left-[11px] top-[2px] w-[1px] h-[3px]" style={{ bgColor: props.outline }} />
      {props.charging ? <View class="absolute left-[3px] top-0"><PixelStatus kind="bolt" color={props.color} /></View> : <Index each={[0,1,2,3]}>{(cell) => <View class="absolute" style={{ insetL: 2 + cell() * 2, insetT: 2, width: 1, height: 3, bgColor: cell() < cells() ? props.color : "#38334f" }} />}</Index>}
    </View>
  </View>;
}
