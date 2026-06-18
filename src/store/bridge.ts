// bridge.ts — connects the reducer to the SQLite backend. `augment` fills in the
// identity/derived fields create-actions need (so the reducer and the persisted
// command agree); `persist` maps each dispatched action to a transactional command.

import { colorFor, detectType, uid } from '../model';
import type { Action, Card, State } from '../model';
import { api, hasTauri } from '../api';

/** Inject generated ids / derived fields so the reducer is a pure fn of inputs. */
export function augment(action: Action, state: State): Action {
  switch (action.type) {
    case 'addBoard':
      return {
        ...action,
        id: action.id ?? uid('b_'),
        color: action.color ?? colorFor(state.boards.length + 3),
      };
    case 'addCard':
      return {
        ...action,
        id: action.id ?? uid('c_'),
        created: action.created ?? Date.now(),
      };
    case 'addColumn': {
      const board = state.boards.find((b) => b.id === action.boardId);
      const cols = board ? board.columns : {};
      const maxOrd = Math.max(-1, ...Object.values(cols).map((c) => c.order ?? 0));
      return {
        ...action,
        color: action.color ?? colorFor(Object.keys(cols).length + 2),
        order: action.order ?? maxOrd + 1,
      };
    }
    default:
      return action;
  }
}

/** Persist a (already augmented) action via the matching Tauri command. */
export async function persist(action: Action, prev: State): Promise<void> {
  if (!hasTauri()) return;
  switch (action.type) {
    case 'setActive':
      return api.setActive(action.id);
    case 'addBoard':
      return api.addBoard(action.id as string, action.name ?? 'New board', action.color as string);
    case 'removeBoard':
      return api.removeBoard(action.id);
    case 'reorderBoards':
      return api.reorderBoards(action.order);
    case 'updateBoard':
      return api.updateBoard(action.id, action.patch);
    case 'addCard': {
      const card: Card = {
        id: action.id as string,
        body: action.body ?? 'Untitled\n',
        props: action.props ?? {},
        promotions: {},
        created: action.created as number,
      };
      return api.addCard(card);
    }
    case 'updateCard':
      return api.updateCard(action.id, action.patch);
    case 'removeCard':
      return api.deleteCard(action.id);
    case 'setProp':
      return api.setProp(
        action.id,
        action.name,
        String(action.value),
        action.propType ?? detectType(action.value),
      );
    case 'renameProp':
      return api.renameProp(action.id, action.from, action.to);
    case 'removeProp':
      return api.removeProp(action.id, action.name);
    case 'togglePromote': {
      const cur = prev.cards[action.id]?.promotions[action.name] ?? {};
      const front = action.where === 'front' ? !cur.front : !!cur.front;
      const title = action.where === 'title' ? !cur.title : !!cur.title;
      return api.togglePromote(action.id, action.name, front, title);
    }
    case 'moveToColumn':
      return api.moveToColumn(action.id, action.boardId, action.value);
    case 'reorderCards':
      return api.reorderCards(action.order);
    case 'setCollapsed':
      return api.setCollapsed(action.boardId, action.cardId, action.value);
    case 'setColumnConfig':
      return api.setColumnConfig(action.boardId, action.value, action.patch);
    case 'addColumn':
      return api.addColumn(action.boardId, action.value, action.color as string, action.order as number);
    case 'reorderColumn':
      return api.reorderColumn(action.boardId, action.value, action.dir);
    case 'renameColumn':
      return api.renameColumn(action.boardId, action.prop, action.from, action.to);
    case 'replace':
      return; // snapshot replace is not persisted incrementally
    default:
      return;
  }
}
