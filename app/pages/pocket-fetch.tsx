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

const INK = "#06111B";
const CYAN = "#3ECFFF";
const GREEN = "#00FF99";
const AMBER = "#FFB400";
const PALE = "#D8E8FF";
const MUTED = "#7893A8";
const LINE = "#1B3345";

// The value column is 210px at 12px monospace; RollingText scrolls anything
// wider instead of clipping it.
const VALUE_WIDTH = 210;

// Tux: the kernel's logo_linux_clut224, cut out of the driver tree and shipped
// as a pak image so the mark is the same penguin the boot log draws.
const LOGO_SRC = "tux.png";
const LOGO_W = 54;
const LOGO_H = 54;

// `user@host` from the bridge. A machine that answers neither keeps the generic
// localhost form rather than a device name that may be wrong.
function prompt(snapshot: SystemSnapshot | null) {
  const user = snapshot?.user?.trim();
  const host = (snapshot?.hostname ?? snapshot?.model)?.trim().split(/\s+/)[0];
  return `${user || "pocket"}@${host || "localhost"}`;
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
      field("Display", displaySize(snap?.display) ?? "--"),
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
    <View class="w-[360px] h-[218px] flex-col" style={{ bgColor: INK }}>
      <View class="w-[360px] flex-1 flex-row px-3 pt-2">
        <Image class="mt-1 mr-3" src={LOGO_SRC} style={{ width: LOGO_W, height: LOGO_H }} />

        <View class="flex-col">
          <Text class="text-xs font-bold" style={{ textColor: GREEN }}>
            {promptLine()}
          </Text>
          <Text class="text-xs font-mono" style={{ textColor: LINE }}>
            ------------------
          </Text>
          <For each={rows()}>
            {(row) => (
              <View class="w-[272px] h-[14px] flex-row items-center">
                <Text class="text-xs font-bold w-[62px] shrink-0" style={{ textColor: CYAN }}>
                  {row.label}
                </Text>
                <RollingText value={row.value} color={row.color} width={VALUE_WIDTH} />
              </View>
            )}
          </For>
        </View>
      </View>

      <View class="w-[360px] h-[18px] flex-row items-center justify-end px-2">
        <TouchTarget onPress={props.onRefresh ?? (() => {})} class="h-[18px] min-w-[24px] px-2 items-center justify-center"><Text class="text-xs font-mono" style={{ textColor: GREEN }}>
          ↻
        </Text></TouchTarget>
      </View>
    </View>
  );
}
