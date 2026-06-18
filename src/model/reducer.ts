// reducer.ts — the TaskDex reducer + action types, ported from store.jsx.
//
// One deviation from the prototype: create-actions (addBoard/addCard/addColumn)
// accept a pre-generated id (and addCard a `created` timestamp, addBoard/addColumn
// their derived color/order). This keeps the reducer a pure function of its inputs
// so the persistence bridge knows exactly which entity was created. Each field
// still falls back to generation, so the reducer also runs standalone (in tests).

import { detectType } from './detect';
import type {
  Board,
  Card,
  Column,
  ColumnPatch,
  Prop,
  PropType,
  State,
} from './types';

export const uid = (p = ''): string => p + Math.random().toString(36).slice(2, 9);

// neon column palette — saturated hues that glow on the dark wall
export const PALETTE = [
  '#ff4d6d', '#ff7a2f', '#ffc23d', '#2bff88', '#2bf0d0',
  '#27e6ff', '#3da6ff', '#7c6bff', '#9d6bff', '#ff5ec4', '#8a93a8',
];
export const colorFor = (i: number): string =>
  PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/** Distinct, non-empty values of a property across all cards (first-seen order). */
export function presentValues(cards: Record<string, Card>, property: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  Object.values(cards).forEach((c) => {
    const p = c.props[property];
    const v = p && String(p.value).trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  });
  return out;
}

/**
 * Desired column list for a property: keep the stored order verbatim (including
 * empty/hidden columns) and append any newly-present values at the end. When
 * nothing is stored yet, seed alphabetically (spec §3.2 / §3.6).
 */
export function reconcileColumns(
  stored: Column[] | undefined,
  present: string[],
): Column[] {
  if (!stored || stored.length === 0) {
    return [...present].sort((a, b) => a.localeCompare(b)).map((value) => ({ value }));
  }
  const known = new Set(stored.map((c) => c.value));
  const appended = present.filter((v) => !known.has(v)).map((value) => ({ value }));
  return appended.length ? [...stored, ...appended] : stored;
}

export function makeCard(
  body: string,
  props: Record<string, Prop>,
  promotions: Card['promotions'] = {},
  id?: string,
  created?: number,
): Card {
  return { id: id || uid('c_'), body, props, promotions, created: created ?? Date.now() };
}

export type Action =
  | { type: 'setActive'; id: string | null }
  | { type: 'addBoard'; id?: string; name?: string; color?: string }
  | { type: 'removeBoard'; id: string }
  | { type: 'updateBoard'; id: string; patch: Partial<Board> }
  | { type: 'reorderBoards'; order: string[] }
  | { type: 'addCard'; id?: string; body?: string; props?: Record<string, Prop>; created?: number }
  | { type: 'updateCard'; id: string; patch: Partial<Card> }
  | { type: 'removeCard'; id: string }
  | { type: 'setProp'; id: string; name: string; value: string; propType?: PropType }
  | { type: 'renameProp'; id: string; from: string; to: string }
  | { type: 'removeProp'; id: string; name: string }
  | { type: 'togglePromote'; id: string; name: string; where: 'front' | 'title' }
  | { type: 'moveToColumn'; id: string; boardId: string; value: string }
  | { type: 'setCollapsed'; boardId: string; cardId: string; value: boolean }
  | { type: 'reorderCards'; order: string[] }
  | { type: 'setColumnConfig'; boardId: string; property: string; value: string; patch: ColumnPatch }
  | { type: 'addColumn'; boardId: string; property: string; value: string; color?: string; order?: number }
  | { type: 'reorderColumn'; boardId: string; property: string; value: string; dir: 'left' | 'right' }
  | { type: 'reorderColumns'; boardId: string; property: string; order: string[] }
  | { type: 'renameColumn'; prop: string; from: string; to: string }
  | { type: 'removeColumn'; boardId: string; property: string; value: string }
  | { type: 'replace'; state: State };

export function reducer(state: State, action: Action): State {
  const a = action;
  switch (a.type) {
    case 'setActive':
      return { ...state, activeBoardId: a.id };

    case 'addBoard': {
      const b: Board = {
        id: a.id || uid('b_'),
        name: a.name || 'New board',
        color: a.color || colorFor(state.boards.length + 3),
        groupBy: null,
        filter: { connector: 'AND', rules: [] },
        filterOpen: false,
        columnsByProperty: {},
        collapsed: {},
      };
      return { ...state, boards: [...state.boards, b], activeBoardId: b.id };
    }
    case 'removeBoard': {
      const boards = state.boards.filter((b) => b.id !== a.id);
      let activeBoardId = state.activeBoardId;
      if (activeBoardId === a.id) activeBoardId = boards[0] ? boards[0].id : null;
      return { ...state, boards, activeBoardId };
    }
    case 'updateBoard':
      return {
        ...state,
        boards: state.boards.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)),
      };
    case 'reorderBoards': {
      // a.order = board ids in the new order. Rebuild the array in that order,
      // dropping unknown ids and appending any boards the order omitted (defensive).
      const byId = new Map(state.boards.map((b) => [b.id, b]));
      const ordered = a.order.map((id) => byId.get(id)).filter((b): b is Board => !!b);
      const seen = new Set(ordered.map((b) => b.id));
      const rest = state.boards.filter((b) => !seen.has(b.id));
      return { ...state, boards: [...ordered, ...rest] };
    }

    case 'addCard': {
      const c = makeCard(a.body || 'Untitled\n', a.props || {}, {}, a.id, a.created);
      return { ...state, cards: { ...state.cards, [c.id]: c } };
    }
    case 'updateCard':
      return { ...state, cards: { ...state.cards, [a.id]: { ...state.cards[a.id], ...a.patch } } };
    case 'removeCard': {
      const cards = { ...state.cards };
      delete cards[a.id];
      return { ...state, cards };
    }
    case 'setProp': {
      const c = state.cards[a.id];
      if (!c) return state;
      const props = {
        ...c.props,
        [a.name]: { type: a.propType || detectType(a.value), value: String(a.value) },
      };
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props } } };
    }
    case 'renameProp': {
      const c = state.cards[a.id];
      if (!c || a.from === a.to || !a.to) return state;
      const props: Record<string, Prop> = {};
      const promotions = { ...c.promotions };
      Object.entries(c.props).forEach(([k, v]) => {
        props[k === a.from ? a.to : k] = v;
      });
      if (promotions[a.from]) {
        promotions[a.to] = promotions[a.from];
        delete promotions[a.from];
      }
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props, promotions } } };
    }
    case 'removeProp': {
      const c = state.cards[a.id];
      if (!c) return state;
      const props = { ...c.props };
      delete props[a.name];
      const promotions = { ...c.promotions };
      delete promotions[a.name];
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props, promotions } } };
    }
    case 'togglePromote': {
      const c = state.cards[a.id];
      if (!c) return state;
      const cur = c.promotions[a.name] || {};
      const next = { ...cur, [a.where]: !cur[a.where] };
      const promotions = { ...c.promotions, [a.name]: next };
      if (!next.front && !next.title) delete promotions[a.name];
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, promotions } } };
    }
    case 'moveToColumn': {
      // set the grouping prop's value to the target column value
      const c = state.cards[a.id];
      if (!c) return state;
      const board = state.boards.find((b) => b.id === a.boardId);
      if (!board || !board.groupBy) return state;
      const existing = c.props[board.groupBy];
      const type = existing ? existing.type : 'select';
      const props = { ...c.props, [board.groupBy]: { type, value: a.value } };
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props } } };
    }
    case 'setCollapsed': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === a.boardId ? { ...b, collapsed: { ...b.collapsed, [a.cardId]: a.value } } : b,
        ),
      };
    }
    case 'reorderCards': {
      // a.order = array of card ids in new global order; we store order on cards via index
      const cards = { ...state.cards };
      a.order.forEach((id, i) => {
        if (cards[id]) cards[id] = { ...cards[id], ord: i };
      });
      return { ...state, cards };
    }
    case 'setColumnConfig': {
      // patch color/hidden on a column in property `a.property`; create it (at the
      // end) if it isn't stored yet.
      const setList = (list: Column[]): Column[] => {
        if (list.some((c) => c.value === a.value)) {
          return list.map((c) => (c.value === a.value ? { ...c, ...a.patch } : c));
        }
        return [...list, { value: a.value, ...a.patch }];
      };
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const list = b.columnsByProperty[a.property] ?? [];
          return { ...b, columnsByProperty: { ...b.columnsByProperty, [a.property]: setList(list) } };
        }),
      };
    }
    case 'addColumn': {
      // append a new column to the end of property `a.property`'s list.
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const list = b.columnsByProperty[a.property] ?? [];
          if (list.some((c) => c.value === a.value)) return b;
          const color = a.color || colorFor(list.length + 2);
          return {
            ...b,
            columnsByProperty: { ...b.columnsByProperty, [a.property]: [...list, { value: a.value, color }] },
          };
        }),
      };
    }
    case 'reorderColumn': {
      // move one column left/right within its property's list.
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const list = b.columnsByProperty[a.property] ?? [];
          const i = list.findIndex((c) => c.value === a.value);
          const j = i + (a.dir === 'left' ? -1 : 1);
          if (i < 0 || j < 0 || j >= list.length) return b;
          const next = [...list];
          [next[i], next[j]] = [next[j], next[i]];
          return { ...b, columnsByProperty: { ...b.columnsByProperty, [a.property]: next } };
        }),
      };
    }
    case 'reorderColumns': {
      // a.order = the full left-to-right value list for `a.property`. Rebuild the
      // list in that order, preserving each known column's config and creating
      // bare entries for new values. Also used to persist first-time seeding and
      // reconciled appends, so it mirrors what reloading from the backend yields.
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const byValue = new Map((b.columnsByProperty[a.property] ?? []).map((c) => [c.value, c]));
          const next: Column[] = a.order.map((value) => byValue.get(value) ?? { value });
          return { ...b, columnsByProperty: { ...b.columnsByProperty, [a.property]: next } };
        }),
      };
    }
    case 'renameColumn': {
      // Rename a grouping value across ALL cards (values are global) and in every
      // board's list for `prop`, in place — array index never moves, so position
      // is preserved by construction. Collision guard: reject (no-op) if `to`
      // already exists for `prop` as a card value or a stored column (spec §3.8).
      const { prop, from, to } = a;
      if (!to || from === to) return state;
      const collision =
        Object.values(state.cards).some(
          (c) => c.props[prop] && String(c.props[prop].value) === to,
        ) ||
        state.boards.some((b) => (b.columnsByProperty[prop] ?? []).some((c) => c.value === to));
      if (collision) return state;
      const cards = { ...state.cards };
      Object.values(cards).forEach((c) => {
        if (c.props[prop] && String(c.props[prop].value) === String(from))
          cards[c.id] = { ...c, props: { ...c.props, [prop]: { ...c.props[prop], value: to } } };
      });
      const boards = state.boards.map((b) => {
        const list = b.columnsByProperty[prop];
        if (!list || !list.some((c) => c.value === from)) return b;
        const next = list.map((c) => (c.value === from ? { ...c, value: to } : c));
        return { ...b, columnsByProperty: { ...b.columnsByProperty, [prop]: next } };
      });
      return { ...state, cards, boards };
    }
    case 'removeColumn': {
      // explicit removal of a column listing; never touches card data (spec §3.7).
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const list = b.columnsByProperty[a.property];
          if (!list) return b;
          const next = list.filter((c) => c.value !== a.value);
          if (next.length === list.length) return b;
          return { ...b, columnsByProperty: { ...b.columnsByProperty, [a.property]: next } };
        }),
      };
    }
    case 'replace':
      return a.state;
    default:
      return state;
  }
}
