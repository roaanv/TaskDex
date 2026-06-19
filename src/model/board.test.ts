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
