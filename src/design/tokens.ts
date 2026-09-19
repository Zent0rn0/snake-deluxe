/**
 * The single source of truth for the visual language.
 *
 * The app renders in two worlds: React/Tailwind chrome and the Canvas 2D board.
 * Canvas cannot read CSS custom properties cheaply per frame, so the palette
 * lives here as plain data and is mirrored into `src/index.css` (`@theme`).
 * `tokens.test.ts` fails the build if the two ever drift apart.
 *
 * Design intent: a deep, low-chroma base so that the few saturated accents
 * actually mean something. Colour is used to say "reward", "danger", "you",
 * never just to decorate.
 */

/** Surface ramp — the app background through to the most raised panel. */
export const ink = {
  950: '#090812',
  900: '#10101d',
  800: '#18182a',
  700: '#222238',
  600: '#2d2d47',
  500: '#3a3a58',
} as const;

/** Text colours. `muted` is the lowest tier that still clears 4.5:1 on ink-900. */
export const text = {
  primary: '#f1f0f7',
  secondary: '#aeacc2',
  muted: '#8b89a3',
} as const;

/**
 * Accent families. Each has `soft` (tints, highlights), `base` (the colour
 * itself) and `deep` (the shadow under a chunky button, pressed states).
 */
export const accent = { soft: '#6ed49a', base: '#3bbf6b', deep: '#1e7a45' } as const;
export const reward = { soft: '#f0cd82', base: '#e3b04b', deep: '#9c6f1e' } as const;
export const danger = { soft: '#f08a94', base: '#e05260', deep: '#8f2733' } as const;
export const info = { soft: '#8bbde8', base: '#4a8fd9', deep: '#26568c' } as const;
export const special = { soft: '#b9a4e8', base: '#8b6fd4', deep: '#4e3a85' } as const;
export const neutral = { soft: '#adabc0', base: '#6f6d85', deep: '#39384e' } as const;

export const palette = { ink, text, accent, reward, danger, info, special, neutral } as const;

/** Hairlines. Kept as alpha so panels stack without muddying. */
export const line = {
  subtle: 'rgba(255,255,255,0.07)',
  base: 'rgba(255,255,255,0.11)',
  strong: 'rgba(255,255,255,0.18)',
} as const;

/** Four elevation steps replace the ad-hoc `shadow-lg` / `shadow-2xl` mix. */
export const elevation = {
  1: '0 1px 2px rgba(0,0,0,0.35)',
  2: '0 4px 14px -3px rgba(0,0,0,0.45)',
  3: '0 14px 32px -10px rgba(0,0,0,0.55)',
  4: '0 30px 64px -18px rgba(0,0,0,0.65)',
} as const;

/** Radius scale. `card` and `panel` carry intent; the rest are raw sizes. */
export const radius = {
  xs: '8px',
  sm: '12px',
  card: '18px',
  panel: '24px',
  sheet: '30px',
} as const;

/** Motion. Short enough that navigation never feels sticky on a phone. */
export const motion = {
  instant: 90,
  fast: 150,
  base: 220,
  slow: 340,
  /** Decelerating curve used for almost everything that enters. */
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

/** Spring presets for framer-motion, so screens stop inventing their own. */
export const spring = {
  soft: { type: 'spring', stiffness: 260, damping: 26 },
  snappy: { type: 'spring', stiffness: 420, damping: 30 },
  pop: { type: 'spring', stiffness: 320, damping: 16 },
} as const;

export type ToneName = 'accent' | 'reward' | 'danger' | 'info' | 'special' | 'neutral';

export const TONE: Record<ToneName, { soft: string; base: string; deep: string }> = {
  accent,
  reward,
  danger,
  info,
  special,
  neutral,
};
