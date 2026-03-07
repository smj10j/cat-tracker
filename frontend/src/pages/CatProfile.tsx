import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCat, getMeasurements, deleteMeasurement, type Cat, type Measurement } from '../lib/api'
import {
  assessHealth, STATUS_COLORS, STATUS_LABEL,
  WATCH_ATTENTION, CONCERNING_ATTENTION, URGENT_VET_SIGNS,
} from '../lib/healthMetrics'
import WeightChart from '../components/WeightChart'
import MeasurementForm from '../components/MeasurementForm'
import { getPresetLabel } from '../lib/measurementPresets'

function catAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years} year${years !== 1 ? 's' : ''} old`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const BEHAVIORAL_TYPES = new Set(['grooming', 'play', 'activity', 'vomiting', 'litter'])

const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', play: 'Play', activity: 'Activity',
  vomiting: 'Vomiting', litter: 'Litter Box',
}

type Tab = 'weight' | 'food' | 'water' | 'behavior' | 'all'

const STATUS_DARK_BG: Record<string, string> = {
  ok: 'rgba(74,222,128,0.08)',
  watch: 'rgba(251,191,36,0.1)',
  concerning: 'rgba(249,115,22,0.1)',
  urgent: 'rgba(248,113,113,0.12)',
}
const STATUS_BORDER: Record<string, string> = {
  ok: 'rgba(74,222,128,0.25)',
  watch: 'rgba(251,191,36,0.4)',
  concerning: 'rgba(249,115,22,0.5)',
  urgent: 'rgba(248,113,113,0.6)',
}
const STATUS_ICON: Record<string, string> = {
  ok: '✓', watch: '👀', concerning: '⚠️', urgent: '🚨',
}

function SkeletonProfile() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="skeleton h-8 w-32 rounded mb-6" />
      <div className="glass-card p-6">
        <div className="flex gap-4 items-center">
          <div className="skeleton w-16 h-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
        </div>
      </div>
      <div className="glass-card p-6">
        <div className="skeleton h-4 w-24 rounded mb-4" />
        <div className="skeleton h-52 w-full rounded-lg" />
      </div>
    </div>
  )
}

export default function CatProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cat, setCat] = useState<Cat | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [tab, setTab] = useState<Tab>('weight')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id)])
      .then(([c, m]) => { setCat(c); setMeasurements(m) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDeleteMeasurement(m: Measurement) {
    if (!confirm('Delete this measurement?')) return
    try {
      await deleteMeasurement(m.id)
      setMeasurements((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e: unknown) { alert((e as Error).message) }
  }

  function handleMeasurementAdded(m: Measurement) {
    setMeasurements((prev) => [...prev, m].sort((a, b) => a.measured_at.localeCompare(b.measured_at)))
  }

  if (loading) return <SkeletonProfile />
  if (error) return (
    <div className="px-4 pt-6">
      <div className="glass-card p-4 text-rose text-sm">{error}</div>
    </div>
  )
  if (!cat) return null

  const weightMeasurements = measurements.filter((m) => m.type === 'weight')
  const latestWeight = [...weightMeasurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]
  const health = assessHealth(weightMeasurements)
  const status = health.overallStatus
  const statusColor = STATUS_COLORS[status]
  const typeSet = new Set(measurements.map((m) => m.type))
  const hasBehavior = [...typeSet].some((t) => BEHAVIORAL_TYPES.has(t))

  const tabMeasurements = (() => {
    if (tab === 'all') return [...measurements]
    if (tab === 'behavior') return measurements.filter((m) => BEHAVIORAL_TYPES.has(m.type))
    return measurements.filter((m) => m.type === tab)
  })().sort((a, b) => b.measured_at.localeCompare(a.measured_at))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'weight', label: 'Weight' },
    ...(typeSet.has('food') ? [{ key: 'food' as Tab, label: 'Food' }] : []),
    ...(typeSet.has('water') ? [{ key: 'water' as Tab, label: 'Water' }] : []),
    ...(hasBehavior ? [{ key: 'behavior' as Tab, label: 'Behavior' }] : []),
    ...(measurements.length > 0 ? [{ key: 'all' as Tab, label: 'All' }] : []),
  ]

  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'
  const isWatch = status === 'watch'
  const showPayAttention = isWatch || isConcerning || isUrgent
  const showVetNow = isConcerning || isUrgent
  const payAttentionItems = isConcerning || isUrgent
    ? [...WATCH_ATTENTION, ...CONCERNING_ATTENTION]
    : WATCH_ATTENTION

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div
        className="px-4 pt-6 pb-8"
        style={{
          background: isUrgent
            ? 'linear-gradient(180deg, rgba(248,113,113,0.12) 0%, transparent 100%)'
            : isConcerning
            ? 'linear-gradient(180deg, rgba(249,115,22,0.1) 0%, transparent 100%)'
            : 'linear-gradient(180deg, rgba(192,132,252,0.08) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-ink-dim hover:text-ink-mid transition-colors text-xl leading-none">←</button>
          <div className="flex-1" />
          <Link to={`/cats/${cat.id}/edit`} className="btn-ghost text-xs px-3 py-1.5">Edit</Link>
        </div>

        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shrink-0"
            style={{
              background: isUrgent
                ? 'linear-gradient(135deg, rgba(248,113,113,0.25) 0%, rgba(248,113,113,0.15) 100%)'
                : isConcerning
                ? 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.15) 100%)'
                : 'linear-gradient(135deg, rgba(192,132,252,0.25) 0%, rgba(251,146,60,0.2) 100%)',
              border: `2px solid ${status !== 'ok' ? statusColor + '60' : 'rgba(255,255,255,0.12)'}`,
              boxShadow: status !== 'ok' ? `0 0 24px ${statusColor}30` : '0 0 24px rgba(192,132,252,0.2)',
            }}
          >
            🐱
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-2xl text-ink leading-tight">{cat.name}</h1>
            <p className="text-ink-mid text-sm mt-0.5">{catAge(cat.birthdate)}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cat.breed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(192,132,252,0.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.2)' }}>
                  {cat.breed}
                </span>
              )}
              {cat.coloring && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-ink-mid"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {cat.coloring}
                </span>
              )}
            </div>
          </div>

          {/* Latest weight */}
          {latestWeight && (
            <div className="text-right shrink-0">
              <div className="font-display font-bold text-3xl tabular-nums" style={{ color: status !== 'ok' ? statusColor : '#fb923c' }}>
                {latestWeight.value}
              </div>
              <div className="text-ink-dim text-xs">{latestWeight.unit}</div>
              {weightMeasurements.length >= 2 && (
                <div
                  className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${isUrgent ? 'animate-pulse' : ''}`}
                  style={{ color: statusColor, background: `${statusColor}20`, border: `1px solid ${statusColor}50` }}
                >
                  {STATUS_LABEL[status]}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Health alert */}
        {weightMeasurements.length >= 2 && status !== 'ok' && (
          <div
            className="rounded-2xl p-4 animate-slide-up opacity-0 stagger-1"
            style={{
              background: STATUS_DARK_BG[status],
              border: `${isUrgent ? '2px' : '1px'} solid ${STATUS_BORDER[status]}`,
              boxShadow: isUrgent ? `0 0 32px ${statusColor}20` : undefined,
              animationFillMode: 'forwards',
            }}
          >
            <div className="flex items-start gap-3">
              <span className={`text-xl shrink-0 mt-0.5 ${isUrgent ? 'animate-pulse' : ''}`}>
                {STATUS_ICON[status]}
              </span>
              <div className="flex-1">
                <p className="font-bold text-sm mb-1" style={{ color: statusColor }}>
                  {isUrgent
                    ? `${cat.name}'s weight needs immediate attention`
                    : isConcerning
                    ? `${cat.name}'s weight trend is concerning`
                    : `${cat.name}'s weight is worth watching`}
                  {health.peakLossPct > 0 && ` — ${health.peakLossPct}% below peak`}
                </p>
                <p className="text-ink-mid text-sm">{health.summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pay attention to... */}
        {showPayAttention && weightMeasurements.length >= 2 && (
          <div
            className="rounded-2xl p-4 animate-slide-up opacity-0 stagger-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusColor}30`,
              animationFillMode: 'forwards',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: statusColor }}>
              Pay attention to...
            </p>
            <ul className="space-y-2">
              {payAttentionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                  <span className="shrink-0 text-xs mt-0.5" style={{ color: statusColor }}>·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Take to the vet NOW */}
        {showVetNow && weightMeasurements.length >= 2 && (
          <div
            className="rounded-2xl p-4 animate-slide-up opacity-0 stagger-3"
            style={{
              background: 'rgba(248,113,113,0.07)',
              border: `${isUrgent ? '2px' : '1px'} solid rgba(248,113,113,0.4)`,
              animationFillMode: 'forwards',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3 text-rose">
              🚨 Take to the vet NOW if you see any of these
            </p>
            <ul className="space-y-2">
              {URGENT_VET_SIGNS.map((sign, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                  <span className="shrink-0 text-rose text-xs mt-0.5">!</span>
                  {sign}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chart */}
        <div
          className="glass-card p-5 animate-slide-up opacity-0"
          style={{ animationDelay: showPayAttention ? '120ms' : '60ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink">Weight Over Time</h3>
            <div className="flex gap-3 text-[10px] text-ink-dim">
              {[
                { label: 'Stable', color: '#4ade80' },
                { label: 'Watch', color: '#fbbf24' },
                { label: 'Concern', color: '#f97316' },
                { label: 'Urgent', color: '#f87171' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <WeightChart measurements={weightMeasurements} />
        </div>

        {/* Add measurement */}
        {id && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

        {/* History */}
        {measurements.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-ink mb-4">History</h3>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={{
                    background: tab === key ? 'rgba(192,132,252,0.15)' : 'transparent',
                    color: tab === key ? '#c084fc' : '#6b5f85',
                    border: tab === key ? '1px solid rgba(192,132,252,0.25)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-0.5">
              {tabMeasurements.length === 0 && (
                <p className="text-ink-dim text-sm text-center py-6">No {tab} measurements yet</p>
              )}
              {tabMeasurements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink tabular-nums">{m.unit === 'scale' ? getPresetLabel(m.type, m.value) : `${m.value} ${m.unit}`}</span>
                      {(tab === 'all' || tab === 'behavior') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink-dim"
                          style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {TYPE_LABELS[m.type] ?? m.type}
                        </span>
                      )}
                      {m.notes && <span className="text-xs text-ink-dim">— {m.notes}</span>}
                    </div>
                    <div className="text-ink-dim text-xs mt-0.5">{formatDate(m.measured_at)}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteMeasurement(m)}
                    className="text-xs text-rose/60 hover:text-rose transition-colors ml-4 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {cat.notes && (
          <div className="glass-card px-5 py-4 text-ink-mid text-sm italic">
            {cat.notes}
          </div>
        )}
      </div>
    </div>
  )
}
