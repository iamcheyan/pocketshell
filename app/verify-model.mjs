import assert from "node:assert/strict";
import { classify, decodeWindow, indexSections, progressAt, safeLoad, searchWindow, stateSnapshot, utf8ByteLength, WINDOW_BYTES } from "./library-model.ts";

const utf8 = new TextEncoder();
const lines = ["# Start", "αβγ", ...Array.from({ length: 30000 }, (_, i) => `line ${i}`), "## Deep Heading", "needle-crosses-window 終端"];
const markdown = utf8.encode(lines.join("\n") + "\n");
let largest = 0; let reads = 0;
const fs = {
  list() { throw new Error("unused"); },
  stat(path) { return path.endsWith("guide.md") ? { size: markdown.length, isDirectory: false } : undefined; },
  read(_path, offset, length) { largest = Math.max(largest, length); reads++; return markdown.subarray(offset, offset + Math.min(length, WINDOW_BYTES)); },
  write() { throw new Error("unused"); },
};
assert.equal(classify("book.MD"), "markdown");
assert.deepEqual(safeLoad("{bad", ["kept"]), ["kept"]);
assert.deepEqual(progressAt("/storage/docs/a.txt", 2, 8, 10, 1), { file: "/storage/docs/a.txt", chapter: 2, line: 8, percentage: 80, updatedAt: 1 });
const position = WINDOW_BYTES - 1;
const multibyte = utf8.encode("a".repeat(position) + "終端Z");
const utfFs = { ...fs, stat: () => ({ size: multibyte.length, isDirectory: false }), read(_path, offset, length) { largest = Math.max(largest, length); return multibyte.subarray(offset, offset + Math.min(length, WINDOW_BYTES)); } };
assert.equal(decodeWindow(utfFs, "x", position, 4), "終端Z");
const sections = indexSections(fs, "guide.md", markdown.length);
assert.deepEqual(sections.map((section) => section.title), ["Start", "Deep Heading"]);
const matches = searchWindow(fs, "guide.md", "needle-crosses-window", 0, 2);
assert.equal(matches.length, 1);
assert.match(matches[0].text, /needle-crosses-window/);
assert.ok(reads > 0);
assert.ok(largest <= WINDOW_BYTES + 3, `read window exceeded: ${largest}`);
const state = { progress: [], bookmarks: [{ file: "a", chapter: 1, line: 3, timestamp: 1, title: "A" }], history: [], settings: { fontSize: 18, lineHeight: 1.35, margins: 24, theme: "dark", showProgress: true } };
assert.equal(stateSnapshot(state, undefined).bookmarks.length, 1);
console.log(JSON.stringify({ ok: true, fileBytes: markdown.length, largestReadWindow: largest, readCalls: reads, sections: sections.length, matches: matches.length }));

const japanese = "日本語😀\nnext line";
const prefix = japanese.slice(0, japanese.indexOf("\n") + 1);
assert.equal(utf8ByteLength(prefix), utf8.encode(prefix).length);
assert.equal(new TextDecoder().decode(utf8.encode(japanese).slice(utf8ByteLength(prefix))), "next line");
