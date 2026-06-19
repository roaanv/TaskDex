# Card–Board Association & Default Filtering — Design

**Date:** 2026-06-19
**Branch:** `card-board-association-and-default-filtering`
**Status:** Approved (design)

## Problem

Today TaskDex cards live in one global pool and boards are saved *views*: a board
shows every card that passes its user-configured filter (`evalFilter(card, board.filter)`).
A card therefore appears on every board whose filter it satisfies — it has no home.

We want a card to **belong** to a board:

- Every card has a `Board` property by default.
- The property's value is the board the card was created in.
- Each board has a built-in, **non-user-configurable** filter that shows only cards
  whose `Board` value matches the board's name.
- This built-in filter works **in conjunction with** (ANDed with) the user filter.

## Conceptual model

Every board carries an **implicit ownership predicate** — `card.Board == board.name` —
that is *computed*, never stored as an editable rule (so it cannot be user-configured).
The predicate is ANDed with the existing user filter.

One board, the **All board**, is the single board where the ownership predicate is
switched off. It shows every card regardless of `Board` value (its user filter still
applies). It is the home where orphaned / legacy cards are found and reassigned.

This is a deliberate shift from "views over a shared pool" to "cards owned by a
board": once cards carry a `Board` value and boards filter on it, each card is
scoped to a single board (plus the All board).

## Decisions (resolved during brainstorming)

1. **Identity = board name.** The `Board` value stores the board's *name*.
2. **Rename propagation.** Renaming a board rewrites every owned card's `Board`
   value to the new name (a board's name and its cards' `Board` value are the same
   string by definition).
3. **Orphan / legacy cards.** Handled via the **All board** (no ownership filter),
   not via lenient matching. On regular boards, ownership is strict: a card with no
   `Board` property appears on *no* regular board — only on the All board.
4. **`Board` is a normal property.** Auto-populated on creation, but otherwise a
   regular prop: editable (editing moves the card to another board), and visible in
   group-by / filter pickers / autocomplete.
5. **Create-on-All leaves `Board` unset.** A card created while viewing the All
   board becomes an orphan (only visible on All) until the user assigns it a board.
6. **All board is protected.** It cannot be deleted or renamed, and is re-created if
   missing. It can still have its own group-by and user filter, which persist.

## Architecture

### New constants and helpers — `src/model/board.ts` (new), re-exported from `src/model/index.ts`

```ts
export const BOARD_PROP = 'Board';
export const ALL_BOARD_ID = 'b_all';

export const isAllBoard = (b: Board | null | undefined): boolean =>
  !!b && b.id === ALL_BOARD_ID;

/** Ownership only (ignores the user filter). */
export function ownsCard(board: Board, card: Card): boolean {
  if (isAllBoard(board)) return true;                 // All board: ownership off
  const p = card.props[BOARD_PROP];
  return !!p && String(p.value) === board.name;       // strict match by name
}

/** Full visibility = ownership AND user filter. The single source of truth. */
export function cardVisibleOnBoard(card: Card, board: Board | null | undefined): boolean {
  if (!board) return evalFilter(card, null);
  return ownsCard(board, card) && evalFilter(card, board.filter);
}
```

`cardVisibleOnBoard` is the one predicate used wherever "the cards on this board"
is computed, guaranteeing the ownership predicate always ANDs with the user filter.

**Call sites updated** (currently `evalFilter(card, board.filter)`):
- `src/components/Board.tsx:565` — the `filtered` list driving the board view.
- `src/components/Shell.tsx:77` — per-board card counts in the sidebar.
- `src/model/registry.ts:27` — `buildBoardRegistry` ("cards on the board").

### Setting `Board` on creation — `src/components/Board.tsx` (`addCardToColumn`)

After the existing filter-rule seeding (`Board.tsx:696`):

```ts
if (!isAllBoard(board)) {
  props[BOARD_PROP] = { type: 'select', value: board.name };
}
```

`select` type matches how enumerated props like `Status` / `Area` are typed.
`addCardToColumn` is the only card-creation path in the UI; `addCard` in the
reducer and the persistence bridge already carry arbitrary `props` through to
`card_props`, so no reducer/bridge change is needed for creation.

### Board rename propagation — `src/model/reducer.ts` (`updateBoard`)

When an `updateBoard` patch changes `name` (and it is not blocked — see All board):
also rewrite every card whose `Board` value equals the old name to the new name,
reusing the same value-rewrite mechanism `renameColumn` already implements for
property values. The board's own `name` is updated as today.

Persistence reuses the existing backend bulk value-rename SQL
(`src-tauri/src/ops.rs:487`: `UPDATE card_props SET value=?3 WHERE name=?1 AND value=?2`)
— **no new backend command, no schema change.** The bridge detects a board-name
change (old name from state vs. patch) and issues both the board update and the
`Board` value-rename.

### The All board — reserved id, protected

- An **ordinary board row**: `id = "b_all"`, `name = "All"`, `groupBy = null`
  (null so orphans show — a *grouped* view hides cards that lack the group value),
  empty user filter, pinned first in the sidebar.
- **Backend ensures it exists** on snapshot load (`src-tauri/src/db.rs`):
  idempotent insert of the row if absent. This is a *seeded row*, not a schema
  change, and covers pre-existing databases.
- **Protection:**
  - Reducer `removeBoard` no-ops when `id === ALL_BOARD_ID`.
  - Reducer `updateBoard` strips any `name` from the patch when `id === ALL_BOARD_ID`
    (group-by / filter / other fields still apply).
  - `Sidebar.tsx` hides the delete and rename affordances for the All board.
  - Defensive guard in the backend `remove_board` (`ops.rs`) rejecting `b_all`.

### Seed data — `src-tauri/src/db.rs`

Update the seed so demo cards receive a `Board` value matching their intended board
(so the demo boards aren't empty on first run), and add the All board to the seed.

## Persistence & migration

No schema migration. The `card_props` table is already a schema-less
`(card_id, name, type, value)` store, so the `Board` property persists through the
existing `add_card` / `set_prop` paths. The All board is a seeded row ensured on
load. The rename propagation reuses the existing value-rename SQL.

## Files touched

**Frontend**
- `src/model/board.ts` (new) — constants + `isAllBoard`, `ownsCard`, `cardVisibleOnBoard`.
- `src/model/index.ts` — re-export the above.
- `src/model/reducer.ts` — rename propagation; All-board delete/rename guards.
- `src/model/registry.ts` — `buildBoardRegistry` uses `cardVisibleOnBoard`.
- `src/components/Board.tsx` — `cardVisibleOnBoard`; set `Board` on creation.
- `src/components/Shell.tsx` — counts use `cardVisibleOnBoard`.
- `src/components/Sidebar.tsx` — hide delete/rename for the All board; pin first.
- `src/store/bridge.ts` — persist rename propagation (board update + value-rename).

**Backend**
- `src-tauri/src/db.rs` — ensure All board on load; seed `Board` values + All board.
- `src-tauri/src/ops.rs` — defensive `remove_board` guard for `b_all`.
- No DB schema migration.

**Tests**
- `src/model/board.test.ts` (new) — ownership, All board, orphan behavior, AND-with-user-filter.
- Reducer tests — rename propagation, All-board delete/rename guards.
- Bridge test — rename persistence (board update + value-rename).
- Fix existing tests that assumed cards show on a board without a `Board` prop.
- Backend tests for ensure-All-board and the delete guard.
- Changelog entry.

## Known limitations (acceptable for now)

- Board names are not enforced unique: two boards with the same name would share
  cards. A duplicate-name guard can be added later.
- Manually setting a card's `Board` to a non-existent name parks it on the All
  board until corrected.
- Grouping the All board by `Board` would hide orphans (cards lacking the value),
  a pre-existing limitation of grouped views; the All board defaults to ungrouped.

## Acceptance criteria

1. Creating a card on a regular board sets `Board = <that board's name>`; the card
   appears on that board and not on other regular boards.
2. A regular board shows exactly the cards whose `Board` equals its name **and**
   that pass its user filter (the two combine with AND).
3. The All board shows all cards passing its user filter, regardless of `Board`.
4. A card with no `Board` property appears only on the All board.
5. Creating a card on the All board leaves `Board` unset (card is an orphan).
6. Renaming a regular board moves all its cards with it (their `Board` updates).
7. The All board cannot be deleted or renamed and is re-created if missing; its
   group-by and user filter still work and persist.
8. No database schema migration is required; existing databases gain the All board
   automatically on load.
