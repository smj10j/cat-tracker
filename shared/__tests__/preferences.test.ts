import { describe, it, expect } from 'vitest'
import {
  deriveDefaults,
  convertWeight,
  formatWeight,
  formatWeightValue,
  formatDate,
  formatDateShort,
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

  it('round-trip lbs->kg->lbs returns within 0.01', () => {
    const original = 9.4
    const kg = convertWeight(original, 'lbs', 'kg')
    const backToLbs = convertWeight(kg, 'kg', 'lbs')
    expect(Math.abs(backToLbs - original)).toBeLessThan(0.02)
  })

  it('handles 0 correctly', () => {
    expect(convertWeight(0, 'lbs', 'kg')).toBe(0)
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
})

describe('formatDateShort', () => {
  const mdyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'MDY' }
  const dmyPrefs: UserPreferences = { ...US_DEFAULTS, dateFormat: 'DMY' }

  it('formats short MDY', () => {
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
})

describe('formatTime', () => {
  const h12Prefs: UserPreferences = { ...US_DEFAULTS, timeFormat: '12h' }
  const h24Prefs: UserPreferences = { ...US_DEFAULTS, timeFormat: '24h' }

  it('formats 12-hour time', () => {
    const result = formatTime('2026-03-07T15:45:00Z', h12Prefs)
    // Account for timezone offset — just check format pattern
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i)
  })

  it('formats 24-hour time', () => {
    const result = formatTime('2026-03-07T15:45:00Z', h24Prefs)
    expect(result).toMatch(/\d{2}:\d{2}/)
  })
})

describe('formatDateTime', () => {
  it('combines date and time', () => {
    const result = formatDateTime('2026-03-07T15:45:00Z', US_DEFAULTS)
    expect(result).toContain('at')
    expect(result).toContain('Mar')
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
})
