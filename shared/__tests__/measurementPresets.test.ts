import { describe, it, expect } from 'vitest'
import { getPresetLabel, getPresetTicks, PRESET_TYPES, PRESETS } from '../lib/measurementPresets'

describe('PRESET_TYPES', () => {
  it('includes all behavioral measurement types', () => {
    const expected = ['food', 'water', 'litter', 'grooming', 'activity', 'vomiting']
    for (const type of expected) {
      expect(PRESET_TYPES.has(type)).toBe(true)
    }
  })

  it('does not include weight (numeric, not preset)', () => {
    expect(PRESET_TYPES.has('weight')).toBe(false)
  })
})

describe('PRESETS', () => {
  it('has exactly 4 levels (0–3) for each preset type', () => {
    for (const type of PRESET_TYPES) {
      const presets = PRESETS[type]
      expect(presets).toBeDefined()
      expect(Object.keys(presets!)).toHaveLength(4)
      expect(presets![0]).toBeDefined()
      expect(presets![3]).toBeDefined()
    }
  })
})

describe('getPresetLabel', () => {
  it('returns the correct label for food type', () => {
    expect(getPresetLabel('food', 0)).toBe('None')
    expect(getPresetLabel('food', 1)).toBe('Some')
    expect(getPresetLabel('food', 2)).toBe('Most')
    expect(getPresetLabel('food', 3)).toBe('All')
  })

  it('returns the correct label for water type', () => {
    expect(getPresetLabel('water', 0)).toBe('None')
    expect(getPresetLabel('water', 3)).toBe('All')
  })

  it('returns the correct label for activity type', () => {
    expect(getPresetLabel('activity', 0)).toBe('Lethargic')
    expect(getPresetLabel('activity', 2)).toBe('Normal')
    expect(getPresetLabel('activity', 3)).toBe('Active')
  })

  it('returns the correct label for grooming type', () => {
    expect(getPresetLabel('grooming', 0)).toBe('None')
    expect(getPresetLabel('grooming', 2)).toBe('Normal')
    expect(getPresetLabel('grooming', 3)).toBe('Excessive')
  })

  it('returns the correct label for litter type', () => {
    expect(getPresetLabel('litter', 0)).toBe('Not used')
    expect(getPresetLabel('litter', 3)).toBe('Normal')
  })

  it('returns the correct label for vomiting type', () => {
    expect(getPresetLabel('vomiting', 0)).toBe('None')
    expect(getPresetLabel('vomiting', 3)).toBe('Many times')
  })

  it('falls back to the numeric value for unknown types', () => {
    expect(getPresetLabel('weight', 10.5)).toBe('10.5')
    expect(getPresetLabel('unknown', 2)).toBe('2')
  })
})

describe('getPresetTicks', () => {
  it('returns an array for each preset type', () => {
    for (const type of PRESET_TYPES) {
      const ticks = getPresetTicks(type)
      expect(Array.isArray(ticks)).toBe(true)
      expect(ticks.length).toBeGreaterThan(0)
    }
  })

  it('returns a generic 0-3 tick array for non-preset types', () => {
    // weight is not a preset type — function falls back to ['0','1','2','3']
    const ticks = getPresetTicks('weight')
    expect(Array.isArray(ticks)).toBe(true)
    expect(ticks).toEqual(['0', '1', '2', '3'])
  })
})
