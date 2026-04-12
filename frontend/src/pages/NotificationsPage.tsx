import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { getNotifications, administerDose, skipDose, CARE_TYPE_ICONS, type NotificationInbox, type DoseWithContext, type Medication } from '../lib/api'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatDueAt, formatFutureDueAt } from '@shared/lib/formatting'
import type { UserPreferences } from '@shared/lib/preferences'

interface DoseCardProps {
  dose: DoseWithContext
  variant: 'overdue' | 'today' | 'upcoming'
  onAdminister: (id: string) => void
  onSkip: (id: string) => void
  acting: string | null
  prefs: UserPreferences
}

function DoseCard({ dose, variant, onAdminister, onSkip, acting, prefs }: DoseCardProps) {
  const isActing = acting === dose.id

  const borderColor = variant === 'overdue'
    ? 'var(--color-overdue-border)'
    : variant === 'today'
    ? 'var(--color-due-today-border)'
    : 'var(--color-rim)'

  const bg = variant === 'overdue'
    ? 'var(--color-overdue-bg)'
    : variant === 'today'
    ? 'var(--color-due-today-bg)'
    : 'var(--color-card)'

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: bg, border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-ink text-sm truncate">
            <span className="mr-1">{CARE_TYPE_ICONS[dose.med_type] ?? '📅'}</span>
            <span className="font-bold">{dose.cat_name}</span>
            <span className="text-ink-dim font-normal"> &middot; </span>
            <span className="font-medium text-ink-mid">{dose.med_name}</span>
          </p>
          {dose.dose && (
            <p className="text-xs text-ink-dim mt-0.5">{dose.dose}</p>
          )}
          <p className="text-xs mt-1" style={{
            color: variant === 'overdue' ? 'var(--color-overdue-muted)' : variant === 'today' ? 'var(--color-due-today-muted)' : 'var(--color-ink-dim)',
          }}>
            {variant === 'overdue' ? 'Was due: ' : 'Due: '}
            {variant === 'upcoming' ? formatFutureDueAt(dose.due_at, prefs) : formatDueAt(dose.due_at, prefs)}
          </p>
        </div>
        <Link
          to={`/cats/${dose.cat_id}?tab=care`}
          className="text-xs text-ink-dim hover:text-lavender transition-colors shrink-0"
        >
          View cat
        </Link>
      </div>

      {variant !== 'upcoming' && (
        <div className="flex gap-2">
          <button
            onClick={() => onAdminister(dose.id)}
            disabled={isActing}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.3)',
              color: '#c084fc',
            }}
          >
            {isActing ? '…' : 'Mark Given'}
          </button>
          <button
            onClick={() => onSkip(dose.id)}
            disabled={isActing}
            className="py-2 px-4 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--color-ink-dim)',
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

function RefillCard({ med }: { med: Medication & { cat_name: string } }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--color-refill-bg)', border: '1px solid var(--color-refill-border)' }}
    >
      <p className="font-semibold text-ink text-sm">
        {med.cat_name}
        <span className="text-ink-dim font-normal"> &middot; </span>
        {med.name}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-refill-muted)' }}>
        {med.doses_remaining} dose{med.doses_remaining !== 1 ? 's' : ''} remaining — order soon
      </p>
      <Link
        to={`/medications/${med.id}/edit`}
        className="text-xs mt-2 inline-block"
        style={{ color: 'var(--color-refill-muted)' }}
      >
        Update stock →
      </Link>
    </div>
  )
}

function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'var(--color-badge-bg)', color }}
      >
        {count}
      </span>
    </div>
  )
}

export default function NotificationsPage() {
  const goBack = useGoBack('/')
  const { prefs } = usePreferences()
  const [inbox, setInbox] = useState<NotificationInbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => { loadInbox() }, [])

  async function loadInbox() {
    setLoading(true)
    try {
      setInbox(await getNotifications())
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminister(doseId: string) {
    setActing(doseId)
    try {
      await administerDose(doseId)
      await loadInbox()
    } finally {
      setActing(null)
    }
  }

  async function handleSkip(doseId: string) {
    setActing(doseId)
    try {
      await skipDose(doseId)
      await loadInbox()
    } finally {
      setActing(null)
    }
  }

  const totalUrgent = (inbox?.overdue.length ?? 0) + (inbox?.due_today.length ?? 0)

  return (
    <div className="min-h-screen px-4 pt-6 pb-4">
      <header className="mb-8">
        <button onClick={goBack} className="text-ink-dim hover:text-ink text-xl leading-none mb-4 block">←</button>
        <h1 className="font-display text-2xl font-bold text-ink">Reminders</h1>
        <p className="text-ink-dim text-sm mt-0.5">
          {loading ? 'Loading…' : totalUrgent > 0
            ? `${totalUrgent} item${totalUrgent !== 1 ? 's' : ''} need attention`
            : 'All caught up'}
        </p>
      </header>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 space-y-2">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-28 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && inbox && (
        <div className="space-y-8">
          {inbox.overdue.length > 0 && (
            <section>
              <SectionHeader label="Overdue" count={inbox.overdue.length} color="var(--color-overdue)" />
              <div className="space-y-3">
                {inbox.overdue.map(d => (
                  <DoseCard key={d.id} dose={d} variant="overdue"
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} prefs={prefs} />
                ))}
              </div>
            </section>
          )}

          {inbox.due_today.length > 0 && (
            <section>
              <SectionHeader label="Due Today" count={inbox.due_today.length} color="var(--color-due-today)" />
              <div className="space-y-3">
                {inbox.due_today.map(d => (
                  <DoseCard key={d.id} dose={d} variant="today"
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} prefs={prefs} />
                ))}
              </div>
            </section>
          )}

          {inbox.refill_alerts.length > 0 && (
            <section>
              <SectionHeader label="Refill Alert" count={inbox.refill_alerts.length} color="var(--color-refill)" />
              <div className="space-y-3">
                {inbox.refill_alerts.map(m => (
                  <RefillCard key={m.id} med={m} />
                ))}
              </div>
            </section>
          )}

          {inbox.upcoming.length > 0 && (
            <section>
              <SectionHeader label="Upcoming (7 days)" count={inbox.upcoming.length} color="#8b7fb0" />
              <div className="space-y-2">
                {inbox.upcoming.map(d => (
                  <DoseCard key={d.id} dose={d} variant="upcoming"
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} prefs={prefs} />
                ))}
              </div>
            </section>
          )}

          {inbox.overdue.length === 0 && inbox.due_today.length === 0 &&
           inbox.upcoming.length === 0 && inbox.refill_alerts.length === 0 && (
            <div className="text-center pt-16 space-y-3">
              <div className="text-5xl">✓</div>
              <p className="font-semibold text-ink">Nothing due</p>
              <p className="text-sm text-ink-dim">All medications are on track.</p>
              <Link to="/" className="inline-block mt-4 text-sm text-lavender">
                Go to cats →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
