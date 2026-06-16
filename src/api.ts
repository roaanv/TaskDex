// api.ts — typed wrappers around the Tauri command surface. Argument keys are
// camelCase here; Tauri maps them to the Rust commands' snake_case params.

import { invoke } from '@tauri-apps/api/core';
import type { Board, Card, ColumnConfig, FilterOp, Snapshot } from './model';

/** True when running inside the Tauri webview (backend available). */
export function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const api = {
  getSnapshot: () => invoke<Snapshot>('get_snapshot'),
  getThemePref: () => invoke<string>('get_theme_pref'),
  setThemePref: (pref: string) => invoke<void>('set_theme_pref', { pref }),

  addCard: (card: Card) => invoke<void>('add_card', { card }),
  updateCard: (id: string, patch: Partial<Card>) => invoke<void>('update_card', { id, patch }),
  deleteCard: (id: string) => invoke<void>('delete_card', { id }),
  setProp: (id: string, name: string, value: string, propType: string) =>
    invoke<void>('set_prop', { id, name, value, propType }),
  renameProp: (id: string, from: string, to: string) =>
    invoke<void>('rename_prop', { id, from, to }),
  removeProp: (id: string, name: string) => invoke<void>('remove_prop', { id, name }),
  togglePromote: (id: string, name: string, front: boolean, title: boolean) =>
    invoke<void>('toggle_promote', { id, name, front, title }),
  moveToColumn: (id: string, boardId: string, value: string) =>
    invoke<void>('move_to_column', { id, boardId, value }),
  reorderCards: (order: string[]) => invoke<void>('reorder_cards', { order }),
  setCollapsed: (boardId: string, cardId: string, value: boolean) =>
    invoke<void>('set_collapsed', { boardId, cardId, value }),

  setActive: (id: string | null) => invoke<void>('set_active', { id }),
  addBoard: (id: string, name: string, color: string) =>
    invoke<void>('add_board', { id, name, color }),
  removeBoard: (id: string) => invoke<void>('remove_board', { id }),
  updateBoard: (id: string, patch: Partial<Board>) => invoke<void>('update_board', { id, patch }),
  setColumnConfig: (boardId: string, value: string, patch: ColumnConfig) =>
    invoke<void>('set_column_config', { boardId, value, patch }),
  addColumn: (boardId: string, value: string, color: string, order: number) =>
    invoke<void>('add_column', { boardId, value, color, order }),
  reorderColumn: (boardId: string, value: string, dir: 'left' | 'right') =>
    invoke<void>('reorder_column', { boardId, value, dir }),
  renameColumn: (boardId: string, prop: string, from: string, to: string) =>
    invoke<void>('rename_column', { boardId, prop, from, to }),
};

// Re-export for callers that build rules etc.
export type { FilterOp };
