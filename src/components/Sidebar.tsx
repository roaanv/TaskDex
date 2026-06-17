// Sidebar.tsx — themeable left panel: board list (activate / rename / recolor /
// delete-keeps-cards) + card count + the Light/Dark/Auto theme switch.
// Ported from sidebar.jsx. Cards are global; removing a board never deletes cards.

import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useTheme, ThemeSwitch } from '../theme/ThemeContext';
import { FONT_MONO, FONT_UI, tint } from '../theme/tokens';
import { PALETTE } from '../model';
import type { Board } from '../model';

function BoardRow({
  board,
  active,
  count,
}: {
  board: Board;
  active: boolean;
  count: number;
}) {
  const { dispatch } = useStore();
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const [palOpen, setPalOpen] = useState(false);
  useEffect(() => setName(board.name), [board.name]);

  const save = () => {
    setEditing(false);
    if (name.trim() && name !== board.name) {
      dispatch({ type: 'updateBoard', id: board.id, patch: { name: name.trim() } });
    }
  };
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Delete board “${board.name}”?\n\nCards are global and will be kept — only this board view is removed.`,
      )
    ) {
      dispatch({ type: 'removeBoard', id: board.id });
    }
  };
  const activeGlow = t.glow ? `, 0 0 16px -6px ${board.color}` : '';

  return (
    <div
      onClick={() => dispatch({ type: 'setActive', id: board.id })}
      className="td-board-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 9,
        cursor: 'pointer',
        background: active ? t.surfaceHi : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${tint(board.color, '55')}${activeGlow}` : 'none',
        position: 'relative',
      }}
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          setPalOpen((o) => !o);
        }}
        title="Board color"
        style={{
          width: 11,
          height: 11,
          borderRadius: 3,
          background: board.color,
          flex: 'none',
          cursor: 'pointer',
          boxShadow: t.glowDot(board.color),
        }}
      />
      {palOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 6,
            top: 36,
            zIndex: 50,
            background: t.panel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: 8,
            boxShadow: '0 16px 34px -14px rgba(0,0,0,.45)',
            display: 'grid',
            gridTemplateColumns: 'repeat(6,1fr)',
            gap: 6,
          }}
        >
          {PALETTE.map((c) => (
            <span
              key={c}
              onClick={() => {
                dispatch({ type: 'updateBoard', id: board.id, patch: { color: c } });
                setPalOpen(false);
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: c,
                cursor: 'pointer',
                boxShadow: board.color === c ? `0 0 0 2px ${t.panel}, 0 0 0 3.5px ${c}` : 'none',
              }}
            />
          ))}
        </div>
      )}
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setName(board.name);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            borderRadius: 6,
            padding: '3px 7px',
            fontSize: 13.5,
            fontFamily: FONT_UI,
            color: t.text,
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: active ? 600 : 500,
            color: active ? t.text : t.muted,
            fontFamily: FONT_UI,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: active ? t.softInk(board.color, 0.55) : 'none',
          }}
        >
          {board.name}
        </span>
      )}
      <span style={{ fontSize: 11, color: t.faint, fontFamily: FONT_MONO, flex: 'none' }}>{count}</span>
      <button
        className="td-board-del"
        onClick={remove}
        title="Delete board"
        style={{
          width: 22,
          height: 22,
          border: 'none',
          background: 'transparent',
          color: t.faint,
          cursor: 'pointer',
          borderRadius: 5,
          flex: 'none',
          padding: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 3.5h9M5.5 3.5V2.4c0-.5.4-.9.9-.9h1.2c.5 0 .9.4.9.9V3.5M4 3.5l.5 8c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9l.5-8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function Sidebar({
  countFor,
  width,
  onCollapse,
}: {
  countFor: (b: Board) => number;
  width: number;
  onCollapse: () => void;
}) {
  const { state, dispatch } = useStore();
  const t = useTheme();
  const logoGlow = t.glow
    ? `0 0 12px -2px ${t.primary}, inset 0 0 10px -5px ${t.primary}`
    : `0 1px 3px -1px ${t.primary}55`;

  return (
    <div
      style={{
        width,
        flex: 'none',
        height: '100%',
        background: t.panel,
        borderRight: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: tint(t.primary, '1a'),
            border: `1.5px solid ${t.primary}`,
            display: 'grid',
            placeItems: 'center',
            boxShadow: logoGlow,
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 18 18"
            fill="none"
            style={{ filter: t.glow ? `drop-shadow(0 0 3px ${t.primary})` : 'none' }}
          >
            <rect x="2" y="3.5" width="14" height="11" rx="2" stroke={t.primary} strokeWidth="1.5" />
            <path d="M2 6.5h14" stroke={t.primary} strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 17,
              color: t.text,
              letterSpacing: '-.01em',
              textShadow: t.softInk(t.primary, 0.8),
            }}
          >
            TaskDex
          </div>
          <div style={{ fontSize: 10.5, color: t.faint, fontFamily: FONT_MONO }}>
            {Object.keys(state.cards).length} cards
          </div>
        </div>
        <button
          className="td-icon-btn"
          onClick={onCollapse}
          title="Collapse panel"
          aria-label="Collapse panel"
          style={{
            marginLeft: 'auto',
            width: 26,
            height: 26,
            border: 'none',
            background: 'transparent',
            color: t.muted,
            cursor: 'pointer',
            borderRadius: 7,
            flex: 'none',
            padding: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M9.5 4.5L6 8l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M2.5 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div
        style={{
          padding: '4px 12px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '.11em',
          textTransform: 'uppercase',
          color: t.faint,
          fontFamily: FONT_UI,
        }}
      >
        Boards
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {state.boards.map((b) => (
          <BoardRow
            key={b.id}
            board={b}
            active={b.id === state.activeBoardId}
            count={countFor ? countFor(b) : 0}
          />
        ))}
      </div>
      <div
        style={{
          padding: '10px 12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          borderTop: `1px solid ${t.line}`,
        }}
      >
        <button
          onClick={() => dispatch({ type: 'addBoard' })}
          style={{
            width: '100%',
            border: `1px dashed ${t.borderSoft}`,
            background: t.surface,
            borderRadius: 9,
            padding: '10px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: t.textDim,
            fontFamily: FONT_UI,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New board
        </button>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.11em',
              textTransform: 'uppercase',
              color: t.faint,
              fontFamily: FONT_UI,
              margin: '0 2px 7px',
            }}
          >
            Theme
          </div>
          <ThemeSwitch />
        </div>
      </div>
    </div>
  );
}
