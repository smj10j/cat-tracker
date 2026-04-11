import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getInvitePreview, acceptInvite, declineInvite, type InvitePreview } from '../lib/api'

const ROLE_DESC: Record<string, string> = {
  viewer: 'view cats and measurements',
  contributor: 'log measurements and mark medications',
  editor: 'add, edit, and delete cats and measurements',
  admin: 'fully manage the household including inviting members',
}

export default function InvitePage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setPreviewError('No invite token in this link.'); setPreviewLoading(false); return }
    getInvitePreview(token)
      .then(p => setPreview(p))
      .catch((e: { message: string }) => {
        if (e.message === 'invite_not_found') setPreviewError('This invite link is no longer valid.')
        else if (e.message === 'invite_expired') setPreviewError('This invite link has expired. Ask the household admin to send a new one.')
        else setPreviewError('Could not load invite.')
      })
      .finally(() => setPreviewLoading(false))
  }, [token])

  async function handleAccept() {
    setActionLoading(true)
    setActionError(null)
    try {
      await acceptInvite(token)
      setDone(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg === 'email_mismatch') {
        setActionError(`This invite was sent to ${preview?.invite_email ?? 'a different email address'}. Sign in with that Google account, or ask the household admin to send a new invite to your current email.`)
      } else if (msg === 'already_member') {
        setActionError('You\'re already a member of this household.')
      } else {
        setActionError(msg)
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDecline() {
    setActionLoading(true)
    try {
      await declineInvite(token)
      navigate('/')
    } catch {
      navigate('/')
    }
  }

  if (previewLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#120c1e' }}>
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>
    )
  }

  if (previewError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#120c1e' }}>
        <div className="text-4xl mb-4">🐱</div>
        <p className="text-ink font-semibold mb-2">Invite not found</p>
        <p className="text-ink-dim text-sm mb-6">{previewError}</p>
        <button onClick={() => navigate('/')} className="btn-primary py-3 px-6 text-sm">
          Go to Whisker Health
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#120c1e' }}>
        <div className="text-4xl mb-4">🐾</div>
        <p className="text-ink font-semibold mb-2">Welcome to {preview?.household_name}!</p>
        <p className="text-ink-dim text-sm">Redirecting to your cats…</p>
      </div>
    )
  }

  const roleDesc = ROLE_DESC[preview?.role ?? ''] ?? 'access the household'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#120c1e' }}>
      <div
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{
          background: 'rgba(30,24,46,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3">🐱</div>
          <p className="text-ink-dim text-sm mb-1">You've been invited to</p>
          <h1 className="font-display font-bold text-xl text-ink">
            {preview?.household_name}
          </h1>
        </div>

        <div
          className="rounded-2xl p-4 space-y-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {preview?.invited_by_name && (
            <p className="text-xs text-ink-dim">
              Invited by <span className="text-ink">{preview.invited_by_name}</span>
            </p>
          )}
          <p className="text-xs text-ink-dim">
            Role: <span className="text-ink capitalize">{preview?.role}</span>
          </p>
          <p className="text-xs text-ink-dim mt-1">
            You'll be able to {roleDesc}.
          </p>
        </div>

        {!user ? (
          <>
            <p className="text-xs text-ink-dim text-center">
              Sign in with Google to accept this invitation.
            </p>
            <a
              href={`/api/auth/login?provider=google&next=${encodeURIComponent(`/invite?token=${token}`)}`}
              className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(192,132,252,0.18) 0%, rgba(251,146,60,0.12) 100%)',
                border: '1px solid rgba(192,132,252,0.35)',
                color: 'var(--color-ink)',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </a>
          </>
        ) : (
          <>
            {actionError && (
              <div
                className="p-3 rounded-xl text-xs"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
              >
                {actionError}
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="btn-primary w-full py-3.5 text-sm"
              >
                {actionLoading ? 'Accepting…' : 'Accept invitation'}
              </button>
              <button
                onClick={handleDecline}
                disabled={actionLoading}
                className="w-full py-3 text-xs text-ink-dim"
              >
                Decline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
