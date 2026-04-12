import type { D1Database } from '@cloudflare/workers-types'
export { ROLE_LEVEL, hasRole } from '../../../shared/lib/constants'

export interface HouseholdContext {
  id: string
  name: string
  role: string
  ownerId: string
}

/**
 * Get (or create) the user's primary household.
 * Creates a personal household if none exists and migrates legacy cats (user_id set, household_id null).
 * Idempotent — safe to call on every authenticated request.
 */
export async function ensureHousehold(
  db: D1Database,
  userId: string,
): Promise<HouseholdContext> {
  const existing = await db.prepare(`
    SELECT hm.household_id as id, h.name, hm.role, h.owner_user_id as ownerId
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ? AND hm.status = 'active'
    ORDER BY hm.joined_at ASC
    LIMIT 1
  `).bind(userId).first<HouseholdContext>()

  if (existing) return existing

  // Create personal household
  const user = await db.prepare('SELECT display_name FROM users WHERE id = ?')
    .bind(userId).first<{ display_name: string | null }>()

  const name = ((user?.display_name?.trim()) || 'My') + "'s Cats"

  const created = await db.prepare(
    `INSERT INTO households (name, owner_user_id) VALUES (?, ?) RETURNING id`,
  ).bind(name, userId).first<{ id: string }>()

  const hId = created!.id

  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO household_members (household_id, user_id, role, status, joined_at)
       VALUES (?, ?, 'admin', 'active', datetime('now'))`,
    ).bind(hId, userId),
    db.prepare(
      `UPDATE cats SET household_id = ? WHERE user_id = ? AND household_id IS NULL`,
    ).bind(hId, userId),
  ])

  return { id: hId, name, role: 'admin', ownerId: userId }
}

/**
 * Returns the effective role of userId for catId:
 * - 'admin' if the cat is a legacy cat (user_id = userId, household_id IS NULL)
 * - the member's household role otherwise
 * - null if the user has no access
 */
export async function getCatRole(
  db: D1Database,
  catId: string,
  userId: string,
): Promise<string | null> {
  // Legacy path: cat owned directly by user with no household yet
  const legacy = await db.prepare(
    `SELECT 'admin' as role FROM cats WHERE id = ? AND user_id = ? AND household_id IS NULL`,
  ).bind(catId, userId).first<{ role: string }>()
  if (legacy) return 'admin'

  // Household path
  const row = await db.prepare(`
    SELECT hm.role
    FROM cats c
    JOIN household_members hm ON hm.household_id = c.household_id
    WHERE c.id = ? AND hm.user_id = ? AND hm.status = 'active'
  `).bind(catId, userId).first<{ role: string }>()
  return row?.role ?? null
}
