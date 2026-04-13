import { describe, it, expect } from 'vitest'
import {
  roundToHour,
  toLocalDatetimeString,
  formatSexNeuter,
  currentHour,
} from '../lib/formatting'

describe('roundToHour', () => {
  it('rounds down when minutes < 30', () => {
    expect(roundToHour('09:15')).toBe('09:00')
    expect(roundToHour('09:00')).toBe('09:00')
    expect(roundToHour('09:29')).toBe('09:00')
  })

  it('rounds up when minutes >= 30', () => {
    expect(roundToHour('09:30')).toBe('10:00')
    expect(roundToHour('09:45')).toBe('10:00')
    expect(roundToHour('09:59')).toBe('10:00')
  })

  it('wraps around midnight', () => {
    expect(roundToHour('23:30')).toBe('00:00')
  })

  it('handles exact hours', () => {
    expect(roundToHour('00:00')).toBe('00:00')
    expect(roundToHour('14:00')).toBe('14:00')
    expect(roundToHour('23:00')).toBe('23:00')
  })
})

describe('toLocalDatetimeString', () => {
  it('formats as YYYY-MM-DDTHH:MM', () => {
    const d = new Date(2026, 2, 15, 14, 30) // March 15, 2026 2:30 PM
    expect(toLocalDatetimeString(d)).toBe('2026-03-15T14:30')
  })

  it('pads single-digit values', () => {
    const d = new Date(2026, 0, 5, 9, 5) // Jan 5, 2026 9:05 AM
    expect(toLocalDatetimeString(d)).toBe('2026-01-05T09:05')
  })
})

describe('formatSexNeuter', () => {
  it('returns "Unknown" when both null', () => {
    expect(formatSexNeuter(null, null)).toBe('Unknown')
  })

  it('returns sex when neuter status unknown', () => {
    expect(formatSexNeuter('Male', null)).toBe('Male')
    expect(formatSexNeuter('Female', null)).toBe('Female')
  })

  it('shows "Spayed" for neutered females', () => {
    expect(formatSexNeuter('Female', 1)).toBe('Female · Spayed')
  })

  it('shows "Neutered" for neutered males', () => {
    expect(formatSexNeuter('Male', 1)).toBe('Male · Neutered')
  })

  it('shows "Intact" for non-neutered cats', () => {
    expect(formatSexNeuter('Male', 0)).toBe('Male · Intact')
    expect(formatSexNeuter('Female', 0)).toBe('Female · Intact')
  })

  it('handles null sex with neuter status', () => {
    expect(formatSexNeuter(null, 1)).toBe('Unknown sex · Neutered')
    expect(formatSexNeuter(null, 0)).toBe('Unknown sex · Intact')
  })
})

describe('currentHour', () => {
  it('returns a number between 0 and 23', () => {
    const h = currentHour()
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(23)
  })
})
