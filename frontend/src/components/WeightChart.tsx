import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import type { Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, STATUS_EMOJI, type PeriodHealth } from '../lib/healthMetrics'
import { useChartWindow, getTickFormatter, type TimeRange } from '../lib/useChartWindow'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatWeightValue, convertWeight } from '@shared/lib/preferences'
import ChartRangeSelector from './ChartRangeSelector'
import SwipeableChart from './SwipeableChart'

interface Props {
  measurements: Measurement[]
  showRangeSelector?: boolean
  fullScreen?: boolean
}

interface DotProps {
  cx?: number; cy?: number; index?: number
  periods: (PeriodHealth | null)[]
}

function HealthDot({ cx, cy, index, periods }: DotProps) {
  if (cx == null || cy == null || index == null) return null
  const period = periods[index]
  const status = period?.status ?? 'ok'
  const emoji = STATUS_EMOJI[status]
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={14}
      style={{ userSelect: 'none' }}
    >
      {emoji}
    </text>
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
      background: 'var(--color-tooltip-bg)',
      border: '1px solid var(--color-tooltip-border)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(10px)',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--color-ink-mid)', marginBottom: 4, fontSize: 11 }}>{label}</div>
      <div style={{ color: 'var(--color-ink)', fontWeight: 700, fontSize: 16 }}>{value} {unit}</div>
      {period && period.direction !== 'stable' && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-rim)', color: STATUS_COLORS[period.status] }}>
          {STATUS_EMOJI[period.status]} {period.direction === 'loss' ? '▼' : '▲'} {convertWeight(Math.abs(period.absoluteChange), 'lbs', unit === 'kg' ? 'kg' : 'lbs')} {unit} in {period.days}d
          <span style={{ color: 'var(--color-ink-dim)', marginLeft: 6 }}>{Math.abs(period.changePerWeek)}%/wk</span>
        </div>
      )}
    </div>
  )
}

export default function WeightChart({ measurements, showRangeSelector = true, fullScreen = false }: Props) {
  const { prefs } = usePreferences()
  const { range, setRange, filteredData, navigate, hasOlderData, hasNewerData } = useChartWindow(measurements)
  const tickFormatter = getTickFormatter(range, prefs)

  if (measurements.length === 0) {
    return (
      <div className="text-center py-12 text-ink-dim text-sm">
        No weight measurements yet — add one below
      </div>
    )
  }

  // Health assessment uses FULL measurements array (global context)
  const { periods: allPeriods } = assessHealth(measurements, undefined, prefs.weightUnit)

  // Build a map from measurement id to its period for lookup
  const periodByIndex = new Map<string, PeriodHealth | null>()
  measurements.forEach((m, i) => {
    periodByIndex.set(m.id, allPeriods[i] ?? null)
  })

  // Build periods array aligned to filteredData
  const filteredPeriods = filteredData.map(m => periodByIndex.get(m.id) ?? null)

  const displayUnit = prefs.weightUnit
  // Convert values to display unit for chart
  const convertedData = filteredData.map(m => ({
    ...m,
    displayValue: formatWeightValue(m.value, m.unit, prefs),
  }))
  const values = convertedData.map((m) => m.displayValue)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 10
  const padding = Math.max((maxVal - minVal) * 0.5, 0.5)
  const yDomain: [number, number] = [
    Math.max(0, parseFloat((minVal - padding).toFixed(1))),
    parseFloat((maxVal + padding).toFixed(1)),
  ]

  const data = convertedData.map((m) => ({
    date: tickFormatter(m.measured_at),
    isoDate: m.measured_at,
    value: m.displayValue,
    unit: displayUnit,
    period: periodByIndex.get(m.id) ?? null,
  }))

  return (
    <div>
      {showRangeSelector && (
        <ChartRangeSelector
          range={range}
          onRangeChange={(r: TimeRange) => setRange(r)}
          onNavigate={navigate}
          hasOlderData={hasOlderData}
          hasNewerData={hasNewerData}
        />
      )}
      <SwipeableChart
        onSwipeLeft={() => navigate('forward')}
        onSwipeRight={() => navigate('back')}
        enabled={range !== 'All'}
      >
        <ResponsiveContainer width="100%" height={fullScreen ? '100%' : 240}>
          <AreaChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 4 }}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-ink-dim)' }} tickLine={false} axisLine={false} />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 10, fill: 'var(--color-ink-dim)' }}
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
              dot={(props: DotProps) => <HealthDot key={props.index} {...props} periods={filteredPeriods} />}
              activeDot={(props: { cx?: number; cy?: number }) => (
                <circle cx={props.cx} cy={props.cy} r={7} fill="#c084fc" style={{ stroke: 'var(--color-dot-ring)', strokeWidth: 2 }} />
              )}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SwipeableChart>
    </div>
  )
}
