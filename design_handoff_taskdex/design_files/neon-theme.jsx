/* neon-theme.jsx — themeable "Outline Tube" tokens + glow helpers + theme controller.
   Two themes: dark (lit neon) and light (clean colored-outline). `window.NEON`
   is a LIVE token object that ThemeProvider swaps in place, so every file that
   reads NEON.* re-renders into the active theme. System mode follows the OS.
   Loaded first; exports NEON, glow fns, ThemeProvider, useTheme, ThemeSwitch. */

const THEMES = {
  dark: {
    mode: "dark", glow: true,
    wall: "radial-gradient(135% 105% at 50% -12%, #17111f 0%, #0b0810 52%, #070509 100%)",
    bg: "#0a0810",
    panel: "#0d0b15",
    barBg: "rgba(11,9,17,.94)",
    surface: "rgba(255,255,255,.04)",
    surfaceHi: "rgba(255,255,255,.06)",
    inputBg: "rgba(255,255,255,.06)",
    cardFill: "rgba(12,10,20,.94)",
    primary: "#9d6bff",
    primarySoft: "#c2abff",
    text: "#f2ecff",
    textDim: "#cdc4e0",
    muted: "#938aab",
    faint: "#6c6584",
    line: "rgba(157,107,255,.16)",
    border: "rgba(157,107,255,.30)",
    borderSoft: "rgba(157,107,255,.20)",
  },
  light: {
    mode: "light", glow: false,
    wall: "linear-gradient(180deg,#f7f6fc 0%,#eef0f6 100%)",
    bg: "#f1f0f7",
    panel: "#ffffff",
    barBg: "rgba(255,255,255,.9)",
    surface: "rgba(40,28,80,.04)",
    surfaceHi: "rgba(40,28,80,.06)",
    inputBg: "#ffffff",
    cardFill: "#ffffff",
    primary: "#7c4dff",
    primarySoft: "#6b3fe0",
    text: "#1d1727",
    textDim: "#4c4660",
    muted: "#7d768f",
    faint: "#a39db2",
    line: "rgba(40,28,80,.10)",
    border: "rgba(124,77,255,.32)",
    borderSoft: "rgba(124,77,255,.18)",
  },
};

// live token object — mutated in place so cached `NEON` references stay valid
const NEON = Object.assign({}, THEMES.dark);
function applyTheme(mode) {
  const t = THEMES[mode] || THEMES.dark;
  Object.keys(NEON).forEach((k) => { delete NEON[k]; });
  Object.assign(NEON, t);
}

/* glow helpers — go flat when the active theme has glow:false (light) */
const tube = (c, s = 1) => NEON.glow
  ? `0 0 ${1.5 * s}px #fff, 0 0 ${4 * s}px #fff, 0 0 ${9 * s}px ${c}, 0 0 ${18 * s}px ${c}, 0 0 ${32 * s}px ${c}`
  : "none";
const softInk = (c, s = 1) => NEON.glow ? `0 0 ${5 * s}px ${c}, 0 0 ${12 * s}px ${c}` : "none";
const bloom = (c, k = 1) => NEON.glow
  ? `0 0 1px ${c}, 0 0 ${13 * k}px -2px ${c}, 0 0 ${38 * k}px -10px ${c}, 0 22px 44px -24px rgba(0,0,0,.85)`
  : `0 1px 2px rgba(30,20,70,.05), 0 12px 26px -16px rgba(40,28,80,.22)`;
const tubeFrame = (c) => NEON.glow
  ? `0 0 0 1px ${c}, 0 0 12px -1px ${c}, 0 0 28px -6px ${c}, inset 0 0 20px -8px ${c}, 0 24px 46px -24px rgba(0,0,0,.85)`
  : `0 1px 2px rgba(30,20,70,.04), 0 10px 22px -14px rgba(40,28,80,.20)`;
const glowDot = (c) => NEON.glow ? `0 0 7px 1px ${c}` : `0 0 0 3px ${c}1f`;
const tint = (c, a) => (typeof c === "string" && c[0] === "#" && c.length === 7 ? c + a : c);

/* ------------------------------------------------------------------ controller */
const ThemeCtx = React.createContext(null);
const THEME_KEY = "taskdex_theme";
const systemMode = () => (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function ThemeProvider({ children }) {
  const [pref, setPref] = React.useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; }
  });
  const [sys, setSys] = React.useState(systemMode);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setSys(systemMode());
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);

  const resolved = pref === "system" ? sys : pref;
  applyTheme(resolved); // runs during render, before children read NEON

  React.useEffect(() => { try { localStorage.setItem(THEME_KEY, pref); } catch (e) {} }, [pref]);
  React.useEffect(() => { document.body.style.background = THEMES[resolved].bg; }, [resolved]);

  const value = React.useMemo(() => ({ pref, setPref, resolved }), [pref, resolved]);
  return React.createElement(ThemeCtx.Provider, { value }, children);
}
function useTheme() { return React.useContext(ThemeCtx); }

/* Root theme state — own this at <App> so the WHOLE tree re-creates on any
   pref/system change (applyTheme runs in render, before children read NEON). */
function useThemeState() {
  const [pref, setPref] = React.useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; }
  });
  const [sys, setSys] = React.useState(systemMode);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setSys(systemMode());
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);
  const resolved = pref === "system" ? sys : pref;
  applyTheme(resolved);
  React.useEffect(() => { try { localStorage.setItem(THEME_KEY, pref); } catch (e) {} }, [pref]);
  React.useEffect(() => { document.body.style.background = THEMES[resolved].bg; }, [resolved]);
  return React.useMemo(() => ({ pref, setPref, resolved }), [pref, resolved]);
}

/* ------------------------------------------------------------------ switch UI */
const ICONS = {
  light: <path d="M8 1.7v1.6M8 12.7v1.6M1.7 8h1.6M12.7 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />,
  dark: <path d="M13 9.3A5.4 5.4 0 0 1 6.7 3 5.4 5.4 0 1 0 13 9.3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />,
  system: <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"><rect x="2" y="3" width="12" height="8" rx="1.3" /><path d="M6 13.5h4M8 11.2v2.3" strokeLinecap="round" /></g>,
};

function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  const opts = [["light", "Light"], ["dark", "Dark"], ["system", "Auto"]];
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: NEON.surface, border: `1px solid ${NEON.borderSoft}` }}>
      {opts.map(([key, label]) => {
        const active = pref === key;
        return (
          <button key={key} onClick={() => setPref(key)} title={label}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              border: "none", cursor: "pointer", borderRadius: 8, padding: "7px 4px",
              background: active ? NEON.primary : "transparent",
              color: active ? "#fff" : NEON.muted,
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 11.5, fontWeight: 600,
              boxShadow: active && NEON.glow ? `0 0 12px -3px ${NEON.primary}` : "none",
              transition: "background .15s, color .15s",
            }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">{ICONS[key]}</svg>
            {label}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { NEON, THEMES, applyTheme, tube, softInk, bloom, tubeFrame, glowDot, tint, ThemeProvider, useTheme, useThemeState, ThemeCtx, ThemeSwitch });
