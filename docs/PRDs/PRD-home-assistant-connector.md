# PRD — Home Assistant Direct Connector (pull-mode ingest)

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-device-integrations.md Phase A (ingest substrate, `measurements.source`, `external_id`, internal ingest pipeline) |
| **Related** | PRD-security-phase2.md (credential storage patterns), PRD-api-versioning.md (feature flag for gradual rollout) |
| **Origin** | Competitive research 2026-04-17 (see PRD-device-integrations.md §10) |

---

## 1. Problem

Home Assistant is the dominant open-source hub for smart-home devices, and its pet-device ecosystem is the broadest surface where Whisker Health's target data already lives: per-cat weights from Sure Petcare feeders, water volumes from Petlibro fountains, litter events from Whisker / PETKIT / CATLINK boxes, activity from Tractive collars, and anything wired up over Tuya / Zigbee / Matter inside the home.

The parent PRD's Tier 1 REST API assumes the HA user writes a YAML automation to POST events to us. That is the correct substrate, but it targets a narrow audience: HA power users who already author automations. **A much larger HA audience exists that does not:** owners who bought an HA hub expressly to pipe their Sure Petcare / Petlibro / Tuya data *somewhere useful*, and who expect a "connect" button rather than a code-editing exercise.

**Observation from competitive research (PRD-device-integrations §10.1):** the iOS app Padr integrates with HA via the published `/api/states` REST endpoint and a user-pasted long-lived access token. No YAML. No custom HACS component. This is the pattern this PRD proposes.

---

## 2. Goal

Let a Home Assistant user connect Whisker Health to their HA instance in under two minutes, map their existing pet-device sensor entities to cats and measurement types, and have data flow in automatically from that point forward — with zero YAML, zero HACS install, and zero developer-facing tooling.

---

## 3. User experience

### 3.1 Setup flow (first-run)

1. Settings → Integrations → **Home Assistant** → **Connect**.
2. Sheet explains the three values needed, with a "Why these?" disclosure:
   - HA URL (public HTTPS URL, typically Nabu Casa Cloud `https://<id>.ui.nabu.casa` or a self-hosted domain with TLS)
   - Long-lived access token (step-by-step screenshots of HA → Profile → Security → "Create Token")
   - A friendly label (e.g. "Home HA")
3. User submits. Worker validates: hits `GET {url}/api/` with the token, expects `200 {"message": "API running."}`. Stores credential encrypted (§7.2).
4. Worker calls `GET {url}/api/states` once and filters to sensor entities likely to be pet-relevant — heuristic on `entity_id` prefix (`sensor.*_weight`, `sensor.*_feeder_*`, `sensor.*_fountain_*`, `sensor.*_cat_*`, friendly name containing "cat"/"feeder"/"bowl"/"fountain"/"litter"/"scale"/"drink"/"eat"). Shows the full filtered list.
5. For each entity the user wants to sync, they pick:
   - Target **cat** (dropdown of their cats + "household" for aggregate)
   - Target **measurement type** (`weight` / `food` / `water` / `litter` / `grooming` / `activity` / `vomiting`) with a suggestion based on entity name
   - Unit override (default inferred from entity's `unit_of_measurement` attribute; shown but editable)
   - Event semantics: **State as value** (e.g., weight sensor) or **Delta between polls** (e.g., cumulative food dispensed counter)
6. Save → poll kicks off immediately and shows a live "pulled N events in the last 24h" confirmation.

### 3.2 Steady state

- One row per connected HA in `/settings/integrations/home-assistant`. For each row: status (healthy/degraded/broken), last successful poll, last error code, mapped entity count, events pulled (last 24h / 7d / 30d), edit mappings, disconnect.
- Per-mapping row: last value pulled, last pulled at, target cat/type, enable toggle, delete.
- Per-mapping request log (last 50 polls) to self-debug ("is my fountain working?").

### 3.3 Failure modes the user sees

- HA unreachable for > 24h → email the owner ("Your Home Assistant connection 'Home HA' hasn't responded since [date]. Check the URL or token.")
- Token rejected (401) → immediate email + persistent in-app banner linking to reconnect.
- Entity removed from HA → mapping shows a `?` badge; user can delete or leave pending.

---

## 4. Technical design

### 4.1 Data model (D1 additions)

```sql
CREATE TABLE IF NOT EXISTS ha_connections (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  url               TEXT NOT NULL,                -- normalized, trailing slash stripped, must be https
  token_ciphertext  BLOB NOT NULL,                -- AES-GCM envelope (see §7.2)
  token_key_version INTEGER NOT NULL DEFAULT 1,   -- for key rotation
  last_ok_at        TEXT,
  last_error_at     TEXT,
  last_error_code   TEXT,                         -- 'unreachable' | 'unauthorized' | 'tls' | 'parse' | 'rate_limited'
  poll_interval_s   INTEGER NOT NULL DEFAULT 900, -- 15 min default, min 300, max 3600
  state             TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'broken'
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ha_connections_user ON ha_connections(user_id);

CREATE TABLE IF NOT EXISTS ha_entity_mappings (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  connection_id    TEXT NOT NULL REFERENCES ha_connections(id) ON DELETE CASCADE,
  entity_id        TEXT NOT NULL,                 -- e.g. 'sensor.luna_feeder_portion_today'
  cat_id           TEXT REFERENCES cats(id) ON DELETE SET NULL, -- NULL = household-scoped event, to be attributed
  measurement_type TEXT NOT NULL,                 -- VALID_MEASUREMENT_TYPES
  unit             TEXT NOT NULL,                 -- canonical (kg, ml, g, scale, ...)
  mode             TEXT NOT NULL,                 -- 'state' | 'delta'
  last_state       TEXT,                          -- for delta mode: last observed raw state
  last_state_at    TEXT,                          -- ISO timestamp HA reported
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(connection_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_ha_mappings_conn ON ha_entity_mappings(connection_id);
```

### 4.2 Polling architecture

- Cron-triggered Worker (new handler `pollHaConnections`) runs every 5 minutes. Fetches active connections whose `last_ok_at + poll_interval_s < now()` OR `last_ok_at IS NULL`.
- For each due connection:
  1. Decrypt token (envelope, `token_key_version`).
  2. `GET {url}/api/states` with `Authorization: Bearer <token>`. 10s timeout.
  3. For each mapping where `is_active = 1`:
     - Find the entity by `entity_id`.
     - **State mode:** read `state` value, parse as number; emit a measurement with `measured_at = last_changed` attribute (HA's authoritative ISO timestamp), `value = parsed`, `unit = mapping.unit`, canonical unit conversion per parent PRD §3. Dedup by `external_id = <entity_id>:<last_changed>`.
     - **Delta mode:** compute `current - last_state`. If positive, emit that delta. Handle counter resets (new value < last_state) by emitting a single event of `value = current` and logging a reset. Dedup `external_id = <entity_id>:<last_changed>`.
  4. Internally call the same ingest pipeline used by the REST API — reuse validation, canonical unit normalization, dedup partial-index, and audit trail. Set `measurements.source = 'home-assistant:<connection_id>'` (connection-id-scoped so the user can delete one HA without nuking the others).
  5. Update `ha_connections.last_ok_at` on success; `last_error_at` + `last_error_code` on failure.
- **Backpressure:** cap per-poll work at 200 mappings per connection. Over that, paginate in subsequent runs (rare in practice).
- **Adaptive interval:** if a connection fails 3 polls in a row, back off `poll_interval_s` exponentially up to 1h; reset on success. Caps incoming error volume on a bad deploy.
- **Silence detection:** reuses parent PRD §1.5 + Phase A.5 silence-detection infrastructure. A connection producing zero measurements for 48h triggers the operational silence alert.

### 4.3 HA API details worth getting right

- **Entity timestamps.** `last_changed` is the authoritative moment-of-change. `last_updated` changes on every state write even if value didn't change — do not use it. HA returns ISO8601 with offset.
- **Entity `state` values** are strings. Must parse defensively (HA returns `"unknown"`, `"unavailable"`, `""` for stale sensors). Drop these with a per-entity counter; surface in the per-mapping log.
- **Unit attribute.** `attributes.unit_of_measurement` is the source-of-truth for unit inference at mapping-creation time. Honor it but let the user override.
- **Rate limits.** HA itself has none by default, but user may have a reverse proxy. Use `If-None-Match`/`ETag` on `/api/states` if supported by their HA version (2024.9+); fall back to full pull otherwise.
- **Long-lived access token scope.** HA tokens are unscoped and grant full admin API access. **This is the single biggest security concern** — see §7.

### 4.4 Frontend & cross-platform

- Web: `frontend/src/pages/SettingsIntegrations/HomeAssistant.tsx` (list, detail, add flow). Reuses existing form patterns.
- iOS: `app/app/settings/integrations/home-assistant.tsx`. Same flow. Token entry masked.
- No changes to shared lib except: add `'home-assistant:*'` as a recognized prefix in the source-badge rendering logic already introduced in parent Phase A.

---

## 5. Non-goals

- **Writing to HA** (setting states, calling services, controlling feeders). Pure one-way read.
- **Custom HACS integration / add-on.** The whole point is zero install on the HA side; we only pull from the public REST API.
- **WebSocket streaming from HA.** Polling is sufficient for health-trend timescales and keeps the architecture stateless. Revisit if a customer actually needs second-resolution data.
- **Discovery of HA instances via mDNS / Bonjour.** User pastes URL. Discovery is overengineering for v1.
- **Supervised.io add-on discovery / SSO integration.** Nabu Casa users give us a Nabu Casa URL; that's all we need.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| HA long-lived access tokens grant full admin API access (can control devices, read cameras, read user PII). Token leak is catastrophic. | (a) Envelope encryption at rest (§7.2); (b) token never round-trips to frontend after creation; (c) per-user token rotation reminder after 365 days; (d) user-facing documentation explicitly warns of the scope; (e) disconnect flow tells users to also revoke the token in HA itself. |
| User's HA URL is publicly exposed HTTPS with a weak TLS posture | Enforce HTTPS (reject HTTP). Follow Cloudflare Worker default TLS cert validation. Log + block on self-signed cert failures (with an explicit error message and docs link). |
| User points us at a compromised HA instance (spoofed values) | Data trust posture identical to the REST API — we accept what the user's authenticated channel pushes. Correlation engine handles outliers on the clinical side. |
| Counter-reset false deltas (feeder restart, HA reboot) | Counter-reset detection in delta mode logs a reset event; UI shows a small "counter reset" badge on the next measurement. Owner-trainable. |
| Household-sharing ambiguity: user A connects HA, user B shares cats with user A — whose data? | Connection is user-scoped. Mappings resolve to cats the connecting user has Contributor+ role on at write time. Reject otherwise (mirrors parent PRD §6 token/cat rule). |
| D1 write pressure during a poll burst | `pollHaConnections` batches writes per connection into a single D1 transaction (parent PRD §3 Phase A best-practice). The per-poll mapping cap (200) bounds worst case. Extend Phase A p95 SLO to include HA-driven writes. |
| HA versioning drift breaks our parser | Test matrix of HA release versions (currently 2024.x–2026.x). `attributes.unit_of_measurement` and `last_changed` have been stable since 2018; the parser is intentionally small. |
| User's HA is behind a cold-start Nabu Casa edge and our cron times out | 10s read timeout with 2 retries; mark as `degraded` not `broken` if intermittent. |
| Scraping a firehose (e.g. state update every second) blows our ingest quota | Adaptive polling interval + per-mapping event dedup (external_id = entity_id:last_changed) ensures we write at most one row per state change, not per poll. |
| Accidental multi-cat data scramble when user has one feeder + N cats | If `cat_id IS NULL` mapping (household), the event is stored household-scoped per parent PRD §1.5 option (C). Per-cat attribution is a follow-up PRD. |

---

## 7. Security

### 7.1 Credential storage

Long-lived access tokens are stored in `ha_connections.token_ciphertext` as AES-GCM envelope:

- Data key: a per-connection 256-bit DEK generated at creation.
- Key-encryption key (KEK): stored in Worker secret (`HA_TOKEN_KEK_V1`), rotatable via `token_key_version`.
- Rotation plan documented: introduce `HA_TOKEN_KEK_V2`, re-encrypt all rows to V2 on touch, drop V1 after all rows migrated.
- KEK never appears in D1. D1 contains only `{ciphertext, iv, authTag, key_version}`.

### 7.2 Worker secret bindings (new)

- `HA_TOKEN_KEK_V1` — 32-byte base64. Set via `wrangler secret put`. Document in `docs/SECURITY.md`.

### 7.3 API surface

- `POST /api/integrations/home-assistant` (create)
- `GET /api/integrations/home-assistant` (list connections for user)
- `GET /api/integrations/home-assistant/:id` (detail — token never returned)
- `PATCH /api/integrations/home-assistant/:id` (update label, poll interval, state)
- `DELETE /api/integrations/home-assistant/:id` (disconnect)
- `GET /api/integrations/home-assistant/:id/entities` (enumerate entities for picker, proxies `/api/states`)
- `POST /api/integrations/home-assistant/:id/mappings` (add mapping)
- `DELETE /api/integrations/home-assistant/:id/mappings/:mid`

Rate limit: 60 req/min per user on these routes (reuse existing `rate_limits` D1 table).

### 7.4 Audit log entries (new)

- `ha_connected`, `ha_disconnected`, `ha_poll_failed_auth` (fires on first 401 after healthy state).

### 7.5 Data export / deletion coverage

Account deletion and GDPR export must cover `ha_connections` and `ha_entity_mappings`. Add integration tests in Phase A. Token ciphertext is destroyed on deletion (DEK is ephemeral since it's enveloped under the KEK — deleting the row effectively revokes access).

---

## 8. Success and kill criteria

**v1 ship (Phase A):** connector live, 1 reference setup blog post, 0 P0/P1 security findings in launch week, recovery from a token-rotation drill tested.

**Week 4:** ≥ 5 connected HA users, each with ≥ 3 active mappings, writing ≥ 1 measurement/day per mapping.

**Week 12:** ≥ 25 connected HA users; ≥ 60% of their measurements arriving via HA (replaced manual entry, not added on top).

**Kill if at Week 12:**
- < 10 active connected users.
- Operational cost > 3× average user (most often: re-auth support tickets from token rotation).
- HA integrations have driven > 3 P1 incidents.

---

## 9. Open questions for the product owner

1. **Approve Draft** → Approved? Depends on parent PRD-device-integrations.md reaching Approved first.
2. **Entity picker heuristic.** Should we surface *all* `sensor.*` entities in a user's HA, or only the heuristic-matched subset? Recommended: heuristic-matched with a "Show all sensors" toggle. Tradeoff: users with unusually-named entities need the escape hatch, but an unfiltered list of 500+ entities is overwhelming for most users.
3. **Poll interval default.** 15 min (900s) recommended. Chronic-care segment (§parent PRD §1.5) may want shorter — expose as a 5-min / 15-min / 1-hour setting, with the bottom of the range gated behind a future premium tier. Confirm.
4. **Nabu Casa Cloud URL detection.** Auto-detect `*.ui.nabu.casa` and skip the TLS hardening warnings (their TLS is trusted). Confirm.
5. **Credential storage location.** D1 with envelope encryption (recommended) vs Workers KV. D1 keeps it with the rest of user data for atomic deletion. KV is faster but separates the data path. Recommended: D1.
6. **Token rotation reminder cadence.** HA doesn't expire long-lived tokens. Email user every 180 days recommending rotation as a defense-in-depth measure. Recommended: yes.
7. **Community blueprint.** Contribute an HA community blueprint showing the ideal reverse path (webhook from HA → our REST API) for users who *prefer* push over pull. Does not conflict with this PRD; complements parent PRD-device-integrations §9 Phase B. Recommended: yes.

---

## 10. Implementation plan (conditional on Approval)

**Phase A — Core connector** (≈1 sprint)
1. D1 tables (`ha_connections`, `ha_entity_mappings`) + migration
2. Worker KEK binding, envelope encryption helper in `worker/src/lib/crypto.ts`
3. Connection CRUD routes + entity enumeration proxy
4. Mapping CRUD routes
5. `pollHaConnections` cron handler, reusing internal ingest pipeline
6. Source-badge rendering on History for `home-assistant:*`
7. Web + iOS UI (Settings → Integrations → Home Assistant)
8. Tests: envelope crypto (unit), poll success + delta computation (integration), counter-reset handling (integration), token rotation (integration), export/deletion (integration)
9. `docs/API.md` integration section; `docs/SECURITY.md` KEK-rotation playbook; blog post "Connect Whisker Health to your Home Assistant in 2 minutes"

**Phase B — Operational polish** (≈3 days)
10. Silence alert integration (reuses parent Phase A.5 infrastructure)
11. Per-mapping request log UI (debug view)
12. Adaptive poll interval
13. 180-day rotation reminder email (Resend)

**Phase C — Entity inference improvements** (≈2 days, follow-up)
14. Better auto-suggest for measurement-type mapping from entity name + unit
15. "My vendor/device isn't listed, help me map it" flow

---

## 11. Addendum — implementation spec gaps (2026-07-02)

Closes four gaps found on review: the entity picker was described but not specified, connection-health states lacked precise transitions, the §7.1 envelope format is internally inconsistent, and there were no engineering acceptance criteria. Nothing here changes scope.

### 11.1 Entity-picker UX spec (completes §3.1 steps 4–5)

- **Default view:** heuristic-matched sensors only, with a "Show all sensors" toggle pinned at the bottom (proposed default for §9 Q2; PO can still override there).
- **List item contents:** friendly name (primary), `entity_id` (secondary, monospace), current state + `unit_of_measurement`, `last_changed` as relative time. Entities whose state is `unknown`/`unavailable`/`""` render greyed with a "stale" badge — selectable, but the user is warned no data will flow until the sensor reports.
- **Search:** search-as-you-type over friendly name + `entity_id`, client-side (the full list is fetched once via `GET .../entities`). Server proxy caps the response at 2,000 `sensor.*` entities (typical HA instances have 100–800 total entities; the cap is a safety valve, and hitting it shows a "use search in HA to trim entities" notice).
- **Empty state (zero heuristic matches):** "We didn't find any pet-looking sensors" + Show-all CTA + docs link ("what makes an entity pet-relevant?").
- **Already-mapped entities** show a check badge; tapping opens edit-mapping rather than creating a duplicate (backed by `UNIQUE(connection_id, entity_id)`).
- **Re-scan button** re-fetches `/api/states`; rate-limited to 6/min per connection via the existing `rate_limits` table.
- **Save gating:** suggested type/unit chips are prefilled (§3.1), but cat and measurement type require explicit confirmation before Save enables — never silently default the cat.

### 11.2 Connection-health state machine (consolidates §3.3 + §4.2 into precise transitions)

| State | Entry condition | User-visible surface | Polling behavior |
|---|---|---|---|
| `healthy` | Last poll succeeded | Green badge | Normal `poll_interval_s` |
| `degraded` | ≥ 1 consecutive failed poll (timeout/unreachable/tls/parse) | Yellow badge on settings row only; no email | From 3 consecutive failures: interval ×2 per failure, cap 3600 s (§4.2) |
| `broken` (unreachable) | 24h of continuous failures | Email (once per outage, §3.3) + red badge | Keep polling at max backoff |
| `broken` (unauthorized) | Any 401 | Immediate email + persistent in-app banner (§3.3) | **Stop polling immediately** — see note below |
| recovery → `healthy` | Any successful poll | Badge clears; send a "reconnected" email only if an outage email was sent | Interval and backoff reset |

- **401 hard-stop rationale:** HA counts failed auth attempts and, with `ip_ban_enabled`, can auto-ban the caller's IP — retrying a dead token can convert an auth problem into a permanent unreachable-host problem (and our egress IPs are shared Cloudflare ranges). Reconnect docs must mention checking HA's `ip_bans.yaml` if reconnection still fails.
- Add per-connection ±10% jitter when scheduling due connections inside the 5-min cron sweep to avoid synchronized herds.
- `timeout` folds into the existing `unreachable` error code; no enum change needed.

### 11.3 Envelope encryption — normative storage format + rotation runbook (corrects §7.1)

§7.1 lists the D1 contents as `{ciphertext, iv, authTag, key_version}` — this **omits the wrapped DEK**. Without it the scheme is direct KEK encryption and §7.5's "deleting the row revokes access" argument fails. Normative format:

- `token_ciphertext` stores a compact JSON envelope: `{ v: 1, kv: <key_version>, dek_iv, dek_ct, iv, ct }` (all byte fields base64). WebCrypto AES-GCM appends the auth tag to the ciphertext, so no separate `authTag` field.
- **DEK:** 256-bit random per connection (`crypto.getRandomValues`). Token encrypted AES-256-GCM under the DEK with `additionalData` (AAD) = `ha_connections.id` — prevents transplanting ciphertext between rows.
- **DEK wrapping:** AES-256-GCM under the KEK, AAD = `'ha_dek:' + connection_id`.
- **KEK provisioning:** 32 bytes, `openssl rand -base64 32`, set via `wrangler secret put HA_TOKEN_KEK_V1` (never in `wrangler.toml` or source, per SECURITY.md principle 7). Add to the SECURITY.md secrets list at implementation.
- **Rotation runbook (makes the §7.1 plan concrete):** (1) `wrangler secret put HA_TOKEN_KEK_V2`; deploy code reading V1+V2, writing V2. (2) Sweep cron unwraps each DEK with V1 and re-wraps with V2 — the token ciphertext itself is untouched (that is the point of envelope encryption; rotation cost is per-row DEK re-wrap, not token re-encryption). (3) When `COUNT(*) WHERE token_key_version = 1` is zero, remove the V1 binding. The §8 "token-rotation drill" tests exactly this sequence.
- Cross-reference note: §3.1 step 3 and §4.1 point at "§7.2" for the envelope; the scheme lives in §7.1 (left un-renumbered to keep this addendum additive).

### 11.4 Phase A acceptance criteria

- [ ] Setup flow (§3.1) completes end-to-end against a real Nabu Casa URL **and** a self-hosted TLS instance in under 2 minutes.
- [ ] `http://` URL rejected at create; self-signed cert fails with the explicit error + docs link (§6).
- [ ] No API route ever returns the token after creation (asserted by integration test across all §7.3 routes).
- [ ] Envelope crypto unit tests: round-trip, AAD mismatch fails closed, KEK V1→V2 re-wrap leaves the token decryptable.
- [ ] State mode and delta mode emit correct measurements; counter reset emits a reset event, never a negative delta (§4.2).
- [ ] `unknown` / `unavailable` / `""` states are dropped and counted in the per-mapping log (§4.3).
- [ ] Dedup: two polls over an unchanged `last_changed` produce exactly one measurement row.
- [ ] 401 halts polling immediately; email + banner fire exactly once; reconnect restores `healthy` and clears surfaces.
- [ ] 24h-unreachable email fires exactly once per outage; recovery sends the reconnected notice.
- [ ] Household rule enforced at write time: mapping to a cat the connecting user no longer has Contributor+ on is rejected (§6).
- [ ] GDPR export + account deletion cover `ha_connections` and `ha_entity_mappings`; deletion destroys ciphertext (§7.5).
- [ ] Audit entries from §7.4 written and visible via `wrangler d1 execute`.
- [ ] All 4 test suites pass; web + iOS settings UI both shipped per the CLAUDE.md cross-platform rule.
