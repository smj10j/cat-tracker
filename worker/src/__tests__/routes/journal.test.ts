import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applySchema, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

async function makeCat(session: string, name = 'Luna'): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/cats', {
    method: 'POST',
    headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, birthdate: '2020-01-01' }),
  })
  return (await res.json() as { id: string }).id
}

const jsonHeaders = (session: string) => ({ ...authedHeaders(session), 'Content-Type': 'application/json' })

describe('Journal — create + list', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  it('creates an entry and lists it with parsed tags + author name', async () => {
    const user = await seedUser({ display_name: 'Sam' })
    const session = await seedSession(user.id)
    const catId = await makeCat(session)

    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'Hiding under the bed since morning', tags: ['hiding', 'low_energy'] }),
    })
    expect(res.status).toBe(201)
    const entry = await res.json() as { id: string; tags: string[]; text: string; author_name: string | null }
    expect(entry.tags).toEqual(['hiding', 'low_energy'])
    expect(entry.author_name).toBe('Sam')

    const listRes = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, { headers: authedHeaders(session) })
    const list = await listRes.json() as Array<{ id: string; tags: string[] | null; author_name: string | null }>
    expect(list).toHaveLength(1)
    expect(list[0]!.tags).toEqual(['hiding', 'low_energy'])
    expect(list[0]!.author_name).toBe('Sam')
  })

  it('rejects an unknown tag with 400', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'x', tags: ['depression'] }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects text over 2000 chars and empty text with 400', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const tooLong = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'a'.repeat(2001) }),
    })
    expect(tooLong.status).toBe(400)
    const empty = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: '   ' }),
    })
    expect(empty.status).toBe(400)
  })

  it('rejects a future occurred_at with 400', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const future = new Date(Date.now() + 7 * 86400000).toISOString()
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: future, text: 'time traveler' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects notes on a deceased cat with 403', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    await SELF.fetch(`http://localhost/api/cats/${catId}`, {
      method: 'PUT', headers: jsonHeaders(session), body: JSON.stringify({ deceased_at: '2026-06-01' }),
    })
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'note' }),
    })
    expect(res.status).toBe(403)
  })

  it("rejects another household's cat with 404", async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const stranger = await seedUser({ id: 'user-2', email: 'stranger@example.com', oauth_id: 'google-456' })
    const strangerSession = await seedSession(stranger.id, 'session-2')
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(strangerSession),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'intruder' }),
    })
    expect(res.status).toBe(404)
  })

  it('filters the list by tag', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'limping today', tags: ['limping'] }),
    })
    await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-02 09:00:00', text: 'good day', tags: ['good_day'] }),
    })
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal?tag=limping`, { headers: authedHeaders(session) })
    const list = await res.json() as Array<{ text: string }>
    expect(list).toHaveLength(1)
    expect(list[0]!.text).toBe('limping today')
  })
})

describe('Journal — update + delete', () => {
  beforeAll(async () => { await applySchema() })
  beforeEach(async () => { await clearDb() })

  async function seedEntry(session: string, catId: string): Promise<string> {
    const res = await SELF.fetch(`http://localhost/api/cats/${catId}/journal`, {
      method: 'POST', headers: jsonHeaders(session),
      body: JSON.stringify({ occurred_at: '2026-07-01 09:00:00', text: 'original', tags: ['hiding'] }),
    })
    return (await res.json() as { id: string }).id
  }

  it('updates an entry (author)', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const entryId = await seedEntry(session, catId)

    const res = await SELF.fetch(`http://localhost/api/journal/${entryId}`, {
      method: 'PUT', headers: jsonHeaders(session),
      body: JSON.stringify({ text: 'edited', tags: ['limping'] }),
    })
    expect(res.status).toBe(200)
    const updated = await res.json() as { text: string; tags: string[] }
    expect(updated.text).toBe('edited')
    expect(updated.tags).toEqual(['limping'])
  })

  it('deletes an entry (author) and it disappears from the list', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const entryId = await seedEntry(session, catId)

    const del = await SELF.fetch(`http://localhost/api/journal/${entryId}`, { method: 'DELETE', headers: authedHeaders(session) })
    expect(del.status).toBe(200)
    const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM journal_entries WHERE cat_id = ?').bind(catId).first<{ n: number }>()
    expect(remaining!.n).toBe(0)
  })

  it("rejects delete of another household's entry with 404", async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const catId = await makeCat(session)
    const entryId = await seedEntry(session, catId)

    const stranger = await seedUser({ id: 'user-2', email: 'stranger@example.com', oauth_id: 'google-456' })
    const strangerSession = await seedSession(stranger.id, 'session-2')
    const res = await SELF.fetch(`http://localhost/api/journal/${entryId}`, { method: 'DELETE', headers: authedHeaders(strangerSession) })
    expect(res.status).toBe(404)
  })
})
