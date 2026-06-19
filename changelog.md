# Changelog

All notable changes to TaskDex are documented here. Versioning follows semantic-versioning concepts.

## [0.1.0] — Unreleased

Initial implementation: a Tauri 2 + Rust/SQLite + React/TypeScript recreation of the TaskDex
"Outline Tube" neon task board from the design handoff.

### Added

- **Card–board association:** every card now carries a `Board` property set to the
  board it was created on. Each board shows only its own cards (ownership ANDed
  with the user filter). Renaming a board moves its cards with it.
- **All board:** a protected board (cannot be deleted or renamed) that shows every
  card regardless of `Board`, so orphaned/legacy cards can be found and reassigned.
  Cards created on the All board are left unassigned. No database migration required.
- **Enable / disable a filter without clearing its rules.** A single On/Off toggle in the filter
  panel header (shown once a board has at least one rule) turns the whole filter off — the rules are
  kept but ignored, so every card shows — and back on. When off, the rule list dims to signal it is
  inactive. The behaviour lives in one place: `evalFilter` short-circuits to "pass" when
  `filter.enabled === false` (an optional flag; a missing value means enabled, so filters saved
  before this field keep working). Persisted across restarts via a new `filter_enabled` column on
  `boards` (migration `0002_filter_enabled.sql`, default `1`), written by `update_board` and read by
  the snapshot loader. Covered by `evalFilter` unit tests and a Rust round-trip persistence test.
- **Fixed an unresolved merge conflict committed in `src-tauri/src/ops.rs`** (from the "Rename
  columns" commit) that left conflict markers in the test module and prevented the Rust backend from
  compiling. Resolved by keeping both tests (`reorder_boards_persists_new_order` and
  `reorder_columns_assigns_sequential_order_from_the_list`).
- **New cards open in title-edit mode.** Adding a card (top-bar **+ Card**, a column's **+ Add
  card**, or a column header's add button) now drops straight into editing that card's title with
  the field focused and the placeholder (`New task`) selected, so the first keystroke replaces it —
  no double-click needed. The board pre-generates the card id (already supported by `addCard`) so it
  can flag exactly the freshly-mounted `IndexCard`, which consumes the flag on mount and clears it.
  Covered by `IndexCard.test.tsx`.
- **Cmd/Ctrl+Enter finishes note editing.** While editing a card's notes on the front face,
  pressing `Cmd+Enter` (or `Ctrl+Enter` on non-mac keyboards) now saves the changes and exits the
  editor — the same save path as blur/`Escape`, so `#name: value` properties are still captured.
  Plain `Enter` continues to insert a newline so notes remain multi-line. Covered by
  `IndexCard.test.tsx`.
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

- **Column-reorder drop indicator now uses the dragged column's color** instead of the purple
  theme accent. The vertical insertion bar shown while dragging a column to reorder it
  (`ColInsertBar`) takes the color of the column being dragged, matching the card-drop indicator
  which already uses its column's color (falls back to the theme accent if the color can't be
  resolved).
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
