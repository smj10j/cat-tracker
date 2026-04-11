import type { Measurement } from './types'

export type HealthStatus = 'ok' | 'watch' | 'concerning' | 'urgent'

export interface PeriodHealth {
  status: HealthStatus
  lbsChange: number       // absolute change from previous measurement
  changePercent: number   // % of previous weight
  changePerWeek: number   // % change per week (annualized to weekly rate)
  days: number
  direction: 'loss' | 'gain' | 'stable'
  skipped: boolean        // true when interval gate fired (< 5 days) — period recorded but not classified
}

export interface HealthAssessment {
  overallStatus: HealthStatus
  // one entry per measurement; first entry is always null (no prior to compare)
  periods: (PeriodHealth | null)[]
  peakLossPct: number     // % lost from referencePeak
  referencePeak: number   // 90th-pct of last 180 days (falls back to all-time max if < 8 recent measurements)
  summary: string         // human-readable explanation
}

// Weight loss/gain thresholds — see docs/research/weight-thresholds.md for full citations.
//
// Rate-of-change thresholds (classifyRate):
//   >2%/week loss    → urgent     (hepatic lipidosis risk; AAFP Nutritional Guidelines;
//                                   Armstrong & Blanchard, VCNA 2009; WSAVA Nutrition Guidelines)
//   1.5–2%/week loss → concerning (exceeds safe intentional loss rate; WSAVA/AAFP Weight Mgmt Guidelines)
//   0.75–1.5%/week loss → watch   (above home-scale noise; see docs/research/weight-thresholds.md)
//   >3%/week gain    → concerning (fluid retention or metabolic dysfunction; AAFP Hyperthyroidism Guidelines)
//   2–3%/week gain   → watch
//
// Total-loss-from-peak thresholds (assessHealth):
//   >10% from peak → urgent     (clinically significant; Merck Vet Manual; JVIM; Ettinger & Feldman)
//   7–10% from peak → concerning (ISFM Feline Nutrition Guidelines)
//   4–7% from peak → watch      (conservative lower bound; AAFP guidance)
//
// Noise floor: changes < 1.5% relative OR < 0.2 lbs absolute are treated as scale noise.
// Consecutive-period requirement: a single non-ok period does not escalate overallStatus;
//   two consecutive non-ok periods in the same direction are required.

function classifyRate(changePerWeek: number): HealthStatus {
  const loss = -changePerWeek // positive = losing weight
  if (loss >= 2) return 'urgent'
  if (loss >= 1.5) return 'concerning'
  if (loss >= 0.75) return 'watch'
  // gain side
  const gain = changePerWeek
  if (gain >= 3) return 'concerning'
  if (gain >= 2) return 'watch'
  return 'ok'
}

function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { ok: 0, watch: 1, concerning: 2, urgent: 3 }
  return rank[a] >= rank[b] ? a : b
}

// 90th-percentile using nearest-rank method (ascending sort).
// For N=8: returns the max. For N=10: 2nd-highest. For N=20: 3rd-highest.
function percentile90(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * 0.9) - 1
  return sorted[Math.max(0, idx)]!
}

export function assessHealth(measurements: Measurement[]): HealthAssessment {
  const sorted = [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at))

  if (sorted.length < 2) {
    return {
      overallStatus: 'ok',
      periods: sorted.map(() => null),
      peakLossPct: 0,
      referencePeak: sorted[0]?.value ?? 0,
      summary: 'Not enough data to assess trend.',
    }
  }

  const values = sorted.map((m) => m.value)
  const peakWeight = Math.max(...values)
  const latestWeight = values[values.length - 1] ?? 0

  // Robust peak reference: 90th-pct of measurements in last 180 days.
  // Falls back to all-time max when fewer than 8 measurements exist in that window.
  const lastDate = new Date(sorted[sorted.length - 1]!.measured_at)
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - 180)
  const recentValues = sorted.filter(m => new Date(m.measured_at) >= cutoff).map(m => m.value)
  const referencePeak = recentValues.length >= 8 ? percentile90(recentValues) : peakWeight

  const peakLossPct = referencePeak > 0 ? ((referencePeak - latestWeight) / referencePeak) * 100 : 0

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

    const periodBase = {
      lbsChange: Math.round(lbsChange * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
      changePerWeek: Math.round(changePerWeek * 10) / 10,
      days: Math.round(days),
      direction: (lbsChange < -0.05 ? 'loss' : lbsChange > 0.05 ? 'gain' : 'stable') as PeriodHealth['direction'],
    }

    // Interval gate: < 5 days between measurements → mark skipped, do not classify
    if (days < 5) {
      periods.push({ ...periodBase, status: 'ok', skipped: true })
      continue
    }

    // Noise floor: change < 1.5% of previous weight OR < 0.2 lbs absolute
    // is within home-scale accuracy / biological variation.
    // See docs/research/weight-thresholds.md "Home scale measurement accuracy".
    const absChangePct = Math.abs(lbsChange) / prev.value
    if (absChangePct < 0.015 || Math.abs(lbsChange) < 0.2) {
      periods.push({ ...periodBase, status: 'ok', skipped: false })
      continue
    }

    const status = classifyRate(changePerWeek)
    periods.push({ ...periodBase, status, skipped: false })
  }

  // Consecutive-period requirement: a single non-ok period does not escalate overallStatus.
  // Two consecutive non-ok periods in the same direction are required to confirm a trend.
  // This filters oscillation noise (e.g. ±0.2 lbs week-to-week on home scales).
  let prevNonSkippedPeriod: PeriodHealth | null = null
  for (const p of periods) {
    if (p === null || p.skipped) continue
    if (p.status === 'ok') { prevNonSkippedPeriod = p; continue }
    // p.status is non-ok here; only escalate if previous was also non-ok in same direction
    if (prevNonSkippedPeriod !== null && prevNonSkippedPeriod.status !== 'ok'
        && prevNonSkippedPeriod.direction === p.direction) {
      overallStatus = worstStatus(overallStatus, p.status)
    }
    prevNonSkippedPeriod = p
  }

  // Factor in total loss from recent baseline (unconditional — cumulative loss IS a trend)
  const roundedPeakLossPct = Math.round(peakLossPct * 10) / 10
  if (roundedPeakLossPct >= 10) overallStatus = worstStatus(overallStatus, 'urgent')
  else if (roundedPeakLossPct >= 7) overallStatus = worstStatus(overallStatus, 'concerning')
  else if (roundedPeakLossPct >= 4) overallStatus = worstStatus(overallStatus, 'watch')

  const summary = buildSummary(overallStatus, periods, roundedPeakLossPct, latestWeight, referencePeak)

  return { overallStatus, periods, peakLossPct: roundedPeakLossPct, referencePeak, summary }
}

function buildSummary(
  status: HealthStatus,
  periods: (PeriodHealth | null)[],
  peakLossPct: number,
  latestWeight: number,
  referencePeak: number
): string {
  const unit = 'lbs'
  // Exclude skipped (interval-gated) periods from worst-period selection
  const worstPeriod = periods
    .filter((p): p is PeriodHealth => p !== null && !p.skipped)
    .sort((a, b) => Math.abs(b.changePerWeek) - Math.abs(a.changePerWeek))[0]

  if (status === 'ok') return 'Weight is stable. No concerns.'

  if (status === 'urgent') {
    if (peakLossPct >= 10)
      return `Lost ${peakLossPct}% from recent weight (${(referencePeak - latestWeight).toFixed(1)} ${unit}). Veterinary evaluation is strongly recommended.`
    return `Fastest recorded rate: ${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week loss. This exceeds 2%/week — the AAFP/WSAVA clinical threshold associated with hepatic lipidosis risk. Vet visit recommended.`
  }

  if (status === 'concerning') {
    if (peakLossPct >= 7)
      return `Lost ${peakLossPct}% from recent weight. Clinically significant — worth discussing with your vet.`
    return `Fastest rate: ${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week loss. AAFP and WSAVA guidelines recommend no more than ~1% body weight loss per week without veterinary guidance. Sustained loss above 1.5%/week warrants clinical attention.`
  }

  // watch
  if (worstPeriod?.direction === 'gain')
    return `Rapid weight gain detected (${worstPeriod.changePerWeek.toFixed(1)}%/week). Sustained gain >2%/week can indicate fluid retention or overfeeding.`
  return `Mild weight loss trend detected (${Math.abs(worstPeriod?.changePerWeek ?? 0).toFixed(1)}%/week). Monitor closely and track future measurements.`
}

export const STATUS_COLORS: Record<HealthStatus, string> = {
  ok: '#4ade80',      // jade
  watch: '#fbbf24',   // honey
  concerning: '#f97316', // coral
  urgent: '#f87171',  // rose
}

export const STATUS_BG: Record<HealthStatus, string> = {
  ok: 'bg-green-50 border-green-200 text-green-800',
  watch: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  concerning: 'bg-orange-50 border-orange-200 text-orange-800',
  urgent: 'bg-red-50 border-red-200 text-red-800',
}

export const STATUS_EMOJI: Record<HealthStatus, string> = {
  ok: '✅',
  watch: '👀',
  concerning: '⚠️',
  urgent: '🚨',
}

export const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Stable',
  watch: 'Watch',
  concerning: 'Concerning',
  urgent: 'Urgent',
}

// Evidence-based behavioral observations for each alert level.
// See docs/research/behavioral-indicators.md for full citations per item.
// Key sources: AAFP Pain Management Guidelines (2022); ISFM Feline Stress Consensus (2020);
//              AAFP FLUTD/FIC Consensus; Armstrong & Blanchard VCNA 2009 (hepatic lipidosis);
//              ACVIM Consensus on HCM; IRIS CKD Guidelines; Merck Veterinary Manual.

export const WATCH_ATTENTION: string[] = [
  'Changes in grooming — bathing less or more than is normal for them',
  'Hiding or seeking isolation more than their usual baseline',
  'Shifts in litter box frequency, effort, or stool consistency',
  'Less interest in play, toys, or interaction',
  'Eating noticeably faster, slower, or leaving food behind',
  'Any new vocalizations or unusual behavior',
]

export const CONCERNING_ATTENTION: string[] = [
  'Vomiting more than once a week, or frequent hairballs',
  'Soft stools or diarrhea lasting more than 24 hours',
  'Consistently leaving food in the bowl when that\'s not their norm',
  'Coat looking dull, greasy, or developing mats they\'re not grooming out',
  'Drinking noticeably more or less water than usual',
  'Moving less — seems stiff, reluctant to jump, or uncomfortable',
]

export const URGENT_VET_SIGNS: string[] = [
  'Not eating for more than 24 hours — cats can develop hepatic lipidosis (fatty liver) rapidly',
  'Straining in the litter box with little output, especially males — may be a life-threatening urinary blockage',
  'Pale, yellow, grey, or white gums instead of bubblegum pink',
  'Labored breathing, open-mouth panting, or breathing with the belly',
  'Crying out, groaning, or hiding completely and refusing to come out',
  'Collapse, extreme weakness, or inability to stand or walk normally',
  'Vomiting multiple times in a single day',
  'Seizures, tremors, or sudden loss of coordination',
]
