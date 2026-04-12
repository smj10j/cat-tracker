import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  getCat, getMedication, createMedication, updateMedication, archiveMedication,
  type Cat, type Medication,
} from '../lib/api'
import { useGoBack } from '../hooks/useGoBack'
import { usePreferences } from '../contexts/PreferencesContext'

// ---------------------------------------------------------------------------
// Preset medications
// ---------------------------------------------------------------------------

interface Preset {
  name: string
  type: string
  frequency: string
  frequency_days?: number
  notes?: string
  category: string
}

const PRESETS: Preset[] = [
  // Prevention
  { name: 'Revolution', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical — part fur between shoulder blades', category: 'Prevention' },
  { name: 'Revolution Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical — part fur between shoulder blades', category: 'Prevention' },
  { name: 'Bravecto', type: 'flea', frequency: 'custom', frequency_days: 84, notes: 'Topical — lasts 12 weeks', category: 'Prevention' },
  { name: 'Advantage Multi', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Frontline Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Heartgard Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral chew — give with food', category: 'Prevention' },
  { name: 'Interceptor Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral', category: 'Prevention' },
  // Medication
  { name: 'Methimazole', type: 'pill', frequency: 'twice_daily', notes: 'Hyperthyroid — give with food', category: 'Medication' },
  { name: 'Prednisolone', type: 'pill', frequency: 'daily', notes: 'Steroid — give with food', category: 'Medication' },
  { name: 'Gabapentin', type: 'pill', frequency: 'daily', notes: 'Pain/anxiety', category: 'Medication' },
  { name: 'Cerenia', type: 'pill', frequency: 'daily', notes: 'Anti-nausea', category: 'Medication' },
  { name: 'Onsior', type: 'pill', frequency: 'daily', notes: 'NSAID pain relief — max 6 days', category: 'Medication' },
  { name: 'Mirataz', type: 'other', frequency: 'daily', notes: 'Transdermal — inner ear — appetite stimulant', category: 'Medication' },
  { name: 'Dewormer', type: 'other', frequency: 'custom', frequency_days: 90, category: 'Medication' },
  // Supplement
  { name: 'Lysine', type: 'supplement', frequency: 'daily', notes: 'Immune support', category: 'Supplement' },
  { name: 'Cobalamin (B12)', type: 'supplement', frequency: 'weekly', notes: 'GI support', category: 'Supplement' },
  { name: 'Fortiflora', type: 'supplement', frequency: 'daily', notes: 'Probiotic — sprinkle on food', category: 'Supplement' },
  // Vet
  { name: 'FVRCP vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Rabies vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Annual exam', type: 'exam', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Dental cleaning', type: 'dental', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Bloodwork', type: 'bloodwork', frequency: 'custom', frequency_days: 365, notes: 'Annual screening', category: 'Vet' },
]

const PRESET_CATEGORIES = ['Prevention', 'Medication', 'Supplement', 'Vet']

function formatFrequencyLabel(frequency: string, frequencyDays?: number): string {
  if (frequency === 'custom' && frequencyDays) {
    if (frequencyDays === 365) return 'Yearly'
    if (frequencyDays === 1095) return 'Every 3 years'
    if (frequencyDays >= 7 && frequencyDays % 7 === 0) return `Every ${frequencyDays / 7} weeks`
    return `Every ${frequencyDays} days`
  }
  return FREQ_LABELS[frequency] ?? frequency
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily (every 12h)',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom interval',
}

const TYPE_LABELS: Record<string, string> = {
  flea: 'Flea/Tick prevention',
  heartworm: 'Heartworm prevention',
  pill: 'Pill / Oral medication',
  vaccine: 'Vaccine',
  supplement: 'Supplement',
  dental: 'Dental cleaning',
  exam: 'Vet exam / Checkup',
  bloodwork: 'Bloodwork / Lab work',
  surgery: 'Surgery / Procedure',
  other: 'Other',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MedicationFormPage() {
  const navigate = useNavigate()
  const { catId, medId } = useParams<{ catId?: string; medId?: string }>()
  const goBack = useGoBack('/')
  const { prefs } = usePreferences()
  const isEdit = Boolean(medId)

  const [cat, setCat] = useState<Cat | null>(null)
  const [existing, setExisting] = useState<Medication | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const [showPresets, setShowPresets] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [type, setType] = useState('other')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [frequencyDays, setFrequencyDays] = useState('30')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [dosesTotal, setDosesTotal] = useState('')
  const [notes, setNotes] = useState('')
  const [dosesRemaining, setDosesRemaining] = useState('')
  const [refillThreshold, setRefillThreshold] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (isEdit && medId) {
          const med = await getMedication(medId)
          setExisting(med)
          setName(med.name)
          setType(med.type)
          setDose(med.dose ?? '')
          setFrequency(med.frequency)
          setFrequencyDays(String(med.frequency_days ?? 30))
          const rt = med.reminder_time
          const h = parseInt(rt.split(':')[0] ?? '9', 10)
          const m = parseInt(rt.split(':')[1] ?? '0', 10)
          const rounded = m >= 30 ? (h + 1) % 24 : h
          setReminderTime(`${String(rounded).padStart(2, '0')}:00`)
          setStartDate(med.start_date)
          setEndDate(med.end_date ?? '')
          setDosesTotal(med.doses_total != null ? String(med.doses_total) : '')
          setNotes(med.notes ?? '')
          setDosesRemaining(med.doses_remaining != null ? String(med.doses_remaining) : '')
          setRefillThreshold(med.refill_alert_threshold != null ? String(med.refill_alert_threshold) : '')
          // Load cat info for context
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

  function applyPreset(preset: Preset) {
    setName(preset.name)
    setType(preset.type)
    setFrequency(preset.frequency)
    if (preset.frequency_days) setFrequencyDays(String(preset.frequency_days))
    if (preset.notes) setNotes(preset.notes)
    setShowPresets(false)
  }

  function showError(msg: string) {
    setError(msg)
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { showError('Name is required'); return }
    if (!startDate) { showError('Start date is required'); return }

    const resolvedCatId = catId ?? existing?.cat_id
    if (!resolvedCatId) { showError('Cat is required'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        cat_id: resolvedCatId,
        name: name.trim(),
        type,
        dose: dose.trim() || null,
        frequency,
        frequency_days: frequency === 'custom' ? parseInt(frequencyDays, 10) || null : null,
        reminder_time: reminderTime,
        start_date: startDate,
        end_date: endDate || null,
        doses_total: dosesTotal ? parseInt(dosesTotal, 10) || null : null,
        notes: notes.trim() || null,
        doses_remaining: dosesRemaining ? parseInt(dosesRemaining, 10) || null : null,
        refill_alert_threshold: refillThreshold ? parseInt(refillThreshold, 10) || null : null,
      }

      if (isEdit && medId) {
        await updateMedication(medId, payload)
        // Navigate to care tab of the cat profile
        const targetCatId = catId ?? existing?.cat_id
        if (targetCatId) navigate(`/cats/${targetCatId}?tab=care`, { replace: true })
        else goBack()
      } else {
        const med = await createMedication(payload)
        // Navigate to care tab of the cat profile
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
          onClick={() => setShowPresets(v => !v)}
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
              id="med-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Revolution Plus" maxLength={200}
              className="input-dark w-full px-3 py-2.5 text-sm" required
            />
          </div>

          <div>
            <label htmlFor="med-type" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Type</label>
            <select id="med-type" value={type} onChange={e => setType(e.target.value)} className="input-dark w-full px-3 py-2.5 text-sm">
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="med-dose" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Dose amount</label>
            <input
              id="med-dose" value={dose} onChange={e => setDose(e.target.value)}
              placeholder="e.g. 2.5mg or 1 tube" maxLength={100}
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="med-notes" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Notes</label>
            <input
              id="med-notes" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Give with food" maxLength={1000}
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Schedule</h2>

          <div>
            <label htmlFor="med-frequency" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Frequency</label>
            <select id="med-frequency" value={frequency} onChange={e => setFrequency(e.target.value)} className="input-dark w-full px-3 py-2.5 text-sm">
              {Object.entries(FREQ_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {frequency === 'custom' && (
            <div>
              <label htmlFor="med-freq-days" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Interval (every {frequencyDays || '?'} days)</label>
              <input
                id="med-freq-days" type="number" min="1" max="3650"
                value={frequencyDays} onChange={e => setFrequencyDays(e.target.value)}
                className="input-dark w-full px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="med-start-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Start date</label>
              <input
                id="med-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="input-dark w-full px-3 py-2.5 text-sm" required
              />
            </div>
            <div>
              <label htmlFor="med-reminder-time" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Reminder time</label>
              <select
                id="med-reminder-time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
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

          <div>
            <label htmlFor="med-end-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
              Stop date <span className="font-normal normal-case text-ink-dim">(leave blank for ongoing)</span>
            </label>
            <input
              id="med-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="med-doses-total" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
              Course length <span className="font-normal normal-case text-ink-dim">(total doses, blank = ongoing)</span>
            </label>
            <input
              id="med-doses-total" type="number" min="1" value={dosesTotal} onChange={e => setDosesTotal(e.target.value)}
              placeholder="e.g. 14 for a 14-day course"
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.12)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid">Stock tracking <span className="font-normal normal-case text-ink-dim">(optional)</span></h2>

          <div>
            <label htmlFor="med-doses-remaining" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Doses currently in stock</label>
            <input
              id="med-doses-remaining" type="number" min="0" value={dosesRemaining} onChange={e => setDosesRemaining(e.target.value)}
              placeholder="e.g. 3"
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="med-refill-threshold" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
              Refill alert threshold <span className="font-normal normal-case text-ink-dim">(alert when stock falls to this)</span>
            </label>
            <input
              id="med-refill-threshold" type="number" min="1" value={refillThreshold} onChange={e => setRefillThreshold(e.target.value)}
              placeholder="e.g. 2"
              className="input-dark w-full px-3 py-2.5 text-sm"
            />
          </div>
        </div>

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
            style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            {deleting ? 'Archiving…' : 'Archive medication'}
          </button>
        )}
      </form>
    </div>
  )
}
