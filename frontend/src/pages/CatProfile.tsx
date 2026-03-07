import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCat, getMeasurements, deleteMeasurement, getMedications, type Cat, type Measurement, type Medication } from '../lib/api'
import {
  assessHealth, STATUS_COLORS, STATUS_EMOJI, STATUS_LABEL,
} from '../lib/healthMetrics'
import WeightChart from '../components/WeightChart'
import MeasurementForm from '../components/MeasurementForm'
import MeasurementChart from '../components/MeasurementChart'
import InsightsPanel from '../components/InsightsPanel'
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDayLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface DayGroup {
  dateStr: string
  label: string
  items: Measurement[]
}

function groupByDay(measurements: Measurement[]): DayGroup[] {
  const map = new Map<string, Measurement[]>()
  for (const m of measurements) {
    const dateStr = m.measured_at.slice(0, 10)
    const bucket = map.get(dateStr) ?? []
    bucket.push(m)
    map.set(dateStr, bucket)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, items]) => ({
      dateStr,
      label: formatDayLabel(dateStr),
      items: items.sort((a, b) => b.measured_at.localeCompare(a.measured_at)),
    }))
}

const BEHAVIORAL_TYPES = new Set(['grooming', 'play', 'activity', 'vomiting', 'litter'])

const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', play: 'Play', activity: 'Activity',
  vomiting: 'Vomiting', litter: 'Litter Box',
}

type Tab = 'weight' | 'food' | 'water' | 'behavior' | 'all'

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

const FREQ_SHORT: Record<string, string> = {
  daily: 'daily', twice_daily: 'twice daily', weekly: 'weekly',
  monthly: 'monthly', custom: 'every N days',
}

function formatNextDue(nextDueAt: string | null | undefined): string {
  if (!nextDueAt) return 'No upcoming dose'
  const [datePart, timePart] = nextDueAt.split(' ')
  if (!datePart) return 'Upcoming'
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const [h, m] = (timePart ?? '09:00').split(':')
  const hour = parseInt(h ?? '9', 10)
  const minute = m ?? '00'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const timeStr = `${hour % 12 || 12}:${minute} ${ampm}`
  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === tomorrow) return `Tomorrow at ${timeStr}`
  const d = new Date(datePart + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

function MedicationsSection({ catId, meds }: { catId: string; meds: Medication[] }) {
  const [open, setOpen] = useState(false)
  if (meds.length === 0 && !open) {
    return (
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-ink-dim">No active medications</span>
        <Link
          to={`/cats/${catId}/medications/new`}
          className="text-xs font-semibold"
          style={{ color: '#c084fc' }}
        >
          + Add medication
        </Link>
      </div>
    )
  }

  const overdueCount = meds.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-mid">Medications</span>
          {meds.length > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#8b7fb0' }}
            >
              {meds.length}
            </span>
          )}
          {overdueCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
            >
              {overdueCount} overdue
            </span>
          )}
        </div>
        <span className="text-ink-dim text-sm">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {meds.map(med => (
            <Link
              key={med.id}
              to={`/medications/${med.id}/edit`}
              className="flex items-center justify-between py-3 px-1 rounded-xl transition-all"
              style={{ color: 'inherit' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink truncate">{med.name}</span>
                  {(med.overdue_count ?? 0) > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                      overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-dim mt-0.5">{FREQ_SHORT[med.frequency] ?? med.frequency} &middot; {formatNextDue(med.next_due_at)}</p>
                {med.dose && <p className="text-xs text-ink-dim">{med.dose}</p>}
              </div>
              <span className="text-ink-dim text-sm ml-3">→</span>
            </Link>
          ))}

          <Link
            to={`/cats/${catId}/medications/new`}
            className="flex items-center justify-center gap-1 w-full py-2.5 rounded-xl text-xs font-semibold transition-all mt-1"
            style={{ border: '1px dashed rgba(192,132,252,0.25)', color: '#8b7fb0' }}
          >
            + Add medication
          </Link>
        </div>
      )}
    </div>
  )
}

export default function CatProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cat, setCat] = useState<Cat | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [meds, setMeds] = useState<Medication[]>([])
  const [tab, setTab] = useState<Tab>('weight')
  const [showOlderHistory, setShowOlderHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id), getMedications(id)])
      .then(([c, m, mds]) => { setCat(c); setMeasurements(m); setMeds(mds) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Reset "show older" when tab changes
  useEffect(() => { setShowOlderHistory(false) }, [tab])

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

  const measurementsByType: Record<string, typeof measurements> = {}
  for (const m of measurements) {
    if (!measurementsByType[m.type]) measurementsByType[m.type] = []
    measurementsByType[m.type]!.push(m)
  }
  const availableTypes = Object.keys(measurementsByType)

  // Tab-filtered measurements for history
  const tabMeasurements = (() => {
    if (tab === 'all') return [...measurements]
    if (tab === 'behavior') return measurements.filter((m) => BEHAVIORAL_TYPES.has(m.type))
    return measurements.filter((m) => m.type === tab)
  })()

  // Group by day for history timeline
  const allDayGroups = groupByDay(tabMeasurements)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const recentGroups = allDayGroups.filter((g) => g.dateStr >= cutoff)
  const olderGroups = allDayGroups.filter((g) => g.dateStr < cutoff)
  const defaultGroups = recentGroups.length > 0 ? recentGroups : allDayGroups.slice(0, 3)
  const visibleGroups = showOlderHistory ? allDayGroups : defaultGroups
  const olderCount = olderGroups.reduce((sum, g) => sum + g.items.length, 0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'weight', label: 'Weight' },
    ...(typeSet.has('food') ? [{ key: 'food' as Tab, label: 'Food' }] : []),
    ...(typeSet.has('water') ? [{ key: 'water' as Tab, label: 'Water' }] : []),
    ...(hasBehavior ? [{ key: 'behavior' as Tab, label: 'Behavior' }] : []),
    ...(measurements.length > 0 ? [{ key: 'all' as Tab, label: 'All' }] : []),
  ]

  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'

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
          <Link to={`/cats/${cat.id}/export`} className="btn-ghost text-xs px-3 py-1.5">Export</Link>
          <Link to={`/cats/${cat.id}/edit`} className="btn-ghost text-xs px-3 py-1.5">Edit</Link>
        </div>

        <div className="flex items-center gap-5">
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
              {cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-') && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono text-ink-dim"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  title="Microchip ID">
                  # {cat.microchip_id.replace(/(.{3})/g, '$1 ').trim()}
                </span>
              )}
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
        {/* Insights panel — health alerts + correlations */}
        <InsightsPanel
          cat={cat}
          status={status}
          health={health}
          measurementsByType={measurementsByType}
          availableTypes={availableTypes}
          hasWeightData={weightMeasurements.length >= 2}
        />

        {/* Medications section */}
        <MedicationsSection catId={id!} meds={meds} />

        {/* Chart — follows active tab */}
        {(tab === 'weight' || tab === 'food' || tab === 'water') && (
          <div className="glass-card p-5 animate-slide-up opacity-0" style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}>
            {tab === 'weight' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-ink">Weight Over Time</h3>
                  <div className="flex gap-3 text-[10px] text-ink-dim">
                    {(['ok', 'watch', 'concerning', 'urgent'] as const).map((s) => (
                      <span key={s} className="flex items-center gap-1">
                        {STATUS_EMOJI[s]} {s}
                      </span>
                    ))}
                  </div>
                </div>
                <WeightChart measurements={weightMeasurements} />
              </>
            ) : (
              <>
                <h3 className="font-display font-semibold text-ink mb-4">
                  {tab === 'food' ? 'Food Intake' : 'Water Intake'} Over Time
                </h3>
                <MeasurementChart
                  measurements={measurements.filter((m) => m.type === tab).sort((a, b) => a.measured_at.localeCompare(b.measured_at))}
                  type={tab}
                />
              </>
            )}
          </div>
        )}

        {/* Add measurement */}
        {id && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

        {/* History — grouped timeline */}
        {measurements.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-ink mb-4">History</h3>

            {/* Type filter tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
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

            {/* Day-grouped entries */}
            {tabMeasurements.length === 0 ? (
              <p className="text-ink-dim text-sm text-center py-6">No {tab} measurements yet</p>
            ) : (
              <div className="space-y-5">
                {visibleGroups.map((group) => (
                  <div key={group.dateStr}>
                    {/* Day header */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-ink-dim">{group.label}</span>
                      <span className="text-[10px] text-ink-dim/60">
                        {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>

                    {/* Entries for this day */}
                    <div className="space-y-0.5">
                      {group.items.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between py-2.5 border-b last:border-0"
                          style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-ink-dim text-xs w-16 shrink-0 tabular-nums">{formatTime(m.measured_at)}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-ink tabular-nums">
                                {m.unit === 'scale' ? getPresetLabel(m.type, m.value) : `${m.value} ${m.unit}`}
                              </span>
                              {(tab === 'all' || tab === 'behavior') && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink-dim"
                                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  {TYPE_LABELS[m.type] ?? m.type}
                                </span>
                              )}
                              {m.notes && <span className="text-xs text-ink-dim">— {m.notes}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteMeasurement(m)}
                            className="text-xs text-rose/60 hover:text-rose transition-colors ml-3 shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Show older entries */}
                {!showOlderHistory && olderGroups.length > 0 && (
                  <button
                    onClick={() => setShowOlderHistory(true)}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl transition-all"
                    style={{
                      color: '#6b5f85',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    View {olderCount} older {olderCount === 1 ? 'entry' : 'entries'}
                  </button>
                )}
              </div>
            )}
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
