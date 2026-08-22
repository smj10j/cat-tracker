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
|  /api/auth/*  /api/config         |
|  /api/cats/* (incl. /:id/photo)   |
|  /api/measurements/*              |
|  /api/medications/* /api/doses/*  |
|  /api/household/*                 |
|  /api/import  /api/health         |
|  Cron: 0 * * * * (hourly)        |
+----+------+----------+-----------+
     | D1   | R2       | KV
+----v------+  +-------v-----------+  +--v-------------------+
| D1 (SQLite)|  | R2: cat-tracker- |  | KV: cat-tracker-     |
| cats,       |  |      photos     |  |      config          |
| measurements|  | Public URL:     |  | Feature flags,       |
| users,      |  | pub-40305f88ebb |  | thresholds,          |
| sessions,   |  | 54339b47a48224f |  | maintenance mode,    |
| households, |  | 195f92.r2.dev   |  | version enforcement  |
| medications,|  | Key: cats/{id}/ |  +----------------------+
| device_tkns,|  | photo.jpg       |
| audit_log,  |  | ?v=ts cache-bust|
| rate_limits |  +------------------+
+-------------+
```

The frontend (Cloudflare Pages) proxies all `/api/*` calls through a Pages Function
(`frontend/functions/api/[[path]].ts`) to the Worker. This keeps the API on the same origin as the
frontend, avoids CORS issues in production, and lets the browser send httpOnly session cookies
automatically.

---

## Project Structure

```
cat-tracker/
├── shared/               # Pure TypeScript shared between frontend/ and app/
│   └── lib/
│       ├── types.ts              # Shared interfaces (Cat, Measurement, User, etc.)
│       ├── correlations.ts       # Pearson lag correlation engine (detectCorrelations, detectConfluence)
│       ├── healthMetrics.ts      # Weight health status thresholds + STATUS_EMOJI/COLORS
│       ├── measurementPresets.ts # Behavioral preset labels (0-3 scale)
│       ├── dates.ts              # Timezone-safe date parsing (parseLocalDate, catAge)
│       ├── preferences.ts        # User preference types and defaults
│       ├── formatting.ts         # Shared formatting helpers
│       └── constants.ts          # App-wide constants
├── docs/
│   ├── PRDs/
│   │   └── REGISTRY.md           # Canonical PRD status tracker — read before any feature work
│   ├── TDD/
│   │   ├── README.md             # TDD index — start here
│   │   ├── web.md                # This file
│   │   └── cross-platform.md    # iOS app architecture (implemented, in TestFlight)
│   ├── research/                 # Veterinary evidence base for healthMetrics.ts
│   │   ├── README.md             # Sourcing standards and process
│   │   ├── weight-thresholds.md  # Citations for every numeric threshold
│   │   ├── behavioral-indicators.md  # Citations for behavioral alert lists
│   │   └── feline-resources.md   # Reference directory (journals, guidelines, orgs)
│   ├── API.md                    # Full API spec: endpoints, shapes, auth, authorization
│   ├── DESIGN.md                 # Visual design system (Tailwind config, color tokens)
│   ├── SECURITY.md               # Security guidelines, principles, architecture model
│   └── TESTING.md                # Test strategy and conventions
├── worker/               # Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts              # Hono app entry + CORS + security headers + API versioning + cron handler
│   │   ├── types.ts              # AppEnv type (Bindings + Variables)
│   │   ├── middleware/
│   │   │   └── auth.ts           # requireAuth middleware (validates session cookie or Bearer token)
│   │   ├── routes/
│   │   │   ├── auth.ts           # OAuth login/callback/logout/me/claim-cats/delete-account/data-export (Google + Apple)
│   │   │   ├── cats.ts           # CRUD for /api/cats, photo upload/delete, memorial
│   │   │   ├── measurements.ts   # CRUD for /api/cats/:id/measurements + /api/measurements/:id
│   │   │   ├── medications.ts    # CRUD for /api/medications; dose generation; push notifications
│   │   │   ├── household.ts      # Household sharing: members, invites, roles
│   │   │   ├── config.ts         # GET /api/config (feature flags, thresholds, maintenance mode from KV)
│   │   │   └── import.ts         # POST /api/import (CSV bulk insert)
│   │   ├── lib/
│   │   │   ├── email.ts          # sendEmail() via Resend API
│   │   │   ├── household.ts      # ensureHousehold() helper
│   │   │   ├── push.ts           # Expo push notification client
│   │   │   ├── apple-auth.ts     # Apple Sign In: client secret generation, ID token verification
│   │   │   └── audit.ts          # logAudit(), checkRateLimit() helpers
│   │   ├── db/
│   │   │   └── schema.sql        # D1 schema (source of truth)
│   │   └── __tests__/            # Vitest tests (cloudflare vitest pool)
│   ├── wrangler.toml
│   └── package.json
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Router + context providers + ProtectedRoute wrapper
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx           # Google sign-in splash page
│   │   │   ├── Home.tsx                # Cat list + health badges + claim prompt
│   │   │   ├── CatProfile.tsx          # Per-cat chart, tabs (Health/Care/About), history timeline, insights
│   │   │   ├── AddEditCat.tsx          # Add/edit/delete cat form
│   │   │   ├── CompareChart.tsx        # Multi-cat comparison chart with type selector
│   │   │   ├── ImportPage.tsx          # CSV upload + preview + confirm
│   │   │   ├── WellnessGuide.tsx       # Cat health reference page
│   │   │   ├── CatHealthGuidance.tsx   # Per-cat health signals + vet thresholds + export link
│   │   │   ├── CatExportPage.tsx       # Print-optimized vet visit summary
│   │   │   ├── HouseholdPage.tsx       # Household settings + member management
│   │   │   ├── NotificationsPage.tsx   # Medication notification inbox
│   │   │   ├── MedicationFormPage.tsx  # Add/edit care schedule items
│   │   │   ├── InvitePage.tsx          # Household invite acceptance
│   │   │   ├── DailyCheckin.tsx        # Quick daily check-in for all cats
│   │   │   ├── SettingsPage.tsx        # Theme toggle + preferences
│   │   │   ├── MemorialPage.tsx        # Deceased cat memorial view
│   │   │   └── PrivacyPage.tsx         # Privacy policy (public, no auth)
│   │   ├── components/
│   │   │   ├── WeightChart.tsx         # Recharts line chart; emoji dots per health status; range selector
│   │   │   ├── MeasurementChart.tsx    # 0-3 scale chart for behavioral/food/water types; range selector
│   │   │   ├── ChartRangeSelector.tsx  # Time range pill bar (1W/1M/3M/6M/1Y/All) + nav chevrons + Today pill
│   │   │   ├── ChartExpandButton.tsx   # Expand-to-fullscreen button for charts
│   │   │   ├── LandscapeChartOverlay.tsx # Landscape-mode fullscreen chart overlay
│   │   │   ├── FullScreenReady.tsx     # Fullscreen readiness wrapper
│   │   │   ├── SwipeableChart.tsx      # Touch gesture wrapper for chart swipe navigation
│   │   │   ├── MeasurementForm.tsx     # Inline measurement entry on CatProfile
│   │   │   ├── InsightsPanel.tsx       # Health alerts + collapsible patterns + explore chart
│   │   │   ├── CorrelationChart.tsx    # Normalized dual-line chart with input→output selectors
│   │   │   ├── QuickAdd.tsx            # Bottom sheet for quick measurement logging
│   │   │   ├── PageShell.tsx           # Layout wrapper; owns QuickAdd open state
│   │   │   ├── BottomNav.tsx           # Fixed 3-item bottom nav (Cats | Log | Compare)
│   │   │   ├── ProtectedRoute.tsx      # Auth guard; redirects to /login if unauthenticated
│   │   │   ├── CatAvatar.tsx           # Reusable photo/emoji avatar
│   │   │   ├── CropModal.tsx           # Full-screen crop/zoom modal; CSS transforms + Canvas
│   │   │   └── ScrollToTop.tsx         # Scrolls to top on route change
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx          # Google OAuth; session management; user state
│   │   │   ├── ThemeContext.tsx         # Dark/light/system theme; CSS var switching
│   │   │   ├── PreferencesContext.tsx   # User preferences (weight unit, etc.)
│   │   │   └── ConfigContext.tsx        # Remote config from /api/config (feature flags, thresholds)
│   │   ├── hooks/
│   │   │   ├── useChartWindow.ts       # React hook: time range state, window filtering, swipe nav
│   │   │   ├── useHealthAssessment.ts  # Hook wrapping health metric calculations
│   │   │   ├── useGoBack.ts            # navigate(-1) with history fallback
│   │   │   └── useKeyboardScroll.ts    # Scrolls focused input into view on mobile keyboard
│   │   └── lib/
│   │       └── api.ts                  # Typed fetch wrappers for all API routes (cookie-based auth)
│   ├── functions/
│   │   └── api/[[path]].ts       # Pages Function: proxies /api/* to Worker (preserves Set-Cookie)
│   ├── public/
│   │   ├── manifest.json         # PWA manifest
│   │   └── _headers              # Cloudflare Pages headers (CSP, etc.)
│   ├── index.html
│   ├── vite.config.ts            # Dev proxy: /api → localhost:8787
│   ├── tailwind.config.ts
│   └── package.json
├── app/                  # Expo/React Native iOS app (Whisker Health)
│   ├── app/              # Expo Router v6 screens
│   ├── lib/
│   │   └── api.ts                # API client (Bearer token auth, same method signatures as frontend)
│   └── ...
├── scripts/
│   ├── build-ios.sh             # Test → deploy web/worker → build iOS IPA
│   ├── submit-testflight.sh     # Submit built IPA to TestFlight + log
│   └── check-shared-drift.sh    # Verify shared libs haven't been duplicated
├── CLAUDE.md
├── TODO.md
└── .gitignore
```

### Shared code architecture

Business logic shared between the web frontend and native app lives in `shared/lib/`. Both platforms
re-export from this directory:

| Shared module | Purpose |
|---------------|---------|
| `types.ts` | Cat, Measurement, User, Household, Medication, and other shared interfaces |
| `correlations.ts` | Pearson lag correlation engine; `detectCorrelations`; `detectConfluence`; `describeCorrelation` |
| `healthMetrics.ts` | Weight health status thresholds; trend evaluation window + loss-episode stabilization gate (PRD-trend-window); `STATUS_EMOJI`/`STATUS_COLORS`; vet-sourced constants |
| `measurementPresets.ts` | Preset labels/values for behavioral types (0-3 scale); `getPresetLabel()` |
| `dates.ts` | Timezone-safe date parsing (`parseLocalDate`, `catAge`); avoids browser date pitfalls |
| `preferences.ts` | User preference types and defaults |
| `formatting.ts` | Shared formatting helpers (weight display, etc.) |
| `constants.ts` | App-wide constants (measurement types, etc.) |

Platform-specific code (API clients, screens, navigation) lives in `frontend/src/` and `app/`.
The web API client (`frontend/src/lib/api.ts`) uses cookie-based auth; the native API client
(`app/lib/api.ts`) uses Bearer token auth. Both expose identical method signatures and types.

---

## Database Schema

Schema source of truth: `worker/src/db/schema.sql`

### cats

```sql
CREATE TABLE IF NOT EXISTS cats (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,
  birthdate     TEXT NOT NULL,    -- ISO 8601 date: YYYY-MM-DD
  breed         TEXT,
  coloring      TEXT,
  notes         TEXT,
  photo_url     TEXT,
  sex           TEXT,             -- 'Male' | 'Female' | NULL (unknown)
  is_neutered   INTEGER,          -- 0 | 1 | NULL (unknown)
  microchip_id  TEXT,
  user_id       TEXT REFERENCES users(id),
  household_id  TEXT REFERENCES households(id),
  deceased_at   TEXT,             -- ISO 8601 datetime; NULL = alive
  memorial_note TEXT,             -- Free-text memorial message
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cats_microchip
  ON cats(microchip_id)
  WHERE microchip_id IS NOT NULL AND microchip_id NOT LIKE 'temp-microchip-id-%';
CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
CREATE INDEX IF NOT EXISTS idx_cats_household ON cats(household_id);
```

**Orphaned cats:** `user_id IS NULL` cats are readable by any authenticated user but can only be
mutated after being claimed via `POST /api/auth/claim-cats`. See Authorization Model in API.md.

**Household cats:** When a household exists, `household_id` links the cat to the household. All
household members can see household cats; mutation permissions depend on the member's role.

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

Preset label mappings live in `shared/lib/measurementPresets.ts`.

### users

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,    -- 'google' | 'apple'
  oauth_id        TEXT NOT NULL,    -- stable provider user ID
  timezone        TEXT,              -- IANA timezone, e.g. 'America/New_York'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);
```

The `timezone` column is used by the medication dose generation cron to compute local-time dose
windows for each user.

### sessions

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at         TEXT NOT NULL,    -- rolling 7-day TTL, refreshed on each authenticated request
  device_fingerprint TEXT,             -- SEC-10: hash of device model + OS version (native clients)
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Sessions are capped at 20 per user (SEC-07); oldest are deleted when a new session is created.
Expired sessions are purged hourly by the cron job.

### oauth_states

```sql
CREATE TABLE IF NOT EXISTS oauth_states (
  state              TEXT PRIMARY KEY,   -- random token
  expires_at         TEXT NOT NULL,      -- 5-minute TTL
  next_url           TEXT,               -- post-login redirect URL
  provider           TEXT NOT NULL DEFAULT 'google',  -- 'google' | 'apple'
  native_redirect_uri TEXT               -- for native app OAuth redirect flow
);
```

### households

```sql
CREATE TABLE IF NOT EXISTS households (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### household_members

```sql
CREATE TABLE IF NOT EXISTS household_members (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL,        -- 'Viewer' | 'Contributor' | 'Editor' | 'Admin'
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'removed'
  invited_by        TEXT REFERENCES users(id),
  invite_email      TEXT,
  invite_token_hash TEXT UNIQUE,
  invite_expires_at TEXT,
  invited_at        TEXT NOT NULL DEFAULT (datetime('now')),
  joined_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_hm_household ON household_members(household_id, status);
CREATE INDEX IF NOT EXISTS idx_hm_user ON household_members(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hm_active_user
  ON household_members(household_id, user_id)
  WHERE status = 'active';
```

Households own cats; members have roles (Viewer / Contributor / Editor / Admin); invites are
email-based via Resend. Stale pending invites are expired by the hourly cron job.

### medications

```sql
CREATE TABLE IF NOT EXISTS medications (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id                 TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL DEFAULT 'other',  -- 'medication'|'supplement'|'vaccine'|'dental'|'exam'|'bloodwork'|'surgery'|'other'
  dose                   TEXT,
  frequency              TEXT NOT NULL,     -- 'daily'|'twice_daily'|'weekly'|'monthly'|'custom'
  frequency_days         INTEGER,           -- for 'custom' frequency
  reminder_time          TEXT NOT NULL DEFAULT '09:00',  -- HH:MM local time
  start_date             TEXT NOT NULL,     -- YYYY-MM-DD
  end_date               TEXT,              -- YYYY-MM-DD, null = ongoing
  doses_total            INTEGER,           -- null = ongoing course
  notes                  TEXT,
  is_active              INTEGER NOT NULL DEFAULT 1,
  doses_remaining        INTEGER,           -- null = not tracking stock
  refill_alert_threshold INTEGER,           -- alert when doses_remaining <= this
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_medications_cat ON medications(cat_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id, is_active);
```

### medication_doses

```sql
CREATE TABLE IF NOT EXISTS medication_doses (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  medication_id        TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  due_at               TEXT NOT NULL,      -- 'YYYY-MM-DD HH:MM:00' (SQLite datetime format, space separator)
  administered_at      TEXT,
  skipped              INTEGER NOT NULL DEFAULT 0,
  skip_reason          TEXT,
  notes                TEXT,
  notification_sent_at TEXT,               -- set when push notification sent for this dose
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medication_id, due_at)            -- idempotent cron insertion via INSERT OR IGNORE
);
CREATE INDEX IF NOT EXISTS idx_doses_medication ON medication_doses(medication_id, due_at);
CREATE INDEX IF NOT EXISTS idx_doses_due ON medication_doses(due_at, administered_at);
```

Doses are pre-generated in a 90-day rolling window by the hourly cron job. `due_at` uses
`YYYY-MM-DD HH:MM:00` format (space separator, not `T`) for SQLite datetime compatibility.

### device_tokens

```sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,  -- 'ios' | 'android' | 'web'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
```

Stores Expo push notification tokens registered by native clients. Stale tokens (rejected by Expo)
are automatically deleted after push send failures.

### apple_token_cache

```sql
CREATE TABLE IF NOT EXISTS apple_token_cache (
  token_key   TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);
```

SEC-13: Prevents Apple ID token replay attacks. Entries are cleaned up hourly by the cron job.

### rate_limits

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,        -- 'data_export' etc.
  window_start TEXT NOT NULL,        -- ISO datetime of window start
  count        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, action);
```

SEC-12: Per-user rate limiting for sensitive operations (e.g., data export). Stale windows are
purged hourly by the cron job.

### audit_log

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT,                  -- NOT a FK — audit entries must survive user deletion
  action      TEXT NOT NULL,         -- 'sign_in','sign_out','account_deleted','data_exported',
                                     --   'cat_deleted','member_added','member_removed','role_changed'
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    TEXT,                  -- JSON blob for action-specific context
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
```

SEC-15: Forensic audit log for security-relevant actions. `user_id` is intentionally not a foreign
key so entries survive account deletion. Entries older than 90 days are purged by the cron job.

---

## Frontend Routing

React Router v6, client-side. Most routes require authentication via `ProtectedRoute`.

**Public routes (no auth required):**

| Route | Component | Notes |
|-------|-----------|-------|
| `/login` | `LoginPage` | Google + Apple sign-in splash; redirect to `/` if already authenticated |
| `/invite` | `InvitePage` | Household invite acceptance (public so link works before login) |
| `/privacy` | `PrivacyPage` | Privacy policy (required for App Store) |

**Protected routes (wrapped in `ProtectedRoute` + `PageShell`):**

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Home` | Cat list with health status badges; claim-orphaned-cats prompt |
| `/cats/new` | `AddEditCat` | Add cat form |
| `/cats/:id` | `CatProfile` | Per-cat charts, history timeline, InsightsPanel; 3 tabs: Health/Care/About |
| `/cats/:id/edit` | `AddEditCat` | Edit + delete cat |
| `/cats/:id/health` | `CatHealthGuidance` | Health signals, vet thresholds, export link |
| `/cats/:id/export` | `CatExportPage` | Print-optimized vet visit summary |
| `/cats/:id/memorial` | `MemorialPage` | Deceased cat memorial view |
| `/cats/:catId/medications/new` | `MedicationFormPage` | Add care item for a specific cat |
| `/medications/:medId/edit` | `MedicationFormPage` | Edit existing care item |
| `/compare` | `CompareChart` | Multi-cat chart with type selector |
| `/import` | `ImportPage` | CSV upload + preview + confirm |
| `/wellness` | `WellnessGuide` | Static cat health reference cards |
| `/household` | `HouseholdPage` | Household settings + member management |
| `/notifications` | `NotificationsPage` | Medication notification inbox |
| `/checkin` | `DailyCheckin` | Quick daily check-in for all cats (behavioral observations) |
| `/settings` | `SettingsPage` | Theme toggle (dark/light/system) + user preferences |

All protected routes are wrapped in `PageShell`, which renders `BottomNav` (3 items: Cats | Log | Compare) and owns the `QuickAdd` open state.

The app uses four React context providers (outermost to innermost): `ConfigProvider` (remote feature flags), `ThemeProvider` (dark/light/system), `PreferencesProvider` (user preferences), `AuthProvider` (session state).

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

### API versioning and remote config

The Worker reads an `X-API-Version` header from every request. If the version is below
`minSupportedVersion` (stored in KV), the Worker returns `426 Upgrade Required`. Version usage
is logged to KV daily for analytics.

`GET /api/config` returns feature flags, health thresholds, maintenance mode status, and deprecation
info from the `CONFIG_KV` namespace. The response is cached for 5 minutes (`max-age=300,
stale-while-revalidate=600`). The `ConfigContext` on the frontend polls this on app load.

### Photo URLs use cache-busting query parameters

Cat photos are stored at a fixed R2 key (`cats/{id}/photo.jpg`) that is overwritten on re-upload.
Because browsers and React Native's `Image` component cache aggressively by URL, replacing a photo
at the same URL causes stale images to persist in the native cache. To solve this, the Worker
appends `?v={timestamp}` to the `photo_url` stored in D1 on every upload. Each replacement
generates a unique URL, forcing clients to fetch the new image. The `CatAvatar` component also
resets its error state when the URL prop changes.

---

## Auth Flow (step by step)

### Google OAuth (web + native)

1. User on `/login` clicks "Continue with Google" → browser navigates to `GET /api/auth/login`
2. Worker generates `state` token, writes to `oauth_states` with 5-minute TTL (including `provider` and optional `native_redirect_uri`), redirects to Google
3. Pages proxy reconstructs the `302` response explicitly so headers pass through
4. Google redirects to `cat-tracker.pages.dev/api/auth/callback?code=...&state=...`
5. Pages proxy forwards to Worker
6. Worker: verifies `state`, exchanges `code` for Google token, fetches profile, upserts `users`, creates `sessions` row
7. Worker returns `302` to `/` with `Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax`
8. Pages proxy reconstructs the `302`; browser sets cookie and follows redirect to `/`
9. All subsequent API calls include the cookie; `requireAuth` middleware validates against `sessions`

### Apple Sign In (native)

1. Native app initiates Apple Sign In via `expo-apple-authentication`
2. App sends the Apple identity token + authorization code to `POST /api/auth/apple`
3. Worker verifies the Apple ID token (via `lib/apple-auth.ts`), checks for token replay (SEC-13 via `apple_token_cache`), upserts `users` with `oauth_provider='apple'`
4. Worker creates a session and returns the session token as JSON (Bearer auth for native)
5. Native app stores the token in SecureStore; subsequent API calls use `Authorization: Bearer <token>`

### Dual auth middleware

The `requireAuth` middleware accepts both httpOnly session cookies (web) and `Authorization: Bearer` tokens (native). Both resolve to the same `sessions` table.

---

## QuickAdd Flow

1. User taps the center "Log" button in `BottomNav`
2. `PageShell` sets `quickAddOpen = true`, renders `<QuickAdd open onClose=... />`
3. User picks cat + measurement type + value; taps save
4. `createMeasurement()` API call; on success fires `window.dispatchEvent(new CustomEvent('measurementAdded'))`
5. `Home` and `CatProfile` both listen for this event and re-fetch

---

## Correlation Engine

`shared/lib/correlations.ts`

- **Algorithm:** Pearson correlation with lag (0–4 weeks). Input measurements are bucketed into
  weekly averages. Minimum 4 aligned weekly buckets required.
- **Known pairs:** 5 hardcoded input→outcome pairs (food→weight, water→vomiting, etc.).
- **Strength thresholds:** |r| ≥ 0.6 = "notable"; |r| ≥ 0.4 = "moderate"; below = "none".
- **Confluence detection:** Two clinical clusters — kidney/thyroid/DM signals; systemic illness.
- **Descriptions:** `describeCorrelation(result, catName, catSex, mode)` with `mode: 'owner' | 'vet'`.

---

## Cron Job

The Worker runs a scheduled handler hourly (`0 * * * *`, configured in `wrangler.toml`). Each
invocation performs the following tasks in order:

1. **Expired session cleanup** — `DELETE FROM sessions WHERE expires_at < datetime('now')`
2. **Apple token replay cache cleanup** (SEC-13) — `DELETE FROM apple_token_cache WHERE expires_at < datetime('now')`
3. **Audit log cleanup** (SEC-15) — `DELETE FROM audit_log WHERE created_at < datetime('now', '-90 days')`
4. **Rate limit cleanup** (SEC-12) — `DELETE FROM rate_limits WHERE window_start < datetime('now', '-2 hours')`
5. **Invite expiry** — Marks stale pending household invites as `removed` and clears their token hash
6. **Dose generation** — Extends the 90-day rolling dose window for all active medications (respects user timezone)
7. **Push notifications** — Finds medication doses due in the current hour window that haven't been notified, groups them by (user, cat), sends Expo push notifications, marks doses as notified, and cleans up stale device tokens

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
| KV | `cat-tracker-config` | `7fc5a67f7e774458a99bf41dc7fe761c` — feature flags, thresholds, maintenance mode |

### Google OAuth

- **Console:** Google Cloud Console, project linked to stevej account
- **Authorized redirect URI:** `https://cat-tracker.pages.dev/api/auth/callback`
- **Worker secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Apple Sign In

- **Apple Developer portal:** Service ID, private key, Team ID, Key ID
- **Worker secrets:** `APPLE_SERVICE_ID`, `APPLE_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`
- **Helper:** `worker/src/lib/apple-auth.ts` — client secret generation + ID token verification
- **Replay prevention:** `apple_token_cache` table (SEC-13)

### Resend (transactional email)

- **From address:** `noreply@01j.me` (verified domain)
- **Worker secret:** `RESEND_API_KEY`
- **Helper:** `worker/src/lib/email.ts`

### Expo Push Notifications

- **Helper:** `worker/src/lib/push.ts` — sends via Expo push API
- **Token storage:** `device_tokens` table; registered by native app on startup
- **Triggered by:** hourly cron job for medication dose reminders

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
