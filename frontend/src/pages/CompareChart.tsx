import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getCats, getMeasurements, type Cat, type Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, STATUS_EMOJI, STATUS_LABEL, type HealthStatus, type PeriodHealth } from '../lib/healthMetrics'
import { getPresetLabel, getPresetTicks, PRESET_TYPES } from '../lib/measurementPresets'

const LINE_COLORS = ['#c084fc', '#fb923c', '#60a5fa', '#f472b6', '#34d399', '#fbbf24']

const TYPE_OPTIONS = [
  { value: 'weight',   label: 'Weight' },
  { value: 'food',     label: 'Food' },
  { value: 'water',    label: 'Water' },
  { value: 'litter',   label: 'Litter Box' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'activity', label: 'Activity' },
  { value: 'vomiting', label: 'Vomiting' },
]

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

function WeightTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-tooltip-border)',
      borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(10px)',
      fontSize: 12, minWidth: 130,
    }}>
      <div style={{ color: 'var(--color-ink-mid)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4" style={{ marginBottom: 3 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span style={{ color: 'var(--color-ink-mid)', fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{p.value} lbs</span>
        </div>
      ))}
    </div>
  )
}

function ScaleTooltip({ active, payload, label, type }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
  type: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-tooltip-border)',
      borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(10px)',
      fontSize: 12, minWidth: 130,
    }}>
      <div style={{ color: 'var(--color-ink-mid)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4" style={{ marginBottom: 3 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span style={{ color: 'var(--color-ink-mid)', fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{getPresetLabel(type, p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CompareChart() {
  const [cats, setCats] = useState<Cat[]>([])
  const [measurementsByCat, setMeasurementsByCat] = useState<Map<string, Measurement[]>>(new Map())
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [selectedType, setSelectedType] = useState('weight')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCats()
      .then(async (allCats) => {
        setCats(allCats)
        setEnabled(new Set(allCats.map((c) => c.name)))
        await fetchMeasurements(allCats, 'weight')
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function fetchMeasurements(allCats: Cat[], type: string) {
    const entries = await Promise.all(
      allCats.map((cat) => getMeasurements(cat.id, type).then((ms) => [cat.id, ms] as const))
    )
    setMeasurementsByCat(new Map(entries))
  }

  async function handleTypeChange(type: string) {
    setSelectedType(type)
    setLoading(true)
    try {
      await fetchMeasurements(cats, type)
    } finally {
      setLoading(false)
    }
  }

  function toggleCat(name: string) {
    setEnabled((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const isWeightType = selectedType === 'weight'
  const isScaleType = PRESET_TYPES.has(selectedType)
  const scaleTicks = isScaleType ? getPresetTicks(selectedType) : []

  const chartData = buildChartData(cats, measurementsByCat)
  const healthIndex = isWeightType ? buildHealthIndex(cats, measurementsByCat) : new Map()
  const healthByCat = isWeightType
    ? new Map(cats.map((cat) => [cat.id, assessHealth(measurementsByCat.get(cat.id) ?? [])]))
    : new Map()

  const enabledValues = cats.filter((c) => enabled.has(c.name)).flatMap((c) => (measurementsByCat.get(c.id) ?? []).map((m) => m.value))
  const minVal = enabledValues.length ? Math.min(...enabledValues) : 0
  const maxVal = enabledValues.length ? Math.max(...enabledValues) : 10

  const yDomain: [number, number] = isScaleType
    ? [0, 3]
    : [
        Math.max(0, parseFloat((minVal - Math.max((maxVal - minVal) * 0.5, 0.5)).toFixed(1))),
        parseFloat((maxVal + Math.max((maxVal - minVal) * 0.5, 0.5)).toFixed(1)),
      ]

  return (
    <div className="min-h-screen px-4 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-ink-dim hover:text-ink-mid transition-colors text-xl">←</Link>
        <h1 className="font-display font-bold text-2xl text-ink flex-1">Compare</h1>
      </header>

      {error && <div className="glass-card p-4 text-rose text-sm">{error}</div>}

      {!error && (
        <div className="glass-card p-5 space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Measurement</label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm"
            >
              {TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="skeleton h-8 w-20 rounded-full" />)}
              </div>
              <div className="skeleton h-72 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {/* Cat toggle pills */}
              <div className="flex flex-wrap gap-2">
                {cats.map((cat, i) => {
                  const lineColor = LINE_COLORS[i % LINE_COLORS.length]!
                  const on = enabled.has(cat.name)
                  const catHealth = healthByCat.get(cat.id)
                  const healthStatus = (catHealth?.overallStatus ?? 'ok') as HealthStatus
                  const healthColor = STATUS_COLORS[healthStatus]
                  const showBadge = isWeightType && catHealth && healthStatus !== 'ok' && catHealth.periods.filter(Boolean).length > 0
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
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: `${healthColor}25`, color: healthColor }}>
                          {STATUS_EMOJI[healthStatus]} {STATUS_LABEL[healthStatus]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-16 text-ink-dim text-sm">No {selectedType} measurements yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 14, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b5f85' }} tickLine={false} axisLine={false} />
                      <YAxis
                        domain={yDomain}
                        ticks={isScaleType ? [0, 1, 2, 3] : undefined}
                        tick={{ fontSize: 10, fill: '#6b5f85' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => isScaleType ? (scaleTicks[v] ?? String(v)) : String(v)}
                        width={isScaleType ? 60 : 28}
                      />
                      <Tooltip content={isWeightType
                        ? <WeightTooltip />
                        : <ScaleTooltip type={selectedType} />}
                      />
                      {cats.map((cat, i) => {
                        if (!enabled.has(cat.name)) return null
                        const catHealthMap = healthIndex.get(cat.id)
                        const lineColor = LINE_COLORS[i % LINE_COLORS.length]!
                        return (
                          <Line
                            key={cat.id}
                            type="monotone"
                            dataKey={cat.name}
                            stroke={lineColor}
                            strokeWidth={2.5}
                            connectNulls
                            activeDot={(props: { cx?: number; cy?: number }) => (
                              <circle cx={props.cx} cy={props.cy} r={6} fill={lineColor} style={{ stroke: 'var(--color-dot-ring)', strokeWidth: 2 }} />
                            )}
                            dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
                              const { cx, cy, index } = dotProps
                              if (cx == null || cy == null || index == null) return <g key={index} />
                              if (isWeightType) {
                                const row = chartData[index]
                                const period = row?.rawDate ? catHealthMap?.get(row.rawDate) : undefined
                                const emoji = STATUS_EMOJI[(period?.status ?? 'ok') as HealthStatus]
                                return (
                                  <text key={`dot-${cat.id}-${index}`} x={cx} y={cy}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={12} style={{ userSelect: 'none' }}>
                                    {emoji}
                                  </text>
                                )
                              }
                              // Non-weight: plain dot in line color
                              return (
                                <g key={`dot-${cat.id}-${index}`}>
                                  <circle cx={cx} cy={cy} r={4} fill={lineColor} style={{ stroke: 'var(--color-dot-ring)', strokeWidth: 2 }} />
                                </g>
                              )
                            }}
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  {isWeightType && (
                    <div className="flex gap-4 text-xs text-ink-dim pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-ink-dim font-medium mr-1">Dots:</span>
                      {(['ok', 'watch', 'concerning', 'urgent'] as const).map((s) => (
                        <span key={s} className="flex items-center gap-1">
                          {STATUS_EMOJI[s]} {s}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
