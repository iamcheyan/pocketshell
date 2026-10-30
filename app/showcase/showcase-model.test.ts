import { describe, expect, test } from "bun:test";
import { serializeSnapshot, type ExplorerSnapshot } from "./showcase-model";

const validSnapshot: ExplorerSnapshot = {
  schema: "pocketjs.explorer.snapshot.v1",
  sourceRevision: "e6770376626a4de5c93eaa6fb048e7e9ffb81f9f",
  frame: 12,
  page: "focus",
  focus: { nodeId: 7, path: ["root", "Focus Demo", "row-3"], frame: 12 },
  render: { width: 720, height: 480, scale: 1, backend: null },
  metrics: { fps: null, frameTimeMs: null, mountedNodes: 8, focusableNodes: 4, visibleRows: null, animations: null, memoryBytes: null },
  recording: false,
};

describe("Remote Dev snapshot adapter", () => {
  test("serializes a versioned additive metrics, focus, and render contract", () => {
    const decoded = JSON.parse(serializeSnapshot(validSnapshot));
    expect(decoded).toEqual(validSnapshot);
  });

  test("rejects malformed frames and render dimensions", () => {
    expect(() => serializeSnapshot({ ...validSnapshot, frame: -1 })).toThrow("frame must be a non-negative safe integer");
    expect(() => serializeSnapshot({ ...validSnapshot, render: { ...validSnapshot.render, width: 0 } })).toThrow("render geometry must be positive");
  });
});
