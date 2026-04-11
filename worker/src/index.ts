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

// API version middleware — reads X-API-Version header
app.use('/api/*', async (c, next) => {
  const version = c.req.header('X-API-Version') || 'latest'
  c.set('apiVersion', version)
  await next()
})

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

      // Expire stale pending invites
      await env.DB.prepare(
        `UPDATE household_members SET status = 'removed', invite_token_hash = NULL
         WHERE status = 'pending' AND invite_expires_at < datetime('now')`,
      ).run()

      // Extend 90-day rolling dose window for all active medications
      const activeMeds = await env.DB.prepare(
        `SELECT id, start_date, reminder_time, frequency, frequency_days, end_date
         FROM medications WHERE is_active = 1`
      ).all<{
        id: string; start_date: string; reminder_time: string
        frequency: string; frequency_days: number | null; end_date: string | null
      }>()

      const window = windowEnd90()
      for (const med of activeMeds.results) {
        const doses = generateDoses(
          med.id, med.start_date, med.reminder_time,
          med.frequency, med.frequency_days, med.end_date, window,
        )
        await insertDoses(env.DB, doses)
      }
    })())
  },
}
