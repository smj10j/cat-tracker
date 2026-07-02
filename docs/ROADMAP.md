# Cat Tracker — Delivery Roadmap

> **Status:** Active. Created 2026-07-02 from a full-codebase bug audit + PRD registry review.
> **How to use:** Each work package (WP) is sized for roughly one session. Work them in order unless the product owner reprioritizes. At the start of a session, pick the first WP with unchecked items, follow the CLAUDE.md Execution Loop (TODO.md phase entry → implement → test → deploy → commit → push), and check items off **here and in TODO.md**. iOS-visible changes additionally need a TestFlight build via `/deploy`.

---

## Priority summary

| WP | Title | Priority | Type | PRD gate |
|----|-------|----------|------|----------|
| WP1 | Care schedule correctness (the "sub-q fluids" bug) | **P0** | Bug fix | None for 1a–1d; 1e needs PRD amendment approval |
| WP2 | Timezone & date correctness sweep | P1 | Bug fix | None |
| WP3 | Data integrity & error handling | P1 | Bug fix / QoL | None |
| WP4 | Care & notifications QoL | P2 | QoL / feature | Partly gated (PRD-medication-reminders is `Partial`) |
| WP5 | Finish `Partial` PRDs | P2 | Feature completion | Already approved scopes |
| WP6 | Test coverage & tech debt | P3 | Debt | None |
| WP7 | New features | P3 | Feature | **Gated — Draft PRDs need approval first** |

---

## WP1 — Care schedule correctness (P0, ~1 session)

**Reported symptom:** "Add sub-q fluids every 3 days, first delivery yesterday, forget to mark it delivered → all hell breaks loose."

**Verified mechanisms (2026-07-02 audit):**

- **1-A. Past start dates create instantly-overdue doses.** `generateDoses()` (`worker/src/routes/medications.ts:31-100`) loops from `start_date` with no relation to "now". A start date of yesterday creates a dose that is overdue the moment the care item is saved. Neither `validateCareItem()` (`shared/lib/careItemForm.ts:87-91`) nor the POST route (`medications.ts:186-195`) validates start-date timing, and neither form constrains the picker (`frontend/src/pages/MedicationFormPage.tsx`, `app/app/cats/[id]/care-item.tsx`).
- **1-B. Overdue doses accumulate forever.** The cron (`worker/src/index.ts:139-161`) extends the 90-day future window every run but never resolves the past. Every missed dose sits in the notifications "overdue" section permanently — one more every interval. No bulk-clear exists; the only escape is tapping each dose individually.
- **1-C. No schedule re-anchoring.** Marking a dose given (even days late) does not shift subsequent doses; they stay anchored to `start_date + n×interval`. For interval-driven care (sub-q fluids, some meds), the clinically correct next-due is `last_given + interval`.
- **1-D. UTC "today" boundary in edit flow.** `PUT /api/medications/:id` (`medications.ts:306-318`) deletes/regenerates future doses using the **UTC** date as "today"; users editing within a few hours of UTC midnight get doses wrongly kept or deleted.

**Tasks:**

- [ ] 1a. Dose generation: never generate doses more than one interval before "today" (user-local today when timezone known). Backdated start dates become an **anchor**, not a backlog. Applies to POST, PUT, and cron paths (all funnel through `generateDoses`).
- [ ] 1b. Creation UX: when start date < today, ask "Already gave the first dose?" — if yes, create that one past dose pre-marked administered so history is accurate; if no, create it as genuinely overdue. Both platforms.
- [ ] 1c. Overdue hygiene: cron auto-expires unresolved doses older than a cutoff (recommend `max(2×interval, 7 days)`) into a `missed` state — visible in history, excluded from the overdue inbox and `overdue_count`. Add "Mark all given" / "Dismiss all" bulk actions to the notifications inbox (web + iOS).
- [ ] 1d. Fix the PUT regeneration boundary to use user-local today (reuse `userDateBoundaries()` in `medications.ts:349`).
- [ ] 1e. **Needs product decision (PRD amendment to PRD-care-extensions or PRD-medication-reminders):** per-item schedule mode — `fixed` (calendar-anchored, e.g. "1st of month") vs `interval` (re-anchor from last given). Recommend `interval` as default for `custom`-frequency items like sub-q fluids. Do not implement until approved; 1a–1d land independently.
- [ ] 1f. Tests: past start date, overdue expiry, bulk actions, PUT near UTC midnight, cron idempotency (`worker/src/__tests__/`).

---

## WP2 — Timezone & date correctness sweep (P1, ~1 session)

- [ ] 2a. **Naive/UTC dual storage.** Users without `users.timezone` get `due_at` stored as naive local time (`medications.ts:47-50`), but clients blindly append `Z` and treat it as UTC (`shared/lib/dates.ts:61`), shifting displayed times by the full UTC offset. Fix: capture timezone at login/session for all users, backfill `users.timezone`, migrate naive dose rows (or regenerate pending doses per med), then drop the `timezone: null` legacy path.
- [ ] 2b. **`catAge()` off-by-one month** (`shared/lib/dates.ts:77-85`): month arithmetic ignores day-of-month, overstating age up to ~10 days/month. Affects Home, CatProfile, exports, Sitter view on both platforms. Fix + tests.
- [ ] 2c. Cron/window boundaries use UTC dates (`windowEnd90()`, hour-window push query in `index.ts:163-186`) — audit each for user-local correctness; document any intentionally-UTC ones inline.
- [ ] 2d. Extreme-timezone day-label drift (Today/Yesterday/Tomorrow in `shared/lib/formatting.ts:122-175`) — resolves mostly via 2a; add regression tests at UTC±12.
- [ ] 2e. Regression-test suite for `dates.ts`/`formatting.ts` covering DST transitions and date-only parsing.

---

## WP3 — Data integrity & error handling (P1, ~1 session)

- [ ] 3a. **CSV import validation parity** (`worker/src/routes/import.ts:150-168`): import bypasses the type/unit/value validation that `POST /measurements` enforces — invalid types can enter the DB and confuse charts/correlations. Mirror the validation; add rejection tests.
- [ ] 3b. Import preview (`frontend/src/pages/ImportPage.tsx`) should validate type/unit client-side so bad rows show as invalid before submit.
- [ ] 3c. Replace `window.confirm()`/`alert()` with a shared in-app confirm dialog + toast: `CatProfile.tsx:180`, `HouseholdPage.tsx:110`, `MedicationFormPage.tsx:139`, `AddEditCat.tsx:168,204`. This also closes the household-sharing Phase B "custom confirmation dialogs" item.
- [ ] 3d. iOS: replace silent `.catch(() => {})` refetch failures (`app/app/cats/[id]/index.tsx:80-82` and similar) with a lightweight stale-data/error indicator; audit other screens for the same pattern.
- [ ] 3e. Fix misleading validation copy in `worker/src/routes/measurements.ts:65-66` ("weight value must be…" shown for all non-scale types).

---

## WP4 — Care & notifications QoL (P2, ~1–2 sessions)

- [ ] 4a. PRN administration log — explicit "gave a dose now" timestamped record for as-needed items (existing follow-up from TODO Phase 60; in approved PRD-care-extensions scope).
- [ ] 4b. Overdue follow-up notification: push fires once at the due hour (`notification_sent_at` guard, `index.ts:181`) and never again — add a single follow-up reminder (e.g., 24h later) with its own sent-marker. Within PRD-medication-reminders approved scope.
- [ ] 4c. Snooze / "given late" affordances on dose rows (web + iOS).
- [ ] 4d. PRD-medication-reminders Phase C: email fallback via Resend when no push token and dose goes overdue.
- [ ] 4e. PRD-medication-reminders Phase D: refill stock tracking UI (`doses_remaining` management on edit form) — and decrement on mark-given if not already wired.
- [ ] 4f. Phase B (web push/VAPID) — deprioritized; iOS push already exists. Confirm with product owner before building.

---

## WP5 — Finish `Partial` PRDs (P2, ~2 sessions; already-approved scope)

- [ ] 5a. Household sharing Phase B remainder: invite reminder email (3 days), admin notification on accept, removed-member notification. (Dialogs handled in 3c.)
- [ ] 5b. Accessibility Phase C: CompareChart stroke-dash differentiation; STATUS_LABEL text always beside STATUS_EMOJI in InsightsPanel.
- [ ] 5c. Usability Phase C: shared `<LoadingShell>`; CatProfile empty-state CTA; health status visible without scrolling at 375px.
- [ ] 5d. App settings Phase C: D1 `user_preferences` sync for theme/regional prefs across devices.
- [ ] 5e. Visual identity v2 follow-ups (PRD `In Progress`): App Store screenshots in Lamplight; app-icon selection (owner decision from `icon-options/`); iOS font bundling (Plus Jakarta + Fraunces); InsightsPanel/CatProfile hierarchy refactors; measurement-emoji → Phosphor migration.

---

## WP6 — Test coverage & tech debt (P3, ongoing filler)

- [ ] 6a. Worker: import-route validation tests (with 3a); cron multi-day accumulation tests (with 1c/1f).
- [ ] 6b. Frontend: tests for the highest-risk untested pages first — MedicationFormPage, NotificationsPage, ImportPage, CatProfile (17 of 34 pages untested).
- [ ] 6c. App: screen tests beyond smoke for care-item, notifications, sitter (3 of 22 screens covered).
- [ ] 6d. Cron efficiency: `generateDoses` re-walks from `start_date` every hourly run for every med (O(age) growth + `INSERT OR IGNORE` churn). Generate from `max(today − 1 interval, last generated due_at)` instead. (Partly falls out of 1a.)
- [ ] 6e. Housekeeping: reconcile stale TODO.md checkboxes — Phase 60 "deploy worker + frontend" and Phase 60.5 "deploy to TestFlight" are unchecked, but the submission log shows v1.0.2/v1.0.3 shipped; verify and mark.

---

## WP7 — New features (P3, **gated on PRD approval — do not implement until REGISTRY.md says `Approved`**)

Ordered by likely value; each needs the product owner to flip status in `docs/PRDs/REGISTRY.md` first:

- [ ] 7a. Health alert acknowledgment (PRD-alert-acknowledgment, `Draft`) — pairs naturally with WP1's overdue hygiene.
- [ ] 7b. Behavioral trend charts (PRD-behavioral-trends, `Draft`).
- [ ] 7c. Streak & consistency tracking (spec ready in PRD-ux-redesign §3B; needs status flip).
- [ ] 7d. Weigh-in reminders (PRD-ux-redesign §3C) — reuses WP1's scheduling substrate.
- [ ] 7e. Device integrations Tier 1 ingest API (PRD-device-integrations, `Draft`), then HA connector / Tuya connector child PRDs.
- [ ] 7f. AI health narrative (needs its own PRD written first).
- [ ] 7g. Household sharing Phase 2 (PRD-household-sharing-phase2, `Draft`): ownership transfer, delete household, audit feed.

---

## Suggested session plan

| Session | Contents |
|---------|----------|
| 1 | WP1 (1a–1d, 1f) + write the 1e PRD amendment for review |
| 2 | WP2 (timezone sweep + catAge) |
| 3 | WP3 (import validation + dialogs/toasts) |
| 4 | WP4 (4a–4c; 4d/4e if time) |
| 5 | WP5 (5a–5c) |
| 6 | WP5 (5d–5e) + WP6 backlog |
| 7+ | WP7 as PRDs get approved; WP6 as filler |

**Standing rules for every session:** all 4 test suites (shared/worker/frontend/app) before deploy; cross-platform parity check (`frontend/` ↔ `app/`); deploy worker + frontend after changes; TestFlight build when iOS-visible; commit + push per logical unit; update this file's checkboxes.
