/* card.jsx — Neon "Outline Tube" index card (Concept E). Flip on single-click,
   double-click to edit. Inline property detection in notes + back-of-card editor
   with autocomplete. Each card glows in its column's accent color.
   Exports: IndexCard, PromotedChips. */

const PROP_LINE = /^\s*([A-Za-z][A-Za-z0-9 _\-]*?)\s*:\s*(\S.*?)\s*$/;
const titleOf = (body) => (body || "").split("\n")[0] || "";
const notesOf = (body) => (body || "").split("\n").slice(1).join("\n");

function extractProps(text, includeLast) {
  const lines = (text || "").split("\n");
  const keep = [], found = [];
  lines.forEach((ln, i) => {
    const isLast = i === lines.length - 1;
    const m = ln.match(PROP_LINE);
    if (m && (!isLast || includeLast)) found.push({ name: m[1].trim(), value: m[2].trim() });
    else keep.push(ln);
  });
  return { remaining: keep.join("\n"), found };
}

const UI = "'Space Grotesk', sans-serif";
const MONO = "'Space Mono', monospace";

/* ---- tiny UI ---- */
function TypeGlyph({ type, accent = NEON.primary }) {
  const meta = (window.TYPE_META || {})[type] || { glyph: "T" };
  if (type === "date") {
    return (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flex: "none", filter: NEON.glow ? `drop-shadow(0 0 3px ${accent})` : "none" }}>
        <rect x="2" y="3" width="10" height="9" rx="1.6" stroke={accent} strokeWidth="1.4" />
        <path d="M2 5.6h10M4.6 2v2.4M9.4 2v2.4" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <span style={{
      flex: "none", minWidth: 16, height: 16, padding: "0 3px", borderRadius: 4,
      fontFamily: MONO, fontSize: type === "decimal" ? 8.5 : 10.5, fontWeight: 700,
      color: accent, background: NEON.surface, border: `1px solid ${window.tint(accent, "33")}`,
      display: "inline-grid", placeItems: "center", textShadow: window.softInk(accent, .6),
    }}>{meta.glyph}</span>
  );
}

function PinButton({ kind, active, onClick, accent = NEON.primary }) {
  const title = kind === "front" ? (active ? "Unpin from front" : "Pin to front") : (active ? "Unpin from title" : "Pin to collapsed title");
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title}
      style={{ width: 22, height: 18, border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "grid", placeItems: "center", borderRadius: 4 }}>
      <svg width="18" height="14" viewBox="0 0 18 14" style={{ filter: active && NEON.glow ? `drop-shadow(0 0 3px ${accent})` : "none" }}>
        <rect x="1.5" y="1.5" width="15" height="11" rx="2" fill="none" stroke={active ? accent : "rgba(180,170,200,.35)"} strokeWidth="1.3" />
        <rect x={3} y={kind === "front" ? 8.5 : 3} width="12" height="2.5" rx="1.25" fill={active ? accent : "rgba(180,170,200,.4)"} opacity={active ? 1 : .5} />
      </svg>
    </button>
  );
}

function Chevron({ collapsed, onToggle, accent = NEON.primary }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} title={collapsed ? "Expand" : "Collapse"}
      style={{ width: 24, height: 24, flex: "none", border: "none", cursor: "pointer", background: "transparent", display: "grid", placeItems: "center", padding: 0, color: NEON.glow ? NEON.primarySoft : accent, filter: NEON.glow ? `drop-shadow(0 0 3px ${accent})` : "none" }}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"
        style={{ transition: "transform .35s cubic-bezier(.4,.05,.15,1)", transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}>
        <path d="M3 5.2 7 9l4-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function FlipBtn({ onClick, accent = NEON.primary }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title="Flip card"
      style={{ width: 26, height: 24, flex: "none", border: `1px solid ${window.tint(accent, "30")}`, cursor: "pointer", background: NEON.surface, borderRadius: 7, display: "grid", placeItems: "center", padding: 0, color: NEON.glow ? NEON.primarySoft : accent, filter: NEON.glow ? `drop-shadow(0 0 3px ${accent})` : "none" }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M5.5 2.5 2.5 5.5 5.5 8.5M2.5 5.5H10a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5H6"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function EditBtn({ onClick, accent = NEON.primary }) {
  return (
    <button className="td-editbtn" onClick={(e) => { e.stopPropagation(); onClick(); }} title="Edit"
      style={{ width: 22, height: 22, flex: "none", border: `1px solid ${window.tint(accent, "26")}`, cursor: "pointer", background: NEON.surface, borderRadius: 6, display: "grid", placeItems: "center", padding: 0, color: NEON.glow ? NEON.primarySoft : accent }}>
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9.3 2.4l2.3 2.3-6.2 6.2-2.7.4.4-2.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
    </button>
  );
}

// promoted chips: front (bottom of front) & title (title bar when collapsed)
function PromotedChips({ card, where, accent = NEON.primary }) {
  const names = Object.keys(card.promotions || {}).filter((n) => card.promotions[n] && card.promotions[n][where] && card.props[n]);
  if (!names.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} onClick={(e) => e.stopPropagation()}>
      {names.map((n) => {
        const p = card.props[n];
        const isUrl = p.type === "url";
        const inner = (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, fontFamily: UI,
            background: NEON.glow ? "rgba(0,0,0,.28)" : window.tint(accent, "12"), color: NEON.text,
            border: `1px solid ${window.tint(accent, NEON.glow ? "55" : "66")}`,
            boxShadow: NEON.glow ? `0 0 10px -3px ${accent}, inset 0 0 8px -5px ${accent}` : "none",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, boxShadow: window.glowDot(accent), flex: "none" }} />
            <span style={{ opacity: .55, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".05em" }}>{n}</span>
            <span style={{ textShadow: window.softInk(accent, .55) }}>{window.formatValue(p)}</span>
          </span>
        );
        return isUrl
          ? <a key={n} href={p.value} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{inner}</a>
          : <React.Fragment key={n}>{inner}</React.Fragment>;
      })}
    </div>
  );
}

/* ---- editable property row (back) ---- */
function PropRow({ card, name, dispatch, accent }) {
  const p = card.props[name];
  const promo = card.promotions[name] || {};
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(p.value);
  useEffect(() => { setVal(p.value); }, [p.value]);
  const save = () => {
    setEditing(false);
    if (val !== p.value) {
      const type = p.type === "select" ? "select" : window.detectType(val);
      dispatch({ type: "setProp", id: card.id, name, value: val, propType: type });
    }
  };
  return (
    <div className="td-prop-row" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "5px 0", borderBottom: `1px solid ${NEON.line}` }}>
      <TypeGlyph type={p.type} accent={accent} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: NEON.muted, flex: "none", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO }}>{name}</span>
      {editing ? (
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onClick={(e) => e.stopPropagation()}
          onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(p.value); setEditing(false); } }}
          style={{ flex: 1, minWidth: 0, fontFamily: UI, fontWeight: 600, fontSize: 14, color: NEON.text, background: NEON.inputBg, border: `1px solid ${window.tint(accent, "44")}`, borderRadius: 6, padding: "3px 8px", textAlign: "right" }} />
      ) : (
        <span onClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Edit value"
          style={{ flex: 1, minWidth: 0, fontFamily: UI, fontWeight: 600, fontSize: 15, lineHeight: 1.1, color: NEON.text, whiteSpace: "nowrap", cursor: "text", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", textShadow: window.softInk(accent, .7) }}>
          {window.formatValue(p)}
        </span>
      )}
      <span className="td-prop-actions" style={{ display: "flex", alignItems: "center", gap: 1, flex: "none" }}>
        <PinButton kind="front" active={!!promo.front} accent={accent} onClick={() => dispatch({ type: "togglePromote", id: card.id, name, where: "front" })} />
        <PinButton kind="title" active={!!promo.title} accent={accent} onClick={() => dispatch({ type: "togglePromote", id: card.id, name, where: "title" })} />
        <button onClick={(e) => { e.stopPropagation(); dispatch({ type: "removeProp", id: card.id, name }); }} title="Delete property"
          style={{ width: 18, height: 18, border: "none", background: "transparent", cursor: "pointer", color: NEON.faint, padding: 0, display: "grid", placeItems: "center", fontSize: 14 }}>×</button>
      </span>
    </div>
  );
}

/* ---- add property (with autocomplete) ---- */
function AddProp({ card, dispatch, registry, accent }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const names = Object.keys(registry).filter((n) => !card.props[n]);
  const beforeColon = text.split(":")[0].trim().toLowerCase();
  const hasColon = text.includes(":");
  const nameSugg = !hasColon && beforeColon
    ? names.filter((n) => n.toLowerCase().includes(beforeColon)).slice(0, 5) : [];
  const curName = text.split(":")[0].trim();
  const valSugg = hasColon && registry[curName] && registry[curName].type === "select"
    ? Object.keys(registry[curName].values).filter((v) => v.toLowerCase().includes(text.split(":").slice(1).join(":").trim().toLowerCase())).slice(0, 6) : [];
  const commit = (raw) => {
    const m = (raw || text).match(/^\s*([^:]+?)\s*:\s*(.+?)\s*$/);
    if (!m) return;
    const name = m[1].trim(), value = m[2].trim();
    const existing = registry[name];
    const type = existing ? existing.type : window.detectType(value);
    dispatch({ type: "setProp", id: card.id, name, value, propType: type });
    setText(""); setOpen(false);
  };
  return (
    <div style={{ position: "relative", marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, background: NEON.surface, border: `1px dashed ${window.tint(accent, "44")}`, borderRadius: 8, padding: "6px 10px" }}>
        <span style={{ color: accent, fontSize: 14, fontWeight: 700, fontFamily: UI, textShadow: window.softInk(accent, .6) }}>+</span>
        <input value={text} placeholder="Add property — e.g. Age: 21"
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: UI, fontSize: 13, color: NEON.text }} />
        {text.includes(":") && <span style={{ fontSize: 9.5, color: accent, fontFamily: MONO, background: NEON.surface, padding: "1px 5px", borderRadius: 4 }}>
          {((window.TYPE_META[(registry[curName] && registry[curName].type) || window.detectType(text.split(":").slice(1).join(":"))]) || {}).label}
        </span>}
      </div>
      {open && (nameSugg.length > 0 || valSugg.length > 0) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", background: NEON.panel, border: `1px solid ${NEON.border}`, borderRadius: 8, boxShadow: "0 14px 30px -12px rgba(0,0,0,.7)", zIndex: 30, overflow: "hidden" }}>
          {nameSugg.map((n) => (
            <div key={n} onMouseDown={(e) => { e.preventDefault(); setText(n + ": "); setOpen(true); }}
              style={{ padding: "7px 11px", fontSize: 12.5, fontFamily: UI, color: NEON.textDim, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
              <TypeGlyph type={registry[n].type} accent={accent} /> {n}
              <span style={{ marginLeft: "auto", fontSize: 10, color: NEON.muted }}>existing</span>
            </div>
          ))}
          {valSugg.map((v) => (
            <div key={v} onMouseDown={(e) => { e.preventDefault(); commit(curName + ": " + v); }}
              style={{ padding: "7px 11px", fontSize: 12.5, fontFamily: UI, color: NEON.textDim, cursor: "pointer" }}>{v}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================ IndexCard */
function IndexCard({ cardId, boardId, dragProps = {}, accent = NEON.primary }) {
  const { state, dispatch, registry } = useStore();
  const card = state.cards[cardId];
  const board = state.boards.find((b) => b.id === boardId);
  const collapsed = !!(board && board.collapsed[cardId]);

  const [back, setBack] = useState(false);
  const [rotY, setRotY] = useState(0);
  const [anim, setAnim] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [draft, setDraft] = useState("");
  const busy = useRef(false);
  const clickTimer = useRef(null);

  if (!card) return null;
  const title = titleOf(card.body);
  const notes = notesOf(card.body);

  const flip = () => {
    if (busy.current || collapsed) return;
    busy.current = true;
    setAnim(true); setRotY(-90);
    setTimeout(() => {
      setBack((b) => !b); setAnim(false); setRotY(90);
      setTimeout(() => { setAnim(true); setRotY(0); setTimeout(() => { busy.current = false; }, 150); }, 28);
    }, 150);
  };

  const beginEdit = (target) => {
    clearTimeout(clickTimer.current);
    if (back) return;
    setEditTarget(target);
    setDraft(target === "title" ? title : notes);
    setEditing(true);
  };
  const saveEdit = () => {
    let body = card.body;
    if (editTarget === "title") {
      body = (draft.replace(/\n/g, " ").trim() || "Untitled") + "\n" + notes;
      dispatch({ type: "updateCard", id: cardId, patch: { body } });
    } else {
      const { remaining, found } = extractProps(draft, true);
      body = title + "\n" + remaining;
      dispatch({ type: "updateCard", id: cardId, patch: { body } });
      found.forEach((f) => {
        const ex = registry[f.name];
        dispatch({ type: "setProp", id: cardId, name: f.name, value: f.value, propType: ex ? ex.type : window.detectType(f.value) });
      });
    }
    setEditing(false); setEditTarget(null);
  };
  const onNotesChange = (v) => {
    setDraft(v);
    const { remaining, found } = extractProps(v, false);
    if (found.length) {
      setDraft(remaining);
      found.forEach((f) => {
        const ex = registry[f.name];
        dispatch({ type: "setProp", id: cardId, name: f.name, value: f.value, propType: ex ? ex.type : window.detectType(f.value) });
      });
      dispatch({ type: "updateCard", id: cardId, patch: { body: title + "\n" + remaining } });
    }
  };

  const propNames = Object.keys(card.props);

  /* ---- title bar (shared) ---- */
  const titleBar = (isBack) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "13px 12px 11px 16px",
      borderBottom: collapsed ? "none" : `1px solid ${window.tint(accent, "26")}`,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, boxShadow: window.glowDot(accent), flex: "none" }} />
      {isBack ? (
        <span style={{ fontFamily: UI, fontWeight: 600, fontSize: 13.5, letterSpacing: ".08em", flex: 1, textTransform: "uppercase", color: NEON.text, textShadow: window.softInk(accent, .8) }}>Properties</span>
      ) : editing && editTarget === "title" ? (
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onClick={(e) => e.stopPropagation()}
          onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
          style={{ flex: 1, minWidth: 0, border: `1px solid ${window.tint(accent, "55")}`, background: NEON.inputBg, borderRadius: 6, padding: "3px 8px", fontFamily: UI, fontWeight: 600, fontSize: 15.5, color: NEON.text }} />
      ) : (
        <span onDoubleClick={(e) => { e.stopPropagation(); beginEdit("title"); }} title="Double-click to rename"
          style={{ fontFamily: UI, fontWeight: 600, fontSize: 16, letterSpacing: "-.01em", flex: 1, lineHeight: 1.25, cursor: "text", color: NEON.text, textShadow: window.softInk(accent, 1),
            display: "-webkit-box", WebkitLineClamp: collapsed ? 1 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title || "Untitled"}
        </span>
      )}
      {collapsed && !isBack && <div style={{ flex: "none", maxWidth: "46%" }}><PromotedChips card={card} where="title" accent={accent} /></div>}
      {!collapsed && <FlipBtn onClick={flip} accent={accent} />}
      <Chevron collapsed={collapsed} accent={accent} onToggle={() => dispatch({ type: "setCollapsed", boardId, cardId, value: !collapsed })} />
    </div>
  );

  /* ---- front body ---- */
  const frontBody = (
    <div className="td-front" style={{ position: "relative", padding: "12px 16px 14px 22px", minHeight: 64 }}>
      <span style={{ position: "absolute", top: 4, bottom: 8, left: 14, width: 2, background: accent, borderRadius: 2, boxShadow: NEON.glow ? `0 0 8px ${accent}` : "none", opacity: NEON.glow ? .7 : .85 }} />
      {editing && editTarget === "notes" ? (
        <textarea autoFocus value={draft} onChange={(e) => onNotesChange(e.target.value)} onClick={(e) => e.stopPropagation()}
          onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Escape") saveEdit(); }}
          rows={Math.max(3, draft.split("\n").length)}
          style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: UI, fontSize: 14, lineHeight: 1.55, color: NEON.textDim }} />
      ) : (
        <p onDoubleClick={(e) => { e.stopPropagation(); beginEdit("notes"); }} title="Double-click to edit"
          style={{ margin: 0, fontFamily: UI, fontSize: 14, lineHeight: 1.55, color: notes.trim() ? NEON.textDim : NEON.faint, whiteSpace: "pre-wrap", minHeight: 24, cursor: "text" }}>
          {notes.trim() || "Double-click to add notes…"}
        </p>
      )}
      <div style={{ marginTop: 13 }}><PromotedChips card={card} where="front" accent={accent} /></div>
    </div>
  );

  /* ---- back body ---- */
  const backBody = (
    <div style={{ padding: "11px 16px 15px" }}>
      {propNames.length === 0 && <div style={{ fontFamily: UI, fontSize: 13.5, color: NEON.faint, padding: "4px 0 2px" }}>No properties yet.</div>}
      {propNames.map((n) => <PropRow key={n} card={card} name={n} dispatch={dispatch} accent={accent} />)}
      <AddProp card={card} dispatch={dispatch} registry={registry} accent={accent} />
    </div>
  );

  return (
    <div
      {...dragProps}
      className="td-card"
      draggable={dragProps.draggable && !editing}
      onDoubleClick={() => beginEdit("notes")}
      style={{ width: "100%", cursor: dragProps.draggable ? "grab" : "default", userSelect: editing ? "text" : "none" }}>
      <div style={{
        transformOrigin: "center center",
        transform: `perspective(1400px) rotateY(${rotY}deg)`,
        transition: anim ? "transform .16s cubic-bezier(.45,.05,.25,1)" : "none",
        willChange: "transform",
        borderRadius: 18, overflow: "hidden",
        background: `radial-gradient(120% 130% at 50% -20%, ${window.tint(accent, NEON.glow ? "1f" : "14")}, ${NEON.cardFill} 58%)`,
        border: `1.5px solid ${accent}`,
        boxShadow: window.tubeFrame(accent),
      }}>
        {titleBar(back)}
        <Collapse collapsed={collapsed}>
          {back ? backBody : frontBody}
        </Collapse>
      </div>
    </div>
  );
}

function Collapse({ collapsed, children }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: collapsed ? "0fr" : "1fr", transition: "grid-template-rows .4s cubic-bezier(.4,.05,.15,1)" }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

Object.assign(window, { IndexCard, PromotedChips });
