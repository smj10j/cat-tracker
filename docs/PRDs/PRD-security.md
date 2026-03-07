# PRD: Security Hardening

| | |
|---|---|
| **Status** | `Approved` |
| **Author** | Security Review |
| **Created** | 2026-03-07 |

---

## Background

A security review of the full codebase identified several findings ranging from high to low severity. This PRD defines fixes for all actionable items. Informational findings are documented in [SECURITY.md](../SECURITY.md) as accepted limitations.

---

## Findings

### SEC-01 — TOCTOU race in OAuth state verification (HIGH)

**Location:** `worker/src/routes/auth.ts` — `/auth/callback`

**Issue:** State verification performs a `SELECT` followed by a `DELETE` in a background `waitUntil()`. Two simultaneous callback requests with the same state could both pass the `SELECT` check before either `DELETE` executes, allowing state reuse.

**Fix:** Replace the SELECT + async DELETE with a single atomic `DELETE ... RETURNING` statement. If the DELETE returns a row, the state was valid and is now consumed. If it returns nothing, the state is invalid or already used.

```sql
-- Before (race-prone):
SELECT state FROM oauth_states WHERE state = ? AND expires_at > datetime('now')
-- ... then later, in waitUntil:
DELETE FROM oauth_states WHERE state = ?

-- After (atomic):
DELETE FROM oauth_states WHERE state = ? AND expires_at > datetime('now') RETURNING state
```

---

### SEC-02 — CORS accepts all origins (MEDIUM)

**Location:** `worker/src/index.ts`

**Issue:** `cors({ origin: '*' })` allows any origin to make requests. While `SameSite=Lax` cookies prevent cross-site credential inclusion (mitigating CSRF), wildcard CORS is poor practice and could enable cross-origin reads of public API responses.

**Fix:** Lock the `origin` option to known origins:
- `https://cat-tracker.pages.dev` (production)
- `https://*.cat-tracker.pages.dev` (preview deployments)
- `http://localhost:*` (local development)

---

### SEC-03 — No security response headers (MEDIUM)

**Location:** Worker (API responses) and Cloudflare Pages (SPA)

**Issue:** Responses lack defensive HTTP headers. An attacker could exploit MIME sniffing, clickjacking, or unrestricted content sources.

**Fix (Worker — API responses):**
Add a middleware that sets on every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

**Fix (Pages — SPA):**
Add `frontend/public/_headers` with:
- `Content-Security-Policy` restricting scripts, styles, fonts, images, and connections
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling unused browser APIs

---

### SEC-04 — No server-side input length validation (MEDIUM)

**Location:** `worker/src/routes/cats.ts`, `worker/src/routes/measurements.ts`, `worker/src/routes/import.ts`

**Issue:** Text fields have no server-side length limits. A malicious client could POST a 10MB `notes` field, bloating the D1 database and causing rendering issues.

**Fix:** Validate field lengths on every write endpoint:

| Field | Limit |
|-------|-------|
| cat name | 200 chars |
| breed, coloring | 200 chars |
| cat notes | 4000 chars |
| measurement notes | 1000 chars |
| microchip_id | 50 chars |

---

### SEC-05 — No measurement type/value validation (MEDIUM)

**Location:** `worker/src/routes/measurements.ts`

**Issue:** `type` and `unit` accept arbitrary strings. `value` has no range check for scale types. Invalid data bypasses the frontend preset system and could cause rendering errors.

**Fix:**
- `type` must be one of: `weight`, `food`, `water`, `litter`, `grooming`, `activity`, `vomiting`
- `unit` must be one of: `lbs`, `kg`, `scale`
- Scale values must be integer 0–3
- Weight values must be positive and ≤ 200

---

### SEC-06 — No import body size limit (MEDIUM)

**Location:** `worker/src/routes/import.ts`

**Issue:** `c.req.text()` reads the entire request body with no size cap. A large upload could exhaust Worker CPU time or cause timeouts.

**Fix:** Reject requests with body > 1 MB (1,048,576 bytes) with HTTP 413.

---

### SEC-07 — No session count limit per user (LOW)

**Location:** `worker/src/routes/auth.ts` — `/auth/callback`

**Issue:** A user logging in repeatedly from many devices accumulates sessions in D1 indefinitely. The daily cron only cleans expired sessions; active sessions grow without bound.

**Fix:** After creating a new session, run a background cleanup that deletes all sessions beyond the 20 most recent for that user.

---

### SEC-08 — Frontend inputs lack maxLength (LOW)

**Location:** `frontend/src/pages/AddEditCat.tsx`, `frontend/src/components/MeasurementForm.tsx`

**Issue:** Inputs have no `maxLength` attribute, allowing users to type arbitrarily long values before hitting the server-side limit.

**Fix:** Add `maxLength` to all text inputs matching the server-side limits. This is a UX improvement only — server validation is authoritative.

---

## Non-findings (reviewed and accepted)

| Topic | Assessment |
|-------|-----------|
| SQL injection | Not present — all queries use parameterized `.bind()` |
| XSS | Not present — React escapes all dynamic content; no `dangerouslySetInnerHTML` |
| CSRF | Mitigated by `SameSite=Lax` cookie and same-origin proxy |
| Session fixation | Not present — new session created after each OAuth auth |
| Brute force | Not applicable — Google handles credentials; no password auth |
| Secret exposure | Credentials are Worker secrets, not in source |
| Direct DB access | Not possible — D1 only accessible via Worker binding |

---

## Implementation Plan

All items in a single sprint. Implement in this order:

1. `worker/src/routes/auth.ts` — SEC-01 (atomic state), SEC-07 (session limit)
2. `worker/src/index.ts` — SEC-02 (CORS), SEC-03 (API security headers)
3. `worker/src/routes/cats.ts` — SEC-04 (length validation)
4. `worker/src/routes/measurements.ts` — SEC-04 + SEC-05 (length + type validation)
5. `worker/src/routes/import.ts` — SEC-04 + SEC-06 (length + body size)
6. `frontend/public/_headers` — SEC-03 (Pages security headers)
7. `frontend/src/pages/AddEditCat.tsx` — SEC-08 (maxLength)
8. Deploy Worker, deploy frontend
