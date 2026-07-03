import { describe, it, expect } from 'vitest'
import { getPresetLabel, getPresetTicks, PRESET_TYPES, PRESETS, BCS_PRESETS, getBcsPreset, getScaleValueLabel } from '../lib/measurementPresets'
import { scaleRange } from '../lib/constants'

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

describe('BCS_PRESETS', () => {
  it('has all 9 scores exactly once, in order', () => {
    expect(BCS_PRESETS.map((p) => p.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('bands the scores per the WSAVA chart (1–4 under, 5 ideal, 6–9 over)', () => {
    expect(getBcsPreset(1)!.band).toBe('under')
    expect(getBcsPreset(4)!.band).toBe('under')
    expect(getBcsPreset(5)!.band).toBe('ideal')
    expect(getBcsPreset(6)!.band).toBe('over')
    expect(getBcsPreset(9)!.band).toBe('over')
  })

  it('carries a verbatim description for every score and the 6/9 footnote', () => {
    for (const p of BCS_PRESETS) expect(p.description.length).toBeGreaterThan(20)
    expect(getBcsPreset(6)!.note).toContain('older cats')
  })

  it('getBcsPreset is undefined outside 1–9', () => {
    expect(getBcsPreset(0)).toBeUndefined()
    expect(getBcsPreset(10)).toBeUndefined()
  })

  it('is NOT registered as a behavioral 0–3 preset type', () => {
    expect(PRESET_TYPES.has('bcs')).toBe(false)
  })
})

describe('getScaleValueLabel', () => {
  it('renders BCS as N/9', () => {
    expect(getScaleValueLabel('bcs', 6)).toBe('6/9')
  })

  it('renders behavioral scales with their preset word', () => {
    expect(getScaleValueLabel('activity', 2)).toBe('Normal')
  })
})

describe('scaleRange', () => {
  it('is 1–9 for bcs and 0–3 for behavioral types', () => {
    expect(scaleRange('bcs')).toEqual({ min: 1, max: 9 })
    expect(scaleRange('food')).toEqual({ min: 0, max: 3 })
    expect(scaleRange('grooming')).toEqual({ min: 0, max: 3 })
  })
})
