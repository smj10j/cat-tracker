# PRD: API Versioning & Backend-Driven Updates

> **Status:** Draft
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11
> **Depends on:** PRD-ios-app-store.md (In Progress)

---

## Problem Statement

With the iOS app shipping via the App Store, frontend and backend deployments are no longer atomic. The web frontend (`frontend/`) deploys instantly via Cloudflare Pages, but the native app requires App Store review (1–7 days) and user-initiated updates. This means:

1. **Breaking API changes** can't be deployed without risking crashes for users on older app versions
2. **Feature flags** don't exist — there's no way to enable/disable features server-side without a client update
3. **Health thresholds and clinical content** are hardcoded in the client (`healthMetrics.ts`) — updating a threshold requires an app update or OTA push
4. **App Store review latency** means critical fixes (e.g., a wrong clinical threshold) can take days to reach users unless we use EAS Update (JS-only)

The web app doesn't have this problem today because the Worker and frontend deploy together. But with two (soon three) clients hitting the same API, backward compatibility becomes a hard requirement.

---

## Goals

1. Allow Worker API changes to ship without breaking any deployed client version
2. Enable server-driven configuration for values that change more frequently than app releases (thresholds, feature flags, copy)
3. Establish a deprecation protocol so old API versions can eventually be retired
4. Keep the system simple — no over-engineering for a single-developer project

## Non-Goals

- Full REST API versioning framework (e.g., `/v1/`, `/v2/` path prefixes) — too heavy for current scale
- GraphQL migration
- Backend-for-frontend (BFF) pattern
- Client-side schema migration

---

## Requirements

### R1: API Compatibility Header

- All clients send an `X-API-Version` header (or `Accept-Version`) with their build version (e.g., `1.0.0`)
- The Worker reads this header and can adapt response shapes if needed
- If no header is sent (existing web frontend, curl), the Worker assumes the latest version
- This is a lightweight alternative to URL-based versioning — it allows per-field adaptation without duplicating routes

### R2: Server-Driven Config Endpoint

- New `GET /api/config` endpoint returns runtime configuration:
  - Feature flags (e.g., `{ "pushNotificationsEnabled": true, "appleSignInEnabled": true }`)
  - Health threshold overrides (optional — allows adjusting thresholds without an app update)
  - Minimum supported app version (for force-upgrade prompts)
  - Maintenance mode flag
- Response is cached aggressively (e.g., 5-minute TTL, stale-while-revalidate)
- Client fetches on app launch and caches locally

### R3: Minimum Version Enforcement

- The `/api/config` response includes `minSupportedVersion: "1.0.0"`
- If the client's version is below this, the app shows a "Please update" screen
- This is a soft kill switch for critically broken versions

### R4: Additive-Only API Changes

- Document a policy: API responses may gain new fields at any time, but existing fields are never removed or change type without a major version bump
- Clients must ignore unknown fields (already true for TypeScript with `as` casts, but worth documenting)

### R5: Deprecation Protocol

- When a field or endpoint will be removed, add a `Sunset` response header with a target date
- Log which client versions are still using deprecated fields (via `X-API-Version` header)
- Only remove after 90 days and after confirming no active clients use the old version

---

## Proposed Implementation

### Phase A: Config Endpoint + Version Header
- Add `GET /api/config` (no auth required)
- Add `X-API-Version` header to the Expo app's `apiFetch`
- Add `X-Min-Version` to config response
- App checks version on launch, shows upgrade prompt if needed

### Phase B: Health Threshold Overrides
- Store threshold overrides in D1 (or KV) as a JSON blob
- `/api/config` merges overrides into a `thresholds` object
- `healthMetrics.ts` accepts optional server overrides, falls back to hardcoded defaults
- This allows adjusting a threshold (e.g., weight loss sensitivity) without any client deploy

### Phase C: Feature Flags
- Simple key-value feature flags in `/api/config`
- Client wraps features in `if (config.featureX)` checks
- Enables gradual rollout and kill switches

---

## Open Questions

1. **KV vs D1 for config?** KV is faster (edge-cached) but less queryable. D1 is already in use. For a config blob that changes rarely, KV is probably better.
2. **How frequently should the app poll config?** On launch + every 6 hours? Or just on launch?
3. **Should health threshold overrides be per-user or global?** Global is simpler and covers the main use case (correcting a wrong threshold for everyone).
4. **OTA updates via EAS Update already handle JS-only fixes.** Is the config endpoint redundant for threshold changes? No — EAS Update requires a deliberate push, while config changes are instant and don't require the user to restart the app.

---

*Last updated: 2026-04-11*
