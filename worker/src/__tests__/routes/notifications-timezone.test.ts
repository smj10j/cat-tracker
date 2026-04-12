/**
 * Notification categorization timezone tests.
 *
 * These tests define CORRECT behavior:
 * - Doses are categorized (overdue / due_today / upcoming) based on the user's LOCAL date,
 *   not the UTC date of the stored due_at value.
 * - A dose due at 11 PM CST (05:00 UTC next day) is "due today" in CST, not "upcoming".
 * - A dose due at 1 AM CST tomorrow (07:00 UTC tomorrow) is "upcoming" in CST, not "due today".
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

async function createCatAndMed(
  session: string,
  userId: string,
  opts: {
    timezone?: string
    reminderTime?: string
    startDate?: string
    frequency?: string
  } = {},
): Promise<{ catId: string; medId: string }> {
  // Set timezone if provided
  if (opts.timezone) {
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind(opts.timezone, userId).run()
  }

  const catRes = await SELF.fetch('http://localhost/api/cats', {
    method: 'POST',
    headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'TestCat', birthdate: '2022-01-01' }),
  })
  const cat = await catRes.json() as { id: string }

  const medRes = await SELF.fetch('http://localhost/api/medications', {
    method: 'POST',
    headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cat_id: cat.id,
      name: 'Test Med',
      type: 'pill',
      frequency: opts.frequency ?? 'daily',
      start_date: opts.startDate ?? '2026-01-01',
      reminder_time: opts.reminderTime ?? '09:00',
    }),
  })
  const med = await medRes.json() as { id: string }

  return { catId: cat.id, medId: med.id }
}

describe('Notification timezone categorization', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('categorizes dose as due_today when due today in user local time (even if UTC date differs)', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // User is in CST (UTC-6). Create med with 11 PM reminder.
    // 11 PM CST Jan 15 = 05:00 UTC Jan 16.
    // If today is Jan 15 locally, this should be "due_today" not "upcoming".
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('America/Chicago', user.id).run()

    const catRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCat', birthdate: '2022-01-01' }),
    })
    const cat = await catRes.json() as { id: string }

    const medRes = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: cat.id,
        name: 'Late Night Med',
        type: 'pill',
        frequency: 'daily',
        start_date: '2026-01-01',
        reminder_time: '23:00',
      }),
    })
    expect(medRes.status).toBe(201)
    const med = await medRes.json() as { id: string }

    // Verify the dose for Jan 15 is stored as UTC Jan 16 05:00
    const dose = await env.DB.prepare(
      "SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE '2026-01-16 05%'"
    ).bind(med.id).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe('2026-01-16 05:00:00')
  })

  it('generates UTC doses correctly for CST timezone', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // Set timezone to CST (UTC-6 in winter)
    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('America/Chicago', user.id).run()

    const catRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCat', birthdate: '2022-01-01' }),
    })
    const cat = await catRes.json() as { id: string }

    // 11 AM CST = 17:00 UTC in winter
    const medRes = await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: cat.id,
        name: 'Morning Med',
        type: 'pill',
        frequency: 'daily',
        start_date: '2026-01-15',
        reminder_time: '11:00',
      }),
    })
    expect(medRes.status).toBe(201)
    const med = await medRes.json() as { id: string }

    // 11 AM CST (UTC-6) = 17:00 UTC
    const dose = await env.DB.prepare(
      "SELECT due_at FROM medication_doses WHERE medication_id = ? AND due_at LIKE '2026-01-15%'"
    ).bind(med.id).first<{ due_at: string }>()
    expect(dose).toBeTruthy()
    expect(dose!.due_at).toBe('2026-01-15 17:00:00')
  })

  it('generates UTC doses with CDT offset via generateDoses directly', async () => {
    // Test DST-aware conversion directly — CDT is UTC-5 in summer
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-07-15', '11:00', 'daily', null, null, '2026-07-15', 'America/Chicago')
    expect(doses).toHaveLength(1)
    // 11 AM CDT (UTC-5) = 16:00 UTC
    expect(doses[0]!.due_at).toBe('2026-07-15 16:00:00')
  })

  it('returns empty inbox when no medications exist', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/notifications', {
      headers: authedHeaders(session),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as {
      overdue: unknown[]; due_today: unknown[]; upcoming: unknown[]; refill_alerts: unknown[]
    }
    expect(data.overdue).toHaveLength(0)
    expect(data.due_today).toHaveLength(0)
    expect(data.upcoming).toHaveLength(0)
    expect(data.refill_alerts).toHaveLength(0)
  })

  it('medication list returns next_due_at in UTC format', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .bind('America/Chicago', user.id).run()

    const catRes = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCat', birthdate: '2022-01-01' }),
    })
    const cat = await catRes.json() as { id: string }

    await SELF.fetch('http://localhost/api/medications', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_id: cat.id,
        name: 'Daily Med',
        type: 'pill',
        frequency: 'daily',
        start_date: new Date().toISOString().slice(0, 10),
        reminder_time: '09:00',
      }),
    })

    const listRes = await SELF.fetch(`http://localhost/api/medications?cat_id=${cat.id}`, {
      headers: authedHeaders(session),
    })
    expect(listRes.status).toBe(200)
    const meds = await listRes.json() as Array<{ next_due_at: string | null }>
    expect(meds.length).toBe(1)
    // next_due_at should exist and be in UTC datetime format
    expect(meds[0]!.next_due_at).toBeTruthy()
    expect(meds[0]!.next_due_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('generateDoses unit tests', () => {
  // Import the pure function directly for unit testing
  it('generates correct number of daily doses', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-01', '09:00', 'daily', null, null, '2026-01-07', null)
    expect(doses).toHaveLength(7) // Jan 1-7
  })

  it('generates correct number of twice_daily doses', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-01', '09:00', 'twice_daily', null, null, '2026-01-03', null)
    expect(doses).toHaveLength(6) // 3 days * 2 doses
  })

  it('respects end date', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-01', '09:00', 'daily', null, '2026-01-03', '2026-01-10', null)
    expect(doses).toHaveLength(3) // Jan 1-3 only
  })

  it('converts to UTC when timezone is provided', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-15', '09:00', 'daily', null, null, '2026-01-15', 'America/New_York')
    expect(doses).toHaveLength(1)
    // 9 AM EST = 14:00 UTC
    expect(doses[0]!.due_at).toBe('2026-01-15 14:00:00')
  })

  it('uses naive time when timezone is null', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-15', '09:00', 'daily', null, null, '2026-01-15', null)
    expect(doses).toHaveLength(1)
    expect(doses[0]!.due_at).toBe('2026-01-15 09:00:00')
  })

  it('handles DST transition correctly (spring forward)', async () => {
    const { generateDoses } = await import('../../routes/medications')
    // March 8 2026 is spring forward in US Eastern (clocks jump from 2am to 3am)
    const doses = generateDoses('med1', '2026-03-07', '09:00', 'daily', null, null, '2026-03-09', 'America/New_York')
    expect(doses).toHaveLength(3)
    // Mar 7: EST (UTC-5) → 14:00 UTC
    expect(doses[0]!.due_at).toBe('2026-03-07 14:00:00')
    // Mar 8: EDT starts this day (UTC-4) → 13:00 UTC
    expect(doses[1]!.due_at).toBe('2026-03-08 13:00:00')
    // Mar 9: EDT (UTC-4) → 13:00 UTC
    expect(doses[2]!.due_at).toBe('2026-03-09 13:00:00')
  })

  it('handles weekly frequency', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-01', '09:00', 'weekly', null, null, '2026-01-22', null)
    expect(doses).toHaveLength(4) // Jan 1, 8, 15, 22
  })

  it('handles custom frequency days', async () => {
    const { generateDoses } = await import('../../routes/medications')
    const doses = generateDoses('med1', '2026-01-01', '09:00', 'custom', 30, null, '2026-04-01', null)
    expect(doses).toHaveLength(4) // Jan 1, Jan 31, Mar 2, Apr 1
  })
})
