import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requireAuth } from './middleware/auth'
import authRoutes from './routes/auth'
import configRoutes from './routes/config'
import cats from './routes/cats'
import measurements from './routes/measurements'
import importRoute from './routes/import'
import medicationsRoute, { generateDoses, insertDoses, windowEnd90 } from './routes/medications'
import householdRoute, { householdPublic } from './routes/household'
import { sendExpoPushNotifications, getStaleTokens, type ExpoPushMessage } from './lib/push'

const app = new Hono<AppEnv>()

// SEC-02: CORS locked to known origins only.
// In production all calls go through the same-origin Pages proxy, so CORS
// only matters for direct Worker URL access from a browser. SameSite=Lax
// cookies prevent CSRF regardless, but we lock origins as defense in depth.
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin // non-browser clients (curl, etc.) — pass through
    if (origin === 'https://cat-tracker.pages.dev') return origin
    if (origin.endsWith('.cat-tracker.pages.dev')) return origin // preview deployments
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin // local dev
    return null // block all other origins
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
}))

// SEC-03: Security headers on every API response.
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
})

// API version middleware — reads X-API-Version header, enforces minimum version, logs usage
app.use('/api/*', async (c, next) => {
  const version = c.req.header('X-API-Version') || 'latest'
  c.set('apiVersion', version)

  // 426 Upgrade Required enforcement: reject requests below minSupportedVersion
  // Only enforce on valid semver versions (not 'latest')
  if (version !== 'latest' && /^\d+\.\d+\.\d+$/.test(version)) {
    try {
      const cfg = await c.env.CONFIG_KV.get('app_config', 'json') as { minSupportedVersion?: string } | null
      const minVersion = cfg?.minSupportedVersion ?? '1.0.0'
      if (compareSemver(version, minVersion) < 0) {
        return c.json({
          error: 'Client version is too old. Please update to continue.',
          minSupportedVersion: minVersion,
          currentVersion: version,
        }, 426)
      }
    } catch {
      // KV read failure — don't block the request
    }
  }

  // Aggregate version logging to KV (daily bucket, best-effort)
  if (version !== 'latest') {
    const dateKey = new Date().toISOString().slice(0, 10)
    const logKey = `version_log:${dateKey}:${version}`
    c.executionCtx.waitUntil(
      c.env.CONFIG_KV.get(logKey).then(async (val) => {
        const count = parseInt(val ?? '0', 10) + 1
        await c.env.CONFIG_KV.put(logKey, String(count), { expirationTtl: 30 * 24 * 60 * 60 })
      }).catch(() => { /* best-effort */ }),
    )
  }

  await next()
})

/** Compare two semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
  }
  return 0
}

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Config route (no auth required) — must be registered BEFORE auth middleware
app.route('/api', configRoutes)

// Auth routes (login/callback/logout/me — no auth middleware on login/callback)
app.route('/api', authRoutes)

// Public household endpoints (no auth) — must be registered BEFORE auth guard
app.route('/api', householdPublic)

// Protected routes
app.use('/api/cats/*', requireAuth)
app.use('/api/measurements/*', requireAuth)
app.use('/api/import', requireAuth)
app.use('/api/medications', requireAuth)
app.use('/api/medications/*', requireAuth)
app.use('/api/notifications', requireAuth)
app.use('/api/doses/*', requireAuth)
app.use('/api/household', requireAuth)
app.use('/api/household/*', requireAuth)

app.route('/api/cats', cats)
app.route('/api', measurements)
app.route('/api', importRoute)
app.route('/api', medicationsRoute)
app.route('/api/household', householdRoute)

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      // Clean up expired sessions
      await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()

      // SEC-13: Clean up expired Apple token replay cache entries
      await env.DB.prepare("DELETE FROM apple_token_cache WHERE expires_at < datetime('now')").run()

      // SEC-15: Purge audit log entries older than 90 days
      await env.DB.prepare("DELETE FROM audit_log WHERE created_at < datetime('now', '-90 days')").run()

      // SEC-12: Purge rate limit entries older than 2 hours (stale windows)
      await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < datetime('now', '-2 hours')").run()

      // Expire stale pending invites
      await env.DB.prepare(
        `UPDATE household_members SET status = 'removed', invite_token_hash = NULL
         WHERE status = 'pending' AND invite_expires_at < datetime('now')`,
      ).run()

      // Extend 90-day rolling dose window for all active medications
      const activeMeds = await env.DB.prepare(
        `SELECT m.id, m.start_date, m.reminder_time, m.frequency, m.frequency_days, m.end_date,
                u.timezone
         FROM medications m
         JOIN users u ON u.id = m.user_id
         WHERE m.is_active = 1`
      ).all<{
        id: string; start_date: string; reminder_time: string
        frequency: string; frequency_days: number | null; end_date: string | null
        timezone: string | null
      }>()

      const window = windowEnd90()
      for (const med of activeMeds.results) {
        const doses = generateDoses(
          med.id, med.start_date, med.reminder_time,
          med.frequency, med.frequency_days, med.end_date, window,
          med.timezone,
        )
        await insertDoses(env.DB, doses)
      }

      // --- Push notifications for doses due this hour ---
      const now = new Date()
      const hourStart = `${now.toISOString().slice(0, 13)}:00:00`.replace('T', ' ')
      const nextHour = new Date(now)
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      const hourEnd = `${nextHour.toISOString().slice(0, 13)}:00:00`.replace('T', ' ')

      // Find doses due in this hour window that need notification
      const dueDoses = await env.DB.prepare(`
        SELECT d.id AS dose_id, d.due_at,
               m.name AS med_name, m.user_id,
               c.name AS cat_name, c.id AS cat_id
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        JOIN cats c ON c.id = m.cat_id
        WHERE d.due_at >= ? AND d.due_at < ?
          AND d.administered_at IS NULL
          AND d.skipped = 0
          AND d.notification_sent_at IS NULL
          AND m.is_active = 1
      `).bind(hourStart, hourEnd).all<{
        dose_id: string; due_at: string; med_name: string;
        user_id: string; cat_name: string; cat_id: string;
      }>()

      if (dueDoses.results.length > 0) {
        // Get device tokens for affected users
        const userIds = [...new Set(dueDoses.results.map(d => d.user_id))]
        const tokenRows = await env.DB.prepare(`
          SELECT token, user_id FROM device_tokens WHERE platform = 'ios'
        `).all<{ token: string; user_id: string }>()

        const tokensByUser = new Map<string, string[]>()
        for (const row of tokenRows.results) {
          if (!userIds.includes(row.user_id)) continue
          const tokens = tokensByUser.get(row.user_id) ?? []
          tokens.push(row.token)
          tokensByUser.set(row.user_id, tokens)
        }

        // Group doses by (user_id, cat_id) for one notification per cat
        const grouped = new Map<string, { cat_name: string; cat_id: string; user_id: string; med_names: string[]; dose_ids: string[] }>()
        for (const dose of dueDoses.results) {
          const key = `${dose.user_id}:${dose.cat_id}`
          const group = grouped.get(key) ?? { cat_name: dose.cat_name, cat_id: dose.cat_id, user_id: dose.user_id, med_names: [], dose_ids: [] }
          group.med_names.push(dose.med_name)
          group.dose_ids.push(dose.dose_id)
          grouped.set(key, group)
        }

        // Build push messages
        const messages: ExpoPushMessage[] = []
        const allDoseIds: string[] = []

        for (const group of grouped.values()) {
          const tokens = tokensByUser.get(group.user_id)
          if (!tokens || tokens.length === 0) continue

          const medList = group.med_names.length === 1
            ? group.med_names[0]!
            : group.med_names.slice(0, -1).join(', ') + ' and ' + group.med_names[group.med_names.length - 1]!

          for (const token of tokens) {
            messages.push({
              to: token,
              title: `Reminder: ${group.cat_name}`,
              body: `Time to give ${medList}`,
              sound: 'default',
              data: { catId: group.cat_id, url: `/cats/${group.cat_id}` },
            })
          }

          allDoseIds.push(...group.dose_ids)
        }

        // Send push notifications
        if (messages.length > 0) {
          const tickets = await sendExpoPushNotifications(messages)

          // Clean up stale tokens
          const stale = getStaleTokens(messages, tickets)
          for (const token of stale) {
            await env.DB.prepare('DELETE FROM device_tokens WHERE token = ?').bind(token).run()
          }
        }

        // Mark doses as notified for users who had tokens (users without tokens are skipped)
        if (allDoseIds.length > 0) {
          // Batch in chunks of 50 to stay within D1 limits
          for (let i = 0; i < allDoseIds.length; i += 50) {
            const chunk = allDoseIds.slice(i, i + 50)
            const placeholders = chunk.map(() => '?').join(',')
            await env.DB.prepare(
              `UPDATE medication_doses SET notification_sent_at = datetime('now') WHERE id IN (${placeholders})`
            ).bind(...chunk).run()
          }
        }
      }
    })())
  },
}
