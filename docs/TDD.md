# Cat Tracker — Technical Design Document

> For the full API specification including request/response shapes and authorization rules, see **[API.md](API.md)**.

## Architecture Overview

```
+-----------------------------------+
|  Cloudflare Pages                 |
|  (React + Vite SPA)               |
|  + Pages Functions (/api/*)       |
+----------------+------------------+
                 | fetch /api/*  (same-origin proxy)
+----------------v------------------+
|  Cloudflare Worker (Hono)         |
|  /api/auth/*                      |
|  /api/cats/* (incl. /:id/photo)   |
|  /api/measurements/*              |
|  /api/medications/* /api/doses/*  |
|  /api/household/*                 |
|  /api/import  /api/health         |
+--------+-----------+--------------+
         | D1        | R2
+--------v----+  +---v--------------------------+
| D1 (SQLite) |  | R2 bucket: cat-tracker-photos|
| cats,       |  | Public URL:                  |
| measurements|  | pub-40305f88ebb54339b47a      |
| users,      |  | 48224f195f92.r2.dev           |
| sessions,   |  | Key scheme: cats/{id}/photo.j|
| households, |  | pg (one object per cat,      |
| medications |  | overwritten on re-upload)    |
+-------------+  +------------------------------+
```

The frontend (Cloudflare Pages) proxies all `/api/*` calls through a Pages Function
(`frontend/functions/api/[[path]].ts`) to the Worker. This keeps the API on the same origin as the
frontend, avoids CORS issues in production, and lets the browser send httpOnly session cookies
automatically.

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRDs/
│   │   ├── REGISTRY.md               # Canonical PRD status tracker — read before any feature work
│   │   ├── PRD-mvp.md
│   │   ├── PRD-features-backlog.md
│   │   ├── PRD-ux-simplification.md
│   │   ├── PRD-health-status-visuals.md
│   │   ├── PRD-measurement-ux.md
│   │   ├── PRD-charts-expansion.md
│   │   ├── PRD-killer-app.md
│   │   ├── PRD-auth.md
│   │   ├── PRD-correlations.md
│   │   ├── PRD-profile-ux.md
│   │   ├── PRD-vet-export.md
│   │   ├── PRD-input-output-metrics.md
│   │   ├── PRD-login-splash.md
│   │   ├── PRD-correlation-descriptions.md
│   │   ├── PRD-microchip-id.md
│   │   └── PRD-profile-clarity.md
│   ├── API.md                        # Full API spec: endpoints, shapes, auth, authorization
│   ├── TDD.md                        # This file — architecture and design decisions
│   └── DESIGN.md                     # Visual design system (Tailwind config, color tokens)
├── worker/               # Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts              # Hono app entry + CORS + route registration + cron handler
│   │   ├── types.ts              # AppEnv type (Bindings + Variables)
│   │   ├── middleware/
│   │   │   └── auth.ts           # requireAuth middleware (validates session cookie)
│   │   ├── routes/
│   │   │   ├── auth.ts           # OAuth login/callback/logout/me/claim-cats
│   │   │   ├── cats.ts           # CRUD for /api/cats
│   │   │   ├── measurements.ts   # CRUD for /api/cats/:id/measurements + /api/measurements/:id
│   │   │   └── import.ts         # POST /api/import (CSV bulk insert)
│   │   └── db/
│   │       └── schema.sql        # D1 schema (source of truth)
│   ├── wrangler.toml
│   └── package.json
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Router + ProtectedRoute wrapper
│   │   ├── pages/
│   │   │   ├── Login.tsx               # Google sign-in splash page
│   │   │   ├── Home.tsx                # Cat list + health badges + claim prompt
│   │   │   ├── CatProfile.tsx          # Per-cat chart, tabs, history timeline, insights
│   │   │   ├── AddEditCat.tsx          # Add/edit/delete cat form
│   │   │   ├── CompareChart.tsx        # Multi-cat comparison chart with type selector
│   │   │   ├── ImportPage.tsx          # CSV upload + preview + confirm
│   │   │   ├── WellnessGuide.tsx       # Cat health reference page
│   │   │   ├── CatHealthGuidance.tsx   # Per-cat health signals + vet thresholds + export link
│   │   │   └── CatExportPage.tsx       # Print-optimized vet visit summary
│   │   ├── components/
│   │   │   ├── WeightChart.tsx         # Recharts line chart; emoji dots per health status
│   │   │   ├── MeasurementChart.tsx    # 0-3 scale chart for behavioral/food/water types
│   │   │   ├── MeasurementForm.tsx     # Inline measurement entry on CatProfile
│   │   │   ├── InsightsPanel.tsx       # Health alerts + collapsible patterns + explore chart
│   │   │   ├── CorrelationChart.tsx    # Normalized dual-line chart with input→output selectors
│   │   │   ├── QuickAdd.tsx            # Bottom sheet for quick measurement logging
│   │   │   ├── PageShell.tsx           # Layout wrapper; owns QuickAdd open state
│   │   │   ├── BottomNav.tsx           # Fixed 3-item bottom nav (Cats | Log | Compare)
│   │   │   ├── CatAvatar.tsx           # Reusable photo/emoji avatar; used in Home, CatProfile, AddEditCat
│   │   │   └── CropModal.tsx           # Full-screen crop/zoom modal; CSS transforms + Canvas extraction
│   │   └── lib/
│   │       ├── api.ts                  # Typed fetch wrappers for all API routes
│   │       ├── healthMetrics.ts        # Vet-threshold health assessment + STATUS_EMOJI/COLORS
│   │       ├── correlations.ts         # Pearson lag correlation; detectCorrelations; describeCorrelation; detectConfluence
│   │       └── measurementPresets.ts   # Preset labels/values for behavioral types (0-3 scale)
│   ├── functions/
│   │   └── api/[[path]].ts       # Pages Function: proxies /api/* to Worker (preserves Set-Cookie)
│   ├── public/
│   │   └── manifest.json         # PWA manifest
│   ├── index.html
│   ├── vite.config.ts            # Dev proxy: /api → localhost:8787
│   ├── tailwind.config.ts
│   └── package.json
├── CLAUDE.md
├── TODO.md
└── .gitignore
```

---

## Database Schema

Schema source of truth: `worker/src/db/schema.sql`

### cats

```sql
CREATE TABLE IF NOT EXISTS cats (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,
  birthdate   TEXT NOT NULL,    -- ISO 8601 date: YYYY-MM-DD
  breed       TEXT,
  coloring    TEXT,
  notes       TEXT,
  photo_url   TEXT,             -- reserved for future R2 photo upload
  sex         TEXT,             -- 'Male' | 'Female' | NULL (unknown)
  user_id     TEXT REFERENCES users(id),  -- NULL = orphaned (pre-auth or unclaimed)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
```

**Orphaned cats:** `user_id IS NULL` cats are readable by any authenticated user but can only be
mutated after being claimed via `POST /api/auth/claim-cats`. See Authorization Model in API.md.

### measurements

```sql
CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id      TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- see Measurement Types below
  value       REAL NOT NULL,    -- numeric for weight; 0–3 integer for behavioral presets
  unit        TEXT NOT NULL,    -- 'lbs' | 'kg' | 'scale'
  measured_at TEXT NOT NULL,    -- ISO 8601 datetime
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_measurements_cat_type
  ON measurements(cat_id, type, measured_at);
```

**Measurement types:**

| type | unit | value |
|------|------|-------|
| `weight` | `lbs` or `kg` | decimal number |
| `food` | `scale` | 0–3 preset (None / Small / Normal / Large) |
| `water` | `scale` | 0–3 preset |
| `litter` | `scale` | 0–3 preset (Normal / Straining / Loose / Not used) |
| `grooming` | `scale` | 0–3 preset (None / Some / Normal / Excessive) |
| `activity` | `scale` | 0–3 preset (None / Low / Normal / High) |
| `vomiting` | `scale` | 0–3 preset (None / Once / Multiple / Severe) |

Preset label mappings live in `frontend/src/lib/measurementPresets.ts`.

### users

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,    -- 'google'
  oauth_id        TEXT NOT NULL,    -- stable provider user ID
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);
```

### sessions

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,    -- rolling 7-day TTL, refreshed on each authenticated request
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

A cron job runs daily at 03:00 UTC to purge expired sessions:
`DELETE FROM sessions WHERE expires_at < datetime('now')`

### oauth_states

```sql
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,   -- random token
  expires_at  TEXT NOT NULL       -- 5-minute TTL
);
```

Used during the Google OAuth flow to prevent CSRF. State is stored in D1 rather than a cookie
because `Set-Cookie` on redirect responses was being silently dropped by the Pages proxy.

---

## Frontend Routing

React Router v6, client-side. All routes require authentication via `ProtectedRoute`; unauthenticated users are redirected to `/login`.

| Route | Component | Notes |
|-------|-----------|-------|
| `/login` | `Login` | Google sign-in splash; redirect to `/` if already authenticated |
| `/` | `Home` | Cat list with health status badges; claim-orphaned-cats prompt |
| `/cats/new` | `AddEditCat` | Add cat form |
| `/cats/:id` | `CatProfile` | Per-cat charts, history timeline, InsightsPanel |
| `/cats/:id/edit` | `AddEditCat` | Edit + delete cat |
| `/cats/:id/health` | `CatHealthGuidance` | Health signals, vet thresholds, export link |
| `/cats/:id/export` | `CatExportPage` | Print-optimized vet visit summary |
| `/compare` | `CompareChart` | Multi-cat chart with type selector |
| `/import` | `ImportPage` | CSV upload + preview + confirm |
| `/wellness` | `WellnessGuide` | Static cat health reference cards |

All routes except `/login` are wrapped in `PageShell`, which renders `BottomNav` (3 items: Cats | Log | Compare) and owns the `QuickAdd` open state.

---

## Key Design Decisions

### Measurements table is intentionally generic

`type` + `value` + `unit` handles both numeric measurements (weight in lbs/kg) and ordinal
behavioral scales (0–3 integer, `unit='scale'`). No schema changes are required to add a new
measurement type — only frontend changes (form, chart, presets).

### Authorization: 404 not 403 for ownership failures

When a user requests a resource that exists but belongs to another user, the API returns `404 Not Found`, not `403 Forbidden`. This avoids leaking information about whether a resource exists. The only exception is 401 (unauthenticated), which is returned before any resource lookup.

### Orphaned cats: read-only until claimed

Pre-auth cats and any cats with `user_id IS NULL` are readable by any authenticated user but
immutable. This allows a smooth transition for early users. The `claim-cats` endpoint mass-assigns
all orphaned cats to the requesting user in one call.

### OAuth state in D1, not cookies

During the OAuth redirect flow, the Pages proxy performs an opaque redirect when the Worker returns
a `302`. `Set-Cookie` headers on opaque redirects were being silently dropped by the proxy. Moving
state storage to D1 (with a 5-minute TTL) eliminates the need for a state cookie entirely.

### Pages proxy preserves Set-Cookie on redirects

`frontend/functions/api/[[path]].ts` uses `fetch(request, { redirect: 'manual' })` and
explicitly reconstructs 3xx responses as `new Response(null, { status, headers })`. This is
necessary because `Response.redirect()` strips custom headers including `Set-Cookie` from redirect
responses.

### Correlations are frontend-only

The Pearson lag correlation engine (`correlations.ts`) runs entirely in the browser. No new API
endpoints are needed — the frontend fetches all measurements for a cat and computes correlations
client-side. This keeps the Worker simple and avoids storing derived data.

### Cat IDs are random hex, not auto-increment

`DEFAULT (lower(hex(randomblob(8))))` generates an 8-byte (16 hex char) random ID. This avoids
sequential IDs that leak row counts and makes IDs safe to expose in URLs.

---

## Auth Flow (step by step)

1. User on `/login` clicks "Continue with Google" → browser navigates to `GET /api/auth/login`
2. Worker generates `state` token, writes to `oauth_states` with 5-minute TTL, redirects to Google
3. Pages proxy reconstructs the `302` response explicitly so headers pass through
4. Google redirects to `cat-tracker.pages.dev/api/auth/callback?code=...&state=...`
5. Pages proxy forwards to Worker
6. Worker: verifies `state` exists in `oauth_states` (and hasn't expired), exchanges `code` for
   Google access token, fetches Google user profile, upserts into `users`, creates `sessions` row
7. Worker returns `302` to `/` with `Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax`
8. Pages proxy reconstructs the `302`; browser sets cookie on `cat-tracker.pages.dev` and follows
   redirect to `/`
9. All subsequent API calls include the cookie; `requireAuth` middleware validates against `sessions`

---

## QuickAdd Flow

1. User taps the center "Log" button in `BottomNav`
2. `PageShell` sets `quickAddOpen = true`, renders `<QuickAdd open onClose=... />`
3. User picks cat + measurement type + value (preset buttons or numeric input); taps save
4. `createMeasurement()` API call; on success fires `window.dispatchEvent(new CustomEvent('measurementAdded'))`
5. `Home` and `CatProfile` both listen for this event and re-fetch their measurement data

---

## Correlation Engine

`frontend/src/lib/correlations.ts`

- **Algorithm:** Pearson correlation with lag (0–4 weeks). Input measurements are bucketed into
  weekly averages. Minimum 4 aligned weekly buckets required.
- **Known pairs:** 5 hardcoded input→outcome pairs checked (e.g., food→weight, water→vomiting).
  Input types: `food, water, grooming, activity, play`. Outcome types: `weight, vomiting, litter`.
- **Strength thresholds:** |r| ≥ 0.6 = "notable"; |r| ≥ 0.4 = "moderate"; below = "none".
- **Confluence detection:** Two hardcoded clinical clusters — kidney/thyroid/DM signals, systemic
  illness signals. Triggered when two or more cluster-specific correlations are detected.
- **Descriptions:** `describeCorrelation(result, catName, catSex, mode)` with `mode: 'owner' | 'vet'`.
  Owner mode: plain-language clinical context with gendered pronouns.
  Vet mode: r-value, lag, data weeks, clinical differentials.

---

## Deployment

### Worker

```bash
cd worker && npx wrangler deploy
```

### Frontend + Pages Functions

```bash
cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

**Must run from `frontend/` directory.** Running from project root doesn't pick up the
`functions/` directory correctly.

### DB migrations

After schema changes, apply the migration to production:

```bash
cd worker && npx wrangler d1 execute cat-tracker-db --remote --file=src/db/schema.sql
```

Use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` to keep migrations idempotent.

### Cloudflare Resources

| Resource | Name | ID |
|----------|------|----|
| Worker | `cat-tracker-api` | — |
| Pages project | `cat-tracker` | — |
| D1 database | `cat-tracker-db` | `9c923aa8-47a3-4029-b07f-3b67d208f9e6` |
| Account | stevej-67b | `67ba5425d0189fa7d4cf1ada3239e058` |

---

## Key Dependencies

### Worker
- `hono` — lightweight routing framework for Cloudflare Workers
- `@cloudflare/workers-types` — TypeScript types for Worker APIs

### Frontend
- `react`, `react-dom`, `react-router-dom` v6
- `recharts` — LineChart, AreaChart, ResponsiveContainer
- `tailwindcss` with custom `brand-*` color scale and dark glass design tokens
- `vite`

### TypeScript Config (both packages)
- `strict: true`
- `noUnusedLocals`, `noUnusedParameters`
- `noUncheckedIndexedAccess` style — always null-check array accesses
- Worker uses `bundler` module resolution; frontend uses standard Vite config
