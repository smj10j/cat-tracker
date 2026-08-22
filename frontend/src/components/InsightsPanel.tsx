import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart, Line, XAxis, YAxis, ResponsiveContainer,
} from 'recharts'
import type { Cat, Measurement, AckRecord, AckSeverity } from '../lib/api'
import { STATUS_COLORS, STATUS_EMOJI, STATUS_LABEL } from '@shared/lib/healthMetrics'
import type { HealthAssessment } from '@shared/lib/healthMetrics'
import { detectCorrelations, describeCorrelation, detectConfluence, bucketByWeek, normalize } from '@shared/lib/correlations'
import type { CorrelationResult } from '@shared/lib/correlations'
import { applyAcknowledgment, assessmentDirection } from '@shared/lib/alertAck'
import { LIMITS } from '@shared/lib/constants'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatDate } from '@shared/lib/preferences'
import CorrelationChart from './CorrelationChart'

// SQLite 'YYYY-MM-DD HH:MM:SS' (UTC) -> ISO the Date constructor treats as UTC.
const toIso = (s: string) => (s.includes('T') ? s : s.replace(' ', 'T') + 'Z')

const STATUS_ICON: Record<string, string> = {
  watch: '👀', concerning: '⚠️', urgent: '🚨',
}

const MEAS_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', play: 'Play', activity: 'Activity',
  vomiting: 'Vomiting', litter: 'Litter Box',
}

function buildSparklineData(
  measA: Measurement[], measB: Measurement[],
): { week: string; a: number | null; b: number | null }[] {
  const bucketsA = bucketByWeek(measA)
  const bucketsB = bucketByWeek(measB)
  const normA = normalize(bucketsA.map(b => b.value))
  const normB = normalize(bucketsB.map(b => b.value))
  const mapA = new Map(bucketsA.map((b, i) => [b.weekKey, normA[i] ?? 0.5]))
  const mapB = new Map(bucketsB.map((b, i) => [b.weekKey, normB[i] ?? 0.5]))
  const allWeeks = [...new Set([...bucketsA.map(b => b.weekKey), ...bucketsB.map(b => b.weekKey)])].sort()
  return allWeeks.map(week => ({
    week,
    a: mapA.has(week) ? mapA.get(week)! : null,
    b: mapB.has(week) ? mapB.get(week)! : null,
  }))
}

function MiniSparkline({ correlation, measurementsByType }: {
  correlation: CorrelationResult
  measurementsByType: Record<string, Measurement[]>
}) {
  const { typeA, typeB } = correlation
  const data = useMemo(
    () => buildSparklineData(measurementsByType[typeA] ?? [], measurementsByType[typeB] ?? []),
    [measurementsByType, typeA, typeB],
  )
  if (data.length < 2) return null
  const labelA = MEAS_LABELS[typeA] ?? typeA
  const labelB = MEAS_LABELS[typeB] ?? typeB
  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-brand)' }} />
          <span className="text-xs text-ink-dim">{labelA}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
          <span className="text-xs text-ink-dim">{labelB}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="week" hide />
          <YAxis domain={[0, 1]} hide />
          <Line type="monotone" dataKey="a" stroke="var(--color-brand)" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="b" stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props {
  cat: Cat
  status: string
  health: HealthAssessment
  measurementsByType: Record<string, Measurement[]>
  availableTypes: string[]
  hasWeightData: boolean
  // Health-alert acknowledgment (PRD-alert-acknowledgment)
  acknowledgment?: AckRecord | null
  latestMeasuredAt: string
  onAcknowledge: (severity: AckSeverity, direction: 'loss' | 'gain', note: string) => Promise<void> | void
  onWithdraw: () => Promise<void> | void
}

export default function InsightsPanel({
  cat, status, health, measurementsByType, availableTypes, hasWeightData,
  acknowledgment, onAcknowledge, onWithdraw,
}: Props) {
  const { prefs } = usePreferences()
  const [patternsOpen, setPatternsOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [ackExpanded, setAckExpanded] = useState(false)
  const [ackNote, setAckNote] = useState('')
  const [ackSubmitting, setAckSubmitting] = useState(false)

  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'
  const isWatch = status === 'watch'
  const showHealthAlert = (isUrgent || isConcerning || isWatch) && hasWeightData

  // Suppression: when true, render the muted "acknowledged" state instead of the
  // full-intensity alert. A superseded/expired ack yields suppressed=false.
  const ackApplied = applyAcknowledgment(health, acknowledgment)
  const suppressed = ackApplied.suppressed

  async function handleConfirmAck() {
    setAckSubmitting(true)
    try {
      await onAcknowledge(status as AckSeverity, assessmentDirection(health), ackNote.trim())
      setAckExpanded(false)
      setAckNote('')
    } finally {
      setAckSubmitting(false)
    }
  }

  const correlations = availableTypes.length >= 2
    ? detectCorrelations(measurementsByType).filter((r) => r.strength !== 'none')
    : []

  const confluence = correlations.length >= 2
    ? detectConfluence(correlations, cat.name)
    : null

  // A real earlier loss that has since stopped no longer escalates the status, but the owner
  // should still be able to see it — otherwise the alert appears to have vanished for no reason.
  // Neutral styling: this is context, not an alert. See PRD-trend-window.
  const showResolvedLoss =
    hasWeightData && !showHealthAlert && health.lossStabilized && health.peakLossPct > 0

  const hasPatterns = availableTypes.length >= 2
  const hasInsights = showHealthAlert || showResolvedLoss || hasPatterns

  if (!hasInsights) return null

  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? 'var(--color-brand)'

  // When the alert is acknowledged, drop all tint/glow to a neutral surface.
  const panelBg = suppressed
    ? 'var(--color-card)'
    : isUrgent
    ? 'rgba(248,113,113,0.08)'
    : isConcerning
    ? 'rgba(249,115,22,0.07)'
    : isWatch
    ? 'rgba(251,191,36,0.07)'
    : 'rgba(192,132,252,0.06)'

  const panelBorder = suppressed
    ? '1px solid var(--color-rim)'
    : isUrgent
    ? '2px solid rgba(248,113,113,0.5)'
    : isConcerning
    ? '1.5px solid rgba(249,115,22,0.45)'
    : isWatch
    ? '1.5px solid rgba(251,191,36,0.35)'
    : '1px solid rgba(192,132,252,0.2)'

  const dividerColor = suppressed
    ? 'var(--color-rim)'
    : isUrgent
    ? 'rgba(248,113,113,0.15)'
    : isConcerning
    ? 'rgba(249,115,22,0.15)'
    : isWatch
    ? 'rgba(251,191,36,0.12)'
    : 'var(--color-rim)'

  const strengthDot = (s: string) => (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0 mt-1"
      style={{ background: s === 'notable' ? 'var(--color-brand)' : 'var(--color-accent)' }}
    />
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: panelBg, border: panelBorder, boxShadow: isUrgent && !suppressed ? '0 0 32px rgba(248,113,113,0.15)' : undefined }}
    >
      {/* Health headline — acknowledged (muted) state */}
      {showHealthAlert && suppressed && acknowledgment && (
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5 opacity-70">{STATUS_EMOJI[status as keyof typeof STATUS_EMOJI]}</span>
            <div className="flex-1">
              <p className="font-bold text-sm leading-snug mb-1 text-ink-mid">
                {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
                {health.peakLossPct > 0 && ` — ${health.peakLossPct}% below recent weight`}
              </p>
              <p className="text-ink-dim text-sm">{health.summary}</p>
            </div>
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-dim">
                {'\u{1F440}'} Acknowledged by {acknowledgment.acknowledged_by_name ?? 'a household member'}
                {' · '}{formatDate(toIso(acknowledgment.created_at), prefs)}
              </p>
              {acknowledgment.note && (
                <p className="text-xs text-ink-dim italic mt-0.5">&ldquo;{acknowledgment.note}&rdquo;</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onWithdraw()}
              className="text-xs text-ink-dim underline shrink-0 py-1"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Resolved loss — the decline stopped; shown as context, never as an alert */}
      {showResolvedLoss && (
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">{'\u2705'}</span>
            <div className="flex-1">
              <p className="font-bold text-sm leading-snug mb-1 text-ink">
                {cat.name}'s weight has stabilized
              </p>
              <p className="text-ink-mid text-sm">{health.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Health headline — full alert */}
      {showHealthAlert && !suppressed && (
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
                {health.peakLossPct > 0 && ` — ${health.peakLossPct}% below recent weight`}
              </p>
              <p className="text-ink-mid text-sm">{health.summary}</p>
            </div>
          </div>

          {/* "I'm on it" — acknowledge this alert */}
          {!ackExpanded ? (
            <button
              type="button"
              onClick={() => setAckExpanded(true)}
              className="mt-3 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              style={{ color: statusColor, background: `${statusColor}12`, border: `1px solid ${statusColor}30` }}
            >
              {'\u{1F440}'} I&apos;m on it
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                maxLength={LIMITS.ACK_NOTE}
                rows={2}
                placeholder="Add a note (optional) — what you're doing about it"
                className="w-full text-sm rounded-xl px-3 py-2 resize-none"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-ink)' }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmAck}
                  disabled={ackSubmitting}
                  className="text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                  style={{ color: '#fff', background: statusColor, opacity: ackSubmitting ? 0.6 : 1 }}
                >
                  {ackSubmitting ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAckExpanded(false); setAckNote('') }}
                  className="text-xs font-semibold px-3 py-2 rounded-xl text-ink-dim"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
              <p className="text-xs text-ink-dim mt-0.5">Behavioral signs, vet thresholds, and what this means</p>
            </div>
            <span className="text-sm ml-3 shrink-0" style={{ color: statusColor }}>→</span>
          </Link>

          {/* Wellness Guide link */}
          <Link
            to="/wellness"
            className="mt-2 flex items-center justify-between w-full px-4 py-3 min-h-[44px] rounded-xl transition-all"
            style={{
              background: 'rgba(192,132,252,0.06)',
              border: '1px solid rgba(192,132,252,0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🐾</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-brand)' }}>Cat Wellness Guide</span>
            </div>
            <span className="text-sm shrink-0" style={{ color: 'var(--color-brand)' }}>→</span>
          </Link>
        </div>
      )}

      {/* Patterns — collapsible row */}
      {hasPatterns && (
        <div className="border-t" style={{ borderColor: dividerColor }}>
          {/* Collapsed header / toggle */}
          <button
            onClick={() => setPatternsOpen((o) => !o)}
            aria-expanded={patternsOpen}
            aria-controls="insights-patterns-panel"
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left transition-colors"
          >
            <span className="text-sm shrink-0">&#128200;</span>
            <span className="text-xs font-semibold text-ink-mid flex-1">Patterns</span>

            {/* Count badge */}
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: correlations.length > 0 ? 'rgba(192,132,252,0.15)' : 'var(--color-card)',
                color: correlations.length > 0 ? 'var(--color-brand)' : 'var(--color-ink-dim)',
                border: correlations.length > 0 ? '1px solid rgba(192,132,252,0.25)' : '1px solid var(--color-rim)',
              }}
            >
              {correlations.length > 0 ? `${correlations.length} detected` : 'None yet'}
            </span>

            {/* Confluence pill — visible even when collapsed */}
            {confluence && !patternsOpen && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: 'rgba(249,115,22,0.12)',
                  color: 'var(--color-health-coral)',
                  border: '1px solid rgba(249,115,22,0.35)',
                }}
              >
                ⚠️ Multiple signals
              </span>
            )}

            <span
              className="text-ink-dim text-sm shrink-0 ml-1"
              style={{ transform: patternsOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'inline-block' }}
            >
              ↓
            </span>
          </button>

          {/* Expanded content */}
          {patternsOpen && (
            <div id="insights-patterns-panel" className="px-4 pb-4 space-y-3">
              {/* Confluence alert */}
              {confluence && (
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(249,115,22,0.08)',
                    border: '1.5px solid rgba(249,115,22,0.4)',
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-health-coral)' }}>
                    Multiple signals — {confluence.clusterName}
                  </p>
                  <p className="text-sm leading-snug" style={{ color: '#fdba74' }}>
                    {confluence.ownerMessage}
                  </p>
                </div>
              )}

              {/* Correlation descriptions */}
              {correlations.length === 0 ? (
                <p className="text-sm text-ink-dim">
                  No patterns detected yet — keep logging to see trends emerge.
                </p>
              ) : (
                <div className="space-y-4">
                  {correlations.map((r) => (
                    <div key={`${r.typeA}-${r.typeB}`}>
                      <div className="flex items-start gap-2">
                        {strengthDot(r.strength)}
                        <p className="text-sm text-ink-mid leading-snug">
                          {describeCorrelation(r, cat.name, cat.sex)}
                        </p>
                      </div>
                      <MiniSparkline correlation={r} measurementsByType={measurementsByType} />
                    </div>
                  ))}
                </div>
              )}

              {/* Explore chart — inside expanded patterns */}
              <div className="pt-1">
                <button
                  onClick={() => setExploreOpen((o) => !o)}
                  aria-expanded={exploreOpen}
                  aria-controls="insights-explore-panel"
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-all text-left"
                  style={{
                    background: exploreOpen ? 'rgba(192,132,252,0.12)' : 'rgba(192,132,252,0.07)',
                    border: '1px solid rgba(192,132,252,0.2)',
                  }}
                >
                  <span className="text-base shrink-0">&#128202;</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-brand)' }}>Explore measurement patterns</p>
                    <p className="text-xs text-ink-dim mt-0.5">Compare any two types to see how they relate over time</p>
                  </div>
                  <span
                    className="text-ink-dim text-sm shrink-0"
                    style={{ transform: exploreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'inline-block' }}
                  >
                    ↓
                  </span>
                </button>

                {exploreOpen && (
                  <div id="insights-explore-panel" className="mt-3">
                    <CorrelationChart
                      catName={cat.name}
                      catSex={cat.sex}
                      allMeasurements={measurementsByType}
                      availableTypes={availableTypes}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
