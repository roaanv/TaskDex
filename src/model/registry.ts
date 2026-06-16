// registry.ts — derive the property registry from all cards. Powers property-name
// and select-value autocomplete plus the filter property pickers. Ported from store.jsx.

import type { Card, Registry } from './types';

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
