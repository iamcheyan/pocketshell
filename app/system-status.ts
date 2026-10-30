export interface SystemSnapshot {
  model: string | null;
  hardware: string | null;
  cpu: string | null;
  cpuUsagePercent: number | null;
  ramVariant: string | null;
  osName: string | null;
  osVersion: string | null;
  os: string | null;
  kernel: string | null;
  temperature: string | null;
  frequency: string | null;
  ramAvailableKb: number | null;
  ramTotalKb: number | null;
  storageUsed: string | null;
  storageTotal: string | null;
  storagePercent: number | null;
  display: string | null;
  runtime: string | null;
}

export interface NetworkSnapshot {
  interface: string | null;
  address: string | null;
  connected: boolean;
}

const numeric = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseSystemSnapshot(payload: string): SystemSnapshot | null {
  if (!payload) return null;
  const fields = new Map<string, string>();
  for (const line of payload.split("\n")) {
    const split = line.indexOf("\t");
    if (split <= 0) continue;
    fields.set(line.slice(0, split), line.slice(split + 1));
  }
  if (!fields.has("model") && !fields.has("hardware") && !fields.has("os") && !fields.has("kernel")) return null;
  const text = (key: string) => fields.get(key)?.trim() || null;
  const cpuUsagePercent = numeric(fields.get("cpuUsagePercent"));
  return {
    model: text("model"),
    hardware: text("hardware"),
    cpu: text("cpu"),
    cpuUsagePercent: cpuUsagePercent === null ? null : Math.max(0, Math.min(100, cpuUsagePercent)),
    ramVariant: text("ramVariant"),
    osName: text("osName"),
    osVersion: text("osVersion"),
    os: text("os"),
    kernel: text("kernel"),
    temperature: text("temperature"),
    frequency: text("frequency"),
    ramAvailableKb: numeric(fields.get("ramAvailableKb")),
    ramTotalKb: numeric(fields.get("ramTotalKb")),
    storageUsed: text("storageUsed"),
    storageTotal: text("storageTotal"),
    storagePercent: numeric(fields.get("storagePercent")),
    display: text("display"),
    runtime: text("runtime"),
  };
}

export function parseNetworkSnapshot(ipPayload: string, wifiPayload: string): NetworkSnapshot {
  const [iface, address] = ipPayload.trim().split("|", 2);
  const validAddress = address && address !== "--" ? address : null;
  return {
    interface: validAddress ? iface || null : null,
    address: validAddress,
    connected: wifiPayload.trim() === "on",
  };
}

export function ramUsage(snapshot: SystemSnapshot | null) {
  const total = snapshot?.ramTotalKb;
  const available = snapshot?.ramAvailableKb;
  if (total === null || available === null || total === undefined || available === undefined || total <= 0) {
    return null;
  }
  const used = Math.max(0, total - available);
  return {
    totalMb: Math.round(total / 1000),
    availableMb: Math.round(available / 1000),
    usedMb: Math.round(used / 1000),
    percent: Math.round((used * 100) / total),
  };
}
