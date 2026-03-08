import { useNavigate } from 'react-router-dom'
import { useTheme, type Theme } from '../contexts/ThemeContext'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '⚙️' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  return (
    <div className="min-h-screen px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
          className="text-ink-dim hover:text-ink-mid transition-colors text-xl"
          aria-label="Back"
        >←</button>
        <h1 className="font-display font-bold text-2xl text-ink">Settings</h1>
      </div>

      {/* Appearance */}
      <section className="glass-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Appearance</h2>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Theme</p>
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: 'var(--color-tab-bar)' }}
            role="group"
            aria-label="Theme selection"
          >
            {THEME_OPTIONS.map(({ value, label, icon }) => {
              const isActive = theme === value
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  aria-pressed={isActive}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: isActive ? 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)' : 'transparent',
                    color: isActive ? 'white' : 'var(--color-ink-dim)',
                    boxShadow: isActive ? '0 2px 8px rgba(168,85,247,0.35)' : 'none',
                  }}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-ink-dim mt-2">
            {theme === 'system'
              ? "Follows your device's display settings."
              : theme === 'light'
              ? 'Always uses the light theme.'
              : 'Always uses the dark theme.'}
          </p>
        </div>
      </section>
    </div>
  )
}
