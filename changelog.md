# Changelog

All notable changes to TaskDex are documented here. Versioning follows semantic-versioning concepts.

## [0.1.0] — Unreleased

Initial implementation: a Tauri 2 + Rust/SQLite + React/TypeScript recreation of the TaskDex
"Outline Tube" neon task board from the design handoff.

### Added

- **Backend (Rust + SQLite, `rusqlite` bundled).** Normalized schema with a `user_version`
  migration runner; first-run seed (12 cards / 3 boards); `get_snapshot` loader that preserves
  property insertion order via SQLite rowid; one transactional command per reducer action
  (cards, props, promotions, boards, columns, filters, collapse, theme pref).
- **Shared model (TypeScript), ported 1:1 from `store.jsx`.** `detectType`, `parseDate`,
  `formatValue`, `coerce`, `ruleMatch`/`evalFilter`, `buildRegistry`, and the full reducer.
- **Persistence bridge.** Optimistic reducer + an augmented dispatch that generates ids and
  derived fields, then persists each mutation via the matching Tauri command. Hydrates from the
  SQLite snapshot on launch.
- **Theme system.** Two exact-hex token palettes + glow helpers, provided via a root-owned
  Context; Light / Dark / Auto (Auto follows `prefers-color-scheme` live); preference persisted to
  the backend with a localStorage paint-cache.
- **UI.** Two-pane shell; Sidebar (board list with activate/rename/recolor/delete-keeps-cards +
  card count + theme switch); Board (group-by, filter toggle with count, match/total, +Card);
  grouped 286px columns with color/rename/reorder/hide/add + ungrouped masonry; the IndexCard
  (tube frame + accent glow, 3D flip, collapse, inline title/notes editing with live `Name: value`
  property capture, Properties back editor with pin toggles + autocomplete, promoted chips);
  FilterPanel (slide-down AND/OR rule builder with type-aware operators/value controls); native
  HTML5 drag-and-drop with stable keyed slots and state-driven drag-dim.
- **Reorderable boards.** The left Boards panel supports drag-and-drop reordering. A new
  `reorderBoards` reducer action rebuilds the board list from a new id order; the order persists
  to SQLite via a `reorder_boards` command that rewrites each board's `ord` (matching the existing
  `ORDER BY ord` load query, mirroring `reorderCards`). The Sidebar shows a glowing insertion line
  (with an end-of-list drop zone) and dims the dragged row; the drop target is held in a ref so the
  drop computation is independent of React render timing. Covered by reducer + `cargo test`.
- **Resizable & collapsible left panel.** The Sidebar width is drag-adjustable via a seam between
  the panel and board (clamped 200–460px); a header chevron collapses the panel to give the board
  full width, with a floating top-left button to reveal it again. Width + collapsed state persist
  to `localStorage` (`taskdex_sidebar`), mirroring the theme paint-cache convention. Geometry and
  the pointer-drag gesture live in a dedicated `useSidebarLayout` hook (unit-tested).
- **Tests.** 57 frontend (Vitest) + 8 backend (`cargo test`) covering the pure logic, the bridge
  mapping, the reducer, app boot/seed, and SQLite mutation round-trips. Makefile with
  setup/run/build/bundle/test/deploy targets.
- **Automatic properties.** Type `#name: value` in a card's notes to set a property. Property
  names autocomplete from properties already on the active board; an unknown name shows a
  "Create property" prompt before it is created.

### Changed

- Card notes now capture properties only from `#`-prefixed lines. Plain `name: value` lines
  are kept as ordinary notes text.

### Fixed

- Drag-and-drop drop target now works in the packaged app: set `dragDropEnabled: false` on the
  window so Tauri's native OS drag-drop handler stops intercepting the webview's in-page HTML5
  `drop` events. Guarded by a config test.
- Hidden columns now leave the board surface (and appear only as "show" pills); the prototype
  rendered them in both places.

### Notes

- Fonts load from Google Fonts (degrade to system fonts offline); self-hosting is a follow-up.
- `esbuild` advisories (transitive via Vite) are dev-server-only and absent from the shipped bundle.
