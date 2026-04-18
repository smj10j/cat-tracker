# PRD — Tuya / Smart Life Cloud Connector (vendor OAuth2)

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-04-17 |
| **Depends on** | PRD-device-integrations.md Phase A (ingest substrate), PRD-device-integrations.md §10.2 (Tuya OAuth2 reachability finding) |
| **Related** | PRD-security-phase2.md (token lifecycle patterns), PRD-household-sharing.md (who writes to which cat) |
| **Origin** | Competitive research 2026-04-17 (see PRD-device-integrations.md §10) |

---

## 1. Problem

The original ingest PRD (§2.2) assumed no pet-device vendor exposes a usable OAuth API. 2026-04-17 competitive research discovered that **Tuya / Smart Life does** — and unlike Sure Petcare, Whisker, Petivity, or Petlibro's non-Tuya cloud, Tuya's developer platform is a published, documented, real OAuth2 authorization-code flow with a generous free tier.

Tuya (Chinese IoT platform, 500,000+ smart device SKUs, the backend for both the "Smart Life" and "Tuya Smart" apps) powers most of the long-tail inexpensive pet devices sold on Amazon, Aliexpress, and Walmart — generic feeders, fountains, pet scales, and cat flaps under brand names like **Tikpaws, Oneisall, WOpet, Faroro, Pawbby, HoneyGuaridan**, as well as SKUs from Catlink and others. The same platform backs Home Assistant's official Tuya integration.

**This matters because:** the chronic-care and budget-conscious segments of our audience overlap heavily with owners of cheap Tuya-inside devices. They are not HA users. They will never see our BYO Data REST API. They deserve a "sign in with Smart Life" button, and Tuya is the one major vendor where that's actually achievable through supported public APIs.

---

## 2. Goal

Let a Whisker Health user who has pet devices configured in the Smart Life or Tuya Smart app click "Connect Smart Life," complete a standard OAuth2 consent flow, and have their feeders / fountains / scales / cat flaps flow measurements into Whisker Health automatically — with no developer tooling, no passwords stored, no reverse-engineered clients.

---

## 3. Landscape — what Tuya actually offers

### 3.1 The platform

- **Platform:** Tuya IoT Development Platform (aka Tuya Cloud Development). Sign up at `iot.tuya.com`. Free to register; developer agreement applies.
- **Project:** we create a single "Cloud Project" scoped to our account with client credentials (`client_id`, `client_secret`).
- **OAuth flow:** Authorization-code with user consent (`code` → token exchange → access_token + refresh_token). Tuya hosts the consent page (`openapi.tuya<region>.com`).
- **Device data:** after consent, our project can call `GET /v1.0/users/{uid}/devices` to list the user's devices, then `GET /v1.0/devices/{device_id}/status` for current state, or use Tuya's Message Queue / Pulsar subscription for event streams.
- **Free tier (IoT Core Trial Edition):** **1,000,000 cloud requests/month and 100 end users** on the Smart App SDK Development plan. Sufficient for pilot. Platform ceiling: 500 req/sec, 500k calls/day per app.

Sources: `developer.tuya.com` OAuth 2.0 Authorization Flow; Tuya Membership/Pricing docs; `tuya.com/solution/hardware/pets` (documents TuyaOS pet-feeder and pet-camera device types).

### 3.2 The regional complication (load-bearing)

Tuya operates **7 regional data centers:** China, US East, US West, Central EU, Western EU, India, Singapore.

- Every Tuya user account is homed to exactly one DC based on where they first registered.
- OAuth flow and device API **must** target the user's home DC. Cross-region calls are **hard-blocked** at the Tuya gateway.
- Western-EU and Central-EU were split in 2024 — breaking integrations that assumed a single EU endpoint.
- Our implementation needs to handle region detection at consent time (user picks, or we probe) and store `region` on the connection.

### 3.3 Supported device categories (Tuya's "category code")

Relevant to us:

| Tuya category | Device type | Whisker Health measurement |
|---|---|---|
| `cwwsq` | Pet feeder | `food` (portion g) |
| `cwy` | Pet fountain | `water` (ml dispensed if supported; otherwise runtime-based estimate — noisy) |
| `cwt` | Pet treater | `food` (treat count) |
| `qp` | Smart scale (human or pet) | `weight` (kg) |
| `tzc3` | Pet training collar | (out of scope v1) |
| `mzj` / `bgl` | Cat flap / door | (out of scope v1 — no per-cat data from generic Tuya flaps) |
| `sp` | Pet camera | (out of scope — we don't ingest video) |

Per-device Data Point (DP) schemas are published in Tuya's device category docs. Different feeder firmwares emit different DP codes; normalizer per category documented in §4.4.

### 3.4 What Tuya does not give us

- **No Sure Petcare, Petlibro (non-Tuya cloud), PETKIT (non-Tuya cloud), or Whisker / Litter-Robot devices.** These vendors run their own clouds and are not reachable via Tuya.
- **No per-cat attribution** for most Tuya devices — microchip RFID is rare in budget feeders. Falls back to household-scoped events per parent PRD §1.5 option (C).
- **No historical backfill beyond Tuya's retention window** (varies by device type; typically 30–90 days).

---

## 4. Technical design

### 4.1 OAuth flow

1. User → Settings → Integrations → **Smart Life / Tuya** → **Connect**.
2. Region picker (US / EU / Asia / South America) with default inferred from user's billing locale (if known) or browser timezone.
3. Redirect to Tuya authorization URL for the chosen DC:
   `https://openapi.tuya{region}.com/v1.0/token?grant_type=authorization_code&...` (exact endpoint per Tuya docs; flow documented in `developer.tuya.com/en/docs/iot/authorization-code-page-usage`).
4. User completes Tuya consent screen (scope: read device data).
5. Tuya redirects back to `https://cat-tracker-api.stevej-67b.workers.dev/api/integrations/tuya/callback?code=...` (or the production equivalent).
6. Worker exchanges `code` for `access_token` + `refresh_token` using `client_id` + `client_secret` (from Worker secrets, **per region**).
7. Worker fetches `GET /v1.0/users/{uid}/devices`. Stores connection + device list. Shows device picker.
8. User checks devices to sync, maps each to cat + measurement type (same UX as HA connector §3.1 step 5).

### 4.2 Data model (D1 additions)

```sql
CREATE TABLE IF NOT EXISTS tuya_connections (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region                TEXT NOT NULL,          -- 'us' | 'eu-central' | 'eu-west' | 'cn' | 'in' | 'sg'
  tuya_uid              TEXT NOT NULL,          -- Tuya user id (not PII)
  access_token_ct       BLOB NOT NULL,          -- AES-GCM envelope
  refresh_token_ct      BLOB NOT NULL,
  token_key_version     INTEGER NOT NULL DEFAULT 1,
  access_expires_at     TEXT NOT NULL,          -- Tuya tokens short-lived (~2h)
  refresh_expires_at    TEXT NOT NULL,          -- long-lived (~30d); hard re-auth after
  last_ok_at            TEXT,
  last_error_at         TEXT,
  last_error_code       TEXT,
  state                 TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'reauth_required' | 'broken'
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tuya_connections_user ON tuya_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_tuya_connections_refresh ON tuya_connections(refresh_expires_at);

CREATE TABLE IF NOT EXISTS tuya_device_mappings (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  connection_id    TEXT NOT NULL REFERENCES tuya_connections(id) ON DELETE CASCADE,
  tuya_device_id   TEXT NOT NULL,
  tuya_category    TEXT NOT NULL,             -- 'cwwsq' | 'cwy' | 'qp' | ...
  cat_id           TEXT REFERENCES cats(id) ON DELETE SET NULL,
  measurement_type TEXT NOT NULL,
  unit             TEXT NOT NULL,
  dp_code          TEXT NOT NULL,             -- Tuya DP code we're watching (e.g. 'feed_report')
  is_active        INTEGER NOT NULL DEFAULT 1,
  last_event_at    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(connection_id, tuya_device_id, dp_code)
);
CREATE INDEX IF NOT EXISTS idx_tuya_mappings_conn ON tuya_device_mappings(connection_id);
```

### 4.3 Polling + event handling

**Polling-first, subscription-optional.**

- **Polling cron (15-min default):** for each active connection past its interval, refresh the access token if near expiry, then `GET /v1.0/devices/{id}/logs` per mapped device for the last-poll-to-now window. Tuya returns structured DP events with timestamps. Normalize (§4.4), dedup, write through internal ingest pipeline with `source = 'tuya:<connection_id>'`.
- **Tuya Pulsar message subscription (optional v2):** Tuya also exposes a Pulsar topic for real-time device events. Worker cron can't hold a long connection, but a dedicated Durable Object or scheduled worker could subscribe and feed D1. Defer until polling proves insufficient for a clinical use case. Polling is cheap on our free-tier cloud request budget (~2 calls × 15 min × 24h × 30d = 2880 calls/connection/month; at 100 users with 3 devices each = 864k calls — inside the 1M free budget). If we exceed, narrow to active devices only.

### 4.4 Per-category DP normalizers

Each Tuya device category emits DPs with stable codes. v1 ships normalizers for:

- **`cwwsq` feeder:** DP `feed_report` (grams per feed), `remote_feed` (trigger → record grams). Emit `food` measurement with `value=grams, unit='g'`, `measured_at` = event timestamp.
- **`cwy` fountain:** DP `water_level` (tank %). Runtime-based water consumption is noisy — drop if device does not expose a consumption DP. Emit `water` only if `water_used` DP present.
- **`qp` scale:** DP `weight` (kg × 100 → kg). Emit `weight` measurement; let the owner attribute to a cat per reading (UI prompt after first-poll batch).

Normalizers live in `worker/src/lib/integrations/tuya/normalizers.ts`. Each normalizer is a `(raw: TuyaDp, mapping: Mapping) → Measurement | null` function. Unknown DP codes for a category are logged and dropped (surface in debug UI).

### 4.5 Token refresh & re-auth

- Tuya access tokens ~2h; refresh tokens ~30d (confirm at implementation time).
- Cron handler refreshes tokens when `access_expires_at - now() < 10 min`.
- If refresh fails 3 times in a row → mark connection `reauth_required`; email user + in-app banner.
- Refresh token expiry (~30d) forces user to re-auth via OAuth — Tuya's design, we can't work around it. Mark this clearly in the UI ("re-link every 30 days — Smart Life limitation").

### 4.6 Frontend

- Web: `frontend/src/pages/SettingsIntegrations/Tuya.tsx`
- iOS: `app/app/settings/integrations/tuya.tsx`
- Deep-link handling for the OAuth callback on iOS (universal link or custom scheme, same pattern as existing Google OAuth).

---

## 5. Non-goals

- **Device control** (triggering a dispense, pausing a fountain). Read-only.
- **Supporting every Tuya device category.** v1 covers feeder, fountain, scale. Treaters and cat-flaps in v2 if demand signal.
- **Listing devices across multiple Tuya accounts per user.** v1 = one Tuya account per Whisker Health user. Second account is a future scope.
- **Full Pulsar event-stream subscription.** Polling covers v1.
- **Acting as a Tuya custom skill / voice assistant.** Out of scope.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **Chinese-platform regulatory exposure.** Tuya HQ in Hangzhou. Data flowing through Tuya Cloud is subject to Chinese data law. Some users will object on principle. | (a) Document clearly in consent flow: "Your device events flow through Smart Life / Tuya's cloud before reaching us — your devices already do this, connecting Whisker Health does not add a data path." (b) Link Tuya's privacy policy + our own. (c) Region-appropriate DC (US users' data stays in US DC). (d) Provide an explicit "disconnect and delete" that deletes `tuya_connections` rows and our derived measurements on demand. |
| **Tuya API rotation / breaking changes.** Tuya revs their Open API periodically. Historical pet-vendor churn (Whisker, Petnet) has burned the ecosystem. | (a) Pin API version in our client; (b) subscribe to Tuya developer bulletins; (c) integration tests run weekly against a dev-sandbox Tuya account to catch rotations early. |
| **Cross-region call blocked** (US user's account homed in CN DC, e.g. traveler who first registered Smart Life in China) | Region picker is **user-chosen, not auto-inferred**, with a clear explanation. If user picks wrong region, consent fails loudly with a region-mismatch error and a link to correct it. |
| **Refresh-token expiry (~30d)** forces manual re-auth, which will frustrate users | Calendar reminder email at day 25 with 1-click reconnect link. Make it ergonomic rather than invisible. |
| **Free tier exhausted at ~100 users / 1M requests** | Telemetry on request volume, alert at 60% of monthly budget. Paid tier is tiered — plan a business decision before crossing. Worst case: slow poll interval (1h instead of 15min) cuts request budget 4×. |
| **Device-category coverage gaps** — user connects an unknown Tuya device category and gets nothing | v1 UI explicitly shows "supported" vs "detected but no parser yet" devices. Unsupported devices can be flagged for parser work; measured demand drives what we build next. |
| **Token leak** | Envelope encryption at rest (same pattern as HA connector §7.1). Refresh token especially sensitive — compromise gives an attacker 30d of read-access. |
| **Per-cat attribution** — most Tuya feeders/fountains lack RFID | Events stored with `cat_id = null` (household-scoped per parent PRD §1.5 option C). Attribution inference is a separate future PRD. |
| **Vendor brand confusion on outages** | Consent flow displays "Powered by Tuya / Smart Life." When we can't reach Tuya, error states name Tuya explicitly so users know where the break is. |
| **Tuya TOS compliance** | Our use case (read user's own device data with explicit user consent) is exactly what the OAuth flow is designed for. Document in a legal memo before public launch. No grey area here — unlike reverse-engineered clients. |
| **Two-factor auth in Tuya consent breaks non-interactive flows** | OAuth is always interactive at consent time; refresh is non-interactive and uses our stored refresh token. No structural conflict. |

---

## 7. Security

Follows the same envelope-encryption pattern as PRD-home-assistant-connector §7. Shared KEK infra — reuse `TUYA_TOKEN_KEK_V1` binding structure (new secret).

Additional considerations:

- **Tuya client_id / client_secret** are Worker secrets, per-region (`TUYA_CLIENT_ID_US`, `TUYA_CLIENT_SECRET_US`, `TUYA_CLIENT_ID_EU`, etc.) if separate projects are required per region. Check Tuya docs: single project can serve all regions, but callback URL and signed-origin checks are per-region.
- **OAuth state parameter** for CSRF (reuse `oauth_states` D1 table already in use for Google OAuth).
- **Audit log entries:** `tuya_connected`, `tuya_disconnected`, `tuya_reauth_required`, `tuya_region_mismatch`.
- **Account deletion / GDPR export:** must include `tuya_connections` and `tuya_device_mappings`. Refresh token destruction on disconnect is user-facing: "disconnect" also POSTs a token-revocation to Tuya (if supported) — best-effort.

---

## 8. Success and kill criteria

**v1 ship (Phase A):** connector live for 1 DC (US), feeder + fountain + scale normalizers, 0 P0/P1 security findings, 1 reference setup blog post + demo video.

**Week 4:** ≥ 5 connected users; ≥ 60% successfully syncing at least one device.

**Week 12:** ≥ 20 connected users; ≥ 50% of their measurements arriving via Tuya (vs manual entry).

**Kill if at Week 12:**
- < 8 connected users (signal: audience not here; the Tuya long-tail owner maybe isn't discovering us).
- Support load > 4× average (signal: token refresh friction + region complexity are too expensive).
- Tuya API breakage has cost > 2 eng-days in the quarter.

Note: the audience for this connector **may not overlap** with the HA connector audience. Track separately.

---

## 9. Open questions for the product owner

1. **Launch regions.** Start with US only (cheapest test bed), add EU and Asia once US is stable? Recommended: yes.
2. **Legal review.** Tuya TOS and a China-data-flow privacy memo before public launch. Recommended: yes, 1 lawyer-day before Phase A ship.
3. **Marketing language.** "Connect Smart Life" vs "Connect Tuya" vs both? Smart Life has more US brand recognition; Tuya has more EU recognition. Recommend both, side-by-side, with helpful "these are the same platform" copy.
4. **Device-category priority.** v1 = feeder + fountain + scale (most pet-value-per-category). Treater + flap + collar in v2 on demand. Confirm.
5. **Per-cat attribution UX.** For scales/fountains lacking RFID, shall we implement a simple "assign this weight to [cat]" review UI inline with first-ingest? Recommended: yes — it's the lowest-friction attribution path for budget-device owners.
6. **Paid tier trigger.** When do we upgrade from Tuya's free tier? Recommend at 60% of monthly request budget, budget reviewed at Week-12 gate.
7. **Sandbox / dev account** for CI. Recommended: yes, one dedicated Tuya account wired to a dev Whisker Health instance for automated test runs against live Tuya API.

---

## 10. Implementation plan (conditional on Approval)

**Phase A — US region + core categories** (≈1.5 sprints)
1. Tuya Cloud Project setup (dev + production); secrets provisioning
2. D1 tables + migration (`tuya_connections`, `tuya_device_mappings`)
3. OAuth callback route + `oauth_states` integration
4. Envelope-encrypted token storage (reuse HA connector's crypto helper)
5. `GET /api/integrations/tuya/*` routes (list, detail, devices, mappings CRUD)
6. `pollTuyaConnections` cron handler (token refresh + device-log polling)
7. Per-category normalizers (`cwwsq`, `cwy`, `qp`)
8. Web + iOS settings UI + OAuth redirect handling
9. Source-badge rendering (`tuya:*`)
10. Tests: OAuth round-trip (integration, against Tuya sandbox), token refresh, normalizers (unit), export/deletion (integration)
11. Legal memo + privacy policy update + Tuya branding review
12. Reference blog post + demo video

**Phase B — Multi-region + reliability** (≈1 sprint)
13. EU Central + EU West + Singapore DC support
14. Re-auth email reminder cron (Resend)
15. Integration sandbox CI job (weekly live-API test)
16. Paid-tier budget alerting

**Phase C — Depth** (≈1 sprint, post-gate)
17. Treater + cat-flap categories (if user demand appears)
18. Optional: Pulsar message subscription for real-time events
19. Per-cat scale attribution UI
