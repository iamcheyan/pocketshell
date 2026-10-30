export type LibraryDocument = {
  path: string;
  title: string;
  kind: "text" | "markdown" | "log";
  size: number;
  lines: number;
  sections: Section[];
};

export type Section = { title: string; line: number };
export type Progress = { file: string; chapter: number; line: number; percentage: number; updatedAt: number };
export type Bookmark = { file: string; chapter: number; line: number; timestamp: number; title: string };
export type Settings = { fontSize: number; lineHeight: number; margins: number; theme: Theme; showProgress: boolean };
export type Theme = "dark" | "light" | "amber" | "green" | "paper";
export type HistoryItem = { file: string; title: string; lastRead: number; favorite: boolean };
export type LibraryState = { progress: Progress[]; bookmarks: Bookmark[]; history: HistoryItem[]; settings: Settings };
export type FileSystem = {
  list(path: string): string[];
  stat(path: string): { size: number; isDirectory: boolean } | undefined;
  read(path: string, offset: number, length: number): Uint8Array;
  write(path: string, value: string): void;
};

export const ROOTS = ["/storage/docs", "/storage/books", "/storage/reports", "/storage/library"];
export const WINDOW_BYTES = 16 * 1024;
export const DEFAULT_SETTINGS: Settings = { fontSize: 18, lineHeight: 1.35, margins: 24, theme: "dark", showProgress: true };
export const EMPTY_STATE = (): LibraryState => ({ progress: [], bookmarks: [], history: [], settings: { ...DEFAULT_SETTINGS } });

export function safeLoad<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object" ? value as T : fallback;
  } catch { return fallback; }
}

export function classify(path: string): LibraryDocument["kind"] {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension === "md" || extension === "markdown" ? "markdown" : extension === "log" ? "log" : "text";
}

export function titleOf(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function decodeUtf8(bytes: Uint8Array): string { return new (globalThis as unknown as { TextDecoder: new (encoding: string, options: { fatal: boolean }) => { decode(bytes: Uint8Array): string } }).TextDecoder("utf-8", { fatal: false }).decode(bytes); }

export function decodeWindow(fs: FileSystem, path: string, offset: number, length = WINDOW_BYTES): string {
  const stat = fs.stat(path);
  if (!stat || stat.isDirectory || offset >= stat.size || length <= 0) return "";
  const start = Math.max(0, offset - 3);
  const bytes = fs.read(path, start, Math.min(length + offset - start + 3, WINDOW_BYTES, stat.size - start));
  const decoded = decodeUtf8(bytes);
  let bytePrefix = offset - start;
  while (bytePrefix > 0 && bytePrefix < bytes.length && (bytes[bytePrefix] & 0xc0) === 0x80) bytePrefix--;
  const charPrefix = decodeUtf8(bytes.subarray(0, bytePrefix)).length;
  return decoded.slice(charPrefix, charPrefix + length);
}

export function listDocuments(fs: FileSystem, roots = ROOTS): LibraryDocument[] {
  const result: LibraryDocument[] = [];
  const visit = (path: string) => {
    for (const child of fs.list(path)) {
      const info = fs.stat(child);
      if (!info) continue;
      if (info.isDirectory) visit(child);
      else if (/\.(txt|md|markdown|log|readme)$/i.test(child)) {
        const kind = classify(child);
        result.push({ path: child, title: titleOf(child), kind, size: info.size, lines: 0, sections: [] });
      }
    }
  };
  for (const root of roots) { try { visit(root); } catch { /* unavailable roots are empty */ } }
  return result.sort((a, b) => a.title.localeCompare(b.title));
}

export function indexSections(fs: FileSystem, path: string, size: number): Section[] {
  const sections: Section[] = []; let offset = 0; let line = 1; let carry = "";
  while (offset < size) {
    const bytes = fs.read(path, offset, Math.min(WINDOW_BYTES, size - offset)); if (!bytes.length) break; offset += bytes.length;
    const rows = (carry + decodeUtf8(bytes)).split("\n"); carry = rows.pop() ?? "";
    for (const row of rows) { if (/^#{1,6}\s+/.test(row)) sections.push({ title: row.replace(/^#{1,6}\s+/, "").trim(), line }); line++; }
  }
  if (carry && /^#{1,6}\s+/.test(carry)) sections.push({ title: carry.replace(/^#{1,6}\s+/, "").trim(), line });
  return sections;
}

export function searchWindow(fs: FileSystem, path: string, query: string, start = 0, maxResults = 100): Array<{ line: number; text: string }> {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const stat = fs.stat(path);
  if (!stat) return [];
  const found: Array<{ line: number; text: string }> = [];
  let offset = 0;
  let line = 1;
  let carry = "";
  while (offset < stat.size && found.length < maxResults) {
    const chunk = decodeWindow(fs, path, offset, WINDOW_BYTES);
    if (!chunk) break;
    offset += Math.min(WINDOW_BYTES, stat.size - offset);
    const rows = (carry + chunk).split("\n");
    carry = rows.pop() ?? "";
    for (const text of rows) {
      if (line >= start && text.toLocaleLowerCase().includes(needle)) found.push({ line, text: text.slice(0, 240) });
      line++;
      if (found.length >= maxResults) break;
    }
  }
  return found;
}

export function progressAt(file: string, chapter: number, line: number, totalLines: number, updatedAt = Date.now()): Progress {
  return { file, chapter: Math.max(0, chapter), line: Math.max(1, line), percentage: totalLines > 0 ? Math.min(100, Math.max(0, line / totalLines * 100)) : 0, updatedAt };
}

export function stateSnapshot(state: LibraryState, current: Progress | undefined) {
  return { version: 1, current: current ?? null, progress: current?.percentage ?? 0, chapter: current?.chapter ?? 0, bookmarks: state.bookmarks.map((bookmark) => ({ ...bookmark })) };
}

export function utf8ByteLength(text: string): number {
  let size = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    size += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return size;
}
