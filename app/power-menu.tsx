import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { translator } from "./i18n";
import { TouchTarget } from "./touch-target";
import { THEME_PALETTES, type ThemeColorKey } from "./theme-model";

export type PowerAction = "poweroff" | "reboot";

export interface PowerMenuProps {
  language: string;
  /** Which side is currently armed; ←→ moves it. */
  themeColor: ThemeColorKey;
  selected: PowerAction;
  busy: boolean;
  /** The host answered that it cannot power off / restart from the guest. */
  refused: boolean;
  onSelect: (action: PowerAction) => void;
  onConfirm: (action: PowerAction) => void;
  onCancel: () => void;
}

const ITEMS: ReadonlyArray<{ action: PowerAction; icon: string; label: string }> = [
  { action: "poweroff", icon: "⏻", label: "powerMenu.poweroff" },
  { action: "reboot", icon: "↻", label: "powerMenu.reboot" },
];

export function PowerMenu(props: PowerMenuProps) {
  const theme = () => THEME_PALETTES[props.themeColor] || THEME_PALETTES.purple;
  const t = () => translator(props.language);
  return (
    <View class="absolute left-0 top-0 w-[720px] h-[480px] bg-[#000000bf] flex-col items-center justify-center">
      <View class="w-[460px] h-[240px] rounded-[16px] bg-[#1a1c24] border border-[#303644] flex-col justify-between p-[24px] shadow-lg">
        <View class="w-[412px] flex-row items-center justify-between">
          <Text class="text-lg font-bold text-white">{t()("powerMenu.title")}</Text>
          <Text class="text-xs text-[#8c94a4]">{t()("powerMenu.hint")}</Text>
        </View>

        <View class="w-[412px] flex-row items-center justify-center gap-[20px]">
          <Index each={ITEMS}>
            {(item) => {
              const armed = () => props.selected === item().action;
              return (
                <TouchTarget
                  onPress={() => {
                    props.onSelect(item().action);
                    props.onConfirm(item().action);
                  }}
                  class={armed()
                    ? "flex-1 h-[100px] flex-col items-center justify-center rounded-[12px] border-2"
                    : "flex-1 h-[100px] flex-col items-center justify-center rounded-[12px] border"}
                  style={armed()
                    ? { bgColor: theme().activeSurface, borderColor: theme().primary }
                    : { bgColor: "#1e222a", borderColor: "#303644" }}
                >
                  <Text class="text-2xl font-bold mb-[6px]" style={{ textColor: armed() ? theme().primary : "#6c7484" }}>
                    {item().icon}
                  </Text>
                  <Text class={armed() ? "text-base font-bold text-white" : "text-base text-[#8c94a4]"}>
                    {t()(item().label)}
                  </Text>
                </TouchTarget>
              );
            }}
          </Index>
        </View>

        <View class="w-[412px] flex-row items-center justify-center">
          <Text class="text-xs" style={{ textColor: props.busy || props.refused ? theme().primary : "#8c94a4" }}>
            {props.busy
              ? t()("powerMenu.working")
              : props.refused
                ? t()("powerMenu.unavailable")
                : t()("powerMenu.footer")}
          </Text>
        </View>
      </View>
    </View>
  );
}
