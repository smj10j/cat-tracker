import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { ensureHousehold } from '../lib/household'

const auth = new Hono<AppEnv>()

function sessionCookie(value: string, maxAge: number) {
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

// GET /api/auth/login?provider=google&next=/invite?token=xxx
auth.get('/auth/login', async (c) => {
  const redirectBase = c.env.OAUTH_REDIRECT_BASE
  const nextUrl = c.req.query('next') ?? null
  const state = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // Store state in D1 (avoids cookie round-trip through redirect proxy)
  await c.env.DB.prepare(
    "INSERT INTO oauth_states (state, expires_at, next_url) VALUES (?, ?, ?) ON CONFLICT(state) DO NOTHING"
  ).bind(state, expiresAt, nextUrl).run()

  // Clean up old states opportunistically
  c.executionCtx.waitUntil(
    c.env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < datetime('now')").run()
  )

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${redirectBase}/api/auth/callback`,
    response_type: 'code',
    scope: 'email profile',
    state,
    access_type: 'online',
  })}`

  return new Response(null, {
    status: 302,
    headers: { Location: googleUrl },
  })
})

// GET /api/auth/callback
auth.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const redirectBase = c.env.OAUTH_REDIRECT_BASE

  if (!code || !state) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=missing_params` } })
  }

  // SEC-01: Atomically consume the state token via DELETE...RETURNING.
  const consumed = await c.env.DB.prepare(
    "DELETE FROM oauth_states WHERE state = ? AND expires_at > datetime('now') RETURNING state, next_url"
  ).bind(state).first<{ state: string; next_url: string | null }>()

  if (!consumed) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=invalid_state` } })
  }

  const postLoginRedirect = consumed.next_url ?? '/'

  // Exchange authorization code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${redirectBase}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
  if (!tokenData.access_token) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=token_exchange_failed` } })
  }

  // Get Google user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const profile = await profileRes.json() as {
    id: string; email: string; name: string; picture: string
  }

  if (!profile.id || !profile.email) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=profile_failed` } })
  }

  // Upsert user
  await c.env.DB.prepare(`
    INSERT INTO users (email, display_name, avatar_url, oauth_provider, oauth_id)
    VALUES (?, ?, ?, 'google', ?)
    ON CONFLICT(oauth_provider, oauth_id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url
  `).bind(profile.email, profile.name, profile.picture, profile.id).run()

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE oauth_provider = 'google' AND oauth_id = ?"
  ).bind(profile.id).first<{ id: string }>()

  if (!user) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=user_creation_failed` } })
  }

  // Create session
  const sessionId = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt).run()

  // SEC-07: Cap sessions per user at 20 (delete oldest beyond that)
  c.executionCtx.waitUntil(
    c.env.DB.prepare(`
      DELETE FROM sessions WHERE id IN (
        SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 20
      )
    `).bind(user.id).run()
  )

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${redirectBase}${postLoginRedirect}`,
      'Set-Cookie': sessionCookie(sessionId, 7 * 24 * 60 * 60),
    },
  })
})

// POST /api/auth/logout
auth.post('/auth/logout', requireAuth, async (c) => {
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie('', 0),
    },
  })
})

// GET /api/auth/me
auth.get('/auth/me', requireAuth, async (c) => {
  const userId = c.get('userId')
  const user = await c.env.DB.prepare(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; display_name: string | null; avatar_url: string | null }>()

  if (!user) return c.json({ error: 'User not found' }, 404)

  const orphaned = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM cats WHERE user_id IS NULL'
  ).first<{ count: number }>()

  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    hasOrphanedCats: (orphaned?.count ?? 0) > 0,
  })
})

// POST /api/auth/claim-cats
auth.post('/auth/claim-cats', requireAuth, async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'UPDATE cats SET user_id = ? WHERE user_id IS NULL'
  ).bind(userId).run()

  // Migrate newly claimed cats to this user's household
  if (result.meta.changes > 0) {
    const { id: householdId } = await ensureHousehold(c.env.DB, userId)
    await c.env.DB.prepare(
      'UPDATE cats SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
    ).bind(householdId, userId).run()
  }

  return c.json({ claimed: result.meta.changes })
})

export default auth
