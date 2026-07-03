import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { isValidHM } from '../../../shared/lib/notifications'

const notificationPrefs = new Hono<AppEnv>()

interface PrefsRow {
  digest_enabled: number
  digest_time: string
  digest_last_sent_date: string | null
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  updated_at?: string
}

const DEFAULTS: PrefsRow = {
  digest_enabled: 0,
  digest_time: '08:00',
  digest_last_sent_date: null,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

// GET /api/notification-prefs — the caller's prefs, or defaults if none saved yet.
notificationPrefs.get('/notification-prefs', async (c) => {
  const userId = c.get('userId')
  const row = await c.env.DB.prepare(
    `SELECT digest_enabled, digest_time, digest_last_sent_date,
            quiet_hours_start, quiet_hours_end, updated_at
     FROM notification_prefs WHERE user_id = ?`
  ).bind(userId).first<PrefsRow>()
  return c.json(row ?? DEFAULTS)
})

// PUT /api/notification-prefs — upsert digest + quiet-hours fields.
// digest_last_sent_date is server-managed and never accepted from the client.
notificationPrefs.put('/notification-prefs', async (c) => {
  const userId = c.get('userId')
  type PrefsBody = {
    digest_enabled?: unknown
    digest_time?: unknown
    quiet_hours_start?: unknown
    quiet_hours_end?: unknown
  }
  const body = await c.req.json<PrefsBody>().catch(() => ({} as PrefsBody))

  // Load current (or defaults) so a partial PUT preserves untouched fields.
  const current = await c.env.DB.prepare(
    `SELECT digest_enabled, digest_time, digest_last_sent_date,
            quiet_hours_start, quiet_hours_end
     FROM notification_prefs WHERE user_id = ?`
  ).bind(userId).first<PrefsRow>() ?? DEFAULTS

  const next: PrefsRow = { ...current }

  if (body.digest_enabled !== undefined) {
    next.digest_enabled = (body.digest_enabled === true || body.digest_enabled === 1) ? 1 : 0
  }
  if (body.digest_time !== undefined) {
    if (typeof body.digest_time !== 'string' || !isValidHM(body.digest_time)) {
      return c.json({ error: 'digest_time must be HH:MM' }, 400)
    }
    next.digest_time = body.digest_time
  }
  // Quiet-hours bounds: a string must be valid HH:MM; null/'' clears the bound.
  for (const key of ['quiet_hours_start', 'quiet_hours_end'] as const) {
    if (body[key] === undefined) continue
    const v = body[key]
    if (v === null || v === '') { next[key] = null; continue }
    if (typeof v !== 'string' || !isValidHM(v)) {
      return c.json({ error: `${key} must be HH:MM or null` }, 400)
    }
    next[key] = v
  }

  await c.env.DB.prepare(
    `INSERT INTO notification_prefs
       (user_id, digest_enabled, digest_time, digest_last_sent_date,
        quiet_hours_start, quiet_hours_end, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id) DO UPDATE SET
       digest_enabled = excluded.digest_enabled,
       digest_time = excluded.digest_time,
       quiet_hours_start = excluded.quiet_hours_start,
       quiet_hours_end = excluded.quiet_hours_end,
       updated_at = excluded.updated_at`
  ).bind(
    userId, next.digest_enabled, next.digest_time, next.digest_last_sent_date,
    next.quiet_hours_start, next.quiet_hours_end,
  ).run()

  return c.json({
    digest_enabled: next.digest_enabled,
    digest_time: next.digest_time,
    digest_last_sent_date: next.digest_last_sent_date,
    quiet_hours_start: next.quiet_hours_start,
    quiet_hours_end: next.quiet_hours_end,
  })
})

export default notificationPrefs
