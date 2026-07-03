import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getCatRole, hasRole } from '../lib/household'
import { VALID_MEASUREMENT_TYPES, VALID_UNITS as VALID_UNITS_ARRAY, LIMITS, scaleRange } from '../../../shared/lib/constants'

const measurements = new Hono<AppEnv>()

// SEC-05: Measurement type and unit allowlists (from shared/lib/constants.ts)
const VALID_TYPES = new Set(VALID_MEASUREMENT_TYPES)
const VALID_UNITS = new Set(VALID_UNITS_ARRAY)
const MAX_NOTES = LIMITS.MEASUREMENT_NOTES

// GET /api/cats/:id/measurements?type=weight
measurements.get('/cats/:id/measurements', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.param('id')
  const type = c.req.query('type')

  const catRole = await getCatRole(c.env.DB, catId, userId)
  if (!catRole) return c.json({ error: 'Cat not found' }, 404)

  const result = type
    ? await c.env.DB.prepare(
        'SELECT * FROM measurements WHERE cat_id = ? AND type = ? ORDER BY measured_at ASC'
      ).bind(catId, type).all()
    : await c.env.DB.prepare(
        'SELECT * FROM measurements WHERE cat_id = ? ORDER BY measured_at ASC'
      ).bind(catId).all()

  return c.json(result.results)
})

// POST /api/cats/:id/measurements
measurements.post('/cats/:id/measurements', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.param('id')
  const body = await c.req.json<{
    type: string
    value: number
    unit: string
    measured_at: string
    notes?: string
  }>()

  const writeRole = await getCatRole(c.env.DB, catId, userId)
  if (!writeRole) return c.json({ error: 'Cat not found' }, 404)
  if (!hasRole(writeRole, 'contributor')) return c.json({ error: 'Contributor access required' }, 403)

  if (!body.type || body.value === undefined || !body.unit || !body.measured_at) {
    return c.json({ error: 'type, value, unit, and measured_at are required' }, 400)
  }

  // SEC-05: Validate type, unit, and value
  if (!VALID_TYPES.has(body.type)) {
    return c.json({ error: `type must be one of: ${[...VALID_TYPES].join(', ')}` }, 400)
  }
  if (!VALID_UNITS.has(body.unit)) {
    return c.json({ error: `unit must be one of: ${[...VALID_UNITS].join(', ')}` }, 400)
  }
  // BCS is a 'scale' measurement (1–9); reject a non-scale unit so it can't slip
  // into the numeric branch and bypass the 1–9 range check.
  if (body.type === 'bcs' && body.unit !== 'scale') {
    return c.json({ error: "bcs must use unit 'scale'" }, 400)
  }
  if (body.unit === 'scale') {
    // Scale range is per-TYPE, not per-unit: bcs is 1–9, behavioral scales are 0–3.
    const { min, max } = scaleRange(body.type)
    if (!Number.isInteger(body.value) || body.value < min || body.value > max) {
      return c.json({ error: `scale value must be an integer ${min}–${max}` }, 400)
    }
  } else {
    if (typeof body.value !== 'number' || body.value <= 0 || body.value > 200) {
      return c.json({ error: 'value must be a positive number ≤ 200' }, 400)
    }
  }

  // SEC-04: Notes length
  if (body.notes && body.notes.length > MAX_NOTES) {
    return c.json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400)
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
  const userId = c.get('userId')
  const id = c.req.param('id')

  // Verify the measurement belongs to a cat this user can write to
  const mRow = await c.env.DB.prepare(
    `SELECT m.id, m.cat_id FROM measurements m WHERE m.id = ?`,
  ).bind(id).first<{ id: string; cat_id: string }>()
  if (!mRow) return c.json({ error: 'Not found' }, 404)

  const delRole = await getCatRole(c.env.DB, mRow.cat_id, userId)
  if (!delRole || !hasRole(delRole, 'contributor')) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM measurements WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default measurements
