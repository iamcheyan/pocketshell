import { describe, expect, test } from "bun:test";
import { readSetting, writeSetting } from "../app/setting-bridge";

describe("device setting responses", () => {
  test("does not cache a local font choice when the runtime rejects it", () => {
    const host = { __launcher: () => "Unknown launcher action" };
    expect(writeSetting(host, "fontSize", "huge")).toBeNull();
    expect(readSetting(host, "fontSize")).toBe("normal");
  });
  test("confirms a local setting by reading the value persisted by the host", () => {
    let fontSize = "normal";
    const host = {
      __launcher: (command: string) => {
        const fields = command.split("\t");
        if (fields[0] !== "SETTING" || fields[1] !== "fontSize") return "Unknown launcher action";
        if (fields[2]) fontSize = fields[2];
        return fontSize;
      },
    };
    expect(writeSetting(host, "fontSize", "huge")).toBe("huge");
    expect(readSetting(host, "fontSize")).toBe("huge");
  });
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
