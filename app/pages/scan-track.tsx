import { createSignal, Index } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";
import { onFrame } from "@pocketjs/framework/lifecycle";

// A travelling highlight on a 12-cell track. The guest has no setTimeout, so the
// animation advances on the 60 Hz frame callback and idles when `active` is
// false; nothing runs while a page is simply showing a list.
const TRACK = 12;
const TAIL = 4;

export function ScanTrack(props: { active: boolean; color?: string }) {
  const [frame, setFrame] = createSignal(0);
  onFrame(() => {
    if (!props.active) return;
    setFrame((value) => (value + 1) % (TRACK * 4));
  });
  const head = () => Math.floor(frame() / 4);
  const lit = (cell: number) => cell <= head() && cell > head() - TAIL;
  return (
    <View class="w-[64px] h-[4px] flex-row gap-[1px]">
      <Index each={Array.from({ length: TRACK }, (_, i) => i)}>
        {(cell) => (
          <View
            class="w-[4px] h-[4px]"
            style={{ bgColor: lit(cell()) ? (props.color ?? "#f2ce76") : "#233240" }}
          />
        )}
      </Index>
    </View>
  );
}
