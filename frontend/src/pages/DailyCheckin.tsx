import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMeasurement, getCats, type Cat } from '../lib/api'
import { PRESETS } from '../lib/measurementPresets'

type Selections = Partial<Record<string, number>>

const BEHAVIORAL_TYPES = [
  { key: 'food',     label: 'Food' },
  { key: 'water',    label: 'Water' },
  { key: 'litter',   label: 'Litter' },
  { key: 'grooming', label: 'Grooming' },
  { key: 'activity', label: 'Activity' },
  { key: 'vomiting', label: 'Vomiting' },
] as const

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentHour(): number {
  return new Date().getHours()
}

function buildMeasuredAt(localDate: string, hour: number): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(y!, mo! - 1, d!, hour, 0, 0).toISOString()
}

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

export default function DailyCheckin() {
  const navigate = useNavigate()
  const [cats, setCats] = useState<Cat[]>([])
  const [selectedCatId, setSelectedCatId] = useState('')
  const [date, setDate] = useState(todayLocalDate)
  const [hour, setHour] = useState(currentHour)
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [selections, setSelections] = useState<Selections>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCats().then((all) => {
      setCats(all)
      if (all.length === 1) setSelectedCatId(all[0]!.id)
    })
  }, [])

  const selectedCat = cats.find((c) => c.id === selectedCatId) ?? null

  const weightValid = weightValue.trim() !== '' && !isNaN(parseFloat(weightValue)) && parseFloat(weightValue) > 0
  const measurementCount =
    (weightValid ? 1 : 0) + Object.keys(selections).filter((k) => selections[k] !== undefined).length
  const canSubmit = selectedCatId !== '' && measurementCount > 0

  function handlePreset(type: string, value: number) {
    setSelections((prev) => {
      // Tapping the already-selected preset deselects it
      if (prev[type] === value) {
        const next = { ...prev }
        delete next[type]
        return next
      }
      return { ...prev, [type]: value }
    })
  }

  function reset() {
    setWeightValue('')
    setSelections({})
    setDate(todayLocalDate())
    setHour(currentHour())
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const measured_at = buildMeasuredAt(date, hour)
    const toCreate: Array<{ type: string; value: number; unit: string }> = []

    if (weightValid) {
      toCreate.push({ type: 'weight', value: parseFloat(weightValue), unit: weightUnit })
    }
    for (const { key } of BEHAVIORAL_TYPES) {
      const val = selections[key]
      if (val !== undefined) {
        toCreate.push({ type: key, value: val, unit: 'scale' })
      }
    }

    try {
      await Promise.all(
        toCreate.map((m) =>
          createMeasurement(selectedCatId, { ...m, measured_at, notes: null })
        )
      )
      window.dispatchEvent(new CustomEvent('measurementAdded'))
      setSaved(true)
      reset()
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Some measurements could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh" style={{ background: '#16111f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ede9f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="font-display font-bold text-ink text-lg leading-tight">Daily Check-In</h1>
          {selectedCat && (
            <p className="text-xs text-ink-mid">{selectedCat.name}</p>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-32 space-y-4">

        {/* Success banner */}
        {saved && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
          >
            <span>✓</span>
            <span>Check-in saved!</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {/* Cat selector (hidden when only one cat) */}
        {cats.length !== 1 && (
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: 'rgba(42,32,64,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <label className="block text-[10px] font-semibold text-ink-mid uppercase tracking-wider mb-2">Cat</label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm"
            >
              <option value="">Select a cat…</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date & Time */}
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: 'rgba(42,32,64,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <label className="block text-[10px] font-semibold text-ink-mid uppercase tracking-wider mb-2">When</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayLocalDate()}
              className="input-dark flex-1 px-3 py-2.5 text-sm"
            />
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="input-dark px-3 py-2.5 text-sm"
              style={{ minWidth: 110 }}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{formatHour(i)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Weight */}
        <div
          className="rounded-2xl px-4 pt-3 pb-4"
          style={{ background: 'rgba(42,32,64,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <label className="block text-[10px] font-semibold text-ink-mid uppercase tracking-wider mb-3">Weight</label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.01"
              min="0"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              placeholder="e.g. 9.4  —  leave blank to skip"
              className="input-dark flex-1 px-3 py-2.5 text-sm"
            />
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as 'lbs' | 'kg')}
              className="input-dark px-3 py-2.5 text-sm"
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>

        {/* Behavioral observations */}
        <div
          className="rounded-2xl px-4 pt-3 pb-2"
          style={{ background: 'rgba(42,32,64,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[10px] font-semibold text-ink-mid uppercase tracking-wider mb-1">
            Observations — tap to select, skip any row
          </p>

          {BEHAVIORAL_TYPES.map(({ key, label }, i) => {
            const presets = PRESETS[key] ?? []
            const selectedVal = selections[key]
            const isLast = i === BEHAVIORAL_TYPES.length - 1

            return (
              <div
                key={key}
                className="flex items-center gap-2 py-2.5"
                style={isLast ? undefined : { borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                {/* Type label */}
                <span
                  className="text-xs font-medium flex-shrink-0"
                  style={{ width: 64, color: selectedVal !== undefined ? '#ede9f6' : '#6b5f85' }}
                >
                  {label}
                </span>

                {/* Preset buttons */}
                <div className="flex gap-1 flex-1">
                  {presets.map((preset) => {
                    const isSelected = selectedVal === preset.value
                    return (
                      <button
                        key={preset.value}
                        onClick={() => handlePreset(key, preset.value)}
                        disabled={saving}
                        className="flex-1 rounded-lg font-semibold transition-all leading-tight"
                        style={{
                          fontSize: 10,
                          paddingTop: 6,
                          paddingBottom: 6,
                          paddingLeft: 2,
                          paddingRight: 2,
                          minHeight: 34,
                          background: isSelected
                            ? (preset.concern ? 'rgba(248,113,113,0.18)' : 'rgba(74,222,128,0.13)')
                            : 'rgba(255,255,255,0.05)',
                          border: isSelected
                            ? (preset.concern ? '1.5px solid rgba(248,113,113,0.45)' : '1.5px solid rgba(74,222,128,0.35)')
                            : '1px solid rgba(255,255,255,0.07)',
                          color: isSelected
                            ? (preset.concern ? '#f87171' : '#4ade80')
                            : '#6b5f85',
                        }}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Submit */}
        <div className="pt-1">
          {measurementCount > 0 && selectedCatId && (
            <p className="text-center text-xs text-ink-mid mb-3">
              Logging {measurementCount} measurement{measurementCount !== 1 ? 's' : ''} for{' '}
              <span className="text-ink font-semibold">{selectedCat?.name ?? '…'}</span>
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="btn-primary w-full py-4 text-sm font-semibold"
            style={!canSubmit ? { opacity: 0.4, cursor: 'default' } : undefined}
          >
            {saving ? 'Saving…' : canSubmit ? 'Log Check-In' : 'Nothing to log yet'}
          </button>
        </div>
      </div>
    </div>
  )
}
