# PocketShell Library

PocketShell Library is the content consumption workspace for TXT, Markdown, LOG, README, Agent reports, and technical documents on the 720×480 RG34XX panel. It uses PocketJS-native Solid UI and the native filesystem bridge. It does not launch a Linux reader process.

## Architecture

- `library-model.ts`: pure document/state types, lazy section extraction, progress, search, and UTF-8 chunk helpers behind `FileSystem`.
- `library.tsx`: PocketJS Solid Library UI, controller state machine, OSK search, reading, bookmarks, and settings.
- `pocketshell-library.rs`: host bridge with roots `/storage/docs`, `/storage/books`, `/storage/reports`, `/storage/library`; each read window is capped at 16 KiB.
- Persistence: `/storage/pocketshell/library/{progress,bookmarks,history,settings}.json`.

Markdown headings become lazy chapter entries. Paragraphs, lists, code fences, quotes and links remain readable plain text. A/B navigate and select, D-pad scrolls lines, left/right jump, L1/R1 page, L/R chapter navigation, X bookmarks, long X opens bookmarks, Y opens search, START opens settings. The PocketJS system `TextField` provides keyboard input. Agent actions remain placeholders.

## Build

`package.mk` copies the app into the pinned PocketJS scratch build tree, checks/compiles `pocket.json` to `library.pocket`, and compiles `boot-pocket.json` to the immutable boot package. `patch-runtime.py` installs `pocketshell-library.rs` into the guest host and exposes `ui.__library(command)`.

## Data and OTA

The native state root defaults to `/storage/pocketshell/library`. Host checks may override it with `POCKETSHELL_LIBRARY_DATA_ROOT`; content roots can be overridden with `POCKETSHELL_LIBRARY_ROOTS` (platform path list). State writes use temp-file rename; invalid JSON uses in-memory defaults without overwriting the corrupt source. The data directory is on persistent `/storage`, outside OS packages, slot trees, and OTA staging. See `docs/heya-core-minimal/POCKETSHELL_LIBRARY.md` for the snapshot contract and local OTA/Remote Dev boundaries.

## Host harness

Use `node tools/pocketshell-dev/library-harness.js` from the repo root after compiling `library.pocket` with the same pinned PocketJS web compiler. It serves the same PocketJS browser host assets and app bundle, synthetic fixture roots, and a temporary in-memory data root. Fixtures are under `fixtures/`; they do not represent real user history.
