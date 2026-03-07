# Cat Tracker — Technical Design Document

## Architecture Overview

```
+-----------------------------------+
|  Cloudflare Pages                 |
|  (React + Vite SPA)               |
|  /  /cats/:id  /cats/new          |
|  /compare  /import  /wellness     |
+----------------+------------------+
                 | fetch /api/*
+----------------v------------------+
|  Cloudflare Worker (Hono)         |
|  /api/cats                        |
|  /api/cats/:id                    |
|  /api/cats/:id/measurements       |
|  /api/measurements/:id            |
|  /api/import                      |
|  /api/health                      |
+----------------+------------------+
                 | D1 binding
+----------------v------------------+
|  Cloudflare D1 (SQLite)           |
|  cats, measurements tables        |
+-----------------------------------+
```

The frontend (Cloudflare Pages) proxies API calls to the Worker via a Pages Function (`frontend/functions/api/[[path]].ts`) that forwards `/api/*` requests to the Worker URL. This avoids CORS issues and keeps the API path clean.

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRDs/
│   │   ├── REGISTRY.md               # Canonical PRD status tracker
│   │   ├── PRD-mvp.md
│   │   ├── PRD-features-backlog.md
│   │   ├── PRD-ux-simplification.md
│   │   ├── PRD-health-status-visuals.md
│   │   ├── PRD-measurement-ux.md
│   │   ├── PRD-charts-expansion.md
│   │   ├── PRD-killer-app.md
│   │   └── PRD-auth.md
│   ├── TDD.md
│   └── DESIGN.md
├── worker/               # Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts      # Worker entry + Hono app + CORS
│   │   ├── routes/
│   │   │   ├── cats.ts           # CRUD for /api/cats
│   │   │   ├── measurements.ts   # CRUD for /api/measurements
│   │   │   └── import.ts         # POST /api/import (CSV bulk insert)
│   │   └── db/
│   │       └── schema.sql        # D1 schema
│   ├── wrangler.toml
│   └── package.json
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Cat list + wellness link
│   │   │   ├── CatProfile.tsx      # Per-cat chart, tabs, health alerts
│   │   │   ├── AddEditCat.tsx      # Add/edit cat form
│   │   │   ├── CompareChart.tsx    # Multi-cat comparison chart
│   │   │   ├── ImportPage.tsx      # CSV upload/preview/import
│   │   │   └── WellnessGuide.tsx   # Cat health reference page
│   │   ├── components/
│   │   │   ├── WeightChart.tsx       # Recharts chart; emoji dots per health status
│   │   │   ├── MeasurementChart.tsx  # 0-3 scale chart for behavioral types
│   │   │   ├── MeasurementForm.tsx   # Inline measurement entry form (on CatProfile)
│   │   │   ├── QuickAdd.tsx          # Bottom sheet for quick measurement logging
│   │   │   ├── PageShell.tsx         # Layout wrapper; owns QuickAdd open state
│   │   │   └── BottomNav.tsx         # Fixed bottom nav (Home / Compare / Log)
│   │   └── lib/
│   │       ├── api.ts                # Typed fetch wrappers for all API routes
│   │       ├── healthMetrics.ts      # Vet-threshold health assessment + STATUS_EMOJI
│   │       └── measurementPresets.ts # Preset labels/values for behavioral types
│   ├── functions/
│   │   └── api/[[path]].ts   # Pages Function: proxies /api/* to Worker
│   ├── public/
│   │   └── manifest.json     # PWA manifest
│   ├── index.html
│   ├── vite.config.ts        # Dev proxy: /api -> localhost:8787
│   ├── tailwind.config.ts
│   └── package.json
├── CLAUDE.md
├── TODO.md
└── .gitignore
```

---

## Database Schema (D1 / SQLite)

```sql
CREATE TABLE IF NOT EXISTS cats (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,
  birthdate   TEXT NOT NULL,          -- ISO 8601 date: YYYY-MM-DD
  breed       TEXT,
  coloring    TEXT,
  notes       TEXT,
  photo_url   TEXT,                   -- reserved for future R2 upload
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id      TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,      -- 'weight' | 'food' | 'water' | 'litter' | 'grooming' | 'activity' | 'vomiting'
  value       REAL NOT NULL,      -- numeric for weight; 0-3 integer for behavioral presets
  unit        TEXT NOT NULL,      -- 'lbs' | 'kg' | 'scale'
  measured_at TEXT NOT NULL,      -- ISO 8601 datetime
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_measurements_cat_type
  ON measurements(cat_id, type, measured_at);
```

Behavioral measurement types (`food`, `water`, `litter`, `grooming`, `activity`, `vomiting`) store a 0–3 integer value with `unit='scale'`. The label mapping lives in `frontend/src/lib/measurementPresets.ts`.

Auth tables (added in auth sprint):

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,   -- 'google'
  oauth_id        TEXT NOT NULL,   -- provider's stable user ID
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Short-lived OAuth state tokens (5min TTL) stored server-side
-- because Set-Cookie headers don't survive the Pages proxy redirect
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);

-- One-time migration: ALTER TABLE cats ADD COLUMN user_id TEXT REFERENCES users(id);
```

---

## API Design

Base path: `/api`

### Cats

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cats | List all cats |
| POST | /api/cats | Create a cat |
| GET | /api/cats/:id | Get a cat |
| PUT | /api/cats/:id | Update a cat |
| DELETE | /api/cats/:id | Delete a cat (cascades measurements) |

### Measurements

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cats/:id/measurements | List measurements (optional ?type=weight) |
| POST | /api/cats/:id/measurements | Add a measurement |
| DELETE | /api/measurements/:id | Delete a measurement |

### Import

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/import | Bulk import cats + measurements from CSV |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/login?provider=google | Redirect to Google OAuth consent |
| GET | /api/auth/callback | Exchange code, create session, set cookie |
| POST | /api/auth/logout | Delete session, clear cookie |
| GET | /api/auth/me | Return current user + hasOrphanedCats flag |
| POST | /api/auth/claim-cats | Assign orphaned cats (user_id IS NULL) to current user |

### Request/Response shapes

**Cat (POST/PUT body)**
```json
{
  "name": "Luna",
  "birthdate": "2020-03-15",
  "breed": "Domestic Shorthair",
  "coloring": "Tabby",
  "notes": "Very fluffy",
  "photo_url": null
}
```

**Measurement (POST body)**
```json
{
  "type": "weight",
  "value": 9.2,
  "unit": "lbs",
  "measured_at": "2024-01-15T10:30:00Z",
  "notes": "Morning before breakfast"
}
```

**Behavioral measurement (POST body)**
```json
{
  "type": "litter",
  "value": 2,
  "unit": "scale",
  "measured_at": "2024-01-15T10:30:00Z",
  "notes": null
}
```

---

## Frontend Routing

Using React Router v6 (client-side):

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Home` | Cat list with health status badges; wellness guide link |
| `/cats/new` | `AddEditCat` | Add cat form (with CSV import link) |
| `/cats/:id` | `CatProfile` | Cat profile + tabbed charts + measurements |
| `/cats/:id/edit` | `AddEditCat` | Edit cat form |
| `/compare` | `CompareChart` | Multi-cat chart with type selector |
| `/import` | `ImportPage` | CSV file upload, preview, confirm |
| `/wellness` | `WellnessGuide` | Cat health reference cards |

All routes are wrapped in `PageShell`, which renders the `BottomNav` and manages `QuickAdd` open state.

---

## Key Frontend Patterns

### Measurement presets

`frontend/src/lib/measurementPresets.ts` defines a `PRESETS` map from type string to `Array<{ value: number, label: string, concern?: boolean }>`. The `PRESET_TYPES` Set lists all types that use preset buttons instead of numeric input. `getPresetLabel(type, value)` maps a stored 0–3 integer back to a display string.

### Health assessment

`frontend/src/lib/healthMetrics.ts` exports `assessHealth(measurements[])` which returns `{ overallStatus, periods }`. Each period has a `status` of `'ok' | 'watch' | 'concerning' | 'urgent'`. The `STATUS_EMOJI` map renders the appropriate emoji on chart dots and cat cards.

### Auth flow

1. User on `/login` clicks "Continue with Google" → browser navigates to `/api/auth/login`
2. Pages proxy forwards to Worker; Worker writes state to `oauth_states` D1 table and returns a `302` to `accounts.google.com`
3. Proxy reconstructs the `302` as `new Response(null, {status:302, headers})` so the browser processes it correctly
4. Browser follows redirect to Google OAuth consent screen
5. Google redirects to `cat-tracker.pages.dev/api/auth/callback?code=...&state=...`
6. Proxy forwards to Worker; Worker verifies state in D1, exchanges code for access token, fetches Google profile, upserts user, creates session
7. Worker returns `302` to `/` with `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax`
8. Proxy reconstructs the `302` → browser sets session cookie on `cat-tracker.pages.dev` and follows redirect to home
9. All subsequent API calls include the cookie automatically; `requireAuth` middleware validates it against D1 sessions

Key: OAuth state is stored in D1, not a cookie, because `Set-Cookie` on redirect responses was being suppressed by the opaque-redirect proxy behavior.

### QuickAdd flow

1. User taps the "Log" pill in `BottomNav`
2. `PageShell` sets `quickAddOpen = true` and renders `<QuickAdd open onClose=... />`
3. User selects cat + type; taps preset or enters weight; hits save
4. `createMeasurement()` is called; on success, fires `window.dispatchEvent(new CustomEvent('measurementAdded'))`
5. `Home` and `CatProfile` listen for this event and re-fetch

---

## Deployment

### Worker

```toml
# worker/wrangler.toml
name = "cat-tracker-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cat-tracker-db"
database_id = "9c923aa8-47a3-4029-b07f-3b67d208f9e6"
```

### Pages

- Build command: `npm run build` (in `frontend/`)
- Output dir: `dist/`
- API proxy: `frontend/functions/api/[[path]].ts` forwards `/api/*` to Worker
- **Important:** proxy uses `fetch(request, { redirect: 'manual' })` and explicitly reconstructs 3xx responses to preserve `Set-Cookie` headers (required for the OAuth session cookie flow)

### Deploy commands

```bash
# Worker
cd worker && npx wrangler deploy

# Frontend
cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true

# DB migrations (after schema changes)
cd worker && npx wrangler d1 execute cat-tracker-db --remote --file=src/db/schema.sql
```

---

## Key Dependencies

### Worker
- `hono` — lightweight routing framework for Workers
- `@cloudflare/workers-types`

### Frontend
- `react`, `react-dom`, `react-router-dom` v6
- `recharts` — charting (LineChart, ResponsiveContainer, etc.)
- `tailwindcss`
- `vite`

---

## MVP Status

All MVP features are complete and deployed. Current sprint work is in post-MVP phases.

### Implemented
- [x] Project scaffolding (Worker + Frontend)
- [x] D1 schema + migrations
- [x] Worker API: cats + measurements CRUD
- [x] Worker API: CSV bulk import
- [x] Frontend: cat list, add/edit cat, cat profile
- [x] Frontend: add measurement form + QuickAdd bottom sheet
- [x] Frontend: weight chart with emoji health dots
- [x] Frontend: measurement chart (0–3 scale) for behavioral types
- [x] Frontend: multi-cat comparison chart with type selector
- [x] Frontend: behavioral measurement presets
- [x] Frontend: wellness guide page
- [x] Frontend: CSV import page
- [x] Health status assessment logic (vet thresholds)
- [x] PWA manifest
- [x] Deployed to Cloudflare (Pages + Worker)

### Planned (see docs/PRDs/)
- [ ] User accounts + data isolation (PRD-auth.md — under review)
- [ ] Photo upload via R2
- [ ] Vet export / shareable summary
- [ ] Daily check-in screen
