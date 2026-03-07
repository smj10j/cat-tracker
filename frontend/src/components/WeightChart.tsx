import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import type { Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, type PeriodHealth } from '../lib/healthMetrics'

interface Props {
  measurements: Measurement[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface DotProps {
  cx?: number; cy?: number; index?: number
  periods: (PeriodHealth | null)[]
}

function HealthDot({ cx, cy, index, periods }: DotProps) {
  if (cx == null || cy == null || index == null) return null
  const period = periods[index]
  const color = period ? STATUS_COLORS[period.status] : '#4ade80'
  return (
    <g>
      {/* Glow */}
      <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.15} />
      {/* Dot */}
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#16111f" strokeWidth={2} />
    </g>
  )
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { unit: string; period: PeriodHealth | null } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { value, payload: data } = payload[0]!
  const period = data.period
  const unit = data.unit

  return (
    <div style={{
      background: 'rgba(42,32,64,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(10px)',
      fontSize: 12,
    }}>
      <div style={{ color: '#a899c0', marginBottom: 4, fontSize: 11 }}>{label}</div>
      <div style={{ color: '#ede9f6', fontWeight: 700, fontSize: 16 }}>{value} {unit}</div>
      {period && period.direction !== 'stable' && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)', color: STATUS_COLORS[period.status] }}>
          {period.direction === 'loss' ? '▼' : '▲'} {Math.abs(period.lbsChange)} {unit} in {period.days}d
          <span style={{ color: '#6b5f85', marginLeft: 6 }}>{Math.abs(period.changePerWeek)}%/wk</span>
        </div>
      )}
    </div>
  )
}

export default function WeightChart({ measurements }: Props) {
  if (measurements.length === 0) {
    return (
      <div className="text-center py-12 text-ink-dim text-sm">
        No weight measurements yet — add one below
      </div>
    )
  }

  const { periods } = assessHealth(measurements)
  const unit = measurements[0]?.unit ?? 'lbs'
  const values = measurements.map((m) => m.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const padding = Math.max((maxVal - minVal) * 0.5, 0.5)
  const yDomain: [number, number] = [
    Math.max(0, parseFloat((minVal - padding).toFixed(1))),
    parseFloat((maxVal + padding).toFixed(1)),
  ]

  const data = measurements.map((m, i) => ({
    date: formatDate(m.measured_at),
    value: m.value,
    unit,
    period: periods[i] ?? null,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c084fc" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#6b5f85' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 10, fill: '#6b5f85' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}`}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          fill="url(#areaGrad)"
          dot={(props: DotProps) => <HealthDot key={props.index} {...props} periods={periods} />}
          activeDot={{ r: 7, fill: '#c084fc', stroke: '#16111f', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
