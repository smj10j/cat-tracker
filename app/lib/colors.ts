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
 * Phase 1 (PRD-visual-identity-v2): 5 families, brand + health + state
 * tokens populated per family × mode. Hex values match the CSS vars in
 * `frontend/src/index.css` and `app/global.css`.
 */

import type { ThemeFamily } from '@shared/lib/themeTokens';

/**
 * The shape of a theme palette. Field names must match across families
 * and modes — that's the contract.
 */
export type Palette = {
  readonly night: string;
  readonly bg: string;
  readonly surface: string;
  readonly surfaceHi: string;
  readonly card: string;
  readonly cardBorder: string;
  readonly rim: string;
  readonly rimHi: string;
  readonly grid: string;
  readonly badgeBg: string;
  readonly ink: string;
  readonly inkMid: string;
  readonly inkDim: string;
  readonly brand: string;
  readonly brandPressed: string;
  readonly brandGlow: string;
  readonly brandOn: string;
  readonly accent: string;
  readonly lavender: string;
  readonly amber: string;
  readonly jade: string;
  readonly honey: string;
  readonly coral: string;
  readonly rose: string;
  readonly overdue: string;
  readonly dueToday: string;
  readonly refill: string;
};

/**
 * All 5 families × 2 modes. Hex values sourced from frontend/src/index.css.
 * `night` and `lavender`/`amber` are legacy aliases kept for backward compat.
 */
export const familyPalettes: Record<ThemeFamily, { dark: Palette; light: Palette }> = {
  lamplight: {
    dark: {
      night: '#1B1424', bg: '#1B1424', surface: '#261B33', surfaceHi: '#332444',
      card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.07)',
      rim: 'rgba(255,220,180,0.08)', rimHi: 'rgba(255,255,255,0.12)',
      grid: 'rgba(255,255,255,0.04)', badgeBg: 'rgba(255,255,255,0.06)',
      ink: '#F5EDE0', inkMid: '#B8A89A', inkDim: '#7A6B5E',
      brand: '#F2A65A', brandPressed: '#C8741F', brandGlow: 'rgba(242,166,90,0.18)', brandOn: '#1B1424', accent: '#9C6BD9',
      lavender: '#F2A65A', amber: '#9C6BD9',
      jade: '#6BCF93', honey: '#F4C849', coral: '#EF7E48', rose: '#E66666',
      overdue: '#f87171', dueToday: '#fbbf24', refill: '#fb923c',
    },
    light: {
      night: '#FAF5EC', bg: '#FAF5EC', surface: '#FFFEF9', surfaceHi: '#F1E9D8',
      card: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,0,0,0.08)',
      rim: 'rgba(80,50,20,0.10)', rimHi: 'rgba(0,0,0,0.15)',
      grid: 'rgba(0,0,0,0.05)', badgeBg: 'rgba(0,0,0,0.06)',
      ink: '#2A211A', inkMid: '#6B5B4E', inkDim: '#9C8E80',
      brand: '#C8741F', brandPressed: '#9A4F11', brandGlow: 'rgba(200,116,31,0.14)', brandOn: '#FFFFFF', accent: '#6E4FA8',
      lavender: '#C8741F', amber: '#6E4FA8',
      jade: '#2e8c5b', honey: '#a57a11', coral: '#b85220', rose: '#b8312e',
      overdue: '#dc2626', dueToday: '#a16207', refill: '#c2410c',
    },
  },
  warmnight: {
    dark: {
      night: '#1A1326', bg: '#1A1326', surface: '#241A33', surfaceHi: '#322547',
      card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.07)',
      rim: 'rgba(255,255,255,0.07)', rimHi: 'rgba(255,255,255,0.12)',
      grid: 'rgba(255,255,255,0.04)', badgeBg: 'rgba(255,255,255,0.06)',
      ink: '#EDE9F6', inkMid: '#A899C0', inkDim: '#6B5F85',
      brand: '#B07BFF', brandPressed: '#8A52E6', brandGlow: 'rgba(176,123,255,0.18)', brandOn: '#1A1326', accent: '#FFB37A',
      lavender: '#B07BFF', amber: '#FFB37A',
      jade: '#6BCF93', honey: '#F4C849', coral: '#EF7E48', rose: '#E66666',
      overdue: '#f87171', dueToday: '#fbbf24', refill: '#fb923c',
    },
    light: {
      night: '#F6F2FB', bg: '#F6F2FB', surface: '#FFFFFF', surfaceHi: '#EFE8FA',
      card: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,0,0,0.08)',
      rim: 'rgba(40,20,80,0.08)', rimHi: 'rgba(0,0,0,0.15)',
      grid: 'rgba(0,0,0,0.05)', badgeBg: 'rgba(0,0,0,0.06)',
      ink: '#1F1A2E', inkMid: '#5A4E7A', inkDim: '#9589B5',
      brand: '#7C3AED', brandPressed: '#6D28D9', brandGlow: 'rgba(124,58,237,0.12)', brandOn: '#FFFFFF', accent: '#C2410C',
      lavender: '#7C3AED', amber: '#C2410C',
      jade: '#2e8c5b', honey: '#a57a11', coral: '#b85220', rose: '#b8312e',
      overdue: '#dc2626', dueToday: '#a16207', refill: '#c2410c',
    },
  },
  forest: {
    dark: {
      night: '#141A14', bg: '#141A14', surface: '#1E2820', surfaceHi: '#27332A',
      card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.07)',
      rim: 'rgba(220,255,220,0.07)', rimHi: 'rgba(255,255,255,0.12)',
      grid: 'rgba(255,255,255,0.04)', badgeBg: 'rgba(255,255,255,0.06)',
      ink: '#EFEFE7', inkMid: '#A6B0A0', inkDim: '#6B756A',
      brand: '#5BAE7E', brandPressed: '#3F8A60', brandGlow: 'rgba(91,174,126,0.18)', brandOn: '#0E140E', accent: '#D6936A',
      lavender: '#5BAE7E', amber: '#D6936A',
      jade: '#6BCF93', honey: '#F4C849', coral: '#EF7E48', rose: '#E66666',
      overdue: '#f87171', dueToday: '#fbbf24', refill: '#fb923c',
    },
    light: {
      night: '#F4F1E8', bg: '#F4F1E8', surface: '#FFFFFF', surfaceHi: '#EAE6D8',
      card: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,0,0,0.08)',
      rim: 'rgba(20,40,20,0.10)', rimHi: 'rgba(0,0,0,0.15)',
      grid: 'rgba(0,0,0,0.05)', badgeBg: 'rgba(0,0,0,0.06)',
      ink: '#1A201A', inkMid: '#4F5A4D', inkDim: '#8A958A',
      brand: '#2F6A4A', brandPressed: '#214E36', brandGlow: 'rgba(47,106,74,0.12)', brandOn: '#FFFFFF', accent: '#A75D34',
      lavender: '#2F6A4A', amber: '#A75D34',
      jade: '#2e8c5b', honey: '#a57a11', coral: '#b85220', rose: '#b8312e',
      overdue: '#dc2626', dueToday: '#a16207', refill: '#c2410c',
    },
  },
  linen: {
    dark: {
      night: '#15191A', bg: '#15191A', surface: '#1E2425', surfaceHi: '#2A3132',
      card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.07)',
      rim: 'rgba(255,255,255,0.07)', rimHi: 'rgba(255,255,255,0.12)',
      grid: 'rgba(255,255,255,0.04)', badgeBg: 'rgba(255,255,255,0.06)',
      ink: '#E8EDED', inkMid: '#9BA8A8', inkDim: '#65706F',
      brand: '#5FB3B0', brandPressed: '#3F908D', brandGlow: 'rgba(95,179,176,0.18)', brandOn: '#0E1718', accent: '#E8B05C',
      lavender: '#5FB3B0', amber: '#E8B05C',
      jade: '#6BCF93', honey: '#F4C849', coral: '#EF7E48', rose: '#E66666',
      overdue: '#f87171', dueToday: '#fbbf24', refill: '#fb923c',
    },
    light: {
      night: '#FAFAFA', bg: '#FAFAFA', surface: '#FFFFFF', surfaceHi: '#F0F2F3',
      card: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,0,0,0.08)',
      rim: 'rgba(15,40,40,0.08)', rimHi: 'rgba(0,0,0,0.15)',
      grid: 'rgba(0,0,0,0.05)', badgeBg: 'rgba(0,0,0,0.06)',
      ink: '#0F1718', inkMid: '#4A5556', inkDim: '#8A9495',
      brand: '#2B7A78', brandPressed: '#1F5957', brandGlow: 'rgba(43,122,120,0.12)', brandOn: '#FFFFFF', accent: '#A5731F',
      lavender: '#2B7A78', amber: '#A5731F',
      jade: '#2e8c5b', honey: '#a57a11', coral: '#b85220', rose: '#b8312e',
      overdue: '#dc2626', dueToday: '#a16207', refill: '#c2410c',
    },
  },
  almanac: {
    dark: {
      night: '#1A1410', bg: '#1A1410', surface: '#251D17', surfaceHi: '#312721',
      card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.07)',
      rim: 'rgba(255,235,210,0.08)', rimHi: 'rgba(255,255,255,0.12)',
      grid: 'rgba(255,255,255,0.04)', badgeBg: 'rgba(255,255,255,0.06)',
      ink: '#F2E8D8', inkMid: '#B5A696', inkDim: '#7A6E60',
      brand: '#D87850', brandPressed: '#A85535', brandGlow: 'rgba(216,120,80,0.18)', brandOn: '#1A1410', accent: '#C7A86B',
      lavender: '#D87850', amber: '#C7A86B',
      jade: '#6BCF93', honey: '#F4C849', coral: '#EF7E48', rose: '#E66666',
      overdue: '#f87171', dueToday: '#fbbf24', refill: '#fb923c',
    },
    light: {
      night: '#F4EFE6', bg: '#F4EFE6', surface: '#FFFCF5', surfaceHi: '#EBE3D2',
      card: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,0,0,0.08)',
      rim: 'rgba(60,40,20,0.10)', rimHi: 'rgba(0,0,0,0.15)',
      grid: 'rgba(0,0,0,0.05)', badgeBg: 'rgba(0,0,0,0.06)',
      ink: '#1F1A14', inkMid: '#5A4E40', inkDim: '#8F8474',
      brand: '#B85C2E', brandPressed: '#8C4220', brandGlow: 'rgba(184,92,46,0.12)', brandOn: '#FFFFFF', accent: '#8A6F3D',
      lavender: '#B85C2E', amber: '#8A6F3D',
      jade: '#2e8c5b', honey: '#a57a11', coral: '#b85220', rose: '#b8312e',
      overdue: '#dc2626', dueToday: '#a16207', refill: '#c2410c',
    },
  },
};

/**
 * Default palette — lamplight. Kept as a backward-compat alias so any
 * existing `import { palette }` call sites continue to work.
 */
export const palette = familyPalettes.lamplight;

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
