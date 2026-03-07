import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getCats, getMeasurements, type Cat, type Measurement } from '../lib/api'

const COLORS = ['#9333ea', '#f97316', '#3b82f6', '#22c55e', '#ec4899', '#eab308']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

type ChartRow = { date: string; rawDate: string; [catName: string]: string | number | null }

function buildChartData(cats: Cat[], measurementsByCat: Map<string, Measurement[]>): ChartRow[] {
  // Collect all unique dates across all cats
  const dateMap = new Map<string, ChartRow>()

  for (const cat of cats) {
    const measurements = measurementsByCat.get(cat.id) ?? []
    for (const m of measurements) {
      const key = m.measured_at.slice(0, 10) // YYYY-MM-DD
      if (!dateMap.has(key)) {
        dateMap.set(key, { date: formatDate(m.measured_at), rawDate: key })
      }
      const row = dateMap.get(key)!
      row[cat.name] = m.value
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

export default function CompareChart() {
  const [cats, setCats] = useState<Cat[]>([])
  const [measurementsByCat, setMeasurementsByCat] = useState<Map<string, Measurement[]>>(new Map())
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCats()
      .then(async (allCats) => {
        setCats(allCats)
        setEnabled(new Set(allCats.map((c) => c.name)))
        const entries = await Promise.all(
          allCats.map((cat) =>
            getMeasurements(cat.id, 'weight').then((ms) => [cat.id, ms] as const)
          )
        )
        setMeasurementsByCat(new Map(entries))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleCat(name: string) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const chartData = buildChartData(cats, measurementsByCat)
  const unit = 'lbs'

  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Weight Comparison</h1>
      </header>

      {loading && <div className="text-center py-12 text-gray-400">Loading...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          {/* Toggles */}
          <div className="flex flex-wrap gap-2 mb-5">
            {cats.map((cat, i) => {
              const color = COLORS[i % COLORS.length]!
              const on = enabled.has(cat.name)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.name)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: color,
                    backgroundColor: on ? color : 'transparent',
                    color: on ? '#fff' : color,
                  }}
                >
                  <span>{cat.name}</span>
                </button>
              )
            })}
          </div>

          {chartData.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No measurements yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v} ${unit}`}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} ${unit}`, name]}
                  labelStyle={{ color: '#374151', fontWeight: 600, fontSize: 12 }}
                  contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {cats.map((cat, i) =>
                  enabled.has(cat.name) ? (
                    <Line
                      key={cat.id}
                      type="monotone"
                      dataKey={cat.name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
