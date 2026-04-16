# PRD — Smart Device Integrations (Auto-Ingest of Measurements)

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-04-15 |
| **Supersedes** | PRD-killer-app.md P8 (Smart scale integration) |
| **Related** | PRD-api-versioning.md, PRD-security.md, PRD-household-sharing.md |

---

## 1. Problem

Owners who already own smart pet hardware — microchip feeders, RFID water fountains, cat-flap litter scales, GPS collars, bowl scales — re-type data into Whisker Health that their devices already capture. That friction is the single biggest drop-off between "logged once" and "daily habit," which is the entire retention thesis of the app.

The user's stated ideal: **"If someone has a SureFeed or a wifi-connected bowl, they OAuth once and measurements flow in automatically."**

This PRD examines whether that ideal is achievable in 2026, documents the landscape, and proposes a tiered strategy.

---

## 2. Landscape research (2026-04)

### 2.1 Major vendors and their device classes

| Vendor | Hero devices for our use | Data they capture |
|---|---|---|
| **Sure Petcare** (Merck) | SureFeed Microchip Pet Feeder Connect, Felaqua Connect water bowl, Microchip Cat Flap Connect | per-cat food consumption (±1g), drinking events, entry/exit weight+time via flap |
| **Petlibro** | Dockstream RFID Smart Fountain, Granary Smart Feeder, Luma AI litter box | per-cat hydration (up to 5 cats), feed amounts, litter events |
| **PETKIT** | EVERSWEET ULTRA fountain, YUMSHARE feeder, PUROBOT CRYSTAL DUO litter | "health card per cat" — eating, drinking, litter trends |
| **Whisker** | Litter-Robot 3/4, Feeder-Robot | weight-per-use (cat weight recorded each cycle), feed amounts |
| **Petivity** (Purina) | Smart Litter Box Monitor | cat weight (every litter visit), urination/defecation events, monthly email reports |
| **CATLINK** | Open-X litter box + AI fountain "Input-Output" ecosystem (2026) | weight per visit, hydration, cross-device correlation |
| **FitBark** | Activity/GPS collar (dogs mostly; cat collars exist) | activity, sleep |
| **Tractive** | Cat GPS tracker | activity minutes, calories, rest |
| **DIY / Home Assistant** | ESP32 + HX711 load cell under litter box; Xiaomi/Tuya scales | anything the owner wires up |

### 2.2 The critical finding: **there are no official public APIs for pet devices.**

- **Sure Petcare:** no public API. Every integration (`surepy`, `sure-pet-care-client`, openHAB binding, SureHub unofficial API) is reverse-engineered from the mobile app traffic. Authentication is username + password (no OAuth). [surepy](https://github.com/benleb/surepy), [openHAB binding](https://www.openhab.org/addons/bindings/surepetcare/)
- **Petlibro:** no public API. Their social-login endpoint `/member/auth/thirdLogin` was publicly documented as [accepting unverified Google IDs](https://bobdahacker.com/blog/petlibro) — i.e. trivially impersonatable. Any integration we build is against an unofficial, breakable surface.
- **PETKIT:** no public API. Ecosystem explicitly designed to keep users inside the PETKIT app ("unified health dashboard").
- **Whisker:** no public API. `pylitterbot` exists but "Whisker has made API changes that affect third-party integrations" — it breaks. Has IFTTT integration (official but limited to events, not historical data).
- **Petivity:** app-only + monthly email reports. No API.
- **FitBark:** **has an official Developer API**. Also bridges to Apple HealthKit, Google Fit, Fitbit, Garmin. But FitBark is dog-centric — collars are not commonly fit to cats, and the data is activity/sleep rather than weight/food/water. [FitBark Dev API](https://www.fitbark.com/dev)
- **Apple HealthKit:** has no pet-specific schema, but FitBark and some scales mirror pet weight into HealthKit under generic mass data points. Unreliable as a general ingestion mechanism.

**Implication:** The "OAuth into SureFeed and data flows in" UX the user described is **not achievable through official channels** for any vendor except FitBark. Attempting it with unofficial clients means:
1. Asking users for their SureFeed account **password** (not a token) and storing it server-side — a significant security and trust regression versus our current Google/Apple OAuth posture.
2. Carrying TOS risk (every vendor prohibits automated access in their ToS).
3. Breakage on every vendor rotation (Whisker example).
4. Vendor brand-confusion liability: if a SureFeed outage is read by owners as a Whisker Health bug, our support cost spikes.

### 2.3 Where the market is going

CES 2026 announcements from CATLINK and PETKIT both double down on **closed ecosystems with "input-output" health dashboards inside the vendor app**. Vendors view the cross-device health view as their differentiation. They are getting **less**, not more, open to third-party readers. A pure OAuth future is unlikely to arrive.

### 2.4 What actually works today

The thriving hobbyist ecosystem — Home Assistant, openHAB, HACS — routes around this by running reverse-engineered clients **inside the user's own home network**, where credentials never leave the owner. That's the functional pattern: **the user's own infrastructure does the scraping; we just accept the data.**

---

## 3. Strategy — three tiers, build in this order

Rather than pick one integration, build a **generic inbound ingestion substrate** first, then layer vendor-specific niceties on top where the economics work.

### Tier 1 — "Bring Your Own Data" ingest API  *(foundation, build first)*

A public, documented ingest endpoint protected by user-issued API tokens.

```
POST /api/v1/ingest/measurements
Authorization: Bearer <user-scoped-api-token>
Content-Type: application/json

{
  "cat_id": "<uuid | microchip_id>",
  "measurements": [
    { "type": "weight", "value": 4.6, "unit": "kg", "observed_at": "2026-04-15T08:12:00Z", "source": "home-assistant-litter-scale" },
    { "type": "water", "value": 45,  "unit": "ml", "observed_at": "2026-04-15T09:30:00Z", "source": "petlibro-dockstream" }
  ]
}
```

**Why this first:**
- Unlocks every Tier 2/3 vendor path — they all end up producing measurement rows.
- Covers the Home Assistant / openHAB / DIY audience **immediately** with zero vendor-negotiation risk.
- Enables iOS Shortcuts, IFTTT recipes, n8n/Zapier, Eufy/Withings scales via HA, and the growing "self-hosted pet dashboard" crowd.
- Is a 1-sprint feature: token table, rate-limited endpoint, idempotency key, existing measurement validation reused verbatim.

**Scope:**
- `user_api_tokens` D1 table (user_id, token_hash, label, created_at, last_used_at, revoked_at)
- `/settings/api-tokens` page — create/label/revoke tokens; tokens shown once
- Ingest endpoint with: per-token rate limit (reuse `rate_limits` table from PRD-security-phase2), idempotency via `(source, external_id)` dedup, cat resolution by `microchip_id` or internal id, batch size cap (100)
- Measurements get a `source` column (new, nullable) — `"manual"` default; device sources render with a small tag in history and are excluded from "you haven't logged in N days" streak gaps
- Docs page at `/docs/api` with curl examples and a sample Home Assistant automation

### Tier 2 — Apple HealthKit bridge  *(iOS-only, moderate effort)*

On iOS, read cat-relevant data the user already has flowing into HealthKit from FitBark, Withings, Eufy, etc.

**Why:** HealthKit is the one real "OAuth-style" consented bridge that exists. Apple's permission UX is a known quantity and satisfies the "press one button" ideal for the subset of owners using HealthKit-writing devices.

**Limits:** HealthKit has no pet schema — we'd read generic `bodyMass` samples in a time range the user designates as "pet data," which is fragile. Worth a spike PRD before committing; tentatively **not scoped in this PRD** pending evaluation. Flag it here so we don't duplicate-PRD.

### Tier 3 — Vendor-specific "link account" integrations  *(only after Tier 1 proves demand)*

For each vendor, make a go/no-go decision against these gates:

| Gate | Pass condition |
|---|---|
| **Legal** | Vendor has written consent, IFTTT partnership, or clearly-permissive TOS for user-authorized read access |
| **Auth** | Vendor offers real OAuth2 or token issuance — not raw password capture |
| **Signal** | ≥ 50 Whisker Health users request the integration (surveyed / waitlisted) |
| **Cost** | Maintenance under 1 eng-day/quarter historical average for comparable integrations |

Vendors scored against these gates today:

| Vendor | Legal | Auth | Likely verdict |
|---|---|---|---|
| Sure Petcare | Unclear (no public dev program) | Password only | **No** unless they ship OAuth |
| Petlibro | Terms prohibit | Weak/broken | **No** |
| PETKIT | Terms prohibit | Closed | **No** |
| Whisker | IFTTT partnership exists | OAuth via IFTTT possible | **Maybe via IFTTT** — event-level only |
| FitBark | **Public dev API, documented** | **OAuth2** | **Yes, if demand exists** (dog-heavy so signal likely low) |
| Petivity | App-only | None | **No** (but email-ingest is viable — see §4) |

**Realistic path:** a single IFTTT applet ("Litter-Robot cycle → Whisker Health weight log") and a FitBark OAuth flow are the only vendor integrations that pass all gates cleanly in 2026.

---

## 4. Optional: email-ingestion addendum

Several vendors (Petivity, SureFeed weekly digests) email structured data that users already opt into. A dedicated forwarding address (e.g. `ingest+<token>@whiskerhealth.app`) + a Mailgun/Postal inbound route + vendor-specific parsers would capture data with zero vendor cooperation. **Tentatively out of scope for v1** — flagged as a fast-follow if Tier 1 adoption proves the ingestion model works.

---

## 5. Non-goals

- Writing data back to vendor devices (controlling feeders, triggering dispenses). Pure one-way read.
- Reverse-engineered vendor clients stored server-side. Never ask users for vendor passwords.
- Real-time streaming / websockets. Batch POSTs with observed_at are sufficient for health-trend timescales (hours/days, not seconds).
- Cross-user data pooling. Each token writes only to its owner's cats.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Token leakage (GitHub, Shortcuts screenshots) | Rotate on demand, `last_used_at` visibility, one-time display, per-token label so users know what to revoke |
| Device clocks skewed → wrong `observed_at` | Reject `observed_at` > 7 days future or > 2 years past; log skew for monitoring |
| Duplicate measurements on retries | Require `source` + optional `external_id`; unique constraint prevents dupes |
| Flood from misconfigured HA automation | Per-token rate limit (reuse `rate_limits`), daily cap alert to user email |
| Household sharing confusion (whose token?) | Tokens are user-scoped; ingest resolves to cats the token's owner has Contributor+ role on. Reject otherwise. |
| Vendor ToS claims about data ownership | We only accept what users push to us; we do not scrape. Document clearly. |

---

## 7. Success criteria

- v1 ship = Tier 1 live, documented, 1 reference Home Assistant blueprint published.
- Week 4: ≥ 5 users with a token writing ≥ 1 measurement/week.
- Week 12: ≥ 25 users; top source identified; informs whether to invest in Tier 3 FitBark or IFTTT applet.

---

## 8. Open questions for the product owner

1. **Agree with the "no password-storage, no reverse-engineered clients" stance?** This is the biggest philosophical call — it rules out the most popular vendor (Sure Petcare) from a native integration until/unless they ship OAuth.
2. **Is Tier 2 (HealthKit) worth a spike PRD**, or defer until Tier 1 adoption is known?
3. **IFTTT as a first vendor surface?** It's the only way Litter-Robot data can enter legally; costs $0 eng time beyond a docs page showing users how to point an IFTTT applet at our ingest endpoint.
4. **Source attribution UX** — when a measurement was ingested from a device, should it show a small badge ("via Home Assistant") in history? Default recommendation: yes.

---

## 9. Implementation plan (conditional on Approval)

**Phase A — Ingest foundation** (≈1 sprint)
1. `user_api_tokens` D1 table + migration
2. `measurements.source` nullable column + migration
3. `POST /api/v1/ingest/measurements` route + validation + rate-limit + dedup
4. `/settings/api-tokens` page (web + iOS)
5. History UI source-badge rendering
6. `docs/API.md` ingest section + Home Assistant blueprint gist

**Phase B — First reference integration** (≈2 days)
7. Publish a copy-paste Home Assistant automation (load cell → ingest POST) + screenshot-walkthrough blog post

**Phase C — IFTTT docs** (≈1 day, if approved)
8. One-pager showing how to wire a Litter-Robot IFTTT applet to our ingest URL with a token

**Phase D — FitBark OAuth** (≈1 sprint, gated on §3 demand signal)
9. OAuth2 client, `/settings/integrations` UI, polling cron, measurement writer

Stop after each phase and reassess based on adoption data.
