/* board.jsx — neon board view: top bar (group-by, filter, add), columns derived
   from the grouping property, native drag-to-set-value, column config.
   Each column's cards glow in the column accent. Exports: Board. */

const UI_B = "'Space Grotesk', sans-serif";
const MONO_B = "'Space Mono', monospace";

/* ---- helpers ---- */
function orderedColumns(board, presentValues) {
  const all = new Set([...Object.keys(board.columns || {}), ...presentValues]);
  const list = [...all].map((value, i) => {
    const cfg = (board.columns || {})[value] || {};
    return { value, color: cfg.color || window.colorFor(i + 1), hidden: !!cfg.hidden, order: cfg.order ?? 1000 };
  });
  list.sort((a, b) => (a.order - b.order) || a.value.localeCompare(b.value));
  return list;
}

/* ---- top bar ---- */
function TopBar({ board, dispatch, registry, matchCount, totalCount, onAddCard }) {
  const [groupOpen, setGroupOpen] = useState(false);
  const ruleCount = (board.filter && board.filter.rules || []).length;
  const propNames = Object.keys(registry);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 22px", borderBottom: `1px solid ${NEON.border}`, background: NEON.barBg, backdropFilter: "blur(10px)", flex: "none", position: "relative", zIndex: 50 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: board.color, flex: "none", boxShadow: window.glowDot(board.color) }} />
      <div style={{ fontFamily: UI_B, fontWeight: 700, fontSize: 20, color: NEON.text, letterSpacing: "-.015em", textShadow: window.softInk(board.color, .8) }}>{board.name}</div>

      <div style={{ marginLeft: 14, position: "relative" }}>
        <button onClick={() => setGroupOpen((o) => !o)} style={btn(false)}>
          <span style={{ color: NEON.muted }}>Group by</span>
          <strong style={{ color: NEON.text, fontWeight: 700 }}>{board.groupBy || "None"}</strong>
          <Caret />
        </button>
        {groupOpen && (
          <div onMouseLeave={() => setGroupOpen(false)} style={menu(220)}>
            <MenuItem active={!board.groupBy} label="None (single list)" onClick={() => { dispatch({ type: "updateBoard", id: board.id, patch: { groupBy: null } }); setGroupOpen(false); }} />
            {propNames.map((n) => (
              <MenuItem key={n} active={board.groupBy === n} onClick={() => { dispatch({ type: "updateBoard", id: board.id, patch: { groupBy: n } }); setGroupOpen(false); }}
                label={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><TypeGlyph type={registry[n].type} /> {n}</span>} />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => dispatch({ type: "updateBoard", id: board.id, patch: { filterOpen: !board.filterOpen } })} style={btn(ruleCount > 0)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 2.5h11l-4.2 5v4l-2.6 1.3v-5.3z" stroke={ruleCount ? "#fff" : NEON.primarySoft} strokeWidth="1.3" strokeLinejoin="round" /></svg>
          Filter
          {ruleCount > 0 && <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{ruleCount}</span>}
        </button>
        <span style={{ fontSize: 12, color: NEON.muted, fontFamily: MONO_B }}>{matchCount}/{totalCount}</span>
        <button onClick={onAddCard} style={{ ...btn(false), background: NEON.primary, color: "#fff", border: `1px solid ${NEON.primary}`, boxShadow: NEON.glow ? `0 0 14px -2px ${NEON.primary}, inset 0 0 12px -6px #fff` : `0 2px 10px -3px ${NEON.primary}`, textShadow: NEON.glow ? "0 0 6px rgba(255,255,255,.5)" : "none" }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Card
        </button>
      </div>
    </div>
  );
}
const btn = (active) => ({
  display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid " + (active ? NEON.primary : NEON.borderSoft),
  background: active ? NEON.primary : NEON.surface, color: active ? "#fff" : NEON.textDim, borderRadius: 9, padding: "8px 13px",
  cursor: "pointer", fontSize: 13, fontFamily: UI_B, fontWeight: 500,
  boxShadow: active ? (NEON.glow ? `0 0 14px -3px ${NEON.primary}` : `0 2px 8px -3px ${NEON.primary}`) : "none",
});
const Caret = () => <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2 }}><path d="M2 3.5 5 6.5 8 3.5" stroke={NEON.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;
const menu = (w) => ({ position: "absolute", top: "calc(100% + 6px)", left: 0, width: w, background: NEON.panel, border: `1px solid ${NEON.border}`, borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,.8)", zIndex: 45, padding: 5, maxHeight: 320, overflowY: "auto" });
function MenuItem({ active, label, onClick }) {
  return <div onClick={onClick} className="td-menu-item" style={{ padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: UI_B, color: active ? NEON.text : NEON.textDim, background: active ? "rgba(157,107,255,.16)" : "transparent", fontWeight: active ? 600 : 500 }}>{label}</div>;
}

/* ---- column header ---- */
function ColumnHead({ board, col, count, dispatch, isFirst, isLast, onAdd }) {
  const [palOpen, setPalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.value);
  useEffect(() => setName(col.value), [col.value]);
  const saveRename = () => { setEditing(false); if (name.trim() && name !== col.value) dispatch({ type: "renameColumn", boardId: board.id, prop: board.groupBy, from: col.value, to: name.trim() }); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 12px", position: "relative" }}>
      <span onClick={() => setPalOpen((o) => !o)} title="Column color"
        style={{ width: 11, height: 11, borderRadius: 999, background: col.color, flex: "none", cursor: "pointer", boxShadow: window.glowDot(col.color) }} />
      {palOpen && (
        <div onMouseLeave={() => setPalOpen(false)} style={{ position: "absolute", top: 24, left: 0, zIndex: 46, background: NEON.panel, border: `1px solid ${NEON.border}`, borderRadius: 10, padding: 8, boxShadow: "0 16px 34px -14px rgba(0,0,0,.8)", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
          {window.PALETTE.map((c) => <span key={c} onClick={() => { dispatch({ type: "setColumnConfig", boardId: board.id, value: col.value, patch: { color: c } }); setPalOpen(false); }} style={{ width: 18, height: 18, borderRadius: 5, background: c, cursor: "pointer", boxShadow: col.color === c ? `0 0 0 2px ${NEON.panel}, 0 0 0 3.5px ${c}, 0 0 8px ${c}` : `0 0 6px -1px ${c}` }} />)}
        </div>
      )}
      {editing ? (
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={saveRename} onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setName(col.value); setEditing(false); } }}
          style={{ border: `1px solid ${window.tint(col.color, "55")}`, background: NEON.inputBg, borderRadius: 6, padding: "2px 7px", fontSize: 13, fontWeight: 700, fontFamily: UI_B, color: NEON.text, width: 130 }} />
      ) : (
        <span onDoubleClick={() => board.groupBy && setEditing(true)} title={board.groupBy ? "Double-click to rename" : ""}
          style={{ fontFamily: UI_B, fontWeight: 700, fontSize: 13.5, color: NEON.text, letterSpacing: ".01em", textShadow: window.softInk(col.color, .7) }}>{col.value || "—"}</span>
      )}
      <span style={{ fontSize: 11.5, color: NEON.muted, fontFamily: MONO_B }}>{count}</span>
      <div className="td-col-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 1 }}>
        <IconBtn dim={isFirst} title="Move left" onClick={() => dispatch({ type: "reorderColumn", boardId: board.id, value: col.value, dir: "left" })}><path d="M7.5 3 4 6.5 7.5 10" /></IconBtn>
        <IconBtn dim={isLast} title="Move right" onClick={() => dispatch({ type: "reorderColumn", boardId: board.id, value: col.value, dir: "right" })}><path d="M5 3 8.5 6.5 5 10" /></IconBtn>
        <IconBtn title="Hide column" onClick={() => dispatch({ type: "setColumnConfig", boardId: board.id, value: col.value, patch: { hidden: true } })}><path d="M1.5 6.5S3.5 3 6.5 3s5 3.5 5 3.5-2 3.5-5 3.5-5-3.5-5-3.5z" /><circle cx="6.5" cy="6.5" r="1.4" /></IconBtn>
        <IconBtn title="Add card here" onClick={onAdd}><path d="M6.5 3v7M3 6.5h7" /></IconBtn>
      </div>
    </div>
  );
}
function IconBtn({ children, onClick, title, dim }) {
  return <button onClick={onClick} title={title} disabled={dim}
    style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: dim ? "default" : "pointer", color: dim ? "rgba(150,140,170,.3)" : NEON.muted, borderRadius: 5, padding: 0, display: "grid", placeItems: "center" }}>
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </button>;
}

/* ============================================================ Board */
function Board() {
  const { state, dispatch, registry } = useStore();
  const board = state.boards.find((b) => b.id === state.activeBoardId);
  const draggedId = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const allCards = useMemo(() => Object.values(state.cards), [state.cards]);
  const filtered = useMemo(() => allCards.filter((c) => window.evalFilter(c, board && board.filter)), [allCards, board]);

  if (!board) return <div style={{ flex: 1, display: "grid", placeItems: "center", color: NEON.muted, fontFamily: UI_B }}>No board selected. Create one from the left.</div>;

  const sortByOrd = (a, b) => ((a.ord ?? a.created) - (b.ord ?? b.created));

  const grouped = !!board.groupBy;
  let columns = [];
  if (grouped) {
    const present = [...new Set(filtered.filter((c) => c.props[board.groupBy] && String(c.props[board.groupBy].value).trim() !== "").map((c) => String(c.props[board.groupBy].value)))];
    columns = orderedColumns(board, present);
  }
  const hiddenCols = grouped ? orderedColumns(board, []).filter((c) => c.hidden) : [];

  const cardsFor = (value) => filtered.filter((c) => c.props[board.groupBy] && String(c.props[board.groupBy].value) === String(value)).sort(sortByOrd);
  const listCards = filtered.slice().sort(sortByOrd);

  const dragProps = (cardId) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", cardId); } catch (x) {} draggedId.current = cardId; setDraggingId(cardId); },
    onDragEnd: () => { draggedId.current = null; setDraggingId(null); setDropTarget(null); },
  });
  const doDrop = (colValue, beforeId) => {
    const id = draggedId.current; if (!id) return;
    if (grouped && colValue != null) dispatch({ type: "moveToColumn", id, boardId: board.id, value: colValue });
    const order = allCards.slice().sort(sortByOrd).map((c) => c.id).filter((x) => x !== id);
    const idx = beforeId ? order.indexOf(beforeId) : order.length;
    order.splice(idx < 0 ? order.length : idx, 0, id);
    dispatch({ type: "reorderCards", order });
    draggedId.current = null; setDraggingId(null); setDropTarget(null);
  };

  const addCardToColumn = (colValue) => {
    const props = {};
    if (grouped && colValue != null) {
      const ex = registry[board.groupBy];
      props[board.groupBy] = { type: ex ? ex.type : "select", value: String(colValue) };
    }
    (board.filter && board.filter.rules || []).forEach((r) => {
      if (r.op === "is" && r.value && !props[r.prop]) props[r.prop] = { type: (registry[r.prop] && registry[r.prop].type) || window.detectType(r.value), value: String(r.value) };
    });
    dispatch({ type: "addCard", body: "New task\n", props });
  };

  // NOTE: render slots via a function call (not an inline <Component/>), so React
  // reconciles the same DOM nodes across the onDragOver re-renders instead of
  // unmounting them mid-drag (which would swallow the dragged node's dragend).
  const renderSlot = (c, colValue, accent) => (
    <div key={c.id}
      onDragOver={(e) => { if (draggedId.current) { e.preventDefault(); setDropTarget({ col: colValue, beforeId: c.id }); } }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); doDrop(colValue, c.id); }}
      style={{ position: "relative" }}>
      {dropTarget && dropTarget.beforeId === c.id && draggedId.current !== c.id && (
        <div style={{ height: 3, background: board.color, borderRadius: 2, margin: "0 0 9px", boxShadow: NEON.glow ? `0 0 8px ${board.color}` : "none" }} />
      )}
      <div style={{ opacity: draggingId === c.id ? .4 : 1, marginBottom: 13 }}>
        <IndexCard cardId={c.id} boardId={board.id} dragProps={dragProps(c.id)} accent={accent} />
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: NEON.wall }}>
      <TopBar board={board} dispatch={dispatch} registry={registry} matchCount={filtered.length} totalCount={allCards.length} onAddCard={() => addCardToColumn(grouped ? (columns[0] && columns[0].value) : null)} />

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <FilterPanel board={board} registry={registry} dispatch={dispatch} matchCount={filtered.length} totalCount={allCards.length} />

        {hiddenCols.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 22px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: NEON.muted, fontFamily: UI_B }}>Hidden:</span>
          {hiddenCols.map((c) => (
            <button key={c.value} onClick={() => dispatch({ type: "setColumnConfig", boardId: board.id, value: c.value, patch: { hidden: false } })}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${window.tint(c.color, "44")}`, background: NEON.surface, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, cursor: "pointer", color: NEON.textDim, fontFamily: UI_B }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, boxShadow: window.glowDot(c.color) }} /> {c.value} <span style={{ color: NEON.muted }}>show</span>
            </button>
          ))}
        </div>
        )}

        {/* board surface */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 22px 28px" }}>
        {grouped ? (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", minHeight: "100%" }}>
            {columns.map((col, i) => {
              const cs = cardsFor(col.value);
              return (
                <div key={col.value} style={{ width: 286, flex: "none", display: "flex", flexDirection: "column" }}
                  onDragOver={(e) => { if (draggedId.current) { e.preventDefault(); setDropTarget({ col: col.value, beforeId: null }); } }}
                  onDrop={(e) => { e.preventDefault(); doDrop(col.value, null); }}>
                  <ColumnHead board={board} col={col} count={cs.length} dispatch={dispatch} isFirst={i === 0} isLast={i === columns.length - 1} onAdd={() => addCardToColumn(col.value)} />
                  <div style={{ background: window.tint(col.color, "0d"), border: `1px solid ${window.tint(col.color, "2b")}`, borderRadius: 16, padding: 11, minHeight: 80, flex: 1, boxShadow: `inset 0 1px 0 ${window.tint(col.color, "22")}` }}>
                    {cs.map((c) => renderSlot(c, col.value, col.color))}
                    {dropTarget && dropTarget.col === col.value && dropTarget.beforeId === null && draggedId.current && (
                      <div style={{ height: 3, background: col.color, borderRadius: 2, margin: "2px 0", boxShadow: NEON.glow ? `0 0 8px ${col.color}` : "none" }} />
                    )}
                    <button onClick={() => addCardToColumn(col.value)} style={addBtnStyle()}>+ Add card</button>
                  </div>
                </div>
              );
            })}
            <AddColumn board={board} dispatch={dispatch} />
          </div>
        ) : (
          <div onDragOver={(e) => { if (draggedId.current) { e.preventDefault(); setDropTarget({ col: null, beforeId: null }); } }}
            onDrop={(e) => { e.preventDefault(); doDrop(null, null); }}
            style={{ columnWidth: 286, columnGap: 16, maxWidth: 1240 }}>
            {listCards.map((c) => (
              <div key={c.id} style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid" }}>
                {renderSlot(c, null, board.color)}
              </div>
            ))}
            {listCards.length === 0 && <div style={{ color: NEON.muted, fontFamily: UI_B, padding: 20 }}>No cards match the current filters.</div>}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

const addBtnStyle = () => ({ width: "100%", border: "none", background: "transparent", color: NEON.muted, cursor: "pointer", fontSize: 12.5, fontFamily: UI_B, fontWeight: 600, padding: "8px", borderRadius: 8, textAlign: "left" });

function AddColumn({ board, dispatch }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => { if (val.trim()) dispatch({ type: "addColumn", boardId: board.id, value: val.trim() }); setVal(""); setAdding(false); };
  if (!board.groupBy) return null;
  return (
    <div style={{ width: 200, flex: "none", paddingTop: 30 }}>
      {adding ? (
        <div style={{ background: NEON.panel, border: `1px solid ${NEON.border}`, borderRadius: 12, padding: 10 }}>
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setAdding(false); }}
            placeholder={`New ${board.groupBy} value`} style={{ width: "100%", border: `1px solid ${NEON.border}`, background: NEON.inputBg, color: NEON.text, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: UI_B, boxSizing: "border-box" }} />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", border: `1px dashed ${NEON.borderSoft}`, background: "transparent", borderRadius: 12, padding: "11px", cursor: "pointer", color: NEON.muted, fontSize: 13, fontFamily: UI_B, fontWeight: 600 }}>+ Add column</button>
      )}
    </div>
  );
}

Object.assign(window, { Board });
