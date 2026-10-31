import { createEffect, Index } from "solid-js";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { animate } from "@pocketjs/framework/animation";
import { displaySize, ramUsage, type NetworkSnapshot, type SystemSnapshot } from "../system-status";
import { translator } from "../i18n";
import { RollingText } from "../rolling-text";

export interface SystemStatus {
  ssh: boolean;
  adb: boolean;
  mtp: boolean;
  battery: number;
  brightness: number | null;
  volume: number | null;
  language: string;
}

export interface SystemPageProps {
  pageIndex: number;
  network: NetworkSnapshot;
  snapshot: SystemSnapshot | null;
  status: SystemStatus;
}

const INK = "#06111B";
const CYAN = "#3ECFFF";
const GREEN = "#00FF99";
const AMBER = "#FFB400";
const PALE = "#D8E8FF";
const MUTED = "#7893A8";
const LINE = "#1B3345";
const CELL = "#0d1b26";

// Three pages, each with a vertical budget that adds up to the 190px body
// (360×198 panel minus the shell's status bar and footer):
//
//   OVERVIEW  14+6+3×22+2×5+8+38+6+19+4+19 = 190
//   DEVICE    12+4+6×19+4+12+4+3×19       = 190
//   NETWORK   12+4+3×19+6+12+4+5×19       = 190
//
// Fixed gaps rather than justify-between: even spacing is the point, and a page
// that loses a row must not stretch the rest to disguise it.
export const SYSTEM_PAGE_KEYS = ["overview", "device", "network"] as const;
export const SYSTEM_PAGES = SYSTEM_PAGE_KEYS;

const text = (value: string | null | undefined) => value || "--";
const percentText = (value: number | null | undefined) => (value === null || value === undefined ? "--%" : `${value}%`);
const compactOs = (snapshot: SystemSnapshot | null) => text(snapshot?.os).replace(/\s*Linux\s*/i, " ").trim();
const compactKernel = (snapshot: SystemSnapshot | null) =>
  text(snapshot?.kernel).replace(/^Linux\s+/i, "").replace(/\s*\(([^)]+)\)\s*$/, " $1");

function Bar(props: { value: number | null | undefined; color: string }) {
  const filledCount = () => Math.round((Math.max(0, Math.min(100, props.value ?? 0)) / 100) * 28);
  const blocks = () => Array.from({ length: 28 }, (_, index) => index < filledCount());
  return (
    <View class="w-[336px] h-[7px] flex-row gap-[2px]">
      <Index each={blocks()}>
        {(filled) => <View class="flex-1 h-[7px]" style={{ bgColor: filled() ? props.color : LINE }} />}
      </Index>
    </View>
  );
}

// Label and value share a 14px line; the bar sits 1px under it. 22px total.
// The label owns the same 132px column as Field, so every page aligns.
function Meter(props: { label: string; value: string; color: string; percent: number | null | undefined }) {
  return (
    <View class="w-[336px] h-[22px] flex-col justify-between">
      <View class="w-[336px] h-[14px] flex-row items-center">
        <View class="h-[14px] flex-row items-center overflow-hidden" style={{ width: LABEL_COL, overflow: 1 }}>
          <Text class="text-xs font-bold tracking-wide" style={{ textColor: props.color }}>
            {props.label}
          </Text>
        </View>
        <RollingText value={props.value} color={PALE} width={VALUE_COL} />
      </View>
      <Bar value={props.percent} color={props.color} />
    </View>
  );
}

// One table line: label left, value right-aligned in a fixed column so long
// values (CPU model, kernel string) scroll instead of colliding with the label.
const VALUE_COL = 196;
const LABEL_COL = 132;
function Field(props: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View class="w-[336px] h-[19px] flex-row items-center justify-between">
      <View class="h-[19px] flex-row items-center overflow-hidden" style={{ width: LABEL_COL, overflow: 1 }}>
        <Text class="text-xs font-bold tracking-wide" style={{ textColor: props.muted ? MUTED : props.color ?? CYAN }}>
          {props.label}
        </Text>
      </View>
      <View class="h-[19px] flex-row items-center" style={{ width: VALUE_COL }}>
        <RollingText value={props.value} color={props.muted ? MUTED : PALE} width={VALUE_COL} />
      </View>
    </View>
  );
}

function Section(props: { label: string }) {
  return (
    <View class="w-[336px] h-[12px] flex-row items-center">
      <Text class="text-xs font-bold tracking-wide" style={{ textColor: MUTED }}>
        {props.label}
      </Text>
    </View>
  );
}

// Three equal cells, 38px tall: a 12px caption over a 12px value with 4px of
// breathing room, so the pair does not touch the cell edges.
function Trio(props: { cells: { label: string; value: string; color: string }[] }) {
  return (
    <View class="w-[336px] h-[38px] flex-row gap-[4px]">
      <Index each={props.cells}>
        {(cell) => (
          <View class="flex-1 h-[38px] px-[5px] py-[4px] flex-col justify-between bg-[#0d1b26] border border-[#1B3345]">
            <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
              {cell().label}
            </Text>
            <Text class="text-xs font-mono" style={{ textColor: cell().color }}>
              {cell().value}
            </Text>
          </View>
        )}
      </Index>
    </View>
  );
}

export function SystemPage(props: SystemPageProps) {
  const snapshot = () => props.snapshot;
  const ram = () => ramUsage(props.snapshot);
  const cpu = () => snapshot()?.cpuUsagePercent ?? null;
  const storage = () => snapshot()?.storagePercent ?? null;
  const t = () => translator(props.status.language);
  const onOff = (value: boolean) => (value ? t()("common.on") : t()("common.off"));
  // `ramVariant` is a device-tree fact (H700 DDR4). Where the bridge has none,
  // show the measured total instead of an empty dash.
  const memoryLabel = () => text(snapshot()?.ramVariant) === "--"
    ? (ram() ? `${ram()!.totalMb} MB` : "--")
    : text(snapshot()?.ramVariant);
  const lowBattery = () => props.status.battery >= 0 && props.status.battery <= 20;
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
    <View class="w-[360px] h-[198px] flex-col px-3 py-1" style={{ bgColor: INK }}>
      <View class="w-[336px] h-[190px] flex-col" ref={(node: NodeMirror) => { pageNode = node; }}>

        {props.pageIndex === 0 ? (
          <>
            <View class="w-[336px] h-[14px] flex-row items-center justify-between">
              <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
                {text(snapshot()?.model)}
              </Text>
              <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
                {memoryLabel()}
              </Text>
            </View>
            <View class="h-[6px]" />
            <Meter label={t()("system.cpu")} value={percentText(cpu())} color={CYAN} percent={cpu()} />
            <View class="h-[5px]" />
            <Meter
              label={t()("system.memory")}
              value={ram() ? `${ram()!.usedMb} / ${ram()!.totalMb} MB` : "-- / -- MB"}
              color={GREEN}
              percent={ram()?.percent}
            />
            <View class="h-[5px]" />
            <Meter
              label={t()("system.storage")}
              value={snapshot()?.storageUsed && snapshot()?.storageTotal ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}` : "-- / --"}
              color={AMBER}
              percent={storage()}
            />
            <View class="h-[8px]" />
            <Trio
              cells={[
                { label: "SSH", value: onOff(props.status.ssh), color: props.status.ssh ? GREEN : MUTED },
                { label: "ADB", value: onOff(props.status.adb), color: props.status.adb ? GREEN : MUTED },
                { label: "MTP", value: onOff(props.status.mtp), color: props.status.mtp ? GREEN : MUTED },
              ]}
            />
            <View class="h-[6px]" />
            <Field label={t()("system.os")} value={compactOs(snapshot())} />
            <View class="h-[4px]" />
            <Field label={t()("system.kernel")} value={compactKernel(snapshot())} muted />
          </>
        ) : null}

        {props.pageIndex === 1 ? (
          <>
            <Section label={t()("system.hardware")} />
            <View class="h-[4px]" />
            <Field label={t()("system.board")} value={text(snapshot()?.hardware)} />
            <Field label={t()("system.cpu")} value={text(snapshot()?.cpu)} />
            <Field label={t()("system.frequency")} value={text(snapshot()?.frequency)} />
            <Field label={t()("system.temperature")} value={text(snapshot()?.temperature)} color={AMBER} />
            <Field label={t()("system.memory")} value={memoryLabel()} color={GREEN} />
            <Field label={t()("system.display")} value={displaySize(snapshot()?.display) ?? "--"} />
            <View class="h-[4px]" />
            <Section label={t()("system.software")} />
            <View class="h-[4px]" />
            <Field label={t()("system.os")} value={compactOs(snapshot())} />
            <Field label={t()("system.kernel")} value={compactKernel(snapshot())} />
            <Field label={t()("system.runtime")} value={text(snapshot()?.runtime)} muted />
          </>
        ) : null}

        {props.pageIndex === 2 ? (
          <>
            <Section label={t()("system.link")} />
            <View class="h-[4px]" />
            <Field
              label={t()("system.status")}
              value={props.network.connected ? t()("system.connected") : t()("system.disconnected")}
              color={props.network.connected ? GREEN : AMBER}
            />
            <Field label={t()("system.interface")} value={text(props.network.interface).toUpperCase()} />
            <Field label={t()("system.address")} value={text(props.network.address)} />
            <View class="h-[6px]" />
            <Section label={t()("system.thisDevice")} />
            <View class="h-[4px]" />
            <Field
              label={t()("system.battery")}
              value={props.status.battery >= 0 ? `${props.status.battery}%` : "--"}
              color={lowBattery() ? AMBER : GREEN}
            />
            <Field
              label={t()("system.brightness")}
              value={props.status.brightness === null ? "--" : `${props.status.brightness}%`}
            />
            <Field
              label={t()("system.volume")}
              value={props.status.volume === null ? "--" : `${props.status.volume}%`}
            />
            <Field label={t()("system.language")} value={props.status.language.toUpperCase()} color={CYAN} />
            <Field label={t()("system.display")} value={displaySize(snapshot()?.display) ?? "--"} />
          </>
        ) : null}

      </View>
    </View>
  );
}
