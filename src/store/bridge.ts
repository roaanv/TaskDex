// bridge.ts — connects the reducer to the SQLite backend. `augment` fills in the
// identity/derived fields create-actions need (so the reducer and the persisted
// command agree); `persist` maps each dispatched action to a transactional command.

import { ALL_BOARD_ID, BOARD_PROP, colorFor, detectType, uid } from '../model';
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
      const list = board?.columnsByProperty[action.property] ?? [];
      return {
        ...action,
        color: action.color ?? colorFor(list.length + 2),
        order: action.order ?? list.length, // append position for the backend
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
      if (action.id === ALL_BOARD_ID) return; // protected; backend also guards
      return api.removeBoard(action.id);
    case 'reorderBoards':
      return api.reorderBoards(action.order);
    case 'updateBoard': {
      await api.updateBoard(action.id, action.patch);
      const prevBoard = prev.boards.find((b) => b.id === action.id);
      const newName = action.patch.name;
      if (prevBoard && typeof newName === 'string' && newName !== prevBoard.name && action.id !== ALL_BOARD_ID) {
        await api.renameColumn(BOARD_PROP, prevBoard.name, newName);
      }
      return;
    }
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
      return api.setColumnConfig(action.boardId, action.property, action.value, action.patch);
    case 'addColumn':
      return api.addColumn(
        action.boardId,
        action.property,
        action.value,
        action.color as string,
        action.order as number,
      );
    case 'reorderColumn':
      return api.reorderColumn(action.boardId, action.property, action.value, action.dir);
    case 'reorderColumns':
      return api.reorderColumns(action.boardId, action.property, action.order);
    case 'renameColumn':
      return api.renameColumn(action.prop, action.from, action.to);
    case 'removeColumn':
      return api.removeColumn(action.boardId, action.property, action.value);
    case 'replace':
      return; // snapshot replace is not persisted incrementally
    default:
      return;
  }
}
