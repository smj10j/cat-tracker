import { getCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'
import type { AppEnv } from '../types'

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401)

  const session = await c.env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first<{ user_id: string }>()

  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  // Rolling session: extend expiry by 7 days
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiry, sessionId).run()
  )

  c.set('userId', session.user_id)
  await next()
}
