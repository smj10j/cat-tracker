import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

beforeEach(async () => {
  await applySchema()
  await clearDb()
})

// ─── SEC-12: Data Export Rate Limiting ──────────────────────────────────────────

describe('SEC-12: data export rate limiting', () => {
  it('allows 5 exports in one hour', async () => {
    await seedUser()
    await seedSession('user-1')

    for (let i = 0; i < 5; i++) {
      const res = await SELF.fetch('http://localhost/api/auth/export', {
        headers: authedHeaders('session-1'),
      })
      expect(res.status).toBe(200)
    }
  })

  it('returns 429 on 6th export within same hour', async () => {
    await seedUser()
    await seedSession('user-1')

    for (let i = 0; i < 5; i++) {
      await SELF.fetch('http://localhost/api/auth/export', {
        headers: authedHeaders('session-1'),
      })
    }

    const res = await SELF.fetch('http://localhost/api/auth/export', {
      headers: authedHeaders('session-1'),
    })
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('exported your data recently')
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('rate limits are per-user (different users not affected)', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com', oauth_id: 'g1' })
    await seedUser({ id: 'user-2', email: 'b@test.com', oauth_id: 'g2' })
    await seedSession('user-1', 'session-1')
    await seedSession('user-2', 'session-2')

    // user-1 exhausts their limit
    for (let i = 0; i < 5; i++) {
      await SELF.fetch('http://localhost/api/auth/export', {
        headers: authedHeaders('session-1'),
      })
    }

    // user-2 can still export
    const res = await SELF.fetch('http://localhost/api/auth/export', {
      headers: authedHeaders('session-2'),
    })
    expect(res.status).toBe(200)
  })
})

// ─── SEC-14: Device Token Validation ────────────────────────────────────────────

describe('SEC-14: device token validation', () => {
  it('accepts valid Expo push token', async () => {
    await seedUser()
    await seedSession('user-1')

    const res = await SELF.fetch('http://localhost/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders('session-1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        platform: 'ios',
      }),
    })
    expect(res.status).toBe(200)
  })

  it('accepts valid APNs hex token', async () => {
    await seedUser()
    await seedSession('user-1')

    const res = await SELF.fetch('http://localhost/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders('session-1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        platform: 'ios',
      }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects invalid token format', async () => {
    await seedUser()
    await seedSession('user-1')

    const res = await SELF.fetch('http://localhost/api/auth/device-token', {
      method: 'POST',
      headers: { ...authedHeaders('session-1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'short',
        platform: 'ios',
      }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid device token format')
  })

  it('caps tokens at 10 per user (prunes oldest)', async () => {
    await seedUser()
    await seedSession('user-1')

    // Register 12 tokens
    for (let i = 0; i < 12; i++) {
      const token = `ExponentPushToken[${'x'.repeat(20)}${String(i).padStart(5, '0')}]`
      await SELF.fetch('http://localhost/api/auth/device-token', {
        method: 'POST',
        headers: { ...authedHeaders('session-1'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'ios' }),
      })
    }

    // Should only have 10 tokens
    const count = await env.DB.prepare(
      'SELECT COUNT(*) as n FROM device_tokens WHERE user_id = ?',
    ).bind('user-1').first<{ n: number }>()
    expect(count!.n).toBe(10)
  })
})

// ─── SEC-15: Audit Logging ──────────────────────────────────────────────────────

describe('SEC-15: audit logging', () => {
  it('logs sign_out event', async () => {
    await seedUser()
    await seedSession('user-1')

    await SELF.fetch('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: authedHeaders('session-1'),
    })

    const logs = await env.DB.prepare(
      "SELECT action, user_id FROM audit_log WHERE action = 'sign_out'",
    ).all<{ action: string; user_id: string }>()

    expect(logs.results.length).toBe(1)
    expect(logs.results[0]!.user_id).toBe('user-1')
  })

  it('logs data_exported event', async () => {
    await seedUser()
    await seedSession('user-1')

    await SELF.fetch('http://localhost/api/auth/export', {
      headers: authedHeaders('session-1'),
    })

    const logs = await env.DB.prepare(
      "SELECT action FROM audit_log WHERE action = 'data_exported'",
    ).all()
    expect(logs.results.length).toBe(1)
  })
})

// ─── SEC-10: Device Fingerprint (soft enforcement) ──────────────────────────────

describe('SEC-10: device fingerprint binding', () => {
  it('stores device fingerprint on session creation', async () => {
    await seedUser()
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, device_fingerprint) VALUES ('fp-session', 'user-1', '2099-01-01', 'iPhone15,2|ios/17.4')",
    ).run()

    const row = await env.DB.prepare(
      'SELECT device_fingerprint FROM sessions WHERE id = ?',
    ).bind('fp-session').first<{ device_fingerprint: string }>()

    expect(row!.device_fingerprint).toBe('iPhone15,2|ios/17.4')
  })

  it('auth middleware works with device_fingerprint column present', async () => {
    await seedUser()
    await seedSession('user-1')

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      headers: authedHeaders('session-1'),
    })
    expect(res.status).toBe(200)
  })
})

// ─── API Version Enforcement ────────────────────────────────────────────────────

describe('API version enforcement', () => {
  it('returns 426 when client version is below minimum', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.0.0',
      features: { pushNotificationsEnabled: false, appleSignInEnabled: true, streaksEnabled: false, aiNarrativeEnabled: false },
      maintenanceMode: false,
    }))

    const res = await SELF.fetch('http://localhost/api/health', {
      headers: { 'X-API-Version': '1.0.0' },
    })
    expect(res.status).toBe(426)
    const body = await res.json() as { error: string; minSupportedVersion: string }
    expect(body.error).toContain('too old')
    expect(body.minSupportedVersion).toBe('2.0.0')
  })

  it('allows requests at or above minSupportedVersion', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.0.0',
      features: {},
      maintenanceMode: false,
    }))

    const res = await SELF.fetch('http://localhost/api/health', {
      headers: { 'X-API-Version': '1.0.0' },
    })
    expect(res.status).toBe(200)
  })

  it('allows requests without version header (treated as latest)', async () => {
    const res = await SELF.fetch('http://localhost/api/health')
    expect(res.status).toBe(200)
  })

  it('config endpoint returns deprecation headers when configured', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.1.0',
      features: {},
      maintenanceMode: false,
      deprecations: { oldField: '2026-06-01T00:00:00Z' },
    }))

    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    expect(res.headers.get('Deprecation')).toBe('true')
    expect(res.headers.get('Sunset')).toBeTruthy()
  })
})
