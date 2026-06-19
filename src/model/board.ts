// board.ts — card↔board association rules. Every board "owns" the cards whose
// `Board` property equals its name; the All board (reserved id) owns all cards.
// This ownership predicate is computed (never a stored, user-editable rule) and
// is ANDed with the board's user filter at every "cards on this board" site.

import { evalFilter } from './filter';
import type { Board, Card, Prop, Registry } from './types';

/** Property name that records which board a card belongs to. */
export const BOARD_PROP = 'Board';

/** Reserved id of the All board (no ownership filter; protected from delete/rename). */
export const ALL_BOARD_ID = 'b_all';

/** The All board shows every card regardless of its `Board` value. */
export function isAllBoard(board: Board | null | undefined): boolean {
  return !!board && board.id === ALL_BOARD_ID;
}

/** Whether a card belongs to a board (ownership only — ignores the user filter). */
export function ownsCard(board: Board, card: Card): boolean {
  if (isAllBoard(board)) return true;
  const p = card.props[BOARD_PROP];
  return !!p && String(p.value) === board.name;
}

/** Cards on a board = ownership AND the user filter. The single source of truth. */
export function cardVisibleOnBoard(card: Card, board: Board | null | undefined): boolean {
  if (!board) return evalFilter(card, null);
  return ownsCard(board, card) && evalFilter(card, board.filter);
}

/**
 * Initial props for a card created on `board`:
 *  1. the group-by column value (when added into a specific column),
 *  2. values seeded from the board's `is` filter rules (so the card matches the view),
 *  3. the `Board` ownership stamp — except on the All board, where it is left unset
 *     so the new card is an orphan the user then assigns.
 */
export function newCardProps(
  board: Board,
  registry: Registry,
  colValue: string | null,
): Record<string, Prop> {
  const props: Record<string, Prop> = {};
  if (board.groupBy && colValue != null) {
    const ex = registry[board.groupBy];
    props[board.groupBy] = { type: ex ? ex.type : 'select', value: String(colValue) };
  }
  (board.filter?.rules ?? []).forEach((r) => {
    if (r.op === 'is' && r.value && !props[r.prop]) {
      props[r.prop] = { type: registry[r.prop]?.type ?? 'text', value: String(r.value) };
    }
  });
  if (!isAllBoard(board) && !props[BOARD_PROP]) {
    props[BOARD_PROP] = { type: 'select', value: board.name };
  }
  return props;
}
