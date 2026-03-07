import { Hono } from 'hono'
import type { AppEnv } from '../types'

const cats = new Hono<AppEnv>()

// SEC-04: Field length limits
const MAX_NAME = 200
const MAX_BREED = 200
const MAX_COLORING = 200
const MAX_NOTES = 4000
const MAX_MICROCHIP = 50

function isRealMicrochip(id: string) {
  return !id.startsWith('temp-microchip-id-')
}

async function checkMicrochipConflict(
  db: AppEnv['Bindings']['DB'],
  microchipId: string,
  currentCatId: string | null,
  requestingUserId: string
): Promise<{ error: string; conflictingCatName?: string } | null> {
  const query = currentCatId
    ? 'SELECT id, name, user_id FROM cats WHERE microchip_id = ? AND id != ?'
    : 'SELECT id, name, user_id FROM cats WHERE microchip_id = ?'

  const row = currentCatId
    ? await db.prepare(query).bind(microchipId, currentCatId).first<{ id: string; name: string; user_id: string | null }>()
    : await db.prepare(query).bind(microchipId).first<{ id: string; name: string; user_id: string | null }>()

  if (!row) return null

  // Same user owns the conflicting cat — reveal its name
  if (row.user_id === requestingUserId) {
    return { error: 'microchip_id_conflict', conflictingCatName: row.name as string }
  }
  // Different user — privacy-preserving generic error
  return { error: 'microchip_id_conflict' }
}

cats.get('/', async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'SELECT * FROM cats WHERE user_id = ? ORDER BY name ASC'
  ).bind(userId).all()
  return c.json(result.results)
})

cats.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name: string
    birthdate: string
    breed?: string | null
    coloring?: string | null
    notes?: string | null
    photo_url?: string | null
    sex?: string | null
    microchip_id?: string | null
  }>()

  if (!body.name?.trim() || !body.birthdate?.trim()) {
    return c.json({ error: 'name and birthdate are required' }, 400)
  }

  // SEC-04: Length validation
  if (body.name.trim().length > MAX_NAME) return c.json({ error: `name must be ${MAX_NAME} characters or fewer` }, 400)
  if (body.breed && body.breed.length > MAX_BREED) return c.json({ error: `breed must be ${MAX_BREED} characters or fewer` }, 400)
  if (body.coloring && body.coloring.length > MAX_COLORING) return c.json({ error: `coloring must be ${MAX_COLORING} characters or fewer` }, 400)
  if (body.notes && body.notes.length > MAX_NOTES) return c.json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400)

  // Microchip ID: use provided value or generate a temp placeholder
  const rawMicrochip = body.microchip_id?.trim() || null
  const microchipId = rawMicrochip || `temp-microchip-id-${crypto.randomUUID()}`

  if (rawMicrochip && rawMicrochip.length > MAX_MICROCHIP) {
    return c.json({ error: `microchip_id must be ${MAX_MICROCHIP} characters or fewer` }, 400)
  }

  // Check for microchip conflict (only for real IDs, not temp placeholders)
  if (rawMicrochip && isRealMicrochip(rawMicrochip)) {
    const conflict = await checkMicrochipConflict(c.env.DB, rawMicrochip, null, userId)
    if (conflict) return c.json(conflict, 409)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO cats (name, birthdate, breed, coloring, notes, photo_url, sex, microchip_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(
      body.name.trim(),
      body.birthdate.trim(),
      body.breed ?? null,
      body.coloring ?? null,
      body.notes ?? null,
      body.photo_url ?? null,
      body.sex ?? null,
      microchipId,
      userId,
    )
    .first()

  return c.json(result, 201)
})

cats.get('/:id', async (c) => {
  const userId = c.get('userId')
  const cat = await c.env.DB.prepare(
    'SELECT * FROM cats WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
  ).bind(c.req.param('id'), userId).first()

  if (!cat) return c.json({ error: 'Not found' }, 404)
  return c.json(cat)
})

cats.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    birthdate?: string
    breed?: string | null
    coloring?: string | null
    notes?: string | null
    photo_url?: string | null
    sex?: string | null
    microchip_id?: string | null
  }>()

  const existing = await c.env.DB.prepare(
    'SELECT * FROM cats WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  // SEC-04: Length validation
  if (body.name && body.name.trim().length > MAX_NAME) return c.json({ error: `name must be ${MAX_NAME} characters or fewer` }, 400)
  if (body.breed && body.breed.length > MAX_BREED) return c.json({ error: `breed must be ${MAX_BREED} characters or fewer` }, 400)
  if (body.coloring && body.coloring.length > MAX_COLORING) return c.json({ error: `coloring must be ${MAX_COLORING} characters or fewer` }, 400)
  if (body.notes && body.notes.length > MAX_NOTES) return c.json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400)

  // Microchip ID update logic
  let newMicrochipId: string | null | undefined = undefined // undefined = keep existing

  if ('microchip_id' in body) {
    const raw = body.microchip_id?.trim() || null
    if (raw) {
      if (raw.length > MAX_MICROCHIP) return c.json({ error: `microchip_id must be ${MAX_MICROCHIP} characters or fewer` }, 400)
      // Check for conflicts against other cats
      if (isRealMicrochip(raw)) {
        const conflict = await checkMicrochipConflict(c.env.DB, raw, id, userId)
        if (conflict) return c.json(conflict, 409)
      }
      newMicrochipId = raw
    } else {
      newMicrochipId = null // explicitly clearing — will store null
    }
  }

  const updated = await c.env.DB.prepare(
    `UPDATE cats
     SET name = ?, birthdate = ?, breed = ?, coloring = ?, notes = ?, photo_url = ?, sex = ?, microchip_id = ?,
         updated_at = datetime('now')
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      body.name?.trim() ?? existing.name,
      body.birthdate ?? existing.birthdate,
      body.breed !== undefined ? body.breed : existing.breed,
      body.coloring !== undefined ? body.coloring : existing.coloring,
      body.notes !== undefined ? body.notes : existing.notes,
      body.photo_url !== undefined ? body.photo_url : existing.photo_url,
      body.sex !== undefined ? body.sex : existing.sex,
      newMicrochipId !== undefined ? newMicrochipId : existing.microchip_id,
      id
    )
    .first()

  return c.json(updated)
})

cats.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id FROM cats WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM measurements WHERE cat_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM cats WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default cats
