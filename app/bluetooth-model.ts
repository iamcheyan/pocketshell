// The Bluetooth bridge protocol, kept pure so the parsing is testable without a
// radio: `BT scan` answers `<address>\t<name>\t<rssi>\t<paired>` per line.
export interface BtDevice {
  address: string;
  name: string;
  /** dBm; -127 when the adapter did not report one. */
  rssi: number;
  paired: boolean;
}

export type BtScanResult =
  | { ok: true; devices: BtDevice[] }
  | { ok: false; reason: "bluez" | "failed" };

export interface BtStatus {
  powered: boolean | null;
  address: string;
}

export function parseBtScan(raw: string): BtScanResult {
  const trimmed = raw.trim();
  if (trimmed.startsWith("error")) {
    return { ok: false, reason: trimmed.includes("bluez") ? "bluez" : "failed" };
  }
  if (trimmed === "" || trimmed === "empty") return { ok: true, devices: [] };
  const devices: BtDevice[] = [];
  for (const line of trimmed.split("\n")) {
    const [address, name, rssi, paired] = line.split("\t");
    if (!address || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(address)) continue;
    devices.push({
      address,
      name: (name ?? "").trim() || address,
      rssi: Number(rssi),
      paired: paired === "1",
    });
  }
  return { ok: true, devices: sortBtDevices(devices) };
}

/** Paired first (they are the ones a handheld can actually reconnect to), then
 *  by signal; an unreported RSSI sinks to the bottom of its group. */
export function sortBtDevices(devices: BtDevice[]): BtDevice[] {
  return [...devices].sort((a, b) => {
    if (a.paired !== b.paired) return a.paired ? -1 : 1;
    const left = Number.isFinite(a.rssi) ? a.rssi : -999;
    const right = Number.isFinite(b.rssi) ? b.rssi : -999;
    if (left !== right) return right - left;
    return a.name.localeCompare(b.name);
  });
}

export function parseBtStatus(raw: string): BtStatus {
  const status: BtStatus = { powered: null, address: "" };
  for (const line of raw.split("\n")) {
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "powered") status.powered = value === "yes" || value === "on" || value === "1";
    else if (key === "address") status.address = value;
  }
  return status;
}
