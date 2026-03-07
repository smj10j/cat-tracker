import { Hono } from 'hono'
import { getCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../types'
import { requireAuth, createSession } from '../middleware/auth'

const auth = new Hono<AppEnv>()

// GET /api/auth/login?provider=google
auth.get('/auth/login', (c) => {
  const redirectBase = c.env.OAUTH_REDIRECT_BASE
  const state = crypto.randomUUID().replace(/-/g, '')

  // Store state in short-lived cookie for CSRF protection
  deleteCookie(c, 'oauth_state')
  const res = c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${redirectBase}/api/auth/callback`,
      response_type: 'code',
      scope: 'email profile',
      state,
      access_type: 'online',
    })}`
  )
  // Set state cookie on the response before returning
  res.headers.append(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`
  )
  return res
})

// GET /api/auth/callback
auth.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const storedState = getCookie(c, 'oauth_state')
  const redirectBase = c.env.OAUTH_REDIRECT_BASE

  if (!code || !state || state !== storedState) {
    return c.redirect(`${redirectBase}/login?error=invalid_state`)
  }

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
    return c.redirect(`${redirectBase}/login?error=token_exchange_failed`)
  }

  // Get Google user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const profile = await profileRes.json() as {
    id: string; email: string; name: string; picture: string
  }

  if (!profile.id || !profile.email) {
    return c.redirect(`${redirectBase}/login?error=profile_failed`)
  }

  // Upsert user in D1
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

  if (!user) return c.redirect(`${redirectBase}/login?error=user_creation_failed`)

  // Create session
  const sessionId = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt).run()

  // Set session cookie and clear state cookie, then redirect to app
  const res = c.redirect(`${redirectBase}/`)
  res.headers.append(
    'Set-Cookie',
    `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`
  )
  res.headers.append(
    'Set-Cookie',
    `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  )
  return res
})

// POST /api/auth/logout
auth.post('/auth/logout', requireAuth, async (c) => {
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }
  const res = c.json({ success: true })
  res.headers.append(
    'Set-Cookie',
    `session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  )
  return res
})

// GET /api/auth/me
auth.get('/auth/me', requireAuth, async (c) => {
  const userId = c.get('userId')
  const user = await c.env.DB.prepare(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; display_name: string | null; avatar_url: string | null }>()

  if (!user) return c.json({ error: 'User not found' }, 404)

  // Check if there are unclaimed cats (for first-login prompt)
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

// POST /api/auth/claim-cats — assign all unclaimed cats to the current user
auth.post('/auth/claim-cats', requireAuth, async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'UPDATE cats SET user_id = ? WHERE user_id IS NULL'
  ).bind(userId).run()

  return c.json({ claimed: result.meta.changes })
})

export default auth
export { createSession }
