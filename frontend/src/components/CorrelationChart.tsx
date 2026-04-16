import { useMemo, useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { Measurement } from '../lib/api'
import { bucketByWeek, lagCorrelation, normalize, describeCorrelation, detectTrend, INPUT_TYPES, OUTCOME_TYPES } from '@shared/lib/correlations'
import type { CorrelationResult } from '@shared/lib/correlations'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatDateShort } from '@shared/lib/preferences'

const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', play: 'Play', activity: 'Activity',
  vomiting: 'Vomiting', litter: 'Litter Box',
}

interface Props {
  catName: string
  catSex?: string | null
  allMeasurements: Record<string, Measurement[]>
  availableTypes: string[]
}

function formatWeekKey(weekKey: string, prefs: import('@shared/lib/preferences').UserPreferences): string {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  return formatDateShort(weekStart.toISOString(), prefs)
}

type ChartPoint = {
  week: string
  label: string
  [key: string]: string | number | null
}

export default function CorrelationChart({ catName, catSex, allMeasurements, availableTypes }: Props) {
  const { prefs } = usePreferences()
  const typesWithData = availableTypes.filter((t) => (allMeasurements[t]?.length ?? 0) >= 2)

  const inputOptions = typesWithData.filter((t) => INPUT_TYPES.has(t))
  const outcomeOptions = typesWithData.filter((t) => OUTCOME_TYPES.has(t))

  // If no input or no outcome types are logged, we can't do constrained exploration
  const canExplore = inputOptions.length > 0 && outcomeOptions.length > 0

  const defaultA = inputOptions[0] ?? typesWithData[0] ?? 'food'
  const defaultB = outcomeOptions.includes('weight')
    ? 'weight'
    : outcomeOptions[0] ?? typesWithData.find((t) => t !== defaultA) ?? 'weight'

  const [typeA, setTypeA] = useState(defaultA)
  const [typeB, setTypeB] = useState(defaultB)

  const { chartData, result, description, needsMoreData } = useMemo(() => {
    const measA = allMeasurements[typeA] ?? []
    const measB = allMeasurements[typeB] ?? []

    const bucketsA = bucketByWeek(measA)
    const bucketsB = bucketByWeek(measB)

    // Build chart data across all weeks from both series
    const allWeeks = [...new Set([...bucketsA.map((b) => b.weekKey), ...bucketsB.map((b) => b.weekKey)])].sort()
    const mapA = new Map(bucketsA.map((b) => [b.weekKey, b.value]))
    const mapB = new Map(bucketsB.map((b) => [b.weekKey, b.value]))

    const normA = normalize(bucketsA.map((b) => b.value))
    const normB = normalize(bucketsB.map((b) => b.value))
    const normMapA = new Map(bucketsA.map((b, i) => [b.weekKey, normA[i] ?? 0.5]))
    const normMapB = new Map(bucketsB.map((b, i) => [b.weekKey, normB[i] ?? 0.5]))

    const chartData: ChartPoint[] = allWeeks.map((week) => ({
      week,
      label: formatWeekKey(week, prefs),
      [typeA]: normMapA.has(week) ? parseFloat(((normMapA.get(week) ?? 0) * 100).toFixed(1)) : null,
      [typeB]: normMapB.has(week) ? parseFloat(((normMapB.get(week) ?? 0) * 100).toFixed(1)) : null,
      [`${typeA}_raw`]: mapA.get(week) ?? null,
      [`${typeB}_raw`]: mapB.get(week) ?? null,
    }))

    // Aligned pairs for correlation
    const alignedA: number[] = []
    const alignedB: number[] = []
    for (const week of allWeeks) {
      if (mapA.has(week) && mapB.has(week)) {
        alignedA.push(mapA.get(week)!)
        alignedB.push(mapB.get(week)!)
      }
    }

    if (alignedA.length < 4) {
      const needed = 4 - alignedA.length
      return {
        chartData,
        result: null,
        description: `Keep logging both types — ${needed} more week${needed !== 1 ? 's' : ''} of overlapping data needed to detect patterns.`,
        needsMoreData: true,
      }
    }

    const { lag, r } = lagCorrelation(alignedA, alignedB)
    const absR = Math.abs(r)
    const strength: CorrelationResult['strength'] =
      absR >= 0.6 ? 'notable' : absR >= 0.3 ? 'weak' : 'none'
    const isHyperthyroidismPattern = typeA === 'food' && typeB === 'weight' && r < -0.5 && lag === 0

    const result: CorrelationResult = {
      typeA, typeB, lag, r,
      direction: r >= 0 ? 'positive' : 'negative',
      strength,
      isPredictive: false,
      isHyperthyroidismPattern,
      typeATrend: detectTrend(bucketsA),
      typeBTrend: detectTrend(bucketsB),
      dataWeeks: alignedA.length,
    }

    return {
      chartData,
      result,
      description: describeCorrelation(result, catName, catSex),
      needsMoreData: false,
    }
  }, [typeA, typeB, allMeasurements, catName, catSex, prefs])

  const strengthColor =
    result?.strength === 'notable' ? 'var(--color-brand)'
    : result?.strength === 'weak' ? 'var(--color-accent)'
    : '#4b4263'

  const selectStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--color-ink-mid)',
    borderRadius: '12px',
    padding: '8px 12px',
    fontSize: '14px',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  }

  if (!canExplore) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm text-ink-dim" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        Log behavioral measurements (food, water, grooming, activity) to explore how they relate to health outcomes like weight.
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <h3 className="font-display font-semibold text-ink mb-4">Trends</h3>

      {/* Constrained selectors: input → outcome */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-1.5">Input / behavior</p>
          <select
            value={typeA}
            onChange={(e) => setTypeA(e.target.value)}
            style={selectStyle}
          >
            {inputOptions.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <span className="text-ink-dim text-sm shrink-0 mt-4">→</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-1.5">Health outcome</p>
          <select
            value={typeB}
            onChange={(e) => setTypeB(e.target.value)}
            style={selectStyle}
          >
            {outcomeOptions.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-ink-dim)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div
                    className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: 'rgba(18,12,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div className="text-ink-dim mb-1.5">{label}</div>
                    {payload.map((p) => {
                      const raw = (p.payload as ChartPoint)[`${p.dataKey as string}_raw`]
                      const display = typeof raw === 'number' ? raw.toFixed(raw % 1 === 0 ? 0 : 1) : '—'
                      return (
                        <div key={p.dataKey as string} style={{ color: p.color as string }}>
                          {TYPE_LABELS[p.dataKey as string] ?? p.dataKey}: {display}
                        </div>
                      )
                    })}
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: 'var(--color-ink-dim)', paddingTop: 8 }}
              iconType="circle"
              iconSize={6}
            />
            <Line
              type="monotone"
              dataKey={typeA}
              name={TYPE_LABELS[typeA] ?? typeA}
              stroke="var(--color-brand)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey={typeB}
              name={TYPE_LABELS[typeB] ?? typeB}
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-40 flex items-center justify-center text-ink-dim text-sm">
          No data to display yet.
        </div>
      )}

      {/* Correlation insight */}
      <div
        className="mt-4 px-4 py-3 rounded-xl text-sm"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${strengthColor}40`,
        }}
      >
        {result?.strength === 'notable' && (
          <div
            className="text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: strengthColor }}
          >
            Notable pattern detected
          </div>
        )}
        {result?.strength === 'weak' && (
          <div
            className="text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: strengthColor }}
          >
            Weak pattern
          </div>
        )}
        <p className="text-ink-mid leading-relaxed" style={{ opacity: needsMoreData ? 0.6 : 1 }}>
          {description}
        </p>
      </div>
    </div>
  )
}
