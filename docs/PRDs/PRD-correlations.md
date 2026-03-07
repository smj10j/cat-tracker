# PRD: Measurement Correlations

**Status:** Draft
**Priority:** P4 (from PRD-killer-app.md)
**Depends on:** Nothing (all data is already in D1; correlations are purely frontend)

---

## Background

Users currently log multiple measurement types independently — weight, food intake, water intake, grooming, activity, vomiting, and litter box usage. These measurements exist in silos: there's no view that shows how behavioral changes relate to physical changes over time.

The core insight this feature unlocks: **a cat's behavior almost always changes before their weight does**. A cat that's eating less this week will probably weigh less in two weeks. A cat that stops grooming is often in pain or distress. Surfacing these connections gives a user actionable early signals, not just historical record-keeping.

---

## Goals

1. Show users how different measurement types move together over time for a single cat
2. Highlight patterns that commonly predict health changes (e.g., food drop → weight drop)
3. Make the insight feel personal and specific to each cat, not generic

---

## Non-Goals

- Cross-cat correlations (comparing cats to each other)
- Statistical significance thresholds or p-values (too clinical for this app)
- Machine learning or AI inference (rule-based pattern matching is sufficient for v1)
- Predictions / forecasts (we show historical correlation, not future projection)

---

## User Stories

**As a cat owner**, I want to see if there's a connection between how much my cat is eating and their recent weight changes, so I can catch problems earlier.

**As a shelter worker**, I want to know if a cat's grooming drop is correlated with reduced food intake, so I can flag it for a vet check before it becomes an emergency.

---

## Feature: Correlation Timeline (cat profile)

### Where it lives

A new tab on the cat profile page: **Trends** — placed after the existing tabs (Weight / Food / Water / Behavior / All).

### What it shows

A dual-axis or stacked chart showing two measurement types over the same time period, side by side. The user can select which two types to compare.

**Layout sketch:**
```
[ Weight ] vs [ Food ]   ← two dropdowns

|     weight (lbs)        food (scale)
| 10 ──────────────────╮  ● Most
|  9      ╭─────       │  ○ Some
|  8  ╭───╯     ╰──    │  ○ None
+-----|-------|-------|--
    Jan     Feb     Mar
```

Correlation note below the chart:
> "Luna's food intake dropped in late January — her weight followed about 2 weeks later."

Or for no strong pattern:
> "No strong pattern detected yet. Keep logging to see trends over time."

### Correlation Detection Logic (frontend)

For each pair of measurement types, compute a **lagged correlation** over the available data window:

1. **Align measurements to weekly buckets** — average (or take last) value per week per type
2. **Normalize** each series to 0–1 range so they can be overlaid on the same visual scale
3. **Compute lag-0 through lag-4 week correlation** — find the lag at which the two series are most correlated
4. **Classify** the correlation:
   - |r| < 0.3 → no pattern
   - 0.3 ≤ |r| < 0.6 → weak pattern (show, but muted)
   - |r| ≥ 0.6 → notable pattern (show with annotation)

No correlation is shown unless there are at least **8 data points per type** (≈2 months of weekly data).

### Known high-value correlations to look for

These are the pairs most clinically meaningful — surface them as suggested comparisons:

| Pair | Typical lag | Why it matters |
|------|------------|----------------|
| Food ↓ → Weight ↓ | 1–3 weeks | Classic early warning |
| Water ↓ → Weight ↓ | 1–2 weeks | Dehydration signal |
| Grooming ↓ → Weight ↓ | 0–2 weeks | Pain/illness signal |
| Activity ↓ → Weight ↓ | 0–2 weeks | Lethargy precedes cachexia |
| Vomiting ↑ → Weight ↓ | 0–1 week | GI distress signal |
| Food ↑ + Weight ↓ | 0 weeks | Hyperthyroidism pattern (eat more, lose weight) |

The last one is particularly important — it's the classic presentation of feline hyperthyroidism, one of the most common diseases in senior cats.

### Correlation copy

Correlations should be expressed in plain, warm language. Examples:

- "Luna eats less about 2 weeks before her weight drops. Watch food intake as an early signal."
- "Gemini's grooming and weight tend to move together — when she grooms less, her weight follows soon after."
- "Kylo is eating more than ever, but still losing weight. This pattern is worth discussing with your vet."
- "Not enough data yet — keep logging to see patterns emerge."

---

## Feature: Home Screen Correlation Badges

If a cat has a notable active correlation (computed on last data fetch), show a small badge on their home card:

```
┌─────────────────────────────────────────────┐
│ 🐱  Luna           [watch]        10.2 lbs  │
│     3y · Domestic Shorthair                 │
│     ⚡ Food drop may affect weight soon      │
└─────────────────────────────────────────────┘
```

Only show this badge if:
- The correlation is notable (|r| ≥ 0.6)
- There has been a recent behavioral change (within last 2 weeks)
- The weight hasn't yet changed in the expected direction (i.e., the signal is predictive, not retrospective)

---

## Implementation Notes

### Frontend-only computation

All correlation math runs in the browser on the already-fetched measurement data. No new API endpoints needed. The computation is lightweight — we're dealing with dozens to low hundreds of data points per cat.

### New component: `CorrelationChart.tsx`

- Dual Y-axis (or normalized single axis) Recharts `ComposedChart`
- Two `Line` components with different colors
- `ReferenceArea` to highlight the lag window where correlation is strongest
- Below the chart: correlation prose (generated from the rule-based classifier)

### New library: `frontend/src/lib/correlations.ts`

Exports:
- `bucketByWeek(measurements: Measurement[]): WeeklyBucket[]`
- `normalize(values: number[]): number[]`
- `lagCorrelation(a: number[], b: number[], maxLag: number): { lag: number; r: number }`
- `detectCorrelations(cat: Cat, allMeasurements: Record<string, Measurement[]>): CorrelationResult[]`
- `describeCorrelation(result: CorrelationResult, catName: string): string`

### Tab integration

On CatProfile, the Trends tab fetches all measurement types (one request per type, in parallel) when first activated, then runs `detectCorrelations()` client-side. Results are memoized per session.

---

## Open Questions

1. **Minimum data requirement:** 8 data points feels right for 2 months of weekly logging, but shelter cats might have denser data (daily). Should we use an absolute count or a minimum time window?

2. **Hyperthyroidism callout:** Should we call this out explicitly by name? It would be very valuable for senior cat owners, but naming a disease feels like a medical claim. Alternative: flag the pattern and say "this unusual combination is worth mentioning to your vet."

3. **Correlation vs. causation language:** The copy must never imply causation. "Food drops tend to be followed by weight drops" is fine. "Eating less causes weight loss" is technically accurate but sounds too clinical. Review all copy with this lens.

4. **What to show when data is sparse:** A "keep logging" empty state with a progress indicator ("3 more weeks of data needed") might encourage continued logging.

---

*Draft written: Sprint 5*
