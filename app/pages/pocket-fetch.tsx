import { createMemo, For } from "solid-js";
import { Image, Text, View } from "@pocketjs/framework/solid/components";
import { displaySize, ramUsage, type NetworkSnapshot, type SystemSnapshot } from "../system-status";
import { RollingText } from "../rolling-text";
import { translator } from "../i18n";
import { TouchTarget } from "../touch-target";

export interface PocketFetchProps {
  snapshot: SystemSnapshot | null;
  network: NetworkSnapshot;
  battery: number;
  language: string;
  onRefresh?: () => void;
  onBack?: () => void;
}

const INK = "#19172b";
const CYAN = "#f2ce76";
const GREEN = "#f2ce76";
const AMBER = "#f2ce76";
const PALE = "#f5eddb";
const MUTED = "#9893ad";
const LINE = "#38334f";

// The value column is 210px at 12px monospace; RollingText scrolls anything
// wider instead of clipping it.
const VALUE_WIDTH = 120;

// Tux: the kernel's logo_linux_clut224, cut out of the driver tree and shipped
// as a pak image so the mark is the same penguin the boot log draws.
const LOGO_SRC = "cover-handheld.png";
const LOGO_W = 120;
const LOGO_H = 120;

// `user@host` from the bridge. A machine that answers neither keeps the generic
// localhost form rather than a device name that may be wrong.
function prompt(snapshot: SystemSnapshot | null) {
  const user = snapshot?.user?.trim();
  const host = (snapshot?.hostname ?? snapshot?.model)?.trim().split(/\s+/)[0];
  return `${user || "root"}@${host || "rg34xx"}`;
}

export function PocketFetch(props: PocketFetchProps) {
  const promptLine = () => prompt(props.snapshot);

  const rows = createMemo(() => {
    const snap = props.snapshot ?? null;
    const net = props.network;
    const ram = ramUsage(snap);
    const text = (value: string | null | undefined) => value?.trim() || "--";
    const field = (label: string, value: string, color = PALE) => ({ label, value, color });

    const os = snap?.os?.replace(/\s*Linux\s*/i, " ").trim();
    const osName = snap?.osName;
    const osVersion = snap?.osVersion;

    const model = snap?.model;
    const board = snap?.hardware;

    const kernel = text(snap?.kernel)
      .replace(/^Linux\s+/i, "")
      .replace(/\s*\(([^)]+)\)\s*$/, " $1");

    const cpuParts = [snap?.cpu, snap?.frequency, snap?.temperature]
      .filter((part): part is string => !!part && part !== "--")
      .map((part) => part.replace(/\s+/g, " ").trim());
    const usage = snap?.cpuUsagePercent ?? null;
    if (usage !== null) cpuParts.push(`${usage}%`);

    const storagePercent = snap?.storagePercent ?? null;
    const disk =
      snap?.storageUsed && snap.storageTotal
        ? `${snap.storageUsed} / ${snap.storageTotal}${storagePercent === null ? "" : ` · ${storagePercent}%`}`
        : "--";

    return [
      field("OS", os || (osName ? `${osName}${osVersion ? ` ${osVersion}` : ""}` : "--")),
      field("Host", model ? `${model}${board ? ` · ${board}` : ""}` : text(board)),
      field("Kernel", kernel),
      field("CPU", cpuParts.length ? cpuParts.join(" · ") : "--"),
      field("Memory", ram ? `${ram.usedMb}M / ${ram.totalMb}M` : "--"),
      field("Disk", disk, storagePercent !== null && storagePercent >= 85 ? AMBER : PALE),
      field("Display", displaySize(snap?.display) ?? "720x480"),
      field(
        "Network",
        net.address
          ? `${net.interface ?? "net"} · ${net.address}`
          : net.connected
            ? "Wi-Fi up · no address"
            : "offline",
      ),
      field(
        "Battery",
        props.battery >= 0 ? `${props.battery}%` : "--",
        props.battery >= 0 && props.battery <= 20 ? AMBER : PALE,
      ),
      field("Runtime", text(snap?.runtime)),
    ];
  });

  const t = () => translator(props.language);

  return (
    <View class="w-[720px] h-[416px] px-[24px] py-[12px] flex-col justify-between" style={{ bgColor: "#121016" }}>
      <View class="w-[672px] flex-1 flex-row items-center justify-between">
        {/* Left Handheld Card */}
        <View class="w-[200px] h-[340px] rounded-[24px] bg-[#1e1b24] p-[16px] flex-col items-center justify-between border border-[#2d2938]">
          <View class="w-[124px] h-[124px] items-center justify-center">
            <Image src={LOGO_SRC} style={{ width: LOGO_W, height: LOGO_H }} />
          </View>
          <View class="flex-col items-center text-center">
            <Text class="text-xl font-bold text-[#e6e0e9]">RG34XX</Text>
            <Text class="text-xs font-bold text-[#d0bcff] mt-[2px]">{promptLine()}</Text>
          </View>
          <TouchTarget
            onPress={props.onBack ?? (() => {})}
            class="w-full h-[36px] rounded-[12px] bg-[#36343b] items-center justify-center"
          >
            <Text class="text-xs font-bold text-[#e6e0e9]">B 返回</Text>
          </TouchTarget>
        </View>

        {/* Right Info Rows */}
        <View class="w-[456px] h-[340px] rounded-[24px] bg-[#1e1b24] p-[16px] flex-col justify-between border border-[#2d2938]">
          <Text class="text-base font-bold text-[#d0bcff] mb-[4px]">系统详细参数</Text>
          <For each={rows()}>
            {(row) => (
              <View class="w-full h-[24px] flex-row items-center justify-between">
                <Text class="text-xs font-bold text-[#938f99] w-[80px] shrink-0">
                  {row.label}
                </Text>
                <Text class="text-xs font-bold text-[#cac4d0]" style={{ textColor: row.color }}>
                  {row.value}
                </Text>
              </View>
            )}
          </For>
        </View>
      </View>
    </View>
  );
}

