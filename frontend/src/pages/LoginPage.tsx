import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const error = searchParams.get('error')

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-night flex items-center justify-center">
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Logo / wordmark */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🐱</div>
        <h1 className="font-display font-bold text-3xl text-ink mb-2">Cat Tracker</h1>
        <p className="text-ink-mid text-sm">Health monitoring for the cats you love</p>
      </div>

      {/* Card */}
      <div className="glass-card w-full max-w-sm p-8 space-y-4">
        <h2 className="font-display font-semibold text-lg text-ink text-center mb-6">Sign in to continue</h2>

        {error && (
          <div className="text-rose text-sm p-3 rounded-xl text-center" style={{ background: 'rgba(248,113,113,0.1)' }}>
            Sign-in failed. Please try again.
          </div>
        )}

        <a
          href="/api/auth/login?provider=google"
          className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl font-semibold text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#ede9f6',
          }}
        >
          <GoogleIcon />
          Continue with Google
        </a>
      </div>

      <p className="text-ink-dim text-xs text-center mt-8 max-w-xs">
        Your cat data is private and accessible only to you.
      </p>
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
