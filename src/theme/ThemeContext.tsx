// ThemeContext.tsx — root-owned theme state so the WHOLE tree re-renders on any
// pref/system change. Light/Dark/Auto; Auto follows prefers-color-scheme live.
// The preference persists to the backend (set_theme_pref) with a localStorage
// paint-cache to avoid a flash before the async backend value arrives.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildTheme, FONT_UI, type Theme, type ThemeMode, type ThemePref } from './tokens';
import { api, hasTauri } from '../api';

const THEME_KEY = 'taskdex_theme';
const systemMode = (): ThemeMode =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

function readStoredPref(): ThemePref {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemePref) || 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeCtxValue {
  theme: Theme;
  pref: ThemePref;
  resolved: ThemeMode;
  setPref: (p: ThemePref) => void;
}

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readStoredPref);
  const [sys, setSys] = useState<ThemeMode>(systemMode);

  // follow the OS preference live (for Auto)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSys(systemMode());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // reconcile with the backend's stored pref once on launch (no re-persist)
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current || !hasTauri()) return;
    reconciled.current = true;
    api
      .getThemePref()
      .then((saved) => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setPrefState((cur) => {
            if (saved !== cur) {
              try {
                localStorage.setItem(THEME_KEY, saved);
              } catch {
                /* ignore */
              }
            }
            return saved;
          });
        }
      })
      .catch(() => {
        /* keep local pref */
      });
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* ignore */
    }
    if (hasTauri()) api.setThemePref(p).catch((e) => console.error('TaskDex: set_theme_pref failed', e));
  };

  const resolved: ThemeMode = pref === 'system' ? sys : pref;
  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  // keep the document background in sync (also covers areas outside #root)
  useEffect(() => {
    document.documentElement.style.background = theme.bg;
    document.body.style.background = theme.bg;
  }, [theme.bg]);

  const value = useMemo<ThemeCtxValue>(
    () => ({ theme, pref, resolved, setPref }),
    [theme, pref, resolved],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

function useThemeCtx(): ThemeCtxValue {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme must be used within a ThemeProvider');
  return v;
}

/** The resolved theme tokens + glow helpers (most components use this). */
export function useTheme(): Theme {
  return useThemeCtx().theme;
}

/** The theme preference controls (for the ThemeSwitch). */
export function useThemePref() {
  const { pref, setPref, resolved } = useThemeCtx();
  return { pref, setPref, resolved };
}

// --- segmented Light / Dark / Auto switch -----------------------------------

const ICONS: Record<ThemePref, ReactNode> = {
  light: (
    <path
      d="M8 1.7v1.6M8 12.7v1.6M1.7 8h1.6M12.7 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  ),
  dark: (
    <path
      d="M13 9.3A5.4 5.4 0 0 1 6.7 3 5.4 5.4 0 1 0 13 9.3z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  system: (
    <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="8" rx="1.3" />
      <path d="M6 13.5h4M8 11.2v2.3" strokeLinecap="round" />
    </g>
  ),
};

export function ThemeSwitch() {
  const theme = useTheme();
  const { pref, setPref } = useThemePref();
  const opts: [ThemePref, string][] = [
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['system', 'Auto'],
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 11,
        background: theme.surface,
        border: `1px solid ${theme.borderSoft}`,
      }}
    >
      {opts.map(([key, label]) => {
        const active = pref === key;
        return (
          <button
            key={key}
            onClick={() => setPref(key)}
            title={label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 8,
              padding: '7px 4px',
              background: active ? theme.primary : 'transparent',
              color: active ? '#fff' : theme.muted,
              fontFamily: FONT_UI,
              fontSize: 11.5,
              fontWeight: 600,
              boxShadow: active && theme.glow ? `0 0 12px -3px ${theme.primary}` : 'none',
              transition: 'background .15s, color .15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              {ICONS[key]}
            </svg>
            {label}
          </button>
        );
      })}
    </div>
  );
}
