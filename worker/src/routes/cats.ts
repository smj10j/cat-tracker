import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

type Env = { DB: D1Database }

const cats = new Hono<{ Bindings: Env }>()

cats.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM cats ORDER BY name ASC'
  ).all()
  return c.json(result.results)
})

cats.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    birthdate: string
    breed?: string
    coloring?: string
    notes?: string
    photo_url?: string
  }>()

  if (!body.name?.trim() || !body.birthdate?.trim()) {
    return c.json({ error: 'name and birthdate are required' }, 400)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO cats (name, birthdate, breed, coloring, notes, photo_url)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(
      body.name.trim(),
      body.birthdate.trim(),
      body.breed ?? null,
      body.coloring ?? null,
      body.notes ?? null,
      body.photo_url ?? null
    )
    .first()

  return c.json(result, 201)
})

cats.get('/:id', async (c) => {
  const cat = await c.env.DB.prepare('SELECT * FROM cats WHERE id = ?')
    .bind(c.req.param('id'))
    .first()

  if (!cat) return c.json({ error: 'Not found' }, 404)
  return c.json(cat)
})

cats.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    birthdate?: string
    breed?: string
    coloring?: string
    notes?: string
    photo_url?: string
  }>()

  const existing = await c.env.DB.prepare('SELECT * FROM cats WHERE id = ?')
    .bind(id)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const updated = await c.env.DB.prepare(
    `UPDATE cats
     SET name = ?, birthdate = ?, breed = ?, coloring = ?, notes = ?, photo_url = ?,
         updated_at = datetime('now')
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      body.name ?? existing.name,
      body.birthdate ?? existing.birthdate,
      body.breed !== undefined ? body.breed : existing.breed,
      body.coloring !== undefined ? body.coloring : existing.coloring,
      body.notes !== undefined ? body.notes : existing.notes,
      body.photo_url !== undefined ? body.photo_url : existing.photo_url,
      id
    )
    .first()

  return c.json(updated)
})

cats.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM cats WHERE id = ?')
    .bind(id)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM cats WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default cats
