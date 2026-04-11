import { describe, it, expect } from 'vitest'
import { parseLocalDate, formatLocalDate, catAge } from '../lib/dates'

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
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const birthdate = sixMonthsAgo.toISOString().slice(0, 10)
    const age = catAge(birthdate)
    expect(age).toContain('6')
    expect(age).toContain('month')
  })

  it('returns years for older cats', () => {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    const birthdate = threeYearsAgo.toISOString().slice(0, 10)
    const age = catAge(birthdate)
    expect(age).toContain('3')
    expect(age).toContain('year')
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
