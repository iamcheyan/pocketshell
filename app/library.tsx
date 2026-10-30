import { createSignal, Index, onMount } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN } from "@pocketjs/framework/input";
import { TextField } from "@pocketjs/framework/osk";
import { onFrame } from "@pocketjs/framework/lifecycle";
import * as Model from "./library-model";

type LibraryHost = { __library?: (command: string) => string };
type Entry = { path: string; title: string; kind: Model.LibraryDocument["kind"]; size: number; sections: Model.Section[] };
type Screen = "home" | "list" | "reading" | "bookmarks" | "search" | "toc" | "settings";
type Snapshot = { file: string; chapter: number; line: number; percentage: number; bookmarks: Model.Bookmark[] };

export function librarySnapshot(current: Snapshot | undefined): { current: Snapshot | null; progress: number; chapter: number; bookmarks: Model.Bookmark[] } {
  return { current: current ?? null, progress: current?.percentage ?? 0, chapter: current?.chapter ?? 0, bookmarks: current?.bookmarks.map((bookmark) => ({ ...bookmark })) ?? [] };
}

const menu = ["Recent Reading", "Bookmarks", "Library", "Documents", "Books", "Reports", "Logs"];
const themes: Model.Theme[] = ["dark", "light", "amber", "green", "paper"];
const themeColors: Record<Model.Theme, { bgColor: number; textColor: number; accent: number }> = {
  dark: { bgColor: 0xff18110b, textColor: 0xfff7f5f2, accent: 0xffbddd67 },
  light: { bgColor: 0xfff6f5f4, textColor: 0xff26201a, accent: 0xff697d08 },
  amber: { bgColor: 0xff070e12, textColor: 0xff72cfff, accent: 0xff32adff },
  green: { bgColor: 0xff0b1207, textColor: 0xffabeda4, accent: 0xff7adf54 },
  paper: { bgColor: 0xffcce4ee, textColor: 0xff202c33, accent: 0xff285d95 },
};

mount(() => {
  const host = (globalThis as typeof globalThis & { ui?: LibraryHost }).ui;
  const [screen, setScreen] = createSignal<Screen>("home");
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [current, setCurrent] = createSignal<Entry>();
  const [line, setLine] = createSignal(1);
  const [content, setContent] = createSignal("");
  const [input, setInput] = createSignal("");
  const [results, setResults] = createSignal<Array<{ line: number; text: string }>>([]);
  const [state, setState] = createSignal<Model.LibraryState>(Model.EMPTY_STATE());
  const [notice, setNotice] = createSignal("");
  let buttonsBefore = 0;
  let squareDownAt = 0;
  let squareHeld = false;
  const call = (command: string) => host?.__library?.(command) ?? "";
  const save = (name: string, value: unknown) => call(`STATE_SET\t${name}\t${JSON.stringify(value)}`);
  const readState = () => {
    const loaded = Model.EMPTY_STATE();
    const maps = [["progress.json", "progress"], ["bookmarks.json", "bookmarks"], ["history.json", "history"], ["settings.json", "settings"]] as const;
    for (const [filename, key] of maps) {
      const parsed = Model.safeLoad<any>(call(`STATE_GET\t${filename}`), undefined);
      if (parsed) Object.assign(loaded, { [key]: parsed });
    }
    setState(loaded);
  };
  const scan = () => {
    const found: Entry[] = [];
    const walk = (path: string) => {
      let list: Array<{ path: string; directory: boolean; size: number }>;
      try { list = JSON.parse(call(`LIST\t${path}`) || "[]"); } catch { return; }
      for (const item of list) {
        if (item.directory) walk(item.path);
        else if (/\.(txt|md|markdown|log|readme)$/i.test(item.path)) found.push({ path: item.path, title: Model.titleOf(item.path), kind: Model.classify(item.path), size: item.size, sections: [] });
      }
    };
    for (const root of Model.ROOTS) walk(root);
    setEntries(found.sort((a, b) => a.title.localeCompare(b.title)));
  };
  let cachedLineCount = 0;
  let currentOffset = 0;
  const progressFor = (file: string) => state().progress.find((entry) => entry.file === file);
  const indexSections = (item: Entry) => {
    const sections: Model.Section[] = []; let offset = 0; let lineNumber = 1; let carry = "";
    while (offset < item.size) {
      const chunk = call(`READ\t${item.path}\t${offset}\t${Model.WINDOW_BYTES}`); if (!chunk) break;
      offset += Model.utf8ByteLength(chunk); const rows = (carry + chunk).split("\n"); carry = rows.pop() ?? "";
      for (const text of rows) { if (/^#{1,6}\s+/.test(text)) sections.push({ title: text.replace(/^#{1,6}\s+/, "").trim(), line: lineNumber }); lineNumber++; }
    }
    return sections;
  };
  const lineCount = (item: Entry) => Math.max(1, cachedLineCount || Math.ceil(item.size / 48));
  const setProgress = (item: Entry, targetLine: number) => {
    const progress = Model.progressAt(item.path, 0, targetLine, lineCount(item));
    const history = [{ file: item.path, title: item.title, lastRead: Date.now(), favorite: state().history.find((entry) => entry.file === item.path)?.favorite ?? false }, ...state().history.filter((entry) => entry.file !== item.path)];
    const next = { ...state(), progress: [...state().progress.filter((entry) => entry.file !== item.path), progress], history };
    setState(next); save("progress.json", next.progress); save("history.json", history);
  };
  const loadAt = (targetLine: number) => {
    const item = current(); if (!item) return;
    let offset = 0; let currentLine = 1;
    while (currentLine < targetLine && offset < item.size) {
      const chunk = call(`READ\t${item.path}\t${offset}\t${Model.WINDOW_BYTES}`); if (!chunk) break;
      const needed = targetLine - currentLine; const newlines = [...chunk.matchAll(/\n/g)];
      if (newlines.length >= needed) { offset += Model.utf8ByteLength(chunk.slice(0, (newlines[needed - 1]?.index ?? 0) + 1)); currentLine = targetLine; break; }
      currentLine += newlines.length; offset += Model.utf8ByteLength(chunk);
    }
    currentOffset = offset;
    const chunk = call(`READ\t${item.path}\t${offset}\t${Model.WINDOW_BYTES}`);
    setContent(chunk); setLine(targetLine); setProgress(item, targetLine);
  };
  const open = (item: Entry, startOver = false) => {
    const sections = item.kind === "markdown" ? indexSections(item) : [];
    cachedLineCount = Math.max(1, sections.at(-1)?.line ?? Math.ceil(item.size / 48));
    const selectedItem = { ...item, sections };
    setCurrent(selectedItem);
    const progress = progressFor(item.path);
    const target = startOver ? 1 : progress?.line ?? 1;
    setScreen("reading");
    setNotice(progress && !startOver ? "Continue Reading?  A Continue  Y Start Over" : "");
    loadAt(target);
  };
  const rows = () => {
    if (screen() === "home") return menu;
    if (screen() === "list") return entries().map((item) => `${item.title}  ·  ${Math.round(progressFor(item.path)?.percentage ?? 0)}%`);
    if (screen() === "bookmarks") return state().bookmarks.map((mark) => `${mark.title}  ·  line ${mark.line}`);
    if (screen() === "toc") return current()?.sections.map((section) => `${section.title}  ·  ${section.line}`) ?? [];
    if (screen() === "search") return results().map((result) => `${result.line}: ${result.text}`);
    if (screen() === "settings") return [`Theme: ${state().settings.theme}`, `Font size: ${state().settings.fontSize}`, `Line height: ${state().settings.lineHeight}`, `Margins: ${state().settings.margins}`, `Progress bar: ${state().settings.showProgress ? "On" : "Off"}`];
    return [];
  };
  const choose = () => {
    if (screen() === "home") {
      const choice = menu[selected()];
      if (choice === "Bookmarks") setScreen("bookmarks");
      else { scan(); setScreen("list"); }
      setSelected(0); return;
    }
    if (screen() === "list") { const item = entries()[selected()]; if (item) open(item); return; }
    if (screen() === "reading") { setScreen("toc"); setSelected(0); return; }
    if (screen() === "toc") { const section = current()?.sections[selected()]; if (section) { setScreen("reading"); loadAt(section.line); } return; }
    if (screen() === "search") { const match = results()[selected()]; if (match) { setScreen("reading"); loadAt(match.line); } return; }
    if (screen() === "bookmarks") { const mark = state().bookmarks[selected()]; const item = entries().find((entry) => entry.path === mark?.file); if (mark && item) { setCurrent(item); setScreen("reading"); loadAt(mark.line); } return; }
    if (screen() === "settings") {
      const settings = state().settings;
      const next = selected() === 0 ? { ...settings, theme: themes[(themes.indexOf(settings.theme) + 1) % themes.length] } : selected() === 1 ? { ...settings, fontSize: settings.fontSize >= 24 ? 16 : settings.fontSize + 2 } : selected() === 2 ? { ...settings, lineHeight: settings.lineHeight >= 1.6 ? 1.2 : +(settings.lineHeight + 0.1).toFixed(1) } : selected() === 3 ? { ...settings, margins: settings.margins >= 40 ? 16 : settings.margins + 4 } : { ...settings, showProgress: !settings.showProgress };
      setState({ ...state(), settings: next }); save("settings.json", next); return;
    }
  };
  const back = () => { if (screen() === "reading") setScreen("list"); else if (["search", "toc"].includes(screen())) setScreen("reading"); else setScreen("home"); setNotice(""); };
  const bookmark = () => {
    const item = current(); if (!item) return;
    const bookmarks = [...state().bookmarks, { file: item.path, chapter: 0, line: line(), timestamp: Date.now(), title: item.title }];
    setState({ ...state(), bookmarks }); save("bookmarks.json", bookmarks); setNotice("Bookmark saved");
  };
  const search = () => {
    const item = current(); if (!item || !input().trim()) return;
    const found: Array<{ line: number; text: string }> = [];
    const size = item.size;
    let offset = 0; let lineNumber = 1; let carry = "";
    while (offset < size && found.length < 100) {
      const chunk = call(`READ\t${item.path}\t${offset}\t${Model.WINDOW_BYTES}`);
      if (!chunk) break;
      offset += Model.utf8ByteLength(chunk);
      const pieces = (carry + chunk).split("\n"); carry = pieces.pop() ?? "";
      for (const text of pieces) { if (text.toLowerCase().includes(input().toLowerCase())) found.push({ line: lineNumber, text: text.slice(0, 180) }); lineNumber++; }
    }
    if (carry && carry.toLowerCase().includes(input().toLowerCase()) && found.length < 100) found.push({ line: lineNumber, text: carry.slice(0, 180) });
    setResults(found); setScreen("search"); setSelected(0);
  };
  const displayRows = () => screen() === "reading" ? content().split("\n").slice(0, 17) : rows();
  const colors = () => themeColors[state().settings.theme];
  const color = (value: number) => (value >>> 0).toString(16).padStart(8, "0");

  onMount(() => { readState(); scan(); });

  onFrame((buttons: number) => {
    const pressed = buttons & ~buttonsBefore;
    if (buttons & BTN.SQUARE) { if (!squareDownAt) squareDownAt = Date.now(); if (!squareHeld && Date.now() - squareDownAt > 600) { squareHeld = true; setScreen("bookmarks"); setSelected(0); } }
    else if (buttonsBefore & BTN.SQUARE) { if (!squareHeld && screen() === "reading") bookmark(); squareDownAt = 0; squareHeld = false; }
    if (pressed & BTN.UP) setSelected((value) => Math.max(0, value - 1));
    if (pressed & BTN.DOWN) setSelected((value) => Math.min(Math.max(0, displayRows().length - 1), value + 1));
    if (pressed & BTN.CIRCLE) { if (screen() === "reading" && notice()) { setNotice(""); } else choose(); }
    if (pressed & BTN.CROSS) back();
    if (pressed & BTN.TRIANGLE) {
      if (screen() === "reading") { setScreen("search"); setInput(""); setResults([]); }
      else if (screen() === "search") search();
      else if (screen() === "list") {
        const item = entries()[selected()]; if (!item) return;
        const history = state().history.map((entry) => entry.file === item.path ? { ...entry, favorite: !entry.favorite } : entry);
        setState({ ...state(), history }); save("history.json", history);
      }
    }
    if (screen() === "reading" && notice() && pressed & BTN.TRIANGLE) { loadAt(1); setNotice(""); }
    if (pressed & BTN.UP && screen() === "reading") loadAt(Math.max(1, line() - 1));
    if (pressed & BTN.DOWN && screen() === "reading") loadAt(line() + 1);
    if (pressed & BTN.LEFT && screen() === "reading") loadAt(Math.max(1, line() - 6));
    if (pressed & BTN.RIGHT && screen() === "reading") loadAt(line() + 6);
    if (pressed & BTN.LTRIGGER && screen() === "reading") loadAt(Math.max(1, line() - 24));
    if (pressed & BTN.RTRIGGER && screen() === "reading") loadAt(line() + 24);
    if (pressed & BTN.START) { setScreen("settings"); setSelected(0); }
    buttonsBefore = buttons;
  });

  const title = () => screen() === "reading" ? current()?.title ?? "Reading" : screen() === "home" ? "Library Workspace" : screen()[1].toUpperCase() + screen().slice(1);
  return (
    <View class="w-[360px] h-[240px] p-3 flex-col" style={{ bgColor: color(colors().bgColor) }}>
      <View class="h-[24px] flex-row justify-between items-center"><Text class="text-base font-bold" style={{ textColor: color(colors().textColor) }}>{title()}</Text><Text class="text-sm" style={{ textColor: color(colors().accent) }}>{screen() === "reading" ? `${line()}  ·  ${current()?.kind ?? "text"}` : "A Open · Y Search"}</Text></View>
      {screen() === "reading" ? <Text class="text-sm" style={{ textColor: color(colors().textColor) }}>{content().split("\n").slice(0, 6).map((row) => row.slice(0, 36)).join("\n")}</Text> : <Index each={displayRows().slice(Math.max(0, selected() - 6), Math.max(0, selected() - 6) + 7)}>{(row, index) => <View class={index + Math.max(0, selected() - 6) === selected() ? "h-[20px] bg-slate-700 px-2" : "h-[20px] px-2"}><Text class="text-xs" style={{ textColor: color(colors().textColor) }}>{row()}</Text></View>}</Index>}
      {screen() === "search" ? <View class="flex-row"><TextField value={input} onInput={setInput} onSubmit={() => search()} placeholder="Type a search query" /><Text class="text-sm" style={{ textColor: color(colors().accent) }}>Y Find</Text></View> : null}
      {notice() ? <Text class="text-sm font-bold" style={{ textColor: color(colors().accent) }}>{notice()}</Text> : null}
      {state().settings.showProgress && screen() === "reading" ? <Text class="text-sm" style={{ textColor: color(colors().accent) }}>{Math.floor(progressFor(current()?.path ?? "")?.percentage ?? 0)}% ━━━━━━━━━━━━━━━━━━━</Text> : null}
      <View class="h-[17px] flex-row justify-between items-center"><Text class="text-xs" style={{ textColor: color(colors().textColor) }}>↑↓ Read · A TOC · B Back</Text><Text class="text-xs" style={{ textColor: color(colors().textColor) }}>X Mark · START Settings</Text></View>
      <ActionHandler button={BTN.UP} onPress={() => screen() === "reading" ? loadAt(Math.max(1, line() - 1)) : setSelected((value) => Math.max(0, value - 1))} />
      <ActionHandler button={BTN.DOWN} onPress={() => screen() === "reading" ? loadAt(line() + 1) : setSelected((value) => value + 1)} />
      <ActionHandler button={BTN.CIRCLE} onPress={choose} />
      <ActionHandler button={BTN.CROSS} onPress={back} />
    </View>
  );
});
