import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders, bearerHeaders } from '../helpers'

beforeAll(async () => { await applySchema() })
beforeEach(async () => { await clearDb() })

describe('Bearer token authentication', () => {
  it('authenticates with Bearer token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)
    const res = await SELF.fetch('https://test.local/api/cats', {
      headers: bearerHeaders(sessionId),
    })
    expect(res.status).toBe(200)
  })

  it('authenticates with cookie (existing behavior)', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)
    const res = await SELF.fetch('https://test.local/api/cats', {
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(200)
  })

  it('returns 401 for invalid Bearer token', async () => {
    const res = await SELF.fetch('https://test.local/api/cats', {
      headers: { Authorization: 'Bearer invalid-session-id' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for expired session via Bearer', async () => {
    const user = await seedUser()
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, '2020-01-01 00:00:00')"
    ).bind('expired-session', user.id).run()

    const res = await SELF.fetch('https://test.local/api/cats', {
      headers: bearerHeaders('expired-session'),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 with no auth at all', async () => {
    const res = await SELF.fetch('https://test.local/api/cats')
    expect(res.status).toBe(401)
  })

  it('prefers Bearer token over cookie when both present', async () => {
    const user1 = await seedUser({ id: 'user-1', email: 'a@test.com', oauth_id: 'g1' })
    const user2 = await seedUser({ id: 'user-2', email: 'b@test.com', oauth_id: 'g2' })
    const session1 = await seedSession(user1.id, 'session-1')
    const session2 = await seedSession(user2.id, 'session-2')

    // Create households for both users (cats query requires household membership)
    await env.DB.prepare(
      "INSERT INTO households (id, name, owner_user_id) VALUES ('h2', 'Home 2', 'user-2')"
    ).run()
    await env.DB.prepare(
      "INSERT INTO household_members (id, household_id, user_id, role, status) VALUES ('hm2', 'h2', 'user-2', 'admin', 'active')"
    ).run()

    // Create a cat for user-2
    await env.DB.prepare(
      "INSERT INTO cats (id, name, birthdate, user_id, household_id) VALUES ('cat-2', 'Bearer Cat', '2020-01-01', 'user-2', 'h2')"
    ).run()

    // Send Bearer for user-2 and Cookie for user-1 — Bearer wins
    const res = await SELF.fetch('https://test.local/api/cats', {
      headers: {
        Authorization: `Bearer ${session2}`,
        Cookie: `session=${session1}`,
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    // The cats response may be { cats: [...] } or just [...]
    const cats = (Array.isArray(body) ? body : (body.cats ?? [])) as Array<{ name: string }>
    expect(cats.some(c => c.name === 'Bearer Cat')).toBe(true)
  })
})

describe('GET /api/auth/me', () => {
  it('includes oauth_provider in response', async () => {
    const user = await seedUser({ oauth_provider: 'google' })
    const sessionId = await seedSession(user.id)
    const res = await SELF.fetch('https://test.local/api/auth/me', {
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { oauth_provider: string }
    expect(data.oauth_provider).toBe('google')
  })

  it('works with Bearer token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)
    const res = await SELF.fetch('https://test.local/api/auth/me', {
      headers: bearerHeaders(sessionId),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { id: string }
    expect(data.id).toBe(user.id)
  })
})

describe('DELETE /api/auth/account', () => {
  it('deletes user and all associated data', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    // Create household, cat, measurement, medication
    await env.DB.prepare(
      "INSERT INTO households (id, name, owner_user_id) VALUES ('h1', 'Test Home', ?)"
    ).bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO household_members (id, household_id, user_id, role, status) VALUES ('hm1', 'h1', ?, 'admin', 'active')"
    ).bind(user.id).run()
    // Add a second admin so sole-admin check doesn't block
    const user2 = await seedUser({ id: 'user-2', email: 'other@test.com', oauth_id: 'g2' })
    await env.DB.prepare(
      "INSERT INTO household_members (id, household_id, user_id, role, status) VALUES ('hm2', 'h1', ?, 'admin', 'active')"
    ).bind(user2.id).run()

    await env.DB.prepare(
      "INSERT INTO cats (id, name, birthdate, user_id, household_id) VALUES ('c1', 'Whiskers', '2020-01-01', ?, 'h1')"
    ).bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO measurements (id, cat_id, type, value, unit, measured_at) VALUES ('m1', 'c1', 'weight', 10, 'lbs', '2026-01-01T12:00:00Z')"
    ).run()
    await env.DB.prepare(
      "INSERT INTO medications (id, cat_id, user_id, name, frequency, start_date) VALUES ('med1', 'c1', ?, 'Flea Med', 'monthly', '2026-01-01')"
    ).bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO medication_doses (id, medication_id, due_at) VALUES ('dose1', 'med1', '2026-01-01 09:00:00')"
    ).run()
    await env.DB.prepare(
      "INSERT INTO device_tokens (id, user_id, token, platform) VALUES ('dt1', ?, 'tok123', 'ios')"
    ).bind(user.id).run()

    const res = await SELF.fetch('https://test.local/api/auth/account', {
      method: 'DELETE',
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { success: boolean; deleted: boolean }
    expect(data.deleted).toBe(true)

    // Verify everything is gone
    const userRow = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    expect(userRow).toBeNull()

    const cats = await env.DB.prepare('SELECT * FROM cats WHERE user_id = ?').bind(user.id).all()
    expect(cats.results).toHaveLength(0)

    const meds = await env.DB.prepare('SELECT * FROM medications WHERE user_id = ?').bind(user.id).all()
    expect(meds.results).toHaveLength(0)

    const doses = await env.DB.prepare('SELECT * FROM medication_doses WHERE medication_id = ?').bind('med1').all()
    expect(doses.results).toHaveLength(0)

    const tokens = await env.DB.prepare('SELECT * FROM device_tokens WHERE user_id = ?').bind(user.id).all()
    expect(tokens.results).toHaveLength(0)

    const sessions = await env.DB.prepare('SELECT * FROM sessions WHERE user_id = ?').bind(user.id).all()
    expect(sessions.results).toHaveLength(0)
  })

  it('blocks deletion when user is sole admin of a household', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    await env.DB.prepare(
      "INSERT INTO households (id, name, owner_user_id) VALUES ('h1', 'Solo Home', ?)"
    ).bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO household_members (id, household_id, user_id, role, status) VALUES ('hm1', 'h1', ?, 'admin', 'active')"
    ).bind(user.id).run()

    const res = await SELF.fetch('https://test.local/api/auth/account', {
      method: 'DELETE',
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(409)
    const data = await res.json() as { error: string; households: Array<{ id: string }> }
    expect(data.error).toContain('sole admin')
    expect(data.households).toHaveLength(1)

    // Verify user still exists
    const userRow = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    expect(userRow).not.toBeNull()
  })

  it('works with Bearer token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/account', {
      method: 'DELETE',
      headers: bearerHeaders(sessionId),
    })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/auth/export', () => {
  it('exports all user data as JSON', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    await env.DB.prepare(
      "INSERT INTO cats (id, name, birthdate, user_id) VALUES ('c1', 'Luna', '2020-06-15', ?)"
    ).bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO measurements (id, cat_id, type, value, unit, measured_at) VALUES ('m1', 'c1', 'weight', 9.5, 'lbs', '2026-03-01T12:00:00Z')"
    ).run()
    await env.DB.prepare(
      "INSERT INTO medications (id, cat_id, user_id, name, frequency, start_date) VALUES ('med1', 'c1', ?, 'Flea Med', 'monthly', '2026-01-01')"
    ).bind(user.id).run()

    const res = await SELF.fetch('https://test.local/api/auth/export', {
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('cat-tracker-export-')

    const data = await res.json() as {
      exported_at: string
      user: { id: string }
      cats: Array<{ name: string }>
      measurements: Array<{ type: string }>
      medications: Array<{ name: string }>
    }

    expect(data.exported_at).toBeTruthy()
    expect(data.user.id).toBe(user.id)
    expect(data.cats).toHaveLength(1)
    expect(data.cats[0]!.name).toBe('Luna')
    expect(data.measurements).toHaveLength(1)
    expect(data.medications).toHaveLength(1)
  })

  it('returns empty arrays when user has no data', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/export', {
      headers: authedHeaders(sessionId),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { cats: unknown[]; measurements: unknown[] }
    expect(data.cats).toHaveLength(0)
    expect(data.measurements).toHaveLength(0)
  })

  it('works with Bearer token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/export', {
      headers: bearerHeaders(sessionId),
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/device-token', () => {
  it('registers a device token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'expo-push-token-123', platform: 'ios' }),
    })
    expect(res.status).toBe(200)

    const tokens = await env.DB.prepare('SELECT * FROM device_tokens WHERE user_id = ?').bind(user.id).all()
    expect(tokens.results).toHaveLength(1)
    expect((tokens.results[0] as Record<string, unknown>).platform).toBe('ios')
  })

  it('is idempotent for same user+token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const body = JSON.stringify({ token: 'tok-abc', platform: 'ios' })
    await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body,
    })
    await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body,
    })

    const tokens = await env.DB.prepare('SELECT * FROM device_tokens WHERE user_id = ?').bind(user.id).all()
    expect(tokens.results).toHaveLength(1)
  })

  it('rejects invalid platform', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok', platform: 'windows' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'ios' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/auth/device-token', () => {
  it('removes a device token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    await env.DB.prepare(
      "INSERT INTO device_tokens (id, user_id, token, platform) VALUES ('dt1', ?, 'tok-xyz', 'ios')"
    ).bind(user.id).run()

    const res = await SELF.fetch('https://test.local/api/auth/device-token', {
      method: 'DELETE',
      headers: { ...authedHeaders(sessionId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok-xyz' }),
    })
    expect(res.status).toBe(200)

    const tokens = await env.DB.prepare('SELECT * FROM device_tokens WHERE user_id = ?').bind(user.id).all()
    expect(tokens.results).toHaveLength(0)
  })
})

describe('GET /api/auth/login', () => {
  it('redirects to Google by default', async () => {
    const res = await SELF.fetch('https://test.local/api/auth/login', { redirect: 'manual' })
    expect(res.status).toBe(302)
    const location = res.headers.get('Location')!
    expect(location).toContain('accounts.google.com')
  })

  it('redirects to Apple when provider=apple', async () => {
    const res = await SELF.fetch('https://test.local/api/auth/login?provider=apple', { redirect: 'manual' })
    expect(res.status).toBe(302)
    const location = res.headers.get('Location')!
    expect(location).toContain('appleid.apple.com')
    expect(location).toContain('response_mode=form_post')
  })

  it('stores state with provider in oauth_states', async () => {
    await SELF.fetch('https://test.local/api/auth/login?provider=apple', { redirect: 'manual' })

    const states = await env.DB.prepare('SELECT * FROM oauth_states').all()
    expect(states.results).toHaveLength(1)
    expect((states.results[0] as Record<string, unknown>).provider).toBe('apple')
  })

  it('includes mode=native in redirect_uri when specified', async () => {
    const res = await SELF.fetch('https://test.local/api/auth/login?mode=native', { redirect: 'manual' })
    const location = res.headers.get('Location')!
    // The redirect_uri parameter inside the Google URL should contain mode=native
    const url = new URL(location)
    const redirectUri = url.searchParams.get('redirect_uri')!
    expect(redirectUri).toContain('mode=native')
  })

  it('preserves next URL in state', async () => {
    await SELF.fetch('https://test.local/api/auth/login?next=/invite?token=abc', { redirect: 'manual' })

    const states = await env.DB.prepare('SELECT * FROM oauth_states').all()
    expect((states.results[0] as Record<string, unknown>).next_url).toBe('/invite?token=abc')
  })
})

describe('POST /api/auth/logout', () => {
  it('works with Bearer token', async () => {
    const user = await seedUser()
    const sessionId = await seedSession(user.id)

    const res = await SELF.fetch('https://test.local/api/auth/logout', {
      method: 'POST',
      headers: bearerHeaders(sessionId),
    })
    expect(res.status).toBe(200)

    // Session should be deleted
    const sessions = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).all()
    expect(sessions.results).toHaveLength(0)
  })
})
