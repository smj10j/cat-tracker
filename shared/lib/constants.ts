/**
 * Shared validation constants — used by worker/, frontend/, and app/.
 *
 * Single source of truth for allowed values and field length limits.
 */

/** Allowed measurement types */
export const VALID_MEASUREMENT_TYPES = ['weight', 'food', 'water', 'litter', 'grooming', 'activity', 'vomiting', 'bcs'] as const;
export type MeasurementType = typeof VALID_MEASUREMENT_TYPES[number];

/** Display labels for measurement types (short form) */
export const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  litter: 'Litter Box', grooming: 'Grooming',
  activity: 'Activity', vomiting: 'Vomiting',
  bcs: 'Body Condition',
  play: 'Play',
}

/** Extended labels for form contexts ("Food Intake" instead of "Food") */
export const MEASUREMENT_TYPE_LABELS_LONG: Record<string, string> = {
  ...MEASUREMENT_TYPE_LABELS,
  food: 'Food Intake', water: 'Water Intake',
  bcs: 'Body Condition Score',
}

/**
 * Body condition score is a WSAVA 9-point scale (1–9); behavioral scales are 0–3.
 * BCS rides the generic measurements table (type='bcs', unit='scale') but its
 * valid range differs, so scale validation must branch on TYPE, not unit.
 * See docs/research/body-condition.md (WSAVA Global Nutrition Committee cat BCS chart).
 */
export const BCS_MIN = 1
export const BCS_MAX = 9

/** Valid [min, max] integer range for a 'scale'-unit measurement, keyed by type. */
export function scaleRange(type: string): { min: number; max: number } {
  return type === 'bcs' ? { min: BCS_MIN, max: BCS_MAX } : { min: 0, max: 3 }
}

/** Behavioral (non-weight) measurement types — ordered list with labels */
export const BEHAVIORAL_TYPES = [
  { key: 'food', label: 'Food' },
  { key: 'water', label: 'Water' },
  { key: 'litter', label: 'Litter' },
  { key: 'grooming', label: 'Grooming' },
  { key: 'activity', label: 'Activity' },
  { key: 'vomiting', label: 'Vomiting' },
] as const

/** Set of all behavioral (non-weight) measurement types */
export const BEHAVIORAL_TYPE_SET = new Set(BEHAVIORAL_TYPES.map(t => t.key))

/** Behavioral types shown under the "behavior" chart tab (excludes food/water which have own tabs) */
export const BEHAVIOR_CHART_TYPES = new Set(['grooming', 'play', 'activity', 'vomiting', 'litter'])

/**
 * Observations-journal preset tags (PRD-notes-journal). Descriptive, never
 * diagnostic — we record what the owner observed ("hiding"), not an
 * interpretation ("depression"), mirroring the behavioral-measurement discipline
 * in docs/research/behavioral-indicators.md. The Worker rejects any tag not in
 * this list so the taxonomy can't drift into clinical language.
 */
export const VALID_JOURNAL_TAGS = [
  'hiding', 'limping', 'low_energy', 'restless', 'vocalizing', 'sneezing',
  'coughing', 'overgrooming', 'scratching', 'eating_less', 'eating_more',
  'drinking_more', 'litter_change', 'vet_visit', 'good_day',
] as const
export type JournalTag = typeof VALID_JOURNAL_TAGS[number]

export const JOURNAL_TAG_LABELS: Record<string, string> = {
  hiding: 'Hiding',
  limping: 'Limping',
  low_energy: 'Low energy',
  restless: 'Restless',
  vocalizing: 'Vocalizing more',
  sneezing: 'Sneezing',
  coughing: 'Coughing',
  overgrooming: 'Overgrooming',
  scratching: 'Scratching',
  eating_less: 'Eating less',
  eating_more: 'Eating more',
  drinking_more: 'Drinking more',
  litter_change: 'Litter box change',
  vet_visit: 'Vet visit / call',
  good_day: 'Good day',
}

/** Chart line colors — canonical palette for multi-series charts */
export const CHART_LINE_COLORS = ['#c084fc', '#4ade80', '#f97316', '#fbbf24', '#fb923c', '#f87171'] as const

/** Allowed measurement units */
export const VALID_UNITS = ['lbs', 'kg', 'scale'] as const;
export type MeasurementUnit = typeof VALID_UNITS[number];

/** Allowed medication frequencies */
export const VALID_FREQUENCIES = ['as_needed', 'daily', 'twice_daily', 'weekly', 'monthly', 'custom'] as const;
export type MedicationFrequency = typeof VALID_FREQUENCIES[number];

/** True when a frequency means "give only when triggered" — no schedule, no reminders */
export function isAsNeeded(frequency: string): boolean {
  return frequency === 'as_needed';
}

/** Field length limits */
export const LIMITS = {
  CAT_NAME: 200,
  BREED: 200,
  COLORING: 200,
  MICROCHIP: 50,
  NOTES: 4000,
  MEASUREMENT_NOTES: 1000,
  MEMORIAL_NOTE: 1024,
  PHOTO_BYTES: 5 * 1024 * 1024,
  MED_NAME: 200,
  MED_TYPE: 50,
  MED_DOSE: 100,
  MED_NOTES: 1000,
  ACK_NOTE: 280,
  JOURNAL_TEXT: 2000,
} as const;

/** Health alert acknowledgment enums (PRD-alert-acknowledgment). */
export const VALID_ACK_SEVERITIES = ['watch', 'concerning', 'urgent'] as const;
export const VALID_ACK_DIRECTIONS = ['loss', 'gain'] as const;
export const VALID_ACK_KINDS = ['weight'] as const;   // v1: weight alert only
/** Days before an acknowledgment force-expires and the full alert returns. */
export const ACK_EXPIRY_DAYS = 30;

/** Household role hierarchy (ascending privilege) */
export const ROLE_LEVEL: Record<string, number> = {
  viewer: 1,
  contributor: 2,
  editor: 3,
  admin: 4,
};

/** Check if a user's role meets the required minimum. */
export function hasRole(userRole: string | null | undefined, required: string): boolean {
  return (ROLE_LEVEL[userRole ?? ''] ?? 0) >= (ROLE_LEVEL[required] ?? 999);
}
