# Automatic Properties via `#` Prefix — Design

**Date:** 2026-06-17
**Ticket:** Automatic properties
**Status:** Approved

## Problem

When entering text for a card, the user should be able to create properties
automatically by prefixing them with a hash (`#`). For example, typing
`#due-date: 18/5/2026` should create the `due-date` property (if it does not
already exist) and set its value to `18/5/2026`.

Because properties carry a `#` prefix, the user should be able to **autocomplete**
a property name if that property already exists on a card on the current board.
If the property does not exist on the board, the user should be **asked whether
to create it** rather than having it created silently.

## Current state

- `IndexCard.tsx` already auto-captures lines matching `Name: value` (the
  `PROP_LINE` regex) from the notes textarea into card properties — no `#`
  required today. This is the behavior the ticket changes.
- The property registry (`buildRegistry` in `model/registry.ts`) is built
  **globally** across all cards. The back-of-card "Add property" input
  autocompletes against it and creates props without asking.
- "Cards on the board" is computed in `Board.tsx` as
  `allCards.filter(c => evalFilter(c, board.filter))`.

## Decisions

1. **`#` replaces colon capture.** Only lines beginning with `#` create
   properties. Plain `name: value` lines remain ordinary notes text. The `#` is
   the single explicit trigger, preventing accidental property creation.
2. **Board-scoped suggestions.** Autocomplete and the "exists?" check operate on
   properties present on cards that pass the active board's filter — not the
   global registry.
3. **Dropdown below the textarea.** Autocomplete and the create-prompt render in
   a dropdown anchored below the notes area (reusing the existing `AddProp`
   dropdown styling), rather than a caret-anchored popup.

## Behavior

### Capture rule

A notes line matching `#<name>: <value>` becomes a property `<name>` with
`<value>` (type auto-detected via `detectType`, or the existing type if the
property is already known).

- If `<name>` **already exists on the active board**, the line is captured
  automatically once it completes — the line is lifted out of the notes text and
  written as a property (same mechanism as today's colon capture).
- If `<name>` is **new to the board**, it is **not** auto-created. The line
  remains as text and the dropdown surfaces a **"Create property 'name'"**
  action. Only after the user confirms is the property created and the line
  captured. This satisfies the ticket's "ask if they want to create it."

### Autocomplete dropdown

- While the caret sits inside a `#token` (after `#`, before any `:`), a dropdown
  renders below the notes textarea.
- It lists board property names matching the token, each with its `TypeGlyph`.
  Selecting one rewrites the token to `#name: ` so the user can type the value.
- If the token matches no board property, the dropdown shows a single
  **"Create property 'X'"** row. Activating it marks the name as creatable so the
  next `#X: value` line will capture.

## Architecture

### `src/model/hashToken.ts` (new)

A pure, unit-testable helper module — no React, no DOM.

- `HASH_PROP_LINE = /^\s*#([A-Za-z][A-Za-z0-9 _\-]*?)\s*:\s*(\S.*?)\s*$/`
- `activeHashToken(text, caret): { name: string; start: number; end: number } | null`
  — parses the textarea value plus caret offset into the `#token` currently being
  typed (after `#`, before any `:`), or `null` if the caret is not in such a token.
- `extractHashProps(text, includeLast): { remaining: string; found: { name; value }[] }`
  — extracts completed `#name: value` lines (mirrors the existing `extractProps`
  but hash-prefixed). Callers classify `found` names as known vs. new.

### `src/model/registry.ts` (extended)

- `buildBoardRegistry(cards, board): Registry` — `buildRegistry` applied to the
  subset of cards passing `evalFilter(c, board.filter)`.
- Exported from `src/model/index.ts`.

### `src/components/IndexCard.tsx` (modified)

- Replace `PROP_LINE`/`extractProps` usage with the hash-based helpers.
- Compute `boardRegistry` via `useMemo(buildBoardRegistry(state.cards, board))`.
- Rework `onNotesChange` / `saveEdit`:
  - Auto-capture completed `#name: value` lines whose name is known to the board.
  - Leave new-name lines in text; do not create them silently.
- Add the notes autocomplete dropdown: read `textarea.selectionStart`, call
  `activeHashToken`, render board suggestions + the create row, and on selection
  rewrite the active token (suggestion) or mark the name creatable (create row).

## Scope boundaries (YAGNI)

- Front-notes editing only. The back-of-card "Add property" input is unchanged.
- Property-**name** autocomplete + create-prompt only. Select-**value**
  autocomplete is out of scope for this ticket.

## Testing

- `hashToken.test.ts`: token parsing across caret positions (inside/outside a
  token, before/after the colon, names with hyphens/spaces); `extractHashProps`
  known/new split and `remaining` text.
- `registry.test.ts`: `buildBoardRegistry` respects the board filter (includes
  only props on matching cards).
- Dropdown wiring verified manually in the running app.
