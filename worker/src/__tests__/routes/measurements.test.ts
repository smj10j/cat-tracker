import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

// Helper: create a cat via API and return its id
async function createCat(session: string, name = 'Luna'): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/cats', {
    method: 'POST',
    headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, birthdate: '2020-01-01' }),
  })
  const cat = await res.json() as { id: string }
  return cat.id
}

// ── GET /api/cats/:id/measurements ───────────────────────────────────────────

describe('GET /api/cats/:id/measurements', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns an empty array when no measurements exist', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(0)
  })

  it('returns measurements filtered by type', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Add weight and food measurements
    await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10.5, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
    })
    await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'food', value: 2, unit: 'scale', measured_at: '2026-01-01T12:00:00Z' }),
    })

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements?type=weight`, {
      headers: authedHeaders(session),
    })
    const data = await res.json() as Array<{ type: string }>
    expect(data.every(m => m.type === 'weight')).toBe(true)
    expect(data).toHaveLength(1)
  })

  it('returns 404 for a cat the user cannot access', async () => {
    const user1 = await seedUser({ id: 'u1', email: 'a@a.com', oauth_id: 'ga1' })
    const user2 = await seedUser({ id: 'u2', email: 'b@b.com', oauth_id: 'ga2' })
    const session1 = await seedSession(user1.id, 'sess1')
    const session2 = await seedSession(user2.id, 'sess2')

    const catId = await createCat(session1)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      headers: authedHeaders(session2),
    })
    expect(res.status).toBe(404)
  })
})

// ── POST /api/cats/:id/measurements ──────────────────────────────────────────

describe('POST /api/cats/:id/measurements', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('creates a weight measurement and returns 201', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10.5, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
    })
    expect(res.status).toBe(201)
    const m = await res.json() as { type: string; value: number; unit: string }
    expect(m.type).toBe('weight')
    expect(m.value).toBe(10.5)
    expect(m.unit).toBe('lbs')
  })

  it('creates a behavioral (scale) measurement', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'food', value: 2, unit: 'scale', measured_at: '2026-01-01T12:00:00Z' }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 400 for an invalid measurement type', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'banana', value: 10, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid unit', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10, unit: 'meters', measured_at: '2026-01-01T12:00:00Z' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scale value is out of 0–3 range', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    for (const badVal of [-1, 4, 1.5]) {
      const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
        method: 'POST',
        headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'food', value: badVal, unit: 'scale', measured_at: '2026-01-01T12:00:00Z' }),
      })
      expect(res.status).toBe(400)
    }
  })

  it('returns 400 when weight value is non-positive or exceeds 200', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    for (const badVal of [0, -5, 201]) {
      const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
        method: 'POST',
        headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weight', value: badVal, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
      })
      expect(res.status).toBe(400)
    }
  })

  it('returns 400 when required fields are missing', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10 }), // missing unit and measured_at
    })
    expect(res.status).toBe(400)
  })

  it('stores an optional notes field', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'weight', value: 10.5, unit: 'lbs',
        measured_at: '2026-01-01T12:00:00Z', notes: 'After vet visit',
      }),
    })
    expect(res.status).toBe(201)
    const m = await res.json() as { notes: string }
    expect(m.notes).toBe('After vet visit')
  })

  it('returns 400 when notes exceed 1000 characters', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'weight', value: 10.5, unit: 'lbs',
        measured_at: '2026-01-01T12:00:00Z', notes: 'x'.repeat(1001),
      }),
    })
    expect(res.status).toBe(400)
  })
})

// ── DELETE /api/measurements/:id ──────────────────────────────────────────────

describe('DELETE /api/measurements/:id', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('deletes a measurement and returns 200', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const createRes = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10.5, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
    })
    const m = await createRes.json() as { id: string }

    const res = await SELF.fetch(`http://localhost/api/measurements/${m.id}`, {
      method: 'DELETE',
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when measurement does not exist', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/measurements/nonexistent-id', {
      method: 'DELETE',
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when trying to delete another user\'s measurement', async () => {
    const user1 = await seedUser({ id: 'u1', email: 'a@a.com', oauth_id: 'ga1' })
    const user2 = await seedUser({ id: 'u2', email: 'b@b.com', oauth_id: 'ga2' })
    const session1 = await seedSession(user1.id, 'sess1')
    const session2 = await seedSession(user2.id, 'sess2')

    const catId = await createCat(session1)
    const createRes = await SELF.fetch(`http://localhost/api/cats/${catId}/measurements`, {
      method: 'POST',
      headers: { ...authedHeaders(session1), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weight', value: 10.5, unit: 'lbs', measured_at: '2026-01-01T12:00:00Z' }),
    })
    const m = await createRes.json() as { id: string }

    // user2 tries to delete user1's measurement
    const res = await SELF.fetch(`http://localhost/api/measurements/${m.id}`, {
      method: 'DELETE',
      headers: authedHeaders(session2),
    })
    expect(res.status).toBe(404)
  })
})
