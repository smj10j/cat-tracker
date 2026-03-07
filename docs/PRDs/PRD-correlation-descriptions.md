# PRD: Fix Correlation Description Logic

## Problem

`describeCorrelation` uses the sign of the Pearson `r` coefficient to decide whether the outcome variable "rises" or "drops." This is wrong.

A positive `r` means typeA and typeB move **in the same direction** — but that direction could be both going up, or both going down. Using `r > 0 → 'rises'` incorrectly describes a scenario where both variables are declining (positive r because they're correlated, but both trending down).

### Example of the bug
If vomiting frequency and weight are both trending downward over time, they'd have a positive correlation (r > 0). The current code would say "weight tends to rise when vomiting increases" — the exact opposite of what's happening.

## Root Cause

The description logic conflates **correlation direction** (which variable leads/lags) with **trend direction** (whether each variable is going up or down). These are independent.

`r` tells you: "when typeA goes up, does typeB tend to go up or down?" It says nothing about the actual trend direction of either series.

## Fix

Add actual trend detection to each series. Compute a simple slope from the weekly-bucketed data: compare the mean of the first half of observations vs. the second half. This gives a stable, outlier-resistant trend signal.

### New fields on CorrelationResult

```ts
interface CorrelationResult {
  // ... existing fields ...
  typeATrend: 'up' | 'down' | 'stable'  // trend direction of typeA over the full window
  typeBTrend: 'up' | 'down' | 'stable'  // trend direction of typeB over the full window
}
```

### Trend computation

```ts
function detectTrend(buckets: WeeklyBucket[]): 'up' | 'down' | 'stable' {
  if (buckets.length < 4) return 'stable'
  const mid = Math.floor(buckets.length / 2)
  const firstHalf = buckets.slice(0, mid).map(b => b.value)
  const secondHalf = buckets.slice(mid).map(b => b.value)
  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
  const changePct = Math.abs(avgSecond - avgFirst) / (avgFirst || 1)
  if (changePct < 0.04) return 'stable'  // less than 4% change = stable
  return avgSecond > avgFirst ? 'up' : 'down'
}
```

### Updated description logic

Use `typeBTrend` to describe what the outcome variable is actually doing:

```
"food intake is declining, and weight is following — down about 3% over the past 6 weeks"
```

vs. the current:

```
"when food intake changes, weight tends to rise"  ← may be wrong
```

Key cases to handle:

1. **Both declining (positive r, both down)**: "As [typeA] has declined, [typeB] has followed — both trending down over the past [N] weeks."

2. **typeA up, typeB down (negative r)**: "When [typeA] increases, [typeB] tends to drop — a pattern worth watching."

3. **Lag > 0, typeA already changed**: "Recent changes in [typeA] suggest [typeB] may [rise/fall] in the coming weeks based on past patterns."

4. **Hyperthyroidism pattern**: unchanged — specific clinical description.

5. **Stable typeB**: "Changes in [typeA] haven't clearly moved [typeB] yet, but the two have tracked together historically."

## Affected Code

- `frontend/src/lib/correlations.ts` — `detectCorrelations`, `describeCorrelation`
- `frontend/src/components/InsightsPanel.tsx` — "Patterns detected" section uses `describeCorrelation`
- `frontend/src/components/CorrelationChart.tsx` — insight text below chart uses `describeCorrelation`
- `frontend/src/pages/CatExportPage.tsx` — "Observed patterns" section

## Out of Scope

- The correlation math (`lagCorrelation`, Pearson) is correct — only the prose generation is broken
- `getHomeBadge` (home page badge) is also affected but lower priority; fix in the same pass
- No UI changes needed — the fix is pure logic in `correlations.ts`

## Success Criteria

- "Vomiting is increasing, weight is declining" → description says weight is *declining*, not rising
- "Both food and weight are trending down" → description says both are declining, not that weight "rises"
- The generated prose reads naturally and reflects what the data actually shows
