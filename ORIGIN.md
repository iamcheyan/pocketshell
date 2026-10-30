# Provenance

- Lifted from `~/development/pocketjs-baseos-frontend/inputs/launcher-src/`
  (the payload's frozen launcher source), which is itself the
  `feat/pocketshell-cards` baseline — horizontal `CardCarousel` — plus the
  Wi-Fi / Settings / System pages that only existed in the payload snapshot.
- Upstream family: `ROCKNIX/packages/apps/pocketjs-runtime/hello/` in
  `~/development/rocknix` (worktrees `pocketshell-cards`,
  `pocketshell-cards-integrate`, `launcher-redesign`, `pocketshell-visual-v2`,
  `pocketshell-system-redesign`).
- Matching on-device artifact at extraction time (2026-10-31):
  `boot.pocket` 4,203,976 bytes, sha256
  `6ed41612bce1723d1eda64b5a0ee9333a105ed498b7085c03267539cf6c1b32d`,
  built 2026-10-30 18:30. Verified by matching UI string sets and the
  `CardCarousel` / Wi-Fi page markers inside the package's JS section.
- The earlier user-approved package (`boot.approved.pocket`, 4,084,728 bytes,
  sha256 `d2836f45e0221dd0de1525a38324cc56f0915282fb864cc74570e707dfa93ee2`)
  corresponds to the `feat/pocketshell-cards` snapshot without the Wi-Fi page.

Rebuilds are not byte-identical to the historical artifacts: the font atlas bake
and plan serialization vary with SDK version. Behavioural parity is what matters;
verify with `make check` + a device frame, not by hash.
