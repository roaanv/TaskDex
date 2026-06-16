/* sidebar.jsx — themeable left panel: board list, create/remove, rename, recolor,
   plus the Light/Dark/Auto theme switch. Cards are global; removing a board never
   deletes cards. Exports: Sidebar. */

const UI_S = "'Space Grotesk', sans-serif";
const MONO_S = "'Space Mono', monospace";

function BoardRow({ board, active, dispatch, count }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const [palOpen, setPalOpen] = useState(false);
  useEffect(() => setName(board.name), [board.name]);
  const save = () => { setEditing(false); if (name.trim() && name !== board.name) dispatch({ type: "updateBoard", id: board.id, patch: { name: name.trim() } }); };
  const remove = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete board “${board.name}”?\n\nCards are global and will be kept — only this board view is removed.`))
      dispatch({ type: "removeBoard", id: board.id });
  };
  const activeGlow = window.NEON.glow ? `, 0 0 16px -6px ${board.color}` : "";
  return (
    <div onClick={() => dispatch({ type: "setActive", id: board.id })}
      className="td-board-row"
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, cursor: "pointer",
        background: active ? NEON.surfaceHi : "transparent",
        boxShadow: active ? `inset 0 0 0 1px ${window.tint(board.color, "55")}${activeGlow}` : "none",
        position: "relative",
      }}>
      <span onClick={(e) => { e.stopPropagation(); setPalOpen((o) => !o); }} title="Board color"
        style={{ width: 11, height: 11, borderRadius: 3, background: board.color, flex: "none", boxShadow: window.glowDot(board.color) }} />
      {palOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 6, top: 36, zIndex: 50, background: NEON.panel, border: `1px solid ${NEON.border}`, borderRadius: 10, padding: 8, boxShadow: "0 16px 34px -14px rgba(0,0,0,.45)", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
          {window.PALETTE.map((c) => (
            <span key={c} onClick={() => { dispatch({ type: "updateBoard", id: board.id, patch: { color: c } }); setPalOpen(false); }}
              style={{ width: 18, height: 18, borderRadius: 5, background: c, cursor: "pointer", boxShadow: board.color === c ? `0 0 0 2px ${NEON.panel}, 0 0 0 3.5px ${c}` : "none" }} />
          ))}
        </div>
      )}
      {editing ? (
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onClick={(e) => e.stopPropagation()}
          onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(board.name); setEditing(false); } }}
          style={{ flex: 1, minWidth: 0, border: `1px solid ${NEON.border}`, background: NEON.inputBg, borderRadius: 6, padding: "3px 7px", fontSize: 13.5, fontFamily: UI_S, color: NEON.text }} />
      ) : (
        <span onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? NEON.text : NEON.muted, fontFamily: UI_S, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: active ? window.softInk(board.color, .55) : "none" }}>
          {board.name}
        </span>
      )}
      <span style={{ fontSize: 11, color: NEON.faint, fontFamily: MONO_S, flex: "none" }}>{count}</span>
      <button className="td-board-del" onClick={remove} title="Delete board"
        style={{ width: 22, height: 22, border: "none", background: "transparent", color: NEON.faint, cursor: "pointer", borderRadius: 5, flex: "none", padding: 0, display: "grid", placeItems: "center" }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M5.5 3.5V2.4c0-.5.4-.9.9-.9h1.2c.5 0 .9.4.9.9V3.5M4 3.5l.5 8c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

function Sidebar({ countFor }) {
  const { state, dispatch } = useStore();
  const logoGlow = window.NEON.glow ? `0 0 12px -2px ${NEON.primary}, inset 0 0 10px -5px ${NEON.primary}` : `0 1px 3px -1px ${NEON.primary}55`;
  return (
    <div style={{ width: 248, flex: "none", height: "100%", background: NEON.panel, borderRight: `1px solid ${NEON.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 18px 14px", display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: window.tint(NEON.primary, "1a"), border: `1.5px solid ${NEON.primary}`, display: "grid", placeItems: "center", boxShadow: logoGlow }}>
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" style={{ filter: window.NEON.glow ? `drop-shadow(0 0 3px ${NEON.primary})` : "none" }}><rect x="2" y="3.5" width="14" height="11" rx="2" stroke={NEON.primary} strokeWidth="1.5" /><path d="M2 6.5h14" stroke={NEON.primary} strokeWidth="1.5" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: UI_S, fontWeight: 700, fontSize: 17, color: NEON.text, letterSpacing: "-.01em", textShadow: window.softInk(NEON.primary, .8) }}>TaskDex</div>
          <div style={{ fontSize: 10.5, color: NEON.faint, fontFamily: MONO_S }}>{Object.keys(state.cards).length} cards</div>
        </div>
      </div>
      <div style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: NEON.faint, fontFamily: UI_S }}>Boards</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {state.boards.map((b) => (
          <BoardRow key={b.id} board={b} active={b.id === state.activeBoardId} dispatch={dispatch} count={countFor ? countFor(b) : 0} />
        ))}
      </div>
      <div style={{ padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${NEON.line}` }}>
        <button onClick={() => dispatch({ type: "addBoard" })}
          style={{ width: "100%", border: `1px dashed ${NEON.borderSoft}`, background: NEON.surface, borderRadius: 9, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: NEON.textDim, fontFamily: UI_S, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New board
        </button>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: NEON.faint, fontFamily: UI_S, margin: "0 2px 7px" }}>Theme</div>
          <ThemeSwitch />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar });
