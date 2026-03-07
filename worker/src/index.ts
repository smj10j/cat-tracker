import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requireAuth } from './middleware/auth'
import authRoutes from './routes/auth'
import cats from './routes/cats'
import measurements from './routes/measurements'
import importRoute from './routes/import'

const app = new Hono<AppEnv>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

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
