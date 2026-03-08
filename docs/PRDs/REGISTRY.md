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
| [PRD-household-sharing.md](PRD-household-sharing.md) | Household Sharing & Multi-User Access | `Implemented` | 2026-03-07 18:00 |
| [PRD-household-sharing-phase2.md](PRD-household-sharing-phase2.md) | Household Sharing — Phase 2 (lifecycle + audit) | `Draft` | 2026-03-07 13:00 |
| [PRD-cat-photos.md](PRD-cat-photos.md) | Cat Photo Uploads | `Implemented` | 2026-03-07 20:00 |
| [PRD-ux-redesign.md](PRD-ux-redesign.md) | UX Redesign — Competitive Analysis & Next-Gen Features | `Partial` | 2026-03-07 |
| [PRD-daily-checkin.md](PRD-daily-checkin.md) | Daily Check-In — Multi-Measurement Entry Screen | `Implemented` | 2026-03-07 |
| [PRD-evidence-base.md](PRD-evidence-base.md) | Veterinary Evidence Base — Sources, Citations, and Research Infrastructure | `Implemented` | 2026-03-07 |
| [PRD-accessibility.md](PRD-accessibility.md) | Accessibility — Color Independence, Touch Targets, Screen Reader Support | `Partial` | 2026-03-07 |
| [PRD-usability.md](PRD-usability.md) | Usability Polish — Scroll, Feedback, Disabled States, Delete Confirmation | `Partial` | 2026-03-07 |

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
| P1 | Daily check-in (multi-measurement single screen) | Implemented (see PRD-daily-checkin.md) |
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
| **Status** | `Partial` |
| **Last updated** | 2026-03-07 11:00 |

**Problem:** Cat owners with recurring medications (flea prevention, daily pills, heartworm) have no reminder system. Missing doses can have serious health consequences (thyroid crisis, flea infestation).

**Scope:** Medication schedule management, recurring/one-time reminders, finite courses, in-app notification inbox, mark-given/skip-dose, refill reminders, web push notifications (VAPID), cron-driven delivery, pre-built medication presets.

**Implemented Phase A** (core scheduling + in-app inbox). Phase B (web push), C (email), D (refill stock UI) remain as future work.

---

### PRD-household-sharing.md — Household Sharing & Multi-User Access

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-03-07 12:30 |

**Problem:** Cat Tracker is single-user. Multi-person households (spouses, family members, pet sitters) can't share access to the same cats.

**Scope:** Household entity owns cats; 4-role permission system (Viewer/Contributor/Editor/Admin); email invite flow via Resend (`noreply@01j.me`); household settings UI accessible from profile popover; migration from current per-user cat ownership to household-based ownership.

**Implemented Phase A** (household model, invite system, role-based access, member management, household settings page, invite acceptance page, home screen household labels, household-scoped cat and measurement authorization).

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
| **Status** | `Draft` |
| **Last updated** | 2026-03-07 |
| **Depends on** | PRD-killer-app.md (P1, P2, P3, P7) |

**Origin:** Competitive analysis of a vet practice pet management app (PetDesk-like). Five screens analyzed covering pet profile, reminder system, and reminder creation flow.

**Scope:** 5 proposals across 5 phases:
- **2A** Profile Hero Redesign (full-bleed photo, gradient overlay, structured details) — **Implemented**
- **2B** Structured Pet Details with Icons + neuter/spay status field — **Implemented**
- **2C** Rename Medications to "Care Schedule," add vet event types, emoji icon system — **Implemented**
- **2D** CatProfile tab reorganization (Health / Care / About) — **Implemented**
- **2E** Photo gallery/timeline — Not started

Plus 5 Killer App promotions: Daily Check-In (P1), Streaks (P2), Weigh-In Reminders (P3), AI Health Narrative (P7), Vet Integration concept (future).

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

## Planned (no PRD written)

Items mentioned or implied by existing PRDs that have not yet been formally specified. A PRD must be written and approved before implementation.

| Feature | Origin | Notes |
|---------|--------|-------|
| ~~Photo upload (R2)~~ | ~~PRD-features-backlog.md~~ | Superseded by PRD-cat-photos.md |
| Date range filter on charts | PRD-features-backlog.md | Low priority so far |
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

**Phases A and B implemented** — `:focus-visible` ring, `htmlFor`/`id` on all forms, `aria-live`/`role="status"/"alert"` on dynamic feedback, `aria-busy` on save buttons, `aria-expanded` on toggles (InsightsPanel, WellnessGuide), `role="tablist"/"tab"/"aria-selected"` on CatProfile tabs. All `text-[10px]` replaced with `text-xs`. `min-h-[44px]` on DailyCheckin preset buttons and MeasurementForm close button. Phase C (color-independence signals, CompareChart dash patterns) remains.

---

### PRD-usability.md — Usability Polish

| | |
|---|---|
| **Status** | `Partial` |
| **Last updated** | 2026-03-07 |

**Problem:** Several interaction patterns create friction or data-loss risk: pages don't scroll to top on navigation; MeasurementForm behavioral preset buttons save immediately on tap (no undo); disabled buttons say "Nothing to log yet" instead of explaining how to enable; delete is single-tap with no confirmation; back navigation is inconsistent across pages; error messages lack actionable recovery guidance.

**Scope:** Three phases — (A) zero-risk wins: `ScrollToTop` component, disabled button copy, actionable error messages, save confirmation in MeasurementForm; (B) interaction model: two-step preset save in MeasurementForm, two-step delete confirmation, back nav audit; (C) state and hierarchy: loading state standardization, empty state improvements, CatProfile health status visibility.

**Phases A and B implemented** — `ScrollToTop` component, disabled button always says "Log Check-In" with contextual hint below, `role="alert"` on errors, `role="status"` on save banners, `aria-busy` on save buttons, MeasurementForm preset select-then-save model (no accidental immediate saves), two-step inline delete confirmation in CatProfile, back nav fixed to `navigate(-1)` with fallback. Phase C (loading state standardization, empty state improvements, CatProfile hierarchy) remains.

---

*Last updated: 2026-03-07*
