import { describe, expect, it } from 'vitest';
import { evalFilter, ruleMatch } from './filter';
import type { Card, Filter, Prop, Rule } from './types';

function card(props: Record<string, Prop>): Card {
  return { id: 'c1', body: 'Title\nnotes', props, promotions: {}, created: 0 };
}
let rid = 0;
function rule(prop: string, op: Rule['op'], value: Rule['value'] = ''): Rule {
  return { id: 'r' + rid++, prop, op, value };
}

describe('ruleMatch', () => {
  const c = card({
    Priority: { type: 'select', value: 'High' },
    Estimate: { type: 'int', value: '8' },
    Due: { type: 'date', value: '2024-06-22' },
    Done: { type: 'bool', value: 'yes' },
  });

  it('is / isnot are case-insensitive', () => {
    expect(ruleMatch(c, rule('Priority', 'is', 'high'))).toBe(true);
    expect(ruleMatch(c, rule('Priority', 'isnot', 'low'))).toBe(true);
    expect(ruleMatch(c, rule('Priority', 'isnot', 'HIGH'))).toBe(false);
  });
  it('contains', () => {
    expect(ruleMatch(c, rule('Priority', 'contains', 'ig'))).toBe(true);
    expect(ruleMatch(c, rule('Priority', 'contains', 'z'))).toBe(false);
  });
  it('numeric gt / lt / between', () => {
    expect(ruleMatch(c, rule('Estimate', 'gt', '5'))).toBe(true);
    expect(ruleMatch(c, rule('Estimate', 'lt', '5'))).toBe(false);
    expect(ruleMatch(c, rule('Estimate', 'between', ['5', '10']))).toBe(true);
    expect(ruleMatch(c, rule('Estimate', 'between', ['9', '10']))).toBe(false);
  });
  it('date before / after', () => {
    expect(ruleMatch(c, rule('Due', 'before', '2024-07-01'))).toBe(true);
    expect(ruleMatch(c, rule('Due', 'after', '2024-07-01'))).toBe(false);
  });
  it('bool istrue / isfalse', () => {
    expect(ruleMatch(c, rule('Done', 'istrue'))).toBe(true);
    expect(ruleMatch(c, rule('Done', 'isfalse'))).toBe(false);
  });
  it('isset / notset test presence', () => {
    expect(ruleMatch(c, rule('Priority', 'isset'))).toBe(true);
    expect(ruleMatch(c, rule('Missing', 'isset'))).toBe(false);
    expect(ruleMatch(c, rule('Missing', 'notset'))).toBe(true);
    expect(ruleMatch(c, rule('Priority', 'notset'))).toBe(false);
  });
  it('a rule with an empty value is ignored (passes)', () => {
    expect(ruleMatch(c, rule('Priority', 'is', ''))).toBe(true);
    expect(ruleMatch(c, rule('Estimate', 'between', ['', '']))).toBe(true);
  });
  it('value ops on a missing prop fail', () => {
    expect(ruleMatch(c, rule('Missing', 'is', 'x'))).toBe(false);
  });
});

describe('evalFilter', () => {
  const c = card({
    Area: { type: 'select', value: 'Eng' },
    Priority: { type: 'select', value: 'High' },
  });
  it('no rules → pass', () => {
    expect(evalFilter(c, { connector: 'AND', rules: [] })).toBe(true);
    expect(evalFilter(c, null)).toBe(true);
  });
  it('AND requires every rule', () => {
    const f: Filter = {
      connector: 'AND',
      rules: [rule('Area', 'is', 'Eng'), rule('Priority', 'is', 'Low')],
    };
    expect(evalFilter(c, f)).toBe(false);
  });
  it('OR requires some rule', () => {
    const f: Filter = {
      connector: 'OR',
      rules: [rule('Area', 'is', 'Design'), rule('Priority', 'is', 'High')],
    };
    expect(evalFilter(c, f)).toBe(true);
  });
  it('disabled filter ignores rules → all cards pass', () => {
    const rules = [rule('Area', 'is', 'Design'), rule('Priority', 'is', 'Low')];
    // Would normally exclude this card under AND…
    expect(evalFilter(c, { connector: 'AND', rules })).toBe(false);
    // …but disabling keeps the rules and passes the card anyway.
    expect(evalFilter(c, { connector: 'AND', rules, enabled: false })).toBe(true);
  });
  it('enabled:true behaves like a normal filter', () => {
    const f: Filter = { connector: 'AND', rules: [rule('Area', 'is', 'Design')], enabled: true };
    expect(evalFilter(c, f)).toBe(false);
  });
  it('missing enabled flag is treated as enabled (backward compatible)', () => {
    const f: Filter = { connector: 'AND', rules: [rule('Area', 'is', 'Design')] };
    expect(evalFilter(c, f)).toBe(false);
  });
});
