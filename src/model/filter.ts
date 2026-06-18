// filter.ts — filter rule evaluation. Ported verbatim from store.jsx's
// ruleMatch / evalFilter. A rule whose value is empty is treated as a pass.

import { coerce, parseDate } from './detect';
import type { Card, Filter, Rule } from './types';

export function ruleMatch(card: Card, rule: Rule): boolean {
  const p = card.props[rule.prop];
  if (rule.op === 'isset') return !!p && String(p.value).trim() !== '';
  if (rule.op === 'notset') return !p || String(p.value).trim() === '';

  // a rule with no value entered yet is ignored (treated as pass)
  const noVal = rule.op === 'istrue' || rule.op === 'isfalse';
  if (!noVal) {
    const tuple = (rule.value || []) as [string, string];
    const empty =
      rule.op === 'between'
        ? !rule.value || (!String(tuple[0]).trim() && !String(tuple[1]).trim())
        : rule.value == null || String(rule.value).trim() === '';
    if (empty) return true;
  }
  if (!p) return false;

  const cv = coerce(p);
  const num = (x: unknown) => Number(x);
  const dt = (x: unknown) => parseDate(x as string);
  const tuple = (rule.value || []) as [string, string];
  switch (rule.op) {
    case 'is':
      return String(p.value).toLowerCase() === String(rule.value).toLowerCase();
    case 'isnot':
      return String(p.value).toLowerCase() !== String(rule.value).toLowerCase();
    case 'contains':
      return String(p.value).toLowerCase().includes(String(rule.value || '').toLowerCase());
    case 'gt':
      return num(cv) > num(rule.value);
    case 'lt':
      return num(cv) < num(rule.value);
    case 'before':
      return (dt(p.value) as number) < (dt(rule.value as string) as number);
    case 'after':
      return (dt(p.value) as number) > (dt(rule.value as string) as number);
    case 'between':
      return num(cv) >= num(tuple[0]) && num(cv) <= num(tuple[1]);
    case 'istrue':
      return cv === true;
    case 'isfalse':
      return cv === false;
    default:
      return true;
  }
}

export function evalFilter(card: Card, filter: Filter | null | undefined): boolean {
  // A disabled filter keeps its rules but ignores them — every card passes.
  // `enabled` is optional; only an explicit `false` disables (undefined = on).
  if (filter && filter.enabled === false) return true;
  if (!filter || !filter.rules || filter.rules.length === 0) return true;
  const results = filter.rules.map((r) => ruleMatch(card, r));
  return filter.connector === 'OR' ? results.some(Boolean) : results.every(Boolean);
}
