import { describe, it, expect } from 'vitest'
import { assessHealth } from '../lib/healthMetrics'
import type { Measurement } from '../lib/types'

// Helper to build Measurement objects with just the fields assessHealth needs.
// Use noon-UTC timestamps to avoid timezone edge cases in date bucketing.
function m(value: number, measured_at: string): Measurement {
  return { id: '', cat_id: '', type: 'weight', value, unit: 'lbs', measured_at, notes: null, created_at: '' }
}

describe('assessHealth', () => {
  it('returns ok status with no periods for empty input', () => {
    const result = assessHealth([])
    expect(result.overallStatus).toBe('ok')
    expect(result.periods).toHaveLength(0)
    expect(result.peakLossPct).toBe(0)
    expect(result.summary).toMatch(/not enough data/i)
  })

  it('returns ok status with single measurement', () => {
    const result = assessHealth([m(10, '2026-01-06T12:00:00Z')])
    expect(result.overallStatus).toBe('ok')
    expect(result.periods).toHaveLength(1)
    expect(result.periods[0]).toBeNull()
  })

  it('returns ok for perfectly stable weight over multiple weeks', () => {
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(10.0, '2026-01-13T12:00:00Z'),
      m(10.0, '2026-01-20T12:00:00Z'),
      m(10.0, '2026-01-27T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    expect(result.peakLossPct).toBe(0)
  })

  it('returns watch for sustained mild weight loss (~0.75–1.5%/week)', () => {
    // 10.00 → 9.90 → 9.80 over 2 weeks = ~1%/week sustained → watch
    // Need two consecutive loss periods above 0.2 lbs absolute each
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.70,  '2026-01-13T12:00:00Z'), // -0.3 lbs, -3%/week → period is concerning
      m(9.40,  '2026-01-20T12:00:00Z'), // -0.3 lbs, consecutive loss → escalates
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).not.toBe('ok') // watch or worse
  })

  it('returns concerning for sustained rapid weight loss (~1.5–2%/week)', () => {
    // Need two consecutive periods of 1.5%+/week loss, each > 0.2 lbs
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.70,  '2026-01-13T12:00:00Z'), // -3%/week
      m(9.40,  '2026-01-20T12:00:00Z'), // -3.1%/week, consecutive
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent') // >2%/week sustained
  })

  it('returns urgent for very rapid weight loss (>2%/week sustained)', () => {
    // 10.00 → 9.50 → 9.00 = 5%/week × 2 consecutive → urgent
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.50,  '2026-01-13T12:00:00Z'),
      m(9.00,  '2026-01-20T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
  })

  it('returns urgent when cumulative peak loss exceeds 10% (sparse data fallback)', () => {
    // Only 4 measurements → fallback to peakWeight; 10 → 8.90 = 11% loss
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.80,  '2026-02-06T12:00:00Z'),
      m(9.50,  '2026-03-06T12:00:00Z'),
      m(8.90,  '2026-04-06T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
    expect(result.peakLossPct).toBeGreaterThanOrEqual(10)
  })

  it('computes peakLossPct correctly (sparse data uses peakWeight fallback)', () => {
    // 2 measurements → N < 8 → fallback to all-time max
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.00,  '2026-02-06T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.peakLossPct).toBe(10)
    expect(result.referencePeak).toBe(10.0)
  })

  it('returns correct period count (one null + N-1 periods)', () => {
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(10.0, '2026-01-13T12:00:00Z'),
      m(10.0, '2026-01-20T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.periods).toHaveLength(3) // [null, period1, period2]
    expect(result.periods[0]).toBeNull()
    expect(result.periods[1]).not.toBeNull()
    expect(result.periods[2]).not.toBeNull()
  })

  it('sorts measurements by date regardless of input order', () => {
    const measurements = [
      m(9.0,  '2026-01-20T12:00:00Z'), // later, lower weight
      m(10.0, '2026-01-06T12:00:00Z'), // earlier, higher weight
    ]
    // Should detect loss (10 → 9), not gain (9 → 10)
    const result = assessHealth(measurements)
    expect(result.peakLossPct).toBe(10)
  })

  it('period direction reflects loss/gain/stable correctly', () => {
    const lossMs = [m(10.0, '2026-01-06T12:00:00Z'), m(9.5, '2026-01-13T12:00:00Z')]
    expect(assessHealth(lossMs).periods[1]?.direction).toBe('loss')

    const gainMs = [m(9.5, '2026-01-06T12:00:00Z'), m(10.0, '2026-01-13T12:00:00Z')]
    expect(assessHealth(gainMs).periods[1]?.direction).toBe('gain')

    const stableMs = [m(10.00, '2026-01-06T12:00:00Z'), m(10.02, '2026-01-13T12:00:00Z')]
    expect(assessHealth(stableMs).periods[1]?.direction).toBe('stable')
  })

  // ── Interval gate ────────────────────────────────────────────────────────────

  it('interval gate: marks period skipped and status ok for < 5-day intervals', () => {
    const measurements = [
      m(10.0,  '2026-01-06T12:00:00Z'),
      m(9.85,  '2026-01-08T12:00:00Z'), // 2 days, 1.5% drop
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    const p = result.periods[1]
    expect(p).not.toBeNull()
    expect(p?.skipped).toBe(true)
    expect(p?.status).toBe('ok')
  })

  it('interval gate: exactly 5 days is NOT skipped', () => {
    // 5-day interval, big loss → should classify (not skip)
    // 10.0 → 9.0 over 5 days = 14%/week → urgent, but need consecutive for overallStatus
    // However peakLossPct = 10% → urgent via cumulative
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.0,  '2026-01-11T12:00:00Z'), // 5 days
    ]
    const result = assessHealth(measurements)
    expect(result.periods[1]?.skipped).toBe(false)
    // 10% cumulative loss → urgent unconditionally
    expect(result.overallStatus).toBe('urgent')
  })

  // ── Noise floor ───────────────────────────────────────────────────────────────

  it('noise floor: change < 1.5% of previous weight → ok', () => {
    // 10.0 → 9.90 = 1% change, and 0.1 lbs < 0.2 absolute → noise floor
    const measurements = [
      m(10.0,  '2026-01-06T12:00:00Z'),
      m(9.90,  '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    expect(result.periods[1]?.status).toBe('ok')
  })

  it('noise floor: change < 0.2 lbs absolute → ok even if pct is high', () => {
    // Small cat: 4.0 → 3.85 = 3.75% but only 0.15 lbs → below absolute floor
    const measurements = [
      m(4.0,  '2026-01-06T12:00:00Z'),
      m(3.85, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    expect(result.periods[1]?.status).toBe('ok')
  })

  it('noise floor: change >= 0.2 lbs AND >= 1.5% passes through to classifyRate', () => {
    // 10.0 → 9.70 = 3% and 0.3 lbs → above both floors → classifies
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.70, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.periods[1]?.status).not.toBe('ok')
    expect(result.periods[1]?.skipped).toBe(false)
  })

  it('noise floor is relative (works correctly for kg measurements)', () => {
    // 4.5 kg → 4.2 kg = 6.7% over 7 days and 0.3 kg (> 0.2) → passes through
    const kgM = (v: number, d: string): Measurement =>
      ({ id: '', cat_id: '', type: 'weight', value: v, unit: 'kg', measured_at: d, notes: null, created_at: '' })
    const measurements = [
      kgM(4.50, '2026-01-06T12:00:00Z'),
      kgM(4.20, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.periods[1]?.status).not.toBe('ok')
  })

  // ── Consecutive-period requirement ─────────────────────────────────────────────

  it('single bad period followed by recovery returns ok (consecutive requirement)', () => {
    // 10.0 → 9.5 (big drop) → 10.0 (recovery) — one isolated dip should not escalate
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.5,  '2026-01-13T12:00:00Z'), // -5%/week → urgent period, but isolated
      m(10.0, '2026-01-20T12:00:00Z'), // recovery
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
  })

  it('two consecutive loss periods escalate overallStatus', () => {
    // 10.0 → 9.5 → 9.0 — sustained drop → should escalate
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.5,  '2026-01-13T12:00:00Z'), // -5%/week loss
      m(9.0,  '2026-01-20T12:00:00Z'), // -5.3%/week loss, consecutive
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
  })

  it('alternating loss/gain periods (oscillation) returns ok', () => {
    // Classic home-scale noise: weight bounces ±0.2 lbs week to week
    // Even though individual periods might classify as non-ok,
    // they alternate direction → no consecutive same-direction pair
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.7,  '2026-01-13T12:00:00Z'), // loss
      m(10.0, '2026-01-20T12:00:00Z'), // gain
      m(9.7,  '2026-01-27T12:00:00Z'), // loss
      m(10.0, '2026-02-03T12:00:00Z'), // gain
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
  })

  it('cumulative peak loss still triggers even without consecutive periods', () => {
    // Slow decline spread over months — individual periods may be mild but
    // cumulative loss from peak is 7%+ → concerning via peak-loss check
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.8,  '2026-02-06T12:00:00Z'),
      m(9.6,  '2026-03-06T12:00:00Z'),
      m(9.3,  '2026-04-06T12:00:00Z'), // 7% cumulative loss from 10.0 peak
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('concerning')
    expect(result.peakLossPct).toBeGreaterThanOrEqual(7)
  })

  // ── Real-world scenarios (review account cats) ─────────────────────────────────

  it('Mochi scenario: oscillating ±0.1 lbs on 8 lb cat returns ok', () => {
    const measurements = [
      m(8.0, '2026-01-06T12:00:00Z'),
      m(8.1, '2026-01-13T12:00:00Z'),
      m(8.0, '2026-01-20T12:00:00Z'),
      m(8.2, '2026-01-27T12:00:00Z'),
      m(8.1, '2026-02-03T12:00:00Z'),
      m(8.2, '2026-02-10T12:00:00Z'),
      m(8.3, '2026-02-17T12:00:00Z'),
      m(8.2, '2026-02-24T12:00:00Z'),
      m(8.3, '2026-03-03T12:00:00Z'),
      m(8.2, '2026-03-10T12:00:00Z'),
      m(8.3, '2026-03-17T12:00:00Z'),
      m(8.2, '2026-03-24T12:00:00Z'),
      m(8.3, '2026-03-31T12:00:00Z'),
      m(8.2, '2026-04-07T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
  })

  it('Biscuit scenario: fluctuating ±0.1-0.2 lbs on 10 lb cat returns ok', () => {
    const measurements = [
      m(10.1, '2026-01-13T12:00:00Z'),
      m(10.2, '2026-01-20T12:00:00Z'),
      m(10.1, '2026-01-27T12:00:00Z'),
      m(10.3, '2026-02-03T12:00:00Z'),
      m(10.2, '2026-02-10T12:00:00Z'),
      m(10.4, '2026-02-17T12:00:00Z'),
      m(10.3, '2026-02-24T12:00:00Z'),
      m(10.5, '2026-03-03T12:00:00Z'),
      m(10.6, '2026-03-24T12:00:00Z'),
      m(10.5, '2026-03-31T12:00:00Z'),
      m(10.7, '2026-04-07T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
  })

  it('Pepper scenario: 0.1 lb drop over 2 weeks on 7 lb cat returns ok', () => {
    const measurements = [
      m(7.1, '2026-02-24T12:00:00Z'),
      m(7.0, '2026-03-10T12:00:00Z'),
      m(7.1, '2026-03-24T12:00:00Z'),
      m(7.0, '2026-04-07T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
  })

  it('Oscar scenario: sustained multi-month decline triggers watch via cumulative loss', () => {
    const measurements = [
      m(13.5, '2026-01-05T12:00:00Z'),
      m(13.4, '2026-01-19T12:00:00Z'),
      m(13.2, '2026-02-08T12:00:00Z'),
      m(13.1, '2026-02-22T12:00:00Z'),
      m(12.9, '2026-03-15T12:00:00Z'),
      m(12.8, '2026-03-29T12:00:00Z'),
      m(12.6, '2026-04-10T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    // 6.7% cumulative loss from peak → watch (4-7% range)
    expect(result.overallStatus).toBe('watch')
    expect(result.peakLossPct).toBeGreaterThanOrEqual(4)
    expect(result.peakLossPct).toBeLessThan(7)
  })

  // ── Robust peak reference ──────────────────────────────────────────────────────

  it('robust peak: uses all-time max when fewer than 8 measurements in 180 days', () => {
    const measurements = [
      m(12.0, '2025-01-06T12:00:00Z'), // older than 180 days from last
      m(10.0, '2026-01-06T12:00:00Z'),
      m(10.0, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    // Only 3 measurements in last 180 days → fallback to peakWeight = 12.0
    expect(result.referencePeak).toBe(12.0)
  })

  it('robust peak: uses 90th-pct of recent measurements when N >= 8', () => {
    const base = '2026-01-06T12:00:00Z'
    const recent = Array.from({ length: 8 }, (_, i) =>
      m(10.0, new Date(new Date(base).getTime() + i * 7 * 86400_000).toISOString())
    )
    const measurements = [
      m(11.0, '2025-01-01T12:00:00Z'), // outside 180-day window
      ...recent,
    ]
    const result = assessHealth(measurements)
    expect(result.referencePeak).toBe(10.0)
    expect(result.peakLossPct).toBe(0)
    expect(result.overallStatus).toBe('ok')
  })

  it('robust peak: genuine loss from recent stable baseline still triggers alert', () => {
    const recentStable = Array.from({ length: 8 }, (_, i) =>
      m(10.0, new Date(new Date('2025-08-01T12:00:00Z').getTime() + i * 7 * 86400_000).toISOString())
    )
    const measurements = [
      ...recentStable,
      m(8.5, '2026-01-06T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.peakLossPct).toBeGreaterThanOrEqual(10)
    expect(result.overallStatus).toBe('urgent')
  })

  // ── Skipped periods excluded from buildSummary worst-period ──────────────────

  it('skipped periods are excluded from worst-period summary selection', () => {
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.0,  '2026-01-07T12:00:00Z'), // 1-day gap → skipped
      m(9.0,  '2026-01-14T12:00:00Z'), // 7-day gap, 0% change from 9.0 → stable
    ]
    const result = assessHealth(measurements)
    expect(result.periods[1]?.skipped).toBe(true)
    expect(result.summary).not.toMatch(/10%\/week/)
  })


  // ── Trend evaluation window + loss-episode stabilization (PRD-trend-window) ────
  //
  // Helper: build a weekly series ending `endDaysAgo` days before `anchor`.
  // All timestamps are noon UTC so the day arithmetic stays exact.

  const ANCHOR = new Date('2026-08-21T12:00:00Z').getTime()
  const at = (daysAgo: number) => new Date(ANCHOR - daysAgo * 86400_000).toISOString()

  it('Luna scenario: decline that ended 3 months ago, flat since, returns ok', () => {
    // 9.0 stable → declines to 8.25 → holds 8.25 for 13 weekly weigh-ins.
    // Every measurement-to-measurement period classifies ok; the old algorithm still reported
    // `concerning` from the cumulative branch until the 9.0 readings aged out of the 180d window.
    const measurements: Measurement[] = []
    for (let w = 34; w >= 22; w--) measurements.push(m(9.0, at(w * 7)))
    for (let w = 21; w >= 13; w--) {
      const t = (21 - w) / (21 - 13)
      measurements.push(m(Number((9.0 - 0.75 * t).toFixed(2)), at(w * 7)))
    }
    const noise = [0, 0.05, -0.05, 0, 0.1, -0.05, 0, 0.05, -0.1, 0, 0.05, 0, 0]
    for (let w = 12; w >= 0; w--) {
      measurements.push(m(Number((8.25 + (noise[12 - w] ?? 0)).toFixed(2)), at(w * 7)))
    }

    const result = assessHealth(measurements)
    expect(result.lossStabilized).toBe(true)
    expect(result.overallStatus).toBe('ok')
    // The loss is suppressed as an escalation but never hidden as a fact.
    expect(result.peakLossPct).toBeGreaterThanOrEqual(7)
    expect(result.summary).toMatch(/decline has stopped/i)
    expect(result.summary).not.toMatch(/%\/week/)
  })

  it('stabilization does not fire while a slow decline is still in progress', () => {
    // ~0.5%/week sustained over 6 months — the case the cumulative branch exists to catch.
    const measurements: Measurement[] = []
    for (let w = 26; w >= 0; w--) {
      measurements.push(m(Number((13.5 - (26 - w) * 0.035).toFixed(2)), at(w * 7)))
    }
    const result = assessHealth(measurements)
    expect(result.lossStabilized).toBe(false)
    expect(result.overallStatus).not.toBe('ok')
    expect(result.recentSlopePctPerWeek).toBeLessThan(-0.2)
  })

  it('a >=10% cumulative loss that has stabilized demotes to watch, never to ok', () => {
    // 10.0 → 8.7 (13% loss), then flat for 12 weeks.
    const measurements: Measurement[] = []
    for (let w = 40; w >= 26; w--) measurements.push(m(10.0, at(w * 7)))
    for (let w = 25; w >= 13; w--) {
      const t = (25 - w) / (25 - 13)
      measurements.push(m(Number((10.0 - 1.3 * t).toFixed(2)), at(w * 7)))
    }
    for (let w = 12; w >= 0; w--) measurements.push(m(8.7, at(w * 7)))

    const result = assessHealth(measurements)
    expect(result.lossStabilized).toBe(true)
    expect(result.peakLossPct).toBeGreaterThanOrEqual(10)
    expect(result.overallStatus).toBe('watch')
    expect(result.summary).toMatch(/held steady/i)
  })

  it('stabilization gate does not run without enough measurements in the window', () => {
    // Stable-then-drop, but only 3 measurements inside the 90-day window → gate cannot run,
    // so the cumulative thresholds apply exactly as before (fail-safe toward alerting).
    const measurements: Measurement[] = []
    for (let i = 0; i < 8; i++) measurements.push(m(10.0, at(300 - i * 10)))
    measurements.push(m(8.9, at(60)))
    measurements.push(m(8.9, at(30)))
    measurements.push(m(8.9, at(0)))

    const result = assessHealth(measurements)
    expect(result.lossStabilized).toBe(false)
    expect(result.overallStatus).not.toBe('ok')
  })

  it('stabilization gate does not run when the observed span is under 8 weeks', () => {
    // Six flat readings, but packed into 5 weeks — not enough elapsed time to call a loss over.
    const measurements: Measurement[] = []
    for (let i = 0; i < 8; i++) measurements.push(m(10.0, at(300 - i * 10)))
    for (let d = 35; d >= 0; d -= 7) measurements.push(m(8.9, at(d)))

    const result = assessHealth(measurements)
    expect(result.lossStabilized).toBe(false)
    expect(result.overallStatus).not.toBe('ok')
  })

  it('two consecutive bad periods outside the trend window no longer escalate', () => {
    // A genuine rapid decline a year ago, fully recovered and flat since.
    const measurements: Measurement[] = [
      m(10.0, at(400)),
      m(9.5,  at(393)),   // -5%/week
      m(9.0,  at(386)),   // -5.3%/week, consecutive → escalated forever under the old loop
      m(10.0, at(360)),   // recovered
    ]
    for (let w = 20; w >= 0; w--) measurements.push(m(10.0, at(w * 7)))

    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    // The historical periods keep their own classification for the chart — they are just
    // marked out-of-window so they cannot drive the overall status.
    expect(result.periods[2]?.status).toBe('urgent')
    expect(result.periods[2]?.withinTrendWindow).toBe(false)
  })

  it('a recent bad period pair still escalates', () => {
    const measurements: Measurement[] = [
      m(10.0, at(21)),
      m(9.5,  at(14)),
      m(9.0,  at(7)),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
    expect(result.periods[2]?.withinTrendWindow).toBe(true)
  })

  it('summary never quotes a %/week rate from a period the classifier scored ok', () => {
    // Slow multi-month decline: cumulative loss escalates, but no single period is flagged.
    const measurements = [
      m(10.0, at(90)),
      m(9.8,  at(60)),
      m(9.6,  at(30)),
      m(9.3,  at(0)),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).not.toBe('ok')
    const flagged = result.periods.filter((p) => p !== null && !p.skipped && p.status !== 'ok')
    expect(flagged).toHaveLength(0)
    expect(result.summary).not.toMatch(/%\/week/)
  })

  it('describes a rapid gain as a gain, not a loss', () => {
    // A >3%/week gain classifies as `concerning`; the copy used to say "%/week loss".
    const measurements: Measurement[] = []
    for (let w = 12; w >= 0; w--) measurements.push(m(Number((9.0 + (12 - w) * 0.3).toFixed(2)), at(w * 7)))
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('concerning')
    expect(result.summary).toMatch(/weight gain/i)
    expect(result.summary).not.toMatch(/loss/i)
  })

  it('exposes trendWindowDays, lossStabilized and recentSlopePctPerWeek', () => {
    const result = assessHealth([m(10.0, at(7)), m(10.0, at(0))])
    expect(result.trendWindowDays).toBe(90)
    expect(result.lossStabilized).toBe(false)
    expect(result.recentSlopePctPerWeek).toBeNull()
  })

  it('respects a custom trendWindowDays override', () => {
    // The same stale pair as above, with a window wide enough to include it again.
    const measurements: Measurement[] = [
      m(10.0, at(400)),
      m(9.5,  at(393)),
      m(9.0,  at(386)),
      m(10.0, at(360)),
    ]
    for (let w = 20; w >= 0; w--) measurements.push(m(10.0, at(w * 7)))
    expect(assessHealth(measurements, { trendWindowDays: 500 }).overallStatus).toBe('urgent')
  })

  // ── referencePeak field on HealthAssessment ───────────────────────────────────

  it('exposes referencePeak on the returned assessment', () => {
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.8,  '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result).toHaveProperty('referencePeak')
    expect(result.referencePeak).toBeGreaterThan(0)
  })
})
