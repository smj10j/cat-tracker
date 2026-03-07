import { Hono } from 'hono'
import type { AppEnv } from '../types'

const importRoute = new Hono<AppEnv>()

// POST /api/import
importRoute.post('/import', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.text()
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
  }

  const rows: ParsedRow[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = (dataLines[i] ?? '').trim()
    if (!line) continue

    const rowNum = i + 2 // +2: 1-indexed, skipping header
    const parts = line.split(',')

    if (parts.length < 5) {
      errors.push(`Row ${rowNum}: expected 5 columns, got ${parts.length}: "${line}"`)
      continue
    }

    const [dateStr, catName, type, valueStr, unit] = parts.map(p => p.trim())

    if (!dateStr || !catName || !type || !valueStr || !unit) {
      errors.push(`Row ${rowNum}: one or more required fields are empty: "${line}"`)
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

    rows.push({ catName, type, value, unit, measuredAt })
  }

  if (rows.length === 0 && errors.length > 0) {
    return c.json({ imported: 0, catsCreated, errors }, 422)
  }

  // Collect unique cat names (case-insensitive, preserve original casing for creation)
  const catNameMap = new Map<string, string>() // lowercase → original casing
  for (const row of rows) {
    const key = row.catName.toLowerCase()
    if (!catNameMap.has(key)) {
      catNameMap.set(key, row.catName)
    }
  }

  // Look up or create each cat (scoped to this user), building a map of lowercase name → id
  const catIdMap = new Map<string, string>()

  for (const [lowerName, originalName] of catNameMap) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM cats WHERE LOWER(name) = ? AND user_id = ?'
    ).bind(lowerName, userId).first<{ id: string }>()

    if (existing) {
      catIdMap.set(lowerName, existing.id)
    } else {
      const created = await c.env.DB.prepare(
        `INSERT INTO cats (name, birthdate, notes, user_id)
         VALUES (?, '2020-01-01', 'Created via CSV import', ?)
         RETURNING id`
      ).bind(originalName, userId).first<{ id: string }>()

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
