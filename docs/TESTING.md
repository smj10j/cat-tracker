# Testing Strategy — Cat Tracker

## Philosophy

Tests exist to prevent regressions, not to achieve arbitrary coverage metrics. Every feature implementation **must** include tests. The test suite is a first-class deliverable, not an afterthought.

## Tooling

| Layer | Framework | Environment |
|-------|-----------|-------------|
| Worker — pure functions | Vitest + `@cloudflare/vitest-pool-workers` | Cloudflare Workers runtime (Miniflare) |
| Worker — API routes | Vitest + `@cloudflare/vitest-pool-workers` + `SELF.fetch` | Cloudflare Workers runtime (Miniflare) |
| Frontend — pure functions | Vitest + jsdom | Node / jsdom |
| Frontend — React components | Vitest + jsdom + `@testing-library/react` | Node / jsdom |

**Why Vitest?** Native ESM, fast, same runner for both packages, first-class Cloudflare integration.

**Why `@cloudflare/vitest-pool-workers`?** Tests run in the actual Workers runtime (not Node.js), giving accurate D1/R2 behavior via Miniflare mocks without network calls.

## Directory Structure

```
worker/
  vitest.config.ts
  src/
    __tests__/
      helpers.ts              # shared seedUser/seedSession/clearDb utilities
      lib/
        household.test.ts     # hasRole, ensureHousehold, getCatRole
        medications.test.ts   # generateDoses, windowEnd90
      routes/
        cats.test.ts          # cats CRUD API (uses SELF.fetch)
        measurements.test.ts  # measurements CRUD API (uses SELF.fetch)

frontend/
  vitest.config.ts
  vitest.setup.ts             # @testing-library/jest-dom matchers
  src/
    __tests__/
      lib/
        healthMetrics.test.ts
        correlations.test.ts
        measurementPresets.test.ts
      components/
        CatAvatar.test.tsx
```

## Naming Conventions

- Test files: `<module>.test.ts` or `<module>.test.tsx`
- Describe blocks: mirror the exported function or route (`describe('hasRole', ...)`, `describe('POST /api/cats', ...)`)
- Test cases: plain English (`it('returns 401 without session')`)
- Helpers: verb-first (`seedUser`, `seedSession`, `clearDb`)

## What to Test

### Always test:
- Input validation / error paths (bad inputs return the right HTTP status and error message)
- Authorization enforcement (viewer cannot write, unauthenticated gets 401)
- Core happy path (feature works correctly with valid data)
- Edge cases that have caused or could cause bugs

### Skip:
- Third-party library behavior (Hono routing, React rendering internals)
- Implementation details that could change (SQL query text, intermediate variable names)
- UI pixel-perfect rendering

## Worker Test Patterns

### Pure functions (no D1 needed)

```ts
import { describe, it, expect } from 'vitest'
import { hasRole } from '../../lib/household'

describe('hasRole', () => {
  it('viewer cannot access contributor-level routes', () => {
    expect(hasRole('viewer', 'contributor')).toBe(false)
  })
})
```

### D1-dependent tests

```ts
import { env } from 'cloudflare:test'
import { beforeAll, beforeEach } from 'vitest'
import { TEST_SCHEMA, clearDb, seedUser, seedSession, authedHeaders } from '../helpers'

describe('POST /api/cats', () => {
  beforeAll(async () => { await env.DB.exec(TEST_SCHEMA) })
  beforeEach(async () => { await clearDb() })

  it('creates a cat with valid data', async () => {
    const user = await seedUser()
    const session = await seedSession(user.id)
    const res = await SELF.fetch('http://localhost/api/cats', {
      method: 'POST',
      headers: { ...authedHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luna', birthdate: '2020-01-01' }),
    })
    expect(res.status).toBe(201)
  })
})
```

**Key rules:**
- `beforeAll`: apply schema (idempotent `CREATE TABLE IF NOT EXISTS`)
- `beforeEach`: clear all data
- Use `SELF.fetch('http://localhost/api/...')` for route tests
- Seed a session and pass `Cookie: session=<id>` for authenticated routes
- Each test file runs in an isolated Worker instance (no cross-file state leakage)

## Frontend Test Patterns

### Pure functions

```ts
import { describe, it, expect } from 'vitest'
import { getPresetLabel } from '../../lib/measurementPresets'

describe('getPresetLabel', () => {
  it('returns the label for a known type and value', () => {
    expect(getPresetLabel('food', 0)).toBe('None')
  })
})
```

### React components

```tsx
import { render, screen } from '@testing-library/react'
import CatAvatar from '../../components/CatAvatar'

it('renders a photo when photoUrl is set', () => {
  render(<CatAvatar photoUrl="https://example.com/cat.jpg" name="Luna" size={56} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cat.jpg')
})
```

## Running Tests

```bash
# Worker
cd worker && npm test            # run once
cd worker && npm run test:watch  # watch mode

# Frontend
cd frontend && npm test
cd frontend && npm run test:watch
```

## Deployment Gate

Tests **must pass** before every deployment. The CLAUDE.md Execution Loop requires running `npm test` in both packages before `wrangler deploy` / `wrangler pages deploy`. A failing test blocks the deploy.

## Adding Tests for New Features

For every new feature or bug fix:

1. Add test file(s) in `src/__tests__/` (worker or frontend as appropriate)
2. Cover: happy path, input validation, authorization checks, edge cases
3. Run `npm test` and fix until all pass
4. Never skip tests to make CI green — fix the code or the test

This requirement is enforced by the CLAUDE.md Execution Loop (step 2.5: "Write tests before committing").
