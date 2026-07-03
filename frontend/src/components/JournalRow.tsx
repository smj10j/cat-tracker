import type { JournalEntry } from '../lib/api'
import type { UserPreferences } from '@shared/lib/preferences'
import { formatTime } from '@shared/lib/preferences'
import { JOURNAL_TAG_LABELS } from '@shared/lib/constants'

interface Props {
  entry: JournalEntry
  prefs: UserPreferences
  /** Show the author name (multi-caretaker households). */
  showAuthor: boolean
  onClick: () => void
}

/**
 * A single observations-journal entry rendered in the History timeline
 * (PRD-notes-journal, Phase A). Visually distinct from measurement rows:
 * 📝 icon, first ~2 lines of text, tag chips, subtle author attribution.
 * Tapping opens the edit form.
 */
export default function JournalRow({ entry, prefs, showAuthor, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex gap-3 py-2.5 border-b last:border-0 transition-colors hover:bg-white/[0.02]"
      style={{ borderColor: 'var(--color-tab-bar)' }}
    >
      <span className="text-ink-dim text-xs w-16 shrink-0 tabular-nums pt-0.5">{formatTime(entry.occurred_at, prefs)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <span className="text-sm leading-tight shrink-0">📝</span>
          <p
            className="text-sm text-ink flex-1 min-w-0"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {entry.text}
          </p>
        </div>
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 ml-6">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(192,132,252,0.12)', color: 'var(--color-brand)' }}
              >
                {JOURNAL_TAG_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>
        )}
        {showAuthor && entry.author_name && (
          <p className="text-[10px] text-ink-dim/70 mt-1 ml-6">— {entry.author_name}</p>
        )}
      </div>
      <span className="text-ink-dim/60 text-xs shrink-0 self-center">›</span>
    </button>
  )
}
