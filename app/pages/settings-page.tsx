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

export { SETTING_ROWS, SETTINGS_COUNT, TIMEOUT_OPTIONS, AUTO_POWEROFF_OPTIONS };

export interface SettingsState {
  selectedIndex: number;
  language: string;
  /** Raw bridge value per row key; null means the bridge did not answer. */
  values: Record<string, string | null>;
  wifiConnected: boolean;
  /** Live IPv4 address; shown instead of the generic "connected" label. */
  ipAddress: string;
}

export interface SettingsPageProps {
  state: SettingsState;
  onSelect?: (index: number) => void;
  onActivate?: (index: number) => void;
  onAdjust?: (index: number, direction: -1 | 1) => void;
  onLevelPreview?: (key: "brightness" | "volume", value: number) => void;
  onLevelCommit?: (key: "brightness" | "volume", value: number) => void;
  onLevelCancel?: () => void;
}

// Seven rows of 24px + the 19px group heading + 2px padding = 189 of the 198px
// panel. The list scrolls inside that window, so adding a row never changes the
// layout — and the footer counter already says where the selection is, which is
// why there is no scroll arrow.
const VISIBLE_ROWS = 7;
const ROW_H = 24;

type LevelKey = "brightness" | "volume";

// Ten vertical cells per level row: filled cells are lit, the rest stay dark.
// The meter keeps a fixed 78px slot (10 x 6px + 9 x 2px gaps), so the value
// column never shifts between rows.
const CELLS = 10;
const CELL_W = 6;
const CELL_H = 16;
const CELL_GAP = 2;
const METER_W = CELLS * CELL_W + (CELLS - 1) * CELL_GAP;

function LevelMeter(props: { rowKey: LevelKey; value: number | null; onPreview: (value: number) => void; onCommit: (value: number) => void; onCancel: () => void }) {
  let track: NodeMirror | undefined;
  const valueAt = (x: number) => {
    const fraction = Math.max(0, Math.min(1, x / METER_W));
    const floor = props.rowKey === "brightness" ? 5 : 0;
    return Math.max(floor, Math.min(100, Math.round(fraction * 100)));
  };
  createGesture({ region: { node: () => track }, axis: "x", onTap: (contact) => {
    const value = valueAt(contact.x); props.onPreview(value); props.onCommit(value);
  }, onPanStart: (contact) => props.onPreview(valueAt(contact.x)),
  onPanMove: (contact) => props.onPreview(valueAt(contact.x)),
  onPanEnd: (contact) => { const value = valueAt(contact.x); props.onPreview(value); props.onCommit(value); },
  onCancel: () => props.onCancel() });
  const filled = () => Math.ceil(((props.value ?? 0) / 100) * CELLS);
  return (
    <View ref={(node: NodeMirror) => { track = node; }} class="h-[24px] flex-row items-center" style={{ width: METER_W, gap: CELL_GAP }}>
      <Index each={Array.from({ length: CELLS }, (_, i) => i)}>
        {(cell) => (
          <View class="w-[6px] h-[16px]" style={{ bgColor: cell() < filled() ? "#58c8e8" : "#223240" }} />
        )}
      </Index>
    </View>
  );
}

const ON_COLOR = "#4ed49a";
const OFF_COLOR = "#5a6b7a";
const UNKNOWN_COLOR = "#3a4a58";

export function SettingsPage(props: SettingsPageProps) {
  // Resolve at call time: the language signal lives on the parent, and a
  // captured translator would keep the old strings until the page was rebuilt.
  const t = (key: string, vars?: Record<string, string | number>) => translator(props.state.language)(key, vars);
  const value = (key: string) => props.state.values[key] ?? null;
  const rowLabel = (row: SettingRow) => t(`settings.${row.label}`);
  const visibleWindow = () => {
    const sel = Math.max(0, Math.min(SETTINGS_COUNT - 1, props.state.selectedIndex));
    const start = Math.max(0, Math.min(Math.max(0, SETTINGS_COUNT - VISIBLE_ROWS), sel - 2));
    return SETTING_ROWS.slice(start, start + VISIBLE_ROWS).map((row, i) => ({ row, realIndex: start + i }));
  };
  // The heading names the group of the row at the TOP of the window, not the
  // selected row: a window that straddles two groups would otherwise label
  // brightness and volume as "connectivity".
  const windowGroup = () => visibleWindow()[0]?.row.group ?? "display";

  // A toggle the bridge could not read is drawn as a dim, unpressable pill:
  // "unknown" must never look like "off".
  const togglePill = (raw: string | null, onPress?: () => void) => {
    const state = parseToggle(raw ?? undefined);
    const label = state === null ? t("common.unknown") : t(state ? "common.on" : "common.off");
    const color = state === null ? UNKNOWN_COLOR : state ? ON_COLOR : OFF_COLOR;
    return (
      <TouchTarget
        onPress={() => {
          if (state !== null) onPress?.();
        }}
        class="min-w-[46px] h-[18px] px-2 items-center justify-center bg-[#101c26] border border-[#2b3d4b]"
      >
        <Text class="text-xs font-bold" style={{ textColor: color }}>{label}</Text>
      </TouchTarget>
    );
  };

  const enumPill = (text: string) => (
    <View class="min-w-[46px] h-[18px] px-2 items-center justify-center bg-[#101c26] border border-[#2b3d4b]">
      <Text class="text-xs font-mono" style={{ textColor: "#58c8e8" }}>{text}</Text>
    </View>
  );

  const rowValue = (row: SettingRow) => {
    const raw = value(row.key);
    if (row.kind === "level") {
      const level = raw === null ? null : Number(raw);
      const shown = level !== null && Number.isFinite(level) ? `${Math.round(level)}%` : t("common.unknown");
      return (
        <View class="flex-row items-center gap-2">
          <LevelMeter
            rowKey={row.key as LevelKey}
            value={level !== null && Number.isFinite(level) ? level : null}
            onPreview={(v) => props.onLevelPreview?.(row.key as LevelKey, v)}
            onCommit={(v) => props.onLevelCommit?.(row.key as LevelKey, v)}
            onCancel={() => props.onLevelCancel?.()}
          />
          <View class="h-[24px] flex-row items-center justify-end" style={{ width: 38 }}>
            <Text class="text-xs font-mono" style={{ textColor: level === null ? UNKNOWN_COLOR : "#58c8e8" }}>{shown}</Text>
          </View>
        </View>
      );
    }
    if (row.kind === "toggle") {
      if (row.key === "wifi") {
        return (
          <View class="flex-row items-center gap-1">
            <Text class="text-xs font-mono" style={{ textColor: "#5a6b7a" }}>
              {props.state.wifiConnected
                ? props.state.ipAddress && props.state.ipAddress !== "--"
                  ? props.state.ipAddress
                  : t("settings.connected")
                : t("settings.disconnected")}
            </Text>
            {togglePill(raw, () => props.onActivate?.(props.state.selectedIndex))}
          </View>
        );
      }
      return togglePill(raw, () => props.onActivate?.(props.state.selectedIndex));
    }
    if (row.kind === "enum") {
      if (row.key === "language") return enumPill(props.state.language.toUpperCase());
      if (row.key === "autoPoweroff") {
        const index = AUTO_POWEROFF_OPTIONS.findIndex((option) => option.value === raw);
        return enumPill(index >= 0 ? AUTO_POWEROFF_OPTIONS[index].label : (raw ?? t("common.unknown")));
      }
      const index = TIMEOUT_OPTIONS.findIndex((option) => option.value === raw);
      return enumPill(index >= 0 ? TIMEOUT_OPTIONS[index].label : (raw ?? t("common.unknown")));
    }
    if (row.kind === "text") {
      return <Text class="text-xs font-mono" style={{ textColor: raw ? "#d8e8ff" : UNKNOWN_COLOR }}>{raw || t("common.unknown")}</Text>;
    }
    return <Text class="text-xs font-bold" style={{ textColor: "#edc44f" }}>{t("settings.pressA")}</Text>;
  };

  return (
    <View class="w-[360px] h-[198px] px-2 py-1 flex-col">
      {/* Group heading only: the footer already carries the row counter, so a
          second one here just competed with it. */}
      <View class="w-[344px] h-[19px] flex-row items-center">
        <Text class="text-xs font-bold tracking-wide" style={{ textColor: "#58c8e8" }}>{t(`settings.group.${windowGroup()}`)}</Text>
      </View>

      <View class="flex-col w-full">
        <Index each={visibleWindow()}>
          {(entry) => {
            const selected = () => props.state.selectedIndex === entry().realIndex;
            const first = () => entry().realIndex === 0 || SETTING_ROWS[entry().realIndex - 1].group !== entry().row.group;
            return (
              <TouchTarget
                onPress={() => {
                  props.onSelect?.(entry().realIndex);
                  props.onActivate?.(entry().realIndex);
                }}
                class={selected()
                  ? "w-[344px] h-[24px] pl-2 pr-2 flex-row items-center justify-between bg-[#173348]"
                  : "w-[344px] h-[24px] pl-2 pr-2 flex-row items-center justify-between bg-[#111e28]"}
              >
                <View class="flex-row items-center gap-2">
                  <View class="w-[2px] h-[13px]" style={{ bgColor: selected() ? "#58c8e8" : first() ? "#2b3d4b" : "#111e28" }} />
                  <Text class={selected() ? "text-xs font-bold text-white" : "text-xs font-bold text-slate-300"}>
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
