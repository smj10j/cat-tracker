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
**Status:** `Under Review`
**Implemented:** Nothing yet
**Summary:** OAuth login (Google + GitHub); D1 users + sessions tables; cats scoped by user_id; ProtectedRoute on frontend; claim-existing-cats prompt on first login
**Open questions:** See PRD-auth.md §Open Questions — needs product owner input before implementation begins

---

## Planned (no PRD yet)

These items have been mentioned or are implied by existing PRDs but don't have a formal PRD written:

| Feature | Origin | Notes |
|---------|--------|-------|
| Photo upload (R2) | PRD-mvp, backlog | Straightforward; needs PRD |
| Date range filter on charts | PRD-mvp | Low priority so far |
| Vet export / PDF | PRD-killer-app P0 | High value; needs PRD |
| Daily check-in screen | PRD-killer-app P1 | High value; needs PRD |
| Streak tracking | PRD-killer-app P2 | Habit-forming; needs PRD |
| Household sharing (post-auth) | backlog §5, killer-app P5 | Depends on auth being done first |

---

## Rejected

Nothing rejected yet.

---

*Last updated: Sprint 4 (Phase 9 complete)*
