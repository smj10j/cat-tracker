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
import { assessHealth, STATUS_COLORS, STATUS_LABEL, type PeriodHealth } from '../lib/healthMetrics'

const LINE_COLORS = ['#9333ea', '#f97316', '#3b82f6', '#ec4899', '#eab308', '#14b8a6']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

type ChartRow = { date: string; rawDate: string; [catName: string]: string | number | null }

function buildChartData(cats: Cat[], measurementsByCat: Map<string, Measurement[]>): ChartRow[] {
  const dateMap = new Map<string, ChartRow>()
  for (const cat of cats) {
    for (const m of measurementsByCat.get(cat.id) ?? []) {
      const key = m.measured_at.slice(0, 10)
      if (!dateMap.has(key)) dateMap.set(key, { date: formatDate(m.measured_at), rawDate: key })
      dateMap.get(key)![cat.name] = m.value
    }
  }
  return Array.from(dateMap.values()).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

// Map catId -> (dateKey -> health period for that point)
function buildHealthIndex(
  cats: Cat[],
  measurementsByCat: Map<string, Measurement[]>
): Map<string, Map<string, PeriodHealth | null>> {
  const result = new Map<string, Map<string, PeriodHealth | null>>()
  for (const cat of cats) {
    const ms = measurementsByCat.get(cat.id) ?? []
    const sorted = [...ms].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    const { periods } = assessHealth(sorted)
    const byDate = new Map<string, PeriodHealth | null>()
    sorted.forEach((m, i) => byDate.set(m.measured_at.slice(0, 10), periods[i] ?? null))
    result.set(cat.id, byDate)
  }
  return result
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
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const chartData = buildChartData(cats, measurementsByCat)
  const healthIndex = buildHealthIndex(cats, measurementsByCat)

  // Compute overall health per cat for toggle badge
  const healthByCat = new Map(
    cats.map((cat) => [cat.id, assessHealth(measurementsByCat.get(cat.id) ?? [])])
  )

  // Zoom Y-axis to visible data range
  const enabledValues = cats
    .filter((c) => enabled.has(c.name))
    .flatMap((c) => (measurementsByCat.get(c.id) ?? []).map((m) => m.value))
  const minVal = enabledValues.length ? Math.min(...enabledValues) : 0
  const maxVal = enabledValues.length ? Math.max(...enabledValues) : 10
  const padding = Math.max((maxVal - minVal) * 0.4, 0.5)
  const yDomain: [number, number] = [
    Math.max(0, parseFloat((minVal - padding).toFixed(1))),
    parseFloat((maxVal + padding).toFixed(1)),
  ]

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          {/* Toggles with health badges */}
          <div className="flex flex-wrap gap-2">
            {cats.map((cat, i) => {
              const lineColor = LINE_COLORS[i % LINE_COLORS.length]!
              const on = enabled.has(cat.name)
              const catHealth = healthByCat.get(cat.id)
              const healthColor = catHealth ? STATUS_COLORS[catHealth.overallStatus] : STATUS_COLORS.ok
              const healthLabel = catHealth ? STATUS_LABEL[catHealth.overallStatus] : 'Stable'
              const showBadge = catHealth && catHealth.overallStatus !== 'ok' && catHealth.periods.length >= 2

              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.name)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: lineColor,
                    backgroundColor: on ? lineColor : 'transparent',
                    color: on ? '#fff' : lineColor,
                  }}
                >
                  <span>{cat.name}</span>
                  {showBadge && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: on ? 'rgba(255,255,255,0.25)' : `${healthColor}20`,
                        color: on ? '#fff' : healthColor,
                      }}
                    >
                      {healthLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {chartData.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No measurements yet.</div>
          ) : (
            <>
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
                    domain={yDomain}
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
                  {cats.map((cat, i) => {
                    if (!enabled.has(cat.name)) return null
                    const catHealthMap = healthIndex.get(cat.id)
                    return (
                      <Line
                        key={cat.id}
                        type="monotone"
                        dataKey={cat.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2.5}
                        connectNulls
                        activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                        dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
                          const { cx, cy, index } = dotProps
                          if (cx == null || cy == null || index == null) return <g key={index} />
                          const row = chartData[index]
                          const period = row?.rawDate ? catHealthMap?.get(row.rawDate) : undefined
                          const dotColor = period !== undefined && period !== null
                            ? STATUS_COLORS[period.status]
                            : STATUS_COLORS.ok
                          return (
                            <circle
                              key={`dot-${cat.id}-${index}`}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill={dotColor}
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                          )
                        }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-gray-400 pt-1 border-t border-gray-50">
                <span className="font-medium text-gray-500 mr-1">Dot color:</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Stable</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Watch</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Concerning</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Urgent</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
