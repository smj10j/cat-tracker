import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        night: '#16111f',
        surface: '#1f1830',
        'surface-hi': '#2a2040',
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
          DEFAULT: '#ede9f6',
          mid: '#a899c0',
          dim: '#6b5f85',
        },
        rim: 'rgba(255,255,255,0.07)',
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
