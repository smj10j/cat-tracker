# PRD: Weight Alert Sensitivity Review

| | |
|---|---|
| **Status** | `Implemented` |
| **Created** | 2026-04-10 |
| **Implemented** | 2026-04-11 |
| **Author** | AI research |

---

## Problem

Cat owners using this app report that all their cats are showing health alert states (watch / concerning) after losing approximately 2.5% of their weight. The alerts feel disproportionate — the cats are healthy, the weight variation is subtle, and the persistent alarm state is eroding trust in the system.

A health tracking app that cries wolf trains owners to ignore alerts. If every cat is always in a watch or concerning state, the system loses the ability to signal genuine emergencies — including the kind that prompted the creation of this app in the first place.

**The most likely immediate cause** is the peak-weight ratchet: the algorithm compares every measurement against the all-time highest recorded weight. Even a cat who is completely stable today will show an alert if they weigh less than their historical maximum — even if that maximum was months ago, during a different season, after a period of overfeeding, or was caused by a single mis-entered measurement. A 2.5% total decline from that high-water mark triggers a `watch` state. This does not reflect the clinical evidence, which defines significant loss against the cat's *established healthy weight*, not their historical maximum.

The rate-calculation problems are secondary but real: annualizing %/week from short measurement intervals amplifies normal scale variation into clinically significant-looking numbers, and there is no noise floor to filter out changes smaller than what a consumer scale can reliably measure.

This PRD analyzes all three root causes, reviews what the clinical evidence actually supports, and proposes algorithm changes that preserve clinical accuracy while eliminating noise-driven false positives.

---

## Root Cause Analysis

The current algorithm has three structural issues that combine to produce over-sensitive alerts for healthy cats.

### 1. The Rate Extrapolation Problem

The `classifyRate()` function annualizes the weight change between any two consecutive measurements to a %/week figure, then applies clinical thresholds designed for *sustained* weekly trends. This works correctly for weekly measurements — but breaks badly for short or long intervals.

**Example: a healthy 10 lb cat measured every 3–4 days**

| Interval | Weight change | Rate (%/wk) | Alert |
|----------|---------------|-------------|-------|
| 3 days | −0.15 lbs (−1.5%) | −3.5%/wk | 🚨 urgent |
| 5 days | −0.15 lbs (−1.5%) | −2.1%/wk | 🚨 urgent |
| 7 days | −0.15 lbs (−1.5%) | −1.5%/wk | ⚠️ concerning |
| 14 days | −0.15 lbs (−1.5%) | −0.75%/wk | 👀 watch |

The weight change is identical in all four cases. The alert level is determined almost entirely by the measurement interval, not the cat's health. A cat weighed on Monday and Thursday shows a dramatically worse alert than the same cat weighed on Monday and the following Monday.

**The clinical mismatch:** AAFP and WSAVA weight loss guidelines describe *sustained* loss rates over multiple weeks — not single-interval drops. The 1–2%/week "concerning" threshold describes a cat who is consistently losing weight week after week, not one that shows a 1.5% drop between two adjacent measurements.

### 2. The Noise Floor Problem

Consumer kitchen scales have typical accuracy of ±0.1–0.2 lbs. Cats vary in weight throughout the day based on hydration, recent meals, bladder fullness, and time since last grooming. This creates inherent measurement variation of approximately 1–3% on a typical adult cat.

**Example: a stable 10 lb cat with normal daily variation**

- Measured at 10.0 lbs on Day 1 (before breakfast)
- Measured at 9.8 lbs on Day 8 (after a light-eating day)
- Change: −0.2 lbs = −2.0% over 7 days = −2.0%/wk → 🚨 **urgent**

The cat is perfectly healthy. The variation is within normal biological and measurement noise. The alert is clinically meaningless — and the owner now has a 🚨 on their cat.

There is currently no minimum absolute change required before the rate calculation triggers. Any non-zero measurement delta — including scale rounding — flows through to the classification function.

### 3. The Peak-Weight Ratchet Problem

The `peakWeight` value is the **all-time highest recorded weight**, and `peakLossPct` compares the latest measurement against it. This ratchet never resets.

This creates two distinct false-alarm patterns:

**A. Intentional weight loss looks like illness.** A cat who was overweight at 14 lbs and is now a healthy 12.5 lbs (−10.7% from peak) permanently reads as `urgent`, even years after reaching a stable healthy weight. The 10%-from-peak threshold correctly describes *recent, unexplained* loss — not a cat who successfully lost weight under veterinary guidance.

**B. Measurement outliers lock in permanently.** If one measurement is accidentally entered too high (fat paws on the scale, the owner's thumb on the button), that becomes the permanent peak reference and every future measurement looks like a loss from that phantom high.

The peak-loss thresholds are clinically sound for their intended purpose — detecting significant unexplained weight loss from a cat's established healthy weight. But comparing against an all-time maximum fails that intent.

---

## What the Clinical Evidence Actually Says

The thresholds currently implemented are cited correctly — the *values* (2%/week urgent, 1–2%/week concerning, 0.5–1%/week watch; 10% from established weight urgent) reflect genuine veterinary guidance. The problem is not the thresholds; it is how they are applied.

Key observations from the cited sources:

**AAFP Nutritional Guidelines / WSAVA Weight Management Guidelines:**
These guidelines discuss weight loss rates in the context of *intentional weight management programs* evaluated over multiple weeks, and *unexplained weight loss* presenting at a veterinary visit where the vet is comparing against the cat's known healthy baseline — not against two consecutive home measurements.

**Armstrong & Blanchard, VCNA 2009 (hepatic lipidosis):**
The 2%/week threshold for hepatic lipidosis risk describes cats who are *anorectic* or *severely food-restricted* — cats where the clinical picture includes not eating. It is not derived from weight measurement alone.

**Merck Veterinary Manual / JVIM (10% from healthy weight = significant):**
The 10% threshold refers to loss from the cat's *established healthy weight*, not their historical maximum. A cat who was obese and successfully reduced to a healthy weight has not lost 10% in a clinically meaningful sense.

**What the evidence supports that the algorithm should preserve:**
- Sustained loss of ≥1%/week over multiple weeks is a meaningful clinical signal
- Total loss of ≥10% from the cat's established healthy weight warrants veterinary evaluation
- Rapid loss in a short window (the spirit of the 2%/week threshold) is always significant

**What the algorithm currently does that the evidence does not support:**
- Applying weekly-rate thresholds to sub-weekly measurement intervals
- Triggering on single-observation changes without trend confirmation
- Ignoring measurement noise (scale precision and biological variation)
- Using all-time maximum rather than stable recent baseline as the peak reference

---

## Proposed Algorithm Changes

Three changes are recommended. They are labeled as either *evidence-backed* (directly supported by clinical guidance) or *engineering heuristic* (noise-reduction decisions not specified by the guidelines but consistent with their intent).

### Change 1: Minimum Interval Gate (Engineering Heuristic)

**Rule:** Do not apply the %/week rate calculation to measurement intervals shorter than 5 days. Short-interval periods are still recorded in history but marked `skipped: true` on the `PeriodHealth` object and do not contribute to `overallStatus`.

**Rationale:** The clinical thresholds were developed in the context of weekly weigh-ins. Extrapolating to %/week from a 2-day or 3-day interval amplifies noise by a factor of 3–4× and produces alerts that the underlying evidence does not support.

**What this preserves:** Measurements taken 5+ days apart continue to behave exactly as before.

**Implementation:** In the period loop in `assessHealth()`, after computing `days`, check `if (days < 5)`. If so, push `{ ...periodBase, skipped: true, status: 'ok' }` and `continue` — do not call `classifyRate()` and do not factor this period into `overallStatus`. The `PeriodHealth` interface gains a `skipped: boolean` field (defaults to `false` for normal periods).

**History UI display for skipped periods:** Show the lb delta and absolute % change as usual but omit the rate badge and status emoji. Replace with a small `ink-dim` label: *"Measured soon after previous"* — warm and informational, not technical. Do not say "Too close to previous" (sounds like a system error) or "Skipped" (sounds like the data was rejected).

**Chart dot display for skipped periods:** The WeightChart shows health status emoji on data points (✅ 👀 ⚠️ 🚨). For skipped periods, show no emoji on the dot — use the plain colored circle default. Do not show ✅ ("stable") because the point wasn't assessed; silence is more honest than a false affirmative.

---

### Change 2: Relative Noise Floor (Engineering Heuristic)

**Rule:** Require a minimum weight change of **0.5% of the previous measurement** (relative floor) before classifying a rate as `watch` or above. Changes smaller than this are treated as stable regardless of the computed rate.

**On a 10 lb cat:** 0.5% = 0.05 lbs — within scale precision, no alert.
**On a 4.5 kg cat:** 0.5% = 0.0225 kg — same logic applies.

**No separate absolute floor.** An earlier draft proposed a 0.1 lb absolute floor, but this is not unit-safe: 0.1 lb ≈ 0.045 kg which is only 1% of a 4.5 kg cat — an order of magnitude different from the same threshold applied in lbs. The relative-only floor (0.5%) is dimensionless and correct for both lbs and kg measurements.

**Rationale:** The biological and measurement variation inherent in home weighing is approximately 1–3%. A 0.5% relative floor prevents the lowest tier of noise from triggering alerts while still catching meaningful changes (e.g., 0.3 lbs on a 10 lb cat = 3%, above the floor and worth watching).

**Implementation:** This check belongs in `assessHealth()`, not in `classifyRate()`, because `assessHealth()` has access to both `lbsChange` and `prev.value`. Add before the `classifyRate()` call:

```typescript
const absChangePct = Math.abs(lbsChange) / prev.value  // both in the same unit
if (absChangePct < 0.005) {
  periods.push({ ...computed, status: 'ok' })
  continue
}
```

`classifyRate()` signature remains `(changePerWeek: number): HealthStatus` — no change. This keeps it a pure, easily testable function.

---

### Change 3: Robust Peak Reference (Evidence-Backed)

**Rule:** Replace `peakWeight` (all-time maximum) with the **90th-percentile weight of measurements in the most recent 180 days** as the baseline for peak-loss calculations. Fall back to `peakWeight` (all-time max) only if fewer than 8 measurements exist within that window.

**Rationale:** The clinical evidence for 10%-from-peak describes loss from the cat's *established healthy weight*, not their historical maximum. A recent 90th-percentile reference:
- Excludes old outlier measurements from the reference weight
- Adjusts for a cat who successfully lost weight (the reference drifts down with them)
- Is robust to a single mistaken high measurement (90th percentile is insensitive to one high outlier when N ≥ 8)

**What this changes:** A cat who was 14 lbs, reduced to 12.5 lbs over a year, and has been stable there for 6 months will have `referencePeak ≈ 12.5` (the 90th percentile of recent measurements), not 14. Their `peakLossPct` will be near zero.

**What this preserves:** A cat actively losing weight will have a 90th-percentile reference near the top of recent measurements — which is where they started. Sudden drops still trigger the thresholds correctly.

**Exact percentile algorithm (nearest-rank, ascending sort):**
```typescript
function percentile90(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  // nearest-rank: index = ceil(N * 0.90) - 1
  const idx = Math.ceil(sorted.length * 0.9) - 1
  return sorted[Math.max(0, idx)]!
}
```
For N=8: idx = ceil(7.2)-1 = 7 (last element = max). For N=10: idx = ceil(9)-1 = 8 (2nd-highest). For N=20: idx = ceil(18)-1 = 17 (3rd-highest). This correctly excludes the top 10% of values as potential outliers.

**Implementation:** In `assessHealth()`, after sorting measurements, compute:
```typescript
const cutoff = new Date(sorted[sorted.length - 1]!.measured_at)
cutoff.setDate(cutoff.getDate() - 180)
const recentValues = sorted
  .filter(m => new Date(m.measured_at) >= cutoff)
  .map(m => m.value)
const referencePeak = recentValues.length >= 8
  ? percentile90(recentValues)
  : peakWeight  // fallback to all-time max
```
Use `referencePeak` (not `peakWeight`) for the `peakLossPct` calculation. Expose `referencePeak` on `HealthAssessment` for display purposes.

**Vet export and InsightsPanel display:** Use `referencePeak` as the primary figure in all UI copy ("X% below recent baseline"). The vet export methodology section should note that the reference is the 90th-percentile of recent measurements, not the all-time maximum, and include the all-time peak weight as a secondary data point for veterinarian reference.

---

### Recommended Approach

Implement all three changes. They address different failure modes and do not conflict:

- Change 1 eliminates the interval-amplification problem
- Change 2 eliminates the noise-floor problem
- Change 3 fixes the peak-weight ratchet (the primary cause of the reported false positives)

Together they make the algorithm behave the way the clinical evidence intends: flagging sustained, meaningful weight changes against a stable recent baseline — not reacting to measurement noise or short-interval variation.

**Verifying real alerts still work:** A cat genuinely declining at 0.6%/week for 8 consecutive weeks (4.8% total from recent baseline) will still correctly read `watch`. Here's the trace: each weekly measurement is ≥7 days apart (passes interval gate), the 0.6% weekly change is above the 0.5% noise floor (passes noise floor), `classifyRate(0.6)` returns `watch`, and `peakLossPct` against the 90th-percentile reference shows ~4.8% (triggers `watch` from the peak-loss tier). The alert fires. This is the behavior we want — the changes reduce false positives, not true positives.

---

## What Should NOT Change

- The rate thresholds themselves: 2%/week urgent, 1–2%/week concerning, 0.5–1%/week watch. These are evidence-backed.
- The peak-loss tier structure: 10% urgent, 7–10% concerning, 4–7% watch. These are evidence-backed.
- The gain-side thresholds: 3%/week concerning, 1.5–3%/week watch.
- The `classifyRate` and `worstStatus` functions' overall shape.

The goal is to make the algorithm apply the existing thresholds more accurately — not to lower them.

---

## Implementation Scope

### Changes to `frontend/src/lib/healthMetrics.ts`

1. **`PeriodHealth` interface**: Add `skipped: boolean` (defaults to `false`).
2. **`HealthAssessment` interface**: Add `referencePeak: number` (the 90th-percentile reference; equals `peakWeight` when fallback is used).
3. **`assessHealth()`**: 
   - Add the `percentile90()` helper and `referencePeak` calculation.
   - Add the interval gate check (`days < 5 → push skipped period, continue`).
   - Add the relative noise floor check (`absChangePct < 0.005 → push ok period, continue`) before calling `classifyRate()`.
   - Use `referencePeak` (not `peakWeight`) for the `peakLossPct` comparison against the tier thresholds.
4. **`classifyRate()`**: **No signature change.** Remains `(changePerWeek: number): HealthStatus`. All new pre-checks live in `assessHealth()`.
5. **`buildSummary()`**: 
   - Filter `periods` to exclude `skipped: true` entries before finding `worstPeriod` — otherwise a skipped period's `changePerWeek` could be picked as worst.
   - Update urgent/concerning peak-loss copy to reference "recent baseline weight" rather than "peak body weight".

**Existing test impact:** Changing the internal logic of `assessHealth()` while keeping `classifyRate()`'s signature unchanged means most existing unit tests on `classifyRate()` need no changes. Tests on `assessHealth()` that check `peakLossPct` or `overallStatus` for scenarios involving all-time peaks may need updating to match the new `referencePeak` logic. Review all existing healthMetrics tests before submitting.

### Changes to `docs/research/weight-thresholds.md`

Add a section documenting:
- The noise floor heuristic (0.5% minimum absolute change) as an engineering decision, not a clinical guideline
- The minimum interval gate (5-day minimum) as an engineering decision
- The 90th-percentile reference peak as a methodological choice consistent with the intent of cited guidelines
- The distinction between "any two measurements" and "sustained trend" in the original source materials

### Changes to `CatExportPage.tsx` (vet export methodology section)

The vet export has a Methodology section (added in PRD-evidence-base.md) that cites the sources behind each threshold. After this change, the peak-loss description must be updated to explain that the reference is the 90th-percentile of recent measurements, not the all-time maximum, and include the all-time peak as a secondary figure. Example: *"Weight loss is assessed against the cat's established baseline, defined as the 90th percentile of weight measurements in the preceding 6 months (all-time peak: X lbs shown as reference)."*

### Changes to InsightsPanel summary copy

The alert summary in InsightsPanel currently says things like "Lost X.X% of peak body weight." After this change, use "recent baseline weight" or just "her recent weight" (with pronoun from `catSex`). Examples aligned with the app's design voice:
- Watch (peak loss): *"Gemini is 5% below her recent weight. Worth keeping an eye on."*
- Concerning (peak loss): *"Gemini has lost 8% from her recent weight. Worth a chat with your vet."*
- Urgent (peak loss): *"Gemini has lost 11% from her recent weight. A vet visit is recommended."*

Do not say "recent baseline weight" in owner-facing copy — it's too clinical. "Recent weight" is sufficient and warmer.

### Ripple effect: CompareChart and CatExportPage

Both `CompareChart.tsx` and `CatExportPage.tsx` call `assessHealth()` — they will automatically reflect the new algorithm with no code changes required. The status emoji displayed on CompareChart data points will update to match the corrected assessments. This is expected and correct behavior; no additional work is needed for these components.

### Test Cases

The following cases should be added to `frontend/src/__tests__/lib/healthMetrics.test.ts`. Use noon-UTC timestamps to avoid timezone edge cases (per existing test conventions in MEMORY.md).

| Scenario | Input | Expected | Mechanism |
|----------|-------|----------|-----------|
| Noise floor: tiny change over 7 days | 10.0 → 9.97 lbs, 7 days (0.3% change) | `ok` | Relative floor: 0.3% < 0.5% |
| Noise floor: borderline change | 10.0 → 9.9 lbs, 7 days (1.0% = 1.0%/wk) | `watch` | 1.0% > 0.5% floor; passes through |
| Interval gate: 2-day measurement | 10.0 → 9.6 lbs, 2 days | `ok` + `skipped: true` | 2 days < 5-day gate |
| Interval gate: 5-day measurement | 10.0 → 9.6 lbs, 5 days (5.6%/wk) | `urgent` | 5 days = gate threshold; gate does NOT apply |
| Genuine concerning rate | 10.0 → 9.55 lbs, 21 days (1.5%/wk) | `concerning` | Passes gate (21d), passes floor (4.5%), classifyRate |
| Genuine urgent rate | 10.0 → 9.0 lbs, 14 days (5.0%/wk) | `urgent` | All checks pass, genuine signal |
| Robust peak: intentional diet | measurements: 14.0 lbs 200d ago, then 12.5 lbs stable for 6mo (N≥8) | `peakLossPct ≈ 0`, status `ok` | referencePeak ≈ 12.5, not 14 |
| Robust peak: outlier high measurement | one measurement at 12.0 lbs >180d ago, then 10.0 stable (N≥8) | `peakLossPct ≈ 0`, status `ok` | outlier excluded from 180-day window |
| Robust peak: fallback for sparse data | only 5 measurements in 180 days | fallback to `peakWeight` (all-time max) | N < 8 triggers fallback |
| Genuine peak loss (no false positive) | 10.0 lbs stable for 6mo, then drops to 8.5 lbs | `peakLossPct ≈ 15%`, status `urgent` | referencePeak ≈ 10.0, loss is real |
| kg unit: noise floor is relative | 4.5 kg → 4.47 kg, 7 days (0.67% change, 0.67%/wk) | `watch` | 0.67% > 0.5% floor; no lb-specific floor to break kg |
| Skipped periods excluded from worst-period | two periods: [skipped, genuine concerning] | `worstPeriod` = the genuine one | buildSummary filters `skipped: true` |

**Note on the original triggering scenario:** If all cats in a household lost ~2.5% of their weight and are in alarm state, the most likely cause is the peak-weight ratchet (Change 3), not the rate calculation — because 2.5% total loss from a stable baseline is below the 4% watch threshold. If their rates were alarming too, they were weighed very frequently (short intervals amplified by Change 1). The test suite should include a realistic household scenario: cat weighed weekly for 3 months, gradual 3% total decline — confirming this reads `watch` after the fix and not `concerning` or `urgent`.

---

## Open Questions

1. **Minimum interval gate value**: 5 days is chosen. 7 days (matching the clinical weekly reference interval) is arguably more correct, but would suppress rate alerts for twice-weekly weighers even when their trends are genuine. 5 days is the pragmatic middle ground — revisit if complaints arise from frequent weighers.

2. **Noise floor percentage**: 0.5% is chosen. Validation against actual data would strengthen this — if the typical measurement-to-measurement variation is higher than 1%, the floor may need to increase to 1%. Track false-positive reports after deployment.

3. **The 90th percentile fallback threshold**: Resolved at 8 measurements (updated from an earlier draft's 5). Fewer than 8 measurements in 180 days is sparse enough that the percentile estimate is unreliable.

4. **Display impact — RESOLVED**: Use `referencePeak` (labeled "recent baseline weight") as the primary figure in InsightsPanel and the vet export. Include the all-time `peakWeight` in the vet export methodology section as a secondary data point for veterinarians who want the raw maximum. Do not change the InsightsPanel summary copy to show both — it would be confusing to owners.

5. **Trend confirmation**: Requiring 2 of the last 3 periods to show decline was considered and deferred. If the three changes above do not sufficiently reduce false positives in practice, this should be the next lever to pull — it would require no changes to the clinical thresholds, only to the `overallStatus` aggregation logic.

---

## Deployment Note

When this change ships, existing users will see their cats' alert status change — potentially from `concerning` to `ok` overnight. This could feel like the app broke or became less accurate. No in-app notification is needed, but:

- The commit message should clearly describe the behavioral change ("Reduce false-positive weight alerts: interval gate, noise floor, 90th-percentile peak reference")
- If there is ever a "what's new" or changelog surface in the app, this warrants a mention: *"Weight alerts are now calibrated against your cat's recent weight rather than their all-time high — reducing false alarms for healthy cats while keeping real alerts intact."*
- Owners who were genuinely relying on the old alerts (e.g., monitoring a cat on a weight loss program) will see their alerts go away. This is correct — the new algorithm will re-trigger if the loss is sustained and measured at appropriate intervals.

## Success Metrics

- **Reduction in false-positive alert rate**: Healthy cats with normal weight variation should show `ok` status after these changes. If >50% of cats with no vet-confirmed health issues are in a non-ok state, the thresholds are still too sensitive.
- **Preservation of true positives**: Cats with documented significant weight loss (vet-confirmed illness, intentional diet programs exceeding 1%/week) should still trigger the appropriate alert tier.
- **Owner trust**: Qualitative — owners should feel the alerts are meaningful and actionable, not background noise. An alert they act on is a success; an alert they dismiss is a failure.
- **No regression complaints**: After deployment, no users should report that a genuinely sick cat's alert was suppressed. Monitor support feedback for 2 weeks post-launch.

---

*This PRD was prompted by Gemini's household, where all cats registered alert states despite being healthy. The irony of a cat health tracker that trained its owners to ignore alerts was not lost on us.*
