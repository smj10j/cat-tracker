import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getCatRole, hasRole } from '../lib/household'
import { LIMITS, VALID_JOURNAL_TAGS } from '../../../shared/lib/constants'

const journal = new Hono<AppEnv>()

// Validate a tags array against the preset taxonomy. Unknown tags are rejected
// (not silently dropped) so the list can't drift into diagnostic language.
function validateTags(tags: unknown): { ok: true; json: string | null } | { ok: false } {
  if (tags === undefined || tags === null) return { ok: true, json: null }
  if (!Array.isArray(tags)) return { ok: false }
  for (const t of tags) {
    if (typeof t !== 'string' || !(VALID_JOURNAL_TAGS as readonly string[]).includes(t)) return { ok: false }
  }
  const unique = [...new Set(tags as string[])]
  return { ok: true, json: unique.length ? JSON.stringify(unique) : null }
}

function parseTags(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  try {
    const a = JSON.parse(raw)
    return Array.isArray(a) ? (a as string[]) : null
  } catch {
    return null
  }
}

function shapeEntry(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, tags: parseTags(row.tags as string | null) }
}

// GET /api/cats/:id/journal — any household member (Viewer+).
// Query: ?tag= ?from= ?to= ?limit= ?offset=
journal.get('/cats/:id/journal', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.param('id')
  const role = await getCatRole(c.env.DB, catId, userId)
  if (!role) return c.json({ error: 'Cat not found' }, 404)

  const tag = c.req.query('tag')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '200', 10) || 200, 1), 500)
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0)

  const conds: string[] = ['je.cat_id = ?']
  const binds: unknown[] = [catId]
  if (tag && (VALID_JOURNAL_TAGS as readonly string[]).includes(tag)) {
    conds.push('je.tags LIKE ?')
    binds.push(`%"${tag}"%`)
  }
  if (from) { conds.push('je.occurred_at >= ?'); binds.push(from) }
  if (to) { conds.push('je.occurred_at <= ?'); binds.push(to) }

  const rows = await c.env.DB.prepare(
    `SELECT je.*, u.display_name AS author_name
     FROM journal_entries je
     LEFT JOIN users u ON u.id = je.user_id
     WHERE ${conds.join(' AND ')}
     ORDER BY je.occurred_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all<Record<string, unknown>>()

  return c.json(rows.results.map(shapeEntry))
})

// POST /api/cats/:id/journal — Contributor+.
journal.post('/cats/:id/journal', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.param('id')
  const role = await getCatRole(c.env.DB, catId, userId)
  if (!role) return c.json({ error: 'Cat not found' }, 404)
  if (!hasRole(role, 'contributor')) return c.json({ error: 'Contributor access required' }, 403)

  const cat = await c.env.DB.prepare('SELECT deceased_at FROM cats WHERE id = ?')
    .bind(catId).first<{ deceased_at: string | null }>()
  if (cat?.deceased_at) return c.json({ error: 'Cannot add notes to a deceased cat' }, 403)

  const body = await c.req.json<{ occurred_at?: string; text?: string; tags?: unknown }>()
    .catch(() => ({} as { occurred_at?: string; text?: string; tags?: unknown }))

  const text = (body.text ?? '').trim()
  if (!text) return c.json({ error: 'text is required' }, 400)
  if ([...text].length > LIMITS.JOURNAL_TEXT) return c.json({ error: `text must be ${LIMITS.JOURNAL_TEXT} characters or fewer` }, 400)
  if (!body.occurred_at) return c.json({ error: 'occurred_at is required' }, 400)
  if (new Date(body.occurred_at).getTime() > Date.now() + 60000) return c.json({ error: 'occurred_at cannot be in the future' }, 400)
  const tags = validateTags(body.tags)
  if (!tags.ok) return c.json({ error: 'invalid tag' }, 400)

  const inserted = await c.env.DB.prepare(
    `INSERT INTO journal_entries (cat_id, user_id, occurred_at, text, tags)
     VALUES (?, ?, ?, ?, ?) RETURNING *`
  ).bind(catId, userId, body.occurred_at, text, tags.json).first<Record<string, unknown>>()

  const me = await c.env.DB.prepare('SELECT display_name FROM users WHERE id = ?')
    .bind(userId).first<{ display_name: string | null }>()
  return c.json({ ...shapeEntry(inserted!), author_name: me?.display_name ?? null }, 201)
})

// PUT /api/journal/:entryId — author, or Admin of the cat's household.
journal.put('/journal/:entryId', async (c) => {
  const userId = c.get('userId')
  const entryId = c.req.param('entryId')
  const entry = await c.env.DB.prepare('SELECT * FROM journal_entries WHERE id = ?')
    .bind(entryId).first<{ id: string; cat_id: string; user_id: string; occurred_at: string; text: string; tags: string | null }>()
  if (!entry) return c.json({ error: 'Not found' }, 404)
  const role = await getCatRole(c.env.DB, entry.cat_id, userId)
  if (!role) return c.json({ error: 'Not found' }, 404)
  const isAuthor = entry.user_id === userId
  if (!isAuthor && !hasRole(role, 'admin')) return c.json({ error: 'Only the author or an admin can edit' }, 403)

  const body = await c.req.json<{ occurred_at?: string; text?: string; tags?: unknown }>()
    .catch(() => ({} as { occurred_at?: string; text?: string; tags?: unknown }))

  let text = entry.text
  if (body.text !== undefined) {
    text = body.text.trim()
    if (!text) return c.json({ error: 'text is required' }, 400)
    if ([...text].length > LIMITS.JOURNAL_TEXT) return c.json({ error: `text must be ${LIMITS.JOURNAL_TEXT} characters or fewer` }, 400)
  }
  let occurredAt = entry.occurred_at
  if (body.occurred_at !== undefined) {
    if (new Date(body.occurred_at).getTime() > Date.now() + 60000) return c.json({ error: 'occurred_at cannot be in the future' }, 400)
    occurredAt = body.occurred_at
  }
  let tagsJson = entry.tags
  if (body.tags !== undefined) {
    const tags = validateTags(body.tags)
    if (!tags.ok) return c.json({ error: 'invalid tag' }, 400)
    tagsJson = tags.json
  }

  const updated = await c.env.DB.prepare(
    `UPDATE journal_entries SET occurred_at = ?, text = ?, tags = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING *`
  ).bind(occurredAt, text, tagsJson, entryId).first<Record<string, unknown>>()
  return c.json(shapeEntry(updated!))
})

// DELETE /api/journal/:entryId — author or Admin.
journal.delete('/journal/:entryId', async (c) => {
  const userId = c.get('userId')
  const entryId = c.req.param('entryId')
  const entry = await c.env.DB.prepare('SELECT id, cat_id, user_id, photo_url FROM journal_entries WHERE id = ?')
    .bind(entryId).first<{ id: string; cat_id: string; user_id: string; photo_url: string | null }>()
  if (!entry) return c.json({ error: 'Not found' }, 404)
  const role = await getCatRole(c.env.DB, entry.cat_id, userId)
  if (!role) return c.json({ error: 'Not found' }, 404)
  const isAuthor = entry.user_id === userId
  if (!isAuthor && !hasRole(role, 'admin')) return c.json({ error: 'Only the author or an admin can delete' }, 403)

  // Phase B: sweep the entry's R2 photo objects if any were attached.
  if (entry.photo_url) {
    try { await c.env.PHOTOS.delete(`journal/${entryId}/photo.jpg`) } catch { /* best effort */ }
  }
  await c.env.DB.prepare('DELETE FROM journal_entries WHERE id = ?').bind(entryId).run()
  return c.json({ success: true })
})

export default journal
