import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, type PeriodHealth } from '../lib/healthMetrics'

interface Props {
  measurements: Measurement[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

interface DotProps {
  cx?: number
  cy?: number
  index?: number
  periods: (PeriodHealth | null)[]
}

function HealthDot({ cx, cy, index, periods }: DotProps) {
  if (cx == null || cy == null || index == null) return null
  const period = periods[index]
  const color = period ? STATUS_COLORS[period.status] : STATUS_COLORS.ok
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
}

interface TooltipPayload {
  value: number
  payload: { unit: string; period: PeriodHealth | null }
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { value, payload: data } = payload[0]!
  const period = data.period
  const unit = data.unit

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow text-xs space-y-1 max-w-[200px]">
      <div className="font-semibold text-gray-700">{label}</div>
      <div className="text-gray-900 font-bold">{value} {unit}</div>
      {period && (
        <div
          className="mt-1 pt-1 border-t border-gray-100"
          style={{ color: STATUS_COLORS[period.status] }}
        >
          {period.direction === 'loss' && `▼ ${Math.abs(period.lbsChange)} ${unit} in ${period.days}d`}
          {period.direction === 'gain' && `▲ ${period.lbsChange} ${unit} in ${period.days}d`}
          {period.direction === 'stable' && '→ Stable'}
          <div className="text-gray-400 mt-0.5">{Math.abs(period.changePerWeek)}%/week</div>
        </div>
      )}
    </div>
  )
}

export default function WeightChart({ measurements }: Props) {
  if (measurements.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No weight measurements yet. Add one below!
      </div>
    )
  }

  const { periods } = assessHealth(measurements)
  const unit = measurements[0]?.unit ?? 'lbs'
  const values = measurements.map((m) => m.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const padding = Math.max((maxVal - minVal) * 0.4, 0.5)
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
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#9333ea"
          strokeWidth={2.5}
          dot={(props: DotProps) => (
            <HealthDot key={props.index} {...props} periods={periods} />
          )}
          activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
