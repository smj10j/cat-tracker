# PRD: Security Hardening Phase 2 — Native App & Multi-Client

> **Status:** Draft
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

## Findings & Requirements

### SEC-10 — Bearer token lacks binding to device (MEDIUM)

**Issue:** A Bearer token stolen from one device works on any device. httpOnly cookies are bound to the browser; Bearer tokens have no equivalent binding.

**Fix:** Add optional device fingerprint (device model + OS version hash) to the sessions table. On each request, compare the `X-Device-Id` header against the stored fingerprint. Log mismatches but don't block in v1 (soft enforcement) — hard enforcement in v2 after data collection.

### SEC-11 — Account deletion lacks re-authentication (HIGH)

**Issue:** `DELETE /api/auth/account` only requires a valid session. If an attacker obtains a session token, they can permanently delete the account with no confirmation step on the server side.

**Fix:** Require re-authentication before account deletion. Options:
- (A) Require the user to re-enter their password (N/A — OAuth-only, no passwords)
- (B) Require a fresh OAuth token (re-sign-in within the last 5 minutes) — check `sessions.created_at`
- (C) Require a confirmation token sent via email — simpler, works for both OAuth providers
- **Recommendation:** Option B — check that the current session was created within the last 5 minutes. If not, return 403 with `{ error: "Re-authentication required", action: "re-sign-in" }`. The app prompts the user to sign in again, which creates a fresh session.

### SEC-12 — Data export lacks rate limiting (MEDIUM)

**Issue:** `GET /api/auth/export` can be called unlimited times. An attacker with a session token could exfiltrate all user data rapidly.

**Fix:** Rate limit to 5 requests per hour per user. Use a simple D1 counter (or Cloudflare's Rate Limiting API if available on the plan). Return 429 if exceeded.

### SEC-13 — Apple identity token replay (MEDIUM)

**Issue:** `POST /api/auth/apple-native` accepts an Apple identity token and creates a session. The token is verified against Apple's JWKS, but the same token could be replayed within its validity window (~5 minutes).

**Fix:** Store consumed Apple token `jti` (JWT ID) or `sub`+`iat` in a short-lived replay cache (D1 table or KV with TTL). Reject tokens that have already been consumed.

### SEC-14 — Device token endpoint lacks validation (LOW)

**Issue:** `POST /api/auth/device-token` accepts any string as a token. No validation that it's a valid Expo push token format.

**Fix:** Validate that the token matches Expo's push token format: `ExponentPushToken[...]` or a raw APNs/FCM token pattern. Cap at 10 device tokens per user (prevent token stuffing).

### SEC-15 — No audit logging for sensitive operations (MEDIUM)

**Issue:** Account deletion, data export, session creation, and household member changes produce no audit trail. If an account is compromised, there's no forensic data.

**Fix:** Create an `audit_log` table with columns: `user_id`, `action`, `ip_address`, `user_agent`, `created_at`. Log: account deletion, data export, sign-in, sign-out, household member add/remove, role changes. Retain for 90 days.

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

## Open Questions

1. **Rate limiting mechanism:** Cloudflare's built-in Rate Limiting (paid plan) vs D1-based counters vs KV with TTL? D1 counters are simplest but add a write per request.
2. **Audit log retention:** 90 days is the PRD-household-sharing-phase2 proposal. Is that sufficient for security forensics?
3. **Re-authentication UX:** Forcing a re-sign-in for account deletion is friction. Is a "type DELETE to confirm" client-side check sufficient, or do we need server-enforced re-auth?
4. **Should data export also require re-authentication?** It's sensitive but not destructive. Leaning toward rate-limit-only, not re-auth.

---

*Last updated: 2026-04-11*
