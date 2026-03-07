import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCats, type Cat } from '../lib/api'
import { assessHealth } from '../lib/healthMetrics'
import { getMeasurements } from '../lib/api'
import QuickAdd from '../components/QuickAdd'

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
      <div className="skeleton w-16 h-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-28 rounded" />
        <div className="skeleton h-3.5 w-20 rounded" />
      </div>
    </div>
  )
}

interface CatWithHealth {
  cat: Cat
  latestWeight: number | null
  latestUnit: string
  healthStatus: string
}

export default function Home() {
  const [cats, setCats] = useState<Cat[]>([])
  const [catData, setCatData] = useState<CatWithHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCats()
  }, [])

  async function loadCats() {
    setLoading(true)
    try {
      const allCats = await getCats()
      setCats(allCats)
      // Fetch measurements for each cat in parallel
      const enriched = await Promise.all(
        allCats.map(async (cat) => {
          try {
            const ms = await getMeasurements(cat.id, 'weight')
            const sorted = [...ms].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
            const health = assessHealth(ms)
            return {
              cat,
              latestWeight: sorted[0]?.value ?? null,
              latestUnit: sorted[0]?.unit ?? 'lbs',
              healthStatus: health.overallStatus,
            }
          } catch {
            return { cat, latestWeight: null, latestUnit: 'lbs', healthStatus: 'ok' }
          }
        })
      )
      setCatData(enriched)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }


  const glowClass: Record<string, string> = {
    ok: 'glow-jade',
    watch: 'glow-honey',
    concerning: 'glow-coral',
    urgent: 'glow-rose',
  }

  const statusColor: Record<string, string> = {
    ok: '#4ade80',
    watch: '#fbbf24',
    concerning: '#f97316',
    urgent: '#f87171',
  }

  return (
    <div className="min-h-screen px-4 pt-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Your Cats</h1>
          <p className="text-ink-dim text-sm mt-0.5">
            {cats.length > 0 ? `${cats.length} cat${cats.length !== 1 ? 's' : ''} tracked` : 'Add your first cat below'}
          </p>
        </div>
        <Link
          to="/import"
          className="btn-ghost text-xs px-3 py-1.5"
        >
          Import CSV
        </Link>
      </header>

      {error && (
        <div className="glass-card border-rose/30 p-4 mb-4 text-rose text-sm">
          {error}
        </div>
      )}

      {/* Cat list */}
      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : catData.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-5 opacity-60">🐾</div>
            <p className="font-display text-ink text-lg font-semibold mb-1">No cats yet</p>
            <p className="text-ink-mid text-sm mb-6">Tap + below to add your first cat</p>
          </div>
        ) : (
          catData.map(({ cat, latestWeight, latestUnit, healthStatus }, i) => {
            const stagger = i < 5 ? `stagger-${i + 1}` : ''
            const isHealthy = healthStatus === 'ok'
            const dotColor = statusColor[healthStatus] ?? '#4ade80'
            const dotGlow = glowClass[healthStatus] ?? 'glow-jade'

            return (
              <Link
                key={cat.id}
                to={`/cats/${cat.id}`}
                className={`glass-card flex items-center gap-4 p-5 block hover:shadow-card-hover transition-shadow animate-slide-up opacity-0 ${stagger}`}
                style={{ animationFillMode: 'forwards' }}
              >
                {/* Avatar */}
                <div
                  className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(192,132,252,0.2) 0%, rgba(251,146,60,0.15) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  🐱
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-ink text-base truncate">{cat.name}</span>
                    {/* Health dot */}
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${!isHealthy ? dotGlow : ''} ${healthStatus === 'urgent' ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  <div className="text-ink-mid text-xs mt-0.5 flex items-center gap-2">
                    <span>{catAge(cat.birthdate)}</span>
                    {cat.breed && <span>· {cat.breed}</span>}
                  </div>
                </div>

                {/* Weight badge */}
                {latestWeight !== null && (
                  <div className="text-right shrink-0">
                    <div
                      className="font-display font-bold text-lg tabular-nums"
                      style={{ color: '#fb923c' }}
                    >
                      {latestWeight}
                    </div>
                    <div className="text-ink-dim text-[10px]">{latestUnit}</div>
                  </div>
                )}
              </Link>
            )
          })
        )}
      </div>

      <QuickAdd onAdded={loadCats} />
    </div>
  )
}
