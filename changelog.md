# Changelog

All notable changes to TaskDex are documented here. Versioning follows semantic-versioning concepts.

## [0.1.0] — Unreleased

Initial implementation: a Tauri 2 + Rust/SQLite + React/TypeScript recreation of the TaskDex
"Outline Tube" neon task board from the design handoff.

### Added

- **Column drag-and-drop reordering.** A grip handle on each column header lets you drag a column
  to a new position; a vertical insertion indicator marks the drop point (left half of a column =
  drop before it, right half = drop after) and the dragged column dims while in flight. Column and
  card drag share one container but stay isolated via separate drag refs. Backed by a new
  `reorderColumns` reducer action (full ordered value list → sequential `order`s, mirroring
  `reorderCards`) and a transactional `reorder_columns` Tauri/SQLite command. The existing
  left/right arrow buttons remain. Covered by reducer, bridge-mapping, and Rust ops tests.
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
- **Tests.** 46 frontend (Vitest) + 7 backend (`cargo test`) covering the pure logic, the bridge
  mapping, the reducer, app boot/seed, and SQLite mutation round-trips. Makefile with
  setup/run/build/bundle/test/deploy targets.

### Fixed

- Drag-and-drop drop target now works in the packaged app: set `dragDropEnabled: false` on the
  window so Tauri's native OS drag-drop handler stops intercepting the webview's in-page HTML5
  `drop` events. Guarded by a config test.
- Hidden columns now leave the board surface (and appear only as "show" pills); the prototype
  rendered them in both places.
- **Renaming a column no longer changes its position** — now fixed structurally. Columns are no
  longer derived-from-values with order bolted on a side map (which fell back to an alphabetical
  name sort, so a rename re-sorted the column). Each board now stores an **ordered list of columns
  per group-by property** (`Board.columnsByProperty`), where a column's position is its index in
  the list and `value` is just a mutable label. Renaming is a single in-place value edit, so the
  index — and thus the position — never moves. The previous "freeze the order on rename" workaround
  (the `order` argument threaded through `renameColumn`) was removed as redundant.

### Changed

- **Per-property column model.** A board keeps a separate ordered column list for every property it
  has been grouped by, so switching the group-by and switching back restores that property's exact
  order. First time a property is grouped, its columns seed alphabetically; new values append to the
  end; renames stay in place. Empty columns are kept (you can still drop cards into them) and are
  removed only via an explicit new **Remove column** action (shown on empty columns) — removal never
  touches card data. Spec: `plans/columns-by-property-spec.md`.
- **Schema change without migration (reseed).** `board_columns` is now keyed by
  `(board_id, property, value)` with a dense `ord`. Per decision, there is no migration: the app
  reseeds fresh dummy data on an empty database. An existing development database from earlier runs
  was moved aside (not deleted) to
  `~/Library/Application Support/io.zero112.taskdex/backup-preschema-*/` and can be restored if
  needed. New backend command `remove_column`; `rename_column` is now global with a collision guard
  (renaming to a name already in use is a no-op); column commands are property-scoped.

### Notes

- Fonts load from Google Fonts (degrade to system fonts offline); self-hosting is a follow-up.
- `esbuild` advisories (transitive via Vite) are dev-server-only and absent from the shipped bundle.
