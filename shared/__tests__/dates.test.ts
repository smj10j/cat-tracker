import { describe, it, expect, vi } from 'vitest'
import { parseLocalDate, formatLocalDate, catAge, localToUTC, utcToLocal } from '../lib/dates'

describe('parseLocalDate', () => {
  it('parses date-only strings to the correct calendar day', () => {
    const d = parseLocalDate('2021-10-01')
    expect(d.getFullYear()).toBe(2021)
    expect(d.getMonth()).toBe(9) // October is 9 (zero-indexed)
    expect(d.getDate()).toBe(1)
  })

  it('handles Dec 31 without rolling to Jan 1', () => {
    const d = parseLocalDate('2025-12-31')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
  })

  it('handles Jan 1 without rolling to Dec 31', () => {
    const d = parseLocalDate('2026-01-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })

  it('passes through datetime strings with T unchanged', () => {
    const d = parseLocalDate('2026-03-15T14:30:00Z')
    expect(d.getFullYear()).toBe(2026)
  })

  it('passes through datetime strings with space separator', () => {
    const d = parseLocalDate('2026-03-15 14:30:00')
    expect(d.getFullYear()).toBe(2026)
  })

  it('returns invalid date for empty string', () => {
    const d = parseLocalDate('')
    expect(isNaN(d.getTime())).toBe(true)
  })
})

describe('formatLocalDate', () => {
  it('formats a date-only string to a readable date', () => {
    const result = formatLocalDate('2026-04-08')
    // Should contain "April" and "8" and "2026" regardless of timezone
    expect(result).toContain('8')
    expect(result).toContain('2026')
  })

  it('never shifts April 8 to April 7 in any US timezone', () => {
    const result = formatLocalDate('2026-04-08')
    expect(result).not.toContain('7,')
    expect(result).not.toContain('April 7')
  })

  it('never shifts October 1 to September 30 in any US timezone', () => {
    const result = formatLocalDate('2021-10-01')
    expect(result).not.toContain('September')
    expect(result).not.toContain('Sep')
  })

  it('returns empty string for empty input', () => {
    expect(formatLocalDate('')).toBe('')
  })

  it('accepts custom format options', () => {
    const result = formatLocalDate('2026-04-08', { month: 'short', day: 'numeric' })
    expect(result).toContain('8')
  })
})

describe('catAge', () => {
  it('returns months for cats under 1 year', () => {
    // Fixed clock + fixed birthdate: relative-date arithmetic through
    // toISOString() shifts the day-of-month across the UTC boundary, which the
    // day-aware catAge then reads as one month short (flaky by local timezone).
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 15, 12)) // Jul 15 2026 local
      const age = catAge('2026-01-15')
      expect(age).toContain('6')
      expect(age).toContain('month')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns years for older cats', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 15, 12)) // Jul 15 2026 local
      const age = catAge('2023-07-15')
      expect(age).toContain('3')
      expect(age).toContain('year')
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts only completed months (day-of-month not yet reached)', () => {
    vi.useFakeTimers()
    try {
      // Born Sept 15 2024; on Sept 10 2025 the cat is 11 months, not 1 year.
      vi.setSystemTime(new Date(2025, 8, 10, 12))
      expect(catAge('2024-09-15')).toBe('11 months old')
      // On the birthday itself it becomes 1 year.
      vi.setSystemTime(new Date(2025, 8, 15, 12))
      expect(catAge('2024-09-15')).toBe('1 year old')
      // Day after: still 1 year.
      vi.setSystemTime(new Date(2025, 8, 16, 12))
      expect(catAge('2024-09-15')).toBe('1 year old')
      // 1y 1mo only once Oct 15 arrives.
      vi.setSystemTime(new Date(2025, 9, 14, 12))
      expect(catAge('2024-09-15')).toBe('1 year old')
      vi.setSystemTime(new Date(2025, 9, 15, 12))
      expect(catAge('2024-09-15')).toBe('1y 1mo')
    } finally {
      vi.useRealTimers()
    }
  })

  it('clamps future birthdates to 0 months', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2025, 0, 10, 12))
      expect(catAge('2025-02-01')).toBe('0 months old')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not shift birthdate across day boundary', () => {
    // October 1 should never show as September age
    const age = catAge('2021-10-01')
    // The age should be based on October, not September
    const d = new Date()
    const expectedMonths = (d.getFullYear() - 2021) * 12 + (d.getMonth() - 9) // 9 = October zero-indexed
    const expectedYears = Math.floor(expectedMonths / 12)
    expect(age).toContain(String(expectedYears))
  })
})

describe('localToUTC', () => {
  it('converts Eastern Standard Time correctly (UTC-5)', () => {
    // 9:00 AM EST = 14:00 UTC (January = EST)
    expect(localToUTC('2026-01-15', '09:00', 'America/New_York'))
      .toBe('2026-01-15 14:00:00')
  })

  it('converts Eastern Daylight Time correctly (UTC-4)', () => {
    // 9:00 AM EDT = 13:00 UTC (July = EDT)
    expect(localToUTC('2026-07-15', '09:00', 'America/New_York'))
      .toBe('2026-07-15 13:00:00')
  })

  it('handles UTC timezone as identity', () => {
    expect(localToUTC('2026-01-15', '09:00', 'UTC'))
      .toBe('2026-01-15 09:00:00')
  })

  it('handles positive UTC offset (Tokyo UTC+9)', () => {
    // 9:00 AM Tokyo = 00:00 UTC same day
    expect(localToUTC('2026-01-15', '09:00', 'Asia/Tokyo'))
      .toBe('2026-01-15 00:00:00')
  })

  it('handles late night local rolling to next UTC day', () => {
    // 11:00 PM New York EST = 04:00 UTC next day
    expect(localToUTC('2026-01-15', '23:00', 'America/New_York'))
      .toBe('2026-01-16 04:00:00')
  })

  it('handles early morning positive offset rolling to previous UTC day', () => {
    // 2:00 AM Tokyo (UTC+9) = 5:00 PM UTC previous day
    expect(localToUTC('2026-01-15', '02:00', 'Asia/Tokyo'))
      .toBe('2026-01-14 17:00:00')
  })

  it('handles Pacific timezone (UTC-8 / UTC-7)', () => {
    // 9:00 AM PST = 17:00 UTC (January = PST)
    expect(localToUTC('2026-01-15', '09:00', 'America/Los_Angeles'))
      .toBe('2026-01-15 17:00:00')
    // 9:00 AM PDT = 16:00 UTC (July = PDT)
    expect(localToUTC('2026-07-15', '09:00', 'America/Los_Angeles'))
      .toBe('2026-07-15 16:00:00')
  })
})

describe('utcToLocal', () => {
  it('converts UTC to Eastern Standard Time', () => {
    const result = utcToLocal('2026-01-15 14:00:00', 'America/New_York')
    expect(result.date).toBe('2026-01-15')
    expect(result.time).toBe('09:00')
  })

  it('converts UTC to Eastern Daylight Time', () => {
    const result = utcToLocal('2026-07-15 13:00:00', 'America/New_York')
    expect(result.date).toBe('2026-07-15')
    expect(result.time).toBe('09:00')
  })

  it('handles UTC timezone as identity', () => {
    const result = utcToLocal('2026-01-15 09:00:00', 'UTC')
    expect(result.date).toBe('2026-01-15')
    expect(result.time).toBe('09:00')
  })

  it('handles date rollover from UTC to local', () => {
    // 04:00 UTC = 11:00 PM EST previous day
    const result = utcToLocal('2026-01-16 04:00:00', 'America/New_York')
    expect(result.date).toBe('2026-01-15')
    expect(result.time).toBe('23:00')
  })

  it('roundtrips correctly through localToUTC and utcToLocal', () => {
    const utc = localToUTC('2026-03-15', '14:00', 'America/Chicago')
    const back = utcToLocal(utc, 'America/Chicago')
    expect(back.date).toBe('2026-03-15')
    expect(back.time).toBe('14:00')
  })
})
