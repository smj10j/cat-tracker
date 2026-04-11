# Cat Tracker — API Reference

This document is the authoritative specification for the Cat Tracker Worker API.

Base URL (production): `https://cat-tracker-api.stevej-67b.workers.dev`
In the app, all calls go through the Pages proxy at `/api/*` on the same origin as the frontend,
which forwards to the Worker. Direct Worker calls are only used for local development.

---

## Authentication

All endpoints except auth routes, `/api/health`, and `/api/config` require a valid session.

**Two auth mechanisms** (Bearer token checked first, cookie fallback):

| Method | Format | Used by |
|--------|--------|---------|
| Bearer token | `Authorization: Bearer <token>` | iOS native app |
| Session cookie | `session=<token>` (httpOnly, Secure, SameSite=Lax) | Web frontend |

Sessions have a 7-day rolling TTL (refreshed on each authenticated request), stored in D1 `sessions` table.

**API Version Header:** All clients should send `X-API-Version: <semver>` on every request. The Worker stores this on the request context for version-gated responses and deprecation logging. If absent, the Worker assumes the latest version.

If the session is missing or expired, all protected routes return:

```
HTTP 401 Unauthorized
{ "error": "Unauthorized" }
```

The `requireAuth` middleware in `worker/src/middleware/auth.ts` validates auth on every request to `/api/cats/*`, `/api/measurements/*`, `/api/import`, and other protected routes.

---

## Authorization Model

**Strict ownership:** every mutable operation verifies that the resource belongs to the authenticated user.

| Operation | Condition |
|-----------|-----------|
| Read a cat / its measurements | `user_id = ? OR user_id IS NULL` — owned cats plus unclaimed (orphaned) cats |
| Create a cat | Always allowed; cat is assigned `user_id` of the requester |
| Update a cat | `user_id = ?` — **owner only** |
| Delete a cat | `user_id = ?` — **owner only** |
| Add a measurement | `cat.user_id = ?` — cat must be owned (not orphaned) |
| Delete a measurement | `cat.user_id = ?` via JOIN — cat must be owned |

### Orphaned cats

Cats with `user_id IS NULL` are "orphaned" — they existed before auth was added, or were imported
without an account. Any logged-in user can **read** them. No one can **mutate** them until they are
claimed. `POST /api/auth/claim-cats` assigns all orphaned cats to the requesting user.

### No cross-user access

There is no admin role or cross-user data access. A user can only see cats they own (or orphaned
cats). Attempting to read, update, or delete another user's cat returns `404 Not Found` (not `403`)
to avoid leaking information about resource existence.

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

### Auth

#### `GET /api/auth/login?provider=google`

No authentication required. Generates a random OAuth state token, stores it in the `oauth_states`
D1 table (5-minute TTL), and redirects to Google's OAuth consent screen.

**Why state is in D1, not a cookie:** The Pages proxy performs an opaque redirect when the Worker
returns a `302`. Setting a cookie on that redirect response was being silently dropped by the proxy.
Storing state server-side in D1 avoids this entirely.

**Response 302** → `accounts.google.com/o/oauth2/v2/auth?...`

---

#### `GET /api/auth/callback?code=...&state=...`

No authentication required. Exchanges the authorization code for a Google access token, fetches
the user's profile, upserts the user in `users`, creates a session in `sessions`, and redirects to
`/` with a `Set-Cookie` header.

**Response 302** → `/` with `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax`

**Response 400** if state is missing, expired, or invalid.

---

#### `POST /api/auth/logout`

**Auth required.** Deletes the current session from `sessions` and clears the session cookie.

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
  "hasOrphanedCats": false,
  "session_age_seconds": 142
}
```

`hasOrphanedCats` is `true` when there are cats with `user_id IS NULL` in the database.
The frontend shows a claim prompt to the user in this case.

`session_age_seconds` is the age of the current session in seconds (computed from `sessions.created_at`). Used by clients to pre-flight the re-authentication check required for account deletion (SEC-11).

---

#### `DELETE /api/auth/account`

**Auth required. Re-authentication required (SEC-11).**

Permanently deletes the user's account and all associated data. The requesting session must have been created within the last 5 minutes. If the session is older, returns 403 with a re-sign-in prompt.

**Response 403** (session too old)
```json
{ "error": "Re-authentication required", "action": "re-sign-in" }
```

**Response 409** (user is sole Admin of a household)
```json
{ "error": "You are the only admin of household \"Johnson Family Cats\". Transfer ownership or remove other members first." }
```

**Response 200** (deletion successful)
```json
{ "success": true }
```

---

#### `GET /api/config`

**No auth required.** Returns server-driven runtime configuration. Cached for 5 minutes.

**Response 200**
```json
{
  "minSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "features": {
    "pushNotificationsEnabled": false,
    "appleSignInEnabled": true,
    "streaksEnabled": false,
    "aiNarrativeEnabled": false
  },
  "thresholds": null,
  "maintenanceMode": false,
  "maintenanceMessage": null
}
```

**Headers:** `Cache-Control: public, max-age=300, stale-while-revalidate=600`

Config is stored in Cloudflare KV (`cat-tracker-config` namespace). If KV is empty or contains malformed data, hardcoded defaults are returned. The `thresholds` field is reserved for future server-driven health threshold overrides (PRD-api-versioning Phase B).

**Additive-only policy:** This endpoint's response may gain new fields at any time. Clients must ignore unknown fields. Existing fields are never removed or change type without a major API version bump.

---

#### `POST /api/auth/claim-cats`

**Auth required.** Sets `user_id` on all cats where `user_id IS NULL` to the authenticated user's
ID. Intended as a one-time migration for users who tracked cats before auth was enabled.

**Response 200**
```json
{ "claimed": 3 }
```

---

### Cats

#### `GET /api/cats`

**Auth required.** Returns all cats owned by the authenticated user, ordered by name.

**Response 200** — array of Cat objects

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
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
]
```

---

#### `POST /api/cats`

**Auth required.** Creates a new cat owned by the authenticated user.

**Request body**
```json
{
  "name": "Luna",
  "birthdate": "2020-03-15",
  "breed": "Domestic Shorthair",
  "coloring": "Orange tabby",
  "notes": "Very fluffy",
  "photo_url": null,
  "sex": "Female"
}
```

Required: `name`, `birthdate`. All others optional, default to `null`.

**Response 201** — Cat object
**Response 400** if `name` or `birthdate` is missing.

---

#### `GET /api/cats/:id`

**Auth required.** Returns a single cat. Accessible if the cat is owned by the user OR orphaned.

**Response 200** — Cat object
**Response 404** if not found or belongs to another user.

---

#### `PUT /api/cats/:id`

**Auth required. Owner only.** Updates a cat's fields. All fields are optional; omitted fields
retain their current values (PATCH semantics on a PUT endpoint).

**Request body** — same shape as POST, all fields optional

**Response 200** — updated Cat object
**Response 404** if not found, orphaned, or belongs to another user.

---

#### `DELETE /api/cats/:id`

**Auth required. Owner only.** Deletes the cat and all its measurements. The deletion is performed
as two explicit statements (measurements first, then cat) in addition to the FK `ON DELETE CASCADE`
defined in the schema.

**Response 200**
```json
{ "success": true }
```

**Response 404** if not found, orphaned, or belongs to another user.

---

### Measurements

#### `GET /api/cats/:id/measurements?type=weight`

**Auth required.** Returns measurements for a cat. The `type` query param is optional; if omitted,
all measurement types are returned. Returns only measurements for cats the user owns or that are
orphaned.

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

**Response 404** if cat not found or belongs to another user.

---

#### `POST /api/cats/:id/measurements`

**Auth required. Owner only.** Adds a measurement to a cat. The cat must be owned by the
authenticated user (not orphaned).

**Request body**
```json
{
  "type": "weight",
  "value": 9.2,
  "unit": "lbs",
  "measured_at": "2024-01-15T10:30:00Z",
  "notes": "Morning before breakfast"
}
```

For behavioral types, `value` is an integer 0–3 and `unit` is `"scale"`:
```json
{
  "type": "litter",
  "value": 2,
  "unit": "scale",
  "measured_at": "2024-01-15T08:00:00Z",
  "notes": null
}
```

Valid `type` values: `weight`, `food`, `water`, `litter`, `grooming`, `activity`, `vomiting`
Required: `type`, `value`, `unit`, `measured_at`.

**Response 201** — Measurement object
**Response 400** if required fields are missing.
**Response 404** if cat not found or is orphaned (not owned by this user).

---

#### `DELETE /api/measurements/:id`

**Auth required. Owner only.** Deletes a single measurement. Verified via JOIN to ensure the
measurement's cat is owned by the authenticated user.

**Response 200**
```json
{ "success": true }
```

**Response 404** if not found or measurement belongs to another user's cat.

---

### Import

#### `POST /api/import`

**Auth required.** Bulk-imports measurements from CSV text. Cat names are matched
case-insensitively against the user's existing cats; new cats are created for names that don't
match. All created/matched cats are assigned to the authenticated user.

**Request body** — plain text (`text/plain`), CSV format:

```
date,cat_name,type,value,unit
1/15/2024,Luna,weight,9.2,lbs
1/16/2024,Luna,weight,9.1,lbs
1/15/2024,Mochi,litter,2,scale
```

Date format: `M/D/YYYY`. Header row is skipped. All five columns are required per row.

**Response 200**
```json
{
  "imported": 47,
  "catsCreated": ["Mochi"],
  "errors": ["Row 5: invalid date format \"2024-01-15\", expected M/D/YYYY"]
}
```

**Response 422** if all rows failed to parse (no valid rows, only errors).

---

## Error Responses

All error responses follow the same shape:

```json
{ "error": "description of the error" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthenticated — no valid session cookie |
| 404 | Not found — resource does not exist, belongs to another user, or is orphaned (for mutations) |
| 422 | Unprocessable — import with zero valid rows |
| 500 | Server error |

**404 vs 403:** The API returns 404 (not 403) when a resource exists but belongs to another user.
This avoids leaking information about whether a resource exists at all.

---

## CORS

The Worker includes a CORS middleware with `origin: '*'`. In production, this is irrelevant because
the frontend calls `/api/*` on the same origin via the Pages proxy, so no cross-origin preflight is
ever issued. The CORS middleware exists for local development where the Vite dev server on
`localhost:5173` calls the Worker on `localhost:8787`. Cookie-based auth (`credentials: 'include'`)
would require a specific origin header in production CORS, but this is moot since prod is
same-origin.

---

## Worker Environment Bindings

Defined in `worker/src/types.ts`:

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1Database | The cat-tracker-db D1 database |
| `GOOGLE_CLIENT_ID` | string | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | string | Google OAuth app client secret |
| `OAUTH_REDIRECT_BASE` | string | Base URL for OAuth redirect (e.g. `https://cat-tracker.pages.dev`) |

These are set as Worker secrets/env vars in the Cloudflare dashboard (not in `wrangler.toml`).
