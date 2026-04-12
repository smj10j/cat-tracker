import { describe, it, expect } from 'vitest'
import { assessHealth, type ThresholdOverrides } from '@shared/lib/healthMetrics'
import type { Measurement } from '../../lib/api'

function makeMeasurement(value: number, daysAgo: number): Measurement {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return {
    id: `m-${daysAgo}`,
    cat_id: 'cat-1',
    type: 'weight',
    value,
    unit: 'lbs',
    measured_at: d.toISOString(),
    notes: null,
    created_at: d.toISOString(),
  }
}

describe('assessHealth with threshold overrides', () => {
  it('uses default thresholds when none provided', () => {
    const ms = [
      makeMeasurement(10.0, 14),
      makeMeasurement(9.5, 7),
      makeMeasurement(9.0, 0), // 5% loss per week from 10 → 9.5 → 9
    ]
    const result = assessHealth(ms)
    // Default thresholds: 0.75%/week = watch
    expect(result.overallStatus).not.toBe('ok')
  })

  it('respects custom weight loss thresholds (more lenient)', () => {
    const ms = [
      makeMeasurement(10.0, 14),
      makeMeasurement(9.85, 7), // ~1.5% loss/week - would be 'concerning' at default
      makeMeasurement(9.7, 0),  // ~1.5% loss/week
    ]
    const lenient: ThresholdOverrides = {
      weightLoss: {
        watchPctPerWeek: 2.0,       // much more lenient
        concerningPctPerWeek: 3.0,
        urgentPctPerWeek: 4.0,
      },
    }
    const result = assessHealth(ms, lenient)
    // With lenient thresholds, 1.5%/week should be ok
    expect(result.overallStatus).toBe('ok')
  })

  it('respects custom interval gate', () => {
    const ms = [
      makeMeasurement(10.0, 3),
      makeMeasurement(8.0, 0), // big loss but only 3 days apart
    ]
    // Default: 5-day interval gate → skipped
    const defaultResult = assessHealth(ms)
    const period = defaultResult.periods[1]
    expect(period?.skipped).toBe(true)

    // Custom: 2-day interval gate → NOT skipped
    const loose: ThresholdOverrides = { minIntervalDays: 2 }
    const customResult = assessHealth(ms, loose)
    const customPeriod = customResult.periods[1]
    expect(customPeriod?.skipped).toBe(false)
  })

  it('falls back to defaults for fields not present in partial overrides', () => {
    // Only override totalLoss — weightLoss rate thresholds should use defaults
    const ms = [
      makeMeasurement(10.0, 14),
      makeMeasurement(9.5, 7),  // 0.5 lbs / ~5%/week loss — above noise floor
      makeMeasurement(9.0, 0),  // 0.5 lbs / ~5.3%/week loss
    ]
    // Only override totalLoss (very lenient), leave weightLoss at default (0.75/1.5/2)
    const partial: ThresholdOverrides = {
      totalLoss: { watchPct: 20, concerningPct: 30, urgentPct: 40 },
    }
    const result = assessHealth(ms, partial)
    // Default weightLoss rate thresholds still classify >2%/week as urgent
    // Two consecutive urgent-loss periods → overallStatus escalated
    // But totalLoss override is very lenient, so only rate-based classification applies
    expect(result.overallStatus).not.toBe('ok')
  })

  it('falls back to defaults when override object is empty', () => {
    const ms = [
      makeMeasurement(10.0, 14),
      makeMeasurement(9.5, 7),
      makeMeasurement(9.0, 0),
    ]
    const empty: ThresholdOverrides = {}
    const resultEmpty = assessHealth(ms, empty)
    const resultDefault = assessHealth(ms)
    // Empty overrides should produce identical results to no overrides
    expect(resultEmpty.overallStatus).toBe(resultDefault.overallStatus)
    expect(resultEmpty.peakLossPct).toBe(resultDefault.peakLossPct)
  })

  it('respects custom total loss thresholds', () => {
    // Build 8+ measurements spread over 180 days to trigger 90th-pct peak reference
    const ms: Measurement[] = []
    for (let i = 0; i < 10; i++) {
      ms.push(makeMeasurement(10.0, 200 - i * 10)) // stable at 10 lbs
    }
    ms.push(makeMeasurement(9.4, 7))  // start dropping
    ms.push(makeMeasurement(9.0, 0))  // total ~10% loss from peak

    // Default: 10% total loss = urgent
    const defaultResult = assessHealth(ms)
    expect(defaultResult.overallStatus).toBe('urgent')

    // Custom: urgentPct = 15% → 10% loss is only concerning
    const custom: ThresholdOverrides = {
      totalLoss: { watchPct: 5, concerningPct: 8, urgentPct: 15 },
    }
    const customResult = assessHealth(ms, custom)
    expect(customResult.overallStatus).not.toBe('urgent')
  })
})
