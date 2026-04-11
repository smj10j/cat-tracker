# Cat Tracker — Web Architecture TDD

> For the full API specification including request/response shapes and authorization rules, see **[API.md](../API.md)**.

This document covers the current production architecture: Cloudflare Worker API + D1 + R2 + React/Vite SPA hosted on Cloudflare Pages.

For the cross-platform (iOS / Android / web unified) architecture plan, see **[cross-platform.md](cross-platform.md)**.

---

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
│   ├── TDD/
│   │   ├── README.md                 # TDD index — start here
│   │   ├── web.md                    # This file
│   │   └── cross-platform.md        # iOS/Android/web unified plan
│   ├── API.md                        # Full API spec: endpoints, shapes, auth, authorization
│   ├── TDD.md                        # Deprecated — see docs/TDD/web.md
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
│   │   │   ├── medications.ts    # CRUD for /api/medications; dose generation; notifications
│   │   │   ├── household.ts      # Household sharing: members, invites, roles
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
│   │   │   ├── LoginPage.tsx           # Google sign-in splash page
│   │   │   ├── Home.tsx                # Cat list + health badges + claim prompt
│   │   │   ├── CatProfile.tsx          # Per-cat chart, tabs, history timeline, insights
│   │   │   ├── AddEditCat.tsx          # Add/edit/delete cat form
│   │   │   ├── CompareChart.tsx        # Multi-cat comparison chart with type selector
│   │   │   ├── ImportPage.tsx          # CSV upload + preview + confirm
│   │   │   ├── WellnessGuide.tsx       # Cat health reference page
│   │   │   ├── CatHealthGuidance.tsx   # Per-cat health signals + vet thresholds + export link
│   │   │   ├── CatExportPage.tsx       # Print-optimized vet visit summary
│   │   │   ├── HouseholdPage.tsx       # Household settings + member management
│   │   │   ├── NotificationsPage.tsx   # Medication notification inbox
│   │   │   ├── MedicationFormPage.tsx  # Add/edit care schedule items
│   │   │   └── InvitePage.tsx          # Household invite acceptance
│   │   ├── components/
│   │   │   ├── WeightChart.tsx         # Recharts line chart; emoji dots per health status; range selector
│   │   │   ├── MeasurementChart.tsx    # 0-3 scale chart for behavioral/food/water types; range selector
│   │   │   ├── ChartRangeSelector.tsx  # Time range pill bar (1W/1M/3M/6M/1Y/All) + nav chevrons + Today pill
│   │   │   ├── SwipeableChart.tsx      # Touch gesture wrapper for chart swipe navigation
│   │   │   ├── MeasurementForm.tsx     # Inline measurement entry on CatProfile
│   │   │   ├── InsightsPanel.tsx       # Health alerts + collapsible patterns + explore chart
│   │   │   ├── CorrelationChart.tsx    # Normalized dual-line chart with input→output selectors
│   │   │   ├── QuickAdd.tsx            # Bottom sheet for quick measurement logging
│   │   │   ├── PageShell.tsx           # Layout wrapper; owns QuickAdd open state
│   │   │   ├── BottomNav.tsx           # Fixed 3-item bottom nav (Cats | Log | Compare)
│   │   │   ├── CatAvatar.tsx           # Reusable photo/emoji avatar
│   │   │   └── CropModal.tsx           # Full-screen crop/zoom modal; CSS transforms + Canvas
│   │   └── lib/
│   │       ├── api.ts                  # Typed fetch wrappers for all API routes
│   │       ├── healthMetrics.ts        # Vet-threshold health assessment + STATUS_EMOJI/COLORS
│   │       ├── correlations.ts         # Pearson lag correlation; detectCorrelations; detectConfluence
│   │       ├── measurementPresets.ts   # Preset labels/values for behavioral types (0-3 scale)
│   │       └── useChartWindow.ts       # React hook: time range state, window filtering, swipe nav
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
  photo_url   TEXT,
  sex         TEXT,             -- 'Male' | 'Female' | NULL (unknown)
  is_neutered INTEGER,          -- 0 | 1 | NULL (unknown)
  microchip_id TEXT,
  user_id     TEXT REFERENCES users(id),
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

A cron job runs daily at 03:00 UTC to purge expired sessions.

### oauth_states

```sql
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,   -- random token
  expires_at  TEXT NOT NULL       -- 5-minute TTL
);
```

### households, household_members, household_invites

See `worker/src/db/schema.sql` for the full household schema. Households own cats; members have
roles (Viewer / Contributor / Editor / Admin); invites are email-based via Resend.

### medications, medication_doses

See `worker/src/db/schema.sql`. Medications have frequency and reminder_time; doses are pre-generated
in a 90-day rolling window via cron. `due_at` stored as `YYYY-MM-DD HH:MM:00` (space separator,
SQLite datetime format).

---

## Frontend Routing

React Router v6, client-side. All routes require authentication via `ProtectedRoute`.

| Route | Component | Notes |
|-------|-----------|-------|
| `/login` | `LoginPage` | Google sign-in splash; redirect to `/` if already authenticated |
| `/` | `Home` | Cat list with health status badges; claim-orphaned-cats prompt |
| `/cats/new` | `AddEditCat` | Add cat form |
| `/cats/:id` | `CatProfile` | Per-cat charts, history timeline, InsightsPanel; 3 tabs: Health/Care/About |
| `/cats/:id/edit` | `AddEditCat` | Edit + delete cat |
| `/cats/:id/health` | `CatHealthGuidance` | Health signals, vet thresholds, export link |
| `/cats/:id/export` | `CatExportPage` | Print-optimized vet visit summary |
| `/cats/:id/medications/new` | `MedicationFormPage` | Add care item |
| `/medications/:id/edit` | `MedicationFormPage` | Edit care item |
| `/compare` | `CompareChart` | Multi-cat chart with type selector |
| `/import` | `ImportPage` | CSV upload + preview + confirm |
| `/wellness` | `WellnessGuide` | Static cat health reference cards |
| `/household` | `HouseholdPage` | Household settings + member management |
| `/notifications` | `NotificationsPage` | Medication notification inbox |
| `/invite` | `InvitePage` | Household invite acceptance |

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
immutable. The `claim-cats` endpoint mass-assigns all orphaned cats to the requesting user.

### OAuth state in D1, not cookies

During the OAuth redirect flow, `Set-Cookie` on opaque redirect responses was being silently dropped
by the Pages proxy. Moving state storage to D1 (5-minute TTL) eliminates the need for a state cookie.

### Pages proxy preserves Set-Cookie on redirects

`frontend/functions/api/[[path]].ts` uses `fetch(request, { redirect: 'manual' })` and explicitly
reconstructs 3xx responses as `new Response(null, { status, headers })`. `Response.redirect()` strips
custom headers including `Set-Cookie`.

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
6. Worker: verifies `state`, exchanges `code` for Google token, fetches profile, upserts `users`, creates `sessions` row
7. Worker returns `302` to `/` with `Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax`
8. Pages proxy reconstructs the `302`; browser sets cookie and follows redirect to `/`
9. All subsequent API calls include the cookie; `requireAuth` middleware validates against `sessions`

---

## QuickAdd Flow

1. User taps the center "Log" button in `BottomNav`
2. `PageShell` sets `quickAddOpen = true`, renders `<QuickAdd open onClose=... />`
3. User picks cat + measurement type + value; taps save
4. `createMeasurement()` API call; on success fires `window.dispatchEvent(new CustomEvent('measurementAdded'))`
5. `Home` and `CatProfile` both listen for this event and re-fetch

---

## Correlation Engine

`frontend/src/lib/correlations.ts`

- **Algorithm:** Pearson correlation with lag (0–4 weeks). Input measurements are bucketed into
  weekly averages. Minimum 4 aligned weekly buckets required.
- **Known pairs:** 5 hardcoded input→outcome pairs (food→weight, water→vomiting, etc.).
- **Strength thresholds:** |r| ≥ 0.6 = "notable"; |r| ≥ 0.4 = "moderate"; below = "none".
- **Confluence detection:** Two clinical clusters — kidney/thyroid/DM signals; systemic illness.
- **Descriptions:** `describeCorrelation(result, catName, catSex, mode)` with `mode: 'owner' | 'vet'`.

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

**Must run from `frontend/` directory.** Running from project root doesn't pick up the `functions/` directory correctly.

### DB migrations

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
| R2 bucket | `cat-tracker-photos` | Public: `pub-40305f88ebb54339b47a48224f195f92.r2.dev` |
| KV namespace | `cat-tracker-config` | `7fc5a67f7e774458a99bf41dc7fe761c` |
| Account | stevej-67b | `67ba5425d0189fa7d4cf1ada3239e058` |

---

## External Service Dependencies

### Cloudflare (hosting + infrastructure)

| Service | Resource name | Detail |
|---------|--------------|--------|
| Pages | `cat-tracker` | Hosts React SPA + Pages Functions proxy |
| Workers | `cat-tracker-api` | Runs the Hono API |
| D1 | `cat-tracker-db` | `9c923aa8-47a3-4029-b07f-3b67d208f9e6` |
| R2 | `cat-tracker-photos` | Public: `pub-40305f88ebb54339b47a48224f195f92.r2.dev` |

### Google OAuth

- **Console:** Google Cloud Console, project linked to stevej account
- **Authorized redirect URI:** `https://cat-tracker.pages.dev/api/auth/callback`
- **Worker secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Resend (transactional email)

- **From address:** `noreply@01j.me` (verified domain)
- **Worker secret:** `RESEND_API_KEY`
- **Helper:** `worker/src/lib/email.ts`

---

## Key Dependencies

### Worker
- `hono` — routing framework for Cloudflare Workers
- `@cloudflare/workers-types` — TypeScript types for Worker APIs

### Frontend
- `react`, `react-dom`, `react-router-dom` v6
- `recharts` — LineChart, AreaChart, ResponsiveContainer
- `tailwindcss` with custom `brand-*` color scale
- `vite`

### TypeScript Config (both packages)
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- `noUncheckedIndexedAccess` style — always null-check array accesses
- Worker uses `bundler` module resolution; frontend uses standard Vite config
