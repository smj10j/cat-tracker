import { useEffect, useRef, useState } from 'react'
import { createMeasurement, getCats, type Cat } from '../lib/api'

interface Props {
  onAdded?: () => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function QuickAdd({ onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [cats, setCats] = useState<Cat[]>([])
  const [form, setForm] = useState({
    catId: '',
    type: 'weight',
    value: '',
    unit: 'lbs',
    measured_at: toLocalDatetimeString(new Date()),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cats.length === 0) {
      getCats().then((all) => {
        setCats(all)
        if (all.length === 1) setForm((f) => ({ ...f, catId: all[0]!.id }))
      })
    }
  }, [open, cats.length])

  // Reset datetime when opened
  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, measured_at: toLocalDatetimeString(new Date()), value: '' }))
      setError(null)
      setSuccess(false)
    }
  }, [open])

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(form.value)
    if (!form.catId) { setError('Select a cat.'); return }
    if (isNaN(num) || num <= 0) { setError('Enter a valid value.'); return }
    setSaving(true)
    setError(null)
    try {
      await createMeasurement(form.catId, {
        type: form.type,
        value: num,
        unit: form.unit,
        measured_at: new Date(form.measured_at).toISOString(),
        notes: null,
      })
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        onAdded?.()
      }, 800)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-brand-700 active:scale-95 transition-all z-40"
        aria-label="Quick add measurement"
      >
        +
      </button>

      {/* Backdrop + bottom sheet */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={handleBackdrop}
        >
          <div
            ref={sheetRef}
            className="w-full bg-white rounded-t-2xl p-5 pb-8 shadow-2xl"
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-gray-900 text-lg mb-4">Quick Add Measurement</h2>

            {success ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-green-600 font-medium">Saved!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cat</label>
                  <select
                    name="catId"
                    value={form.catId}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Select a cat…</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="weight">Weight</option>
                      <option value="food">Food</option>
                      <option value="water">Water</option>
                    </select>
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
                      placeholder="0.0"
                      className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                    <select
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {form.type === 'weight' && <><option value="lbs">lbs</option><option value="kg">kg</option></>}
                      {form.type === 'food' && <><option value="oz">oz</option><option value="g">g</option></>}
                      {form.type === 'water' && <><option value="oz">oz</option><option value="mL">mL</option></>}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time</label>
                  <input
                    name="measured_at"
                    type="datetime-local"
                    value={form.measured_at}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors mt-1"
                >
                  {saving ? 'Saving…' : 'Save Measurement'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
