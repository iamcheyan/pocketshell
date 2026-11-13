import { describe, expect, test } from "bun:test";
import { readSetting, writeSetting } from "../app/setting-bridge";

describe("device setting responses", () => {
  test("an unsupported legacy write cannot report the previous value as success", () => {
    const host = { __launcher: (command: string) => command === "STATE\twifi" ? "on" : "Unknown launcher action" };
    expect(readSetting(host, "wifi")).toBe("on");
    expect(writeSetting(host, "wifi", "off")).toBeNull();
  });
  test("keeps boot-only change pending until restart", () => {
    const host = { __launcher: (command: string) => command === "SETTING\theadphoneFix\ton" ? "error:reboot-required" : "off" };
    expect(writeSetting(host, "headphoneFix", "on")).toBe("reboot-required");
    expect(readSetting(host, "headphoneFix")).toBe("off");
  });
  test("legacy wifi enabled state is still accepted", () => {
    const host = { __launcher: (command: string) => command.startsWith("SETTING") ? "Unknown launcher action" : "1" };
    expect(readSetting(host, "wifi")).toBe("on");
  });
  test("unknown commands cannot become a power-off timeout", () => {
    const host = { __launcher: () => "Unknown launcher action" };
    expect(readSetting(host, "autoPoweroff")).toBeNull();
  });
  test("unavailable unified setting does not appear as an error string", () => {
    const host = { __launcher: () => "error:unsupported" };
    expect(readSetting(host, "hostname")).toBeNull();
  });
});
