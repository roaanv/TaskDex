# Automatic Properties (`#` prefix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create/set card properties by typing `#name: value` in card notes, with board-scoped name autocomplete and an explicit "create" prompt for unknown names.

**Architecture:** A new pure helper module (`model/hashToken.ts`) parses `#`-prefixed lines and the active `#token` at the caret. A board-scoped registry (`buildBoardRegistry`) drives suggestions. `IndexCard.tsx`'s notes editor consumes both: known names auto-capture on line completion; unknown names stay as text until confirmed via a dropdown below the textarea.

**Tech Stack:** TypeScript, React, Vitest. Pure model logic is TDD'd; the React wiring is verified by typecheck + manual run.

## Global Constraints

- TypeScript: no `any`; prefer explicit interfaces (per repo conventions).
- Model code in `src/model/` is framework-agnostic — no React/DOM imports.
- Property values are always stored as strings (`Prop.value: string`).
- "Cards on the board" = cards passing `evalFilter(card, board.filter)`.
- Tests use Vitest (`describe`/`it`/`expect`), colocated as `*.test.ts`.
- Run a single test file: `npx vitest run src/model/<file>.test.ts`.
- Full suite: `npm test`. Typecheck/build: `make build`.

---

### Task 1: `HASH_PROP_LINE` + `extractHashProps`

**Files:**
- Create: `src/model/hashToken.ts`
- Test: `src/model/hashToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HASH_PROP_LINE: RegExp`
  - `interface FoundProp { name: string; value: string }`
  - `interface ExtractResult { remaining: string; found: FoundProp[] }`
  - `extractHashProps(text: string, includeLast: boolean, isCapturable?: (name: string) => boolean): ExtractResult`

- [ ] **Step 1: Write the failing test**

```ts
// src/model/hashToken.test.ts
import { describe, expect, it } from 'vitest';
import { extractHashProps, HASH_PROP_LINE } from './hashToken';

describe('HASH_PROP_LINE', () => {
  it('matches a hash-prefixed name: value line (hyphens allowed)', () => {
    const m = '#due-date: 18/5/2026'.match(HASH_PROP_LINE);
    expect(m?.[1]).toBe('due-date');
    expect(m?.[2]).toBe('18/5/2026');
  });
  it('does NOT match a plain name: value line (no hash)', () => {
    expect('Age: 21'.match(HASH_PROP_LINE)).toBeNull();
  });
});

describe('extractHashProps', () => {
  it('lifts completed hash lines out of the text', () => {
    const r = extractHashProps('note one\n#age: 21\nnote two\n', false);
    expect(r.found).toEqual([{ name: 'age', value: '21' }]);
    expect(r.remaining).toBe('note one\nnote two\n');
  });
  it('leaves the last (still-being-typed) line when includeLast=false', () => {
    const r = extractHashProps('a\n#age: 2', false);
    expect(r.found).toEqual([]);
    expect(r.remaining).toBe('a\n#age: 2');
  });
  it('captures the last line when includeLast=true', () => {
    const r = extractHashProps('a\n#age: 21', true);
    expect(r.found).toEqual([{ name: 'age', value: '21' }]);
    expect(r.remaining).toBe('a');
  });
  it('keeps non-capturable names as text', () => {
    const r = extractHashProps('#known: 1\n#newone: 2', true, (n) => n === 'known');
    expect(r.found).toEqual([{ name: 'known', value: '1' }]);
    expect(r.remaining).toBe('#newone: 2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/hashToken.test.ts`
Expected: FAIL — cannot find module `./hashToken`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/model/hashToken.ts — pure parsing of #-prefixed property syntax in card text.
// Frame-agnostic: no React/DOM. Powers hash property capture + caret autocomplete.

/** A completed `#name: value` line. First name char must be a letter. */
export const HASH_PROP_LINE = /^\s*#([A-Za-z][A-Za-z0-9 _\-]*?)\s*:\s*(\S.*?)\s*$/;

export interface FoundProp {
  name: string;
  value: string;
}

export interface ExtractResult {
  remaining: string;
  found: FoundProp[];
}

/**
 * Lift `#name: value` lines out of `text` into `found`, leaving the rest in
 * `remaining`. When `includeLast` is false the final line is never captured
 * (it may still be mid-edit). `isCapturable` (default: all) lets the caller
 * keep unknown names as plain text instead of capturing them.
 */
export function extractHashProps(
  text: string,
  includeLast: boolean,
  isCapturable: (name: string) => boolean = () => true,
): ExtractResult {
  const lines = (text || '').split('\n');
  const keep: string[] = [];
  const found: FoundProp[] = [];
  lines.forEach((ln, i) => {
    const isLast = i === lines.length - 1;
    const m = ln.match(HASH_PROP_LINE);
    const name = m ? m[1].trim() : '';
    if (m && (!isLast || includeLast) && isCapturable(name)) {
      found.push({ name, value: m[2].trim() });
    } else {
      keep.push(ln);
    }
  });
  return { remaining: keep.join('\n'), found };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/hashToken.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/model/hashToken.ts src/model/hashToken.test.ts
git commit -m "feat: hash property line parsing (extractHashProps)"
```

---

### Task 2: `activeHashToken` (caret token parsing)

**Files:**
- Modify: `src/model/hashToken.ts`
- Test: `src/model/hashToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface HashToken { name: string; start: number; end: number }`
  - `activeHashToken(text: string, caret: number): HashToken | null`
  - `start` = index of the `#` in `text`; `end` = `caret`. `name` = trimmed text between `#` and caret. Returns `null` if the caret is not inside a `#token` (e.g. a `:` already appears before the caret on that line).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/model/hashToken.test.ts
import { activeHashToken } from './hashToken';

describe('activeHashToken', () => {
  it('returns the token while typing the name', () => {
    const text = '#due';
    const tk = activeHashToken(text, 4);
    expect(tk).toEqual({ name: 'due', start: 0, end: 4 });
  });
  it('returns an empty-name token right after #', () => {
    expect(activeHashToken('#', 1)).toEqual({ name: '', start: 0, end: 1 });
  });
  it('returns null once a colon precedes the caret', () => {
    expect(activeHashToken('#due: 1', 7)).toBeNull();
  });
  it('returns null when caret is not after a #', () => {
    expect(activeHashToken('plain text', 5)).toBeNull();
  });
  it('finds a # mid-line and reports its absolute start', () => {
    const text = 'see #pri';
    expect(activeHashToken(text, 8)).toEqual({ name: 'pri', start: 4, end: 8 });
  });
  it('scopes to the caret line', () => {
    const text = '#a: 1\n#bcd';
    expect(activeHashToken(text, 10)).toEqual({ name: 'bcd', start: 6, end: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/hashToken.test.ts`
Expected: FAIL — `activeHashToken` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/model/hashToken.ts

export interface HashToken {
  name: string;
  start: number;
  end: number;
}

/**
 * If the caret sits inside a `#token` being typed (after `#`, before any `:`),
 * return it; else null. Names allow letters, digits, spaces, `_` and `-`.
 */
export function activeHashToken(text: string, caret: number): HashToken | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const prefix = text.slice(lineStart, caret);
  const m = prefix.match(/#([A-Za-z0-9 _\-]*)$/);
  if (!m || m.index === undefined) return null;
  return { name: m[1].trim(), start: lineStart + m.index, end: caret };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/hashToken.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/model/hashToken.ts src/model/hashToken.test.ts
git commit -m "feat: parse active #token at caret (activeHashToken)"
```

---

### Task 3: `buildBoardRegistry` + barrel export

**Files:**
- Modify: `src/model/registry.ts`
- Modify: `src/model/index.ts`
- Test: `src/model/registry.test.ts` (create)

**Interfaces:**
- Consumes: `buildRegistry` (existing), `evalFilter` (existing), `Board`, `Card`, `Registry` types.
- Produces: `buildBoardRegistry(cards: Record<string, Card>, board: Board | null | undefined): Registry`.

- [ ] **Step 1: Write the failing test**

```ts
// src/model/registry.test.ts
import { describe, expect, it } from 'vitest';
import { buildBoardRegistry } from './registry';
import type { Board, Card } from './types';

const card = (id: string, props: Card['props']): Card => ({
  id, body: id + '\n', props, promotions: {}, created: 0,
});

const board = (rules: Board['filter']['rules']): Board => ({
  id: 'b', name: 'B', color: '#fff', groupBy: null,
  filter: { connector: 'AND', rules }, filterOpen: false, columns: {}, collapsed: {},
});

describe('buildBoardRegistry', () => {
  it('includes only props on cards passing the board filter', () => {
    const cards = {
      a: card('a', { status: { type: 'text', value: 'open' }, owner: { type: 'text', value: 'me' } }),
      b: card('b', { status: { type: 'text', value: 'done' }, due: { type: 'date', value: '1/1/2026' } }),
    };
    const reg = buildBoardRegistry(cards, board([
      { id: 'r', prop: 'status', op: 'is', value: 'open' },
    ]));
    expect(Object.keys(reg).sort()).toEqual(['owner', 'status']);
    expect(reg.due).toBeUndefined();
  });

  it('with no filter, includes every card (like buildRegistry)', () => {
    const cards = { a: card('a', { x: { type: 'text', value: '1' } }) };
    expect(Object.keys(buildBoardRegistry(cards, null))).toEqual(['x']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/registry.test.ts`
Expected: FAIL — `buildBoardRegistry` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/model/registry.ts
import { evalFilter } from './filter';
import type { Board } from './types';

/** Registry built only from cards passing the board's filter ("cards on the board"). */
export function buildBoardRegistry(
  cards: Record<string, Card>,
  board: Board | null | undefined,
): Registry {
  const subset: Record<string, Card> = {};
  Object.values(cards).forEach((c) => {
    if (evalFilter(c, board ? board.filter : null)) subset[c.id] = c;
  });
  return buildRegistry(subset);
}
```

Also update the existing import line at the top of `registry.ts` to include `Registry`:

```ts
import type { Card, Registry } from './types';
```

(`src/model/index.ts` already re-exports everything from `./registry`, so no change is needed there — verify the barrel line `export * from './registry';` is present. Add `export * from './hashToken';` to the barrel.)

In `src/model/index.ts`, add after the existing exports:

```ts
export * from './hashToken';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/registry.ts src/model/registry.test.ts src/model/index.ts
git commit -m "feat: board-scoped property registry (buildBoardRegistry)"
```

---

### Task 4: IndexCard — switch notes capture to `#` + board scope

**Files:**
- Modify: `src/components/IndexCard.tsx`

**Interfaces:**
- Consumes: `extractHashProps`, `buildBoardRegistry` (Tasks 1–3).
- Produces: notes editor that captures only `#name: value` lines, and only when the name already exists on the board. (Dropdown/create flow arrives in Task 5.)

- [ ] **Step 1: Update imports**

Replace the model import line (currently `import { detectType, formatValue, TYPE_META } from '../model';`) with:

```ts
import { buildBoardRegistry, detectType, extractHashProps, formatValue, TYPE_META } from '../model';
```

Add `useMemo` to the React import (line 7):

```ts
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
```

- [ ] **Step 2: Remove the old colon-based extractor**

Delete the `PROP_LINE` constant (line 14) and the entire `extractProps` function (lines 18–29). Keep `titleOf` and `notesOf`.

- [ ] **Step 3: Add board registry + caret state in the IndexCard component**

Just after `const collapsed = ...` (around line 611), add:

```ts
  const boardRegistry = useMemo(() => buildBoardRegistry(state.cards, board), [state.cards, board]);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const isCapturable = (name: string) => !!boardRegistry[name];
```

- [ ] **Step 4: Rewrite `saveEdit` notes branch and `onNotesChange`**

Replace the `else` branch inside `saveEdit` (the one calling `extractProps(draft, true)`) with:

```ts
    } else {
      const { remaining, found } = extractHashProps(draft, true, isCapturable);
      body = title + '\n' + remaining;
      dispatch({ type: 'updateCard', id: cardId, patch: { body } });
      found.forEach((f) => {
        const ex = registry[f.name];
        dispatch({
          type: 'setProp',
          id: cardId,
          name: f.name,
          value: f.value,
          propType: ex ? ex.type : detectType(f.value),
        });
      });
    }
```

Replace the whole `onNotesChange` function with:

```ts
  const onNotesChange = (v: string, caretPos: number) => {
    const { remaining, found } = extractHashProps(v, false, isCapturable);
    if (found.length) {
      setDraft(remaining);
      found.forEach((f) => {
        const ex = registry[f.name];
        dispatch({
          type: 'setProp',
          id: cardId,
          name: f.name,
          value: f.value,
          propType: ex ? ex.type : detectType(f.value),
        });
      });
      dispatch({ type: 'updateCard', id: cardId, patch: { body: title + '\n' + remaining } });
    } else {
      setDraft(v);
    }
    setCaret(caretPos);
  };
```

- [ ] **Step 5: Wire the textarea to report value + caret**

In `frontBody`, change the `<textarea>` opening so it has a ref, passes the caret to `onNotesChange`, and tracks caret moves. Replace its `onChange` and add `ref`/`onSelect`:

```tsx
        <textarea
          ref={notesRef}
          autoFocus
          value={draft}
          onChange={(e) => onNotesChange(e.target.value, e.target.selectionStart)}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onClick={(e) => e.stopPropagation()}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') saveEdit();
          }}
          rows={Math.max(3, draft.split('\n').length)}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            fontFamily: FONT_UI,
            fontSize: 14,
            lineHeight: 1.55,
            color: t.textDim,
          }}
        />
```

- [ ] **Step 6: Update the notes placeholder hint**

Change the empty-notes hint text so users learn the syntax. Replace `'Double-click to add notes…'` with:

```tsx
          {notes.trim() || 'Double-click to add notes… (use #name: value for properties)'}
```

- [ ] **Step 7: Typecheck + run model tests**

Run: `make build`
Expected: typecheck/build succeeds (no TS errors).

Run: `npm test`
Expected: all existing + new tests PASS.

- [ ] **Step 8: Manual verification**

Run the app (`make run` or `npm run dev`). On a card that already has a `status` property on the active board: double-click notes, type `#status: open` then move to a new line — the line is lifted into a property. Type `#unknownprop: x` and move on — it stays as plain text (not captured). Plain `foo: bar` stays as text.

- [ ] **Step 9: Commit**

```bash
git add src/components/IndexCard.tsx
git commit -m "feat: capture card properties via #name: value (board-scoped)"
```

---

### Task 5: IndexCard — autocomplete dropdown + create prompt

**Files:**
- Modify: `src/components/IndexCard.tsx`

**Interfaces:**
- Consumes: `activeHashToken`, `HashToken` (Task 2); `boardRegistry`, `isCapturable`, `caret`, `notesRef` (Task 4).
- Produces: a dropdown below the notes textarea offering board property names and a "Create property" row for unknown names; confirming create marks the name capturable.

- [ ] **Step 1: Import the token helpers**

Extend the model import to include the token API:

```ts
import {
  activeHashToken,
  buildBoardRegistry,
  detectType,
  extractHashProps,
  formatValue,
  TYPE_META,
  type HashToken,
} from '../model';
```

- [ ] **Step 2: Add the `NotesAutocomplete` component**

Add this component just above `/* ---- collapse wrapper ---- */`:

```tsx
/* ---- notes #property autocomplete (below textarea) ---- */
function NotesAutocomplete({
  token,
  registry,
  accent,
  onPick,
  onCreate,
}: {
  token: HashToken | null;
  registry: Registry;
  accent: string;
  onPick: (name: string) => void;
  onCreate: (name: string) => void;
}) {
  const t = useTheme();
  if (!token) return null;
  const q = token.name.toLowerCase();
  const names = Object.keys(registry);
  const matches = names.filter((n) => n.toLowerCase().includes(q)).slice(0, 6);
  const exact = names.some((n) => n.toLowerCase() === q);
  const showCreate = token.name.length > 0 && !exact;
  if (matches.length === 0 && !showCreate) return null;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 6,
        background: t.panel,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        boxShadow: '0 14px 30px -12px rgba(0,0,0,.7)',
        overflow: 'hidden',
      }}
    >
      {matches.map((n) => (
        <div
          key={n}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(n);
          }}
          style={{
            padding: '7px 11px',
            fontSize: 12.5,
            fontFamily: FONT_UI,
            color: t.textDim,
            cursor: 'pointer',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <TypeGlyph type={registry[n].type} accent={accent} /> {n}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: t.muted }}>existing</span>
        </div>
      ))}
      {showCreate && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            onCreate(token.name);
          }}
          style={{
            padding: '7px 11px',
            fontSize: 12.5,
            fontFamily: FONT_UI,
            color: accent,
            cursor: 'pointer',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            borderTop: matches.length ? `1px solid ${t.line}` : 'none',
          }}
        >
          <span style={{ fontWeight: 700 }}>+</span> Create property “{token.name}”
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add create state + handlers; extend `isCapturable`**

Replace the `isCapturable` line added in Task 4 with the creatable-aware version and add handlers (place right after the `caret` state):

```ts
  const [creatable, setCreatable] = useState<Set<string>>(new Set());
  const isCapturable = (name: string) => !!boardRegistry[name] || creatable.has(name);

  const handlePick = (name: string) => {
    const tk = activeHashToken(draft, caret);
    if (!tk) return;
    const next = draft.slice(0, tk.start) + '#' + name + ': ' + draft.slice(tk.end);
    const pos = tk.start + name.length + 3; // '#' + name + ': '
    setDraft(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      const el = notesRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleCreate = (name: string) => {
    setCreatable((s) => new Set(s).add(name));
    handlePick(name);
  };

  const notesToken = editing && editTarget === 'notes' ? activeHashToken(draft, caret) : null;
```

- [ ] **Step 4: Render the dropdown under the textarea**

In `frontBody`, immediately after the closing `</textarea>` (still inside the `editing && editTarget === 'notes'` branch), add:

```tsx
        <NotesAutocomplete
          token={notesToken}
          registry={boardRegistry}
          accent={accent}
          onPick={handlePick}
          onCreate={handleCreate}
        />
```

Note: the textarea + dropdown must be wrapped in a single parent since the branch returns one element. Wrap them in a `<>...</>` fragment:

```tsx
      {editing && editTarget === 'notes' ? (
        <>
          <textarea ... />
          <NotesAutocomplete ... />
        </>
      ) : (
```

- [ ] **Step 5: Typecheck + tests**

Run: `make build`
Expected: build/typecheck passes.

Run: `npm test`
Expected: all tests PASS (no model tests broken).

- [ ] **Step 6: Manual verification**

Run the app. Double-click a card's notes and type `#`: a dropdown lists properties present on the current board. Type part of a name — list filters. Click one → text becomes `#name: ` with the caret ready for the value; finish the value and move on → property is set. Type a brand-new name (`#sprint`) → a “Create property ‘sprint’” row appears; click it → text becomes `#sprint: `, and after typing a value and leaving the line, the new property is created. Confirm that an unknown name typed *without* using the Create row is NOT captured (stays as text).

- [ ] **Step 7: Commit**

```bash
git add src/components/IndexCard.tsx
git commit -m "feat: #property autocomplete + create prompt in card notes"
```

---

### Task 6: Changelog + full verification

**Files:**
- Modify: `changelog.md`

- [ ] **Step 1: Add a changelog entry**

Add under the latest unreleased section (create an `## [Unreleased]` heading if none exists):

```markdown
### Added
- Automatic properties: type `#name: value` in a card's notes to set a property.
  Property names autocomplete from properties already on the active board; an
  unknown name shows a "Create property" prompt before it is created.

### Changed
- Card notes now capture properties only from `#`-prefixed lines. Plain
  `name: value` lines are kept as ordinary notes text.
```

- [ ] **Step 2: Full suite + build**

Run: `npm test`
Expected: PASS.

Run: `make build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add changelog.md
git commit -m "docs: changelog for automatic # properties"
```

---

## Self-Review

**Spec coverage:**
- `#name: value` creates/sets a property → Tasks 1, 4.
- Type detection (e.g. date for `18/5/2026`) → reuses `detectType` in Task 4.
- Autocomplete from properties on the board → Tasks 2, 3, 5.
- Ask before creating an unknown property → Task 5 (Create row + `creatable`/`isCapturable`).
- `#` replaces colon capture → Task 4 (old `PROP_LINE`/`extractProps` removed).
- Board-scoped, not global → Task 3 + `boardRegistry` usage.
- Front-notes only; back-of-card AddProp unchanged → no AddProp edits in any task.

**Placeholder scan:** None — every code step shows full code.

**Type consistency:** `extractHashProps(text, includeLast, isCapturable?)`, `activeHashToken(text, caret): HashToken | null` with `{name,start,end}`, and `buildBoardRegistry(cards, board)` are used identically across Tasks 4–5. `isCapturable` has a single definition (introduced in Task 4, widened in Task 5). The textarea branch is converted to a fragment in Task 5 so the JSX still returns one element.
