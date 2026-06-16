// Shell.tsx — the two-pane app layout: fixed 248px Sidebar + flexible Board.
// Mirrors app.jsx's <Shell>. The board pane is a placeholder until slice 4.

import { useStore } from '../store/StoreContext';
import { useTheme } from '../theme/ThemeContext';
import { FONT_UI } from '../theme/tokens';
import { evalFilter } from '../model';
import type { Board } from '../model';
import { Sidebar } from './Sidebar';
import { Board as BoardView } from './Board';

export function Shell() {
  const { state, ready } = useStore();
  const t = useTheme();
  const countFor = (b: Board) =>
    Object.values(state.cards).filter((c) => evalFilter(c, b.filter)).length;

  if (!ready) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'grid',
          placeItems: 'center',
          background: t.bg,
          color: t.muted,
          fontFamily: FONT_UI,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: t.bg,
      }}
    >
      <Sidebar countFor={countFor} />
      <BoardView />
    </div>
  );
}
