import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { ROLE_LEVEL, hasRole, ensureHousehold, getCatRole } from '../../lib/household'
import { applySchema, clearDb, seedUser } from '../helpers'

// ── ROLE_LEVEL ────────────────────────────────────────────────────────────────

describe('ROLE_LEVEL', () => {
  it('has four roles in ascending order', () => {
    expect(ROLE_LEVEL['viewer']).toBeLessThan(ROLE_LEVEL['contributor']!)
    expect(ROLE_LEVEL['contributor']).toBeLessThan(ROLE_LEVEL['editor']!)
    expect(ROLE_LEVEL['editor']).toBeLessThan(ROLE_LEVEL['admin']!)
  })
})

// ── hasRole ───────────────────────────────────────────────────────────────────

describe('hasRole', () => {
  it('returns true when role meets required level', () => {
    expect(hasRole('admin', 'viewer')).toBe(true)
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('editor', 'contributor')).toBe(true)
    expect(hasRole('contributor', 'contributor')).toBe(true)
  })

  it('returns false when role is below required level', () => {
    expect(hasRole('viewer', 'contributor')).toBe(false)
    expect(hasRole('viewer', 'admin')).toBe(false)
    expect(hasRole('contributor', 'editor')).toBe(false)
  })

  it('returns false for null or undefined role', () => {
    expect(hasRole(null, 'viewer')).toBe(false)
    expect(hasRole(undefined, 'viewer')).toBe(false)
  })

  it('returns false for unknown role strings', () => {
    expect(hasRole('superuser', 'viewer')).toBe(false)
    expect(hasRole('', 'viewer')).toBe(false)
  })
})

// ── ensureHousehold ───────────────────────────────────────────────────────────

describe('ensureHousehold', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('creates a household for a new user and returns admin context', async () => {
    const user = await seedUser({ display_name: 'Alice' })
    const ctx = await ensureHousehold(env.DB, user.id)

    expect(ctx.id).toBeDefined()
    expect(ctx.name).toBe("Alice's Cats")
    expect(ctx.role).toBe('admin')
    expect(ctx.ownerId).toBe(user.id)
  })

  it('is idempotent — returns same household on second call', async () => {
    const user = await seedUser()
    const ctx1 = await ensureHousehold(env.DB, user.id)
    const ctx2 = await ensureHousehold(env.DB, user.id)

    expect(ctx1.id).toBe(ctx2.id)
  })

  it('uses "My\'s Cats" fallback when display_name is null', async () => {
    const user = await seedUser()
    // Insert user without display_name
    await env.DB.prepare('UPDATE users SET display_name = NULL WHERE id = ?').bind(user.id).run()
    const ctx = await ensureHousehold(env.DB, user.id)
    expect(ctx.name).toBe("My's Cats")
  })

  it('migrates legacy cats (user_id set, household_id null) into the new household', async () => {
    const user = await seedUser()
    // Insert a legacy cat with user_id but no household_id
    await env.DB.prepare(
      `INSERT INTO cats (id, name, birthdate, user_id, household_id) VALUES ('cat-1', 'Mittens', '2020-01-01', ?, NULL)`
    ).bind(user.id).run()

    const ctx = await ensureHousehold(env.DB, user.id)
    const cat = await env.DB.prepare('SELECT household_id FROM cats WHERE id = ?')
      .bind('cat-1').first<{ household_id: string }>()
    expect(cat?.household_id).toBe(ctx.id)
  })
})

// ── getCatRole ────────────────────────────────────────────────────────────────

describe('getCatRole', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('returns "admin" for a legacy cat owned directly by the user', async () => {
    const user = await seedUser()
    await env.DB.prepare(
      `INSERT INTO cats (id, name, birthdate, user_id, household_id) VALUES ('cat-1', 'Mochi', '2020-01-01', ?, NULL)`
    ).bind(user.id).run()

    const role = await getCatRole(env.DB, 'cat-1', user.id)
    expect(role).toBe('admin')
  })

  it('returns the household role for a cat in a shared household', async () => {
    const owner = await seedUser({ id: 'u1', email: 'a@a.com', oauth_id: 'ga1' })
    const member = await seedUser({ id: 'u2', email: 'b@b.com', oauth_id: 'ga2' })

    // Create household owned by owner
    await env.DB.prepare(`INSERT INTO households (id, name, owner_user_id) VALUES ('hh-1', 'Test HH', ?)`)
      .bind(owner.id).run()
    // Add owner as admin member
    await env.DB.prepare(`INSERT INTO household_members (household_id, user_id, role, status) VALUES ('hh-1', ?, 'admin', 'active')`)
      .bind(owner.id).run()
    // Add member as contributor
    await env.DB.prepare(`INSERT INTO household_members (household_id, user_id, role, status) VALUES ('hh-1', ?, 'contributor', 'active')`)
      .bind(member.id).run()
    // Cat belongs to household
    await env.DB.prepare(`INSERT INTO cats (id, name, birthdate, household_id) VALUES ('cat-2', 'Luna', '2021-01-01', 'hh-1')`)
      .run()

    expect(await getCatRole(env.DB, 'cat-2', owner.id)).toBe('admin')
    expect(await getCatRole(env.DB, 'cat-2', member.id)).toBe('contributor')
  })

  it('returns null for a user with no access', async () => {
    const owner = await seedUser({ id: 'u1', email: 'a@a.com', oauth_id: 'ga1' })
    const stranger = await seedUser({ id: 'u2', email: 'b@b.com', oauth_id: 'ga2' })

    await env.DB.prepare(`INSERT INTO households (id, name, owner_user_id) VALUES ('hh-1', 'Test HH', ?)`)
      .bind(owner.id).run()
    await env.DB.prepare(`INSERT INTO household_members (household_id, user_id, role, status) VALUES ('hh-1', ?, 'admin', 'active')`)
      .bind(owner.id).run()
    await env.DB.prepare(`INSERT INTO cats (id, name, birthdate, household_id) VALUES ('cat-3', 'Ghost', '2021-01-01', 'hh-1')`)
      .run()

    const role = await getCatRole(env.DB, 'cat-3', stranger.id)
    expect(role).toBeNull()
  })

  it('returns null for a nonexistent cat', async () => {
    const user = await seedUser()
    const role = await getCatRole(env.DB, 'no-such-cat', user.id)
    expect(role).toBeNull()
  })
})
