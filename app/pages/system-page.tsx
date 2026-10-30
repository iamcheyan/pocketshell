import { createEffect, Index } from "solid-js";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { animate } from "@pocketjs/framework/animation";
import { ramUsage, type NetworkSnapshot, type SystemSnapshot } from "../system-status";

export interface SystemPageProps {
  pageIndex: number;
  network: NetworkSnapshot;
  snapshot: SystemSnapshot | null;
}

const INK = "#06111B";
const CYAN = "#3ECFFF";
const GREEN = "#00FF99";
const AMBER = "#FFB400";
const PALE = "#D8E8FF";
const MUTED = "#7893A8";
const LINE = "#1B3345";
const text = (value: string | null | undefined) => value || "--";
const percentText = (value: number | null | undefined) => (value === null || value === undefined ? "--%" : `${value}%`);
const compactOs = (snapshot: SystemSnapshot | null) => text(snapshot?.os).replace(/\s*Linux\s*/i, " ").trim();
const compactKernel = (snapshot: SystemSnapshot | null) => text(snapshot?.kernel).replace(/^Linux\s+/i, "").replace(/\s*\(([^)]+)\)\s*$/, " $1");

function Bar(props: { value: number | null | undefined; color: string }) {
  const filledCount = () => Math.round((Math.max(0, Math.min(100, props.value ?? 0)) / 100) * 24);
  const blocks = () => Array.from({ length: 24 }, (_, index) => index < filledCount());
  return (
    <View class="w-[336px] h-[6px] flex-row gap-[2px]">
      <Index each={blocks()}>
        {(filled) => <View class="flex-1 h-[6px]" style={{ bgColor: filled() ? props.color : LINE }} />}
      </Index>
    </View>
  );
}

// One row shape for every page: label left, value right, optional bar underneath
// at full width. The old versions mixed text-base/text-sm/text-lg per page,
// which is what made this panel read as disorganised.
function Metric(props: { label: string; value: string; color: string; percent?: number | null }) {
  return (
    <View class="w-[336px] flex-col gap-[3px]">
      <View class="w-[336px] flex-row items-center justify-between">
        <Text class="text-xs font-bold tracking-wide" style={{ textColor: props.color }}>{props.label}</Text>
        <Text class="text-xs font-bold font-mono" style={{ textColor: PALE }}>{props.value}</Text>
      </View>
      {props.percent === undefined ? null : <Bar value={props.percent} color={props.color} />}
    </View>
  );
}

export function SystemPage(props: SystemPageProps) {
  const snapshot = () => props.snapshot;
  const ram = () => ramUsage(props.snapshot);
  const cpu = () => snapshot()?.cpuUsagePercent ?? null;
  const storage = () => snapshot()?.storagePercent ?? null;
  let pageNode: NodeMirror | undefined;
  createEffect(() => {
    props.pageIndex;
    props.snapshot;
    props.network;
    if (!pageNode) return;
    try {
      animate(pageNode, "opacity", 0.7, { dur: 0 });
      animate(pageNode, "opacity", 1, { dur: 120, easing: "out" });
    } catch {
      // Current page remains visible if animation is unavailable.
    }
  });

  return (
    <View class="w-[360px] h-[198px] flex-col px-3 py-2" style={{ bgColor: INK }}>
      <View class="w-[336px] flex-1 flex-col justify-between" ref={(node: NodeMirror) => { pageNode = node; }}>

        {props.pageIndex === 0 ? (
          <View class="flex-col gap-[6px]">
            <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
              {text(snapshot()?.model)} · {text(snapshot()?.hardware)} · {text(snapshot()?.ramVariant)}
            </Text>
            <Metric label="CPU" value={percentText(cpu())} color={CYAN} percent={cpu()} />
            <Metric
              label="MEMORY"
              value={ram() ? `${ram()!.usedMb} / ${ram()!.totalMb} MB` : "-- / -- MB"}
              color={GREEN}
              percent={ram()?.percent}
            />
            <Metric
              label="STORAGE"
              value={snapshot()?.storageUsed && snapshot()?.storageTotal ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}` : "-- / --"}
              color={AMBER}
              percent={storage()}
            />
          </View>
        ) : null}

        {props.pageIndex === 1 ? (
          <View class="flex-col gap-[6px]">
            <Metric label="CPU UTILIZATION" value={percentText(cpu())} color={CYAN} percent={cpu()} />
            <Metric label="FREQUENCY" value={text(snapshot()?.frequency)} color={PALE} />
            <Metric label="TEMPERATURE" value={text(snapshot()?.temperature)} color={AMBER} />
          </View>
        ) : null}

        {props.pageIndex === 2 ? (
          <View class="flex-col gap-[6px]">
            <Metric
              label="MEMORY"
              value={ram() ? `${ram()!.usedMb} / ${ram()!.totalMb} MB` : "-- / -- MB"}
              color={GREEN}
              percent={ram()?.percent}
            />
            <Metric label="USED" value={percentText(ram()?.percent)} color={PALE} />
            <Metric label="FREE" value={ram() ? `${ram()!.availableMb} MB` : "-- MB"} color={MUTED} />
            <Metric
              label="RAW"
              value={`${text(snapshot()?.ramAvailableKb?.toString())} / ${text(snapshot()?.ramTotalKb?.toString())} KB`}
              color={MUTED}
            />
          </View>
        ) : null}

        {props.pageIndex === 3 ? (
          <View class="flex-col gap-[6px]">
            <Metric
              label="STORAGE · /STORAGE"
              value={snapshot()?.storageUsed && snapshot()?.storageTotal ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}` : "-- / --"}
              color={AMBER}
              percent={storage()}
            />
            <Metric label="USED" value={percentText(storage())} color={PALE} />
          </View>
        ) : null}

        {props.pageIndex === 4 ? (
          <View class="flex-col gap-[6px]">
            <Metric label="ADDRESS" value={text(props.network.address)} color={CYAN} />
            <Metric label="INTERFACE" value={text(props.network.interface).toUpperCase()} color={PALE} />
            <Metric
              label="WIFI"
              value={props.network.connected ? "CONNECTED" : "DISCONNECTED"}
              color={props.network.connected ? GREEN : AMBER}
            />
            <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
              OS {compactOs(snapshot())} · KERNEL {compactKernel(snapshot())}
            </Text>
            <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
              DISPLAY {text(snapshot()?.display)} · {text(snapshot()?.runtime)}
            </Text>
          </View>
        ) : null}

      </View>
    </View>
  );
}
