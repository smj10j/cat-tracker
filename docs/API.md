# Cat Tracker — API Reference

This document is the authoritative specification for the Cat Tracker Worker API.

Base URL (production): `https://cat-tracker-api.stevej-67b.workers.dev`
In the app, all calls go through the Pages proxy at `/api/*` on the same origin as the frontend,
which forwards to the Worker. Direct Worker calls are only used for local development.

---

## Authentication

All endpoints except auth routes, `/api/health`, `/api/config`, and `/api/household/invites/preview` require a valid session.

**Two auth mechanisms** (Bearer token checked first, cookie fallback):

| Method | Format | Used by |
|--------|--------|---------|
| Bearer token | `Authorization: Bearer <token>` | iOS native app |
| Session cookie | `session=<token>` (httpOnly, Secure, SameSite=Lax) | Web frontend |

Sessions have a 7-day rolling TTL (refreshed on each authenticated request), stored in D1 `sessions` table. Each user is capped at 20 concurrent sessions (oldest pruned on creation).

**API Version Header:** All clients should send `X-API-Version: <semver>` on every request. The Worker stores this on the request context for version-gated responses and deprecation logging. If absent, the Worker assumes the latest version. If the version is below `minSupportedVersion` (from KV config), the Worker returns `426 Upgrade Required`.

If the session is missing or expired, all protected routes return:

```
HTTP 401 Unauthorized
{ "error": "Unauthorized" }
```

The `requireAuth` middleware in `worker/src/middleware/auth.ts` validates auth on every request to `/api/cats/*`, `/api/measurements/*`, `/api/medications/*`, `/api/doses/*`, `/api/notifications`, `/api/household/*`, and `/api/import`.

---

## Authorization Model

### Household-based access

Cats belong to households. Access to a cat (and its measurements, medications, doses) is determined by the user's membership role in the cat's household.

| Role | Level | Capabilities |
|------|-------|--------------|
| `viewer` | 1 | Read cats, measurements, medications, doses |
| `contributor` | 2 | All viewer permissions + add measurements, administer/skip doses |
| `editor` | 3 | All contributor permissions + create/edit/delete cats, medications, photos |
| `admin` | 4 | All editor permissions + manage household members, invite/remove users, rename household |

Role checks use `getCatRole()` which resolves the user's role for a given cat via household membership, then `hasRole(role, required)` to verify the minimum required level.

### Orphaned cats

Cats with `user_id IS NULL` are "orphaned" — they existed before auth was added, or were imported
without an account. Any logged-in user can **read** them. No one can **mutate** them until they are
claimed. `POST /api/auth/claim-cats` assigns all orphaned cats to the requesting user.

### No cross-user access

There is no cross-user data access outside of households. Attempting to read, update, or delete
another user's cat (outside of a shared household) returns `404 Not Found` (not `403`) to avoid
leaking information about resource existence.

---

## Endpoints

### Health

#### `GET /api/health`

No authentication required. Returns server status.

**Response 200**
```json
{ "status": "ok" }
```

---

### Config

#### `GET /api/config`

**No auth required.** Returns server-driven runtime configuration. Cached for 5 minutes.

**Response 200**
```json
{
  "minSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "updateMessage": null,
  "features": {
    "pushNotificationsEnabled": false,
    "appleSignInEnabled": true,
    "streaksEnabled": false,
    "aiNarrativeEnabled": false
  },
  "thresholds": null,
  "maintenanceMode": false,
  "maintenanceMessage": null,
  "deprecations": null
}
```

**Headers:** `Cache-Control: public, max-age=300, stale-while-revalidate=600`

If `deprecations` is non-null, response includes `Deprecation: true` and `Sunset: <earliest date>` headers.

Config is stored in Cloudflare KV (`CONFIG_KV` namespace). If KV is empty or contains malformed data, hardcoded defaults are returned.

The `thresholds` field carries optional server-driven overrides for the weight health algorithm; its shape mirrors `ThresholdOverrides` in `shared/lib/healthMetrics.ts`. Any subset may be supplied — omitted keys fall back to the documented defaults. Supported keys: `weightLoss`, `weightGain`, `noiseFloorPct`, `minIntervalDays`, `referencePeakWindowDays`, `referencePeakMinMeasurements`, `trendWindowDays`, `stabilization` (`{ minMeasurements, minSpanDays }`), and `totalLoss`. See `docs/research/weight-thresholds.md` for what each one calibrates — clinical thresholds there are citation-backed and should not be retuned without updating that document.

**Additive-only policy:** This endpoint's response may gain new fields at any time. Clients must ignore unknown fields. Existing fields are never removed or change type without a major API version bump.

---

### Auth

#### `GET /api/auth/login`

No authentication required. Initiates OAuth flow for Google or Apple.

**Query params:**
- `provider` — `google` (default) or `apple`
- `next` — optional post-login redirect path (e.g. `/invite?token=xxx`)
- `mode` — optional, passed through to callback (e.g. `native`)
- `redirect_uri` — optional, app custom URL scheme for native OAuth (e.g. `whiskerhealth://auth`)

Generates a random state token, stores it in D1 `oauth_states` table (5-minute TTL), and redirects to the provider's consent screen.

**Response 302** → Google or Apple OAuth consent URL

---

#### `GET /api/auth/callback`

No authentication required. **Google OAuth callback.** Exchanges the authorization code for a Google access token, fetches the user's profile, upserts the user in `users`, creates a session, and redirects.

**Query params:** `code`, `state`, `mode` (optional)

**Web response:** `302` → redirect path with `Set-Cookie: session=<token>`
**Native response:** `302` → `<redirect_uri>?session=<token>` (if `native_redirect_uri` was stored with the state)

**Error responses:** `302` → `/login?error=<reason>` for missing params, invalid state, token exchange failure, or profile failure.

---

#### `POST /api/auth/callback`

No authentication required. **Apple OAuth callback** (form-encoded POST, `response_mode=form_post`).

**Form body:** `id_token`, `state`, `user` (optional JSON with `name.firstName`, `name.lastName`)

Verifies the Apple `id_token` JWT, upserts the user, creates a session. Apple sends the user's name only on the first authorization.

**Web response:** `302` → redirect path with `Set-Cookie: session=<token>`
**Native response:** `302` → `<redirect_uri>?session=<token>`

---

#### `POST /api/auth/apple-native`

No authentication required. Native iOS Apple Sign In flow — receives the identity token directly from the device (no redirect dance).

**Request body**
```ts
{
  identityToken: string                // Apple identity JWT
  fullName?: {                         // Only available on first auth
    givenName?: string
    familyName?: string
  } | null
}
```

Verifies the token against Apple's public keys (audience: bundle ID `me.01j.whisker`, fallback to `APPLE_SERVICE_ID`). Includes replay prevention via `apple_token_cache` table.

**Response 200**
```json
{ "sessionId": "abc123...", "userId": "user456..." }
```

**Response 401** — invalid identity token
**Response 409** — token already consumed (replay)

---

#### `POST /api/auth/logout`

**Auth required.** Deletes the current session and clears the session cookie.

**Response 200**
```json
{ "success": true }
```

---

#### `GET /api/auth/me`

**Auth required.** Returns the current user's profile.

**Response 200**
```json
{
  "id": "abc123",
  "email": "user@example.com",
  "display_name": "Jane Smith",
  "avatar_url": "https://...",
  "oauth_provider": "google",
  "timezone": "America/New_York",
  "hasOrphanedCats": false,
  "session_age_seconds": 142
}
```

- `oauth_provider` — `"google"` or `"apple"`
- `timezone` — IANA timezone string or `null` if not yet set
- `hasOrphanedCats` — `true` when cats with `user_id IS NULL` exist in the database
- `session_age_seconds` — age of the current session in seconds (for re-auth gate checks)

---

#### `PUT /api/auth/me`

**Auth required.** Updates the current user's profile.

**Request body**
```ts
{
  timezone?: string   // IANA timezone (e.g. "America/New_York")
}
```

Validates the timezone via `Intl.DateTimeFormat`. On first timezone set, triggers a lazy migration that regenerates all future medication doses in UTC.

**Response 200**
```json
{ "ok": true }
```

**Response 400** — invalid timezone

---

#### `POST /api/auth/claim-cats`

**Auth required.** Sets `user_id` on all orphaned cats (`user_id IS NULL`) to the authenticated user and migrates them into the user's household.

**Response 200**
```json
{ "claimed": 3 }
```

---

#### `DELETE /api/auth/account`

**Auth required. Re-authentication required (session must be < 5 minutes old).**

Permanently deletes the user's account and all associated data (cats, measurements, medications, doses, photos, sessions, device tokens, household memberships). Transfers household ownership to another admin if possible; deletes the household if no other admin exists.

**Response 200**
```json
{ "success": true, "deleted": true }
```

**Response 403** (session too old)
```json
{ "error": "Re-authentication required", "action": "re-sign-in" }
```

**Response 409** (sole admin of a household)
```json
{
  "error": "Cannot delete account: you are the sole admin of one or more households",
  "households": [{ "id": "...", "name": "..." }],
  "hint": "Transfer ownership or delete the household first"
}
```

---

#### `GET /api/auth/export`

**Auth required. Rate limited to 5 per hour per user.**

Full data export (GDPR Article 20, Apple requirement). Returns all user data as a JSON file download.

**Response 200** — `Content-Type: application/json`, `Content-Disposition: attachment; filename="whisker-health-export-YYYY-MM-DD.json"`

```ts
{
  exported_at: string
  user: { id, email, display_name, avatar_url, oauth_provider, created_at }
  cats: Cat[]
  measurements: Measurement[]
  medications: Medication[]
  household_memberships: HouseholdMember[]
}
```

**Response 429** (rate limited)
```json
{ "error": "You've exported your data recently. You can export again in N minutes." }
```

---

#### `POST /api/auth/device-token`

**Auth required.** Registers a push notification device token. Capped at 10 tokens per user (oldest pruned).

**Request body**
```ts
{
  token: string      // Expo push token or APNs token
  platform: string   // "ios" | "android" | "web"
}
```

Token format is validated: iOS accepts `ExponentPushToken[...]` or 64-char hex APNs tokens.

**Response 200**
```json
{ "success": true }
```

**Response 400** — missing fields, invalid platform, or invalid token format

---

#### `DELETE /api/auth/device-token`

**Auth required.** Unregisters a push notification device token.

**Request body**
```ts
{
  token: string
}
```

**Response 200**
```json
{ "success": true }
```

---

### Cats

#### `GET /api/cats`

**Auth required.** Returns cats accessible to the user via household membership, ordered by name.

**Query params:**
- `status` — `active` (default, excludes deceased), `memorial` (deceased only), `all`

**Response 200** — array of Cat objects (includes `household_name` from JOIN)

```json
[
  {
    "id": "a1b2c3d4",
    "name": "Luna",
    "birthdate": "2020-03-15",
    "breed": "Domestic Shorthair",
    "coloring": "Tabby",
    "notes": null,
    "photo_url": null,
    "sex": "Female",
    "microchip_id": "982000123456789",
    "is_neutered": 1,
    "deceased_at": null,
    "memorial_note": null,
    "user_id": "user123",
    "household_id": "hh456",
    "household_name": "Smith Family",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
]
```

---

#### `POST /api/cats`

**Auth required.** Creates a new cat in the user's household.

**Request body**
```ts
{
  name: string           // required, max 100 chars
  birthdate: string      // required, YYYY-MM-DD
  breed?: string | null  // max 100 chars
  coloring?: string | null  // max 100 chars
  notes?: string | null  // max 2000 chars
  photo_url?: string | null
  sex?: string | null    // "Male" | "Female" | "Unknown"
  microchip_id?: string | null  // max 50 chars; auto-generated temp ID if omitted
  is_neutered?: number | null   // 0 or 1
}
```

**Response 201** — Cat object
**Response 400** — missing `name` or `birthdate`, or field length exceeded
**Response 409** — microchip ID conflict with another cat

---

#### `GET /api/cats/:id`

**Auth required.** Returns a single cat. Accessible if the user has any household role for this cat.

**Response 200** — Cat object (includes `household_name`)
**Response 404** — not found or no access

---

#### `PUT /api/cats/:id`

**Auth required. Editor role required.** Updates a cat's fields. All fields are optional; omitted fields retain their current values (PATCH semantics).

**Request body** — same shape as POST, plus:
```ts
{
  deceased_at?: string | null   // ISO date; setting marks the cat as deceased
  memorial_note?: string | null // max 5000 chars
}
```

When `deceased_at` is set for the first time, all medications for this cat are deactivated and pending future doses are deleted.

**Response 200** — updated Cat object
**Response 403** — insufficient role
**Response 404** — not found or no access
**Response 409** — microchip ID conflict

---

#### `DELETE /api/cats/:id`

**Auth required. Editor role required.** Deletes the cat and all its measurements. Logged to audit trail.

**Response 200**
```json
{ "success": true }
```

**Response 403** — insufficient role
**Response 404** — not found or no access

---

#### `POST /api/cats/:id/photo`

**Auth required. Editor role required.** Uploads a cat photo to R2. Accepts multipart form data.

**Request:** `Content-Type: multipart/form-data`
- `photo` — JPEG file, max 5 MB

The photo is stored at `cats/{id}/photo.jpg` in R2 (overwrites any existing photo). The cat's `photo_url` is updated with a cache-busting `?v=` timestamp.

**Response 200**
```json
{ "photo_url": "https://pub-40305f88ebb54339b47a48224f195f92.r2.dev/cats/abc123/photo.jpg?v=1700000000000" }
```

**Response 400** — missing photo field, non-JPEG, or exceeds 5 MB
**Response 403** — insufficient role
**Response 404** — cat not found or no access

---

#### `DELETE /api/cats/:id/photo`

**Auth required. Editor role required.** Deletes the cat's photo from R2 and sets `photo_url` to NULL.

**Response 200**
```json
{ "ok": true }
```

**Response 403** — insufficient role
**Response 404** — cat not found or no access

---

#### Health alert acknowledgment (PRD-alert-acknowledgment)

`GET /api/cats` and `GET /api/cats/:id` embed an `acknowledgment: AckRecord | null` field per cat — the active, non-expired ack (read-side expiry: an ack past `expires_at` is treated as gone). Health status is computed client-side; the suppression decision is made client-side via `shared/lib/alertAck.ts` `applyAcknowledgment(assessment, ack)`. The server stores the claimed severity/direction verbatim and never validates it against a computed status (enum validation only).

`AckRecord`: `{ id, cat_id, alert_kind, acknowledged_severity, direction, acknowledged_by, acknowledged_by_name, note, latest_measured_at, context, status, expires_at, created_at, ended_at }`.

#### `PUT /api/cats/:id/acknowledgment`

**Auth required. Contributor role required.** Acknowledge a health alert. Upsert: marks any existing active ack for `(cat, kind)` as `superseded`, inserts a new `active` row with `expires_at = now + 30 days`.

**Request body**
```ts
{
  kind?: string           // default 'weight' (only 'weight' in v1)
  severity: 'watch' | 'concerning' | 'urgent'
  direction: 'loss' | 'gain'
  note?: string | null    // <= 280 chars
  latest_measured_at: string
  context?: string | null // JSON snapshot for export/history
}
```

**Response 200** — the created `AckRecord` (with `acknowledged_by_name`).
**Response 400** — invalid kind/severity/direction or missing `latest_measured_at`.
**Response 403** — insufficient role (Viewer). **Response 404** — cat not found or no access.

#### `DELETE /api/cats/:id/acknowledgment?kind=weight`

**Auth required. Contributor role required.** Withdraw ("Undo") the active ack → status `withdrawn`; full alert returns.

**Response 200** `{ "success": true }` — **404** if no active ack (or no access).

#### `POST /api/cats/:id/acknowledgment/resolve?kind=weight`

**Auth required. Contributor role required.** Fire-and-forget from clients when they render `ok` (episode over): active ack → `resolved`. Idempotent — 200 whether or not one was active.

---

### Measurements

#### `GET /api/cats/:id/measurements`

**Auth required.** Returns measurements for a cat. Accessible if the user has any household role for this cat.

**Query params:**
- `type` — optional filter (e.g. `weight`, `food`, `water`, `litter`, `grooming`, `activity`, `vomiting`, `bcs`)

Measurements are ordered by `measured_at ASC`.

**Response 200** — array of Measurement objects

```json
[
  {
    "id": "m1m2m3m4",
    "cat_id": "a1b2c3d4",
    "type": "weight",
    "value": 9.2,
    "unit": "lbs",
    "measured_at": "2024-01-15T10:30:00Z",
    "notes": "Morning before breakfast",
    "created_at": "2024-01-15T10:31:00"
  }
]
```

**Response 404** — cat not found or no access

---

#### `POST /api/cats/:id/measurements`

**Auth required. Contributor role required.** Adds a measurement to a cat.

**Request body**
```ts
{
  type: string         // required; one of: weight, food, water, litter, grooming, activity, vomiting, bcs
  value: number        // required; scale range is per-type — bcs: integer 1-9; other scale types (behavioral): integer 0-3; weight: positive number <= 200
  unit: string         // required; one of: lbs, kg, scale (bcs must use 'scale')
  measured_at: string  // required; ISO datetime
  notes?: string       // max 2000 chars
}
```

**Response 201** — Measurement object
**Response 400** — missing fields, invalid type/unit, or value out of range
**Response 403** — insufficient role
**Response 404** — cat not found or no access

---

#### `DELETE /api/measurements/:id`

**Auth required. Contributor role required.** Deletes a single measurement. Verified via the measurement's cat to ensure household access.

**Response 200**
```json
{ "success": true }
```

**Response 404** — not found or no access

---

### Observations Journal (PRD-notes-journal)

Dated free-text observations per cat (≤2000 chars, backdatable, preset descriptive tags), interleaved into the History timeline. Tags are validated against `VALID_JOURNAL_TAGS` (shared) — unknown tags are rejected. `tags` is returned as a parsed `string[] | null`. `author_name` is the joined display name.

`JournalEntry`: `{ id, cat_id, user_id, author_name, occurred_at, text, tags: string[]|null, photo_url, created_at, updated_at }`.

#### `GET /api/cats/:id/journal`

**Auth required. Any household role (Viewer+).** Lists entries for a cat, newest `occurred_at` first.

**Query params:** `tag` (preset key), `from` / `to` (ISO datetime bounds on `occurred_at`), `limit` (default 200, max 500), `offset`.

**Response 200** — array of `JournalEntry`. **404** — cat not found or no access.

#### `POST /api/cats/:id/journal`

**Auth required. Contributor role required.** Creates an entry.

**Request body**
```ts
{
  occurred_at: string        // ISO datetime; must not be in the future
  text: string               // 1..2000 chars (Unicode code points)
  tags?: string[] | null     // preset keys only
}
```

**Response 201** — the created `JournalEntry`.
**400** — empty/oversized text, future `occurred_at`, or unknown tag.
**403** — Viewer role, or the cat is deceased (`deceased_at` set).
**404** — cat not found or no access.

#### `PUT /api/journal/:entryId`

**Auth required. Author, or Admin of the cat's household.** Updates `occurred_at`, `text`, and/or `tags` (PATCH semantics). Same validation as create.

**Response 200** — updated `JournalEntry`. **403** — not author/admin. **404** — entry not found or no access.

#### `DELETE /api/journal/:entryId`

**Auth required. Author or Admin.** Deletes the entry (and its R2 photo object if present).

**Response 200** `{ "success": true }`. **403** — not author/admin. **404** — entry not found or no access.

---

### Import

#### `POST /api/import`

**Auth required.** Bulk-imports measurements from CSV text. Cat names are matched
case-insensitively against the user's existing cats (also by microchip ID if provided); new cats are created for names that don't match.

**Request body** — plain text (`text/plain`), CSV format, max 1 MB:

```
date,cat_name,type,value,unit[,microchip_id]
1/15/2024,Luna,weight,9.2,lbs
1/16/2024,Luna,weight,9.1,lbs
1/15/2024,Mochi,litter,2,scale,982000123456789
```

Date format: `M/D/YYYY`. Header row is skipped. First 5 columns are required; 6th column (microchip_id) is optional.

**Response 200**
```json
{
  "imported": 47,
  "catsCreated": ["Mochi"],
  "errors": ["Row 5: invalid date format \"2024-01-15\", expected M/D/YYYY"]
}
```

**Response 413** — body exceeds 1 MB
**Response 422** — all rows failed to parse (no valid rows)

---

### Medications

#### `GET /api/medications`

**Auth required.** Returns all active medications accessible to the user via household membership.

**Query params:**
- `cat_id` — optional; filter by cat

Each medication includes computed fields `next_due_at` (next pending dose), `overdue_count` (doses past due), and `muted` (`1` if the requesting user has muted this item's reminders — see `PUT /api/medications/:id/mute`).

**Response 200** — array of Medication objects

```json
[
  {
    "id": "med123",
    "cat_id": "a1b2c3d4",
    "user_id": "user123",
    "name": "Methimazole",
    "type": "medication",
    "dose": "2.5mg",
    "frequency": "twice_daily",
    "frequency_days": null,
    "reminder_time": "09:00",
    "start_date": "2024-01-01",
    "end_date": null,
    "doses_total": null,
    "notes": null,
    "is_active": 1,
    "doses_remaining": 45,
    "refill_alert_threshold": 10,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "next_due_at": "2024-06-15 09:00:00",
    "overdue_count": 0
  }
]
```

---

#### `POST /api/medications`

**Auth required. Editor role required (for the cat).** Creates a new medication and generates 90 days of dose records.

**Request body**
```ts
{
  cat_id: string          // required
  name: string            // required, max 200 chars
  frequency: string       // required; one of: daily, twice_daily, weekly, monthly, custom
  start_date: string      // required; YYYY-MM-DD
  type?: string           // default "other", max 50 chars (e.g. medication, vaccine, dental, exam, bloodwork, surgery)
  dose?: string | null    // max 100 chars (e.g. "2.5mg")
  frequency_days?: number | null  // required when frequency = "custom"
  reminder_time?: string  // default "09:00"; HH:MM (user's local time)
  end_date?: string | null
  doses_total?: number | null
  notes?: string | null   // max 1000 chars
  doses_remaining?: number | null
  refill_alert_threshold?: number | null
}
```

Doses are generated using the user's timezone (from `users.timezone`) for UTC conversion. If no timezone is set, naive local time is used.

**Response 201** — Medication object
**Response 400** — missing required fields or invalid frequency
**Response 403** — insufficient role
**Response 404** — cat not found or no access

---

#### `GET /api/medications/:id`

**Auth required.** Returns a single medication with its last 60 doses (last 30 + next 30, ordered by `due_at DESC`).

**Response 200**
```ts
{
  ...Medication,
  doses: MedicationDose[]
}
```

**Response 404** — not found or no access

---

#### `PUT /api/medications/:id`

**Auth required. Editor role required.** Updates a medication. All fields are optional (PATCH semantics). After update, future unadministered/unskipped doses are deleted and regenerated.

**Request body** — same fields as POST (all optional), plus:
```ts
{
  is_active?: number  // 0 to deactivate, 1 to reactivate
}
```

**Response 200** — updated Medication object
**Response 403** — insufficient role
**Response 404** — not found or no access

---

#### `DELETE /api/medications/:id`

**Auth required. Editor role required.** Soft-deletes (archives) a medication by setting `is_active = 0`.

**Response 200**
```json
{ "success": true }
```

**Response 403** — insufficient role
**Response 404** — not found or no access

---

### Doses

#### `POST /api/doses/:id/administer`

**Auth required. Contributor role required.** Marks a dose as administered.

**Request body**
```ts
{
  administered_at?: string  // ISO datetime; defaults to now
  notes?: string            // max 1000 chars
}
```

**Response 200** — updated MedicationDose object

```json
{
  "id": "dose456",
  "medication_id": "med123",
  "due_at": "2024-06-15 09:00:00",
  "administered_at": "2024-06-15 09:05:00",
  "skipped": 0,
  "skip_reason": null,
  "notes": "Given with food",
  "notification_sent_at": null
}
```

**Response 404** — dose not found or no access

---

#### `POST /api/doses/:id/skip`

**Auth required. Contributor role required.** Marks a dose as skipped.

**Request body**
```ts
{
  skip_reason?: string  // max 500 chars
}
```

**Response 200** — updated MedicationDose object (with `skipped: 1`, `administered_at: null`)

**Response 404** — dose not found or no access

---

#### `POST /api/doses/:id/snooze`

**Auth required. Contributor role required.** Defers a due/overdue dose (WP4g). Sets `snoozed_until = now + minutes` and clears `notification_sent_at`, so the hourly cron re-pings once `snoozed_until` passes. Server-authoritative: the snooze is visible to all household members and suppresses the 24h follow-up until it elapses. Called by the iOS notification "Snooze 1h" action and the web/iOS inbox Snooze button.

**Request body**
```ts
{
  minutes?: number  // default 60; clamped to [1, 1440]
}
```

**Response 200**
```ts
{ snoozed_until: string }  // 'YYYY-MM-DD HH:MM:SS' UTC
```

**Response 409** — dose already resolved (administered, skipped, or expired to `missed`); resolved doses can't be snoozed. This also prevents a snooze from resurrecting a WP1c-expired dose.

**Response 404** — dose not found or no access

---

### Notifications

#### `GET /api/notifications`

**Auth required.** Returns categorized medication dose notifications for the current user across all household cats. Uses the user's timezone for date boundary calculations.

**Response 200**
```ts
{
  overdue: DoseNotification[]     // due_at < now, not administered, not skipped (limit 50)
  due_today: DoseNotification[]   // due_at >= now and within today in user's timezone (limit 50)
  upcoming: DoseNotification[]    // due tomorrow through 7 days out (limit 50)
  refill_alerts: RefillAlert[]    // medications where doses_remaining <= refill_alert_threshold
}
```

Each `DoseNotification` includes:
```ts
{
  // medication_doses fields
  id: string
  medication_id: string
  due_at: string
  administered_at: string | null
  skipped: number
  // joined fields
  med_name: string
  dose: string | null
  med_type: string
  cat_name: string
  cat_id: string
}
```

Each `RefillAlert` includes full medication fields plus `cat_name` and `cat_id`.

---

### Notification preferences (PRD-actionable-notifications Phase B/C)

#### `GET /api/notification-prefs`

**Auth required.** Returns the caller's notification preferences, or defaults if none are saved yet.

**Response 200**
```ts
{
  digest_enabled: number          // 0 | 1 — morning daily digest on/off (default 0)
  digest_time: string             // 'HH:MM' user-local (default '08:00')
  digest_last_sent_date: string | null  // 'YYYY-MM-DD' user-local; server-managed idempotency guard
  quiet_hours_start: string | null       // 'HH:MM' or null (off)
  quiet_hours_end: string | null         // 'HH:MM' or null (off)
}
```

#### `PUT /api/notification-prefs`

**Auth required.** Partial upsert of the caller's prefs (row created lazily). `digest_last_sent_date` is server-managed and ignored if sent. Quiet-hours bounds accept an `'HH:MM'` string or `null`/`''` to clear.

**Request body** (all optional)
```ts
{
  digest_enabled?: boolean | number   // coerced to 0/1
  digest_time?: string                 // 'HH:MM'
  quiet_hours_start?: string | null    // 'HH:MM' or null
  quiet_hours_end?: string | null      // 'HH:MM' or null
}
```

**Response 200** — the updated prefs (same shape as GET)
**Response 400** — a time field is not `HH:MM`

**Behavior:** the hourly cron sends one digest per user-local day once local time reaches `digest_time` (deferred past quiet hours, never dropped), listing items due today plus a carried-over overdue count — silent when nothing is due. Quiet hours also defer the 24h overdue follow-up; explicitly-scheduled due-hour pushes still fire.

#### `PUT /api/medications/:id/mute`

**Auth required. Any member who can see the cat (Viewer+).** Mutes or unmutes push reminders for this care item **for the calling user only** — the schedule and other members' notifications are unaffected. Backed by `care_item_mutes`. The `muted` flag is surfaced per-caller on `GET /api/medications` and `GET /api/medications/:id`.

**Request body**
```ts
{ muted: boolean }   // required
```

**Response 200** — `{ muted: boolean }`
**Response 400** — `muted` missing or not a boolean
**Response 404** — medication not found or no access

---

### Household

#### `GET /api/household/invites/preview`

**No auth required.** Returns invite preview information for a pending invite token.

**Query params:**
- `token` — the invite token (required)

**Response 200**
```json
{
  "household_name": "Smith Family",
  "invited_by_name": "Jane Smith",
  "invite_email": "bob@example.com",
  "role": "editor"
}
```

**Response 404** — invite not found or already consumed
**Response 410** — invite expired

---

#### `GET /api/household`

**Auth required.** Returns the user's household details, active members, and pending invites.

**Response 200**
```ts
{
  household: {
    id: string
    name: string
    owner_user_id: string
    created_at: string
  }
  members: Array<{
    id: string
    user_id: string
    role: string
    invited_at: string
    joined_at: string | null
    display_name: string | null
    email: string | null
    avatar_url: string | null
  }>
  pendingInvites: Array<{
    id: string
    invite_email: string
    role: string
    invited_at: string
    invite_expires_at: string | null
    invited_by_name: string | null
  }>
  myRole: string    // viewer | contributor | editor | admin
  isOwner: boolean
}
```

---

#### `GET /api/household/list`

**Auth required.** Returns all households the user belongs to (for multi-household support).

**Response 200**
```json
[
  {
    "id": "hh123",
    "name": "Smith Family",
    "role": "admin",
    "is_owner": 1
  }
]
```

---

#### `PUT /api/household`

**Auth required. Admin role required.** Renames the household.

**Request body**
```ts
{
  name: string  // 1-100 characters
}
```

**Response 200** — updated household object
```json
{ "id": "hh123", "name": "New Name", "owner_user_id": "...", "created_at": "..." }
```

**Response 400** — name empty or > 100 chars
**Response 403** — not admin

---

#### `PUT /api/household/members/:userId/role`

**Auth required. Admin role required.** Changes a member's role. Cannot change the owner's role, your own role, or grant a role higher than your own.

**Request body**
```ts
{
  role: string  // viewer | contributor | editor | admin
}
```

**Response 200**
```json
{ "success": true }
```

**Response 400** — invalid role, target is owner, or targeting self
**Response 403** — not admin, or trying to escalate above own role
**Response 404** — member not found

---

#### `DELETE /api/household/members/:userId`

**Auth required. Admin role required.** Removes a member from the household. Cannot remove the owner.

**Response 200**
```json
{ "success": true }
```

**Response 400** — target is the owner
**Response 403** — not admin
**Response 404** — member not found (implicit)

---

#### `POST /api/household/invites`

**Auth required. Admin role required.** Sends a household invite via email. Max 10 pending invites at a time. Cannot invite someone at a role higher than your own.

**Request body**
```ts
{
  email: string  // required; normalized to lowercase
  role: string   // required; viewer | contributor | editor | admin
}
```

Sends an invite email via Resend (non-fatal if email fails). Invite token expires in 7 days.

**Response 201**
```json
{ "success": true, "inviteUrl": "https://cat-tracker.pages.dev/invite?token=..." }
```

**Response 400** — missing fields or invalid role
**Response 403** — not admin, or role escalation
**Response 409** — `already_member` or `invite_pending`
**Response 429** — max pending invites reached

---

#### `DELETE /api/household/invites/:id`

**Auth required. Admin role required.** Revokes a pending invite.

**Response 200**
```json
{ "success": true }
```

**Response 403** — not admin
**Response 404** — invite not found

---

#### `POST /api/household/invites/accept`

**Auth required.** Accepts a household invite. The authenticated user's email must match the invite email.

**Request body**
```ts
{
  token: string  // the invite token
}
```

**Response 200**
```json
{ "success": true, "household_id": "hh123" }
```

**Response 403** — `email_mismatch` (includes `invite_email` in response)
**Response 404** — `invite_not_found`
**Response 409** — `already_member`
**Response 410** — `invite_expired`

---

#### `POST /api/household/invites/decline`

**Auth required.** Declines a household invite.

**Request body**
```ts
{
  token: string
}
```

**Response 200**
```json
{ "success": true }
```

**Response 404** — `invite_not_found`

---

## Error Responses

All error responses follow the same shape:

```json
{ "error": "description of the error" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthenticated — no valid session |
| 403 | Forbidden — insufficient role or re-auth required |
| 404 | Not found — resource does not exist or user has no access |
| 409 | Conflict — duplicate resource (microchip ID, already member, token replay) |
| 410 | Gone — invite expired |
| 413 | Payload too large — import exceeds 1 MB |
| 422 | Unprocessable — import with zero valid rows |
| 426 | Upgrade Required — client version below `minSupportedVersion` |
| 429 | Too Many Requests — rate limited (data export, invites) |
| 500 | Server error |

**404 vs 403:** The API returns 404 (not 403) when a resource exists but belongs to another user.
This avoids leaking information about whether a resource exists at all. 403 is used only for
role-based denials within a household where the user already has some access.

---

## CORS

The Worker restricts CORS origins to:
- `https://cat-tracker.pages.dev` (production)
- `*.cat-tracker.pages.dev` (preview deployments)
- `http://localhost:*` (local development)

All other origins are blocked. In production, this is largely moot because the frontend calls
`/api/*` on the same origin via the Pages proxy. The CORS middleware exists for local development
and direct Worker URL access.

---

## Scheduled Tasks (Cron Trigger)

The Worker runs a scheduled handler that performs:

1. **Session cleanup** — deletes expired sessions
2. **Apple token cache cleanup** — purges expired replay cache entries
3. **Audit log pruning** — removes entries older than 90 days
4. **Rate limit cleanup** — purges stale rate limit entries (> 2 hours)
5. **Invite expiry** — marks expired pending invites as `removed`
6. **Dose generation** — extends the 90-day rolling dose window for all active medications
7. **Push notifications** — sends Expo push notifications for doses due in the current hour window; groups by (user, cat) for a single notification per cat; cleans up stale device tokens

---

## Worker Environment Bindings

Defined in `worker/src/types.ts`:

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1Database | The cat-tracker-db D1 database |
| `PHOTOS` | R2Bucket | R2 bucket for cat photos (public URL: `https://pub-40305f88ebb54339b47a48224f195f92.r2.dev`) |
| `CONFIG_KV` | KVNamespace | KV namespace for app configuration (feature flags, thresholds, maintenance mode) |
| `GOOGLE_CLIENT_ID` | string | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | string | Google OAuth app client secret |
| `OAUTH_REDIRECT_BASE` | string | Base URL for OAuth redirect (e.g. `https://cat-tracker.pages.dev`) |
| `RESEND_API_KEY` | string | Resend API key for transactional email |
| `APPLE_SERVICE_ID` | string | Apple Sign In — Service ID registered in Apple Developer portal |
| `APPLE_PRIVATE_KEY` | string | Apple Sign In — ES256 private key (PEM format) for generating client secrets |
| `APPLE_TEAM_ID` | string | Apple Sign In — Team ID from Apple Developer portal |
| `APPLE_KEY_ID` | string | Apple Sign In — Key ID for the private key |

These are set as Worker secrets/env vars in the Cloudflare dashboard (not in `wrangler.toml`).
