import { describe, it, expect } from 'vitest'
import {
  bucketByWeek,
  normalize,
  lagCorrelation,
  detectTrend,
  detectCorrelations,
} from '../../lib/correlations'
import type { Measurement } from '../../lib/api'

// ── Measurement builder ───────────────────────────────────────────────────────

let _id = 0
function m(type: string, value: number, measured_at: string): Measurement {
  return { id: String(_id++), cat_id: 'cat-1', type, value, unit: 'lbs', measured_at, created_at: '' }
}

// ── bucketByWeek ──────────────────────────────────────────────────────────────

describe('bucketByWeek', () => {
  it('returns an empty array for no measurements', () => {
    expect(bucketByWeek([])).toHaveLength(0)
  })

  it('groups measurements in the same week into one bucket', () => {
    // Use noon UTC timestamps to avoid timezone-induced day shifts
    // Tue 2026-01-06 noon UTC and Thu 2026-01-08 noon UTC are in the same ISO week
    const ms = [
      m('weight', 10.0, '2026-01-06T12:00:00Z'),
      m('weight', 10.2, '2026-01-08T12:00:00Z'),
    ]
    const buckets = bucketByWeek(ms)
    expect(buckets).toHaveLength(1)
    expect(buckets[0]?.value).toBeCloseTo(10.1, 5)
  })

  it('creates separate buckets for different weeks', () => {
    const ms = [
      m('weight', 10.0, '2026-01-05'), // week 1
      m('weight', 9.8,  '2026-01-12'), // week 2
    ]
    const buckets = bucketByWeek(ms)
    expect(buckets).toHaveLength(2)
  })

  it('returns buckets sorted chronologically', () => {
    const ms = [
      m('weight', 9.5, '2026-01-19'),
      m('weight', 10.0, '2026-01-05'),
    ]
    const buckets = bucketByWeek(ms)
    expect(buckets[0]!.value).toBe(10.0)
    expect(buckets[1]!.value).toBe(9.5)
  })
})

// ── normalize ─────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('returns values scaled to [0, 1]', () => {
    const result = normalize([0, 5, 10])
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(0.5)
    expect(result[2]).toBeCloseTo(1)
  })

  it('returns 0.5 for all values when all are equal (no range)', () => {
    const result = normalize([5, 5, 5])
    expect(result.every(v => v === 0.5)).toBe(true)
  })

  it('handles negative values', () => {
    const result = normalize([-10, 0, 10])
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(0.5)
    expect(result[2]).toBeCloseTo(1)
  })
})

// ── lagCorrelation ────────────────────────────────────────────────────────────

describe('lagCorrelation', () => {
  it('returns lag=0 and r≈1 for identical series', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8]
    const { lag, r } = lagCorrelation(s, s)
    expect(lag).toBe(0)
    expect(r).toBeCloseTo(1, 5)
  })

  it('returns r≈-1 for perfectly anti-correlated series at lag 0', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8]
    const b = [8, 7, 6, 5, 4, 3, 2, 1]
    const { lag, r } = lagCorrelation(a, b)
    expect(lag).toBe(0)
    expect(r).toBeCloseTo(-1, 5)
  })

  it('returns r=0 for too-short series (< 4 points)', () => {
    const { r } = lagCorrelation([1, 2, 3], [1, 2, 3])
    expect(r).toBe(0)
  })
})

// ── detectTrend ───────────────────────────────────────────────────────────────

describe('detectTrend', () => {
  it('returns "stable" when fewer than 4 buckets', () => {
    const buckets = [
      { weekKey: '2026-W01', weekStart: new Date('2026-01-05'), value: 10 },
      { weekKey: '2026-W02', weekStart: new Date('2026-01-12'), value: 9 },
    ]
    expect(detectTrend(buckets)).toBe('stable')
  })

  it('returns "down" for a declining series', () => {
    const buckets = [10, 9.5, 9, 8.5].map((v, i) => ({
      weekKey: `2026-W0${i + 1}`,
      weekStart: new Date(2026, 0, 5 + i * 7),
      value: v,
    }))
    expect(detectTrend(buckets)).toBe('down')
  })

  it('returns "up" for an increasing series', () => {
    const buckets = [8.5, 9, 9.5, 10].map((v, i) => ({
      weekKey: `2026-W0${i + 1}`,
      weekStart: new Date(2026, 0, 5 + i * 7),
      value: v,
    }))
    expect(detectTrend(buckets)).toBe('up')
  })

  it('returns "stable" for small variations (< 4% change)', () => {
    const buckets = [10, 10.1, 10.05, 10.08].map((v, i) => ({
      weekKey: `2026-W0${i + 1}`,
      weekStart: new Date(2026, 0, 5 + i * 7),
      value: v,
    }))
    expect(detectTrend(buckets)).toBe('stable')
  })
})

// ── detectCorrelations ────────────────────────────────────────────────────────

describe('detectCorrelations', () => {
  it('returns an empty array when there is no data', () => {
    expect(detectCorrelations({})).toHaveLength(0)
  })

  it('returns an empty array when there are fewer than 4 measurements per type', () => {
    const byType = {
      food: [m('food', 2, '2026-01-01'), m('food', 3, '2026-01-08')],
      weight: [m('weight', 10, '2026-01-01')],
    }
    expect(detectCorrelations(byType)).toHaveLength(0)
  })

  it('detects a strong correlation between food intake and weight', () => {
    // Build 8 weekly measurements where food and weight move together
    const foodMs = [2, 2, 3, 3, 2, 1, 1, 2].map((v, i) =>
      m('food', v, new Date(2026, 0, 5 + i * 7).toISOString().slice(0, 10)),
    )
    const weightMs = [10.0, 10.0, 10.2, 10.2, 10.0, 9.7, 9.7, 10.0].map((v, i) =>
      m('weight', v, new Date(2026, 0, 5 + i * 7).toISOString().slice(0, 10)),
    )

    const results = detectCorrelations({ food: foodMs, weight: weightMs })
    // Should detect at least one non-'none' result
    const notable = results.filter(r => r.strength !== 'none')
    expect(notable.length).toBeGreaterThan(0)
    expect(results[0]?.typeA).toBe('food')
    expect(results[0]?.typeB).toBe('weight')
  })

  it('only checks known pairs (not arbitrary combinations)', () => {
    // Provide data for 'food' only — no weight, so no valid pair exists
    const foodMs = [1, 2, 3, 2, 1, 2, 3, 2].map((v, i) =>
      m('food', v, new Date(2026, 0, 5 + i * 7).toISOString().slice(0, 10)),
    )
    const results = detectCorrelations({ food: foodMs })
    expect(results).toHaveLength(0)
  })
})
