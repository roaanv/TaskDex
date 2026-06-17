// Board.tsx — the neon board view: top bar (group-by, filter toggle, match/total,
// +Card), columns derived from the grouping property with native drag-to-set-value
// + column config, and the ungrouped masonry list. Ported from board.jsx.
//
// DnD note (the pitfall the README calls out): each card slot is a stable element
// keyed by card id (renderSlot is a plain function call, NOT an inline component),
// and the drag-dim is driven from React state cleared on dragend AND on drop — so
// the dragged node is never unmounted mid-drag and its dragend always fires.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../store/StoreContext';
import { useTheme } from '../theme/ThemeContext';
import { FONT_MONO, FONT_UI, tint, type Theme } from '../theme/tokens';
import { colorFor, evalFilter, PALETTE } from '../model';
import type { Board as BoardModel, Registry } from '../model';
import { IndexCard, TypeGlyph } from './IndexCard';
import { FilterPanel } from './FilterPanel';

interface ColView {
  value: string;
  color: string;
  hidden: boolean;
  order: number;
}

function orderedColumns(board: BoardModel, presentValues: string[]): ColView[] {
  const all = new Set<string>([...Object.keys(board.columns || {}), ...presentValues]);
  const list: ColView[] = [...all].map((value, i) => {
    const cfg = (board.columns || {})[value] || {};
    return {
      value,
      color: cfg.color || colorFor(i + 1),
      hidden: !!cfg.hidden,
      order: cfg.order ?? 1000,
    };
  });
  list.sort((a, b) => a.order - b.order || a.value.localeCompare(b.value));
  return list;
}

/* ---- shared button / menu styling ---- */
const btnStyle = (t: Theme, active: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  border: '1px solid ' + (active ? t.primary : t.borderSoft),
  background: active ? t.primary : t.surface,
  color: active ? '#fff' : t.textDim,
  borderRadius: 9,
  padding: '8px 13px',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: FONT_UI,
  fontWeight: 500,
  boxShadow: active ? (t.glow ? `0 0 14px -3px ${t.primary}` : `0 2px 8px -3px ${t.primary}`) : 'none',
});
const menuStyle = (t: Theme, w: number): CSSProperties => ({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  width: w,
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  boxShadow: '0 18px 40px -16px rgba(0,0,0,.8)',
  zIndex: 45,
  padding: 5,
  maxHeight: 320,
  overflowY: 'auto',
});

function Caret() {
  const t = useTheme();
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2 }}>
      <path d="M2 3.5 5 6.5 8 3.5" stroke={t.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function MenuItem({ active, label, onClick }: { active: boolean; label: ReactNode; onClick: () => void }) {
  const t = useTheme();
  return (
    <div
      onClick={onClick}
      className="td-menu-item"
      style={{
        padding: '8px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: FONT_UI,
        color: active ? t.text : t.textDim,
        background: active ? 'rgba(157,107,255,.16)' : 'transparent',
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </div>
  );
}

/* ---- top bar ---- */
function TopBar({
  board,
  registry,
  matchCount,
  totalCount,
  onAddCard,
}: {
  board: BoardModel;
  registry: Registry;
  matchCount: number;
  totalCount: number;
  onAddCard: () => void;
}) {
  const { dispatch } = useStore();
  const t = useTheme();
  const [groupOpen, setGroupOpen] = useState(false);
  const ruleCount = (board.filter && board.filter.rules) ? board.filter.rules.length : 0;
  const propNames = Object.keys(registry);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 22px',
        borderBottom: `1px solid ${t.border}`,
        background: t.barBg,
        backdropFilter: 'blur(10px)',
        flex: 'none',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 3,
          background: board.color,
          flex: 'none',
          boxShadow: t.glowDot(board.color),
        }}
      />
      <div
        style={{
          fontFamily: FONT_UI,
          fontWeight: 700,
          fontSize: 20,
          color: t.text,
          letterSpacing: '-.015em',
          textShadow: t.softInk(board.color, 0.8),
        }}
      >
        {board.name}
      </div>

      <div style={{ marginLeft: 14, position: 'relative' }}>
        <button onClick={() => setGroupOpen((o) => !o)} style={btnStyle(t, false)}>
          <span style={{ color: t.muted }}>Group by</span>
          <strong style={{ color: t.text, fontWeight: 700 }}>{board.groupBy || 'None'}</strong>
          <Caret />
        </button>
        {groupOpen && (
          <div onMouseLeave={() => setGroupOpen(false)} style={menuStyle(t, 220)}>
            <MenuItem
              active={!board.groupBy}
              label="None (single list)"
              onClick={() => {
                dispatch({ type: 'updateBoard', id: board.id, patch: { groupBy: null } });
                setGroupOpen(false);
              }}
            />
            {propNames.map((n) => (
              <MenuItem
                key={n}
                active={board.groupBy === n}
                onClick={() => {
                  dispatch({ type: 'updateBoard', id: board.id, patch: { groupBy: n } });
                  setGroupOpen(false);
                }}
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TypeGlyph type={registry[n].type} /> {n}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => dispatch({ type: 'updateBoard', id: board.id, patch: { filterOpen: !board.filterOpen } })}
          style={btnStyle(t, ruleCount > 0)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1.5 2.5h11l-4.2 5v4l-2.6 1.3v-5.3z"
              stroke={ruleCount ? '#fff' : t.primarySoft}
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          Filter
          {ruleCount > 0 && (
            <span style={{ background: 'rgba(255,255,255,.22)', borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
              {ruleCount}
            </span>
          )}
        </button>
        <span style={{ fontSize: 12, color: t.muted, fontFamily: FONT_MONO }}>
          {matchCount}/{totalCount}
        </span>
        <button
          onClick={onAddCard}
          style={{
            ...btnStyle(t, false),
            background: t.primary,
            color: '#fff',
            border: `1px solid ${t.primary}`,
            boxShadow: t.glow
              ? `0 0 14px -2px ${t.primary}, inset 0 0 12px -6px #fff`
              : `0 2px 10px -3px ${t.primary}`,
            textShadow: t.glow ? '0 0 6px rgba(255,255,255,.5)' : 'none',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Card
        </button>
      </div>
    </div>
  );
}

/* ---- column header ---- */
function IconBtn({
  children,
  onClick,
  title,
  dim,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  dim?: boolean;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={dim}
      style={{
        width: 22,
        height: 22,
        border: 'none',
        background: 'transparent',
        cursor: dim ? 'default' : 'pointer',
        color: dim ? 'rgba(150,140,170,.3)' : t.muted,
        borderRadius: 5,
        padding: 0,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 13 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

function ColumnHead({
  board,
  col,
  count,
  isFirst,
  isLast,
  onAdd,
}: {
  board: BoardModel;
  col: ColView;
  count: number;
  isFirst: boolean;
  isLast: boolean;
  onAdd: () => void;
}) {
  const { dispatch } = useStore();
  const t = useTheme();
  const [palOpen, setPalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.value);
  useEffect(() => setName(col.value), [col.value]);
  const saveRename = () => {
    setEditing(false);
    if (name.trim() && name !== col.value && board.groupBy) {
      dispatch({
        type: 'renameColumn',
        boardId: board.id,
        prop: board.groupBy,
        from: col.value,
        to: name.trim(),
      });
    }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 12px', position: 'relative' }}>
      <span
        onClick={() => setPalOpen((o) => !o)}
        title="Column color"
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          background: col.color,
          flex: 'none',
          cursor: 'pointer',
          boxShadow: t.glowDot(col.color),
        }}
      />
      {palOpen && (
        <div
          onMouseLeave={() => setPalOpen(false)}
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            zIndex: 46,
            background: t.panel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: 8,
            boxShadow: '0 16px 34px -14px rgba(0,0,0,.8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(6,1fr)',
            gap: 6,
          }}
        >
          {PALETTE.map((c) => (
            <span
              key={c}
              onClick={() => {
                dispatch({ type: 'setColumnConfig', boardId: board.id, value: col.value, patch: { color: c } });
                setPalOpen(false);
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: c,
                cursor: 'pointer',
                boxShadow:
                  col.color === c
                    ? `0 0 0 2px ${t.panel}, 0 0 0 3.5px ${c}, 0 0 8px ${c}`
                    : `0 0 6px -1px ${c}`,
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
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRename();
            if (e.key === 'Escape') {
              setName(col.value);
              setEditing(false);
            }
          }}
          style={{
            border: `1px solid ${tint(col.color, '55')}`,
            background: t.inputBg,
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: FONT_UI,
            color: t.text,
            width: 130,
          }}
        />
      ) : (
        <span
          onDoubleClick={() => board.groupBy && setEditing(true)}
          title={board.groupBy ? 'Double-click to rename' : ''}
          style={{
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 13.5,
            color: t.text,
            letterSpacing: '.01em',
            textShadow: t.softInk(col.color, 0.7),
          }}
        >
          {col.value || '—'}
        </span>
      )}
      <span style={{ fontSize: 11.5, color: t.muted, fontFamily: FONT_MONO }}>{count}</span>
      <div className="td-col-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconBtn dim={isFirst} title="Move left" onClick={() => dispatch({ type: 'reorderColumn', boardId: board.id, value: col.value, dir: 'left' })}>
          <path d="M7.5 3 4 6.5 7.5 10" />
        </IconBtn>
        <IconBtn dim={isLast} title="Move right" onClick={() => dispatch({ type: 'reorderColumn', boardId: board.id, value: col.value, dir: 'right' })}>
          <path d="M5 3 8.5 6.5 5 10" />
        </IconBtn>
        <IconBtn title="Hide column" onClick={() => dispatch({ type: 'setColumnConfig', boardId: board.id, value: col.value, patch: { hidden: true } })}>
          <path d="M1.5 6.5S3.5 3 6.5 3s5 3.5 5 3.5-2 3.5-5 3.5-5-3.5-5-3.5z" />
          <circle cx="6.5" cy="6.5" r="1.4" />
        </IconBtn>
        <IconBtn title="Add card here" onClick={onAdd}>
          <path d="M6.5 3v7M3 6.5h7" />
        </IconBtn>
      </div>
    </div>
  );
}

function AddColumn({ board }: { board: BoardModel }) {
  const { dispatch } = useStore();
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => {
    if (val.trim()) dispatch({ type: 'addColumn', boardId: board.id, value: val.trim() });
    setVal('');
    setAdding(false);
  };
  if (!board.groupBy) return null;
  return (
    <div style={{ width: 200, flex: 'none', paddingTop: 30 }}>
      {adding ? (
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 10 }}>
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder={`New ${board.groupBy} value`}
            style={{
              width: '100%',
              border: `1px solid ${t.border}`,
              background: t.inputBg,
              color: t.text,
              borderRadius: 7,
              padding: '6px 9px',
              fontSize: 13,
              fontFamily: FONT_UI,
              boxSizing: 'border-box',
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            width: '100%',
            border: `1px dashed ${t.borderSoft}`,
            background: 'transparent',
            borderRadius: 12,
            padding: '11px',
            cursor: 'pointer',
            color: t.muted,
            fontSize: 13,
            fontFamily: FONT_UI,
            fontWeight: 600,
          }}
        >
          + Add column
        </button>
      )}
    </div>
  );
}

/* ============================================================ Board */
export function Board() {
  const { state, dispatch, registry } = useStore();
  const t = useTheme();
  const board = state.boards.find((b) => b.id === state.activeBoardId);
  const draggedId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: string | null; beforeId: string | null } | null>(null);

  const allCards = useMemo(() => Object.values(state.cards), [state.cards]);
  const filtered = useMemo(
    () => allCards.filter((c) => evalFilter(c, board ? board.filter : null)),
    [allCards, board],
  );

  if (!board) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: t.muted, fontFamily: FONT_UI }}>
        No board selected. Create one from the left.
      </div>
    );
  }

  const sortByOrd = (a: { ord?: number; created: number }, b: { ord?: number; created: number }) =>
    (a.ord ?? a.created) - (b.ord ?? b.created);

  const grouped = !!board.groupBy;
  const groupBy = board.groupBy as string;
  let columns: ColView[] = [];
  if (grouped) {
    const present = [
      ...new Set(
        filtered
          .filter((c) => c.props[groupBy] && String(c.props[groupBy].value).trim() !== '')
          .map((c) => String(c.props[groupBy].value)),
      ),
    ];
    columns = orderedColumns(board, present);
  }
  const visibleColumns = columns.filter((c) => !c.hidden);
  const hiddenCols = grouped ? orderedColumns(board, []).filter((c) => c.hidden) : [];

  const cardsFor = (value: string) =>
    filtered.filter((c) => c.props[groupBy] && String(c.props[groupBy].value) === String(value)).sort(sortByOrd);
  const listCards = filtered.slice().sort(sortByOrd);

  const dragProps = (cardId: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', cardId);
      } catch {
        /* ignore */
      }
      draggedId.current = cardId;
      setDraggingId(cardId);
    },
    onDragEnd: () => {
      draggedId.current = null;
      setDraggingId(null);
      setDropTarget(null);
    },
  });

  const doDrop = (colValue: string | null, beforeId: string | null) => {
    const id = draggedId.current;
    if (!id) return;
    if (grouped && colValue != null) dispatch({ type: 'moveToColumn', id, boardId: board.id, value: colValue });
    const order = allCards
      .slice()
      .sort(sortByOrd)
      .map((c) => c.id)
      .filter((x) => x !== id);
    const idx = beforeId ? order.indexOf(beforeId) : order.length;
    order.splice(idx < 0 ? order.length : idx, 0, id);
    dispatch({ type: 'reorderCards', order });
    draggedId.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const addCardToColumn = (colValue: string | null) => {
    const props: Record<string, { type: import('../model').PropType; value: string }> = {};
    if (grouped && colValue != null) {
      const ex = registry[groupBy];
      props[groupBy] = { type: ex ? ex.type : 'select', value: String(colValue) };
    }
    (board.filter && board.filter.rules ? board.filter.rules : []).forEach((r) => {
      if (r.op === 'is' && r.value && !props[r.prop]) {
        props[r.prop] = {
          type: (registry[r.prop] && registry[r.prop].type) || 'text',
          value: String(r.value),
        };
      }
    });
    dispatch({ type: 'addCard', body: 'New task\n', props });
  };

  // Stable, reconciled slot (function call, not an inline component) — see file header.
  const renderSlot = (c: (typeof allCards)[number], colValue: string | null, accent: string) => (
    <div
      key={c.id}
      onDragOver={(e) => {
        if (draggedId.current) {
          e.preventDefault();
          // stop the column's onDragOver from overwriting beforeId with null,
          // so the insertion line lands above the hovered card, not the bottom.
          e.stopPropagation();
          setDropTarget({ col: colValue, beforeId: c.id });
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        doDrop(colValue, c.id);
      }}
      style={{ position: 'relative' }}
    >
      {dropTarget && dropTarget.beforeId === c.id && draggedId.current !== c.id && (
        <div
          style={{
            height: 3,
            background: board.color,
            borderRadius: 2,
            margin: '0 0 9px',
            boxShadow: t.glow ? `0 0 8px ${board.color}` : 'none',
          }}
        />
      )}
      <div style={{ opacity: draggingId === c.id ? 0.4 : 1, marginBottom: 13 }}>
        <IndexCard cardId={c.id} boardId={board.id} dragProps={dragProps(c.id)} accent={accent} />
      </div>
    </div>
  );

  const addBtnStyle: CSSProperties = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: t.muted,
    cursor: 'pointer',
    fontSize: 12.5,
    fontFamily: FONT_UI,
    fontWeight: 600,
    padding: '8px',
    borderRadius: 8,
    textAlign: 'left',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.wall }}>
      <TopBar
        board={board}
        registry={registry}
        matchCount={filtered.length}
        totalCount={allCards.length}
        onAddCard={() => addCardToColumn(grouped ? (visibleColumns[0] ? visibleColumns[0].value : null) : null)}
      />

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <FilterPanel board={board} registry={registry} matchCount={filtered.length} totalCount={allCards.length} />

        {hiddenCols.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 22px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: t.muted, fontFamily: FONT_UI }}>Hidden:</span>
            {hiddenCols.map((c) => (
              <button
                key={c.value}
                onClick={() => dispatch({ type: 'setColumnConfig', boardId: board.id, value: c.value, patch: { hidden: false } })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${tint(c.color, '44')}`,
                  background: t.surface,
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  color: t.textDim,
                  fontFamily: FONT_UI,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, boxShadow: t.glowDot(c.color) }} /> {c.value}{' '}
                <span style={{ color: t.muted }}>show</span>
              </button>
            ))}
          </div>
        )}

        {/* board surface */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px 28px' }}>
          {grouped ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minHeight: '100%' }}>
              {visibleColumns.map((col, i) => {
                const cs = cardsFor(col.value);
                return (
                  <div
                    key={col.value}
                    style={{ width: 286, flex: 'none', display: 'flex', flexDirection: 'column' }}
                    onDragOver={(e) => {
                      if (draggedId.current) {
                        e.preventDefault();
                        setDropTarget({ col: col.value, beforeId: null });
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      doDrop(col.value, null);
                    }}
                  >
                    <ColumnHead
                      board={board}
                      col={col}
                      count={cs.length}
                      isFirst={i === 0}
                      isLast={i === visibleColumns.length - 1}
                      onAdd={() => addCardToColumn(col.value)}
                    />
                    <div
                      style={{
                        background: tint(col.color, '0d'),
                        border: `1px solid ${tint(col.color, '2b')}`,
                        borderRadius: 16,
                        padding: 11,
                        minHeight: 80,
                        flex: 1,
                        boxShadow: `inset 0 1px 0 ${tint(col.color, '22')}`,
                      }}
                    >
                      {cs.map((c) => renderSlot(c, col.value, col.color))}
                      {dropTarget && dropTarget.col === col.value && dropTarget.beforeId === null && draggedId.current && (
                        <div
                          style={{
                            height: 3,
                            background: col.color,
                            borderRadius: 2,
                            margin: '2px 0',
                            boxShadow: t.glow ? `0 0 8px ${col.color}` : 'none',
                          }}
                        />
                      )}
                      <button onClick={() => addCardToColumn(col.value)} style={addBtnStyle}>
                        + Add card
                      </button>
                    </div>
                  </div>
                );
              })}
              <AddColumn board={board} />
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                if (draggedId.current) {
                  e.preventDefault();
                  setDropTarget({ col: null, beforeId: null });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                doDrop(null, null);
              }}
              style={{ columnWidth: 286, columnGap: 16, maxWidth: 1240 }}
            >
              {listCards.map((c) => (
                <div key={c.id} style={{ breakInside: 'avoid', WebkitColumnBreakInside: 'avoid' } as CSSProperties}>
                  {renderSlot(c, null, board.color)}
                </div>
              ))}
              {listCards.length === 0 && (
                <div style={{ color: t.muted, fontFamily: FONT_UI, padding: 20 }}>
                  No cards match the current filters.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
