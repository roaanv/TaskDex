# Handoff: TaskDex — Themeable Neon Task Board

## Overview
TaskDex is a task manager built around **index cards**. Every task is a card with a free‑text
title, free‑text notes, and a flexible set of **typed properties** (Status, Priority, Due, Rating,
etc.). Cards live in a single global pool; **Boards** are saved *views* over that pool that group
cards into columns by a chosen property and filter them with rich rules. Think "Notion database
+ Trello board," rendered as a deck of cards.

The signature look is the **Outline Tube** card: a continuous glowing neon frame on a dark wall,
with each card lit in its column's accent color. The app ships with **three themes — Dark (neon),
Light (flat colored‑outline), and Auto (follows the OS)** — switchable from the sidebar.

## Screenshots
Rendered reference states in `screenshots/` (1440×900):
- `01-dark-board.jpg` — Dark (neon) theme, Product Sprint board grouped by Status; the four
  columns each glow in their accent (Backlog slate, In Progress blue, Blocked red, Done green).
- `02-card-properties-dark.jpg` — a card flipped to its **Properties** back (typed rows, pin
  toggles, Add‑property input).
- `03-light-board.jpg` — the same board in the **Light** theme (flat colored‑outline cards).
- `04-card-properties-light.jpg` — the Properties back in Light theme.

(The sidebar theme switch in some captures may show the wrong segment highlighted — that's an
artifact of the screenshot renderer; the live app highlights the active theme correctly.)

## About the Design Files
The files in `design_files/` are a **design reference implemented in HTML + React (UMD) + inline
Babel JSX**. They are a working, interactive prototype — not production code to ship as‑is. The
task is to **recreate this design and its behavior in the target codebase's environment** using its
established patterns, component library, and build system. If no environment exists yet, pick an
appropriate stack (the prototype maps most directly to **React + TypeScript**, but the data model
is framework‑agnostic).

Two things in this bundle are worth porting almost verbatim because they are pure logic, not
styling:
- **`store.jsx`** — the data model, the reducer, type‑detection, date parsing, filter evaluation,
  the property registry, the seed data, and localStorage persistence. This is the heart of the app
  and is UI‑framework‑independent.
- **`neon-theme.jsx`** — the two design‑token palettes and the glow helper functions.

Everything else (`card.jsx`, `board.jsx`, `sidebar.jsx`, `filters.jsx`, `app.jsx`) is presentation
and should be rebuilt with the codebase's own components, but the documented structure, tokens, and
interactions must be matched.

## Fidelity
**High‑fidelity (hifi).** Final colors, typography, spacing, radii, glow treatment, and interaction
behavior are all defined here and in the source files. Recreate the UI to match. The exact hex
values, font sizes, and the dual‑theme token system below are authoritative.

---

## Architecture at a Glance

```
TaskDex.html              ← shell: fonts, base CSS, script load order, #root
 ├─ neon-theme.jsx        ← THEMES (light/dark) + live NEON token object + glow fns + ThemeSwitch
 ├─ store.jsx             ← data model, reducer, helpers, persistence, seed, <TaskDexProvider>
 ├─ card.jsx              ← <IndexCard> (the tube card: flip, collapse, inline props, promote)
 ├─ filters.jsx           ← <FilterPanel> (per‑board AND/OR rule builder)
 ├─ sidebar.jsx           ← <Sidebar> (board list + theme switch)
 ├─ board.jsx             ← <Board> (top bar, columns, drag‑and‑drop, column config)
 └─ app.jsx               ← <App>/<Shell> (providers + two‑pane layout, mounts to #root)
```

**Module pattern in the prototype:** each file attaches its exports to `window` (e.g.
`Object.assign(window, { Board })`) because the prototype uses raw `<script type="text/babel">`
tags with no bundler. In a real codebase, replace this with normal ES module `import`/`export`.

**Rendering tree:** `App → ThemeCtx.Provider (theme state) → TaskDexProvider (data store) →
Shell → [Sidebar | Board]`.

---

## Data Model

All of this is in `store.jsx`. Port it directly.

### Card
```ts
type PropType = 'text' | 'int' | 'decimal' | 'date' | 'bool' | 'select' | 'url';

interface Prop { type: PropType; value: string; }          // value is always stored as a string

interface Card {
  id: string;                                              // "c_xxxxxxx"
  body: string;                                            // line 0 = title, remaining lines = notes
  props: Record<string, Prop>;                             // e.g. { Priority: {type:'select', value:'High'} }
  promotions: Record<string, { front?: boolean; title?: boolean }>; // which props show as chips, where
  created: number;                                         // Date.now()
  ord?: number;                                            // manual sort index (set by drag‑reorder)
}
```
- `title = body.split('\n')[0]`, `notes = body.split('\n').slice(1).join('\n')`.
- **Cards are global.** Deleting a board never deletes cards.

### Board (a saved view)
```ts
interface Board {
  id: string;                                              // "b_xxxxxxx"
  name: string;
  color: string;                                           // hex, used as the board accent
  groupBy: string | null;                                  // property name to split into columns, or null = single list
  filter: { connector: 'AND' | 'OR'; rules: Rule[] };
  filterOpen: boolean;
  columns: Record<string, { color?: string; order?: number; hidden?: boolean }>; // keyed by the group value
  collapsed: Record<string, boolean>;                      // cardId → collapsed?
}

interface Rule {
  id: string;                                              // "r_xxxxxxx"
  prop: string;
  op: 'is'|'isnot'|'contains'|'gt'|'lt'|'before'|'after'|'between'|'isset'|'notset'|'istrue'|'isfalse';
  value: string | [string, string];                       // tuple only for 'between'
}
```

### Top‑level state
```ts
interface State { cards: Record<string, Card>; boards: Board[]; activeBoardId: string | null; version: 1; }
```

### Derived: the property registry
`buildRegistry(cards)` scans every card and produces
`{ [name]: { name, type, values: { [value]: count } } }`. It powers property‑name and select‑value
**autocomplete** and the filter property pickers. Recompute it whenever cards change (memoized).

### Type detection & formatting (exact rules — keep them)
`detectType(raw)` (first match wins):
1. `^(https?:\/\/|www\.)\S+$` → `url`
2. `^(yes|no|true|false|done|y|n|✓)$` (case‑insensitive) → `bool`
3. `^-?\d{1,9}$` → `int`
4. `^-?\d*\.\d+$` → `decimal`
5. `parseDate(v) != null` → `date`
6. else → `text`

`parseDate` accepts `YYYY-MM-DD`, `M/D` or `M/D/YY(YY)`, `Mon D[, YYYY]`, and `D Mon[, YYYY]`
(month names matched on first 3 letters). `formatValue` renders dates as `Mon D` (adds year only if
not the current year), bools as `Yes`/`No`, everything else as its string.

### Filter evaluation
`evalFilter(card, filter)` returns true if (AND → every / OR → some) rule matches. A rule whose
value is empty is treated as a pass (ignored). `isset`/`notset` test presence; numeric/date ops
coerce via `coerce(prop)`. Reproduce `ruleMatch` exactly.

### Reducer actions (the full API surface)
`setActive, addBoard, removeBoard, updateBoard, addCard, updateCard, removeCard, setProp,
renameProp, removeProp, togglePromote, moveToColumn, setCollapsed, reorderCards, setColumnConfig,
addColumn, reorderColumn, renameColumn, replace`. Each is small and pure — see `store.jsx`.
Notable: `moveToColumn` sets the card's `groupBy` property value to the target column (that is how
drag‑between‑columns works); `renameColumn` rewrites the value across **all** cards and the board's
column map.

### Persistence
- `localStorage["taskdex_state_v1"]` ← whole state, written on every change; read on load, falling
  back to `seed()` (12 sample cards across a Product Sprint, By Priority, and Reading List board).
- `localStorage["taskdex_theme"]` ← `"light" | "dark" | "system"` (default `"dark"`).

---

## Screens / Views

### 1. App shell (`app.jsx`)
- **Layout:** full‑viewport flex row. Left: fixed **Sidebar** (248px). Right: flexible **Board**
  that fills the rest. `height: 100vh; width: 100vw; overflow: hidden`. Background = `NEON.bg`.

### 2. Sidebar (`sidebar.jsx`) — 248px, full height
- **Header:** 32×32 rounded‑9 app mark (neon‑bordered card glyph) + wordmark "TaskDex"
  (Space Grotesk 700, 17px) + card count (Space Mono, 10.5px, muted).
- **"BOARDS" label** (10.5px, 700, uppercase, letter‑spacing .11em, faint).
- **Board list:** each row = color dot (11px, glows) + name + card count (mono) + delete button
  (reveals on row hover). Active row gets a 1px inset ring in the board color (+ soft glow in dark).
  - Click row → activate board. Double‑click name → inline rename. Click dot → 6‑column palette
    popover (11 swatches). Delete → confirm dialog ("cards are kept").
- **Footer** (separated by a hairline): "**+ New board**" dashed button, then a "THEME" label and
  the **ThemeSwitch** segmented control (Light / Dark / Auto, each with an icon).

### 3. Board (`board.jsx`)
- **Top bar** (sticky, `z-index: 50`, blurred translucent `NEON.barBg`, bottom border):
  board color chip + board name (Space Grotesk 700, 20px, glows) · **Group by** dropdown
  (lists "None" + every registered property with a type glyph) · right side: **Filter** button
  (shows active rule count badge, toggles the filter panel) · `matchCount/totalCount` (mono) ·
  **+ Card** button (filled primary, glows in dark).
- **Filter panel** (`filters.jsx`): absolutely positioned, slides down from under the top bar
  (`transform: translateY(0 / -101%)`, .34s ease). Title "Filters" + AND/OR segmented toggle
  (only when >1 rule) + "N of M cards" + "Clear all" + "Done". Each rule row: `Where/AND/OR`
  connector label, property `<select>`, operator `<select>`, then a value control whose shape
  depends on type/op (text input, select of known values, or two inputs for `between`). "+ Add
  filter rule" dashed button.
- **Board surface** (scrolls): 
  - **Grouped** (`groupBy` set): horizontal row of **columns**, 286px each, 16px gap. Each column =
    header (color dot → palette popover; title, double‑click to rename; count; hover actions:
    move‑left, move‑right, hide, add‑card) over a tinted container holding the cards + a "+ Add
    card" button. A trailing dashed **+ Add column** affordance. Hidden columns surface as
    "show" pills above the surface.
  - **Ungrouped** (`groupBy === null`): a CSS multi‑column masonry (`column-width: 286px`,
    `column-gap: 16px`, `max-width: 1240px`) of all matching cards.
- **Drag & drop (native HTML5):** dragging a card dims it to `opacity: .4`; a glowing 3px insertion
  line marks the drop position. Dropping into another column sets the card's group property to that
  column; dropping reorders globally. **Implementation note / known pitfall fixed here:** render
  each card slot as a *stable, reconciled element keyed by card id* — do **not** make the slot an
  inline component that is re‑created each render, or the `onDragOver`‑driven re‑renders will
  unmount the node you're dragging and its `dragend` (which clears the dim) will never fire. Drive
  the drag‑dim from React **state**, not a ref, and clear it in `onDragEnd` *and* on drop.

### 4. Index Card (`card.jsx`) — the centerpiece, 286px wide in columns
The card is a single 3D‑flippable surface (no mirrored back face; content swaps at 90°).
- **Frame:** `border-radius: 18px`, `1.5px solid <accent>`, radial fill from a faint accent tint at
  top into `NEON.cardFill`. Dark theme adds the multi‑layer **tube glow** box‑shadow; light theme
  uses a soft drop shadow only. `<accent>` = the column color (grouped) or the board color (list).
- **Title bar:** glowing accent dot + title (Space Grotesk 600, 16px, 2‑line clamp, double‑click to
  rename) + **flip** button + **chevron** (collapse/expand). When collapsed, title‑promoted property
  chips appear inline and the body hides via a `grid-template-rows: 1fr → 0fr` height animation.
- **Front body:** a thin glowing accent **margin rule** on the left, notes text (Space Grotesk,
  14px, 1.55 line‑height; double‑click to edit in a textarea), then **front‑promoted** chips.
  - **Inline property capture:** while editing notes, any completed line matching `Name: value`
    (regex `^\s*([A-Za-z][A-Za-z0-9 _\-]*?)\s*:\s*(\S.*?)\s*$`) is *extracted* into a typed property
    and removed from the notes text. On blur the current line is captured too.
- **Back body ("Properties"):** one editable row per property — type glyph, label (Space Mono caps),
  value (Space Grotesk 600, click to edit, right‑aligned), then two **pin** toggles (promote to
  front / promote to collapsed‑title) and a delete ✕. Below: an **Add property** input
  (`Name: value`) with autocomplete that suggests existing property names and, for `select` props,
  known values.
- **Chips:** rounded‑999 pills — accent dot + uppercase label + value, accent border, dark‑theme
  glow. `url` props render as links.

---

## Interactions & Behavior
- **Flip:** single click on a card (when not collapsed/editing) → 3D rotateY flip, ~150ms each half,
  content swapped at the edge. `busy` guard prevents overlap.
- **Collapse:** chevron → animate `grid-template-rows` 1fr↔0fr over .4s `cubic-bezier(.4,.05,.15,1)`;
  rotates the chevron −90°. Collapsed state is stored per‑board (`board.collapsed[cardId]`).
- **Editing:** double‑click title → inline input; double‑click notes → textarea with live property
  extraction; click a back‑row value → inline input. Enter saves, Escape cancels.
- **Promote pins:** toggle whether a property appears as a chip on the front and/or in the collapsed
  title bar.
- **Group by:** changing it re‑derives columns from the chosen property's present values (merged
  with any configured columns), ordered by `order` then alphabetically.
- **Filters:** live; recompute `evalFilter` over all cards on every change; `matchCount/total`
  reflects it. New cards created while a filter/column is active inherit the implied property values.
- **Theme switch:** updates a token object in place and re‑renders the whole tree; persists to
  localStorage; **Auto** subscribes to `matchMedia('(prefers-color-scheme: dark)')` and updates live.
- **Transitions/easing used:** flip `.16–.22s cubic-bezier(.45,.05,.25,1)`; collapse & filter panel
  `cubic-bezier(.4,.05,.15,1)`; theme button bg/color `.15s`.

## State Management
- **Data:** single `useReducer` in `TaskDexProvider`, exposed via context as `{ state, dispatch,
  registry }`. Persisted to localStorage on every change.
- **Theme:** `useState` for `pref` (`light|dark|system`) and `sys` (resolved OS pref) owned at the
  **App root** so a change re‑renders the entire tree; `resolved = pref === 'system' ? sys : pref`.
  Provided via `ThemeCtx`. (Owning this at the root matters — see the inline note in `neon-theme.jsx`;
  a lower provider whose children are a fixed element will leave parts of the tree stale.)
- **Local UI state:** drag (`draggingId` state + a `draggedId` ref for synchronous drop logic,
  `dropTarget`), per‑component editing flags, popover open flags.

---

## Design Tokens

### Typography
- **UI / titles / values:** `'Space Grotesk', sans-serif` (weights 400/500/600/700).
- **Labels, counts, type glyphs:** `'Space Mono', monospace` (400/700).
- No other families. (The earlier "manila" prototype used handwriting fonts — those are gone.)
- Key sizes: card title 16/600, notes 14, property value 15/600, property label 10–10.5 mono caps
  (letter‑spacing .09–.11em), board name 20/700, sidebar wordmark 17/700, chips 11.5/600,
  counts 11–12 mono.

### Theme tokens (two complete palettes — from `neon-theme.jsx`)
| token | Dark (neon) | Light (flat) | role |
|---|---|---|---|
| `mode` / `glow` | `dark` / `true` | `light` / `false` | drives whether glow helpers emit shadows |
| `wall` | radial `#17111f → #0b0810 → #070509` | linear `#f7f6fc → #eef0f6` | board surface background |
| `bg` | `#0a0810` | `#f1f0f7` | app background |
| `panel` | `#0d0b15` | `#ffffff` | sidebar / popovers / filter panel |
| `barBg` | `rgba(11,9,17,.94)` | `rgba(255,255,255,.9)` | top bar (blurred) |
| `surface` | `rgba(255,255,255,.04)` | `rgba(40,28,80,.04)` | inset button/chip surfaces |
| `surfaceHi` | `rgba(255,255,255,.06)` | `rgba(40,28,80,.06)` | active row surface |
| `inputBg` | `rgba(255,255,255,.06)` | `#ffffff` | text inputs / selects |
| `cardFill` | `rgba(12,10,20,.94)` | `#ffffff` | card body fill (under the accent‑tint radial) |
| `primary` | `#9d6bff` | `#7c4dff` | primary action / accent default |
| `primarySoft` | `#c2abff` | `#6b3fe0` | icon tints |
| `text` | `#f2ecff` | `#1d1727` | primary text |
| `textDim` | `#cdc4e0` | `#4c4660` | body/secondary text |
| `muted` | `#938aab` | `#7d768f` | labels, counts |
| `faint` | `#6c6584` | `#a39db2` | placeholders, hints |
| `line` | `rgba(157,107,255,.16)` | `rgba(40,28,80,.10)` | hairlines |
| `border` | `rgba(157,107,255,.30)` | `rgba(124,77,255,.32)` | borders |
| `borderSoft` | `rgba(157,107,255,.20)` | `rgba(124,77,255,.18)` | dashed/soft borders |

### Column / board accent palette (`PALETTE`, both themes)
`#ff4d6d` `#ff7a2f` `#ffc23d` `#2bff88` `#2bf0d0` `#27e6ff` `#3da6ff` `#7c6bff` `#9d6bff`
`#ff5ec4` `#8a93a8`. New columns/boards cycle through these; each card glows in its accent.

### Glow helpers (theme‑aware — return flat values when `glow:false`)
- `tube(c,s)` — text shadow: hot‑white core + colored bloom (lit glass). Light → `none`.
- `softInk(c,s)` — softer colored text glow. Light → `none`.
- `bloom(c,k)` — box bloom an object throws on the wall. Light → soft neutral drop shadow.
- `tubeFrame(c)` — the continuous‑tube card frame shadow. Light → soft drop shadow (border carries
  the color).
- `glowDot(c)` — dot halo. Light → a faint `0 0 0 3px <c>1f` ring.
- `tint(c, aa)` — append a 2‑digit hex alpha to a 6‑digit hex (column tints).

### Radii & spacing
Cards 18px · top‑bar buttons/menus 7–11px · chips 999px · column container 16px · column width 286px,
gap 16px · board padding 18–28px · sidebar width 248px. Hit targets ≥ ~24px; flip/chevron buttons
24–26px.

### Misc CSS (in `TaskDex.html`)
Custom neon scrollbars, `::selection` in primary, hover‑reveal chrome classes
(`.td-col-actions`, `.td-board-del`, `.td-editbtn`, `.td-menu-item:hover`). Inputs/textarea inherit
font and remove default outline.

## Assets
- **Fonts:** Space Grotesk + Space Mono via Google Fonts (`<link>` in `TaskDex.html`). Swap for the
  codebase's font pipeline (self‑host or its existing families) if preferred.
- **Icons:** all inline hand‑drawn SVGs (chevron, flip, calendar, filter funnel, trash, eye,
  pencil, sun/moon/monitor for the theme switch, the app‑mark card glyph). No icon library and no
  raster images are used — reproduce with the codebase's icon set or keep as inline SVG.
- **No external image assets.**

## Files (in `design_files/`)
- `TaskDex.html` — shell, fonts, base CSS, script order (load `neon-theme` → `store` → `card` →
  `filters` → `sidebar` → `board` → `app`).
- `neon-theme.jsx` — **tokens + glow helpers + theme controller** (port the tokens/helpers).
- `store.jsx` — **data model, reducer, helpers, persistence, seed** (port nearly verbatim).
- `card.jsx` — `IndexCard` + property/chip/pin/add‑prop subcomponents.
- `board.jsx` — `Board`, top bar, columns, drag‑and‑drop, column config.
- `sidebar.jsx` — `Sidebar` + board rows + theme switch placement.
- `filters.jsx` — `FilterPanel` rule builder.
- `app.jsx` — `App`/`Shell` providers + two‑pane layout.

To run the reference as‑is: open `TaskDex.html` in a browser (it loads React/Babel from a CDN).

## Build Prompt
`BUILD_PROMPT.md` (in this folder) is a ready‑to‑paste prompt for Claude Code that targets a
**Tauri + Rust/SQLite + React/TypeScript** implementation — including a suggested SQLite schema, the
command surface mirroring the reducer, and the delivery order.
