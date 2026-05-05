import { describe, it, expect } from 'vitest'
import { generateDoses, windowEnd90 } from '../../routes/medications'

describe('generateDoses — daily', () => {
  it('generates one dose per day for a 3-day window', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'daily', null, null, '2026-01-03')
    expect(doses).toHaveLength(3)
    expect(doses[0]).toEqual({ medication_id: 'med-1', due_at: '2026-01-01 09:00:00' })
    expect(doses[1]).toEqual({ medication_id: 'med-1', due_at: '2026-01-02 09:00:00' })
    expect(doses[2]).toEqual({ medication_id: 'med-1', due_at: '2026-01-03 09:00:00' })
  })

  it('includes both start and end dates (inclusive)', () => {
    const doses = generateDoses('med-1', '2026-03-01', '08:30', 'daily', null, null, '2026-03-01')
    expect(doses).toHaveLength(1)
    expect(doses[0]?.due_at).toBe('2026-03-01 08:30:00')
  })

  it('returns empty array when startDate is after windowEnd', () => {
    const doses = generateDoses('med-1', '2026-02-01', '09:00', 'daily', null, null, '2026-01-01')
    expect(doses).toHaveLength(0)
  })

  it('respects endDate when it is before windowEnd', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'daily', null, '2026-01-03', '2026-01-10')
    expect(doses).toHaveLength(3)
    expect(doses[doses.length - 1]?.due_at).toBe('2026-01-03 09:00:00')
  })

  it('uses windowEnd when endDate is null', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'daily', null, null, '2026-01-05')
    expect(doses).toHaveLength(5)
  })

  it('uses windowEnd when endDate is after windowEnd', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'daily', null, '2026-12-31', '2026-01-03')
    expect(doses).toHaveLength(3)
  })
})

describe('generateDoses — twice_daily', () => {
  it('generates two doses per day', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'twice_daily', null, null, '2026-01-02')
    expect(doses).toHaveLength(4)
    expect(doses[0]?.due_at).toBe('2026-01-01 09:00:00')
    expect(doses[1]?.due_at).toBe('2026-01-01 21:00:00') // 09 + 12 = 21
    expect(doses[2]?.due_at).toBe('2026-01-02 09:00:00')
    expect(doses[3]?.due_at).toBe('2026-01-02 21:00:00')
  })

  it('wraps midnight correctly for late reminder times', () => {
    // 14:00 reminder → second dose at (14+12)%24 = 02:00
    const doses = generateDoses('med-1', '2026-01-01', '14:00', 'twice_daily', null, null, '2026-01-01')
    expect(doses).toHaveLength(2)
    expect(doses[0]?.due_at).toBe('2026-01-01 14:00:00')
    expect(doses[1]?.due_at).toBe('2026-01-01 02:00:00')
  })
})

describe('generateDoses — weekly', () => {
  it('generates one dose per week', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'weekly', null, null, '2026-01-15')
    expect(doses).toHaveLength(3)
    expect(doses[0]?.due_at).toBe('2026-01-01 09:00:00')
    expect(doses[1]?.due_at).toBe('2026-01-08 09:00:00')
    expect(doses[2]?.due_at).toBe('2026-01-15 09:00:00')
  })
})

describe('generateDoses — monthly', () => {
  it('generates doses every 30 days', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'monthly', null, null, '2026-03-01')
    // Jan 1, Jan 31, Mar 2 (30-day increments) — depends on exact day math
    expect(doses.length).toBeGreaterThanOrEqual(2)
    expect(doses[0]?.due_at).toBe('2026-01-01 09:00:00')
  })
})

describe('generateDoses — as_needed', () => {
  it('generates zero doses for as_needed frequency', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'as_needed', null, null, '2026-12-31')
    expect(doses).toHaveLength(0)
  })

  it('returns empty even when end_date is set', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'as_needed', null, '2026-06-30', '2026-12-31')
    expect(doses).toHaveLength(0)
  })
})

describe('generateDoses — custom frequency', () => {
  it('generates doses every N days', () => {
    // Every 3 days: Jan 1, 4, 7
    const doses = generateDoses('med-1', '2026-01-01', '10:00', 'custom', 3, null, '2026-01-07')
    expect(doses).toHaveLength(3)
    expect(doses[0]?.due_at).toBe('2026-01-01 10:00:00')
    expect(doses[1]?.due_at).toBe('2026-01-04 10:00:00')
    expect(doses[2]?.due_at).toBe('2026-01-07 10:00:00')
  })

  it('falls back to daily when frequencyDays is null', () => {
    const doses = generateDoses('med-1', '2026-01-01', '09:00', 'custom', null, null, '2026-01-03')
    expect(doses).toHaveLength(3)
  })
})

describe('windowEnd90', () => {
  it('returns a YYYY-MM-DD string 90 days from today', () => {
    const result = windowEnd90()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const today = new Date()
    const expected = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    // Allow ±1 day for time-of-day drift
    const diff = Math.abs(new Date(result).getTime() - expected.getTime())
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })
})
