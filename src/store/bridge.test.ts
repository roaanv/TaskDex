import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Tauri api so persist() can be exercised in node (where hasTauri()
// would otherwise be false). vi.hoisted lets the (hoisted) mock factory share the
// call registry. Every command is a spy returning a resolved promise.
const { calls, api } = vi.hoisted(() => {
  const calls: Record<string, unknown[][]> = {};
  const spy = (name: string) => {
    calls[name] = [];
    return (...args: unknown[]) => {
      calls[name].push(args);
      return Promise.resolve();
    };
  };
  const names = [
    'setActive', 'addBoard', 'removeBoard', 'updateBoard', 'addCard', 'updateCard',
    'deleteCard', 'setProp', 'renameProp', 'removeProp', 'togglePromote', 'moveToColumn',
    'reorderCards', 'setCollapsed', 'setColumnConfig', 'addColumn', 'reorderColumn', 'reorderColumns',
    'renameColumn', 'removeColumn',
  ];
  const api: Record<string, (...a: unknown[]) => Promise<void>> = {};
  names.forEach((n) => (api[n] = spy(n)));
  return { calls, api };
});
vi.mock('../api', () => ({ hasTauri: () => true, api }));

import { augment, persist } from './bridge';
import type { State } from '../model';

function state(): State {
  return {
    cards: {
      a: { id: 'a', body: 'A\n', props: { P: { type: 'select', value: 'x' } }, promotions: { P: { front: true } }, created: 1 },
    },
    boards: [
      {
        id: 'b1', name: 'B', color: '#fff', groupBy: 'Status',
        filter: { connector: 'AND', rules: [] }, filterOpen: false,
        columnsByProperty: { Status: [{ value: 'Todo', color: '#111' }, { value: 'Done', color: '#222' }] },
        collapsed: {},
      },
    ],
    activeBoardId: 'b1',
    version: 1,
  };
}

beforeEach(() => {
  for (const k of Object.keys(calls)) calls[k] = [];
});

describe('augment', () => {
  it('injects an id and color for addBoard', () => {
    const a = augment({ type: 'addBoard' }, state());
    expect(a.type).toBe('addBoard');
    if (a.type === 'addBoard') {
      expect(a.id).toMatch(/^b_/);
      expect(a.color).toMatch(/^#/);
    }
  });
  it('injects id + created for addCard', () => {
    const a = augment({ type: 'addCard', body: 'X\n' }, state());
    if (a.type === 'addCard') {
      expect(a.id).toMatch(/^c_/);
      expect(typeof a.created).toBe('number');
    }
  });
  it('computes color + order for addColumn from the target property list', () => {
    const a = augment({ type: 'addColumn', boardId: 'b1', property: 'Status', value: 'Blocked' }, state());
    if (a.type === 'addColumn') {
      expect(a.order).toBe(2); // append index after 2 existing columns
      expect(a.color).toMatch(/^#/);
    }
  });

  it('pins the All board first when reordering boards', () => {
    const a = augment({ type: 'reorderBoards', order: ['b1', 'b_all', 'b2'] }, state());
    if (a.type === 'reorderBoards') {
      expect(a.order).toEqual(['b_all', 'b1', 'b2']);
    }
  });

  it('leaves a reorder without the All board unchanged', () => {
    const a = augment({ type: 'reorderBoards', order: ['b2', 'b1'] }, state());
    if (a.type === 'reorderBoards') {
      expect(a.order).toEqual(['b2', 'b1']);
    }
  });
});

describe('persist', () => {
  it('maps addCard to api.addCard with a constructed card', async () => {
    await persist({ type: 'addCard', id: 'c_1', body: 'Hi\n', props: {}, created: 5 }, state());
    expect(calls.addCard).toHaveLength(1);
    expect(calls.addCard[0][0]).toMatchObject({ id: 'c_1', body: 'Hi\n', created: 5 });
  });

  it('resolves propType for setProp when omitted', async () => {
    await persist({ type: 'setProp', id: 'a', name: 'Due', value: '2024-06-22' }, state());
    expect(calls.setProp[0]).toEqual(['a', 'Due', '2024-06-22', 'date']);
  });

  it('derives final front/title for togglePromote from previous state', async () => {
    // prop P currently has front:true; toggling front should yield front:false
    await persist({ type: 'togglePromote', id: 'a', name: 'P', where: 'front' }, state());
    expect(calls.togglePromote[0]).toEqual(['a', 'P', false, false]);
    // toggling title should yield front:true (unchanged), title:true
    await persist({ type: 'togglePromote', id: 'a', name: 'P', where: 'title' }, state());
    expect(calls.togglePromote[1]).toEqual(['a', 'P', true, true]);
  });

  it('maps moveToColumn straight through', async () => {
    await persist({ type: 'moveToColumn', id: 'a', boardId: 'b1', value: 'Done' }, state());
    expect(calls.moveToColumn[0]).toEqual(['a', 'b1', 'Done']);
  });

  it('maps reorderColumns with the property and full ordered value list', async () => {
    await persist({ type: 'reorderColumns', boardId: 'b1', property: 'Status', order: ['Done', 'Todo'] }, state());
    expect(calls.reorderColumns[0]).toEqual(['b1', 'Status', ['Done', 'Todo']]);
  });

  it('maps renameColumn to (prop, from, to) — global, no board/order', async () => {
    await persist({ type: 'renameColumn', prop: 'Status', from: 'Todo', to: 'Doing' }, state());
    expect(calls.renameColumn[0]).toEqual(['Status', 'Todo', 'Doing']);
  });

  it('maps removeColumn straight through', async () => {
    await persist({ type: 'removeColumn', boardId: 'b1', property: 'Status', value: 'Done' }, state());
    expect(calls.removeColumn[0]).toEqual(['b1', 'Status', 'Done']);
  });

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
    expect(calls.updateBoard[0]).toEqual(['b_all', { name: 'Nope' }]);
  });

  it('does not persist deletion of the All board', async () => {
    await persist({ type: 'removeBoard', id: 'b_all' }, state());
    expect(calls.removeBoard).toHaveLength(0);
  });
});
