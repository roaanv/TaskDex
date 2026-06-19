import { describe, expect, it } from 'vitest';
import { reconcileColumns, reducer } from './reducer';
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
    columnsByProperty: { Status: [{ value: 'Todo', color: '#111' }, { value: 'Done', color: '#222' }] },
    collapsed: {},
  };
  return { cards, boards: [board], activeBoardId: 'b1', version: 1 };
}

describe('reducer', () => {
  const statusValues = (s: State) => s.boards[0].columnsByProperty.Status.map((c) => c.value);

  it('renameColumn rewrites the value across ALL cards and keeps the column position', () => {
    // 'Todo' -> 'Zzz' would sort to the end alphabetically; it must NOT move.
    const next = reducer(baseState(), { type: 'renameColumn', prop: 'Status', from: 'Todo', to: 'Zzz' });
    expect(next.cards.a.props.Status.value).toBe('Zzz');
    expect(next.cards.b.props.Status.value).toBe('Zzz');
    expect(next.cards.c.props.Status.value).toBe('Done'); // untouched
    expect(statusValues(next)).toEqual(['Zzz', 'Done']); // index 0 preserved
    expect(next.boards[0].columnsByProperty.Status[0].color).toBe('#111'); // config carried
  });

  it('renameColumn is a no-op when the target name already exists (collision)', () => {
    const before = baseState();
    const next = reducer(before, { type: 'renameColumn', prop: 'Status', from: 'Todo', to: 'Done' });
    expect(next).toBe(before); // unchanged reference: nothing happened
    expect(statusValues(next)).toEqual(['Todo', 'Done']);
    expect(next.cards.a.props.Status.value).toBe('Todo');
  });

  it('removeColumn drops the listing but never touches card data', () => {
    const next = reducer(baseState(), { type: 'removeColumn', boardId: 'b1', property: 'Status', value: 'Done' });
    expect(statusValues(next)).toEqual(['Todo']);
    expect(next.cards.c.props.Status.value).toBe('Done'); // card value retained
  });

  it('reorderBoards rebuilds the board list in the given id order', () => {
    const s = baseState();
    const b2: Board = { ...s.boards[0], id: 'b2', name: 'Second' };
    const b3: Board = { ...s.boards[0], id: 'b3', name: 'Third' };
    const start: State = { ...s, boards: [s.boards[0], b2, b3] };
    const next = reducer(start, { type: 'reorderBoards', order: ['b3', 'b1', 'b2'] });
    expect(next.boards.map((b) => b.id)).toEqual(['b3', 'b1', 'b2']);
    expect(next.activeBoardId).toBe('b1'); // active board unchanged
  });

  it('reorderBoards appends boards omitted from the order (defensive)', () => {
    const s = baseState();
    const b2: Board = { ...s.boards[0], id: 'b2' };
    const start: State = { ...s, boards: [s.boards[0], b2] };
    const next = reducer(start, { type: 'reorderBoards', order: ['b2'] });
    expect(next.boards.map((b) => b.id)).toEqual(['b2', 'b1']);
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

  it('addColumn appends to the end of the property list', () => {
    const next = reducer(baseState(), { type: 'addColumn', boardId: 'b1', property: 'Status', value: 'Blocked' });
    expect(statusValues(next)).toEqual(['Todo', 'Done', 'Blocked']);
  });

  it('reorderColumns rebuilds the list in the given order, preserving config', () => {
    const next = reducer(baseState(), { type: 'reorderColumns', boardId: 'b1', property: 'Status', order: ['Done', 'Todo'] });
    expect(statusValues(next)).toEqual(['Done', 'Todo']);
    expect(next.boards[0].columnsByProperty.Status[0].color).toBe('#222'); // Done's config preserved
  });

  it('reorderColumns creates a bare entry for a previously-unstored value', () => {
    const next = reducer(baseState(), { type: 'reorderColumns', boardId: 'b1', property: 'Status', order: ['Backlog', 'Todo', 'Done'] });
    expect(statusValues(next)).toEqual(['Backlog', 'Todo', 'Done']);
  });

  it('reconcileColumns seeds alphabetically, then appends new values keeping order', () => {
    expect(reconcileColumns(undefined, ['Todo', 'Done', 'Backlog']).map((c) => c.value)).toEqual([
      'Backlog', 'Done', 'Todo', // alphabetical seed
    ]);
    const stored = [{ value: 'Todo' }, { value: 'Done' }];
    expect(reconcileColumns(stored, ['Todo', 'Done', 'New']).map((c) => c.value)).toEqual([
      'Todo', 'Done', 'New', // appended at the end, existing order kept
    ]);
  });

  it('addCard uses a provided id and created timestamp', () => {
    const next = reducer(baseState(), { type: 'addCard', id: 'z', body: 'Z\n', created: 99 });
    expect(next.cards.z).toMatchObject({ id: 'z', body: 'Z\n', created: 99 });
  });

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
});
