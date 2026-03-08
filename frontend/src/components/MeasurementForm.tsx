import { useState } from 'react'
import { createMeasurement, type Measurement } from '../lib/api'
import { PRESETS, PRESET_TYPES } from '../lib/measurementPresets'

interface Props {
  catId: string
  onAdded: (m: Measurement) => void
}

const TYPE_OPTIONS = [
  { value: 'weight',   label: 'Weight' },
  { value: 'food',     label: 'Food Intake' },
  { value: 'water',    label: 'Water Intake' },
  { value: 'litter',   label: 'Litter Box' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'activity', label: 'Activity' },
  { value: 'vomiting', label: 'Vomiting' },
]

function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

export default function MeasurementForm({ catId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('weight')
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState('lbs')
  const [date, setDate] = useState(todayLocalDate)
  const [hour, setHour] = useState(() => new Date().getHours())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(newType: string) {
    setType(newType)
    setWeightValue('')
    setError(null)
  }

  async function save(value: number, unit: string) {
    setSaving(true)
    setError(null)
    try {
      const measured_at = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
      const m = await createMeasurement(catId, { type, value, unit, measured_at, notes: null })
      onAdded(m)
      setWeightValue('')
      setDate(todayLocalDate())
      setHour(new Date().getHours())
      setOpen(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleWeightSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(weightValue)
    if (isNaN(num) || num <= 0) { setError('Enter a valid positive number.'); return }
    await save(num, weightUnit)
  }

  async function handlePresetTap(value: number) {
    await save(value, 'scale')
  }

  const isPresetType = PRESET_TYPES.has(type)
  const presets = PRESETS[type] ?? []

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
        <button onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink-mid text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-all">×</button>
      </div>

      {error && <div className="text-rose text-sm p-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)' }}>{error}</div>}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
        <select value={type} onChange={(e) => handleTypeChange(e.target.value)} className="input-dark w-full px-3 py-2.5 text-sm">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Date/time (always shown) */}
      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Date &amp; Time</label>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            max={todayLocalDate()} className="input-dark flex-1 px-3 py-2.5 text-sm" />
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
            className="input-dark px-3 py-2.5 text-sm" style={{ minWidth: 110 }}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{formatHour(i)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Input: presets for behavioral types, numeric for weight */}
      {isPresetType ? (
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Observation</label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetTap(preset.value)}
                disabled={saving}
                className="py-3.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: preset.concern ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)',
                  border: preset.concern ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(255,255,255,0.08)',
                  color: preset.concern ? '#f87171cc' : '#ede9f6',
                }}
              >
                {saving ? '…' : preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Weight</label>
              <input type="number" step="0.01" min="0" value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="e.g. 9.4" className="input-dark w-full px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
              <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className="input-dark w-full px-2 py-2.5 text-sm">
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={handleWeightSubmit} disabled={saving} className="btn-primary w-full py-3 text-sm">
            {saving ? 'Saving…' : 'Save Weight'}
          </button>
        </div>
      )}
    </div>
  )
}
