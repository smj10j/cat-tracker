# Testing Strategy — Cat Tracker

## Philosophy

Tests exist to prevent regressions, not to achieve arbitrary coverage metrics. Every feature implementation **must** include tests. The test suite is a first-class deliverable, not an afterthought.

## Tooling

| Layer | Framework | Environment |
|-------|-----------|-------------|
| Shared — pure functions | Vitest | Node (no DOM, no mocking) |
| Worker — pure functions | Vitest + `@cloudflare/vitest-pool-workers` | Cloudflare Workers runtime (Miniflare) |
| Worker — API routes | Vitest + `@cloudflare/vitest-pool-workers` + `SELF.fetch` | Cloudflare Workers runtime (Miniflare) |
| Frontend — pure functions | Vitest + jsdom | Node / jsdom |
| Frontend — React components | Vitest + jsdom + `@testing-library/react` | Node / jsdom |
| App — pure functions | Vitest | Node |
| App — React Native screens | Vitest + jsdom + `@testing-library/react` | Node / jsdom (react-native-web shim) |

**Why Vitest?** Native ESM, fast, same runner for all four packages, first-class Cloudflare integration.

**Why `@cloudflare/vitest-pool-workers`?** Tests run in the actual Workers runtime (not Node.js), giving accurate D1/R2 behavior via Miniflare mocks without network calls.

## Directory Structure

```
shared/
  vitest.config.ts              # environment: 'node', include: __tests__/**/*.test.ts
  __tests__/
    careItemForm.test.ts        # care item form logic (defaults, hydration, validation, payload)
    constants.test.ts           # VALID_MEASUREMENT_TYPES, VALID_UNITS, ROLE_LEVEL, hasRole
    constants-extended.test.ts  # MEASUREMENT_TYPE_LABELS, BEHAVIORAL_TYPES, CHART_LINE_COLORS
    correlations.test.ts        # Pearson lag, detectTrend
    dates.test.ts               # parseLocalDate, formatLocalDate, catAge, localToUTC, utcToLocal
    formatting.test.ts          # formatTimeFromParts, todayLocalDate, buildMeasuredAt, groupByDay, formatNextDue
    formatting-extended.test.ts # roundToHour, toLocalDatetimeString, formatSexNeuter, currentHour
    healthMetrics.test.ts       # weight health status thresholds
    measurementPresets.test.ts  # getPresetLabel, behavioral preset labels
    medicationPresets.test.ts   # MEDICATION_PRESETS, MEDICATION_FREQ_LABELS, formatFrequencyLabel
    preferences.test.ts         # deriveDefaults, convertWeight, formatWeight, formatDate variants
    timezone-formatting.test.ts # timezone-aware formatting (12h/24h, MDY/DMY, localToUTC/utcToLocal)

worker/
  vitest.config.ts              # defineWorkersConfig, wrangler.toml bindings
  src/
    __tests__/
      helpers.ts                # shared seedUser/seedSession/clearDb utilities
      lib/
        household.test.ts       # hasRole, ensureHousehold, getCatRole
        medications.test.ts     # generateDoses, windowEnd90
        push.test.ts            # push notification delivery logic
      routes/
        auth-new.test.ts        # auth registration and login flows
        auth-security.test.ts   # auth security edge cases (token reuse, expiry)
        auth-timezone.test.ts   # timezone handling in auth/session
        cats.test.ts            # cats CRUD API (uses SELF.fetch)
        config.test.ts          # /api/config endpoint
        import.test.ts          # /api/import endpoint
        measurements.test.ts    # measurements CRUD API (uses SELF.fetch)
        medications.test.ts     # medications/care schedule CRUD API
        notifications-timezone.test.ts  # notification delivery with timezone offsets
        security-phase2.test.ts # advanced security (rate limiting, CSRF, etc.)

frontend/
  vitest.config.ts              # jsdom, @vitejs/plugin-react, @shared alias
  vitest.setup.ts               # @testing-library/jest-dom matchers
  src/
    __tests__/
      components/
        CatAvatar.test.tsx      # photo/emoji avatar rendering
        CropModal.test.tsx      # image crop (data: URL, no blob: URL)
        FullScreenReady.test.tsx # full-screen readiness wrapper
        MeasurementForm.test.tsx # measurement input form behavior
      contexts/
        ConfigContext.test.tsx   # ConfigContext provider and consumer
      lib/
        healthMetrics.test.ts   # weight health thresholds (frontend copy)
        useChartWindow.test.ts  # chart time-window hook logic
      pages/
        DailyCheckin.test.tsx   # daily check-in page rendering

app/
  vitest.config.ts              # node default, jsdom for __tests__/screens/**, setup.ts, alias stubs
  __tests__/
    apiClient.test.ts           # X-API-Version header, X-Device-Id, UpgradeRequiredError
    bottomNav.test.tsx          # persistent bottom nav rendering (jsdom, RN mocks)
    careItemValidation.test.ts  # care item form validation and payload construction
    features.test.ts            # push notification lifecycle, timezone sync, deep linking, reminder helpers
    lineChartHelpers.test.ts    # niceScale, data processing for LineChart (pure functions)
    screens/
      setup.ts                  # RN/Expo module mocks, DOM element shims, test fixtures
      smoke.test.tsx            # screen mount smoke tests (every screen renders without crashing)
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
# All four suites (run before every deploy)
cd shared && npm test
cd worker && npm test
cd frontend && npm test
cd app && npm test

# Watch mode (during development)
cd shared && npx vitest --watch
cd worker && npm run test:watch
cd frontend && npm run test:watch
cd app && npx vitest --watch
```

## Deployment Gate

Tests **must pass** in all four suites before every deployment. The CLAUDE.md Execution Loop requires running `npm test` in `shared/`, `worker/`, `frontend/`, and `app/` before `wrangler deploy` / `wrangler pages deploy`. A failing test blocks the deploy.

## Shared Test Patterns

Shared tests cover pure TypeScript functions in `shared/lib/`. No DOM, no mocking, no external dependencies. These run in Node with Vitest's default environment.

```ts
import { describe, it, expect } from 'vitest'
import { parseLocalDate } from '../lib/dates'

describe('parseLocalDate', () => {
  it('parses date-only strings to the correct calendar day', () => {
    const d = parseLocalDate('2021-10-01')
    expect(d.getFullYear()).toBe(2021)
    expect(d.getMonth()).toBe(9) // October is 0-indexed
    expect(d.getDate()).toBe(1)
  })
})
```

**Key rules:**
- Import directly from `../lib/<module>` (relative to `shared/`)
- No DOM APIs, no `jsdom`, no mocking — if a function needs those, it belongs in a platform test
- These tests are the canonical correctness check for cross-platform shared logic

## App Test Patterns

App tests cover the Expo/React Native iOS app. Two patterns coexist:

### Pure functions (node environment)

Tests like `lineChartHelpers.test.ts` and `careItemValidation.test.ts` inline or import pure functions from app components and test them without any rendering. These run in the default Node environment.

```ts
import { describe, it, expect } from 'vitest'

describe('niceScale', () => {
  it('returns a single value when min equals max', () => {
    expect(niceScale(5, 5)).toEqual([5])
  })
})
```

### Screen smoke tests (jsdom environment)

Screen tests in `__tests__/screens/` use `@testing-library/react` with jsdom. React Native and Expo modules are mocked as DOM elements via `setup.ts`, using `react-native-web` style shims. This catches import errors, null references, and render crashes without a native runtime.

```tsx
import React from 'react'
import { render, act } from '@testing-library/react'

async function renderScreen(Component: React.ComponentType<any>) {
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(React.createElement(Component))
  })
  return result!
}
```

**Key rules:**
- `vitest.config.ts` uses `environmentMatchGlobs` to run `__tests__/screens/**` in jsdom and everything else in Node
- `setup.ts` mocks `react-native`, `expo-router`, `expo-secure-store`, and other native modules as DOM elements
- Screen tests verify mount-without-crash, not visual layout or native gestures
- Pure function tests (chart helpers, validation, API client) should NOT use jsdom

### Component regression tests (jsdom via directive)

Tests like `bottomNav.test.tsx` use the `// @vitest-environment jsdom` directive at the top of the file to opt into jsdom without being in the `screens/` directory. They mock React Native components inline and test specific component behavior.

## Adding Tests for New Features

For every new feature or bug fix:

1. Add test file(s) in the appropriate package's `__tests__/` directory:
   - `shared/__tests__/` — for shared pure functions (types, dates, health metrics, correlations, presets)
   - `worker/src/__tests__/` — for API routes and worker-side pure functions
   - `frontend/src/__tests__/` — for web React components and frontend-specific logic
   - `app/__tests__/` — for React Native screens and app-specific logic
2. Cover: happy path, input validation, authorization checks, edge cases
3. Run `npm test` in all four packages and fix until all pass
4. Never skip tests to make CI green — fix the code or the test

This requirement is enforced by the CLAUDE.md Execution Loop (step 2.5: "Write tests before committing").
