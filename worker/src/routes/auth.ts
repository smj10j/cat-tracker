import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { ensureHousehold } from '../lib/household'
import { generateAppleClientSecret, verifyAppleIdToken } from '../lib/apple-auth'
import { logAudit, checkRateLimit } from '../lib/audit'

const auth = new Hono<AppEnv>()

function sessionCookie(value: string, maxAge: number) {
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

/** Create a session and return session ID + user ID. */
async function createSession(db: D1Database, userId: string, deviceFingerprint?: string | null): Promise<string> {
  const sessionId = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  // SEC-10: Store device fingerprint if provided (from X-Device-Id header)
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at, device_fingerprint) VALUES (?, ?, ?, ?)')
    .bind(sessionId, userId, expiresAt, deviceFingerprint ?? null).run()

  // SEC-07: Cap sessions per user at 20 (delete oldest beyond that)
  await db.prepare(`
    DELETE FROM sessions WHERE id IN (
      SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 20
    )
  `).bind(userId).run()

  return sessionId
}

/** Return either a redirect (web) or app-scheme redirect (native) depending on mode. */
function authResponse(
  redirectBase: string,
  sessionId: string,
  redirectPath: string,
  nativeRedirectUri: string | null,
) {
  // Native app: redirect to app's custom URL scheme with session token
  if (nativeRedirectUri) {
    const separator = nativeRedirectUri.includes('?') ? '&' : '?'
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${nativeRedirectUri}${separator}session=${sessionId}`,
      },
    })
  }

  // Web: redirect with session cookie
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${redirectBase}${redirectPath}`,
      'Set-Cookie': sessionCookie(sessionId, 7 * 24 * 60 * 60),
    },
  })
}

// GET /api/auth/login?provider=google|apple&next=/invite?token=xxx&mode=native
auth.get('/auth/login', async (c) => {
  const redirectBase = c.env.OAUTH_REDIRECT_BASE
  const nextUrl = c.req.query('next') ?? null
  const provider = c.req.query('provider') ?? 'google'
  const mode = c.req.query('mode') ?? null
  const nativeRedirectUri = c.req.query('redirect_uri') ?? null
  const state = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // Store state in D1 (avoids cookie round-trip through redirect proxy)
  // native_redirect_uri is stored so the callback can redirect back to the app scheme
  await c.env.DB.prepare(
    "INSERT INTO oauth_states (state, expires_at, next_url, provider, native_redirect_uri) VALUES (?, ?, ?, ?, ?) ON CONFLICT(state) DO NOTHING"
  ).bind(state, expiresAt, nextUrl, provider, nativeRedirectUri).run()

  // Clean up old states opportunistically
  c.executionCtx.waitUntil(
    c.env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < datetime('now')").run()
  )

  const callbackUrl = `${redirectBase}/api/auth/callback${mode ? `?mode=${mode}` : ''}`

  if (provider === 'apple') {
    const appleUrl = `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
      client_id: c.env.APPLE_SERVICE_ID,
      redirect_uri: callbackUrl,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state,
    })}`

    return new Response(null, {
      status: 302,
      headers: { Location: appleUrl },
    })
  }

  // Default: Google OAuth
  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
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

// GET /api/auth/callback — Google OAuth callback (query params)
auth.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const redirectBase = c.env.OAUTH_REDIRECT_BASE
  const mode = c.req.query('mode') ?? undefined

  if (!code || !state) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=missing_params` } })
  }

  // SEC-01: Atomically consume the state token via DELETE...RETURNING.
  const consumed = await c.env.DB.prepare(
    "DELETE FROM oauth_states WHERE state = ? AND expires_at > datetime('now') RETURNING state, next_url, provider, native_redirect_uri"
  ).bind(state).first<{ state: string; next_url: string | null; provider: string; native_redirect_uri: string | null }>()

  if (!consumed) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=invalid_state` } })
  }

  const postLoginRedirect = consumed.next_url ?? '/'
  const callbackUrl = `${redirectBase}/api/auth/callback${mode ? `?mode=${mode}` : ''}`

  // Exchange authorization code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl,
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

  const deviceFingerprint = c.req.header('X-Device-Id') ?? null
  const sessionId = await createSession(c.env.DB, user.id, deviceFingerprint)
  logAudit(c, 'sign_in', { provider: 'google', userId: user.id })

  return authResponse(redirectBase, sessionId, postLoginRedirect, consumed.native_redirect_uri)
})

// POST /api/auth/callback — Apple OAuth callback (form_urlencoded POST)
auth.post('/auth/callback', async (c) => {
  const redirectBase = c.env.OAUTH_REDIRECT_BASE
  const mode = c.req.query('mode') ?? undefined

  const body = await c.req.parseBody() as Record<string, string>
  const { id_token: idToken, state, user: userJson } = body

  if (!idToken || !state) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=missing_params` } })
  }

  // SEC-01: Atomically consume the state token
  const consumed = await c.env.DB.prepare(
    "DELETE FROM oauth_states WHERE state = ? AND expires_at > datetime('now') RETURNING state, next_url, provider, native_redirect_uri"
  ).bind(state).first<{ state: string; next_url: string | null; provider: string; native_redirect_uri: string | null }>()

  if (!consumed || consumed.provider !== 'apple') {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=invalid_state` } })
  }

  const postLoginRedirect = consumed.next_url ?? '/'

  // Verify the Apple id_token JWT
  let payload
  try {
    payload = await verifyAppleIdToken(idToken, c.env.APPLE_SERVICE_ID)
  } catch {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=apple_token_invalid` } })
  }

  if (!payload.sub || !payload.email) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=apple_missing_profile` } })
  }

  // Apple sends the user's name ONLY on the first authorization
  let displayName: string | null = null
  if (userJson) {
    try {
      const userData = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } }
      const first = userData.name?.firstName ?? ''
      const last = userData.name?.lastName ?? ''
      displayName = [first, last].filter(Boolean).join(' ') || null
    } catch {
      // Ignore malformed user JSON — name is optional
    }
  }

  // Upsert user — only update display_name if it's provided (first auth) or currently null
  await c.env.DB.prepare(`
    INSERT INTO users (email, display_name, avatar_url, oauth_provider, oauth_id)
    VALUES (?, ?, NULL, 'apple', ?)
    ON CONFLICT(oauth_provider, oauth_id) DO UPDATE SET
      email = excluded.email,
      display_name = COALESCE(excluded.display_name, users.display_name)
  `).bind(payload.email, displayName, payload.sub).run()

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE oauth_provider = 'apple' AND oauth_id = ?"
  ).bind(payload.sub).first<{ id: string }>()

  if (!user) {
    return new Response(null, { status: 302, headers: { Location: `${redirectBase}/login?error=user_creation_failed` } })
  }

  const deviceFingerprint = c.req.header('X-Device-Id') ?? null
  const sessionId = await createSession(c.env.DB, user.id, deviceFingerprint)
  logAudit(c, 'sign_in', { provider: 'apple', userId: user.id })

  return authResponse(redirectBase, sessionId, postLoginRedirect, consumed.native_redirect_uri)
})

// POST /api/auth/apple-native — Native iOS Apple Sign In (receives identity token directly)
auth.post('/auth/apple-native', async (c) => {
  const body = await c.req.json<{
    identityToken: string
    fullName?: { givenName?: string; familyName?: string } | null
  }>()

  if (!body.identityToken) {
    return c.json({ error: 'identityToken is required' }, 400)
  }

  // Verify the Apple id_token JWT
  let payload
  try {
    // For native Sign in with Apple, the audience is the bundle ID, not the Service ID
    payload = await verifyAppleIdToken(body.identityToken, 'me.01j.whisker')
  } catch {
    // Fallback: try with Service ID in case Apple sends that as audience
    try {
      payload = await verifyAppleIdToken(body.identityToken, c.env.APPLE_SERVICE_ID)
    } catch {
      return c.json({ error: 'Invalid identity token' }, 401)
    }
  }

  if (!payload.sub || !payload.email) {
    return c.json({ error: 'Missing user identity' }, 400)
  }

  // SEC-13: Apple token replay prevention
  const tokenData = new TextEncoder().encode(payload.sub + '|' + (payload.iat ?? ''))
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData)
  const tokenKey = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const existing = await c.env.DB.prepare(
    'SELECT 1 FROM apple_token_cache WHERE token_key = ?'
  ).bind(tokenKey).first()

  if (existing) {
    return c.json({ error: 'Token already consumed' }, 409)
  }

  // Store token key with expiry (iat + 600 seconds)
  const iatDate = payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString()
  await c.env.DB.prepare(
    "INSERT INTO apple_token_cache (token_key, expires_at) VALUES (?, datetime(?, '+600 seconds'))"
  ).bind(tokenKey, iatDate).run()

  // Build display name from native credential (only available on first auth)
  let displayName: string | null = null
  if (body.fullName) {
    const first = body.fullName.givenName ?? ''
    const last = body.fullName.familyName ?? ''
    displayName = [first, last].filter(Boolean).join(' ') || null
  }

  // Upsert user
  await c.env.DB.prepare(`
    INSERT INTO users (email, display_name, avatar_url, oauth_provider, oauth_id)
    VALUES (?, ?, NULL, 'apple', ?)
    ON CONFLICT(oauth_provider, oauth_id) DO UPDATE SET
      email = excluded.email,
      display_name = COALESCE(excluded.display_name, users.display_name)
  `).bind(payload.email, displayName, payload.sub).run()

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE oauth_provider = 'apple' AND oauth_id = ?"
  ).bind(payload.sub).first<{ id: string }>()

  if (!user) {
    return c.json({ error: 'User creation failed' }, 500)
  }

  const deviceFingerprint = c.req.header('X-Device-Id') ?? null
  const sessionId = await createSession(c.env.DB, user.id, deviceFingerprint)
  logAudit(c, 'sign_in', { provider: 'apple-native', userId: user.id })

  return c.json({ sessionId, userId: user.id })
})

// POST /api/auth/logout
auth.post('/auth/logout', requireAuth, async (c) => {
  logAudit(c, 'sign_out')
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const sessionId = bearerToken ?? getCookie(c, 'session')
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
  const sessionId = c.get('sessionId')
  const user = await c.env.DB.prepare(
    'SELECT id, email, display_name, avatar_url, oauth_provider FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; display_name: string | null; avatar_url: string | null; oauth_provider: string }>()

  if (!user) return c.json({ error: 'User not found' }, 404)

  const orphaned = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM cats WHERE user_id IS NULL'
  ).first<{ count: number }>()

  // SEC-11: Include session age for frontend re-auth gate checks
  let session_age_seconds = 0
  const sessionRow = await c.env.DB.prepare(
    'SELECT created_at FROM sessions WHERE id = ?'
  ).bind(sessionId).first<{ created_at: string }>()
  if (sessionRow) {
    const raw = sessionRow.created_at
    const createdAt = new Date(raw.includes('T') ? raw : raw + 'Z').getTime()
    session_age_seconds = Math.floor((Date.now() - createdAt) / 1000)
  }

  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    oauth_provider: user.oauth_provider,
    hasOrphanedCats: (orphaned?.count ?? 0) > 0,
    session_age_seconds,
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

// DELETE /api/auth/account — Apple requires in-app account deletion
auth.delete('/auth/account', requireAuth, async (c) => {
  const userId = c.get('userId')
  const sessionId = c.get('sessionId')

  // SEC-11: Re-auth gate — session must be < 5 minutes old
  const sessionRow = await c.env.DB.prepare(
    'SELECT created_at FROM sessions WHERE id = ? AND user_id = ?'
  ).bind(sessionId, userId).first<{ created_at: string }>()

  if (sessionRow) {
    // D1 datetime('now') stores as 'YYYY-MM-DD HH:MM:SS' (no Z); explicit inserts may include T/Z
    const raw = sessionRow.created_at
    const createdAt = new Date(raw.includes('T') ? raw : raw + 'Z').getTime()
    const ageMs = Date.now() - createdAt
    if (ageMs > 5 * 60 * 1000) {
      return c.json({ error: 'Re-authentication required', action: 're-sign-in' }, 403)
    }
  }

  // Check if user is the sole Admin of any household
  const soleAdminHouseholds = await c.env.DB.prepare(`
    SELECT h.id, h.name FROM households h
    WHERE h.owner_user_id = ?
    AND (SELECT COUNT(*) FROM household_members hm
         WHERE hm.household_id = h.id AND hm.role = 'admin' AND hm.status = 'active') <= 1
  `).bind(userId).all<{ id: string; name: string }>()

  if (soleAdminHouseholds.results.length > 0) {
    return c.json({
      error: 'Cannot delete account: you are the sole admin of one or more households',
      households: soleAdminHouseholds.results.map(h => ({ id: h.id, name: h.name })),
      hint: 'Transfer ownership or delete the household first',
    }, 409)
  }

  // Get all cats owned by this user (for R2 photo cleanup)
  const userCats = await c.env.DB.prepare(
    'SELECT id FROM cats WHERE user_id = ?'
  ).bind(userId).all<{ id: string }>()

  // Delete in order (respecting foreign keys):
  // 1. medication_doses for user's medications
  await c.env.DB.prepare(`
    DELETE FROM medication_doses WHERE medication_id IN (
      SELECT id FROM medications WHERE user_id = ?
    )
  `).bind(userId).run()

  // 2. medications
  await c.env.DB.prepare('DELETE FROM medications WHERE user_id = ?').bind(userId).run()

  // 3. measurements for user's cats
  await c.env.DB.prepare(`
    DELETE FROM measurements WHERE cat_id IN (
      SELECT id FROM cats WHERE user_id = ?
    )
  `).bind(userId).run()

  // 4. R2 photos (best-effort; don't block account deletion on R2 failures)
  if (c.env.PHOTOS) {
    for (const cat of userCats.results) {
      try {
        await c.env.PHOTOS.delete(`cats/${cat.id}/photo.jpg`)
      } catch {
        // Ignore R2 errors during account deletion
      }
    }
  }

  // 5. cats
  await c.env.DB.prepare('DELETE FROM cats WHERE user_id = ?').bind(userId).run()

  // 6. Transfer household ownership where this user is owner but other admins exist
  const ownedHouseholds = await c.env.DB.prepare(
    'SELECT id FROM households WHERE owner_user_id = ?'
  ).bind(userId).all<{ id: string }>()

  for (const household of ownedHouseholds.results) {
    // Find another active admin to transfer to
    const newOwner = await c.env.DB.prepare(`
      SELECT user_id FROM household_members
      WHERE household_id = ? AND user_id != ? AND role = 'admin' AND status = 'active'
      LIMIT 1
    `).bind(household.id, userId).first<{ user_id: string }>()

    if (newOwner) {
      await c.env.DB.prepare('UPDATE households SET owner_user_id = ? WHERE id = ?')
        .bind(newOwner.user_id, household.id).run()
    } else {
      // No other admin — delete the household (members were already checked above)
      await c.env.DB.prepare('DELETE FROM household_members WHERE household_id = ?')
        .bind(household.id).run()
      await c.env.DB.prepare('DELETE FROM households WHERE id = ?')
        .bind(household.id).run()
    }
  }

  // 7. household_members
  await c.env.DB.prepare('DELETE FROM household_members WHERE user_id = ?').bind(userId).run()

  // 8. device_tokens
  await c.env.DB.prepare('DELETE FROM device_tokens WHERE user_id = ?').bind(userId).run()

  // 9. sessions
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()

  // 10. user — audit before delete since the user row is about to be removed
  logAudit(c, 'account_deleted', { userId })
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  return new Response(JSON.stringify({ success: true, deleted: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie('', 0),
    },
  })
})

// GET /api/auth/export — Full data export (GDPR Article 20, Apple recommendation)
auth.get('/auth/export', requireAuth, async (c) => {
  const userId = c.get('userId')

  // SEC-12: Rate limit data exports to 5 per hour per user
  const { allowed, retryAfterSeconds } = await checkRateLimit(c.env.DB, userId, 'data_export', 5)
  if (!allowed) {
    return c.json(
      { error: `You've exported your data recently. You can export again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
      429,
      { 'Retry-After': String(retryAfterSeconds) },
    )
  }

  logAudit(c, 'data_exported')

  const user = await c.env.DB.prepare(
    'SELECT id, email, display_name, avatar_url, oauth_provider, created_at FROM users WHERE id = ?'
  ).bind(userId).first()

  const cats = await c.env.DB.prepare(
    'SELECT * FROM cats WHERE user_id = ?'
  ).bind(userId).all()

  const catIds = cats.results.map((cat: Record<string, unknown>) => cat.id as string)

  let measurements = { results: [] as Record<string, unknown>[] }
  if (catIds.length > 0) {
    // Build parameterized query for cat IDs
    const placeholders = catIds.map(() => '?').join(',')
    measurements = await c.env.DB.prepare(
      `SELECT * FROM measurements WHERE cat_id IN (${placeholders}) ORDER BY measured_at DESC`
    ).bind(...catIds).all()
  }

  const medications = await c.env.DB.prepare(
    'SELECT * FROM medications WHERE user_id = ?'
  ).bind(userId).all()

  const householdMemberships = await c.env.DB.prepare(`
    SELECT hm.*, h.name as household_name FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ? AND hm.status = 'active'
  `).bind(userId).all()

  const exportData = {
    exported_at: new Date().toISOString(),
    user,
    cats: cats.results,
    measurements: measurements.results,
    medications: medications.results,
    household_memberships: householdMemberships.results,
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="whisker-health-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
})

// SEC-14: Device token format validation
const EXPO_TOKEN_RE = /^ExponentPushToken\[.{20,50}\]$/
const APNS_TOKEN_RE = /^[a-f0-9]{64}$/i
const MAX_DEVICE_TOKENS_PER_USER = 10

function isValidDeviceToken(token: string, platform: string): boolean {
  if (platform === 'ios') return EXPO_TOKEN_RE.test(token) || APNS_TOKEN_RE.test(token)
  if (platform === 'android') return EXPO_TOKEN_RE.test(token) || token.length >= 20
  if (platform === 'web') return token.length >= 20 && token.length <= 500
  return false
}

// POST /api/auth/device-token — Register push notification device token
auth.post('/auth/device-token', requireAuth, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ token: string; platform: string }>()

  if (!body.token || !body.platform) {
    return c.json({ error: 'token and platform are required' }, 400)
  }
  if (!['ios', 'android', 'web'].includes(body.platform)) {
    return c.json({ error: 'platform must be ios, android, or web' }, 400)
  }

  // SEC-14: Validate token format
  if (!isValidDeviceToken(body.token, body.platform)) {
    return c.json({ error: 'Invalid device token format' }, 400)
  }

  await c.env.DB.prepare(
    'INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?) ON CONFLICT(user_id, token) DO NOTHING'
  ).bind(userId, body.token, body.platform).run()

  // SEC-14: Cap at MAX_DEVICE_TOKENS_PER_USER per user (prune oldest)
  await c.env.DB.prepare(`
    DELETE FROM device_tokens WHERE id IN (
      SELECT id FROM device_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?
    )
  `).bind(userId, MAX_DEVICE_TOKENS_PER_USER).run()

  return c.json({ success: true })
})

// DELETE /api/auth/device-token — Unregister push notification device token
auth.delete('/auth/device-token', requireAuth, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ token: string }>()

  if (!body.token) {
    return c.json({ error: 'token is required' }, 400)
  }

  await c.env.DB.prepare(
    'DELETE FROM device_tokens WHERE user_id = ? AND token = ?'
  ).bind(userId, body.token).run()

  return c.json({ success: true })
})

export default auth
