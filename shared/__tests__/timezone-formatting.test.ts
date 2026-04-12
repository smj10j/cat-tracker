/**
 * Tests for timezone-aware formatting functions.
 * These tests define CORRECT behavior — if code doesn't match, fix the code.
 */
import { describe, it, expect } from 'vitest'
import { localToUTC, utcToLocal } from '../lib/dates'
import { formatDateShort, type UserPreferences } from '../lib/preferences'
import { formatTimeFromParts } from '../lib/formatting'

const PREFS_12H: UserPreferences = { weightUnit: 'lbs', dateFormat: 'MDY', timeFormat: '12h' }
const PREFS_24H: UserPreferences = { weightUnit: 'kg', dateFormat: 'DMY', timeFormat: '24h' }
const PREFS_YMD: UserPreferences = { weightUnit: 'lbs', dateFormat: 'YMD', timeFormat: '24h' }

describe('formatTimeFromParts respects time format preference', () => {
  it('formats 9:00 AM correctly in 12h mode', () => {
    expect(formatTimeFromParts('09:00', PREFS_12H)).toBe('9:00 AM')
  })

  it('formats 9:00 in 24h mode', () => {
    expect(formatTimeFromParts('09:00', PREFS_24H)).toBe('09:00')
  })

  it('formats noon correctly in 12h mode', () => {
    expect(formatTimeFromParts('12:00', PREFS_12H)).toBe('12:00 PM')
  })

  it('formats midnight correctly in 12h mode', () => {
    expect(formatTimeFromParts('00:00', PREFS_12H)).toBe('12:00 AM')
  })

  it('formats midnight correctly in 24h mode', () => {
    expect(formatTimeFromParts('00:00', PREFS_24H)).toBe('00:00')
  })

  it('formats 11 PM correctly in both modes', () => {
    expect(formatTimeFromParts('23:00', PREFS_12H)).toBe('11:00 PM')
    expect(formatTimeFromParts('23:00', PREFS_24H)).toBe('23:00')
  })

  it('formats 1:30 PM correctly', () => {
    expect(formatTimeFromParts('13:30', PREFS_12H)).toBe('1:30 PM')
    expect(formatTimeFromParts('13:30', PREFS_24H)).toBe('13:30')
  })
})

describe('UTC roundtrip preserves local time for all US timezones', () => {
  const timezones = [
    { tz: 'America/New_York', name: 'Eastern' },
    { tz: 'America/Chicago', name: 'Central' },
    { tz: 'America/Denver', name: 'Mountain' },
    { tz: 'America/Los_Angeles', name: 'Pacific' },
    { tz: 'Pacific/Honolulu', name: 'Hawaii' },
  ]
  const times = ['09:00', '00:00', '12:00', '23:00']
  const dates = ['2026-01-15', '2026-07-15'] // Winter and summer (DST)

  for (const { tz, name } of timezones) {
    for (const date of dates) {
      for (const time of times) {
        it(`roundtrips ${date} ${time} in ${name} (${tz})`, () => {
          const utc = localToUTC(date, time, tz)
          const back = utcToLocal(utc, tz)
          expect(back.date).toBe(date)
          expect(back.time).toBe(time)
        })
      }
    }
  }
})

describe('Care item time: user picks local time, stored as UTC, displayed as local', () => {
  it('CST user picks 11:00 AM → stored as 17:00 UTC → displayed as 11:00 AM', () => {
    // User in CST (UTC-6, winter) picks 11:00 AM
    const userTime = '11:00'
    const userDate = '2026-01-15'
    const userTz = 'America/Chicago'

    // Backend converts to UTC
    const utcDueAt = localToUTC(userDate, userTime, userTz)
    expect(utcDueAt).toBe('2026-01-15 17:00:00')

    // Client converts back to local for display
    const local = utcToLocal(utcDueAt, userTz)
    expect(local.date).toBe('2026-01-15')
    expect(local.time).toBe('11:00')

    // Displayed in 12h format
    expect(formatTimeFromParts(local.time, PREFS_12H)).toBe('11:00 AM')
    // Displayed in 24h format
    expect(formatTimeFromParts(local.time, PREFS_24H)).toBe('11:00')
  })

  it('CDT user picks 11:00 AM → stored as 16:00 UTC → displayed as 11:00 AM', () => {
    const utcDueAt = localToUTC('2026-07-15', '11:00', 'America/Chicago')
    expect(utcDueAt).toBe('2026-07-15 16:00:00')

    const local = utcToLocal(utcDueAt, 'America/Chicago')
    expect(local.date).toBe('2026-07-15')
    expect(local.time).toBe('11:00')
  })

  it('late night CST dose rolls to next UTC day but displays correctly', () => {
    const utcDueAt = localToUTC('2026-01-15', '23:00', 'America/Chicago')
    expect(utcDueAt).toBe('2026-01-16 05:00:00')

    const local = utcToLocal(utcDueAt, 'America/Chicago')
    expect(local.date).toBe('2026-01-15')
    expect(local.time).toBe('23:00')
  })
})

describe('Date format preference applied to short dates', () => {
  it('MDY format: "Mar 15"', () => {
    const result = formatDateShort('2026-03-15', PREFS_12H)
    expect(result).toContain('Mar')
    expect(result).toContain('15')
  })

  it('DMY format: "15 Mar"', () => {
    const result = formatDateShort('2026-03-15', PREFS_24H)
    expect(result).toContain('15')
    expect(result).toContain('Mar')
  })

  it('YMD format: "03-15"', () => {
    const result = formatDateShort('2026-03-15', PREFS_YMD)
    expect(result).toContain('03')
    expect(result).toContain('15')
  })
})
