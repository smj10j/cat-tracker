/**
 * Shared medication/care presets — used by both frontend/ and app/.
 *
 * Single source of truth for common medication definitions, categories,
 * and frequency label formatting.
 */

export interface MedicationPreset {
  name: string
  type: string
  frequency: string
  frequency_days?: number
  notes?: string
  category: string
}

export const MEDICATION_PRESETS: MedicationPreset[] = [
  // Prevention
  { name: 'Revolution', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical — part fur between shoulder blades', category: 'Prevention' },
  { name: 'Revolution Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical — part fur between shoulder blades', category: 'Prevention' },
  { name: 'Bravecto', type: 'flea', frequency: 'custom', frequency_days: 84, notes: 'Topical — lasts 12 weeks', category: 'Prevention' },
  { name: 'Advantage Multi', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Frontline Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Heartgard Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral chew — give with food', category: 'Prevention' },
  { name: 'Interceptor Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral', category: 'Prevention' },
  // Medication
  { name: 'Methimazole', type: 'pill', frequency: 'twice_daily', notes: 'Hyperthyroid — give with food', category: 'Medication' },
  { name: 'Prednisolone', type: 'pill', frequency: 'daily', notes: 'Steroid — give with food', category: 'Medication' },
  { name: 'Gabapentin', type: 'pill', frequency: 'daily', notes: 'Pain/anxiety', category: 'Medication' },
  { name: 'Cerenia', type: 'pill', frequency: 'daily', notes: 'Anti-nausea', category: 'Medication' },
  { name: 'Onsior', type: 'pill', frequency: 'daily', notes: 'NSAID pain relief — max 6 days', category: 'Medication' },
  { name: 'Mirataz', type: 'other', frequency: 'daily', notes: 'Transdermal — inner ear — appetite stimulant', category: 'Medication' },
  { name: 'Dewormer', type: 'other', frequency: 'custom', frequency_days: 90, category: 'Medication' },
  // Supplement
  { name: 'Lysine', type: 'supplement', frequency: 'daily', notes: 'Immune support', category: 'Supplement' },
  { name: 'Cobalamin (B12)', type: 'supplement', frequency: 'weekly', notes: 'GI support', category: 'Supplement' },
  { name: 'Fortiflora', type: 'supplement', frequency: 'daily', notes: 'Probiotic — sprinkle on food', category: 'Supplement' },
  // Vet
  { name: 'FVRCP vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Rabies vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Annual exam', type: 'exam', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Dental cleaning', type: 'dental', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Bloodwork', type: 'bloodwork', frequency: 'custom', frequency_days: 365, notes: 'Annual screening', category: 'Vet' },
]

export const MEDICATION_PRESET_CATEGORIES = ['Prevention', 'Medication', 'Supplement', 'Vet']

/** Display labels for medication frequencies (used in form selectors) */
export const MEDICATION_FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom interval',
}

/** Display labels for medication/care types (used in form selectors) */
export const MEDICATION_TYPE_LABELS: Record<string, string> = {
  flea: 'Flea/Tick',
  heartworm: 'Heartworm',
  pill: 'Oral med',
  vaccine: 'Vaccine',
  supplement: 'Supplement',
  dental: 'Dental',
  exam: 'Vet exam',
  bloodwork: 'Bloodwork',
  surgery: 'Surgery',
  other: 'Other',
}

/**
 * Format a medication frequency for long/human-readable display.
 * e.g. "Daily", "Twice daily", "Yearly", "Every 3 years", "Every 12 weeks"
 */
export function formatFrequencyLabel(frequency: string, frequencyDays?: number): string {
  if (frequency === 'custom' && frequencyDays) {
    if (frequencyDays === 365) return 'Yearly'
    if (frequencyDays === 1095) return 'Every 3 years'
    if (frequencyDays >= 7 && frequencyDays % 7 === 0) return `Every ${frequencyDays / 7} weeks`
    return `Every ${frequencyDays} days`
  }
  const labels: Record<string, string> = {
    daily: 'Daily', twice_daily: 'Twice daily', weekly: 'Weekly', monthly: 'Monthly',
  }
  return labels[frequency] ?? frequency
}
