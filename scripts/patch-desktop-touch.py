#!/usr/bin/env python3
"""Wire desktop mouse and native touch into PocketJS frame contacts.

Usage: python3 scripts/patch-desktop-touch.py SDK_ROOT
Reapply before building the desktop host. No device profile changes required.
"""
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit(__doc__)
sdk = Path(sys.argv[1]).resolve()
target = sdk / "programs/desktop/src/main.rs"
source = target.read_text()
marker = "mod pocketshell_desktop_contacts;"
if marker not in source:
    changes = [
        ("mod gpu;", "mod gpu;\nmod pocketshell_desktop_contacts;"),
        ("    Reset,\n", "    Touch(u64, f32, f32, u8),\n    CancelContacts,\n    Reset,\n"),
        ("    mouse_down: bool,\n", "    mouse_down: bool,\n    desktop_contacts: pocketshell_desktop_contacts::DesktopContacts,\n"),
        ("            mouse_down: false,\n", "            mouse_down: false,\n            desktop_contacts: Default::default(),\n"),
        ("    fn svc(&self, event: Value) {", """    fn svc(&mut self, event: Value) {
        if !self.args.editor && event["t"] == "mouse" && event["b"] != 2 {
            if let (Some(x), Some(y), Some(down)) = (event["x"].as_f64(), event["y"].as_f64(), event["d"].as_bool()) {
                self.desktop_contacts.mouse(x as f32, y as f32, down);
            }
        }"""),
        ("            Input::Reset => {", """            Input::Touch(id, x, y, phase) => {
                if !self.args.editor { self.desktop_contacts.touch(id, x, y, phase); }
            }
            Input::CancelContacts => self.desktop_contacts.reset(),
            Input::Reset => {
                self.desktop_contacts.reset();"""),
        ("        facts.buttons = buttons;", """        facts.buttons = buttons;
        let (contacts, cancelled) = self.desktop_contacts.sample();
        facts.contacts.extend(contacts.into_iter().map(|(id, x, y)| pocket_drivers::Contact { surface: 0, id, x, y, cancelled: false }));
        facts.cancelled.extend(cancelled.into_iter().map(|id| pocket_drivers::CancelledContact { surface: 0, id }));"""),
        ("            WindowEvent::CursorMoved { position, .. } => {", """            WindowEvent::Touch(touch) => {
                let scale = self.window.as_ref().unwrap().scale_factor();
                let phase = match touch.phase {
                    winit::event::TouchPhase::Started => 0,
                    winit::event::TouchPhase::Moved => 1,
                    winit::event::TouchPhase::Ended => 2,
                    winit::event::TouchPhase::Cancelled => 3,
                };
                self.send(Input::Touch(touch.id, (touch.location.x / scale) as f32, (touch.location.y / scale) as f32, phase));
            }
            WindowEvent::CursorLeft { .. } => {
                self.down = false;
                self.send(Input::CancelContacts);
            }
            WindowEvent::CursorMoved { position, .. } => {"""),
    ]
    for before, after in changes:
        if source.count(before) != 1:
            raise SystemExit(f"Expected exactly one desktop anchor: {before!r}")
        source = source.replace(before, after, 1)
    target.write_text(source)
shutil.copyfile(root / "bridge/desktop-contacts.rs", target.parent / "pocketshell_desktop_contacts.rs")
print(f"desktop mouse/touch frame contacts installed: {target}")
