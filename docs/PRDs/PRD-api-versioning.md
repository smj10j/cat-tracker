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

- All clients send an `X-API-Version` header with their build version (e.g., `1.0.0`)
- The Worker reads this header via middleware and stores it on the request context
- If no header is sent (existing web frontend, curl), the Worker assumes the latest version
- This is a lightweight alternative to URL-based versioning — it allows per-field adaptation without duplicating routes
- The header value follows semver (`major.minor.patch`) — the Worker only inspects `major` for breaking-change decisions

### R2: Server-Driven Config Endpoint

- New `GET /api/config` endpoint returns runtime configuration
- **No auth required** — the config is not user-specific and must be accessible before login
- Response shape:

```typescript
interface AppConfig {
  // Version enforcement
  minSupportedVersion: string     // e.g., "1.0.0"
  latestVersion: string           // e.g., "1.2.0"
  updateMessage?: string          // "A new version is available with..."

  // Feature flags
  features: {
    pushNotificationsEnabled: boolean
    appleSignInEnabled: boolean
    streaksEnabled: boolean         // future: PRD-ux-redesign 3B
    aiNarrativeEnabled: boolean     // future: PRD-ux-redesign 3D
    [key: string]: boolean          // extensible
  }

  // Health threshold overrides (optional — null means use client defaults)
  thresholds?: {
    weightLoss: {
      watchPctPerWeek?: number      // default: 0.5
      concerningPctPerWeek?: number // default: 1.0
      urgentPctPerWeek?: number     // default: 2.0
      peakLossWatch?: number        // default: 4.0
      peakLossConcerning?: number   // default: 7.0
      peakLossUrgent?: number       // default: 10.0
    }
    noiseFloorPct?: number          // default: 0.005
    minIntervalDays?: number        // default: 5
    referencePeakWindowDays?: number // default: 180
    referencePeakMinMeasurements?: number // default: 8
  }

  // Maintenance
  maintenanceMode: boolean
  maintenanceMessage?: string
}
```

- Config is stored in **Cloudflare KV** (not D1) for edge-cached, low-latency reads
  - KV namespace: `CAT_TRACKER_CONFIG`
  - Single key: `app_config` → JSON blob
  - Updated via `wrangler kv:key put` or a future admin endpoint
- Response includes `Cache-Control: public, max-age=300, stale-while-revalidate=600` (5-minute cache, 10-minute stale-while-revalidate)
- Client fetches on app launch and caches in memory (React state / AsyncStorage)
- Client re-fetches every 6 hours if the app stays open (background timer)

### R3: Minimum Version Enforcement

- `minSupportedVersion` in the config response defines the oldest client that can use the API
- Client checks on launch: if `appVersion < minSupportedVersion`, show a blocking "Please update" screen with a link to the App Store / Play Store
- The Worker **does not** enforce this at the API level in Phase A (soft enforcement on client). Phase B adds middleware that returns `426 Upgrade Required` for requests with `X-API-Version` below `minSupportedVersion`
- The "Please update" screen is a last resort — EAS OTA updates should handle most cases before they reach this point

### R4: Additive-Only API Change Policy

Document a policy (in `docs/API.md`):
- API responses **may gain new fields** at any time — clients must ignore unknown fields
- Existing fields are **never removed or change type** without incrementing the major version in `X-API-Version`
- New required request fields are never added to existing endpoints without a version gate
- Optional request fields may be added freely
- TypeScript `as` casts and Zod `.passthrough()` already handle unknown fields — document this explicitly

### R5: Deprecation Protocol

When a field or endpoint will be removed:
1. Add a `Sunset: <date>` response header with a target removal date (minimum 90 days from announcement)
2. Add a `Deprecation: true` header alongside Sunset
3. Log which client versions are still using deprecated fields (via `X-API-Version` header — store counts in KV)
4. Only remove after the Sunset date AND after confirming no active clients use the old version (check KV logs)
5. Document the deprecation in `docs/API.md` with the sunset date and migration path

---

## Technical Scope

### Worker Changes

**New middleware: `apiVersion.ts`**

```typescript
// worker/src/middleware/apiVersion.ts
export function apiVersionMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const version = c.req.header('X-API-Version') || 'latest'
    c.set('apiVersion', version)
    await next()
  }
}
```

Registered in `index.ts` before all route handlers.

**New route: `GET /api/config`**

```typescript
// worker/src/routes/config.ts
app.get('/api/config', async (c) => {
  const config = await c.env.CONFIG_KV.get('app_config', 'json')
  if (!config) {
    // Return sensible defaults if KV is empty
    return c.json({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.0.0',
      features: {
        pushNotificationsEnabled: false,
        appleSignInEnabled: true,
        streaksEnabled: false,
        aiNarrativeEnabled: false,
      },
      thresholds: null,  // use client defaults
      maintenanceMode: false,
    })
  }
  return c.json(config, 200, {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  })
})
```

No auth middleware on this route.

**New KV namespace binding in `wrangler.toml`:**

```toml
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "<created-via-wrangler-kv-namespace-create>"
```

**Types update (`types.ts`):**

Add `CONFIG_KV: KVNamespace` to `AppEnv.Bindings`.

### Frontend Changes (Web)

**`frontend/src/lib/api.ts`:**
- Add `getConfig(): Promise<AppConfig>` function
- No auth header required for this endpoint

**`frontend/src/contexts/ConfigContext.tsx`** (new):
- Fetches config on mount, provides via React context
- Exposes `useConfig()` hook
- Caches in state; re-fetches on 6-hour interval

**`frontend/src/lib/healthMetrics.ts`:**
- `assessHealth()` accepts optional `thresholdOverrides` parameter
- If overrides are provided (from server config), they replace the hardcoded defaults
- Hardcoded values remain as fallbacks — the app works fully offline without config

### Expo App Changes

**`app/lib/api.ts`:**
- All `apiFetch()` calls include `X-API-Version: <Constants.expoConfig.version>` header
- Add `getConfig()` function

**`app/contexts/ConfigContext.tsx`:**
- Same pattern as web, with AsyncStorage cache fallback for offline launch

**Version check on launch:**
- After fetching config, compare `Constants.expoConfig.version` against `minSupportedVersion`
- If below minimum: show blocking "Update Required" screen with App Store link
- If equal to or above: proceed normally

### Database Changes

None. Config lives in KV, not D1.

### Cloudflare Resources

| Resource | Name | Notes |
|----------|------|-------|
| KV namespace | `cat-tracker-config` | Created via `wrangler kv:namespace create cat-tracker-config` |

---

## Implementation Plan

### Phase A: Config Endpoint + Version Header (before iOS launch)
1. Create KV namespace for config storage
2. Add `CONFIG_KV` binding to `wrangler.toml` and `types.ts`
3. Implement `GET /api/config` route (no auth, KV read, cache headers)
4. Add `apiVersionMiddleware` to Worker
5. Add `X-API-Version` header to Expo app's `apiFetch()`
6. Implement `ConfigContext` in Expo app with version check on launch
7. Seed initial config in KV via `wrangler kv:key put`
8. Write tests for config route
9. Document additive-only API change policy in `docs/API.md`
10. Deploy Worker

### Phase B: Health Threshold Overrides (post-launch, within 30 days)
11. Add threshold override structure to KV config blob
12. Update `healthMetrics.ts` to accept and apply server overrides
13. Wire `ConfigContext` threshold overrides into chart and health assessment components
14. Add `ConfigContext` to web frontend (web currently doesn't need it, but prepares for parity)
15. Test: change a threshold in KV, verify both web and native reflect the change

### Phase C: Feature Flags + Deprecation (within 60 days)
16. Add feature flag checks to relevant UI components
17. Add `Sunset` / `Deprecation` header middleware for deprecated fields
18. Add client-version logging to KV (aggregate counts, not per-request)
19. Add server-side `426 Upgrade Required` enforcement for `minSupportedVersion`
20. Document deprecation protocol in `docs/API.md`

---

## Open Questions

1. **KV vs D1 for config?** KV is faster (edge-cached) but less queryable. D1 is already in use. For a config blob that changes rarely, KV is the right choice — it's designed for read-heavy, write-rare patterns. **Resolved: KV.**

2. **How frequently should the app poll config?** On launch + every 6 hours while open. This balances freshness with minimizing KV reads (which are free-tier-limited on Cloudflare). **Resolved: launch + 6h interval.**

3. **Should health threshold overrides be per-user or global?** Global. Per-user overrides add significant complexity (D1 storage, user-config merge logic) for a use case that doesn't exist yet. If a vet wants custom thresholds for a specific cat, that's a different feature (per-cat health profiles). **Resolved: global.**

4. **OTA updates via EAS Update already handle JS-only fixes. Is the config endpoint redundant for threshold changes?** No — EAS Update requires a deliberate push and the user must restart the app. Config changes via KV are instant and take effect on the next config poll (within 6 hours or on next app launch). Both mechanisms serve different purposes: EAS for code fixes, config for runtime adjustments.

5. **Should the web frontend also use the config endpoint?** Phase A: no (web deploys atomically with the Worker). Phase B: yes (for threshold overrides, so the web app can reflect the same thresholds as the native app). This ensures parity across clients.

---

## Success Criteria

- The iOS app sends `X-API-Version` on every API request
- `GET /api/config` returns a valid config blob in < 50ms (KV edge cache)
- Changing `minSupportedVersion` in KV causes old app versions to show the "Update Required" screen
- Changing a threshold override in KV is reflected in the native app within 6 hours (no app update needed)
- No existing API endpoints break when the version header is absent (backward compatible)
- The additive-only policy is documented and followed for all future API changes

---

*Last updated: 2026-04-11*
