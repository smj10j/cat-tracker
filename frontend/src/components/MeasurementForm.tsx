import { useState } from 'react'
import { createMeasurement, type Measurement } from '../lib/api'

interface Props {
  catId: string
  onAdded: (m: Measurement) => void
}

const TYPE_OPTIONS = [
  { value: 'weight', label: 'Weight' },
  { value: 'food', label: 'Food Intake' },
  { value: 'water', label: 'Water Intake' },
]

const UNITS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  weight: [{ value: 'lbs', label: 'lbs' }, { value: 'kg', label: 'kg' }],
  food:   [{ value: 'oz', label: 'oz' }, { value: 'g', label: 'g' }],
  water:  [{ value: 'oz', label: 'oz' }, { value: 'mL', label: 'mL' }],
}

const DEFAULT_UNIT: Record<string, string> = { weight: 'lbs', food: 'oz', water: 'oz' }

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MeasurementForm({ catId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'weight', value: '', unit: 'lbs', measured_at: toLocalDatetimeString(new Date()), notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    if (name === 'type') {
      setForm((prev) => ({ ...prev, type: value, unit: DEFAULT_UNIT[value] ?? 'lbs' }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numVal = parseFloat(form.value)
    if (isNaN(numVal) || numVal <= 0) { setError('Enter a valid positive number.'); return }
    setSaving(true)
    setError(null)
    try {
      const m = await createMeasurement(catId, {
        type: form.type, value: numVal, unit: form.unit,
        measured_at: new Date(form.measured_at).toISOString(),
        notes: form.notes.trim() || null,
      })
      onAdded(m)
      setForm((prev) => ({ ...prev, value: '', notes: '', measured_at: toLocalDatetimeString(new Date()) }))
      setOpen(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const unitOptions = UNITS_BY_TYPE[form.type] ?? UNITS_BY_TYPE['weight']!

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold text-lavender transition-all"
        style={{
          border: '1.5px dashed rgba(192,132,252,0.3)',
          background: 'transparent',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,132,252,0.06)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        + Add Measurement
      </button>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4 animate-fade-in"
      style={{
        background: 'rgba(192,132,252,0.06)',
        border: '1px solid rgba(192,132,252,0.2)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-ink">New Measurement</h3>
        <button onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink-mid text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-all">×</button>
      </div>

      {error && <div className="text-rose text-sm p-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)' }}>{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
          <select name="type" value={form.type} onChange={handleChange} className="input-dark w-full px-3 py-2.5 text-sm">
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
          <select name="unit" value={form.unit} onChange={handleChange} className="input-dark w-full px-3 py-2.5 text-sm">
            {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Value</label>
        <input name="value" type="number" step="0.01" min="0" value={form.value} onChange={handleChange}
          required placeholder="e.g. 9.4" className="input-dark w-full px-3 py-2.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Date &amp; Time</label>
        <input name="measured_at" type="datetime-local" value={form.measured_at} onChange={handleChange}
          required className="input-dark w-full px-3 py-2.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Notes</label>
        <input name="notes" value={form.notes} onChange={handleChange} placeholder="e.g. Before breakfast"
          className="input-dark w-full px-3 py-2.5 text-sm" />
      </div>

      <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-3 text-sm">
        {saving ? 'Saving…' : 'Save Measurement'}
      </button>
    </div>
  )
}
