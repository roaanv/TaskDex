// Shell.tsx — the two-pane app layout: a resizable/collapsible Sidebar + flexible
// Board, separated by a drag-to-resize seam. When the panel is collapsed it shrinks
// to a thin rail with a vertical "Boards" label that reveals it again on click.
// Geometry lives in useSidebarLayout.

import { useStore } from '../store/StoreContext';
import { useTheme } from '../theme/ThemeContext';
import { FONT_UI } from '../theme/tokens';
import { evalFilter } from '../model';
import type { Board } from '../model';
import { Sidebar } from './Sidebar';
import { Board as BoardView } from './Board';
import { useSidebarLayout } from './useSidebarLayout';

/**
 * The collapsed presentation of the left panel: a thin full-height rail showing
 * the word "Boards" written vertically, with the reveal arrow sitting next to the
 * leading "B". The whole rail is one large click target that re-expands the panel.
 */
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  const t = useTheme();
  return (
    <button
      className="td-collapsed-rail"
      onClick={onExpand}
      title="Show boards panel"
      aria-label="Show boards panel"
      style={{
        flex: 'none',
        width: 40,
        height: '100%',
        background: t.panel,
        border: 'none',
        borderRight: `1px solid ${t.border}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '18px 0',
        color: t.muted,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flex: 'none' }}>
        <path
          d="M6.5 4.5L10 8l-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.5 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        style={{
          writingMode: 'vertical-rl',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          fontFamily: FONT_UI,
          color: t.faint,
          userSelect: 'none',
        }}
      >
        Boards
      </span>
    </button>
  );
}

export function Shell() {
  const { state, ready } = useStore();
  const t = useTheme();
  const { width, collapsed, resizing, toggleCollapsed, startResize } = useSidebarLayout();
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
        position: 'relative',
      }}
    >
      {!collapsed && (
        <>
          <Sidebar countFor={countFor} width={width} onCollapse={toggleCollapsed} />
          <div
            className="td-resize"
            data-resizing={resizing}
            onPointerDown={startResize}
            onDoubleClick={toggleCollapsed}
            title="Drag to resize · double-click to collapse"
            role="separator"
            aria-orientation="vertical"
            style={{
              flex: 'none',
              width: 6,
              height: '100%',
              marginLeft: -3,
              cursor: 'col-resize',
              background: 'transparent',
              zIndex: 5,
            }}
          />
        </>
      )}
      {collapsed && <CollapsedRail onExpand={toggleCollapsed} />}
      <BoardView />
    </div>
  );
}
