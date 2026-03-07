// Behavioral measurement types use tap-to-select presets instead of numeric input.
// Values are stored as 0–3 integers with unit='scale'.
// Weight uses a numeric input and is NOT included here.

export interface Preset {
  label: string
  value: number
  // Optional color hint for rendering (warn on concerning values)
  concern?: boolean
}

export const PRESETS: Record<string, Preset[]> = {
  food: [
    { label: 'None',  value: 0, concern: true },
    { label: 'Some',  value: 1 },
    { label: 'Most',  value: 2 },
    { label: 'All',   value: 3 },
  ],
  water: [
    { label: 'None',  value: 0, concern: true },
    { label: 'Some',  value: 1 },
    { label: 'Most',  value: 2 },
    { label: 'All',   value: 3 },
  ],
  litter: [
    { label: 'Not used',   value: 0, concern: true },
    { label: 'Diarrhea',   value: 1, concern: true },
    { label: 'Straining',  value: 2, concern: true },
    { label: 'Normal',     value: 3 },
  ],
  grooming: [
    { label: 'Not grooming', value: 0, concern: true },
    { label: 'Less than usual', value: 1 },
    { label: 'Normal',       value: 2 },
    { label: 'Excessive',    value: 3, concern: true },
  ],
  activity: [
    { label: 'Lethargic', value: 0, concern: true },
    { label: 'Low',       value: 1 },
    { label: 'Normal',    value: 2 },
    { label: 'Active',    value: 3 },
  ],
  vomiting: [
    { label: 'None',       value: 0 },
    { label: 'Once',       value: 1 },
    { label: 'A few times', value: 2, concern: true },
    { label: 'Many times', value: 3, concern: true },
  ],
}

export const PRESET_TYPES = new Set(Object.keys(PRESETS))

/** Returns the display label for a preset measurement, or the raw value if unknown. */
export function getPresetLabel(type: string, value: number): string {
  const preset = PRESETS[type]?.find((p) => p.value === value)
  return preset?.label ?? String(value)
}
