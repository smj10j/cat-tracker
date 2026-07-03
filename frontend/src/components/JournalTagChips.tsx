import { VALID_JOURNAL_TAGS, JOURNAL_TAG_LABELS } from '@shared/lib/constants'

interface Props {
  selected: string[]
  onToggle: (tag: string) => void
  disabled?: boolean
}

/**
 * Multi-select preset tag chips for the observations journal (PRD-notes-journal).
 * Descriptive tags only — the list is curated in `shared/lib/constants.ts`.
 * Shared by the cat-profile note form and the daily check-in quick-add.
 */
export default function JournalTagChips({ selected, onToggle, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VALID_JOURNAL_TAGS.map((tag) => {
        const on = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            disabled={disabled}
            aria-pressed={on}
            className="text-xs font-medium px-2.5 py-1.5 rounded-full transition-all"
            style={{
              background: on ? 'rgba(192,132,252,0.15)' : 'var(--color-card)',
              border: on ? '1.5px solid rgba(192,132,252,0.45)' : '1px solid var(--color-rim)',
              color: on ? 'var(--color-brand)' : 'var(--color-ink-dim)',
            }}
          >
            {JOURNAL_TAG_LABELS[tag] ?? tag}
          </button>
        )
      })}
    </div>
  )
}
