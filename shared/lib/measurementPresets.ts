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

// ── Body Condition Score (BCS) ──────────────────────────────────────────────
// BCS is a periodic physical assessment (like weight), NOT a daily behavioral
// 0–3 scale — so it lives outside PRESETS/getPresetTicks (which hardcode 0–3)
// and gets this parallel 9-entry structure.
//
// CLINICAL CONTENT — every per-score `description` below is transcribed VERBATIM
// from the WSAVA Global Nutrition Committee cat Body Condition Score chart
// (June 2025 version). The band labels (Under ideal / Ideal / Over ideal) and the
// score-6 footnote are likewise the chart's own text. Source, access date, and the
// validated systems behind the scale (Laflamme 1997; Bjornvad 2011; Teng 2018) are
// documented in docs/research/body-condition.md. The app TRANSCRIBES the owner's or
// vet's score — it does not compute, infer, or diagnose. Do not add "too heavy /
// too thin" judgments or ideal-range alerts here without a Tier 1 citation and the
// docs/research process (per docs/research/README.md and CLAUDE.md).

export type BcsBand = 'under' | 'ideal' | 'over'

export interface BcsPreset {
  value: number        // 1–9
  band: BcsBand
  description: string   // WSAVA verbatim (cat)
  note?: string         // chart footnote, if any
}

export const BCS_BAND_LABELS: Record<BcsBand, string> = {
  under: 'Under ideal',
  ideal: 'Ideal',
  over: 'Over ideal',
}

export const BCS_PRESETS: BcsPreset[] = [
  { value: 1, band: 'under', description: 'Ribs very easily seen on short-haired cats. No fat pads present. Severe abdominal tuck. Lumbar vertebrae and pelvic bones easily seen and felt.' },
  { value: 2, band: 'under', description: 'Ribs easily seen on short-haired cats. Lumbar vertebrae obvious. Pronounced abdominal tuck. No fat pads present.' },
  { value: 3, band: 'under', description: 'Ribs easily felt with minimal fat covering. Lumbar vertebrae obvious. Obvious waist behind ribs. Minimal abdominal fat pads.' },
  { value: 4, band: 'under', description: 'Ribs felt with minimal fat covering. Noticeable waist behind ribs. Slight abdominal tuck. Minimal abdominal fat pads.' },
  { value: 5, band: 'ideal', description: 'Well-proportioned. Ribs felt with slight fat covering. Waist seen behind ribs, but not pronounced. Abdominal fat pad minimal.' },
  { value: 6, band: 'over', description: 'Ribs felt with slight excess fat covering. Waist and abdominal fat pad present but not obvious. Abdominal tuck absent.', note: 'A body condition score of 6/9 may be acceptable in some cats, especially older cats.' },
  { value: 7, band: 'over', description: 'Ribs not easily felt through moderate fat covering. Waist not easily seen. Slight rounding of abdomen may be present. Moderate abdominal fat pad.' },
  { value: 8, band: 'over', description: 'Ribs not felt due to excess fat covering. Waist absent. Obvious rounding of abdomen with prominent abdominal fat pad. Fat deposits present over lower back area.' },
  { value: 9, band: 'over', description: 'Ribs not felt under heavy fat cover. Heavy fat deposits over lumbar area, face and limbs. Distention of abdomen with no waist. Extensive abdominal fat deposits.' },
]

/** The BCS preset for a given score (1–9), or undefined if out of range. */
export function getBcsPreset(value: number): BcsPreset | undefined {
  return BCS_PRESETS.find((p) => p.value === value)
}

/**
 * Display label for a 'scale'-unit measurement value.
 * BCS shows "6/9"; behavioral types show their preset word ("Normal"). Use this
 * anywhere a scale measurement is rendered (history rows, vet export) so BCS and
 * behavioral scales format consistently across platforms.
 */
export function getScaleValueLabel(type: string, value: number): string {
  if (type === 'bcs') return `${value}/9`
  return getPresetLabel(type, value)
}
