import { describe, expect, it } from 'vitest';
import { reducer } from './reducer';
import type { Board, Card, State } from './types';

function baseState(): State {
  const cards: Record<string, Card> = {
    a: { id: 'a', body: 'A\n', props: { Status: { type: 'select', value: 'Todo' } }, promotions: {}, created: 1 },
    b: { id: 'b', body: 'B\n', props: { Status: { type: 'select', value: 'Todo' } }, promotions: {}, created: 2 },
    c: { id: 'c', body: 'C\n', props: { Status: { type: 'select', value: 'Done' } }, promotions: {}, created: 3 },
  };
  const board: Board = {
    id: 'b1', name: 'Board', color: '#fff', groupBy: 'Status',
    filter: { connector: 'AND', rules: [] }, filterOpen: false,
    columns: { Todo: { color: '#111', order: 0 }, Done: { color: '#222', order: 1 } },
    collapsed: {},
  };
  return { cards, boards: [board], activeBoardId: 'b1', version: 1 };
}

describe('reducer', () => {
  it('renameColumn rewrites the value across ALL cards and the board column key', () => {
    const next = reducer(baseState(), { type: 'renameColumn', boardId: 'b1', prop: 'Status', from: 'Todo', to: 'In Progress' });
    expect(next.cards.a.props.Status.value).toBe('In Progress');
    expect(next.cards.b.props.Status.value).toBe('In Progress');
    expect(next.cards.c.props.Status.value).toBe('Done'); // untouched
    expect(Object.keys(next.boards[0].columns)).toContain('In Progress');
    expect(Object.keys(next.boards[0].columns)).not.toContain('Todo');
  });

  it('moveToColumn sets the grouping prop value to the target column', () => {
    const next = reducer(baseState(), { type: 'moveToColumn', id: 'c', boardId: 'b1', value: 'Todo' });
    expect(next.cards.c.props.Status.value).toBe('Todo');
    expect(next.cards.c.props.Status.type).toBe('select'); // preserves existing type
  });

  it('togglePromote flips a surface and removes the entry when both are off', () => {
    let s = reducer(baseState(), { type: 'togglePromote', id: 'a', name: 'Status', where: 'front' });
    expect(s.cards.a.promotions.Status.front).toBe(true);
    s = reducer(s, { type: 'togglePromote', id: 'a', name: 'Status', where: 'front' });
    expect(s.cards.a.promotions.Status).toBeUndefined();
  });

  it('removeBoard keeps cards and reassigns the active board', () => {
    const next = reducer(baseState(), { type: 'removeBoard', id: 'b1' });
    expect(next.boards).toHaveLength(0);
    expect(next.activeBoardId).toBeNull();
    expect(Object.keys(next.cards)).toHaveLength(3); // cards are global, never deleted
  });

  it('setProp detects type when not provided', () => {
    const next = reducer(baseState(), { type: 'setProp', id: 'a', name: 'Due', value: '2024-06-22' });
    expect(next.cards.a.props.Due).toEqual({ type: 'date', value: '2024-06-22' });
  });

  it('addColumn appends after the max order', () => {
    const next = reducer(baseState(), { type: 'addColumn', boardId: 'b1', value: 'Blocked' });
    expect(next.boards[0].columns.Blocked.order).toBe(2);
  });

  it('addCard uses a provided id and created timestamp', () => {
    const next = reducer(baseState(), { type: 'addCard', id: 'z', body: 'Z\n', created: 99 });
    expect(next.cards.z).toMatchObject({ id: 'z', body: 'Z\n', created: 99 });
  });
});
