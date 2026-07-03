import { useEffect, useRef, useState } from 'react'
import { createMeasurement, getCats, type Cat } from '../lib/api'
import { PRESETS, PRESET_TYPES } from '@shared/lib/measurementPresets'
import { usePreferences } from '../contexts/PreferencesContext'
import { toLocalDatetimeString } from '@shared/lib/formatting'
import { VALID_MEASUREMENT_TYPES, MEASUREMENT_TYPE_LABELS } from '@shared/lib/constants'
import BcsPicker from './BcsPicker'

interface Props {
  open: boolean
  onClose: () => void
}

const TYPE_OPTIONS = VALID_MEASUREMENT_TYPES.map(value => ({ value, label: MEASUREMENT_TYPE_LABELS[value] ?? value }))

export default function QuickAdd({ open, onClose }: Props) {
  const { prefs } = usePreferences()
  const [cats, setCats] = useState<Cat[]>([])
  const [form, setForm] = useState({ catId: '', type: 'weight', value: '', unit: prefs.weightUnit, measured_at: toLocalDatetimeString(new Date()) })
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
    const scaleUnit = PRESET_TYPES.has(type) || type === 'bcs'
    setForm((f) => ({ ...f, type, value: '', unit: (scaleUnit ? 'scale' : prefs.weightUnit) as typeof f.unit }))
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
  const isBcsType = form.type === 'bcs'
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
        className="w-full animate-slide-up opacity-0 overflow-y-auto"
        style={{
          background: 'var(--color-surface-hi)',
          borderTop: '1px solid var(--color-rim)',
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          animationFillMode: 'forwards',
          maxHeight: '100dvh',
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

            {/* Type selector */}
            <div>
              <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">What to log</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="input-dark w-full px-3 py-3 text-sm"
              >
                {TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Input area */}
            {isBcsType ? (
              /* BCS 1–9 picker (select-then-save so the description is readable) */
              <div>
                <BcsPicker
                  value={selectedPreset}
                  onChange={(v) => { setSelectedPreset(v); setError(null) }}
                  disabled={saving}
                />
                {selectedPreset !== null && (
                  <button
                    type="button"
                    onClick={() => submitMeasurement(selectedPreset, 'scale')}
                    disabled={saving}
                    className="btn-primary w-full py-3.5 text-sm mt-3"
                  >
                    {saving ? 'Saving…' : 'Save Body Condition'}
                  </button>
                )}
              </div>
            ) : isPresetType ? (
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
                            ? (preset.concern ? 'var(--color-health-rose)' : 'var(--color-health-jade)')
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
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Unit</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as typeof f.unit }))}
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
