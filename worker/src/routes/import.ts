import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ensureHousehold } from '../lib/household'
import { LIMITS, VALID_MEASUREMENT_TYPES, VALID_UNITS as VALID_UNITS_ARRAY, scaleRange } from '../../../shared/lib/constants'

const importRoute = new Hono<AppEnv>()

const IMPORT_MAX_BYTES = 1024 * 1024 // 1 MB — SEC-06
const MAX_CAT_NAME = LIMITS.CAT_NAME
const MAX_NOTES = LIMITS.NOTES
// Same allowlists as POST /cats/:id/measurements — imports must not bypass
// measurement validation (invalid types corrupt charts and correlations).
const VALID_TYPES = new Set<string>(VALID_MEASUREMENT_TYPES)
const VALID_UNITS = new Set<string>(VALID_UNITS_ARRAY)

// POST /api/import
importRoute.post('/import', async (c) => {
  const userId = c.get('userId')
  const { id: householdId } = await ensureHousehold(c.env.DB, userId)
  const body = await c.req.text()

  // SEC-06: Body size limit
  if (body.length > IMPORT_MAX_BYTES) {
    return c.json({ error: 'Import file too large (max 1 MB)' }, 413)
  }

  const lines = body.split('\n')

  // Skip header row
  const dataLines = lines.slice(1)

  const errors: string[] = []
  const catsCreated: string[] = []

  interface ParsedRow {
    catName: string
    type: string
    value: number
    unit: string
    measuredAt: string
    microchipId: string | null
  }

  const rows: ParsedRow[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = (dataLines[i] ?? '').trim()
    if (!line) continue

    const rowNum = i + 2 // +2: 1-indexed, skipping header
    const parts = line.split(',')

    // Accept 5 columns (legacy) or 6 columns (with microchip_id as last column)
    if (parts.length < 5) {
      errors.push(`Row ${rowNum}: expected 5 or 6 columns, got ${parts.length}: "${line}"`)
      continue
    }

    const [dateStr, catName, type, valueStr, unit, microchipRaw] = parts.map(p => p.trim())

    if (!dateStr || !catName || !type || !valueStr || !unit) {
      errors.push(`Row ${rowNum}: one or more required fields are empty: "${line}"`)
      continue
    }

    // SEC-04: Field length validation
    if (catName.length > MAX_CAT_NAME) {
      errors.push(`Row ${rowNum}: cat name exceeds ${MAX_CAT_NAME} characters`)
      continue
    }

    // Parse M/D/YYYY → YYYY-MM-DDT12:00:00Z
    const dateParts = dateStr.split('/')
    if (dateParts.length !== 3) {
      errors.push(`Row ${rowNum}: invalid date format "${dateStr}", expected M/D/YYYY`)
      continue
    }
    const [month, day, year] = dateParts
    const monthNum = parseInt(month ?? '', 10)
    const dayNum = parseInt(day ?? '', 10)
    const yearNum = parseInt(year ?? '', 10)

    if (isNaN(monthNum) || isNaN(dayNum) || isNaN(yearNum) ||
        monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      errors.push(`Row ${rowNum}: invalid date values in "${dateStr}"`)
      continue
    }

    const measuredAt = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}T12:00:00Z`

    const value = parseFloat(valueStr)
    if (isNaN(value)) {
      errors.push(`Row ${rowNum}: invalid numeric value "${valueStr}"`)
      continue
    }

    // Mirror POST /cats/:id/measurements validation (SEC-05)
    if (!VALID_TYPES.has(type ?? '')) {
      errors.push(`Row ${rowNum}: type must be one of: ${[...VALID_TYPES].join(', ')}`)
      continue
    }
    if (!VALID_UNITS.has(unit ?? '')) {
      errors.push(`Row ${rowNum}: unit must be one of: ${[...VALID_UNITS].join(', ')}`)
      continue
    }
    if (type === 'bcs' && unit !== 'scale') {
      errors.push(`Row ${rowNum}: bcs must use unit 'scale'`)
      continue
    }
    if (unit === 'scale') {
      // Scale range is per-TYPE: bcs is 1–9, behavioral scales are 0–3.
      const { min, max } = scaleRange(type ?? '')
      if (!Number.isInteger(value) || value < min || value > max) {
        errors.push(`Row ${rowNum}: scale value must be an integer ${min}–${max}`)
        continue
      }
    } else if (value <= 0 || value > 200) {
      errors.push(`Row ${rowNum}: value must be a positive number ≤ 200`)
      continue
    }

    const microchipId = microchipRaw?.trim() || null

    rows.push({ catName, type, value, unit, measuredAt, microchipId })
  }

  if (rows.length === 0 && errors.length > 0) {
    return c.json({ imported: 0, catsCreated, errors }, 422)
  }

  // Collect unique cat names (case-insensitive, preserve original casing for creation)
  const catNameMap = new Map<string, { name: string; microchipId: string | null }>()
  for (const row of rows) {
    const key = row.catName.toLowerCase()
    if (!catNameMap.has(key)) {
      catNameMap.set(key, { name: row.catName, microchipId: row.microchipId })
    }
  }

  // Look up or create each cat (scoped to this user), building a map of lowercase name → id
  const catIdMap = new Map<string, string>()

  for (const [lowerName, { name: originalName, microchipId }] of catNameMap) {
    // Try to match by microchip_id first (if provided and not a temp ID)
    let existing: { id: string } | null = null

    if (microchipId && !microchipId.startsWith('temp-microchip-id-')) {
      existing = await c.env.DB.prepare(
        'SELECT id FROM cats WHERE microchip_id = ? AND user_id = ?'
      ).bind(microchipId, userId).first<{ id: string }>() ?? null
    }

    // Fall back to name match
    if (!existing) {
      existing = await c.env.DB.prepare(
        'SELECT id FROM cats WHERE LOWER(name) = ? AND user_id = ?'
      ).bind(lowerName, userId).first<{ id: string }>() ?? null
    }

    if (existing) {
      catIdMap.set(lowerName, existing.id)
    } else {
      const tempMicrochip = microchipId || `temp-microchip-id-${crypto.randomUUID()}`
      const created = await c.env.DB.prepare(
        `INSERT INTO cats (name, birthdate, notes, microchip_id, user_id, household_id)
         VALUES (?, '2020-01-01', 'Created via CSV import', ?, ?, ?)
         RETURNING id`
      ).bind(originalName, tempMicrochip, userId, householdId).first<{ id: string }>()

      if (!created) {
        errors.push(`Failed to create cat "${originalName}"`)
        continue
      }
      catIdMap.set(lowerName, created.id)
      catsCreated.push(originalName)
    }
  }

  // Build batch insert statements for all valid rows
  const statements = []
  const skipped: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const catId = catIdMap.get(row.catName.toLowerCase())
    if (catId === undefined) {
      skipped.push(i)
      continue
    }
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO measurements (cat_id, type, value, unit, measured_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(catId, row.type, row.value, row.unit, row.measuredAt)
    )
  }

  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }

  return c.json({
    imported: statements.length,
    catsCreated,
    errors,
  })
})

export default importRoute
