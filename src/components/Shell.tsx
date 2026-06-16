// Shell.tsx — the two-pane app layout: fixed 248px Sidebar + flexible Board.
// Mirrors app.jsx's <Shell>. The board pane is a placeholder until slice 4.

import { useStore } from '../store/StoreContext';
import { useTheme } from '../theme/ThemeContext';
import { FONT_MONO, FONT_UI } from '../theme/tokens';
import { evalFilter } from '../model';
import type { Board } from '../model';
import { Sidebar } from './Sidebar';

function PlaceholderBoard() {
  const { state } = useStore();
  const t = useTheme();
  const board = state.boards.find((b) => b.id === state.activeBoardId);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: t.wall,
        display: 'grid',
        placeItems: 'center',
        color: t.muted,
        fontFamily: FONT_UI,
      }}
    >
      {board ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: t.text,
              textShadow: t.softInk(board.color, 0.8),
            }}
          >
            {board.name}
          </div>
          <div style={{ marginTop: 8, fontFamily: FONT_MONO, fontSize: 12 }}>
            grouped by {board.groupBy ?? 'None'} · {Object.keys(state.cards).length} cards loaded
          </div>
        </div>
      ) : (
        <span>No board selected. Create one from the left.</span>
      )}
    </div>
  );
}

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
      <PlaceholderBoard />
    </div>
  );
}
