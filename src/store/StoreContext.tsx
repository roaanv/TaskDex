// StoreContext.tsx — the data store. Holds the reducer state (hydrated from the
// SQLite snapshot on launch), exposes an augmented dispatch that also persists
// each mutation to the backend, and memoizes the derived property registry.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildRegistry, reducer } from '../model';
import type { Action, Registry, State } from '../model';
import { api, hasTauri } from '../api';
import { augment, persist } from './bridge';

const EMPTY: State = { cards: {}, boards: [], activeBoardId: null, version: 1 };

interface StoreValue {
  state: State;
  dispatch: (action: Action) => void;
  registry: Registry;
  ready: boolean;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, EMPTY);
  const [ready, setReady] = useState(false);

  // keep a live ref so the dispatch closure reads pre-mutation state
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    if (!hasTauri()) {
      console.warn('TaskDex: not running inside Tauri — persistence is disabled.');
      setReady(true);
      return;
    }
    api
      .getSnapshot()
      .then((snap) => {
        if (!alive) return;
        rawDispatch({ type: 'replace', state: { ...snap, version: 1 } });
        setReady(true);
      })
      .catch((e) => {
        console.error('TaskDex: failed to load snapshot', e);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dispatch = useCallback((action: Action) => {
    const prev = stateRef.current;
    const aug = augment(action, prev);
    rawDispatch(aug);
    persist(aug, prev).catch((e) => console.error('TaskDex: persist failed:', action.type, e));
  }, []);

  const registry = useMemo(() => buildRegistry(state.cards), [state.cards]);
  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, registry, ready }),
    [state, dispatch, registry, ready],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore must be used within a StoreProvider');
  return v;
}
