import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCats, type Cat } from '../lib/api'
import { assessHealth, STATUS_COLORS, STATUS_LABEL, URGENT_VET_SIGNS } from '../lib/healthMetrics'
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
      <div className="skeleton w-14 h-14 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-28 rounded" />
        <div className="skeleton h-3.5 w-20 rounded" />
      </div>
    </div>
  )
}

const STATUS_RANK: Record<string, number> = { urgent: 3, concerning: 2, watch: 1, ok: 0 }

// Card styles per health status — each level distinctly more alarming
const CARD_STYLE: Record<string, React.CSSProperties> = {
  ok: {
    background: 'rgba(30,24,46,0.7)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  watch: {
    background: 'rgba(30,24,46,0.7)',
    border: '1.5px solid rgba(251,191,36,0.4)',
    boxShadow: '0 0 0 0 transparent',
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

interface WellnessCard {
  icon: string
  title: string
  items: string[]
}

const WELLNESS_CARDS: WellnessCard[] = [
  {
    icon: '📋',
    title: 'Monthly Self-Check',
    items: [
      'Weigh your cat and log it here',
      'Run hands over their body — feel for lumps or tender spots',
      'Check coat: shiny, soft, free of mats?',
      'Gums: pink and moist (not pale, yellow, or tacky)?',
      'Eyes: clear, no discharge or cloudiness?',
      'Ears: clean, not smelly or waxy?',
    ],
  },
  {
    icon: '📊',
    title: 'Normal Vitals',
    items: [
      'Temperature: 99–102.5°F (37–39°C)',
      'Resting heart rate: 140–220 bpm',
      'Healthy sleep: 12–16 hours per day',
      'Healthy weight: varies — ask your vet for their target range',
      'Weight loss >10% of body weight: always see a vet',
    ],
  },
  {
    icon: '🚨',
    title: 'Always Call the Vet',
    items: URGENT_VET_SIGNS.slice(0, 5),
  },
  {
    icon: '🥩',
    title: 'Nutrition Basics',
    items: [
      'Cats are obligate carnivores — high protein is essential',
      'Wet food significantly improves hydration and urinary health',
      'Free-feeding dry kibble is a leading cause of obesity',
      'Target ~20–30 cal per lb of ideal body weight per day',
      'Fresh water access at all times — many cats prefer running water',
    ],
  },
]

export default function Home() {
  const [cats, setCats] = useState<Cat[]>([])
  const [catData, setCatData] = useState<{ cat: Cat; latestWeight: number | null; latestUnit: string; healthStatus: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openWellness, setOpenWellness] = useState<number | null>(null)

  useEffect(() => { loadCats() }, [])

  async function loadCats() {
    setLoading(true)
    try {
      const allCats = await getCats()
      setCats(allCats)
      const enriched = await Promise.all(
        allCats.map(async (cat) => {
          try {
            const ms = await getMeasurements(cat.id, 'weight')
            const sorted = [...ms].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
            const health = assessHealth(ms)
            return { cat, latestWeight: sorted[0]?.value ?? null, latestUnit: sorted[0]?.unit ?? 'lbs', healthStatus: health.overallStatus }
          } catch {
            return { cat, latestWeight: null, latestUnit: 'lbs', healthStatus: 'ok' }
          }
        })
      )
      // Sort: urgent first, then concerning, watch, ok
      enriched.sort((a, b) => (STATUS_RANK[b.healthStatus] ?? 0) - (STATUS_RANK[a.healthStatus] ?? 0))
      setCatData(enriched)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
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
        <Link to="/import" className="btn-ghost text-xs px-3 py-1.5">Import CSV</Link>
      </header>

      {error && <div className="glass-card p-4 mb-4 text-rose text-sm">{error}</div>}

      {/* Cat list */}
      <div className="space-y-3">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : catData.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-5 opacity-60">🐾</div>
            <p className="font-display text-ink text-lg font-semibold mb-1">No cats yet</p>
            <p className="text-ink-mid text-sm mb-6">Tap + below to add your first cat</p>
          </div>
        ) : (
          catData.map(({ cat, latestWeight, latestUnit, healthStatus }, i) => {
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
                {/* Urgent top strip */}
                {isUrgent && (
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[20px]"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.8), transparent)' }}
                  />
                )}

                {/* Avatar */}
                <div
                  className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={avatarStyle}
                >
                  🐱
                </div>

                {/* Info */}
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
                </div>

                {/* Weight badge */}
                {latestWeight !== null && (
                  <div className="text-right shrink-0">
                    <div
                      className="font-display font-bold text-lg tabular-nums"
                      style={{ color: isOk ? '#fb923c' : statusColor }}
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

      {/* Wellness section */}
      {!loading && (
        <div className="mt-10 mb-4">
          <h2 className="font-display font-semibold text-ink-mid text-sm uppercase tracking-wider mb-4">Cat Wellness Guide</h2>
          <div className="space-y-2">
            {WELLNESS_CARDS.map((card, i) => {
              const isOpen = openWellness === i
              const isUrgentCard = card.title === 'Always Call the Vet'
              return (
                <div
                  key={card.title}
                  className="rounded-2xl overflow-hidden transition-all"
                  style={{
                    background: isUrgentCard
                      ? 'rgba(248,113,113,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: isUrgentCard
                      ? '1px solid rgba(248,113,113,0.2)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <button
                    onClick={() => setOpenWellness(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{card.icon}</span>
                      <span
                        className="font-semibold text-sm"
                        style={{ color: isUrgentCard ? '#f87171' : '#ede9f6' }}
                      >
                        {card.title}
                      </span>
                    </div>
                    <span
                      className="text-ink-dim text-xs transition-transform"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                    >
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <ul className="space-y-2">
                        {card.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-ink-mid">
                            <span className="shrink-0 mt-0.5" style={{ color: isUrgentCard ? '#f87171' : '#6b5f85' }}>
                              {isUrgentCard ? '•' : '·'}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <QuickAdd onAdded={loadCats} />
    </div>
  )
}
