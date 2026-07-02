import { useState } from 'react'
import { useTheme, type ThemeMode } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { updateMe } from '../lib/api'
import { usePreferences } from '../contexts/PreferencesContext'
import { useGoBack } from '../hooks/useGoBack'
import { THEME_FAMILIES, type ThemeFamily } from '@shared/lib/themeTokens'
import type { DateFormat, TimeFormat, WeightUnit } from '@shared/lib/preferences'

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '⚙️' },
]

const FAMILY_META: Record<ThemeFamily, { label: string; description: string; swatches: { dark: string[]; light: string[] } }> = {
  lamplight: {
    label: 'Lamplight',
    description: 'Warm amber on aubergine — the default',
    swatches: { dark: ['#1B1424', '#332444', '#F2A65A', '#9C6BD9'], light: ['#FAF5EC', '#F1E9D8', '#C8741F', '#6E4FA8'] },
  },
  warmnight: {
    label: 'Warm Night',
    description: 'The original nightshade purple, sharpened',
    swatches: { dark: ['#1A1326', '#322547', '#B07BFF', '#FFB37A'], light: ['#F6F2FB', '#EFE8FA', '#7C3AED', '#C2410C'] },
  },
  forest: {
    label: 'Forest',
    description: 'Deep green with terracotta warmth',
    swatches: { dark: ['#141A14', '#27332A', '#5BAE7E', '#D6936A'], light: ['#F4F1E8', '#EAE6D8', '#2F6A4A', '#A75D34'] },
  },
  linen: {
    label: 'Linen',
    description: 'Cool teal on soft neutral',
    swatches: { dark: ['#15191A', '#2A3132', '#5FB3B0', '#E8B05C'], light: ['#FAFAFA', '#F0F2F3', '#2B7A78', '#A5731F'] },
  },
  almanac: {
    label: 'Almanac',
    description: 'Terracotta on warm paper — editorial feel',
    swatches: { dark: ['#1A1410', '#312721', '#D87850', '#C7A86B'], light: ['#F4EFE6', '#EBE3D2', '#B85C2E', '#8A6F3D'] },
  },
}

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
                background: isActive ? 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-pressed) 100%)' : 'transparent',
                color: isActive ? 'var(--color-brand-on)' : 'var(--color-ink-dim)',
                boxShadow: isActive ? '0 2px 8px var(--color-brand-glow)' : 'none',
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

function ThemeFamilyPicker({ value, onChange, currentMode }: { value: ThemeFamily; onChange: (f: ThemeFamily) => void; currentMode: 'dark' | 'light' }) {
  return (
    <div className="space-y-2">
      {THEME_FAMILIES.map((fam) => {
        const meta = FAMILY_META[fam]
        const isActive = value === fam
        const swatches = meta.swatches[currentMode]
        return (
          <button
            key={fam}
            onClick={() => onChange(fam)}
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
            style={{
              background: isActive ? 'var(--color-brand-glow)' : 'var(--color-card)',
              border: isActive ? '1.5px solid var(--color-brand)' : '1px solid var(--color-card-border)',
            }}
          >
            {/* Swatches */}
            <div className="flex gap-1 shrink-0">
              {swatches.map((color, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full"
                  style={{
                    backgroundColor: color,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
            {/* Label + description */}
            <div className="min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: isActive ? 'var(--color-brand)' : 'var(--color-ink)' }}
              >
                {meta.label}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--color-ink-dim)' }}>
                {meta.description}
              </p>
            </div>
            {/* Checkmark */}
            {isActive && (
              <span className="ml-auto text-sm" style={{ color: 'var(--color-brand)' }}>✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsPage() {
  const goBack = useGoBack('/')
  const { mode, setMode, family, setFamily } = useTheme()
  const { prefs, setPref, resetToLocale, isOverridden } = usePreferences()
  const { user, refresh } = useAuth()
  const [emailReminders, setEmailReminders] = useState<number>(user?.email_reminders ?? 1)
  const [savingEmail, setSavingEmail] = useState(false)

  async function toggleEmailReminders() {
    const next = emailReminders === 1 ? 0 : 1
    setEmailReminders(next)
    setSavingEmail(true)
    try {
      await updateMe({ email_reminders: next })
      await refresh()
    } catch {
      setEmailReminders(next === 1 ? 0 : 1) // revert on failure
    } finally {
      setSavingEmail(false)
    }
  }

  const hasAnyOverride = isOverridden('dateFormat') || isOverridden('timeFormat') || isOverridden('weightUnit')

  // Resolve 'system' → actual mode for swatch display
  const resolvedMode: 'dark' | 'light' =
    mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode

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
      <section className="glass-card p-5 space-y-5 mb-4">
        <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Appearance</h2>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Theme</p>
          <ThemeFamilyPicker value={family} onChange={setFamily} currentMode={resolvedMode} />
        </div>

        <div>
          <p className="text-sm font-medium text-ink mb-3">Mode</p>
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          <p className="text-xs text-ink-dim mt-2">
            {mode === 'system'
              ? "Follows your device's display settings."
              : mode === 'light'
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

      {/* Notifications */}
      <section className="glass-card p-5 space-y-3 mt-4">
        <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Notifications</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Email reminders</p>
            <p className="text-xs text-ink-dim mt-0.5">
              A fallback email when a care item goes overdue and you have no push notifications set up.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailReminders === 1}
            aria-label="Email reminders"
            disabled={savingEmail}
            onClick={toggleEmailReminders}
            className="relative w-12 h-7 rounded-full transition-all shrink-0"
            style={{
              background: emailReminders === 1 ? 'var(--color-brand)' : 'rgba(255,255,255,0.12)',
              opacity: savingEmail ? 0.6 : 1,
            }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full transition-all"
              style={{ left: emailReminders === 1 ? 'calc(100% - 24px)' : '4px', background: '#fff' }}
            />
          </button>
        </div>
      </section>
    </div>
  )
}
