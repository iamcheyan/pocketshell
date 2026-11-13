import { createEffect, createSignal } from "solid-js";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { jump } from "@pocketjs/framework/animation";
import { getOps } from "@pocketjs/framework/host";
import { onFrame } from "@pocketjs/framework/lifecycle";

export interface RollingTextProps {
  value: string;
  color: string;
  /** Column width in logical px; text wider than this scrolls. */
  width: number;
  /** Font slot used to measure — 19 is the 10 px label face. */
  slot?: number;
  /** Show the value only, no scrolling (used for numbers that must not move). */
  still?: boolean;
}

const TICK_MS = 1000 / 60;
const HOLD_FRAMES = 90;
const PX_PER_MS = 30 / 1000;

// A single line of text that never gets cut off: if it is wider than the column
// it ping-pongs between its ends with a pause at each end. Short values register
// no frame callback and cost nothing. translateX goes through jump() because a
// style object is frozen at mount.
export function RollingText(props: RollingTextProps) {
  const [overflowing, setOverflowing] = createSignal(false);
  let node: NodeMirror | undefined;
  let travel = 0;
  let position = 0;
  let direction = -1;
  let hold = 0;

  const move = (x: number) => {
    if (!node) return;
    try {
      jump(node, "translateX", x);
    } catch {
      // host without animation ops: the text stays clipped at its head
    }
  };

  createEffect(() => {
    const value = props.value;
    const still = props.still === true;
    let width = 0;
    try {
      width = getOps().measureText(value, props.slot ?? 19);
    } catch {
      width = 0;
    }
    travel = still ? 0 : Math.max(0, width - props.width);
    setOverflowing(travel > 0);
    position = 0;
    direction = -1;
    hold = HOLD_FRAMES;
    move(0);
  });

  onFrame(() => {
    if (!overflowing()) return;
    if (hold > 0) {
      hold--;
      return;
    }
    position += direction * (PX_PER_MS * TICK_MS);
    if (position <= -travel) {
      position = -travel;
      direction = 1;
      hold = HOLD_FRAMES;
    } else if (position >= 0) {
      position = 0;
      direction = -1;
      hold = HOLD_FRAMES;
    }
    move(Math.round(position));
  });

  return (
    <View class="h-[12px] overflow-hidden" style={{ width: props.width, overflow: 1 }}>
      <Text
        ref={(mirror: NodeMirror) => {
          node = mirror;
        }}
        class="text-2xs"
        style={{ textColor: props.color }}
      >
        {props.value}
      </Text>
    </View>
  );
}
