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

interface Props {
  measurements: Measurement[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function WeightChart({ measurements }: Props) {
  if (measurements.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No weight measurements yet. Add one below!
      </div>
    )
  }

  const data = measurements.map((m) => ({
    date: formatDate(m.measured_at),
    value: m.value,
    unit: m.unit,
    full_date: m.measured_at,
  }))

  const unit = measurements[0]?.unit ?? 'lbs'

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
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v} ${unit}`}
          width={60}
        />
        <Tooltip
          formatter={(value: number) => [`${value} ${unit}`, 'Weight']}
          labelStyle={{ color: '#374151', fontWeight: 600, fontSize: 12 }}
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#9333ea"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#9333ea', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
