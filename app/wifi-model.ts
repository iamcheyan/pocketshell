// The Wi-Fi bridge protocol, as documented in docs/WIFI-BRIDGE-CONTRACT.md.
//
// Everything here is pure: the page feeds it the raw strings the host returns
// and renders the result. Keeping the parsing out of the component means the
// awkward parts — tab-splitting, `error:` prefixes, the pre-2.0 runtime that
// still answers prose — are testable without a device.

export type WifiSecurity = "open" | "wep" | "wpa";

export interface WifiNetwork {
  ssid: string;
  /** dBm as reported by the supplicant; NaN when the field was not a number. */
  signal: number;
  security: WifiSecurity;
  /** The supplicant has a saved profile for this SSID. */
  saved: boolean;
  /** The device is currently associated with this SSID. */
  active: boolean;
}

/** What `WIFI scan` answered, including the reasons it can answer with nothing. */
export type ScanResult =
  | { ok: true; networks: WifiNetwork[] }
  | { ok: false; reason: "supplicant" | "failed" };

export type ConnectOutcome =
  | { kind: "connected"; ssid: string }
  | { kind: "need-psk" }
  | { kind: "auth-failed" }
  | { kind: "not-found" }
  | { kind: "timeout" }
  | { kind: "error"; detail: string };

export interface WifiStatus {
  state: string;
  ssid: string;
  ip: string;
}

/** An SSID is at most 32 octets, so the limit is on bytes, not characters. */
export function ssidBytes(ssid: string): number {
  let bytes = 0;
  for (const char of ssid) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const securityWord = (flags: string): WifiSecurity => {
  const upper = flags.toUpperCase();
  if (upper.includes("WPA") || upper.includes("RSN") || upper.includes("SAE")) return "wpa";
  if (upper.includes("WEP")) return "wep";
  return "open";
};

export function parseScan(raw: string, saved: string[], activeSsid: string): ScanResult {
  const trimmed = raw.trim();
  if (trimmed.startsWith("error") || /unknown launcher action/i.test(trimmed)) {
    return { ok: false, reason: trimmed.includes("supplicant") ? "supplicant" : "failed" };
  }
  if (trimmed === "" || trimmed === "empty") return { ok: true, networks: [] };

  // Dynamic SSID keys: a scan repeats an SSID once per BSSID, and only the
  // strongest sample of each is worth showing.
  const bySsid = new Map<string, WifiNetwork>();
  for (const line of raw.split("\n")) {
    const [ssid, signal, sec] = line.split("\t");
    // Hidden networks arrive as an empty SSID and cannot be joined by name.
    if (!ssid || !ssid.trim() || ssidBytes(ssid) > 32) continue;
    const network: WifiNetwork = {
      ssid,
      signal: signal?.trim() ? Number(signal) : Number.NaN,
      security: securityWord(sec ?? ""),
      saved: saved.includes(ssid),
      active: ssid === activeSsid,
    };
    const previous = bySsid.get(ssid);
    if (!previous || (Number.isFinite(network.signal) && (!Number.isFinite(previous.signal) || network.signal > previous.signal))) {
      bySsid.set(ssid, network);
    }
  }

  return { ok: true, networks: sortNetworks([...bySsid.values()]) };
}

/** Associated first, then by signal strength; unusable readings sink. */
export function sortNetworks(networks: WifiNetwork[]): WifiNetwork[] {
  return [...networks].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const left = Number.isFinite(a.signal) ? a.signal : -999;
    const right = Number.isFinite(b.signal) ? b.signal : -999;
    if (left !== right) return right - left;
    return a.ssid.localeCompare(b.ssid);
  });
}

/** `WIFI status` answers `state=`/`ssid=`/`ip=` on separate lines. */
export function parseStatus(raw: string): WifiStatus {
  const status: WifiStatus = { state: "", ssid: "", ip: "" };
  for (const line of raw.split("\n")) {
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "state" || key === "wpa_state") status.state = value;
    else if (key === "ssid") status.ssid = value;
    else if (key === "ip" || key === "ip_address") status.ip = value;
  }
  return status;
}

/**
 * `WIFI saved` is one SSID per line. A runtime without Wi-Fi 2.0 answers
 * "Unknown launcher action" instead, which must not read as an SSID named that.
 * An empty answer is a supported bridge with nothing saved — not a refusal.
 */
export function parseSaved(raw: string): { supported: boolean; ssids: string[] } {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "unknown launcher action") {
    return { supported: false, ssids: [] };
  }
  return {
    supported: true,
    ssids: trimmed.split("\n").map((line) => line.trim()).filter((line) => line.length > 0),
  };
}

export function parseConnectResult(raw: string): ConnectOutcome {
  const text = raw.trim();
  if (text.startsWith("connected")) {
    const at = text.indexOf(":");
    return { kind: "connected", ssid: at >= 0 ? text.slice(at + 1) : "" };
  }
  if (text === "need-psk") return { kind: "need-psk" };
  if (text === "auth-failed") return { kind: "auth-failed" };
  if (text === "not-found") return { kind: "not-found" };
  if (text === "timeout") return { kind: "timeout" };
  if (text.startsWith("error")) {
    const at = text.indexOf(":");
    return { kind: "error", detail: at >= 0 ? text.slice(at + 1) : text };
  }
  // A runtime without Wi-Fi 2.0 answers prose ("Unable to connect"); show it
  // rather than inventing a category it never meant.
  return { kind: "error", detail: text || "unknown" };
}

/** WPA2 passphrases are 8–63 printable ASCII characters; anything else cannot work. */
export function pskIssue(psk: string): "empty" | "short" | "long" | "non-ascii" | null {
  if (!psk) return "empty";
  if (psk.length < 8) return "short";
  if (psk.length > 63) return "long";
  if (!/^[\x20-\x7e]+$/.test(psk)) return "non-ascii";
  return null;
}
