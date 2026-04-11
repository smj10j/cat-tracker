import { describe, it, expect } from 'vitest'
import { assessHealth } from '../../lib/healthMetrics'
import type { Measurement } from '../../lib/api'

// Helper to build Measurement objects with just the fields assessHealth needs.
// Use noon-UTC timestamps to avoid timezone edge cases in date bucketing.
function m(value: number, measured_at: string): Measurement {
  return { id: '', cat_id: '', type: 'weight', value, unit: 'lbs', measured_at, created_at: '' }
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

  it('returns watch for mild weight loss (~0.5–1%/week)', () => {
    // 10.00 → 9.95 over 7 days = 0.5%/week → watch
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.95,  '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('watch')
  })

  it('returns concerning for rapid weight loss (~1–2%/week)', () => {
    // 10.00 → 9.85 over 7 days = 1.5%/week → concerning
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.85,  '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('concerning')
  })

  it('returns urgent for very rapid weight loss (>2%/week)', () => {
    // 10.00 → 9.70 over 7 days = 3%/week → urgent
    const measurements = [
      m(10.00, '2026-01-06T12:00:00Z'),
      m(9.70,  '2026-01-13T12:00:00Z'),
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
    // 2-day interval; drop is 1.5% (below 4% peak-loss watch threshold) but
    // rate is 5.25%/wk which would be urgent without the gate
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
    // 5-day interval, 4% loss = 5.6%/week → urgent
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.6,  '2026-01-11T12:00:00Z'), // 5 days
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
    expect(result.periods[1]?.skipped).toBe(false)
  })

  // ── Noise floor ───────────────────────────────────────────────────────────────

  it('noise floor: change < 0.5% of previous weight → ok, not skipped', () => {
    // 10.0 → 9.97 = 0.3% change over 7 days → below 0.5% floor
    const measurements = [
      m(10.0,  '2026-01-06T12:00:00Z'),
      m(9.97,  '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    expect(result.periods[1]?.skipped).toBe(false)
    expect(result.periods[1]?.status).toBe('ok')
  })

  it('noise floor: change exactly at 0.5% passes through to classifyRate', () => {
    // 10.0 → 9.95 = 0.5% = exactly the floor boundary → should pass through → watch
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.95, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('watch')
    expect(result.periods[1]?.skipped).toBe(false)
  })

  it('noise floor is relative (works correctly for kg measurements)', () => {
    // 4.5 kg → 4.47 kg = 0.67% over 7 days = 0.67%/week → watch (above 0.5% floor)
    const kgM = (v: number, d: string): Measurement =>
      ({ id: '', cat_id: '', type: 'weight', value: v, unit: 'kg', measured_at: d, created_at: '' })
    const measurements = [
      kgM(4.50, '2026-01-06T12:00:00Z'),
      kgM(4.47, '2026-01-13T12:00:00Z'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('watch')
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
    // 8 recent measurements at 10.0 plus one older measurement at 11.0 (>180 days ago).
    // 11.0 → 10.0 over 370 days = ~0.17%/week — no rate alert triggered.
    // With N=8 in the 180-day window, referencePeak must be 90th-pct(10.0 x 8) = 10.0, not 11.0.
    const base = '2026-01-06T12:00:00Z'
    const recent = Array.from({ length: 8 }, (_, i) =>
      m(10.0, new Date(new Date(base).getTime() + i * 7 * 86400_000).toISOString())
    )
    const measurements = [
      m(11.0, '2025-01-01T12:00:00Z'), // outside 180-day window — excluded from percentile
      ...recent,
    ]
    const result = assessHealth(measurements)
    // referencePeak = 90th-pct of 8 values all at 10.0 = 10.0, not all-time max 11.0
    expect(result.referencePeak).toBe(10.0)
    expect(result.peakLossPct).toBe(0)
    expect(result.overallStatus).toBe('ok')
  })

  it('robust peak: genuine loss from recent stable baseline still triggers alert', () => {
    // 8 recent measurements at ~10.0, then drops to 8.5 (15% loss from recent peak)
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
    // Short-interval huge drop (would be worst if included) + real moderate drop
    const measurements = [
      m(10.0, '2026-01-06T12:00:00Z'),
      m(9.0,  '2026-01-07T12:00:00Z'), // 1-day gap → skipped
      m(9.0,  '2026-01-14T12:00:00Z'), // 7-day gap, 0% change from 9.0 → stable
    ]
    const result = assessHealth(measurements)
    // The skipped period should not influence the summary
    expect(result.periods[1]?.skipped).toBe(true)
    expect(result.summary).not.toMatch(/10%\/week/)
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
