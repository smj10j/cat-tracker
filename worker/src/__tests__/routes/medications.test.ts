import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

// Helper: create a cat and return its ID
async function createCat(session: string, name = 'Luna'): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/cats', {
    method: 'POST',
    headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, birthdate: '2022-01-01' }),
  })
  const data = await res.json() as { id: string }
  return data.id
}

describe('POST /api/medications', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('creates a medication and generates doses', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Flea Prevention',
        type: 'flea',
        frequency: 'monthly',
        start_date: '2026-01-01',
        reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string; name: string }
    expect(med.name).toBe('Flea Prevention')

    // Check that doses were generated
    const doses = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM medication_doses WHERE medication_id = ?'
    ).bind(med.id).first<{ count: number }>()
    expect(doses!.count).toBeGreaterThan(0)
  })

  it('returns 400 for invalid frequency', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Test',
        type: 'other',
        frequency: 'invalid_freq',
        start_date: '2026-01-01',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: 'any',
        name: 'Test',
        frequency: 'daily',
        start_date: '2026-01-01',
      }),
    })
    expect(res.status).toBe(401)
  })

  it('accepts as_needed frequency without generating doses', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Gabapentin (PRN)',
        type: 'pill',
        frequency: 'as_needed',
        start_date: '2026-01-01',
        notes: 'Give if hiding or limping',
        // these should be stripped server-side for as_needed
        end_date: '2026-12-31',
        doses_total: 30,
        doses_remaining: 5,
        refill_alert_threshold: 2,
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as {
      id: string; frequency: string; end_date: string | null;
      doses_total: number | null; doses_remaining: number | null; refill_alert_threshold: number | null
    }
    expect(med.frequency).toBe('as_needed')
    expect(med.end_date).toBeNull()
    expect(med.doses_total).toBeNull()
    expect(med.doses_remaining).toBeNull()
    expect(med.refill_alert_threshold).toBeNull()

    const doses = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM medication_doses WHERE medication_id = ?'
    ).bind(med.id).first<{ count: number }>()
    expect(doses!.count).toBe(0)
  })
})

describe('GET /api/notifications', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns categorized notification inbox', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/notifications', {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as {
      overdue: unknown[]; due_today: unknown[]; upcoming: unknown[]; refill_alerts: unknown[]
    }
    expect(Array.isArray(data.overdue)).toBe(true)
    expect(Array.isArray(data.due_today)).toBe(true)
    expect(Array.isArray(data.upcoming)).toBe(true)
    expect(Array.isArray(data.refill_alerts)).toBe(true)
  })
})

describe('PUT /api/medications/:id', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('updates a medication and regenerates future doses', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Create medication
    const createRes = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Test Med',
        type: 'pill',
        frequency: 'daily',
        start_date: '2026-01-01',
        reminder_time: '09:00',
      }),
    })
    const med = await createRes.json() as { id: string }

    // Update name
    const updateRes = await SELF.fetch(`http://localhost/api/medications/${med.id}`, {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Med' }),
    })
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json() as { name: string }
    expect(updated.name).toBe('Updated Med')
  })
})

describe('Timezone-aware dose generation', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('generates UTC due_at values when user has timezone set', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Set user timezone first
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('America/New_York', user.id).run()

    // Create medication with 9 AM reminder
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Morning Med',
        type: 'pill',
        frequency: 'daily',
        start_date: '2026-01-15',
        reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string }

    // Check that due_at is in UTC (9 AM EST = 14:00 UTC)
    const dose = await env.DB.prepare(
      "SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE '2026-01-15%'"
    ).bind(med.id).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe('2026-01-15 14:00:00')
  })

  it('generates naive due_at when user has no timezone', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // No timezone set — should use naive format
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Morning Med',
        type: 'pill',
        frequency: 'daily',
        start_date: '2026-01-15',
        reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string }

    // Due_at should be naive local time
    const dose = await env.DB.prepare(
      "SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE '2026-01-15%'"
    ).bind(med.id).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe('2026-01-15 09:00:00')
  })
})
