import { describe, it, expect } from 'vitest'
import { assessHealth } from '../../lib/healthMetrics'
import type { Measurement } from '../../lib/api'

// Helper to build Measurement objects with just the fields assessHealth needs
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
    const result = assessHealth([m(10, '2026-01-01')])
    expect(result.overallStatus).toBe('ok')
    expect(result.periods).toHaveLength(1)
    expect(result.periods[0]).toBeNull()
  })

  it('returns ok for perfectly stable weight over multiple weeks', () => {
    // All identical weights → changePerWeek = 0 → ok
    const measurements = [
      m(10.0, '2026-01-01'),
      m(10.0, '2026-01-08'),
      m(10.0, '2026-01-15'),
      m(10.0, '2026-01-22'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('ok')
    expect(result.peakLossPct).toBe(0)
  })

  it('returns watch for mild weight loss (~0.5–1%/week)', () => {
    // Drop from 10 to 9.65 over 7 days = ~3.5% total = 3.5%/week → concerning
    // Let's try 10 to 9.95 over 7 days = 0.5%/week → watch
    const measurements = [
      m(10.00, '2026-01-01'),
      m(9.95, '2026-01-08'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('watch')
  })

  it('returns concerning for rapid weight loss (~1–2%/week)', () => {
    // Drop from 10 to 9.85 over 7 days = 1.5%/week → concerning
    const measurements = [
      m(10.00, '2026-01-01'),
      m(9.85, '2026-01-08'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('concerning')
  })

  it('returns urgent for very rapid weight loss (>2%/week)', () => {
    // Drop from 10 to 9.7 over 7 days = 3%/week → urgent
    const measurements = [
      m(10.00, '2026-01-01'),
      m(9.70, '2026-01-08'),
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
  })

  it('returns urgent when cumulative peak loss exceeds 10%', () => {
    // Start at 10 lbs, drop to 8.9 lbs over time (11% loss from peak)
    const measurements = [
      m(10.00, '2026-01-01'),
      m(9.80,  '2026-02-01'), // slow decline — individually might be ok
      m(9.50,  '2026-03-01'),
      m(8.90,  '2026-04-01'), // peak loss = 11%
    ]
    const result = assessHealth(measurements)
    expect(result.overallStatus).toBe('urgent')
    expect(result.peakLossPct).toBeGreaterThanOrEqual(10)
  })

  it('computes peakLossPct correctly', () => {
    const measurements = [
      m(10.00, '2026-01-01'),
      m(9.00,  '2026-02-01'), // 10% loss from peak
    ]
    const result = assessHealth(measurements)
    expect(result.peakLossPct).toBe(10)
  })

  it('returns correct period count (one null + N-1 periods)', () => {
    const measurements = [
      m(10.0, '2026-01-01'),
      m(10.0, '2026-01-08'),
      m(10.0, '2026-01-15'),
    ]
    const result = assessHealth(measurements)
    expect(result.periods).toHaveLength(3) // [null, period1, period2]
    expect(result.periods[0]).toBeNull()
    expect(result.periods[1]).not.toBeNull()
    expect(result.periods[2]).not.toBeNull()
  })

  it('sorts measurements by date regardless of input order', () => {
    const measurements = [
      m(9.0, '2026-01-15'), // later, lower weight
      m(10.0, '2026-01-01'), // earlier, higher weight
    ]
    // Should detect loss (10 → 9), not gain (9 → 10)
    const result = assessHealth(measurements)
    expect(result.peakLossPct).toBe(10)
  })

  it('period direction reflects loss/gain/stable correctly', () => {
    const lossMs = [m(10.0, '2026-01-01'), m(9.5, '2026-01-08')]
    const lossResult = assessHealth(lossMs)
    expect(lossResult.periods[1]?.direction).toBe('loss')

    const gainMs = [m(9.5, '2026-01-01'), m(10.0, '2026-01-08')]
    const gainResult = assessHealth(gainMs)
    expect(gainResult.periods[1]?.direction).toBe('gain')

    const stableMs = [m(10.00, '2026-01-01'), m(10.02, '2026-01-08')]
    const stableResult = assessHealth(stableMs)
    expect(stableResult.periods[1]?.direction).toBe('stable')
  })
})
