import { BCS_PRESETS, BCS_BAND_LABELS, getBcsPreset } from '@shared/lib/measurementPresets'

interface Props {
  /** Currently selected score (1–9), or null when nothing is chosen. */
  value: number | null
  /** Called with the tapped score. */
  onChange: (value: number) => void
  disabled?: boolean
}

/**
 * Nine-segment Body Condition Score picker (WSAVA 9-point scale).
 *
 * CLINICAL CONTENT: the only evaluative words rendered here are the transcribed
 * band label (BCS_BAND_LABELS) and the verbatim WSAVA description/note carried by
 * the shared BCS_PRESETS — no authored judgment copy, no band-based color coding
 * (every segment uses the same brand styling). See docs/research/body-condition.md.
 */
export default function BcsPicker({ value, onChange, disabled }: Props) {
  const selected = value != null ? getBcsPreset(value) : undefined

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <label className="block text-xs font-semibold text-ink-mid uppercase tracking-wider">Body Condition</label>
        <span className="text-[11px] text-ink-dim shrink-0">9-point body condition scale</span>
      </div>

      {/* One row of nine on wider layouts; 3×3 grid at mobile widths. */}
      <div
        role="group"
        aria-label="Body condition score, 1 to 9"
        className="grid grid-cols-3 gap-2 min-[520px]:grid-cols-9 min-[520px]:gap-1.5"
      >
        {BCS_PRESETS.map((preset) => {
          const isSelected = value === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Score ${preset.value} of 9`}
              className="rounded-xl text-base font-bold tabular-nums transition-all"
              style={{
                minHeight: 48,
                background: isSelected ? 'rgba(192,132,252,0.15)' : 'var(--color-card)',
                border: isSelected ? '1.5px solid rgba(192,132,252,0.5)' : '1px solid var(--color-rim)',
                color: isSelected ? 'var(--color-brand)' : 'var(--color-ink)',
                boxShadow: isSelected ? '0 0 12px rgba(192,132,252,0.22)' : undefined,
              }}
            >
              {preset.value}
            </button>
          )
        })}
      </div>

      {/* Chosen score's transcribed WSAVA meaning (shown only once selected). */}
      {selected && (
        <div
          className="mt-3 p-3 rounded-xl"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-brand)' }}>
              {selected.value}/9
            </span>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(192,132,252,0.12)', color: 'var(--color-brand)', border: '1px solid rgba(192,132,252,0.25)' }}
            >
              {BCS_BAND_LABELS[selected.band]}
            </span>
          </div>
          <p className="text-xs text-ink-mid leading-relaxed">{selected.description}</p>
          {selected.note && (
            <p className="text-[11px] text-ink-dim italic mt-1.5">{selected.note}</p>
          )}
        </div>
      )}
    </div>
  )
}
