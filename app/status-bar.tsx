import { View, Text } from "@pocketjs/framework/solid/components";

export interface StatusBarProps {
  currentScreen: number;
  wifiConnected: boolean;
  ipAddress: string;
  bluetoothOn: boolean;
  batteryLevel: number;
  sshEnabled: boolean;
  adbEnabled: boolean;
  mtpEnabled: boolean;
  pageTitle?: string;
  pageIndex?: number;
  pageCount?: number;
  category?: string;
}
// Three panels now: everything launchable lives in APPS. The HOME/MEDIA/GAMES
// split only made sense while each screen had its own carousel; with one list
// and a category badge the extra tabs had nothing left to say. The WS n/5
// counter was decoration and is gone with them.
const TABS = ["APPS", "SETTINGS", "SYSTEM"];
const tabIndex = (screen: number) => (screen === 0 ? 0 : screen === 3 ? 1 : 2);

export function StatusBar(props: StatusBarProps) {
  const batteryKnown = () => props.batteryLevel >= 0;
  const batteryIcon = () => {
    const level = props.batteryLevel;
    if (!batteryKnown()) return "\uf244";
    if (level >= 90) return "\uf240";
    if (level >= 65) return "\uf241";
    if (level >= 40) return "\uf242";
    if (level >= 15) return "\uf243";
    return "\uf244";
  };

  return (
    <View class="w-[360px] h-[22px] flex-col justify-between" style={{ bgColor: "#06111B" }}>
      <View class="w-[360px] h-[21px] flex-row items-center justify-between px-2">
        <View class="flex-row items-center gap-2">
          {TABS.map((label, i) => (
            <Text
              class={i === tabIndex(props.currentScreen) ? "text-xs font-bold tracking-wide" : "text-xs"}
              style={{ textColor: i === tabIndex(props.currentScreen) ? "#00FF99" : "#5A7183" }}
            >
              {label}
            </Text>
          ))}
          {props.pageTitle ? <Text class="text-xs font-bold" style={{ textColor: "#3ECFFF" }}>{props.pageTitle}</Text> : null}
          {props.pageCount ? <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>{props.pageIndex! + 1}/{props.pageCount}</Text> : null}
        </View>

        <View class="flex-row items-center gap-1 px-1">
          {props.category ? (
            <Text class="text-xs font-bold" style={{ textColor: "#3ECFFF" }}>{props.category}</Text>
          ) : null}
          <Text class="text-xs font-mono" style={{ textColor: props.wifiConnected ? "#00FF99" : "#41586B" }}>
            {"\uf1eb"}
          </Text>
          <Text class="text-xs font-mono" style={{ textColor: props.bluetoothOn ? "#3ECFFF" : "#41586B" }}>
            {"\uf293"}
          </Text>
          <Text class="text-xs font-mono" style={{ textColor: props.sshEnabled ? "#00FF99" : "#7893A8" }}>{"\uf120"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.adbEnabled ? "#3ECFFF" : "#7893A8" }}>{"\uf287"}</Text>
          <Text class="text-xs font-mono" style={{ textColor: props.mtpEnabled ? "#3ECFFF" : "#7893A8" }}>{"\uf07b"}</Text>
          <Text
            class="text-xs font-mono"
            style={{ textColor: !batteryKnown() ? "#41586B" : props.batteryLevel > 20 ? "#00FF99" : "#FFB400" }}
          >
            {batteryIcon()}
          </Text>
        </View>
      </View>
      <View class="w-[360px] h-[1px]" style={{ bgColor: "#1B3345" }} />
    </View>
  );
}
