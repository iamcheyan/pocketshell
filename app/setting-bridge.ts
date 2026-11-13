// How each settings row talks to the host.
//
// Two transports, one shape: `SETTING\t<key>[\t<value>]` is the unified protocol
// (implemented by the desktop bridge and by future device runtimes), and the
// per-key `legacy` entries are the commands today's device runtime already
// answers — STATE / LEVEL / CONTROL / SERVICE / SLEEP / LANGUAGE. The reader
// tries the unified form first and falls back per key, so one UI code path works
// on a machine that only speaks the older dialect.
//
// A key with no legacy fallback and no SETTING answer reads as null: the row
// renders "--" and refuses to toggle rather than inventing a value.
import type { LauncherHost } from "./host";

export interface SettingBridge {
  /** Legacy read command, or null when only SETTING can answer. */
  read?: string;
  /** Legacy write command builder. */
  write?: (value: string) => string;
  /** Normalise a legacy answer into the value vocabulary the row expects. */
  parse?: (raw: string) => string | null;
}

const numericPercent = (raw: string): string | null => {
  const value = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? String(Math.round(parsed)) : null;
};

// "ssh.enabled=1" and "on"/"1"/"true" all mean the same thing to a toggle row.
const booleanWord = (raw: string): string | null => {
  const text = raw.trim().toLowerCase();
  const tail = text.includes("=") ? text.slice(text.lastIndexOf("=") + 1) : text;
  if (["1", "true", "on", "enabled", "yes", "active"].includes(tail)) return "on";
  if (["0", "false", "off", "disabled", "no", "inactive"].includes(tail)) return "off";
  return null;
};

// `rocknix-services status` prints "key=1"; STATE prints the bare word.
export const SETTING_BRIDGE: Record<string, SettingBridge> = {
  brightness: {
    read: "LEVEL\tbrightness",
    write: (value) => `CONTROL\tbrightness\t${value}`,
    parse: numericPercent,
  },
  volume: {
    read: "LEVEL\tvolume",
    write: (value) => `CONTROL\tvolume\t${value}`,
    parse: numericPercent,
  },
  wifi: {
    read: "STATE\twifi",
    write: (value) => `CONTROL\twifi\t${value}`,
    // The device bridge answers "on:<ssid>" once associated (not the bare "on"
    // the other toggles use), so the prefix decides; anything else is "--".
    parse: (raw) => booleanWord(raw.split(":")[0]),
  },
  bluetooth: {
    read: "STATE\tbluetooth",
    write: (value) => `CONTROL\tbluetooth\t${value}`,
    parse: booleanWord,
  },
  ssh: {
    read: "STATE\tssh",
    write: (value) => `SERVICE\tssh.enabled\t${value}`,
    parse: booleanWord,
  },
  adb: {
    read: "STATE\tadbusb",
    write: (value) => `SERVICE\tadbusb.enabled\t${value}`,
    parse: booleanWord,
  },
  // USB gadget mode: the device reports "file_transfer" when storage is shared.
  mtp: {
    read: "STATUS\tusb",
    parse: (raw) => {
      const text = raw.trim().toLowerCase();
      if (text === "file_transfer") return "on";
      if (text === "unknown" || text === "") return null;
      return "off";
    },
  },
  // mDNS is avahi on the device.
  mdns: {
    read: "STATE\tavahi",
    write: (value) => `SERVICE\tavahi.enabled\t${value}`,
    parse: booleanWord,
  },
  language: {
    read: "LANGUAGE",
    write: (value) => `LANGUAGE\t${value}`,
    parse: (raw) => {
      const text = raw.trim().toLowerCase();
      return ["en", "zh", "ja"].includes(text) ? text : null;
    },
  },
  timeout: {
    read: "STATE\ttimeout",
    write: (value) => `SLEEP\t${value}`,
    parse: (raw) => raw.trim() || null,
  },
  autoPoweroff: {
    read: "STATE\tpower_timeout",
    write: (value) => `POWER\t${value}`,
    parse: (raw) => raw.trim() || null,
  },
  // No device arm yet: these stay "--" until the runtime learns the key.
  btAudio: {},
  headphoneFix: {},
  ntp: {},
  hostname: {},
  reboot: {},
  poweroff: {},
};

// A runtime that predates a command answers with this prose instead of an
// error, and it must never be mistaken for a value.
const isUnknownArm = (raw: string): boolean => /unknown launcher action/i.test(raw);

export const readSetting = (host: LauncherHost | undefined, key: string): string | null => {
  const unified = host?.__launcher?.(`SETTING\t${key}`)?.trim() ?? "";
  if (unified && !isUnknownArm(unified) && !/^error:/i.test(unified)) return unified;
  const bridge = SETTING_BRIDGE[key];
  if (!bridge?.read) return null;
  const raw = host?.__launcher?.(bridge.read)?.trim();
  if (!raw || isUnknownArm(raw) || /^error:/i.test(raw)) return null;
  return bridge.parse ? bridge.parse(raw) : raw;
};

/** Returns the value the host reports afterwards, or null when it refused. */
export const writeSetting = (host: LauncherHost | undefined, key: string, value: string): string | null => {
  const unified = host?.__launcher?.(`SETTING\t${key}\t${value}`)?.trim() ?? "";
  if (unified === "error:reboot-required") return "reboot-required";
  if (unified === "error:starting") return "starting";
  if (unified && !isUnknownArm(unified) && !/error/i.test(unified)) return readSetting(host, key);
  const bridge = SETTING_BRIDGE[key];
  if (!bridge?.write) return null;
  const legacy = host?.__launcher?.(bridge.write(value))?.trim() ?? "";
  if (!legacy || isUnknownArm(legacy) || /failed|error|invalid|unable|unsupported/i.test(legacy)) return null;
  return readSetting(host, key);
};
