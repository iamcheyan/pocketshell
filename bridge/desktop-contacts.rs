//! Tick-sampled mouse/touch contacts. Keep fast down/up edges on separate
//! frames, so a click received between ticks cannot disappear.
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Copy)]
enum Event { Set(u64, f32, f32), End(u64), Cancel(u64) }
#[derive(Default)]
pub struct DesktopContacts {
    active: HashMap<u64, (u32, f32, f32)>,
    pending: VecDeque<Event>,
    next_id: u32,
    mouse_down: bool,
}
impl DesktopContacts {
    pub fn mouse(&mut self, x: f32, y: f32, down: bool) {
        if down { self.set(u64::MAX, x, y); }
        else if self.mouse_down { self.pending.push_back(Event::End(u64::MAX)); }
        self.mouse_down = down;
    }
    fn set(&mut self, id: u64, x: f32, y: f32) {
        if !x.is_finite() || !y.is_finite() { return; }
        // Motion may coalesce; press/release/cancel edges must not.
        if let Some(Event::Set(old_id, old_x, old_y)) = self.pending.back_mut()
            && *old_id == id {
            *old_x = x; *old_y = y; return;
        }
        self.pending.push_back(Event::Set(id, x, y));
    }
    pub fn touch(&mut self, id: u64, x: f32, y: f32, phase: u8) {
        match phase {
            0 | 1 => self.set(id, x, y),
            2 => self.pending.push_back(Event::End(id)),
            _ => self.pending.push_back(Event::Cancel(id)),
        }
    }
    pub fn reset(&mut self) {
        self.pending.clear();
        for id in self.active.keys() { self.pending.push_back(Event::Cancel(*id)); }
        self.mouse_down = false;
    }
    pub fn sample(&mut self) -> (Vec<(u32, f32, f32)>, Vec<u32>) {
        let mut cancelled = Vec::new();
        let mut moved = false;
        // One lifecycle edge per sample preserves down/up even under batching.
        // Deliver the last movement before a release so sliders see its value.
        while let Some(event) = self.pending.pop_front() {
            if moved && !matches!(event, Event::Set(..)) {
                self.pending.push_front(event);
                break;
            }
            match event {
                Event::Set(id, x, y) => {
                    if let Some(c) = self.active.get_mut(&id) { c.1 = x; c.2 = y; moved = true; }
                    else if self.active.len() < 8 {
                        self.next_id = self.next_id.wrapping_add(1);
                        self.active.insert(id, (self.next_id, x, y));
                        break;
                    }
                }
                Event::End(id) => { self.active.remove(&id); break; }
                Event::Cancel(id) => {
                    if let Some((wire, _, _)) = self.active.remove(&id) { cancelled.push(wire); }
                    break;
                }
            }
        }
        let mut contacts: Vec<_> = self.active.values().copied().collect();
        contacts.sort_by_key(|c| c.0);
        (contacts, cancelled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fast_click_survives_tick_batching() {
        let mut s = DesktopContacts::default();
        s.mouse(10., 20., true); s.mouse(10., 20., false);
        assert_eq!(s.sample().0.len(), 1);
        assert!(s.sample().0.is_empty());
    }
    #[test]
    fn focus_loss_cancels_instead_of_clicking() {
        let mut s = DesktopContacts::default();
        s.touch(90, 10., 20., 0);
        let id = s.sample().0[0].0;
        s.reset();
        let (contacts, cancelled) = s.sample();
        assert!(contacts.is_empty()); assert_eq!(cancelled, vec![id]);
    }
    #[test]
    fn drag_and_multitouch_keep_identity() {
        let mut s = DesktopContacts::default();
        s.touch(50, 10., 20., 0); let id = s.sample().0[0].0;
        s.touch(50, 40., 20., 1); s.touch(60, 30., 40., 0);
        let contacts = s.sample().0;
        assert_eq!(contacts.len(), 2); assert_eq!(contacts[0], (id, 40., 20.));
    }
    #[test]
    fn last_drag_position_precedes_release() {
        let mut s = DesktopContacts::default();
        s.mouse(10., 20., true); s.sample();
        s.mouse(90., 20., true); s.mouse(90., 20., false);
        assert_eq!(s.sample().0[0].1, 90.);
        assert!(s.sample().0.is_empty());
    }
}
