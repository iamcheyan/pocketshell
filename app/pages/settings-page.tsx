import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";

export interface SettingsState {
  selectedIndex: number;
  brightness: number;
  volume: number;
  wifi: boolean;
  language: string;
  timeoutIndex: number;
  services: Record<string, boolean>;
}

export const TIMEOUT_OPTIONS = [
  { label: "10s", value: "10s" },
  { label: "30s", value: "30s" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "Never", value: "never" },
];

// Only services BaseOS can actually start. The rest were ROCKNIX names with no
// daemon behind them (samba, syncthing, http, ftp, rsyncd, telnet, devbridge),
// so their switches flipped a label and nothing else.
export const SERVICE_KEYS = [
  { key: "ssh", name: "SSH Remote Shell" },
];

type SettingsRow = { type: string; label: string; key?: string };

export function SettingsPage(props: { state: SettingsState }) {
  const allRows: SettingsRow[] = [
    { type: "brightness", label: "Brightness" },
    { type: "volume", label: "Volume" },
    { type: "wifi", label: "Wi-Fi" },
    { type: "language", label: "Language 语言" },
    { type: "timeout", label: "Screen Timeout" },
    ...SERVICE_KEYS.map((s) => ({ type: "service", key: s.key, label: s.name })),
  ];

  const visibleWindow = () => {
    const sel = props.state.selectedIndex;
    const maxStart = Math.max(0, allRows.length - 6);
    const start = Math.max(0, Math.min(maxStart, sel - 2));
    return allRows.slice(start, start + 6).map((item, i) => ({ ...item, realIndex: start + i }));
  };

  const renderProgressBlocks = (value: number) => {
    const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
    return Array.from({ length: 10 }, (_, index) => index < filled);
  };

  const statePill = (enabled: boolean, label: string, color: "green" | "cyan" = "green") => (
    <View class={enabled
      ? (color === "green"
        ? "w-[72px] h-[17px] rounded-full items-center justify-center bg-emerald-900 border border-emerald-400"
        : "w-[72px] h-[17px] rounded-full items-center justify-center bg-sky-900 border border-sky-400")
      : "w-[72px] h-[17px] rounded-full items-center justify-center bg-slate-800 border border-[#34485a]"}>
      <Text class={enabled
        ? (color === "green" ? "text-xs font-bold text-emerald-300" : "text-xs font-bold text-sky-300")
        : "text-xs font-bold text-slate-500"}>
        {enabled ? label : "OFF"}
      </Text>
    </View>
  );
  return (
    <View class="w-[360px] h-[198px] px-2 py-1 flex-col justify-center">

      {/* Settings Rows */}
      <View class="flex-col gap-[3px] w-full">
        <Index each={visibleWindow()}>
          {(row) => {
            const isSelected = () => props.state.selectedIndex === row().realIndex;
            return (
              <View
                class={
                  isSelected()
                    ? "w-[344px] h-[23px] px-2 rounded-lg flex-row items-center justify-between bg-[#1e3042] border border-[#38bdf8]"
                    : "w-[344px] h-[23px] px-2 rounded-lg flex-row items-center justify-between bg-[#14202c] border border-[#273a4b]"
                }
              >
                {/* Left: Label */}
                <Text
                  class={
                    isSelected()
                      ? "text-xs font-bold text-white"
                      : "text-xs font-bold text-slate-300"
                  }
                >
                  {row().label}
                </Text>

                {/* Right: Value Widget */}
                {row().type === "brightness" ? (
                  <View class="flex-row items-center gap-2">
                    <View class="flex-row gap-[2px] h-[8px] w-[78px]">
                      <Index each={renderProgressBlocks(props.state.brightness)}>
                        {(filled) => <View class="flex-1 h-[8px] rounded-sm" style={{ bgColor: filled() ? "#38bdf8" : "#263746" }} />}
                      </Index>
                    </View>
                    <Text class="w-[34px] text-right text-xs font-mono text-cyan-300">{`${props.state.brightness}%`}</Text>
                  </View>
                ) : row().type === "volume" ? (
                  <View class="flex-row items-center gap-2">
                    <View class="flex-row gap-[2px] h-[8px] w-[78px]">
                      <Index each={renderProgressBlocks(props.state.volume)}>
                        {(filled) => <View class="flex-1 h-[8px] rounded-sm" style={{ bgColor: filled() ? "#38bdf8" : "#263746" }} />}
                      </Index>
                    </View>
                    <Text class="w-[34px] text-right text-xs font-mono text-cyan-300">{`${props.state.volume}%`}</Text>
                  </View>
                ) : row().type === "wifi" ? (
                  statePill(props.state.wifi, "ON", "cyan")
                ) : row().type === "language" ? (
                  <View class="w-[72px] h-[17px] rounded-full bg-[#102d3b] border border-[#28627a] items-center justify-center">
                    <Text class="text-xs font-mono text-cyan-300">{props.state.language.toUpperCase()}</Text>
                  </View>
                ) : row().type === "timeout" ? (
                  <View class="w-[72px] h-[17px] rounded-full bg-[#102d3b] border border-[#28627a] items-center justify-center">
                    <Text class="text-xs font-mono text-cyan-300">{TIMEOUT_OPTIONS[props.state.timeoutIndex].label}</Text>
                  </View>
                ) : row().type === "service" ? (
                  statePill(!!row().key && props.state.services[row().key!], "ON")
                ) : (
                  <Text class="text-xs font-bold text-amber-300">PRESS A 打开</Text>
                )}
              </View>
            );
          }}
        </Index>
      </View>

    </View>
  );
}
