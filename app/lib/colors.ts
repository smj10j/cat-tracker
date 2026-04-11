/** Dark/light palette constants for use in inline styles.
 *  Tailwind class-based colors (bg-night, text-ink, etc.) auto-switch via CSS vars
 *  in global.css. This file is only needed where inline `style={{ }}` is used. */

export const palette = {
  dark: {
    night: '#16111f',
    surface: '#1f1830',
    surfaceHi: '#2a2040',
    ink: '#ede9f6',
    inkMid: '#a899c0',
    inkDim: '#6b5f85',
    rim: 'rgba(255,255,255,0.07)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.07)',
  },
  light: {
    night: '#f0eefa',
    surface: '#ffffff',
    surfaceHi: '#e8e0f7',
    ink: '#1a1525',
    inkMid: '#5a4e7a',
    inkDim: '#9589b5',
    rim: 'rgba(0,0,0,0.08)',
    card: 'rgba(255,255,255,0.9)',
    cardBorder: 'rgba(0,0,0,0.08)',
  },
} as const;

/** Accent colors that don't change between themes */
export const accent = {
  lavender: '#c084fc',
  lavenderDim: '#7c3aed',
  jade: '#4ade80',
  honey: '#fbbf24',
  coral: '#f97316',
  rose: '#f87171',
  amber: '#fb923c',
} as const;

export type Palette = (typeof palette)['dark'];
