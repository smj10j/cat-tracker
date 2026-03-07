import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getNotifications, administerDose, skipDose, CARE_TYPE_ICONS, type NotificationInbox, type DoseWithContext, type Medication } from '../lib/api'

function formatDueAt(dueAt: string): string {
  // dueAt is 'YYYY-MM-DD HH:MM:00'
  const [datePart, timePart] = dueAt.split(' ')
  if (!datePart || !timePart) return dueAt
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const [h, m] = timePart.split(':')
  const hour = parseInt(h ?? '0', 10)
  const minute = m ?? '00'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  const timeStr = `${h12}:${minute} ${ampm}`

  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === yesterday) return `Yesterday at ${timeStr}`
  const d = new Date(datePart + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

function formatFutureDueAt(dueAt: string): string {
  const [datePart, timePart] = dueAt.split(' ')
  if (!datePart || !timePart) return dueAt
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const [h, m] = timePart.split(':')
  const hour = parseInt(h ?? '0', 10)
  const minute = m ?? '00'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  const timeStr = `${h12}:${minute} ${ampm}`

  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === tomorrow) return `Tomorrow at ${timeStr}`
  const d = new Date(datePart + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

interface DoseCardProps {
  dose: DoseWithContext
  variant: 'overdue' | 'today' | 'upcoming'
  onAdminister: (id: string) => void
  onSkip: (id: string) => void
  acting: string | null
}

function DoseCard({ dose, variant, onAdminister, onSkip, acting }: DoseCardProps) {
  const isActing = acting === dose.id

  const borderColor = variant === 'overdue'
    ? 'rgba(248,113,113,0.35)'
    : variant === 'today'
    ? 'rgba(251,191,36,0.3)'
    : 'rgba(255,255,255,0.08)'

  const bg = variant === 'overdue'
    ? 'rgba(248,113,113,0.06)'
    : variant === 'today'
    ? 'rgba(251,191,36,0.04)'
    : 'rgba(255,255,255,0.02)'

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: bg, border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm truncate">
            <span className="mr-1">{CARE_TYPE_ICONS[dose.med_type] ?? '📅'}</span>
            {dose.cat_name}
            <span className="text-ink-dim font-normal"> &middot; </span>
            {dose.med_name}
          </p>
          {dose.dose && (
            <p className="text-xs text-ink-dim mt-0.5">{dose.dose}</p>
          )}
          <p className="text-xs mt-1" style={{
            color: variant === 'overdue' ? '#f87171cc' : variant === 'today' ? '#fbbf24cc' : '#8b7fb0',
          }}>
            {variant === 'overdue' ? 'Was due: ' : 'Due: '}
            {variant === 'upcoming' ? formatFutureDueAt(dose.due_at) : formatDueAt(dose.due_at)}
          </p>
        </div>
        <Link
          to={`/cats/${dose.cat_id}`}
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
              color: '#6b5f85',
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
      style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.25)' }}
    >
      <p className="font-semibold text-ink text-sm">
        {med.cat_name}
        <span className="text-ink-dim font-normal"> &middot; </span>
        {med.name}
      </p>
      <p className="text-xs mt-1" style={{ color: '#fb923ccc' }}>
        {med.doses_remaining} dose{med.doses_remaining !== 1 ? 's' : ''} remaining — order soon
      </p>
      <Link
        to={`/medications/${med.id}/edit`}
        className="text-xs mt-2 inline-block"
        style={{ color: '#fb923ccc' }}
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
        style={{ background: 'rgba(255,255,255,0.06)', color }}
      >
        {count}
      </span>
    </div>
  )
}

export default function NotificationsPage() {
  const navigate = useNavigate()
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
        <button onClick={() => navigate(-1)} className="text-ink-dim hover:text-ink text-xl leading-none mb-4 block">←</button>
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
              <SectionHeader label="Overdue" count={inbox.overdue.length} color="#f87171" />
              <div className="space-y-3">
                {inbox.overdue.map(d => (
                  <DoseCard key={d.id} dose={d} variant="overdue"
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} />
                ))}
              </div>
            </section>
          )}

          {inbox.due_today.length > 0 && (
            <section>
              <SectionHeader label="Due Today" count={inbox.due_today.length} color="#fbbf24" />
              <div className="space-y-3">
                {inbox.due_today.map(d => (
                  <DoseCard key={d.id} dose={d} variant="today"
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} />
                ))}
              </div>
            </section>
          )}

          {inbox.refill_alerts.length > 0 && (
            <section>
              <SectionHeader label="Refill Alert" count={inbox.refill_alerts.length} color="#fb923c" />
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
                    onAdminister={handleAdminister} onSkip={handleSkip} acting={acting} />
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
