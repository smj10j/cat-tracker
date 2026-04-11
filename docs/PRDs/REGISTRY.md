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
| [PRD-medication-reminders.md](PRD-medication-reminders.md) | Medication Reminders | `Partial` | 2026-04-11 |
| [PRD-household-sharing.md](PRD-household-sharing.md) | Household Sharing & Multi-User Access | `Partial` | 2026-04-11 |
| [PRD-household-sharing-phase2.md](PRD-household-sharing-phase2.md) | Household Sharing — Phase 2 (lifecycle + audit) | `Draft` | 2026-03-07 13:00 |
| [PRD-cat-photos.md](PRD-cat-photos.md) | Cat Photo Uploads | `Implemented` | 2026-03-07 20:00 |
| [PRD-ux-redesign.md](PRD-ux-redesign.md) | UX Redesign — Competitive Analysis & Next-Gen Features | `Partial` | 2026-04-11 |
| [PRD-daily-checkin.md](PRD-daily-checkin.md) | Daily Check-In — Multi-Measurement Entry Screen | `Implemented` | 2026-03-07 |
| [PRD-evidence-base.md](PRD-evidence-base.md) | Veterinary Evidence Base — Sources, Citations, and Research Infrastructure | `Implemented` | 2026-03-07 |
| [PRD-accessibility.md](PRD-accessibility.md) | Accessibility — Color Independence, Touch Targets, Screen Reader Support | `Partial` | 2026-03-07 |
| [PRD-usability.md](PRD-usability.md) | Usability Polish — Scroll, Feedback, Disabled States, Delete Confirmation | `Partial` | 2026-03-07 |
| [PRD-app-settings.md](PRD-app-settings.md) | App Settings — Dark/Light/System Mode Toggle | `Partial` | 2026-04-11 |
| [PRD-deceased-cat.md](PRD-deceased-cat.md) | In Memoriam — Marking a Cat as Deceased | `Implemented` | 2026-04-11 |
| [PRD-weight-alert-sensitivity.md](PRD-weight-alert-sensitivity.md) | Weight Alert Sensitivity Review | `Implemented` | 2026-04-11 |
| [PRD-ios-app-store.md](PRD-ios-app-store.md) | iOS App Store Deployment | `In Progress` | 2026-04-10 |
| [PRD-api-versioning.md](PRD-api-versioning.md) | API Versioning & Backend-Driven Updates | `In Progress` | 2026-04-11 |
| [PRD-security-phase2.md](PRD-security-phase2.md) | Security Hardening Phase 2 — Native App & Multi-Client | `Partial` | 2026-04-11 |
| [PRD-chart-time-navigation.md](PRD-chart-time-navigation.md) | Chart Time Range & Swipe Navigation | `Implemented` | 2026-04-11 |
| [PRD-alert-acknowledgment.md](PRD-alert-acknowledgment.md) | Health Alert Acknowledgment | `Draft` | 2026-04-11 |
| [PRD-behavioral-trends.md](PRD-behavioral-trends.md) | Behavioral Trend Charts | `Draft` | 2026-04-11 |
| [PRD-localization-preferences.md](PRD-localization-preferences.md) | Localization & Regional Preferences | `Approved` | 2026-04-11 |
| [PRD-landscape-charts.md](PRD-landscape-charts.md) | Landscape Mode — Full-Screen Chart Visualization | `Approved` | 2026-04-11 |

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
- Date range filtering on charts (see PRD-chart-time-navigation.md, Draft)
- Trend regression / ideal weight band
- "Due for weigh-in" badge (see PRD-killer-app.md P3 / PRD-ux-redesign.md 3C)

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
| P1 | Daily check-in (multi-measurement single screen) | Implemented (see PRD-daily-checkin.md) |
| P2 | Streak & consistency tracking | Not started (spec in PRD-ux-redesign.md 3B) |
| P3 | Weigh-in reminders (`reminder_interval_days` per cat) | Not started (spec in PRD-ux-redesign.md 3C) |
| P4 | Correlation insights (food drop → weight drop) | Implemented (see PRD-correlations.md) |
| P5 | Household sharing (on top of auth) | Partial (see PRD-household-sharing.md) |
| P6 | Shelter mode (rooms, triage view, medical templates) | Not started |
| P7 | AI health narrative (Claude API weekly summaries) | Not started (concept in PRD-ux-redesign.md 3D) |
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
| **Status** | `Partial` |
| **Last updated** | 2026-04-11 |

**Problem:** Cat owners with recurring medications (flea prevention, daily pills, heartworm) have no reminder system. Missing doses can have serious health consequences (thyroid crisis, flea infestation).

**Scope:** Medication schedule management, recurring/one-time reminders, finite courses, in-app notification inbox, mark-given/skip-dose, refill reminders, web push notifications (VAPID), cron-driven delivery, pre-built medication presets.

**Implemented Phase A** — core scheduling + in-app inbox: `medications` and `medication_doses` tables, CRUD endpoints, 90-day dose generation with cron, `/notifications` inbox (overdue/due-today/upcoming/refill), mark-given/skip endpoints, MedicationFormPage with presets, NotificationsPage, home screen badge count.

**Not yet implemented:**
- Phase B — Web Push notifications (VAPID key pair, service worker, `/api/push/*` endpoints, push delivery in cron)
- Phase C — Email fallback (Resend email when no push subscription and dose becomes overdue)
- Phase D — Refill stock tracking UI (doses_remaining management on medication edit form)

---

### PRD-household-sharing.md — Household Sharing & Multi-User Access

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-04-11 |

**Problem:** Cat Tracker is single-user. Multi-person households (spouses, family members, pet sitters) can't share access to the same cats.

**Scope:** Household entity owns cats; 4-role permission system (Viewer/Contributor/Editor/Admin); email invite flow via Resend (`noreply@01j.me`); household settings UI accessible from profile popover; migration from current per-user cat ownership to household-based ownership.

**Implemented Phase A** — household model, invite system (with SHA-256 token hashing), role-based access, member management (role change + removal), household settings page, invite acceptance page, home screen household labels, household-scoped cat and measurement authorization. All core features working in production.

**Not yet implemented (Phase B):**
- Custom confirmation dialogs for role changes and member removal (currently uses browser `confirm()`)
- Invitation reminder email (resend if not accepted after 3 days)
- Email notification to Admins when someone accepts an invite
- Email notification to removed member when they are removed

---

### PRD-household-sharing-phase2.md — Household Sharing Phase 2

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-03-07 13:00 |
| **Depends on** | PRD-household-sharing.md Phase A |

**Problem:** Phase 1 leaves dangerous gaps: no ownership transfer (lock-out risk), no household deletion, no cat migration between households, no audit log, and no cross-member medication dose visibility.

**Scope:** Ownership transfer + lock-out recovery; delete household (two-step confirmation); move cats between households; activity feed / audit log (90-day retention); household-wide medication dose notifications with `administered_by` field; confirmation dialogs for destructive actions; Phase B invitation UX (reminder email, admin notifications).

**Do not implement** — status is `Draft`. Requires product owner approval.

---

### PRD-cat-photos.md — Cat Photo Uploads

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 20:00 |
| **Supersedes** | PRD-features-backlog.md §1a |

**Problem:** Every cat card and profile shows a generic 🐱 emoji. Real photos make the app feel personal and drive retention.

**Scope:** Upload from Add/Edit Cat form or by tapping the profile hero avatar; client-side crop/zoom modal (Canvas API, no library) that outputs 400×400 JPEG; store in Cloudflare R2 public bucket (`cat-tracker-photos`); display via reusable `CatAvatar` component across Home, Cat Profile, Add/Edit Cat form, and Vet Export; remove/reset to emoji; Worker proxy upload (`POST /api/cats/:id/photo`) with Editor-role authorization.

**Phase A implemented** — core cat photo upload via R2, CropModal, CatAvatar component. Full scope delivered.

---

### PRD-ux-redesign.md — UX Redesign: Competitive Analysis & Next-Gen Features

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-04-11 |
| **Depends on** | PRD-killer-app.md (P1, P2, P3, P7) |

**Origin:** Competitive analysis of a vet practice pet management app (PetDesk-like). Five screens analyzed covering pet profile, reminder system, and reminder creation flow.

**Implemented (Phases 1-2):**
- **2A** Profile Hero Redesign (full-bleed photo, gradient overlay, structured details)
- **2B** Structured Pet Details with Icons + neuter/spay status field
- **2C** Rename Medications to "Care Schedule," add vet event types, emoji icon system
- **2D** CatProfile tab reorganization (Health / Care / About)
- **3A** Daily Check-In — implemented separately via PRD-daily-checkin.md

**Not yet implemented:**
- **2E** Photo gallery/timeline — not started (low priority)
- **3B** Streak & consistency tracking — not started (fully specified in PRD, high priority)
- **3C** Weigh-in reminders — not started (medium priority)
- **3D** AI Health Narrative (Claude API) — not started (needs separate detailed PRD)
- **3E** Vet integration two-way data — future concept only

---

### PRD-daily-checkin.md — Daily Check-In: Multi-Measurement Entry Screen

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 |
| **Supersedes** | PRD-killer-app.md P1 (Daily Check-In concept) |

**Problem:** Logging a full daily health observation requires 4–7 separate QuickAdd interactions — too much friction to become a daily habit.

**Implemented:** Single `/checkin` screen showing all measurement types simultaneously; unselected rows generate no record; adjustable date/time; one submit creates all records with the same timestamp; replaces QuickAdd as the primary "Log" entry point from BottomNav.

---

### PRD-evidence-base.md — Veterinary Evidence Base: Sources, Citations, and Research Infrastructure

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-03-07 |

**Problem:** The app makes specific clinical claims (weight loss thresholds, hepatic lipidosis risk, behavioral warning signs) that are grounded in veterinary literature but have no documented sources. This reduces trust and makes future threshold updates unmaintainable.

**Implemented:** All five phases — (A) `docs/research/` folder with four files: sourcing principles, weight-threshold citations, behavioral-indicator citations, and a curated feline resource directory; (B) inline citations in `healthMetrics.ts`; (C) Methodology section added to the vet export footer; (D) source attribution footer on WellnessGuide; (E) CLAUDE.md updated with clinical content process rules to prevent regression.

---

### PRD-deceased-cat.md — In Memoriam: Marking a Cat as Deceased

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-04-11 |

**Problem:** Cat Tracker has no way to mark a cat as deceased. The only option is deletion, which permanently destroys data that may be irreplaceable — a record of a life and the observations that helped prompt veterinary care.

**Implemented:** Full "passed away" flow on the Edit Cat page with date-of-passing and optional 150-char memorial note; deceased cats hidden from the active home list and shown in a quiet "In Memoriam" section; Memorial Record page at `/cats/:id/memorial` with hero, memorial note, life summary, collapsible health history, and PDF export button; auto-deactivation of medications and deletion of future doses; exclusion from CompareChart and QuickAdd. Two DB columns (`deceased_at`, `memorial_note`) added; `GET /api/cats?status=active|memorial|all` filter; un-marking ("restore") flow for errors. See Phase 31 in TODO.md.

---

### PRD-weight-alert-sensitivity.md — Weight Alert Sensitivity Review

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-04-11 |

**Problem:** All cats in a household are showing health alert states (watch/concerning) after a ~2.5% weight loss. The alerts are noise-driven, eroding owner trust in the system.

**Implemented:** All three algorithm changes to `healthMetrics.ts`: (1) minimum interval gate — skip rate classification for measurements < 5 days apart (`skipped: true` on PeriodHealth); (2) relative noise floor — require ≥0.5% absolute change before any non-ok classification; (3) robust peak reference — 90th percentile of measurements in the last 180 days (fallback to all-time max when < 8 measurements). `referencePeak` exposed on `HealthAssessment`. InsightsPanel and CatExportPage updated to reference "recent weight" instead of "peak body weight." `docs/research/weight-thresholds.md` updated with engineering heuristic documentation. New test cases added to `healthMetrics.test.ts`. See Phase 30 in TODO.md.

---

## Planned (no PRD written)

Items mentioned or implied by existing PRDs that have not yet been formally specified. A PRD must be written and approved before implementation.

| Feature | Origin | Notes |
|---------|--------|-------|
| ~~Photo upload (R2)~~ | ~~PRD-features-backlog.md~~ | Superseded by PRD-cat-photos.md |
| ~~Date range filter on charts~~ | ~~PRD-features-backlog.md~~ | Now specified in PRD-chart-time-navigation.md |
| ~~Daily check-in screen~~ | ~~PRD-killer-app.md P1~~ | Now specified in PRD-daily-checkin.md |
| ~~Streak tracking~~ | ~~PRD-killer-app.md P2~~ | Now fully specified in PRD-ux-redesign.md 3B |
| AI Health Narrative | PRD-killer-app.md P7, PRD-ux-redesign.md 3D | Needs separate detailed PRD if approved |

---

## Rejected

Nothing rejected yet.

---

### PRD-accessibility.md — Accessibility

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-03-07 |

**Problem:** The app was built mobile-first without an accessibility pass. Key gaps: color-only health signals (affects ~8% of males with color vision deficiency), 31 instances of `text-[10px]` below WCAG minimum, `<label>` elements not associated to inputs via `htmlFor`/`id`, no `aria-live` for dynamic feedback, no visible focus ring, preset buttons at 34px below 44px touch target minimum.

**Scope:** Three phases — (A) zero-visual-impact fixes: label associations, `aria-live`/`role="alert"`, `aria-expanded`, `role="tablist"`, `:focus-visible` ring; (B) text and touch targets: min 12px text, min 44px touch targets; (C) color independence: text labels on concern-tier presets, stroke dash patterns in CompareChart, STATUS_LABEL always alongside STATUS_EMOJI.

**Implemented (Phases A + B):** `:focus-visible` ring, `htmlFor`/`id` on all forms, `aria-live`/`role="status"/"alert"` on dynamic feedback, `aria-busy` on save buttons, `aria-expanded` on toggles (InsightsPanel, WellnessGuide), `role="tablist"/"tab"/"aria-selected"` on CatProfile tabs. All `text-[10px]` replaced with `text-xs`. `min-h-[44px]` on DailyCheckin preset buttons and MeasurementForm close button. Concern-tier preset buttons have "! " prefix.

**Not yet implemented (Phase C — color independence):**
- CompareChart: stroke dash patterns (solid vs dashed) as second per-cat differentiator alongside color
- InsightsPanel: STATUS_LABEL text badge always alongside STATUS_EMOJI (not just on hover)

---

### PRD-usability.md — Usability Polish

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-03-07 |

**Problem:** Several interaction patterns create friction or data-loss risk: pages don't scroll to top on navigation; MeasurementForm behavioral preset buttons save immediately on tap (no undo); disabled buttons say "Nothing to log yet" instead of explaining how to enable; delete is single-tap with no confirmation; back navigation is inconsistent across pages; error messages lack actionable recovery guidance.

**Scope:** Three phases — (A) zero-risk wins: `ScrollToTop` component, disabled button copy, actionable error messages, save confirmation in MeasurementForm; (B) interaction model: two-step preset save in MeasurementForm, two-step delete confirmation, back nav audit; (C) state and hierarchy: loading state standardization, empty state improvements, CatProfile health status visibility.

**Implemented (Phases A + B):** `ScrollToTop` component, disabled button always says "Log Check-In" with contextual hint below, `role="alert"` on errors, `role="status"` on save banners, `aria-busy` on save buttons, MeasurementForm preset select-then-save model (no accidental immediate saves), two-step inline delete confirmation in CatProfile, back nav fixed to `navigate(-1)` with fallback, MeasurementForm "Saved!" flash for 1s before close.

**Not yet implemented (Phase C — state and hierarchy):**
- Shared `<LoadingShell>` component for consistent loading states across all pages
- Empty state improvements (CatProfile no-measurement state with call-to-action)
- CatProfile health status always visible without scrolling on 375px screen

---

### PRD-app-settings.md — App Settings

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-04-11 |

**Problem:** No user-configurable settings. Immediate request: dark/light/system mode toggle accessible from the profile menu.

**Scope:** `/settings` route + `SettingsPage.tsx`; profile popover "Settings" link; theme toggle with localStorage persistence; CSS token layer for light theme.

**Implemented Phases A + B** — Settings screen at `/settings` with Dark/Light/System segmented control; ThemeContext with localStorage persistence and `data-theme` attribute on `<html>`; full CSS variable layer with dark and light token sets; system mode respects `prefers-color-scheme` via media query listener; all component inline styles migrated to CSS variables.

**Not yet implemented:**
- Phase C — D1 `user_preferences` column for cross-device theme sync

---

### PRD-ios-app-store.md — iOS App Store Deployment

| | |
|---|---|
| **Status** | `In Progress` |
| **Last updated** | 2026-04-10 |
| **Depends on** | All current `Implemented` PRDs |
| **Related TDD** | docs/TDD/cross-platform.md |

**Problem:** Cat Tracker is invisible to iOS users who discover apps through the App Store. A native iOS app unlocks discoverability, push notifications, credibility, and retention.

**Scope:** Migrate from React/Vite SPA to Expo/React Native (shared codebase for iOS + web); full feature parity; Sign in with Apple; native push notifications; privacy policy; automated build & submission pipeline; App Store metadata and screenshots. 7 phases (0–7) from scaffolding through submission to frontend retirement.

**Completed phases:** 0A (Worker auth), 0B (Expo scaffold), 1 (Auth + nav), 2 (Core screens + components), partial 4 (notifications, wellness, memorial, invite, deep links), partial 5 (privacy policy, store metadata, eas.json).

**Remaining:** Chart library wiring (Phase 3), full native features (expo-print, expo-document-picker, push registration), icon/splash assets, Sentry, accessibility audit, screenshot automation. Human prerequisites: Apple Developer Program enrollment, EAS account, App Store Connect app record.

---

### PRD-api-versioning.md — API Versioning & Backend-Driven Updates

| | |
|---|---|
| **Status** | `In Progress` |
| **Last updated** | 2026-04-11 |
| **Depends on** | PRD-ios-app-store.md |

**Problem:** With the iOS app shipping via App Store, frontend and backend deployments are no longer atomic. Breaking API changes can crash older app versions. Health thresholds are hardcoded in the client — updating them requires an app update or OTA push.

**Scope:** API compatibility header (`X-API-Version`), server-driven config endpoint (`GET /api/config`) with feature flags and threshold overrides, minimum version enforcement, additive-only API change policy, deprecation protocol with `Sunset` header.

**Implemented Phase A** — KV namespace (`cat-tracker-config`, ID `7fc5a67f7e774458a99bf41dc7fe761c`), `CONFIG_KV` binding, `GET /api/config` endpoint (no auth, 5-min cache, KV validation with safe defaults fallback), `X-API-Version` middleware and header on all frontend requests, 6 tests in `config.test.ts`. Initial config seeded in production KV.

**Not yet implemented:**
- Phase B — Threshold overrides (client reads config thresholds and merges with local defaults)
- Phase C — Feature flags (client checks `features.*` before enabling UI)
- Minimum version enforcement middleware (compare X-API-Version against minSupportedVersion, return 426)
- Deprecation protocol with `Sunset` header

---

### PRD-security-phase2.md — Security Hardening Phase 2

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-04-11 |
| **Depends on** | PRD-security.md (Implemented), PRD-ios-app-store.md |

**Problem:** The iOS app introduces new attack surface not covered by Phase 1.

**Implemented Phase A** — SEC-11: re-auth gate on account deletion (5-minute session age check, 403 with re-sign-in prompt, `session_age_seconds` in `/auth/me`). SEC-13: Apple token replay prevention (`apple_token_cache` D1 table, SHA-256 of `sub|iat`, 409 on replay, cron cleanup). 5 tests in `auth-security.test.ts`.

**Not yet implemented:** Phase B (SEC-12 rate limiting, SEC-14 device token validation, SEC-15 audit logging), Phase C (SEC-10 device fingerprint, SEC-16 accepted risk docs).

---

### PRD-chart-time-navigation.md — Chart Time Range & Swipe Navigation

| | |
|---|---|
| **Status** | `Implemented` |
| **Last updated** | 2026-04-11 |

**Implemented Phases A + B** — `useChartWindow` hook (time range state, window filtering, navigation, adaptive tick formatting). `ChartRangeSelector` pill bar (1W/1M/3M/6M/1Y/All, default All, 44px touch targets, horizontally scrollable). `SwipeableChart` touch gesture wrapper (50px min swipe, translateX feedback). Integrated into WeightChart, MeasurementChart, CompareChart. Health assessment uses global `assessHealth()` — not recomputed per window. 10 tests in `useChartWindow.test.ts`.

---

### PRD-landscape-charts.md — Landscape Mode: Full-Screen Chart Visualization

| | |
|---|---|
| **Status** | `Approved` |
| **Last updated** | 2026-04-11 |
| **Related** | PRD-chart-time-navigation.md (range selector + swipe reused in landscape) |

**Problem:** Mobile charts are compressed into ~60% of a narrow portrait viewport. Users studying trends or comparing time ranges can't see enough detail.

**Scope:** Manual expand button (primary entry) + full-screen chart overlay with range selector and swipe navigation; opt-in `<FullScreenReady>` wrapper pattern; auto-rotate on native phones only (Phase B); no auto-rotate on web. Phase A = manual expand; Phase B = auto-rotate (native); Phase C = swipe dismiss + animation polish.

---

### PRD-localization-preferences.md — Localization & Regional Preferences

| | |
|---|---|
| **Status** | `Approved` |
| **Last updated** | 2026-04-11 |
| **Related** | PRD-app-settings.md (Phase C — D1 user_preferences sync) |

**Problem:** The app assumes US conventions (12h time, lbs, MM/DD/YYYY) everywhere. International users see unfamiliar formats with no override.

**Scope:** Locale-first defaults framework in `shared/lib/preferences.ts`; explicit overrides in Settings (Regional section); Phase A1 = date/time format; Phase A2 = weight unit + healthMetrics migration; Phase B = week start, temperature, chart/export integration; Phase C = D1 sync + native parity.

---

*Last updated: 2026-04-11*
