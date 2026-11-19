import { Text, View } from "@pocketjs/framework/solid/components";
import { Index, createSignal, createEffect } from "solid-js";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { TouchTarget } from "./touch-target";
import {
  THEME_PALETTES,
  FONT_SCALE_CONFIGS,
  type ThemeColorKey,
  type FontSizeKey,
} from "./theme-model";
import { PixelStatus } from "./pixel-status";

export interface StatusBarProps {
  currentScreen?: number;
  language?: string;
  wifiConnected?: boolean;
  ipAddress?: string;
  bluetoothOn?: boolean;
  sshEnabled?: boolean;
  adbEnabled?: boolean;
  mtpEnabled?: boolean;
  themeColor?: ThemeColorKey;
  fontSize?: FontSizeKey;
  showClock?: boolean;
  onSelectTab?: (screen: number) => void;
  title?: string;
  batteryLevel: number;
  batteryStatus: "charging" | "full" | "discharging" | "unknown";
}

export function StatusBar(props: StatusBarProps) {
  const isZh = () => !props.language || props.language.startsWith("zh");
  const isJa = () => Boolean(props.language?.startsWith("ja"));

  const theme = () => THEME_PALETTES[props.themeColor || "purple"] || THEME_PALETTES.purple;
  const isHuge = () => props.fontSize === "huge";
  const isLarge = () => props.fontSize === "large";

  const [currentTime, setCurrentTime] = createSignal("");
  const update = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    setCurrentTime(`${h}:${m}`);
  };

  createEffect(() => {
    if (!props.showClock) {
      setCurrentTime("");
      return;
    }
    update();
  });

  let clockTicks = 0;
  onFrame(() => {
    if (!props.showClock) return;
    clockTicks++;
    if (clockTicks >= 60) {
      clockTicks = 0;
      update();
    }
  });

  const isAppScreen = () =>
    props.currentScreen === 0 ||
    props.currentScreen === 1 ||
    props.currentScreen === 2 ||
    props.currentScreen === 5;

  const TABS = [
    { id: "apps", screen: 0, label: isZh() ? "应用" : isJa() ? "アプリ" : "Apps", active: isAppScreen },
    { id: "settings", screen: 3, label: isZh() ? "设置" : isJa() ? "設定" : "Settings", active: () => props.currentScreen === 3 },
    { id: "system", screen: 4, label: isZh() ? "系统" : isJa() ? "システム" : "System", active: () => props.currentScreen === 4 },
  ];

  const known = () => props.batteryLevel >= 0 && props.batteryLevel <= 100;
  const isLow = () => known() && props.batteryLevel <= 20;
  const isCharging = () => props.batteryStatus === "charging";

  const batteryColor = () => {
    if (isCharging()) return "#a8e6cf";
    if (isLow()) return "#ffb4ab";
    return theme().primary;
  };

  return (
    <View class="w-[360px] h-[32px] flex-row items-center justify-between px-[12px] bg-transparent shadow-md">
      {/* Left: M3 Navigation Tabs (No L/R badges, borderless pill indicators) */}
      <View class="flex-row items-center gap-[6px]">
        {props.title ? (
          <View class="flex-row items-center gap-[5px]">
            <View class="w-[2px] h-[12px] rounded-[999px]" style={{ bgColor: theme().primary }} />
            <Text class="text-xs font-bold text-[#e6e0e9] tracking-wide">
              {props.title}
            </Text>
          </View>
        ) : (
          <View class="flex-row items-center gap-[4px]">
            <Index each={TABS}>
              {(tab) => {
                const isSelected = () => tab().active();
                return (
                  <TouchTarget
                    onPress={() => props.onSelectTab?.(tab().screen)}
                    class="h-[20px] items-center justify-center"
                  >
                    {isSelected() ? (
                      <View
                        class="px-[9px] py-[3px] rounded-[999px] items-center justify-center border-2"
                        style={{
                          bgColor: theme().container,
                          borderColor: theme().primary,
                        }}
                      >
                        <Text
                          class={isHuge() ? "text-base font-bold text-white" : isLarge() ? "text-sm font-bold text-white" : "text-xs font-bold text-white"}
                          style={{ textColor: "#ffffff" }}
                        >
                          {tab().label}
                        </Text>
                      </View>
                    ) : (
                      <View
                        class="px-[7px] py-[3px] items-center justify-center bg-transparent"
                        style={{
                          bgColor: "#00000000",
                          borderColor: "#00000000",
                          borderWidth: 0,
                          radius: 0,
                        }}
                      >
                        <Text
                          class={isHuge() ? "text-base text-[#938f99]" : isLarge() ? "text-sm text-[#938f99]" : "text-xs text-[#938f99]"}
                          style={{ textColor: "#938f99" }}
                        >
                          {tab().label}
                        </Text>
                      </View>
                    )}
                  </TouchTarget>
                );
              }}
            </Index>
          </View>
        )}
      </View>

      {/* Center: Clock (When showClock setting enabled) */}
      {props.showClock && currentTime() ? (
        <View class="items-center justify-center">
          <Text
            class={isHuge() ? "text-base font-bold text-[#e6e0e9]" : isLarge() ? "text-sm font-bold text-[#e6e0e9]" : "text-xs font-bold text-[#e6e0e9]"}
          >
            {currentTime()}
          </Text>
        </View>
      ) : null}

      {/* Right: Modern Vector Status Icons (Bright when enabled, dim when disabled) */}
      <View class="flex-row items-center gap-[6px]">
        {/* Wi-Fi */}
        <PixelStatus kind="wifi" color={props.wifiConnected ? theme().primary : "#756f7d"} />
        <PixelStatus kind="bluetooth" color={props.bluetoothOn ? theme().primary : "#756f7d"} />
        <PixelStatus kind="ssh" color={props.sshEnabled ? theme().primary : "#756f7d"} />
        <PixelStatus kind="lock" color={props.adbEnabled ? theme().primary : "#756f7d"} />
        <PixelStatus kind="usb" color={props.mtpEnabled ? theme().primary : "#756f7d"} />

        {/* Battery Level */}
        <View class="flex-row items-center gap-[4px] ml-[2px]">
          {known() && (
            <Text class={isHuge() ? "text-base font-bold text-[#e6e0e9]" : isLarge() ? "text-sm font-bold text-[#e6e0e9]" : "text-xs font-bold text-[#e6e0e9]"}>
              {props.batteryLevel}%
            </Text>
          )}
          <View class="w-[10px] h-[6px] rounded-[1px] bg-[#36343b] p-[1px] flex-row items-center">
            <View
              class="h-full rounded-[1px]"
              style={{
                width: Math.max(1, Math.min(16, Math.round((props.batteryLevel / 100) * 16))),
                bgColor: batteryColor(),
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
