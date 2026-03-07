import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Cat, Measurement } from '../lib/api'
import { STATUS_COLORS } from '../lib/healthMetrics'
import type { HealthAssessment } from '../lib/healthMetrics'
import { detectCorrelations, describeCorrelation } from '../lib/correlations'
import CorrelationChart from './CorrelationChart'

const STATUS_ICON: Record<string, string> = {
  watch: '👀', concerning: '⚠️', urgent: '🚨',
}

interface Props {
  cat: Cat
  status: string
  health: HealthAssessment
  measurementsByType: Record<string, Measurement[]>
  availableTypes: string[]
  hasWeightData: boolean
}

export default function InsightsPanel({
  cat, status, health, measurementsByType, availableTypes, hasWeightData,
}: Props) {
  const [exploreOpen, setExploreOpen] = useState(false)

  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'
  const isWatch = status === 'watch'
  const showHealthAlert = (isUrgent || isConcerning || isWatch) && hasWeightData

  const correlations = availableTypes.length >= 2
    ? detectCorrelations(measurementsByType).filter((r) => r.strength !== 'none')
    : []

  const hasInsights = showHealthAlert || correlations.length > 0

  if (!hasInsights && availableTypes.length < 2) return null

  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#c084fc'

  const panelBg = isUrgent
    ? 'rgba(248,113,113,0.08)'
    : isConcerning
    ? 'rgba(249,115,22,0.07)'
    : isWatch
    ? 'rgba(251,191,36,0.07)'
    : 'rgba(192,132,252,0.06)'

  const panelBorder = isUrgent
    ? '2px solid rgba(248,113,113,0.5)'
    : isConcerning
    ? '1.5px solid rgba(249,115,22,0.45)'
    : isWatch
    ? '1.5px solid rgba(251,191,36,0.35)'
    : '1px solid rgba(192,132,252,0.2)'

  const dividerColor = isUrgent
    ? 'rgba(248,113,113,0.15)'
    : isConcerning
    ? 'rgba(249,115,22,0.15)'
    : isWatch
    ? 'rgba(251,191,36,0.12)'
    : 'rgba(255,255,255,0.06)'

  const strengthDot = (s: string) => (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0 mt-1"
      style={{ background: s === 'notable' ? '#c084fc' : '#fb923c' }}
    />
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: panelBg, border: panelBorder, boxShadow: isUrgent ? '0 0 32px rgba(248,113,113,0.15)' : undefined }}
    >
      {/* Health headline */}
      {showHealthAlert && (
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl shrink-0 mt-0.5 ${isUrgent ? 'animate-pulse' : ''}`}>
              {STATUS_ICON[status]}
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm leading-snug mb-1" style={{ color: statusColor }}>
                {isUrgent
                  ? `${cat.name}'s weight needs immediate attention`
                  : isConcerning
                  ? `${cat.name}'s weight trend is concerning`
                  : `${cat.name}'s weight is worth watching`}
                {health.peakLossPct > 0 && ` — ${health.peakLossPct}% below peak`}
              </p>
              <p className="text-ink-mid text-sm">{health.summary}</p>
            </div>
          </div>

          {/* CTA → health guidance page */}
          <Link
            to={`/cats/${cat.id}/health`}
            className="mt-3 flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all"
            style={{
              background: `${statusColor}12`,
              border: `1px solid ${statusColor}35`,
            }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: statusColor }}>
                What to watch for &amp; when to go to the vet
              </p>
              <p className="text-[10px] text-ink-dim mt-0.5">Behavioral signs, vet thresholds, and what this means</p>
            </div>
            <span className="text-sm ml-3 shrink-0" style={{ color: statusColor }}>→</span>
          </Link>
        </div>
      )}

      {/* Detected patterns */}
      {availableTypes.length >= 2 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: dividerColor }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3 text-ink-dim">
            Patterns detected
          </p>
          {correlations.length === 0 ? (
            <p className="text-sm text-ink-dim">
              No patterns detected yet — keep logging to see trends emerge.
            </p>
          ) : (
            <div className="space-y-3">
              {correlations.map((r) => (
                <div key={`${r.typeA}-${r.typeB}`} className="flex items-start gap-2">
                  {strengthDot(r.strength)}
                  <p className="text-sm text-ink-mid leading-snug">
                    {describeCorrelation(r, cat.name)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Explore correlations — prominent card toggle */}
      {availableTypes.length >= 2 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: dividerColor }}>
          <button
            onClick={() => setExploreOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
            style={{
              background: exploreOpen ? 'rgba(192,132,252,0.12)' : 'rgba(192,132,252,0.07)',
              border: '1px solid rgba(192,132,252,0.2)',
            }}
          >
            <span className="text-base shrink-0">&#128200;</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: '#c084fc' }}>Explore measurement patterns</p>
              <p className="text-[10px] text-ink-dim mt-0.5">Compare any two types to see how they relate over time</p>
            </div>
            <span
              className="text-ink-dim text-sm shrink-0"
              style={{ transform: exploreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'inline-block' }}
            >
              ↓
            </span>
          </button>

          {exploreOpen && (
            <div className="mt-3">
              <CorrelationChart
                catName={cat.name}
                allMeasurements={measurementsByType}
                availableTypes={availableTypes}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
