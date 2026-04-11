import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        night: 'var(--color-night)',
        surface: 'var(--color-surface)',
        'surface-hi': 'var(--color-surface-hi)',
        lavender: {
          DEFAULT: '#c084fc',
          dim: '#7c3aed',
          glow: 'rgba(192,132,252,0.15)',
        },
        amber: {
          DEFAULT: '#fb923c',
          dim: 'rgba(251,146,60,0.15)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          mid: 'var(--color-ink-mid)',
          dim: 'var(--color-ink-dim)',
        },
        rim: 'var(--color-rim)',
        jade: '#4ade80',
        honey: '#fbbf24',
        coral: '#f97316',
        rose: '#f87171',
      },
      borderRadius: {
        card: '20px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config
