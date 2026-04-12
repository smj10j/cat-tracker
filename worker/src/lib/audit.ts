import type { Context } from 'hono'
import type { AppEnv } from '../types'

export type AuditAction =
  | 'sign_in'
  | 'sign_out'
  | 'account_deleted'
  | 'data_exported'
  | 'cat_deleted'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'

/**
 * Write an audit log entry. Best-effort — never throws.
 * Use waitUntil so it doesn't block the response.
 */
export function logAudit(
  c: Context<AppEnv>,
  action: AuditAction,
  metadata?: Record<string, unknown>,
): void {
  const userId = c.get('userId') ?? null
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null
  const ua = c.req.header('user-agent') ?? null
  const metaJson = metadata ? JSON.stringify(metadata) : null

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'INSERT INTO audit_log (user_id, action, ip_address, user_agent, metadata) VALUES (?, ?, ?, ?, ?)',
    ).bind(userId, action, ip, ua, metaJson).run().catch((err) => {
      console.error('Audit log write failed:', err)
    }),
  )
}

/**
 * Check rate limit for a user+action. Returns { allowed, retryAfterSeconds }.
 * Window is 1 hour. Max requests configurable (default 5).
 *
 * Uses increment-then-check to avoid TOCTOU race conditions:
 * the UPSERT atomically increments the counter, then we read the
 * resulting count. If over the limit, the request is rejected but
 * the counter stays incremented (harmless — it just means the next
 * valid request within the window also sees the overage).
 */
export async function checkRateLimit(
  db: D1Database,
  userId: string,
  action: string,
  maxPerHour = 5,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date()
  // Window start = top of the current hour
  const windowStart = new Date(now)
  windowStart.setMinutes(0, 0, 0)
  const windowStartStr = windowStart.toISOString().replace('T', ' ').slice(0, 19)

  // Atomically increment first, then check — eliminates TOCTOU race.
  // If two concurrent requests both UPSERT, D1 serializes the writes
  // so the count accurately reflects both.
  await db.prepare(
    `INSERT INTO rate_limits (user_id, action, window_start, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, action, window_start) DO UPDATE SET count = count + 1`,
  ).bind(userId, action, windowStartStr).run()

  // Now read the count (reflects all concurrent increments)
  const row = await db.prepare(
    'SELECT count FROM rate_limits WHERE user_id = ? AND action = ? AND window_start = ?',
  ).bind(userId, action, windowStartStr).first<{ count: number }>()

  const currentCount = row?.count ?? 0
  if (currentCount > maxPerHour) {
    const nextWindow = new Date(windowStart)
    nextWindow.setHours(nextWindow.getHours() + 1)
    const retryAfterSeconds = Math.ceil((nextWindow.getTime() - now.getTime()) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}
