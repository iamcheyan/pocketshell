export type PageId = "home" | "layout" | "focus" | "animation" | "list" | "input" | "rendering" | "gallery" | "performance" | "diagnostics";

export const PAGE_NAMES = ["HOME", "LAYOUT", "FOCUS", "ANIMATION", "LIST", "INPUT", "RENDERING", "GALLERY", "PERFORMANCE", "DIAGNOSTICS"] as const;
export const STRESS_SIZES = [100, 500, 1000, 5000, 10000] as const;
export const PINNED_REVISION = "e6770376626a4de5c93eaa6fb048e7e9ffb81f9f";

export interface Diagnostic {
  field: string;
  value: string;
  source: string;
}

export function createShowcaseModel() {
  return {
    revision: PINNED_REVISION,
    diagnostics: [
      { field: "PocketJS source", value: PINNED_REVISION, source: "package.mk: PKG_VERSION (compile-time pin)" },
      { field: "QuickJS version", value: "N/A", source: "No guest API exposes the embedded engine version" },
      { field: "Profile", value: "rocknix-h700-kms", source: "config/profile.ts:3-14 (compile-time)" },
      { field: "Platform", value: "linux", source: "config/profile.ts:5 (compile-time)" },
      { field: "Build type", value: "N/A", source: "No app-visible build identity API" },
      { field: "Viewport", value: "720 × 480", source: "config/profile.ts:8-12 (compile-time logical and physical)" },
      { field: "Scale", value: "1× raster density", source: "config/profile.ts:11 (compile-time)" },
      { field: "Renderer", value: "N/A in app", source: "Linux KMS host constructs pocket_raster::RasterRenderer in programs/linux-kms/src/main.rs" },
      { field: "Display backend", value: "N/A in app", source: "Host logs DRM/KMS or fbdev selection; no guest query" },
      { field: "FPS / frame time", value: "measured by preview only", source: "host wall-clock deltas around onFrame; guest scheduler does not expose presentation timing" },
      { field: "Memory / RSS", value: "N/A", source: "Linux host process metrics are outside the guest API" },
      { field: "Native tree node count", value: "N/A", source: "Guest mirror count is not a host/native core node query" },
      { field: "Focus id/path", value: "app mirror", source: "framework/src/input.ts getFocused() + NodeMirror traversal" },
      { field: "Images/assets", value: "Image API only", source: "Image exists in primitives.ts; selected H700 profile omits image capability" },
      { field: "Screenshot / data path", value: "N/A", source: "No Linux KMS ui screenshot or filesystem binding in HostOps" },
    ] satisfies Diagnostic[],
  };
}

export interface FocusSnapshot {
  nodeId: number | null;
  path: string[];
  frame: number;
}

export interface RenderSnapshot {
  width: number;
  height: number;
  scale: number;
  backend: string | null;
}

export interface MetricsSnapshot {
  fps: number | null;
  frameTimeMs: number | null;
  mountedNodes: number | null;
  focusableNodes: number | null;
  visibleRows: number | null;
  animations: number | null;
  memoryBytes: number | null;
}

export interface ExplorerSnapshot {
  schema: "pocketjs.explorer.snapshot.v1";
  sourceRevision: string;
  frame: number;
  page: PageId;
  focus: FocusSnapshot;
  render: RenderSnapshot;
  metrics: MetricsSnapshot;
  recording: boolean;
}

export function serializeSnapshot(snapshot: ExplorerSnapshot): string {
  if (snapshot.schema !== "pocketjs.explorer.snapshot.v1") throw new TypeError("unsupported snapshot schema");
  if (!Number.isSafeInteger(snapshot.frame) || snapshot.frame < 0) throw new TypeError("frame must be a non-negative safe integer");
  if (snapshot.render.width <= 0 || snapshot.render.height <= 0 || snapshot.render.scale <= 0) throw new TypeError("render geometry must be positive");
  return JSON.stringify(snapshot);
}
