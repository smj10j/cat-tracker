import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('GET /api/cats — auth', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns 401 without a session cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/cats')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an expired or nonexistent session', async () => {
    const res = await SELF.fetch('http://localhost/api/cats', {
      headers: { Cookie: 'session=invalid-session-id' },
    })
    expect(res.status).toBe(401)
  })
})

// ── GET /api/cats ─────────────────────────────────────────────────────────────

describe('GET /api/cats', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns an empty array for a new user', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(0)
  })

  it('returns cats belonging to the user\'s household', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // Create a cat
    await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luna', birthdate: '2020-01-01' }),
    })

    const res = await SELF.fetch('http://localhost/api/cats', {
      headers: authedHeaders(session),
    })
    const data = await res.json() as Array<{ name: string }>
    expect(data).toHaveLength(1)
    expect(data[0]?.name).toBe('Luna')
  })
})

// ── POST /api/cats ────────────────────────────────────────────────────────────

describe('POST /api/cats', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('creates a cat and returns 201', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luna', birthdate: '2020-01-01' }),
    })

    expect(res.status).toBe(201)
    const cat = await res.json() as { id: string; name: string; birthdate: string }
    expect(cat.id).toBeDefined()
    expect(cat.name).toBe('Luna')
    expect(cat.birthdate).toBe('2020-01-01')
  })

  it('accepts optional fields (breed, sex, notes)', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mochi',
        birthdate: '2021-06-15',
        breed: 'Tabby',
        sex: 'Female',
        notes: 'Loves treats',
      }),
    })

    expect(res.status).toBe(201)
    const cat = await res.json() as { breed: string; sex: string; notes: string }
    expect(cat.breed).toBe('Tabby')
    expect(cat.sex).toBe('Female')
    expect(cat.notes).toBe('Loves treats')
  })

  it('returns 400 when name is missing', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthdate: '2020-01-01' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when birthdate is missing', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luna' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name exceeds 200 characters', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a'.repeat(201), birthdate: '2020-01-01' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 when microchip_id is already taken', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const chip = 'CHIP123456789'

    await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cat A', birthdate: '2020-01-01', microchip_id: chip }),
    })

    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cat B', birthdate: '2020-01-01', microchip_id: chip }),
    })
    expect(res.status).toBe(409)
  })
})

// ── GET /api/cats/:id ─────────────────────────────────────────────────────────

describe('GET /api/cats/:id', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns the cat for the authenticated owner', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const createRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mochi', birthdate: '2021-01-01' }),
    })
    const cat = await createRes.json() as { id: string }

    const res = await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const fetched = await res.json() as { name: string }
    expect(fetched.name).toBe('Mochi')
  })

  it('returns 404 for a cat the user cannot access', async () => {
    const user1 = await seedUser({ id: 'u1', email: 'a@a.com', oauth_id: 'ga1' })
    const user2 = await seedUser({ id: 'u2', email: 'b@b.com', oauth_id: 'ga2' })
    const session1 = await seedSession(user1.id, 'sess1')
    const session2 = await seedSession(user2.id, 'sess2')

    const createRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session1), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Private Cat', birthdate: '2020-01-01' }),
    })
    const cat = await createRes.json() as { id: string }

    const res = await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      headers: authedHeaders(session2),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for a nonexistent cat id', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats/does-not-exist', {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(404)
  })
})

// ── PUT /api/cats/:id ─────────────────────────────────────────────────────────

describe('PUT /api/cats/:id', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('updates name and returns 200', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const createRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Old Name', birthdate: '2020-01-01' }),
    })
    const cat = await createRes.json() as { id: string }

    const res = await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const updated = await res.json() as { name: string }
    expect(updated.name).toBe('New Name')
  })

  it('returns 404 for a nonexistent cat', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/cats/no-such-cat', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anything' }),
    })
    expect(res.status).toBe(404)
  })
})

// ── DELETE /api/cats/:id ──────────────────────────────────────────────────────

describe('DELETE /api/cats/:id', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('deletes the cat and returns 200', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const createRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToDelete', birthdate: '2020-01-01' }),
    })
    const cat = await createRes.json() as { id: string }

    const deleteRes = await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      method: 'DELETE',
      headers: authedHeaders(session),
    })
    expect(deleteRes.status).toBe(200)

    // Confirm it's gone
    const getRes = await SELF.fetch(`http://localhost/api/cats/${cat.id}`, {
      headers: authedHeaders(session),
    })
    expect(getRes.status).toBe(404)
  })
})

describe('Health alert acknowledgment', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  async function makeCat(session: string, name = 'Luna'): Promise<string> {
    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthdate: '2020-01-01' }),
    })
    return (await res.json() as { id: string }).id
  }

  const ackBody = {
    severity: 'watch', direction: 'loss',
    note: 'Vet visit Thursday', latest_measured_at: '2026-07-01 00:00:00',
  }
  const ackHeaders = (session: string) => ({ ...authedHeaders(session), 'Content-Type': 'application/json' })

  it('acknowledges an alert and embeds it in GET /api/cats/:id and the list', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)

    const putRes = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(session), body: JSON.stringify(ackBody),
    })
    expect(putRes.status).toBe(200)
    const ack = await putRes.json() as { acknowledged_severity: string; status: string; acknowledged_by_name: string | null }
    expect(ack.acknowledged_severity).toBe('watch')
    expect(ack.status).toBe('active')

    const getRes = await SELF.fetch(`http://localhost/api/cats/${catId}`, { headers: authedHeaders(session) })
    const cat = await getRes.json() as { acknowledgment: { acknowledged_severity: string; note: string } | null }
    expect(cat.acknowledgment).not.toBeNull()
    expect(cat.acknowledgment!.acknowledged_severity).toBe('watch')
    expect(cat.acknowledgment!.note).toBe('Vet visit Thursday')

    const listRes = await SELF.fetch('http://localhost/api/cats', { headers: authedHeaders(session) })
    const list = await listRes.json() as Array<{ id: string; acknowledgment: unknown }>
    expect(list.find(c => c.id === catId)!.acknowledgment).not.toBeNull()
  })

  it('re-acknowledging supersedes the previous active ack (one active row)', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)

    await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(session), body: JSON.stringify(ackBody),
    })
    await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(session), body: JSON.stringify({ ...ackBody, severity: 'concerning' }),
    })
    const active = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM alert_acknowledgments WHERE cat_id = ? AND status = 'active'`
    ).bind(catId).first<{ n: number }>()
    expect(active!.n).toBe(1)
    const superseded = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM alert_acknowledgments WHERE cat_id = ? AND status = 'superseded'`
    ).bind(catId).first<{ n: number }>()
    expect(superseded!.n).toBe(1)
  })

  it('withdraw clears the active ack (embed null); 404 on second withdraw', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(session), body: JSON.stringify(ackBody),
    })
    const del = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment?kind=weight`, {
      method: 'DELETE', headers: authedHeaders(session),
    })
    expect(del.status).toBe(200)
    const getRes = await SELF.fetch(`http://localhost/api/cats/${catId}`, { headers: authedHeaders(session) })
    expect((await getRes.json() as { acknowledgment: unknown }).acknowledgment).toBeNull()
    const del2 = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment?kind=weight`, {
      method: 'DELETE', headers: authedHeaders(session),
    })
    expect(del2.status).toBe(404)
  })

  it('resolve is idempotent (200 with no active ack)', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment/resolve`, {
      method: 'POST', headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
  })

  it('rejects invalid severity with 400', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(session),
      body: JSON.stringify({ severity: 'catastrophic', direction: 'loss', latest_measured_at: '2026-07-01 00:00:00' }),
    })
    expect(res.status).toBe(400)
  })

  it("rejects another household's cat with 404", async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)

    const stranger = await seedUser({ id: 'user-2', email: 'stranger@example.com', oauth_id: 'google-456' })
    const strangerSession = await seedSession(stranger.id, 'session-2')
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/acknowledgment`, {
      method: 'PUT', headers: ackHeaders(strangerSession), body: JSON.stringify(ackBody),
    })
    expect(res.status).toBe(404)
  })
})
