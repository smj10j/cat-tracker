import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCat, getMedications, CARE_TYPE_ICONS, type Cat, type Medication } from '../lib/api'
import { catAge } from '@shared/lib/dates'
import { formatSexNeuter, formatTimeFromParts, formatFreqShort } from '@shared/lib/formatting'
import { isAsNeeded } from '@shared/lib/constants'
import { usePreferences } from '../contexts/PreferencesContext'
import CatAvatar from '../components/CatAvatar'

/**
 * Sitter view — read-only, screenshot-friendly summary of everything a cat sitter
 * needs to know. No app chrome, no edit affordances, designed to fit in one
 * screenshot when shared.
 */
export default function SitterView() {
  const { id } = useParams<{ id: string }>()
  const { prefs } = usePreferences()
  const [cat, setCat] = useState<Cat | null>(null)
  const [meds, setMeds] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMedications(id)])
      .then(([c, m]) => { setCat(c); setMeds(m) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-dvh bg-night flex items-center justify-center">
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>
    )
  }

  if (error || !cat) {
    return (
      <div className="min-h-dvh bg-night px-6 py-12 text-center text-ink-dim text-sm">
        {error ?? 'Cat not found'}
        <div className="mt-6">
          <Link to={`/cats/${id ?? ''}`} className="text-brand text-sm font-semibold">← Back</Link>
        </div>
      </div>
    )
  }

  const scheduled = meds.filter(m => !isAsNeeded(m.frequency))
  const asNeeded = meds.filter(m => isAsNeeded(m.frequency))

  // Group scheduled meds by reminder time so the daily routine reads top-to-bottom
  const groups = new Map<string, Medication[]>()
  for (const m of scheduled) {
    const key = m.reminder_time || '09:00'
    const bucket = groups.get(key) ?? []
    bucket.push(m)
    groups.set(key, bucket)
  }
  const orderedTimes = [...groups.keys()].sort()

  return (
    <div className="min-h-dvh bg-night print:bg-white">
      {/* Print stylesheet — strip backgrounds for sane PDF output */}
      <style>{`
        @media print {
          body, .min-h-dvh { background: white !important; }
          .sitter-card { break-inside: avoid; box-shadow: none !important; border-color: #ccc !important; }
          .sitter-no-print { display: none !important; }
          .text-ink, .text-ink-dim, .text-ink-mid { color: #111 !important; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-12">
        {/* Top bar — hidden in print */}
        <div className="flex items-center justify-between mb-4 sitter-no-print">
          <Link to={`/cats/${cat.id}?tab=care`} className="text-ink-dim hover:text-ink text-sm">← Back</Link>
          <button
            onClick={() => window.print()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(192,132,252,0.1)', color: 'var(--color-brand)' }}
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Header card — cat identity */}
        <div className="sitter-card glass-card p-5 mb-4">
          <div className="flex items-center gap-4">
            <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={88} />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-ink truncate">{cat.name}</h1>
              <p className="text-sm text-ink-dim mt-1">{catAge(cat.birthdate)} · {formatSexNeuter(cat.sex, cat.is_neutered)}</p>
              {cat.breed && <p className="text-xs text-ink-dim mt-0.5">{cat.breed}{cat.coloring ? ` · ${cat.coloring}` : ''}</p>}
              {cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-') && (
                <p className="text-xs text-ink-dim mt-0.5 font-mono">
                  Chip: {cat.microchip_id.replace(/(.{3})/g, '$1 ').trim()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div className="sitter-card glass-card p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid mb-3">Daily Schedule</h2>
          {scheduled.length === 0 ? (
            <p className="text-sm text-ink-dim">No scheduled medications.</p>
          ) : (
            <div className="space-y-4">
              {orderedTimes.map(time => {
                const items = groups.get(time)!
                return (
                  <div key={time}>
                    <p className="text-sm font-semibold text-brand mb-1.5">
                      {formatTimeFromParts(time, prefs)}
                    </p>
                    <div className="space-y-2 pl-1">
                      {items.map(med => (
                        <div key={med.id} className="flex items-start gap-3">
                          <span className="text-base w-6 text-center shrink-0 mt-0.5">{CARE_TYPE_ICONS[med.type] ?? '📅'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-ink">
                              <span className="font-semibold">{med.name}</span>
                              {med.dose && <span className="text-ink-dim"> — {med.dose}</span>}
                              {med.frequency !== 'daily' && (
                                <span className="text-ink-dim text-xs"> ({formatFreqShort(med.frequency, med.frequency_days)})</span>
                              )}
                            </div>
                            {med.notes && <p className="text-xs text-ink-dim mt-0.5">{med.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* As Needed */}
        {asNeeded.length > 0 && (
          <div className="sitter-card glass-card p-5 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid mb-3">
              As Needed <span className="font-normal normal-case text-ink-dim">— only if triggered</span>
            </h2>
            <div className="space-y-3">
              {asNeeded.map(med => (
                <div key={med.id} className="flex items-start gap-3">
                  <span className="text-base w-6 text-center shrink-0 mt-0.5">{CARE_TYPE_ICONS[med.type] ?? '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink">
                      <span className="font-semibold">{med.name}</span>
                      {med.dose && <span className="text-ink-dim"> — {med.dose}</span>}
                    </div>
                    <p className="text-xs text-ink-dim mt-0.5">
                      {med.notes ? <><span className="font-semibold">Give if:</span> {med.notes}</> : 'As needed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {cat.notes && (
          <div className="sitter-card glass-card p-5 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mid mb-2">Care Notes</h2>
            <p className="text-sm text-ink whitespace-pre-wrap">{cat.notes}</p>
          </div>
        )}

        <p className="text-center text-[10px] text-ink-dim mt-4">Whisker Health · sitter view</p>
      </div>
    </div>
  )
}
