import { createEffect, Index } from "solid-js";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { animate } from "@pocketjs/framework/animation";
import { displaySize, ramUsage, type NetworkSnapshot, type SystemSnapshot } from "../system-status";
import { translator } from "../i18n";

import {
  THEME_PALETTES,
  FONT_SCALE_CONFIGS,
  type ThemeColorKey,
  type FontSizeKey,
} from "../theme-model";

export interface SystemStatus {
  ssh: boolean;
  adb: boolean;
  mtp: boolean;
  battery: number;
  brightness: number | null;
  volume: number | null;
  language: string;
  themeColor?: ThemeColorKey;
  fontSize?: FontSizeKey;
}

export interface SystemPageProps {
  pageIndex: number;
  network: NetworkSnapshot;
  snapshot: SystemSnapshot | null;
  status: SystemStatus;
}

export const SYSTEM_PAGE_KEYS = ["overview", "hardware", "network"] as const;
export const SYSTEM_PAGES = SYSTEM_PAGE_KEYS;

const text = (value: string | null | undefined) => value || "--";
const percentText = (value: number | null | undefined) =>
  value === null || value === undefined ? "--%" : `${Math.round(value)}%`;
const compactOs = (snapshot: SystemSnapshot | null) =>
  text(snapshot?.os).replace(/\s*Linux\s*/i, " ").trim();
const compactKernel = (snapshot: SystemSnapshot | null) =>
  text(snapshot?.kernel).replace(/^Linux\s+/i, "").replace(/\s*\(([^)]+)\)\s*$/, " $1");

function SegmentedMeter(props: { percent: number | null | undefined; color: string }) {
  const pct = () => Math.max(0, Math.min(100, props.percent ?? 0));
  const filledCount = () => Math.round((pct() / 100) * 8);
  const segments = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <View class="w-[180px] flex-row items-center gap-[4px]">
      <Index each={segments}>
        {(i) => {
          const filled = () => i() < filledCount();
          return (
            <View
              class="w-[18px] h-[6px] rounded-[3px]"
              style={{
                bgColor: filled() ? props.color : "#36343b",
              }}
            />
          );
        }}
      </Index>
    </View>
  );
}

function MetricCard(props: {
  title: string;
  percent: number | null | undefined;
  valueStr: string;
  subtext: string;
  color: string;
}) {
  return (
    <View class="w-[210px] h-[126px] p-[14px] rounded-[20px] bg-[#211f26] flex-col justify-between">
      {/* Top: Title & Dot */}
      <View class="flex-row items-center justify-between">
        <Text class="text-sm font-bold text-[#cac4d0] tracking-wide">{props.title}</Text>
        <View class="w-[8px] h-[8px] rounded-[999px]" style={{ bgColor: props.color }} />
      </View>

      {/* Middle: Value & Subtext */}
      <View class="flex-col">
        <Text class="text-2xl font-bold" style={{ textColor: props.color }}>
          {props.valueStr}
        </Text>
        <Text class="text-xs text-[#938f99]">{props.subtext}</Text>
      </View>

      {/* Bottom: 8-segment Pill Bar */}
      <SegmentedMeter percent={props.percent} color={props.color} />
    </View>
  );
}

function InfoRow(props: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View class="w-[660px] h-[40px] px-[18px] rounded-[14px] bg-[#211f26] flex-row items-center justify-between mb-[5px]">
      <Text class="text-base text-[#cac4d0]">{props.label}</Text>
      <Text
        class="text-base font-bold"
        style={{ textColor: props.muted ? "#938f99" : props.color ?? "#e6e0e9" }}
      >
        {props.value}
      </Text>
    </View>
  );
}

export function SystemPage(props: SystemPageProps) {
  const snapshot = () => props.snapshot;
  const ram = () => ramUsage(props.snapshot);
  const cpu = () => snapshot()?.cpuUsagePercent ?? null;
  const storage = () => snapshot()?.storagePercent ?? null;
  const t = () => translator(props.status.language);

  const memoryLabel = () =>
    text(snapshot()?.ramVariant) === "--"
      ? ram()
        ? `${ram()!.totalMb} MB`
        : "--"
      : text(snapshot()?.ramVariant);

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
      // ignore
    }
  });

  return (
    <View class="w-[720px] h-[348px] px-[30px] py-[6px] bg-transparent flex-col items-center justify-center">
      <View
        class="w-[660px] flex-col"
        ref={(node: NodeMirror) => {
          pageNode = node;
        }}
      >
        {props.pageIndex === 0 ? (
          <View class="w-[660px] flex-col">
            {/* Header Device Summary */}
            <View class="w-[660px] flex-row items-center justify-between px-[4px] mb-[6px]">
              <Text class="text-lg font-bold text-[#e6e0e9]">{text(snapshot()?.model)}</Text>
              <Text class="text-sm font-bold text-[#cac4d0]">{memoryLabel()}</Text>
            </View>

            {/* 3 Metric Cards Side-by-Side (No overflow) */}
            <View class="w-[660px] flex-row justify-between mb-[8px]">
              <MetricCard
                title={t()("system.cpu")}
                percent={cpu()}
                valueStr={percentText(cpu())}
                subtext={snapshot()?.cpu || "Quad-Core ARM"}
                color="#d0bcff"
              />
              <MetricCard
                title={t()("system.memory")}
                percent={ram()?.percent}
                valueStr={percentText(ram()?.percent)}
                subtext={ram() ? `${ram()!.usedMb} / ${ram()!.totalMb} MB` : "-- / -- MB"}
                color="#a8efff"
              />
              <MetricCard
                title={t()("system.storage")}
                percent={storage()}
                valueStr={percentText(storage())}
                subtext={
                  snapshot()?.storageUsed && snapshot()?.storageTotal
                    ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}`
                    : "-- / --"
                }
                color="#ffd8e4"
              />
            </View>

            {/* Service Status Row (SSH, ADB, MTP) */}
            <View class="w-[660px] flex-row justify-between mb-[8px]">
              <View class="w-[210px] h-[44px] px-[16px] rounded-[14px] bg-[#211f26] flex-row items-center justify-between">
                <Text class="text-sm font-bold text-[#cac4d0]">SSH</Text>
                <View
                  class={
                    props.status.ssh
                      ? "px-[10px] py-[2px] rounded-[999px] bg-[#1e3a2f]"
                      : "px-[10px] py-[2px] rounded-[999px] bg-[#36343b]"
                  }
                >
                  <Text
                    class="text-xs font-bold"
                    style={{ textColor: props.status.ssh ? "#a8efff" : "#938f99" }}
                  >
                    {props.status.ssh ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>

              <View class="w-[210px] h-[44px] px-[16px] rounded-[14px] bg-[#211f26] flex-row items-center justify-between">
                <Text class="text-sm font-bold text-[#cac4d0]">ADB</Text>
                <View
                  class={
                    props.status.adb
                      ? "px-[10px] py-[2px] rounded-[999px] bg-[#1e3a2f]"
                      : "px-[10px] py-[2px] rounded-[999px] bg-[#36343b]"
                  }
                >
                  <Text
                    class="text-xs font-bold"
                    style={{ textColor: props.status.adb ? "#a8efff" : "#938f99" }}
                  >
                    {props.status.adb ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>

              <View class="w-[210px] h-[44px] px-[16px] rounded-[14px] bg-[#211f26] flex-row items-center justify-between">
                <Text class="text-sm font-bold text-[#cac4d0]">MTP</Text>
                <View
                  class={
                    props.status.mtp
                      ? "px-[10px] py-[2px] rounded-[999px] bg-[#1e3a2f]"
                      : "px-[10px] py-[2px] rounded-[999px] bg-[#36343b]"
                  }
                >
                  <Text
                    class="text-xs font-bold"
                    style={{ textColor: props.status.mtp ? "#a8efff" : "#938f99" }}
                  >
                    {props.status.mtp ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>
            </View>

            {/* OS & Kernel */}
            <InfoRow label={t()("system.os")} value={compactOs(snapshot())} />
            <InfoRow label={t()("system.kernel")} value={compactKernel(snapshot())} muted />
          </View>
        ) : null}

        {props.pageIndex === 1 ? (
          <View class="w-[660px] flex-col">
            <View class="w-[660px] px-[6px] mb-[6px]">
              <Text class="text-base font-bold text-[#d0bcff]">{t()("system.hardware")}</Text>
            </View>
            <InfoRow label={t()("system.board")} value={text(snapshot()?.hardware)} />
            <InfoRow label={t()("system.cpu")} value={text(snapshot()?.cpu)} />
            <InfoRow label={t()("system.frequency")} value={text(snapshot()?.frequency)} />
            <InfoRow
              label={t()("system.temperature")}
              value={text(snapshot()?.temperature)}
              color="#ffd8e4"
            />
            <InfoRow label={t()("system.memory")} value={memoryLabel()} color="#a8efff" />
            <InfoRow
              label={t()("system.display")}
              value={displaySize(snapshot()?.display) ?? "--"}
            />
            <InfoRow label={t()("system.runtime")} value={text(snapshot()?.runtime)} muted />
          </View>
        ) : null}

        {props.pageIndex === 2 ? (
          <View class="w-[660px] flex-col">
            <View class="w-[660px] px-[6px] mb-[6px]">
              <Text class="text-base font-bold text-[#d0bcff]">{t()("system.link")}</Text>
            </View>
            <InfoRow
              label={t()("system.status")}
              value={props.network.connected ? t()("system.connected") : t()("system.disconnected")}
              color={props.network.connected ? "#a8efff" : "#ffd8e4"}
            />
            <InfoRow
              label={t()("system.interface")}
              value={text(props.network.interface).toUpperCase()}
            />
            <InfoRow label={t()("system.address")} value={text(props.network.address)} />

            <View class="w-[660px] px-[6px] mt-[6px] mb-[6px]">
              <Text class="text-base font-bold text-[#d0bcff]">{t()("system.thisDevice")}</Text>
            </View>
            <InfoRow
              label={t()("system.battery")}
              value={props.status.battery >= 0 ? `${props.status.battery}%` : "--"}
              color={props.status.battery <= 20 ? "#ffb4ab" : "#a8efff"}
            />
            <InfoRow
              label={t()("system.brightness")}
              value={props.status.brightness === null ? "--" : `${props.status.brightness}%`}
            />
            <InfoRow
              label={t()("system.volume")}
              value={props.status.volume === null ? "--" : `${props.status.volume}%`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}