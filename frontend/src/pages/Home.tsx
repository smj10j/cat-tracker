import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCats, getMeasurements, claimCats, type Cat, type Measurement } from '../lib/api'
import { assessHealth, STATUS_COLORS, STATUS_LABEL } from '../lib/healthMetrics'
import { detectCorrelations, getHomeBadge } from '../lib/correlations'
import { useAuth } from '../contexts/AuthContext'

function catAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="skeleton w-14 h-14 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-28 rounded" />
        <div className="skeleton h-3.5 w-20 rounded" />
      </div>
    </div>
  )
}

const STATUS_RANK: Record<string, number> = { urgent: 3, concerning: 2, watch: 1, ok: 0 }

const CARD_STYLE: Record<string, React.CSSProperties> = {
  ok: {
    background: 'rgba(30,24,46,0.7)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  watch: {
    background: 'rgba(30,24,46,0.7)',
    border: '1.5px solid rgba(251,191,36,0.4)',
  },
  concerning: {
    background: 'rgba(249,115,22,0.07)',
    border: '1.5px solid rgba(249,115,22,0.5)',
    boxShadow: '0 0 16px rgba(249,115,22,0.12)',
  },
  urgent: {
    background: 'rgba(248,113,113,0.09)',
    border: '2px solid rgba(248,113,113,0.6)',
    boxShadow: '0 0 24px rgba(248,113,113,0.18)',
  },
}

const AVATAR_STYLE: Record<string, React.CSSProperties> = {
  ok: {
    background: 'linear-gradient(135deg, rgba(192,132,252,0.2) 0%, rgba(251,146,60,0.15) 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  watch: {
    background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.08) 100%)',
    border: '2px solid rgba(251,191,36,0.5)',
  },
  concerning: {
    background: 'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.1) 100%)',
    border: '2px solid rgba(249,115,22,0.6)',
    boxShadow: '0 0 12px rgba(249,115,22,0.2)',
  },
  urgent: {
    background: 'linear-gradient(135deg, rgba(248,113,113,0.2) 0%, rgba(248,113,113,0.12) 100%)',
    border: '2px solid rgba(248,113,113,0.7)',
    boxShadow: '0 0 16px rgba(248,113,113,0.3)',
  },
}

export default function Home() {
  const { user, logout, refresh: refreshUser } = useAuth()
  const [catData, setCatData] = useState<{ cat: Cat; latestWeight: number | null; latestUnit: string; healthStatus: string; correlationBadge: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    loadCats()

    // Re-fetch when a measurement is added via the QuickAdd sheet
    const handler = () => loadCats()
    window.addEventListener('measurementAdded', handler)
    return () => window.removeEventListener('measurementAdded', handler)
  }, [])

  async function loadCats() {
    setLoading(true)
    try {
      const allCats = await getCats()
      const enriched = await Promise.all(
        allCats.map(async (cat) => {
          try {
            const ms = await getMeasurements(cat.id)
            const weightMs = ms.filter((m: Measurement) => m.type === 'weight')
            const sorted = [...weightMs].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
            const health = assessHealth(weightMs)
            const byType: Record<string, Measurement[]> = {}
            for (const m of ms) {
              if (!byType[m.type]) byType[m.type] = []
              byType[m.type]!.push(m)
            }
            const correlations = detectCorrelations(byType)
            const correlationBadge = getHomeBadge(correlations)
            return { cat, latestWeight: sorted[0]?.value ?? null, latestUnit: sorted[0]?.unit ?? 'lbs', healthStatus: health.overallStatus, correlationBadge }
          } catch {
            return { cat, latestWeight: null, latestUnit: 'lbs', healthStatus: 'ok', correlationBadge: null }
          }
        })
      )
      enriched.sort((a, b) => (STATUS_RANK[b.healthStatus] ?? 0) - (STATUS_RANK[a.healthStatus] ?? 0))
      setCatData(enriched)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleClaimCats() {
    setClaiming(true)
    try {
      await claimCats()
      await Promise.all([loadCats(), refreshUser()])
    } finally {
      setClaiming(false)
    }
  }

  const catCount = catData.length

  const initial = (user?.display_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="min-h-screen px-4 pt-6">
      {/* Profile popover */}
      {showProfile && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)}>
          <div
            className="absolute rounded-2xl p-4 space-y-3 min-w-[180px]"
            style={{
              top: '72px',
              left: '16px',
              background: '#2a2040',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-semibold text-ink truncate">{user?.display_name ?? 'You'}</p>
              <p className="text-xs text-ink-dim truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { setShowProfile(false); logout() }}
              className="w-full text-left text-sm text-rose py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setShowProfile(prev => !prev)}
          aria-label="Account"
          className="shrink-0"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="Your avatar"
              className="w-9 h-9 rounded-full object-cover"
              style={{ border: '1.5px solid rgba(192,132,252,0.3)' }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(192,132,252,0.2)', color: '#c084fc', border: '1.5px solid rgba(192,132,252,0.3)' }}
            >
              {initial}
            </div>
          )}
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Your Cats</h1>
          <p className="text-ink-dim text-sm mt-0.5">
            {catCount > 0 ? `${catCount} cat${catCount !== 1 ? 's' : ''} tracked` : 'Add your first cat below'}
          </p>
        </div>
      </header>

      {error && <div className="glass-card p-4 mb-4 text-rose text-sm">{error}</div>}

      {/* Claim existing cats prompt */}
      {user?.hasOrphanedCats && (
        <div className="glass-card p-4 mb-6 space-y-3" style={{ border: '1px solid rgba(192,132,252,0.25)' }}>
          <div>
            <p className="text-sm font-semibold text-ink">Existing cats found</p>
            <p className="text-xs text-ink-mid mt-0.5">There are cats in this app not yet linked to your account. Claim them as yours?</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClaimCats}
              disabled={claiming}
              className="btn-primary py-2 px-4 text-xs"
            >
              {claiming ? 'Claiming…' : 'Yes, claim them'}
            </button>
            <button
              onClick={() => refreshUser()}
              className="text-xs text-ink-dim px-3 py-2"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Cat list */}
      <div className="space-y-3">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            {catData.map(({ cat, latestWeight, latestUnit, healthStatus, correlationBadge }, i) => {
              const stagger = i < 5 ? `stagger-${i + 1}` : ''
              const isOk = healthStatus === 'ok'
              const statusColor = STATUS_COLORS[healthStatus as keyof typeof STATUS_COLORS] ?? '#4ade80'
              const cardStyle = CARD_STYLE[healthStatus] ?? CARD_STYLE.ok
              const avatarStyle = AVATAR_STYLE[healthStatus] ?? AVATAR_STYLE.ok
              const isUrgent = healthStatus === 'urgent'
              const isConcerning = healthStatus === 'concerning'

              return (
                <Link
                  key={cat.id}
                  to={`/cats/${cat.id}`}
                  className={`flex items-center gap-4 p-5 rounded-[20px] block transition-all animate-slide-up opacity-0 ${stagger}`}
                  style={{ ...cardStyle, animationFillMode: 'forwards' }}
                >
                  <div
                    className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                    style={avatarStyle}
                  >
                    🐱
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-ink text-base truncate">{cat.name}</span>
                      {!isOk && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isUrgent ? 'animate-pulse' : ''}`}
                          style={{
                            color: statusColor,
                            background: `${statusColor}20`,
                            border: `1px solid ${statusColor}50`,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {isUrgent ? '⚠ ' : isConcerning ? '! ' : ''}{STATUS_LABEL[healthStatus as keyof typeof STATUS_LABEL]}
                        </span>
                      )}
                    </div>
                    <div className="text-ink-mid text-xs mt-0.5 flex items-center gap-2">
                      <span>{catAge(cat.birthdate)}</span>
                      {cat.breed && <span>· {cat.breed}</span>}
                    </div>
                    {!isOk && (
                      <div className="text-xs mt-1.5" style={{ color: `${statusColor}bb` }}>
                        {isUrgent ? 'Vet visit recommended' : isConcerning ? 'Monitor closely' : 'Keep an eye on weight trend'}
                      </div>
                    )}
                    {correlationBadge && (
                      <div className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'rgba(192,132,252,0.8)' }}>
                        <span>&#9889;</span>
                        <span>{correlationBadge}</span>
                      </div>
                    )}
                  </div>

                  {latestWeight !== null && (
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-lg tabular-nums" style={{ color: isOk ? '#fb923c' : statusColor }}>
                        {latestWeight}
                      </div>
                      <div className="text-ink-dim text-[10px]">{latestUnit}</div>
                    </div>
                  )}
                </Link>
              )
            })}

            {/* Add a cat — dashed card at bottom of list */}
            <Link
              to="/cats/new"
              className="flex items-center justify-center gap-2 py-4 rounded-[20px] transition-all"
              style={{
                border: '1.5px dashed rgba(192,132,252,0.25)',
                color: '#6b5f85',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,132,252,0.5)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b5f85'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,132,252,0.25)' }}
            >
              <span className="text-lg font-light">＋</span>
              <span className="text-sm font-semibold">Add a cat</span>
            </Link>
          </>
        )}
      </div>

      {/* Wellness guide link */}
      {!loading && (
        <div className="mt-8 mb-4">
          <Link
            to="/wellness"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,132,252,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🐾</span>
              <div>
                <div className="text-sm font-semibold text-ink">Cat Wellness Guide</div>
                <div className="text-xs text-ink-dim mt-0.5">Monthly checks, vitals, vet signs</div>
              </div>
            </div>
            <span className="text-ink-dim text-sm">→</span>
          </Link>
        </div>
      )}
    </div>
  )
}
