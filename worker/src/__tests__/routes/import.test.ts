import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

describe('POST /api/import', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('imports cats and measurements from CSV', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const csv = `date,cat_name,type,value,unit
1/15/2026,Luna,weight,9.4,lbs
1/16/2026,Luna,weight,9.5,lbs`

    const res = await SELF.fetch('http://localhost/api/import', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'text/plain' },
      body: csv,
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; errors: string[] }
    expect(data.imported).toBeGreaterThan(0)

    // Verify cat was created
    const cats = await env.DB.prepare('SELECT * FROM cats WHERE name = ?').bind('Luna').all()
    expect(cats.results.length).toBe(1)
  })

  it('returns 401 without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'cat_name,date,type,value,unit\nTest,2026-01-01,weight,10,lbs',
    })
    expect(res.status).toBe(401)
  })

  it('returns 413 for oversized body', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    // Create a body larger than 1 MB
    const bigBody = 'cat_name,date,type,value,unit\n' + 'a'.repeat(1024 * 1024 + 1)

    const res = await SELF.fetch('http://localhost/api/import', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'text/plain' },
      body: bigBody,
    })
    expect(res.status).toBe(413)
  })

  it('handles empty CSV gracefully', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)

    const res = await SELF.fetch('http://localhost/api/import', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'text/plain' },
      body: 'cat_name,date,type,value,unit\n',
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number }
    expect(data.imported).toBe(0)
  })
})

describe('POST /api/import — measurement validation parity (WP3a)', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  async function importCsv(session: string, rows: string): Promise<{ status: number; imported: number; errors: string[] }> {
    const res = await SELF.fetch('http://localhost/api/import', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'text/plain' },
      body: `date,cat_name,type,value,unit\n${rows}`,
    })
    const data = await res.json() as { imported: number; errors: string[] }
    return { status: res.status, ...data }
  }

  it('rejects invalid measurement types', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const result = await importCsv(session, '1/15/2026,Luna,banana,9.4,lbs')
    expect(result.imported).toBe(0)
    expect(result.errors.some(e => e.includes('type must be one of'))).toBe(true)
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM measurements').first<{ c: number }>()
    expect(count!.c).toBe(0)
  })

  it('rejects invalid units', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const result = await importCsv(session, '1/15/2026,Luna,weight,9.4,stone')
    expect(result.imported).toBe(0)
    expect(result.errors.some(e => e.includes('unit must be one of'))).toBe(true)
  })

  it('rejects out-of-range values', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const result = await importCsv(session, '1/15/2026,Luna,weight,999,lbs')
    expect(result.imported).toBe(0)
    expect(result.errors.some(e => e.includes('positive number'))).toBe(true)
  })

  it('rejects non-integer scale values but accepts valid ones', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const result = await importCsv(session, '1/15/2026,Luna,grooming,2.5,scale\n1/16/2026,Luna,grooming,2,scale')
    expect(result.imported).toBe(1)
    expect(result.errors.some(e => e.includes('integer 0–3'))).toBe(true)
  })

  it('imports valid rows while rejecting invalid ones in the same file', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const result = await importCsv(session, '1/15/2026,Luna,weight,9.4,lbs\n1/16/2026,Luna,banana,1,lbs')
    expect(result.imported).toBe(1)
    expect(result.errors.length).toBe(1)
  })
})
