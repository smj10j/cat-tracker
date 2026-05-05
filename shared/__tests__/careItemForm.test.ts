import { describe, it, expect } from 'vitest'
import {
  CARE_ITEM_DEFAULTS,
  hydrateFromMedication,
  applyPresetToFields,
  validateCareItem,
  buildCareItemPayload,
  type CareItemFields,
} from '../lib/careItemForm'
import type { Medication } from '../lib/types'
import type { MedicationPreset } from '../lib/medicationPresets'

const mockMedication: Medication & { doses: [] } = {
  id: 'med-1',
  cat_id: 'cat-1',
  user_id: 'user-1',
  name: 'Revolution Plus',
  type: 'flea',
  dose: '2.5mg',
  frequency: 'custom',
  frequency_days: 30,
  reminder_time: '09:30',
  start_date: '2026-01-15',
  end_date: '2026-12-31',
  is_active: 1,
  doses_total: null,
  doses_remaining: 5,
  refill_alert_threshold: 2,
  next_due_at: null,
  notes: 'Topical',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  doses: [],
}

const mockPreset: MedicationPreset = {
  name: 'Bravecto',
  type: 'flea',
  frequency: 'custom',
  frequency_days: 84,
  notes: 'Topical — lasts 12 weeks',
  category: 'Prevention',
}

describe('CARE_ITEM_DEFAULTS', () => {
  it('has sensible default values', () => {
    expect(CARE_ITEM_DEFAULTS.name).toBe('')
    expect(CARE_ITEM_DEFAULTS.type).toBe('other')
    expect(CARE_ITEM_DEFAULTS.frequency).toBe('monthly')
    expect(CARE_ITEM_DEFAULTS.reminderTime).toBe('09:00')
  })

  it('startDate is today', () => {
    expect(CARE_ITEM_DEFAULTS.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('hydrateFromMedication', () => {
  it('populates all fields from a medication', () => {
    const fields = hydrateFromMedication(mockMedication)
    expect(fields.name).toBe('Revolution Plus')
    expect(fields.type).toBe('flea')
    expect(fields.dose).toBe('2.5mg')
    expect(fields.frequency).toBe('custom')
    expect(fields.frequencyDays).toBe('30')
    expect(fields.startDate).toBe('2026-01-15')
    expect(fields.endDate).toBe('2026-12-31')
    expect(fields.notes).toBe('Topical')
    expect(fields.dosesRemaining).toBe('5')
    expect(fields.refillThreshold).toBe('2')
  })

  it('rounds reminder time to nearest hour', () => {
    const fields = hydrateFromMedication(mockMedication)
    // 09:30 rounds up to 10:00
    expect(fields.reminderTime).toBe('10:00')
  })

  it('handles null optional fields', () => {
    const med = { ...mockMedication, dose: null, end_date: null, notes: null, doses_remaining: null, refill_alert_threshold: null }
    const fields = hydrateFromMedication(med)
    expect(fields.dose).toBe('')
    expect(fields.endDate).toBe('')
    expect(fields.notes).toBe('')
    expect(fields.dosesRemaining).toBe('')
    expect(fields.refillThreshold).toBe('')
  })
})

describe('applyPresetToFields', () => {
  it('overwrites name, type, frequency, notes from preset', () => {
    const result = applyPresetToFields(CARE_ITEM_DEFAULTS, mockPreset)
    expect(result.name).toBe('Bravecto')
    expect(result.type).toBe('flea')
    expect(result.frequency).toBe('custom')
    expect(result.frequencyDays).toBe('84')
    expect(result.notes).toBe('Topical — lasts 12 weeks')
  })

  it('preserves fields not in preset', () => {
    const existing: CareItemFields = {
      ...CARE_ITEM_DEFAULTS,
      dose: '5mg',
      startDate: '2026-06-01',
    }
    const result = applyPresetToFields(existing, mockPreset)
    expect(result.dose).toBe('5mg')
    expect(result.startDate).toBe('2026-06-01')
  })

  it('keeps existing notes if preset has no notes', () => {
    const preset: MedicationPreset = { name: 'Custom', type: 'pill', frequency: 'daily', category: 'Medication' }
    const existing = { ...CARE_ITEM_DEFAULTS, notes: 'Keep these notes' }
    const result = applyPresetToFields(existing, preset)
    expect(result.notes).toBe('Keep these notes')
  })
})

describe('validateCareItem', () => {
  it('returns null for valid fields', () => {
    const fields = { ...CARE_ITEM_DEFAULTS, name: 'Test Med', startDate: '2026-01-01' }
    expect(validateCareItem(fields)).toBeNull()
  })

  it('returns error when name is empty', () => {
    expect(validateCareItem(CARE_ITEM_DEFAULTS)).toBe('Name is required')
  })

  it('returns error when name is whitespace', () => {
    const fields = { ...CARE_ITEM_DEFAULTS, name: '   ' }
    expect(validateCareItem(fields)).toBe('Name is required')
  })

  it('returns error when startDate is empty', () => {
    const fields = { ...CARE_ITEM_DEFAULTS, name: 'Test', startDate: '' }
    expect(validateCareItem(fields)).toBe('Start date is required')
  })
})

describe('buildCareItemPayload', () => {
  const validFields: CareItemFields = {
    ...CARE_ITEM_DEFAULTS,
    name: 'Revolution Plus',
    type: 'flea',
    dose: '2.5mg',
    frequency: 'custom',
    frequencyDays: '30',
    reminderTime: '09:00',
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    dosesTotal: '12',
    notes: 'Topical',
    dosesRemaining: '5',
    refillThreshold: '2',
  }

  it('builds correct payload', () => {
    const payload = buildCareItemPayload(validFields, 'cat-1')
    expect(payload.cat_id).toBe('cat-1')
    expect(payload.name).toBe('Revolution Plus')
    expect(payload.type).toBe('flea')
    expect(payload.dose).toBe('2.5mg')
    expect(payload.frequency).toBe('custom')
    expect(payload.frequency_days).toBe(30)
    expect(payload.reminder_time).toBe('09:00')
    expect(payload.start_date).toBe('2026-01-15')
    expect(payload.end_date).toBe('2026-12-31')
    expect(payload.doses_total).toBe(12)
    expect(payload.notes).toBe('Topical')
    expect(payload.doses_remaining).toBe(5)
    expect(payload.refill_alert_threshold).toBe(2)
  })

  it('trims name and dose', () => {
    const fields = { ...validFields, name: '  Test  ', dose: '  5mg  ' }
    const payload = buildCareItemPayload(fields, 'cat-1')
    expect(payload.name).toBe('Test')
    expect(payload.dose).toBe('5mg')
  })

  it('nullifies empty optional fields', () => {
    const fields = { ...validFields, dose: '', endDate: '', notes: '  ', dosesTotal: '', dosesRemaining: '', refillThreshold: '' }
    const payload = buildCareItemPayload(fields, 'cat-1')
    expect(payload.dose).toBeNull()
    expect(payload.end_date).toBeNull()
    expect(payload.notes).toBeNull()
    expect(payload.doses_total).toBeNull()
    expect(payload.doses_remaining).toBeNull()
    expect(payload.refill_alert_threshold).toBeNull()
  })

  it('only includes frequency_days for custom frequency', () => {
    const daily = { ...validFields, frequency: 'daily', frequencyDays: '30' }
    expect(buildCareItemPayload(daily, 'cat-1').frequency_days).toBeNull()

    const custom = { ...validFields, frequency: 'custom', frequencyDays: '30' }
    expect(buildCareItemPayload(custom, 'cat-1').frequency_days).toBe(30)
  })

  it('strips schedule and stock fields when frequency is as_needed', () => {
    const prn: CareItemFields = {
      ...validFields,
      frequency: 'as_needed',
      frequencyDays: '30',
      endDate: '2026-12-31',
      dosesTotal: '14',
      dosesRemaining: '5',
      refillThreshold: '2',
    }
    const payload = buildCareItemPayload(prn, 'cat-1')
    expect(payload.frequency).toBe('as_needed')
    expect(payload.frequency_days).toBeNull()
    expect(payload.end_date).toBeNull()
    expect(payload.doses_total).toBeNull()
    expect(payload.doses_remaining).toBeNull()
    expect(payload.refill_alert_threshold).toBeNull()
    // start_date is preserved (defaults to today if blank)
    expect(payload.start_date).toBe('2026-01-15')
    // notes flow through (used as the "give if" trigger)
    expect(payload.notes).toBe('Topical')
  })
})
