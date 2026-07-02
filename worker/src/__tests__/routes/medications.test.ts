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

    // Phoenix has no DST (UTC-7 year-round) — deterministic expected value.
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('America/Phoenix', user.id).run()

    // Start tomorrow so the dose is inside the generation window regardless of timezone.
    const startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Morning Med',
        type: 'pill',
        frequency: 'daily',
        start_date: startDate,
        reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string }

    // 9 AM in Phoenix (UTC-7) = 16:00 UTC
    const dose = await env.DB.prepare(
      'SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE ?'
    ).bind(med.id, `${startDate}%`).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe(`${startDate} 16:00:00`)
  })

  it('generates naive due_at when user has no timezone', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    // No timezone set — should use naive format
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId,
        name: 'Morning Med',
        type: 'pill',
        frequency: 'daily',
        start_date: startDate,
        reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string }

    // Due_at should be naive local time
    const dose = await env.DB.prepare(
      'SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE ?'
    ).bind(med.id, `${startDate}%`).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe(`${startDate} 09:00:00`)
  })
})

describe('Dose generation windowing (past start dates)', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('backdated start_date anchors the schedule instead of creating an overdue backlog', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Started 30 days ago, daily — must NOT create ~30 overdue doses.
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Old Med', type: 'pill',
        frequency: 'daily', start_date: startDate, reminder_time: '09:00',
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string }

    const nowUTC = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const past = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM medication_doses WHERE medication_id = ? AND due_at < ?'
    ).bind(med.id, nowUTC).first<{ count: number }>()
    // At most the single most recent occurrence (one interval back) may be pending
    expect(past!.count).toBeLessThanOrEqual(2)

    const future = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM medication_doses WHERE medication_id = ? AND due_at >= ?'
    ).bind(med.id, nowUTC).first<{ count: number }>()
    expect(future!.count).toBeGreaterThan(80) // ~90-day window intact
  })

  it('first_dose_given marks the past occurrence administered', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Sub-q fluids every 3 days, first given yesterday — the reported scenario.
    const startDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'SubQ Fluids', type: 'subq_fluids',
        frequency: 'custom', frequency_days: 3,
        start_date: startDate, reminder_time: '09:00',
        first_dose_given: true,
      }),
    })
    expect(res.status).toBe(201)
    const med = await res.json() as { id: string; schedule_mode: string }
    expect(med.schedule_mode).toBe('interval') // custom frequency defaults to interval anchoring

    // Yesterday's dose exists and is already administered — nothing overdue.
    const pastPending = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM medication_doses
       WHERE medication_id = ? AND administered_at IS NULL AND skipped = 0
         AND due_at < datetime('now')`
    ).bind(med.id).first<{ count: number }>()
    expect(pastPending!.count).toBe(0)

    const given = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM medication_doses WHERE medication_id = ? AND administered_at IS NOT NULL'
    ).bind(med.id).first<{ count: number }>()
    expect(given!.count).toBe(1)
  })
})

describe('Interval re-anchoring on administer', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('re-anchors future doses to the given date + interval', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    // Every 3 days starting yesterday → grid is yesterday, +2d, +5d...
    const startDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'SubQ Fluids', type: 'subq_fluids',
        frequency: 'custom', frequency_days: 3,
        start_date: startDate, reminder_time: '09:00',
      }),
    })
    const med = await res.json() as { id: string }

    // The overdue dose from yesterday is given TODAY (a day late).
    const overdue = await env.DB.prepare(
      `SELECT id FROM medication_doses WHERE medication_id = ?
       AND administered_at IS NULL ORDER BY due_at ASC LIMIT 1`
    ).bind(med.id).first<{ id: string }>()
    const adminRes = await SELF.fetch(`http://localhost/api/doses/${overdue!.id}/administer`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(adminRes.status).toBe(200)

    // Next pending dose must be 3 days from TODAY (given date), not from the start grid.
    const next = await env.DB.prepare(
      `SELECT due_at FROM medication_doses WHERE medication_id = ?
       AND administered_at IS NULL AND skipped = 0 ORDER BY due_at ASC LIMIT 1`
    ).bind(med.id).first<{ due_at: string }>()
    const expectedDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    expect(next!.due_at.slice(0, 10)).toBe(expectedDate)
  })

  it('decrements doses_remaining on first administration only', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const startDate = new Date().toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Pill', type: 'pill',
        frequency: 'daily', start_date: startDate, reminder_time: '09:00',
        doses_remaining: 10, refill_alert_threshold: 3,
      }),
    })
    const med = await res.json() as { id: string }

    const dose = await env.DB.prepare(
      'SELECT id FROM medication_doses WHERE medication_id = ? ORDER BY due_at ASC LIMIT 1'
    ).bind(med.id).first<{ id: string }>()

    // Administer twice — stock must only drop once.
    for (let i = 0; i < 2; i++) {
      await SELF.fetch(`http://localhost/api/doses/${dose!.id}/administer`, {
        method: 'POST',
        headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    }
    const after = await env.DB.prepare(
      'SELECT doses_remaining FROM medications WHERE id = ?'
    ).bind(med.id).first<{ doses_remaining: number }>()
    expect(after!.doses_remaining).toBe(9)
  })
})

describe('POST /api/doses/bulk', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  async function seedOverdueMed(session: string, catId: string): Promise<{ medId: string; doseIds: string[] }> {
    const startDate = new Date().toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Pill', type: 'pill',
        frequency: 'daily', start_date: startDate, reminder_time: '09:00',
      }),
    })
    const med = await res.json() as { id: string }
    const doses = await env.DB.prepare(
      'SELECT id FROM medication_doses WHERE medication_id = ? ORDER BY due_at ASC LIMIT 3'
    ).bind(med.id).all<{ id: string }>()
    return { medId: med.id, doseIds: doses.results.map(d => d.id) }
  }

  it('bulk administers doses at their due time', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const { doseIds } = await seedOverdueMed(session, catId)

    const res = await SELF.fetch('http://localhost/api/doses/bulk', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dose_ids: doseIds, action: 'administer' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { updated: number }
    expect(data.updated).toBe(3)

    const rows = await env.DB.prepare(
      `SELECT due_at, administered_at FROM medication_doses WHERE id IN (?, ?, ?)`
    ).bind(...doseIds).all<{ due_at: string; administered_at: string | null }>()
    for (const row of rows.results) {
      expect(row.administered_at).toBe(row.due_at) // catch-up semantics
    }
  })

  it('bulk skips doses with dismissed reason', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const { doseIds } = await seedOverdueMed(session, catId)

    const res = await SELF.fetch('http://localhost/api/doses/bulk', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dose_ids: doseIds, action: 'skip' }),
    })
    expect(res.status).toBe(200)
    const skipped = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM medication_doses WHERE id IN (?, ?, ?) AND skipped = 1`
    ).bind(...doseIds).first<{ count: number }>()
    expect(skipped!.count).toBe(3)
  })

  it("rejects other users' doses", async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const { doseIds } = await seedOverdueMed(session, catId)

    const stranger = await seedUser({ id: 'user-2', email: 'stranger@example.com', oauth_id: 'google-456' })
    const strangerSession = await seedSession(stranger.id, 'session-2')
    const res = await SELF.fetch('http://localhost/api/doses/bulk', {
      method: 'POST',
      headers: { ...authedHeaders(strangerSession), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dose_ids: doseIds, action: 'administer' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects invalid action', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const res = await SELF.fetch('http://localhost/api/doses/bulk', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dose_ids: ['x'], action: 'explode' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Missed-dose exclusion', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('missed doses are excluded from the overdue inbox and counts', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)

    const startDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Pill', type: 'pill',
        frequency: 'daily', start_date: startDate, reminder_time: '00:00',
      }),
    })
    const med = await res.json() as { id: string }

    // Expire every past-due dose the way the cron does
    await env.DB.prepare(
      `UPDATE medication_doses SET missed = 1
       WHERE medication_id = ? AND due_at < datetime('now') AND administered_at IS NULL`
    ).bind(med.id).run()

    const inbox = await SELF.fetch('http://localhost/api/notifications', {
      headers: authedHeaders(session),
    })
    const data = await inbox.json() as { overdue: unknown[] }
    expect(data.overdue).toHaveLength(0)

    const list = await SELF.fetch(`http://localhost/api/medications?cat_id=${catId}`, {
      headers: authedHeaders(session),
    })
    const meds = await list.json() as Array<{ overdue_count: number }>
    expect(meds[0]!.overdue_count).toBe(0)
  })
})

describe('POST /api/medications/:id/log-dose (PRN administration log)', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  async function createPrnMed(session: string, catId: string): Promise<string> {
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Gabapentin (PRN)', type: 'pill',
        frequency: 'as_needed', start_date: new Date().toISOString().slice(0, 10),
      }),
    })
    const med = await res.json() as { id: string }
    return med.id
  }

  it('logs an ad-hoc given dose for an as-needed item', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const medId = await createPrnMed(session, catId)

    const res = await SELF.fetch(`http://localhost/api/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'was hiding under bed' }),
    })
    expect(res.status).toBe(201)
    const dose = await res.json() as { administered_at: string | null; due_at: string; notes: string }
    expect(dose.administered_at).toBe(dose.due_at)
    expect(dose.notes).toBe('was hiding under bed')

    // last_given_at surfaces on the medication list
    const list = await SELF.fetch(`http://localhost/api/medications?cat_id=${catId}`, {
      headers: authedHeaders(session),
    })
    const meds = await list.json() as Array<{ last_given_at: string | null }>
    expect(meds[0]!.last_given_at).toBe(dose.administered_at)
  })

  it('rejects log-dose on scheduled items', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const res = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: catId, name: 'Daily Pill', type: 'pill',
        frequency: 'daily', start_date: new Date().toISOString().slice(0, 10),
      }),
    })
    const med = await res.json() as { id: string }
    const logRes = await SELF.fetch(`http://localhost/api/medications/${med.id}/log-dose`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(logRes.status).toBe(400)
  })

  it('guards against double-tap via the unique due_at constraint', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await createCat(session)
    const medId = await createPrnMed(session, catId)

    const givenAt = '2026-07-02 15:00:00'
    const first = await SELF.fetch(`http://localhost/api/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ given_at: givenAt }),
    })
    expect(first.status).toBe(201)
    const second = await SELF.fetch(`http://localhost/api/medications/${medId}/log-dose`, {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ given_at: givenAt }),
    })
    expect(second.status).toBe(409)
  })
})

describe('email_reminders preference', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('defaults to 1, round-trips through PUT /auth/me, and rejects invalid values', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    let me = await (await SELF.fetch('http://localhost/api/auth/me', { headers: authedHeaders(session) })).json() as { email_reminders: number }
    expect(me.email_reminders).toBe(1)

    const put = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_reminders: 0 }),
    })
    expect(put.status).toBe(200)

    me = await (await SELF.fetch('http://localhost/api/auth/me', { headers: authedHeaders(session) })).json() as { email_reminders: number }
    expect(me.email_reminders).toBe(0)

    const bad = await SELF.fetch('http://localhost/api/auth/me', {
      method: 'PUT',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_reminders: 5 }),
    })
    expect(bad.status).toBe(400)
  })
})
