// types.ts — TaskDex data model types, ported 1:1 from the prototype's store.jsx.
// Cards live in one global pool; Boards are saved views that group + filter them.

export type PropType = 'text' | 'int' | 'decimal' | 'date' | 'bool' | 'select' | 'url';

/** A typed property value. `value` is always stored as a string. */
export interface Prop {
  type: PropType;
  value: string;
}

/** Which surfaces a promoted property chip appears on. */
export interface Promotion {
  front?: boolean;
  title?: boolean;
}

export interface Card {
  id: string; // "c_xxxxxxx"
  body: string; // line 0 = title, remaining lines = notes
  props: Record<string, Prop>;
  promotions: Record<string, Promotion>;
  created: number; // epoch ms
  ord?: number; // manual sort index (set by drag-reorder)
}

export type FilterOp =
  | 'is'
  | 'isnot'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'before'
  | 'after'
  | 'between'
  | 'isset'
  | 'notset'
  | 'istrue'
  | 'isfalse';

export interface Rule {
  id: string; // "r_xxxxxxx"
  prop: string;
  op: FilterOp;
  value: string | [string, string]; // tuple only for the 'between' op
}

export interface Filter {
  connector: 'AND' | 'OR';
  rules: Rule[];
}

/** Per-column configuration, keyed by the group value. */
export interface ColumnConfig {
  color?: string;
  order?: number;
  hidden?: boolean;
}

export interface Board {
  id: string; // "b_xxxxxxx"
  name: string;
  color: string; // hex, board accent
  groupBy: string | null; // property name to split into columns, or null = single list
  filter: Filter;
  filterOpen: boolean;
  columns: Record<string, ColumnConfig>; // keyed by the group value
  collapsed: Record<string, boolean>; // cardId → collapsed?
}

export interface State {
  cards: Record<string, Card>;
  boards: Board[];
  activeBoardId: string | null;
  version: 1;
}

/** Shape returned by the `get_snapshot` Tauri command. */
export interface Snapshot {
  cards: Record<string, Card>;
  boards: Board[];
  activeBoardId: string | null;
}

/** Derived property registry (autocomplete + filter pickers). */
export interface RegistryEntry {
  name: string;
  type: PropType;
  values: Record<string, number>;
}
export type Registry = Record<string, RegistryEntry>;
