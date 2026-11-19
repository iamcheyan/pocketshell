export interface SaveEntry {
  gameTitle: string;
  kind: "slot" | "auto_state" | "state" | "battery" | "other";
  label: string;
  path: string;
  size: number;
  mtime: number; // unix timestamp in seconds
  extra: string; // e.g. "hearts=14;rupees=250;loc=海拉鲁镇"
}

export function parseSaveEntries(raw: string): SaveEntry[] {
  if (!raw || raw.startsWith("error:")) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return {
        gameTitle: parts[0] || "其他游戏",
        kind: (parts[1] as any) || "other",
        label: parts[2] || "存档",
        path: parts[3] || "",
        size: parseInt(parts[4] || "0", 10),
        mtime: parseInt(parts[5] || "0", 10),
        extra: parts[6] || "",
      };
    });
}

export function formatSaveDate(secs: number): string {
  if (!secs || isNaN(secs)) return "--";
  const d = new Date(secs * 1000);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

export function formatSaveProgress(extra: string): string | null {
  if (!extra) return null;
  const parts = extra.split(";").map((p) => p.trim());
  let hearts = 0;
  let rupees = 0;
  let loc = "";

  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "hearts") hearts = parseInt(v, 10);
    else if (k === "rupees") rupees = parseInt(v, 10);
    else if (k === "loc") loc = v;
  }

  if (!loc && hearts === 0 && rupees === 0) return null;
  const segments: string[] = [];
  if (loc) segments.push(`地点: ${loc}`);
  if (hearts > 0) segments.push(`${hearts}颗心`);
  if (rupees > 0) segments.push(`${rupees}卢比`);
  return segments.join(" · ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
