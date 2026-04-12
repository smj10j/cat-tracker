# Whisker Health — Security Guidelines & Architecture

This document describes the security model, principles, and guidelines for the Whisker Health application (repo: cat-tracker). It applies to the Cloudflare Worker API, the React SPA, the Expo/React Native iOS app, and the Pages proxy.

> For the API authorization rules (who can read/mutate which resources), see **[API.md](API.md)**.
> For the full technical design including the auth flow, see **[TDD/web.md](TDD/web.md)**.

---

## Security Architecture Summary

```
Browser ──HTTPS──▶ Cloudflare Pages (cat-tracker.pages.dev)
                         │ same-origin fetch /api/*
                   Pages Function proxy
                         │ HTTPS
                   Cloudflare Worker (cat-tracker-api)
                         │ D1 binding (private)
                   Cloudflare D1 (SQLite)
```

```
iOS App ──HTTPS──▶ Cloudflare Worker (cat-tracker-api) ←── Bearer token
                         │ D1 binding (private)
                   Cloudflare D1 (SQLite)
```

**Key properties:**
- All traffic is HTTPS-only (enforced by Cloudflare)
- The database is never directly accessible from the internet — only via the Worker D1 binding
- Web: API mutations require a valid session cookie (httpOnly, SameSite=Lax)
- iOS: API mutations require a valid Bearer token in `Authorization` header (stored in iOS Keychain via `expo-secure-store`)
- All data is user-scoped or household-scoped; no cross-user data access is possible

---

## Principles

### 1. Authentication by default
Every API route except `/api/health`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/apple-native`, `/api/config`, and `/api/household/invites/preview` requires a valid session. The `requireAuth` middleware validates the session token (Bearer header or cookie) before any business logic runs. There is no "opt-in" to auth — routes are protected unless explicitly excluded.

### 2. Fail closed
When in doubt, return 401 or 404. Do not expose whether a resource exists if the requester lacks access. The API returns 404 (not 403) for ownership failures to avoid leaking resource existence.

### 3. Parameterized queries everywhere
All database queries use D1 prepared statements with `.bind()`. String concatenation into SQL is never used. This eliminates SQL injection.

### 4. Strict ownership on mutations
Reads may include orphaned (unclaimed) cats. Writes — PUT, DELETE on cats; POST, DELETE on measurements — require `user_id = ?`. See [API.md](API.md) for the full authorization matrix.

### 5. Minimal data exposure
- Session validation queries return only `user_id`, not full session objects
- `/api/auth/me` returns only id, email, display_name, avatar_url — no sensitive fields
- Conflict detection on microchip_id returns `conflictingCatName` only if the conflict is with the requesting user's own cat; cross-user conflicts return a generic error

### 6. Defense in depth at every layer
- CSRF: `SameSite=Lax` on the session cookie prevents cross-site requests from including cookies
- CORS: locked to the known Pages origin; cross-origin browser requests from unknown origins are blocked
- CSP: Content-Security-Policy on the SPA restricts what scripts, styles, fonts, and connections are allowed
- Headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on all responses

### 7. Secrets never in source
OAuth credentials and API keys are stored as Cloudflare Worker secrets, not in `wrangler.toml` or source code:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `APPLE_SERVICE_ID`, `APPLE_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` — Apple Sign In
- `RESEND_API_KEY` — transactional email
- `OAUTH_REDIRECT_BASE` — OAuth redirect URL (env var)

Apple API keys for EAS Build/Submit are stored in `keys/` (gitignored).

### 8. Validate at the boundary
Input validation runs at the Worker API layer, not just the frontend. Field length limits, type allowlists for measurements, and value range checks are enforced server-side. Frontend validation (maxLength, type="number") is a UX convenience only.

---

## Authentication Details

### Session tokens
- Generated with `crypto.randomUUID()` — 128 bits of cryptographic randomness
- Stored in D1 `sessions` table; never in JWTs or client-visible state
- **Web:** Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<7 days>`
- **iOS native:** Stored in iOS Keychain via `expo-secure-store`; sent as `Authorization: Bearer <token>`
- `requireAuth` middleware checks Bearer header first, then falls back to cookie
- Rolling 7-day TTL: extended on every authenticated request
- Max 20 sessions per user — oldest sessions pruned when limit exceeded

### Cookie flags explained
| Flag | Purpose |
|------|---------|
| `HttpOnly` | JavaScript cannot read the cookie; prevents XSS-based token theft |
| `Secure` | Cookie only sent over HTTPS |
| `SameSite=Lax` | Cookie not sent on cross-site XHR/fetch; sent on top-level GET navigations (needed for OAuth redirect) |
| `Path=/` | Cookie scoped to the entire origin |

### OAuth state (CSRF protection)
State tokens are stored in D1 `oauth_states` with a 5-minute TTL. State verification uses a single `DELETE ... RETURNING` statement — this atomically consumes the state, preventing replay even under concurrent requests. See [TDD/web.md](TDD/web.md) for why state is in D1 rather than a cookie.

---

## Authorization Model

See [API.md](API.md#authorization-model) for the full matrix. Summary:
- **Reads**: own cats + orphaned cats (user_id IS NULL)
- **Writes**: own cats only (user_id = authenticated user)
- Orphaned cats become read-only until claimed via `POST /api/auth/claim-cats`

---

## Input Validation

### Server-side (Worker)

| Field | Max length |
|-------|-----------|
| cat name | 200 characters |
| breed, coloring | 200 characters |
| notes (cat) | 4000 characters |
| notes (measurement) | 1000 characters |
| microchip_id | 50 characters |

| Measurement field | Rule |
|------------------|------|
| `type` | Must be one of: weight, food, water, litter, grooming, activity, vomiting |
| `unit` | Must be one of: lbs, kg, scale |
| `value` (scale) | Integer 0–3 |
| `value` (weight) | Positive number, ≤ 200 |

| Import | Limit |
|--------|-------|
| Body size | 1 MB |

### Client-side (frontend)
Frontend inputs use `maxLength` attributes matching server limits, and `type="number"` with `min`/`max` for numeric fields. These are UX guard-rails only — server validation is authoritative.

---

## CORS Policy

The Worker responds with `Access-Control-Allow-Origin` only for requests from:
- `https://cat-tracker.pages.dev` (production)
- `https://*.cat-tracker.pages.dev` (preview deployments)
- `http://localhost:*` (local development)

All other origins receive no CORS headers, blocking cross-origin browser requests. Non-browser clients (curl, etc.) are unaffected by CORS.

**Why this matters less in production:** The frontend and API are same-origin in production (both on `cat-tracker.pages.dev` via the Pages proxy). CORS headers are only relevant for direct Worker URL access from a browser, which requires a valid session cookie. `SameSite=Lax` ensures that cookie won't be sent from a third-party site's fetch.

---

## Response Security Headers

### API responses (Worker)
| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevent framing |
| `Referrer-Policy` | `no-referrer` | Don't leak API paths in Referer headers |

### SPA (Cloudflare Pages)
Set via `frontend/public/_headers`:
| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` | Restrict script/style/image/connect sources |
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing |
| `X-Frame-Options: DENY` | Prevent clickjacking |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | Disable unused browser features |

---

## Known Limitations & Accepted Risks

### No rate limiting
The Worker has no rate limiting. Cloudflare's free tier imposes global limits (100k Worker requests/day, D1 row limits) which provide some natural throttling. The app is single-user-per-account so abuse risk is low. If the app grows, Cloudflare Rate Limiting rules can be added at the Cloudflare dashboard level without code changes.

### claim-cats is a global migration endpoint
`POST /api/auth/claim-cats` assigns ALL orphaned cats (user_id IS NULL) to the requesting user. This was designed for the one-time migration when auth was added. In production there should be no orphaned cats (all cats now get user_id on creation). The endpoint is kept for backward compatibility but should eventually be deprecated.

### Audit logging (SEC-15, implemented)
The `audit_log` D1 table records security-relevant events: `sign_in`, `sign_out`, `account_deleted`, `data_exported`, `cat_deleted`, `member_added`, `member_removed`, `role_changed`. Each entry captures `user_id`, `ip_address` (from `cf-connecting-ip`), `user_agent`, and a JSON `metadata` blob. Writes are best-effort via `waitUntil` (never block the response). Entries are retained for 90 days; the daily cron purges older rows. No API endpoint exposes the log — it is queried via `wrangler d1 execute` during incident investigation.

### OAuth providers
The app supports Google OAuth and Apple Sign In. No password-based auth means no brute force concern. MFA is handled by each provider's own account security.

**Apple native Sign In** (`POST /api/auth/apple-native`) verifies JWT identity tokens against Apple's JWKS. **Replay prevention (SEC-13, implemented):** Each consumed token's `sub|iat` is SHA-256 hashed and stored in the `apple_token_cache` D1 table. Duplicate tokens within the 10-minute validity window are rejected with `409`. The daily cron cleans expired entries.

### Account deletion — re-authentication gate (SEC-11, implemented)
`DELETE /api/auth/account` permanently deletes all user data (cats, measurements, medications, photos, sessions, device tokens, household memberships). **Re-authentication is required:** the requesting session must have been created within the last 5 minutes (checked via `sessions.created_at`). If the session is older, the endpoint returns `403 { error: "Re-authentication required", action: "re-sign-in" }`. The client prompts the user to sign in again, creating a fresh session.

`GET /api/auth/me` includes `session_age_seconds` so clients can pre-flight this check and prompt re-auth before showing the deletion UI.

### Data export — rate limited (SEC-12, implemented)
`GET /api/auth/export` returns a full JSON dump of user data. Rate limited to 5 requests per hour per user via the `rate_limits` D1 table. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header. Stale rate limit windows are cleaned up by the daily cron.

### Bearer tokens — device fingerprint binding (SEC-10, soft enforcement)
Bearer tokens sent in `Authorization` headers are now associated with a device fingerprint (`sessions.device_fingerprint` column, stored at session creation from the `X-Device-Id` header). **Current enforcement: logging only** — the auth middleware logs mismatches (`console.warn`) but does not reject requests. This allows monitoring the false-positive rate before enabling hard enforcement. Hard blocking is planned for a future phase.

### Authorization header in CORS (SEC-16, accepted risk)
The CORS configuration allows the `Authorization` header from known origins. This is an accepted risk: an XSS vulnerability on `cat-tracker.pages.dev` would already have access to the session cookie (SameSite=Lax), so allowing `Authorization` in CORS does not widen the attack surface. Mitigation: Content-Security-Policy headers are already in place on the frontend.

### Device token validation (SEC-14, implemented)
`POST /api/auth/device-token` validates token format: Expo push tokens (`ExponentPushToken[...]`), APNs hex tokens (64 hex chars), and web tokens (20-500 chars). Invalid tokens are rejected with `400`. Each user is capped at 10 device tokens; registering a new token prunes the oldest beyond the cap.

### No "logout all devices" for users
`POST /api/auth/logout` clears only the current session. Users cannot remotely revoke other sessions (e.g., if a device is lost). Mitigated by the 7-day rolling expiry — a session on a lost device expires within 7 days of last use.

---

## Security Review Cadence

Run a security review when:
- Introducing new API routes or authentication flows
- Changing session or cookie behavior
- Adding file upload or user-supplied URL handling
- Adding server-side rendering or template evaluation

The review checklist:
1. All new routes behind `requireAuth` unless explicitly public
2. All DB queries use parameterized statements
3. All user-supplied strings have server-side length validation
4. New data types or fields have appropriate access control
5. New third-party integrations follow the secrets-never-in-source principle
