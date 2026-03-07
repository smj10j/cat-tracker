import { useEffect, useRef, useState } from 'react'
import { createMeasurement, getCats, type Cat } from '../lib/api'
import { PRESETS, PRESET_TYPES } from '../lib/measurementPresets'

interface Props {
  open: boolean
  onClose: () => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const TYPE_OPTIONS = [
  { value: 'weight',   label: 'Weight' },
  { value: 'food',     label: 'Food' },
  { value: 'water',    label: 'Water' },
  { value: 'litter',   label: 'Litter Box' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'activity', label: 'Activity' },
  { value: 'vomiting', label: 'Vomiting' },
]

export default function QuickAdd({ open, onClose }: Props) {
  const [cats, setCats] = useState<Cat[]>([])
  const [form, setForm] = useState({ catId: '', type: 'weight', value: '', unit: 'lbs', measured_at: toLocalDatetimeString(new Date()) })
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
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
      setSelectedPreset(null)
      setError(null)
      setSuccess(false)
    }
  }, [open])

  function handleBackdrop(e: React.MouseEvent) {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose()
  }

  function handleTypeChange(type: string) {
    setSelectedPreset(null)
    setForm((f) => ({ ...f, type, value: '', unit: PRESET_TYPES.has(type) ? 'scale' : 'lbs' }))
  }

  function handleCatChange(catId: string) {
    setForm((f) => ({ ...f, catId }))
  }

  async function submitMeasurement(value: number, unit: string) {
    if (!form.catId) { setError('Select a cat first.'); return }
    setSaving(true)
    setError(null)
    try {
      await createMeasurement(form.catId, {
        type: form.type, value, unit,
        measured_at: new Date(form.measured_at).toISOString(),
        notes: null,
      })
      setSuccess(true)
      window.dispatchEvent(new CustomEvent('measurementAdded'))
      setTimeout(() => { onClose(); setSuccess(false) }, 900)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePresetTap(presetValue: number) {
    setSelectedPreset(presetValue)
    await submitMeasurement(presetValue, 'scale')
  }

  async function handleWeightSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(form.value)
    if (isNaN(num) || num <= 0) { setError('Enter a valid weight.'); return }
    await submitMeasurement(num, form.unit)
  }

  const isPresetType = PRESET_TYPES.has(form.type)
  const presets = PRESETS[form.type] ?? []

  if (!open) return null

  return (
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

        <h2 className="font-display font-bold text-ink text-lg mb-5">Log Measurement</h2>

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
          <div className="space-y-4">
            {error && (
              <div className="text-rose text-sm p-2.5 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)' }}>{error}</div>
            )}

            {/* Cat selector */}
            <div>
              <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Cat</label>
              <select
                value={form.catId}
                onChange={(e) => handleCatChange(e.target.value)}
                className="input-dark w-full px-3 py-3 text-sm"
              >
                <option value="">Select…</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Type selector — horizontal scroll of pill buttons */}
            <div>
              <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">What to log</label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {TYPE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleTypeChange(value)}
                    className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: form.type === value ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.05)',
                      color: form.type === value ? '#c084fc' : '#6b5f85',
                      border: form.type === value ? '1px solid rgba(192,132,252,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input area */}
            {isPresetType ? (
              /* Preset tap buttons */
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
                        className="py-4 rounded-2xl text-sm font-semibold transition-all"
                        style={{
                          background: isSelected
                            ? (preset.concern ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.15)')
                            : 'rgba(255,255,255,0.05)',
                          border: isSelected
                            ? (preset.concern ? '1.5px solid rgba(248,113,113,0.5)' : '1.5px solid rgba(74,222,128,0.4)')
                            : '1px solid rgba(255,255,255,0.08)',
                          color: isSelected
                            ? (preset.concern ? '#f87171' : '#4ade80')
                            : '#ede9f6',
                        }}
                      >
                        {saving && isSelected ? '…' : preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Weight numeric input */
              <form onSubmit={handleWeightSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Weight</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.value}
                      onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                      placeholder="e.g. 9.4"
                      className="input-dark w-full px-3 py-3 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                      className="input-dark w-full px-2 py-3 text-sm"
                    >
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-sm">
                  {saving ? 'Saving…' : 'Save Weight'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
