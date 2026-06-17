import { describe, expect, it } from 'vitest';
import { extractHashProps, HASH_PROP_LINE } from './hashToken';

describe('HASH_PROP_LINE', () => {
  it('matches a hash-prefixed name: value line (hyphens allowed)', () => {
    const m = '#due-date: 18/5/2026'.match(HASH_PROP_LINE);
    expect(m?.[1]).toBe('due-date');
    expect(m?.[2]).toBe('18/5/2026');
  });
  it('does NOT match a plain name: value line (no hash)', () => {
    expect('Age: 21'.match(HASH_PROP_LINE)).toBeNull();
  });
});

describe('extractHashProps', () => {
  it('lifts completed hash lines out of the text', () => {
    const r = extractHashProps('note one\n#age: 21\nnote two\n', false);
    expect(r.found).toEqual([{ name: 'age', value: '21' }]);
    expect(r.remaining).toBe('note one\nnote two\n');
  });
  it('leaves the last (still-being-typed) line when includeLast=false', () => {
    const r = extractHashProps('a\n#age: 2', false);
    expect(r.found).toEqual([]);
    expect(r.remaining).toBe('a\n#age: 2');
  });
  it('captures the last line when includeLast=true', () => {
    const r = extractHashProps('a\n#age: 21', true);
    expect(r.found).toEqual([{ name: 'age', value: '21' }]);
    expect(r.remaining).toBe('a');
  });
  it('keeps non-capturable names as text', () => {
    const r = extractHashProps('#known: 1\n#newone: 2', true, (n) => n === 'known');
    expect(r.found).toEqual([{ name: 'known', value: '1' }]);
    expect(r.remaining).toBe('#newone: 2');
  });
});
