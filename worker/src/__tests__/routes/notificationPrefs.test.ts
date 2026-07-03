import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { env, SELF, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

// The cron sends real Expo pushes; mock the transport so the scheduled handler
// runs offline and we can inspect what would have been sent.
import { sendExpoPushNotifications } from '../../lib/push'
vi.mock('../../lib/push', () => ({
  sendExpoPushNotifications: vi.fn(async () => []),
  getStaleTokens: vi.fn(() => []),
}))
import worker from '../../index'

const jsonHeaders = (session: string) => ({ ...authedHeaders(session), 'Content-Type': 'application/json' })

async function makeCat(session: string, name = 'Peanut'): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/cats', {
    method: 'POST', headers: jsonHeaders(session),
    body: JSON.stringify({ name, birthdate: '2020-01-01' }),
  })
  return (await res.json() as { id: string }).id
}

async function makeMed(session: string, catId: string, name = 'Methimazole'): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/medications', {
    method: 'POST', headers: jsonHeaders(session),
    body: JSON.stringify({ cat_id: catId, name, frequency: 'daily', reminder_time: '09:00', start_date: '2026-01-01' }),
  })
  return (await res.json() as { id: string }).id
}

describe('Notification prefs — GET/PUT', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns defaults when no row exists', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const res = await SELF.fetch('http://localhost/api/notification-prefs', { headers: authedHeaders(session) })
    expect(res.status).toBe(200)
    const prefs = await res.json() as Record<string, unknown>
    expect(prefs.digest_enabled).toBe(0)
    expect(prefs.digest_time).toBe('08:00')
    expect(prefs.quiet_hours_start).toBeNull()
  })

  it('upserts digest + quiet-hours fields and reads them back', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const put = await SELF.fetch('http://localhost/api/notification-prefs', {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ digest_enabled: true, digest_time: '07:30', quiet_hours_start: '22:00', quiet_hours_end: '07:00' }),
    })
    expect(put.status).toBe(200)
    const prefs = await (await SELF.fetch('http://localhost/api/notification-prefs', { headers: authedHeaders(session) })).json() as Record<string, unknown>
    expect(prefs.digest_enabled).toBe(1)
    expect(prefs.digest_time).toBe('07:30')
    expect(prefs.quiet_hours_start).toBe('22:00')
    expect(prefs.quiet_hours_end).toBe('07:00')
  })

  it('a partial PUT preserves untouched fields', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    await SELF.fetch('http://localhost/api/notification-prefs', {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ digest_enabled: true, digest_time: '06:15' }),
    })
    await SELF.fetch('http://localhost/api/notification-prefs', {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ quiet_hours_start: '23:00', quiet_hours_end: '08:00' }),
    })
    const prefs = await (await SELF.fetch('http://localhost/api/notification-prefs', { headers: authedHeaders(session) })).json() as Record<string, unknown>
    expect(prefs.digest_time).toBe('06:15')       // preserved
    expect(prefs.digest_enabled).toBe(1)          // preserved
    expect(prefs.quiet_hours_start).toBe('23:00') // new
  })

  it('clears quiet hours when passed null', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    await SELF.fetch('http://localhost/api/notification-prefs', {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ quiet_hours_start: '22:00', quiet_hours_end: '07:00' }),
    })
    await SELF.fetch('http://localhost/api/notification-prefs', {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ quiet_hours_start: null, quiet_hours_end: null }),
    })
    const prefs = await (await SELF.fetch('http://localhost/api/notification-prefs', { headers: authedHeaders(session) })).json() as Record<string, unknown>
    expect(prefs.quiet_hours_start).toBeNull()
    expect(prefs.quiet_hours_end).toBeNull()
  })

  it('rejects a malformed digest_time', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    for (const bad of ['7:30', '24:00', 'morning', '07:60']) {
      const res = await SELF.fetch('http://localhost/api/notification-prefs', {
        method: 'PUT', headers: jsonHeaders(session),
        body: JSON.stringify({ digest_time: bad }),
      })
      expect(res.status).toBe(400)
    }
  })
})

describe('Care-item mute — PUT + medication flag', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('mutes and unmutes a care item and reflects it on the medication', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const medId = await makeMed(session, catId)

    // starts unmuted
    let meds = await (await SELF.fetch('http://localhost/api/medications', { headers: authedHeaders(session) })).json() as Array<{ id: string; muted: number }>
    expect(meds.find(m => m.id === medId)!.muted).toBe(0)

    const mute = await SELF.fetch(`http://localhost/api/medications/${medId}/mute`, {
      method: 'PUT', headers: jsonHeaders(session), body: JSON.stringify({ muted: true }),
    })
    expect(mute.status).toBe(200)
    meds = await (await SELF.fetch('http://localhost/api/medications', { headers: authedHeaders(session) })).json() as Array<{ id: string; muted: number }>
    expect(meds.find(m => m.id === medId)!.muted).toBe(1)

    // detail endpoint reflects it too
    const detail = await (await SELF.fetch(`http://localhost/api/medications/${medId}`, { headers: authedHeaders(session) })).json() as { muted: number }
    expect(detail.muted).toBe(1)

    // unmute
    await SELF.fetch(`http://localhost/api/medications/${medId}/mute`, {
      method: 'PUT', headers: jsonHeaders(session), body: JSON.stringify({ muted: false }),
    })
    meds = await (await SELF.fetch('http://localhost/api/medications', { headers: authedHeaders(session) })).json() as Array<{ id: string; muted: number }>
    expect(meds.find(m => m.id === medId)!.muted).toBe(0)
  })

  it('rejects a non-boolean muted and a stranger cat with 400/404', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const medId = await makeMed(session, catId)

    const bad = await SELF.fetch(`http://localhost/api/medications/${medId}/mute`, {
      method: 'PUT', headers: jsonHeaders(session), body: JSON.stringify({ muted: 'yes' }),
    })
    expect(bad.status).toBe(400)

    const stranger = await seedUser({ id: 'user-2', email: 's@example.com', oauth_id: 'google-456' })
    const strangerSession = await seedSession(stranger.id, 'session-2')
    const notFound = await SELF.fetch(`http://localhost/api/medications/${medId}/mute`, {
      method: 'PUT', headers: jsonHeaders(strangerSession), body: JSON.stringify({ muted: true }),
    })
    expect(notFound.status).toBe(404)
  })
})

describe('Morning digest cron (Phase B)', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => {
    await clearDb()
    vi.mocked(sendExpoPushNotifications).mockClear()
  })

  // Seed a user (UTC) with a device token, digest enabled at 00:00 (so the local
  // hour is always past digest time), and one dose due today.
  async function seedDigestUser(opts: { muted?: boolean } = {}): Promise<{ userId: string; today: string }> {
    const user = await seedUser()
    await env.DB.prepare("UPDATE users SET timezone = 'UTC' WHERE id = ?").bind(user.id).run()
    await env.DB.prepare("INSERT INTO device_tokens (user_id, token, platform) VALUES (?, 'ExpoTok', 'ios')").bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO notification_prefs (user_id, digest_enabled, digest_time) VALUES (?, 1, '00:00')"
    ).bind(user.id).run()
    await env.DB.prepare("INSERT INTO cats (id, name, birthdate, user_id) VALUES ('cat-d', 'Peanut', '2020-01-01', ?)").bind(user.id).run()
    await env.DB.prepare(
      "INSERT INTO medications (id, cat_id, user_id, name, frequency, reminder_time, start_date) VALUES ('med-d', 'cat-d', ?, 'Fluids', 'as_needed', '09:00', '2026-01-01')"
    ).bind(user.id).run()
    const today = new Date().toISOString().slice(0, 10)
    await env.DB.prepare(
      "INSERT INTO medication_doses (id, medication_id, due_at) VALUES ('dose-d', 'med-d', ?)"
    ).bind(`${today} 09:00:00`).run()
    if (opts.muted) {
      await env.DB.prepare("INSERT INTO care_item_mutes (user_id, medication_id) VALUES (?, 'med-d')").bind(user.id).run()
    }
    return { userId: user.id, today }
  }

  async function runCron(): Promise<void> {
    const ctx = createExecutionContext()
    await worker.scheduled({ scheduledTime: Date.now(), cron: '0 * * * *', noRetry() {} } as unknown as ScheduledController, env, ctx)
    await waitOnExecutionContext(ctx)
  }

  function digestMessages(): Array<{ title: string; body: string }> {
    const calls = vi.mocked(sendExpoPushNotifications).mock.calls
    return calls.flatMap(c => c[0] as Array<{ title: string; body: string }>)
      .filter(m => /due today|overdue/.test(m.title))
  }

  it('sends a digest for items due today and marks it sent for the day', async () => {
    const { userId, today } = await seedDigestUser()
    await runCron()

    const msgs = digestMessages()
    expect(msgs.length).toBeGreaterThan(0)
    expect(msgs[0]!.title).toContain('due today for Peanut')
    expect(msgs[0]!.body).toContain('Fluids')

    const row = await env.DB.prepare('SELECT digest_last_sent_date FROM notification_prefs WHERE user_id = ?')
      .bind(userId).first<{ digest_last_sent_date: string }>()
    expect(row!.digest_last_sent_date).toBe(today)
  })

  it('does not send a second digest the same day (idempotent)', async () => {
    await seedDigestUser()
    await runCron()
    const first = digestMessages().length
    expect(first).toBeGreaterThan(0)
    vi.mocked(sendExpoPushNotifications).mockClear()
    await runCron()
    expect(digestMessages().length).toBe(0)
  })

  it('sends no digest when the only due item is muted (silence is the feature)', async () => {
    const { userId } = await seedDigestUser({ muted: true })
    await runCron()
    expect(digestMessages().length).toBe(0)
    const row = await env.DB.prepare('SELECT digest_last_sent_date FROM notification_prefs WHERE user_id = ?')
      .bind(userId).first<{ digest_last_sent_date: string | null }>()
    expect(row!.digest_last_sent_date).toBeNull()   // not marked — nothing was due
  })
})
