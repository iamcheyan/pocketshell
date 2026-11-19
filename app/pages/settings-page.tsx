import { SegBar } from "../pixel-ui";
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
      class="w-[90px] h-[9px] flex-row items-center"
    >
      <SegBar value={percent()} width={90} height={9} segs={18} fill={props.fillColor} />
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

  const rowHeight = () => (isHuge() ? 31 : isLarge() ? 28 : 26);

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
            ? "w-[26px] h-[15px] flex-row items-center justify-end px-[2px]"
            : "w-[26px] h-[15px] bg-[#36343b] flex-row items-center justify-start px-[2px]"
        }
        style={on ? { bgColor: theme().primary } : undefined}
      >
        <View
          class="w-[12px] h-[12px]"
          style={{ bgColor: on ? theme().switchThumb : "#938f99" }}
        />
      </TouchTarget>
    );
  };

  // M3 Chip
  const enumPill = (text: string) => (
    <View class="px-[8px] h-[17px] items-center justify-center bg-[#36343b]">
      <Text
        class={isHuge() ? "text-base font-bold" : isLarge() ? "text-sm font-bold" : "text-xs font-bold"}
        style={{ textColor: theme().onContainer }}
      >
        {text}
      </Text>
    </View>
  );

  const rowValue = (row: SettingRow, realIndex: number) => {
    const raw = value(row.key);
    if (row.kind === "level") {
      const level = raw === null ? null : Number(raw);
      const shown =
        level !== null && Number.isFinite(level) ? `${Math.round(level)}%` : t("common.unknown");
      return (
        <View class="flex-row items-center gap-[7px]">
          <LevelMeter
            rowKey={row.key as LevelKey}
            value={level !== null && Number.isFinite(level) ? level : null}
            fillColor={theme().primary}
            onPreview={(v) => {
              props.onSelect?.(realIndex);
              props.onLevelPreview?.(row.key as LevelKey, v);
            }}
            onCommit={(v) => {
              props.onSelect?.(realIndex);
              props.onLevelCommit?.(row.key as LevelKey, v);
            }}
            onCancel={() => props.onLevelCancel?.()}
          />
          <View class="w-[25px] flex-row items-center justify-end">
            <Text
              class={isHuge() ? "text-base font-bold" : isLarge() ? "text-sm font-bold" : "text-xs font-bold"}
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
          <View class="flex-row items-center gap-[6px]">
            <Text
              class={isHuge() ? "text-base text-[#cac4d0]" : "text-xs text-[#cac4d0]"}
            >
              {props.state.wifiConnected
                ? props.state.ipAddress && props.state.ipAddress !== "--"
                  ? props.state.ipAddress
                  : t("settings.connected")
                : t("settings.disconnected")}
            </Text>
            {switchControl(raw, () => {
              props.onSelect?.(realIndex);
              props.onActivate?.(realIndex);
            })}
          </View>
        );
      }
      return switchControl(raw, () => {
        props.onSelect?.(realIndex);
        props.onActivate?.(realIndex);
      });
    }
    if (row.kind === "enum") {
      if (row.key === "language") {
        const langs = [
          { code: "zh", label: "中文" },
          { code: "en", label: "EN" },
          { code: "ja", label: "日本語" },
        ];
        return (
          <View class="h-[17px] bg-[#36343b] flex-row items-center p-[1px]">
            <Index each={langs}>
              {(l) => {
                const active = () => props.state.language === l().code;
                return (
                  <TouchTarget
                    onPress={() => {
                      props.onSelect?.(realIndex);
                      if (props.onSetLanguage) props.onSetLanguage(l().code);
                      else props.onActivate?.(realIndex);
                    }}
                    class={
                      active()
                        ? "px-[6px] h-[15px] items-center justify-center"
                        : "px-[5px] h-[15px] items-center justify-center bg-transparent"
                    }
                    style={active() ? { bgColor: theme().primary } : undefined}
                  >
                    <Text
                      class={active() ? "text-xs font-bold" : "text-xs text-[#cac4d0]"}
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
          <View class="h-[17px] bg-[#36343b] flex-row items-center p-[1px]">
            <Index each={sizes}>
              {(s) => {
                const active = () => (props.state.fontSize || "normal") === s().key;
                return (
                  <TouchTarget
                    onPress={() => {
                      props.onSelect?.(realIndex);
                      props.onAdjust?.(realIndex, 1);
                    }}
                    class={
                      active()
                        ? "px-[6px] h-[15px] items-center justify-center"
                        : "px-[5px] h-[15px] items-center justify-center bg-transparent"
                    }
                    style={active() ? { bgColor: theme().primary } : undefined}
                  >
                    <Text
                      class={active() ? "text-xs font-bold" : "text-xs text-[#cac4d0]"}
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
          <TouchTarget
            onPress={() => {
              props.onSelect?.(realIndex);
              props.onAdjust?.(realIndex, 1);
            }}
            class="px-[7px] h-[17px] items-center justify-center bg-[#36343b] flex-row gap-[4px]"
          >
            <View class="w-[6px] h-[6px]" style={{ bgColor: pal.primary }} />
            <Text
              class={isHuge() ? "text-base font-bold" : isLarge() ? "text-sm font-bold" : "text-xs font-bold"}
              style={{ textColor: pal.primary }}
            >
              {t(`theme.${key}`)}
            </Text>
          </TouchTarget>
        );
      }
      if (row.key === "autoPoweroff") {
        const index = AUTO_POWEROFF_OPTIONS.findIndex((option) => option.value === raw);
        return (
          <TouchTarget
            onPress={() => {
              props.onSelect?.(realIndex);
              props.onAdjust?.(realIndex, 1);
            }}
            class="flex-row items-center gap-[5px]"
          >
            <Text class={isHuge() ? "text-base text-[#cac4d0]" : "text-xs text-[#cac4d0]"}>
              {t("settings.autoPoweroffCharger")}
            </Text>
            {enumPill(
              index >= 0 ? AUTO_POWEROFF_OPTIONS[index].label : raw ?? t("common.unknown"),
            )}
          </TouchTarget>
        );
      }
      const index = TIMEOUT_OPTIONS.findIndex((option) => option.value === raw);
      return (
        <TouchTarget
          onPress={() => {
            props.onSelect?.(realIndex);
            props.onAdjust?.(realIndex, 1);
          }}
        >
          {enumPill(index >= 0 ? TIMEOUT_OPTIONS[index].label : raw ?? t("common.unknown"))}
        </TouchTarget>
      );
    }
    if (row.kind === "text") {
      return (
        <Text
          class={isHuge() ? "text-base font-bold" : isLarge() ? "text-sm font-bold" : "text-xs font-bold"}
          style={{ textColor: "#e6e0e9" }}
        >
          {raw || t("common.unknown")}
        </Text>
      );
    }
    return (
      <View class="px-[7px] py-[3px] bg-[#36343b]">
        <Text
          class={isHuge() ? "text-base font-bold" : isLarge() ? "text-sm font-bold" : "text-xs font-bold"}
          style={{ textColor: theme().primary }}
        >
          {t("settings.pressA")}
        </Text>
      </View>
    );
  };

  return (
    <View class="w-[360px] h-[174px] px-[18px] py-[4px] flex-col justify-between items-center bg-transparent">
      {/* Category heading (M3 Title Large) */}
      <View class="w-[330px] h-[15px] flex-row items-center justify-between px-[3px]">
        <Text
          class={isHuge() ? "text-base font-bold tracking-wide" : "text-xs font-bold tracking-wide"}
          style={{ textColor: theme().primary }}
        >
          {t(`settings.group.${windowGroup()}`)}
        </Text>
        <Text class={isHuge() ? "text-base font-bold text-[#cac4d0]" : "text-xs font-bold text-[#cac4d0]"}>
          {`${props.state.selectedIndex + 1} / ${SETTINGS_COUNT}`}
        </Text>
      </View>

      {/* M3 List Container (Borderless, soft surface highlights, dynamic height) */}
      <View class="flex-col w-[330px] gap-[3px]">
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
                    ? "w-[330px] px-[8px] flex-row items-center justify-between"
                    : "w-[330px] px-[8px] flex-row items-center justify-between bg-transparent"
                }
                style={{
                  height: rowHeight(),
                  bgColor: selected() ? theme().activeSurface : "#00000000",
                }}
              >
                <View class="flex-row items-center gap-[6px]">
                  <View
                    class="w-[2px] h-[12px]"
                    style={{ bgColor: selected() ? theme().primary : "#00000000" }}
                  />
                  <Text
                    class={
                      isHuge()
                        ? (selected() ? "text-xs font-bold text-[#e6e0e9]" : "text-xs text-[#cac4d0]")
                        : isLarge()
                        ? (selected() ? "text-xs font-bold text-[#e6e0e9]" : "text-xs text-[#cac4d0]")
                        : (selected() ? "text-xs font-bold text-[#e6e0e9]" : "text-xs text-[#cac4d0]")
                    }
                  >
                    {rowLabel(entry().row)}
                  </Text>
                </View>
                {rowValue(entry().row, entry().realIndex)}
              </TouchTarget>
            );
          }}
        </Index>
      </View>
    </View>
  );
}
