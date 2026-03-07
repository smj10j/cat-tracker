import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
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
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
        glow: '0 0 12px rgba(192,132,252,0.4)',
        'glow-jade': '0 0 10px rgba(74,222,128,0.4)',
        'glow-rose': '0 0 10px rgba(248,113,113,0.4)',
        'glow-honey': '0 0 10px rgba(251,191,36,0.4)',
        'glow-coral': '0 0 10px rgba(249,115,22,0.4)',
      },
      keyframes: {
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slideUpFade 220ms cubic-bezier(0.22,1,0.36,1) forwards',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        pulse: 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 180ms ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
