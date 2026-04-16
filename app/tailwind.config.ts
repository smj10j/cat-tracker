import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surface (--color-bg is canonical; --color-night kept as alias for legacy classes)
        bg: 'var(--color-bg)',
        night: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hi': 'var(--color-surface-hi)',
        card: 'var(--color-card)',
        'card-border': 'var(--color-card-border)',
        rim: 'var(--color-rim)',
        'rim-hi': 'var(--color-rim-hi)',

        // Ink
        ink: {
          DEFAULT: 'var(--color-ink)',
          mid: 'var(--color-ink-mid)',
          dim: 'var(--color-ink-dim)',
        },

        // Brand — theme-reactive. Legacy `lavender`/`amber` aliases map to
        // brand/accent so existing classes don't break during the Phase 0
        // sweep; consumer migration to `brand`/`accent` is a follow-up.
        brand: {
          DEFAULT: 'var(--color-brand)',
          pressed: 'var(--color-brand-pressed)',
          glow: 'var(--color-brand-glow)',
          on: 'var(--color-brand-on)',
        },
        accent: 'var(--color-accent)',
        lavender: {
          DEFAULT: 'var(--color-brand)',
          dim: 'var(--color-brand-pressed)',
          glow: 'var(--color-brand-glow)',
        },
        amber: {
          DEFAULT: 'var(--color-accent)',
          dim: 'var(--color-brand-glow)',
        },

        // Health palette — theme-reactive.
        jade: 'var(--color-health-jade)',
        honey: 'var(--color-health-honey)',
        coral: 'var(--color-health-coral)',
        rose: 'var(--color-health-rose)',
      },
      borderRadius: {
        card: '20px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config
