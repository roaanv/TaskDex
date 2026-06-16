# TaskDex — Implementation Plan

Local-first desktop task manager. **Tauri 2.x** (Rust + SQLite via `rusqlite` bundled) +
**React 18 + TypeScript + Vite**. Faithful, high-fidelity recreation of the `design_handoff_taskdex/`
reference. Styling: **CSS-in-JS + theme Context** (ported NEON tokens + glow helpers).

## Decisions (locked)
- **SQLite:** `rusqlite` with `bundled` feature. One transactional command per mutation + a snapshot loader.
- **Styling:** Port the two NEON palettes + glow helpers to a typed module; provide the resolved
  theme via React Context; inline style objects (mirrors the prototype). Dynamic per-accent glows
  stay as JS helper functions branching on a `glow` flag.
- **State:** `useReducer` + Context as the optimistic working model (ported 1:1 from `store.jsx`).
  Each dispatch also fires a transactional Tauri command to persist. `get_snapshot` hydrates on launch.
- **Target:** macOS (dev on Apple Silicon). Universal packaging deferred.

## Architecture
```
src-tauri/                  Rust backend
  src/db.rs                 connection, migrations (user_version pragma), seed
  src/model.rs              Rust structs mirroring the data model (serde)
  src/commands.rs           one #[tauri::command] per reducer action + get_snapshot
  src/main.rs / lib.rs      app setup, managed Db state
  migrations/0001_init.sql  schema from BUILD_PROMPT
src/                        React frontend
  model/                    PORTED 1:1 from store.jsx (pure, framework-agnostic)
    types.ts                Card, Board, Rule, State, Prop, PropType
    detect.ts               detectType, parseDate, formatValue, coerce, truthy, MONTHS
    filter.ts               ruleMatch, evalFilter
    registry.ts             buildRegistry
    reducer.ts              reducer (all actions) + uid + PALETTE + colorFor + seed
    *.test.ts               unit tests (detectType, parseDate, formatValue, evalFilter)
  theme/
    tokens.ts               THEMES (dark/light) exact hex, glow helpers, tint
    ThemeContext.tsx        useThemeState (root-owned), useTheme, ThemeSwitch
  store/
    StoreContext.tsx        provider: reducer + registry memo + command bridge + snapshot load
    bridge.ts               action -> invoke(command) mapping
  components/
    Shell, Sidebar, Board, TopBar, FilterPanel, IndexCard (+ subcomponents), columns
  api.ts                    typed invoke wrappers
```

## Delivery slices (vertical, test each before expanding)
1. **Scaffold + DB foundation.** Tauri 2 React-TS scaffold at repo root. rusqlite migrations +
   `user_version`. Seed (12 cards / 3 boards) on first run. `get_snapshot` command. Verify app boots
   and returns seeded snapshot.
2. **Port store.jsx -> model.ts (+ tests).** detectType/parseDate/formatValue/evalFilter/reducer/
   registry verbatim. Vitest unit tests pass. Wire StoreContext + command bridge.
3. **Theme + shell + Sidebar.** tokens.ts (exact hex), glow helpers, ThemeContext (Light/Dark/Auto +
   prefers-color-scheme), two-pane shell, Sidebar (board list, rename/recolor/delete, count, theme switch).
4. **Board + columns + card.** TopBar (group-by, filter toggle, match/total, +Card), grouped columns
   (286px/16px) + ungrouped masonry, IndexCard (frame/glow, title bar, front/back flip, collapse,
   inline notes prop-capture, Properties editor, promoted chips).
5. **Filters + DnD + column config.** FilterPanel AND/OR rule builder w/ type-aware ops; native HTML5
   drag (dim-from-state, stable keyed slots, glowing insertion line); column color/rename/reorder/hide/add.
6. **Polish + tests + package.** Pixel pass vs screenshots (both themes); smoke test (boot/seed/roundtrip);
   Makefile (setup/build/run/deploy); package.

## Non-negotiables to honor
- Exact hex tokens, radii (card 18, chips 999), 286px columns / 16px gaps, Space Grotesk + Space Mono.
- `move_to_column` sets the card's groupBy prop value to the target column.
- `rename_column` rewrites the value across ALL cards AND the board's column rows.
- Drag-dim driven by React state, cleared on `dragend` AND drop; slots are stable keyed elements.
- Theme owned at app root so the whole tree re-renders; Auto follows OS live.
- Data is never destroyed (deleting a board keeps cards).
```
```
