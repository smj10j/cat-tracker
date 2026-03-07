import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getCats, getMeasurements, type Cat, type Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, STATUS_LABEL, type PeriodHealth } from '../lib/healthMetrics'

const LINE_COLORS = ['#c084fc', '#fb923c', '#60a5fa', '#f472b6', '#34d399', '#fbbf24']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

function buildHealthIndex(cats: Cat[], measurementsByCat: Map<string, Measurement[]>) {
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

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(42,32,64,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(10px)',
      fontSize: 12,
      minWidth: 130,
    }}>
      <div style={{ color: '#a899c0', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4" style={{ marginBottom: 3 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span style={{ color: '#a899c0', fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: '#ede9f6', fontWeight: 600 }}>{p.value} lbs</span>
        </div>
      ))}
    </div>
  )
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
          allCats.map((cat) => getMeasurements(cat.id, 'weight').then((ms) => [cat.id, ms] as const))
        )
        setMeasurementsByCat(new Map(entries))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleCat(name: string) {
    setEnabled((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const chartData = buildChartData(cats, measurementsByCat)
  const healthIndex = buildHealthIndex(cats, measurementsByCat)
  const healthByCat = new Map(cats.map((cat) => [cat.id, assessHealth(measurementsByCat.get(cat.id) ?? [])]))

  const enabledValues = cats.filter((c) => enabled.has(c.name)).flatMap((c) => (measurementsByCat.get(c.id) ?? []).map((m) => m.value))
  const minVal = enabledValues.length ? Math.min(...enabledValues) : 0
  const maxVal = enabledValues.length ? Math.max(...enabledValues) : 10
  const padding = Math.max((maxVal - minVal) * 0.5, 0.5)
  const yDomain: [number, number] = [
    Math.max(0, parseFloat((minVal - padding).toFixed(1))),
    parseFloat((maxVal + padding).toFixed(1)),
  ]

  return (
    <div className="min-h-screen px-4 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-ink-dim hover:text-ink-mid transition-colors text-xl">←</Link>
        <h1 className="font-display font-bold text-2xl text-ink flex-1">Compare</h1>
      </header>

      {loading && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex gap-2">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-8 w-20 rounded-full" />)}
          </div>
          <div className="skeleton h-72 w-full rounded-xl" />
        </div>
      )}

      {error && (
        <div className="glass-card p-4 text-rose text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="glass-card p-5 space-y-5">
          {/* Toggle pills */}
          <div className="flex flex-wrap gap-2">
            {cats.map((cat, i) => {
              const lineColor = LINE_COLORS[i % LINE_COLORS.length]!
              const on = enabled.has(cat.name)
              const catHealth = healthByCat.get(cat.id)
              const healthStatus = catHealth?.overallStatus ?? 'ok'
              const healthColor = STATUS_COLORS[healthStatus]
              const showBadge = catHealth && healthStatus !== 'ok' && (catHealth.periods.filter(Boolean).length > 0)

              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.name)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
                  style={{
                    border: `1.5px solid ${lineColor}`,
                    background: on ? `${lineColor}22` : 'transparent',
                    color: on ? lineColor : '#6b5f85',
                  }}
                >
                  <span>{cat.name}</span>
                  {showBadge && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${healthColor}25`, color: healthColor }}
                    >
                      {STATUS_LABEL[healthStatus]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {chartData.length === 0 ? (
            <div className="text-center py-16 text-ink-dim text-sm">No measurements yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b5f85' }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 10, fill: '#6b5f85' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}`}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} />
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
                        activeDot={{ r: 6, stroke: '#16111f', strokeWidth: 2 }}
                        dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
                          const { cx, cy, index } = dotProps
                          if (cx == null || cy == null || index == null) return <g key={index} />
                          const row = chartData[index]
                          const period = row?.rawDate ? catHealthMap?.get(row.rawDate) : undefined
                          const dotColor = (period !== undefined && period !== null)
                            ? STATUS_COLORS[period.status]
                            : STATUS_COLORS.ok
                          return (
                            <g key={`dot-${cat.id}-${index}`}>
                              <circle cx={cx} cy={cy} r={7} fill={dotColor} opacity={0.15} />
                              <circle cx={cx} cy={cy} r={4} fill={dotColor} stroke="#16111f" strokeWidth={2} />
                            </g>
                          )
                        }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex gap-4 text-[10px] text-ink-dim pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-ink-dim font-medium mr-1">Dot:</span>
                {[{ label: 'Stable', color: '#4ade80' }, { label: 'Watch', color: '#fbbf24' }, { label: 'Concerning', color: '#f97316' }, { label: 'Urgent', color: '#f87171' }].map(({ label, color }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
