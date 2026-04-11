import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

describe('GET /api/config', () => {
  beforeEach(async () => {
    // Clear any existing config from KV
    await env.CONFIG_KV.delete('app_config')
  })

  it('returns defaults when KV is empty', async () => {
    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.minSupportedVersion).toBe('1.0.0')
    expect(body.latestVersion).toBe('1.0.0')
    expect(body.maintenanceMode).toBe(false)
    expect(body.maintenanceMessage).toBeNull()
    expect(body.thresholds).toBeNull()
    const features = body.features as Record<string, boolean>
    expect(features.pushNotificationsEnabled).toBe(false)
    expect(features.appleSignInEnabled).toBe(true)
    expect(features.streaksEnabled).toBe(false)
    expect(features.aiNarrativeEnabled).toBe(false)
  })

  it('returns KV blob when populated with valid config', async () => {
    const customConfig = {
      minSupportedVersion: '1.1.0',
      latestVersion: '1.2.0',
      features: {
        pushNotificationsEnabled: true,
        appleSignInEnabled: true,
        streaksEnabled: true,
        aiNarrativeEnabled: false,
      },
      thresholds: null,
      maintenanceMode: false,
      maintenanceMessage: null,
    }
    await env.CONFIG_KV.put('app_config', JSON.stringify(customConfig))

    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.minSupportedVersion).toBe('1.1.0')
    expect(body.latestVersion).toBe('1.2.0')
    const features = body.features as Record<string, boolean>
    expect(features.pushNotificationsEnabled).toBe(true)
    expect(features.streaksEnabled).toBe(true)
  })

  it('includes Cache-Control header with max-age=300', async () => {
    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const cacheControl = res.headers.get('Cache-Control')
    expect(cacheControl).toContain('max-age=300')
    expect(cacheControl).toContain('stale-while-revalidate=600')
  })

  it('falls back to defaults when KV blob is missing required fields', async () => {
    // Object missing 'features' field
    await env.CONFIG_KV.put('app_config', JSON.stringify({ minSupportedVersion: '2.0.0' }))

    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    // Should return defaults, not the partial blob
    expect(body.minSupportedVersion).toBe('1.0.0')
    expect(body.features).toBeDefined()
  })

  it('falls back to defaults when thresholds have invalid values', async () => {
    const badConfig = {
      minSupportedVersion: '1.0.0',
      latestVersion: '1.0.0',
      features: { pushNotificationsEnabled: false, appleSignInEnabled: true, streaksEnabled: false, aiNarrativeEnabled: false },
      thresholds: {
        weightLoss: {
          urgentPctPerWeek: 1.0, // urgent < concerning — invalid!
          concerningPctPerWeek: 2.0,
          watchPctPerWeek: 0.5,
        },
      },
      maintenanceMode: false,
      maintenanceMessage: null,
    }
    await env.CONFIG_KV.put('app_config', JSON.stringify(badConfig))

    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    // Should return defaults due to invalid thresholds
    expect(body.minSupportedVersion).toBe('1.0.0')
    expect(body.thresholds).toBeNull()
  })

  it('does not require authentication', async () => {
    // No session cookie, no Authorization header — should still succeed
    const res = await SELF.fetch('http://localhost/api/config')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.minSupportedVersion).toBeDefined()
  })
})
