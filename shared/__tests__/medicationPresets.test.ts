import { describe, it, expect } from 'vitest'
import {
  MEDICATION_PRESETS,
  MEDICATION_PRESET_CATEGORIES,
  MEDICATION_FREQ_LABELS,
  MEDICATION_TYPE_LABELS,
  formatFrequencyLabel,
} from '../lib/medicationPresets'

describe('MEDICATION_PRESETS', () => {
  it('has 22 presets', () => {
    expect(MEDICATION_PRESETS).toHaveLength(22)
  })

  it('every preset has required fields', () => {
    for (const p of MEDICATION_PRESETS) {
      expect(p.name).toBeTruthy()
      expect(p.type).toBeTruthy()
      expect(p.frequency).toBeTruthy()
      expect(p.category).toBeTruthy()
    }
  })

  it('every preset category is in MEDICATION_PRESET_CATEGORIES', () => {
    for (const p of MEDICATION_PRESETS) {
      expect(MEDICATION_PRESET_CATEGORIES).toContain(p.category)
    }
  })

  it('custom frequency presets have frequency_days', () => {
    const customPresets = MEDICATION_PRESETS.filter(p => p.frequency === 'custom')
    for (const p of customPresets) {
      expect(p.frequency_days).toBeGreaterThan(0)
    }
  })
})

describe('MEDICATION_FREQ_LABELS', () => {
  it('has labels for all standard frequencies', () => {
    expect(MEDICATION_FREQ_LABELS.daily).toBe('Daily')
    expect(MEDICATION_FREQ_LABELS.twice_daily).toBe('Twice daily')
    expect(MEDICATION_FREQ_LABELS.weekly).toBe('Weekly')
    expect(MEDICATION_FREQ_LABELS.monthly).toBe('Monthly')
    expect(MEDICATION_FREQ_LABELS.custom).toBe('Custom interval')
  })
})

describe('MEDICATION_TYPE_LABELS', () => {
  it('has labels for all medication types', () => {
    expect(MEDICATION_TYPE_LABELS.flea).toBeTruthy()
    expect(MEDICATION_TYPE_LABELS.heartworm).toBeTruthy()
    expect(MEDICATION_TYPE_LABELS.pill).toBeTruthy()
    expect(MEDICATION_TYPE_LABELS.vaccine).toBeTruthy()
    expect(MEDICATION_TYPE_LABELS.other).toBeTruthy()
  })
})

describe('formatFrequencyLabel', () => {
  it('formats standard frequencies', () => {
    expect(formatFrequencyLabel('daily')).toBe('Daily')
    expect(formatFrequencyLabel('twice_daily')).toBe('Twice daily')
    expect(formatFrequencyLabel('weekly')).toBe('Weekly')
    expect(formatFrequencyLabel('monthly')).toBe('Monthly')
  })

  it('formats yearly', () => {
    expect(formatFrequencyLabel('custom', 365)).toBe('Yearly')
  })

  it('formats every 3 years', () => {
    expect(formatFrequencyLabel('custom', 1095)).toBe('Every 3 years')
  })

  it('formats weeks when divisible by 7', () => {
    expect(formatFrequencyLabel('custom', 14)).toBe('Every 2 weeks')
    expect(formatFrequencyLabel('custom', 84)).toBe('Every 12 weeks')
  })

  it('formats arbitrary days', () => {
    expect(formatFrequencyLabel('custom', 30)).toBe('Every 30 days')
    expect(formatFrequencyLabel('custom', 90)).toBe('Every 90 days')
  })

  it('returns raw string for unknown frequency', () => {
    expect(formatFrequencyLabel('biweekly')).toBe('biweekly')
  })
})
