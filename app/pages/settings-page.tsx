import { View, Text, type NodeMirror } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import { createGesture } from "@pocketjs/framework/gesture";
import { translator } from "../i18n";
import { TouchTarget } from "../touch-target";
import {
  SETTING_ROWS,
  SETTINGS_COUNT,
  TIMEOUT_OPTIONS,
  AUTO_POWEROFF_OPTIONS,
  parseToggle,
  type SettingRow,
} from "../settings-model";
import {
  THEME_PALETTES,
  type ThemeColorKey,
  type FontSizeKey,
} from "../theme-model";

export { SETTING_ROWS, SETTINGS_COUNT, TIMEOUT_OPTIONS, AUTO_POWEROFF_OPTIONS };

export interface SettingsState {
  selectedIndex: number;
  language: string;
  values: Record<string, string | null>;
  wifiConnected: boolean;
  ipAddress: string;
  themeColor?: ThemeColorKey;
  fontSize?: FontSizeKey;
}

export interface SettingsPageProps {
  state: SettingsState;
  onSelect?: (index: number) => void;
  onActivate?: (index: number) => void;
  onAdjust?: (index: number, direction: -1 | 1) => void;
  onLevelPreview?: (key: "brightness" | "volume", value: number) => void;
  onLevelCommit?: (key: "brightness" | "volume", value: number) => void;
  onLevelCancel?: () => void;
  onSetLanguage?: (lang: string) => void;
}

const VISIBLE_ROWS = 5;
type LevelKey = "brightness" | "volume";

const METER_W = 180;

function LevelMeter(props: {
  rowKey: LevelKey;
  value: number | null;
  fillColor: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
  onCancel: () => void;
}) {
  let track: NodeMirror | undefined;
  const valueAt = (x: number) => {
    const fraction = Math.max(0, Math.min(1, x / METER_W));
    const floor = props.rowKey === "brightness" ? 5 : 0;
    return Math.max(floor, Math.min(100, Math.round(fraction * 100)));
  };
  createGesture({
    region: { node: () => track },
    axis: "x",
    onTap: (contact) => {
      const value = valueAt(contact.x);
      props.onPreview(value);
      props.onCommit(value);
    },
    onPanStart: (contact) => props.onPreview(valueAt(contact.x)),
    onPanMove: (contact) => props.onPreview(valueAt(contact.x)),
    onPanEnd: (contact) => {
      const value = valueAt(contact.x);
      props.onPreview(value);
      props.onCommit(value);
    },
    onCancel: () => props.onCancel(),
  });

  const percent = () => Math.max(0, Math.min(100, props.value ?? 0));

  return (
    <View
      ref={(node: NodeMirror) => { track = node; }}
      class="w-[180px] h-[18px] rounded-[999px] bg-[#36343b] overflow-hidden flex-row items-center p-[2px]"
    >
      <View
        class="h-full rounded-[999px]"
        style={{
          width: Math.round((percent() / 100) * 176),
          bgColor: props.fillColor,
        }}
      />
    </View>
  );
}

export function SettingsPage(props: SettingsPageProps) {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translator(props.state.language)(key, vars);
  const value = (key: string) => props.state.values[key] ?? null;
  const rowLabel = (row: SettingRow) => t(`settings.${row.label}`);

  const theme = () => THEME_PALETTES[props.state.themeColor || "purple"] || THEME_PALETTES.purple;
  const isHuge = () => props.state.fontSize === "huge";
  const isLarge = () => props.state.fontSize === "large";

  const rowHeight = () => (isHuge() ? 62 : isLarge() ? 56 : 52);

  const visibleWindow = () => {
    const sel = Math.max(0, Math.min(SETTINGS_COUNT - 1, props.state.selectedIndex));
    const start = Math.max(0, Math.min(Math.max(0, SETTINGS_COUNT - VISIBLE_ROWS), sel - 2));
    return SETTING_ROWS.slice(start, start + VISIBLE_ROWS).map((row, i) => ({
      row,
      realIndex: start + i,
    }));
  };

  const windowGroup = () => visibleWindow()[0]?.row.group ?? "display";

  // M3 Switch Pill
  // iPhone / M3 physical sliding toggle switch
  const switchControl = (raw: string | null, onPress?: () => void) => {
    const state = parseToggle(raw ?? undefined);
    const on = state === true;
    return (
      <TouchTarget
        onPress={() => {
          if (state !== null) onPress?.();
        }}
        class={
          on
            ? "w-[52px] h-[30px] rounded-[999px] flex-row items-center justify-end px-[3px]"
            : "w-[52px] h-[30px] rounded-[999px] bg-[#36343b] flex-row items-center justify-start px-[3px]"
        }
        style={on ? { bgColor: theme().primary } : undefined}
      >
        <View
          class="w-[24px] h-[24px] rounded-[999px]"
          style={{ bgColor: on ? theme().switchThumb : "#938f99" }}
        />
      </TouchTarget>
    );
  };

  // M3 Chip
  const enumPill = (text: string) => (
    <View class="px-[16px] h-[34px] items-center justify-center bg-[#36343b] rounded-[999px]">
      <Text
        class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
        style={{ textColor: theme().onContainer }}
      >
        {text}
      </Text>
    </View>
  );

  const rowValue = (row: SettingRow) => {
    const raw = value(row.key);
    if (row.kind === "level") {
      const level = raw === null ? null : Number(raw);
      const shown =
        level !== null && Number.isFinite(level) ? `${Math.round(level)}%` : t("common.unknown");
      return (
        <View class="flex-row items-center gap-[14px]">
          <LevelMeter
            rowKey={row.key as LevelKey}
            value={level !== null && Number.isFinite(level) ? level : null}
            fillColor={theme().primary}
            onPreview={(v) => props.onLevelPreview?.(row.key as LevelKey, v)}
            onCommit={(v) => props.onLevelCommit?.(row.key as LevelKey, v)}
            onCancel={() => props.onLevelCancel?.()}
          />
          <View class="w-[50px] flex-row items-center justify-end">
            <Text
              class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
              style={{ textColor: theme().primary }}
            >
              {shown}
            </Text>
          </View>
        </View>
      );
    }
    if (row.kind === "toggle") {
      if (row.key === "wifi") {
        return (
          <View class="flex-row items-center gap-[12px]">
            <Text
              class={isHuge() ? "text-lg text-[#cac4d0]" : "text-base text-[#cac4d0]"}
            >
              {props.state.wifiConnected
                ? props.state.ipAddress && props.state.ipAddress !== "--"
                  ? props.state.ipAddress
                  : t("settings.connected")
                : t("settings.disconnected")}
            </Text>
            {switchControl(raw, () => props.onActivate?.(props.state.selectedIndex))}
          </View>
        );
      }
      return switchControl(raw, () => props.onActivate?.(props.state.selectedIndex));
    }
    if (row.kind === "enum") {
      if (row.key === "language") {
        const langs = [
          { code: "zh", label: "中文" },
          { code: "en", label: "EN" },
          { code: "ja", label: "日本語" },
        ];
        return (
          <View class="h-[34px] rounded-[999px] bg-[#36343b] flex-row items-center p-[2px]">
            <Index each={langs}>
              {(l) => {
                const active = () => props.state.language === l().code;
                return (
                  <TouchTarget
                    onPress={() => {
                      if (props.onSetLanguage) props.onSetLanguage(l().code);
                      else props.onActivate?.(props.state.selectedIndex);
                    }}
                    class={
                      active()
                        ? "px-[12px] h-[30px] rounded-[999px] items-center justify-center"
                        : "px-[10px] h-[30px] rounded-[999px] items-center justify-center bg-transparent"
                    }
                    style={active() ? { bgColor: theme().primary } : undefined}
                  >
                    <Text
                      class={active() ? "text-sm font-bold" : "text-sm text-[#cac4d0]"}
                      style={active() ? { textColor: theme().switchThumb } : undefined}
                    >
                      {l().label}
                    </Text>
                  </TouchTarget>
                );
              }}
            </Index>
          </View>
        );
      }
      if (row.key === "fontSize") {
        const sizes: { key: FontSizeKey; label: string }[] = [
          { key: "normal", label: t("fontSize.normal") },
          { key: "large", label: t("fontSize.large") },
          { key: "huge", label: t("fontSize.huge") },
        ];
        return (
          <View class="h-[34px] rounded-[999px] bg-[#36343b] flex-row items-center p-[2px]">
            <Index each={sizes}>
              {(s) => {
                const active = () => (props.state.fontSize || "normal") === s().key;
                return (
                  <TouchTarget
                    onPress={() => props.onAdjust?.(props.state.selectedIndex, 1)}
                    class={
                      active()
                        ? "px-[12px] h-[30px] rounded-[999px] items-center justify-center"
                        : "px-[10px] h-[30px] rounded-[999px] items-center justify-center bg-transparent"
                    }
                    style={active() ? { bgColor: theme().primary } : undefined}
                  >
                    <Text
                      class={active() ? "text-sm font-bold" : "text-sm text-[#cac4d0]"}
                      style={active() ? { textColor: theme().switchThumb } : undefined}
                    >
                      {s().label}
                    </Text>
                  </TouchTarget>
                );
              }}
            </Index>
          </View>
        );
      }
      if (row.key === "themeColor") {
        const key = (props.state.themeColor || "purple") as ThemeColorKey;
        const pal = THEME_PALETTES[key] || THEME_PALETTES.purple;
        return (
          <View class="px-[14px] h-[34px] items-center justify-center bg-[#36343b] rounded-[999px] flex-row gap-[8px]">
            <View class="w-[12px] h-[12px] rounded-[999px]" style={{ bgColor: pal.primary }} />
            <Text
              class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
              style={{ textColor: pal.primary }}
            >
              {t(`theme.${key}`)}
            </Text>
          </View>
        );
      }
      if (row.key === "autoPoweroff") {
        const index = AUTO_POWEROFF_OPTIONS.findIndex((option) => option.value === raw);
        return (
          <View class="flex-row items-center gap-[10px]">
            <Text class={isHuge() ? "text-lg text-[#cac4d0]" : "text-base text-[#cac4d0]"}>
              {t("settings.autoPoweroffCharger")}
            </Text>
            {enumPill(
              index >= 0 ? AUTO_POWEROFF_OPTIONS[index].label : raw ?? t("common.unknown"),
            )}
          </View>
        );
      }
      const index = TIMEOUT_OPTIONS.findIndex((option) => option.value === raw);
      return enumPill(index >= 0 ? TIMEOUT_OPTIONS[index].label : raw ?? t("common.unknown"));
    }
    if (row.kind === "text") {
      return (
        <Text
          class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
          style={{ textColor: "#e6e0e9" }}
        >
          {raw || t("common.unknown")}
        </Text>
      );
    }
    return (
      <View class="px-[14px] py-[6px] rounded-[999px] bg-[#36343b]">
        <Text
          class={isHuge() ? "text-xl font-bold" : isLarge() ? "text-lg font-bold" : "text-base font-bold"}
          style={{ textColor: theme().primary }}
        >
          {t("settings.pressA")}
        </Text>
      </View>
    );
  };

  return (
    <View class="w-[720px] h-[348px] px-[36px] py-[8px] flex-col justify-between items-center bg-transparent">
      {/* Category heading (M3 Title Large) */}
      <View class="w-[660px] h-[30px] flex-row items-center justify-between px-[6px]">
        <Text
          class={isHuge() ? "text-2xl font-bold tracking-wide" : "text-xl font-bold tracking-wide"}
          style={{ textColor: theme().primary }}
        >
          {t(`settings.group.${windowGroup()}`)}
        </Text>
        <Text class={isHuge() ? "text-lg font-bold text-[#cac4d0]" : "text-base font-bold text-[#cac4d0]"}>
          {`${props.state.selectedIndex + 1} / ${SETTINGS_COUNT}`}
        </Text>
      </View>

      {/* M3 List Container (Borderless, soft surface highlights, dynamic height) */}
      <View class="flex-col w-[660px] gap-[6px]">
        <Index each={visibleWindow()}>
          {(entry) => {
            const selected = () => props.state.selectedIndex === entry().realIndex;
            return (
              <TouchTarget
                onPress={() => {
                  props.onSelect?.(entry().realIndex);
                  props.onActivate?.(entry().realIndex);
                }}
                class={
                  selected()
                    ? "w-[660px] px-[16px] flex-row items-center justify-between rounded-[16px]"
                    : "w-[660px] px-[16px] flex-row items-center justify-between rounded-[16px] bg-transparent"
                }
                style={{
                  height: rowHeight(),
                  bgColor: selected() ? theme().activeSurface : "#00000000",
                }}
              >
                <View class="flex-row items-center gap-[12px]">
                  <View
                    class="w-[4px] h-[24px] rounded-[999px]"
                    style={{ bgColor: selected() ? theme().primary : "#00000000" }}
                  />
                  <Text
                    class={
                      isHuge()
                        ? (selected() ? "text-2xl font-bold text-[#e6e0e9]" : "text-2xl text-[#cac4d0]")
                        : isLarge()
                        ? (selected() ? "text-xl font-bold text-[#e6e0e9]" : "text-xl text-[#cac4d0]")
                        : (selected() ? "text-xl font-bold text-[#e6e0e9]" : "text-lg text-[#cac4d0]")
                    }
                  >
                    {rowLabel(entry().row)}
                  </Text>
                </View>
                {rowValue(entry().row)}
              </TouchTarget>
            );
          }}
        </Index>
      </View>
    </View>
  );
}
