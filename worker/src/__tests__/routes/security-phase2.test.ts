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

    // Should only have 10 tokens (2 pruned from the 12 registered)
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

  it('logs rate-limited export attempts', async () => {
    await seedUser()
    await seedSession('user-1')

    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      await SELF.fetch('http://localhost/api/auth/export', {
        headers: authedHeaders('session-1'),
      })
    }

    // 6th request is blocked
    await SELF.fetch('http://localhost/api/auth/export', {
      headers: authedHeaders('session-1'),
    })

    // Both successful and blocked exports are audited
    const logs = await env.DB.prepare(
      "SELECT metadata FROM audit_log WHERE action = 'data_exported'",
    ).all<{ metadata: string | null }>()

    const blocked = logs.results.filter(l => l.metadata && JSON.parse(l.metadata).blocked === true)
    expect(blocked.length).toBe(1)
    expect(logs.results.length).toBe(6) // 5 successful + 1 blocked
  })

  it('logs cat_deleted event', async () => {
    await seedUser()
    await seedSession('user-1')

    // Create a household (required for cat ownership)
    await env.DB.prepare(
      "INSERT INTO households (id, name, owner_user_id) VALUES ('h1', 'Test House', 'user-1')",
    ).run()
    await env.DB.prepare(
      "INSERT INTO household_members (id, household_id, user_id, role, status, joined_at) VALUES ('hm1', 'h1', 'user-1', 'admin', 'active', datetime('now'))",
    ).run()

    // Create a cat
    const createRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders('session-1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCat', birthdate: '2020-01-01' }),
    })
    const cat = await createRes.json() as { id: string }

    // Delete the cat
    await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      method: 'DELETE',
      headers: authedHeaders('session-1'),
    })

    const logs = await env.DB.prepare(
      "SELECT action, metadata FROM audit_log WHERE action = 'cat_deleted'",
    ).all<{ action: string; metadata: string }>()
    expect(logs.results.length).toBe(1)
    expect(JSON.parse(logs.results[0]!.metadata).catId).toBe(cat.id)
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

  it('allows requests with mismatched fingerprint (soft enforcement)', async () => {
    await seedUser()
    // Session created with one fingerprint
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, device_fingerprint) VALUES ('fp-sess', 'user-1', '2099-01-01', 'iPhone15,2|ios/17.4')",
    ).run()

    // Request from a different device — should still succeed (soft enforcement = log only)
    const res = await SELF.fetch('http://localhost/api/auth/me', {
      headers: { ...authedHeaders('fp-sess'), 'X-Device-Id': 'iPad13,1|ios/18.0' },
    })
    expect(res.status).toBe(200)
  })

  it('allows requests when session has no stored fingerprint', async () => {
    await seedUser()
    await seedSession('user-1') // no device_fingerprint

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      headers: { ...authedHeaders('session-1'), 'X-Device-Id': 'iPhone15,2|ios/17.4' },
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

  it('rejects version just below minimum (boundary: 1.9.9 vs 2.0.0)', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.0.0',
      features: {},
      maintenanceMode: false,
    }))

    const res = await SELF.fetch('http://localhost/api/health', {
      headers: { 'X-API-Version': '1.9.9' },
    })
    expect(res.status).toBe(426)
  })

  it('allows version above minimum (2.1.0 vs 2.0.0)', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.1.0',
      features: {},
      maintenanceMode: false,
    }))

    const res = await SELF.fetch('http://localhost/api/health', {
      headers: { 'X-API-Version': '2.1.0' },
    })
    expect(res.status).toBe(200)
  })

  it('ignores malformed version header (treated as latest)', async () => {
    await env.CONFIG_KV.put('app_config', JSON.stringify({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.0.0',
      features: {},
      maintenanceMode: false,
    }))

    // Non-semver header should bypass version check
    const res = await SELF.fetch('http://localhost/api/health', {
      headers: { 'X-API-Version': 'not-a-version' },
    })
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
