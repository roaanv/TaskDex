# Build Prompt — TaskDex (Tauri + SQLite)

Paste the prompt below into Claude Code, with this `design_handoff_taskdex/` folder present in the
repo so Claude can read `README.md`, the `design_files/`, and the `screenshots/`.

---

You are building **TaskDex**, a local-first desktop task manager, as a **Tauri** application with a
**Rust + SQLite** backend and a **React + TypeScript + Vite** frontend. A complete design reference
and specification live in `design_handoff_taskdex/`. **Read `design_handoff_taskdex/README.md` in
full first**, then the files in `design_handoff_taskdex/design_files/` (especially `store.jsx`, which
is the authoritative data model and business logic) and the images in
`design_handoff_taskdex/screenshots/`.

## What TaskDex is
Tasks are **index cards** (title + notes + a flexible set of *typed* properties). Cards live in one
global pool. **Boards** are saved views that group cards into columns by a chosen property and
filter them with AND/OR rules. The signature UI is a neon "Outline Tube" card with **Dark, Light,
and Auto** themes. The HTML files are a **reference implementation** — recreate their look and
behavior in this stack; do not ship the HTML.

## Tech stack & non-negotiables
- **Tauri 2.x**, Rust backend, **SQLite** via `rusqlite` (bundled) or `sqlx` — your choice, but use
  a real SQLite file in the app data dir, with migrations.
- **Frontend:** React 18 + TypeScript + Vite. State via `useReducer` + Context, mirroring the
  reducer in `store.jsx`. Styling: CSS-in-JS or CSS modules/Tailwind — your call, but the **design
  tokens and two-theme system from the README must be reproduced exactly** (every hex value).
- **All persistence goes through the Rust/SQLite layer** (replacing the prototype's localStorage).
  The frontend holds the working model and calls Tauri commands (`invoke`) to persist every
  mutation; on launch it loads the full snapshot from the backend.
- Keep the **pure business logic** (type detection, date parsing, value formatting, filter
  evaluation, the property registry) as a shared TypeScript module ported 1:1 from `store.jsx`. Do
  not re-derive these rules — port them verbatim and add unit tests for `detectType`, `parseDate`,
  `formatValue`, and `evalFilter`.

## Suggested SQLite schema (normalize the prototype's state; refine as needed)
```sql
CREATE TABLE cards (
  id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL, ord INTEGER
);
CREATE TABLE card_props (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY (card_id, name)
);
CREATE TABLE card_promotions (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, front INTEGER NOT NULL DEFAULT 0, title INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_id, name)
);
CREATE TABLE boards (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
  group_by TEXT, filter_connector TEXT NOT NULL DEFAULT 'AND',
  filter_open INTEGER NOT NULL DEFAULT 0, ord INTEGER NOT NULL
);
CREATE TABLE board_filter_rules (
  id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  prop TEXT NOT NULL, op TEXT NOT NULL,
  value TEXT, value2 TEXT,                  -- value2 only used by the 'between' op
  ord INTEGER NOT NULL
);
CREATE TABLE board_columns (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  value TEXT NOT NULL, color TEXT, ord INTEGER, hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, value)
);
CREATE TABLE card_collapsed (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  collapsed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, card_id)
);
CREATE TABLE app_meta ( key TEXT PRIMARY KEY, value TEXT );  -- 'active_board_id', 'theme_pref', 'schema_version'
```

## Tauri commands (mirror the prototype's reducer actions)
Expose one command per mutation plus a snapshot loader. Each must write to SQLite in a transaction
and return either the updated entity or `()`:
- `get_snapshot() -> { cards, boards, active_board_id }`
- Cards: `add_card`, `update_card`, `delete_card`, `set_prop`, `rename_prop`, `remove_prop`,
  `toggle_promote`, `move_to_column`, `reorder_cards`, `set_collapsed`
- Boards: `add_board`, `remove_board`, `update_board`, `set_active`, `set_column_config`,
  `add_column`, `reorder_column`, `rename_column`
- App: `get_theme_pref`, `set_theme_pref`
Semantics must match `store.jsx` exactly — notably `move_to_column` sets the card's `group_by`
property value to the target column, and `rename_column` rewrites that value across **all** cards
and the board's column rows. Seed the database on first run with the sample data from `seed()` in
`store.jsx` (12 cards across Product Sprint, By Priority, Reading List) so the app opens populated.

## Frontend requirements (match the README precisely)
1. **Two-pane shell:** 248px Sidebar + flexible Board. Reproduce the dark "wall" / light surfaces.
2. **Theme system:** port `neon-theme.jsx` — both token palettes, the glow helpers (which go flat
   when `glow:false`), and Light/Dark/Auto with `prefers-color-scheme` for Auto. Own the theme
   state at the app root so the whole tree re-renders on change (see the README note). Persist the
   preference via `set_theme_pref`.
3. **Index card:** 3D flip (single content-swapping face), collapse animation, inline title/notes
   editing, **inline `Name: value` property capture** while typing notes, the Properties back editor
   with typed rows + pin-to-front / pin-to-title toggles + autocomplete Add-property input, and
   promoted chips. Each card glows in its column/board accent.
4. **Board:** top bar (group-by dropdown, filter toggle with count, match/total, + Card), the
   slide-down **filter panel** (AND/OR rule builder with type-aware operators/value controls),
   grouped columns (286px, color/rename/reorder/hide/add via header) and the ungrouped masonry list.
5. **Drag & drop:** native HTML5 DnD. Dragging dims the card to 0.4 and shows a glowing insertion
   line; drop sets the group property and reorders. **Critical:** render each card slot as a stable,
   key-reconciled element (not a remounting inline component) and drive the drag-dim from React
   state cleared on `dragend` and on drop — otherwise the dragged node unmounts mid-drag and the dim
   sticks (this bug is called out in the README; don't reintroduce it).
6. **Sidebar:** board list (activate / rename / recolor / delete-keeps-cards) + card count + the
   theme switch.

## Quality bar
- Pixel-match the hifi spec: tokens, radii (cards 18px, chips 999px), 286px columns/16px gaps,
  Space Grotesk + Space Mono, the exact glow treatments per theme.
- Type ≥ the README sizes; hit targets ≥ 24px; smooth flip/collapse/panel transitions.
- Add the unit tests noted above and a basic smoke test that the app boots, seeds, and round-trips a
  card edit through SQLite.

## Suggested delivery order
1. Tauri scaffold + SQLite migrations + seed + `get_snapshot`.
2. Port `store.jsx` logic to a typed `model.ts` (+ tests) and wire the reducer→command bridge.
3. Theme tokens + shell + Sidebar.
4. Board + columns + grouping + the card (front/back/flip/collapse).
5. Filters, drag & drop, column config.
6. Polish pass against the screenshots in both themes; tests; package the app.

Work in vertical slices, keep commands small and transactional, and check your UI against
`screenshots/01–04` in both themes as you go.
