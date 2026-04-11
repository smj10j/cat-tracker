# PRD: Security Hardening Phase 2 — Native App & Multi-Client

> **Status:** Approved
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11
> **Depends on:** PRD-security.md (Implemented), PRD-ios-app-store.md (In Progress)

---

## Problem Statement

PRD-security.md (Phase 1) addressed the initial security findings: TOCTOU OAuth race, CORS scoping, security headers, input validation, session limits, and frontend maxLength. All were implemented.

The iOS app introduces new attack surface that Phase 1 didn't cover:

1. **Bearer tokens in transit** — Native apps send session tokens in `Authorization` headers instead of httpOnly cookies. These tokens are visible to any network proxy and aren't protected by `SameSite` cookie policy.
2. **Apple OAuth** — New auth provider with JWT verification, JWKS key rotation, and the `privaterelay.appleid.com` email relay — all new code paths that need hardening.
3. **Account deletion** — A new destructive endpoint (`DELETE /api/auth/account`) that permanently removes all user data. Misconfigured authorization or missing rate limiting could enable account takeover + deletion.
4. **Device token registration** — The `/api/auth/device-token` endpoint accepts push tokens. Malicious token registration could enable push spam or token harvesting.
5. **Native auth endpoint** — `POST /api/auth/apple-native` accepts raw identity tokens from the iOS SDK. Input validation and replay protection are minimal.
6. **Data export** — `GET /api/auth/export` dumps all user data as JSON. No rate limiting, no re-authentication before export.

---

## Goals

1. Harden all new endpoints introduced for the iOS app
2. Protect Bearer token authentication against replay, leakage, and session fixation
3. Add re-authentication gates before destructive or sensitive operations
4. Establish rate limiting on auth endpoints to prevent brute force

## Non-Goals

- WAF or DDoS protection (Cloudflare provides this at the edge)
- Penetration testing (separate engagement)
- SOC 2 compliance
- End-to-end encryption of measurement data

---

## User-Facing Impact

Most security changes are invisible to users. The ones that aren't:

| Change | What the user sees | Frequency |
|--------|-------------------|-----------|
| SEC-11 (re-auth on delete) | "Sign in again to delete your account" prompt in Settings | Rare — only when deleting account |
| SEC-12 (export rate limit) | "You've exported your data recently. You can export again in [X] minutes." | Rare — only on 6th+ export in an hour |
| SEC-13 (Apple replay) | Nothing visible if working correctly. If false-positive: "Sign-in failed, please try again." | Should never be seen |
| SEC-10 (device fingerprint) | Nothing in Phase C (soft enforcement, logging only) | Never in v1 |

**Rollback plan:** If SEC-13 (Apple replay cache) produces false positives that block legitimate Apple sign-ins, the fix must be deployable without a code change. Options: (a) truncate the `apple_token_cache` table via `wrangler d1 execute`, (b) if PRD-api-versioning's config endpoint is live, add a `appleReplayCheckEnabled` feature flag that can be toggled in KV. Either way, the window for false positives is small (~5 minutes per token lifetime), so the blast radius is limited.

---

## Findings & Requirements

### SEC-10 — Bearer token lacks binding to device (MEDIUM)

**Issue:** A Bearer token stolen from one device works on any device. httpOnly cookies are bound to the browser; Bearer tokens have no equivalent binding.

**Fix:** Add optional device fingerprint (device model + OS version hash) to the sessions table. On each request, compare the `X-Device-Id` header against the stored fingerprint. Log mismatches but don't block in v1 (soft enforcement) — hard enforcement in v2 after data collection.

**Migration note:** The `sessions` table currently has columns `id`, `user_id`, `expires_at`, `created_at`. Adding `device_fingerprint TEXT` requires a schema migration (`ADD COLUMN IF NOT EXISTS`).

### SEC-11 — Account deletion lacks re-authentication (HIGH)

**Issue:** `DELETE /api/auth/account` (worker/src/routes/auth.ts line ~377) only requires a valid session via `requireAuth` middleware. If an attacker obtains a session token, they can permanently delete the account — all cats, measurements, medications, household memberships, and R2 photos — with no server-side confirmation step.

**Current behavior verified:** The endpoint cascades through cats → measurements → medications → medication_doses → household_members, then deletes the user row. No re-auth, no rate limit, no confirmation.

**Fix:** Require re-authentication before account deletion.

Options considered:
- (A) Require the user to re-enter their password — N/A, OAuth-only, no passwords
- (B) Require a fresh OAuth session (sign-in within the last 5 minutes) — check `sessions.created_at`
- (C) Require a confirmation token sent via email — simpler, works for both OAuth providers

**Recommendation: Option B.** Check that the current session's `created_at` is within the last 5 minutes. If not, return `403 { error: "Re-authentication required", action: "re-sign-in" }`. The app prompts the user to sign in again, which creates a fresh session, then retries the deletion.

**Implementation detail:** The `sessions` table already has `created_at TEXT NOT NULL DEFAULT (datetime('now'))`. The check is:
```sql
SELECT created_at FROM sessions WHERE id = ? AND user_id = ?
-- Then in JS: if (minutesSinceCreation > 5) return 403
```

**UX note:** The 5-minute window means a user who signed in, navigated to Settings, and then decided to delete their account 6+ minutes later will be asked to sign in again. This is intentional friction for a destructive operation. The native app should pre-flight this check before showing the deletion confirmation UI — call `GET /api/auth/me` extended with a `session_age_seconds` field, and prompt re-auth proactively if the session is stale.

**Edge case:** If the user has multiple active sessions (e.g., web + native), only the session making the request is checked. Other sessions are not invalidated until the deletion completes.

### SEC-12 — Data export lacks rate limiting (MEDIUM)

**Issue:** `GET /api/auth/export` can be called unlimited times. An attacker with a session token could exfiltrate all user data rapidly.

**Fix:** Rate limit to 5 requests per hour per user. Use a D1 counter. Return `429` with `Retry-After` header.

**User-facing message (429 response):** The app should show: "You've exported your data recently. You can export again in [X] minutes." Not a generic "Rate limited" or "Try again later" — tell the user what happened and when they can act.

### SEC-13 — Apple identity token replay (MEDIUM)

**Issue:** `POST /api/auth/apple-native` (worker/src/routes/auth.ts line ~261) accepts an Apple identity token and creates a session. The token is verified against Apple's JWKS, but the same token could be replayed within its validity window (~5 minutes). An attacker who intercepts the token in transit could create their own session.

**Current behavior verified:** The handler verifies the JWT signature against Apple's JWKS, checks `iss`, `aud`, and `exp`, then upserts the user and creates a session. No replay detection.

**Fix:** Store consumed Apple tokens in a short-lived replay cache. Apple identity tokens do not reliably include a `jti` claim — use `sub` + `iat` (subject + issued-at) as the composite key instead.

**Recommended approach: D1 table** (not KV, because D1 is already used and KV doesn't exist in this Worker yet — adding a KV namespace just for replay cache is over-provisioning).

```sql
CREATE TABLE IF NOT EXISTS apple_token_cache (
  token_key TEXT PRIMARY KEY,  -- sha256(sub + '|' + iat)
  expires_at TEXT NOT NULL     -- iat + 10 minutes
);
```

On each `apple-native` request:
1. Compute `token_key = sha256(decoded.sub + '|' + decoded.iat)`
2. `SELECT 1 FROM apple_token_cache WHERE token_key = ?`
3. If found → reject with `409 { error: "Token already consumed" }`
4. If not found → `INSERT INTO apple_token_cache (token_key, expires_at) VALUES (?, ?)`
5. Proceed with session creation

**Cleanup:** Extend the existing daily cron to `DELETE FROM apple_token_cache WHERE expires_at < datetime('now')`. Given the 5-minute Apple token validity, rows accumulate slowly and clean up fast.

**Why not KV:** The PRD-api-versioning.md proposes adding KV for config. If that ships first, KV could be reused here. But the replay cache is a security-critical path that benefits from D1's transactional guarantees (the INSERT + SELECT must be atomic to prevent TOCTOU). Use D1.

### SEC-14 — Device token endpoint lacks validation (LOW)

**Issue:** `POST /api/auth/device-token` (worker/src/routes/auth.ts line ~529) accepts any non-empty string as a token and stores it in the `device_tokens` table. No format validation, no per-user cap. An attacker with a session token could register thousands of garbage tokens.

**Current behavior verified:** The handler checks only that `token` is truthy, then upserts into `device_tokens`. No format regex, no count check.

**Fix:**
1. Validate token format: `ExponentPushToken[...]` regex (`/^ExponentPushToken\[.{20,50}\]$/`) OR raw APNs hex token (`/^[a-f0-9]{64}$/i`). Reject with `400` if neither matches.
2. Cap at 10 device tokens per user. Before insert: `SELECT COUNT(*) FROM device_tokens WHERE user_id = ?`. If ≥ 10, delete the oldest (by `created_at`) before inserting.
3. Add `created_at TEXT NOT NULL DEFAULT (datetime('now'))` to `device_tokens` if not already present (needed for oldest-first cleanup).

**Note:** The `device_tokens` table is distinct from `push_subscriptions` proposed in PRD-medication-reminders.md Phase B. `device_tokens` stores native push tokens (APNs/FCM via Expo); `push_subscriptions` would store Web Push subscription objects (endpoint + keys). These serve different push delivery paths and should remain separate tables.

### SEC-15 — No audit logging for sensitive operations (MEDIUM)

**Issue:** Account deletion, data export, session creation, and household member changes produce no audit trail. If an account is compromised, there's no forensic data to determine what happened or when.

**Fix:** Create an `audit_log` table:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,  -- 'account_deleted', 'data_exported', 'sign_in', 'sign_out',
                             -- 'member_added', 'member_removed', 'role_changed', 'cat_deleted'
  ip_address TEXT,
  user_agent TEXT,
  metadata   TEXT,           -- JSON blob for action-specific context (e.g., affected user_id for role changes)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
```

Log events: account deletion, data export, sign-in (Google + Apple), sign-out, household member add/remove, role changes, cat deletion. Write the audit entry in the same D1 batch as the mutation (not a separate async call).

**Retention:** 90 days. Extend the existing daily cron: `DELETE FROM audit_log WHERE created_at < datetime('now', '-90 days')`.

**Relationship to PRD-household-sharing-phase2.md:** That PRD proposes a separate `household_activity` table for user-facing activity feeds. The `audit_log` here is a security/forensic table — not user-visible, retained for incident response. They serve different purposes and should remain separate. The `household_activity` table has `display_text` for UI rendering; the `audit_log` has `ip_address` and `user_agent` for forensics. Do not merge them.

**Access:** The audit log has no API endpoint in v1. It is queried via `wrangler d1 execute` during incident investigation. A future admin panel could expose it.

### SEC-16 — CORS allows Authorization header from any allowed origin (LOW)

**Issue:** Adding `Authorization` to `allowHeaders` means any script on `cat-tracker.pages.dev` (including XSS payloads) can send Bearer tokens to the API. Previously, only httpOnly cookies were used, which aren't accessible to JavaScript.

**Fix:** This is acceptable risk given that XSS on the Pages site would also have access to the cookie-based session. The mitigation is preventing XSS in the first place (CSP is already configured). Document this as an accepted risk in SECURITY.md.

---

## Proposed Implementation

### Phase A: Critical (before App Store launch)
- SEC-11: Re-authentication gate on account deletion
- SEC-13: Apple token replay prevention

### Phase B: Important (within 30 days of launch)
- SEC-12: Rate limiting on data export
- SEC-14: Device token format validation + per-user cap
- SEC-15: Audit logging table + logging for sensitive operations

### Phase C: Hardening (within 90 days)
- SEC-10: Device fingerprint binding (soft enforcement)
- SEC-16: Document accepted risk in SECURITY.md

---

## Open Questions (Resolved)

1. **Rate limiting mechanism — RESOLVED: D1 counters.** Cloudflare's built-in Rate Limiting requires a paid plan. KV doesn't exist in this Worker yet (unless PRD-api-versioning ships first). D1 counters are simplest: a `rate_limits` table with `(user_id, action, window_start, count)`. One write per rate-limited request is acceptable for the low-traffic endpoints being protected (export, device-token). For auth endpoints (sign-in), the existing session count cap (20 per user, SEC-07 from Phase 1) provides indirect rate limiting.

2. **Audit log retention — RESOLVED: 90 days.** 90 days is sufficient for a consumer app. Enterprise requirements (SOC 2 etc.) would demand longer, but that's out of scope per the Non-Goals. The cron cleanup is cheap and prevents unbounded table growth.

3. **Re-authentication UX — RESOLVED: Server-enforced re-auth (Option B).** "Type DELETE to confirm" is a client-side check that provides no security — an attacker with a session token can call the API directly. Server-enforced re-auth (fresh session within 5 minutes) is the minimum viable protection for a destructive endpoint. The UX friction is proportional to the severity of the action. See SEC-11 above for the implementation detail and the pre-flight check pattern.

4. **Data export re-authentication — RESOLVED: Rate-limit only.** Export is sensitive but not destructive — it reads data but doesn't modify it. Rate limiting (5/hour) prevents bulk exfiltration. Re-auth on every export would be hostile UX for legitimate use (e.g., exporting data before a vet visit).

---

*Last updated: 2026-04-11*
