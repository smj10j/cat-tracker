import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders, bearerHeaders } from '../helpers'

describe('SEC-11: Re-auth gate on account deletion', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns 403 when session is older than 5 minutes', async () => {
    const user = await seedUser()
    const sessionId = 'old-session-1'
    // Insert session with created_at 10 minutes ago
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, '2099-01-01 00:00:00', ?)"
    ).bind(sessionId, user.id, tenMinAgo).run()

    const res = await SELF.fetch('http://localhost/api/auth/account', {
      method: 'DELETE',
      headers: authedHeaders(sessionId),
    })

    expect(res.status).toBe(403)
    const body = await res.json() as { error: string; action: string }
    expect(body.error).toBe('Re-authentication required')
    expect(body.action).toBe('re-sign-in')
  })

  it('succeeds when session is fresh (< 5 minutes)', async () => {
    const user = await seedUser()
    const sessionId = 'fresh-session-1'
    // Insert session with created_at just now
    const now = new Date().toISOString()
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, '2099-01-01 00:00:00', ?)"
    ).bind(sessionId, user.id, now).run()

    const res = await SELF.fetch('http://localhost/api/auth/account', {
      method: 'DELETE',
      headers: authedHeaders(sessionId),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; deleted: boolean }
    expect(body.success).toBe(true)
    expect(body.deleted).toBe(true)
  })
})

describe('SEC-11: GET /api/auth/me includes session_age_seconds', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns session_age_seconds in the response', async () => {
    const user = await seedUser()
    const sessionId = 'me-session-1'
    // Insert session with created_at 2 minutes ago
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, '2099-01-01 00:00:00', ?)"
    ).bind(sessionId, user.id, twoMinAgo).run()

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      headers: authedHeaders(sessionId),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { session_age_seconds: number }
    expect(typeof body.session_age_seconds).toBe('number')
    // Should be approximately 120 seconds (2 min), allow some tolerance
    expect(body.session_age_seconds).toBeGreaterThanOrEqual(110)
    expect(body.session_age_seconds).toBeLessThan(180)
  })
})

describe('SEC-13: Apple token replay prevention (cache table)', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('rejects duplicate token_key in apple_token_cache', async () => {
    // Directly test the replay cache logic by inserting into the table
    const tokenKey = 'abc123hash'
    const expiresAt = new Date(Date.now() + 600 * 1000).toISOString()

    // First insert should succeed
    await env.DB.prepare(
      'INSERT INTO apple_token_cache (token_key, expires_at) VALUES (?, ?)'
    ).bind(tokenKey, expiresAt).run()

    // Verify it exists
    const row = await env.DB.prepare(
      'SELECT 1 FROM apple_token_cache WHERE token_key = ?'
    ).bind(tokenKey).first()
    expect(row).not.toBeNull()

    // Second insert with same key should fail (PRIMARY KEY constraint)
    let threw = false
    try {
      await env.DB.prepare(
        'INSERT INTO apple_token_cache (token_key, expires_at) VALUES (?, ?)'
      ).bind(tokenKey, expiresAt).run()
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('expired entries are cleaned up by cron DELETE', async () => {
    // Insert an expired entry with a date far in the past (SQLite format without T/Z)
    const tokenKey = 'expired-token'
    const pastDate = '2020-01-01 00:00:00'
    await env.DB.prepare(
      'INSERT INTO apple_token_cache (token_key, expires_at) VALUES (?, ?)'
    ).bind(tokenKey, pastDate).run()

    // Run the cleanup query (same as in cron handler)
    await env.DB.prepare("DELETE FROM apple_token_cache WHERE expires_at < datetime('now')").run()

    // Should be gone
    const row = await env.DB.prepare(
      'SELECT 1 FROM apple_token_cache WHERE token_key = ?'
    ).bind(tokenKey).first()
    expect(row).toBeNull()
  })
})
