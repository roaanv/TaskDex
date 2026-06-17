// Shell.tsx — the two-pane app layout: a resizable/collapsible Sidebar + flexible
// Board, separated by a drag-to-resize seam. When the panel is collapsed a small
// floating button reveals it again. Geometry lives in useSidebarLayout.

import { useStore } from '../store/StoreContext';
import { useTheme } from '../theme/ThemeContext';
import { FONT_UI } from '../theme/tokens';
import { evalFilter } from '../model';
import type { Board } from '../model';
import { Sidebar } from './Sidebar';
import { Board as BoardView } from './Board';
import { useSidebarLayout } from './useSidebarLayout';

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
      <BoardView />
      {collapsed && (
        <button
          className="td-icon-btn"
          onClick={toggleCollapsed}
          title="Show panel"
          aria-label="Show panel"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 34,
            height: 34,
            zIndex: 60,
            borderRadius: 9,
            border: `1px solid ${t.border}`,
            background: t.panel,
            color: t.muted,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: t.glow ? `0 0 14px -4px ${t.primary}` : '0 2px 8px -3px rgba(0,0,0,.25)',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 4.5L10 8l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M13.5 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
