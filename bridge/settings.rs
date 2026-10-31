//! `SETTING` reads/writes for the desktop host.
//!
//! One key per row in `app/settings-model.ts`. `SETTING\t<key>` reads,
//! `SETTING\t<key>\t<value>` writes, and an unanswered key returns empty so the
//! panel can render "--" and refuse to toggle instead of faking a state.
//!
//! Everything here is a file read, an `rfkill`/`timedatectl` query or a short
//! child process on the guest's render thread: bounded, and never a daemon.

use std::process::{Command, Stdio};

fn read(path: &str) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|value| value.trim_matches('\0').trim().to_owned())
}

/// `on`/`off` from a boolean, the same vocabulary the toggles parse.
fn flag(value: bool) -> String {
    if value { "on".into() } else { "off".into() }
}

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

/// `rfkill list` groups by radio: a header line names the device ("0: phy0:
/// Wireless LAN"), the indented lines below it carry the block state.
fn rfkill_blocked(kind: &str) -> Option<bool> {
    let text = run("rfkill", &["list"])?;
    let mut current = String::new();
    for line in text.lines() {
        if !line.starts_with([' ', '\t']) {
            current = line.to_ascii_lowercase();
            continue;
        }
        if current.contains(kind) && line.trim_start().starts_with("Soft blocked") {
            return Some(line.trim_end().ends_with("yes"));
        }
    }
    None
}

fn bluetooth_on() -> Option<bool> {
    // Controller present and not soft-blocked. A machine without a controller
    // answers None, so the row stays "--" instead of claiming OFF.
    rfkill_blocked("bluetooth").map(|blocked| !blocked)
}

fn wifi_on() -> Option<bool> {
    // rfkill names the radio after its driver: "Wireless LAN" for wlan/phyN.
    rfkill_blocked("wireless").or_else(|| rfkill_blocked("wlan")).map(|blocked| !blocked)
}

fn ntp_on() -> Option<bool> {
    run("timedatectl", &["show", "-p", "NTP", "--value"]).map(|value| value == "yes")
}

fn volume_level() -> Option<u64> {
    // wpctl prints "Volume: 0.62" or "Volume: 1.00 [MUTED]".
    let text = run("wpctl", &["get-volume", "@DEFAULT_AUDIO_SINK@"])?;
    let fraction: f64 = text.split_whitespace().nth(1)?.parse().ok()?;
    let percent = (fraction * 100.0).round().clamp(0.0, 100.0);
    Some(percent as u64)
}

fn hostname() -> String {
    read("/proc/sys/kernel/hostname").unwrap_or_default()
}

fn ssh_service() -> Option<bool> {
    // `pgrep -x sshd` prints a pid only when a daemon is actually running; an
    // empty answer is a real "off", not a missing capability.
    match run("pgrep", &["-x", "sshd"]) {
        Some(pids) => Some(!pids.trim().is_empty()),
        None => None,
    }
}

pub fn command(value: &str) -> String {
    let mut fields = value.split('\t');
    let head = fields.next().unwrap_or("");
    if head != "SETTING" {
        return String::new();
    }
    let key = fields.next().unwrap_or("");
    let argument = fields.next();
    if head == "POWER" {
        // `POWER\tmenu` has no third field, so it lands in `key`.
        return match (key, argument) {
            ("menu", _) => "none".into(),
            ("poweroff", _) | ("reboot", _) => "error:preview".into(),
            _ => String::new(),
        };
    }

    match (key, argument) {
        ("brightness", None) => "unknown".into(),
        ("brightness", Some(_)) => "error:unsupported".into(),
        ("volume", None) => volume_level().map_or_else(|| "unknown".into(), |v| v.to_string()),
        ("volume", Some(raw)) => match raw.parse::<u64>() {
            Ok(level) if level <= 100 => {
                let step = format!("{:.2}", level as f64 / 100.0);
                match run("wpctl", &["set-volume", "@DEFAULT_AUDIO_SINK@", &step]) {
                    Some(_) => "ok".into(),
                    None => "error:unsupported".into(),
                }
            }
            _ => "error:unsupported".into(),
        },
        ("bluetooth", None) => bluetooth_on().map_or_else(|| "unknown".into(), flag),
        ("bluetooth", Some(want)) => {
            let on = want == "on";
            match run("rfkill", &[if on { "unblock" } else { "block" }, "bluetooth"]) {
                Some(_) => "ok".into(),
                None => "error:unsupported".into(),
            }
        }
        ("wifi", None) => wifi_on().map_or_else(|| "unknown".into(), flag),
        ("wifi", Some(want)) => {
            let on = want == "on";
            match run("rfkill", &[if on { "unblock" } else { "block" }, "wlan"]) {
                Some(_) => "ok".into(),
                None => "error:unsupported".into(),
            }
        }
        ("ssh", None) => ssh_service().map_or_else(|| "unknown".into(), flag),
        ("ssh", Some(_)) => "error:unsupported".into(),
        // The remaining toggles describe device hardware this host has none of;
        // answering "unknown" is what keeps their rows honest.
        ("adb", _) | ("mtp", _) | ("mdns", _) | ("btAudio", _) | ("headphoneFix", _) | ("ntp", _) => {
            if argument.is_some() {
                return "error:unsupported".into();
            }
            match key {
                "ntp" => ntp_on().map_or_else(|| "unknown".into(), flag),
                _ => "unknown".into(),
            }
        }
        ("language", _) => String::new(),
        ("timeout", _) => String::new(),
        ("hostname", None) => hostname(),
        ("hostname", Some(_)) => "error:unsupported".into(),
        // Power requests are handled by the early return above: a preview must
        // never power the developer's machine off or reboot it.
        _ => String::new(),
    }
}
