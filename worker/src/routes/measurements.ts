import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

type Env = { DB: D1Database }

const measurements = new Hono<{ Bindings: Env }>()

// GET /api/cats/:id/measurements?type=weight
measurements.get('/cats/:id/measurements', async (c) => {
  const catId = c.req.param('id')
  const type = c.req.query('type')

  const cat = await c.env.DB.prepare('SELECT id FROM cats WHERE id = ?')
    .bind(catId)
    .first()
  if (!cat) return c.json({ error: 'Cat not found' }, 404)

  const query = type
    ? 'SELECT * FROM measurements WHERE cat_id = ? AND type = ? ORDER BY measured_at ASC'
    : 'SELECT * FROM measurements WHERE cat_id = ? ORDER BY measured_at ASC'

  const result = type
    ? await c.env.DB.prepare(query).bind(catId, type).all()
    : await c.env.DB.prepare(query).bind(catId).all()

  return c.json(result.results)
})

// POST /api/cats/:id/measurements
measurements.post('/cats/:id/measurements', async (c) => {
  const catId = c.req.param('id')
  const body = await c.req.json<{
    type: string
    value: number
    unit: string
    measured_at: string
    notes?: string
  }>()

  const cat = await c.env.DB.prepare('SELECT id FROM cats WHERE id = ?')
    .bind(catId)
    .first()
  if (!cat) return c.json({ error: 'Cat not found' }, 404)

  if (!body.type || body.value === undefined || !body.unit || !body.measured_at) {
    return c.json({ error: 'type, value, unit, and measured_at are required' }, 400)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO measurements (cat_id, type, value, unit, measured_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(catId, body.type, body.value, body.unit, body.measured_at, body.notes ?? null)
    .first()

  return c.json(result, 201)
})

// DELETE /api/measurements/:id
measurements.delete('/measurements/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM measurements WHERE id = ?')
    .bind(id)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM measurements WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default measurements
