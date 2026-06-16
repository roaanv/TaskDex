# TaskDex

A local-first desktop task manager built around **index cards** — every task is a card with a
free-text title, free-text notes, and a flexible set of *typed* properties (Status, Priority, Due,
Rating, …). Cards live in one global pool; **Boards** are saved views that group cards into columns
by a chosen property and filter them with AND/OR rules. The signature look is the neon **"Outline
Tube"** card, with **Dark**, **Light**, and **Auto** themes.

Built as a **Tauri 2** desktop app: a **Rust + SQLite** backend and a **React 18 + TypeScript +
Vite** frontend. All persistence goes through the Rust/SQLite layer.

## Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2.x (macOS) |
| Backend | Rust, SQLite via `rusqlite` (bundled), `indexmap` for order-preserving maps |
| Frontend | React 18 + TypeScript + Vite |
| Styling | CSS-in-JS via a theme **Context** (two token palettes + glow helpers ported from the design) |
| State | `useReducer` + Context (ported 1:1 from the prototype) + a per-mutation command bridge |
| Tests | Vitest (frontend) + `cargo test` (backend) |

## Prerequisites

- Node 18+ and npm
- Rust (stable) + Cargo
- macOS with Xcode Command Line Tools (for the Tauri webview)

## Quick start

```bash
make setup      # npm install
make run        # launch the app (Vite + Tauri webview, hot reload)
```

On first launch the SQLite database (in the OS app-data dir) is created, migrated, and seeded with
12 sample cards across three boards (Product Sprint, By Priority, Reading List).

```bash
make build      # compile both halves to verify the build
make bundle     # produce a distributable .app / .dmg
make test       # run all tests (Vitest + cargo)
make typecheck  # tsc --noEmit
```

> Running plain `vite` (`npm run dev`) in a normal browser works for UI iteration: with no Tauri
> backend it falls back to an in-memory **dev seed** and disables persistence. The shipped app
> always uses the SQLite backend.

## Architecture

```
src-tauri/                     Rust backend
  migrations/0001_init.sql     schema (applied via the user_version pragma)
  src/model.rs                 serde structs mirroring the TS model (order-preserving maps)
  src/db.rs                    connection, migration runner, first-run seed, snapshot loader
  src/ops.rs                   transactional logic for every mutation (unit-tested)
  src/commands.rs              thin #[tauri::command] wrappers over ops
  src/lib.rs                   app setup (DB in app-data dir) + command registration
src/                           React frontend
  model/                       PORTED 1:1 from the prototype's store.jsx (pure, tested):
    detect.ts                  detectType / parseDate / formatValue / coerce
    filter.ts                  ruleMatch / evalFilter
    registry.ts                buildRegistry
    reducer.ts                 the reducer + action types + PALETTE + uid
  theme/                       tokens.ts (both palettes + glow helpers) + ThemeContext + ThemeSwitch
  store/                       StoreContext (hydrate from snapshot) + bridge (dispatch → command)
  api.ts                       typed invoke() wrappers
  components/                  Shell, Sidebar, Board, FilterPanel, IndexCard
```

**Data flow.** The frontend reducer is the optimistic working model. On launch the store hydrates
from `get_snapshot`. Each dispatched action is *augmented* with any generated id/derived field (so
the reducer stays a pure function of its inputs) and then *persisted* via the matching Tauri command
— one transactional command per mutation, mirroring the reducer actions.

**Theme.** Theme state is owned at the app root so the whole tree re-renders on change. Each theme
resolves to a token object plus glow helper functions (`tube`/`bloom`/`tubeFrame`/`glowDot`) that go
flat in Light mode. **Auto** follows `prefers-color-scheme` live. The preference persists to the
backend (`set_theme_pref`) with a localStorage paint-cache to avoid a flash on launch.

## Testing

- **Frontend** (`npm test`): `detectType` / `parseDate` / `formatValue` / `evalFilter`, the reducer's
  trickiest actions, the dispatch→command bridge mapping, and an App boot/seed smoke test.
- **Backend** (`cargo test`): seed + snapshot load, and round-trip tests through the real `ops` code
  (set_prop ordering, move_to_column type inheritance, rename_column global rewrite, toggle_promote,
  add/update card, filter-rule replace) — this covers the "round-trip a card edit through SQLite"
  smoke test.

## Notes

- **Fonts** (Space Grotesk + Space Mono) load from Google Fonts; offline they degrade to system
  sans/mono. Self-hosting them is a possible follow-up for full offline fidelity.
- **`npm audit`** reports advisories in `esbuild` (transitive via Vite). These are dev-server-only
  and not present in the shipped static bundle; the only fix is a breaking Vite 8 upgrade, deferred.

The original design reference lives in `design_handoff_taskdex/` and the implementation plan in
`plans/`.
