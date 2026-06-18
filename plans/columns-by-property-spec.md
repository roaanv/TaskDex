# Spec: Columns-by-Property (ordered, per-property column lists)

Status: **Proposed** — awaiting approval before implementation.
Author: design conversation, 2026-06-17.
Supersedes: the "freeze-on-rename" workaround (the optional `order` arg on `renameColumn`)
shipped in changelog `0.1.0 › Fixed › "Renaming a column no longer changes its position"`.

---

## 1. Objective

Give each board a **dictionary of properties → ordered list of columns**, so that:

1. A board remembers a distinct, user-controlled column order **per group-by property**.
2. Switching the group-by property and switching back **restores** that property's order exactly.
3. **Renaming a column never changes its position** — by construction, not by compensation.

This replaces today's model, where a board has a single implicit `columns` map keyed by the
current group value, columns are *derived* from card values, and order lives in a side table that
most columns have no row in (so they fall back to an alphabetical sort by name — the source of the
rename-jump bug).

### Target user
Single-user desktop app (Tauri). No multi-user/concurrency concerns. Personal task board.

### The three agreed commitments
- **(a) The list is stored and authoritative.** Column membership + order are persisted, not
  re-derived each render. This is what makes position independent of name.
- **(b) Reconcile on value drift.** Card values change over time; the stored list is reconciled by
  **appending** newly-appearing values to the end and applying a defined empty-column policy.
- **(c) Rename stays a global value-rewrite.** Columns still join to cards by their **value string**,
  so renaming rewrites that value on all matching cards and in every board's list for that property.
  (Eliminating this would require column ids on cards — explicitly **out of scope**, see §10.)

### Non-goals
- No migration path. We **reseed** the database with fresh dummy data (per owner decision).
- No move to column-ids / classic-kanban join model (keeps the "group by any property" capability).

---

## 2. Data model

### 2.1 In-memory (TypeScript — `src/model/types.ts`)

```ts
/** One column within a property's ordered list. Position = array index. */
export interface Column {
  value: string;        // the group value; ALSO the join key to card props (commitment c)
  color?: string;
  hidden?: boolean;
}

export interface Board {
  id: string;
  name: string;
  color: string;
  groupBy: string | null;
  filter: Filter;
  filterOpen: boolean;
  // NEW: property name -> ordered columns. Replaces `columns: Record<string, ColumnConfig>`.
  columnsByProperty: Record<string, Column[]>;
  collapsed: Record<string, boolean>;
}
```

Notes:
- **Order is the array index.** The `order?: number` field on the old `ColumnConfig` is **deleted**;
  there is no more `order ?? 1000` fallback and no alphabetical tiebreaker anywhere.
- `ColumnConfig` is replaced by `Column` (adds `value`, drops `order`).
- A property key exists in `columnsByProperty` only once the board has grouped by it at least once
  (lazy materialization — see §3.2).

### 2.2 Rust model (`src-tauri/src/model.rs`)

```rust
pub struct Column {
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub hidden: Option<bool>,
}

pub struct Board {
    // ...
    pub group_by: Option<String>,
    // IndexMap preserves property insertion order; Vec preserves column order.
    pub columns_by_property: IndexMap<String, Vec<Column>>,
    pub collapsed: IndexMap<String, bool>,
}
```

### 2.3 Database schema (`src-tauri/migrations/0001_init.sql` — rewritten, reseeded)

```sql
CREATE TABLE board_columns (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  property TEXT NOT NULL,             -- NEW: which group-by property this column belongs to
  value    TEXT NOT NULL,             -- the group value (join key to card_props.value)
  color    TEXT,
  hidden   INTEGER NOT NULL DEFAULT 0,
  ord      INTEGER NOT NULL,          -- position within (board_id, property); 0-based, dense
  PRIMARY KEY (board_id, property, value)
);
CREATE INDEX idx_board_columns_board_prop ON board_columns(board_id, property);
```

- `ord` is the storage representation of array index. The loader does
  `... ORDER BY property, ord` and rebuilds each `Vec<Column>` in order.
- On every persisted reorder/append, `ord` is rewritten dense (0..n-1) for that `(board, property)`.

---

## 3. Behavioral rules

### 3.1 Group by a property (`updateBoard { groupBy }`)
- Set `board.groupBy = property`.
- If `columnsByProperty[property]` **exists**, use it as-is (commitment 2: restore previous order).
- If it **does not exist**, materialize it (§3.2) and persist it.

### 3.2 First-time materialization (seeding)
When a property is grouped-by for the first time on a board:
- `present = distinct non-empty values of that property across all cards` (global pool).
- Seed `columnsByProperty[property]` = `present` sorted **alphabetically** (locale-aware), each as
  `{ value }` (no color/hidden).
- Persist immediately (commitment a).

### 3.3 Add a column (`addColumn { boardId, property, value }`)
- Append `{ value }` to the **end** of `columnsByProperty[property]` (matches the "+ button lives at
  the end" UX). No-op if the value already exists in that list.
- Persist with `ord = list.length - 1`.

### 3.4 Reorder columns (`reorderColumns { boardId, property, order: string[] }`)
- Reassign the array to the given order; rewrite dense `ord`s. (Property-scoped — today it is not.)

### 3.5 Rename a column (`renameColumn { boardId, prop, from, to }`)
**The headline simplification.** No `order` argument; position is never touched.
1. Validate: `to` non-empty, `to !== from`, and **`to` is not already in use** for `prop`
   (collision → reject as a no-op; see §3.8). The collision check is the guard that lets steps 2–3
   assume `to` is new, so no merge logic is ever needed.
2. Rewrite card values globally: every card with `props[prop].value === from` → `to`.
3. For **every** board, in `columnsByProperty[prop]`, find the node whose `value === from` and set
   `value = to` **in place** (array index unchanged).
4. Position is preserved automatically because the node's index never moves and there is no
   name-based sort. ✅

Backend `ops::rename_column(conn, prop, from, to)`:
- Guard: if any `card_props(name=prop, value=to)` row **or** any `board_columns(property=prop,
  value=to)` row already exists, return without changes (the reducer enforces the same guard, so the
  optimistic state and the persisted state agree).
- `UPDATE card_props SET value=to WHERE name=prop AND value=from`
- `UPDATE board_columns SET value=to WHERE property=prop AND value=from`. `ord` untouched.

### 3.6 Reconcile with live card values (commitment b)
The stored list can drift from the set of present card values (new card introduces a value; a value
disappears; a value is created on another board — values are global). Reconciliation rule, applied
for a board's **current** `groupBy` property at: snapshot hydration, group-by switch, and after any
card mutation that changes a value for a grouped-by property (`setProp`, `moveToColumn`, `addCard`,
`renameColumn`):
- **Append** any present value missing from the list, to the **end**, and persist it.
- Existing list order is otherwise preserved.

### 3.7 Empty-column policy (DECISION — overridable)
- **Empty columns are KEPT.** A column that loses all its cards remains in the list so the user can
  still drop cards into it (kanban-friendly) and its position/color are retained.
- Removal is **explicit only**, via a new `removeColumn { boardId, property, value }` action +
  `remove_column` command. Removing a column does **not** touch card data (cards retain their
  property value; the column simply stops being listed until reconcile re-appends it if still
  present — so `removeColumn` is meaningful primarily for already-empty columns).
- Rationale: predictable, never surprises the user by making a column vanish mid-use. This reverses
  today's auto-vanish behavior; called out as a deliberate change.

> Open question for approval: keep-empty (proposed) vs. auto-prune-empty. See §11.

### 3.8 Determinism & edge cases
- **Rename collision** (`to` already in use for `prop` — as a column on any board or a value on any
  card): the rename is **rejected as a no-op**. No card values change, no list changes. The UI should
  surface this (e.g. revert the inline edit / brief inline error) rather than silently discard. This
  avoids ever merging two columns' cards by accident. Unit-tested.
- **Hidden columns** keep their slot in the array (hidden is a flag, not a removal).
- **`groupBy === null`** (single-list view): no columns; `columnsByProperty` untouched.

---

## 4. Command / action surface (before → after)

| Concern | Before | After |
|---|---|---|
| `renameColumn` action | `{boardId, prop, from, to, order?}` | `{boardId, prop, from, to}` — **drop `order`** |
| `addColumn` | `{boardId, value, color?, order?}` | `{boardId, property, value, color?}` |
| `reorderColumns` | `{boardId, order}` | `{boardId, property, order}` |
| `reorderColumn` (arrows) | `{boardId, value, dir}` | `{boardId, property, value, dir}` |
| `setColumnConfig` | `{boardId, value, patch}` | `{boardId, property, value, patch}` (patch: color/hidden) |
| `removeColumn` | — | **NEW** `{boardId, property, value}` |
| Tauri commands | no `property` arg | every column command gains `property` |
| `board_columns` table | PK `(board_id, value)` | PK `(board_id, property, value)`, `+property`, `ord NOT NULL` |

Wiring layers to update in lockstep (the existing reducer↔bridge↔api↔command↔ops mirror):
`src/model/reducer.ts`, `src/store/bridge.ts`, `src/api.ts`,
`src-tauri/src/commands.rs`, `src-tauri/src/ops.rs`, `src-tauri/src/db.rs` (loader + seed),
`src-tauri/migrations/0001_init.sql`, `src/components/Board.tsx` (selectors + handlers).

`Board.tsx` simplifications:
- `orderedColumns()` collapses to "read `columnsByProperty[groupBy]`, filter hidden, then append any
  reconciled present-values" — **the `order ?? 1000` sort and `localeCompare` tiebreak are deleted.**
- The `renameColumn` Board handler stops computing/sending an `order` list.

---

## 5. Reseed (dummy data)

Rewrite `seed()` in `src-tauri/src/db.rs`. Target: ~12 cards, 3 boards, each grouped by a **different**
property so per-property lists are exercised, including at least one board with a **non-alphabetical**
explicit order and one **empty** column.

- Properties used by seed cards: `Status` (Backlog, In progress, Blocked, Done), `Priority`
  (High, Medium, Low), `Area` (UI, Backend, Docs).
- Board A "Pipeline" → groupBy `Status`, columns explicitly ordered Backlog→In progress→Blocked→Done,
  plus one empty column (e.g. `Archived`) to prove empties persist.
- Board B "By Priority" → groupBy `Priority`, columns High→Medium→Low.
- Board C "By Area" → groupBy `Area`, seeded alphabetically (Backend, Docs, UI).
- Seed `board_columns` rows with explicit `(property, value, ord)` for each.

---

## 6. Testing strategy

Follow existing conventions: Vitest for the model/reducer/bridge, `cargo test` for `ops`/`db`.
Each behavior below gets at least one test; write the failing test first (TDD).

### Acceptance criteria (Given / When / Then)

1. **Rename preserves position (the bug).**
   Given a board grouped by `Status` with columns `[Backlog, In progress, Blocked, Done]`,
   When `Backlog` is renamed to `Zzz`,
   Then the list is `[Zzz, In progress, Blocked, Done]` (index 0 unchanged) and every card's
   `Status==Backlog` is now `Zzz`. *(reducer + ops)*

2. **Per-property order is independent.**
   Given the board has been grouped by `Status` (order S) and by `Priority` (order P),
   When grouped back to `Status`,
   Then order S is restored, and `Priority`'s list is unchanged. *(reducer + db round-trip)*

3. **First group-by seeds alphabetically.**
   Given no stored list for `Area`, When grouped by `Area`,
   Then columns are alphabetical and persisted. *(reducer + ops)*

4. **Add appends to end.** New column lands last; `ord = n-1`. *(reducer + ops)*

5. **Reconcile appends new values.**
   Given a stored `Status` list, When a card gains a brand-new `Status` value,
   Then that value appears as the **last** column and is persisted. *(reducer + ops)*

6. **Empty columns persist.**
   Given a column with cards, When all its cards change value,
   Then the column remains in the list at its position. *(reducer + db round-trip)*

7. **Explicit removeColumn removes only the listing, never card data.** *(reducer + ops)*

8. **Rename collision is rejected.**
   Renaming `from`→`to` where `to` already exists for that property is a **no-op**: card values and
   all column lists are unchanged. *(reducer + ops)*

9. **DB round-trip.** Seed → `get_snapshot` → assert `columnsByProperty` shape, per-property order,
   and that hidden/empty columns survive. *(db)*

10. **Regression sweep.** Full `vitest` + `cargo test` green; `tsc` clean; `cargo clippy` clean;
    `npm run build` succeeds.

---

## 7. Project structure & code style

- Keep the **reducer pure** (a function of its inputs); the bridge injects derived fields; each ops
  function mirrors one reducer action (existing pattern — preserve it).
- Preserve insertion/array order with `IndexMap`/`Vec` in Rust and arrays in TS.
- Every new/changed file keeps its top-of-file purpose comment (per repo convention).
- No new dependencies.

---

## 8. Affected files (checklist)

- [ ] `src/model/types.ts` — `Column`, `Board.columnsByProperty`; delete `ColumnConfig.order`.
- [ ] `src/model/reducer.ts` — rewrite column actions; delete `order` sort logic; add `removeColumn`,
      reconcile/seed helpers.
- [ ] `src/store/bridge.ts` — `property` in column action persistence; drop `renameColumn.order`.
- [ ] `src/api.ts` — `property` args; drop `order` from `renameColumn`.
- [ ] `src/components/Board.tsx` — selector reads `columnsByProperty`; simplify rename handler;
      add remove-column affordance (explicit).
- [ ] `src-tauri/src/model.rs` — `Column.value`; `columns_by_property`.
- [ ] `src-tauri/src/ops.rs` — `property`-scoped column ops; `remove_column`; simplify `rename_column`.
- [ ] `src-tauri/src/commands.rs` — `property` params; `remove_column`.
- [ ] `src-tauri/src/lib.rs` — register `remove_column`.
- [ ] `src-tauri/src/db.rs` — loader (`ORDER BY property, ord`); rewritten `seed()`.
- [ ] `src-tauri/migrations/0001_init.sql` — `board_columns` schema.
- [ ] `changelog.md` — note the model change; note it supersedes the freeze-on-rename fix.

---

## 9. Boundaries

**Always**
- Preserve all card data. Renames/removes/reconciles touch column **listings** and card **values**
  only as specified; never delete a card.
- Keep reducer↔ops mirrored and tested per behavior.
- Run the full verification sweep (criterion 10) before declaring done.

**Ask first**
- Changing the empty-column policy (§3.7 / §11).
- Any behavior that could make a populated column disappear.
- Adding destructive UI for `removeColumn` beyond a confirmed action.

**Never**
- Delete cards or card property data as a side effect of a column operation.
- Auto-delete a non-empty column.
- Reintroduce a name-based sort for column position.

---

## 10. Out of scope (possible follow-ups)
- **Column ids on cards** (cards reference `column_id` instead of value string) — the only way to make
  rename *not* a global value-rewrite. Bigger model change; deferred (commitment c accepted).
- Real DB migration from existing user data (we reseed instead).
- Drag-to-reorder across the new property-scoped lists already works via `reorderColumns`; no change.

---

## 11. Decisions (resolved 2026-06-17)
1. **Empty-column policy:** ✅ **Keep-empty + explicit `removeColumn`.** (§3.7)
2. **Seed ordering on first group-by:** ✅ **Alphabetical.** (§3.2)
3. **Rename collision rule:** ✅ **Block the rename (no-op).** (§3.5, §3.8)
