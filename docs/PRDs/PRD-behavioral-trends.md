# PRD: Behavioral Trend Charts

> **Status:** Draft
> **Created:** 2026-04-11
> **Last updated:** 2026-07-02

---

## Problem Statement

Users log behavioral observations daily (food intake, water, grooming, activity, litter, vomiting) using 0-3 scale presets. This data accumulates but is only visible as a history list of individual entries. There's no way to visualize behavioral trends over time — whether a cat's appetite has been declining over weeks, whether grooming returned to normal after a medication change, or whether vomiting frequency is increasing.

**State of the gap (re-audited 2026-07-02):** the original draft said iOS had no behavioral charts; that has since flipped:

- **Web** (`frontend/src/pages/CatProfile.tsx`): the Behavior chart tab shows **history only — no chart at all** (an intentional PRD-charts-expansion decision this PRD now reverses). Food/Water tabs use `MeasurementChart.tsx`.
- **iOS** (`app/app/cats/[id]/index.tsx` lines ~488-525): the Behavior tab already renders **per-type line charts** (grooming/activity/litter/vomiting small multiples via `LineChart`), plus Food/Water charts.
- **Both platforms share a rendering flaw**: behavioral values are ordinal (0-3 preset labels), but they're drawn as smooth continuous lines (`monotone` interpolation on web `MeasurementChart`, straight-line interpolation on iOS `LineChart`). A line gliding through 1.7 between "Less" and "Normal" implies a precision and a continuum that do not exist.

So the work is: give web its missing behavior charts, and give both platforms an *ordinal-correct* chart form, daily aggregation, and a trend summary.

---

## Goals

1. Show behavioral measurement trends as time-series charts on the CatProfile behavior surface (web Behavior tab; iOS Health-tab Behavior chart selector)
2. Render 0-3 scale values honestly: ordinal steps with human-readable preset labels on the Y axis — never smooth interpolation implying values between categories
3. Aggregate multiple same-day observations into one defensible daily value, and handle sparse data without drawing misleading connections
4. Surface multi-week patterns via a one-line trend summary so users notice gradual changes before they become emergencies
5. Keep web and iOS behavior identical via shared aggregation/trend logic in `shared/lib/`

## Non-Goals

- Weekly aggregate summaries (future — daily granularity first; the trend line copy covers the "weeks" view)
- Correlation visualization between behavioral types (handled by CorrelationChart, separate feature)
- Behavioral alerts/notifications or health-status escalation from behavioral data (handled by healthMetrics.ts and InsightsPanel; see Clinical Content Rule below before any of that copy is written)
- Changing how Food/Water values are *collected* (0-3 presets stay as-is)

---

## User Stories

- **As an owner of a cat with chronic GI issues**, I want to see vomiting frequency over the last 3 months as a chart, so I can tell the vet "it's gone from once a month to weekly" with evidence instead of a feeling.
- **As an owner whose cat just changed medication**, I want to watch grooming and activity in the weeks after the switch, so I can see whether they returned to Normal.
- **As a daily check-in user**, I want the data I log every morning to show up as a visible trend, so logging feels worthwhile.
- **As an owner who logs sporadically**, I want the chart to be honest about gaps, so I don't misread a line drawn across three unlogged weeks as "everything was Normal".
- **As an iOS user**, I want the same picture my partner sees on the web app.

---

## Scope: which types

The four behavior-tab types, all with 0-3 preset scales defined in `shared/lib/measurementPresets.ts`:

| Type | Scale (0→3) | Concern values |
|------|-------------|----------------|
| `grooming` | None / Less / Normal / Excessive | 0 **and** 3 (two-sided — both extremes are flagged `concern`) |
| `activity` | Lethargic / Low / Normal / Active | 0 |
| `vomiting` | None / Once / A few times / Many times | 2, 3 |
| `litter` | Not used / Straining / Loose-Diarrhea / Normal | 0, 1, 2 |

Food and water also use 0-3 presets, already have their own chart tabs (`MeasurementChart` on web), and are **in scope only for the rendering fix** (R2 applies to them; they get no new placement). Note: `BEHAVIOR_CHART_TYPES` in `shared/lib/constants.ts` includes a legacy `'play'` key that is not in `VALID_MEASUREMENT_TYPES` and has no presets — this PRD ignores it (cleanup noted in Open Question #5).

---

## Requirements

### R1: Chart Placement & Type Handling
- **Web**: the existing CatProfile **Behavior** chart tab gains charts above the history list — **small multiples**, one compact card per behavioral type that has data (matches the iOS layout that already exists). No new pill bar is needed: the Weight/Food/Water/Behavior/All chart-tab selector already exists on both platforms.
- **iOS**: the existing Behavior small multiples are upgraded in place (rendering, aggregation, trend line, empty states) — no navigation changes.
- Types with no data render nothing (no empty cards inside the multiples); if *no* behavioral type has ≥ 2 observation days, show the R4 empty state.

### R2: Ordinal-Correct Scale Chart (applies to behavior multiples AND the existing food/water charts)
- **Chart form: step-line with visible observation dots** (Recharts `type="stepAfter"` on web; equivalent step interpolation added to `app/components/LineChart.tsx` on iOS). The horizontal segment says "this was the state as of this observation"; the vertical jump says "the next observation was different." No `monotone`/linear glide between ordinal points — a numeric line between "Less" and "Normal" implies a false in-between value.
- Y-axis: fixed domain 0-3, ticks labeled with preset labels via `getPresetTicks(type)` (already used by web `MeasurementChart` and iOS `formatY`)
- X-axis: dates, adaptive tick formatting per range (existing `getLocaleTickFormatter` behavior)
- Dots: rendered at each daily aggregated value. Concern values (per the `concern` flag in `measurementPresets.ts`) use the warning palette **plus a non-color differentiator** (ring/larger radius) per PRD-accessibility.md — never color alone
- Tooltip: preset label (not the number), date, and — when the day had multiple raw entries — a count ("2 entries this day, showing most notable")

### R3: Daily Aggregation & Sparse Data
- **One plotted point per calendar day** (user-local day via `shared/lib/dates.ts` conventions). Raw entries remain untouched in history.
- **Aggregation rule: "most notable observation of the day"**, defined per type (the concerning direction differs by type, so a single min/max is wrong):

| Type | Daily reducer | Rationale |
|------|---------------|-----------|
| `food`, `water` | **min** | lower = worse (None is the concern) |
| `activity` | **min** | lower = worse |
| `litter` | **min** | lower = worse (0/1/2 all concerns, 3 Normal) |
| `vomiting` | **max** | higher = worse |
| `grooming` | **max distance from 2 (Normal)**; tie → the lower value | two-sided concern (0 None and 3 Excessive) |

  This surfaces the day's most clinically relevant observation instead of averaging it away (an average of "None" and "All" food is not "Most"). The table lives in a new shared module — proposed `shared/lib/behavioralTrends.ts` (`aggregateDaily(measurements, type)`) — so web and iOS cannot drift (resolves original Open Question #2).
- **Sparse data:** break the step line when the gap between consecutive observation days exceeds **14 days** — render disconnected segments rather than a line implying continuity across an unlogged month. Isolated single points render as dots only. A type needs ≥ 2 observation *days* to chart; below that, the type card is omitted.

### R4: Behavioral Trend Insight
- Below each type's chart, a one-line trend summary: "Vomiting has been increasing over the past 3 weeks", "Grooming is stable at Normal"
- Computed with the existing shared `detectTrend()` from `shared/lib/correlations.ts` (weekly buckets, first-half vs second-half average); requires ≥ 4 weekly buckets, otherwise show "Keep logging — N more weeks until trend detection" (mirrors the CorrelationChart sparse-data pattern)
- Copy generation lives in the shared module (`describeBehavioralTrend(type, trend, weeks)`), and is **strictly descriptive** — see Clinical Content Rule below

### R5: Empty State
- When no behavioral type has chartable data: "No behavioral observations yet. Log a check-in to start tracking." with a link/router push to the Daily Check-In screen (`/checkin` web; check-in flow on iOS)

### R6: Time Range & Navigation Reuse
- **Web**: one `ChartRangeSelector` + `useChartWindow` instance above the small multiples, driving a **shared window across all type cards** (comparing types requires aligned X axes); each card wrapped in `SwipeableChart` navigating the shared window. Default range: **3M** for the behavior tab (behavioral data is dense-daily, unlike weight; "All" turns multi-month step charts into noise) — confirm in Open Question #3.
- **iOS**: `useChartWindow` is currently web-only (`frontend/src/lib/useChartWindow.ts`) and iOS has no range selector. v1 iOS parity = rendering + aggregation + trend copy + empty states; the range selector/window is included **if** the hook is lifted to `shared/lib/` in this sprint — otherwise iOS keeps its current all-data view with the existing `FullScreenChartModal` expand. Decision in Open Question #4.

---

## Clinical Content Rule (MANDATORY — read before writing any copy)

Per CLAUDE.md and `docs/research/README.md`:

- The trend summaries in R4 are **descriptive statements about the user's own logged data** ("increasing over the past 3 weeks") — they carry no clinical claim and need no citation.
- **Any alert-like copy** tied to behavioral trends — thresholds ("vomiting more than once a week warrants a vet visit"), condition names, risk associations — **requires a Tier 1 citation documented in `docs/research/` first.**
- The behavioral indicator lists already have citations in **`docs/research/behavioral-indicators.md`** (e.g., AAFP Consensus on Chronic Vomiting for the >1/week vomiting threshold; ISFM Feline Stress Consensus and AAFP Pain Management Guidelines 2022 for grooming-change significance; AAFP FLUTD/FIC guidelines for litter signals). If a future iteration adds threshold-based callouts to these charts, it must reference those existing entries by name in code comments — and any *new* claim goes through the full sourcing process (primary source → research doc → inline comment → copy) before implementation.
- v1 as specced ships **zero new clinical claims**.

---

## Existing Infrastructure (updated 2026-07-02)

| Component | Location | Status |
|-----------|----------|--------|
| `MeasurementChart.tsx` | `frontend/src/components/` | Web food/water scale chart — Recharts `AreaChart` with `monotone` interpolation (**needs step-line fix per R2**); already uses `getPresetTicks` Y labels, `useChartWindow`, `ChartRangeSelector`, `SwipeableChart` |
| Web Behavior chart tab | `frontend/src/pages/CatProfile.tsx` | History list only — **no chart (R1 adds it)** |
| iOS Behavior charts | `app/app/cats/[id]/index.tsx` (~488-525) | Per-type small multiples exist — linear interpolation, no aggregation, no trend line (**upgrade per R2-R4**) |
| `LineChart.tsx` | `app/components/` | iOS chart primitive — needs a step-interpolation mode |
| `measurementPresets.ts` | `shared/lib/` | Preset labels, `concern` flags, `getPresetTicks` — single source of truth |
| `detectTrend()` | `shared/lib/correlations.ts` | Weekly-bucket trend detection (rising/falling/stable) — reused as-is |
| `useChartWindow` + `ChartRangeSelector` + `SwipeableChart` | `frontend/src/lib/`, `frontend/src/components/` | Web-only today; candidate for lifting `useChartWindow` to `shared/lib/` (R6 / OQ#4) |
| `shared/lib/behavioralTrends.ts` | — | **New**: `aggregateDaily`, gap-breaking helper, `describeBehavioralTrend` + tests |

No API or DB changes — this is a pure client feature over existing measurement data.

---

## Acceptance Criteria

- [ ] Web CatProfile Behavior tab shows a step-line chart card per behavioral type with data, above the history list
- [ ] All behavioral (and food/water) scale charts on both platforms render as step lines with dots — no interpolated values between ordinal points anywhere
- [ ] Y axes show preset labels ("Lethargic/Low/Normal/Active"), not 0-3 numbers; tooltips show labels
- [ ] Two same-day entries chart as one point following the per-type "most notable" table; tooltip discloses the count
- [ ] A >14-day logging gap renders as a visible break, not a connecting line
- [ ] Concern-value dots are distinguishable by more than color alone
- [ ] Each charted type shows a `detectTrend()`-based one-liner, or the "N more weeks" sparse-data message
- [ ] Empty behavior tab links to Daily Check-In
- [ ] Web range selector drives a shared window across the behavior multiples; swipe navigation works
- [ ] Aggregation, gap, and trend-copy logic lives in `shared/lib/behavioralTrends.ts` with unit tests (per-type reducers incl. grooming two-sided rule, gap edges, DST/day-boundary cases); `./scripts/check-shared-drift.sh` passes
- [ ] No new clinical claims in any copy; trend summaries are descriptive only

---

## Open Questions (for product owner)

1. **"Normal" range shading** (original OQ#3): shade the normal band per type (e.g., food Most-All)? It aids at-a-glance reading but is awkward for grooming, where Normal is a single interior value (2) flanked by concerns on both sides. Proposal: defer to v1.1; ship concern-colored dots only. Confirm.
2. **Aggregation transparency**: is "most notable of the day" acceptable, or should the tooltip list every raw entry for the day (morning "Some", evening "None") instead of just a count?
3. **Default range**: 3M default for the behavior tab (vs the app-wide "All" default)? Weight keeps "All".
4. **iOS range-selector parity**: lift `useChartWindow` to `shared/lib/` and build an iOS `ChartRangeSelector` in this sprint, or ship iOS v1 without range selection (current behavior) and fast-follow?
5. **Cleanup**: `BEHAVIOR_CHART_TYPES` contains a dead `'play'` key (`shared/lib/constants.ts:39`) that isn't a valid measurement type — remove it as part of this work, or leave for a housekeeping pass?
6. **Small multiples vs single chart with sub-selector on web**: small multiples proposed for iOS parity and cross-type scanning; a single taller chart with a type sub-selector would give each type more vertical room at 375px. Preference?

---

*Last updated: 2026-07-02*
