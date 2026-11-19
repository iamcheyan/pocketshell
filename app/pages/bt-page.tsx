import { PixelStatus } from "../pixel-status";
import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { translator } from "../i18n";
import { TouchTarget } from "../touch-target";
import type { BtDevice } from "../bluetooth-model";
import { ScanTrack } from "./scan-track";
import { THEME_PALETTES, type ThemeColorKey } from "../theme-model";

export type BtPhase = "scanning" | "list" | "connecting";

export interface BtPageProps {
  devices: BtDevice[];
  index: number;
  status: string;
  phase: BtPhase;
  powered: boolean | null;
  themeColor: ThemeColorKey;
  language: string;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  onRescan: () => void;
  onForget: (address: string) => void;
  onDisconnect: (address: string) => void;
  onBack: () => void;
}

const VISIBLE = 6;

// Paired devices sit above a rule, discovered ones below, so the list says at a
// glance which rows are already known to the handheld.

const levelFor = (rssi: number): number => {
  if (!Number.isFinite(rssi) || rssi <= -127) return 0;
  if (rssi >= -60) return 3;
  if (rssi >= -75) return 2;
  return 1;
};

function SignalBars(props: { rssi: number; dim: boolean; accent: string }) {
  return (
    <View class="w-[16px] h-[12px] flex-row items-end gap-[2px]">
      <Index each={[0, 1, 2]}>
        {(bar) => (
          <View
            class="w-[3px]"
            style={{
              height: 4 + bar() * 3,
              bgColor: props.dim ? "#2c3d4a" : bar() < levelFor(props.rssi) ? props.accent : "#233441",
            }}
          />
        )}
      </Index>
    </View>
  );
}

export function BtPage(props: BtPageProps) {
  const theme = () => THEME_PALETTES[props.themeColor] || THEME_PALETTES.purple;
  const t = () => translator(props.language);
  const windowRows = () => {
    const maxStart = Math.max(0, props.devices.length - VISIBLE);
    const start = Math.max(0, Math.min(maxStart, props.index - 2));
    return props.devices.slice(start, start + VISIBLE).map((row, i) => ({ ...row, realIndex: start + i }));
  };
  const selected = () => props.devices[props.index];
  const empty = () => props.devices.length === 0;

  return (
    <View class="w-[360px] h-[174px] flex-col px-[8px] py-[4px]">
      <View class="w-[344px] h-[22px] flex-row items-center justify-between">
        <View class="flex-row items-center gap-[8px]">
          <PixelStatus kind="bluetooth" color={theme().primary} />
          <Text class="text-xs font-bold text-white">{t()("bt.title")}</Text>
        </View>
        <Text class="text-xs" style={{ textColor: "#9893ad" }}>
          {props.phase === "scanning"
            ? t()("bt.scanning")
            : props.phase === "connecting"
              ? t()("bt.connecting")
              : props.powered === false
                ? t()("common.off")
                : t()("bt.count", { n: props.devices.length })}
        </Text>
      </View>

      <View class="w-[344px] flex-1 flex-col">
        {props.phase === "scanning" || props.phase === "connecting" ? (
          <View class="w-[344px] h-[70px] flex-col items-center justify-center gap-[8px]">
            <ScanTrack active color={theme().primary} />
            <Text class="text-xs" style={{ textColor: "#9893ad" }}>
              {props.phase === "scanning" ? t()("bt.scanning") : t()("bt.connecting")}
            </Text>
          </View>
        ) : props.powered === false ? (
          <View class="w-[344px] h-[70px] items-center justify-center">
            <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("bt.off")}</Text>
          </View>
        ) : empty() ? (
          <View class="w-[344px] h-[70px] items-center justify-center">
            <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("bt.empty")}</Text>
          </View>
        ) : (
          <Index each={windowRows()}>
            {(row) => (
              <TouchTarget
                onPress={() => {
                  props.onSelect(row().realIndex);
                  props.onActivate(row().realIndex);
                }}
                class="w-[344px] h-[20px] flex-row items-center justify-between px-[8px]"
                style={{ bgColor: row().realIndex === props.index ? theme().activeSurface : "#00000000" }}
              >
                <View class="flex-row items-center gap-[8px]">
                  <View
                    class="w-[8px] h-[8px]"
                    style={{
                      bgColor: row().paired
                        ? theme().primary
                        : row().realIndex === props.index ? theme().primary : "#31465a",
                    }}
                  />
                  <Text
                    class="text-xs"
                    style={{ textColor: row().realIndex === props.index ? "#EAF7FF" : "#f5eddb" }}
                  >
                    {row().name.length > 22 ? `${row().name.slice(0, 21)}…` : row().name}
                  </Text>
                </View>
                <View class="flex-row items-center gap-[8px]">
                  {row().paired ? (
                    <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("bt.paired")}</Text>
                  ) : null}
                  <SignalBars rssi={row().rssi} dim={row().realIndex !== props.index} accent={theme().primary} />
                </View>
              </TouchTarget>
            )}
          </Index>
        )}
      </View>

      <View class="w-[344px] h-[18px] flex-row items-center justify-between">
        <Text class="text-xs" style={{ textColor: "#9893ad" }}>{props.status}</Text>
        <View class="flex-row items-center gap-[8px]">
          {props.phase === "list" && selected()?.paired ? (
            <TouchTarget onPress={() => selected() && props.onDisconnect(selected().address)} class="h-[18px] px-[8px] items-center justify-center">
              <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("bt.disconnect")}</Text>
            </TouchTarget>
          ) : null}
          {props.phase === "list" && selected()?.paired ? (
            <TouchTarget onPress={() => selected() && props.onForget(selected().address)} class="h-[18px] px-[8px] items-center justify-center">
              <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("bt.forget")}</Text>
            </TouchTarget>
          ) : null}
          <TouchTarget onPress={props.onRescan} class="h-[18px] px-[8px] items-center justify-center">
            <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("bt.rescan")}</Text>
          </TouchTarget>
          <TouchTarget onPress={props.onBack} class="h-[18px] px-[8px] items-center justify-center">
            <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("bt.back")}</Text>
          </TouchTarget>
        </View>
      </View>
    </View>
  );
}
