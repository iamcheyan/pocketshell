import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, FocusScope, Modal, Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { BTN, getFocused } from "@pocketjs/framework/input";
import { animate } from "@pocketjs/framework/animation";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { virtualFrame } from "@pocketjs/framework/clock";
import { VirtualList } from "@pocketjs/framework/virtual-list";
import { createScroller } from "@pocketjs/framework/kinetics";
import { createShowcaseModel, PAGE_NAMES, STRESS_SIZES, type PageId } from "./showcase-model";

const COLORS = { ink: "#101820", paper: "#e8edf0", muted: "#78909c", lime: "#c4f24b", amber: "#ffb454", coral: "#f27766" };
const NAV_ROW = "w-full h-[16] flex-row items-center px-2 rounded-md bg-[#1b2730] border-[#344650] focus:bg-[#2a3c45] focus:border-[#c4f24b] transition-colors duration-100";
const PANEL = "flex-col gap-1 p-2 rounded-lg shadow-md bg-[#1b2730] border-[#344650]";
const PAGES: PageId[] = ["home", "layout", "focus", "animation", "list", "input", "rendering", "gallery", "performance", "diagnostics"];
const COMPONENTS = ["View", "Text", "Image", "Sprite", "CompositorSurface", "DeepZoom", "Screen", "Focusable", "Named", "FocusScope", "FocusGrid", "ActionHandler", "AxisHandler", "MotionHandler", "For", "Portal", "AuxiliarySurface", "AuxiliaryPortal", "Modal", "ActionBar", "Grid", "Lazy", "Gallery"];
const BUTTONS = [["UP", BTN.UP], ["DOWN", BTN.DOWN], ["LEFT", BTN.LEFT], ["RIGHT", BTN.RIGHT], ["A / CROSS", BTN.CROSS], ["B / CIRCLE", BTN.CIRCLE], ["X / SQUARE", BTN.SQUARE], ["Y / TRIANGLE", BTN.TRIANGLE], ["L / LTRIGGER", BTN.LTRIGGER], ["R / RTRIGGER", BTN.RTRIGGER], ["L1 / ZL", BTN.ZL], ["R1 / ZR", BTN.ZR], ["START", BTN.START], ["SELECT", BTN.SELECT]] as const;

mount(() => {
  const model = createShowcaseModel();
  const [page, setPage] = createSignal<PageId>("home");
  const [selected, setSelected] = createSignal(0);
  const [fpsVisible, setFpsVisible] = createSignal(true);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [listSize, setListSize] = createSignal(100);
  const [stressSize, setStressSize] = createSignal(100);
  const [eventText, setEventText] = createSignal("Waiting for controller input");
  const [notice, setNotice] = createSignal("CROSS opens · CIRCLE home · START screenshot request");
  const [recording, setRecording] = createSignal(false);
  const [visibleRows, setVisibleRows] = createSignal(0);
  const [focusSnapshot, setFocusSnapshot] = createSignal({ id: "none", path: "none" });
  let treeRoot: NodeMirror | undefined;
  let animated: NodeMirror | undefined;
  let previousButtons = 0;
  const [mirror, setMirror] = createSignal({ nodes: 0, focusable: 0 });
  const samples: Array<{ button: string; frame: number }> = [];
  const listScroller = createScroller({ max: () => Math.max(0, listSize() * 16 - 100) });

  const inspectTree = (node: NodeMirror | undefined): void => {
    let nodes = 0;
    let focusable = 0;
    const visit = (current: NodeMirror) => {
      nodes++;
      if (current.focusable) focusable++;
      current.children.forEach(visit);
    };
    if (node) visit(node);
    setMirror({ nodes, focusable });
  };
  const updateFocusSnapshot = () => {
    const node = getFocused();
    if (!node) { setFocusSnapshot({ id: "none", path: "none" }); return; }
    const path: string[] = [];
    let current: NodeMirror | null = node;
    while (current) {
      path.push(current.debugName ?? (current.text ? current.text.slice(0, 24) : `node#${current.id}`));
      current = current.parent;
    }
    setFocusSnapshot({ id: String(node.id), path: path.reverse().join(" / ") });
  };
  const saveScreenshot = () => {
    const host = globalThis as typeof globalThis & { ui?: { __showcase?: (request: string) => string } };
    setNotice(host.ui?.__showcase?.("screenshot") ?? "Unavailable: host has no screenshot/filesystem bridge");
  };
  const toggleRecording = () => {
    setRecording((value) => !value);
    setNotice(recording() ? "Recording stopped; report requires preview host export" : "Recording started: button edges and virtual frames");
  };
  const movePage = (delta: number) => {
    const index = Math.max(0, Math.min(PAGES.length - 1, PAGES.indexOf(page()) + delta));
    setPage(PAGES[index]);
    setSelected(0);
  };
  const back = () => {
    if (modalOpen()) setModalOpen(false);
    else { setPage("home"); setSelected(0); }
  };
  const activate = () => {
    if (page() === "home") { setPage(PAGES[Math.min(selected(), PAGES.length - 1)]); setSelected(0); }
    else if (page() === "list") {
      const sizes = [100, 1000, 5000, 10000];
      setListSize(sizes[(sizes.indexOf(listSize()) + 1) % sizes.length]);
      listScroller.scrollTo(0, { immediate: true });
    } else if (page() === "animation" && animated) {
      const turn = virtualFrame() % 2;
      animate(animated, "opacity", turn ? 1 : 0.35, { dur: 240, easing: "out" });
      animate(animated, "scale", turn ? 1.1 : 0.82, { dur: 300, easing: "spring-bouncy" });
      animate(animated, "translateX", turn ? 48 : 0, { dur: 300, easing: "out-back" });
      animate(animated, "bgColor", turn ? COLORS.lime : COLORS.amber, { dur: 300, easing: "in-out" });
    } else if (page() === "gallery") setModalOpen((value) => !value);
    else if (page() === "input") setEventText(`CROSS edge at virtual frame ${virtualFrame()}`);
  };
  const recordButtons = (pressed: number, held: number) => {
    for (const [name, mask] of BUTTONS) {
      if (held & mask) setEventText(`${name} held; frame ${virtualFrame()}`);
      if (!(pressed & mask)) continue;
      setEventText(`${name} press edge; frame ${virtualFrame()}`);
      if (recording()) samples.push({ button: name, frame: virtualFrame() });
    }
  };

  onMount(() => {
    onFrame((buttons) => {
      const pressed = buttons & ~previousButtons;
      previousButtons = buttons;
      if (pressed) recordButtons(pressed, buttons);
      updateFocusSnapshot();
      inspectTree(treeRoot);
      if ((pressed & BTN.SELECT) && (buttons & BTN.START)) toggleRecording();
      else if (pressed & BTN.START) saveScreenshot();
      else if (pressed & BTN.SELECT) setFpsVisible((value) => !value);
      else if (pressed & BTN.CIRCLE) back();
      else if (pressed & BTN.CROSS) activate();
      else if (pressed & BTN.UP) setSelected((value) => Math.max(0, value - 1));
      else if (pressed & BTN.DOWN) setSelected((value) => value + 1);
      else if (pressed & BTN.LEFT) movePage(-1);
      else if (pressed & BTN.RIGHT) movePage(1);
    });
  });

  const LabelValue = (props: { label: string; value: string }) => (
    <View class="flex-row items-center justify-between gap-2 h-[16]"><Text class="text-xs" style={{ textColor: COLORS.muted }}>{props.label}</Text><Text class="text-xs font-bold" style={{ textColor: COLORS.paper }}>{props.value}</Text></View>
  );
  const Section = (props: { title: string; children: unknown }) => (
    <View class={PANEL}><Text class="text-sm font-bold" style={{ textColor: COLORS.lime }}>{props.title}</Text>{props.children as never}</View>
  );
  const Heading = (props: { title: string; subtitle: string }) => (
    <View class="flex-col gap-1"><Text class="text-sm font-bold" style={{ textColor: COLORS.paper }}>{props.title}</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>{props.subtitle}</Text></View>
  );
  const content = createMemo(() => {
    if (page() === "home") return <View class="flex-col gap-2 w-full h-full"><Heading title="Capability Explorer" subtitle={`PocketJS ${model.revision} · native 360×240 · LCD 2×`}/><View class="flex-row gap-2"><Section title="PROFILE"><LabelValue label="platform" value="Linux embedded"/><LabelValue label="tick" value="60 Hz profile fact"/><LabelValue label="backend" value="host query unavailable"/></Section><Section title="INPUT / FOCUS"><LabelValue label="button masks" value="input.buttons"/><LabelValue label="focus node/path" value={focusSnapshot().id}/><Text class="text-xs" style={{ textColor: COLORS.paper }}>{focusSnapshot().path}</Text></Section></View><Section title="MEASUREMENT"><Text class="text-xs" style={{ textColor: COLORS.amber }}>FPS and presented frame time are not exposed to this guest. Use browser preview measurements only.</Text><Text class="text-xs" style={{ textColor: COLORS.paper }}>{mirror().nodes} app mirror nodes · {mirror().focusable} focusable · counts exclude native core-owned nodes.</Text></Section><Text class="text-xs" style={{ textColor: COLORS.amber }}>{notice()}</Text></View>;
    if (page() === "layout") return <View class="flex-col gap-3 w-full h-full"><Heading title="Layout Demo" subtitle="Native flex, gap, alignment, spacing and clipping"/><View class="flex-row gap-2 p-2 rounded-xl bg-[#1b2730] border-[#344650]"><View class="flex-col gap-2 w-[87]"><Text class="text-xs" style={{ textColor: COLORS.lime }}>COLUMN + GAP</Text><View class="h-[22] items-center justify-center rounded-md bg-[#344650]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>padding / radius / border</Text></View><View class="h-[22] items-center justify-center rounded-md bg-[#344650]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>nested column margin</Text></View></View><View class="flex-1 flex-col gap-2"><Text class="text-xs" style={{ textColor: COLORS.lime }}>ROW + ALIGNMENT</Text><View class="flex-row items-center justify-between h-[22] px-2 rounded-md bg-[#344650]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>start</Text><Text class="text-xs" style={{ textColor: COLORS.amber }}>center</Text><Text class="text-xs" style={{ textColor: COLORS.paper }}>end</Text></View><View class="flex-1 overflow-hidden rounded-md border-[#78909c] bg-[#101820]"><View class="w-[140] h-[40] p-2 bg-[#2a3c45]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>overflow-hidden clips the subtree</Text></View></View></View></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>Kinetic scrolling is demonstrated by VirtualList. A clip alone is not a scroll view.</Text></View>;
    if (page() === "focus") return <View class="flex-col gap-2 w-full h-full"><Heading title="Focus Demo" subtitle="Native traversal; app observes the Solid node mirror"/><View class="flex-row gap-2"><Section title="FOCUSED"><LabelValue label="node id" value={focusSnapshot().id}/><Text class="text-xs" style={{ textColor: COLORS.paper }}>{focusSnapshot().path}</Text></Section><Section title="OBSERVED"><Text class="text-xs" style={{ textColor: COLORS.paper }}>{eventText()}</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>getFocused() is polled by the app. No focus-change event callback exists.</Text></Section></View><View class="flex-row gap-2"><For each={["document order", "FocusScope", "FocusGrid", "focus restore"]}>{(label) => <View focusable debugName={label} onPress={() => setNotice(`${label} activated`)} class="flex-col justify-center p-2 w-[61] h-[33] rounded-lg bg-[#1b2730] border-[#344650] focus:bg-[#2a3c45] focus:border-[#c4f24b] transition-colors duration-100"><Text class="text-xs font-bold" style={{ textColor: COLORS.paper }}>{label}</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>mirror node</Text></View>}</For></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>Focus path and node count are app mirror measurements, not native core diagnostics.</Text></View>;
    if (page() === "animation") return <View class="flex-col gap-2 w-full h-full"><Heading title="Animation Demo" subtitle="Native core tween and spring APIs"/><View class="flex-row items-center justify-between p-3 h-[59] rounded-xl bg-[#1b2730] border-[#344650]"><View ref={(node: NodeMirror) => { animated = node; }} style={{ opacity: 0.35, scale: 0.82, bgColor: COLORS.amber }} class="w-[56] h-[35] rounded-lg shadow-md items-center justify-center"><Text class="text-xs font-bold" style={{ textColor: COLORS.ink }}>animate()</Text></View><View class="flex-col gap-2"><Text class="text-sm" style={{ textColor: COLORS.paper }}>opacity · scale · translateX · bgColor</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>240–300 ms; out, spring-bouncy, out-back easing</Text><Text class="text-xs" style={{ textColor: COLORS.amber }}>Press CROSS to tween</Text></View></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>Native animations use fixed profile dt; they do not expose presentation latency.</Text></View>;
    if (page() === "list") return <View class="flex-col gap-1 w-full h-full"><Heading title="Virtual List Demo" subtitle={`generated ${listSize()} rows; visible window is bounded by viewport + overscan`}/><View class="flex-row items-center gap-2 h-[20]"><Text class="text-xs font-bold" style={{ textColor: COLORS.lime }}>ROWS {listSize()}</Text><For each={[100, 1000, 5000, 10000]}>{(count) => <View focusable onPress={() => { setListSize(count); listScroller.scrollTo(0, { immediate: true }); }} class="px-2 py-1 rounded-md bg-[#1b2730] border-[#344650] focus:border-[#c4f24b]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>{count}</Text></View>}</For></View><LabelValue label="visible rows (viewport + overscan bound)" value={String(visibleRows())}/><LabelValue label="current app mirror nodes" value={String(mirror().nodes)}/><View ref={(node: NodeMirror) => { treeRoot = node; }} class="flex-1 overflow-hidden rounded-lg border-[#344650] bg-[#101820]"><VirtualList count={listSize()} rowHeight={16} height={100} controller={listScroller} overscan={32} ref={() => setVisibleRows(Math.min(listSize(), Math.ceil(100 / 16) + Math.ceil(2 * 32 / 16)))} renderRow={(index) => <View focusable debugName={`row-${index}`} onPress={() => setNotice(`Selected row ${index}`)} class="flex-row items-center gap-2 px-2 h-[16] border-[#344650] focus:bg-[#2a3c45] focus:border-[#c4f24b]"><Text class="text-xs" style={{ textColor: COLORS.lime }}>{String(index + 1).padStart(5, "0")}</Text><Text class="text-xs" style={{ textColor: COLORS.paper }}>PocketJS virtual row</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>key {index}</Text></View>}/></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>Only rows in the viewport and overscan are mounted. Generated count is not mounted count.</Text></View>;
    if (page() === "input") return <View class="flex-col gap-2 w-full h-full"><Heading title="Input Demo" subtitle="Held masks sampled each frame; controller callback is edge-only"/><View class="flex-row gap-2"><Section title="LAST EVENT"><Text class="text-sm font-bold" style={{ textColor: COLORS.lime }}>{eventText()}</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>Hold observation uses virtual frames. Native repeat callback is unavailable.</Text></Section><Section title="CHORDS"><Text class="text-xs" style={{ textColor: COLORS.paper }}>START + SELECT: recording toggle</Text><Text class="text-xs" style={{ textColor: COLORS.paper }}>START: preview host screenshot request</Text><Text class="text-xs" style={{ textColor: COLORS.paper }}>SELECT: FPS panel toggle (preview only)</Text></Section></View><View class="flex-row flex-wrap gap-1"><For each={BUTTONS}>{([name]) => <View class="px-2 py-1 rounded-md border-[#344650] bg-[#1b2730]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>{name}</Text></View>}</For></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>Evdev aliases L/R to triggers and maps L1/R1 to ZL/ZR. Verify the physical board mapping on RG34XX.</Text></View>;
    if (page() === "rendering") return <View class="flex-col gap-2 w-full h-full"><Heading title="Rendering Demo" subtitle="CPU raster and baked styles; gaps are explicit"/><View class="flex-row gap-2"><View class="flex-1 flex-col gap-2 p-2 rounded-xl bg-gradient-to-r from-blue-900 to-slate-950 border-[#78909c] shadow-md"><Text class="text-sm font-bold" style={{ textColor: COLORS.paper }}>gradient · border · radius · shadow</Text><Text class="text-xs" style={{ textColor: COLORS.lime }}>View / Text supported</Text></View><View class="flex-1 flex-col gap-2 p-2 rounded-xl bg-[#1b2730] border-[#344650]"><Text class="text-sm font-bold" style={{ textColor: COLORS.paper }}>Image / Sprite</Text><Text class="text-xs" style={{ textColor: COLORS.amber }}>Image API exists; profile omits image capability, no asset bundled.</Text></View></View><Text class="text-xs" style={{ textColor: COLORS.muted }}>The rendering stress levels are in Performance. No browser DOM, WebGL, OpenGL or Vulkan app API is exposed by this profile.</Text></View>;
    if (page() === "gallery") return <View class="flex-col gap-2 w-full h-full"><Heading title="Component Gallery" subtitle={`${COMPONENTS.length} component exports + VirtualList API listed`}/><View class="flex-row flex-wrap gap-1"><For each={COMPONENTS}>{(name) => <View class="px-2 py-1 rounded-md border-[#344650] bg-[#1b2730]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>{name}</Text></View>}</For></View><Text class="text-xs" style={{ textColor: COLORS.lime }}>Button/Card/Progress/Tabs patterns compose from View, Text and focus styles.</Text><Text class="text-xs" style={{ textColor: COLORS.amber }}>No exported Button, Card, Progress, Tabs, Dialog, Overlay or ScrollView component in this pinned Solid API.</Text><View focusable onPress={() => setModalOpen(true)} class="w-[89] h-[20] justify-center px-3 rounded-lg bg-[#1b2730] border-[#344650] focus:border-[#c4f24b]"><Text class="text-sm" style={{ textColor: COLORS.paper }}>Open native Modal</Text></View><Modal open={modalOpen} panelClass="flex-col gap-2 w-[195] p-4 rounded-xl shadow-lg bg-[#1b2730] border-[#78909c]"><Text class="text-sm font-bold" style={{ textColor: COLORS.lime }}>Modal / Portal / FocusScope</Text><Text class="text-sm" style={{ textColor: COLORS.paper }}>CIRCLE closes; background button handlers are blocked.</Text><View focusable onPress={() => setModalOpen(false)} class="px-3 py-2 rounded-md border-[#c4f24b]"><Text class="text-sm" style={{ textColor: COLORS.paper }}>Close</Text></View></Modal></View>;
    if (page() === "performance") return <View class="flex-col gap-2 w-full h-full"><Heading title="Performance Demo" subtitle="Native guest cannot query presented FPS, frame time, or memory"/><Text class="text-xs" style={{ textColor: COLORS.amber }}>FPS / avg / min / max / 1% low / frame time: N/A on this KMS guest; browser RAF measurements belong to the preview only.</Text><View class="flex-row items-center gap-2"><Text class="text-xs" style={{ textColor: COLORS.lime }}>ELEMENT COUNT</Text><For each={STRESS_SIZES}>{(count) => <View focusable onPress={() => setStressSize(count)} class="px-2 py-1 rounded-md bg-[#1b2730] border-[#344650] focus:border-[#c4f24b]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>{count}</Text></View>}</For></View><Text class="text-xs" style={{ textColor: COLORS.paper }}>Selected stress level: {stressSize()} explicit native View nodes. Switch away to destroy the stress subtree.</Text><Show when={page() === "performance"}><View ref={(node: NodeMirror) => { treeRoot = node; }} class="flex-1 flex-row flex-wrap gap-1 overflow-hidden">{Array.from({ length: stressSize() }, (_, index) => <View class="w-[6] h-[6] rounded-sm" style={{ bgColor: index % 2 ? COLORS.lime : COLORS.amber }}/>)}</View></Show><Text class="text-xs" style={{ textColor: COLORS.amber }}>Guest mirror counts are app-side only. Native core nodes, hidden nodes, animation count and memory/RSS: N/A.</Text></View>;
    return <View class="flex-col gap-2 w-full h-full"><Heading title="Diagnostics" subtitle="Source-backed values and unavailable queries"/><For each={model.diagnostics}>{(item) => <View class="flex-row items-start gap-2 p-1 border-[#344650]"><Text class="text-xs font-bold w-[55]" style={{ textColor: COLORS.lime }}>{item.field}</Text><Text class="text-xs w-[55]" style={{ textColor: item.value === "N/A" ? COLORS.coral : COLORS.paper }}>{item.value}</Text><Text class="text-xs flex-1" style={{ textColor: COLORS.muted }}>{item.source}</Text></View>}</For><Text class="text-xs" style={{ textColor: COLORS.amber }}>PocketJS/QuickJS package revisions are build inputs; app JS receives no engine-version query.</Text></View>;
  });

  return <View class="relative flex-col w-[360] h-[240] p-1 gap-1 bg-[#101820] overflow-hidden"><View class="flex-row items-center justify-between h-[32] border-[#344650]"><View class="flex-col"><Text class="text-xs font-bold tracking-wide" style={{ textColor: COLORS.lime }}>POCKETJS EXPLORER</Text><Text class="text-xs" style={{ textColor: COLORS.muted }}>pinned {model.revision.slice(0, 8)} · 360×240 @2×</Text></View><Show when={fpsVisible()}><Text class="text-xs" style={{ textColor: COLORS.amber }}>FPS N/A</Text></Show></View><View ref={(node: NodeMirror) => { treeRoot = node; }} class="flex-row gap-1 flex-1 overflow-hidden"><FocusScope class="w-[96] flex-col gap-0 shrink-0" autoFocus><For each={PAGE_NAMES}>{(entry, index) => <View focusable debugName={entry} onPress={() => { setPage(PAGES[index()]); setSelected(index()); }} class={NAV_ROW}><Text class="text-xs font-bold" style={{ textColor: page() === PAGES[index()] ? COLORS.lime : COLORS.paper }}>{entry}</Text></View>}</For></FocusScope><View class="flex-1 flex-col p-2 gap-1 rounded-xl border-[#344650] bg-[#14212a] overflow-hidden">{content()}</View></View><View class="flex-row items-center justify-between h-[16] border-[#344650]"><Text class="text-xs" style={{ textColor: COLORS.paper }}>↑↓ Select · A Open · B Home</Text><Text class="text-xs" style={{ textColor: COLORS.amber }}>START Shot</Text></View><ActionHandler button={BTN.START} onPress={() => saveScreenshot()}/></View>;
});
