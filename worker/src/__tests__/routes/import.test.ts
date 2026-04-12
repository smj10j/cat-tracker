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
