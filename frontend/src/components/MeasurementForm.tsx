import { useState } from 'react'
import { createMeasurement, type Measurement } from '../lib/api'
import { PRESETS, PRESET_TYPES } from '@shared/lib/measurementPresets'
import { usePreferences } from '../contexts/PreferencesContext'
import { todayLocalDate, formatHour, buildMeasuredAt, currentHour } from '@shared/lib/formatting'
import { VALID_MEASUREMENT_TYPES, MEASUREMENT_TYPE_LABELS_LONG } from '@shared/lib/constants'

interface Props {
  catId: string
  onAdded: (m: Measurement) => void
}

const TYPE_OPTIONS = VALID_MEASUREMENT_TYPES.map(value => ({ value, label: MEASUREMENT_TYPE_LABELS_LONG[value] ?? value }))

export default function MeasurementForm({ catId, onAdded }: Props) {
  const { prefs } = usePreferences()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('weight')
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState(prefs.weightUnit)
  const [date, setDate] = useState(todayLocalDate)
  const [hour, setHour] = useState(currentHour)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  function handleTypeChange(newType: string) {
    setType(newType)
    setWeightValue('')
    setSelectedPreset(null)
    setError(null)
  }

  async function save(value: number, unit: string) {
    setSaving(true)
    setError(null)
    try {
      const measured_at = buildMeasuredAt(date, hour)
      const m = await createMeasurement(catId, { type, value, unit, measured_at, notes: null })
      onAdded(m)
      setWeightValue('')
      setSelectedPreset(null)
      setDate(todayLocalDate())
      setHour(currentHour())
      // Show "Saved!" for 1 second then close
      setSavedFlash(true)
      setTimeout(() => {
        setSavedFlash(false)
        setOpen(false)
      }, 1000)
    } catch (e: unknown) {
      setError('Couldn\'t save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleWeightSubmit() {
    const num = parseFloat(weightValue)
    if (isNaN(num) || num <= 0) { setError('Enter a valid positive number.'); return }
    await save(num, weightUnit)
  }

  async function handlePresetSave() {
    if (selectedPreset === null) return
    await save(selectedPreset, 'scale')
  }

  function handlePresetTap(value: number) {
    setSelectedPreset((prev) => prev === value ? null : value)
    setError(null)
  }

  const isPresetType = PRESET_TYPES.has(type)
  const presets = PRESETS[type] ?? []
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold text-lavender transition-all"
        style={{ border: '1.5px dashed rgba(192,132,252,0.3)', background: 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,132,252,0.06)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        + Add Measurement
      </button>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-ink">New Measurement</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-ink-dim hover:text-ink-mid text-xl leading-none flex items-center justify-center rounded-full hover:bg-white/5 transition-all"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {savedFlash && (
        <div
          role="status"
          aria-live="polite"
          className="text-sm font-semibold text-center py-1"
          style={{ color: '#4ade80' }}
        >
          ✓ Saved!
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="text-rose text-sm p-2 rounded-lg"
          style={{ background: 'rgba(248,113,113,0.1)' }}
        >
          {error}
        </div>
      )}

      {/* Type selector */}
      <div>
        <label htmlFor="mform-type" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
        <select id="mform-type" value={type} onChange={(e) => handleTypeChange(e.target.value)} className="input-dark w-full px-3 py-2.5 text-sm">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Date/time (always shown) */}
      <div>
        <label htmlFor="mform-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Date &amp; Time</label>
        <div className="flex gap-2">
          <input id="mform-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            max={todayLocalDate()} className="input-dark flex-1 px-3 py-2.5 text-sm" />
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
            className="input-dark px-3 py-2.5 text-sm" style={{ minWidth: 110 }}
            aria-label="Hour">
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{formatHour(i, prefs)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Input: presets for behavioral types, numeric for weight */}
      {isPresetType ? (
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Observation</label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isSelected = selectedPreset === preset.value
              return (
                <button
                  key={preset.value}
                  onClick={() => handlePresetTap(preset.value)}
                  disabled={saving}
                  aria-pressed={isSelected}
                  className="py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: isSelected
                      ? (preset.concern ? 'rgba(248,113,113,0.18)' : 'rgba(192,132,252,0.15)')
                      : (preset.concern ? 'rgba(248,113,113,0.08)' : 'var(--color-card)'),
                    border: isSelected
                      ? (preset.concern ? '1.5px solid rgba(248,113,113,0.5)' : '1.5px solid rgba(192,132,252,0.4)')
                      : (preset.concern ? '1px solid rgba(248,113,113,0.25)' : '1px solid var(--color-rim)'),
                    color: isSelected
                      ? (preset.concern ? '#f87171' : '#c084fc')
                      : (preset.concern ? '#f87171cc' : 'var(--color-ink)'),
                  }}
                >
                  {preset.concern ? '! ' : ''}{saving ? '…' : preset.label}
                </button>
              )
            })}
          </div>
          {selectedPreset !== null && (
            <button
              type="button"
              onClick={handlePresetSave}
              disabled={saving}
              aria-busy={saving}
              className="btn-primary w-full py-3 text-sm mt-3"
            >
              {saving ? 'Saving…' : `Save ${typeLabel} Observation`}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label htmlFor="mform-weight" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Weight</label>
              <input id="mform-weight" type="number" step="0.01" min="0" value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="e.g. 9.4" className="input-dark w-full px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label htmlFor="mform-unit" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
              <select id="mform-unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'lbs' | 'kg')} className="input-dark w-full px-2 py-2.5 text-sm">
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={handleWeightSubmit} disabled={saving} aria-busy={saving} className="btn-primary w-full py-3 text-sm">
            {saving ? 'Saving…' : 'Save Weight'}
          </button>
        </div>
      )}
    </div>
  )
}
