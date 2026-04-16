/**
 * Canonical theme token contract.
 *
 * Every (family, mode) variant defined in `frontend/src/index.css` and
 * `app/global.css` MUST define exactly the tokens listed in
 * `THEME_TOKEN_CONTRACT` — no missing, no extra. Enforced by the test
 * in `shared/__tests__/themeTokens.test.ts`.
 *
 * This file is the single source of truth. Adding a new token = add it
 * here first, then add it to every variant block in both stylesheets.
 *
 * The contract is grouped only for human readability; downstream
 * consumers should treat the flattened list as opaque.
 */

export const THEME_FAMILIES = ['lamplight', 'warmnight', 'forest', 'linen', 'almanac'] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Surface + ink + brand tokens — the bones of every theme. */
export const SURFACE_TOKENS = [
  'color-bg',
  'color-surface',
  'color-surface-hi',
  'color-card',
  'color-card-border',
  'color-section-bg',
  'color-section-border',
  'color-rim',
  'color-rim-hi',
  'color-grid',
  'color-dot-ring',
  'color-tab-bar',
  'color-tooltip-bg',
  'color-tooltip-border',
  'color-nav-bg',
  'color-nav-border',
  'color-hero-overlay',
  'color-hero-overlay-mid',
  'color-skeleton-from',
  'color-skeleton-to',
  'color-badge-bg',
] as const;

export const INK_TOKENS = [
  'color-ink',
  'color-ink-mid',
  'color-ink-dim',
] as const;

export const BRAND_TOKENS = [
  'color-brand',
  'color-brand-pressed',
  'color-brand-glow',
  'color-brand-on',
  'color-accent',
] as const;

/** Health palette — semantically constant across families, lightly tuned per family. */
export const HEALTH_TOKENS = [
  'color-health-jade',
  'color-health-honey',
  'color-health-coral',
  'color-health-rose',
] as const;

/** Notification/state tokens — overdue, due-today, refill (used in the inbox UI). */
export const STATE_TOKENS = [
  'color-overdue',
  'color-overdue-muted',
  'color-overdue-bg',
  'color-overdue-border',
  'color-due-today',
  'color-due-today-muted',
  'color-due-today-bg',
  'color-due-today-border',
  'color-refill',
  'color-refill-muted',
  'color-refill-bg',
  'color-refill-border',
] as const;

/**
 * Flattened canonical token list. Every variant block in every stylesheet
 * must define exactly these tokens. Order is irrelevant; presence is not.
 */
export const THEME_TOKEN_CONTRACT: readonly string[] = [
  ...SURFACE_TOKENS,
  ...INK_TOKENS,
  ...BRAND_TOKENS,
  ...HEALTH_TOKENS,
  ...STATE_TOKENS,
];

/**
 * Critical contrast pairs that every variant must satisfy at WCAG AA
 * (4.5:1 for body text, 3:1 for non-text/focus rings).
 *
 * Format: [foreground token, background token, minRatio, label]
 */
export const CRITICAL_CONTRAST_PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['color-ink', 'color-bg', 4.5, 'body text on background'],
  ['color-ink-mid', 'color-bg', 4.5, 'secondary text on background'],
  ['color-ink', 'color-surface', 4.5, 'body text on surface'],
  ['color-brand', 'color-bg', 3.0, 'brand on background (focus ring / non-text)'],
  ['color-brand-on', 'color-brand', 3.0, 'text on brand surface (large/bold text — buttons)'],
];
