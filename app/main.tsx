import { createSignal, createEffect, createMemo, onMount, Index } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { Text, View, Image, type NodeMirror } from "@pocketjs/framework/solid/components";
import { getOps } from "@pocketjs/framework/host";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { animate } from "@pocketjs/framework/animation";
import { Osk, createOsk } from "@pocketjs/framework/osk";

import {
  LAUNCHER_APPS,
  appDescription,
  appName,
  appShortName,
  appTag,
  categoryLabel,
  getAppsForScreen,
  type LauncherApp,
} from "./launcher-catalog";
import { translator } from "./i18n";
import { StatusBar } from "./status-bar";
import { CardCarousel, CAROUSEL_OFFSET_5, CAROUSEL_OFFSET_LESS, CAROUSEL_STEP } from "./card-carousel";
import { libraryTexture } from "./library-images";
import { PixelStatus } from "./pixel-status";
import { TouchTarget } from "./touch-target";
import { SettingsPage, type SettingsState } from "./pages/settings-page";
import { SETTING_ROWS, SETTINGS_COUNT, TIMEOUT_OPTIONS, AUTO_POWEROFF_OPTIONS, parseToggle } from "./settings-model";
import { readSetting, writeSetting } from "./setting-bridge";
import {
  THEME_PALETTES,
  THEME_COLORS,
  FONT_SIZES,
  FONT_SCALE_CONFIGS,
  type ThemeColorKey,
  type FontSizeKey,
} from "./theme-model";
import { SYSTEM_PAGES, SystemPage } from "./pages/system-page";
import { WifiPage, type WifiPhase } from "./pages/wifi-page";
import { BtPage, type BtPhase } from "./pages/bt-page";
import { parseBtScan, parseBtStatus, type BtDevice } from "./bluetooth-model";
import {
  parseConnectResult,
  parseSaved,
  parseScan,
  parseStatus,
  pskIssue,
  type WifiNetwork,
} from "./wifi-model";
import { PocketFetch } from "./pages/pocket-fetch";
import { PowerMenu, type PowerAction } from "./power-menu";
import { parseNetworkSnapshot, parseSystemSnapshot, type NetworkSnapshot, type SystemSnapshot } from "./system-status";

type HostUI = {
  __launcher?: (command: string) => string;
};

mount(() => {
  const host = (globalThis as typeof globalThis & { ui?: HostUI }).ui;

  // -------------------------------------------------------------------------
  // Launcher State (Switch 5-Screen)
  // -------------------------------------------------------------------------
  const [currentScreen, setCurrentScreen] = createSignal(0);
  const [launcherOpen, setLauncherOpen] = createSignal(true);
  // Power menu: armed by a long power-key press, then a modal over everything.
  const [powerMenuOpen, setPowerMenuOpen] = createSignal(false);
  const [powerChoice, setPowerChoice] = createSignal<PowerAction>("poweroff");
  const [powerBusy, setPowerBusy] = createSignal(false);
  // Set when the bridge refuses (no POWER arm, or a preview host). The dialog
  // stays up and says so instead of closing on a request that never ran.
  const [powerRefused, setPowerRefused] = createSignal(false);

  // Card indexes per screen
  const [homeCardIndex, setHomeCardIndex] = createSignal(0);
  const [carouselCenter, setCarouselCenter] = createSignal(0);
  let carouselResetAt = 0;
  const [favorites, setFavorites] = createSignal<string[]>([]);
  const [gameOptionsOpen, setGameOptionsOpen] = createSignal(false);
  const [libraryRevision, setLibraryRevision] = createSignal(0);
  const [backgroundReady, setBackgroundReady] = createSignal(false);
  const [backgroundNode, setBackgroundNode] = createSignal<NodeMirror>();
  const [systemPageIndex, setSystemPageIndex] = createSignal(0);

  // Settings State
  const [settingsIndex, setSettingsIndex] = createSignal(0);
  const [brightness, setBrightness] = createSignal<number | null>(null);
  const [volume, setVolume] = createSignal<number | null>(null);
  const [wifiEnabled, setWifiEnabled] = createSignal<boolean | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = createSignal(false);
  const [language, setLanguage] = createSignal("zh");
  const [timeoutIndex, setTimeoutIndex] = createSignal(0); // 10s, matches the saved default
  const [autoPoweroffIndex, setAutoPoweroffIndex] = createSignal(0); // never
  // Raw bridge answers per settings key; null means "the host did not answer".
  const [settingValues, setSettingValues] = createSignal<Record<string, string | null>>({});

  // Hardware Status State
  const [ipAddress, setIpAddress] = createSignal("--");
  const [batteryLevel, setBatteryLevel] = createSignal(-1);
  const [batteryStatus, setBatteryStatus] = createSignal<"charging" | "full" | "discharging" | "unknown">("unknown");
  const [sshEnabled, setSshEnabled] = createSignal(false);
  const [adbEnabled, setAdbEnabled] = createSignal(false);
  const [mtpEnabled, setMtpEnabled] = createSignal(false);
  const [systemSnapshot, setSystemSnapshot] = createSignal<SystemSnapshot | null>(null);
  const [toastMessage, setToastMessage] = createSignal("");
  const [networkSnapshot, setNetworkSnapshot] = createSignal<NetworkSnapshot>({ interface: null, address: null, connected: false });

  // Animation Node Mirrors & Safe Wrappers
  let pageNode: NodeMirror | undefined;
  let carouselNode: NodeMirror | undefined;
  let toastNode: NodeMirror | undefined;
  let toastFrames = 0;
  let pendingForceQuitToast = "";

  interface CardNodeEntry {
    node: NodeMirror;
    screen: number;
  }
  const cardNodes: Map<number, CardNodeEntry> = new Map();

  const animationsEnabled = () => {
    const val = settingValues().animations;
    return val !== "false" && val !== "off";
  };

  const safeAnimate = (
    node: NodeMirror | undefined | null,
    prop: any,
    to: number | string,
    opts?: any,
  ): number => {
    if (!node || typeof node.id !== "number" || node.id <= 0) return 0;
    try {
      const actualOpts = animationsEnabled() ? opts : { ...(opts || {}), dur: 0 };
      return animate(node, prop, to, actualOpts);
    } catch {
      return 0;
    }
  };


  let armed = false;
  let previousButtons = 0;
  let lastHardwarePoll = 0;
  // The power request is a 4 Hz poll: fast enough to feel immediate, cheap
  // enough to leave the render thread alone.
  let lastPowerPoll = 0;
  // The volume wheel changes the mixer behind the app's back, so the settings
  // rows are re-read while that page is visible.
  let lastSettingsPoll = 0;
  let zlHoldFrames = 0;
  let zrHoldFrames = 0;

  // -------------------------------------------------------------------------
  // Toast & Animation Helpers
  // -------------------------------------------------------------------------
  // Every visible string goes through this dictionary; `language` is a signal,
  // so a LANGUAGE change re-renders the whole panel without reloading.
  const t = (key: string, vars?: Record<string, string | number>) => translator(language())(key, vars);

  const showToast = (message: string) => {
    try {
      setToastMessage(message);
      toastFrames = 80; // ~1.3s at 60fps
      safeAnimate(toastNode, "opacity", 1, { dur: 100, easing: "out" });
      safeAnimate(toastNode, "translateY", 0, { dur: 120, easing: "out" });
    } catch {
      // ignore
    }
  };

  const games = createMemo(() => {
    libraryRevision();
    return getAppsForScreen(0, host);
  });
  const currentApps = () => games();
  const isCarouselScreen = () => currentScreen() === 0;
  const currentCardIndex = () => homeCardIndex();

  const updateCardPosition = (idx: number, smooth = true) => {
    try {
      const targetX = currentApps().length >= 5 ? CAROUSEL_OFFSET_5 : CAROUSEL_OFFSET_LESS(idx);
      if (carouselNode) {
        if (smooth) {
          safeAnimate(carouselNode, "translateX", targetX, { dur: 220, easing: "out" });
        } else {
          safeAnimate(carouselNode, "translateX", targetX, { dur: 0 });
        }
      }
    } catch {
      // ignore
    }
  };

  // Three panels: APPS (0), SETTINGS (3), SYSTEM (4).
  const SCREENS: number[] = [0, 3, 4];
  const switchScreen = (target: number, direction: number) => {
    try {
      const next = SCREENS.includes(target) ? target : 0;
      if (next === currentScreen()) return;

      if (next === 0) setLibraryRevision((revision) => revision + 1);
      setCurrentScreen(next);
      setHomeCardIndex(0);
      setCarouselCenter(0);
      carouselResetAt = 0;

      if (next === 0) {
        updateCardPosition(currentCardIndex(), false);
      }

      safeAnimate(pageNode, "translateX", direction * 24, { dur: 0 });
      safeAnimate(pageNode, "translateX", 0, { dur: 200, easing: "out" });
      safeAnimate(pageNode, "opacity", 1, { dur: 180, easing: "out" });
      if (next === 3) {
        syncSettings();
        lastSettingsPoll = Date.now();
      } else if (next === 4) {
        syncSystemStatus();
      }
    } catch {
      // ignore
    }
  };

  const moveCard = (delta: number) => {
    const apps = currentApps();
    if (apps.length === 0) return;
    const cur = currentCardIndex();
    const next = apps.length >= 5 ? (cur + delta + apps.length) % apps.length : Math.max(0, Math.min(apps.length - 1, cur + delta));
    if (next === cur) return;
    if (carouselResetAt) {
      setCarouselCenter(cur);
      updateCardPosition(cur, false);
      carouselResetAt = 0;
    }
    setHomeCardIndex(next);
    if (apps.length >= 5) {
      safeAnimate(carouselNode, "translateX", CAROUSEL_OFFSET_5 - delta * CAROUSEL_STEP, { dur: 220, easing: "out" });
      carouselResetAt = Date.now() + 220;
    } else updateCardPosition(next, true);
  };

  // -------------------------------------------------------------------------
  // Host Bridge Actions
  // -------------------------------------------------------------------------
  // Real hardware status for the top bar: battery %, Wi-Fi association and the
  // live IPv4 address. Falls back to "--" / -1 when the bridge cannot answer,
  // never to a made-up number.
  const syncHardwareStatus = () => {
    if (!host?.__launcher) return;
    const batteryText = host.__launcher("LEVEL\tbattery").trim();
    const battery = /^\d+$/.test(batteryText) ? Number(batteryText) : -1;
    setBatteryLevel(Number.isFinite(battery) && battery >= 0 && battery <= 100 ? battery : -1);
    const power = host.__launcher("LEVEL\tbattery-status").trim();
    setBatteryStatus(["charging", "full", "discharging"].includes(power) ? power as "charging" | "full" | "discharging" : "unknown");
    const network = parseNetworkSnapshot(host.__launcher("LEVEL\tip") ?? "", host.__launcher("LEVEL\twifi") ?? "");
    setNetworkSnapshot(network);
    const wifiState = host.__launcher("STATE\twifi").trim().toLowerCase();
    if (["1", "true", "on", "enabled", "yes"].includes(wifiState)) setWifiEnabled(true);
    else if (["0", "false", "off", "disabled", "no"].includes(wifiState)) setWifiEnabled(false);
    const bluetoothState = host.__launcher("STATE\tbluetooth").trim().toLowerCase();
    if (["1", "true", "on", "enabled", "yes"].includes(bluetoothState)) setBluetoothEnabled(true);
    else if (["0", "false", "off", "disabled", "no"].includes(bluetoothState)) setBluetoothEnabled(false);
    setIpAddress(network.address ?? "--");
    // settings row and SYSTEM page must agree, so both read the same source:
    // the service state the settings toggle writes and re-reads.
    const flag = (value: string) => ["1", "true", "on", "enabled", "yes"].includes(value.trim().toLowerCase());
    setSshEnabled(flag(host.__launcher("STATUS\tssh")) || flag(host.__launcher("STATE\tssh")));
    setAdbEnabled(flag(host.__launcher("STATUS\tadb")) || flag(host.__launcher("STATE\tadbusb")));
    setMtpEnabled(host.__launcher("STATUS\tusb").trim() === "file_transfer");
  };
  const operationSucceeded = (result: string | undefined) => !!result?.trim() && !/(failed|error|invalid|unable|unsupported)/i.test(result);
  const syncSystemStatus = () => {
    setSystemSnapshot(parseSystemSnapshot(host?.__launcher?.("SYSTEM") ?? ""));
  };

  // Every settings row reads and writes through the bridge map: the unified
  // SETTING protocol first, the device runtime's per-key commands as fallback.
  const readRow = (key: string) => readSetting(host, key);

  // The codec reports its maximum for ~100ms while a tone is streaming, so a
  // poll taken mid-beep looked like a jump to 100% (both when raising and when
  // lowering the level). A real adjustment moves 5% per detent, so any single
  // poll that jumps by more than three detents is a transient: hold the
  // previous value until the same number is read twice.
  const pendingLevel: Partial<Record<"brightness" | "volume", number>> = {};
  const settleLevel = (key: "brightness" | "volume", value: number | null) => {
    if (value === null) return null;
    const previous = key === "volume" ? volume() : brightness();
    if (previous === null) return value;
    if (Math.abs(value - previous) <= 30) {
      delete pendingLevel[key];
      return value;
    }
    if (pendingLevel[key] === value) {
      delete pendingLevel[key];
      return value;
    }
    pendingLevel[key] = value;
    return previous;
  };

  const level = (raw: string | null | undefined) => {
    const value = Number(raw);
    return raw !== null && raw !== undefined && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
  };

  const syncSettings = () => {
    const next: Record<string, string | null> = {};
    for (const row of SETTING_ROWS) next[row.key] = readRow(row.key);
    const lang = next["language"];
    if (lang && ["en", "zh", "ja"].includes(lang)) setLanguage(lang);
    const savedTimeout = next["timeout"];
    const timeoutAt = TIMEOUT_OPTIONS.findIndex((option) => option.value === savedTimeout);
    if (timeoutAt >= 0) setTimeoutIndex(timeoutAt);
    const savedPower = next["autoPoweroff"];
    const powerAt = AUTO_POWEROFF_OPTIONS.findIndex((option) => option.value === savedPower);
    if (powerAt >= 0) setAutoPoweroffIndex(powerAt);
    const brightness = settleLevel("brightness", level(next["brightness"]));
    const volumeLevel = settleLevel("volume", level(next["volume"]));
    if (brightness !== null) next["brightness"] = String(brightness);
    if (volumeLevel !== null) next["volume"] = String(volumeLevel);
    setSettingValues(next);
    setBrightness(brightness);
    setVolume(volumeLevel);
    setWifiEnabled(parseToggle(next["wifi"] ?? undefined));
    setBluetoothEnabled(parseToggle(next["bluetooth"] ?? undefined) ?? false);
  };

  // Floating OSD for Volume and Brightness
  const [osd, setOsd] = createSignal<{ visible: boolean; type: "brightness" | "volume"; value: number }>({
    visible: false,
    type: "brightness",
    value: 50,
  });
  let osdTimer: any = null;

  const showOsd = (type: "brightness" | "volume", value: number) => {
    if (osdTimer) clearTimeout(osdTimer);
    setOsd({ visible: true, type, value: Math.max(0, Math.min(100, Math.round(value))) });
    osdTimer = setTimeout(() => {
      setOsd((curr) => ({ ...curr, visible: false }));
    }, 1500);
  };

  // Brightness and volume can change through hardware controls. Poll just
  // these two values between full settings refreshes: a full pass reads every
  // row and can spawn several helpers on the render thread.
  const syncLevels = () => {
    const prevB = brightness();
    const prevV = volume();
    const nextBrightness = settleLevel("brightness", level(readRow("brightness")));
    const nextVolume = settleLevel("volume", level(readRow("volume")));
    if (prevB !== null && nextBrightness !== null && prevB !== nextBrightness) {
      showOsd("brightness", nextBrightness);
    }
    if (prevV !== null && nextVolume !== null && prevV !== nextVolume) {
      showOsd("volume", nextVolume);
    }
    setBrightness(nextBrightness);
    setVolume(nextVolume);
    const brightnessText = nextBrightness === null ? null : String(nextBrightness);
    const volumeText = nextVolume === null ? null : String(nextVolume);
    setSettingValues((current) => current.brightness === brightnessText && current.volume === volumeText
      ? current : { ...current, brightness: brightnessText, volume: volumeText });
  };

  // Auto-sync NTP time when Wi-Fi connects
  createEffect(() => {
    if (networkSnapshot().connected) {
      writeSetting(host, "ntp", "sync");
    }
  });

  const changeLevel = (key: "brightness" | "volume", delta: number) => {
    const current = key === "brightness" ? brightness() : volume();
    if (current === null) {
      showToast(t("common.failed"));
      return;
    }
    const floor = key === "brightness" ? 5 : 0;
    const next = Math.max(floor, Math.min(100, current + delta));
    const saved = writeSetting(host, key, String(next));
    syncLevels();
    if (saved === null) showToast(t("common.failed"));
    else {
      showOsd(key, next);
    }
  };

  const setLevel = (key: "brightness" | "volume", rawValue: number) => {
    const value = Math.max(key === "brightness" ? 5 : 0, Math.min(100, Math.round(rawValue)));
    const saved = writeSetting(host, key, String(value));
    syncLevels();
    if (saved === null) showToast(t("common.failed"));
    else {
      showOsd(key, value);
    }
  };

  const toggleRow = (key: string) => {
    const current = parseToggle(settingValues()[key] ?? undefined);
    // An unreadable row must not flip: there is no state to invert.
    if (current === null) {
      showToast(t("common.failed"));
      return;
    }
    const saved = writeSetting(host, key, current ? "off" : "on");
    syncSettings();
    showToast(saved === "starting"
      ? t("toast.bluetoothStarting")
      : saved === "reboot-required"
      ? t("toast.rebootRequired")
      : saved === null
      ? t("common.failed")
      : t("toast.service", { name: t(`settings.${key}`), state: t(parseToggle(saved) ? "common.on" : "common.off") }));
  };

  // -------------------------------------------------------------------------
  // Wi-Fi picker (scan → choose → passphrase → connect)
  //
  // The bridge owns supplicant, credentials and DHCP; this screen owns the
  // state machine and nothing else. Every answer is parsed by wifi-model.ts so
  // the awkward cases (pre-2.0 prose, hidden SSIDs, `error:` prefixes) are
  // decided in one tested place.
  // -------------------------------------------------------------------------
  const [wifiOpen, setWifiOpen] = createSignal(false);
  const [wifiRows, setWifiRows] = createSignal<WifiNetwork[]>([]);
  const [wifiIndex, setWifiIndex] = createSignal(0);
  const [wifiStatus, setWifiStatus] = createSignal("");
  const [wifiPskFor, setWifiPskFor] = createSignal("");
  const [wifiPsk, setWifiPsk] = createSignal("");
  const [wifiPhase, setWifiPhase] = createSignal<WifiPhase>("scanning");

  // The passphrase keyboard. Created here rather than in the page so its buffer
  // survives the page unmounting mid-connect; a masked field in the page shows
  // the dots and calls open().
  const wifiOsk = createOsk({
    value: () => wifiPsk(),
    setValue: (value) => setWifiPsk(value),
    onCommit: () => submitWifiPsk(),
    maxLength: 63,
    // The panel closes itself on commit by default, which would dismiss the
    // keyboard before the bridge answers. A rejected passphrase must leave it
    // up, so the close happens only on success (see runWifiConnect).
    closeOnCommit: false,
    // B/× on the keyboard cancels the prompt outright, matching the hint.
    onClose: () => {
      setWifiPskFor("");
      setWifiPsk("");
      setWifiStatus("");
      setWifiPhase("list");
    },
  });
  // `WIFI saved` does not exist before Wi-Fi 2.0; the parser reports that, and
  // the flag keeps a scan on an older runtime from re-asking every time.
  let wifiSavedSupported = true;

  // `WIFI scan` blocks its caller for up to six seconds, and `__launcher` runs
  // on the render thread. The frame loop starts the call only after the
  // scanning frame has painted, so the panel is never frozen on a blank page.
  let scanRequested = false;

  const readWifiSaved = (): string[] => {
    // One probe per session: a runtime does not gain Wi-Fi 2.0 mid-boot, and
    // each of these is a round trip on the render thread.
    if (!wifiSavedSupported) return [];
    const parsed = parseSaved(host?.__launcher?.("WIFI\tsaved") ?? "");
    wifiSavedSupported = parsed.supported;
    return parsed.ssids;
  };

  const readWifiStatus = () => parseStatus(host?.__launcher?.("WIFI\tstatus") ?? "");


  const scanWifi = () => {
    setWifiRows([]);
    setWifiIndex(0);
    setWifiPskFor("");
    setWifiPsk("");
    setWifiStatus("");
    setWifiPhase("scanning");
    scanRequested = true;
  };

  const runWifiScan = () => {
    scanRequested = false;
    const selectedSsid = wifiRows()[wifiIndex()]?.ssid;
    const saved = readWifiSaved();
    const { ssid } = readWifiStatus();
    const result = parseScan(host?.__launcher?.("WIFI\tscan") ?? "", saved, ssid);
    if (!result.ok) {
      setWifiStatus(t(result.reason === "supplicant" ? "wifi.noSupplicant" : "wifi.scanFailed"));
      setWifiPhase("list");
      return;
    }
    setWifiRows(result.networks);
    // Sorting moves rows whenever association or signal changes, so the
    // selection follows the SSID it was on rather than the row number.
    const keep = selectedSsid ? result.networks.findIndex((row) => row.ssid === selectedSsid) : -1;
    setWifiIndex(keep >= 0 ? keep : 0);
    setWifiStatus(result.networks.length ? "" : t("wifi.empty"));
    setWifiPhase("list");
  };

  const openWifiPanel = () => {
    setWifiOpen(true);
    scanWifi();
  };

  // `WIFI connect` blocks for up to ten seconds inside the bridge, on the same
  // thread that renders. Like the scan, it is requested here and issued from the
  // frame loop, so the "connecting" panel is on screen before the call starts.
  let connectRequest: { ssid: string; psk: string } | null = null;

  const connectWifi = (ssid: string, psk: string) => {
    if (!host?.__launcher) {
      setWifiStatus(t("wifi.noBridge"));
      return;
    }
    setWifiPhase("connecting");
    setWifiStatus(t("wifi.connecting"));
    connectRequest = { ssid, psk };
  };

  const runWifiConnect = () => {
    const request = connectRequest;
    connectRequest = null;
    if (!request || !host?.__launcher) return;
    const { ssid, psk } = request;
    const outcome = parseConnectResult(host.__launcher(`WIFI\tconnect\t${ssid}\t${psk}`));
    switch (outcome.kind) {
      case "connected": {
        setWifiPskFor("");
        setWifiPsk("");
        setWifiStatus(t("wifi.connected", { ssid: outcome.ssid || ssid }));
        setWifiEnabled(true);
        wifiOsk.close();
        syncHardwareStatus();
        runWifiScan();
        return;
      }
      case "need-psk":
        setWifiPskFor(ssid);
        setWifiStatus(t("wifi.needPsk"));
        setWifiPhase("psk");
        wifiOsk.open();
        return;
      case "auth-failed":
        setWifiStatus(t("wifi.authFailed"));
        break;
      case "not-found":
        setWifiStatus(t("wifi.notFound"));
        break;
      case "timeout":
        setWifiStatus(t("wifi.timeout"));
        break;
      default:
        setWifiStatus(outcome.detail);
    }
    // A failed attempt keeps the passphrase prompt and its text, so a typo is
    // one edit away, and leaves the keyboard up: it is still the field being
    // edited, so closing it here would undo the retry.
    if (wifiPskFor()) setWifiPhase("psk");
    else setWifiPhase("list");
  };

  const activateWifiRow = (index = wifiIndex()) => {
    const row = wifiRows()[index];
    if (!row) return;
    // Already associated: selecting it is not a request to reconnect, and the
    // supplicant would spend ten seconds re-running a handshake it already has.
    if (row.active) return;
    if (row.security === "open") {
      connectWifi(row.ssid, "");
      return;
    }
    setWifiPskFor(row.ssid);
    setWifiPsk("");
    setWifiStatus("");
    setWifiPhase("psk");
    wifiOsk.open();
  };

  const submitWifiPsk = () => {
    const ssid = wifiPskFor();
    if (!ssid) return;
    const issue = pskIssue(wifiPsk());
    if (issue) {
      // Refusing locally saves a 10-second bridge round trip and keeps the
      // supplicant from logging a failed handshake for a typo.
      setWifiStatus(t(issue === "empty" ? "wifi.needPsk" : issue === "short" ? "wifi.pskShort" : issue === "long" ? "wifi.pskLong" : "wifi.pskAscii"));
      return;
    }
    connectWifi(ssid, wifiPsk());
  };

  const forgetWifi = (ssid: string) => {
    const raw = host?.__launcher?.(`WIFI\tforget\t${ssid}`) ?? "";
    if (!raw.startsWith("ok")) {
      setWifiStatus(t("common.failed"));
      return;
    }
    setWifiStatus(t("wifi.forgot", { ssid }));
    runWifiScan();
  };

  const disconnectWifi = () => {
    const raw = host?.__launcher?.("WIFI\tdisconnect") ?? "";
    if (!raw.startsWith("ok")) {
      setWifiStatus(t("common.failed"));
      return;
    }
    setWifiStatus(t("wifi.disconnected"));
    syncHardwareStatus();
    runWifiScan();
  };

  // Returns true when the open Wi-Fi panel consumed the input.
  const wifiKey = (dir: number | 0, action: "up" | "down" | "ok" | "back") => {
    if (!wifiOpen()) return false;
    if (wifiPhase() === "psk") {
      // The keyboard owns typing. B cancels the prompt outright (the same path
      // as its own ×), A commits, and both leave the list underneath intact.
      if (action === "back") wifiOsk.cancel();
      else if (action === "ok") submitWifiPsk();
      return true;
    }
    if (action === "back") {
      setWifiOpen(false);
      return true;
    }
    if (wifiPhase() === "scanning" || wifiPhase() === "connecting") return true;
    if (action === "up") setWifiIndex((p) => Math.max(0, p - 1));
    else if (action === "down") setWifiIndex((p) => Math.min(Math.max(0, wifiRows().length - 1), p + 1));
    else if (action === "ok") activateWifiRow();
    return true;
  };

  // -------------------------------------------------------------------------
  // Bluetooth picker (scan → pair/connect → forget)
  //
  // Same shape as the Wi-Fi panel: the bridge owns BlueZ, this file owns the
  // phase, and every answer is parsed by bluetooth-model.ts.
  // -------------------------------------------------------------------------
  const [btOpen, setBtOpen] = createSignal(false);
  const [btDevices, setBtDevices] = createSignal<BtDevice[]>([]);
  const [btIndex, setBtIndex] = createSignal(0);
  const [btStatus, setBtStatus] = createSignal("");
  const [btPhase, setBtPhase] = createSignal<BtPhase>("scanning");
  const [btPowered, setBtPowered] = createSignal<boolean | null>(null);
  let btScanRequested = false;

  const scanBluetooth = () => {
    setBtDevices([]);
    setBtIndex(0);
    setBtStatus("");
    setBtPhase("scanning");
    btScanRequested = true;
  };

  const runBluetoothScan = () => {
    btScanRequested = false;
    const status = parseBtStatus(host?.__launcher?.("BT\tstatus") ?? "");
    setBtPowered(status.powered);
    if (status.powered === false) {
      setBtPhase("list");
      setBtStatus(t("bt.off"));
      return;
    }
    const result = parseBtScan(host?.__launcher?.("BT\tscan") ?? "");
    if (!result.ok) {
      setBtStatus(t(result.reason === "bluez" ? "bt.off" : "common.failed"));
      setBtPhase("list");
      return;
    }
    setBtDevices(result.devices);
    setBtStatus(result.devices.length ? "" : t("bt.empty"));
    setBtPhase("list");
  };

  const openBluetoothPanel = () => {
    setBtOpen(true);
    scanBluetooth();
  };

  const activateBtDevice = (index = btIndex()) => {
    const device = btDevices()[index];
    if (!device) return;
    setBtPhase("connecting");
    setBtStatus(t("bt.connecting"));
    const answer = host?.__launcher?.(`BT\tconnect\t${device.address}`) ?? "";
    if (answer.startsWith("connected")) {
      setBtStatus(t("bt.connected", { name: device.name }));
      setBluetoothEnabled(true);
    } else {
      setBtStatus(t("bt.connectFailed"));
    }
    runBluetoothScan();
  };

  const forgetBtDevice = (address: string) => {
    const answer = host?.__launcher?.(`BT\tforget\t${address}`) ?? "";
    setBtStatus(answer.startsWith("ok") ? "" : t("common.failed"));
    runBluetoothScan();
  };

  const disconnectBtDevice = (address: string) => {
    const answer = host?.__launcher?.(`BT\tdisconnect\t${address}`) ?? "";
    setBtStatus(answer.startsWith("ok") ? "" : t("common.failed"));
    runBluetoothScan();
  };

  const btKey = (action: "up" | "down" | "ok" | "back") => {
    // Back is never gated: a picker the user cannot leave is a trap, even while
    // a scan is still running (its answer is discarded when the panel closes).
    if (action === "back") {
      setBtOpen(false);
      return;
    }
    if (btPhase() === "scanning" || btPhase() === "connecting") return;
    if (action === "up") setBtIndex((p) => Math.max(0, p - 1));
    else if (action === "down") setBtIndex((p) => Math.min(Math.max(0, btDevices().length - 1), p + 1));
    else if (action === "ok") activateBtDevice();
  };

  const toggleBluetooth = () => {
    setBluetoothEnabled(!bluetoothEnabled());
    syncSettings();
  };

  const cycleLanguage = (direction: -1 | 1) => {
    const order = ["en", "zh", "ja"];
    const next = order[(order.indexOf(language()) + direction + order.length) % order.length];
    const saved = writeSetting(host, "language", next);
    if (saved && order.includes(saved)) setLanguage(saved);
    syncSettings();
  };

  const cycleTimeout = (delta: number) => {
    const nextIdx = (timeoutIndex() + delta + TIMEOUT_OPTIONS.length) % TIMEOUT_OPTIONS.length;
    const saved = writeSetting(host, "timeout", TIMEOUT_OPTIONS[nextIdx].value);
    if (saved) {
      const readback = TIMEOUT_OPTIONS.findIndex((option) => option.value === saved);
      if (readback >= 0) setTimeoutIndex(readback);
    }
    syncSettings();
  };

  const cycleAutoPoweroff = (delta: number) => {
    const nextIdx = (autoPoweroffIndex() + delta + AUTO_POWEROFF_OPTIONS.length) % AUTO_POWEROFF_OPTIONS.length;
    const saved = writeSetting(host, "autoPoweroff", AUTO_POWEROFF_OPTIONS[nextIdx].value);
    if (saved) {
      const readback = AUTO_POWEROFF_OPTIONS.findIndex((option) => option.value === saved);
      if (readback >= 0) setAutoPoweroffIndex(readback);
    }
    syncSettings();
  };

  const [themeColor, setThemeColor] = createSignal<ThemeColorKey>("purple");
  const [fontSize, setFontSize] = createSignal<FontSizeKey>("normal");
  const theme = () => THEME_PALETTES[themeColor()] || THEME_PALETTES.purple;
  const fontConfig = () => FONT_SCALE_CONFIGS[fontSize()] || FONT_SCALE_CONFIGS.normal;

  const cycleThemeColor = (delta: number) => {
    const cur = themeColor();
    const idx = THEME_COLORS.indexOf(cur);
    const next = THEME_COLORS[(idx + delta + THEME_COLORS.length) % THEME_COLORS.length];
    setThemeColor(next);
  };

  const cycleFontSize = (delta: number) => {
    const cur = fontSize();
    const idx = FONT_SIZES.indexOf(cur);
    const next = FONT_SIZES[(idx + delta + FONT_SIZES.length) % FONT_SIZES.length];
    setFontSize(next);
  };

  const adjustSetting = (index: number, direction: -1 | 1) => {
    const row = SETTING_ROWS[index];
    if (!row) return;
    if (row.kind === "level") changeLevel(row.key === "brightness" ? "brightness" : "volume", direction * 5);
    else if (row.kind === "toggle") toggleRow(row.key);
    else if (row.kind === "enum") {
      if (row.key === "fontSize") cycleFontSize(direction);
      else if (row.key === "themeColor") cycleThemeColor(direction);
      else if (row.key === "language") cycleLanguage(direction);
      else if (row.key === "timeout") cycleTimeout(direction);
      else if (row.key === "autoPoweroff") cycleAutoPoweroff(direction);
    }
  };

  const activateSetting = (index: number) => {
    const row = SETTING_ROWS[index];
    if (!row) return;
    if (row.kind === "level") changeLevel(row.key === "brightness" ? "brightness" : "volume", 5);
    else if (row.kind === "toggle") {
      // Wi-Fi and Bluetooth open their pickers (choose a network / device);
      // every other toggle flips in place.
      if (row.key === "wifi") openWifiPanel();
      else if (row.key === "bluetooth") openBluetoothPanel();
      else toggleRow(row.key);
    } else if (row.kind === "enum") {
      if (row.key === "fontSize") cycleFontSize(1);
      else if (row.key === "themeColor") cycleThemeColor(1);
      else if (row.key === "language") cycleLanguage(1);
      else if (row.key === "timeout") cycleTimeout(1);
      else if (row.key === "autoPoweroff") cycleAutoPoweroff(1);
    } else if (row.kind === "action") {
      // The only action row is the power dialog; it is a view, not a bridge call.
      openPowerMenu();
    }
  };

  // -------------------------------------------------------------------------
  // Power menu (long press on the power key)
  // -------------------------------------------------------------------------
  const POWER_COMMANDS: Record<PowerAction, string> = { poweroff: "poweroff", reboot: "reboot" };

  const openPowerMenu = () => {
    setPowerChoice("poweroff");
    setPowerBusy(false);
    setPowerRefused(false);
    setPowerMenuOpen(true);
  };

  // The guest cannot shut the machine down: it asks the bridge and keeps the
  // dialog up while the request runs, so a refused request never looks done.
  const runPowerAction = (action: PowerAction) => {
    const answer = host?.__launcher?.(`POWER\t${POWER_COMMANDS[action]}`) ?? "";
    // The bridge spawns BaseOS's own wrapper and answers "ok:<action>" before the
    // machine goes down, so the dialog can show progress instead of vanishing.
    if (answer.trim() !== `ok:${POWER_COMMANDS[action]}`) {
      setPowerBusy(false);
      setPowerRefused(true);
      return;
    }
    setPowerRefused(false);
    setPowerBusy(true);
  };

  const powerMenuKey = (action: "left" | "right" | "ok" | "back") => {
    if (powerBusy()) return;
    if (action === "left") setPowerChoice("poweroff");
    else if (action === "right") setPowerChoice("reboot");
    else if (action === "ok") runPowerAction(powerChoice());
    else setPowerMenuOpen(false);
  };

  // The list scrolls inside a fixed six-row window, so selection moves freely
  // across every row instead of clamping to what is on screen.
  const moveSettingsSelection = (delta: -1 | 1) =>
    setSettingsIndex((index) => Math.max(0, Math.min(SETTINGS_COUNT - 1, index + delta)));

  // Terminal state and Virtual Keyboard controller
  const [terminalOpen, setTerminalOpen] = createSignal(false);
  const [terminalInput, setTerminalInput] = createSignal("");
  const [terminalLines, setTerminalLines] = createSignal<string[]>([
    "BaseOS Linux 5.10.110 (aarch64 rg34xx)",
    "Type commands to test virtual keyboard.",
    "Commands: help, uname, date, whoami, uptime, df, free, ip, clear, exit",
    "----------------------------------------",
  ]);

  const runTerminalCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    const history = [...terminalLines(), `root@rg34xx:~# ${cmd}`];
    const parts = cmd.split(/\s+/);
    const bin = parts[0].toLowerCase();
    if (bin === "clear") {
      setTerminalLines([]);
      setTerminalInput("");
      return;
    }
    if (bin === "exit") {
      setTerminalOpen(false);
      setTerminalInput("");
      return;
    }
    if (bin === "help") {
      history.push(
        "Available commands:",
        "  help      - Show this help summary",
        "  uname -a  - Kernel and hardware architecture",
        "  whoami    - Current logged-in user",
        "  date      - Current system date and time",
        "  uptime    - System uptime and load",
        "  df -h     - Disk storage filesystem usage",
        "  free -m   - Physical memory RAM usage",
        "  ip / addr - Network IPv4 interface address",
        "  echo [s]  - Print arguments",
        "  clear     - Clear terminal buffer",
        "  exit      - Close terminal and return to launcher"
      );
    } else if (bin === "uname") {
      history.push("Linux rg34xx 5.10.110-rockchip aarch64 GNU/Linux");
    } else if (bin === "whoami") {
      history.push("root");
    } else if (bin === "date") {
      history.push(new Date().toString());
    } else if (bin === "uptime") {
      history.push("up 4 hours, load average: 0.18, 0.22, 0.15");
    } else if (bin === "df") {
      history.push(
        "Filesystem      Size  Used Avail Use% Mounted on",
        "/dev/root       1.8G  1.2G  520M  70% /",
        "/dev/mmcblk0p2   58G   12G   44G  22% /storage"
      );
    } else if (bin === "free") {
      const r = systemSnapshot()?.ramVariant || "1024 MB";
      history.push(
        "              total        used        free      shared  buff/cache   available",
        `Mem:           ${r}      380 MB      490 MB       12 MB      154 MB      580 MB`,
        "Swap:             0B          0B          0B"
      );
    } else if (bin === "ip" || bin === "ifconfig" || bin === "addr") {
      const net = networkSnapshot();
      history.push(
        `wlan0: inet ${net.address || "unavailable"} netmask 255.255.255.0 broadcast 255.255.255.255`,
        `status: ${net.connected ? "CONNECTED" : "DISCONNECTED"}`
      );
    } else if (bin === "echo") {
      history.push(parts.slice(1).join(" "));
    } else {
      history.push(`bash: ${bin}: command not found`);
    }
    if (history.length > 13) {
      setTerminalLines(history.slice(history.length - 13));
    } else {
      setTerminalLines(history);
    }
    setTerminalInput("");
  };

  const terminalOsk = createOsk({
    value: () => terminalInput(),
    setValue: (val) => setTerminalInput(val),
    onCommit: () => {
      runTerminalCommand(terminalInput());
      terminalOsk.close();
    },
    maxLength: 64,
    closeOnCommit: true,
    onClose: () => {},
  });

  const launchApp = (app: LauncherApp) => {
    if (app.id === "terminal") {
      setTerminalOpen(true);
      return;
    }
    showToast(t("toast.launch", { name: appShortName(t, app) }));
    if (app.kind === "native") {
      const rom = app.romPath;
      if (rom) {
        const answer = host?.__launcher?.(`ROMLAUNCH\t${rom}`) ?? "";
        if (!answer || /unknown/i.test(answer)) {
          const legacy = host?.__launcher?.(`ROM\tlaunch\t${rom}`) ?? "";
          if (!/^launching:/i.test(legacy)) showToast(language() === "zh" ? "游戏启动失败" : "Unable to start game");
        } else if (!/^(Starting game|launching:)/i.test(answer)) {
          showToast(language() === "zh" ? "游戏启动失败" : "Unable to start game");
        }
      } else {
        const answer = host?.__launcher?.(`LAUNCH\t${app.id}`) ?? "";
        if (!answer || /error|unknown|unable/i.test(answer)) showToast(language() === "zh" ? "应用启动失败" : "Unable to start app");
      }
      return;
    }

    // PocketFetch is this program's own screen, not a child process: closing the
    // launcher opens it and re-polls the bridge, so nothing is handed to the host.
    setLauncherOpen(false);
    syncSettings();
    syncHardwareStatus();
    syncSystemStatus();
  };


  const activateCurrent = () => {
    const s = currentScreen();
    if (s <= 2 || s === 5) {
      const apps = currentApps();
      const app = apps[currentCardIndex()];
      if (app) launchApp(app);
      return;
    }
  };

  const refreshPocketFetch = () => {
    syncSettings();
    syncHardwareStatus();
    syncSystemStatus();
  };

  const confirmCurrent = () => {
    if (btOpen()) { btKey("ok"); return; }
    if (wifiOpen()) { wifiKey(0, "ok"); return; }
    if (!launcherOpen()) { refreshPocketFetch(); return; }
    if (currentScreen() === 3) activateSetting(settingsIndex());
    else activateCurrent();
  };

  const syncFavorites = () => {
    const result = host?.__launcher?.("FAVORITES\tlist") ?? "";
    setFavorites(result.split("\n").filter((path) => path.startsWith("/")));
  };

  const toggleFavorite = () => {
    const path = selectedApp()?.romPath;
    if (!path) return;
    const result = host?.__launcher?.(`FAVORITES\ttoggle\t${path}`) ?? "";
    if (result === "added" || result === "removed") {
      syncFavorites();
      setHomeCardIndex(0);
      setCarouselCenter(0);
      carouselResetAt = 0;
      updateCardPosition(0, false);
    } else showToast(language() === "zh" ? "收藏保存失败" : "Could not save favorite");
    setGameOptionsOpen(false);
  };


  onMount(() => {
    // One pass fills every settings row, the language and the screen timeout —
    // they all come from the same bridge map.
    syncSettings();
    syncFavorites();
    const closedApp = host?.__launcher?.("FORCEQUIT")?.trim() ?? "";
    if (/^[a-zA-Z0-9._-]{1,64}$/.test(closedApp)) {
      const app = LAUNCHER_APPS.find((entry) => entry.id === closedApp);
      pendingForceQuitToast = t("toast.forceQuit", { name: closedApp === "game" ? t("toast.game") : appName(t, app) || t("toast.app") });
    }
    syncHardwareStatus();
    lastHardwarePoll = Date.now();

    onTextEvent((event: TextEvent) => {
      if (gameOptionsOpen() && event.kind === "key" && event.pressed) {
        if (event.key === "Enter") toggleFavorite();
        else if (event.key === "Escape") setGameOptionsOpen(false);
        return true;
      }
      if (powerMenuOpen() && event.kind === "key" && event.pressed) {
        if (event.key === "ArrowLeft") powerMenuKey("left");
        else if (event.key === "ArrowRight") powerMenuKey("right");
        else if (event.key === "Enter" || event.key === " ") powerMenuKey("ok");
        else if (event.key === "Escape") powerMenuKey("back");
        return true;
      }
      if (btOpen() && event.kind === "key" && event.pressed) {
        if (event.key === "Escape") btKey("back");
        else if (event.key === "ArrowUp") btKey("up");
        else if (event.key === "ArrowDown") btKey("down");
        else if (event.key === "Enter" || event.key === " ") btKey("ok");
        return true;
      }
      if (wifiOpen() && event.kind === "key" && event.pressed) {
        const action =
          event.key === "ArrowUp" ? "up" :
          event.key === "ArrowDown" ? "down" :
          event.key === "Enter" || event.key === " " ? "ok" :
          event.key === "Escape" ? "back" : "";
        if (action) {
          wifiKey(0, action as "up" | "down" | "ok" | "back");
          return;
        }
      }
      if (launcherOpen()) {
        if (event.kind === "key" && event.pressed) {
          if (event.key === "ArrowLeft") {
            if (isCarouselScreen()) moveCard(-1);
            else if (currentScreen() === 3) adjustSetting(settingsIndex(), -1);
            else if (currentScreen() === 4) {
              setSystemPageIndex((p) => (p + SYSTEM_PAGES.length - 1) % SYSTEM_PAGES.length);
            }
          } else if (event.key === "ArrowRight") {
            if (isCarouselScreen()) moveCard(1);
            else if (currentScreen() === 3) adjustSetting(settingsIndex(), 1);
            else if (currentScreen() === 4) {
              setSystemPageIndex((p) => (p + 1) % SYSTEM_PAGES.length);
            }
          } else if (event.key === "ArrowUp") {
            if (currentScreen() === 3) moveSettingsSelection(-1);
            else if (currentScreen() === 4) setSystemPageIndex((p) => (p + SYSTEM_PAGES.length - 1) % SYSTEM_PAGES.length);
          } else if (event.key === "ArrowDown") {
            if (currentScreen() === 3) moveSettingsSelection(1);
            else if (currentScreen() === 4) setSystemPageIndex((p) => (p + 1) % SYSTEM_PAGES.length);
          } else if (event.key === "Enter") {
            confirmCurrent();
          } else if (event.key === "Escape") {
            if (currentScreen() !== 0) switchScreen(0, -1);
          } else if (event.key === "PageUp") {
            switchScreen(SCREENS[(SCREENS.indexOf(currentScreen()) + SCREENS.length - 1) % SCREENS.length], -1);
          } else if (event.key === "PageDown") {
            switchScreen(SCREENS[(SCREENS.indexOf(currentScreen()) + 1) % SCREENS.length], 1);
          }
        }
        return true;
      }

      // The keyboard escape key is a back action on PocketFetch.
      if (event.kind !== "key" || !event.pressed) return true;
      if (event.key === "Escape") setLauncherOpen(true);
      return true;
    });
  });

  onFrame((buttons: number) => {
    if (buttons === 0) armed = true;

    // A bridge scan blocks its own thread, so it runs after the scanning frame
    // has been painted instead of inside the key handler. A connect is deferred
    // the same way: its "connecting" panel must be on screen before the call.
    if (scanRequested) runWifiScan();
    // A BlueZ scan also blocks, so it runs after the scanning frame too.
    if (btScanRequested) runBluetoothScan();
    if (connectRequest) runWifiConnect();

    // Poll on elapsed time so the visible page remains live at any frame rate.
    const now = Date.now();
    if (carouselResetAt && now >= carouselResetAt) {
      carouselResetAt = 0;
      setCarouselCenter(currentCardIndex());
      updateCardPosition(currentCardIndex(), false);
    }
    // Long power press: baseos-hotkeys writes /run/power-menu.request instead of
    // cutting power. The bridge consumes the marker, so one press = one dialog.
    if (now - lastPowerPoll >= 250 && !powerMenuOpen() && !powerBusy()) {
      lastPowerPoll = now;
      if ((host?.__launcher?.("POWER\tmenu") ?? "").trim() === "menu") openPowerMenu();
    }

    if (now - lastHardwarePoll >= 5000) {
      lastHardwarePoll = now;
      if (currentScreen() === 4) syncSystemStatus();
      syncHardwareStatus();
      // Volume is a system-wide value: the wheel, the settings row and any
      // future hotkey all move the same mixer, so the cached signal has to
      // follow it even while another page is visible.
      if (currentScreen() === 3) { syncSettings(); lastSettingsPoll = now; }
      else syncLevels();
    }

    if (currentScreen() === 3 && now - lastSettingsPoll >= 400) {
      lastSettingsPoll = now;
      syncLevels();
    }

    if (pendingForceQuitToast && toastNode) {
      showToast(pendingForceQuitToast);
      pendingForceQuitToast = "";
    }

    // Advance frame-driven toast
    if (toastFrames > 0) {
      toastFrames--;
      if (toastFrames === 0) {
        safeAnimate(toastNode, "opacity", 0, { dur: 250, easing: "out" });
        safeAnimate(toastNode, "translateY", 6, { dur: 250, easing: "out" });
      }
    }

    if (!armed) {
      previousButtons = buttons;
      return;
    }
    const pressed = buttons & ~previousButtons;
    previousButtons = buttons;

    // -----------------------------------------------------------------------
    // Native Switch Launcher Input Mode
    // -------------------------------------------------------------------------

    if (powerMenuOpen()) {
      // The dialog is modal: it takes the pad before any page sees it.
      if (pressed & BTN.LEFT) powerMenuKey("left");
      else if (pressed & BTN.RIGHT) powerMenuKey("right");
      else if (pressed & BTN.CIRCLE) powerMenuKey("ok");
      else if (pressed & BTN.CROSS) powerMenuKey("back");
      return;
    }
    if (gameOptionsOpen()) {
      if (pressed & BTN.CIRCLE) toggleFavorite();
      else if (pressed & (BTN.CROSS | BTN.START)) setGameOptionsOpen(false);
      return;
    }
    if (wifiOpen()) {
      // While the passphrase keyboard is up it owns every button (START commits,
      // × cancels, □ backspaces), so the page must not also react to them.
      if (wifiOsk.isOpen()) return;
      if (pressed & BTN.UP) wifiKey(0, "up");
      else if (pressed & BTN.DOWN) wifiKey(0, "down");
      else if (pressed & BTN.CIRCLE) wifiKey(0, "ok");
      else if (pressed & BTN.CROSS) wifiKey(0, "back");
      // □ rescan, △ acts on the selected row (disconnect / forget). The panel
      // has no touch controller, so the footer's touch targets need a pad path.
      else if (pressed & BTN.SQUARE) scanWifi();
      else if (pressed & BTN.TRIANGLE) {
        const row = wifiRows()[wifiIndex()];
        if (wifiPhase() !== "list" || !row) return;
        if (row.active) disconnectWifi();
        else if (row.saved) forgetWifi(row.ssid);
      }
      return;
    }
    if (btOpen()) {
      // The picker owns the pad while it is up: B always closes it (even mid
      // scan), □ rescans, △ forgets/disconnects the selected device.
      if (pressed & BTN.CROSS) {
        btKey("back");
        return;
      }
      if (pressed & BTN.UP) btKey("up");
      else if (pressed & BTN.DOWN) btKey("down");
      else if (pressed & BTN.CIRCLE) btKey("ok");
      else if (pressed & BTN.SQUARE) scanBluetooth();
      else if (pressed & BTN.TRIANGLE) {
        const device = btDevices()[btIndex()];
        if (btPhase() !== "list" || !device || !device.paired) return;
        forgetBtDevice(device.address);
      }
      return;
    }
    if (terminalOpen()) {
      if (terminalOsk.isOpen()) return;
      if (pressed & BTN.CIRCLE) {
        terminalOsk.open();
        return;
      }
      if (pressed & BTN.CROSS) {
        setTerminalOpen(false);
        return;
      }
      return;
    }
    if (launcherOpen()) {
      if (pressed & BTN.START && isCarouselScreen() && selectedApp()?.romPath) {
        setGameOptionsOpen(true);
        return;
      }
      // L1 / R1: Category navigation (Apps <-> Settings <-> System)
      if (pressed & BTN.RTRIGGER) {
        switchScreen(SCREENS[(SCREENS.indexOf(currentScreen()) + 1) % SCREENS.length], 1);
        return;
      }
      if (pressed & BTN.LTRIGGER) {
        switchScreen(SCREENS[(SCREENS.indexOf(currentScreen()) + SCREENS.length - 1) % SCREENS.length], -1);
        return;
      }
      // L2 / R2: Brightness adjustment with hold-to-repeat
      if (pressed & BTN.ZL) {
        zlHoldFrames = 0;
        changeLevel("brightness", -5);
      } else if (buttons & BTN.ZL) {
        zlHoldFrames++;
        if (zlHoldFrames > 18 && zlHoldFrames % 6 === 0) {
          changeLevel("brightness", -5);
        }
      } else {
        zlHoldFrames = 0;
      }

      if (pressed & BTN.ZR) {
        zrHoldFrames = 0;
        changeLevel("brightness", 5);
      } else if (buttons & BTN.ZR) {
        zrHoldFrames++;
        if (zrHoldFrames > 18 && zrHoldFrames % 6 === 0) {
          changeLevel("brightness", 5);
        }
      } else {
        zrHoldFrames = 0;
      }
      if (pressed & BTN.LEFT) {
        if (isCarouselScreen()) moveCard(-1);
        else if (currentScreen() === 3) adjustSetting(settingsIndex(), -1);
        else if (currentScreen() === 4) {
          setSystemPageIndex((p) => (p + SYSTEM_PAGES.length - 1) % SYSTEM_PAGES.length);
        }
      }
      if (pressed & BTN.RIGHT) {
        if (isCarouselScreen()) moveCard(1);
        else if (currentScreen() === 3) adjustSetting(settingsIndex(), 1);
        else if (currentScreen() === 4) {
          setSystemPageIndex((p) => (p + 1) % SYSTEM_PAGES.length);
        }
      }
      if (pressed & BTN.UP) {
        if (currentScreen() === 3) moveSettingsSelection(-1);
        else if (currentScreen() === 4) setSystemPageIndex((p) => (p + SYSTEM_PAGES.length - 1) % SYSTEM_PAGES.length);
      }
      if (pressed & BTN.DOWN) {
        if (currentScreen() === 3) moveSettingsSelection(1);
        else if (currentScreen() === 4) setSystemPageIndex((p) => (p + 1) % SYSTEM_PAGES.length);
      }
      if (pressed & BTN.CIRCLE) {
        confirmCurrent();
      }
      if (pressed & BTN.CROSS && currentScreen() !== 0) switchScreen(0, -1);
      return;
    }

    // -----------------------------------------------------------------------
    // PocketFetch Mode: A re-polls the bridge, B goes back.
    // -----------------------------------------------------------------------
    if (pressed & BTN.CIRCLE) {
      confirmCurrent();
      return;
    }
    if (pressed & BTN.CROSS) setLauncherOpen(true);
  });

  const titleLines = (name: string): string[] => {
    const lines: string[] = []; let line = ""; let width = 0;
    for (const word of name.replace(/[-_]+/g, " ").split(/(\s+)/)) {
      const wordWidth = Array.from(word).reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
      if (width + wordWidth > 26 && line.trim()) { lines.push(line.trim()); line = ""; width = 0; }
      for (const c of word) {
        const cw = c.charCodeAt(0) > 255 ? 2 : 1;
        if (width + cw > 26) { lines.push(line.trim()); line = ""; width = 0; }
        line += c; width += cw;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.length <= 2 ? lines : [lines[0], lines.slice(1).join(" ").slice(0, 23) + "…"];
  };

  const selectedApp = () => {
    const apps = currentApps();
    return apps[currentCardIndex()] || apps[0];
  };

  createEffect(() => {
    const path = selectedApp()?.coverPath;
    const node = backgroundNode();
    if (!node || !path || !isCarouselScreen()) {
      safeAnimate(node, "opacity", 0, { dur: 100 });
      setBackgroundReady(false);
      return;
    }
    const handle = libraryTexture(host, path, "background");
    if (handle !== undefined) {
      safeAnimate(node, "opacity", 0, { dur: 60 });
      setTimeout(() => {
        getOps().setImage(node.id, handle);
        setBackgroundReady(true);
        safeAnimate(node, "opacity", 0.16, { dur: 200, easing: "out" });
      }, 60);
    } else {
      safeAnimate(node, "opacity", 0, { dur: 80 });
      setBackgroundReady(false);
    }
  });

  const settingsState = (): SettingsState => ({
    selectedIndex: settingsIndex(),
    language: language(),
    values: settingValues(),
    wifiConnected: networkSnapshot().connected,
    ipAddress: ipAddress(),
    themeColor: themeColor(),
    fontSize: fontSize(),
  });

  return (
    <View class="w-[720px] h-[480px] bg-[#141218] relative flex-col justify-between overflow-hidden">
      <Image ref={(node: NodeMirror) => setBackgroundNode(node)} class="absolute left-0 top-0 w-[720px] h-[480px]" src="pixel-games.png" style={{ opacity: backgroundReady() ? 0.15 : 0 }} />
      {/* The status bar belongs to the program, not to a screen: the launcher and
          PocketFetch are two views of the same device state and share it. */}
      <StatusBar
        currentScreen={currentScreen()}
        language={language()}
        wifiConnected={networkSnapshot().connected}
        ipAddress={ipAddress()}
        bluetoothOn={bluetoothEnabled()}
        sshEnabled={sshEnabled()}
        adbEnabled={adbEnabled()}
        mtpEnabled={mtpEnabled()}
        themeColor={themeColor()}
        fontSize={fontSize()}
        showClock={settingValues().showClock === "true" || settingValues().showClock === "on"}
        onSelectTab={(screen) => switchScreen(screen, screen > currentScreen() ? 1 : -1)}
        title={launcherOpen() ? undefined : t("app.systemInfo")}
        batteryLevel={batteryLevel()}
        batteryStatus={batteryStatus()}
      />

      {launcherOpen() ? (
        <View class="w-[720px] h-[416px] flex-col justify-between">
          {/* Animated Page Container */}
          <View class="w-[720px] flex-1 flex-col justify-between overflow-hidden relative">
            {isCarouselScreen() ? (
              <View class="w-[720px] h-[348px] flex-col justify-between items-center py-[2px]">
                {/* Horizontal Switch-Style Card Carousel */}
                {currentApps().length ? (
                  <CardCarousel
                    t={t}
                    apps={currentApps()}
                    selectedIndex={currentCardIndex()}
                    windowCenter={carouselCenter()}
                    onMountCarousel={(node) => {
                      carouselNode = node;
                      updateCardPosition(currentCardIndex(), false);
                    }}
                    onMountCard={(idx, node) => {
                      cardNodes.set(idx, { node, screen: currentScreen() });
                    }}
                    onCardPress={(idx) => {
                      if (idx !== currentCardIndex()) {
                        setHomeCardIndex(idx);
                        setCarouselCenter(idx);
                        carouselResetAt = 0;
                        updateCardPosition(idx, false);
                      } else {
                        const app = currentApps()[idx];
                        if (app) launchApp(app);
                      }
                    }}
                    onMove={(delta) => moveCard(delta)}
                  />
                ) : (
                  <View class="w-[340px] h-[140px] items-center justify-center rounded-[16px] bg-[#211f26]">
                    <Text class="text-xl text-[#cac4d0]">
                      {language() === "zh" ? (currentScreen() === 5 ? "暂无收藏游戏" : "暂无内容") : language() === "ja" ? "項目がありません" : (currentScreen() === 5 ? "No favorites" : "Nothing here")}
                    </Text>
                  </View>
                )}

                {/* Modern Game Title & Metadata Plaque (Material Design 3 typography) */}
                <View class="w-[640px] flex-col items-center justify-center gap-[4px] mb-[6px]">
                  <Text class="text-2xl font-bold text-[#e6e0e9] text-center tracking-wide">
                    {appName(t, selectedApp()) || "Nintendo Switch"}
                  </Text>
                  {selectedApp() ? (
                    <Text class="text-base font-bold text-[#cac4d0] text-center">
                      {selectedApp()?.romPath
                        ? `${categoryLabel(t, selectedApp()) || (language() === "zh" ? "游戏" : "Game")} · ${currentCardIndex() + 1} / ${currentApps().length}`
                        : `${categoryLabel(t, selectedApp()) || "App"} · ${currentCardIndex() + 1} / ${currentApps().length}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : currentScreen() === 3 ? (
              /* Screen 3: Settings Page (Wi-Fi picker takes over while open) */
              btOpen() ? (
                <BtPage
                  devices={btDevices()}
                  index={btIndex()}
                  status={btStatus()}
                  phase={btPhase()}
                  powered={btPowered()}
                  language={language()}
                  onSelect={setBtIndex}
                  onActivate={activateBtDevice}
                  onRescan={scanBluetooth}
                  onForget={forgetBtDevice}
                  onDisconnect={disconnectBtDevice}
                  onBack={() => setBtOpen(false)}
                />
              ) : wifiOpen() ? (
                <WifiPage
                  rows={wifiRows()}
                  index={wifiIndex()}
                  status={wifiStatus()}
                  pskFor={wifiPskFor()}
                  psk={wifiPsk()}
                  phase={wifiPhase()}
                  language={language()}
                  osk={wifiOsk}
                  onSelect={setWifiIndex}
                  onActivate={activateWifiRow}
                  onRescan={scanWifi}
                  onForget={forgetWifi}
                  onDisconnect={disconnectWifi}
                  onBack={() => setWifiOpen(false)}
                />
              ) : (
                <SettingsPage state={settingsState()}
                  onSelect={(idx) => setSettingsIndex(idx)}
                  onActivate={activateSetting}
                  onLevelPreview={(key, value) => {
                    setSettingsIndex(key === "brightness" ? 0 : 1);
                    if (key === "brightness") setBrightness(value); else setVolume(value);
                  }}
                  onLevelCommit={(key, value) => setLevel(key, value)}
                  onLevelCancel={syncSettings}
                  onAdjust={adjustSetting}
                  onSetLanguage={(lang) => {
                    const saved = writeSetting(host, "language", lang);
                    if (saved) setLanguage(saved);
                    syncSettings();
                  }} />
              )
            ) : (
              /* Screen 4: System Information Page */
              <SystemPage
                pageIndex={systemPageIndex()}
                network={networkSnapshot()}
                snapshot={systemSnapshot()}
                status={{
                  ssh: sshEnabled(),
                  adb: adbEnabled(),
                  mtp: mtpEnabled(),
                  battery: batteryLevel(),
                  brightness: brightness(),
                  volume: volume(),
                  language: language(),
                  themeColor: themeColor(),
                  fontSize: fontSize(),
                }}
              />
            )}
          </View>

          {/* Bottom Action Footer Bar (Material Design 3 borderless, seamless transparent background) */}
          <View class="w-[720px] h-[64px] bg-transparent flex-row items-center justify-between px-[32px]">
            <View class="flex-row items-center gap-[10px]">
              <Text class="text-xl text-[#938f99]">◀ ▶</Text>
              <Text class={fontSize() === "huge" ? "text-xl font-bold text-[#cac4d0]" : "text-lg font-bold text-[#cac4d0]"}>
                {language() === "zh" ? "选择" : language() === "ja" ? "選択" : "Select"}
              </Text>
            </View>
            <View class="flex-row items-center gap-[28px]">
              {/* (A) Button */}
              <View class="flex-row items-center gap-[8px]">
                <Text class="text-xl font-bold" style={{ textColor: theme().primary }}>A</Text>
                <Text class={fontSize() === "huge" ? "text-xl font-bold text-[#e6e0e9]" : "text-lg font-bold text-[#e6e0e9]"}>
                  {language() === "zh" ? "开始" : language() === "ja" ? "決定" : "Start"}
                </Text>
              </View>

              {/* (B) Button */}
              <View class="flex-row items-center gap-[8px]">
                <Text class="text-xl font-bold" style={{ textColor: theme().primary }}>B</Text>
                <Text class={fontSize() === "huge" ? "text-xl font-bold text-[#e6e0e9]" : "text-lg font-bold text-[#e6e0e9]"}>
                  {language() === "zh" ? "返回" : language() === "ja" ? "戻る" : "Back"}
                </Text>
              </View>

              {/* (+) Button */}
              {isCarouselScreen() && (
                <View class="flex-row items-center gap-[8px]">
                  <Text class="text-xl font-bold" style={{ textColor: theme().primary }}>+</Text>
                  <Text class={fontSize() === "huge" ? "text-xl font-bold text-[#e6e0e9]" : "text-lg font-bold text-[#e6e0e9]"}>
                    {language() === "zh" ? "选项" : language() === "ja" ? "設定" : "Options"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <PocketFetch
          snapshot={systemSnapshot()}
          network={networkSnapshot()}
          battery={batteryLevel()}
          language={language()}
          onRefresh={refreshPocketFetch}
          onBack={() => setLauncherOpen(true)}
        />
      )}

      <View ref={(node: NodeMirror) => { toastNode = node; }} class="absolute bottom-[60px] left-[180px] w-[360px] h-[36px] items-center opacity-0">
        <View class="w-[360px] h-[36px] rounded-full bg-[#1e222a] border border-[#3e4555] items-center justify-center shadow-lg">
          <Text class="text-sm font-bold text-white text-center">{toastMessage()}</Text>
        </View>
      </View>

      {gameOptionsOpen() ? (
        <View class="absolute inset-0 bg-[#00000099] items-center justify-center">
          <View class="w-[320px] h-[120px] rounded-[16px] bg-[#1c2028] border-2 border-[#00d2ff] flex-col items-center justify-center gap-[12px] p-[16px]">
            <Text class="text-base font-bold text-white text-center">
              {favorites().includes(selectedApp()?.romPath || "")
                ? (language() === "zh" ? "取消收藏" : language() === "ja" ? "お気に入り解除" : "Remove Favorite")
                : (language() === "zh" ? "加入收藏" : language() === "ja" ? "お気に入り追加" : "Add Favorite")}
            </Text>
            <View class="flex-row items-center gap-[16px]">
              <View class="flex-row items-center gap-[6px]">
                <View class="w-[20px] h-[20px] items-center justify-center rounded-full bg-[#00d2ff]">
                  <Text class="text-2xs font-bold text-[#14161c]">A</Text>
                </View>
                <Text class="text-xs text-[#c0c6d4]">{language() === "zh" ? "确定" : "OK"}</Text>
              </View>
              <View class="flex-row items-center gap-[6px]">
                <View class="w-[20px] h-[20px] items-center justify-center rounded-full bg-[#343a46]">
                  <Text class="text-2xs font-bold text-white">B</Text>
                </View>
                <Text class="text-xs text-[#c0c6d4]">{language() === "zh" ? "返回" : "Back"}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {powerMenuOpen() ? (
        <PowerMenu
          language={language()}
          selected={powerChoice()}
          busy={powerBusy()}
          refused={powerRefused()}
          onSelect={setPowerChoice}
          onConfirm={runPowerAction}
          onCancel={() => setPowerMenuOpen(false)}
        />
      ) : null}

      {/* Floating Volume / Brightness OSD */}
      {osd().visible && (
        <View class="absolute top-[14px] left-[200px] w-[320px] h-[46px] rounded-[999px] bg-[#211f26] border border-[#49454f] flex-row items-center justify-between px-[18px] shadow-lg">
          <Text class="text-lg font-bold text-[#e6e0e9]">
            {osd().type === "brightness" ? "☼" : "🔊"}
          </Text>
          <View class="w-[180px] h-[8px] rounded-[999px] bg-[#36343b] overflow-hidden">
            <View
              class="h-full rounded-[999px]"
              style={{
                width: Math.round((Math.max(0, Math.min(100, osd().value)) / 100) * 180),
                bgColor: theme().primary,
              }}
            />
          </View>
          <Text class="text-sm font-bold" style={{ textColor: theme().primary }}>
            {`${Math.round(osd().value)}%`}
          </Text>
        </View>
      )}

      {/* Terminal View with Virtual Keyboard Testing */}
      {terminalOpen() && (
        <View class="absolute inset-0 bg-[#0f1117] flex-col justify-between p-[16px]">
          {/* Terminal Window Header */}
          <View class="w-[688px] h-[36px] flex-row items-center justify-between px-[12px] bg-[#1a1d26] rounded-[12px]">
            <View class="flex-row items-center gap-[8px]">
              <View class="w-[10px] h-[10px] rounded-[999px] bg-[#ff5f56]" />
              <View class="w-[10px] h-[10px] rounded-[999px] bg-[#ffbd2e]" />
              <View class="w-[10px] h-[10px] rounded-[999px] bg-[#27c93f]" />
              <Text class="text-xs font-bold text-[#938f99] ml-[8px]">
                bash - root@rg34xx:~ (720x480)
              </Text>
            </View>
            <TouchTarget onPress={() => setTerminalOpen(false)} class="px-[8px] py-[2px] rounded-[6px] bg-[#2d313e]">
              <Text class="text-xs text-[#cac4d0]">B {language() === "zh" ? "退出" : "Exit"}</Text>
            </TouchTarget>
          </View>

          {/* Terminal Screen Lines */}
          <View class="w-[688px] flex-1 bg-[#14161f] p-[12px] flex-col justify-start gap-[4px] overflow-hidden">
            <Index each={terminalLines()}>
              {(line) => (
                <Text
                  class="text-xs font-mono"
                  style={{
                    textColor: line().startsWith("root@")
                      ? "#5af78e"
                      : line().startsWith("bash:")
                      ? "#ff5f56"
                      : "#cac4d0",
                  }}
                >
                  {line()}
                </Text>
              )}
            </Index>
          </View>

          {/* Terminal Interactive Input Bar */}
          <TouchTarget
            onPress={() => terminalOsk.open()}
            class="w-[688px] h-[44px] px-[12px] bg-[#1a1d26] rounded-[12px] flex-row items-center justify-between"
          >
            <View class="flex-row items-center gap-[8px]">
              <Text class="text-xs font-bold text-[#5af78e]">root@rg34xx:~#</Text>
              <Text class="text-xs font-mono text-[#ffffff]">
                {terminalInput() || (language() === "zh" ? "点击或按 A 激活键盘输入..." : "Tap or press A to type...")}
              </Text>
            </View>
            <View class="px-[10px] py-[4px] rounded-[999px] bg-[#5af78e22]">
              <Text class="text-xs font-bold text-[#5af78e]">
                {language() === "zh" ? "A 键盘" : "A Type"}
              </Text>
            </View>
          </TouchTarget>

          {/* Virtual Keyboard Overlay */}
          <Osk osk={terminalOsk} theme="pjos" />
        </View>
      )}
    </View>
  );
});
