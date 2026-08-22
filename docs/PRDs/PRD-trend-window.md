# PRD: Trend Evaluation Window — Stale Alerts After a Resolved Loss

| | |
|---|---|
| **Status** | `Approved` |
| **Created** | 2026-08-21 |
| **Author** | AI research (owner-reported bug) |

---

## Problem

A cat (Luna) declined from 9.0 lb to 8.25 lb and has since held 8.25 lb for three months —
thirteen consecutive weekly weigh-ins, no meaningful variation. The app renders a persistent
`concerning` alert reading *"Lost 8.3% from recent weight. Clinically significant — worth
discussing with your vet."* and, in other states, quotes a weekly loss percentage as though the
loss were ongoing.

This is wrong in a way that matters. The alert is not describing anything happening to the cat
now; it is describing something that finished three months ago. An alert that cannot clear itself
when the underlying condition resolves is indistinguishable from a broken alert, and it trains the
owner to ignore the alert system — the exact failure mode
[PRD-weight-alert-sensitivity.md](PRD-weight-alert-sensitivity.md) was written to prevent.

Reproduced against the shipped algorithm with a synthetic series matching Luna's shape:

```
status=concerning  referencePeak=9.0  peakLossPct=8.3%  nonOkPeriods=0
summary: "Lost 8.3% from recent weight. Clinically significant — worth discussing with your vet."
```

`nonOkPeriods=0` is the tell: **every** measurement-to-measurement period is classified `ok`. The
rate engine correctly reports a stable cat. The alert comes entirely from the cumulative
loss-from-peak branch.

Running the same shape with the decline ending seven months ago instead of three yields
`status=ok`. The alert therefore clears on a **180-day calendar timer** — when the pre-decline
measurements age out of the `referencePeak` window — and not in response to any health signal.

---

## Root Cause Analysis

Three independent defects, all in `shared/lib/healthMetrics.ts`.

### 1. Rate-based escalation has no recency bound

The consecutive-period loop that sets `overallStatus` iterates over the entire `periods` array
with no reference to when those periods occurred. Two consecutive non-ok periods in the same
direction escalate the assessment permanently — a cat that had a genuine two-week decline a year
ago and fully recovered still reports `urgent` today.

### 2. The cumulative loss-from-peak branch is applied unconditionally

By explicit design. `docs/research/weight-thresholds.md` stated the rationale:

> The cumulative peak-loss thresholds (4% → watch, 7% → concerning, 10% → urgent) are applied
> unconditionally, as cumulative loss from baseline *is* a trend signal by definition — it already
> accounts for the full history.

The premise is false. A cumulative loss that has **stopped** is a completed episode, not a trend.
The rate branch is protected by the consecutive-period requirement; the cumulative branch has no
equivalent gate, and no test anywhere asks whether the loss is still in progress.

### 3. Summary text quotes a stale, unfiltered worst period

`buildSummary` selects `worstPeriod` as the maximum `|changePerWeek|` across all history, and does
**not** filter to non-ok periods. In the reproduction this produced *"Mild weight loss trend
detected (1.8%/week)"* sourced from a period seven weeks old that the classifier had itself scored
`ok`. The same unfiltered, unbounded selection is used by `assessmentDirection` in `alertAck.ts`
to decide an acknowledgment's direction.

### Same bug class outside weight

`detectTrend` in `shared/lib/correlations.ts` splits *all* weekly buckets in half and compares the
means. A metric that shifted a year ago and has been flat since reports `up`/`down` forever. This
feeds the confluence `CLUSTERS`, including the kidney/thyroid/diabetes cluster alert.

---

## Proposed Solution

Full calibration detail and rationale live in
[`docs/research/weight-thresholds.md`](../research/weight-thresholds.md) §"Trend evaluation window
and loss-episode stabilization". Summary:

### A. Trend evaluation window (`trendWindowDays`, default 90)

Rate-based escalation only considers periods whose end measurement falls within `trendWindowDays`
of the most recent measurement. Anchored to the last measurement, not wall-clock `now`. Both
periods of a consecutive pair must be in-window to escalate.

### B. Loss-episode stabilization gate

An ordinary-least-squares fit of weight against time over the windowed measurements. The episode
is **stabilized** when the fitted total change across the observed span is smaller than the
existing 1.5% noise floor in the downward direction.

Runs only with ≥4 measurements spanning ≥56 days in the window. Below that, the gate does not run
and current behaviour is preserved exactly — the fail-safe direction.

When stabilized:

| Cumulative loss | Not stabilized | Stabilized |
|---|---|---|
| ≥ 10% | `urgent` | **`watch`** (demoted, never cleared) |
| 7–10% | `concerning` | no contribution |
| 4–7% | `watch` | no contribution |

The ≥10% case is deliberately not cleared — see the research doc for the clinical reasoning.
Suppression applies to *severity escalation only*; the loss is still stated in the summary and in
the vet export.

### C. Windowed, non-ok worst-period selection

`buildSummary` and `assessmentDirection` both select from periods that are non-ok **and**
in-window. Summaries fall back to cumulative-loss phrasing when no such period exists, instead of
quoting `0.0%/week` or a stale rate.

### D. New assessment surface

`HealthAssessment` gains `lossStabilized`, `recentSlopePctPerWeek`, and `trendWindowDays`;
`PeriodHealth` gains `withinTrendWindow`. Clients use `lossStabilized` to render a
"stable since the earlier decline" state rather than silently dropping the history.

### E. `detectTrend` windowing

`detectTrend` accepts a `windowWeeks` bound (default 26) and filters buckets to that window before
splitting. If fewer than 4 buckets remain, it falls back to the full series — preserving current
behaviour for sparse data rather than regressing toward under-alerting.

### F. Profile chart default range → 6 months

Independent owner request, shipped alongside: the cat profile chart defaults to the last 6 months
of data, or the full record when that is shorter. Web keeps its existing range selector, so "All"
remains one tap away.

---

## Non-Goals

- **Shortening `referencePeakWindowDays` from 180.** Would move the false positive to a 90-day
  timer rather than fix it, and would degrade genuine slow-decline detection.
- **Changing any clinical threshold.** The 0.75/1.5/2%/week rate thresholds, the 4/7/10%
  cumulative thresholds, and the 1.5%/0.2 lb noise floor are unchanged.
- **Suppressing anything in the vet export.** The export always shows the full picture.

---

## Success Criteria

1. Luna's shape (decline, then ≥8 weeks flat) reports `ok` with the loss retained as context.
2. The "Oscar scenario" regression test — a real ~0.5%/week multi-month decline — still alerts.
3. A cat with a ≥10% loss that has since plateaued reports `watch`, not `ok` and not `urgent`.
4. Sparse-data cats (<4 measurements or <56-day span in-window) behave exactly as before.
5. No summary quotes a `%/week` figure from a period the classifier scored `ok`.
6. A stale non-ok period pair outside the trend window no longer escalates `overallStatus`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Suppressing a genuine slow decline | Gate requires the fitted trend to be flatter than the noise floor; ~0.5%/week declines are unaffected. Documented known limitation for sub-noise-floor declines. |
| Sparse-data cats losing alerts | Gate requires ≥4 measurements and ≥56-day span; otherwise it does not run at all. |
| A severe historical loss disappearing | ≥10% demotes to `watch` rather than clearing; summary and vet export always retain the loss. |
| `detectTrend` windowing weakening cluster alerts | Falls back to the full bucket series when the window holds <4 buckets. |
