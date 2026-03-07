// Behavioral measurement types use tap-to-select presets instead of numeric input.
// Values are stored as 0–3 integers with unit='scale'.
// Weight uses a numeric input and is NOT included here.

export interface Preset {
  label: string
  value: number
  // Flags this option as clinically concerning (shown with warning styling)
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
    { label: 'Not used',      value: 0, concern: true },
    { label: 'Straining',     value: 1, concern: true },  // potential blockage — more urgent than diarrhea
    { label: 'Loose/Diarrhea', value: 2, concern: true },
    { label: 'Normal',        value: 3 },
  ],
  grooming: [
    { label: 'None',      value: 0, concern: true },  // not grooming / matted
    { label: 'Less',      value: 1 },
    { label: 'Normal',    value: 2 },
    { label: 'Excessive', value: 3, concern: true },  // overgrooming / hair loss
  ],
  activity: [
    { label: 'Lethargic', value: 0, concern: true },
    { label: 'Low',       value: 1 },
    { label: 'Normal',    value: 2 },
    { label: 'Active',    value: 3 },
  ],
  vomiting: [
    { label: 'None',        value: 0 },
    { label: 'Once',        value: 1 },
    { label: 'A few times', value: 2, concern: true },
    { label: 'Many times',  value: 3, concern: true },
  ],
}

export const PRESET_TYPES = new Set(Object.keys(PRESETS))

/** Returns the display label for a preset measurement, or the raw value string if unknown. */
export function getPresetLabel(type: string, value: number): string {
  const preset = PRESETS[type]?.find((p) => p.value === value)
  return preset?.label ?? String(value)
}

/** Y-axis tick labels for scale charts (index = value 0–3). */
export function getPresetTicks(type: string): string[] {
  const presets = PRESETS[type]
  if (!presets) return ['0', '1', '2', '3']
  return [0, 1, 2, 3].map((v) => presets.find((p) => p.value === v)?.label ?? String(v))
}
