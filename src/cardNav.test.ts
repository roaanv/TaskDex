import { describe, expect, it } from 'vitest';
import { nextSelectedInGrid, nextSelectedInList } from './cardNav';

describe('nextSelectedInGrid', () => {
  // Three columns of differing heights:
  //   col0: a0, a1, a2
  //   col1: b0
  //   col2: c0, c1
  const cols = [
    ['a0', 'a1', 'a2'],
    ['b0'],
    ['c0', 'c1'],
  ];

  it('moves up/down within a column and clamps at the ends', () => {
    expect(nextSelectedInGrid(cols, 'a1', 'up')).toBe('a0');
    expect(nextSelectedInGrid(cols, 'a1', 'down')).toBe('a2');
    expect(nextSelectedInGrid(cols, 'a0', 'up')).toBeNull(); // top edge
    expect(nextSelectedInGrid(cols, 'a2', 'down')).toBeNull(); // bottom edge
  });

  it('moves to the same row in the adjacent column when it exists', () => {
    expect(nextSelectedInGrid(cols, 'c0', 'left')).toBe('b0'); // c0 row0 -> b0 row0
    expect(nextSelectedInGrid(cols, 'a1', 'right')).toBe('b0'); // b has only row 0
  });

  it('lands on the last card of a shorter target column', () => {
    // a2 is row 2; col1 (b) has only row 0 -> last card b0.
    expect(nextSelectedInGrid(cols, 'a2', 'right')).toBe('b0');
    // a2 is row 2; col2 (c) has rows 0..1 -> last card c1 when coming from the left.
    expect(nextSelectedInGrid([['a0', 'a1', 'a2'], ['c0', 'c1']], 'a2', 'right')).toBe('c1');
  });

  it('skips fully empty columns when moving left/right', () => {
    const withGap = [['a0', 'a1'], [], ['c0', 'c1', 'c2']];
    expect(nextSelectedInGrid(withGap, 'a1', 'right')).toBe('c1'); // skip empty col1, row 1
    expect(nextSelectedInGrid(withGap, 'c0', 'left')).toBe('a0'); // skip empty col1, row 0
  });

  it('no-ops at the left/right edges', () => {
    expect(nextSelectedInGrid(cols, 'a0', 'left')).toBeNull();
    expect(nextSelectedInGrid(cols, 'c1', 'right')).toBeNull();
  });

  it('returns null when the current id is not present', () => {
    expect(nextSelectedInGrid(cols, 'zzz', 'down')).toBeNull();
  });
});

describe('nextSelectedInList', () => {
  const ids = ['x', 'y', 'z'];

  it('moves up=prev and down=next, clamped', () => {
    expect(nextSelectedInList(ids, 'y', 'up')).toBe('x');
    expect(nextSelectedInList(ids, 'y', 'down')).toBe('z');
    expect(nextSelectedInList(ids, 'x', 'up')).toBeNull();
    expect(nextSelectedInList(ids, 'z', 'down')).toBeNull();
  });

  it('ignores left/right', () => {
    expect(nextSelectedInList(ids, 'y', 'left')).toBeNull();
    expect(nextSelectedInList(ids, 'y', 'right')).toBeNull();
  });

  it('returns null when the current id is not present', () => {
    expect(nextSelectedInList(ids, 'nope', 'down')).toBeNull();
  });
});
