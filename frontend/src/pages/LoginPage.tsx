import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const error = searchParams.get('error')

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#120c1e' }}>
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#120c1e' }}>

      {/* Hero */}
      <div className="flex flex-col items-center pt-16 pb-10 px-6">

        {/* Cat graphic with floating metrics */}
        <div className="relative mb-8" style={{ width: 140, height: 140 }}>
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(192,132,252,0.22) 0%, rgba(251,146,60,0.08) 50%, transparent 72%)',
              transform: 'scale(1.4)',
            }}
          />

          {/* Cat emoji */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ fontSize: 72 }}
          >
            🐱
          </div>

          {/* Floating metric — weight */}
          <div
            className="absolute text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{
              top: 8,
              right: -12,
              background: 'rgba(192,132,252,0.15)',
              border: '1px solid rgba(192,132,252,0.35)',
              color: 'var(--color-brand)',
              backdropFilter: 'blur(8px)',
            }}
          >
            9.4 lbs
          </div>

          {/* Floating metric — trend */}
          <div
            className="absolute text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{
              bottom: 10,
              left: -14,
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              color: 'var(--color-health-jade)',
              backdropFilter: 'blur(8px)',
            }}
          >
            ↗ stable
          </div>
        </div>

        {/* Sparkline */}
        <div className="mb-10 opacity-50">
          <svg viewBox="0 0 220 36" width="220" height="36" fill="none">
            <defs>
              <linearGradient id="spark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path
              d="M0 28 C20 26 36 22 55 24 S88 16 108 13 S145 16 165 11 S195 6 220 4"
              stroke="url(#spark)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="55" cy="24" r="3" fill="var(--color-brand)" opacity="0.5" />
            <circle cx="108" cy="13" r="3" fill="var(--color-brand)" opacity="0.7" />
            <circle cx="165" cy="11" r="3.5" fill="var(--color-brand)" opacity="0.9" />
            <circle cx="220" cy="4" r="4" fill="var(--color-accent)" />
          </svg>
        </div>

        {/* App name + tagline */}
        <h1 className="font-display font-bold text-3xl text-ink text-center mb-3">
          Whisker Health
        </h1>
        <p className="text-center text-base leading-relaxed max-w-xs" style={{ color: 'rgba(237,233,246,0.65)' }}>
          Know your cat's health trends before they become vet emergencies.
        </p>
      </div>

      {/* Features */}
      <div className="px-6 mb-8 space-y-3">
        <FeatureRow
          icon="⚖️"
          title="Weight & behavior tracking"
          desc="Log a reading in seconds. See months of trends at a glance."
        />
        <FeatureRow
          icon="📊"
          title="Early warning patterns"
          desc="Spot when food, grooming, or activity shift before weight follows."
        />
        <FeatureRow
          icon="🏥"
          title="Vet-ready summaries"
          desc="One tap to export a printable health report for your appointment."
        />
      </div>

      {/* Sign in */}
      <div className="px-6 pb-12 mt-auto">
        {error && (
          <div
            className="text-rose text-sm p-3 rounded-xl text-center mb-4"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            Sign-in failed — please try again.
          </div>
        )}

        <a
          href="/api/auth/login?provider=google"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold text-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(192,132,252,0.18) 0%, rgba(251,146,60,0.12) 100%)',
            border: '1px solid rgba(192,132,252,0.35)',
            color: 'var(--color-ink)',
          }}
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <p className="text-center text-xs mt-4" style={{ color: 'rgba(237,233,246,0.35)' }}>
          Your data is private and only accessible to you.
        </p>
      </div>

    </div>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="flex items-start gap-4 px-4 py-3.5 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(237,233,246,0.5)' }}>{desc}</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
