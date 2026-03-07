import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCat, getMeasurements, deleteMeasurement, type Cat, type Measurement } from '../lib/api'
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

export default function CatProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cat, setCat] = useState<Cat | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id, 'weight')])
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

  const latestWeight = [...measurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{cat.name}</h1>
        <Link
          to={`/cats/${cat.id}/edit`}
          className="text-sm text-brand-600 hover:underline font-medium"
        >
          Edit
        </Link>
      </header>

      {/* Cat info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
        <div className="text-5xl">🐱</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-xl">{cat.name}</h2>
          <p className="text-gray-500 text-sm">{catAge(cat.birthdate)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {cat.breed && (
              <span className="bg-brand-50 text-brand-700 text-xs px-2 py-1 rounded-full font-medium">
                {cat.breed}
              </span>
            )}
            {cat.coloring && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                {cat.coloring}
              </span>
            )}
            {latestWeight && (
              <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                {latestWeight.value} {latestWeight.unit}
              </span>
            )}
          </div>
          {cat.notes && (
            <p className="text-gray-500 text-sm mt-2 italic">{cat.notes}</p>
          )}
        </div>
      </div>

      {/* Weight chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Weight Over Time</h3>
        <WeightChart measurements={measurements} />
      </div>

      {/* Add measurement */}
      {id && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

      {/* Measurement history */}
      {measurements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Measurement History</h3>
          <div className="space-y-2">
            {[...measurements]
              .sort((a, b) => b.measured_at.localeCompare(a.measured_at))
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <span className="font-medium text-sm">
                      {m.value} {m.unit}
                    </span>
                    {m.notes && (
                      <span className="text-xs text-gray-400 ml-2">— {m.notes}</span>
                    )}
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
