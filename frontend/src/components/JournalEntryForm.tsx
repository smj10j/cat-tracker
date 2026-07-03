import { useState } from 'react'
import { createJournalEntry, updateJournalEntry, deleteJournalEntry, type JournalEntry } from '../lib/api'
import { usePreferences } from '../contexts/PreferencesContext'
import { todayLocalDate, currentHour, formatHour, buildMeasuredAt } from '@shared/lib/formatting'
import { LIMITS } from '@shared/lib/constants'
import JournalTagChips from './JournalTagChips'

interface Props {
  catId: string
  /** Present = edit an existing entry; absent = create a new one. */
  entry?: JournalEntry
  onSaved: (entry: JournalEntry) => void
  onDeleted?: (id: string) => void
  onCancel: () => void
}

/** Split an ISO/stored datetime into the local `YYYY-MM-DD` date + 0-23 hour. */
function localParts(iso: string): { date: string; hour: number } {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: todayLocalDate(), hour: currentHour() }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours() }
}

/**
 * Create/edit form for an observations-journal entry (PRD-notes-journal, Phase A).
 * Reuses the check-in date+hour pattern so entries can be backdated.
 */
export default function JournalEntryForm({ catId, entry, onSaved, onDeleted, onCancel }: Props) {
  const { prefs } = usePreferences()
  const isEdit = !!entry
  const init = entry ? localParts(entry.occurred_at) : { date: todayLocalDate(), hour: currentHour() }

  const [text, setText] = useState(entry?.text ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [date, setDate] = useState(init.date)
  const [hour, setHour] = useState(init.hour)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function handleSave() {
    const trimmed = text.trim()
    if (!trimmed) { setError('Add a note before saving.'); return }
    if (trimmed.length > LIMITS.JOURNAL_TEXT) {
      setError(`Notes are limited to ${LIMITS.JOURNAL_TEXT} characters.`); return
    }
    setSaving(true)
    setError(null)
    try {
      const occurred_at = buildMeasuredAt(date, hour)
      const saved = isEdit
        ? await updateJournalEntry(entry!.id, { occurred_at, text: trimmed, tags })
        : await createJournalEntry(catId, { occurred_at, text: trimmed, tags })
      onSaved(saved)
    } catch {
      setError('Couldn\'t save. Check your connection and try again.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    setSaving(true)
    setError(null)
    try {
      await deleteJournalEntry(entry.id)
      onDeleted?.(entry.id)
    } catch {
      setError('Couldn\'t delete. Try again.')
      setSaving(false)
    }
  }

  const count = text.trim().length
  const overLimit = count > LIMITS.JOURNAL_TEXT

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-ink">{isEdit ? 'Edit note' : 'New note'}</h3>
        <button
          onClick={onCancel}
          className="text-ink-dim hover:text-ink-mid text-xl leading-none flex items-center justify-center rounded-full hover:bg-white/5 transition-all"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="text-rose text-sm p-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)' }}>
          {error}
        </div>
      )}

      {/* Date & time (backdatable) */}
      <div>
        <label htmlFor="jform-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Date &amp; Time</label>
        <div className="flex gap-2">
          <input
            id="jform-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayLocalDate()}
            className="input-dark flex-1 px-3 py-2.5 text-sm"
          />
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="input-dark px-3 py-2.5 text-sm"
            style={{ minWidth: 110 }}
            aria-label="Hour"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{formatHour(i, prefs)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note text */}
      <div>
        <label htmlFor="jform-text" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Note</label>
        <textarea
          id="jform-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.JOURNAL_TEXT}
          rows={4}
          placeholder="What did you notice? e.g., 'Hiding under the bed since this morning.'"
          className="input-dark w-full px-3 py-2.5 text-sm resize-none"
        />
        {count > 1800 && (
          <p className="text-xs mt-1 text-right tabular-nums" style={{ color: overLimit ? 'var(--color-health-rose)' : 'var(--color-ink-dim)' }}>
            {count} / {LIMITS.JOURNAL_TEXT}
          </p>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Tags <span className="normal-case text-ink-dim">— optional</span></label>
        <JournalTagChips selected={tags} onToggle={toggleTag} disabled={saving} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || count === 0 || overLimit}
          aria-busy={saving}
          className="btn-primary flex-1 py-3 text-sm"
          style={saving || count === 0 || overLimit ? { opacity: 0.5 } : undefined}
        >
          {saving ? 'Saving…' : isEdit ? 'Save note' : 'Add note'}
        </button>

        {isEdit && (
          confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2.5 py-2 rounded-lg"
                style={{ color: 'var(--color-ink-dim)', background: 'var(--color-card)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-xs px-2.5 py-2 rounded-lg font-semibold"
                style={{ color: 'var(--color-health-rose)', background: 'rgba(248,113,113,0.1)' }}
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs px-3 py-3 rounded-lg shrink-0 transition-colors"
              style={{ color: 'var(--color-health-rose)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
  )
}
