import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import { TextField } from "@pocketjs/framework/osk";

export interface WifiRow {
  ssid: string;
  signal: string;
  sec: string;
}

export interface WifiPageProps {
  rows: WifiRow[];
  index: number;
  status: string;
  pskFor: string;
  psk: string;
  connecting: boolean;
  onInput: (value: string) => void;
  onSubmit: () => void;
}

// Wi-Fi picker. BaseOS ships wpa_supplicant but no UI ever started it, so the
// switch alone did nothing; scanning and the passphrase prompt live here and
// talk to the launcher bridge (`WIFI scan` / `WIFI connect`).
export function WifiPage(props: WifiPageProps) {
  const windowRows = () => {
    const maxStart = Math.max(0, props.rows.length - 6);
    const start = Math.max(0, Math.min(maxStart, props.index - 2));
    return props.rows.slice(start, start + 6).map((row, i) => ({ ...row, realIndex: start + i }));
  };

  return (
    <View class="w-[360px] h-[198px] flex-col px-2 py-1">
      <View class="w-[344px] h-[22px] flex-row items-center justify-between">
        <Text class="text-sm font-bold text-white">Wi-Fi 网络</Text>
        <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>
          {props.connecting ? "连接中…" : `${props.rows.length} 个`}
        </Text>
      </View>

      {props.pskFor ? (
        <View class="w-[344px] flex-col gap-1">
          <Text class="text-xs" style={{ textColor: "#D8E8FF" }}>{`输入 ${props.pskFor} 的密码`}</Text>
          <View class="flex-row items-center">
            <TextField
              value={() => props.psk}
              onInput={props.onInput}
              onSubmit={props.onSubmit}
              placeholder="Wi-Fi password"
            />
          </View>
          <Text class="text-xs" style={{ textColor: "#7893A8" }}>输入完成后确认连接 · B 取消</Text>
        </View>
      ) : (
        <View class="w-[344px] flex-1 flex-col gap-1">
          <Index each={windowRows()}>
            {(row) => (
              <View
                class={
                  row().realIndex === props.index
                    ? "w-[344px] h-[22px] flex-row items-center justify-between px-2 rounded bg-[#164e63] border border-[#38bdf8]"
                    : "w-[344px] h-[22px] flex-row items-center justify-between px-2"
                }
              >
                <Text class="text-xs" style={{ textColor: row().realIndex === props.index ? "#EAF7FF" : "#D8E8FF" }}>
                  {row().ssid}
                </Text>
                <Text class="text-xs font-mono" style={{ textColor: "#7893A8" }}>
                  {`${row().sec} ${row().signal}dBm`}
                </Text>
              </View>
            )}
          </Index>
          {props.rows.length === 0 ? (
            <Text class="text-xs" style={{ textColor: "#7893A8" }}>正在扫描…</Text>
          ) : null}
        </View>
      )}

      <View class="w-[344px] h-[18px] flex-row items-center justify-between">
        <Text class="text-xs" style={{ textColor: "#7893A8" }}>{props.status}</Text>
        <Text class="text-xs" style={{ textColor: "#3ECFFF" }}>A 连接 · B 返回</Text>
      </View>
    </View>
  );
}
