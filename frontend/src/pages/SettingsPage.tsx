import { useTheme, type Theme } from '../contexts/ThemeContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { useGoBack } from '../hooks/useGoBack'
import type { DateFormat, TimeFormat, WeightUnit } from '@shared/lib/preferences'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '⚙️' },
]

const DATE_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'MDY', label: 'MM/DD/YYYY' },
  { value: 'DMY', label: 'DD/MM/YYYY' },
  { value: 'YMD', label: 'YYYY-MM-DD' },
]

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
]

const WEIGHT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
]

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  isAuto,
}: {
  options: { value: T; label: string; icon?: string }[]
  value: T
  onChange: (v: T) => void
  isAuto?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: 'var(--color-tab-bar)' }}
        role="group"
      >
        {options.map(({ value: v, label, icon }) => {
          const isActive = value === v
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              aria-pressed={isActive}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: isActive ? 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)' : 'transparent',
                color: isActive ? 'white' : 'var(--color-ink-dim)',
                boxShadow: isActive ? '0 2px 8px rgba(168,85,247,0.35)' : 'none',
              }}
            >
              {icon && <span>{icon}</span>}
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {isAuto && <span className="text-xs text-ink-dim ml-1">(auto-detected)</span>}
    </div>
  )
}

export default function SettingsPage() {
  const goBack = useGoBack('/')
  const { theme, setTheme } = useTheme()
  const { prefs, setPref, resetToLocale, isOverridden } = usePreferences()

  const hasAnyOverride = isOverridden('dateFormat') || isOverridden('timeFormat') || isOverridden('weightUnit')

  return (
    <div className="min-h-screen px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={goBack}
          className="text-ink-dim hover:text-ink-mid transition-colors text-xl"
          aria-label="Back"
        >←</button>
        <h1 className="font-display font-bold text-2xl text-ink">Settings</h1>
      </div>

      {/* Appearance */}
      <section className="glass-card p-5 space-y-4 mb-4">
        <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Appearance</h2>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Theme</p>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={theme}
            onChange={setTheme}
          />
          <p className="text-xs text-ink-dim mt-2">
            {theme === 'system'
              ? "Follows your device's display settings."
              : theme === 'light'
              ? 'Always uses the light theme.'
              : 'Always uses the dark theme.'}
          </p>
        </div>
      </section>

      {/* Regional */}
      <section className="glass-card p-5 space-y-5">
        <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Regional</h2>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Date format</p>
          <SegmentedControl
            options={DATE_OPTIONS}
            value={prefs.dateFormat}
            onChange={(v) => setPref('dateFormat', v)}
            isAuto={!isOverridden('dateFormat')}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Time format</p>
          <SegmentedControl
            options={TIME_OPTIONS}
            value={prefs.timeFormat}
            onChange={(v) => setPref('timeFormat', v)}
            isAuto={!isOverridden('timeFormat')}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Weight unit</p>
          <SegmentedControl
            options={WEIGHT_OPTIONS}
            value={prefs.weightUnit}
            onChange={(v) => setPref('weightUnit', v)}
            isAuto={!isOverridden('weightUnit')}
          />
        </div>

        {hasAnyOverride && (
          <button
            onClick={resetToLocale}
            className="text-sm text-ink-dim hover:text-ink-mid transition-colors"
          >
            Reset to locale defaults
          </button>
        )}
      </section>
    </div>
  )
}
