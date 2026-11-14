import { createEffect, Index } from "solid-js";
import { Image, Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
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

function InfoRow(props: { label: string; value: string; color?: string; muted?: boolean; fontSize?: FontSizeKey }) {
  const isHuge = () => props.fontSize === "huge";
  const isLarge = () => props.fontSize === "large";
  return (
    <View class="w-[660px] h-[44px] px-[20px] rounded-[16px] bg-[#211f26] flex-row items-center justify-between mb-[6px] border border-[#2d2938]">
      <Text class={isHuge() ? "text-xl font-bold text-[#cac4d0]" : isLarge() ? "text-lg font-bold text-[#cac4d0]" : "text-base font-bold text-[#cac4d0]"}>{props.label}</Text>
      <Text
        class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
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
  const isHuge = () => props.status.fontSize === "huge";
  const isLarge = () => props.status.fontSize === "large";

  const memoryLabel = () =>
    text(snapshot()?.ramVariant) === "--"
      ? ram()
        ? `${ram()!.totalMb} MB`
        : "--"
      : text(snapshot()?.ramVariant);

  let pageNode: NodeMirror | undefined;

  return (
    <View class="w-[720px] h-[348px] px-[24px] py-[6px] bg-transparent flex-col items-center justify-center">
      <View
        class="w-[672px] h-[336px]"
        ref={(node: NodeMirror) => {
          pageNode = node;
        }}
      >
        {props.pageIndex === 0 ? (
          <View class="w-[672px] h-[336px] flex-row items-center justify-between">
            {/* Left Column: Device Identity Card */}
            <View class="w-[230px] h-[336px] rounded-[24px] bg-[#1e1b24] p-[16px] flex-col items-center justify-between border border-[#2d2938]">
              {/* Device Image (Vector Flat Handheld Illustration) */}
              <View class="w-[124px] h-[124px] items-center justify-center">
                <Image src="cover-handheld.png" style={{ width: 116, height: 116 }} />
              </View>

              {/* Device Names */}
              <View class="flex-col items-center text-center">
                <Text class="text-2xl font-bold text-[#e6e0e9]">RG34XX</Text>
                <Text class={isHuge() ? "text-base font-bold text-[#d0bcff] mt-[2px]" : isLarge() ? "text-sm font-bold text-[#d0bcff] mt-[2px]" : "text-xs font-bold text-[#d0bcff] mt-[2px]"}>{text(snapshot()?.model) || "Allwinner H700"}</Text>
                <Text class={isHuge() ? "text-base text-[#938f99] mt-[2px]" : isLarge() ? "text-sm text-[#938f99] mt-[2px]" : "text-xs text-[#938f99] mt-[2px]"}>
                  {snapshot()?.cpu || "4 Cores @ 1.5 GHz"}
                </Text>
              </View>

              {/* OS Badge & Services */}
              <View class="w-full flex-col gap-[6px]">
                <View class="w-full h-[32px] px-[12px] rounded-[10px] bg-[#292633] flex-row items-center justify-between">
                  <Text class={isHuge() ? "text-base text-[#cac4d0]" : isLarge() ? "text-sm text-[#cac4d0]" : "text-xs text-[#cac4d0]"}>PJOS</Text>
                  <Text class={isHuge() ? "text-base font-bold text-[#a8efff]" : isLarge() ? "text-sm font-bold text-[#a8efff]" : "text-xs font-bold text-[#a8efff]"}>{compactOs(snapshot()) || "1.5.3"}</Text>
                </View>
                <View class="w-full flex-row justify-between gap-[6px]">
                  <View
                    class="flex-1 h-[28px] rounded-[8px] flex-row items-center justify-center gap-[4px]"
                    style={{ bgColor: props.status.ssh ? "#1e3a2f" : "#292633" }}
                  >
                    <View class="w-[6px] h-[6px] rounded-[3px]" style={{ bgColor: props.status.ssh ? "#a8efff" : "#938f99" }} />
                    <Text class={isHuge() ? "text-sm font-bold" : isLarge() ? "text-xs font-bold" : "text-2xs font-bold"} style={{ textColor: props.status.ssh ? "#a8efff" : "#938f99" }}>SSH</Text>
                  </View>
                  <View
                    class="flex-1 h-[28px] rounded-[8px] flex-row items-center justify-center gap-[4px]"
                    style={{ bgColor: props.status.adb ? "#1e3a2f" : "#292633" }}
                  >
                    <View class="w-[6px] h-[6px] rounded-[3px]" style={{ bgColor: props.status.adb ? "#a8efff" : "#938f99" }} />
                    <Text class={isHuge() ? "text-sm font-bold" : isLarge() ? "text-xs font-bold" : "text-2xs font-bold"} style={{ textColor: props.status.adb ? "#a8efff" : "#938f99" }}>ADB</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right Column: 3 Large Metric Cards */}
            <View class="w-[426px] h-[336px] flex-col justify-between">
              {/* CPU Card */}
              <View class="w-[426px] h-[104px] p-[16px] rounded-[20px] bg-[#211f26] flex-col justify-between border border-[#2d2938]">
                <View class="flex-row items-center justify-between">
                  <View class="flex-row items-center gap-[8px]">
                    <View class="w-[10px] h-[10px] rounded-[5px] bg-[#d0bcff]" />
                    <Text class={isHuge() ? "text-xl font-bold text-[#e6e0e9]" : isLarge() ? "text-lg font-bold text-[#e6e0e9]" : "text-base font-bold text-[#e6e0e9]"}>{t()("system.cpu")}</Text>
                  </View>
                  <Text class={isHuge() ? "text-base text-[#938f99] font-bold" : isLarge() ? "text-sm text-[#938f99] font-bold" : "text-xs text-[#938f99] font-bold"}>
                    {snapshot()?.frequency ? `${snapshot()!.frequency} · ` : ""}{snapshot()?.temperature || ""}
                  </Text>
                </View>
                <View class="flex-row items-end justify-between">
                  <Text class="text-2xl font-bold" style={{ textColor: "#d0bcff" }}>{percentText(cpu())}</Text>
                  <View class="flex-col items-end gap-[6px]">
                    <View class="w-[260px] h-[10px] rounded-[5px] bg-[#36343b] overflow-hidden">
                      <View
                        class="h-[10px] rounded-[5px] bg-[#d0bcff]"
                        style={{ width: Math.max(4, Math.round((Math.max(0, Math.min(100, cpu() ?? 0)) / 100) * 260)) }}
                      />
                    </View>
                    <Text class={isHuge() ? "text-base text-[#938f99]" : isLarge() ? "text-sm text-[#938f99]" : "text-xs text-[#938f99]"}>{snapshot()?.cpu || "Quad-Core ARM"}</Text>
                  </View>
                </View>
              </View>

              {/* Memory Card */}
              <View class="w-[426px] h-[104px] p-[16px] rounded-[20px] bg-[#211f26] flex-col justify-between border border-[#2d2938]">
                <View class="flex-row items-center justify-between">
                  <View class="flex-row items-center gap-[8px]">
                    <View class="w-[10px] h-[10px] rounded-[5px] bg-[#a8efff]" />
                    <Text class={isHuge() ? "text-xl font-bold text-[#e6e0e9]" : isLarge() ? "text-lg font-bold text-[#e6e0e9]" : "text-base font-bold text-[#e6e0e9]"}>{t()("system.memory")}</Text>
                  </View>
                  <Text class={isHuge() ? "text-base font-bold text-[#a8efff]" : isLarge() ? "text-sm font-bold text-[#a8efff]" : "text-xs font-bold text-[#a8efff]"}>{memoryLabel()}</Text>
                </View>
                <View class="flex-row items-end justify-between">
                  <Text class="text-2xl font-bold" style={{ textColor: "#a8efff" }}>{percentText(ram()?.percent)}</Text>
                  <View class="flex-col items-end gap-[6px]">
                    <View class="w-[260px] h-[10px] rounded-[5px] bg-[#36343b] overflow-hidden">
                      <View
                        class="h-[10px] rounded-[5px] bg-[#a8efff]"
                        style={{ width: Math.max(4, Math.round((Math.max(0, Math.min(100, ram()?.percent ?? 0)) / 100) * 260)) }}
                      />
                    </View>
                    <Text class={isHuge() ? "text-base text-[#938f99]" : isLarge() ? "text-sm text-[#938f99]" : "text-xs text-[#938f99]"}>{ram() ? `${ram()!.usedMb} / ${ram()!.totalMb} MB` : "-- / -- MB"}</Text>
                  </View>
                </View>
              </View>

              {/* Storage Card */}
              <View class="w-[426px] h-[104px] p-[16px] rounded-[20px] bg-[#211f26] flex-col justify-between border border-[#2d2938]">
                <View class="flex-row items-center justify-between">
                  <View class="flex-row items-center gap-[8px]">
                    <View class="w-[10px] h-[10px] rounded-[5px] bg-[#ffd8e4]" />
                    <Text class={isHuge() ? "text-xl font-bold text-[#e6e0e9]" : isLarge() ? "text-lg font-bold text-[#e6e0e9]" : "text-base font-bold text-[#e6e0e9]"}>{t()("system.storage")}</Text>
                  </View>
                  <Text class={isHuge() ? "text-base font-bold text-[#ffd8e4]" : isLarge() ? "text-sm font-bold text-[#ffd8e4]" : "text-xs font-bold text-[#ffd8e4]"}>
                    {snapshot()?.storageTotal ? `TF / Storage` : ""}
                  </Text>
                </View>
                <View class="flex-row items-end justify-between">
                  <Text class="text-2xl font-bold" style={{ textColor: "#ffd8e4" }}>{percentText(storage())}</Text>
                  <View class="flex-col items-end gap-[6px]">
                    <View class="w-[260px] h-[10px] rounded-[5px] bg-[#36343b] overflow-hidden">
                      <View
                        class="h-[10px] rounded-[5px] bg-[#ffd8e4]"
                        style={{ width: Math.max(4, Math.round((Math.max(0, Math.min(100, storage() ?? 0)) / 100) * 260)) }}
                      />
                    </View>
                    <Text class={isHuge() ? "text-base text-[#938f99]" : isLarge() ? "text-sm text-[#938f99]" : "text-xs text-[#938f99]"}>
                      {snapshot()?.storageUsed && snapshot()?.storageTotal ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}` : "-- / --"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {props.pageIndex === 1 ? (
          <View class="w-[672px] h-[336px] flex-col justify-between">
            <View class="w-[672px] px-[6px] mb-[4px]">
              <Text class={isHuge() ? "text-2xl font-bold text-[#d0bcff]" : isLarge() ? "text-xl font-bold text-[#d0bcff]" : "text-lg font-bold text-[#d0bcff]"}>{t()("system.hardware")}</Text>
            </View>
            <InfoRow label={t()("system.board")} value={text(snapshot()?.hardware)} fontSize={props.status.fontSize} />
            <InfoRow label={t()("system.cpu")} value={text(snapshot()?.cpu)} fontSize={props.status.fontSize} />
            <InfoRow label={t()("system.frequency")} value={text(snapshot()?.frequency)} fontSize={props.status.fontSize} />
            <InfoRow
              label={t()("system.temperature")}
              value={text(snapshot()?.temperature)}
              color="#ffd8e4"
              fontSize={props.status.fontSize}
            />
            <InfoRow label={t()("system.memory")} value={memoryLabel()} color="#a8efff" fontSize={props.status.fontSize} />
            <InfoRow
              label={t()("system.display")}
              value={displaySize(snapshot()?.display) ?? "--"}
              fontSize={props.status.fontSize}
            />
            <InfoRow label={t()("system.runtime")} value={text(snapshot()?.runtime)} muted fontSize={props.status.fontSize} />
          </View>
        ) : null}

        {props.pageIndex === 2 ? (
          <View class="w-[672px] h-[336px] flex-col justify-between">
            <View class="w-[672px] px-[6px] mb-[4px]">
              <Text class={isHuge() ? "text-2xl font-bold text-[#d0bcff]" : isLarge() ? "text-xl font-bold text-[#d0bcff]" : "text-lg font-bold text-[#d0bcff]"}>{t()("system.link")}</Text>
            </View>
            <InfoRow
              label={t()("system.status")}
              value={props.network.connected ? t()("system.connected") : t()("system.disconnected")}
              color={props.network.connected ? "#a8efff" : "#ffd8e4"}
              fontSize={props.status.fontSize}
            />
            <InfoRow
              label={t()("system.interface")}
              value={text(props.network.interface).toUpperCase()}
              fontSize={props.status.fontSize}
            />
            <InfoRow label={t()("system.address")} value={text(props.network.address)} fontSize={props.status.fontSize} />

            <View class="w-[672px] px-[6px] mt-[4px] mb-[4px]">
              <Text class={isHuge() ? "text-2xl font-bold text-[#d0bcff]" : isLarge() ? "text-xl font-bold text-[#d0bcff]" : "text-lg font-bold text-[#d0bcff]"}>{t()("system.thisDevice")}</Text>
            </View>
            <InfoRow
              label={t()("system.battery")}
              value={props.status.battery >= 0 ? `${props.status.battery}%` : "--"}
              color={props.status.battery <= 20 ? "#ffb4ab" : "#a8efff"}
              fontSize={props.status.fontSize}
            />
            <InfoRow
              label={t()("system.brightness")}
              value={props.status.brightness === null ? "--" : `${props.status.brightness}%`}
              fontSize={props.status.fontSize}
            />
            <InfoRow
              label={t()("system.volume")}
              value={props.status.volume === null ? "--" : `${props.status.volume}%`}
              fontSize={props.status.fontSize}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
