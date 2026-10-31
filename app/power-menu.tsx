import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { translator } from "./i18n";
import { TouchTarget } from "./touch-target";

export type PowerAction = "poweroff" | "reboot";

export interface PowerMenuProps {
  language: string;
  /** Which side is currently armed; ←→ moves it. */
  selected: PowerAction;
  busy: boolean;
  /** The host answered that it cannot power off / restart from the guest. */
  refused: boolean;
  onSelect: (action: PowerAction) => void;
  onConfirm: (action: PowerAction) => void;
  onCancel: () => void;
}

const ITEMS: ReadonlyArray<{ action: PowerAction; glyph: string; label: string }> = [
  { action: "poweroff", glyph: "\u{f011}", label: "powerMenu.poweroff" },
  { action: "reboot", glyph: "\u{f021}", label: "powerMenu.reboot" },
];

// A modal over the whole panel. It is drawn last in the tree so it covers the
// launcher, and it owns every button while open — the only way out is an
// explicit choice or B.
export function PowerMenu(props: PowerMenuProps) {
  const t = () => translator(props.language);
  return (
    <View class="absolute left-0 top-0 w-[360px] h-[240px] flex-col items-center justify-center" style={{ bgColor: "#05090d", opacity: 0.98 }}>
      <View class="w-[336px] h-[150px] flex-col" style={{ bgColor: "#0d1722", borderWidth: 1, borderColor: "#1f3a4d", radius: 10 }}>
        <View class="w-[336px] h-[34px] flex-row items-center justify-between px-4">
          <Text class="text-sm font-bold" style={{ textColor: "#d8e8ff" }}>{t()("powerMenu.title")}</Text>
          <Text class="text-xs font-mono" style={{ textColor: "#5a7183" }}>{t()("powerMenu.hint")}</Text>
        </View>
        <View class="w-[336px] h-[1px]" style={{ bgColor: "#1b3345" }} />

        <View class="w-[336px] flex-1 flex-row items-center justify-center gap-3">
          <Index each={ITEMS}>
            {(item) => {
              const armed = () => props.selected === item().action;
              return (
                <TouchTarget
                  onPress={() => {
                    props.onSelect(item().action);
                    props.onConfirm(item().action);
                  }}
                  class={
                    armed()
                      ? "w-[140px] h-[86px] flex-col items-center justify-center bg-[#173348]"
                      : "w-[140px] h-[86px] flex-col items-center justify-center bg-[#101c26]"
                  }
                >
                  <View class="h-[38px] items-center justify-center">
                    <Text class="text-2xl" style={{ textColor: armed() ? "#58c8e8" : "#5a7183" }}>
                      {item().glyph}
                    </Text>
                  </View>
                  <View class="h-[20px] items-center justify-center">
                    <Text
                      class="text-sm font-bold"
                      style={{ textColor: armed() ? "#eaf7ff" : "#9fb2c2" }}
                    >
                      {t()(item().label)}
                    </Text>
                  </View>
                </TouchTarget>
              );
            }}
          </Index>
        </View>

        <View class="w-[336px] h-[20px] flex-row items-center justify-center">
          <Text class="text-xs font-mono" style={{ textColor: props.busy || props.refused ? "#edc44f" : "#3a4a58" }}>
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
