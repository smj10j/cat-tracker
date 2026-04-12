import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatTimeFromParts,
  todayLocalDate,
  buildMeasuredAt,
  formatHour,
  formatDayLabel,
  groupByDay,
  formatNextDue,
  formatFreqShort,
  formatDueAt,
  formatFutureDueAt,
} from '../lib/formatting'
import type { UserPreferences } from '../lib/preferences'
import { US_DEFAULTS } from '../lib/preferences'
import type { Measurement } from '../lib/types'

const prefs12h: UserPreferences = { ...US_DEFAULTS, timeFormat: '12h' }
const prefs24h: UserPreferences = { ...US_DEFAULTS, timeFormat: '24h' }

describe('formatTimeFromParts', () => {
  it('formats midnight in 12h mode', () => {
    expect(formatTimeFromParts('00:00', prefs12h)).toBe('12:00 AM')
  })

  it('formats morning in 12h mode', () => {
    expect(formatTimeFromParts('09:30', prefs12h)).toBe('9:30 AM')
  })

  it('formats noon in 12h mode', () => {
    expect(formatTimeFromParts('12:00', prefs12h)).toBe('12:00 PM')
  })

  it('formats afternoon in 12h mode', () => {
    expect(formatTimeFromParts('15:45', prefs12h)).toBe('3:45 PM')
  })

  it('formats 11:59 PM in 12h mode', () => {
    expect(formatTimeFromParts('23:59', prefs12h)).toBe('11:59 PM')
  })

  it('formats midnight in 24h mode', () => {
    expect(formatTimeFromParts('00:00', prefs24h)).toBe('00:00')
  })

  it('formats afternoon in 24h mode', () => {
    expect(formatTimeFromParts('15:45', prefs24h)).toBe('15:45')
  })

  it('formats single-digit hour in 24h mode with padding', () => {
    expect(formatTimeFromParts('9:05', prefs24h)).toBe('09:05')
  })
})

describe('todayLocalDate', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = todayLocalDate()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches current date', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(todayLocalDate()).toBe(expected)
  })
})

describe('buildMeasuredAt', () => {
  it('returns a valid ISO string', () => {
    const result = buildMeasuredAt('2026-03-15', 14)
    const d = new Date(result)
    expect(isNaN(d.getTime())).toBe(false)
  })

  it('uses the correct hour', () => {
    const result = buildMeasuredAt('2026-03-15', 14)
    const d = new Date(result)
    expect(d.getHours()).toBe(14)
  })

  it('uses the correct date', () => {
    const result = buildMeasuredAt('2026-03-15', 9)
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // March is 2 (zero-indexed)
    expect(d.getDate()).toBe(15)
  })

  it('handles midnight', () => {
    const result = buildMeasuredAt('2026-01-01', 0)
    const d = new Date(result)
    expect(d.getHours()).toBe(0)
  })

  it('handles 11 PM', () => {
    const result = buildMeasuredAt('2026-12-31', 23)
    const d = new Date(result)
    expect(d.getHours()).toBe(23)
  })
})

describe('formatHour', () => {
  it('formats midnight in 12h', () => {
    expect(formatHour(0, prefs12h)).toBe('12:00 AM')
  })

  it('formats 6 AM in 12h', () => {
    expect(formatHour(6, prefs12h)).toBe('6:00 AM')
  })

  it('formats noon in 12h', () => {
    expect(formatHour(12, prefs12h)).toBe('12:00 PM')
  })

  it('formats 6 PM in 12h', () => {
    expect(formatHour(18, prefs12h)).toBe('6:00 PM')
  })

  it('formats 11 PM in 12h', () => {
    expect(formatHour(23, prefs12h)).toBe('11:00 PM')
  })

  it('formats midnight in 24h', () => {
    expect(formatHour(0, prefs24h)).toBe('00:00')
  })

  it('formats 6 AM in 24h', () => {
    expect(formatHour(6, prefs24h)).toBe('06:00')
  })

  it('formats noon in 24h', () => {
    expect(formatHour(12, prefs24h)).toBe('12:00')
  })

  it('formats 6 PM in 24h', () => {
    expect(formatHour(18, prefs24h)).toBe('18:00')
  })
})

describe('formatDayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for today\'s date', () => {
    expect(formatDayLabel('2026-04-12', prefs12h)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday\'s date', () => {
    expect(formatDayLabel('2026-04-11', prefs12h)).toBe('Yesterday')
  })

  it('returns formatted date for older dates', () => {
    const result = formatDayLabel('2026-04-09', prefs12h)
    expect(result).toContain('Thu')
    expect(result).toContain('Apr')
    expect(result).toContain('9')
  })
})

describe('groupByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeMeasurement = (measured_at: string, id = '1'): Measurement => ({
    id,
    cat_id: 'cat1',
    type: 'weight',
    value: 9.4,
    unit: 'lbs',
    measured_at,
    notes: null,
    created_at: measured_at,
  })

  it('groups measurements by date', () => {
    const measurements = [
      makeMeasurement('2026-04-12T10:00:00Z', '1'),
      makeMeasurement('2026-04-12T14:00:00Z', '2'),
      makeMeasurement('2026-04-11T09:00:00Z', '3'),
    ]
    const groups = groupByDay(measurements, prefs12h)
    expect(groups).toHaveLength(2)
  })

  it('sorts groups descending by date', () => {
    const measurements = [
      makeMeasurement('2026-04-10T10:00:00Z', '1'),
      makeMeasurement('2026-04-12T10:00:00Z', '2'),
      makeMeasurement('2026-04-11T10:00:00Z', '3'),
    ]
    const groups = groupByDay(measurements, prefs12h)
    expect(groups[0]!.label).toBe('Today')
    expect(groups[1]!.label).toBe('Yesterday')
  })

  it('sorts items within a day descending by time', () => {
    const measurements = [
      makeMeasurement('2026-04-12T10:00:00Z', '1'),
      makeMeasurement('2026-04-12T14:00:00Z', '2'),
      makeMeasurement('2026-04-12T08:00:00Z', '3'),
    ]
    const groups = groupByDay(measurements, prefs12h)
    expect(groups[0]!.items[0]!.id).toBe('2') // 14:00 first
    expect(groups[0]!.items[2]!.id).toBe('3') // 08:00 last
  })

  it('returns empty array for no measurements', () => {
    expect(groupByDay([], prefs12h)).toEqual([])
  })
})

describe('formatNextDue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "No upcoming dose" for null', () => {
    expect(formatNextDue(null, prefs12h)).toBe('No upcoming dose')
  })

  it('returns "No upcoming dose" for undefined', () => {
    expect(formatNextDue(undefined, prefs12h)).toBe('No upcoming dose')
  })

  it('formats today\'s due time', () => {
    // utcToLocal will convert this; the exact time depends on local timezone
    // but the format should include "Today at"
    const result = formatNextDue('2026-04-12 15:00:00', prefs12h)
    expect(result).toContain('at')
  })
})

describe('formatFreqShort', () => {
  it('formats daily', () => {
    expect(formatFreqShort('daily')).toBe('daily')
  })

  it('formats twice_daily', () => {
    expect(formatFreqShort('twice_daily')).toBe('twice daily')
  })

  it('formats weekly', () => {
    expect(formatFreqShort('weekly')).toBe('weekly')
  })

  it('formats monthly', () => {
    expect(formatFreqShort('monthly')).toBe('monthly')
  })

  it('formats custom with days', () => {
    expect(formatFreqShort('custom', 14)).toBe('every 14 days')
  })

  it('formats custom yearly (365 days)', () => {
    expect(formatFreqShort('custom', 365)).toBe('yearly')
  })

  it('formats custom every 3 years (1095 days)', () => {
    expect(formatFreqShort('custom', 1095)).toBe('every 3 years')
  })

  it('returns frequency string for unknown frequency', () => {
    expect(formatFreqShort('biweekly')).toBe('biweekly')
  })

  it('formats custom without days as "custom"', () => {
    expect(formatFreqShort('custom')).toBe('custom')
  })
})

describe('formatDueAt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats a due time with "at"', () => {
    const result = formatDueAt('2026-04-12 15:00:00', prefs12h)
    expect(result).toContain('at')
  })

  it('formats a past date due time', () => {
    const result = formatDueAt('2026-04-05 09:00:00', prefs12h)
    expect(result).toContain('at')
    // Should be a date (not "Today" or "Yesterday")
    expect(result).toContain('Apr')
  })
})

describe('formatFutureDueAt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats a future due time with "at"', () => {
    const result = formatFutureDueAt('2026-04-13 09:00:00', prefs12h)
    expect(result).toContain('at')
  })

  it('formats a distant future due time with weekday', () => {
    const result = formatFutureDueAt('2026-04-20 09:00:00', prefs12h)
    expect(result).toContain('at')
    expect(result).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)
  })
})
