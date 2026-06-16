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
  ColumnConfig,
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
  | { type: 'setColumnConfig'; boardId: string; value: string; patch: ColumnConfig }
  | { type: 'addColumn'; boardId: string; value: string; color?: string; order?: number }
  | { type: 'reorderColumn'; boardId: string; value: string; dir: 'left' | 'right' }
  | { type: 'renameColumn'; boardId: string; prop: string; from: string; to: string }
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
        columns: {},
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
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === a.boardId
            ? { ...b, columns: { ...b.columns, [a.value]: { ...(b.columns[a.value] || {}), ...a.patch } } }
            : b,
        ),
      };
    }
    case 'addColumn': {
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId || b.columns[a.value]) return b;
          const maxOrd = Math.max(-1, ...Object.values(b.columns).map((c) => c.order ?? 0));
          const color = a.color || colorFor(Object.keys(b.columns).length + 2);
          const order = a.order ?? maxOrd + 1;
          return { ...b, columns: { ...b.columns, [a.value]: { color, order } } };
        }),
      };
    }
    case 'reorderColumn': {
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const entries = Object.entries(b.columns).sort(
            (x, y) => (x[1].order ?? 0) - (y[1].order ?? 0),
          );
          const i = entries.findIndex((e) => e[0] === a.value);
          const j = i + (a.dir === 'left' ? -1 : 1);
          if (i < 0 || j < 0 || j >= entries.length) return b;
          [entries[i], entries[j]] = [entries[j], entries[i]];
          const columns: Record<string, ColumnConfig> = {};
          entries.forEach(([k, v], idx) => {
            columns[k] = { ...v, order: idx };
          });
          return { ...b, columns };
        }),
      };
    }
    case 'renameColumn': {
      // rename a grouping value across all cards (values are global) + the board column key
      const { prop, from, to } = a;
      if (!to || from === to) return state;
      const cards = { ...state.cards };
      Object.values(cards).forEach((c) => {
        if (c.props[prop] && String(c.props[prop].value) === String(from))
          cards[c.id] = { ...c, props: { ...c.props, [prop]: { ...c.props[prop], value: to } } };
      });
      const boards = state.boards.map((b) => {
        if (!b.columns[from]) return b;
        const columns: Record<string, ColumnConfig> = {};
        Object.entries(b.columns).forEach(([k, v]) => {
          columns[k === from ? to : k] = v;
        });
        return { ...b, columns };
      });
      return { ...state, cards, boards };
    }
    case 'replace':
      return a.state;
    default:
      return state;
  }
}
