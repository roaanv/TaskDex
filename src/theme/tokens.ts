// tokens.ts — the two "Outline Tube" design-token palettes + glow helpers,
// ported verbatim from neon-theme.jsx. The prototype mutated a global NEON
// object in place; here a resolved Theme object (tokens + glow helpers bound to
// the active `glow` flag) is provided through React context instead.

export type ThemeMode = 'dark' | 'light';
export type ThemePref = 'dark' | 'light' | 'system';

export interface ThemeTokens {
  mode: ThemeMode;
  glow: boolean;
  wall: string;
  bg: string;
  panel: string;
  barBg: string;
  surface: string;
  surfaceHi: string;
  inputBg: string;
  cardFill: string;
  primary: string;
  primarySoft: string;
  text: string;
  textDim: string;
  muted: string;
  faint: string;
  line: string;
  border: string;
  borderSoft: string;
}

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  dark: {
    mode: 'dark',
    glow: true,
    wall: 'radial-gradient(135% 105% at 50% -12%, #17111f 0%, #0b0810 52%, #070509 100%)',
    bg: '#0a0810',
    panel: '#0d0b15',
    barBg: 'rgba(11,9,17,.94)',
    surface: 'rgba(255,255,255,.04)',
    surfaceHi: 'rgba(255,255,255,.06)',
    inputBg: 'rgba(255,255,255,.06)',
    cardFill: 'rgba(12,10,20,.94)',
    primary: '#9d6bff',
    primarySoft: '#c2abff',
    text: '#f2ecff',
    textDim: '#cdc4e0',
    muted: '#938aab',
    faint: '#6c6584',
    line: 'rgba(157,107,255,.16)',
    border: 'rgba(157,107,255,.30)',
    borderSoft: 'rgba(157,107,255,.20)',
  },
  light: {
    mode: 'light',
    glow: false,
    wall: 'linear-gradient(180deg,#f7f6fc 0%,#eef0f6 100%)',
    bg: '#f1f0f7',
    panel: '#ffffff',
    barBg: 'rgba(255,255,255,.9)',
    surface: 'rgba(40,28,80,.04)',
    surfaceHi: 'rgba(40,28,80,.06)',
    inputBg: '#ffffff',
    cardFill: '#ffffff',
    primary: '#7c4dff',
    primarySoft: '#6b3fe0',
    text: '#1d1727',
    textDim: '#4c4660',
    muted: '#7d768f',
    faint: '#a39db2',
    line: 'rgba(40,28,80,.10)',
    border: 'rgba(124,77,255,.32)',
    borderSoft: 'rgba(124,77,255,.18)',
  },
};

/** Append a 2-digit hex alpha to a 6-digit hex color (column tints). Pure. */
export const tint = (c: string, a: string): string =>
  typeof c === 'string' && c[0] === '#' && c.length === 7 ? c + a : c;

/** A resolved theme: tokens + glow helpers bound to this theme's `glow` flag. */
export interface Theme extends ThemeTokens {
  /** text shadow: hot-white core + colored bloom (lit glass). */
  tube: (c: string, s?: number) => string;
  /** softer colored text glow. */
  softInk: (c: string, s?: number) => string;
  /** box bloom an object throws on the wall (soft neutral drop shadow in light). */
  bloom: (c: string, k?: number) => string;
  /** the continuous-tube card frame shadow (soft drop shadow in light). */
  tubeFrame: (c: string) => string;
  /** dot halo (faint ring in light). */
  glowDot: (c: string) => string;
}

/** Build a resolved Theme for a given mode. */
export function buildTheme(mode: ThemeMode): Theme {
  const t = THEMES[mode];
  const glow = t.glow;
  return {
    ...t,
    tube: (c, s = 1) =>
      glow
        ? `0 0 ${1.5 * s}px #fff, 0 0 ${4 * s}px #fff, 0 0 ${9 * s}px ${c}, 0 0 ${18 * s}px ${c}, 0 0 ${32 * s}px ${c}`
        : 'none',
    softInk: (c, s = 1) => (glow ? `0 0 ${5 * s}px ${c}, 0 0 ${12 * s}px ${c}` : 'none'),
    bloom: (c, k = 1) =>
      glow
        ? `0 0 1px ${c}, 0 0 ${13 * k}px -2px ${c}, 0 0 ${38 * k}px -10px ${c}, 0 22px 44px -24px rgba(0,0,0,.85)`
        : `0 1px 2px rgba(30,20,70,.05), 0 12px 26px -16px rgba(40,28,80,.22)`,
    tubeFrame: (c) =>
      glow
        ? `0 0 0 1px ${c}, 0 0 12px -1px ${c}, 0 0 28px -6px ${c}, inset 0 0 20px -8px ${c}, 0 24px 46px -24px rgba(0,0,0,.85)`
        : `0 1px 2px rgba(30,20,70,.04), 0 10px 22px -14px rgba(40,28,80,.20)`,
    glowDot: (c) => (glow ? `0 0 7px 1px ${c}` : `0 0 0 3px ${c}1f`),
  };
}

export const FONT_UI = "'Space Grotesk', sans-serif";
export const FONT_MONO = "'Space Mono', monospace";
