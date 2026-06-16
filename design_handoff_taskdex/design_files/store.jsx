/* store.jsx — TaskDex data model, helpers, persistence, seed.
   Exports to window: TaskDexProvider, useStore, and pure helpers
   (detectType, parseDate, formatValue, evalFilter, PALETTE, uid, propRegistry). */

const { useReducer, useEffect, useMemo, createContext, useContext, useRef, useState, useCallback } = React;

const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);

// neon column palette — saturated hues that glow on the dark wall
const PALETTE = [
  "#ff4d6d", "#ff7a2f", "#ffc23d", "#2bff88", "#2bf0d0",
  "#27e6ff", "#3da6ff", "#7c6bff", "#9d6bff", "#ff5ec4", "#8a93a8",
];
const colorFor = (i) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/* ---------------------------------------------------------------- type detection */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(y, +m[1] - 1, +m[2]).getTime();
  }
  if ((m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/i))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo != null) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[2]).getTime();
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:[,\s]+(\d{4}))?$/i))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo != null) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[1]).getTime();
  }
  return null;
}

// returns detected type string for a raw value
function detectType(raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (!v) return "text";
  if (/^(https?:\/\/|www\.)\S+$/i.test(v)) return "url";
  if (/^(yes|no|true|false|done|y|n|✓)$/i.test(v)) return "bool";
  if (/^-?\d{1,9}$/.test(v)) return "int";
  if (/^-?\d*\.\d+$/.test(v)) return "decimal";
  if (parseDate(v) != null) return "date";
  return "text";
}

const TYPE_META = {
  text: { glyph: "T", label: "Text" },
  int: { glyph: "#", label: "Number" },
  decimal: { glyph: "#.", label: "Decimal" },
  date: { glyph: "", label: "Date" },
  bool: { glyph: "✓", label: "Yes/No" },
  select: { glyph: "≡", label: "Select" },
  url: { glyph: "↗", label: "Link" },
};

const truthy = (v) => /^(yes|true|done|y|✓)$/i.test(String(v).trim());

// human display of a stored {type, value}
function formatValue(prop) {
  if (!prop) return "";
  const { type, value } = prop;
  if (type === "date") {
    const t = parseDate(value);
    if (t == null) return value;
    const d = new Date(t);
    const cur = new Date().getFullYear();
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== cur ? " " + d.getFullYear() : ""}`;
  }
  if (type === "bool") return truthy(value) ? "Yes" : "No";
  return String(value);
}

// coerce for comparison
function coerce(prop) {
  if (!prop) return null;
  const { type, value } = prop;
  if (type === "int" || type === "decimal") return Number(value);
  if (type === "date") return parseDate(value);
  if (type === "bool") return truthy(value);
  return String(value).toLowerCase();
}

/* ---------------------------------------------------------------- filters */
// filter = { connector: 'AND'|'OR', rules: [{ id, prop, op, value }] }
// ops: is, isnot, contains, gt, lt, before, after, between, isset, notset, istrue, isfalse
function ruleMatch(card, rule) {
  const p = card.props[rule.prop];
  if (rule.op === "isset") return !!p && String(p.value).trim() !== "";
  if (rule.op === "notset") return !p || String(p.value).trim() === "";
  // a rule with no value entered yet is ignored (treated as pass)
  const noVal = ["istrue", "isfalse"].includes(rule.op);
  if (!noVal) {
    const empty = rule.op === "between"
      ? !rule.value || (!String((rule.value || [])[0]).trim() && !String((rule.value || [])[1]).trim())
      : rule.value == null || String(rule.value).trim() === "";
    if (empty) return true;
  }
  if (!p) return false;
  const cv = coerce(p);
  const num = (x) => Number(x);
  const dt = (x) => parseDate(x);
  switch (rule.op) {
    case "is": return String(p.value).toLowerCase() === String(rule.value).toLowerCase();
    case "isnot": return String(p.value).toLowerCase() !== String(rule.value).toLowerCase();
    case "contains": return String(p.value).toLowerCase().includes(String(rule.value || "").toLowerCase());
    case "gt": return num(cv) > num(rule.value);
    case "lt": return num(cv) < num(rule.value);
    case "before": return dt(p.value) < dt(rule.value);
    case "after": return dt(p.value) > dt(rule.value);
    case "between": return num(cv) >= num((rule.value || [])[0]) && num(cv) <= num((rule.value || [])[1]);
    case "istrue": return cv === true;
    case "isfalse": return cv === false;
    default: return true;
  }
}
function evalFilter(card, filter) {
  if (!filter || !filter.rules || filter.rules.length === 0) return true;
  const results = filter.rules.map((r) => ruleMatch(card, r));
  return filter.connector === "OR" ? results.some(Boolean) : results.every(Boolean);
}

/* ---------------------------------------------------------------- registry (autocomplete) */
// derive { name: { type, values:Set } } from all cards
function buildRegistry(cards) {
  const reg = {};
  Object.values(cards).forEach((c) => {
    Object.entries(c.props).forEach(([name, p]) => {
      if (!reg[name]) reg[name] = { name, type: p.type, values: {} };
      reg[name].values[String(p.value)] = (reg[name].values[String(p.value)] || 0) + 1;
    });
  });
  return reg;
}

/* ---------------------------------------------------------------- seed */
function prop(type, value) { return { type, value: String(value) }; }
function makeCard(body, props, promotions = {}) {
  return { id: uid("c_"), body, props, promotions, created: Date.now() };
}

function seed() {
  const cards = {};
  const add = (...a) => { const c = makeCard(...a); cards[c.id] = c; return c.id; };

  add("Redesign onboarding flow\nTalk to 5 users about the first run, then sketch 3 entry points and prototype the warmest one.",
    { Status: prop("select", "In progress"), Priority: prop("select", "High"), Due: prop("date", "Jun 22"), Estimate: prop("int", "8"), Area: prop("select", "Design") },
    { Priority: { front: true, title: true }, Due: { front: true } });
  add("Ship dark mode\nAudit every surface for contrast and wire the theme toggle into settings.",
    { Status: prop("select", "In progress"), Priority: prop("select", "Medium"), Effort: prop("decimal", "3.5"), Area: prop("select", "Eng") },
    { Priority: { front: true } });
  add("Fix flaky CI pipeline\nThe integration suite times out ~1 in 5 runs. Bisect the slow tests.",
    { Status: prop("select", "Blocked"), Priority: prop("select", "High"), Area: prop("select", "Eng"), Done: prop("bool", "no") },
    { Priority: { title: true } });
  add("Write Q3 OKRs\nDraft 3 objectives with measurable key results and circulate for feedback.",
    { Status: prop("select", "Backlog"), Priority: prop("select", "Medium"), Due: prop("date", "Jul 1"), Area: prop("select", "Research") }, {});
  add("Interview 5 power users\nRecruit from the beta cohort. Focus on workflows we don't support yet.",
    { Status: prop("select", "Backlog"), Priority: prop("select", "Low"), Area: prop("select", "Research"), Estimate: prop("int", "5") }, {});
  add("Migrate to new icon set\nReplace the 40 most-used glyphs and delete the old sprite sheet.",
    { Status: prop("select", "Done"), Priority: prop("select", "Low"), Area: prop("select", "Design"), Done: prop("bool", "yes") },
    { Done: { title: true } });
  add("Launch referral program\nDefine the reward tiers and the share surface. Coordinate with growth.",
    { Status: prop("select", "Backlog"), Priority: prop("select", "High"), Due: prop("date", "Aug 15"), Area: prop("select", "Eng") },
    { Priority: { front: true }, Due: { front: true, title: true } });
  add("Refactor settings module\nIt's grown into a 2k-line file. Split by domain and add tests.",
    { Status: prop("select", "In progress"), Priority: prop("select", "Medium"), Effort: prop("decimal", "5.0"), Area: prop("select", "Eng") }, {});
  // reading list cards (different property vocabulary)
  add("Thinking in Systems — Donella Meadows\nFoundational mental models for feedback loops.",
    { Shelf: prop("select", "Reading"), Rating: prop("int", "5"), Link: prop("url", "https://example.com/systems") },
    { Rating: { front: true, title: true } });
  add("The Design of Everyday Things — Norman\nThe classic on affordances and signifiers.",
    { Shelf: prop("select", "Finished"), Rating: prop("int", "4") }, { Rating: { title: true } });
  add("Shape Up — Basecamp\nAppetite-driven planning and the hill chart.",
    { Shelf: prop("select", "To read"), Link: prop("url", "https://basecamp.com/shapeup") }, {});
  add("A Pattern Language — Alexander\nWhere a lot of modern design vocabulary comes from.",
    { Shelf: prop("select", "Reading"), Rating: prop("int", "5") }, { Rating: { front: true } });

  const statusColors = { Backlog: "#64748b", "In progress": "#3b82f6", Blocked: "#ef4444", Done: "#22c55e" };
  const priColors = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };

  const boards = [
    {
      id: uid("b_"), name: "Product Sprint", color: "#6366f1", groupBy: "Status",
      filter: { connector: "AND", rules: [] }, filterOpen: false,
      columns: {
        Backlog: { color: statusColors.Backlog, order: 0 },
        "In progress": { color: statusColors["In progress"], order: 1 },
        Blocked: { color: statusColors.Blocked, order: 2 },
        Done: { color: statusColors.Done, order: 3 },
      },
      collapsed: {},
    },
    {
      id: uid("b_"), name: "By Priority", color: "#ec4899", groupBy: "Priority",
      filter: { connector: "AND", rules: [{ id: uid("r_"), prop: "Area", op: "is", value: "Eng" }] }, filterOpen: false,
      columns: {
        High: { color: priColors.High, order: 0 },
        Medium: { color: priColors.Medium, order: 1 },
        Low: { color: priColors.Low, order: 2 },
      },
      collapsed: {},
    },
    {
      id: uid("b_"), name: "Reading List", color: "#14b8a6", groupBy: "Shelf",
      filter: { connector: "AND", rules: [] }, filterOpen: false,
      columns: {
        "To read": { color: "#f59e0b", order: 0 },
        Reading: { color: "#3b82f6", order: 1 },
        Finished: { color: "#22c55e", order: 2 },
      },
      collapsed: {},
    },
  ];

  return { cards, boards, activeBoardId: boards[0].id, version: 1 };
}

/* ---------------------------------------------------------------- persistence */
const LS_KEY = "taskdex_state_v1";
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.boards && s.cards) return s; }
  } catch (e) { /* ignore */ }
  return seed();
}

/* ---------------------------------------------------------------- reducer */
function reducer(state, action) {
  const a = action;
  switch (a.type) {
    case "setActive": return { ...state, activeBoardId: a.id };

    case "addBoard": {
      const b = {
        id: uid("b_"), name: a.name || "New board", color: colorFor(state.boards.length + 3),
        groupBy: null, filter: { connector: "AND", rules: [] }, filterOpen: false, columns: {}, collapsed: {},
      };
      return { ...state, boards: [...state.boards, b], activeBoardId: b.id };
    }
    case "removeBoard": {
      const boards = state.boards.filter((b) => b.id !== a.id);
      let activeBoardId = state.activeBoardId;
      if (activeBoardId === a.id) activeBoardId = boards[0] ? boards[0].id : null;
      return { ...state, boards, activeBoardId };
    }
    case "updateBoard":
      return { ...state, boards: state.boards.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)) };

    case "addCard": {
      const c = makeCard(a.body || "Untitled\n", a.props || {}, {});
      return { ...state, cards: { ...state.cards, [c.id]: c } };
    }
    case "updateCard":
      return { ...state, cards: { ...state.cards, [a.id]: { ...state.cards[a.id], ...a.patch } } };
    case "removeCard": {
      const cards = { ...state.cards }; delete cards[a.id];
      return { ...state, cards };
    }
    case "setProp": {
      const c = state.cards[a.id]; if (!c) return state;
      const props = { ...c.props, [a.name]: { type: a.propType || detectType(a.value), value: String(a.value) } };
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props } } };
    }
    case "renameProp": {
      const c = state.cards[a.id]; if (!c || a.from === a.to || !a.to) return state;
      const props = {}; const promotions = { ...c.promotions };
      Object.entries(c.props).forEach(([k, v]) => { props[k === a.from ? a.to : k] = v; });
      if (promotions[a.from]) { promotions[a.to] = promotions[a.from]; delete promotions[a.from]; }
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props, promotions } } };
    }
    case "removeProp": {
      const c = state.cards[a.id]; if (!c) return state;
      const props = { ...c.props }; delete props[a.name];
      const promotions = { ...c.promotions }; delete promotions[a.name];
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props, promotions } } };
    }
    case "togglePromote": {
      const c = state.cards[a.id]; if (!c) return state;
      const cur = c.promotions[a.name] || {};
      const next = { ...cur, [a.where]: !cur[a.where] };
      const promotions = { ...c.promotions, [a.name]: next };
      if (!next.front && !next.title) delete promotions[a.name];
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, promotions } } };
    }
    case "moveToColumn": {
      // set the grouping prop's value to the target column value
      const c = state.cards[a.id]; if (!c) return state;
      const board = state.boards.find((b) => b.id === a.boardId);
      if (!board || !board.groupBy) return state;
      const existing = c.props[board.groupBy];
      const type = existing ? existing.type : "select";
      const props = { ...c.props, [board.groupBy]: { type, value: a.value } };
      return { ...state, cards: { ...state.cards, [a.id]: { ...c, props } } };
    }
    case "setCollapsed": {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === a.boardId ? { ...b, collapsed: { ...b.collapsed, [a.cardId]: a.value } } : b),
      };
    }
    case "reorderCards": {
      // a.order = array of card ids in new global order; we store order on cards via index
      const cards = { ...state.cards };
      a.order.forEach((id, i) => { if (cards[id]) cards[id] = { ...cards[id], ord: i }; });
      return { ...state, cards };
    }
    case "setColumnConfig": {
      return {
        ...state,
        boards: state.boards.map((b) => b.id === a.boardId
          ? { ...b, columns: { ...b.columns, [a.value]: { ...(b.columns[a.value] || {}), ...a.patch } } } : b),
      };
    }
    case "addColumn": {
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId || b.columns[a.value]) return b;
          const maxOrd = Math.max(-1, ...Object.values(b.columns).map((c) => c.order ?? 0));
          return { ...b, columns: { ...b.columns, [a.value]: { color: colorFor(Object.keys(b.columns).length + 2), order: maxOrd + 1 } } };
        }),
      };
    }
    case "reorderColumn": {
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== a.boardId) return b;
          const entries = Object.entries(b.columns).sort((x, y) => (x[1].order ?? 0) - (y[1].order ?? 0));
          const i = entries.findIndex((e) => e[0] === a.value);
          const j = i + (a.dir === "left" ? -1 : 1);
          if (i < 0 || j < 0 || j >= entries.length) return b;
          [entries[i], entries[j]] = [entries[j], entries[i]];
          const columns = {}; entries.forEach(([k, v], idx) => { columns[k] = { ...v, order: idx }; });
          return { ...b, columns };
        }),
      };
    }
    case "renameColumn": {
      // rename a grouping value across all cards (values are global), and the board column key
      const { prop, from, to } = a;
      if (!to || from === to) return state;
      const cards = { ...state.cards };
      Object.values(cards).forEach((c) => {
        if (c.props[prop] && String(c.props[prop].value) === String(from))
          cards[c.id] = { ...c, props: { ...c.props, [prop]: { ...c.props[prop], value: to } } };
      });
      const boards = state.boards.map((b) => {
        if (!b.columns[from]) return b;
        const columns = {}; Object.entries(b.columns).forEach(([k, v]) => { columns[k === from ? to : k] = v; });
        return { ...b, columns };
      });
      return { ...state, cards, boards };
    }
    case "replace": return a.state;
    default: return state;
  }
}

/* ---------------------------------------------------------------- provider */
const StoreCtx = createContext(null);

function TaskDexProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [state]);

  const registry = useMemo(() => buildRegistry(state.cards), [state.cards]);

  const value = useMemo(() => ({ state, dispatch, registry }), [state, registry]);
  return React.createElement(StoreCtx.Provider, { value }, children);
}

function useStore() { return useContext(StoreCtx); }

Object.assign(window, {
  TaskDexProvider, useStore, StoreCtx,
  detectType, parseDate, formatValue, coerce, evalFilter, buildRegistry,
  PALETTE, colorFor, uid, TYPE_META, MONTH_NAMES, truthy,
});
