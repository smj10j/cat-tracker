import type { Measurement } from './api'

export type HealthStatus = 'ok' | 'watch' | 'concerning' | 'urgent'

export interface PeriodHealth {
  status: HealthStatus
  lbsChange: number       // absolute change from previous measurement
  changePercent: number   // % of previous weight
  changePerWeek: number   // % change per week (annualized to weekly rate)
  days: number
  direction: 'loss' | 'gain' | 'stable'
}

export interface HealthAssessment {
  overallStatus: HealthStatus
  // one entry per measurement; first entry is always null (no prior to compare)
  periods: (PeriodHealth | null)[]
  peakLossPct: number   // % lost from highest recorded weight
  summary: string       // human-readable explanation
}

// Thresholds based on feline veterinary literature:
//   - Clinically significant loss: >10% of body weight (vet urgently)
//   - Concerning loss: >5-7% of body weight
//   - Safe intentional loss rate: <1% body weight/week
//   - Concerning rate: 1-2%/week loss
//   - Urgent rate: >2%/week loss
//   - Rapid gain (>2%/week) can indicate fluid retention or other issues

function classifyRate(changePerWeek: number): HealthStatus {
  const loss = -changePerWeek // positive = losing weight
  if (loss >= 2) return 'urgent'
  if (loss >= 1) return 'concerning'
  if (loss >= 0.5) return 'watch'
  // gain side
  const gain = changePerWeek
  if (gain >= 3) return 'concerning'
  if (gain >= 1.5) return 'watch'
  return 'ok'
}

function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { ok: 0, watch: 1, concerning: 2, urgent: 3 }
  return rank[a] >= rank[b] ? a : b
}

export function assessHealth(measurements: Measurement[]): HealthAssessment {
  const sorted = [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at))

  if (sorted.length < 2) {
    return {
      overallStatus: 'ok',
      periods: sorted.map(() => null),
      peakLossPct: 0,
      summary: 'Not enough data to assess trend.',
    }
  }

  const values = sorted.map((m) => m.value)
  const peakWeight = Math.max(...values)
  const latestWeight = values[values.length - 1] ?? 0
  const peakLossPct = peakWeight > 0 ? ((peakWeight - latestWeight) / peakWeight) * 100 : 0

  const periods: (PeriodHealth | null)[] = [null]
  let overallStatus: HealthStatus = 'ok'

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!
    const days = Math.max(
      1,
      (new Date(curr.measured_at).getTime() - new Date(prev.measured_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const lbsChange = curr.value - prev.value
    const changePercent = prev.value > 0 ? (lbsChange / prev.value) * 100 : 0
    const changePerWeek = (changePercent / days) * 7

    const status = classifyRate(changePerWeek)
    overallStatus = worstStatus(overallStatus, status)

    periods.push({
      status,
      lbsChange: Math.round(lbsChange * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
      changePerWeek: Math.round(changePerWeek * 10) / 10,
      days: Math.round(days),
      direction: lbsChange < -0.05 ? 'loss' : lbsChange > 0.05 ? 'gain' : 'stable',
    })
  }

  // Also factor in total peak loss
  if (peakLossPct >= 10) overallStatus = worstStatus(overallStatus, 'urgent')
  else if (peakLossPct >= 7) overallStatus = worstStatus(overallStatus, 'concerning')
  else if (peakLossPct >= 4) overallStatus = worstStatus(overallStatus, 'watch')

  const roundedPeakLossPct = Math.round(peakLossPct * 10) / 10
  const summary = buildSummary(overallStatus, periods, roundedPeakLossPct, latestWeight, peakWeight)

  return { overallStatus, periods, peakLossPct: roundedPeakLossPct, summary }
}

function buildSummary(
  status: HealthStatus,
  periods: (PeriodHealth | null)[],
  peakLossPct: number,
  latestWeight: number,
  peakWeight: number
): string {
  const unit = 'lbs'
  const worstPeriod = periods
    .filter((p): p is PeriodHealth => p !== null)
    .sort((a, b) => Math.abs(b.changePerWeek) - Math.abs(a.changePerWeek))[0]

  if (status === 'ok') return 'Weight is stable. No concerns.'

  if (status === 'urgent') {
    if (peakLossPct >= 10)
      return `Lost ${peakLossPct}% of peak body weight (${(peakWeight - latestWeight).toFixed(1)} ${unit}). Veterinary evaluation is strongly recommended.`
    return `Fastest recorded rate: ${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week loss. This exceeds 2%/week — a threshold associated with hepatic lipidosis risk. Vet visit recommended.`
  }

  if (status === 'concerning') {
    if (peakLossPct >= 7)
      return `Lost ${peakLossPct}% from peak weight. Clinically significant loss — worth discussing with your vet.`
    return `Fastest rate: ${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week loss. Cats should not lose more than ~1% body weight per week without veterinary guidance.`
  }

  // watch
  if (worstPeriod?.direction === 'gain')
    return `Rapid weight gain detected (${worstPeriod.changePerWeek.toFixed(1)}%/week). Gaining >1.5%/week can indicate fluid retention or overfeeding.`
  return `Mild weight loss trend detected (${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week). Monitor closely and track future measurements.`
}

export const STATUS_COLORS: Record<HealthStatus, string> = {
  ok: '#22c55e',
  watch: '#eab308',
  concerning: '#f97316',
  urgent: '#ef4444',
}

export const STATUS_BG: Record<HealthStatus, string> = {
  ok: 'bg-green-50 border-green-200 text-green-800',
  watch: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  concerning: 'bg-orange-50 border-orange-200 text-orange-800',
  urgent: 'bg-red-50 border-red-200 text-red-800',
}

export const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Stable',
  watch: 'Watch',
  concerning: 'Concerning',
  urgent: 'Urgent',
}
