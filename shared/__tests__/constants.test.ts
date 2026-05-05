import { describe, it, expect } from 'vitest'
import {
  VALID_MEASUREMENT_TYPES,
  VALID_UNITS,
  VALID_FREQUENCIES,
  LIMITS,
  ROLE_LEVEL,
  hasRole,
  isAsNeeded,
} from '../lib/constants'

describe('VALID_MEASUREMENT_TYPES', () => {
  it('contains all expected types', () => {
    expect(VALID_MEASUREMENT_TYPES).toContain('weight')
    expect(VALID_MEASUREMENT_TYPES).toContain('food')
    expect(VALID_MEASUREMENT_TYPES).toContain('water')
    expect(VALID_MEASUREMENT_TYPES).toContain('litter')
    expect(VALID_MEASUREMENT_TYPES).toContain('grooming')
    expect(VALID_MEASUREMENT_TYPES).toContain('activity')
    expect(VALID_MEASUREMENT_TYPES).toContain('vomiting')
    expect(VALID_MEASUREMENT_TYPES).toHaveLength(7)
  })
})

describe('VALID_UNITS', () => {
  it('contains lbs, kg, and scale', () => {
    expect(VALID_UNITS).toContain('lbs')
    expect(VALID_UNITS).toContain('kg')
    expect(VALID_UNITS).toContain('scale')
    expect(VALID_UNITS).toHaveLength(3)
  })
})

describe('VALID_FREQUENCIES', () => {
  it('contains all expected frequencies', () => {
    expect(VALID_FREQUENCIES).toContain('as_needed')
    expect(VALID_FREQUENCIES).toContain('daily')
    expect(VALID_FREQUENCIES).toContain('twice_daily')
    expect(VALID_FREQUENCIES).toContain('weekly')
    expect(VALID_FREQUENCIES).toContain('monthly')
    expect(VALID_FREQUENCIES).toContain('custom')
    expect(VALID_FREQUENCIES).toHaveLength(6)
  })
})

describe('isAsNeeded', () => {
  it('returns true only for the as_needed frequency', () => {
    expect(isAsNeeded('as_needed')).toBe(true)
    expect(isAsNeeded('daily')).toBe(false)
    expect(isAsNeeded('twice_daily')).toBe(false)
    expect(isAsNeeded('custom')).toBe(false)
    expect(isAsNeeded('')).toBe(false)
  })
})

describe('LIMITS', () => {
  it('has expected values', () => {
    expect(LIMITS.CAT_NAME).toBe(200)
    expect(LIMITS.MEASUREMENT_NOTES).toBe(1000)
    expect(LIMITS.NOTES).toBe(4000)
    expect(LIMITS.PHOTO_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('ROLE_LEVEL', () => {
  it('has ascending privilege', () => {
    expect(ROLE_LEVEL['viewer']).toBeLessThan(ROLE_LEVEL['contributor']!)
    expect(ROLE_LEVEL['contributor']).toBeLessThan(ROLE_LEVEL['editor']!)
    expect(ROLE_LEVEL['editor']).toBeLessThan(ROLE_LEVEL['admin']!)
  })
})

describe('hasRole', () => {
  it('returns true when user role meets requirement', () => {
    expect(hasRole('admin', 'editor')).toBe(true)
    expect(hasRole('editor', 'editor')).toBe(true)
    expect(hasRole('admin', 'viewer')).toBe(true)
  })

  it('returns false when user role is insufficient', () => {
    expect(hasRole('viewer', 'editor')).toBe(false)
    expect(hasRole('contributor', 'admin')).toBe(false)
  })

  it('returns false for null/undefined role', () => {
    expect(hasRole(null, 'viewer')).toBe(false)
    expect(hasRole(undefined, 'editor')).toBe(false)
  })

  it('returns false for unknown role', () => {
    expect(hasRole('superuser', 'viewer')).toBe(false)
  })

  it('returns false for unknown required role', () => {
    expect(hasRole('admin', 'superadmin')).toBe(false)
  })
})
