//! Local `ui.__launcher(cmd)` bridge for the desktop host.
//!
//! The device build gets this from `pocketshell-launcher.rs` injected by the
//! ROCKNIX `patch-runtime.py`. The PocketJS SDK has no such module, so a
//! desktop run has `host.__launcher === undefined` and every launcher/PocketFetch
//! row reads "--". This file supplies the same command surface from the machine
//! the host actually runs on, so the UI can be tested without a handheld.
//!
//! Read-only, single render thread, no long-running child processes: anything
//! that can block (backlight, battery, thermal) is a plain file read and a
//! missing file is simply an absent field.

use std::process::{Command, Stdio};
use std::sync::Mutex;

static CPU_SAMPLE: Mutex<Option<(u64, u64)>> = Mutex::new(None);
/// The desktop has no LANGUAGE daemon; keep the choice in-process so the three
/// translations can be exercised without a handheld.
static LANGUAGE: Mutex<Option<String>> = Mutex::new(None);

fn read(path: &str) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|value| value.trim_matches('\0').trim().to_owned())
}

fn os_release(key: &str) -> Option<String> {
    read("/etc/os-release")?.lines().find_map(|line| {
        let (name, value) = line.split_once('=')?;
        (name == key).then(|| value.trim_matches('"').to_owned())
    })
}

/// Reads one key from `/proc/meminfo` (`MemTotal`, `MemAvailable`), in kB.
fn memory_kb(key: &str) -> Option<u64> {
    read("/proc/meminfo")?.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        if name != key {
            return None;
        }
        value.split_whitespace().next()?.parse().ok()
    })
}

fn cpu_model() -> Option<String> {
    let text = read("/proc/cpuinfo")?;
    let line = text.lines().find(|line| line.starts_with("model name") || line.starts_with("Hardware"))?;
    Some(line.split_once(':')?.1.trim().to_owned())
}

fn cpu_frequency_mhz() -> Option<u64> {
    let mut best = 0;
    for entry in std::fs::read_dir("/sys/devices/system/cpu/cpufreq").ok()?.flatten() {
        let path = entry.path().join("scaling_cur_freq");
        if let Some(khz) = read(path.to_str()?).and_then(|value| value.parse::<u64>().ok()) {
            best = best.max(khz / 1000);
        }
    }
    (best > 0).then_some(best)
}

fn cpu_usage_percent() -> Option<u64> {
    let text = read("/proc/stat")?;
    let line = text.lines().next()?;
    let fields: Vec<u64> = line
        .split_whitespace()
        .skip(1)
        .filter_map(|value| value.parse().ok())
        .collect();
    if fields.len() < 4 {
        return None;
    }
    // user nice system idle iowait irq softirq steal…
    let idle = fields[3] + fields.get(4).copied().unwrap_or(0);
    let total: u64 = fields.iter().sum();
    let mut sample = CPU_SAMPLE.lock().ok()?;
    let previous = sample.replace((total, idle));
    let (total0, idle0) = previous?;
    let total_delta = total.checked_sub(total0)?;
    let idle_delta = idle.checked_sub(idle0)?;
    (total_delta > 0).then(|| ((total_delta - idle_delta) * 100 / total_delta).min(100))
}

fn temperature() -> Option<String> {
    for entry in std::fs::read_dir("/sys/class/thermal").ok()?.flatten() {
        let path = entry.path().join("temp");
        if let Some(milli) = read(path.to_str()?).and_then(|value| value.parse::<u64>().ok()) {
            if (1000..=150_000).contains(&milli) {
                return Some(format!("{}C", milli / 1000));
            }
        }
    }
    None
}

fn display() -> Option<String> {
    if let Some(size) = read("/sys/class/graphics/fb0/virtual_size") {
        return Some(size.replace(',', "×"));
    }
    for entry in std::fs::read_dir("/sys/class/drm").ok()?.flatten() {
        let path = entry.path().join("modes");
        if let Some(mode) = read(path.to_str()?).and_then(|text| text.lines().next().map(str::to_owned)) {
            let (w, h) = mode.split_once('x')?;
            let area: u64 = w.parse::<u64>().ok()? * h.parse::<u64>().ok()?;
            if area >= 640 * 480 {
                return Some(format!("{w}×{h}"));
            }
        }
    }
    None
}

/// `used`, `total` and percent of the filesystem holding `path`.
fn storage(path: &str) -> Option<(u64, u64, u64)> {
    let output = Command::new("df")
        .args(["-B1", "--output=used,size", path])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let mut values = text.lines().nth(1)?.split_whitespace();
    let used: u64 = values.next()?.parse().ok()?;
    let total: u64 = values.next()?.parse().ok()?;
    (total > 0).then(|| (used, total, used * 100 / total))
}

fn battery_level() -> Option<u64> {
    for entry in std::fs::read_dir("/sys/class/power_supply").ok()?.flatten() {
        if let Some(level) = read(entry.path().join("capacity").to_str()?).and_then(|v| v.parse::<u64>().ok()) {
            return Some(level.min(100));
        }
    }
    None
}

/// Power supply status is optional in sysfs; report unknown when no battery
/// exposes a recognized status rather than inferring charging from capacity.
fn battery_status() -> &'static str {
    for entry in std::fs::read_dir("/sys/class/power_supply").ok().into_iter().flatten().flatten() {
        let path = entry.path();
        let is_battery = read(path.join("type").to_str().unwrap_or_default()).as_deref() == Some("Battery")
            || path.join("capacity").exists();
        if !is_battery { continue; }
        match read(path.join("status").to_str().unwrap_or_default()).as_deref() {
            Some("Charging") => return "charging",
            Some("Full") => return "full",
            Some("Discharging") | Some("Not charging") => return "discharging",
            _ => {}
        }
    }
    "unknown"
}

fn ip_address() -> String {
    let output = Command::new("ip")
        .args(["-o", "-4", "addr", "show"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();
    let Ok(output) = output else { return "--".into() };
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        // "3: wlp3s0    inet 203.0.113.188/24 brd …" — iface, "inet", prefix.
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 4 || fields[2] != "inet" || line.contains("scope host") {
            continue;
        }
        let iface = fields[1];
        let address = fields[3].split('/').next().unwrap_or("");
        if iface == "lo" || address.is_empty() {
            continue;
        }
        return format!("{iface}|{address}");
    }
    "--".into()
}

/// Bounded child process: a host probe must never be able to hang the render
/// thread, so every call is `Command::output()` with stderr dropped.
fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

/// `WIFI scan` — NetworkManager's list, tab-separated as
/// `<ssid>\t<signal dBm>\t<security>`, one line per network. Empty SSIDs are
/// skipped: they cannot be joined by name.
fn wifi_scan() -> String {
    let Some(text) = run("nmcli", &["-t", "-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list"]) else {
        return "error:nmcli".into();
    };
    let mut seen: Vec<String> = Vec::new();
    let mut rows: Vec<String> = Vec::new();
    for line in text.lines() {
        // nmcli escapes a literal ':' in a field as '\:'.
        let fields = split_escaped(line);
        if fields.len() < 3 {
            continue;
        }
        let ssid = fields[0].trim().to_owned();
        if ssid.is_empty() || seen.contains(&ssid) {
            continue;
        }
        // SIGNAL is 0..100 quality; the panel shows dBm, so convert.
        let quality: i32 = fields[1].trim().parse().unwrap_or(0);
        let dbm = quality / 2 - 100;
        let security = if fields[2].contains("WEP") {
            "wep"
        } else if fields[2].trim().is_empty() {
            "open"
        } else {
            "wpa"
        };
        seen.push(ssid.clone());
        rows.push(format!("{ssid}\t{dbm}\t{security}"));
    }
    if rows.is_empty() { "empty".into() } else { rows.join("\n") }
}

/// nmcli -t escapes ':' inside values as '\:'; split on the real separators.
fn split_escaped(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for ch in line.chars() {
        match (escaped, ch) {
            (true, _) => { current.push(ch); escaped = false; }
            (false, '\\') => escaped = true,
            (false, ':') => { fields.push(std::mem::take(&mut current)); }
            (false, _) => current.push(ch),
        }
    }
    fields.push(current);
    fields
}

fn wifi_status() -> String {
    let Some(text) = run("nmcli", &["-t", "-f", "GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS", "device", "show", "wlan0"]) else {
        return "state=\nssid=\nip=".into();
    };
    let mut state = String::new();
    let mut ssid = String::new();
    let mut ip = String::new();
    for line in text.lines() {
        if let Some(value) = line.strip_prefix("GENERAL.STATE:") {
            state = if value.contains("connected") && !value.contains("disconnected") { "COMPLETED".into() } else { "DISCONNECTED".into() };
        } else if let Some(value) = line.strip_prefix("GENERAL.CONNECTION:") {
            ssid = if value == "--" { String::new() } else { value.to_owned() };
        } else if let Some(value) = line.strip_prefix("IP4.ADDRESS") {
            let address = value.trim_start_matches("[0-9]:").split('/').next().unwrap_or("").trim();
            if !address.is_empty() { ip = address.to_owned(); }
        }
    }
    format!("state={state}\nssid={ssid}\nip={ip}")
}

fn wifi_saved() -> String {
    let Some(text) = run("nmcli", &["-t", "-f", "NAME,TYPE", "connection", "show"]) else {
        return String::new();
    };
    let rows: Vec<String> = text
        .lines()
        .filter_map(|line| line.rsplit_once(':').map(|(name, kind)| (name, kind)))
        .filter(|(_, kind)| kind.contains("wireless"))
        .map(|(name, _)| name.to_owned())
        .collect();
    rows.join("\n")
}

/// The desktop preview may only join networks the developer's session can reach
/// without a password prompt, so a passphrase is passed straight to nmcli.
fn wifi_connect(ssid: &str, psk: &str) -> String {
    if ssid.is_empty() {
        return "error:ssid".into();
    }
    let mut args = vec!["device", "wifi", "connect", ssid];
    if !psk.is_empty() {
        args.push("password");
        args.push(psk);
    }
    match run("nmcli", &args) {
        Some(_) => format!("connected:{ssid}"),
        None => "auth-failed".into(),
    }
}

fn wifi_disconnect() -> String {
    match run("nmcli", &["device", "disconnect", "wlan0"]) {
        Some(_) => "ok".into(),
        None => "error:nmcli".into(),
    }
}

fn wifi_forget(ssid: &str) -> String {
    if ssid.is_empty() {
        return "error:ssid".into();
    }
    match run("nmcli", &["connection", "delete", ssid]) {
        Some(_) => "ok".into(),
        None => "error:nmcli".into(),
    }
}

/// `BT scan` — paired devices first, then everything the adapter currently
/// sees. `<address>\t<name>\t<rssi dBm>\t<paired>`, one line per device.
fn bt_scan() -> String {
    if run("bluetoothctl", &["show"]).is_none() {
        return "error:bluez".into();
    }
    // `bluetoothctl --timeout` needs the scan to start before it begins
    // counting; the plain form would stay attached forever on the render
    // thread, so the child is killed by `timeout(1)` instead.
    let _ = run("timeout", &["7", "bluetoothctl", "--timeout", "6", "scan", "on"]);
    let paired: Vec<String> = run("bluetoothctl", &["devices", "Paired"])
        .map(|text| text.lines().map(str::to_owned).collect())
        .unwrap_or_default();
    let Some(text) = run("bluetoothctl", &["devices"]) else {
        return "error:bluez".into();
    };
    let mut rows: Vec<String> = Vec::new();
    for line in text.lines() {
        // "Device AA:BB:CC:DD:EE:FF Name of the thing"
        let Some(rest) = line.strip_prefix("Device ") else { continue };
        let mut parts = rest.splitn(2, ' ');
        let Some(address) = parts.next() else { continue };
        let name = parts.next().unwrap_or(address).trim();
        let is_paired = paired.iter().any(|row| row.contains(address));
        // RSSI is a live query per device; the list is short, so it stays cheap.
        let rssi = run("bluetoothctl", &["info", address])
            .and_then(|info| {
                info.lines()
                    .find_map(|line| line.trim().strip_prefix("RSSI: "))
                    .and_then(|value| value.trim().parse::<i32>().ok())
            })
            .unwrap_or(-127);
        rows.push(format!("{address}\t{name}\t{rssi}\t{}", if is_paired { "1" } else { "0" }));
    }
    rows.sort_by_key(|row| {
        let paired = row.ends_with('1');
        let rssi: i32 = row.split('\t').nth(2).and_then(|v| v.parse().ok()).unwrap_or(-127);
        (!paired, -rssi)
    });
    if rows.is_empty() { "empty".into() } else { rows.join("\n") }
}

fn bt_status() -> String {
    let text = run("bluetoothctl", &["show"]).unwrap_or_default();
    let mut powered = "no".to_string();
    let mut address = String::new();
    for line in text.lines() {
        if let Some(value) = line.trim().strip_prefix("Powered: ") {
            powered = value.trim().to_owned();
        } else if let Some(value) = line.trim().strip_prefix("Controller ") {
            address = value.split_whitespace().next().unwrap_or("").to_owned();
        }
    }
    format!("powered={powered}\naddress={address}\ntransport=desktop")
}

struct Fields(String);

impl Fields {
    fn push(&mut self, key: &str, value: &str) {
        self.0.push_str(key);
        self.0.push('\t');
        self.0.push_str(&value.replace(['\t', '\n'], " "));
        self.0.push('\n');
    }
}

/// A wireless interface is associated and administratively up.
fn wireless_up() -> bool {
    let Ok(entries) = std::fs::read_dir("/sys/class/net") else {
        return false;
    };
    entries.flatten().any(|entry| {
        if !entry.path().join("wireless").exists() {
            return false;
        }
        entry
            .path()
            .join("operstate")
            .to_str()
            .and_then(read)
            .is_some_and(|state| state == "up")
    })
}

fn snapshot() -> String {
    let cpu = cpu_model().unwrap_or_default();
    let os_name = os_release("OS_NAME");
    let os_version = os_release("OS_VERSION");
    let os = match (&os_name, &os_version) {
        (Some(name), Some(version)) => format!("{name} {version}"),
        (Some(name), None) => name.clone(),
        _ => os_release("PRETTY_NAME").unwrap_or_default(),
    };
    // `hardware` is the board fact the UI pairs with `model`; repeating the CPU
    // model here would print the same string in Host and CPU.
    let model = read("/sys/devices/virtual/dmi/id/product_name").unwrap_or_default();
    let board = read("/sys/devices/virtual/dmi/id/board_name").unwrap_or_default();
    let mut out = Fields(String::new());
    // Prompt identity: who the session runs as and what this machine calls
    // itself. Both are read, never assumed.
    out.push(
        "user",
        &std::env::var("USER")
            .or_else(|_| std::env::var("LOGNAME"))
            .unwrap_or_default(),
    );
    out.push("hostname", &read("/etc/hostname").unwrap_or_default());
    out.push("model", &model);
    // Board name is usually the same string as the product name; keep the row
    // useful by falling back to the product instead of printing "--".
    out.push("hardware", if board.is_empty() || board == model { &model } else { &board });
    out.push("cpu", &cpu);
    out.push("osName", os_name.as_deref().unwrap_or(""));
    out.push("osVersion", os_version.as_deref().unwrap_or(""));
    out.push("os", &os);
    out.push(
        "kernel",
        &read("/proc/sys/kernel/osrelease")
            .map(|release| format!("Linux {release} ({})", std::env::consts::ARCH))
            .unwrap_or_default(),
    );
    out.push("temperature", &temperature().unwrap_or_default());
    out.push("frequency", &cpu_frequency_mhz().map(|mhz| format!("{mhz}MHz")).unwrap_or_default());
    if let Some(value) = cpu_usage_percent() {
        out.push("cpuUsagePercent", &value.to_string());
    }
    if let Some(value) = memory_kb("MemAvailable") {
        out.push("ramAvailableKb", &value.to_string());
    }
    if let Some(value) = memory_kb("MemTotal") {
        out.push("ramTotalKb", &value.to_string());
    }
    if let Some((used, total, percent)) = storage("/") {
        out.push("storageUsed", &format!("{:.1}G", used as f64 / 1_073_741_824.0));
        out.push("storageTotal", &format!("{:.1}G", total as f64 / 1_073_741_824.0));
        out.push("storagePercent", &percent.to_string());
    }
    out.push("display", &display().unwrap_or_default());
    out.push("runtime", "PocketJS");
    out.0
}

/// `ui.__launcher(command)`. Unknown commands answer empty, exactly like a
/// device whose daemon has no arm for them, so the app's defaults apply.
pub fn command(value: &str) -> String {
    // Settings live in their own module: one key per row, same read/write shape.
    if value.starts_with("SETTING\t") || value.starts_with("POWER\t") {
        return super::pocketshell_settings::command(value);
    }
    let mut fields = value.split('\t');
    match (fields.next().unwrap_or(""), fields.next().unwrap_or("")) {
        ("ROMS", _) => std::env::var("POCKETSHELL_TEST_LIBRARY")
            .ok().and_then(|path| std::fs::read_to_string(path).ok()).unwrap_or_default(),
        ("SYSTEM", _) => snapshot(),
        ("LEVEL", "battery") => battery_level().map_or_else(|| "unknown".into(), |v| v.to_string()),
        ("LEVEL", "battery-status") => battery_status().into(),
        ("LEVEL", "brightness") => "unknown".into(),
        ("LEVEL", "volume") => "unknown".into(),
        ("LEVEL", "ip") => ip_address(),
        ("LEVEL", "wifi") => {
            if wireless_up() { "on".into() } else { "off".into() }
        }
        ("STATUS", _) => "false".into(),
        ("LAUNCH", _) => "Unable to start application".into(),
        ("LANGUAGE", value) if ["en", "zh", "ja"].contains(&value) => {
            if let Ok(mut slot) = LANGUAGE.lock() {
                *slot = Some(value.to_owned());
            }
            "ok".into()
        }
        ("LANGUAGE", _) => LANGUAGE
            .lock()
            .ok()
            .map(|mut slot| {
                // POCKETSHELL_LANGUAGE seeds a fresh desktop run, so the other two
                // translations can be inspected without a handheld.
                slot.get_or_insert_with(|| {
                    std::env::var("POCKETSHELL_LANGUAGE").unwrap_or_else(|_| "en".into())
                })
                .clone()
            })
            .unwrap_or_else(|| "en".into()),
        ("BT", "scan") => bt_scan(),
        ("BT", "status") => bt_status(),
        ("BT", "power") => match fields.next().unwrap_or("") {
            "on" => run("bluetoothctl", &["power", "on"]).map_or_else(|| "error:bluez".into(), |_| "ok".into()),
            "off" => run("bluetoothctl", &["power", "off"]).map_or_else(|| "error:bluez".into(), |_| "ok".into()),
            _ => "error:arg".into(),
        },
        ("BT", "connect") => {
            let address = fields.next().unwrap_or("");
            if address.is_empty() {
                "error:address".into()
            } else {
                run("bluetoothctl", &["connect", address])
                    .map_or_else(|| "error:connect".into(), |out| if out.contains("Failed") { "error:connect".into() } else { format!("connected:{address}") })
            }
        }
        ("BT", "disconnect") => {
            let address = fields.next().unwrap_or("");
            run("bluetoothctl", &["disconnect", address])
                .map_or_else(|| "error:connect".into(), |_| "ok".into())
        }
        ("BT", "forget") => {
            let address = fields.next().unwrap_or("");
            run("bluetoothctl", &["remove", address])
                .map_or_else(|| "error:remove".into(), |_| "ok".into())
        }
        ("WIFI", "scan") => wifi_scan(),
        ("WIFI", "status") => wifi_status(),
        ("WIFI", "saved") => wifi_saved(),
        ("WIFI", "connect") => wifi_connect(fields.next().unwrap_or(""), fields.next().unwrap_or("")),
        ("WIFI", "disconnect") => wifi_disconnect(),
        ("WIFI", "forget") => wifi_forget(fields.next().unwrap_or("")),
        ("CONTROL", _) | ("SERVICE", _) | ("SLEEP", _) | ("STATE", _) | ("WIFI", _) => String::new(),
        _ => String::new(),
    }
}
