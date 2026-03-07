# PRD Registry

Canonical list of all product requirement documents, their status, and implementation state.
**Always check this before starting new work** to avoid duplicating effort or implementing something that was rejected.

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| `Draft` | Written, not yet reviewed by the product owner |
| `Under Review` | Shared with product owner; awaiting feedback |
| `Approved` | Greenlit; ready to implement when prioritized |
| `In Progress` | Currently being actively implemented |
| `Implemented` | Fully built and deployed to production |
| `Partial` | Some items implemented; remainder deprioritized or blocked |
| `Superseded` | Replaced by a newer PRD; do not implement remaining items |
| `Rejected` | Product owner decided not to build this |

---

## PRD Index

### PRD-mvp.md — MVP: Cat Tracking Core
**Status:** `Implemented`
**Implemented:** All MVP features (cat CRUD, weight measurements, chart, mobile layout)
**Notes:** The "no auth" decision was explicit and intentional for MVP. Auth is now tracked in PRD-auth.md.

---

### PRD-features-backlog.md — Feature Backlog
**Status:** `Partial`
**Implemented items:**
- CSV Import (POST /api/import + ImportPage)
- Quick-add floating button (now: BottomNav center "Log" button via QuickAdd)
- PWA manifest + installability
- Food/water intake measurement types
- Behavioral measurement types (grooming, activity, vomiting, litter)
- Cat profile tabs (Weight / Food / Water / Behavior / All)
- Health severity visuals (status-tinted cards, badges, sorted by severity)

**Not yet implemented:**
- Photo upload (R2) — still viable, no PRD written yet; see PRD-killer-app.md P0-adjacent
- Date range filtering on charts
- Trend regression / ideal weight band
- "Due for weigh-in" badge — see PRD-killer-app.md P3

**Superseded items:**
- §5 Sharing / token-based household access — replaced by PRD-auth.md which proposes full user accounts

---

### PRD-ux-simplification.md — UX Simplification
**Status:** `Implemented`
**Implemented:** BottomNav center → QuickAdd Log sheet; "Add a cat" dashed card on Home; Wellness Guide page at /wellness; tap-to-select presets for behavioral measurements; presets stored as 0–3 int with unit='scale'

---

### PRD-health-status-visuals.md — Health Status Emoji Indicators
**Status:** `Implemented`
**Implemented:** STATUS_EMOJI (✅ 👀 ⚠️ 🚨) in healthMetrics.ts; WeightChart and CompareChart use SVG emoji text nodes on data points; legend updated

---

### PRD-measurement-ux.md — Measurement UX Fixes
**Status:** `Implemented`
**Implemented:** QuickAdd type selector is now a native `<select>` (no horizontal scroll); litter presets reordered (Straining before Diarrhea — blockage is more urgent); grooming "Not grooming" shortened to "None"

---

### PRD-charts-expansion.md — Charts: Multi-Type & Profile Chart by Tab
**Status:** `Implemented`
**Implemented:** CompareChart has type selector + re-fetches all cats on change; scale Y axis shows preset labels; CatProfile shows WeightChart on weight tab, MeasurementChart on food/water tabs, no chart on behavior/all; new MeasurementChart.tsx component

---

### PRD-killer-app.md — Killer App Research & Roadmap
**Status:** `Under Review`
**Implemented:** Nothing yet — this is a roadmap document for product review
**Items (pending prioritization):**
- P0: Vet export / shareable visit summary
- P1: Daily check-in (multi-measurement single screen)
- P2: Streak & consistency tracking
- P3: Weigh-in reminders (reminder_interval_days per cat)
- P4: Correlation insights (food drop → weight drop)
- P5: Household sharing (on top of auth)
- P6: Shelter mode (rooms, triage view, medical templates)
- P7: AI health narrative (Claude API weekly summaries)
- P8: Smart scale integration

---

### PRD-auth.md — User Accounts & Data Isolation
**Status:** `Implemented`
**Implemented:** Google OAuth (login/callback/logout/me); D1 users + sessions + oauth_states tables; cats.user_id FK; requireAuth middleware with rolling sessions; all routes scoped by userId; ProtectedRoute; /login page; user avatar in BottomNav with sign-out; claim-existing-cats prompt on Home. Live and verified.
**Open questions resolved:** Google-only at launch (answered). 7-day sessions (answered). Claim prompt on first login (answered, implemented). State stored in D1 oauth_states (not cookie) to survive proxy redirect. Pages proxy reconstructs 3xx responses to preserve Set-Cookie headers.

---

### PRD-correlations.md — Measurement Correlations
**Status:** `Implemented`
**Implemented:** `correlations.ts` (weekly buckets, normalize, Pearson lag correlation, detectCorrelations, describeCorrelation, getHomeBadge); `CorrelationChart.tsx` (normalized dual-line chart, type selectors, pattern prose); CatProfile Trends tab; Home correlation badge for predictive signals. Frontend-only, no new API.
**Open questions resolved:** Min data = 4 aligned weekly buckets (lenient; works with our test data). Hyperthyroidism pattern flagged without naming the disease. Copy avoids causation language. Sparse data shows "X more weeks needed".
**Superseded by:** PRD-correlation-descriptions.md for description quality/clinical content. Core math unchanged.

---

---

### PRD-vet-export.md — Vet Visit Export
**Status:** `Implemented`
**Implemented:** `/cats/:id/export` — print-optimized white page with cat info, weight table (15 entries with deltas), behavioral tables (last 4 weeks, human-readable preset labels), observed patterns section. Vet-mode correlation descriptions (clinical language + differentials). Confluence cluster note in amber card. Export buttons on CatProfile and CatHealthGuidance. `window.print()` → "Save as PDF" flow.

---

### PRD-input-output-metrics.md — Input/Output Metric Classification
**Status:** `Implemented`
**Implemented:** `INPUT_TYPES` (food, water, grooming, activity, play) and `OUTCOME_TYPES` (weight, vomiting, litter) sets in correlations.ts. CorrelationChart uses constrained selectors: left dropdown = input types only, right = outcome types only. Arrow `→` between dropdowns. Graceful empty state when no input or outcome types are logged.

---

### PRD-login-splash.md — Marketing / Splash Login Page
**Status:** `Implemented`
**Implemented:** Full login page redesign. Hero section with cat emoji, radial glow, floating "9.4 lbs" / "↗ stable" metric bubbles, branded sparkline. Value prop headline. 3 feature rows (weight tracking, early warning patterns, vet-ready summaries). Sign-in button with gradient border. Privacy note. Error state for auth failures.

---

### PRD-correlation-descriptions.md — Correlation Descriptions: Clinical Accuracy & Dual-Audience
**Status:** `Implemented`
**Implemented:** `typeATrend`/`typeBTrend`/`dataWeeks` fields on CorrelationResult; `detectTrend()` using first-half vs second-half average; `detectConfluence()` with two known clinical clusters (kidney/thyroid/DM; systemic illness); `describeCorrelation()` rewritten with `mode: 'owner' | 'vet'` — owner mode uses pair-specific clinical context, gendered pronouns, confidence framing, early-warning note; vet mode includes r/lag/dataWeeks stats and clinical differentials by pair+trend direction. InsightsPanel shows confluence alert above individual patterns. CorrelationChart updated with new fields and catSex prop. CatExportPage uses vet mode with amber confluence card.

---

## Planned (no PRD yet)

These items have been mentioned or are implied by existing PRDs but don't have a formal PRD written:

| Feature | Origin | Notes |
|---------|--------|-------|
| Photo upload (R2) | PRD-mvp, backlog | Straightforward; needs PRD |
| Date range filter on charts | PRD-mvp | Low priority so far |
| Daily check-in screen | PRD-killer-app P1 | High value; needs PRD |
| Streak tracking | PRD-killer-app P2 | Habit-forming; needs PRD |
| Household sharing (post-auth) | backlog §5, killer-app P5 | Depends on auth being done first |

---

## Rejected

Nothing rejected yet.

---

### PRD-profile-ux.md — Cat Profile UX: Insights Panel & History Timeline
**Status:** `Implemented`
**Implemented:** InsightsPanel.tsx — single severity-tinted panel replacing 3 separate alert cards; proactive correlation text from detectCorrelations(); collapsible CorrelationChart. History grouped by calendar day with day headers and "View N older entries" load-more. Trends tab removed from history tab bar.

---

*Last updated: Sprint 7 (vet export, input/output metrics, login splash, correlation descriptions overhaul, cat sex field, UX polish)*
