import { useEffect, useRef, useState } from 'react'
import { createMeasurement, getCats, type Cat } from '../lib/api'

interface Props {
  onAdded?: () => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const UNITS_BY_TYPE: Record<string, string[]> = {
  weight: ['lbs', 'kg'],
  food: ['oz', 'g'],
  water: ['oz', 'mL'],
}
const DEFAULT_UNIT: Record<string, string> = { weight: 'lbs', food: 'oz', water: 'oz' }

export default function QuickAdd({ onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [cats, setCats] = useState<Cat[]>([])
  const [form, setForm] = useState({ catId: '', type: 'weight', value: '', unit: 'lbs', measured_at: toLocalDatetimeString(new Date()) })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cats.length === 0) {
      getCats().then((all) => {
        setCats(all)
        if (all.length === 1) setForm((f) => ({ ...f, catId: all[0]!.id }))
      })
    }
  }, [open, cats.length])

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, measured_at: toLocalDatetimeString(new Date()), value: '' }))
      setError(null)
      setSuccess(false)
    }
  }, [open])

  function handleBackdrop(e: React.MouseEvent) {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setOpen(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'type') {
      setForm((f) => ({ ...f, type: value, unit: DEFAULT_UNIT[value] ?? 'lbs' }))
    } else {
      setForm((f) => ({ ...f, [name]: value }))
    }
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
        type: form.type, value: num, unit: form.unit,
        measured_at: new Date(form.measured_at).toISOString(),
        notes: null,
      })
      setSuccess(true)
      setTimeout(() => { setOpen(false); setSuccess(false); onAdded?.() }, 900)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const unitOptions = UNITS_BY_TYPE[form.type] ?? ['lbs']

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(10,6,20,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={handleBackdrop}
        >
          <div
            ref={sheetRef}
            className="w-full animate-slide-up opacity-0"
            style={{
              background: '#2a2040',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
              animationFillMode: 'forwards',
            }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />

            <h2 className="font-display font-bold text-ink text-lg mb-5">Quick Add</h2>

            {success ? (
              <div className="text-center py-8">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  ✓
                </div>
                <p className="font-semibold text-jade">Saved!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="text-rose text-sm p-2.5 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)' }}>{error}</div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Cat</label>
                  <select name="catId" value={form.catId} onChange={handleChange} required
                    className="input-dark w-full px-3 py-3 text-sm">
                    <option value="">Select…</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
                    <select name="type" value={form.type} onChange={handleChange} className="input-dark w-full px-2 py-3 text-sm">
                      <option value="weight">Weight</option>
                      <option value="food">Food</option>
                      <option value="water">Water</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Value</label>
                    <input name="value" type="number" step="0.01" min="0" value={form.value} onChange={handleChange}
                      required placeholder="0.0" className="input-dark w-full px-2 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
                    <select name="unit" value={form.unit} onChange={handleChange} className="input-dark w-full px-2 py-3 text-sm">
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Date &amp; Time</label>
                  <input name="measured_at" type="datetime-local" value={form.measured_at} onChange={handleChange}
                    required className="input-dark w-full px-3 py-3 text-sm" />
                </div>

                <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-sm">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
