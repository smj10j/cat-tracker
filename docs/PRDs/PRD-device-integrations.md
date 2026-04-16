# PRD — Smart Device Integrations (Auto-Ingest of Measurements)

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-04-15 |
| **Reviewers** | Principal PM + Senior Staff Engineer — 4 passes (2026-04-15) |
| **Supersedes** | PRD-killer-app.md P8 (Smart scale integration) |
| **Related** | PRD-api-versioning.md, PRD-security.md, PRD-household-sharing.md |

---

## 1. Problem

Owners who already own smart pet hardware — microchip feeders, RFID water fountains, cat-flap litter scales, GPS collars, bowl scales — re-type data into Whisker Health that their devices already capture. We hypothesize this re-entry friction is a meaningful drag on the "log once" → "daily habit" conversion that underpins our retention thesis. (We do not yet have the funnel data to size it; Tier 1 success metrics in §7 are designed to test it.)

The user's stated ideal: **"If someone has a SureFeed or a wifi-connected bowl, they OAuth once and measurements flow in automatically."**

This PRD examines whether that ideal is achievable in 2026, documents the landscape, and proposes a tiered strategy.

**Target persona for v1 (Tier 1):** the technically inclined owner who already runs Home Assistant, IFTTT, Shortcuts, or n8n. This is a small but vocal segment whose feedback compounds (HA forums, Reddit). Mass-market vendor OAuth is explicitly *not* the v1 audience — see §3 for why.

---

## 1.5 Strategic framing (why this is bigger than a convenience feature)

The landscape in §2 reveals an opportunity that is easy to miss if we frame this as "let power users skip typing." Three strategic positions open up — we should build toward them deliberately, not accidentally:

1. **Cross-vendor system of record.** Every device vendor (CATLINK, PETKIT, Sure Petcare) is racing to own the per-cat health dashboard *inside their own app*. None of them can credibly aggregate across vendors — no owner uses only one. This is the Fitbit-vs-Apple-Health pattern. Whisker Health is uniquely positioned to be the vendor-neutral record precisely *because* it sells no hardware. The ingest endpoint is the beachhead for that positioning.

2. **Anti-lock-in value prop.** Owners are increasingly burned by vendor discontinuation: Petnet shut down and bricked feeders; Whisker rotates APIs; Petivity depends on Purina's continued investment. A Whisker Health account becomes **the portable pet health record that outlives any single device**. Market this explicitly on the landing page and in settings copy ("Your cat's data, yours forever. Not locked to any device brand.").

3. **Privacy as differentiator.** Vendors are closing their APIs because the data is monetizable. We do the opposite: the user pushes data to us and we never scrape. This pairs with our existing Google/Apple-only OAuth posture and the GDPR/CCPA export+delete work already shipped (PRD-security-phase2). Worth one line on the marketing page: "We never log into your device vendors. You control what flows in."

### The real value prop is passive alerting, not saving keystrokes

**Reframe (principal PM, 3rd-pass review):** The PRD currently sells ingest as "the owner types less." That's the *feature*; the *value* is qualitatively different. Continuous, passive data collection enables a class of product behavior that manual entry cannot: **the app tells the owner something is wrong before they noticed.**

An owner who manually logs weight weekly will detect a 10% weight loss after ~3-4 weeks. A fountain + feeder + litter-scale owner has the data to detect a 15% drop in water intake over 72 hours — which correlates to early CKD flares, UTIs, and hyperthyroidism episodes. That early-warning moment is the thing customers will pay for, recommend, and stay for. It is also the thing competitors cannot copy without cross-vendor ingest.

**Implication for this PRD:**
- v1 ships the ingest substrate (as scoped). But the **roadmap must explicitly pair ingest with a follow-up "passive-stream anomaly detection" PRD** — otherwise Tier 1 ships as plumbing without a consumer-visible payoff, and the §7 retention hypothesis has nothing to rest on. Retention won't lift because we saved users 30 seconds of typing; it will lift because we caught a hydration drop on a Saturday.
- Resist the temptation to ship naive threshold alerts on ingested streams before the anomaly PRD lands. A fountain that spikes during cleaning should not page the owner at 2am. This is why §8 Q6 ("monetization free at v1") is correct — **the monetizable feature is alerting-on-streams, which comes next**, not the ingest pipe itself.
- Telemetry from v1 should capture the *gap-to-detection* metric: for each ingest user, what is the median latency between a clinically-relevant trend onset and the point at which the app first surfaces it? This becomes the north-star metric for the anomaly PRD.

### Silence as signal — the most underrated feature of continuous ingest

**Added (4th-pass, principal PM + staff eng):** The PRD frames ingest value as "more data = better alerts." There's a complementary signal that's arguably *more* clinically actionable: **the absence of data where data is expected.**

A cat who uses a SureFeed feeder twice daily, every day, for 6 months — and then produces zero events for 36 hours — is communicating something. Inappetence is one of the earliest and most sensitive indicators of feline illness (AAFP Senior Care Guidelines, 2021). A fountain that reports 200ml/day average and drops to 40ml over 48h is a CKD/UTI signal. Neither of these requires anomaly-detection ML — they require **silence detection**: "Expected pattern X; observed pattern ∅."

This is qualitatively different from trend alerts (which need weeks of data to detect slopes). Silence detection can fire within 24–48 hours of onset — the exact window where clinical intervention has the most impact and the lowest cost.

**Engineering cost is near-zero on the ingest substrate:** each token already has `last_used_at`. A daily cron job that checks "tokens with ≥ 14 days of history and no event in the last N hours" is trivial. The user configures expected cadence per token (or we infer it from the first 2 weeks). The alert is a push notification: "Luna's feeder hasn't recorded a meal since yesterday morning."

**Product implication:** Silence detection should ship as a *Phase A.5 fast-follow* alongside the vet-share URL — it's the first "the app told me something I didn't know" moment, and it requires zero anomaly-detection infrastructure. It is also the feature that converts the chronic-care segment (§1.5): the CKD owner who worries "is my cat eating enough?" gets an answer passively.

**Not scoped in this PRD** — flag for the anomaly-detection PRD, but note that it can ship far earlier than the full anomaly engine because it's algorithmically trivial.

### Multi-cat disambiguation — the quiet killer

Every vendor without per-cat RFID (most fountains, most bowl scales, all ESP32 DIY rigs) produces **un-attributed events** in multi-cat households. The PRD's current cat resolution (UUID or `microchip_id`) assumes the integrator already knows which cat. In practice:

- SureFeed / Felaqua / PETKIT feeders with microchip readers: attributed, works today.
- Every other smart fountain, bowl scale, generic DIY rig: **not attributed**. An owner with 3 cats and a Petlibro fountain cannot answer "which cat is drinking less."

This is the most common real-world deployment and the current ingest contract silently makes it unusable. Options:

- **(A) Reject unattributed events.** Safe, but kills 60% of real HA deployments.
- **(B) Accept `cat_id: "household"` or null and store as household-scoped.** Useful for aggregate trends ("total household water went down") but breaks per-cat correlation — our strongest asset.
- **(C, recommended) Accept unattributed events but offer *inference hooks*:** time-of-day patterns, weight-ranges (a 4.2kg reading almost certainly isn't the 6.8kg cat), and a manual "this event was [Cat X]" correction UI. Over time the model learns household patterns. v1 stores the raw event with `cat_id: null` and a `disambiguation_hint` JSON blob; the attribution engine is a follow-up PRD.

**Decision requested in §8.** If the answer is (A), we lose the majority of our addressable Tier-1 audience silently; most integrators will disengage rather than file a bug.

### Chronic-care segment is the monetization wedge (not power users)

The PRD's Tier-1 persona is the self-hosting tinkerer. They are the *distribution* wedge (vocal, word-of-mouth, community blueprints). They are **not** the *willingness-to-pay* wedge. The paying customer is the owner of a senior cat with CKD, diabetes, hyperthyroidism, or IBD — who is already weighing daily, tracking water intake, giving subQ fluids, and spending $200/month on prescription diet and vet follow-ups.

This segment:
- Has a clinical reason to care about continuous data (their vet asks for trend charts).
- Already owns a scale, often a smart fountain, sometimes a glucose monitor (AlphaTRAK-style) or fluid pump with logs.
- Will pay $5–10/month without blinking if the app demonstrably reduces ER visits or catches flares early.
- Overlaps only partially with the HA/DIY crowd.

**v1 doesn't need a dedicated feature for them**, but two things should be true:
1. The ingest contract must accept the data types they care about (blood glucose, subQ fluid volume, BUN/creatinine from lab results) — already covered by the generic schema, but explicitly validate `VALID_MEASUREMENT_TYPES` includes these before launch.
2. The first-run / empty-state copy should **not** read as "for power users with Home Assistant." Frame the ingest page as "Connect your cat's devices" with HA as *one of several* options listed, so a chronic-care owner sees themselves in the landing.

Flag in §8.

### Vet-share moment (minimum lovable output of all this data)

Once ingest is flowing, the highest-emotional-resonance moment is **the appointment**. An owner walks into the vet's office and hands over a share-link to a 90-day chart bundle: weight, water, food, litter frequency, medication adherence. Today they read numbers off a notebook or open the app and scroll.

Product cost is tiny on top of the ingest substrate: a `share_token` on the cat with a redacted, read-only public URL that expires in 7 days. Engineering can confirm this is a 1–2 day feature. Not scoped in this PRD — **but call it out as the first "visible payoff" feature to ship *after* Phase A**, before Phase D (FitBark), to give every ingest-using owner a reason to tell their vet about Whisker Health. This is how the vet channel seeds itself for free.

Flag as a recommended fast-follow in §9.

### HealthKit is a distribution channel, not just an ingest source

Tier 2 currently scopes HealthKit as a source of incoming weight data. The more valuable direction may be the reverse: **write Whisker Health data *into* HealthKit** (under generic mass/nutrition/hydration samples), so cat data surfaces in Apple Health / Fitness summaries alongside the owner's own data. This turns Apple's ecosystem into a passive marketing surface: every time the owner glances at the Health app, our brand is present. Engineering cost is similar to the read direction and reuses the same permission UX.

Flag in §8 alongside the Tier 2 decision.

### Customer latent needs this PRD surfaces (but does not scope)

Reviewing adjacent pain points that owners have but rarely articulate, because they've normalized the friction:

- **Vet-visit data loop (potentially the highest-value ingest source, period).** The single largest measurement gap is the vet scale — and lab results. Owners get a weight every appointment and manually re-enter it (if at all). More importantly, **vets produce the only data owners can't generate at home**: CBC panels, metabolic panels, urinalysis, thyroid levels, kidney values (BUN, creatinine, SDMA). This is exactly the data the chronic-care segment (CKD, diabetes, hyperthyroidism) needs to trend over time, and it's exactly what their vet asks to see at follow-ups. Today it lives in a PDF emailed from the clinic PMS, or printed and handed over. Nobody trends it. A clinic-facing push endpoint (same ingest substrate, different consumer), email-forwarded lab PDFs (§4), or a CSV-export-from-vet-PMS path is probably a larger retention lever than any smart device. Out of scope here but **the ingest substrate enables it for near-zero marginal cost** — flag explicitly so we don't redesign when the vet PRD lands. The email-ingest channel (§4) is the natural first path for vet lab data: owners already receive lab results by email.
- **Boarding / pet-sitter data continuity.** When a cat is away from home, tracking goes dark. A token-per-sitter with time-boxed access solves this and is a natural extension of household sharing.
- **Cross-vendor reconciliation.** Two feeders + one litter box on different clocks produces duplicate "water event" noise. Owners don't realize this is the problem until they see weird correlations. Our correlation engine is the asset that monetizes cross-vendor ingest. Worth wiring telemetry to detect when this happens and surface it.
- **Export to vet portals / insurance.** Pet insurance is a growing segment; insurers want longitudinal data for claims. "Export last 12 months to Trupanion / Lemonade" is a future unlock that ingest-sourced data makes credible.

### Monetization posture (explicit decision requested — see §8)

The PRD is currently silent on whether ingest is free, premium, or acquisition-funnel. Recommended posture: **free at v1** as an acquisition + retention funnel for the power-user segment who recommends the app; revisit monetization only when the cross-vendor aggregator positioning is validated in §7 kill gates. Price-fencing ingest at v1 kills the retention hypothesis before we can measure it.

**Reserve future premium hooks — don't build them, don't rule them out:** (1) unlimited historical retention (free tier caps at e.g. 2 years; premium = lifetime); (2) advanced alerting rules on ingested streams; (3) insurance/vet-portal export; (4) multi-cat households beyond N pets. Avoid architectural decisions in Phase A that would foreclose any of these — e.g., don't hardcode a retention window, don't make alerting frontend-only.

### Competitive positioning check (TBD before launch)

We assume the "cross-vendor cat-health aggregator" slot is empty. This PRD does **not** verify that assumption against: Cat Genie, PetPace, MyPetCenter consumer side, Whistle's consumer app expansion, or a well-funded startup that may have launched in 2025–2026. **Pre-launch action:** one engineer-day of competitive scan before the §1.5 marketing copy goes live. If a credible aggregator already exists, we either pivot narrative to "best for cats, strongest privacy" or reconsider the positioning entirely.

### Activation funnel — the metric that actually predicts retention

**Added (4th-pass, principal PM):** The §7 success metrics measure week-4 and week-12 active users. These are *retention* metrics. The missing leading indicator is **activation**: of users who create a token, what % successfully send their first measurement within 24 hours?

Industry benchmarks for developer-facing API products: 40–60% of token creators send a first request within 24h. Below 30% means the setup friction is too high. Above 60% means docs and onboarding are working. This metric tells us whether we have a *distribution* problem or a *product* problem far earlier than week-4 retention.

**Measure separately for each channel:**
- REST API tokens: % that send first measurement within 24h
- Email-ingest tokens (if §4 ships): % that receive first parseable email within 7 days (longer because email forwarding setup has more steps)

**v1 must instrument this from day one** — it's the signal that tells us whether to invest in better docs, better onboarding UX, or more parsers.

### Onboarding the already-quantified owner (the killer first-run experience)

A power user who finds Whisker Health likely already has a year of data in Home Assistant / InfluxDB / Google Sheets. If their first experience is "start logging from today," we lose them.

**The ingest substrate already supports this** (`observed_at` accepted up to 2 years back per §6) but v1 must explicitly design the UX:
- First-run flow after token creation shows a "Backfill from history?" prompt with copy-paste HA/Python snippets that pull their existing timeseries.
- Server accepts backfill batches with no rate-limit penalty the first 24h after token creation (one-time grace).
- A single "backfill in progress: 1,847 / 12,400 measurements" status on `/settings/api-tokens`.

Without this, the retention metric in §7 reflects the wrong population (users starting from zero data).

### Community moat — user-contributed blueprints

Home Assistant's distribution model is community-shared YAML. Whisker Health should mirror that: a public `github.com/whiskerhealth/community-blueprints` repo seeded with our official HA / Shortcuts / n8n examples and accepting PRs. Each accepted blueprint attributed to its author. This is free SEO, free distribution, and free integration surface — every new blueprint is a new vendor integrated with zero eng cost. Launch alongside v1.

### Multi-pet households (species gap)

SureFeed, Petlibro, and most feeders are species-agnostic. A household with a dog + a cat will push dog measurements through the same ingest token. Whisker Health is cat-only today. Two options:
- **(A) Reject dog-shaped data** (by type mismatch with cat profiles) — safe, but frustrating for owners who'd rather see unified data.
- **(B) Silently accept data scoped only to cat profiles; document clearly** — recommended. The token owner chose which `cat_id` / `microchip_id` their automation references; we honor it and drop anything that doesn't resolve. Dog data is simply not pushed.

Option B matches the "just work" ingest ethos. Flag in §8.

### Provenance and trust (for the future vet / insurance unlock)

If "portable pet health record" is the long-term narrative, vets and insurers eventually need to trust what's in it. v1 defers this but must not block it:
- `source` string is free-form — **but** any future `verified: boolean` or signed-attestation field adds on top, not replacing it. Schema stays compatible.
- Log the ingest token's label and user_id on each measurement write. Audit chain is already there via existing `audit_log` infra.
- Do not claim "vet-grade" or "insurance-grade" data in v1 marketing copy. That earned language comes later.

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
POST /api/ingest/measurements
Authorization: Bearer <user-scoped-api-token>
X-API-Version: <semver>
Content-Type: application/json

{
  "cat_id": "<uuid | microchip_id>",
  "measurements": [
    { "type": "weight", "value": 4.6, "unit": "kg", "observed_at": "2026-04-15T08:12:00Z", "source": "home-assistant-litter-scale", "external_id": "ha-2026-04-15-08-12" },
    { "type": "water", "value": 45,  "unit": "ml", "observed_at": "2026-04-15T09:30:00Z", "source": "petlibro-dockstream", "external_id": "pl-evt-9928174" }
  ]
}
```

> Versioning: header-based per `PRD-api-versioning.md` (no `/v1/` path prefix). Backward compatibility follows the additive-only policy already in force for the rest of the API.

**Why this first:**
- Unlocks every Tier 2/3 vendor path — they all end up producing measurement rows.
- Covers the Home Assistant / openHAB / DIY audience **immediately** with zero vendor-negotiation risk.
- Enables iOS Shortcuts, IFTTT recipes, n8n/Zapier, Eufy/Withings scales via HA, and the growing "self-hosted pet dashboard" crowd.
- Is a 1-sprint feature: token table, rate-limited endpoint, idempotency key, existing measurement validation reused verbatim.

**Scope:**
- `user_api_tokens` D1 table (`user_id`, `token_hash` SHA-256 (consistent with invite-token storage in PRD-household-sharing), `label`, `scope` enum — v1 only `ingest:measurements`, future-proofs additional scopes — `created_at`, `last_used_at`, `revoked_at`).
- `/settings/api-tokens` page — create/label/revoke tokens; raw token shown exactly once at creation. Per-user cap of 10 tokens (consistent with device-token cap in `PRD-security-phase2` SEC-14).
- Ingest endpoint with:
  - Per-token rate limit (verify `rate_limits` schema supports per-token key, not only per-user; extend if needed in Phase A).
  - Idempotency: `external_id` is **required** for any non-`"manual"` source. Dedup via unique `(user_id, source, external_id)` partial index. Requests without `external_id` from automated sources are rejected with 400.
  - Cat resolution by internal `cat_id` (UUID) or `microchip_id`. Ambiguous or unresolved → 404 with structured error code (`cat_not_found` | `cat_ambiguous`); never silent-create.
  - Batch size cap 100. Per-token daily cap configurable (default 5000) with 429 + email alert on hit.
- Measurements get a `source TEXT` column (new, nullable; `NULL` = manual, set explicitly only when ingested). Device-sourced rows render with a small tag in history and are excluded from streak-gap calculation. Historical rows backfill stays NULL.
- Docs page at `/docs/api` with curl examples and a sample Home Assistant automation.

**Protocol details that need to be right the first time** (external API = hard to change later):
- **Timestamp discipline.** `observed_at` must be ISO 8601 with explicit offset or `Z`. Reject naive timestamps with 400 and a pointer to the docs. Server never infers a timezone from the token owner — integrators get burned by that in 6 months.
- **Partial success response.** The endpoint returns `207`-style per-item status, not all-or-nothing. Shape:
  ```json
  { "accepted": 98, "rejected": 2, "items": [{ "index": 17, "status": "duplicate", "measurement_id": "..." }, { "index": 42, "status": "error", "code": "observed_at_out_of_range" }] }
  ```
  Rationale: a bad payload buried in a 100-event batch from an HA automation should not fail the whole batch; it should tell the integrator which row is bad.
- **Structured error codes.** Every 4xx body includes a stable string `code` (`cat_not_found`, `cat_ambiguous`, `rate_limited`, `observed_at_out_of_range`, `external_id_required`, `token_revoked`, `scope_insufficient`). HTTP status is not enough for machine consumers.
- **`Retry-After` on 429**, honoring the per-token rate-limit window. Reuse the existing middleware.
- **Token format.** Prefix like `wht_live_<random>` (and `wht_test_` for future sandbox tokens), registered with GitHub secret scanning. Free automatic leak detection; token revocation webhook if GitHub finds one.
- **Observability that users can self-serve.** `/settings/api-tokens` shows per-token: last 7 days of requests, success/error rate, top 3 error codes. Users debug their own HA automations; support load stays low.
- **Anomaly alerts.** A sudden 100× volume spike or 100% error rate for a token emails the user — catches misconfiguration before they burn their daily cap.

**Second-pass engineering concerns (must be addressed in Phase A, not deferred):**
- **Rate-limit substrate.** The existing `rate_limits` D1 table works fine for low-volume per-user data export (PRD-security-phase2 SEC-12). For ingest — many clients, potentially bursty, token-granularity — D1 writes on every request are a hot-path concern. Evaluate moving per-token counters to a Durable Object or Workers KV with write-coalescing before Phase A ships. If D1 is retained, document the write-QPS ceiling and alert on it.
- **Batch insert approach.** A 100-item batch with partial-success semantics has two implementations: (a) 100 sequential `INSERT` statements (slow, ~100 ms+ tail on D1) or (b) a single `INSERT ... ON CONFLICT DO NOTHING RETURNING` with error rows rebuilt from the diff. Prefer (b); document the tradeoff in the route. Target p95 end-to-end < 500ms for a 10-item batch, < 1500ms for 100-item. Publish as an SLO.
- **Thundering-herd on 429.** `Retry-After` should include randomized jitter (±20%) and the docs must tell HA / cron authors to add backoff themselves. A single Home Assistant server with 50 ingest users retrying in lockstep will walk the rate limit in a loop.
- **`external_id` bypass hole.** The "required for non-manual sources" rule is bypassable by any client that sends `source: "manual"`. Close the hole: for any request carrying a non-user-owned API token (i.e., all of them in v1), `external_id` is required regardless of `source` value. Reserve unattributed `manual` writes for the existing in-app entry path, not the ingest endpoint.
- **Audit log policy.** Every ingest *event* is too noisy for `audit_log`. But `token_created`, `token_revoked`, `token_anomaly_alert_sent`, and `backfill_started` belong there — they're the security-relevant transitions. Per-measurement writes rely on the measurement row itself as the record.
- **Noisy-neighbor on Workers.** Even under our rate limit, a misbehaving token can spray 5000 requests/day in a 1-minute burst and impact tail latency for legitimate traffic. Add a **per-token-per-minute** secondary cap (e.g., 120/min) alongside the daily cap.
- **`measurements.source` cardinality.** Free-form string is fine for v1, but nothing stops the source column from exploding with typos (`home-assistant-litter-scale` vs `ha-litter-scale`). Phase A ships as-is; a follow-up normalization pass with an `integration_source` FK is straightforward once real data arrives.
- **D1 write throughput ceiling (4th-pass, staff eng).** Cloudflare D1 is a single-writer SQLite database. Production write throughput is ~100–200 writes/sec under ideal conditions, with tail latency spiking under contention. A 100-item batch insert from one token is a single transaction (~1 write), but 50 tokens each sending 10-item batches simultaneously produces 50 concurrent write transactions. At our current scale (pre-launch, <100 users) this is irrelevant. At the §7 Week-12 target (25 active token users), still fine. But if ingest succeeds and scales to 500+ active tokens with bursty HA automations (cron-triggered, so temporally correlated), D1 becomes the bottleneck before the rate limiter fires. **Mitigation:** the per-token-per-minute cap (120/min) already limits per-client burst; add a global write-queue metric to the health check endpoint. If D1 write latency p95 exceeds 200ms for 5 consecutive minutes, alert. Migration path is Durable Objects (one per household) or Hyperdrive→Postgres, but don't build it until the metric demands it.
- **Ingest health monitoring for stale tokens.** Users who set up an HA automation and walk away won't notice when it silently breaks (HA update, token expiry, network change). A daily cron that checks "tokens with ≥ 7 days of history and no event in the last 48h" should email the user: "Your token [label] hasn't sent data since [date]. Is your automation still running?" This is different from the *clinical* silence detection (§1.5) — this is *operational* silence detection. Low-effort, high-trust-building. Include in Phase A.
- **Unit normalization at the boundary.** The ingest contract accepts `kg`, `g`, `lb`, `oz`, `ml`, `fl_oz`. Decision: (a) store as-received and normalize at query time, or (b) normalize to canonical units on write (kg for mass, ml for volume). Recommend (b) — it keeps every downstream consumer (charts, alerts, export, correlation engine) simple and prevents drift where half the measurements for the same cat are in lbs and half in kg. The ingest response should echo back the stored canonical value so the integrator sees the conversion.
- **Token rotation grace window.** A token baked into an HA `configuration.yaml` is hard to rotate instantly. When the user creates a replacement token, keep the old token valid for 72h in a `deprecated` state (still works, but every response includes `Warning: token-deprecated; rotate by <date>`). This avoids silent breakage when security-conscious users rotate tokens. If a token is *revoked* (not rotated), it dies immediately — the grace only applies to create-then-replace flows.
- **Support tooling.** Self-serve observability is correctly scoped for users, but support will need a way to view any user's token activity given a support ticket. Add a lightweight admin-only route (`GET /api/admin/tokens/:user_id/activity`) behind the existing admin auth — otherwise every debugging session starts with "can you screenshot your token page?" over email.

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

## 4. Email-ingestion: the Kayak pattern (promoted from addendum to strategic recommendation)

**Reframe (3rd-pass, principal PM):** The original draft treats email-ingest as a niche follow-up. It should be promoted to a **co-equal ingest channel alongside the REST API** — potentially launching *before* or *alongside* Tier 1 Phase B.

**Why this is bigger than it looks:** Kayak's "forward your booking emails" pattern works because it meets users exactly where they already are — no new tooling, no developer setup, no YAML editing. For Whisker Health, the same pattern unlocks a dramatically wider audience than the HA/power-user crowd:

1. **Petivity** sends monthly email reports with structured weight and litter data. Every Petivity owner already receives this.
2. **Sure Petcare** sends weekly feeding/drinking digests. Already in the owner's inbox.
3. **Whisker (Litter-Robot)** sends cycle completion emails. Weight is in the body.
4. **Vet clinics** email lab results (BUN, creatinine, glucose, CBC panels) after appointments. Often in a standard PDF or structured text format.
5. **Pet pharmacies** (Chewy, 1-800-PetMeds) email prescription refill confirmations — medication adherence data for free.
6. **Pet insurance** (Trupanion, Lemonade, Embrace) email claims summaries with diagnosis codes and treatment records.

**The critical insight:** email-ingest is the **mass-market path that skips the entire API landscape problem** documented in §2. No vendor cooperation, no API, no OAuth, no reverse engineering. The vendor already sends the email; the owner already receives it. We parse it.

### How it works

- Each user gets a unique forwarding address: `ingest+<short_token>@whiskerhealth.app`
- Owner sets up an email filter/rule: "From: noreply@surepetcare.com → Forward to ingest+abc123@whiskerhealth.app" (one-time, 30 seconds, works on every email client)
- Alternatively, owner simply forwards individual emails manually (the "Kayak quick-forward" UX)
- Inbound route (Cloudflare Email Workers or Resend inbound — we already have the Resend relationship) receives the email, runs it through vendor-specific parsers, and writes measurements through the same ingest pipeline (same validation, dedup, rate-limits, `source: "email:surepetcare"`)
- Unrecognized email formats are logged with a "we couldn't parse this" notification to the user — builds a natural feedback loop for adding new parsers

### Why this is the right second channel

| | REST API (Tier 1) | Email ingest |
|---|---|---|
| **Audience** | Self-hosters, developers, HA users | Everyone with an email account |
| **Setup difficulty** | YAML/code/cURL (minutes to hours) | Email forwarding rule (30 seconds) |
| **Vendor cooperation needed** | None | None |
| **Data freshness** | Real-time (event-driven push) | Batch (when vendor emails — daily/weekly/monthly) |
| **Data types** | Any `VALID_MEASUREMENT_TYPES` | Whatever the vendor puts in their email |
| **Maintenance** | Zero (user maintains their automation) | Parser per vendor (breaks when vendor changes email template) |
| **Competitive moat** | Moderate (anyone can build an API) | **High** — parser library is a compound asset that grows over time |

### Implementation sketch (Phase A+E, ≈1 sprint)

1. **Inbound email route** via Cloudflare Email Workers (free on Workers plan, already in our infra) routing to a Worker handler
2. **Token-to-user resolution** from the `+<short_token>` address suffix → `user_api_tokens` (reuse the same token table, add `channel: "email"` scope)
3. **Parser framework:** a simple `(rawEmail) → Measurement[]` interface. Ship with 3 parsers at launch:
   - Petivity monthly report (structured HTML table — weight per visit, litter events)
   - Sure Petcare weekly digest (feeding amounts, drinking events per cat)
   - Litter-Robot cycle email (cat weight per use)
4. **Vet lab result parser (promoted from stretch to core, 4th-pass PM review):** PDF attachment extraction → common lab panel values (BUN, creatinine, SDMA, glucose, T4, CBC). Higher variance in format, but: (a) even a 60% parse rate is transformative for the chronic-care segment, (b) vet lab data is the single highest-value data type in the entire ingest strategy — it's the only data owners can't generate at home, and it's what makes the "portable pet health record" narrative credible to vets, (c) owners of chronically ill cats get labs every 2–8 weeks and have years of emailed results sitting in Gmail — the backfill opportunity is enormous, (d) Claude API can parse semi-structured lab PDFs with high accuracy, and our existing Anthropic relationship makes this a natural technical fit. **Recommendation: ship vet lab parsing in the email-ingest launch, not as a stretch goal.** Accept a "best-effort with manual review" posture — a parsed lab result that needs one owner correction is still 10× better than manual entry from a printed page.
5. **Unrecognized email fallback:** store the raw email, notify the user "we received an email from [sender] but couldn't parse it — want to help us add support for this vendor?" Community feedback loop.
6. **Settings UI:** `/settings/email-ingest` showing the user's forwarding address, list of received emails with parse status, vendor breakdown

### Email-ingest risks (additive to §6)

| Risk | Mitigation |
|---|---|
| Spam/abuse to ingest addresses | Token-scoped addresses; reject unrecognized senders by default; rate-limit inbound by token |
| Vendor changes email template → parser breaks | Monitor parse-failure rate per vendor; alert maintainer; parsers are isolated modules. **4th-pass eng reality check:** Vendor email templates change more often than APIs — typically 2–4× per year for marketing-driven redesigns. The "0.5 days per parser" estimate is for initial build; budget 0.25 days/quarter/vendor for maintenance. At 5 vendors, that's 1.25 eng-days/quarter — manageable but not zero. Mitigate by using LLM-based parsing (Claude API) for semi-structured content rather than brittle regex/HTML selectors; this trades API cost (~$0.01/email) for resilience to template changes. |
| PII in forwarded emails (owner name, address, vet details) | Strip and discard all non-measurement content after parsing; document in privacy policy; never store raw email body long-term (retain 7 days for debugging, then delete) |
| Email deliverability / forwarding chain issues | Provide a "test your forwarding" button in settings that sends a test email and verifies round-trip |
| Parser accuracy (wrong values extracted) | Every parsed measurement shown to user in a "pending review" state for first 3 emails from a new sender; after user confirms accuracy, auto-accept future emails from that sender |

### Recommendation

**Promote email-ingest from "tentative fast-follow" to Phase A+E (parallel with Phase B).** The REST API is the *developer* ingest channel; email is the *everyone else* ingest channel. Together they cover the full spectrum from tinkerer to non-technical chronic-care owner. Email-ingest alone may drive more retention than the REST API — it's lower-friction, broader-audience, and surfaces the "forward your vet labs" use case that no competitor is doing.

**Decision requested in §8.**

---

## 5. Non-goals

- Writing data back to vendor devices (controlling feeders, triggering dispenses). Pure one-way read.
- Reverse-engineered vendor clients stored server-side. Never ask users for vendor passwords.
- Real-time streaming / websockets. Batch POSTs with observed_at are sufficient for health-trend timescales (hours/days, not seconds).
- Cross-user data pooling. Each token writes only to its owner's cats.
- **Outbound webhooks** (pushing events *from* Whisker to user systems). Natural mirror of ingest; explicitly deferred to avoid scope creep and because no user has asked.
- **Auto-correlation of ingest sources.** Even though two feeders may produce duplicate "water events" (see §1.5), v1 does not reconcile — it ingests faithfully. A separate PRD handles reconciliation after we see the shape of the duplication in production data.
- **Public read API.** Tokens only grant `ingest:measurements` scope in v1. Read access via API is a separate PRD and a separate security review.

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
| Vendor legal response (C&D) if we become a credible aggregator | User-pushed model is defensible (no ToS violation by us). Keep written legal opinion on file before the first marketing push on §1.5 framing. |
| `measurements.source` breaks existing queries / indexes | Nullable + default NULL; no existing query references the column. Backfill is zero-touch. Add index only if query patterns demand it — not prophylactically. |
| GDPR export / deletion coverage for new fields | `source` and `external_id` must appear in data export payloads and be fully deleted on account deletion. Add test cases in Phase A. |
| Token scope creep (future read access, admin ops) | `scope` column is an enum from day one; v1 only issues `ingest:measurements`. Adding future scopes is additive and gated by security review. |
| Notification fatigue once ingest + alerting ship together | Ingested streams can produce thousands of events/day. Default alerting posture is **silent** except for clinically-derived thresholds already in `healthMetrics.ts`; all new alert types require their own PRD and opt-in. A weekly digest is the default summary surface, not per-event pushes. |
| Multi-cat household silently produces meaningless data | Unattributed events stored with `cat_id: null` are flagged in the UI ("12 events this week not yet assigned to a cat") with a bulk-assignment tool. Never silently drop, never silently assign to a random cat. |
| Unit ambiguity causing clinical misread | Canonical-unit normalization on write (see §3). Ingest response echoes stored value + unit so the integrator sees the conversion. Reject payloads with ambiguous or missing units. |
| Inferred attribution (future §1.5 disambiguation) misassigns data | Any inferred attribution must be explicitly marked `attribution: inferred` on the row and excluded from health-alert calculations until the owner confirms. Health alerts only fire on owner-confirmed or RFID-attributed data. |
| Token baked into user's HA config leaks via git push | GitHub secret scanning registration (Tier 1 scope). 72h rotation grace window (Tier 1 scope). Docs explicitly warn against committing tokens. |

---

## 7. Success and kill criteria

**Success (Tier 1 graduation gates):**
- **v1 ship:** Tier 1 endpoint live, documented, 1 reference Home Assistant blueprint published, 0 P0/P1 security findings against ingest in launch week.
- **Week 4:** ≥ 5 distinct users with an active token, each writing ≥ 1 measurement/week. Zero token-leakage incidents.
- **Week 12:** ≥ 25 active token-using users; ≥ 60% of measurements from those users arriving via ingest (i.e., it actually replaced manual entry, not added on top); top three sources identified. **Activates the §3 Tier 3 vendor decision.**
- **Retention proof point (Week 12):** D30 retention for ingest-using cohort ≥ 1.5× the manual-only cohort, **adjusted for pre-existing engagement**. Raw comparison is misleading — ingest users self-select as power users who were already retaining well. Match cohorts on prior-30-day activity level before measuring the lift. If we can't achieve a credible matched comparison at n=25, extend the window to Week 20 rather than declare victory on unmatched numbers.

**Activation (leading indicator, measure from day one):**
- **Day 1:** Instrument token-creation → first-successful-measurement funnel. Target: ≥ 50% of tokens send first measurement within 24h (REST API); ≥ 40% receive first parseable email within 7 days (email ingest).
- **Week 2:** If activation < 30% for REST API, the problem is docs/onboarding, not demand. Invest in better first-run UX before waiting for Week 12 retention data.
- Measure per-channel (REST, email) and per-source (HA, Shortcuts, IFTTT, Petivity email, etc.) to identify which paths work.

**Kill criteria — stop investment if at Week 12:**
- < 10 active token users (signal: niche even within self-hosters).
- ingest-cohort retention is *not* materially higher than manual-only (signal: the hypothesis was wrong; ingest is convenience, not retention).
- Operational cost (support tickets + incidents per active user) > 3× the average user.

If killed: keep the endpoint live and documented (it's nearly free to maintain), but stop building Tier 2/3 and remove from the roadmap.

---

## 8. Open questions for the product owner

1. **Confirm the "no password-storage, no reverse-engineered clients" stance.** This is the load-bearing philosophical call — it rules out the most popular vendor (Sure Petcare) from a native integration until/unless they ship OAuth. Recommended: confirm.
2. **Tier 2 (HealthKit) decision trigger.** Recommend deferring a HealthKit spike PRD until Tier 1 hits the Week-12 success gate (§7). Confirm — or set an earlier explicit trigger.
3. **IFTTT as a first vendor surface.** Cheapest possible vendor presence ($0 eng beyond a docs page). Approve as part of Phase C, or split into its own decision?
4. **Source attribution UX.** Show a small "via Home Assistant" badge in history? Default recommendation: yes. Confirm.
5. **Persona conviction.** Are we comfortable that the v1 audience is explicitly the self-hoster / power-user segment? If product wants mass-market vendor OAuth as the v1 framing instead, this PRD should be rejected and rewritten — the strategies are mutually exclusive.
6. **Monetization posture (§1.5).** Ship Tier 1 free as a funnel/retention play, reassess at Week 12? Recommended yes. If no, a pricing model needs to land *before* Phase A or we re-do onboarding.
7. **Cross-vendor positioning.** Do we want to lean into "portable pet health record that outlives any device brand" as a marketing narrative now, or keep it quiet until the §7 retention proof point lands? Leaning in earlier accelerates the self-hoster word-of-mouth loop; leaning in later avoids vendor C&D provocation before we have legal on file.
8. **Vet-visit ingest pathway.** The ingest substrate makes a clinic-facing push trivial (§1.5). Original recommendation was to pre-coordinate the schema now; **on engineering review, recommendation reverses**: prove vet-export in its own PRD first, refactor the (small) measurements table later. Adding speculative columns before there's a real second consumer is the kind of cost that compounds quietly (migrations, test matrices, API docs, export paths). A future `source_type` column is a <1-day migration at our current scale — cheap enough to defer.
9. **Multi-pet (dog) data handling (§1.5).** Confirm the "silently drop data that doesn't resolve to a cat profile" behavior. Alternative is a hard 400 with `species_not_supported`. Recommended: silent drop — matches the "just works" ethos and the token owner controls what's pushed anyway.
10. **Historical backfill first-run UX (§1.5).** Approve the 24h no-rate-limit grace window + copy-paste migration snippets? Materially shapes the v1 retention metric.
11. **Community blueprints repo (§1.5).** OK to launch `github.com/whiskerhealth/community-blueprints` at v1 and accept community PRs? Requires a lightweight review rubric. Costs ~0.5 eng-day/month moderating.
12. **Competitive scan (§1.5).** Assign one eng-day before launch to verify the aggregator slot is empty. If taken, the §1.5 narrative needs a rewrite.
13. **Multi-cat disambiguation posture (§1.5).** Accept unattributed events with `cat_id: null` and build toward inference (option C), reject unattributed (option A), or store household-scoped only (option B)? Recommended: option C. If not, the ingest contract is useless for ~60% of real devices.
14. **Unit normalization: store canonical or as-received?** Recommended: canonical (kg for mass, ml for volume), echoed in response. If as-received, every downstream consumer inherits the conversion burden forever.
15. **Passive-alerting PRD timing.** The retention thesis in §7 depends on alerting-on-streams, not the pipe itself. Should the anomaly-detection PRD begin drafting concurrently with Phase A, so it's ready to ship as a fast-follow? Recommended: yes, draft in parallel.
16. **Chronic-care segment representation.** Should the ingest settings page and docs explicitly address the chronic-care owner (CKD/diabetes/hyperthyroidism) alongside the power-user/HA audience? Recommended: yes — different copy, same endpoint.
17. **HealthKit write direction.** Should Tier 2 scope include writing Whisker Health data *into* HealthKit (distribution play), not just reading from it? Recommended: yes, and it may be higher-ROI than the read direction.
18. **Vet-share URL fast-follow.** Approve a 1–2 day feature (time-limited read-only share link per cat) as the first visible consumer of ingest data, shipping immediately after Phase A? Recommended: yes — it's the emotional payoff moment.
19. **Email-ingest promotion (§4).** Promote email-ingest from tentative addendum to co-equal channel, shipping as Phase A+E in parallel with Phase B? Recommended: **yes** — it's the mass-market ingest path and the lowest-friction entry point. The Kayak "forward your emails" pattern is proven, the vendor email landscape is rich, and Cloudflare Email Workers keep infra cost at zero.
20. **Email-ingest launch parsers.** Ship with Petivity + Sure Petcare + Litter-Robot parsers at launch, or start with just one to validate the pattern? Recommended: ship all three — each covers a different data type (weight, food/water, litter), and the parser effort per vendor is ~0.5 days.
21. **Vet lab email parsing (promoted from stretch).** Include vet lab result PDF parsing in the email-ingest launch? High variance in format, but the chronic-care segment values this above all other data types, and it's the only data they can't generate at home. Recommended: **yes, ship at launch** with LLM-based parsing (Claude API) and manual-review fallback. Accept imperfect accuracy — a parsed result the owner corrects once is still 10× less friction than manual entry from a printed page.
22. **Silence detection fast-follow (§1.5).** Ship "your token hasn't sent data in N hours" as a Phase A.5 feature alongside vet-share URL? This is the lowest-cost, highest-impact early-warning feature and requires no anomaly-detection infrastructure. Recommended: yes.
23. **Activation funnel instrumentation (§1.5).** Instrument token-creation-to-first-measurement conversion rate from day one? This is the leading indicator that tells us whether we have a docs/onboarding problem before week-4 retention data arrives. Recommended: yes, mandatory for v1 launch.
24. **LLM-based email parsing vs regex.** Use Claude API for email/PDF parsing instead of hand-written parsers? Higher per-email cost (~$0.01) but dramatically more resilient to vendor template changes and format variance. Recommended: yes for vet lab PDFs (high variance, high value); evaluate per-vendor for structured device emails (lower variance, may not justify API cost at scale).

---

## 9. Implementation plan (conditional on Approval)

**Phase A — Ingest foundation** (≈1 sprint)
1. `user_api_tokens` D1 table + migration (token hash, scope enum, label, timestamps, revocation)
2. `measurements.source` + `measurements.external_id` nullable columns + migration; unique partial index on `(user_id, source, external_id) WHERE external_id IS NOT NULL`
3. `POST /api/ingest/measurements` route (no `/v1/` prefix — versioning is header-based per PRD-api-versioning). Partial-success response, structured error codes, ISO-8601-with-offset enforcement, dedup, rate-limit, cat resolution by UUID or microchip.
4. `/settings/api-tokens` page (web + iOS) with per-token request log, error breakdown, anomaly alert toggle
5. History UI source-badge rendering; streak-gap calc updated to exclude device rows
6. GDPR export and account-deletion paths updated to cover `source`, `external_id`, and `user_api_tokens`
7. Tests: fuzz payload (unit), 100-item batch partial-success (integration), rate-limit + `Retry-After` (integration), idempotency under retry (integration), export/deletion coverage (integration)
8. `docs/API.md` ingest section + Home Assistant blueprint gist + registration for GitHub secret scanning token prefix

**Phase A.5 — Vet-share URL + silence detection** (≈2–3 days, recommended fast-follow before Phase B)
_a1._ Time-limited, read-only share link per cat (90-day chart bundle: weight, water, food, litter, meds). Expire after 7 days. No auth required to view. This is the first consumer-visible payoff of ingest data and the viral seed for the vet channel.
_a2._ Operational silence detection: daily cron checks tokens with ≥7 days of history and no event in 48h; emails user "Your token [label] hasn't sent data since [date]." Builds trust and catches broken automations before users notice.
_a3._ Clinical silence detection (if §8 Q22 approved): for tokens with ≥14 days of history, detect unexpected gaps in expected-cadence events (e.g., feeder that usually fires 2×/day goes silent for 24h). Push notification to user. This is the first "the app caught something I didn't notice" moment — the emotional hook that drives word-of-mouth.

**Phase B — First reference integration** (≈2 days)
9. Publish a copy-paste Home Assistant automation (load cell → ingest POST) + screenshot-walkthrough blog post

**Phase A+E — Email ingest channel** (≈1 sprint, parallel with Phase B, if approved per §8 Q19)
_e1._ Cloudflare Email Worker inbound route + token resolution from `+<short_token>` suffix
_e2._ Parser framework + launch parsers: Petivity monthly report, Sure Petcare weekly digest, Litter-Robot cycle email
_e3._ `/settings/email-ingest` UI: forwarding address display, received email log, parse status, "test your forwarding" button
_e4._ 7-day raw email retention policy + auto-purge
_e5._ Vet lab result PDF parser (promoted from stretch): LLM-based extraction via Claude API with manual-review fallback for first 3 results per sender; auto-accept after owner confirms accuracy

**Phase C — IFTTT docs** (≈1 day, if approved)
10. One-pager showing how to wire a Litter-Robot IFTTT applet to our ingest URL with a token

**Phase D — FitBark OAuth** (≈1 sprint, gated on §3 demand signal + §7 Week-12 gate)
11. OAuth2 client, `/settings/integrations` UI, polling cron, measurement writer — reusing the Phase A ingest pipeline internally so vendor writes flow through the same validation/dedup path.

Stop after each phase and reassess based on adoption data.
