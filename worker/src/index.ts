import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requireAuth } from './middleware/auth'
import authRoutes from './routes/auth'
import configRoutes from './routes/config'
import cats from './routes/cats'
import measurements from './routes/measurements'
import importRoute from './routes/import'
import journalRoute from './routes/journal'
import notificationPrefsRoute from './routes/notificationPrefs'
import medicationsRoute, {
  generateDoses, insertDoses, windowEnd90,
  generationWindowStart, effectiveAnchorStart, frequencyToDays,
  userLocalToday, userLocalHM, addDays,
} from './routes/medications'
import householdRoute, { householdPublic } from './routes/household'
import { sendExpoPushNotifications, getStaleTokens, type ExpoPushMessage } from './lib/push'
import { sendEmail } from './lib/email'
import { localToUTC, utcToLocal } from '../../shared/lib/dates'
import { inQuietHours } from '../../shared/lib/notifications'

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

/** Format a 24h 'HH:MM' local time as a compact 12h label ("9 AM", "8:30 PM")
 *  for digest push copy. Self-contained (no user prefs in the cron context). */
function formatDigestTime(hm: string): string {
  const h = parseInt(hm.slice(0, 2), 10)
  const m = parseInt(hm.slice(3, 5), 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

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
app.use('/api/notification-prefs', requireAuth)
app.use('/api/doses/*', requireAuth)
app.use('/api/journal/*', requireAuth)
app.use('/api/household', requireAuth)
app.use('/api/household/*', requireAuth)

app.route('/api/cats', cats)
app.route('/api', measurements)
app.route('/api', importRoute)
app.route('/api', journalRoute)
app.route('/api', notificationPrefsRoute)
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

      // Extend 90-day rolling dose window for all scheduled active medications
      // (PRN / 'as_needed' items have no schedule and are skipped)
      const activeMeds = await env.DB.prepare(
        `SELECT m.id, m.start_date, m.reminder_time, m.frequency, m.frequency_days, m.end_date,
                m.schedule_mode, u.timezone
         FROM medications m
         JOIN users u ON u.id = m.user_id
         WHERE m.is_active = 1 AND m.frequency != 'as_needed'`
      ).all<{
        id: string; start_date: string; reminder_time: string
        frequency: string; frequency_days: number | null; end_date: string | null
        schedule_mode: string | null; timezone: string | null
      }>()

      const window = windowEnd90()
      for (const med of activeMeds.results) {
        // 'interval' medications anchor to the last given dose — regenerating
        // from start_date would resurrect grid doses the re-anchor path removed.
        const anchor = await effectiveAnchorStart(env.DB, med, med.timezone)
        const doses = generateDoses(
          med.id, anchor, med.reminder_time,
          med.frequency, med.frequency_days, med.end_date, window,
          med.timezone,
          generationWindowStart(med.frequency, med.frequency_days, med.timezone),
        )
        await insertDoses(env.DB, doses)

        // Overdue hygiene: unresolved doses older than max(2 intervals, 7 days)
        // become 'missed' — kept in history, dropped from the overdue inbox.
        const intervalDays = frequencyToDays(med.frequency, med.frequency_days)
        const cutoffDays = Math.max(2 * intervalDays, 7)
        const cutoff = new Date(Date.now() - cutoffDays * 86400000)
          .toISOString().replace('T', ' ').slice(0, 19)
        await env.DB.prepare(
          `UPDATE medication_doses SET missed = 1
           WHERE medication_id = ? AND administered_at IS NULL AND skipped = 0 AND missed = 0
             AND due_at < ?`
        ).bind(med.id, cutoff).run()
      }

      // --- Push notifications for doses due this hour ---
      const now = new Date()
      const hourStart = `${now.toISOString().slice(0, 13)}:00:00`.replace('T', ' ')
      const nextHour = new Date(now)
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      const hourEnd = `${nextHour.toISOString().slice(0, 13)}:00:00`.replace('T', ' ')
      const nowStr = now.toISOString().replace('T', ' ').slice(0, 19)

      // Find doses that need a push now: either due in this hour window and not
      // snoozed, or previously snoozed with the snooze now elapsed (WP4g). The
      // two branches are mutually exclusive (snoozed_until null vs. not-null) so
      // no dose is picked up twice.
      const dueDoses = await env.DB.prepare(`
        SELECT d.id AS dose_id, d.due_at,
               m.name AS med_name, m.user_id,
               c.name AS cat_name, c.id AS cat_id
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        JOIN cats c ON c.id = m.cat_id
        WHERE d.administered_at IS NULL
          AND d.skipped = 0
          AND d.missed = 0
          AND d.notification_sent_at IS NULL
          AND m.is_active = 1
          AND NOT EXISTS (
            SELECT 1 FROM care_item_mutes cm
            WHERE cm.user_id = m.user_id AND cm.medication_id = m.id
          )
          AND (
            (d.snoozed_until IS NULL AND d.due_at >= ? AND d.due_at < ?)
            OR (d.snoozed_until IS NOT NULL AND d.snoozed_until <= ?)
          )
      `).bind(hourStart, hourEnd, nowStr).all<{
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

          // Actionable category: a grouped push (multiple doses) offers
          // "Mark all given"; a single dose offers "Mark given" (WP4g).
          const categoryId = group.dose_ids.length > 1 ? 'care_dose_group' : 'care_dose'
          for (const token of tokens) {
            messages.push({
              to: token,
              title: `Reminder: ${group.cat_name}`,
              body: `Time to give ${medList}`,
              sound: 'default',
              categoryId,
              data: { catId: group.cat_id, url: `/cats/${group.cat_id}`, doseIds: group.dose_ids },
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

      // --- Single 24h follow-up push for still-unresolved doses (WP4b) ---
      // Fires once per dose (followup_sent_at marker); 48h lookback cap so a
      // deploy never mass-notifies historic backlog. Excludes muted items and
      // DEFERS (never drops) for users currently inside their quiet hours —
      // deferred doses keep followup_sent_at NULL and re-attempt next hour.
      const followupStart = new Date(Date.now() - 48 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
      const followupEnd = new Date(Date.now() - 24 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
      const followupDoses = await env.DB.prepare(`
        SELECT d.id AS dose_id, m.name AS med_name, m.user_id,
               c.name AS cat_name, c.id AS cat_id,
               u.timezone, np.quiet_hours_start, np.quiet_hours_end
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        JOIN cats c ON c.id = m.cat_id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN notification_prefs np ON np.user_id = m.user_id
        WHERE d.due_at >= ? AND d.due_at < ?
          AND d.administered_at IS NULL AND d.skipped = 0 AND d.missed = 0
          AND d.notification_sent_at IS NOT NULL
          AND d.followup_sent_at IS NULL
          AND m.is_active = 1
          AND NOT EXISTS (
            SELECT 1 FROM care_item_mutes cm
            WHERE cm.user_id = m.user_id AND cm.medication_id = m.id
          )
      `).bind(followupStart, followupEnd).all<{
        dose_id: string; med_name: string; user_id: string; cat_name: string; cat_id: string
        timezone: string | null; quiet_hours_start: string | null; quiet_hours_end: string | null
      }>()

      // Drop doses whose owner is inside quiet hours right now — leave them
      // unmarked so a later (post-quiet-hours) pass delivers the follow-up.
      const deliverableFollowups = followupDoses.results.filter(d =>
        !inQuietHours(userLocalHM(d.timezone), d.quiet_hours_start, d.quiet_hours_end),
      )

      if (deliverableFollowups.length > 0) {
        const fuUserIds = [...new Set(deliverableFollowups.map(d => d.user_id))]
        const fuTokenRows = await env.DB.prepare(
          `SELECT token, user_id FROM device_tokens WHERE platform = 'ios'`
        ).all<{ token: string; user_id: string }>()
        const fuTokensByUser = new Map<string, string[]>()
        for (const row of fuTokenRows.results) {
          if (!fuUserIds.includes(row.user_id)) continue
          fuTokensByUser.set(row.user_id, [...(fuTokensByUser.get(row.user_id) ?? []), row.token])
        }

        const fuMessages: ExpoPushMessage[] = []
        const fuDoseIds: string[] = []
        for (const dose of deliverableFollowups) {
          const tokens = fuTokensByUser.get(dose.user_id)
          fuDoseIds.push(dose.dose_id) // mark even without tokens — one follow-up chance, then done
          if (!tokens) continue
          for (const token of tokens) {
            fuMessages.push({
              to: token,
              title: `Still due: ${dose.cat_name}`,
              body: `${dose.med_name} from yesterday hasn't been marked given`,
              sound: 'default',
              data: { catId: dose.cat_id, url: `/notifications` },
            })
          }
        }
        if (fuMessages.length > 0) await sendExpoPushNotifications(fuMessages)
        for (let i = 0; i < fuDoseIds.length; i += 50) {
          const chunk = fuDoseIds.slice(i, i + 50)
          const placeholders = chunk.map(() => '?').join(',')
          await env.DB.prepare(
            `UPDATE medication_doses SET followup_sent_at = datetime('now') WHERE id IN (${placeholders})`
          ).bind(...chunk).run()
        }
      }

      // --- Morning daily digest (opt-in) (PRD-actionable-notifications Phase B) ---
      // For each user with the digest enabled and an iOS token, once their local
      // clock reaches digest_time (and not during quiet hours), send ONE summary
      // of items due today + carried-over overdue count. Silent when nothing's due.
      const digestCandidates = await env.DB.prepare(`
        SELECT np.user_id, np.digest_time, np.digest_last_sent_date,
               np.quiet_hours_start, np.quiet_hours_end, u.timezone
        FROM notification_prefs np
        JOIN users u ON u.id = np.user_id
        WHERE np.digest_enabled = 1
          AND EXISTS (SELECT 1 FROM device_tokens t WHERE t.user_id = np.user_id AND t.platform = 'ios')
      `).all<{
        user_id: string; digest_time: string; digest_last_sent_date: string | null
        quiet_hours_start: string | null; quiet_hours_end: string | null; timezone: string | null
      }>()

      for (const cand of digestCandidates.results) {
        const localToday = userLocalToday(cand.timezone)
        if (cand.digest_last_sent_date === localToday) continue          // already sent today
        const localHM = userLocalHM(cand.timezone)
        const digestHour = parseInt(cand.digest_time.slice(0, 2), 10)
        const localHour = parseInt(localHM.slice(0, 2), 10)
        if (localHour < digestHour) continue                            // not yet digest time
        if (inQuietHours(localHM, cand.quiet_hours_start, cand.quiet_hours_end)) continue // defer

        // Doses from before today (overdue) through end of today, unresolved,
        // for this user's active meds, excluding muted items. One query splits
        // overdue (before local-day start) from due-today.
        const dayStartUTC = localToUTC(localToday, '00:00', cand.timezone ?? 'UTC')
        const dayEndUTC = localToUTC(addDays(localToday, 1), '00:00', cand.timezone ?? 'UTC')
        const items = await env.DB.prepare(`
          SELECT d.due_at, m.name AS med_name, c.name AS cat_name,
                 CASE WHEN d.due_at < ? THEN 1 ELSE 0 END AS is_overdue
          FROM medication_doses d
          JOIN medications m ON m.id = d.medication_id
          JOIN cats c ON c.id = m.cat_id
          WHERE m.user_id = ?
            AND m.is_active = 1
            AND d.administered_at IS NULL AND d.skipped = 0 AND d.missed = 0
            AND d.due_at < ?
            AND NOT EXISTS (
              SELECT 1 FROM care_item_mutes cm
              WHERE cm.user_id = m.user_id AND cm.medication_id = m.id
            )
          ORDER BY d.due_at ASC
        `).bind(dayStartUTC, cand.user_id, dayEndUTC).all<{
          due_at: string; med_name: string; cat_name: string; is_overdue: number
        }>()

        const dueToday = items.results.filter(r => r.is_overdue === 0)
        const overdueCount = items.results.filter(r => r.is_overdue === 1).length
        if (dueToday.length === 0 && overdueCount === 0) continue        // silence is the feature

        // Cat names for the title: from due-today items, else from overdue.
        const catSource = dueToday.length > 0 ? dueToday : items.results
        const catNames = [...new Set(catSource.map(r => r.cat_name))]
        const catsLabel = catNames.length === 1
          ? catNames[0]!
          : catNames.slice(0, -1).join(', ') + ' and ' + catNames[catNames.length - 1]!

        let title: string
        let body: string
        if (dueToday.length > 0) {
          title = `${dueToday.length} care item${dueToday.length > 1 ? 's' : ''} due today for ${catsLabel}`
          const shown = dueToday.slice(0, 6).map(r => {
            const t = utcToLocal(r.due_at, cand.timezone ?? 'UTC').time
            return `${r.med_name} at ${formatDigestTime(t)}`
          })
          const itemLine = shown.join(' · ') + (dueToday.length > 6 ? ` · +${dueToday.length - 6} more` : '')
          body = overdueCount > 0
            ? `${overdueCount} overdue · ${itemLine}`
            : itemLine
        } else {
          title = `${overdueCount} overdue care item${overdueCount > 1 ? 's' : ''} for ${catsLabel}`
          body = 'Tap to review overdue items'
        }

        const digestTokens = await env.DB.prepare(
          `SELECT token FROM device_tokens WHERE user_id = ? AND platform = 'ios'`
        ).bind(cand.user_id).all<{ token: string }>()
        const digestMessages: ExpoPushMessage[] = digestTokens.results.map(t => ({
          to: t.token, title, body, sound: 'default',
          data: { url: '/notifications' },
        }))
        if (digestMessages.length > 0) {
          await sendExpoPushNotifications(digestMessages)
        }
        // Mark sent for this user-local day (idempotency guard) regardless of
        // push-ticket outcome, so a cron retry within the hour can't double-send.
        await env.DB.prepare(
          `UPDATE notification_prefs SET digest_last_sent_date = ? WHERE user_id = ?`
        ).bind(localToday, cand.user_id).run()
      }

      // --- Email fallback for users with no push channel (Phase C, WP4d) ---
      // One digest per user per run. 1h grace gives push the first shot; 48h
      // lookback cap prevents mass-mailing backlog on first deploy.
      const emailStart = new Date(Date.now() - 48 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
      const emailEnd = new Date(Date.now() - 1 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
      const emailDoses = await env.DB.prepare(`
        SELECT d.id AS dose_id, d.due_at, m.name AS med_name, m.user_id,
               c.name AS cat_name, u.email, u.display_name
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        JOIN cats c ON c.id = m.cat_id
        JOIN users u ON u.id = m.user_id
        WHERE d.due_at >= ? AND d.due_at < ?
          AND d.administered_at IS NULL AND d.skipped = 0 AND d.missed = 0
          AND d.notification_sent_at IS NULL
          AND d.email_sent_at IS NULL
          AND (d.snoozed_until IS NULL OR d.snoozed_until <= ?)
          AND m.is_active = 1
          AND u.email_reminders = 1
          AND NOT EXISTS (SELECT 1 FROM device_tokens t WHERE t.user_id = m.user_id)
      `).bind(emailStart, emailEnd, nowStr).all<{
        dose_id: string; due_at: string; med_name: string; user_id: string
        cat_name: string; email: string; display_name: string | null
      }>()

      if (emailDoses.results.length > 0) {
        const byUser = new Map<string, typeof emailDoses.results>()
        for (const d of emailDoses.results) {
          byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d])
        }
        for (const [, doses] of byUser) {
          const first = doses[0]!
          const lines = doses.map(d => `• ${d.cat_name} — ${d.med_name} (was due ${d.due_at} UTC)`)
          try {
            await sendEmail({
              to: first.email,
              toName: first.display_name ?? undefined,
              subject: `Care reminder: ${doses.length === 1 ? `${first.cat_name}'s ${first.med_name}` : `${doses.length} items need attention`}`,
              text: `The following care items haven't been marked given:\n\n${lines.join('\n')}\n\nOpen Whisker Health to mark them given or dismiss them:\nhttps://cat-tracker.pages.dev/notifications`,
            }, env.RESEND_API_KEY)
            // Mark only after a successful send so failures retry next hour
            const ids = doses.map(d => d.dose_id)
            const placeholders = ids.map(() => '?').join(',')
            await env.DB.prepare(
              `UPDATE medication_doses SET email_sent_at = datetime('now') WHERE id IN (${placeholders})`
            ).bind(...ids).run()
          } catch {
            // Resend failure — leave email_sent_at NULL, retried next run
          }
        }
      }
    })())
  },
}
