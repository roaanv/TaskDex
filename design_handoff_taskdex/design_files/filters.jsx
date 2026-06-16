/* filters.jsx — neon per-board filter panel that slides in from the top.
   Rich rules with AND/OR connector. Exports: FilterPanel. */

const UI_F = "'Space Grotesk', sans-serif";

const OP_LABEL = {
  is: "is", isnot: "is not", contains: "contains", gt: "greater than", lt: "less than",
  before: "before", after: "after", between: "between", isset: "is set", notset: "is empty",
  istrue: "is true", isfalse: "is false",
};
const NO_VALUE = ["isset", "notset", "istrue", "isfalse"];
function opsForType(type) {
  switch (type) {
    case "int": case "decimal": return ["is", "isnot", "gt", "lt", "between", "isset", "notset"];
    case "date": return ["is", "before", "after", "between", "isset", "notset"];
    case "bool": return ["istrue", "isfalse", "isset", "notset"];
    default: return ["is", "isnot", "contains", "isset", "notset"];
  }
}

const fSelect = () => ({
  appearance: "none", border: `1px solid ${NEON.border}`, borderRadius: 7, background: NEON.inputBg,
  padding: "6px 26px 6px 10px", fontSize: 12.5, color: NEON.text, fontFamily: UI_F,
  cursor: "pointer", backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5 5 6.5 8 3.5' stroke='${NEON.glow ? "%23c2abff" : "%237d768f"}' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 9px center",
});
const fInput = () => ({ border: `1px solid ${NEON.border}`, borderRadius: 7, background: NEON.inputBg, padding: "6px 10px", fontSize: 12.5, color: NEON.text, fontFamily: UI_F, width: 130 });

function RuleRow({ rule, board, registry, dispatch, connector }) {
  const propNames = Object.keys(registry);
  const reg = registry[rule.prop];
  const type = reg ? reg.type : "text";
  const ops = opsForType(type);
  const update = (patch) => {
    const rules = board.filter.rules.map((r) => (r.id === rule.id ? { ...r, ...patch } : r));
    dispatch({ type: "updateBoard", id: board.id, patch: { filter: { ...board.filter, rules } } });
  };
  const remove = () => {
    const rules = board.filter.rules.filter((r) => r.id !== rule.id);
    dispatch({ type: "updateBoard", id: board.id, patch: { filter: { ...board.filter, rules } } });
  };
  const needsValue = !NO_VALUE.includes(rule.op);
  const selectValues = (type === "select" || type === "text") && reg ? Object.keys(reg.values) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ width: 42, textAlign: "right", fontSize: 11.5, fontWeight: 600, color: NEON.muted }}>{connector}</span>
      <select value={rule.prop} onChange={(e) => { const nr = registry[e.target.value]; update({ prop: e.target.value, op: opsForType(nr ? nr.type : "text")[0], value: "" }); }} style={fSelect()}>
        {!reg && <option value={rule.prop}>{rule.prop || "property"}</option>}
        {propNames.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={rule.op} onChange={(e) => update({ op: e.target.value, value: e.target.value === "between" ? ["", ""] : "" })} style={fSelect()}>
        {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      {needsValue && rule.op === "between" && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input style={{ ...fInput(), width: 64 }} value={(rule.value || [])[0] || ""} onChange={(e) => update({ value: [e.target.value, (rule.value || [])[1] || ""] })} placeholder="min" />
          <span style={{ color: NEON.muted, fontSize: 12 }}>and</span>
          <input style={{ ...fInput(), width: 64 }} value={(rule.value || [])[1] || ""} onChange={(e) => update({ value: [(rule.value || [])[0] || "", e.target.value] })} placeholder="max" />
        </span>
      )}
      {needsValue && rule.op !== "between" && selectValues && rule.op !== "contains" && (
        <select value={rule.value} onChange={(e) => update({ value: e.target.value })} style={fSelect()}>
          <option value="">choose…</option>
          {selectValues.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
      {needsValue && rule.op !== "between" && (!selectValues || rule.op === "contains") && (
        <input style={fInput()} value={rule.value || ""} onChange={(e) => update({ value: e.target.value })}
          placeholder={type === "date" ? "e.g. Jun 22" : "value"} />
      )}
      <button onClick={remove} title="Remove rule"
        style={{ marginLeft: "auto", width: 26, height: 26, border: "none", background: "transparent", color: NEON.faint, cursor: "pointer", borderRadius: 6, fontSize: 16 }}>×</button>
    </div>
  );
}

function FilterPanel({ board, registry, dispatch, matchCount, totalCount }) {
  const open = !!board.filterOpen;
  const filter = board.filter || { connector: "AND", rules: [] };
  const propNames = Object.keys(registry);
  const addRule = () => {
    const prop = propNames[0] || "";
    const type = registry[prop] ? registry[prop].type : "text";
    const rule = { id: window.uid("r_"), prop, op: opsForType(type)[0], value: "" };
    dispatch({ type: "updateBoard", id: board.id, patch: { filter: { ...filter, rules: [...filter.rules, rule] } } });
  };
  const setConnector = (c) => dispatch({ type: "updateBoard", id: board.id, patch: { filter: { ...filter, connector: c } } });
  const clearAll = () => dispatch({ type: "updateBoard", id: board.id, patch: { filter: { ...filter, rules: [] } } });
  const close = () => dispatch({ type: "updateBoard", id: board.id, patch: { filterOpen: false } });

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 40,
      transform: open ? "translateY(0)" : "translateY(-101%)",
      transition: "transform .34s cubic-bezier(.4,.05,.15,1)",
      background: NEON.panel, borderBottom: `1px solid ${NEON.border}`,
      boxShadow: open ? "0 22px 44px -22px rgba(0,0,0,.85)" : "none",
      padding: "16px 22px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: filter.rules.length ? 14 : 4 }}>
        <span style={{ fontFamily: UI_F, fontWeight: 700, fontSize: 14, color: NEON.text, textShadow: window.softInk(NEON.primary, .6) }}>Filters</span>
        {filter.rules.length > 1 && (
          <div style={{ display: "inline-flex", border: `1px solid ${NEON.border}`, borderRadius: 8, overflow: "hidden" }}>
            {["AND", "OR"].map((c) => (
              <button key={c} onClick={() => setConnector(c)}
                style={{ border: "none", padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: UI_F,
                  background: filter.connector === c ? NEON.primary : "transparent", color: filter.connector === c ? "#fff" : NEON.muted,
                  boxShadow: filter.connector === c && NEON.glow ? `0 0 12px -3px ${NEON.primary}` : "none" }}>{c}</button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 12, color: NEON.muted, fontFamily: UI_F }}>
          {matchCount} of {totalCount} cards
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {filter.rules.length > 0 && <button onClick={clearAll} style={{ border: "none", background: "transparent", color: NEON.muted, cursor: "pointer", fontSize: 12.5, fontFamily: UI_F }}>Clear all</button>}
          <button onClick={close} style={{ border: `1px solid ${NEON.border}`, background: NEON.surface, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12.5, color: NEON.textDim, fontFamily: UI_F }}>Done</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filter.rules.map((r, i) => (
          <RuleRow key={r.id} rule={r} board={board} registry={registry} dispatch={dispatch} connector={i === 0 ? "Where" : filter.connector} />
        ))}
      </div>
      <button onClick={addRule} disabled={!propNames.length}
        style={{ marginTop: filter.rules.length ? 12 : 8, marginLeft: 50, border: `1px dashed ${NEON.borderSoft}`, background: "rgba(255,255,255,.02)", borderRadius: 8, padding: "7px 14px", cursor: propNames.length ? "pointer" : "not-allowed", fontSize: 12.5, color: NEON.textDim, fontFamily: UI_F, fontWeight: 600 }}>
        + Add filter rule
      </button>
    </div>
  );
}

Object.assign(window, { FilterPanel });
