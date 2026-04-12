import { describe, it, expect } from 'vitest'
import {
  deriveDefaults,
  convertWeight,
  formatWeight,
  formatWeightValue,
  formatDate,
  formatDateShort,
  formatDateWithWeekday,
  formatDateFull,
  formatTime,
  formatDateTime,
  getLocaleTickFormatter,
  US_DEFAULTS,
  type UserPreferences,
} from '../lib/preferences'

describe('deriveDefaults', () => {
  it('returns US defaults for en-US', () => {
    const prefs = deriveDefaults('en-US')
    expect(prefs.weightUnit).toBe('lbs')
    expect(prefs.dateFormat).toBe('MDY')
    expect(prefs.timeFormat).toBe('12h')
  })

  it('returns kg and DMY for en-GB', () => {
    const prefs = deriveDefaults('en-GB')
    expect(prefs.weightUnit).toBe('kg')
    expect(prefs.dateFormat).toBe('DMY')
    expect(prefs.timeFormat).toBe('24h')
  })

  it('returns kg and DMY for de-DE', () => {
    const prefs = deriveDefaults('de-DE')
    expect(prefs.weightUnit).toBe('kg')
    expect(prefs.dateFormat).toBe('DMY')
    expect(prefs.timeFormat).toBe('24h')
  })

  it('returns kg and YMD for ja-JP', () => {
    const prefs = deriveDefaults('ja-JP')
    expect(prefs.weightUnit).toBe('kg')
    expect(prefs.dateFormat).toBe('YMD')
    expect(prefs.timeFormat).toBe('24h')
  })

  it('returns lbs for en-CA (pet weight convention)', () => {
    const prefs = deriveDefaults('en-CA')
    expect(prefs.weightUnit).toBe('lbs')
  })

  it('returns kg and DMY for fr-FR', () => {
    const prefs = deriveDefaults('fr-FR')
    expect(prefs.weightUnit).toBe('kg')
    expect(prefs.dateFormat).toBe('DMY')
    expect(prefs.timeFormat).toBe('24h')
  })

  it('returns US defaults for empty string', () => {
    const prefs = deriveDefaults('')
    expect(prefs.weightUnit).toBe('lbs')
    expect(prefs.dateFormat).toBe('MDY')
    expect(prefs.timeFormat).toBe('12h')
  })
})

describe('convertWeight', () => {
  it('converts lbs to kg', () => {
    expect(convertWeight(10, 'lbs', 'kg')).toBe(4.54)
  })

  it('converts kg to lbs', () => {
    expect(convertWeight(4.54, 'kg', 'lbs')).toBe(10.01)
  })

  it('returns identity when from === to', () => {
    expect(convertWeight(9.4, 'lbs', 'lbs')).toBe(9.4)
    expect(convertWeight(4.5, 'kg', 'kg')).toBe(4.5)
  })

  it('round-trip lbs->kg->lbs returns within 0.02', () => {
    const original = 9.4
    const kg = convertWeight(original, 'lbs', 'kg')
    const backToLbs = convertWeight(kg, 'kg', 'lbs')
    expect(Math.abs(backToLbs - original)).toBeLessThan(0.02)
  })

  it('handles 0 correctly', () => {
    expect(convertWeight(0, 'lbs', 'kg')).toBe(0)
  })

  it('handles small values', () => {
    const result = convertWeight(0.1, 'lbs', 'kg')
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(0.1)
  })
})

describe('formatWeight', () => {
  const lbsPrefs: UserPreferences = { ...US_DEFAULTS, weightUnit: 'lbs' }
  const kgPrefs: UserPreferences = { ...US_DEFAULTS, weightUnit: 'kg' }

  it('displays in preferred unit with conversion', () => {
    expect(formatWeight(9.4, 'lbs', kgPrefs)).toBe('4.26 kg')
  })

  it('displays without conversion when units match', () => {
    expect(formatWeight(9.4, 'lbs', lbsPrefs)).toBe('9.4 lbs')
  })

  it('converts from kg to lbs', () => {
    expect(formatWeight(4.54, 'kg', lbsPrefs)).toBe('10.01 lbs')
  })

  it('handles unknown stored unit as lbs', () => {
    // fromUnit not 'kg' → treated as 'lbs'
    expect(formatWeight(9.4, 'pounds', lbsPrefs)).toBe('9.4 lbs')
  })
})

describe('formatWeightValue', () => {
  const kgPrefs: UserPreferences = { ...US_DEFAULTS, weightUnit: 'kg' }

  it('returns numeric conversion', () => {
    expect(formatWeightValue(10, 'lbs', kgPrefs)).toBe(4.54)
  })
})

describe('formatDate', () => {
  const mdyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'MDY' }
  const dmyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'DMY' }
  const ymdPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'YMD' }

  it('formats MDY correctly', () => {
    const result = formatDate('2026-03-07', mdyPrefs)
    expect(result).toContain('Mar')
    expect(result).toContain('7')
    expect(result).toContain('2026')
  })

  it('formats DMY correctly', () => {
    const result = formatDate('2026-03-07', dmyPrefs)
    expect(result).toContain('Mar')
    expect(result).toContain('7')
    expect(result).toContain('2026')
  })

  it('formats YMD as YYYY-MM-DD', () => {
    const result = formatDate('2026-03-07', ymdPrefs)
    expect(result).toBe('2026-03-07')
  })

  it('handles empty string', () => {
    expect(formatDate('', mdyPrefs)).toBe('')
  })

  it('handles datetime ISO strings', () => {
    const result = formatDate('2026-03-07T15:30:00Z', mdyPrefs)
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('handles invalid date string', () => {
    expect(formatDate('not-a-date', mdyPrefs)).toBe('')
  })
})

describe('formatDateShort', () => {
  const mdyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'MDY' }
  const dmyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'DMY' }
  const ymdPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'YMD' }

  it('formats short MDY without year', () => {
    const result = formatDateShort('2026-03-07', mdyPrefs)
    expect(result).toContain('Mar')
    expect(result).toContain('7')
    expect(result).not.toContain('2026')
  })

  it('formats short DMY', () => {
    const result = formatDateShort('2026-03-07', dmyPrefs)
    expect(result).toContain('Mar')
    expect(result).toContain('7')
  })

  it('formats short YMD as MM-DD', () => {
    const result = formatDateShort('2026-03-07', ymdPrefs)
    expect(result).toBe('03-07')
  })
})

describe('formatDateWithWeekday', () => {
  const mdyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'MDY' }
  const dmyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'DMY' }
  const ymdPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'YMD' }

  it('includes weekday for MDY', () => {
    const result = formatDateWithWeekday('2026-03-07', mdyPrefs)
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/)
    expect(result).toContain('Mar')
    expect(result).toContain('7')
  })

  it('includes weekday for DMY', () => {
    const result = formatDateWithWeekday('2026-03-07', dmyPrefs)
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/)
  })

  it('includes weekday for YMD', () => {
    const result = formatDateWithWeekday('2026-03-07', ymdPrefs)
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/)
  })
})

describe('formatDateFull', () => {
  const mdyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'MDY' }
  const dmyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'DMY' }

  it('does not duplicate weekday in MDY format', () => {
    const result = formatDateFull('2026-03-07', mdyPrefs)
    // Should be "Sat, Mar 7, 2026" — NOT "Sat, Sat, Mar 7, 2026"
    const weekdayMatches = result.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g) ?? []
    expect(weekdayMatches.length).toBe(1)
    expect(result).toContain('2026')
  })

  it('includes year in DMY format', () => {
    const result = formatDateFull('2026-03-07', dmyPrefs)
    expect(result).toContain('2026')
    const weekdayMatches = result.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g) ?? []
    expect(weekdayMatches.length).toBe(1)
  })
})

describe('formatTime', () => {
  const h12Prefs: UserPreferences = { ...US_DEFAULTS, timeFormat: '12h' }
  const h24Prefs: UserPreferences = { ...US_DEFAULTS, timeFormat: '24h' }

  it('formats 12-hour time', () => {
    const result = formatTime('2026-03-07T15:45:00Z', h12Prefs)
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i)
  })

  it('formats 24-hour time', () => {
    const result = formatTime('2026-03-07T15:45:00Z', h24Prefs)
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('returns empty for invalid date', () => {
    expect(formatTime('invalid', h12Prefs)).toBe('')
  })
})

describe('formatDateTime', () => {
  it('combines date and time with "at"', () => {
    const result = formatDateTime('2026-03-07T15:45:00Z', US_DEFAULTS)
    expect(result).toContain('at')
    expect(result).toContain('Mar')
  })

  it('respects 24h time format', () => {
    const prefs: UserPreferences = { ...US_DEFAULTS, timeFormat: '24h' }
    const result = formatDateTime('2026-03-07T15:45:00Z', prefs)
    expect(result).toContain('at')
    // Should not contain AM/PM
    expect(result).not.toMatch(/AM|PM/)
  })
})

describe('getLocaleTickFormatter', () => {
  it('returns short weekday for 1W range', () => {
    const formatter = getLocaleTickFormatter('1W', US_DEFAULTS)
    const result = formatter('2026-03-07T12:00:00Z')
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)
  })

  it('returns day number for 1M range', () => {
    const formatter = getLocaleTickFormatter('1M', US_DEFAULTS)
    const result = formatter('2026-03-07T12:00:00Z')
    expect(result).toMatch(/^\d+$/)
  })

  it('returns short date for 3M range', () => {
    const formatter = getLocaleTickFormatter('3M', US_DEFAULTS)
    const result = formatter('2026-03-07T12:00:00Z')
    expect(result).toContain('Mar')
  })

  it('returns month for 6M and 1Y ranges', () => {
    for (const range of ['6M', '1Y']) {
      const formatter = getLocaleTickFormatter(range, US_DEFAULTS)
      const result = formatter('2026-03-07T12:00:00Z')
      expect(result).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)
    }
  })

  it('returns short date for All range', () => {
    const formatter = getLocaleTickFormatter('All', US_DEFAULTS)
    const result = formatter('2026-03-07T12:00:00Z')
    expect(result).toContain('Mar')
  })

  it('handles invalid date gracefully', () => {
    const formatter = getLocaleTickFormatter('1W', US_DEFAULTS)
    const result = formatter('invalid')
    expect(result).toBe('')
  })
})
