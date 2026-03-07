import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ensureHousehold, hasRole, ROLE_LEVEL } from '../lib/household'
import { sendEmail } from '../lib/email'

// ── Public routes (no auth required) ─────────────────────────────────────────
export const householdPublic = new Hono<AppEnv>()

householdPublic.get('/household/invites/preview', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'token required' }, 400)

  const hash = await hashToken(token)
  const row = await c.env.DB.prepare(`
    SELECT hm.role, hm.invite_expires_at, hm.invite_email,
           h.name as household_name,
           ib.display_name as invited_by_name
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    LEFT JOIN users ib ON ib.id = hm.invited_by
    WHERE hm.invite_token_hash = ? AND hm.status = 'pending'
  `).bind(hash).first<{
    role: string; invite_expires_at: string | null; invite_email: string
    household_name: string; invited_by_name: string | null
  }>()

  if (!row) return c.json({ error: 'invite_not_found' }, 404)
  if (row.invite_expires_at && row.invite_expires_at < sqliteNow()) {
    return c.json({ error: 'invite_expired' }, 410)
  }

  return c.json({
    household_name: row.household_name,
    invited_by_name: row.invited_by_name,
    invite_email: row.invite_email,
    role: row.role,
  })
})

// ── Protected routes ──────────────────────────────────────────────────────────
const household = new Hono<AppEnv>()
export default household

// GET /api/household
household.get('/', async (c) => {
  const userId = c.get('userId')
  const { id: householdId } = await ensureHousehold(c.env.DB, userId)

  const [hRow, membersRes, invitesRes, myMemberRes] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, name, owner_user_id, created_at FROM households WHERE id = ?',
    ).bind(householdId).first<{
      id: string; name: string; owner_user_id: string; created_at: string
    }>(),

    c.env.DB.prepare(`
      SELECT hm.id, hm.user_id, hm.role, hm.invited_at, hm.joined_at,
             u.display_name, u.email, u.avatar_url
      FROM household_members hm
      LEFT JOIN users u ON u.id = hm.user_id
      WHERE hm.household_id = ? AND hm.status = 'active'
      ORDER BY hm.joined_at ASC
    `).bind(householdId).all<{
      id: string; user_id: string; role: string; invited_at: string; joined_at: string | null
      display_name: string | null; email: string | null; avatar_url: string | null
    }>(),

    c.env.DB.prepare(`
      SELECT hm.id, hm.invite_email, hm.role, hm.invited_at, hm.invite_expires_at,
             ib.display_name as invited_by_name
      FROM household_members hm
      LEFT JOIN users ib ON ib.id = hm.invited_by
      WHERE hm.household_id = ? AND hm.status = 'pending'
        AND (hm.invite_expires_at IS NULL OR hm.invite_expires_at > datetime('now'))
      ORDER BY hm.invited_at DESC
    `).bind(householdId).all<{
      id: string; invite_email: string; role: string
      invited_at: string; invite_expires_at: string | null; invited_by_name: string | null
    }>(),

    c.env.DB.prepare(
      `SELECT role FROM household_members WHERE household_id = ? AND user_id = ? AND status = 'active'`,
    ).bind(householdId, userId).first<{ role: string }>(),
  ])

  return c.json({
    household: hRow,
    members: membersRes.results,
    pendingInvites: invitesRes.results,
    myRole: myMemberRes?.role ?? 'viewer',
    isOwner: hRow?.owner_user_id === userId,
  })
})

// GET /api/household/list — all households the user belongs to (for home screen labels)
household.get('/list', async (c) => {
  const userId = c.get('userId')
  await ensureHousehold(c.env.DB, userId)

  const rows = await c.env.DB.prepare(`
    SELECT h.id, h.name, hm.role,
           CASE WHEN h.owner_user_id = ? THEN 1 ELSE 0 END as is_owner
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ? AND hm.status = 'active'
    ORDER BY hm.joined_at ASC
  `).bind(userId, userId).all<{
    id: string; name: string; role: string; is_owner: number
  }>()

  return c.json(rows.results)
})

// PUT /api/household — rename (admin only)
household.put('/', async (c) => {
  const userId = c.get('userId')
  const { id: householdId, role } = await ensureHousehold(c.env.DB, userId)

  if (!hasRole(role, 'admin')) return c.json({ error: 'Admin access required' }, 403)

  const body = await c.req.json<{ name: string }>()
  const name = body.name?.trim()
  if (!name || name.length > 100) return c.json({ error: 'name must be 1–100 characters' }, 400)

  const updated = await c.env.DB.prepare(
    `UPDATE households SET name = ? WHERE id = ? RETURNING id, name, owner_user_id, created_at`,
  ).bind(name, householdId).first()
  return c.json(updated)
})

// ── Member management ─────────────────────────────────────────────────────────

// PUT /api/household/members/:userId/role
household.put('/members/:targetUserId/role', async (c) => {
  const userId = c.get('userId')
  const targetUserId = c.req.param('targetUserId')
  const { id: householdId, role, ownerId } = await ensureHousehold(c.env.DB, userId)

  if (!hasRole(role, 'admin')) return c.json({ error: 'Admin access required' }, 403)
  if (targetUserId === ownerId) return c.json({ error: 'Cannot change owner role' }, 400)
  if (targetUserId === userId) return c.json({ error: 'Cannot change your own role' }, 400)

  const body = await c.req.json<{ role: string }>()
  const newRole = body.role
  if (!ROLE_LEVEL[newRole]) return c.json({ error: 'Invalid role' }, 400)
  // Cannot escalate above own role
  if ((ROLE_LEVEL[newRole] ?? 0) > (ROLE_LEVEL[role] ?? 0)) {
    return c.json({ error: 'Cannot grant a role higher than your own' }, 403)
  }

  const target = await c.env.DB.prepare(
    `SELECT id FROM household_members WHERE household_id = ? AND user_id = ? AND status = 'active'`,
  ).bind(householdId, targetUserId).first()
  if (!target) return c.json({ error: 'Member not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE household_members SET role = ? WHERE household_id = ? AND user_id = ? AND status = 'active'`,
  ).bind(newRole, householdId, targetUserId).run()

  return c.json({ success: true })
})

// DELETE /api/household/members/:userId
household.delete('/members/:targetUserId', async (c) => {
  const userId = c.get('userId')
  const targetUserId = c.req.param('targetUserId')
  const { id: householdId, role, ownerId } = await ensureHousehold(c.env.DB, userId)

  if (!hasRole(role, 'admin')) return c.json({ error: 'Admin access required' }, 403)
  if (targetUserId === ownerId) return c.json({ error: 'Cannot remove the household owner' }, 400)

  await c.env.DB.prepare(
    `UPDATE household_members SET status = 'removed' WHERE household_id = ? AND user_id = ? AND status = 'active'`,
  ).bind(householdId, targetUserId).run()

  return c.json({ success: true })
})

// ── Invites ───────────────────────────────────────────────────────────────────

// POST /api/household/invites
household.post('/invites', async (c) => {
  const userId = c.get('userId')
  const { id: householdId, role, name: householdName } = await ensureHousehold(c.env.DB, userId)

  if (!hasRole(role, 'admin')) return c.json({ error: 'Admin access required' }, 403)

  const body = await c.req.json<{ email: string; role: string }>()
  const inviteEmail = body.email?.trim().toLowerCase()
  const inviteRole = body.role

  if (!inviteEmail || !inviteRole) return c.json({ error: 'email and role are required' }, 400)
  if (!ROLE_LEVEL[inviteRole]) return c.json({ error: 'Invalid role' }, 400)
  if ((ROLE_LEVEL[inviteRole] ?? 0) > (ROLE_LEVEL[role] ?? 0)) {
    return c.json({ error: 'Cannot invite someone to a role higher than your own' }, 403)
  }

  // Check max pending invites (rate limit)
  const pendingCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM household_members WHERE household_id = ? AND status = 'pending'`,
  ).bind(householdId).first<{ n: number }>()
  if ((pendingCount?.n ?? 0) >= 10) {
    return c.json({ error: 'Max 10 pending invites at a time' }, 429)
  }

  // Check if already an active member
  const activeUser = await c.env.DB.prepare(
    `SELECT hm.id FROM household_members hm
     JOIN users u ON u.id = hm.user_id
     WHERE hm.household_id = ? AND LOWER(u.email) = ? AND hm.status = 'active'`,
  ).bind(householdId, inviteEmail).first()
  if (activeUser) return c.json({ error: 'already_member' }, 409)

  // Check if a pending invite already exists for this email
  const existingInvite = await c.env.DB.prepare(
    `SELECT id FROM household_members
     WHERE household_id = ? AND LOWER(invite_email) = ? AND status = 'pending'
       AND (invite_expires_at IS NULL OR invite_expires_at > datetime('now'))`,
  ).bind(householdId, inviteEmail).first()
  if (existingInvite) return c.json({ error: 'invite_pending' }, 409)

  // Generate invite token
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = sqliteNow(7 * 24 * 60 * 60)

  // Get inviter name
  const inviter = await c.env.DB.prepare('SELECT display_name FROM users WHERE id = ?')
    .bind(userId).first<{ display_name: string | null }>()
  const inviterName = inviter?.display_name ?? 'Someone'

  await c.env.DB.prepare(`
    INSERT INTO household_members
      (household_id, role, status, invited_by, invite_email, invite_token_hash, invite_expires_at)
    VALUES (?, ?, 'pending', ?, ?, ?, ?)
  `).bind(householdId, inviteRole, userId, inviteEmail, tokenHash, expiresAt).run()

  // Send invite email (non-fatal)
  const inviteUrl = `https://cat-tracker.pages.dev/invite?token=${rawToken}`
  const roleDesc = roleDescription(inviteRole)

  c.executionCtx.waitUntil(
    sendEmail({
      to: inviteEmail,
      subject: `${inviterName} invited you to ${householdName} on Cat Tracker`,
      text: [
        `Hi there,`,
        ``,
        `${inviterName} has invited you to join "${householdName}" on Cat Tracker as a ${inviteRole}.`,
        ``,
        `As a ${inviteRole}, you'll be able to ${roleDesc}.`,
        ``,
        `Click the link below to accept:`,
        `  ${inviteUrl}`,
        ``,
        `This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.`,
        ``,
        `— Cat Tracker`,
      ].join('\n'),
    }).catch(() => { /* non-fatal */ }),
  )

  return c.json({ success: true, inviteUrl }, 201)
})

// DELETE /api/household/invites/:id — revoke
household.delete('/invites/:inviteId', async (c) => {
  const userId = c.get('userId')
  const { id: householdId, role } = await ensureHousehold(c.env.DB, userId)

  if (!hasRole(role, 'admin')) return c.json({ error: 'Admin access required' }, 403)

  const invite = await c.env.DB.prepare(
    `SELECT id FROM household_members WHERE id = ? AND household_id = ? AND status = 'pending'`,
  ).bind(c.req.param('inviteId'), householdId).first()
  if (!invite) return c.json({ error: 'Invite not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE household_members SET status = 'removed', invite_token_hash = NULL WHERE id = ?`,
  ).bind(c.req.param('inviteId')).run()

  return c.json({ success: true })
})

// POST /api/household/invites/accept
household.post('/invites/accept', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ token: string }>()
  if (!body.token) return c.json({ error: 'token required' }, 400)

  const hash = await hashToken(body.token)
  const invite = await c.env.DB.prepare(`
    SELECT hm.id, hm.household_id, hm.invite_email, hm.invite_expires_at, hm.role
    FROM household_members hm
    WHERE hm.invite_token_hash = ? AND hm.status = 'pending'
  `).bind(hash).first<{
    id: string; household_id: string; invite_email: string
    invite_expires_at: string | null; role: string
  }>()

  if (!invite) return c.json({ error: 'invite_not_found' }, 404)
  if (invite.invite_expires_at && invite.invite_expires_at < sqliteNow()) {
    return c.json({ error: 'invite_expired' }, 410)
  }

  // Verify email matches
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId).first<{ email: string }>()
  if (!user) return c.json({ error: 'User not found' }, 404)
  if (user.email.toLowerCase() !== invite.invite_email.toLowerCase()) {
    return c.json({ error: 'email_mismatch', invite_email: invite.invite_email }, 403)
  }

  // Check if already a member
  const alreadyMember = await c.env.DB.prepare(
    `SELECT id FROM household_members WHERE household_id = ? AND user_id = ? AND status = 'active'`,
  ).bind(invite.household_id, userId).first()
  if (alreadyMember) return c.json({ error: 'already_member' }, 409)

  await c.env.DB.prepare(`
    UPDATE household_members
    SET user_id = ?, status = 'active', joined_at = datetime('now'), invite_token_hash = NULL
    WHERE id = ?
  `).bind(userId, invite.id).run()

  return c.json({ success: true, household_id: invite.household_id })
})

// POST /api/household/invites/decline
household.post('/invites/decline', async (c) => {
  const body = await c.req.json<{ token: string }>()
  if (!body.token) return c.json({ error: 'token required' }, 400)

  const hash = await hashToken(body.token)
  const invite = await c.env.DB.prepare(
    `SELECT id FROM household_members WHERE invite_token_hash = ? AND status = 'pending'`,
  ).bind(hash).first<{ id: string }>()
  if (!invite) return c.json({ error: 'invite_not_found' }, 404)

  await c.env.DB.prepare(
    `UPDATE household_members SET status = 'removed', invite_token_hash = NULL WHERE id = ?`,
  ).bind(invite.id).run()

  return c.json({ success: true })
})

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** SQLite datetime string (UTC), optionally offset by secondsDelta. */
function sqliteNow(secondsDelta = 0): string {
  return new Date(Date.now() + secondsDelta * 1000)
    .toISOString().replace('T', ' ').substring(0, 19)
}

function roleDescription(role: string): string {
  switch (role) {
    case 'viewer': return 'view cats and measurements'
    case 'contributor': return 'log measurements and mark medications given'
    case 'editor': return 'add, edit, and delete cats and measurements'
    case 'admin': return 'fully manage the household including inviting members'
    default: return 'access the household'
  }
}
