// devSeed.ts — DEV-ONLY seed used when the app runs outside Tauri (plain browser,
// e.g. `vite dev` or component tests), where the SQLite backend is unavailable.
// Mirrors src-tauri/src/db.rs::seed() so the UI can be previewed/screenshotted
// without the Rust backend. In the shipped Tauri app this is never used — the
// backend snapshot always hydrates the store.

import { makeCard, uid } from '../model';
import type { Board, Card, Prop, Promotion, State } from '../model';

const prop = (type: Prop['type'], value: string): Prop => ({ type, value });

interface SeedSpec {
  body: string;
  props: Record<string, Prop>;
  promotions: Record<string, Promotion>;
}

const CARDS: SeedSpec[] = [
  {
    body: 'Redesign onboarding flow\nTalk to 5 users about the first run, then sketch 3 entry points and prototype the warmest one.',
    props: { Status: prop('select', 'In progress'), Priority: prop('select', 'High'), Due: prop('date', 'Jun 22'), Estimate: prop('int', '8'), Area: prop('select', 'Design') },
    promotions: { Priority: { front: true, title: true }, Due: { front: true } },
  },
  {
    body: 'Ship dark mode\nAudit every surface for contrast and wire the theme toggle into settings.',
    props: { Status: prop('select', 'In progress'), Priority: prop('select', 'Medium'), Effort: prop('decimal', '3.5'), Area: prop('select', 'Eng') },
    promotions: { Priority: { front: true } },
  },
  {
    body: 'Fix flaky CI pipeline\nThe integration suite times out ~1 in 5 runs. Bisect the slow tests.',
    props: { Status: prop('select', 'Blocked'), Priority: prop('select', 'High'), Area: prop('select', 'Eng'), Done: prop('bool', 'no') },
    promotions: { Priority: { title: true } },
  },
  {
    body: 'Write Q3 OKRs\nDraft 3 objectives with measurable key results and circulate for feedback.',
    props: { Status: prop('select', 'Backlog'), Priority: prop('select', 'Medium'), Due: prop('date', 'Jul 1'), Area: prop('select', 'Research') },
    promotions: {},
  },
  {
    body: "Interview 5 power users\nRecruit from the beta cohort. Focus on workflows we don't support yet.",
    props: { Status: prop('select', 'Backlog'), Priority: prop('select', 'Low'), Area: prop('select', 'Research'), Estimate: prop('int', '5') },
    promotions: {},
  },
  {
    body: 'Migrate to new icon set\nReplace the 40 most-used glyphs and delete the old sprite sheet.',
    props: { Status: prop('select', 'Done'), Priority: prop('select', 'Low'), Area: prop('select', 'Design'), Done: prop('bool', 'yes') },
    promotions: { Done: { title: true } },
  },
  {
    body: 'Launch referral program\nDefine the reward tiers and the share surface. Coordinate with growth.',
    props: { Status: prop('select', 'Backlog'), Priority: prop('select', 'High'), Due: prop('date', 'Aug 15'), Area: prop('select', 'Eng') },
    promotions: { Priority: { front: true }, Due: { front: true, title: true } },
  },
  {
    body: "Refactor settings module\nIt's grown into a 2k-line file. Split by domain and add tests.",
    props: { Status: prop('select', 'In progress'), Priority: prop('select', 'Medium'), Effort: prop('decimal', '5.0'), Area: prop('select', 'Eng') },
    promotions: {},
  },
  {
    body: 'Thinking in Systems — Donella Meadows\nFoundational mental models for feedback loops.',
    props: { Shelf: prop('select', 'Reading'), Rating: prop('int', '5'), Link: prop('url', 'https://example.com/systems') },
    promotions: { Rating: { front: true, title: true } },
  },
  {
    body: 'The Design of Everyday Things — Norman\nThe classic on affordances and signifiers.',
    props: { Shelf: prop('select', 'Finished'), Rating: prop('int', '4') },
    promotions: { Rating: { title: true } },
  },
  {
    body: 'Shape Up — Basecamp\nAppetite-driven planning and the hill chart.',
    props: { Shelf: prop('select', 'To read'), Link: prop('url', 'https://basecamp.com/shapeup') },
    promotions: {},
  },
  {
    body: 'A Pattern Language — Alexander\nWhere a lot of modern design vocabulary comes from.',
    props: { Shelf: prop('select', 'Reading'), Rating: prop('int', '5') },
    promotions: { Rating: { front: true } },
  },
];

export function devSeedState(): State {
  const cards: Record<string, Card> = {};
  const base = 1_700_000_000_000;
  CARDS.forEach((spec, i) => {
    const c = makeCard(spec.body, spec.props, spec.promotions, uid('c_'), base + i);
    cards[c.id] = c;
  });

  const statusColors: Record<string, string> = {
    Backlog: '#64748b', 'In progress': '#3b82f6', Blocked: '#ef4444', Done: '#22c55e',
  };
  const priColors: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

  const boards: Board[] = [
    {
      id: uid('b_'), name: 'Product Sprint', color: '#6366f1', groupBy: 'Status',
      filter: { connector: 'AND', rules: [] }, filterOpen: false,
      columns: {
        Backlog: { color: statusColors.Backlog, order: 0 },
        'In progress': { color: statusColors['In progress'], order: 1 },
        Blocked: { color: statusColors.Blocked, order: 2 },
        Done: { color: statusColors.Done, order: 3 },
      },
      collapsed: {},
    },
    {
      id: uid('b_'), name: 'By Priority', color: '#ec4899', groupBy: 'Priority',
      filter: { connector: 'AND', rules: [{ id: uid('r_'), prop: 'Area', op: 'is', value: 'Eng' }] }, filterOpen: false,
      columns: {
        High: { color: priColors.High, order: 0 },
        Medium: { color: priColors.Medium, order: 1 },
        Low: { color: priColors.Low, order: 2 },
      },
      collapsed: {},
    },
    {
      id: uid('b_'), name: 'Reading List', color: '#14b8a6', groupBy: 'Shelf',
      filter: { connector: 'AND', rules: [] }, filterOpen: false,
      columns: {
        'To read': { color: '#f59e0b', order: 0 },
        Reading: { color: '#3b82f6', order: 1 },
        Finished: { color: '#22c55e', order: 2 },
      },
      collapsed: {},
    },
  ];
  return { cards, boards, activeBoardId: boards[0].id, version: 1 };
}
