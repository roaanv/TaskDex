# Card–Board Association & Default Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every card belong to the board it was created on, and filter each board to its own cards (combined with the user filter), with one protected "All" board that shows everything.

**Architecture:** A computed ownership predicate (`card.props.Board === board.name`) is ANDed with the existing user filter at every "cards on this board" site. The All board (reserved id `b_all`) skips ownership. `Board` is a normal, auto-populated card property; no DB schema migration is needed (the `card_props` table is already schema-less). Renaming a board rewrites its cards' `Board` value via the existing `rename_column` mechanism.

**Tech Stack:** React 18 + TypeScript (Vite, Vitest), Tauri 2 Rust backend (rusqlite/SQLite), reducer + persistence-bridge store.

**Design doc:** `docs/superpowers/specs/2026-06-19-card-board-association-design.md`

## Global Constraints

- No `any` types; remove unused imports/vars (TS clean). Each new file starts with a header comment describing its purpose.
- **No DB schema migration.** The `Board` property is an ordinary `card_props` row; the All board is an ordinary `boards` row ensured on load.
- A board's name **is** its cards' `Board` value (same string). The `Board` property type is always `'select'`.
- Reserved id of the All board is the string `"b_all"`; its name is `"All"`. It is protected from delete and rename, but its group-by and user filter still work.
- Commit after every task. Run `npm run typecheck` before committing frontend tasks. Frontend tests: `npm test` (or `npx vitest run <file>`). Rust tests: `cd src-tauri && cargo test`.

## File Structure

**New**
- `src/model/board.ts` — ownership constants + predicates (`BOARD_PROP`, `ALL_BOARD_ID`, `isAllBoard`, `ownsCard`, `cardVisibleOnBoard`) and `newCardProps` (initial props for a created card). One responsibility: card↔board association rules.
- `src/model/board.test.ts` — unit tests for the above.

**Modified — frontend**
- `src/model/index.ts` — re-export `./board`.
- `src/store/devSeed.ts` — `Board` value on each seed card + an All board.
- `src/model/registry.ts` — `buildBoardRegistry` uses `cardVisibleOnBoard`.
- `src/model/registry.test.ts` — give cards a `Board` value so the filter test still exercises filtering.
- `src/components/Shell.tsx` — sidebar count uses `cardVisibleOnBoard`.
- `src/components/Board.tsx` — visible cards use `cardVisibleOnBoard`; new cards use `newCardProps`.
- `src/model/reducer.ts` — `updateBoard` propagates a rename to owned cards and blocks renaming the All board; `removeBoard` protects the All board.
- `src/model/reducer.test.ts` — tests for the above.
- `src/store/bridge.ts` — persist a board rename (board update + `Board` value rename); skip persisting a delete/rename of the All board.
- `src/store/bridge.test.ts` — tests for the above.
- `src/components/Sidebar.tsx` — hide delete + disable rename for the All board.

**Modified — backend**
- `src-tauri/src/db.rs` — `ALL_BOARD_ID` const + `ensure_all_board`; seed cards get a `Board` value; fix the seed snapshot test.
- `src-tauri/src/lib.rs` — call `ensure_all_board` after `ensure_seeded`.
- `src-tauri/src/ops.rs` — `remove_board`/`update_board` guards for the All board + tests.

**Other**
- `changelog.md` — entry.

---

### Task 1: Ownership model (`src/model/board.ts`)

**Files:**
- Create: `src/model/board.ts`
- Create: `src/model/board.test.ts`
- Modify: `src/model/index.ts`

**Interfaces:**
- Produces:
  - `const BOARD_PROP = 'Board'` and `const ALL_BOARD_ID = 'b_all'`
  - `isAllBoard(board: Board | null | undefined): boolean`
  - `ownsCard(board: Board, card: Card): boolean`
  - `cardVisibleOnBoard(card: Card, board: Board | null | undefined): boolean`
  - `newCardProps(board: Board, registry: Registry, colValue: string | null): Record<string, Prop>`

- [ ] **Step 1: Write the failing test** — create `src/model/board.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  ALL_BOARD_ID,
  BOARD_PROP,
  cardVisibleOnBoard,
  isAllBoard,
  newCardProps,
  ownsCard,
} from './board';
import type { Board, Card, Registry } from './types';

const card = (id: string, props: Card['props']): Card => ({
  id, body: id + '\n', props, promotions: {}, created: 0,
});
const board = (over: Partial<Board> = {}): Board => ({
  id: 'b1', name: 'Sprint', color: '#fff', groupBy: null,
  filter: { connector: 'AND', rules: [] }, filterOpen: false,
  columnsByProperty: {}, collapsed: {}, ...over,
});

describe('ownsCard', () => {
  it('matches when Board equals the board name', () => {
    expect(ownsCard(board(), card('a', { Board: { type: 'select', value: 'Sprint' } }))).toBe(true);
  });
  it('does not match a different name or a missing Board on a regular board', () => {
    expect(ownsCard(board(), card('a', { Board: { type: 'select', value: 'Other' } }))).toBe(false);
    expect(ownsCard(board(), card('b', {}))).toBe(false);
  });
  it('the All board owns every card, including orphans', () => {
    const all = board({ id: ALL_BOARD_ID, name: 'All' });
    expect(ownsCard(all, card('a', {}))).toBe(true);
    expect(ownsCard(all, card('b', { Board: { type: 'select', value: 'X' } }))).toBe(true);
  });
});

describe('cardVisibleOnBoard', () => {
  it('requires BOTH ownership and the user filter (AND)', () => {
    const b = board({ filter: { connector: 'AND', rules: [{ id: 'r', prop: 'Status', op: 'is', value: 'Done' }] } });
    expect(cardVisibleOnBoard(card('a', { Board: { type: 'select', value: 'Sprint' }, Status: { type: 'select', value: 'Done' } }), b)).toBe(true);
    expect(cardVisibleOnBoard(card('b', { Board: { type: 'select', value: 'Sprint' }, Status: { type: 'select', value: 'Todo' } }), b)).toBe(false);
    expect(cardVisibleOnBoard(card('c', { Status: { type: 'select', value: 'Done' } }), b)).toBe(false);
  });
  it('the All board applies its user filter but ignores ownership', () => {
    const all = board({ id: ALL_BOARD_ID, name: 'All', filter: { connector: 'AND', rules: [{ id: 'r', prop: 'Status', op: 'is', value: 'Done' }] } });
    expect(cardVisibleOnBoard(card('a', { Status: { type: 'select', value: 'Done' } }), all)).toBe(true);
    expect(cardVisibleOnBoard(card('b', { Status: { type: 'select', value: 'Todo' } }), all)).toBe(false);
  });
  it('a null board shows every card', () => {
    expect(cardVisibleOnBoard(card('a', {}), null)).toBe(true);
  });
});

describe('isAllBoard', () => {
  it('is true only for the reserved id', () => {
    expect(isAllBoard(board({ id: ALL_BOARD_ID }))).toBe(true);
    expect(isAllBoard(board())).toBe(false);
    expect(isAllBoard(null)).toBe(false);
  });
});

describe('newCardProps', () => {
  const reg: Registry = {};
  it('stamps the Board name on a regular board', () => {
    expect(newCardProps(board(), reg, null)[BOARD_PROP]).toEqual({ type: 'select', value: 'Sprint' });
  });
  it('leaves Board unset on the All board (orphan)', () => {
    expect(newCardProps(board({ id: ALL_BOARD_ID, name: 'All' }), reg, null)[BOARD_PROP]).toBeUndefined();
  });
  it('seeds the group-by column value and stamps Board', () => {
    const p = newCardProps(board({ groupBy: 'Status' }), reg, 'Done');
    expect(p.Status).toEqual({ type: 'select', value: 'Done' });
    expect(p[BOARD_PROP]).toEqual({ type: 'select', value: 'Sprint' });
  });
  it("seeds props from the board's `is` filter rules", () => {
    const b = board({ filter: { connector: 'AND', rules: [{ id: 'r', prop: 'Area', op: 'is', value: 'Eng' }] } });
    expect(newCardProps(b, reg, null).Area).toEqual({ type: 'text', value: 'Eng' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/board.test.ts`
Expected: FAIL — cannot resolve `./board` / functions not defined.

- [ ] **Step 3: Write minimal implementation** — create `src/model/board.ts`

```ts
// board.ts — card↔board association rules. Every board "owns" the cards whose
// `Board` property equals its name; the All board (reserved id) owns all cards.
// This ownership predicate is computed (never a stored, user-editable rule) and
// is ANDed with the board's user filter at every "cards on this board" site.

import { evalFilter } from './filter';
import type { Board, Card, Prop, Registry } from './types';

/** Property name that records which board a card belongs to. */
export const BOARD_PROP = 'Board';

/** Reserved id of the All board (no ownership filter; protected from delete/rename). */
export const ALL_BOARD_ID = 'b_all';

/** The All board shows every card regardless of its `Board` value. */
export function isAllBoard(board: Board | null | undefined): boolean {
  return !!board && board.id === ALL_BOARD_ID;
}

/** Whether a card belongs to a board (ownership only — ignores the user filter). */
export function ownsCard(board: Board, card: Card): boolean {
  if (isAllBoard(board)) return true;
  const p = card.props[BOARD_PROP];
  return !!p && String(p.value) === board.name;
}

/** Cards on a board = ownership AND the user filter. The single source of truth. */
export function cardVisibleOnBoard(card: Card, board: Board | null | undefined): boolean {
  if (!board) return evalFilter(card, null);
  return ownsCard(board, card) && evalFilter(card, board.filter);
}

/**
 * Initial props for a card created on `board`:
 *  1. the group-by column value (when added into a specific column),
 *  2. values seeded from the board's `is` filter rules (so the card matches the view),
 *  3. the `Board` ownership stamp — except on the All board, where it is left unset
 *     so the new card is an orphan the user then assigns.
 */
export function newCardProps(
  board: Board,
  registry: Registry,
  colValue: string | null,
): Record<string, Prop> {
  const props: Record<string, Prop> = {};
  if (board.groupBy && colValue != null) {
    const ex = registry[board.groupBy];
    props[board.groupBy] = { type: ex ? ex.type : 'select', value: String(colValue) };
  }
  (board.filter?.rules ?? []).forEach((r) => {
    if (r.op === 'is' && r.value && !props[r.prop]) {
      props[r.prop] = { type: registry[r.prop]?.type ?? 'text', value: String(r.value) };
    }
  });
  if (!isAllBoard(board) && !props[BOARD_PROP]) {
    props[BOARD_PROP] = { type: 'select', value: board.name };
  }
  return props;
}
```

- [ ] **Step 4: Re-export from the barrel** — edit `src/model/index.ts`, add after the `./filter` line:

```ts
export * from './board';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/model/board.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/model/board.ts src/model/board.test.ts src/model/index.ts
git commit -m "feat: card-board ownership model (board.ts)"
```

---

### Task 2: Seed `Board` values + All board in the dev seed

This keeps the browser/test seed consistent with the new model so later tasks (and `App.test`) stay green.

**Files:**
- Modify: `src/store/devSeed.ts`

- [ ] **Step 1: Import the constant** — edit the import on line 7:

Replace:
```ts
import { makeCard, uid } from '../model';
```
with:
```ts
import { ALL_BOARD_ID, makeCard, uid } from '../model';
```

- [ ] **Step 2: Add a `Board` value to every seed card.** In each of the 12 `props: { … }` objects in `CARDS`, append the matching entry just before the closing `}` (the values map cards to boards so the demo boards are populated):

| # | Card title | append to `props` |
|---|------------|-------------------|
| 0 | Redesign onboarding flow | `, Board: prop('select', 'Product Sprint')` |
| 1 | Ship dark mode | `, Board: prop('select', 'By Priority')` |
| 2 | Fix flaky CI pipeline | `, Board: prop('select', 'By Priority')` |
| 3 | Write Q3 OKRs | `, Board: prop('select', 'Product Sprint')` |
| 4 | Interview 5 power users | `, Board: prop('select', 'Product Sprint')` |
| 5 | Migrate to new icon set | `, Board: prop('select', 'Product Sprint')` |
| 6 | Launch referral program | `, Board: prop('select', 'By Priority')` |
| 7 | Refactor settings module | `, Board: prop('select', 'By Priority')` |
| 8 | Thinking in Systems | `, Board: prop('select', 'Reading List')` |
| 9 | The Design of Everyday Things | `, Board: prop('select', 'Reading List')` |
| 10 | Shape Up | `, Board: prop('select', 'Reading List')` |
| 11 | A Pattern Language | `, Board: prop('select', 'Reading List')` |

Example (card 0) — replace:
```ts
    props: { Status: prop('select', 'In progress'), Priority: prop('select', 'High'), Due: prop('date', 'Jun 22'), Estimate: prop('int', '8'), Area: prop('select', 'Design') },
```
with:
```ts
    props: { Status: prop('select', 'In progress'), Priority: prop('select', 'High'), Due: prop('date', 'Jun 22'), Estimate: prop('int', '8'), Area: prop('select', 'Design'), Board: prop('select', 'Product Sprint') },
```

- [ ] **Step 3: Add the All board.** In `devSeedState`, rename the `const boards: Board[] = [` declaration to `const realBoards: Board[] = [`, then replace the final `return { … }` line:

Replace:
```ts
  return { cards, boards, activeBoardId: boards[0].id, version: 1 };
```
with:
```ts
  const allBoard: Board = {
    id: ALL_BOARD_ID, name: 'All', color: '#8a93a8', groupBy: null,
    filter: { connector: 'AND', rules: [] }, filterOpen: false,
    columnsByProperty: {}, collapsed: {},
  };
  return { cards, boards: [allBoard, ...realBoards], activeBoardId: realBoards[0].id, version: 1 };
```

- [ ] **Step 4: Verify the app smoke test still passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — Product Sprint is active and still shows "Redesign onboarding flow"; the extra `Board` prop and the inactive All board don't affect it.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/store/devSeed.ts
git commit -m "feat: seed Board values and All board in dev seed"
```

---

### Task 3: Apply ownership at the three display sites + card creation

**Files:**
- Modify: `src/model/registry.ts`
- Modify: `src/model/registry.test.ts`
- Modify: `src/components/Shell.tsx`
- Modify: `src/components/Board.tsx`

**Interfaces:**
- Consumes: `cardVisibleOnBoard`, `newCardProps` from `../model` (Task 1).

- [ ] **Step 1: Update the registry test first** — edit `src/model/registry.test.ts`. In the first test ("includes only props on cards passing the board filter"), give both cards a `Board` value matching the board name `'B'` and add `Board` to the expected keys.

Replace:
```ts
    const cards = {
      a: card('a', { status: { type: 'text', value: 'open' }, owner: { type: 'text', value: 'me' } }),
      b: card('b', { status: { type: 'text', value: 'done' }, due: { type: 'date', value: '1/1/2026' } }),
    };
    const reg = buildBoardRegistry(cards, board([
      { id: 'r', prop: 'status', op: 'is', value: 'open' },
    ]));
    expect(Object.keys(reg).sort()).toEqual(['owner', 'status']);
    expect(reg.due).toBeUndefined();
```
with:
```ts
    const cards = {
      a: card('a', { Board: { type: 'select', value: 'B' }, status: { type: 'text', value: 'open' }, owner: { type: 'text', value: 'me' } }),
      b: card('b', { Board: { type: 'select', value: 'B' }, status: { type: 'text', value: 'done' }, due: { type: 'date', value: '1/1/2026' } }),
    };
    const reg = buildBoardRegistry(cards, board([
      { id: 'r', prop: 'status', op: 'is', value: 'open' },
    ]));
    expect(Object.keys(reg).sort()).toEqual(['Board', 'owner', 'status']);
    expect(reg.due).toBeUndefined();
```

- [ ] **Step 2: Run the registry test to verify it fails**

Run: `npx vitest run src/model/registry.test.ts`
Expected: FAIL — `buildBoardRegistry` still uses `evalFilter` (ownership not applied yet), so card `a`'s keys won't include `Board` filtering semantics as expected. (It will fail on the `['Board','owner','status']` assertion.)

- [ ] **Step 3: Switch the registry to ownership** — edit `src/model/registry.ts`.

Replace:
```ts
import type { Card, Registry, Board } from './types';
import { evalFilter } from './filter';
```
with:
```ts
import type { Card, Registry, Board } from './types';
import { cardVisibleOnBoard } from './board';
```

Replace:
```ts
  Object.values(cards).forEach((c) => {
    if (evalFilter(c, board ? board.filter : null)) subset[c.id] = c;
  });
```
with:
```ts
  Object.values(cards).forEach((c) => {
    if (cardVisibleOnBoard(c, board)) subset[c.id] = c;
  });
```

- [ ] **Step 4: Run the registry test to verify it passes**

Run: `npx vitest run src/model/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Switch the sidebar count** — edit `src/components/Shell.tsx`.

Replace:
```ts
import { evalFilter } from '../model';
```
with:
```ts
import { cardVisibleOnBoard } from '../model';
```

Replace:
```ts
  const countFor = (b: Board) =>
    Object.values(state.cards).filter((c) => evalFilter(c, b.filter)).length;
```
with:
```ts
  const countFor = (b: Board) =>
    Object.values(state.cards).filter((c) => cardVisibleOnBoard(c, b)).length;
```

- [ ] **Step 6: Switch the board view + card creation** — edit `src/components/Board.tsx`.

Replace the model import (line 14):
```ts
import { colorFor, evalFilter, PALETTE, presentValues, reconcileColumns } from '../model';
```
with:
```ts
import { cardVisibleOnBoard, colorFor, newCardProps, PALETTE, presentValues, reconcileColumns } from '../model';
```

Replace the `filtered` memo:
```ts
  const filtered = useMemo(
    () => allCards.filter((c) => evalFilter(c, board ? board.filter : null)),
    [allCards, board],
  );
```
with:
```ts
  const filtered = useMemo(
    () => allCards.filter((c) => cardVisibleOnBoard(c, board)),
    [allCards, board],
  );
```

Replace the whole `addCardToColumn` function:
```ts
  const addCardToColumn = (colValue: string | null) => {
    const props: Record<string, { type: import('../model').PropType; value: string }> = {};
    if (grouped && colValue != null) {
      const ex = registry[groupBy];
      props[groupBy] = { type: ex ? ex.type : 'select', value: String(colValue) };
    }
    (board.filter && board.filter.rules ? board.filter.rules : []).forEach((r) => {
      if (r.op === 'is' && r.value && !props[r.prop]) {
        props[r.prop] = {
          type: (registry[r.prop] && registry[r.prop].type) || 'text',
          value: String(r.value),
        };
      }
    });
    dispatch({ type: 'addCard', body: 'New task\n', props });
  };
```
with:
```ts
  const addCardToColumn = (colValue: string | null) => {
    const props = newCardProps(board, registry, colValue);
    dispatch({ type: 'addCard', body: 'New task\n', props });
  };
```

- [ ] **Step 7: Run the full frontend suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS. (`App.test` still finds "Redesign onboarding flow" on Product Sprint; `board.test` and `registry.test` pass.)

- [ ] **Step 8: Commit**

```bash
git add src/model/registry.ts src/model/registry.test.ts src/components/Shell.tsx src/components/Board.tsx
git commit -m "feat: filter boards by card ownership and stamp Board on create"
```

---

### Task 4: Board rename propagation + All-board guards (reducer)

**Files:**
- Modify: `src/model/reducer.ts`
- Modify: `src/model/reducer.test.ts`

**Interfaces:**
- Consumes: `ALL_BOARD_ID`, `BOARD_PROP` from `./board`.

- [ ] **Step 1: Write the failing tests** — append to the `describe('reducer', …)` block in `src/model/reducer.test.ts` (before its closing `});`):

```ts
  it('renaming a board rewrites the Board value on its owned cards', () => {
    const s = baseState();
    s.boards[0].name = 'Sprint';
    s.cards.a.props.Board = { type: 'select', value: 'Sprint' };
    s.cards.b.props.Board = { type: 'select', value: 'Other' };
    const next = reducer(s, { type: 'updateBoard', id: 'b1', patch: { name: 'Sprint 2' } });
    expect(next.boards[0].name).toBe('Sprint 2');
    expect(next.cards.a.props.Board.value).toBe('Sprint 2'); // owned -> moved
    expect(next.cards.b.props.Board.value).toBe('Other');    // not owned -> untouched
  });

  it('the All board cannot be renamed', () => {
    const s = baseState();
    s.boards[0] = { ...s.boards[0], id: 'b_all', name: 'All' };
    const next = reducer({ ...s, activeBoardId: 'b_all' }, { type: 'updateBoard', id: 'b_all', patch: { name: 'Renamed', groupBy: 'Status' } });
    expect(next.boards[0].name).toBe('All');         // name change dropped
    expect(next.boards[0].groupBy).toBe('Status');   // other fields still applied
  });

  it('the All board cannot be removed', () => {
    const s = baseState();
    s.boards[0] = { ...s.boards[0], id: 'b_all', name: 'All' };
    const next = reducer({ ...s, activeBoardId: 'b_all' }, { type: 'removeBoard', id: 'b_all' });
    expect(next.boards).toHaveLength(1);
    expect(next.boards[0].id).toBe('b_all');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/model/reducer.test.ts`
Expected: FAIL — rename does not propagate; All board is renamed/removed.

- [ ] **Step 3: Implement** — edit `src/model/reducer.ts`.

Add the constants import after the `detect` import near the top:
```ts
import { ALL_BOARD_ID, BOARD_PROP } from './board';
```

Replace the `removeBoard` case opening:
```ts
    case 'removeBoard': {
      const boards = state.boards.filter((b) => b.id !== a.id);
```
with:
```ts
    case 'removeBoard': {
      if (a.id === ALL_BOARD_ID) return state; // the All board is protected
      const boards = state.boards.filter((b) => b.id !== a.id);
```

Replace the entire `updateBoard` case:
```ts
    case 'updateBoard':
      return {
        ...state,
        boards: state.boards.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)),
      };
```
with:
```ts
    case 'updateBoard': {
      const target = state.boards.find((b) => b.id === a.id);
      // The All board's name is fixed — drop any attempt to rename it.
      let patch = a.patch;
      if (a.id === ALL_BOARD_ID && 'name' in patch) {
        patch = { ...patch };
        delete patch.name;
      }
      // A board's name IS its cards' `Board` value: renaming the board renames
      // that value across every card it owns.
      let cards = state.cards;
      const newName = patch.name;
      if (target && newName && newName !== target.name) {
        cards = { ...state.cards };
        Object.values(cards).forEach((c) => {
          const p = c.props[BOARD_PROP];
          if (p && String(p.value) === target.name) {
            cards[c.id] = { ...c, props: { ...c.props, [BOARD_PROP]: { ...p, value: newName } } };
          }
        });
      }
      return {
        ...state,
        cards,
        boards: state.boards.map((b) => (b.id === a.id ? { ...b, ...patch } : b)),
      };
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/model/reducer.test.ts`
Expected: PASS (new + existing, including "removeBoard keeps cards" which targets `b1`, not `b_all`).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/model/reducer.ts src/model/reducer.test.ts
git commit -m "feat: propagate board rename to owned cards; protect All board in reducer"
```

---

### Task 5: Persist board rename + All-board guard (bridge)

**Files:**
- Modify: `src/store/bridge.ts`
- Modify: `src/store/bridge.test.ts`

**Interfaces:**
- Consumes: `ALL_BOARD_ID`, `BOARD_PROP` from `../model`; `api.updateBoard`, `api.renameColumn`, `api.removeBoard`.

- [ ] **Step 1: Write the failing tests** — append inside `describe('persist', …)` in `src/store/bridge.test.ts` (before its closing `});`):

```ts
  it('renaming a board also renames the Board value across cards', async () => {
    await persist({ type: 'updateBoard', id: 'b1', patch: { name: 'New' } }, state());
    expect(calls.updateBoard[0]).toEqual(['b1', { name: 'New' }]);
    expect(calls.renameColumn[0]).toEqual(['Board', 'B', 'New']); // prev name 'B' -> 'New'
  });

  it('does not rename the All board or propagate its name', async () => {
    const s = state();
    s.boards = [{ ...s.boards[0], id: 'b_all', name: 'All' }];
    await persist({ type: 'updateBoard', id: 'b_all', patch: { name: 'Nope' } }, s);
    expect(calls.renameColumn).toHaveLength(0);
  });

  it('does not persist deletion of the All board', async () => {
    await persist({ type: 'removeBoard', id: 'b_all' }, state());
    expect(calls.removeBoard).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store/bridge.test.ts`
Expected: FAIL — `renameColumn` not called on rename; `removeBoard` called for `b_all`.

- [ ] **Step 3: Implement** — edit `src/store/bridge.ts`.

Add to the model import (line 5/6 area):
```ts
import { ALL_BOARD_ID, BOARD_PROP, colorFor, detectType, uid } from '../model';
```
(replacing the existing `import { colorFor, detectType, uid } from '../model';`).

Replace the `removeBoard` case:
```ts
    case 'removeBoard':
      return api.removeBoard(action.id);
```
with:
```ts
    case 'removeBoard':
      if (action.id === ALL_BOARD_ID) return; // protected; backend also guards
      return api.removeBoard(action.id);
```

Replace the `updateBoard` case:
```ts
    case 'updateBoard':
      return api.updateBoard(action.id, action.patch);
```
with:
```ts
    case 'updateBoard': {
      await api.updateBoard(action.id, action.patch);
      const prevBoard = prev.boards.find((b) => b.id === action.id);
      const newName = action.patch.name;
      if (prevBoard && typeof newName === 'string' && newName !== prevBoard.name && action.id !== ALL_BOARD_ID) {
        await api.renameColumn(BOARD_PROP, prevBoard.name, newName);
      }
      return;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/store/bridge.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/store/bridge.ts src/store/bridge.test.ts
git commit -m "feat: persist board rename as Board value rename; guard All board"
```

---

### Task 6: Hide delete + disable rename for the All board (Sidebar)

**Files:**
- Modify: `src/components/Sidebar.tsx`

No unit test exists for the Sidebar; verify via typecheck and the running app.

- [ ] **Step 1: Import the constant** — edit the imports.

Replace:
```ts
import { PALETTE } from '../model';
```
with:
```ts
import { ALL_BOARD_ID, PALETTE } from '../model';
```

- [ ] **Step 2: Compute the flag** — in `BoardRow`, after `const t = useTheme();` add:

```ts
  const isAll = board.id === ALL_BOARD_ID;
```

- [ ] **Step 3: Disable rename** — in the name `<span>`'s `onDoubleClick` handler, guard `setEditing`.

Replace:
```ts
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
```
with:
```ts
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isAll) setEditing(true);
          }}
```

- [ ] **Step 4: Hide the delete button** — wrap the delete `<button className="td-board-del" …>…</button>` so it renders only when `!isAll`.

Replace the opening of the delete button:
```ts
      <button
        className="td-board-del"
        onClick={remove}
```
with:
```ts
      {!isAll && (
      <button
        className="td-board-del"
        onClick={remove}
```
and replace its closing `</button>` (the one immediately after the trash-icon `</svg>`) with:
```ts
      </button>
      )}
```

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck`
Expected: PASS. (Optionally `make run` and confirm the "All" row has no trash icon and double-click does not edit it.)

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: hide delete and disable rename for the All board"
```

---

### Task 7: Ensure the All board exists on the backend

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `pub const ALL_BOARD_ID: &str = "b_all";` and `pub fn ensure_all_board(conn: &mut Connection) -> rusqlite::Result<()>` in `db.rs`.

- [ ] **Step 1: Write the failing test** — add to the `mod tests` block in `src-tauri/src/db.rs` (inside `#[cfg(test)] mod tests { … }`):

```rust
    #[test]
    fn ensure_all_board_is_idempotent_and_pins_first() {
        let mut conn = mem();
        ensure_seeded(&mut conn).unwrap();
        ensure_all_board(&mut conn).unwrap();
        ensure_all_board(&mut conn).unwrap(); // idempotent
        let snap = load_snapshot(&conn).unwrap();
        let all: Vec<&Board> = snap.boards.iter().filter(|b| b.id == ALL_BOARD_ID).collect();
        assert_eq!(all.len(), 1, "exactly one All board");
        assert_eq!(all[0].name, "All");
        assert_eq!(snap.boards[0].id, ALL_BOARD_ID, "pinned first (ord -1)");
        assert_eq!(snap.boards.len(), 4, "3 seed boards + All");
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd src-tauri && cargo test ensure_all_board_is_idempotent_and_pins_first`
Expected: FAIL — `ensure_all_board` / `ALL_BOARD_ID` not found (compile error).

- [ ] **Step 3: Implement** — in `src-tauri/src/db.rs`, add the constant near the top (after the `use` block, before `pub fn open`):

```rust
/// Reserved id of the All board — shows every card (ownership filter off) and is
/// protected from delete/rename. Ensured to exist on every launch.
pub const ALL_BOARD_ID: &str = "b_all";
```

Add the function right after `ensure_seeded` (after its closing `}`):

```rust
/// Ensure the protected "All" board row exists (idempotent). Pinned first via a
/// low `ord`. Not a schema change — just a seeded row, so existing databases gain
/// it on the next launch.
pub fn ensure_all_board(conn: &mut Connection) -> rusqlite::Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM boards WHERE id = ?1",
        params![ALL_BOARD_ID],
        |r| r.get(0),
    )?;
    if exists == 0 {
        conn.execute(
            "INSERT INTO boards (id, name, color, group_by, filter_connector, filter_open, ord)
             VALUES (?1, 'All', '#8a93a8', NULL, 'AND', 0, -1)",
            params![ALL_BOARD_ID],
        )?;
    }
    Ok(())
}
```

- [ ] **Step 4: Call it on startup** — edit `src-tauri/src/lib.rs`.

Replace:
```rust
            db::ensure_seeded(&mut conn).expect("failed to seed database");
```
with:
```rust
            db::ensure_seeded(&mut conn).expect("failed to seed database");
            db::ensure_all_board(&mut conn).expect("failed to ensure All board");
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd src-tauri && cargo test ensure_all_board_is_idempotent_and_pins_first`
Expected: PASS. Then run the whole file's suite: `cd src-tauri && cargo test` — existing tests still pass (their `seeded()`/`mem()` helpers don't call `ensure_all_board`).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/lib.rs
git commit -m "feat: ensure protected All board exists on launch"
```

---

### Task 8: Backend guards for the All board (ops)

**Files:**
- Modify: `src-tauri/src/ops.rs`

- [ ] **Step 1: Write the failing tests** — add to `src-tauri/src/ops.rs`'s `mod tests` block. First extend the test import on line 515:

Replace:
```rust
    use crate::db::{ensure_seeded, load_snapshot, migrate};
```
with:
```rust
    use crate::db::{ensure_all_board, ensure_seeded, load_snapshot, migrate, ALL_BOARD_ID};
```

Then add the tests:
```rust
    #[test]
    fn remove_board_ignores_the_all_board() {
        let mut conn = seeded();
        ensure_all_board(&mut conn).unwrap();
        remove_board(&mut conn, ALL_BOARD_ID).unwrap();
        let snap = load_snapshot(&conn).unwrap();
        assert!(snap.boards.iter().any(|b| b.id == ALL_BOARD_ID), "All board survives");
    }

    #[test]
    fn update_board_ignores_a_rename_of_the_all_board() {
        let mut conn = seeded();
        ensure_all_board(&mut conn).unwrap();
        update_board(
            &mut conn,
            ALL_BOARD_ID,
            &serde_json::json!({ "name": "Renamed", "groupBy": "Status" }),
        )
        .unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let all = snap.boards.iter().find(|b| b.id == ALL_BOARD_ID).unwrap();
        assert_eq!(all.name, "All", "name unchanged");
        assert_eq!(all.group_by.as_deref(), Some("Status"), "other fields still applied");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd src-tauri && cargo test all_board`
Expected: FAIL — the All board gets deleted / renamed.

- [ ] **Step 3: Implement** — edit `src-tauri/src/ops.rs`.

In `remove_board`, add a guard as the first line of the function body (before `let tx = conn.transaction()?;`):
```rust
    if id == crate::db::ALL_BOARD_ID {
        return Ok(()); // the All board is protected
    }
```

In `update_board`, guard the name update. Replace:
```rust
    if let Some(name) = pstr(patch, "name") {
        tx.execute(
            "UPDATE boards SET name = ?2 WHERE id = ?1",
            params![id, name],
        )?;
    }
```
with:
```rust
    if id != crate::db::ALL_BOARD_ID {
        if let Some(name) = pstr(patch, "name") {
            tx.execute(
                "UPDATE boards SET name = ?2 WHERE id = ?1",
                params![id, name],
            )?;
        }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test all_board`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ops.rs
git commit -m "feat: backend guards protecting the All board from delete/rename"
```

---

### Task 9: Seed `Board` values in the Rust seed

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Update the seed snapshot test first** — edit `seeds_and_loads_snapshot` in `db.rs`.

Replace:
```rust
        assert_eq!(names, vec!["Status", "Priority", "Due", "Estimate", "Area"]);
```
with:
```rust
        assert_eq!(names, vec!["Status", "Priority", "Due", "Estimate", "Area", "Board"]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd src-tauri && cargo test seeds_and_loads_snapshot`
Expected: FAIL — seed card 0 has no `Board` prop yet, so `names` ends at `"Area"`.

- [ ] **Step 3: Append a `Board` prop to each seed card.** In the `SeedCard` array in `seed()`, append the matching tuple to the end of each `props: &[ … ]` slice (same card→board mapping as the dev seed):

| # | append to `props` |
|---|-------------------|
| 0 | `, ("Board", "select", "Product Sprint")` |
| 1 | `, ("Board", "select", "By Priority")` |
| 2 | `, ("Board", "select", "By Priority")` |
| 3 | `, ("Board", "select", "Product Sprint")` |
| 4 | `, ("Board", "select", "Product Sprint")` |
| 5 | `, ("Board", "select", "Product Sprint")` |
| 6 | `, ("Board", "select", "By Priority")` |
| 7 | `, ("Board", "select", "By Priority")` |
| 8 | `, ("Board", "select", "Reading List")` |
| 9 | `, ("Board", "select", "Reading List")` |
| 10 | `, ("Board", "select", "Reading List")` |
| 11 | `, ("Board", "select", "Reading List")` |

Example (card 0) — replace:
```rust
            props: &[("Status", "select", "In progress"), ("Priority", "select", "High"), ("Due", "date", "Jun 22"), ("Estimate", "int", "8"), ("Area", "select", "Design")],
```
with:
```rust
            props: &[("Status", "select", "In progress"), ("Priority", "select", "High"), ("Due", "date", "Jun 22"), ("Estimate", "int", "8"), ("Area", "select", "Design"), ("Board", "select", "Product Sprint")],
```

- [ ] **Step 4: Run the backend suite to verify it passes**

Run: `cd src-tauri && cargo test`
Expected: PASS — `seeds_and_loads_snapshot` now matches, and `set_prop_upsert_updates_in_place_and_appends` still holds (`Board` is appended after `Area`, so `Status` stays first and `Zeta` stays last).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: assign Board values to seed cards so demo boards populate"
```

---

### Task 10: Changelog + full verification

**Files:**
- Modify: `changelog.md`

- [ ] **Step 1: Add a changelog entry** at the top of the most recent version's section in `changelog.md`:

```markdown
### Added
- **Card–board association:** every card now carries a `Board` property set to the
  board it was created on. Each board shows only its own cards (ownership ANDed
  with the user filter). Renaming a board moves its cards with it.
- **All board:** a protected board (cannot be deleted or renamed) that shows every
  card regardless of `Board`, so orphaned/legacy cards can be found and reassigned.
  Cards created on the All board are left unassigned. No database migration required.
```

- [ ] **Step 2: Run every test suite + build**

Run: `npm run typecheck && make test && make build`
Expected: PASS — frontend Vitest, Rust cargo tests, and both build halves succeed.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `make run`. Verify: the sidebar shows "All" first (no trash icon, double-click doesn't rename); creating a card on "Product Sprint" keeps it there and not on "By Priority"; renaming a board carries its cards along; orphaned cards appear on "All".

- [ ] **Step 4: Commit**

```bash
git add changelog.md
git commit -m "docs: changelog for card-board association and default filtering"
```

---

## Self-Review

**Spec coverage:**
- "All cards have a Board property by default / set to the creating board" → Task 1 (`newCardProps`) + Task 3 (wired into `addCardToColumn`); seeds in Tasks 2 & 9.
- "Default non-configurable filter: Board == board name, combined with user filter" → Task 1 (`cardVisibleOnBoard`) + Task 3 (three display sites).
- "Propagate renames" → Task 4 (reducer) + Task 5 (bridge).
- "All board for orphans; protected from delete/rename; own group-by/filter" → Tasks 6, 7, 8 (+ dev seed in Task 2).
- "Create-on-All leaves Board unset" → Task 1 (`newCardProps` skips the All board).
- "No schema migration; existing DBs gain the All board on load" → Task 7 (`ensure_all_board`).

**Placeholder scan:** none — every step has concrete code/commands.

**Type/name consistency:** `BOARD_PROP`, `ALL_BOARD_ID`, `isAllBoard`, `ownsCard`, `cardVisibleOnBoard`, `newCardProps` are defined in Task 1 and consumed verbatim in Tasks 3–6; the Rust `ALL_BOARD_ID` / `ensure_all_board` are defined in Task 7 and consumed in Task 8. Card→board mapping is identical in the dev seed (Task 2) and the Rust seed (Task 9).

## Known limitations (carried from the design)
- Board names are not unique; two boards with the same name would share cards.
- A board rename and its `Board` value rename are two backend calls (not one transaction); on a same-name collision the value rename no-ops (existing `rename_column` guard), so frontend state may briefly differ from disk until reload.
- Setting a card's `Board` to a non-existent name parks it on the All board until corrected.
