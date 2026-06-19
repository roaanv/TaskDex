// registry.ts — derive the property registry from all cards. Powers property-name
// and select-value autocomplete plus the filter property pickers. Ported from store.jsx.

import type { Card, Registry, Board } from './types';
import { cardVisibleOnBoard } from './board';

/** Build `{ [name]: { name, type, values: { [value]: count } } }` from all cards. */
export function buildRegistry(cards: Record<string, Card>): Registry {
  const reg: Registry = {};
  Object.values(cards).forEach((c) => {
    Object.entries(c.props).forEach(([name, p]) => {
      if (!reg[name]) reg[name] = { name, type: p.type, values: {} };
      const key = String(p.value);
      reg[name].values[key] = (reg[name].values[key] || 0) + 1;
    });
  });
  return reg;
}

/** Registry built only from cards passing the board's filter ("cards on the board"). */
export function buildBoardRegistry(
  cards: Record<string, Card>,
  board: Board | null | undefined,
): Registry {
  const subset: Record<string, Card> = {};
  Object.values(cards).forEach((c) => {
    if (cardVisibleOnBoard(c, board)) subset[c.id] = c;
  });
  return buildRegistry(subset);
}
