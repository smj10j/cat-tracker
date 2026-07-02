# PRD: Body Condition Score (BCS)

| | |
|---|---|
| **Status** | `Approved` |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Author** | AI research (for product owner review) |
| **Depends on** | Generic measurements pipeline (`/add-measurement-type` process), evidence base process (PRD-evidence-base, `docs/research/`); Phase B touches InsightsPanel |

---

## Problem

Weight is the app's flagship metric, but weight alone is ambiguous. A cat can hold a steady weight while losing muscle and gaining fat; a lean-framed 8 lb cat and an underweight 8 lb cat are different animals; deliberate diet-driven loss and disease-driven loss can look identical on the weight chart. The app's weight alerts can flag *change* but cannot see *composition*.

Veterinary practice pairs weight with a **body condition score** — a standardized hands-on assessment of fat cover — as the companion metric. The intended standard here is the **WSAVA 9-point body condition scale**, which vets already use at every exam, meaning owners can transcribe the score their vet assigns and learn to assess between visits. The app has a home for exactly this kind of data (the generic measurements pipeline, 0–3 behavioral scales, time-series charts) but no BCS type.

This is deliberately a small feature: one new measurement type, one picker, one chart.

---

## Target users

- **Weight-management owners** (diet cats) who need to see condition, not just pounds, moving.
- **Chronic/senior-cat owners** whose vets track BCS at every recheck — transcribing it keeps the home record aligned with the clinical one.
- **Multi-caretaker households** where "she feels bonier lately" needs a shared, structured vocabulary.

---

## User stories

1. "The vet said Mochi is a 7 out of 9. Let me log that with today's date."
2. "Show me her BCS over the past year next to her weight chart — the diet started in January."
3. "I do the rib-check monthly. Give me a picker that reminds me what each score means so I score consistently." *(descriptive copy is citation-gated — see guardrail)*
4. "Include BCS history in the vet export so the new vet sees the trajectory, not one data point."

---

## Scope

### Phase A — the measurement type

- Add **`bcs`** as a new measurement type through the existing generic pipeline, following the documented `/add-measurement-type` steps:
  - `VALID_MEASUREMENT_TYPES` in `shared/lib/constants.ts` gains `'bcs'`
  - `MEASUREMENT_TYPE_LABELS`: `bcs: 'Body Condition'`; `MEASUREMENT_TYPE_LABELS_LONG`: `'Body Condition Score'`
  - **Not** added to `BEHAVIORAL_TYPES` (it is a periodic physical assessment like weight, not a daily behavioral 0–3) and not part of the daily check-in
  - Presets: a new `BCS_PRESETS` structure in `shared/lib/measurementPresets.ts` — the existing `PRESETS` machinery assumes a 0–3 scale (`getPresetTicks` hardcodes four ticks), so BCS gets a parallel 9-entry list rather than a forced fit
- Stored as `type='bcs'`, `value` 1–9 integer, `unit='scale'` — **no change to the measurements table shape** (this is the entire point of the generic pipeline; both platforms pick the type up via shared constants).
- Worker validation accepts value 1–9 for `bcs` (the 0–3 range check must be per-type, not global).
- **Visual picker UI** (web + iOS): nine selectable segments, 1–9, each with a plain-language one-line description of what that score feels/looks like. **Descriptions ship only after citation — see guardrail.** Until cited, the picker may ship with numbers and the scale name only.
- **BCS-over-time chart**: step/line chart, y-axis fixed 1–9, on the cat profile's chart area alongside Weight (its own tab; excluded from `BEHAVIOR_CHART_TYPES`).
- BCS rows appear in measurement history and the vet export's measurement section like any other type.

### Phase B — pairing with weight in insights

- InsightsPanel (web + iOS) may show weight and BCS **side by side as factual observations** — e.g., "Weight down 0.4 lbs since March; last BCS 6/9 (Apr 2)". **Framing only.**
- Any *evaluative* pairing — "losing weight while condition remains above ideal", ideal-range shading on the chart, alert integration with `healthMetrics.ts` — is a clinical claim and ships only after Tier 1 citation per the guardrail, and likely deserves its own follow-up review.

### Phase C — muscle condition score (open question, not scoped)

- WSAVA also defines a muscle condition score (MCS), the loss-of-muscle counterpart that matters for exactly this app's senior/CKD audience. Deliberately **not** scoped here — see Q3.

### Clinical-content guardrail

Per `docs/research/README.md` and CLAUDE.md, and binding for every phase:

- The intended standard is the **WSAVA 9-point body condition scale** — named here as intent, not asserted as implemented guidance.
- **Before any per-score descriptive copy, any "ideal range" band, any alert logic, or any Wellness Guide content ships**, the primary source (the WSAVA Global Nutrition Committee BCS chart / associated guidelines, Tier 1) must be documented in `docs/research/` (new `body-condition.md` or an extension of `weight-thresholds.md`), with access date, following the standard process: source → research doc → code comment → copy.
- This PRD intentionally asserts **no** numeric claims about which scores are ideal, overweight, or underweight, and no health associations. Where the UI would state one, it is blocked on the citation, not on engineering.
- Copy stays conservative: describe, never diagnose; scores are the owner's (or their vet's) assessment, and the app recommends discussing scoring technique with the vet.

---

## Data model sketch

**None. No new tables, no new columns.** BCS rides the existing generic `measurements` table exactly as designed:

| Column | Value |
|---|---|
| `type` | `'bcs'` |
| `value` | `1.0`–`9.0` (integers in v1; half-points are Q2) |
| `unit` | `'scale'` |
| `measured_at` | assessment date |
| `notes` | optional ("vet-assessed at annual exam") |

The existing `idx_measurements_cat_type` index already serves the chart query. This PRD makes **zero** schema changes — it is the reference example of why the measurements table is intentionally generic.

---

## API sketch

**No new routes.** Existing measurement endpoints handle create/list/edit/delete once `'bcs'` joins `VALID_MEASUREMENT_TYPES` (shared constant consumed by worker validation).

Worker changes, small and additive:

- Per-type value validation: `bcs` → integer 1–9 (existing behavioral types keep 0–3; weight keeps its numeric rules).
- Confirm the export endpoint/page needs no server change (measurement sections are type-driven).

Authorization: unchanged — whoever can log a weight can log a BCS (Contributor+, per existing measurement rules).

---

## UX notes (web + iOS — parity mandatory)

### Picker (both platforms)

- Entry from the measurement form / QuickAdd type list as "Body Condition".
- Nine tappable segments in a 1→9 row (or 3×3 grid at 375px if a row is too cramped), selected state prominent; beneath the selection, the one-line description for the chosen score (**citation-gated**; numbers-only fallback pre-citation).
- Optional simple silhouette glyphs per score are nice-to-have and count as descriptive clinical content — same citation gate, since the silhouettes *are* the WSAVA chart's content.
- A quiet caption links the scale name: "9-point body condition scale". A "how to score" explainer (rib-check technique etc.) is Wellness Guide content — citation-gated, not required for Phase A.
- iOS mirrors the web layout, iPad-responsive via the existing `useResponsiveLayout`/`rv()` system.

### Chart

- Y-axis fixed 1–9 with integer ticks; stepped line (BCS is sparse and ordinal — avoid implying smooth continuity), dots on actual entries.
- Sits as its own tab beside Weight in the cat profile chart area on both platforms; respects existing time-range navigation and landscape behavior.
- No colored bands or ideal-zone shading in Phase A (citation-gated).

### History & export

- History rows render "Body Condition — 6/9" plus notes; vet export lists BCS entries with dates (vets can interpret; export adds no interpretation).

### Cadence

- BCS is periodic, not daily: excluded from daily check-in. Any "it's been a while since the last BCS" nudge is Q1, default off.

---

## Edge cases

- **Score entered on a 5-point scale** (some clinics use it): v1 supports the 9-point scale only; the picker's explicit 1–9 framing prevents ambiguity. A "my vet used 5-point" note in notes is fine; **no automatic conversion** (a conversion mapping is itself clinical content).
- **Value validation drift**: `unit='scale'` currently implies 0–3 elsewhere; validation must branch on `type`, not `unit` — regression-test the behavioral types after the change.
- **Charts with 2–3 lifetime points**: entirely normal for BCS; the chart must look intentional, not broken, with sparse data (dot-forward rendering).
- **Pre-citation ship state**: if Phase A ships before descriptions are cited, the picker shows numbers + scale name with no descriptive copy — and this state must be visually complete, not placeholder-looking.
- **Correlation engine**: BCS is sparse and ordinal; verify it is excluded from (or harmless within) the behavioral correlation engine — it is not a `BEHAVIORAL_TYPE`, so exclusion should be automatic; confirm in tests.
- **Deceased cats**: BCS history remains in the memorial health record like all measurements; no new entry (existing guard).
- **CSV import/export**: type-driven paths should pass `bcs` rows through untouched — verify.

---

## Out of scope

- **Interpretation of any score** — "overweight", "ideal", weight+BCS composite alerts, `healthMetrics.ts` integration. All blocked on Tier 1 citations in `docs/research/` and (for alerts) a follow-up review.
- **Ideal-range chart shading** — same gate.
- **Muscle condition score** — Phase C question, not scoped.
- **5-point scale support or cross-scale conversion.**
- **Photo-based or guided-assessment scoring** ("feel the ribs" wizard) — Wellness Guide territory, citation-gated, future.
- Reminders/notifications for BCS entry beyond the (default-off) Q1 nudge.

---

## Open questions for product owner

1. **Cadence nudge:** should the app quietly suggest a BCS entry when none has been logged for N months (e.g., in InsightsPanel as a factual "last scored in March")? Default off in Phase A unless wanted.
2. **Half-points:** vets occasionally record 6.5/9. Integers-only keeps the picker clean; allowing halves doubles picker states for marginal value. Recommendation: integers in v1 (the note field absorbs "vet said 6.5"). Confirm.
3. **Phase C — muscle condition score:** MCS (normal / mild / moderate / severe muscle loss) is arguably *more* valuable than BCS for this app's senior/CKD-heavy audience and would follow the identical pipeline (`type='mcs'`, 4-point presets). Scope into a fast-follow, fold into this PRD, or park?
4. **Vet-assessed vs. owner-assessed:** worth a structured "who scored this?" toggle (stored in notes vs. a convention), or is the free-text note sufficient in v1?

---

## Acceptance criteria

- [ ] `'bcs'` is a valid measurement type via shared constants; both platforms offer "Body Condition" in measurement entry with **no schema change and no new API routes** (verified: schema.sql diff is empty for this feature).
- [ ] Worker accepts integer values 1–9 for `bcs` and continues to enforce 0–3 for behavioral types (regression tests included).
- [ ] Visual 1–9 picker ships on web and iOS with identical scoring semantics; per-score descriptive copy appears **only if** the WSAVA citation is documented in `docs/research/` first (PR link between the research doc and the copy).
- [ ] BCS chart renders with fixed 1–9 axis, handles sparse data cleanly, and appears as its own tab beside Weight on both platforms.
- [ ] BCS entries appear in measurement history and the vet export with no interpretive copy anywhere (no "ideal/overweight/underweight" strings in the codebase for this feature pre-citation).
- [ ] BCS is excluded from daily check-in, `BEHAVIORAL_TYPES`, and behavioral correlation surfaces.
- [ ] (Phase B) InsightsPanel weight+BCS pairing is purely factual (values + dates); evaluative copy is demonstrably absent pre-citation.
- [ ] All four test suites pass; `./scripts/check-shared-drift.sh` clean.
