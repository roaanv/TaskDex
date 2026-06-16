// detect.ts — type detection, date parsing, value formatting, and coercion.
// Ported verbatim from store.jsx; these rules are authoritative — do not re-derive.

import type { Prop, PropType } from './types';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const TYPE_META: Record<PropType, { glyph: string; label: string }> = {
  text: { glyph: 'T', label: 'Text' },
  int: { glyph: '#', label: 'Number' },
  decimal: { glyph: '#.', label: 'Decimal' },
  date: { glyph: '', label: 'Date' },
  bool: { glyph: '✓', label: 'Yes/No' },
  select: { glyph: '≡', label: 'Select' },
  url: { glyph: '↗', label: 'Link' },
};

/** Parse a date string to epoch ms, or null. Accepts YYYY-MM-DD, M/D[/YY(YY)],
 *  Mon D[, YYYY], and D Mon[, YYYY] (month matched on first 3 letters). */
export function parseDate(input: string | null | undefined): number | null {
  if (!input) return null;
  const s = String(input).trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(y, +m[1] - 1, +m[2]).getTime();
  }
  if ((m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/i))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo != null) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[2]).getTime();
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:[,\s]+(\d{4}))?$/i))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo != null) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[1]).getTime();
  }
  return null;
}

/** Detect the property type for a raw value (first match wins). */
export function detectType(raw: unknown): PropType {
  const v = String(raw == null ? '' : raw).trim();
  if (!v) return 'text';
  if (/^(https?:\/\/|www\.)\S+$/i.test(v)) return 'url';
  if (/^(yes|no|true|false|done|y|n|✓)$/i.test(v)) return 'bool';
  if (/^-?\d{1,9}$/.test(v)) return 'int';
  if (/^-?\d*\.\d+$/.test(v)) return 'decimal';
  if (parseDate(v) != null) return 'date';
  return 'text';
}

export const truthy = (v: unknown): boolean => /^(yes|true|done|y|✓)$/i.test(String(v).trim());

/** Human display of a stored {type, value}. */
export function formatValue(prop: Prop | null | undefined): string {
  if (!prop) return '';
  const { type, value } = prop;
  if (type === 'date') {
    const t = parseDate(value);
    if (t == null) return value;
    const d = new Date(t);
    const cur = new Date().getFullYear();
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== cur ? ' ' + d.getFullYear() : ''}`;
  }
  if (type === 'bool') return truthy(value) ? 'Yes' : 'No';
  return String(value);
}

/** Coerce a stored prop for comparison in filters. */
export function coerce(prop: Prop | null | undefined): number | boolean | string | null {
  if (!prop) return null;
  const { type, value } = prop;
  if (type === 'int' || type === 'decimal') return Number(value);
  if (type === 'date') return parseDate(value) as number;
  if (type === 'bool') return truthy(value);
  return String(value).toLowerCase();
}
