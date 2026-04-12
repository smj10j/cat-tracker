import { getCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'
import type { AppEnv } from '../types'

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  // Dual-path auth: Bearer token (native app) or session cookie (web)
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const sessionId = bearerToken ?? getCookie(c, 'session')

  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401)

  const session = await c.env.DB.prepare(
    "SELECT user_id, device_fingerprint FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first<{ user_id: string; device_fingerprint: string | null }>()

  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  // SEC-10: Soft enforcement — log device fingerprint mismatches (no blocking yet)
  const currentDeviceId = c.req.header('X-Device-Id')
  if (session.device_fingerprint && currentDeviceId && session.device_fingerprint !== currentDeviceId) {
    console.warn(`SEC-10: Device fingerprint mismatch for session ${sessionId.slice(0, 8)}... ` +
      `stored=${session.device_fingerprint.slice(0, 16)} current=${currentDeviceId.slice(0, 16)}`)
  }

  // Rolling session: extend expiry by 7 days
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiry, sessionId).run()
  )

  c.set('userId', session.user_id)
  c.set('sessionId', sessionId)
  await next()
}
