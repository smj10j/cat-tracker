import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requireAuth } from './middleware/auth'
import authRoutes from './routes/auth'
import cats from './routes/cats'
import measurements from './routes/measurements'
import importRoute from './routes/import'

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
  allowHeaders: ['Content-Type'],
}))

// SEC-03: Security headers on every API response.
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Auth routes (login/callback/logout/me — no auth middleware on login/callback)
app.route('/api', authRoutes)

// Protected routes
app.use('/api/cats/*', requireAuth)
app.use('/api/measurements/*', requireAuth)
app.use('/api/import', requireAuth)

app.route('/api/cats', cats)
app.route('/api', measurements)
app.route('/api', importRoute)

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    // Clean up expired sessions daily
    ctx.waitUntil(
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
    )
  },
}
