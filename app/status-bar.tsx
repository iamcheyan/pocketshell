import { Image, Text, View } from "@pocketjs/framework/solid/components";
import { Index, createSignal, createEffect, onCleanup } from "solid-js";
import { TouchTarget } from "./touch-target";
import {
  THEME_PALETTES,
  FONT_SCALE_CONFIGS,
  type ThemeColorKey,
  type FontSizeKey,
} from "./theme-model";

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
  const fontConfig = () => FONT_SCALE_CONFIGS[props.fontSize || "normal"] || FONT_SCALE_CONFIGS.normal;

  const [currentTime, setCurrentTime] = createSignal("");
  createEffect(() => {
    if (!props.showClock) {
      setCurrentTime("");
      return;
    }
    const update = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setCurrentTime(`${h}:${m}`);
    };
    update();
    const interval = setInterval(update, 5000);
    onCleanup(() => clearInterval(interval));
  });

  const TABS = [
    { screen: 0, label: isZh() ? "应用" : isJa() ? "アプリ" : "Apps" },
    { screen: 3, label: isZh() ? "设置" : isJa() ? "設定" : "Settings" },
    { screen: 4, label: isZh() ? "系统" : isJa() ? "システム" : "System" },
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
    <View class="w-[720px] h-[64px] flex-row items-center justify-between px-[24px] bg-transparent">
      {/* Left: M3 Navigation Tabs (No L/R badges, borderless pill indicators) */}
      <View class="flex-row items-center gap-[12px]">
        {props.title ? (
          <View class="flex-row items-center gap-[10px]">
            <View class="w-[4px] h-[24px] rounded-[999px]" style={{ bgColor: theme().primary }} />
            <Text class="text-xl font-bold text-[#e6e0e9] tracking-wide">
              {props.title}
            </Text>
          </View>
        ) : (
          <View class="flex-row items-center gap-[8px]">
            <Index each={TABS}>
              {(tab) => {
                const isSelected = () => props.currentScreen === tab().screen;
                return (
                  <TouchTarget
                    onPress={() => props.onSelectTab?.(tab().screen)}
                    class={
                      isSelected()
                        ? "px-[18px] py-[6px] rounded-[999px] items-center justify-center"
                        : "px-[14px] py-[6px] rounded-[999px] items-center justify-center bg-transparent"
                    }
                    style={isSelected() ? { bgColor: theme().container } : undefined}
                  >
                    <Text
                      class={
                        isSelected()
                          ? (props.fontSize === "huge" ? "text-2xl font-bold" : "text-xl font-bold")
                          : (props.fontSize === "huge" ? "text-xl text-[#cac4d0]" : "text-lg text-[#cac4d0]")
                      }
                      style={isSelected() ? { textColor: theme().onContainer } : undefined}
                    >
                      {tab().label}
                    </Text>
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
            class={props.fontSize === "huge" ? "text-xl font-bold text-[#e6e0e9]" : "text-lg font-bold text-[#e6e0e9]"}
          >
            {currentTime()}
          </Text>
        </View>
      ) : null}

      {/* Right: Modern Vector Status Icons (Bright when enabled, dim when disabled) */}
      <View class="flex-row items-center gap-[12px]">
        {/* Wi-Fi */}
        <Image
          class="w-[22px] h-[22px]"
          src={props.wifiConnected ? "icon-wifi-on.png" : "icon-wifi-off.png"}
        />

        {/* Bluetooth */}
        <Image
          class="w-[22px] h-[22px]"
          src={props.bluetoothOn ? "icon-bt-on.png" : "icon-bt-off.png"}
        />

        {/* SSH */}
        <Image
          class="w-[22px] h-[22px]"
          src={props.sshEnabled ? "icon-ssh-on.png" : "icon-ssh-off.png"}
        />

        {/* ADB */}
        <Image
          class="w-[22px] h-[22px]"
          src={props.adbEnabled ? "icon-adb-on.png" : "icon-adb-off.png"}
        />

        {/* USB / MTP */}
        <Image
          class="w-[22px] h-[22px]"
          src={props.mtpEnabled ? "icon-usb-on.png" : "icon-usb-off.png"}
        />

        {/* Battery Level */}
        <View class="flex-row items-center gap-[8px] ml-[4px]">
          {known() && (
            <Text class="text-base font-bold text-[#e6e0e9]">
              {props.batteryLevel}%
            </Text>
          )}
          <View class="w-[34px] h-[18px] rounded-[4px] bg-[#36343b] p-[2px] flex-row items-center">
            <View
              class="h-full rounded-[2px]"
              style={{
                width: Math.max(2, Math.min(30, Math.round((props.batteryLevel / 100) * 30))),
                bgColor: batteryColor(),
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
