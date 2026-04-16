/**
 * Hero stat treatment — the app's signature motif.
 *
 * A large tabular-numeral value with a smaller baseline-aligned unit,
 * underlined by a 1px brand-color bar that spans only the numeric portion.
 * Used on CatProfile (current weight), Home (cat row weight), Daily Check-In
 * (confirmation), and vet export (top stat).
 *
 * PRD-visual-identity-v2 §8.
 */

interface HeroStatProps {
  /** The numeric portion (e.g., "9.4") */
  value: string
  /** The unit label (e.g., "lbs") — rendered smaller, baseline-aligned */
  unit?: string
  /** Font size for the value in px. Default: 48 on desktop, 36 on mobile. */
  size?: number
  /** Override the underline color. Default: var(--color-brand). */
  color?: string
  /** Extra className on the wrapper. */
  className?: string
}

export default function HeroStat({ value, unit, size = 48, color, className = '' }: HeroStatProps) {
  const unitSize = Math.round(size * 0.5)
  const underlineOffset = Math.round(size * 0.12)

  return (
    <span
      className={`inline-flex items-baseline gap-1 ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Numeric value with underline */}
      <span className="relative">
        <span
          style={{
            fontSize: size,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
            color: color ?? 'var(--color-brand)',
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </span>
        {/* Brand underline — the motif */}
        <span
          className="absolute left-0 right-0"
          style={{
            bottom: -underlineOffset,
            height: 1,
            background: color ?? 'var(--color-brand)',
            opacity: 0.5,
            borderRadius: 1,
          }}
        />
      </span>

      {/* Unit */}
      {unit && (
        <span
          style={{
            fontSize: unitSize,
            fontWeight: 500,
            color: 'var(--color-ink-mid)',
            lineHeight: 1,
          }}
        >
          {unit}
        </span>
      )}
    </span>
  )
}
