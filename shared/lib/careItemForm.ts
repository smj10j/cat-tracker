/**
 * Shared care item (medication) form logic — pure functions, no React dependency.
 *
 * Platform-specific hooks (app/frontend) use these to avoid duplicating
 * validation, preset application, payload building, and medication hydration.
 */

import type { Medication, MedicationDose, MedicationInput } from './types'
import type { MedicationPreset } from './medicationPresets'
import { isAsNeeded } from './constants'
import { todayLocalDate, roundToHour } from './formatting'

// ---------------------------------------------------------------------------
// Form field defaults
// ---------------------------------------------------------------------------

export interface CareItemFields {
  name: string
  type: string
  dose: string
  frequency: string
  frequencyDays: string
  reminderTime: string
  startDate: string
  endDate: string
  dosesTotal: string
  notes: string
  dosesRemaining: string
  refillThreshold: string
}

export const CARE_ITEM_DEFAULTS: CareItemFields = {
  name: '',
  type: 'other',
  dose: '',
  frequency: 'monthly',
  frequencyDays: '30',
  reminderTime: '09:00',
  startDate: todayLocalDate(),
  endDate: '',
  dosesTotal: '',
  notes: '',
  dosesRemaining: '',
  refillThreshold: '',
}

// ---------------------------------------------------------------------------
// Hydrate form from an existing medication
// ---------------------------------------------------------------------------

export function hydrateFromMedication(med: Medication & { doses?: MedicationDose[] }): CareItemFields {
  return {
    name: med.name,
    type: med.type,
    dose: med.dose ?? '',
    frequency: med.frequency,
    frequencyDays: String(med.frequency_days ?? 30),
    reminderTime: roundToHour(med.reminder_time),
    startDate: med.start_date,
    endDate: med.end_date ?? '',
    dosesTotal: med.doses_total != null ? String(med.doses_total) : '',
    notes: med.notes ?? '',
    dosesRemaining: med.doses_remaining != null ? String(med.doses_remaining) : '',
    refillThreshold: med.refill_alert_threshold != null ? String(med.refill_alert_threshold) : '',
  }
}

// ---------------------------------------------------------------------------
// Apply a preset
// ---------------------------------------------------------------------------

export function applyPresetToFields(fields: CareItemFields, preset: MedicationPreset): CareItemFields {
  return {
    ...fields,
    name: preset.name,
    type: preset.type,
    frequency: preset.frequency,
    frequencyDays: preset.frequency_days ? String(preset.frequency_days) : fields.frequencyDays,
    notes: preset.notes ?? fields.notes,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCareItem(fields: CareItemFields): string | null {
  if (!fields.name.trim()) return 'Name is required'
  if (!fields.startDate) return 'Start date is required'
  return null
}

// ---------------------------------------------------------------------------
// Build API payload
// ---------------------------------------------------------------------------

export function buildCareItemPayload(fields: CareItemFields, catId: string): MedicationInput {
  const asNeeded = isAsNeeded(fields.frequency)
  return {
    cat_id: catId,
    name: fields.name.trim(),
    type: fields.type,
    dose: fields.dose.trim() || null,
    frequency: fields.frequency,
    frequency_days: fields.frequency === 'custom' ? parseInt(fields.frequencyDays, 10) || null : null,
    reminder_time: fields.reminderTime,
    start_date: fields.startDate || todayLocalDate(),
    end_date: asNeeded ? null : (fields.endDate || null),
    doses_total: asNeeded ? null : (fields.dosesTotal ? parseInt(fields.dosesTotal, 10) || null : null),
    notes: fields.notes.trim() || null,
    doses_remaining: asNeeded ? null : (fields.dosesRemaining ? parseInt(fields.dosesRemaining, 10) || null : null),
    refill_alert_threshold: asNeeded ? null : (fields.refillThreshold ? parseInt(fields.refillThreshold, 10) || null : null),
  }
}
