import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getCatRole, hasRole } from '../lib/household'
import { localToUTC } from '../../../shared/lib/dates'
import { VALID_FREQUENCIES, isAsNeeded } from '../../../shared/lib/constants'

const medications = new Hono<AppEnv>()

// ---------------------------------------------------------------------------
// Dose generation helpers
// ---------------------------------------------------------------------------

interface DoseRow {
  medication_id: string
  due_at: string // 'YYYY-MM-DD HH:MM:00' — SQLite datetime format for correct comparisons
}

function frequencyToDays(frequency: string, frequencyDays: number | null): number {
  switch (frequency) {
    case 'daily': return 1
    case 'weekly': return 7
    case 'monthly': return 30
    case 'custom': return frequencyDays ?? 1
    default: return 1
  }
}

// Generate doses for a medication within [startDate, min(endDate, windowEnd)]
// When timezone is provided, due_at values are converted to UTC.
// When null (unmigrated users), due_at remains as naive local time (legacy behavior).
export function generateDoses(
  medicationId: string,
  startDate: string,    // YYYY-MM-DD
  reminderTime: string, // HH:MM (user's local time)
  frequency: string,
  frequencyDays: number | null,
  endDate: string | null,
  windowEnd: string,    // YYYY-MM-DD
  timezone: string | null = null,
): DoseRow[] {
  // PRN items have no schedule — no doses are generated and they never fire reminders.
  if (isAsNeeded(frequency)) return []

  const doses: DoseRow[] = []
  const effectiveEnd = endDate && endDate < windowEnd ? endDate : windowEnd

  function makeDueAt(dateStr: string, timeStr: string): string {
    if (timezone) return localToUTC(dateStr, timeStr, timezone)
    return `${dateStr} ${timeStr}:00`
  }

  if (frequency === 'twice_daily') {
    const [hStr, mStr] = reminderTime.split(':')
    const h = parseInt(hStr ?? '9', 10)
    const m = parseInt(mStr ?? '0', 10)
    const h2 = (h + 12) % 24
    const t1 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const t2 = `${String(h2).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    const startMs = Date.UTC(
      parseInt(startDate.slice(0, 4), 10),
      parseInt(startDate.slice(5, 7), 10) - 1,
      parseInt(startDate.slice(8, 10), 10),
    )
    const endMs = Date.UTC(
      parseInt(effectiveEnd.slice(0, 4), 10),
      parseInt(effectiveEnd.slice(5, 7), 10) - 1,
      parseInt(effectiveEnd.slice(8, 10), 10),
    )
    const DAY = 86400000
    for (let ms = startMs; ms <= endMs; ms += DAY) {
      const d = new Date(ms).toISOString().slice(0, 10)
      doses.push({ medication_id: medicationId, due_at: makeDueAt(d, t1) })
      doses.push({ medication_id: medicationId, due_at: makeDueAt(d, t2) })
    }
  } else {
    const intervalDays = frequencyToDays(frequency, frequencyDays)
    const startMs = Date.UTC(
      parseInt(startDate.slice(0, 4), 10),
      parseInt(startDate.slice(5, 7), 10) - 1,
      parseInt(startDate.slice(8, 10), 10),
    )
    const endMs = Date.UTC(
      parseInt(effectiveEnd.slice(0, 4), 10),
      parseInt(effectiveEnd.slice(5, 7), 10) - 1,
      parseInt(effectiveEnd.slice(8, 10), 10),
    )
    const intervalMs = intervalDays * 86400000
    let n = 0
    while (true) {
      const dueMs = startMs + n * intervalMs
      if (dueMs > endMs) break
      const d = new Date(dueMs).toISOString().slice(0, 10)
      doses.push({ medication_id: medicationId, due_at: makeDueAt(d, reminderTime) })
      n++
    }
  }

  return doses
}

// Idempotent batch insert — chunks of 100 to stay within D1 batch limits
export async function insertDoses(db: AppEnv['Bindings']['DB'], doses: DoseRow[]): Promise<void> {
  if (doses.length === 0) return
  const CHUNK = 100
  const stmt = db.prepare('INSERT OR IGNORE INTO medication_doses (medication_id, due_at) VALUES (?, ?)')
  for (let i = 0; i < doses.length; i += CHUNK) {
    const chunk = doses.slice(i, i + CHUNK)
    await db.batch(chunk.map(d => stmt.bind(d.medication_id, d.due_at)))
  }
}

// 90 days from today as YYYY-MM-DD
export function windowEnd90(): string {
  return new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Medication CRUD
// ---------------------------------------------------------------------------

// GET /api/medications[?cat_id=]
medications.get('/medications', async (c) => {
  const userId = c.get('userId')
  const catId = c.req.query('cat_id')
  const nowUTC = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const householdFilter = `(
      c.household_id IN (
        SELECT household_id FROM household_members WHERE user_id = ? AND status = 'active'
      ) OR (c.user_id = ? AND c.household_id IS NULL)
    )`

  const rows = catId
    ? await c.env.DB.prepare(
        `SELECT m.*,
           (SELECT due_at FROM medication_doses d
            WHERE d.medication_id = m.id AND d.administered_at IS NULL AND d.skipped = 0
              AND d.due_at >= ?
            ORDER BY d.due_at ASC LIMIT 1) AS next_due_at,
           (SELECT COUNT(*) FROM medication_doses d
            WHERE d.medication_id = m.id AND d.administered_at IS NULL AND d.skipped = 0
              AND d.due_at < ?) AS overdue_count
         FROM medications m
         JOIN cats c ON c.id = m.cat_id
         WHERE ${householdFilter} AND m.cat_id = ? AND m.is_active = 1
         ORDER BY m.name ASC`
      ).bind(nowUTC, nowUTC, userId, userId, catId).all()
    : await c.env.DB.prepare(
        `SELECT m.*,
           (SELECT due_at FROM medication_doses d
            WHERE d.medication_id = m.id AND d.administered_at IS NULL AND d.skipped = 0
              AND d.due_at >= ?
            ORDER BY d.due_at ASC LIMIT 1) AS next_due_at,
           (SELECT COUNT(*) FROM medication_doses d
            WHERE d.medication_id = m.id AND d.administered_at IS NULL AND d.skipped = 0
              AND d.due_at < ?) AS overdue_count
         FROM medications m
         JOIN cats c ON c.id = m.cat_id
         WHERE ${householdFilter} AND m.is_active = 1
         ORDER BY m.name ASC`
      ).bind(nowUTC, nowUTC, userId, userId).all()

  return c.json(rows.results)
})

// POST /api/medications
medications.post('/medications', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    cat_id: string
    name: string
    type?: string
    dose?: string | null
    frequency: string
    frequency_days?: number | null
    reminder_time?: string
    start_date: string
    end_date?: string | null
    doses_total?: number | null
    notes?: string | null
    doses_remaining?: number | null
    refill_alert_threshold?: number | null
  }>()

  if (!body.cat_id || !body.name?.trim() || !body.frequency || !body.start_date) {
    return c.json({ error: 'cat_id, name, frequency, and start_date are required' }, 400)
  }
  const VALID_FREQS = new Set(VALID_FREQUENCIES)
  if (!VALID_FREQS.has(body.frequency)) {
    return c.json({ error: 'Invalid frequency' }, 400)
  }
  if (body.frequency === 'custom' && !body.frequency_days) {
    return c.json({ error: 'frequency_days required for custom frequency' }, 400)
  }
  // PRN items must not carry refill alerts — owners administer unpredictably.
  const asNeeded = isAsNeeded(body.frequency)

  // Verify cat access (supports household sharing)
  const catRole = await getCatRole(c.env.DB, body.cat_id, userId)
  if (!catRole) return c.json({ error: 'Cat not found' }, 404)
  if (!hasRole(catRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  const reminderTime = body.reminder_time ?? '09:00'
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  await c.env.DB.prepare(
    `INSERT INTO medications
       (id, cat_id, user_id, name, type, dose, frequency, frequency_days,
        reminder_time, start_date, end_date, doses_total, notes,
        doses_remaining, refill_alert_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.cat_id, userId,
    body.name.trim().slice(0, 200),
    (body.type ?? 'other').slice(0, 50),
    body.dose?.trim().slice(0, 100) ?? null,
    body.frequency,
    asNeeded ? null : (body.frequency_days ?? null),
    reminderTime,
    body.start_date,
    asNeeded ? null : (body.end_date ?? null),
    asNeeded ? null : (body.doses_total ?? null),
    body.notes?.trim().slice(0, 1000) ?? null,
    asNeeded ? null : (body.doses_remaining ?? null),
    asNeeded ? null : (body.refill_alert_threshold ?? null),
  ).run()

  // Look up user timezone for UTC dose generation
  const userRow = await c.env.DB.prepare('SELECT timezone FROM users WHERE id = ?').bind(userId).first<{ timezone: string | null }>()

  // Generate 90 days of doses
  const doses = generateDoses(id, body.start_date, reminderTime, body.frequency,
    body.frequency_days ?? null, body.end_date ?? null, windowEnd90(), userRow?.timezone ?? null)
  await insertDoses(c.env.DB, doses)

  const med = await c.env.DB.prepare('SELECT * FROM medications WHERE id = ?').bind(id).first()
  return c.json(med, 201)
})

// GET /api/medications/:id
medications.get('/medications/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const med = await c.env.DB.prepare('SELECT * FROM medications WHERE id = ?').bind(id).first<{ cat_id: string }>()
  if (!med) return c.json({ error: 'Not found' }, 404)
  const medRole = await getCatRole(c.env.DB, med.cat_id, userId)
  if (!medRole) return c.json({ error: 'Not found' }, 404)

  // Last 30 + next 30 doses
  const doses = await c.env.DB.prepare(
    `SELECT * FROM medication_doses WHERE medication_id = ?
     ORDER BY due_at DESC LIMIT 60`
  ).bind(id).all()

  return c.json({ ...med, doses: doses.results })
})

// PUT /api/medications/:id
medications.put('/medications/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  type MedRow = {
    cat_id: string; name: string; type: string; dose: string | null; frequency: string
    frequency_days: number | null; reminder_time: string; start_date: string
    end_date: string | null; doses_total: number | null; notes: string | null
    is_active: number; doses_remaining: number | null; refill_alert_threshold: number | null
  }
  const med = await c.env.DB.prepare('SELECT * FROM medications WHERE id = ?').bind(id).first<MedRow>()
  if (!med) return c.json({ error: 'Not found' }, 404)
  const putRole = await getCatRole(c.env.DB, med.cat_id, userId)
  if (!putRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(putRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  const body = await c.req.json<Partial<MedRow>>()

  const name = (body.name?.trim() ?? med.name).slice(0, 200)
  const type = (body.type ?? med.type).slice(0, 50)
  const dose = 'dose' in body ? (body.dose?.trim().slice(0, 100) ?? null) : med.dose
  const frequency = body.frequency ?? med.frequency
  const frequencyDays = 'frequency_days' in body ? (body.frequency_days ?? null) : med.frequency_days
  const reminderTime = body.reminder_time ?? med.reminder_time
  const startDate = body.start_date ?? med.start_date
  const endDate = 'end_date' in body ? (body.end_date ?? null) : med.end_date
  const dosesTotal = 'doses_total' in body ? (body.doses_total ?? null) : med.doses_total
  const notes = 'notes' in body ? (body.notes?.trim().slice(0, 1000) ?? null) : med.notes
  const isActive = 'is_active' in body ? (body.is_active ?? 1) : med.is_active
  const dosesRemaining = 'doses_remaining' in body ? (body.doses_remaining ?? null) : med.doses_remaining
  const refillThreshold = 'refill_alert_threshold' in body ? (body.refill_alert_threshold ?? null) : med.refill_alert_threshold

  await c.env.DB.prepare(
    `UPDATE medications
     SET name=?, type=?, dose=?, frequency=?, frequency_days=?, reminder_time=?,
         start_date=?, end_date=?, doses_total=?, notes=?, is_active=?,
         doses_remaining=?, refill_alert_threshold=?, updated_at=datetime('now')
     WHERE id = ?`
  ).bind(
    name, type, dose, frequency, frequencyDays, reminderTime,
    startDate, endDate, dosesTotal, notes, isActive,
    dosesRemaining, refillThreshold, id,
  ).run()

  // Delete future unadministered/unskipped doses and regenerate
  const todayStr = new Date().toISOString().slice(0, 10)
  await c.env.DB.prepare(
    `DELETE FROM medication_doses
     WHERE medication_id = ? AND administered_at IS NULL AND skipped = 0
       AND due_at >= ?`
  ).bind(id, `${todayStr} 00:00:00`).run()

  if (isActive) {
    const userRow = await c.env.DB.prepare('SELECT timezone FROM users WHERE id = ?').bind(userId).first<{ timezone: string | null }>()
    const doses = generateDoses(id, startDate, reminderTime, frequency,
      frequencyDays, endDate, windowEnd90(), userRow?.timezone ?? null)
    const futureDoses = doses.filter(d => d.due_at >= `${todayStr} 00:00:00`)
    await insertDoses(c.env.DB, futureDoses)
  }

  const updated = await c.env.DB.prepare('SELECT * FROM medications WHERE id = ?').bind(id).first()
  return c.json(updated)
})

// DELETE /api/medications/:id — archive (soft delete)
medications.delete('/medications/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const delMed = await c.env.DB.prepare('SELECT cat_id FROM medications WHERE id = ?').bind(id).first<{ cat_id: string }>()
  if (!delMed) return c.json({ error: 'Not found' }, 404)
  const delRole = await getCatRole(c.env.DB, delMed.cat_id, userId)
  if (!delRole) return c.json({ error: 'Not found' }, 404)
  if (!hasRole(delRole, 'editor')) return c.json({ error: 'Editor access required' }, 403)

  await c.env.DB.prepare(
    `UPDATE medications SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run()

  return c.json({ success: true })
})

// ---------------------------------------------------------------------------
// Notification inbox
// ---------------------------------------------------------------------------

// Compute the UTC boundaries of "today" in the user's timezone.
// Returns { todayStartUTC, tomorrowStartUTC, weekEndUTC, nowUTC } as 'YYYY-MM-DD HH:MM:00' strings.
function userDateBoundaries(timezone: string | null): {
  nowUTC: string
  todayStartUTC: string
  tomorrowStartUTC: string
  weekEndUTC: string
} {
  const now = new Date()
  const nowUTC = now.toISOString().replace('T', ' ').slice(0, 19)

  if (!timezone) {
    // No timezone — fall back to UTC dates
    const todayStr = now.toISOString().slice(0, 10)
    const tom = new Date(now.getTime() + 86400000)
    const weekEnd = new Date(now.getTime() + 8 * 86400000)
    return {
      nowUTC,
      todayStartUTC: `${todayStr} 00:00:00`,
      tomorrowStartUTC: `${tom.toISOString().slice(0, 10)} 00:00:00`,
      weekEndUTC: `${weekEnd.toISOString().slice(0, 10)} 00:00:00`,
    }
  }

  // Get user's local "today" date string using Intl
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => localParts.find(p => p.type === type)?.value ?? ''
  const localToday = `${get('year')}-${get('month')}-${get('day')}`

  // Convert local midnight boundaries to UTC using localToUTC
  const todayStartUTC = localToUTC(localToday, '00:00', timezone)

  // Tomorrow in user's timezone
  const localTomDate = new Date(`${localToday}T12:00:00Z`)
  localTomDate.setUTCDate(localTomDate.getUTCDate() + 1)
  const tomorrowStr = localTomDate.toISOString().slice(0, 10)
  const tomorrowStartUTC = localToUTC(tomorrowStr, '00:00', timezone)

  // 8 days from today (end of 7-day upcoming window)
  const localWeekDate = new Date(`${localToday}T12:00:00Z`)
  localWeekDate.setUTCDate(localWeekDate.getUTCDate() + 8)
  const weekEndStr = localWeekDate.toISOString().slice(0, 10)
  const weekEndUTC = localToUTC(weekEndStr, '00:00', timezone)

  return { nowUTC, todayStartUTC, tomorrowStartUTC, weekEndUTC }
}

// GET /api/notifications
medications.get('/notifications', async (c) => {
  const userId = c.get('userId')

  const hhFilter = `(
      c.household_id IN (
        SELECT household_id FROM household_members WHERE user_id = ? AND status = 'active'
      ) OR (c.user_id = ? AND c.household_id IS NULL)
    )`

  // Look up user timezone for timezone-aware categorization
  const userRow = await c.env.DB.prepare('SELECT timezone FROM users WHERE id = ?').bind(userId).first<{ timezone: string | null }>()
  const { nowUTC, todayStartUTC, tomorrowStartUTC, weekEndUTC } = userDateBoundaries(userRow?.timezone ?? null)

  const [overdueR, todayR, upcomingR, refillR] = await Promise.all([
    // Overdue: due_at < now and not administered and not skipped
    c.env.DB.prepare(
      `SELECT d.*, m.name AS med_name, m.dose, m.type AS med_type,
              c.name AS cat_name, c.id AS cat_id
       FROM medication_doses d
       JOIN medications m ON m.id = d.medication_id
       JOIN cats c ON c.id = m.cat_id
       WHERE ${hhFilter} AND m.is_active = 1
         AND d.due_at < ?
         AND d.administered_at IS NULL AND d.skipped = 0
       ORDER BY d.due_at ASC LIMIT 50`
    ).bind(userId, userId, nowUTC).all(),

    // Due today: due_at >= now AND within today in user's timezone
    c.env.DB.prepare(
      `SELECT d.*, m.name AS med_name, m.dose, m.type AS med_type,
              c.name AS cat_name, c.id AS cat_id
       FROM medication_doses d
       JOIN medications m ON m.id = d.medication_id
       JOIN cats c ON c.id = m.cat_id
       WHERE ${hhFilter} AND m.is_active = 1
         AND d.due_at >= ?
         AND d.due_at >= ? AND d.due_at < ?
         AND d.administered_at IS NULL AND d.skipped = 0
       ORDER BY d.due_at ASC LIMIT 50`
    ).bind(userId, userId, nowUTC, todayStartUTC, tomorrowStartUTC).all(),

    // Upcoming: after today in user's timezone, within 7 days
    c.env.DB.prepare(
      `SELECT d.*, m.name AS med_name, m.dose, m.type AS med_type,
              c.name AS cat_name, c.id AS cat_id
       FROM medication_doses d
       JOIN medications m ON m.id = d.medication_id
       JOIN cats c ON c.id = m.cat_id
       WHERE ${hhFilter} AND m.is_active = 1
         AND d.due_at >= ?
         AND d.due_at < ?
         AND d.administered_at IS NULL AND d.skipped = 0
       ORDER BY d.due_at ASC LIMIT 50`
    ).bind(userId, userId, tomorrowStartUTC, weekEndUTC).all(),

    // Refill alerts: doses_remaining <= threshold (PRN items excluded — unpredictable consumption)
    c.env.DB.prepare(
      `SELECT m.*, c.name AS cat_name, c.id AS cat_id
       FROM medications m
       JOIN cats c ON c.id = m.cat_id
       WHERE ${hhFilter} AND m.is_active = 1
         AND m.frequency != 'as_needed'
         AND m.doses_remaining IS NOT NULL
         AND m.refill_alert_threshold IS NOT NULL
         AND m.doses_remaining <= m.refill_alert_threshold
         AND m.doses_remaining > 0`
    ).bind(userId, userId).all(),
  ])

  return c.json({
    overdue: overdueR.results,
    due_today: todayR.results,
    upcoming: upcomingR.results,
    refill_alerts: refillR.results,
  })
})

// ---------------------------------------------------------------------------
// Dose actions
// ---------------------------------------------------------------------------

// POST /api/doses/:id/administer
medications.post('/doses/:id/administer', async (c) => {
  const userId = c.get('userId')
  const doseId = c.req.param('id')
  const body = await c.req.json<{ administered_at?: string; notes?: string }>().catch(() => ({} as { administered_at?: string; notes?: string }))

  const dose = await c.env.DB.prepare(
    `SELECT d.id, m.cat_id FROM medication_doses d
     JOIN medications m ON m.id = d.medication_id
     WHERE d.id = ?`
  ).bind(doseId).first<{ id: string; cat_id: string }>()
  if (!dose) return c.json({ error: 'Not found' }, 404)
  const adminRole = await getCatRole(c.env.DB, dose.cat_id, userId)
  if (!adminRole || !hasRole(adminRole, 'contributor')) return c.json({ error: 'Not found' }, 404)

  const administeredAt = body.administered_at ?? new Date().toISOString().replace('T', ' ').slice(0, 19)
  await c.env.DB.prepare(
    `UPDATE medication_doses
     SET administered_at = ?, notes = ?, skipped = 0
     WHERE id = ?`
  ).bind(administeredAt, body.notes?.trim().slice(0, 1000) ?? null, doseId).run()

  const updated = await c.env.DB.prepare(
    'SELECT * FROM medication_doses WHERE id = ?'
  ).bind(doseId).first()
  return c.json(updated)
})

// POST /api/doses/:id/skip
medications.post('/doses/:id/skip', async (c) => {
  const userId = c.get('userId')
  const doseId = c.req.param('id')
  const body = await c.req.json<{ skip_reason?: string }>().catch(() => ({} as { skip_reason?: string }))

  const skipDose = await c.env.DB.prepare(
    `SELECT d.id, m.cat_id FROM medication_doses d
     JOIN medications m ON m.id = d.medication_id
     WHERE d.id = ?`
  ).bind(doseId).first<{ id: string; cat_id: string }>()
  if (!skipDose) return c.json({ error: 'Not found' }, 404)
  const skipRole = await getCatRole(c.env.DB, skipDose.cat_id, userId)
  if (!skipRole || !hasRole(skipRole, 'contributor')) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE medication_doses
     SET skipped = 1, skip_reason = ?, administered_at = NULL
     WHERE id = ?`
  ).bind(body.skip_reason?.trim().slice(0, 500) ?? null, doseId).run()

  const updated = await c.env.DB.prepare(
    'SELECT * FROM medication_doses WHERE id = ?'
  ).bind(doseId).first()
  return c.json(updated)
})

export default medications
