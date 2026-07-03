import { describe, it, expect } from 'vitest'
import { isValidHM, inQuietHours } from '../lib/notifications'

describe('isValidHM', () => {
  it('accepts valid 24h times', () => {
    for (const s of ['00:00', '08:00', '09:30', '23:59', '12:45']) {
      expect(isValidHM(s)).toBe(true)
    }
  })
  it('rejects malformed or out-of-range times', () => {
    for (const s of ['8:00', '24:00', '23:60', '07:5', 'ab:cd', '', '0800', '25:00', '12:99']) {
      expect(isValidHM(s)).toBe(false)
    }
  })
})

describe('inQuietHours', () => {
  it('is false when either bound is null or the window is zero-length', () => {
    expect(inQuietHours('23:00', null, '07:00')).toBe(false)
    expect(inQuietHours('23:00', '22:00', null)).toBe(false)
    expect(inQuietHours('22:00', '22:00', '22:00')).toBe(false)
  })

  it('handles a same-day window [start, end)', () => {
    // 13:00–17:00
    expect(inQuietHours('12:59', '13:00', '17:00')).toBe(false)
    expect(inQuietHours('13:00', '13:00', '17:00')).toBe(true)   // inclusive start
    expect(inQuietHours('16:59', '13:00', '17:00')).toBe(true)
    expect(inQuietHours('17:00', '13:00', '17:00')).toBe(false)  // exclusive end
  })

  it('handles a window that wraps past midnight (22:00–07:00)', () => {
    expect(inQuietHours('22:00', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('23:30', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('00:00', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('06:59', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('07:00', '22:00', '07:00')).toBe(false) // exclusive end
    expect(inQuietHours('12:00', '22:00', '07:00')).toBe(false)
    expect(inQuietHours('21:59', '22:00', '07:00')).toBe(false)
  })
})
