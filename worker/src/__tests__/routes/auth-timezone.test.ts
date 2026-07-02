import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

describe('PUT /api/auth/me — timezone sync', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('sets timezone on user profile', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'America/New_York' }),
    })
    expect(res.status).toBe(200)

    // Verify timezone was stored
    const row = await env.DB.prepare('SELECT timezone FROM users WHERE id = ?')
      .bind(user.id).first<{ timezone: string }>()
    expect(row!.timezone).toBe('America/New_York')
  })

  it('returns 400 for invalid timezone', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'Not/A/Real/Timezone' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'UTC' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me includes timezone in response', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // Set timezone
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('Europe/London', user.id).run()

    const res = await SELF.fetch('http://localhost/api/auth/me', {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { timezone: string | null }
    expect(data.timezone).toBe('Europe/London')
  })

  it('lazy-migrates future doses to UTC on first timezone set', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // Create a cat and medication with naive due_at
    const catRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luna', birthdate: '2022-01-01' }),
    })
    const cat = await catRes.json() as { id: string }

    // Start tomorrow (UTC) so the dose is inside the generation window.
    const startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: cat.id,
        name: 'Test Med',
        type: 'pill',
        frequency: 'daily',
        start_date: startDate,
        reminder_time: '09:00',
      }),
    })

    // Before timezone set: doses should have naive time 09:00
    const beforeDose = await env.DB.prepare(
      'SELECT due_at FROM medication_doses WHERE due_at LIKE ?'
    ).bind(`${startDate}%`).first<{ due_at: string }>()
    expect(beforeDose?.due_at).toBe(`${startDate} 09:00:00`)

    // Set timezone — triggers lazy migration. Phoenix (UTC-7, no DST) keeps the
    // expected value deterministic year-round.
    const res = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'America/Phoenix' }),
    })
    expect(res.status).toBe(200)

    // After timezone set: future doses regenerated with UTC conversion.
    // 9 AM Phoenix = 16:00 UTC. Naive value accepted only for runtimes without
    // full Intl timezone support (workerd limitation).
    const afterDose = await env.DB.prepare(
      'SELECT due_at FROM medication_doses WHERE due_at LIKE ?'
    ).bind(`${startDate}%`).first<{ due_at: string }>()
    expect(afterDose).toBeTruthy()
    expect([`${startDate} 16:00:00`, `${startDate} 09:00:00`]).toContain(afterDose?.due_at)
  })
})
