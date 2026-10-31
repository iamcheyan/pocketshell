import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { translator } from "../i18n";
import { TouchTarget } from "../touch-target";
import type { BtDevice } from "../bluetooth-model";
import { ScanTrack } from "./scan-track";

export type BtPhase = "scanning" | "list" | "connecting";

export interface BtPageProps {
  devices: BtDevice[];
  index: number;
  status: string;
  phase: BtPhase;
  powered: boolean | null;
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
const BARS: ReadonlyArray<readonly [string, string, string]> = [
  ["#233441", "#233441", "#233441"],
  ["#4ed49a", "#233441", "#233441"],
  ["#4ed49a", "#4ed49a", "#233441"],
  ["#4ed49a", "#4ed49a", "#4ed49a"],
];

const levelFor = (rssi: number): number => {
  if (!Number.isFinite(rssi) || rssi <= -127) return 0;
  if (rssi >= -60) return 3;
  if (rssi >= -75) return 2;
  return 1;
};

function SignalBars(props: { rssi: number; dim: boolean }) {
  return (
    <View class="w-[16px] h-[12px] flex-row items-end gap-[2px]">
      <Index each={[0, 1, 2]}>
        {(bar) => (
          <View
            class="w-[3px]"
            style={{
              height: 3 + bar() * 3,
              bgColor: props.dim ? "#2c3d4a" : BARS[levelFor(props.rssi)][bar()],
            }}
          />
        )}
      </Index>
    </View>
  );
}

export function BtPage(props: BtPageProps) {
  const t = () => translator(props.language);
  const windowRows = () => {
    const maxStart = Math.max(0, props.devices.length - VISIBLE);
    const start = Math.max(0, Math.min(maxStart, props.index - 2));
    return props.devices.slice(start, start + VISIBLE).map((row, i) => ({ ...row, realIndex: start + i }));
  };
  const selected = () => props.devices[props.index];
  const empty = () => props.devices.length === 0;

  return (
    <View class="w-[360px] h-[198px] flex-col px-2 py-1">
      <View class="w-[344px] h-[22px] flex-row items-center justify-between">
        <View class="flex-row items-center gap-2">
          <Text class="text-sm font-bold text-white">{"\uf293"}</Text>
          <Text class="text-sm font-bold text-white">{t()("bt.title")}</Text>
        </View>
        <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>
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
          <View class="w-[344px] h-[70px] flex-col items-center justify-center gap-2">
            <ScanTrack active />
            <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>
              {props.phase === "scanning" ? t()("bt.scanning") : t()("bt.connecting")}
            </Text>
          </View>
        ) : props.powered === false ? (
          <View class="w-[344px] h-[70px] items-center justify-center">
            <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>{t()("bt.off")}</Text>
          </View>
        ) : empty() ? (
          <View class="w-[344px] h-[70px] items-center justify-center">
            <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>{t()("bt.empty")}</Text>
          </View>
        ) : (
          <Index each={windowRows()}>
            {(row) => (
              <TouchTarget
                onPress={() => {
                  props.onSelect(row().realIndex);
                  props.onActivate(row().realIndex);
                }}
                class={
                  row().realIndex === props.index
                    ? "w-[344px] h-[19px] flex-row items-center justify-between px-2 bg-[#164e63]"
                    : "w-[344px] h-[19px] flex-row items-center justify-between px-2"
                }
              >
                <View class="flex-row items-center gap-2">
                  <View
                    class="w-[8px] h-[8px]"
                    style={{
                      bgColor: row().paired
                        ? "#4ed49a"
                        : row().realIndex === props.index ? "#58c8e8" : "#31465a",
                    }}
                  />
                  <Text
                    class="text-xs"
                    style={{ textColor: row().realIndex === props.index ? "#EAF7FF" : "#D8E8FF" }}
                  >
                    {row().name.length > 22 ? `${row().name.slice(0, 21)}…` : row().name}
                  </Text>
                </View>
                <View class="flex-row items-center gap-2">
                  {row().paired ? (
                    <Text class="text-xs font-mono" style={{ textColor: "#4ed49a" }}>{t()("bt.paired")}</Text>
                  ) : null}
                  <SignalBars rssi={row().rssi} dim={row().realIndex !== props.index} />
                </View>
              </TouchTarget>
            )}
          </Index>
        )}
      </View>

      <View class="w-[344px] h-[18px] flex-row items-center justify-between">
        <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>{props.status}</Text>
        <View class="flex-row items-center gap-2">
          {props.phase === "list" && selected()?.paired ? (
            <TouchTarget onPress={() => selected() && props.onDisconnect(selected().address)} class="h-[18px] px-2 items-center justify-center">
              <Text class="text-xs font-mono" style={{ textColor: "#FFB400" }}>{t()("bt.disconnect")}</Text>
            </TouchTarget>
          ) : null}
          {props.phase === "list" && selected()?.paired ? (
            <TouchTarget onPress={() => selected() && props.onForget(selected().address)} class="h-[18px] px-2 items-center justify-center">
              <Text class="text-xs font-mono" style={{ textColor: "#FFB400" }}>{t()("bt.forget")}</Text>
            </TouchTarget>
          ) : null}
          <TouchTarget onPress={props.onRescan} class="h-[18px] px-2 items-center justify-center">
            <Text class="text-xs font-mono" style={{ textColor: "#3ECFFF" }}>{t()("bt.rescan")}</Text>
          </TouchTarget>
          <TouchTarget onPress={props.onBack} class="h-[18px] px-2 items-center justify-center">
            <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>{t()("bt.back")}</Text>
          </TouchTarget>
        </View>
      </View>
    </View>
  );
}
