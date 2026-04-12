import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import type { Measurement } from '../lib/api'
import { getPresetLabel, getPresetTicks } from '../lib/measurementPresets'
import { useChartWindow, getTickFormatter, type TimeRange } from '../lib/useChartWindow'
import { usePreferences } from '../contexts/PreferencesContext'
import ChartRangeSelector from './ChartRangeSelector'
import SwipeableChart from './SwipeableChart'

interface Props {
  measurements: Measurement[]
  type: string
  showRangeSelector?: boolean
  fullScreen?: boolean
}

function CustomTooltip({ active, payload, label, type }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  type: string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]!.value
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
      <div style={{ color: 'var(--color-ink)', fontWeight: 700, fontSize: 15 }}>{getPresetLabel(type, value)}</div>
    </div>
  )
}

export default function MeasurementChart({ measurements, type, showRangeSelector = true, fullScreen = false }: Props) {
  const { prefs } = usePreferences()
  const { range, setRange, filteredData, navigate, hasOlderData, hasNewerData } = useChartWindow(measurements)
  const tickFormatter = getTickFormatter(range, prefs)

  if (measurements.length === 0) {
    return (
      <div className="text-center py-12 text-ink-dim text-sm">
        No {type} measurements yet — add one below
      </div>
    )
  }

  const ticks = getPresetTicks(type)
  const data = filteredData.map((m) => ({
    date: tickFormatter(m.measured_at),
    isoDate: m.measured_at,
    value: m.value,
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
        <ResponsiveContainer width="100%" height={fullScreen ? '100%' : 200}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="scaleLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
              <linearGradient id="scaleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-ink-dim)' }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 3]}
              ticks={[0, 1, 2, 3]}
              tick={{ fontSize: 10, fill: 'var(--color-ink-dim)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => ticks[v] ?? String(v)}
              width={56}
            />
            <Tooltip content={<CustomTooltip type={type} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#scaleLineGrad)"
              strokeWidth={2.5}
              fill="url(#scaleAreaGrad)"
              dot={(props: { cx?: number; cy?: number; index?: number }) => (
                <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill="#c084fc" style={{ stroke: 'var(--color-dot-ring)', strokeWidth: 2 }} />
              )}
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
