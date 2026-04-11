import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCat, getMeasurements, type Cat, type Measurement } from '../lib/api'
import { useGoBack } from '../hooks/useGoBack'
import {
  assessHealth, STATUS_COLORS, STATUS_LABEL,
  WATCH_ATTENTION, CONCERNING_ATTENTION, URGENT_VET_SIGNS,
} from '../lib/healthMetrics'
import { catAge } from '../lib/dates'

export default function CatHealthGuidance() {
  const { id } = useParams<{ id: string }>()
  const goBack = useGoBack(id ? `/cats/${id}` : '/')

  const [cat, setCat] = useState<Cat | null>(null)
  const [weightMs, setWeightMs] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id, 'weight')])
      .then(([c, m]) => { setCat(c); setWeightMs(m) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="skeleton h-6 w-24 rounded" />
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !cat) {
    return (
      <div className="px-4 pt-6">
        <div className="glass-card p-4 text-rose text-sm">{error ?? 'Cat not found'}</div>
      </div>
    )
  }

  const health = assessHealth(weightMs)
  const status = health.overallStatus
  const statusColor = STATUS_COLORS[status]
  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'

  const payAttentionItems = isConcerning || isUrgent
    ? [...WATCH_ATTENTION, ...CONCERNING_ATTENTION]
    : WATCH_ATTENTION

  const showVetNow = isConcerning || isUrgent

  const headerGradient = isUrgent
    ? 'linear-gradient(180deg, rgba(248,113,113,0.14) 0%, transparent 100%)'
    : isConcerning
    ? 'linear-gradient(180deg, rgba(249,115,22,0.12) 0%, transparent 100%)'
    : 'linear-gradient(180deg, rgba(251,191,36,0.1) 0%, transparent 100%)'

  const sectionBorder = isUrgent
    ? 'rgba(248,113,113,0.2)'
    : isConcerning
    ? 'rgba(249,115,22,0.2)'
    : 'rgba(251,191,36,0.15)'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-8" style={{ background: headerGradient }}>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-ink-dim hover:text-ink-mid transition-colors"
          >
            <span className="text-xl leading-none">←</span>
            <span className="text-sm">{cat.name}</span>
          </button>
          <Link
            to={`/cats/${cat.id}/export`}
            className="btn-ghost text-xs px-3 py-1.5"
          >
            Export for vet
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40` }}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-ink-dim text-xs">{catAge(cat.birthdate)}</span>
        </div>

        <h1 className="font-display font-bold text-xl text-ink leading-snug">
          {isUrgent
            ? `${cat.name}'s weight needs immediate attention`
            : isConcerning
            ? `${cat.name}'s weight trend is concerning`
            : `${cat.name}'s weight is worth watching`}
          {health.peakLossPct > 0 && (
            <span style={{ color: statusColor }}> — {health.peakLossPct}% below peak</span>
          )}
        </h1>

        <p className="text-ink-mid text-sm mt-2 leading-relaxed">{health.summary}</p>
      </div>

      <div className="px-4 space-y-4 pb-8">
        {/* Vet signs — shown first if urgent/concerning since it's the most time-sensitive */}
        {showVetNow && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(248,113,113,0.07)',
              border: `${isUrgent ? '2px' : '1px'} solid rgba(248,113,113,0.4)`,
              boxShadow: isUrgent ? '0 0 24px rgba(248,113,113,0.12)' : undefined,
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-4 text-rose">
              Go to the vet now if I see any of these
            </p>
            <ul className="space-y-3">
              {URGENT_VET_SIGNS.map((sign, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 text-rose font-bold text-sm mt-0.5">!</span>
                  <span className="text-sm text-ink-mid leading-snug">{sign}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pay attention to */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${sectionBorder}`,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: statusColor }}>
            Pay attention to
          </p>
          <ul className="space-y-3">
            {payAttentionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 text-sm mt-0.5" style={{ color: statusColor }}>·</span>
                <span className="text-sm text-ink-mid leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Reassurance / next step */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm text-ink-mid leading-relaxed">
            {isUrgent
              ? 'These thresholds are based on feline veterinary guidelines. A loss of more than 10% of body weight or a rate faster than 2%/week warrants prompt evaluation — not because something is definitely wrong, but because catching issues early makes a real difference.'
              : isConcerning
              ? "Cats are good at hiding discomfort. These behavioral signals can appear before weight loss becomes severe, which is exactly when intervention is most effective. If I'm seeing several of these, a vet visit is worthwhile even without an emergency."
              : "A mild weight change isn't always a problem — it could be a diet shift, seasonal variation, or measurement timing. The goal is to notice a trend early, not to panic at a single reading. Keep logging and see if the pattern continues."}
          </p>
        </div>

        {/* Back to profile */}
        <button
          onClick={goBack}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{ color: 'var(--color-ink-dim)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          ← Back to {cat.name}'s profile
        </button>
      </div>
    </div>
  )
}
