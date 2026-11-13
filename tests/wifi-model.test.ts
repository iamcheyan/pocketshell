import { describe, expect, test } from "bun:test";
import { parseScan } from "../app/wifi-model";

describe("Wi-Fi scan names and signal readings", () => {
  test("SSID names that match object properties remain visible", () => {
    const result = parseScan("__proto__\t-40\tWPA2\nconstructor\t-50\tWPA2\ntoString\t-60\t", [], "");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.networks.map((network) => network.ssid)).toEqual(["__proto__", "constructor", "toString"]);
  });
  test("a later usable BSSID replaces a missing or invalid signal", () => {
    const result = parseScan("home\tbad\tWPA2\nhome\t-35\tWPA2\nmissing\t\t", [], "");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.networks[0].signal).toBe(-35);
      expect(Number.isNaN(result.networks[1].signal)).toBe(true);
    }
  });
  test("an older bridge's unsupported scan is not a fake network", () => {
    expect(parseScan("Unknown launcher action", [], "").ok).toBe(false);
  });
});
