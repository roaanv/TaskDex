import { describe, expect, it } from 'vitest';
import { buildBoardRegistry } from './registry';
import type { Board, Card } from './types';

const card = (id: string, props: Card['props']): Card => ({
  id, body: id + '\n', props, promotions: {}, created: 0,
});

const board = (rules: Board['filter']['rules']): Board => ({
  id: 'b', name: 'B', color: '#fff', groupBy: null,
  filter: { connector: 'AND', rules }, filterOpen: false, columnsByProperty: {}, collapsed: {},
});

describe('buildBoardRegistry', () => {
  it('includes only props on cards passing the board filter', () => {
    const cards = {
      a: card('a', { Board: { type: 'select', value: 'B' }, status: { type: 'text', value: 'open' }, owner: { type: 'text', value: 'me' } }),
      b: card('b', { Board: { type: 'select', value: 'B' }, status: { type: 'text', value: 'done' }, due: { type: 'date', value: '1/1/2026' } }),
    };
    const reg = buildBoardRegistry(cards, board([
      { id: 'r', prop: 'status', op: 'is', value: 'open' },
    ]));
    expect(Object.keys(reg).sort()).toEqual(['Board', 'owner', 'status']);
    expect(reg.due).toBeUndefined();
  });

  it('with no filter, includes every card (like buildRegistry)', () => {
    const cards = { a: card('a', { x: { type: 'text', value: '1' } }) };
    expect(Object.keys(buildBoardRegistry(cards, null))).toEqual(['x']);
  });
});
