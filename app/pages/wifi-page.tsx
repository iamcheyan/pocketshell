import { PixelStatus } from "../pixel-status";
import { createSignal, Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Osk, type OskController, type OskThemeName } from "@pocketjs/framework/osk";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { translator } from "../i18n";
import { TouchTarget } from "../touch-target";
import type { WifiNetwork } from "../wifi-model";
import { THEME_PALETTES, type ThemeColorKey } from "../theme-model";
import { isWideScreen } from "../card-carousel";

export type WifiPhase = "scanning" | "list" | "psk" | "connecting";

export interface WifiPageProps {
  rows: WifiNetwork[];
  index: number;
  status: string;
  pskFor: string;
  psk: string;
  phase: WifiPhase;
  language: string;
  themeColor: ThemeColorKey;
  /** The passphrase keyboard; the caller owns it so its text outlives this view. */
  oskTheme: OskThemeName;
  osk: OskController;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  onRescan: () => void;
  onForget: (ssid: string) => void;
  onDisconnect: () => void;
  onBack: () => void;
}

const VISIBLE = 7;

// Signal strength in three buckets, drawn as bars rather than a number: -60 dBm
// and better is strong, -75 and better medium, anything lower weak.
const barsFor = (signal: number): number => {
  if (!Number.isFinite(signal)) return 1;
  if (signal >= -60) return 3;
  if (signal >= -75) return 2;
  return 1;
};


function SignalBars(props: { signal: number; dim: boolean; accent: string }) {
  const level = () => barsFor(props.signal);
  return (
    <View class="w-[16px] h-[12px] flex-row items-end gap-[2px]">
      <Index each={[0, 1, 2]}>
        {(bar) => (
          <View
            class="w-[3px]"
            style={{
              height: 4 + bar() * 3,
              bgColor: props.dim ? "#2c3d4a" : bar() < level() ? props.accent : "#233441",
            }}
          />
        )}
      </Index>
    </View>
  );
}

// Sweep animation for the scan state: one cell travels across a 12-cell track,
// driven by the frame callback (no timers in the guest).
const TRACK = 12;

export function WifiPage(props: WifiPageProps) {
  const theme = () => THEME_PALETTES[props.themeColor] || THEME_PALETTES.purple;
  const t = () => translator(props.language);
  const [frame, setFrame] = createSignal(0);
  const [spin, setSpin] = createSignal(0);

  // The guest has no setTimeout; both animations advance on the 60 Hz frame.
  onFrame(() => {
    if (props.phase !== "scanning" && props.phase !== "connecting") return;
    setFrame((value) => (value + 1) % (TRACK * 4));
    setSpin((value) => (value + 1) % 4);
  });

  const TAIL = 4;
  const lit = (cell: number) => {
    const head = props.phase === "scanning" ? Math.floor(frame() / 4) : spin() * 3;
    return cell <= head && cell > head - TAIL;
  };

  const windowRows = () => {
    const maxStart = Math.max(0, props.rows.length - VISIBLE);
    const start = Math.max(0, Math.min(maxStart, props.index - 2));
    return props.rows.slice(start, start + VISIBLE).map((row, i) => ({ ...row, realIndex: start + i }));
  };

  const selected = () => props.rows[props.index];

  return (
    <View class={isWideScreen() ? "w-full flex-1 relative flex-col items-center" : "w-[360px] h-[174px] relative flex-col"}>
      {/* The keyboard is positioned against this root, so the side margin lives
          on the content column: padding on the root would clip the panel by
          exactly that padding. */}
      <View class={isWideScreen() ? "w-full max-w-[560px] flex-1 flex-col px-[8px] py-[4px]" : "w-[360px] flex-1 flex-col px-[8px] py-[4px]"}>
        <View class={isWideScreen() ? "w-full h-[22px] flex-row items-center justify-between" : "w-[344px] h-[22px] flex-row items-center justify-between"}>
          <View class="flex-row items-center gap-[8px]">
            <PixelStatus kind="wifi" color={theme().primary} />
            <Text class="text-xs font-bold text-white">{t()("wifi.title")}</Text>
          </View>
          <Text class="text-xs" style={{ textColor: "#9893ad" }}>
            {props.phase === "scanning"
              ? "…"
              : props.phase === "connecting"
                ? t()("wifi.connecting")
                : t()("wifi.count", { n: props.rows.length })}
          </Text>
        </View>

        {props.phase === "psk" ? (
          <View class={isWideScreen() ? "w-full flex-1 flex-col gap-[4px] pt-[4px]" : "w-[344px] flex-1 flex-col gap-[4px] pt-[4px]"}>
            <Text class="text-xs" style={{ textColor: "#f5eddb" }}>
              {t()("wifi.password", { ssid: props.pskFor })}
            </Text>
            {/* A password must not sit legible on the panel, so the field draws
                dots; the keyboard behind it still edits the real text. */}
            <TouchTarget onPress={() => props.osk.open()} class={isWideScreen() ? "w-full h-[22px] px-[8px] items-center bg-[#211d33]" : "w-[344px] h-[22px] px-[8px] items-center bg-[#211d33]"}>
              <Text class="text-xs" style={{ textColor: "#EAF7FF" }}>
                {props.psk ? "•".repeat(props.psk.length) : t()("wifi.passwordEmpty")}
              </Text>
            </TouchTarget>
            {/* The keyboard covers the lower half of this page, so the result of
                the last attempt replaces the hint line instead of sitting under
                it: a hidden "wrong password" would look like nothing happened. */}
            <Text class="text-xs" style={{ textColor: props.status ? theme().primary : "#9893ad" }}>
              {props.status || t()("wifi.passwordHint")}
            </Text>
          </View>
        ) : (
          <View class={isWideScreen() ? "w-full flex-1 flex-col" : "w-[344px] flex-1 flex-col"}>
            {props.phase === "scanning" || props.phase === "connecting" ? (
              <View class={isWideScreen() ? "w-full h-[70px] flex-col items-center justify-center gap-[8px]" : "w-[344px] h-[70px] flex-col items-center justify-center gap-[8px]"}>
                <View class="w-[96px] h-[6px] flex-row gap-[2px]">
                  <Index each={Array.from({ length: TRACK }, (_, i) => i)}>
                    {(cell) => (
                      <View
                        class="w-[6px] h-[6px]"
                        style={{ bgColor: lit(cell()) ? theme().primary : "#233240" }}
                      />
                    )}
                  </Index>
                </View>
                <Text class="text-xs" style={{ textColor: "#9893ad" }}>
                  {props.phase === "scanning" ? t()("wifi.scanning") : t()("wifi.connecting")}
                </Text>
              </View>
            ) : props.rows.length === 0 ? (
              <View class={isWideScreen() ? "w-full h-[70px] items-center justify-center" : "w-[344px] h-[70px] items-center justify-center"}>
                <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("wifi.empty")}</Text>
              </View>
            ) : (
              <Index each={windowRows()}>
                {(row) => (
                  <TouchTarget
                    onPress={() => {
                      props.onSelect(row().realIndex);
                      props.onActivate(row().realIndex);
                    }}
                    class={isWideScreen() ? "w-full h-[22px] flex-row items-center justify-between px-[8px]" : "w-[344px] h-[20px] flex-row items-center justify-between px-[8px]"}
                    style={{ bgColor: row().realIndex === props.index ? theme().activeSurface : "#00000000" }}
                  >
                    <View class="flex-row items-center gap-[8px]">
                      <View
                        class="w-[8px] h-[8px]"
                        style={{
                          bgColor: row().active
                            ? theme().primary
                            : row().realIndex === props.index ? theme().primary : "#31465a",
                        }}
                      />
                      <Text
                        class="text-xs"
                        style={{ textColor: row().realIndex === props.index ? "#EAF7FF" : "#f5eddb" }}
                      >
                        {row().ssid}
                      </Text>
                      {row().security === "open" ? null : (
                        <PixelStatus kind="lock" color="#9893ad" />
                      )}
                    </View>
                    <View class="flex-row items-center gap-[8px]">
                      {row().active ? (
                        <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("wifi.current")}</Text>
                      ) : row().saved ? (
                        <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("wifi.savedTag")}</Text>
                      ) : null}
                      <SignalBars signal={row().signal} dim={row().realIndex !== props.index} accent={theme().primary} />
                    </View>
                  </TouchTarget>
                )}
              </Index>
            )}
          </View>
        )}

        <View class={isWideScreen() ? "w-full h-[20px] flex-row items-center justify-between" : "w-[344px] h-[18px] flex-row items-center justify-between"}>
          <Text class="text-xs" style={{ textColor: "#9893ad" }}>{props.status}</Text>
          <View class="flex-row items-center gap-[8px]">
            {props.phase === "list" && selected()?.active ? (
              <TouchTarget onPress={props.onDisconnect} class="h-[18px] px-[8px] items-center justify-center">
                <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("wifi.disconnect")}</Text>
              </TouchTarget>
            ) : props.phase === "list" && selected()?.saved ? (
              <TouchTarget onPress={() => selected() && props.onForget(selected().ssid)} class="h-[18px] px-[8px] items-center justify-center">
                <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("wifi.forget")}</Text>
              </TouchTarget>
            ) : null}
            <TouchTarget onPress={props.onRescan} class="h-[18px] px-[8px] items-center justify-center">
              <Text class="text-xs" style={{ textColor: theme().primary }}>{t()("wifi.rescan")}</Text>
            </TouchTarget>
            <TouchTarget onPress={props.onBack} class="h-[18px] px-[8px] items-center justify-center">
              <Text class="text-xs" style={{ textColor: "#9893ad" }}>{t()("wifi.back")}</Text>
            </TouchTarget>
          </View>
        </View>
      </View>

      {/* Docked over the page's lower half while open; the OSK blocks the panel
          beneath it itself, so nothing here needs a scrim. */}
      <View class={isWideScreen() ? "absolute left-0 bottom-0 w-full items-center" : "absolute left-0 bottom-0 w-[360px]"}>
        <Osk osk={props.osk} theme={props.oskTheme} keyHeight={22} />
      </View>
    </View>
  );
}
