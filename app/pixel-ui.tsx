import { Index } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";

// Retro pixel primitives for the 360x240 logical canvas (shown at 2x, nearest).
// Everything is built from axis-aligned rectangles so no edge pixel is ever
// anti-aliased: a rounded rect would rasterise with grey corner pixels that the
// 2x presentation turns into smudges.

/**
 * Notched frame: border + fill with the classic 1px-cut corners. Drop it as the
 * first child of a box that has `relative` or any positioned layout and no
 * background/border of its own; the box's content then draws above it.
 */
export function PxEdge(props: { fill: string; edge: string; bw?: number }) {
  const bw = () => props.bw ?? 2;
  return (
    <>
      <View class="absolute left-0 right-0 top-[1px] bottom-[1px]" style={{ bgColor: props.edge }} />
      <View class="absolute left-[1px] right-[1px] top-0 bottom-0" style={{ bgColor: props.edge }} />
      <View
        class="absolute"
        style={{ insetL: bw(), insetT: bw() + 1, insetR: bw(), insetB: bw() + 1, bgColor: props.fill }}
      />
      <View
        class="absolute"
        style={{ insetL: bw() + 1, insetT: bw(), insetR: bw() + 1, insetB: bw(), bgColor: props.fill }}
      />
    </>
  );
}

/**
 * Segmented meter, like a handheld battery gauge: `segs` blocks with a 1px gap.
 * `width` is the full logical width; `value` is 0..100.
 */
export function SegBar(props: {
  value: number;
  width: number;
  height?: number;
  segs?: number;
  fill: string;
  empty?: string;
}) {
  const segs = () => props.segs ?? Math.max(4, Math.floor(props.width / 5));
  const segW = () => Math.max(1, Math.floor((props.width - (segs() - 1)) / segs()));
  const lit = () => Math.round((Math.max(0, Math.min(100, props.value)) / 100) * segs());
  const indices = () => Array.from({ length: segs() }, (_, i) => i);
  return (
    <View class="flex-row items-center" style={{ width: props.width, height: props.height ?? 5 }}>
      <Index each={indices()}>
        {(i) => (
          <View
            style={{
              width: segW(),
              height: props.height ?? 5,
              marginR: i() === segs() - 1 ? 0 : 1,
              bgColor: i() < lit() ? props.fill : (props.empty ?? "#36343b"),
            }}
          />
        )}
      </Index>
    </View>
  );
}
