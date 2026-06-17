import { describe, expect, it } from 'vitest';
import { extractHashProps, HASH_PROP_LINE, activeHashToken } from './hashToken';

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

describe('activeHashToken', () => {
  it('returns the token while typing the name', () => {
    const text = '#due';
    const tk = activeHashToken(text, 4);
    expect(tk).toEqual({ name: 'due', start: 0, end: 4 });
  });
  it('returns an empty-name token right after #', () => {
    expect(activeHashToken('#', 1)).toEqual({ name: '', start: 0, end: 1 });
  });
  it('returns null once a colon precedes the caret', () => {
    expect(activeHashToken('#due: 1', 7)).toBeNull();
  });
  it('returns null when caret is not after a #', () => {
    expect(activeHashToken('plain text', 5)).toBeNull();
  });
  it('finds a # mid-line and reports its absolute start', () => {
    const text = 'see #pri';
    expect(activeHashToken(text, 8)).toEqual({ name: 'pri', start: 4, end: 8 });
  });
  it('scopes to the caret line', () => {
    const text = '#a: 1\n#bcd';
    expect(activeHashToken(text, 10)).toEqual({ name: 'bcd', start: 6, end: 10 });
  });
});
