import { describe, expect, it } from 'vitest';
import { coerce, detectType, formatValue, parseDate, truthy } from './detect';

describe('detectType', () => {
  it('detects url (http/https/www)', () => {
    expect(detectType('https://example.com/x')).toBe('url');
    expect(detectType('http://a.b')).toBe('url');
    expect(detectType('www.example.com')).toBe('url');
  });
  it('detects bool tokens (case-insensitive)', () => {
    for (const v of ['yes', 'no', 'true', 'false', 'done', 'y', 'n', '✓', 'YES', 'Done']) {
      expect(detectType(v)).toBe('bool');
    }
  });
  it('detects int (1..9 digits, optional sign)', () => {
    expect(detectType('8')).toBe('int');
    expect(detectType('-42')).toBe('int');
    expect(detectType('123456789')).toBe('int');
  });
  it('treats 10+ digit numbers as text, not int', () => {
    expect(detectType('1234567890')).toBe('text');
  });
  it('detects decimal', () => {
    expect(detectType('3.5')).toBe('decimal');
    expect(detectType('-0.25')).toBe('decimal');
    expect(detectType('.5')).toBe('decimal');
  });
  it('detects date forms', () => {
    expect(detectType('2024-06-22')).toBe('date');
    expect(detectType('6/22')).toBe('date');
    expect(detectType('Jun 22')).toBe('date');
    expect(detectType('22 Jun')).toBe('date');
  });
  it('falls back to text and empty → text', () => {
    expect(detectType('hello world')).toBe('text');
    expect(detectType('')).toBe('text');
    expect(detectType(null)).toBe('text');
  });
  it('order: a numeric-looking bool word still wins as bool', () => {
    // "done" matches bool before any numeric/date rule
    expect(detectType('done')).toBe('bool');
  });
});

describe('parseDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    const t = parseDate('2024-06-22')!;
    const d = new Date(t);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 5, 22]);
  });
  it('parses M/D/YY with 2-digit year → 2000+', () => {
    const d = new Date(parseDate('3/5/24')!);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 2, 5]);
  });
  it('parses M/D defaulting to current year', () => {
    const d = new Date(parseDate('12/1')!);
    expect([d.getMonth(), d.getDate()]).toEqual([11, 1]);
    expect(d.getFullYear()).toBe(new Date().getFullYear());
  });
  it('parses "Mon D, YYYY" and "D Mon YYYY"', () => {
    expect(new Date(parseDate('Jun 22, 2023')!).getMonth()).toBe(5);
    expect(new Date(parseDate('22 Jun 2023')!).getDate()).toBe(22);
  });
  it('returns null for non-dates', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('formatValue', () => {
  it('formats a current-year date without a year', () => {
    const cur = new Date().getFullYear();
    expect(formatValue({ type: 'date', value: `${cur}-03-09` })).toBe('Mar 9');
  });
  it('formats a non-current-year date with a year', () => {
    expect(formatValue({ type: 'date', value: '2020-01-15' })).toBe('Jan 15 2020');
  });
  it('returns the raw string for an unparseable date', () => {
    expect(formatValue({ type: 'date', value: 'someday' })).toBe('someday');
  });
  it('formats bool as Yes/No', () => {
    expect(formatValue({ type: 'bool', value: 'yes' })).toBe('Yes');
    expect(formatValue({ type: 'bool', value: 'no' })).toBe('No');
    expect(formatValue({ type: 'bool', value: 'whatever' })).toBe('No');
  });
  it('returns the string for other types and null for missing', () => {
    expect(formatValue({ type: 'text', value: 'hi' })).toBe('hi');
    expect(formatValue(null)).toBe('');
  });
});

describe('coerce + truthy', () => {
  it('coerces numbers, dates, bools, and text', () => {
    expect(coerce({ type: 'int', value: '7' })).toBe(7);
    expect(coerce({ type: 'decimal', value: '3.5' })).toBe(3.5);
    expect(coerce({ type: 'bool', value: 'yes' })).toBe(true);
    expect(coerce({ type: 'text', value: 'AbC' })).toBe('abc');
    expect(typeof coerce({ type: 'date', value: '2024-06-22' })).toBe('number');
  });
  it('truthy recognizes affirmative tokens', () => {
    expect(truthy('yes')).toBe(true);
    expect(truthy('✓')).toBe(true);
    expect(truthy('no')).toBe(false);
  });
});
