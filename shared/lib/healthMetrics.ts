import type { Measurement } from './types'
import { convertWeight, type WeightUnit } from './preferences'

export type HealthStatus = 'ok' | 'watch' | 'concerning' | 'urgent'

export interface PeriodHealth {
  status: HealthStatus
  /** Absolute change from previous measurement. Always in lbs (internal canonical unit). */
  absoluteChange: number
  changePercent: number   // % of previous weight
  changePerWeek: number   // % change per week (annualized to weekly rate)
  days: number
  direction: 'loss' | 'gain' | 'stable'
  skipped: boolean        // true when interval gate fired (< 5 days) — period recorded but not classified
  /**
   * True when this period's *end* measurement falls inside the trend evaluation window
   * (trendWindowDays before the most recent measurement). Only in-window periods may
   * escalate overallStatus or be quoted in summary text — a non-ok period from a year ago
   * describes history, not a current trend.
   */
  withinTrendWindow: boolean
}

export interface HealthAssessment {
  overallStatus: HealthStatus
  // one entry per measurement; first entry is always null (no prior to compare)
  periods: (PeriodHealth | null)[]
  peakLossPct: number     // % lost from referencePeak
  referencePeak: number   // 90th-pct of last 180 days (falls back to all-time max if < 8 recent measurements)
  summary: string         // human-readable explanation
  /** Window (in days, back from the most recent measurement) used to bound trend escalation. */
  trendWindowDays: number
  /**
   * True when a cumulative loss from referencePeak has demonstrably *stopped*: the fitted trend
   * across the measurements inside the trend window is flatter than the noise floor, backed by
   * enough measurements over a long enough span to say so. Suppresses (or, at >= urgent-level
   * cumulative loss, demotes) the loss-from-peak escalation. Never hides the loss itself.
   */
  lossStabilized: boolean
  /** Fitted slope over the trend window, in % of mean weight per week. null when not computable. */
  recentSlopePctPerWeek: number | null
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

/** Threshold overrides that can be provided by the server config. */
export interface ThresholdOverrides {
  weightLoss?: {
    watchPctPerWeek: number
    concerningPctPerWeek: number
    urgentPctPerWeek: number
  }
  weightGain?: {
    watchPctPerWeek: number
    concerningPctPerWeek: number
  }
  noiseFloorPct?: number
  minIntervalDays?: number
  referencePeakWindowDays?: number
  referencePeakMinMeasurements?: number
  /** Lookback (days, from the most recent measurement) for rate-based trend escalation. */
  trendWindowDays?: number
  /** Evidence required before a loss episode may be declared stabilized. */
  stabilization?: {
    minMeasurements: number
    minSpanDays: number
  }
  totalLoss?: {
    watchPct: number
    concerningPct: number
    urgentPct: number
  }
}

// Defaults matching the hardcoded values documented above
const DEFAULT_THRESHOLDS: Required<ThresholdOverrides> = {
  weightLoss: { watchPctPerWeek: 0.75, concerningPctPerWeek: 1.5, urgentPctPerWeek: 2 },
  weightGain: { watchPctPerWeek: 2, concerningPctPerWeek: 3 },
  noiseFloorPct: 0.015,
  minIntervalDays: 5,
  referencePeakWindowDays: 180,
  referencePeakMinMeasurements: 8,
  trendWindowDays: 90,
  stabilization: { minMeasurements: 4, minSpanDays: 56 },
  totalLoss: { watchPct: 4, concerningPct: 7, urgentPct: 10 },
}

function classifyRate(changePerWeek: number, thresholds?: ThresholdOverrides): HealthStatus {
  const wl = thresholds?.weightLoss ?? DEFAULT_THRESHOLDS.weightLoss
  const wg = thresholds?.weightGain ?? DEFAULT_THRESHOLDS.weightGain
  const loss = -changePerWeek // positive = losing weight
  if (loss >= wl.urgentPctPerWeek) return 'urgent'
  if (loss >= wl.concerningPctPerWeek) return 'concerning'
  if (loss >= wl.watchPctPerWeek) return 'watch'
  // gain side
  const gain = changePerWeek
  if (gain >= wg.concerningPctPerWeek) return 'concerning'
  if (gain >= wg.watchPctPerWeek) return 'watch'
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

/**
 * Ordinary least-squares fit of weight against time.
 * `t` is in days; the returned slope is a percentage of the mean weight per day, which makes it
 * comparable to the %-based noise floor and rate thresholds regardless of the cat's size or unit.
 * Returns null when the points are too few or all share one timestamp (zero variance in t).
 */
function fitTrend(points: { t: number; v: number }[]): { slopePctPerDay: number; spanDays: number } | null {
  const n = points.length
  if (n < 2) return null
  const meanT = points.reduce((sum, p) => sum + p.t, 0) / n
  const meanV = points.reduce((sum, p) => sum + p.v, 0) / n
  if (meanV <= 0) return null
  let num = 0
  let den = 0
  for (const p of points) {
    const dt = p.t - meanT
    num += dt * (p.v - meanV)
    den += dt * dt
  }
  if (den === 0) return null
  return {
    slopePctPerDay: (num / den / meanV) * 100,
    spanDays: points[n - 1]!.t - points[0]!.t,
  }
}

/** Human-readable duration for summary copy ("8 weeks", "3 months"). */
function describeSpan(days: number): string {
  if (days >= 60) {
    const months = Math.round(days / 30)
    return months === 1 ? 'month' : `${months} months`
  }
  const weeks = Math.max(1, Math.round(days / 7))
  return weeks === 1 ? 'week' : `${weeks} weeks`
}

/**
 * Assess health from weight measurements.
 * displayUnit controls the unit used in human-readable summary text (defaults to 'lbs').
 * Internally, all values are normalized to lbs for deterministic computation.
 */
export function assessHealth(measurements: Measurement[], thresholds?: ThresholdOverrides, displayUnit: WeightUnit = 'lbs'): HealthAssessment {
  // Normalize all measurements to lbs (internal canonical unit) to handle mixed-unit sequences
  const normalized = measurements.map(m => {
    const unit = (m.unit === 'kg' ? 'kg' : 'lbs') as WeightUnit
    return { ...m, value: convertWeight(m.value, unit, 'lbs'), unit: 'lbs' }
  })
  const sorted = [...normalized].sort((a, b) => a.measured_at.localeCompare(b.measured_at))

  const trendWindowDays = thresholds?.trendWindowDays ?? DEFAULT_THRESHOLDS.trendWindowDays

  if (sorted.length < 2) {
    return {
      overallStatus: 'ok',
      periods: sorted.map(() => null),
      peakLossPct: 0,
      referencePeak: sorted[0]?.value ?? 0,
      summary: 'Not enough data to assess trend.',
      trendWindowDays,
      lossStabilized: false,
      recentSlopePctPerWeek: null,
    }
  }

  const values = sorted.map((m) => m.value)
  const peakWeight = Math.max(...values)
  const latestWeight = values[values.length - 1] ?? 0

  const peakWindowDays = thresholds?.referencePeakWindowDays ?? DEFAULT_THRESHOLDS.referencePeakWindowDays
  const peakMinMeasurements = thresholds?.referencePeakMinMeasurements ?? DEFAULT_THRESHOLDS.referencePeakMinMeasurements

  // Robust peak reference: 90th-pct of measurements in last N days.
  // Falls back to all-time max when fewer than M measurements exist in that window.
  const lastDate = new Date(sorted[sorted.length - 1]!.measured_at)
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - peakWindowDays)
  const recentValues = sorted.filter(m => new Date(m.measured_at) >= cutoff).map(m => m.value)
  const referencePeak = recentValues.length >= peakMinMeasurements ? percentile90(recentValues) : peakWeight

  const peakLossPct = referencePeak > 0 ? ((referencePeak - latestWeight) / referencePeak) * 100 : 0

  // Trend evaluation window — anchored to the most recent measurement, not to wall-clock now, so
  // a record that stops being updated keeps its assessment instead of silently going quiet.
  // See docs/research/weight-thresholds.md "Trend evaluation window and loss-episode stabilization".
  const trendCutoffMs = lastDate.getTime() - trendWindowDays * 86400_000

  // Loss-episode stabilization: fit a line through the measurements inside the trend window and
  // ask whether it still slopes down by more than measurement noise. Requires enough measurements
  // over a long enough span to be evidence of anything; when it is not computable the gate simply
  // does not run and the cumulative thresholds apply exactly as before (fail-safe toward alerting).
  const stab = thresholds?.stabilization ?? DEFAULT_THRESHOLDS.stabilization
  const noiseFloorPct = thresholds?.noiseFloorPct ?? DEFAULT_THRESHOLDS.noiseFloorPct
  const windowPoints = sorted
    .filter((m) => new Date(m.measured_at).getTime() >= trendCutoffMs)
    .map((m) => ({ t: (new Date(m.measured_at).getTime() - trendCutoffMs) / 86400_000, v: m.value }))
  const fit = windowPoints.length >= stab.minMeasurements ? fitTrend(windowPoints) : null
  const recentSlopePctPerWeek = fit ? Math.round(fit.slopePctPerDay * 7 * 100) / 100 : null
  const lossStabilized =
    fit !== null &&
    fit.spanDays >= stab.minSpanDays &&
    // Fitted total change across the observed span is flatter than the noise floor, downward.
    fit.slopePctPerDay * fit.spanDays > -(noiseFloorPct * 100)

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
    const absChange = curr.value - prev.value
    const changePercent = prev.value > 0 ? (absChange / prev.value) * 100 : 0
    const changePerWeek = (changePercent / days) * 7

    const periodBase = {
      absoluteChange: Math.round(absChange * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
      changePerWeek: Math.round(changePerWeek * 10) / 10,
      days: Math.round(days),
      direction: (absChange < -0.05 ? 'loss' : absChange > 0.05 ? 'gain' : 'stable') as PeriodHealth['direction'],
      withinTrendWindow: new Date(curr.measured_at).getTime() >= trendCutoffMs,
    }

    // Interval gate: < N days between measurements → mark skipped, do not classify
    const minInterval = thresholds?.minIntervalDays ?? DEFAULT_THRESHOLDS.minIntervalDays
    if (days < minInterval) {
      periods.push({ ...periodBase, status: 'ok', skipped: true })
      continue
    }

    // Noise floor: change < N% of previous weight OR < 0.2 lbs absolute
    // is within home-scale accuracy / biological variation.
    // See docs/research/weight-thresholds.md "Home scale measurement accuracy".
    const noiseFloor = thresholds?.noiseFloorPct ?? DEFAULT_THRESHOLDS.noiseFloorPct
    const absChangePct = Math.abs(absChange) / prev.value
    if (absChangePct < noiseFloor || Math.abs(absChange) < 0.2) {
      periods.push({ ...periodBase, status: 'ok', skipped: false })
      continue
    }

    const status = classifyRate(changePerWeek, thresholds)
    periods.push({ ...periodBase, status, skipped: false })
  }

  // Consecutive-period requirement: a single non-ok period does not escalate overallStatus.
  // Two consecutive non-ok periods in the same direction are required to confirm a trend.
  // This filters oscillation noise (e.g. ±0.2 lbs week-to-week on home scales).
  //
  // Both periods of the pair must also fall inside the trend window. Without that bound a real
  // decline from a year ago — long since recovered — escalates the assessment forever.
  let prevNonSkippedPeriod: PeriodHealth | null = null
  for (const p of periods) {
    if (p === null || p.skipped) continue
    if (p.status === 'ok') { prevNonSkippedPeriod = p; continue }
    // p.status is non-ok here; only escalate if previous was also non-ok in same direction
    if (prevNonSkippedPeriod !== null && prevNonSkippedPeriod.status !== 'ok'
        && prevNonSkippedPeriod.direction === p.direction
        && p.withinTrendWindow && prevNonSkippedPeriod.withinTrendWindow) {
      overallStatus = worstStatus(overallStatus, p.status)
    }
    prevNonSkippedPeriod = p
  }

  // Factor in total loss from the reference baseline — but only while the loss is still happening.
  // A cumulative loss that has stopped is a completed episode, not a trend; escalating on it
  // regardless left cats flagged until the pre-decline data aged out of the referencePeak window.
  const tl = thresholds?.totalLoss ?? DEFAULT_THRESHOLDS.totalLoss
  const roundedPeakLossPct = Math.round(peakLossPct * 10) / 10
  if (roundedPeakLossPct >= tl.urgentPct) {
    // A loss this large stays visible even once it has stopped — demoted, never cleared.
    overallStatus = worstStatus(overallStatus, lossStabilized ? 'watch' : 'urgent')
  } else if (!lossStabilized) {
    if (roundedPeakLossPct >= tl.concerningPct) overallStatus = worstStatus(overallStatus, 'concerning')
    else if (roundedPeakLossPct >= tl.watchPct) overallStatus = worstStatus(overallStatus, 'watch')
  }

  const summary = buildSummary({
    status: overallStatus,
    periods,
    peakLossPct: roundedPeakLossPct,
    latestWeight,
    referencePeak,
    displayUnit,
    lossStabilized,
    stableSpanDays: fit?.spanDays ?? 0,
    totalLoss: tl,
  })

  return {
    overallStatus,
    periods,
    peakLossPct: roundedPeakLossPct,
    referencePeak,
    summary,
    trendWindowDays,
    lossStabilized,
    recentSlopePctPerWeek,
  }
}

interface SummaryInput {
  status: HealthStatus
  periods: (PeriodHealth | null)[]
  peakLossPct: number
  latestWeight: number
  referencePeak: number
  displayUnit: WeightUnit
  lossStabilized: boolean
  /** Observed span of the windowed fit, in days. 0 when the fit was not computable. */
  stableSpanDays: number
  totalLoss: Required<ThresholdOverrides>['totalLoss']
}

function buildSummary(input: SummaryInput): string {
  const {
    status, periods, peakLossPct, latestWeight, referencePeak,
    displayUnit: unit, lossStabilized, stableSpanDays, totalLoss,
  } = input

  // Convert internal lbs values to display unit for summary text
  const displayLoss = convertWeight(referencePeak - latestWeight, 'lbs', unit)
  const displayPeak = convertWeight(referencePeak, 'lbs', unit)
  const displayLatest = convertWeight(latestWeight, 'lbs', unit)
  const stableFor = describeSpan(stableSpanDays)

  // A quoted %/week figure must come from a period the classifier actually flagged, and one
  // recent enough to describe what is happening now. Skipped (interval-gated), ok, and
  // out-of-window periods are all excluded.
  const worstPeriod = periods
    .filter((p): p is PeriodHealth =>
      p !== null && !p.skipped && p.withinTrendWindow && p.status !== 'ok')
    .sort((a, b) => Math.abs(b.changePerWeek) - Math.abs(a.changePerWeek))[0]

  if (status === 'ok') {
    // A real earlier loss that has since stopped is reported as context, not dropped silently.
    if (lossStabilized && peakLossPct >= totalLoss.watchPct) {
      return `Stable at ${displayLatest.toFixed(1)} ${unit} for the last ${stableFor}. That's ${peakLossPct}% below the earlier reference of ${displayPeak.toFixed(1)} ${unit}, but the decline has stopped.`
    }
    return 'Weight is stable. No concerns.'
  }

  if (status === 'urgent') {
    if (worstPeriod && peakLossPct < totalLoss.urgentPct)
      return `Fastest recorded rate: ${Math.abs(worstPeriod.changePerWeek).toFixed(1)}%/week loss. This exceeds 2%/week — the AAFP/WSAVA clinical threshold associated with hepatic lipidosis risk. Vet visit recommended.`
    return `Lost ${peakLossPct}% from recent weight (${displayLoss.toFixed(1)} ${unit}). Veterinary evaluation is strongly recommended.`
  }

  if (status === 'concerning') {
    // A >3%/week gain also classifies as concerning — it must not be described as a loss.
    // Claim cited to AAFP Hyperthyroidism Management Guidelines; see docs/research/weight-thresholds.md.
    if (worstPeriod?.direction === 'gain')
      return `Rapid weight gain detected (${worstPeriod.changePerWeek.toFixed(1)}%/week). Sustained gain above 3%/week may indicate fluid retention, overfeeding, or metabolic dysfunction — worth discussing with your vet.`
    if (worstPeriod && (lossStabilized || peakLossPct < totalLoss.concerningPct))
      return `Fastest rate: ${Math.abs(worstPeriod.changePerWeek).toFixed(1)}%/week loss. AAFP and WSAVA guidelines recommend no more than ~1% body weight loss per week without veterinary guidance. Sustained loss above 1.5%/week warrants clinical attention.`
    return `Lost ${peakLossPct}% from recent weight. Clinically significant — worth discussing with your vet.`
  }

  // watch
  // A cumulative loss at or above the urgent threshold that has demonstrably stopped is demoted
  // to watch rather than cleared — the magnitude still matters, the urgency no longer does.
  if (lossStabilized && peakLossPct >= totalLoss.urgentPct) {
    return `Down ${peakLossPct}% (${displayLoss.toFixed(1)} ${unit}) from the earlier reference of ${displayPeak.toFixed(1)} ${unit}, but weight has held steady for the last ${stableFor}. Worth raising at the next vet visit.`
  }
  if (worstPeriod?.direction === 'gain')
    return `Rapid weight gain detected (${worstPeriod.changePerWeek.toFixed(1)}%/week). Sustained gain >2%/week can indicate fluid retention or overfeeding.`
  if (worstPeriod)
    return `Mild weight loss trend detected (${Math.abs(worstPeriod.changePerWeek).toFixed(1)}%/week). Monitor closely and track future measurements.`
  // Slow cumulative decline with no single period large enough to flag — the case the
  // loss-from-peak branch exists to catch. Quote the cumulative figure, not a per-week rate.
  return `Down ${peakLossPct}% from recent weight (${displayLoss.toFixed(1)} ${unit}). Monitor closely and track future measurements.`
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
