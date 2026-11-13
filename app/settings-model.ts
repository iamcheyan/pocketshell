// The settings the launcher exposes. Every row is one bridge key; the guest
// never invents a value — an unanswered key renders as "--" and its row refuses
// to toggle, so a capability the runtime lacks cannot look switched on.
export type SettingKind = "level" | "toggle" | "enum" | "text" | "action";

export interface SettingRow {
  /** Bridge key: `SETTING\t<key>` reads, `SETTING\t<key>\t<value>` writes. */
  key: string;
  /** i18n key under `settings.`. */
  label: string;
  kind: SettingKind;
  /** Section header shown above the first row of a group. */
  group: "display" | "connectivity" | "system";
  /** enum rows: the values cycled with left/right. */
  values?: readonly string[];
  /** action rows: the bridge value that triggers them. */
  action?: string;
}

// Ordered exactly as the panel lists them. Levels come first because they are
// the two things a handheld user changes most.
export const SETTING_ROWS: readonly SettingRow[] = [
  { key: "brightness", label: "brightness", kind: "level", group: "display" },
  { key: "volume", label: "volume", kind: "level", group: "display" },
  { key: "fontSize", label: "fontSize", kind: "enum", group: "display", values: ["normal", "large", "huge"] },
  { key: "themeColor", label: "themeColor", kind: "enum", group: "display", values: ["purple", "blue", "green", "pink", "amber"] },
  { key: "showClock", label: "showClock", kind: "toggle", group: "display" },
  { key: "animations", label: "animations", kind: "toggle", group: "display" },
  { key: "bluetooth", label: "bluetooth", kind: "toggle", group: "connectivity" },
  { key: "wifi", label: "wifi", kind: "toggle", group: "connectivity" },
  { key: "ssh", label: "ssh", kind: "toggle", group: "connectivity" },
  { key: "adb", label: "adb", kind: "toggle", group: "connectivity" },
  { key: "mtp", label: "mtp", kind: "toggle", group: "connectivity" },
  { key: "mdns", label: "mdns", kind: "toggle", group: "connectivity" },
  { key: "btAudio", label: "btAudio", kind: "toggle", group: "connectivity" },
  { key: "headphoneFix", label: "headphoneFix", kind: "toggle", group: "system" },
  { key: "language", label: "language", kind: "enum", group: "system", values: ["en", "zh", "ja"] },
  { key: "timeout", label: "timeout", kind: "enum", group: "system" },
  { key: "autoPoweroff", label: "autoPoweroff", kind: "enum", group: "system" },
  { key: "hostname", label: "hostname", kind: "text", group: "system" },
  { key: "ntp", label: "ntp", kind: "toggle", group: "system" },
  // Not a setting: the row opens the power dialog the long power press opens.
  { key: "power", label: "power", kind: "action", group: "system" },

];

export const SETTINGS_COUNT = SETTING_ROWS.length;

export const TIMEOUT_OPTIONS = [
  { label: "10s", value: "10s" },
  { label: "30s", value: "30s" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "Never", value: "never" },
];

export const AUTO_POWEROFF_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "10m", value: "10m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "2h", value: "2h" },
];

/** The one shared parser for toggle values across every bridge call. */
export function parseToggle(value: string | undefined): boolean | null {
  const text = (value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "enabled", "yes", "active"].includes(text)) return true;
  if (["0", "false", "off", "disabled", "no", "inactive"].includes(text)) return false;
  return null;
}
