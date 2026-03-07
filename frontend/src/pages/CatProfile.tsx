import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCat, getMeasurements, deleteMeasurement, type Cat, type Measurement } from '../lib/api'
import { assessHealth, STATUS_BG, STATUS_LABEL, STATUS_COLORS } from '../lib/healthMetrics'
import WeightChart from '../components/WeightChart'
import MeasurementForm from '../components/MeasurementForm'

function catAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years} yr ${rem} mo old` : `${years} year${years !== 1 ? 's' : ''} old`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight',
  food: 'Food',
  water: 'Water',
}

type Tab = 'weight' | 'food' | 'water' | 'all'

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
      .then(([c, m]) => {
        setCat(c)
        setMeasurements(m)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDeleteMeasurement(m: Measurement) {
    if (!confirm('Delete this measurement?')) return
    try {
      await deleteMeasurement(m.id)
      setMeasurements((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  function handleMeasurementAdded(m: Measurement) {
    setMeasurements((prev) =>
      [...prev, m].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    )
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>
  if (error) return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
    </div>
  )
  if (!cat) return null

  const weightMeasurements = measurements.filter((m) => m.type === 'weight')
  const latestWeight = [...weightMeasurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]
  const health = assessHealth(weightMeasurements)

  // Determine which types have data (for tab visibility)
  const typeSet = new Set(measurements.map((m) => m.type))

  const tabMeasurements = tab === 'all'
    ? [...measurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
    : measurements.filter((m) => m.type === tab).sort((a, b) => b.measured_at.localeCompare(a.measured_at))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'weight', label: 'Weight' },
    ...(typeSet.has('food') ? [{ key: 'food' as Tab, label: 'Food' }] : []),
    ...(typeSet.has('water') ? [{ key: 'water' as Tab, label: 'Water' }] : []),
    ...(measurements.length > 0 ? [{ key: 'all' as Tab, label: 'All' }] : []),
  ]

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{cat.name}</h1>
        <Link to={`/cats/${cat.id}/edit`} className="text-sm text-brand-600 hover:underline font-medium">Edit</Link>
      </header>

      {/* Cat info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
        <div className="text-5xl">🐱</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-xl">{cat.name}</h2>
          <p className="text-gray-500 text-sm">{catAge(cat.birthdate)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {cat.breed && (
              <span className="bg-brand-50 text-brand-700 text-xs px-2 py-1 rounded-full font-medium">{cat.breed}</span>
            )}
            {cat.coloring && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">{cat.coloring}</span>
            )}
            {latestWeight && (
              <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                {latestWeight.value} {latestWeight.unit}
              </span>
            )}
            {weightMeasurements.length >= 2 && (
              <span
                className="text-xs px-2 py-1 rounded-full font-medium border"
                style={{ color: STATUS_COLORS[health.overallStatus], borderColor: STATUS_COLORS[health.overallStatus], backgroundColor: `${STATUS_COLORS[health.overallStatus]}15` }}
              >
                {STATUS_LABEL[health.overallStatus]}
              </span>
            )}
          </div>
          {cat.notes && <p className="text-gray-500 text-sm mt-2 italic">{cat.notes}</p>}
        </div>
      </div>

      {/* Health alert */}
      {weightMeasurements.length >= 2 && health.overallStatus !== 'ok' && (
        <div className={`rounded-xl border p-4 ${STATUS_BG[health.overallStatus]}`}>
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5">
              {health.overallStatus === 'urgent' ? '🚨' : health.overallStatus === 'concerning' ? '⚠️' : '👀'}
            </span>
            <div>
              <div className="font-semibold text-sm mb-1">
                Weight {STATUS_LABEL[health.overallStatus]}
                {health.peakLossPct > 0 && ` — ${health.peakLossPct}% below peak`}
              </div>
              <p className="text-sm">{health.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Weight chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">
          Weight Over Time
          <span className="ml-3 text-xs font-normal text-gray-400">dots colored by rate of change</span>
        </h3>
        <WeightChart measurements={weightMeasurements} />
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Stable</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Watch</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Concerning</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Urgent</span>
        </div>
      </div>

      {/* Add measurement */}
      {id && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

      {/* Measurement history with tabs */}
      {measurements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Measurement History</h3>

          {/* Tab bar */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {tabMeasurements.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No {tab} measurements yet.</p>
            )}
            {tabMeasurements.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium text-sm">{m.value} {m.unit}</span>
                  {tab === 'all' && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                  )}
                  {m.notes && <span className="text-xs text-gray-400 ml-2">— {m.notes}</span>}
                  <div className="text-xs text-gray-400">{formatDate(m.measured_at)}</div>
                </div>
                <button
                  onClick={() => handleDeleteMeasurement(m)}
                  className="text-xs text-red-400 hover:text-red-600 ml-4 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
