import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ensureHousehold, getCatRole, hasRole } from '../lib/household'

const cats = new Hono<AppEnv>()

// SEC-04: Field length limits
const MAX_NAME = 200
const MAX_BREED = 200
const MAX_COLORING = 200
const MAX_NOTES = 4000
const MAX_MICROCHIP = 50
const MAX_MEMORIAL_NOTE = 1024

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
    ? 'SELECT c.id, c.name FROM cats c WHERE c.microchip_id = ? AND c.id != ?'
    : 'SELECT c.id, c.name FROM cats c WHERE c.microchip_id = ?'

  const row = currentCatId
    ? await db.prepare(query).bind(microchipId, currentCatId).first<{ id: string; name: string }>()
    : await db.prepare(query).bind(microchipId).first<{ id: string; name: string }>()

  if (!row) return null

  // Check if the conflicting cat is accessible to this user (same household)
  const conflictRole = await getCatRole(db, row.id, requestingUserId)
  if (conflictRole) {
    return { error: 'microchip_id_conflict', conflictingCatName: row.name as string }
  }
  return { error: 'microchip_id_conflict' }
}

cats.get('/', async (c) => {
  const userId = c.get('userId')
  // Trigger lazy migration so this user's cats have household_id set
  await ensureHousehold(c.env.DB, userId)

  const status = c.req.query('status') ?? 'active' // default: only active cats

  let statusFilter = ''
  if (status === 'active') statusFilter = 'AND c.deceased_at IS NULL'
  else if (status === 'memorial') statusFilter = 'AND c.deceased_at IS NOT NULL'
  // 'all' → no filter

  const result = await c.env.DB.prepare(`
    SELECT c.*, h.name as household_name
    FROM cats c
    LEFT JOIN households h ON h.id = c.household_id
    WHERE (
      c.household_id IN (
        SELECT household_id FROM household_members WHERE user_id = ? AND status = 'active'
      ) OR (c.user_id = ? AND c.household_id IS NULL)
    )
    ${statusFilter}
    ORDER BY c.name ASC
  `).bind(userId, userId).all()
  return c.json(result.results)
})

cats.post('/', async (c) => {
  const userId = c.get('userId')
  // Ensure household exists and get householdId for new cat
  const { id: householdId } = await ensureHousehold(c.env.DB, userId)
  const body = await c.req.json<{
    name: string
    birthdate: string
    breed?: string | null
    coloring?: string | null
    notes?: string | null
    photo_url?: string | null
    sex?: string | null
    microchip_id?: string | null
    is_neutered?: number | null
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
    `INSERT INTO cats (name, birthdate, breed, coloring, notes, photo_url, sex, microchip_id, is_neutered, user_id, household_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      body.is_neutered ?? null,
      userId,
      householdId,
    )
    .first()

  return c.json(result, 201)
})

cats.get('/:id', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.param('id')
  const role = await getCatRole(c.env.DB, catId, userId)
  if (!role) return c.json({ error: 'Not found' }, 404)

  const cat = await c.env.DB.prepare(
    `SELECT c.*, h.name as household_name FROM cats c
     LEFT JOIN households h ON h.id = c.household_id WHERE c.id = ?`,
  ).bind(catId).first()
  return c.json(cat)
})

cats.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const catRole = await getCatRole(c.env.DB, id, userId)
  if (!catRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(catRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  const body = await c.req.json<{
    name?: string
    birthdate?: string
    breed?: string | null
    coloring?: string | null
    notes?: string | null
    photo_url?: string | null
    sex?: string | null
    microchip_id?: string | null
    is_neutered?: number | null
    deceased_at?: string | null
    memorial_note?: string | null
  }>()

  const existing = await c.env.DB.prepare('SELECT * FROM cats WHERE id = ?')
    .bind(id).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  // SEC-04: Length validation
  if (body.name && body.name.trim().length > MAX_NAME) return c.json({ error: `name must be ${MAX_NAME} characters or fewer` }, 400)
  if (body.breed && body.breed.length > MAX_BREED) return c.json({ error: `breed must be ${MAX_BREED} characters or fewer` }, 400)
  if (body.coloring && body.coloring.length > MAX_COLORING) return c.json({ error: `coloring must be ${MAX_COLORING} characters or fewer` }, 400)
  if (body.notes && body.notes.length > MAX_NOTES) return c.json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400)
  if (body.memorial_note && body.memorial_note.length > MAX_MEMORIAL_NOTE) return c.json({ error: `memorial_note must be ${MAX_MEMORIAL_NOTE} characters or fewer` }, 400)

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

  // Detect transition to deceased so we can fire side-effects
  const becomingDeceased =
    'deceased_at' in body &&
    body.deceased_at !== null &&
    (existing.deceased_at === null || existing.deceased_at === undefined)

  const updated = await c.env.DB.prepare(
    `UPDATE cats
     SET name = ?, birthdate = ?, breed = ?, coloring = ?, notes = ?, photo_url = ?, sex = ?, microchip_id = ?,
         is_neutered = ?, deceased_at = ?, memorial_note = ?, updated_at = datetime('now')
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
      body.is_neutered !== undefined ? body.is_neutered : existing.is_neutered,
      body.deceased_at !== undefined ? body.deceased_at : existing.deceased_at ?? null,
      body.memorial_note !== undefined ? body.memorial_note : existing.memorial_note ?? null,
      id
    )
    .first()

  // Side-effects when a cat is marked deceased:
  // 1. Deactivate all medications (prevent future reminder generation).
  // 2. Delete all pending (unactioned) future doses.
  if (becomingDeceased) {
    await c.env.DB.prepare(
      `UPDATE medications SET is_active = 0 WHERE cat_id = ?`
    ).bind(id).run()
    await c.env.DB.prepare(
      `DELETE FROM medication_doses
       WHERE medication_id IN (SELECT id FROM medications WHERE cat_id = ?)
         AND administered_at IS NULL AND skipped = 0`
    ).bind(id).run()
  }

  return c.json(updated)
})

cats.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const catRole = await getCatRole(c.env.DB, id, userId)
  if (!catRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(catRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  await c.env.DB.prepare('DELETE FROM measurements WHERE cat_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM cats WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

const PHOTOS_BASE = 'https://pub-40305f88ebb54339b47a48224f195f92.r2.dev'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB

cats.post('/:id/photo', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const catRole = await getCatRole(c.env.DB, id, userId)
  if (!catRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(catRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  const formData = await c.req.formData()
  const file = formData.get('photo')
  if (!file || typeof file === 'string') return c.json({ error: 'Missing photo field' }, 400)

  if (file.type !== 'image/jpeg') return c.json({ error: 'Only JPEG images are accepted' }, 400)

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_PHOTO_BYTES) return c.json({ error: 'Photo must be under 5MB' }, 400)

  const key = `cats/${id}/photo.jpg`
  await c.env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } })

  const photoUrl = `${PHOTOS_BASE}/${key}`
  await c.env.DB.prepare("UPDATE cats SET photo_url = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(photoUrl, id).run()

  return c.json({ photo_url: photoUrl })
})

cats.delete('/:id/photo', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const catRole = await getCatRole(c.env.DB, id, userId)
  if (!catRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(catRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  await c.env.PHOTOS.delete(`cats/${id}/photo.jpg`)
  await c.env.DB.prepare("UPDATE cats SET photo_url = NULL, updated_at = datetime('now') WHERE id = ?")
    .bind(id).run()

  return c.json({ ok: true })
})

export default cats
