import { useEffect, useState } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import {
  getHousehold, renameHousehold, sendInvite, revokeInvite,
  changeMemberRole, removeMember,
  type HouseholdResponse, type HouseholdMember, type PendingInvite,
} from '../lib/api'

const ROLES = ['viewer', 'contributor', 'editor', 'admin'] as const
type Role = typeof ROLES[number]

const ROLE_DESC: Record<Role, string> = {
  viewer: 'Can view cats and measurements',
  contributor: 'Can log measurements and mark medications',
  editor: 'Can add, edit, and delete cats',
  admin: 'Full control, can invite members',
}

export default function HouseholdPage() {
  const goBack = useGoBack('/')
  const [data, setData] = useState<HouseholdResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rename state
  const [renaming, setRenaming] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('contributor')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const d = await getHousehold()
      setData(d)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRename() {
    if (!renameName.trim() || !data) return
    setRenameLoading(true)
    try {
      await renameHousehold(renameName.trim())
      setRenaming(false)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRenameLoading(false)
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError(null)
    setInviteSuccess(null)
    try {
      const res = await sendInvite(inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      if (res.inviteUrl) {
        setInviteSuccess(`Invite sent! Share this link if email doesn't arrive: ${res.inviteUrl}`)
      } else {
        setInviteSuccess('Invite sent!')
      }
      await load()
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg === 'already_member') setInviteError('That person is already a member.')
      else if (msg === 'invite_pending') setInviteError('A pending invite already exists for this email. Revoke it first to resend.')
      else setInviteError(msg)
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await revokeInvite(inviteId)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await changeMemberRole(userId, newRole)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function handleRemove(userId: string) {
    const member = data?.members.find(m => m.user_id === userId)
    const name = member?.display_name ?? member?.email ?? 'this member'
    if (!confirm(`Remove ${name} from this household? They'll lose access immediately.`)) return
    try {
      await removeMember(userId)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  if (loading) return (
    <div className="min-h-screen px-4 pt-6">
      <div className="skeleton h-6 w-40 rounded mb-8" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen px-4 pt-6">
      <p className="text-rose text-sm">{error ?? 'Failed to load household.'}</p>
    </div>
  )

  const { household, members, pendingInvites, myRole, isOwner } = data
  const isAdmin = myRole === 'admin'

  return (
    <div className="min-h-screen px-4 pt-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8">
        <button onClick={goBack} className="text-ink-dim text-sm mr-1">← Back</button>
        <h1 className="font-display text-xl font-bold text-ink">Household</h1>
      </header>

      {error && (
        <div className="glass-card p-3 mb-4 text-rose text-sm">{error}</div>
      )}

      {/* Household name */}
      <div className="glass-card p-5 mb-4">
        {renaming ? (
          <div className="space-y-3">
            <input
              className="w-full bg-transparent border-b border-lavender/40 text-ink font-semibold text-lg pb-1 outline-none"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              autoFocus
              maxLength={100}
              onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleRename}
                disabled={renameLoading}
                className="btn-primary py-2 px-4 text-xs"
              >
                {renameLoading ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setRenaming(false)} className="text-xs text-ink-dim py-2 px-3">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-dim uppercase tracking-wider mb-1">Household</p>
              <h2 className="font-display font-bold text-lg text-ink">{household.name}</h2>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setRenameName(household.name); setRenaming(true) }}
                className="text-xs text-ink-dim px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Rename
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="glass-card p-5 mb-4">
        <h3 className="text-xs font-semibold text-ink-dim uppercase tracking-wider mb-3">
          Members ({members.length})
        </h3>
        <div className="space-y-3">
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              isOwner={household.owner_user_id === m.user_id}
              canManage={isAdmin && household.owner_user_id !== m.user_id}
              myRole={myRole}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      {/* Pending invites — admins only */}
      {isAdmin && pendingInvites.length > 0 && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-xs font-semibold text-ink-dim uppercase tracking-wider mb-3">
            Pending Invites ({pendingInvites.length})
          </h3>
          <div className="space-y-3">
            {pendingInvites.map(inv => (
              <PendingInviteRow key={inv.id} invite={inv} onRevoke={handleRevoke} />
            ))}
          </div>
        </div>
      )}

      {/* Invite form — admins only */}
      {isAdmin && (
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-ink-dim uppercase tracking-wider mb-4">
            Invite Someone
          </h3>
          <form onSubmit={handleSendInvite} className="space-y-3">
            <div>
              <label className="text-xs text-ink-dim block mb-1">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-transparent border rounded-xl px-3 py-2.5 text-sm text-ink placeholder-ink-dim outline-none focus:border-lavender/60"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                maxLength={200}
                required
              />
            </div>
            <div>
              <label className="text-xs text-ink-dim block mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="w-full bg-night border rounded-xl px-3 py-2.5 text-sm text-ink outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {ROLES.filter(r => r !== 'admin' || isOwner).map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)} — {ROLE_DESC[r]}</option>
                ))}
              </select>
            </div>
            {inviteError && <p className="text-rose text-xs">{inviteError}</p>}
            {inviteSuccess && (
              <div className="p-3 rounded-xl text-xs break-all" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'var(--color-health-jade)' }}>
                {inviteSuccess}
              </div>
            )}
            <button
              type="submit"
              disabled={inviteLoading || !inviteEmail.trim()}
              className="btn-primary w-full py-3 text-sm"
            >
              {inviteLoading ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function MemberRow({
  member,
  isOwner,
  canManage,
  myRole,
  onRoleChange,
  onRemove,
}: {
  member: HouseholdMember
  isOwner: boolean
  canManage: boolean
  myRole: string
  onRoleChange: (userId: string, role: string) => void
  onRemove: (userId: string) => void
}) {
  const initial = (member.display_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="flex items-center gap-3">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'rgba(192,132,252,0.2)', color: 'var(--color-brand)' }}
        >
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate">
          {member.display_name ?? member.email ?? 'Unknown'}
          {isOwner && <span className="text-xs text-ink-dim ml-1.5">Owner</span>}
        </div>
        {member.email && member.display_name && (
          <div className="text-xs text-ink-dim truncate">{member.email}</div>
        )}
      </div>
      {canManage ? (
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={member.role}
            onChange={e => onRoleChange(member.user_id, e.target.value)}
            className="text-xs bg-night rounded-lg px-2 py-1 text-ink-dim outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {ROLES.filter(r => r !== 'admin' || myRole === 'admin').map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={() => onRemove(member.user_id)}
            className="text-xs text-rose/70 hover:text-rose px-1"
            title="Remove member"
          >
            ×
          </button>
        </div>
      ) : (
        <span
          className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'rgba(192,132,252,0.12)', color: 'var(--color-brand)' }}
        >
          {member.role}
        </span>
      )}
    </div>
  )
}

function PendingInviteRow({ invite, onRevoke }: {
  invite: PendingInvite
  onRevoke: (id: string) => void
}) {
  const daysLeft = invite.invite_expires_at
    ? Math.max(0, Math.ceil((new Date(invite.invite_expires_at.replace(' ', 'T') + 'Z').getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
        style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--color-health-honey)' }}
      >
        ✉
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{invite.invite_email}</div>
        <div className="text-xs text-ink-dim mt-0.5">
          {invite.role} · {daysLeft !== null ? `expires in ${daysLeft}d` : 'no expiry'}
        </div>
      </div>
      <button
        onClick={() => onRevoke(invite.id)}
        className="text-xs text-ink-dim hover:text-rose shrink-0 px-2 py-1 rounded-lg"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        Revoke
      </button>
    </div>
  )
}
