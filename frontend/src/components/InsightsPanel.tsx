import { useState } from 'react'
import type { Cat, Measurement } from '../lib/api'
import {
  STATUS_COLORS, WATCH_ATTENTION, CONCERNING_ATTENTION, URGENT_VET_SIGNS,
} from '../lib/healthMetrics'
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
  const statusNotOk = isUrgent || isConcerning || isWatch
  const showHealthAlert = statusNotOk && hasWeightData
  const showPayAttention = showHealthAlert && (isWatch || isConcerning || isUrgent)
  const showVetNow = showHealthAlert && (isConcerning || isUrgent)

  const payAttentionItems = isConcerning || isUrgent
    ? [...WATCH_ATTENTION, ...CONCERNING_ATTENTION]
    : WATCH_ATTENTION

  const correlations = availableTypes.length >= 2
    ? detectCorrelations(measurementsByType).filter((r) => r.strength !== 'none')
    : []

  const hasCorrelations = correlations.length > 0
  const hasInsights = showHealthAlert || hasCorrelations

  if (!hasInsights && availableTypes.length < 2) return null

  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#c084fc'

  // Panel tint: driven by most severe signal
  const panelBg = isUrgent
    ? 'rgba(248,113,113,0.08)'
    : isConcerning
    ? 'rgba(249,115,22,0.07)'
    : isWatch
    ? 'rgba(251,191,36,0.07)'
    : 'rgba(192,132,252,0.06)'

  const panelBorder = isUrgent
    ? `2px solid rgba(248,113,113,0.5)`
    : isConcerning
    ? `1.5px solid rgba(249,115,22,0.45)`
    : isWatch
    ? `1.5px solid rgba(251,191,36,0.35)`
    : `1px solid rgba(192,132,252,0.2)`

  const sectionDivider = { borderColor: isUrgent
    ? 'rgba(248,113,113,0.15)'
    : isConcerning
    ? 'rgba(249,115,22,0.15)'
    : isWatch
    ? 'rgba(251,191,36,0.12)'
    : 'rgba(255,255,255,0.06)',
  }

  const strengthDot = (s: string) =>
    s === 'notable'
      ? <span className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0" style={{ background: '#c084fc', marginTop: 2 }} />
      : <span className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0" style={{ background: '#fb923c', marginTop: 2 }} />

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: panelBg, border: panelBorder, boxShadow: isUrgent ? '0 0 32px rgba(248,113,113,0.15)' : undefined }}
    >
      {/* Health summary */}
      {showHealthAlert && (
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl shrink-0 mt-0.5 ${isUrgent ? 'animate-pulse' : ''}`}>
              {STATUS_ICON[status]}
            </span>
            <div>
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
        </div>
      )}

      {/* What to watch */}
      {showPayAttention && (
        <div className="px-4 py-3 border-t" style={sectionDivider}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: statusColor }}>
            Pay attention to
          </p>
          <ul className="space-y-1.5">
            {payAttentionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                <span className="shrink-0 text-xs mt-0.5" style={{ color: statusColor }}>·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vet signs */}
      {showVetNow && (
        <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-rose">
            Take to the vet if you see any of these
          </p>
          <ul className="space-y-1.5">
            {URGENT_VET_SIGNS.map((sign, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                <span className="shrink-0 text-rose text-xs mt-0.5">!</span>
                {sign}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detected patterns */}
      {availableTypes.length >= 2 && (
        <div className="px-4 py-3 border-t" style={sectionDivider}>
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
                <div key={`${r.typeA}-${r.typeB}`}>
                  <div className="flex items-start gap-0">
                    {strengthDot(r.strength)}
                    <p className="text-sm text-ink-mid leading-snug">
                      {describeCorrelation(r, cat.name)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Explore correlations (collapsible) */}
      {availableTypes.length >= 2 && (
        <div className="border-t" style={sectionDivider}>
          <button
            onClick={() => setExploreOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold transition-colors"
            style={{ color: '#6b5f85' }}
          >
            <span>Explore correlations</span>
            <span style={{ transform: exploreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'inline-block' }}>↓</span>
          </button>
          {exploreOpen && (
            <div className="px-4 pb-4">
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
