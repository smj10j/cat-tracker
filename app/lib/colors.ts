/**
 * Theme color palette for inline `style={{ }}` use in React Native.
 *
 * NativeWind classes (`bg-night`, `text-ink`, etc.) auto-resolve via CSS
 * variables in `global.css` — that path is preferred. This file exists
 * only because RN inline styles can't read CSS vars directly.
 *
 * **Do not import `palette` directly into components.** Use the
 * `useThemeColors()` hook — it returns the right palette for the active
 * theme without the component having to know about mode.
 *
 * Phase 0 (PRD-visual-identity-v2): single active family, brand + health +
 * state tokens populated per mode. Phase 1 expands to 5 families; the
 * shape of `palette[mode]` does not change.
 */

export const palette = {
  dark: {
    // Surface — `night` is the legacy field name; kept for backward compat.
    night: '#16111f',
    bg: '#16111f',
    surface: '#1f1830',
    surfaceHi: '#2a2040',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.07)',
    rim: 'rgba(255,255,255,0.07)',
    rimHi: 'rgba(255,255,255,0.12)',
    grid: 'rgba(255,255,255,0.04)',
    badgeBg: 'rgba(255,255,255,0.06)',

    // Ink
    ink: '#ede9f6',
    inkMid: '#a899c0',
    inkDim: '#6b5f85',

    // Brand (cool-purple today; Phase 1 swaps to Lamplight amber)
    brand: '#c084fc',
    brandPressed: '#a855f7',
    brandGlow: 'rgba(192,132,252,0.18)',
    brandOn: '#ffffff',
    accent: '#fb923c',
    // Legacy aliases — `lavender` ≡ brand, `amber` ≡ accent. Kept so the
    // ~80 existing `colors.lavender` / `colors.amber` call sites stay
    // valid; they now correctly shift per theme instead of being constants.
    lavender: '#c084fc',
    amber: '#fb923c',

    // Health palette (semantic — same role across families)
    jade: '#4ade80',
    honey: '#fbbf24',
    coral: '#f97316',
    rose: '#f87171',

    // Notification state
    overdue: '#f87171',
    dueToday: '#fbbf24',
    refill: '#fb923c',
  },
  light: {
    night: '#f0eefa',
    bg: '#f0eefa',
    surface: '#ffffff',
    surfaceHi: '#e8e0f7',
    card: 'rgba(255,255,255,0.9)',
    cardBorder: 'rgba(0,0,0,0.08)',
    rim: 'rgba(0,0,0,0.08)',
    rimHi: 'rgba(0,0,0,0.15)',
    grid: 'rgba(0,0,0,0.05)',
    badgeBg: 'rgba(0,0,0,0.06)',

    // Ink
    ink: '#1a1525',
    inkMid: '#5a4e7a',
    inkDim: '#9589b5',

    // Brand (light-mode tuned for AA on lavender bg)
    brand: '#7c3aed',
    brandPressed: '#6d28d9',
    brandGlow: 'rgba(124,58,237,0.12)',
    brandOn: '#ffffff',
    accent: '#c2410c',
    lavender: '#7c3aed',
    amber: '#c2410c',

    // Health palette (light-mode tuned for AA)
    jade: '#2e8c5b',
    honey: '#a57a11',
    coral: '#b85220',
    rose: '#b8312e',

    // Notification state
    overdue: '#dc2626',
    dueToday: '#a16207',
    refill: '#c2410c',
  },
} as const;

/**
 * The shape of a theme palette. Using a mapped type widens the literal
 * hex values to `string` so `palette.dark` and `palette.light` (which have
 * different concrete values) are both assignable. Field names must match
 * across modes — that's the contract.
 */
export type Palette = { readonly [K in keyof (typeof palette)['dark']]: string };

/**
 * @deprecated Use `useThemeColors()` instead. Kept only to avoid breaking
 * any incidental imports. These values are wrong for light mode and should
 * not be used in new code. Will be removed once a follow-up sweep confirms
 * no remaining consumers.
 */
export const accent = {
  lavender: palette.dark.brand,
  lavenderDim: palette.light.brand,
  jade: palette.dark.jade,
  honey: palette.dark.honey,
  coral: palette.dark.coral,
  rose: palette.dark.rose,
  amber: palette.dark.accent,
} as const;
