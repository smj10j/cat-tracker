import { useState } from 'react'
import { createMeasurement, type Measurement } from '../lib/api'

interface Props {
  catId: string
  onAdded: (m: Measurement) => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MeasurementForm({ catId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'weight',
    value: '',
    unit: 'lbs',
    measured_at: toLocalDatetimeString(new Date()),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numVal = parseFloat(form.value)
    if (isNaN(numVal) || numVal <= 0) {
      setError('Please enter a valid positive number for value.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const m = await createMeasurement(catId, {
        type: form.type,
        value: numVal,
        unit: form.unit,
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-brand-300 text-brand-600 rounded-xl py-3 text-sm font-medium hover:border-brand-500 hover:bg-brand-50 transition-colors"
      >
        + Add Measurement
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-brand-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800">New Measurement</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
          ×
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="weight">Weight</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
          <select
            name="unit"
            value={form.unit}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
        <input
          name="value"
          type="number"
          step="0.01"
          min="0"
          value={form.value}
          onChange={handleChange}
          required
          placeholder="e.g. 9.4"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time</label>
        <input
          name="measured_at"
          type="datetime-local"
          value={form.measured_at}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="e.g. Before breakfast"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Measurement'}
      </button>
    </form>
  )
}
