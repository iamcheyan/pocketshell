// Capture real PocketJS pixels: official Rust/WASM core + rasterizer, the
// compiled app bundle from `pocket compile`, and scripted controller input.
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createWasmUi } from "../../platforms/web/wasm-ops.js";
import { encodePNG } from "../../tools/png.ts";

const OUT = process.argv[2] ?? "/tmp/pocketjs-showcase-shots";
const DIST = "/tmp/pocketjs-showcase-e677037/apps/rocknix-showcase/dist";
const WASM_PATH = "/tmp/pocketjs-showcase-e677037/platforms/web/pocketjs.wasm";
const BUNDLE = join(DIST, "rocknix-pocketjs-boot.js");
const PAK = join(DIST, "rocknix-pocketjs-boot.pak");
const W = 720;
const H = 480;
const RIGHT = 0x20;
const CROSS = 0x4000;
const SELECT = 0x01;

const PAGES = ["home", "layout", "focus", "animation", "list", "input", "rendering", "gallery", "performance", "diagnostics"];

if (!existsSync(WASM_PATH)) throw new Error(`missing ${WASM_PATH} — run: bun tools/wasm.ts`);
mkdirSync(OUT, { recursive: true });

const wasm = await createWasmUi(await Bun.file(WASM_PATH).arrayBuffer(), {
  width: W, height: H, rasterDensity: 1, host: "rocknix-h700-kms",
});
const g = globalThis as unknown as {
  ui?: typeof wasm.ops; __pak?: ArrayBuffer;
  frame?: (buttons: number) => void;
};
g.ui = wasm.ops;
if (existsSync(PAK)) g.__pak = await Bun.file(PAK).arrayBuffer();
g.frame = undefined;
(0, eval)(await Bun.file(BUNDLE).text());
if (typeof g.frame !== "function") throw new Error("bundle did not install globalThis.frame");

const press = (mask: number, frames = 4) => {
  for (let i = 0; i < frames; i++) { g.frame!(mask); wasm.tick(); }
  for (let i = 0; i < 2; i++) { g.frame!(0); wasm.tick(); }
};
const settle = (frames: number) => { for (let i = 0; i < frames; i++) { g.frame!(0); wasm.tick(); } };
const shot = (name: string) => {
  const png = encodePNG(wasm.render(), W, H);
  Bun.write(join(OUT, `${name}.png`), png);
  console.log(`captured ${name}.png (${png.byteLength} bytes)`);
};

settle(10);
shot("home");
press(SELECT); // FPS overlay panel visible
shot("home-fps-overlay");
press(SELECT);

for (let i = 1; i < PAGES.length; i++) {
  press(RIGHT);
  settle(30);
  shot(PAGES[i]);
  if (PAGES[i] === "list") {
    press(CROSS); settle(20); shot("list-1000");
    press(CROSS); settle(20); shot("list-5000");
    press(CROSS); settle(30); shot("list-10000");
  }
}

console.log(`focused node id after run: ${wasm.focused()}`);
wasm.dispose();
