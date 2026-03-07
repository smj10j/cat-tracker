# PRD Registry

> Canonical index of all product requirements for Cat Tracker.
> **Rule for AI and humans alike:** Check this file before starting any work. Never implement a `Draft` or `Under Review` PRD. Never duplicate an `Implemented` one.

---

## Summary Table

| PRD File | Title | Status | Last Updated |
|----------|-------|--------|--------------|
| [PRD-mvp.md](PRD-mvp.md) | MVP: Cat Tracking Core | `Implemented` | 2026-03-06 20:05 |
| [PRD-features-backlog.md](PRD-features-backlog.md) | Feature Backlog | `Partial` | 2026-03-06 20:05 |
| [PRD-ux-simplification.md](PRD-ux-simplification.md) | UX Simplification | `Implemented` | 2026-03-06 21:15 |
| [PRD-health-status-visuals.md](PRD-health-status-visuals.md) | Health Status Emoji Indicators | `Implemented` | 2026-03-06 21:42 |
| [PRD-measurement-ux.md](PRD-measurement-ux.md) | Measurement UX Fixes | `Implemented` | 2026-03-06 21:42 |
| [PRD-charts-expansion.md](PRD-charts-expansion.md) | Charts: Multi-Type & Profile Chart by Tab | `Implemented` | 2026-03-06 21:42 |
| [PRD-killer-app.md](PRD-killer-app.md) | Killer App Research & Roadmap | `Under Review` | 2026-03-06 21:42 |
| [PRD-auth.md](PRD-auth.md) | User Accounts & Data Isolation | `Implemented` | 2026-03-06 22:09 |
| [PRD-correlations.md](PRD-correlations.md) | Measurement Correlations | `Implemented` | 2026-03-06 22:50 |
| [PRD-profile-ux.md](PRD-profile-ux.md) | Cat Profile UX: Insights Panel & History Timeline | `Implemented` | 2026-03-06 23:09 |
| [PRD-vet-export.md](PRD-vet-export.md) | Vet Visit Export | `Implemented` | 2026-03-06 23:29 |
| [PRD-input-output-metrics.md](PRD-input-output-metrics.md) | Input/Output Metric Classification | `Implemented` | 2026-03-06 23:29 |
| [PRD-login-splash.md](PRD-login-splash.md) | Marketing / Splash Login Page | `Implemented` | 2026-03-06 23:56 |
| [PRD-correlation-descriptions.md](PRD-correlation-descriptions.md) | Correlation Descriptions: Clinical Accuracy & Dual-Audience | `Implemented` | 2026-03-07 00:12 |
| [PRD-microchip-id.md](PRD-microchip-id.md) | Microchip ID as Cat Identifier | `Implemented` | 2026-03-07 10:25 |
| [PRD-profile-clarity.md](PRD-profile-clarity.md) | Cat Profile — Insights Panel Clarity | `Implemented` | 2026-03-07 10:25 |
| [PRD-security.md](PRD-security.md) | Security Hardening | `Implemented` | 2026-03-07 10:39 |
| [PRD-medication-reminders.md](PRD-medication-reminders.md) | Medication Reminders | `Implemented` | 2026-03-07 12:00 |

---

## Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| `Draft` | Written, not yet reviewed by the product owner | Do not implement |
| `Under Review` | Shared with product owner; awaiting feedback | Do not implement |
| `Approved` | Greenlit; ready to implement when prioritized | Safe to implement |
| `In Progress` | Currently being actively implemented | Check with team |
| `Implemented` | Fully built and deployed to production | Do not re-implement |
| `Partial` | Some items implemented; remainder deprioritized or blocked | See detail section |
| `Superseded` | Replaced by a newer PRD; do not implement remaining items | See replacement |
| `Rejected` | Product owner decided not to build this | Do not implement |

---

## PRD Detail

Each entry below provides full implementation notes and open questions. The summary table above is the quick-reference; this section is the authoritative record.

---

### PRD-mvp.md — MVP: Cat Tracking Core

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 20:05 |

**Implemented:** All MVP features — cat CRUD, weight measurements, time-series chart, mobile-responsive layout.

**Notes:** The "no auth" decision was explicit and intentional for MVP. Authentication is now tracked in PRD-auth.md.

---

### PRD-features-backlog.md — Feature Backlog

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-03-06 20:05 |

**Implemented:**
- CSV Import (`POST /api/import` + ImportPage)
- Quick-add (BottomNav center "Log" button via QuickAdd sheet)
- PWA manifest + installability
- Food/water intake measurement types
- Behavioral measurement types (grooming, activity, vomiting, litter)
- Cat profile tabs (Weight / Food / Water / Behavior / All)
- Health severity visuals (status-tinted cards, badges, sorted by severity)

**Not yet implemented:**
- Photo upload (R2) — still viable; no PRD written yet
- Date range filtering on charts
- Trend regression / ideal weight band
- "Due for weigh-in" badge (see PRD-killer-app.md P3)

**Superseded:**
- §5 Sharing / token-based household access — replaced by PRD-auth.md (full user accounts)

---

### PRD-ux-simplification.md — UX Simplification

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 21:15 |

**Implemented:** BottomNav center → QuickAdd Log sheet; "Add a cat" dashed card on Home; Wellness Guide page at `/wellness`; tap-to-select presets for behavioral measurements; presets stored as 0–3 int with `unit='scale'`.

---

### PRD-health-status-visuals.md — Health Status Emoji Indicators

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 21:42 |

**Implemented:** `STATUS_EMOJI` (✅ 👀 ⚠️ 🚨) in `healthMetrics.ts`; WeightChart and CompareChart use SVG emoji text nodes on data points; chart legend updated.

---

### PRD-measurement-ux.md — Measurement UX Fixes

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 21:42 |

**Implemented:** QuickAdd type selector replaced with native `<select>` (eliminates horizontal scroll); litter presets reordered (Straining before Diarrhea — blockage is more urgent); grooming "Not grooming" shortened to "None".

---

### PRD-charts-expansion.md — Charts: Multi-Type & Profile Chart by Tab

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 21:42 |

**Implemented:** CompareChart has type selector + re-fetches all cats on change; scale Y axis shows preset labels; CatProfile shows WeightChart on weight tab, MeasurementChart on food/water tabs, no chart on behavior/all tabs; new `MeasurementChart.tsx` component.

---

### PRD-killer-app.md — Killer App Research & Roadmap

| | |
|---|---|
| **Status** | `Under Review` |
| **Last updated** | 2026-03-06 21:42 |

**This is a roadmap/research document — do not implement items without explicit approval.**

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | Vet export / shareable visit summary | Implemented (see PRD-vet-export.md) |
| P1 | Daily check-in (multi-measurement single screen) | Not started |
| P2 | Streak & consistency tracking | Not started |
| P3 | Weigh-in reminders (`reminder_interval_days` per cat) | Not started |
| P4 | Correlation insights (food drop → weight drop) | Implemented (see PRD-correlations.md) |
| P5 | Household sharing (on top of auth) | Not started |
| P6 | Shelter mode (rooms, triage view, medical templates) | Not started |
| P7 | AI health narrative (Claude API weekly summaries) | Not started |
| P8 | Smart scale integration | Not started |

---

### PRD-auth.md — User Accounts & Data Isolation

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 22:09 |

**Implemented:** Google OAuth (login/callback/logout/me); D1 `users` + `sessions` + `oauth_states` tables; `cats.user_id` FK; `requireAuth` middleware with rolling 7-day sessions; all routes scoped by `userId`; `ProtectedRoute`; `/login` page; user avatar in header with sign-out; claim-existing-cats prompt on Home. Live and verified in production.

**Implementation notes:**
- OAuth state stored in D1 `oauth_states` table (5-min TTL) — cookie approach was dropped on opaque proxy redirect
- Pages proxy reconstructs `3xx` responses explicitly so `Set-Cookie` headers reach the browser
- Google-only at launch (intentional)

---

### PRD-correlations.md — Measurement Correlations

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 22:50 |
| **Superseded by** | PRD-correlation-descriptions.md (description quality/clinical content; core math unchanged) |

**Implemented:** `correlations.ts` (weekly buckets, normalize, Pearson lag correlation, `detectCorrelations`, `describeCorrelation`, `getHomeBadge`); `CorrelationChart.tsx` (normalized dual-line chart, type selectors, pattern prose); CatProfile Trends tab; Home correlation badge for predictive signals. Frontend-only, no new API.

**Design decisions:** Min data = 4 aligned weekly buckets. Hyperthyroidism pattern flagged without naming the disease. Copy avoids causation language. Sparse data shows "N more weeks needed".

---

### PRD-profile-ux.md — Cat Profile UX: Insights Panel & History Timeline

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 23:09 |

**Implemented:** `InsightsPanel.tsx` — single severity-tinted panel replacing 3 separate alert cards; proactive correlation text from `detectCorrelations()`; collapsible `CorrelationChart`. History grouped by calendar day with day headers and "View N older entries" load-more. Trends tab removed from history tab bar.

---

### PRD-vet-export.md — Vet Visit Export

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 23:29 |

**Implemented:** `/cats/:id/export` — print-optimized white page with cat info, weight table (last 15 entries with change deltas), behavioral tables (last 4 weeks, human-readable preset labels), observed patterns section. Vet-mode correlation descriptions (clinical language + differentials). Confluence cluster note in amber card. Export buttons on CatProfile and CatHealthGuidance. `window.print()` → "Save as PDF" flow.

---

### PRD-input-output-metrics.md — Input/Output Metric Classification

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 23:29 |

**Implemented:** `INPUT_TYPES` (food, water, grooming, activity, play) and `OUTCOME_TYPES` (weight, vomiting, litter) sets in `correlations.ts`. CorrelationChart uses constrained selectors: left dropdown = input types only, right = outcome types only. Arrow `→` between dropdowns. Graceful empty state when no input or outcome types are logged.

---

### PRD-login-splash.md — Marketing / Splash Login Page

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-06 23:56 |

**Implemented:** Full login page redesign — hero section with cat emoji, radial glow, floating "9.4 lbs" / "↗ stable" metric bubbles, branded sparkline. Value prop headline. 3 feature rows (weight tracking, early warning patterns, vet-ready summaries). Sign-in button with gradient border. Privacy note. Error state for auth failures.

---

### PRD-correlation-descriptions.md — Correlation Descriptions: Clinical Accuracy & Dual-Audience

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 00:12 |

**Implemented:** `typeATrend`/`typeBTrend`/`dataWeeks` fields on `CorrelationResult`; `detectTrend()` using first-half vs second-half bucket average; `detectConfluence()` with two known clinical clusters (kidney/thyroid/DM; systemic illness); `describeCorrelation()` rewritten with `mode: 'owner' | 'vet'` — owner mode uses pair-specific clinical context, gendered pronouns, confidence framing, early-warning note; vet mode includes r/lag/dataWeeks stats and clinical differentials by pair+trend direction. InsightsPanel shows confluence alert above individual patterns. CorrelationChart updated with new fields and `catSex` prop. CatExportPage uses vet mode with amber confluence card.

---

### PRD-microchip-id.md — Microchip ID as Cat Identifier

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 10:25 |

**Problem:** Cats have real-world microchip IDs that are globally unique. Cat Tracker currently uses opaque internal UUIDs with no way to identify the same physical cat across accounts or imports.

**Scope:** Add optional `microchip_id` field to cats; auto-generate `temp-microchip-id-<GUID>` when absent; enforce uniqueness with privacy-preserving conflict messages for cross-account conflicts; support microchip_id column in CSV import.

---

### PRD-security.md — Security Hardening

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 10:39 |

**Problem:** Security review identified 8 findings (2 HIGH, 4 MEDIUM, 2 LOW): TOCTOU race in OAuth state, missing security headers, no input validation, no CORS scoping, no session limits, no frontend maxLength.

**Scope:** Atomic OAuth state consumption, CORS origin locking, security headers (Worker + Pages `_headers`), server-side input length/type validation, import body size limit, session count cap, frontend maxLength attributes.

---

### PRD-profile-clarity.md — Cat Profile: Insights Panel Clarity

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 10:25 |

**Problem:** When multiple signals are detected (urgent health + confluence cluster + 2-3 pattern descriptions + explore button), the top of the cat profile is visually overwhelming before the chart is even visible.

**Solution:** Collapse the patterns section by default into a single toggle row; surface the confluence ⚠️ pill in the collapsed header; merge the "Explore" section inside the expanded patterns panel. Health alerts remain fully visible.

---

### PRD-medication-reminders.md — Medication Reminders

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-03-07 11:00 |

**Problem:** Cat owners with recurring medications (flea prevention, daily pills, heartworm) have no reminder system. Missing doses can have serious health consequences (thyroid crisis, flea infestation).

**Scope:** Medication schedule management, recurring/one-time reminders, finite courses, in-app notification inbox, mark-given/skip-dose, refill reminders, web push notifications (VAPID), cron-driven delivery, pre-built medication presets.

**Implemented Phase A** (core scheduling + in-app inbox). Phase B (web push), C (email), D (refill stock UI) remain as future work.

---

## Planned (no PRD written)

Items mentioned or implied by existing PRDs that have not yet been formally specified. A PRD must be written and approved before implementation.

| Feature | Origin | Notes |
|---------|--------|-------|
| Photo upload (R2) | PRD-features-backlog.md | Straightforward; needs PRD |
| Date range filter on charts | PRD-features-backlog.md | Low priority so far |
| Daily check-in screen | PRD-killer-app.md P1 | High value; needs PRD |
| Streak tracking | PRD-killer-app.md P2 | Habit-forming; needs PRD |
| Household sharing (post-auth) | PRD-features-backlog.md §5, PRD-killer-app.md P5 | Depends on auth |

---

## Rejected

Nothing rejected yet.

---

*Last updated: 2026-03-07 12:00*
