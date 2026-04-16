import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { getCat, getMeasurements, type Cat, type Measurement } from '../lib/api'
import CatAvatar from '../components/CatAvatar'
import WeightChart from '../components/WeightChart'
import { assessHealth, STATUS_LABEL, STATUS_COLORS } from '@shared/lib/healthMetrics'
import { parseLocalDate, formatLocalDate } from '@shared/lib/dates'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatWeight as fmtWeight } from '@shared/lib/preferences'

function catLifespan(birthdate: string, deceasedAt: string): string {
  const birth = parseLocalDate(birthdate)
  const death = parseLocalDate(deceasedAt)
  const months =
    (death.getFullYear() - birth.getFullYear()) * 12 +
    (death.getMonth() - birth.getMonth())
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years} year${years !== 1 ? 's' : ''} and ${rem} month${rem !== 1 ? 's' : ''}` : `${years} year${years !== 1 ? 's' : ''}`
}

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>()
  const { prefs } = usePreferences()
  const goBack = useGoBack('/')
  const [cat, setCat] = useState<Cat | null>(null)
  const [weightMs, setWeightMs] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id, 'weight')]).then(([c, ms]) => {
      setCat(c)
      const sorted = [...ms].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      setWeightMs(sorted)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!cat) {
    return (
      <div className="px-4 pt-6 text-center text-ink-dim">
        <p>Cat not found.</p>
        <Link to="/" className="text-sm text-brand-400 mt-4 inline-block">Go home</Link>
      </div>
    )
  }

  const health = assessHealth(weightMs)
  const peakWeight = weightMs.length > 0 ? Math.max(...weightMs.map(m => m.value)) : null
  const peakUnit = weightMs.length > 0 ? (weightMs[weightMs.length - 1]?.unit ?? 'lbs') : 'lbs'

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div
        className="relative w-full flex flex-col items-center justify-end pb-8 pt-16"
        style={{ minHeight: '45vh', background: 'linear-gradient(to bottom, var(--color-bg) 0%, rgba(0,0,0,0) 100%)' }}
      >
        <button
          onClick={goBack}
          aria-label="Back"
          className="absolute top-6 left-4 flex items-center gap-2 text-sm text-ink-dim hover:text-ink-mid transition-colors z-10"
          style={{ background: 'var(--color-surface-hi)', border: '1px solid var(--color-rim)', borderRadius: '20px', padding: '6px 14px' }}
        >
          ← Back
        </button>

        <div
          className="w-28 h-28 rounded-full overflow-hidden mb-5"
          style={{ border: '3px solid var(--color-brand-glow)', filter: 'grayscale(0.4)' }}
        >
          <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={112} />
        </div>

        <p className="text-3xl font-bold text-ink mb-1" style={{ fontFamily: "'Fraunces', serif" }}>{cat.name}</p>
        <p className="text-sm text-ink-dim">🕊️</p>
        {cat.deceased_at && (
          <p className="text-sm text-ink-dim mt-1" style={{ fontFamily: "'Fraunces', serif" }}>
            {formatLocalDate(cat.birthdate)}
            {' — '}
            {formatLocalDate(cat.deceased_at)}
          </p>
        )}
        {cat.deceased_at && (
          <p className="text-xs text-ink-dim mt-0.5">
            {catLifespan(cat.birthdate, cat.deceased_at)} of life
          </p>
        )}
      </div>

      <div className="px-4 space-y-4 pb-20">
        {/* Memorial note */}
        {cat.memorial_note && (
          <div
            className="rounded-2xl px-5 py-4 text-center"
            style={{
              background: 'var(--color-brand-glow)',
              border: '1px solid var(--color-brand-glow)',
            }}
          >
            <p className="text-sm text-ink-mid leading-relaxed italic">"{cat.memorial_note}"</p>
          </div>
        )}

        {/* Life summary */}
        <div
          className="rounded-2xl px-5 py-4 space-y-3"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-card-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-dim">Life summary</p>
          <div className="grid grid-cols-2 gap-3">
            {cat.breed && (
              <div>
                <p className="text-xs text-ink-dim">Breed</p>
                <p className="text-sm font-semibold text-ink">{cat.breed}</p>
              </div>
            )}
            {weightMs.length > 0 && peakWeight !== null && (
              <div>
                <p className="text-xs text-ink-dim">Peak weight</p>
                <p className="text-sm font-semibold text-ink">{fmtWeight(peakWeight, peakUnit, prefs)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-ink-dim">Measurements logged</p>
              <p className="text-sm font-semibold text-ink">{weightMs.length}</p>
            </div>
            {health.overallStatus !== 'ok' && (
              <div>
                <p className="text-xs text-ink-dim">Last health status</p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: STATUS_COLORS[health.overallStatus] }}
                >
                  {STATUS_LABEL[health.overallStatus]}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible health record */}
        {weightMs.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-card-border)' }}
          >
            <button
              onClick={() => setHistoryOpen(o => !o)}
              aria-expanded={historyOpen}
              aria-controls="memorial-history-panel"
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <span className="text-sm shrink-0">📈</span>
              <span className="text-sm font-semibold text-ink flex-1">Weight history</span>
              <span
                className="text-ink-dim text-sm shrink-0"
                style={{ transform: historyOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'inline-block' }}
              >
                ↓
              </span>
            </button>
            {historyOpen && (
              <div id="memorial-history-panel" className="px-4 pb-4">
                <WeightChart measurements={weightMs} />
              </div>
            )}
          </div>
        )}

        {/* Edit link */}
        <Link
          to={`/cats/${cat.id}/edit`}
          className="flex items-center justify-center gap-2 w-full py-3 text-sm text-ink-dim rounded-xl transition-colors hover:text-ink-mid"
          style={{ border: '1px solid var(--color-rim)' }}
        >
          Edit memorial
        </Link>
      </div>
    </div>
  )
}
