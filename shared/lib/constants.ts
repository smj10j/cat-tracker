/**
 * Shared validation constants — used by worker/, frontend/, and app/.
 *
 * Single source of truth for allowed values and field length limits.
 */

/** Allowed measurement types */
export const VALID_MEASUREMENT_TYPES = ['weight', 'food', 'water', 'litter', 'grooming', 'activity', 'vomiting'] as const;
export type MeasurementType = typeof VALID_MEASUREMENT_TYPES[number];

/** Allowed measurement units */
export const VALID_UNITS = ['lbs', 'kg', 'scale'] as const;
export type MeasurementUnit = typeof VALID_UNITS[number];

/** Allowed medication frequencies */
export const VALID_FREQUENCIES = ['daily', 'twice_daily', 'weekly', 'monthly', 'custom'] as const;
export type MedicationFrequency = typeof VALID_FREQUENCIES[number];

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
} as const;

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
