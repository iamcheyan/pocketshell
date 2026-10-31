import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import { TouchTarget } from "./touch-target";

export interface StatusBarProps {
  currentScreen: number;
  language: string;
  wifiConnected: boolean;
  ipAddress: string;
  bluetoothOn: boolean;
  batteryLevel: number;
  batteryStatus: "charging" | "full" | "discharging" | "unknown";
  sshEnabled: boolean;
  adbEnabled: boolean;
  mtpEnabled: boolean;
  onSelectTab?: (screen: number) => void;
  /** A full-screen app replaces the tabs with its own name: there is nothing to
   *  switch to while it runs. */
  title?: string;
}

const TABS: Record<string, string[]> = {
  en: ["APPS", "SETTINGS", "SYSTEM"],
  zh: ["应用", "设置", "系统"],
  ja: ["アプリ", "設定", "情報"],
};
const BATTERY_LEVELS = [
  { threshold: 10, normal: "\u{f007a}", charging: "\u{f089c}" },
  { threshold: 20, normal: "\u{f007b}", charging: "\u{f0086}" },
  { threshold: 30, normal: "\u{f007c}", charging: "\u{f0087}" },
  { threshold: 40, normal: "\u{f007d}", charging: "\u{f0088}" },
  { threshold: 50, normal: "\u{f007e}", charging: "\u{f089d}" },
  { threshold: 60, normal: "\u{f007f}", charging: "\u{f0089}" },
  { threshold: 70, normal: "\u{f0080}", charging: "\u{f089e}" },
  { threshold: 80, normal: "\u{f0081}", charging: "\u{f008a}" },
  { threshold: 90, normal: "\u{f0082}", charging: "\u{f008b}" },
];

export function StatusBar(props: StatusBarProps) {
  const known = () => props.batteryLevel >= 0;
  const charge = () => props.batteryStatus === "charging";
  const fullAndPlugged = () => props.batteryStatus === "full";
  // One rule for the whole bar: everything idle is gray, everything on is
  // green. The battery is the only icon that leaves those two states, at 30%
  // (amber) and 10% (red) — a charging battery is green because it is "on".
  const IDLE = "#5a7183";
  const ON = "#4ed49a";
  const batteryColor = () => {
    if (charge() || fullAndPlugged()) return ON;
    if (!known()) return IDLE;
    if (props.batteryLevel <= 10) return "#f06464";
    if (props.batteryLevel <= 30) return "#edc44f";
    return "#d9e5e9";
  };
  const batteryGlyph = () => {
    if (fullAndPlugged()) return "\u{f0085}";
    if (!known()) return charge() ? "\u{f089f}" : "\u{f0091}";
    const level = Math.max(0, Math.min(100, props.batteryLevel));
    if (level < 10) return charge() ? "\u{f089f}" : "\u{f008e}";
    const bucket = Math.floor(level / 10) * 10;
    if (bucket >= 100) return charge() ? "\u{f0085}" : "\u{f0079}";
    return BATTERY_LEVELS.find((item) => item.threshold === bucket)?.[charge() ? "charging" : "normal"] ?? "\u{f0079}";
  };

  return (
    <View class="w-[360px] h-[22px] flex-col justify-between" style={{ bgColor: "#06111b" }}>
      <View class="w-[360px] h-[21px] flex-row items-center justify-between px-2">
        <View class="flex-row items-center gap-2">
          {props.title ? (
            <Text class="text-xs font-bold tracking-wide" style={{ textColor: "#00ff99" }}>
              {props.title}
            </Text>
          ) : null}
          {props.title ? null : <Index each={TABS[props.language] ?? TABS.en}>{(label, i) => (
            <TouchTarget onPress={() => props.onSelectTab?.([0, 3, 4][i])} class="px-1 py-[2px]">
            <Text class={i === (props.currentScreen === 0 ? 0 : props.currentScreen === 3 ? 1 : 2) ? "text-xs font-bold tracking-wide" : "text-xs"}
              style={{ textColor: i === (props.currentScreen === 0 ? 0 : props.currentScreen === 3 ? 1 : 2) ? "#00ff99" : "#5a7183" }}>
              {label()}
            </Text>
            </TouchTarget>
          )}</Index>}
        </View>
        <View class="flex-row items-center gap-1 px-1">
          <Text class="text-xs font-mono" style={{ textColor: props.wifiConnected ? ON : IDLE }}>{"\u{f1eb}"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.bluetoothOn ? ON : IDLE }}>{"\u{f293}"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.sshEnabled ? ON : IDLE }}>{"\u{f120}"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.adbEnabled ? ON : IDLE }}>{"\u{f287}"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.mtpEnabled ? ON : IDLE }}>{"\u{f07b}"}</Text>
          <Text class="text-sm font-mono" style={{ textColor: batteryColor() }}>{batteryGlyph()}</Text>
        </View>
      </View>
      <View class="w-[360px] h-[1px]" style={{ bgColor: "#1b3345" }} />
    </View>
  );
}
