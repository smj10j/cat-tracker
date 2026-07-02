import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  getCat, getMedication, createMedication, updateMedication, archiveMedication,
  type Cat,
} from '../lib/api'
import { useGoBack } from '../hooks/useGoBack'
import { usePreferences } from '../contexts/PreferencesContext'
import {
  MEDICATION_PRESETS as PRESETS,
  MEDICATION_PRESET_CATEGORIES as PRESET_CATEGORIES,
  MEDICATION_FREQ_LABELS,
  MEDICATION_TYPE_LABELS,
  formatFrequencyLabel,
  type MedicationPreset,
} from '@shared/lib/medicationPresets'
import {
  CARE_ITEM_DEFAULTS,
  hydrateFromMedication,
  applyPresetToFields,
  validateCareItem,
  buildCareItemPayload,
  defaultScheduleMode,
  scheduleModeApplies,
  isPastStartDate,
  type CareItemFields,
} from '@shared/lib/careItemForm'
import { isAsNeeded } from '@shared/lib/constants'
import { formatDate } from '@shared/lib/preferences'
import { formatDueAt } from '@shared/lib/formatting'
import type { MedicationDose } from '@shared/lib/types'

const SCHEDULE_MODE_OPTIONS = [
  {
    value: 'fixed',
    title: 'Stick to schedule',
    helper: 'Doses stay on the original calendar — e.g. the 1st of each month.',
  },
  {
    value: 'interval',
    title: 'Restart the interval',
    helper: 'Next dose is due one interval after you mark this one given — right for sub-q fluids.',
  },
]

// Extended labels for web where there's room for longer text
const FREQ_LABELS: Record<string, string> = {
  ...MEDICATION_FREQ_LABELS,
  twice_daily: 'Twice daily (every 12h)',
}

const TYPE_LABELS: Record<string, string> = {
  ...MEDICATION_TYPE_LABELS,
  flea: 'Flea/Tick prevention',
  heartworm: 'Heartworm prevention',
  pill: 'Pill / Oral medication',
  subq_fluids: 'Subcutaneous fluids',
  dental: 'Dental cleaning',
  exam: 'Vet exam / Checkup',
  bloodwork: 'Bloodwork / Lab work',
  surgery: 'Surgery / Procedure',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MedicationFormPage() {
  const navigate = useNavigate()
  const { catId, medId } = useParams<{ catId?: string; medId?: string }>()
  const goBack = useGoBack('/')
  const { prefs } = usePreferences()
  const errorRef = useRef<HTMLDivElement>(null)
  const isEdit = Boolean(medId)

  const [cat, setCat] = useState<Cat | null>(null)
  const [fields, setFields] = useState<CareItemFields>(CARE_ITEM_DEFAULTS)
  const [doses, setDoses] = useState<MedicationDose[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [firstDoseGiven, setFirstDoseGiven] = useState(true)

  const setField = <K extends keyof CareItemFields>(key: K, value: CareItemFields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  // Destructure for cleaner JSX
  const {
    name, type, dose, frequency, frequencyDays,
    reminderTime, startDate, endDate, dosesTotal,
    notes, dosesRemaining, refillThreshold, scheduleMode,
  } = fields
  const asNeeded = isAsNeeded(frequency)
  // Create-mode only: ask whether the first dose was already given for past start dates
  const showPastStartPrompt = !isEdit && !asNeeded && isPastStartDate(startDate)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (isEdit && medId) {
          const med = await getMedication(medId)
          setFields(hydrateFromMedication(med))
          setDoses(med.doses ?? [])
          const c = await getCat(med.cat_id)
          setCat(c)
        } else if (catId) {
          const c = await getCat(catId)
          setCat(c)
        }
      } catch (e: unknown) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isEdit, medId, catId])

  function applyPreset(preset: MedicationPreset) {
    setFields(prev => applyPresetToFields(prev, preset))
    setShowPresets(false)
  }

  function showError(msg: string) {
    setError(msg)
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const resolvedCatId = catId ?? cat?.id
    if (!resolvedCatId) { showError('Cat is required'); return }

    const validationError = validateCareItem(fields)
    if (validationError) { showError(validationError); return }

    const payload = buildCareItemPayload(
      fields,
      resolvedCatId,
      showPastStartPrompt ? firstDoseGiven : undefined,
    )

    setSaving(true)
    setError(null)
    try {
      if (isEdit && medId) {
        await updateMedication(medId, payload)
        const targetCatId = catId ?? cat?.id
        if (targetCatId) navigate(`/cats/${targetCatId}?tab=care`, { replace: true })
        else goBack()
      } else {
        const med = await createMedication(payload)
        navigate(`/cats/${med.cat_id}?tab=care`, { replace: true })
      }
    } catch (e: unknown) {
      showError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!medId) return
    if (!window.confirm(`Stop tracking ${name}? This will archive the medication schedule.`)) return
    setDeleting(true)
    try {
      await archiveMedication(medId)
      goBack()
    } finally {
      setDeleting(false)
    }
  }

  // Resolved doses (given / skipped / missed), most recent first
  const doseHistory = doses
    .filter(d => d.administered_at || d.skipped === 1 || d.missed === 1)
    .sort((a, b) => b.due_at.localeCompare(a.due_at))
    .slice(0, 10)

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="glass-card p-5 space-y-4">
          <div className="skeleton h-5 w-full rounded" />
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-5 w-1/2 rounded" />
        </div>
      </div>
    )
  }

  const backPath = cat ? `/cats/${cat.id}` : '/'

  return (
    <div className="min-h-screen px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to={backPath} className="text-ink-dim hover:text-ink text-lg leading-none flex items-center justify-center w-9 h-9">←</Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {isEdit ? 'Edit Care Item' : 'Add Care Item'}
          </h1>
          {cat && <p className="text-ink-dim text-sm mt-0.5">for {cat.name}</p>}
        </div>
      </div>

      {error && (
        <div ref={errorRef} className="mb-4 text-rose text-sm p-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)' }}>
          {error}
        </div>
      )}

      {/* Preset picker */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowPresets((v: boolean) => !v)}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-lavender transition-all"
          style={{ border: '1.5px solid rgba(192,132,252,0.4)', background: 'rgba(192,132,252,0.08)' }}
        >
          📋 {showPresets ? 'Hide presets' : 'Choose a preset medication'}
        </button>
        {showPresets && (
          <div
            className="mt-2 rounded-2xl p-3 space-y-3"
            style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.15)' }}
          >
            {PRESET_CATEGORIES.map(cat => (
              <div key={cat}>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-dim px-3 mb-1">{cat}</p>
                {PRESETS.filter(p => p.category === cat).map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-ink transition-all hover:bg-lavender-glow min-h-[44px]"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-ink-dim ml-2">
                      {p.notes ?? (TYPE_LABELS[p.type] ?? p.type)}
                      {' · '}
                      {formatFrequencyLabel(p.frequency, p.frequency_days)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Medication</h2>

          <div>
            <label htmlFor="med-name" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Name</label>
            <input
              id="med-name" value={name} onChange={e => setField("name", e.target.value)}
              placeholder="e.g. Revolution Plus" maxLength={200}
              className="input-dark w-full px-3 py-2.5 text-sm" required
            />
          </div>

          <div>
            <label htmlFor="med-type" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
            <select id="med-type" value={type} onChange={e => setField("type", e.target.value)} className="input-dark w-full px-3 py-2.5 text-sm">
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="med-dose" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Dose amount</label>
            <input
              id="med-dose" value={dose} onChange={e => setField("dose", e.target.value)}
              placeholder="e.g. 2.5mg or 1 tube" maxLength={100}
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="med-notes" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
              {asNeeded ? 'When to give' : 'Notes'}
            </label>
            <input
              id="med-notes" value={notes} onChange={e => setField("notes", e.target.value)}
              placeholder={asNeeded ? "e.g. If hiding or refusing food" : "e.g. Give with food"} maxLength={1000}
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
            {asNeeded && (
              <p className="text-xs text-ink-dim mt-1.5">
                Shown to sitters as the trigger for giving this medication.
              </p>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Schedule</h2>

          <div>
            <label htmlFor="med-frequency" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Frequency</label>
            <select
              id="med-frequency" value={frequency}
              onChange={e => {
                const f = e.target.value
                setFields(prev => ({ ...prev, frequency: f, scheduleMode: defaultScheduleMode(f) }))
              }}
              className="input-dark w-full px-3 py-2.5 text-sm"
            >
              {Object.entries(FREQ_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {asNeeded && (
              <p className="text-xs text-ink-dim mt-1.5">
                No reminders or overdue alerts for as-needed items.
              </p>
            )}
          </div>

          {!asNeeded && frequency === 'custom' && (
            <div>
              <label htmlFor="med-freq-days" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Interval (every {frequencyDays || '?'} days)</label>
              <input
                id="med-freq-days" type="number" min="1" max="3650"
                value={frequencyDays} onChange={e => setField("frequencyDays", e.target.value)}
                className="input-dark w-full px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {scheduleModeApplies(frequency) && (
            <div role="radiogroup" aria-label="After a dose is given">
              <span className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">After a dose is given</span>
              <div className="space-y-2">
                {SCHEDULE_MODE_OPTIONS.map(opt => {
                  const active = scheduleMode === opt.value
                  return (
                    <button
                      key={opt.value} type="button" role="radio" aria-checked={active}
                      onClick={() => setField("scheduleMode", opt.value)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                      style={{
                        background: active ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.03)',
                        border: active ? '1.5px solid rgba(192,132,252,0.5)' : '1px solid var(--color-rim)',
                      }}
                    >
                      <span className={`block text-sm font-semibold ${active ? 'text-lavender' : 'text-ink'}`}>{opt.title}</span>
                      <span className="block text-xs text-ink-dim mt-0.5">{opt.helper}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!asNeeded && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="med-start-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Start date</label>
                  <input
                    id="med-start-date" type="date" value={startDate} onChange={e => setField("startDate", e.target.value)}
                    className="input-dark w-full px-3 py-2.5 text-sm" required
                  />
                </div>
                <div>
                  <label htmlFor="med-reminder-time" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Reminder time</label>
                  <select
                    id="med-reminder-time" value={reminderTime} onChange={e => setField("reminderTime", e.target.value)}
                    className="input-dark w-full px-3 py-2.5 text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const v = `${String(i).padStart(2, '0')}:00`
                      if (prefs.timeFormat === '24h') {
                        return <option key={v} value={v}>{String(i).padStart(2, '0')}:00</option>
                      }
                      const h = i === 0 ? 12 : i > 12 ? i - 12 : i
                      const ap = i < 12 ? 'AM' : 'PM'
                      return <option key={v} value={v}>{h}:00 {ap}</option>
                    })}
                  </select>
                </div>
              </div>

              {showPastStartPrompt && (
                <div
                  className="rounded-xl p-3 space-y-2.5"
                  style={{ background: 'rgba(244,200,73,0.08)', border: '1px solid rgba(244,200,73,0.25)' }}
                >
                  <p className="text-xs text-ink-mid">
                    The start date is in the past. Did you already give the first dose on {formatDate(startDate, prefs)}?
                  </p>
                  <div className="flex gap-2" role="radiogroup" aria-label="First dose already given">
                    {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(({ v, l }) => {
                      const active = firstDoseGiven === v
                      return (
                        <button
                          key={l} type="button" role="radio" aria-checked={active}
                          onClick={() => setFirstDoseGiven(v)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${active ? 'text-lavender' : 'text-ink-dim'}`}
                          style={{
                            background: active ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.04)',
                            border: active ? '1px solid rgba(192,132,252,0.4)' : '1px solid var(--color-rim)',
                          }}
                        >
                          {l}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="med-end-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
                  Stop date <span className="font-normal normal-case text-ink-dim">(leave blank for ongoing)</span>
                </label>
                <input
                  id="med-end-date" type="date" value={endDate} onChange={e => setField("endDate", e.target.value)}
                  className="input-dark w-full px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="med-doses-total" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
                  Course length <span className="font-normal normal-case text-ink-dim">(total doses, blank = ongoing)</span>
                </label>
                <input
                  id="med-doses-total" type="number" min="1" value={dosesTotal} onChange={e => setField("dosesTotal", e.target.value)}
                  placeholder="e.g. 14 for a 14-day course"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                />
              </div>
            </>
          )}
        </div>

        {!asNeeded && (
          <div
            className="rounded-2xl p-5 space-y-5"
            style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Stock tracking <span className="font-normal normal-case text-ink-dim">(optional)</span></h2>

            <div>
              <label htmlFor="med-doses-remaining" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Doses currently in stock</label>
              <input
                id="med-doses-remaining" type="number" min="0" value={dosesRemaining} onChange={e => setField("dosesRemaining", e.target.value)}
                placeholder="e.g. 3"
                className="input-dark w-full px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="med-refill-threshold" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
                Refill alert threshold <span className="font-normal normal-case text-ink-dim">(alert when stock falls to this)</span>
              </label>
              <input
                id="med-refill-threshold" type="number" min="1" value={refillThreshold} onChange={e => setField("refillThreshold", e.target.value)}
                placeholder="e.g. 2"
                className="input-dark w-full px-3 py-2.5 text-sm"
              />
            </div>
          </div>
        )}

        {isEdit && doseHistory.length > 0 && (
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Dose history</h2>
            <div className="space-y-2">
              {doseHistory.map(d => {
                const status = d.administered_at
                  ? { label: 'Given', color: 'var(--color-health-jade)' }
                  : d.skipped === 1
                  ? { label: 'Skipped', color: 'var(--color-ink-dim)' }
                  : { label: 'Missed', color: 'var(--color-ink-dim)' }
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-xs text-ink-mid">{formatDueAt(d.due_at, prefs)}</span>
                    <span className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          type="submit" disabled={saving || deleting}
          className="btn-primary w-full py-3 text-sm font-semibold"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Care Item'}
        </button>

        {isEdit && (
          <button
            type="button" onClick={handleArchive} disabled={saving || deleting}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{ color: 'var(--color-health-rose)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            {deleting ? 'Archiving…' : 'Archive medication'}
          </button>
        )}
      </form>
    </div>
  )
}
