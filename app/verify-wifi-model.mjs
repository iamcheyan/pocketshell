import assert from "node:assert/strict";
import {
  parseConnectResult,
  parseSaved,
  parseScan,
  parseStatus,
  pskIssue,
  sortNetworks,
  ssidBytes,
} from "./wifi-model.ts";

// A scan line is `<ssid>\t<signal>\t<security>`; repeated SSIDs are one entry.
const scan = [
  "Buffalo-2G-8700\t-69\twpa",
  "Buffalo-2G-8700\t-55\twpa",
  "Cafe-Guest\t-80\topen",
  "\t-50\twpa",
  "Extremely-Long-SSID-That-Exceeds-32b\t-61\twpa",
].join("\n");

const parsed = parseScan(scan, ["Cafe-Guest"], "Buffalo-2G-8700");
assert.equal(parsed.ok, true, "scan parses");
if (parsed.ok) {
  const names = parsed.networks.map((n) => n.ssid);
  assert.deepEqual(names, ["Buffalo-2G-8700", "Cafe-Guest"], "hidden and over-long SSIDs dropped");
  const strongest = parsed.networks.find((n) => n.ssid === "Buffalo-2G-8700");
  assert.equal(strongest?.signal, -55, "duplicate SSIDs keep the strongest sample");
  assert.equal(strongest?.active, true, "associated network is marked active");
  assert.equal(parsed.networks.find((n) => n.ssid === "Cafe-Guest")?.saved, true, "saved list marks the row");
  assert.equal(parsed.networks.find((n) => n.ssid === "Cafe-Guest")?.security, "open");
}

assert.deepEqual(parseScan("error:supplicant", [], ""), { ok: false, reason: "supplicant" });
assert.deepEqual(parseScan("error:something", [], ""), { ok: false, reason: "failed" });
assert.deepEqual(parseScan("empty", [], ""), { ok: true, networks: [] });

// Sorting: associated first, then signal, unreadable values last, then name.
const sorted = sortNetworks([
  { ssid: "b", signal: -70, security: "wpa", saved: false, active: false },
  { ssid: "a", signal: -70, security: "wpa", saved: false, active: false },
  { ssid: "hot", signal: -40, security: "wpa", saved: false, active: false },
  { ssid: "away", signal: NaN, security: "wpa", saved: false, active: false },
  { ssid: "now", signal: -90, security: "wpa", saved: false, active: true },
]);
assert.deepEqual(sorted.map((n) => n.ssid), ["now", "hot", "a", "b", "away"]);

assert.deepEqual(parseConnectResult("connected:Cafe-Guest"), { kind: "connected", ssid: "Cafe-Guest" });
assert.deepEqual(parseConnectResult("need-psk"), { kind: "need-psk" });
assert.deepEqual(parseConnectResult("auth-failed"), { kind: "auth-failed" });
assert.deepEqual(parseConnectResult("not-found"), { kind: "not-found" });
assert.deepEqual(parseConnectResult("timeout"), { kind: "timeout" });
assert.deepEqual(parseConnectResult("error:add-network"), { kind: "error", detail: "add-network" });
// A pre-2.0 runtime still answers prose; it must surface, not vanish.
assert.deepEqual(parseConnectResult("Unable to connect"), { kind: "error", detail: "Unable to connect" });

const status = parseStatus("state=COMPLETED\nssid=Buffalo-2G-8700\nip=192.168.1.24");
assert.deepEqual(status, { state: "COMPLETED", ssid: "Buffalo-2G-8700", ip: "192.168.1.24" });
assert.deepEqual(parseStatus(""), { state: "", ssid: "", ip: "" });
// wpa_cli spells the same field two ways depending on the command used.
assert.equal(parseStatus("wpa_state=INACTIVE\nip_address=10.0.0.2").state, "INACTIVE");
assert.equal(parseStatus("wpa_state=INACTIVE\nip_address=10.0.0.2").ip, "10.0.0.2");

assert.deepEqual(parseSaved("Home\nCafe-Guest\n"), { supported: true, ssids: ["Home", "Cafe-Guest"] });
// An empty list is a working bridge with nothing saved; only the pre-2.0
// runtime's prose answer means the command itself is missing.
assert.deepEqual(parseSaved(""), { supported: true, ssids: [] });
assert.deepEqual(parseSaved("Unknown launcher action"), { supported: false, ssids: [] });

// WPA2: 8..63 printable ASCII.
assert.equal(pskIssue(""), "empty");
assert.equal(pskIssue("short"), "short");
assert.equal(pskIssue("x".repeat(64)), "long");
assert.equal(pskIssue("pässword"), "non-ascii");
assert.equal(pskIssue("correct horse"), null);

// SSID length is counted in UTF-8 octets, not UTF-16 units.
assert.equal(ssidBytes("岩石路由器"), 15);
assert.equal(ssidBytes("plain"), 5);

console.log(JSON.stringify({ ok: true, scanned: parsed.ok ? parsed.networks.length : 0, sorted: sorted.length }));
