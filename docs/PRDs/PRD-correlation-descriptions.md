# PRD: Correlation Descriptions — Clinical Accuracy & Dual-Audience Messaging

**Status:** Implemented

## Problem (Original Bug)

`describeCorrelation` uses the sign of the Pearson `r` coefficient to decide whether the outcome variable "rises" or "drops." This is wrong.

A positive `r` means typeA and typeB move **in the same direction** — but that direction could be both going up, or both going down. Using `r > 0 → 'rises'` incorrectly describes a scenario where both variables are declining.

**But fixing the direction bug is not enough.** Even with correct direction, the current descriptions are clinically hollow: "a pattern worth watching" or "these two variables tend to move together." This tells the owner nothing useful, and gives the vet nothing to act on.

---

## The Bigger Opportunity

The 5 input→outcome pairs we track are not arbitrary. Each has a specific clinical literature behind it. When we detect a notable correlation, we're not just observing a statistical curiosity — we're surfacing a pattern that feline veterinary medicine recognizes and uses to differentiate diagnoses.

The descriptions should reflect that. An owner whose cat shows a water↑+weight↓ pattern should understand that this is a specific, recognizable signal — not just "something worth watching." A vet receiving an export should see the clinical framing, not just "water intake and weight tend to move together."

**Tracking becomes medicine at the moment a pattern is detected. The description is what makes that happen.**

---

## Expanded Clinical Context Per Pair

This is the knowledge layer that needs to be encoded in the app. Each pair has specific clinical significance.

### food → weight

| Pattern | Clinical meaning |
|---|---|
| food↓ + weight↓ | Most common presentation of systemic illness in cats. Differential: dental disease, GI disease (IBD, pancreatitis), systemic illness (CKD, liver, cancer), stress/pain. Food decline often precedes weight loss by 1–3 weeks. |
| food↑ + weight↓ (paradoxical) | High specificity for hyperthyroidism, early diabetes mellitus, intestinal lymphoma, or exocrine pancreatic insufficiency. One of the clearest "call your vet" patterns. Already detected as `isHyperthyroidismPattern`. |
| food stable + weight↓ | Muscle wasting without appetite change. Consider: CKD-associated cachexia, cancer (esp. older cats), sarcopenia, early hyperthyroidism. |

**Lag significance:** Food change typically leads weight change by 1–3 weeks. A lag of 2–3 weeks means the tracking is working — the owner caught behavioral change before it showed up on the scale.

---

### water → weight

| Pattern | Clinical meaning |
|---|---|
| water↑ + weight↓ | **Highest diagnostic specificity of any pattern in this system.** Classic polyuria/polydipsia (PU/PD) triad with weight loss. Top differentials: CKD (most common in senior cats), hyperthyroidism, diabetes mellitus. A vet seeing this on an export should run: BUN/Cr/UA, T4, glucose/fructosamine. |
| water↑ + weight stable | Early PU/PD — may precede weight loss. Still worth investigating. |
| water↓ + weight↓ | Possible nausea-induced adipsia (cats suppress thirst when nauseous), systemic depression, or advanced illness. Dehydration risk. |

**Owner message priority:** Water↑+weight↓ should generate the most direct action prompt of any correlation, because the diagnostic yield from a vet visit is very high.

---

### grooming → weight

| Pattern | Clinical meaning |
|---|---|
| grooming↓ + weight↓ | Significant multi-system signal. Cats are meticulous groomers — they stop when they are in pain, nauseous, or systemically unwell. Declining grooming combined with weight loss strongly suggests the cat is uncomfortable. Differential: dental pain, GI disease, orthopedic pain, systemic illness. |
| grooming↑ (excessive) + weight↓ | Psychogenic alopecia from stress combined with metabolic stress. Less common but possible in anxious cats. |

**Human communication note:** "Cats groom less when they're hurting" is an insight most owners don't have. The description should make this explicit — it will feel like a discovery.

---

### activity → weight

| Pattern | Clinical meaning |
|---|---|
| activity↓ + weight↓ | Decreased energy + wasting. Pain is the most common cause of activity decline in cats — they hide it well. Combined with weight loss, this points to systemic illness, pain (dental, orthopedic, abdominal), or cancer in older cats. |
| activity↑ + weight↓ | Hyperthyroid cats often become hyperactive while losing weight. This is another corroborating signal for the hyperthyroid pattern. |
| activity↓ + weight stable/↑ | Sedentary weight gain — not an urgent concern but worth monitoring. |

---

### vomiting → weight

| Pattern | Clinical meaning |
|---|---|
| vomiting↑ + weight↓ | **Most specific pattern for GI disease.** In cats over 8: IBD vs. small-cell intestinal lymphoma (clinically identical — requires biopsy to differentiate). Also: hyperthyroidism, food intolerance, CKD. Chronic vomiting + weight loss warrants GI workup. |
| vomiting↑ + weight stable | Likely hairballs or dietary indiscretion if weight is unaffected. Less urgent but worth addressing. |
| vomiting↓ + weight stable | Possibly resolved — e.g., after a diet change. Note the improvement. |

---

## Multi-Pattern Confluence Detection

The current system evaluates each pair in isolation. But patterns compound:

- **food↓ + grooming↓ + weight↓** = more concerning than any single pair — suggests systemic illness
- **water↑ + vomiting↑ + weight↓** = near-classic CKD or hyperthyroid triad
- **activity↓ + food↓ + weight↓** = pain or systemic illness with high confidence
- **food↑ + activity↑ + weight↓** = strong hyperthyroid cluster

### Implementation

Add a `detectConfluence` function that checks for known multi-pattern clusters and returns an escalation note:

```ts
interface ConfluenceResult {
  clusterName: string           // e.g. "CKD/hyperthyroid cluster"
  pairsInvolved: string[]       // e.g. ["water→weight", "vomiting→weight"]
  ownerMessage: string
  vetNote: string
}
```

Show this above individual pattern descriptions when a cluster is detected — it's the strongest signal the app can generate.

---

## Dual-Audience Prose

The same mathematical result needs two different voices:

### Owner voice (InsightsPanel)

- Plain language. No disease names unless it's the paradoxical food↑+weight↓ pattern (where naming hyperthyroidism is actually helpful).
- Explain *why* the pattern matters in terms the owner understands (e.g., "cats groom less when they're hurting").
- Clear, proportionate action: "worth mentioning at your next visit" → "worth scheduling a checkup" → "a vet call soon is a good idea."
- When lag > 0 and typeA recently changed: tell them explicitly that their tracking just gave them an early warning. That's validating and actionable.

**Example (water↑ + weight↓, notable, owner):**
> Luna has been drinking more than usual while losing weight at the same time. In cats, this specific combination is one of the clearest early signs of kidney disease or diabetes — two conditions that respond well to early treatment. A vet visit soon is a good idea.

**Example (food↓, lag=2 weeks, weight now declining, owner):**
> Luna's food intake dropped about 2 weeks before her weight started declining — which means your tracking caught this pattern early. Sustained appetite loss combined with weight loss is worth discussing with your vet.

### Vet voice (Export page)

- Clinical terminology is appropriate.
- Include: pair name, correlation strength (r), lag in weeks, data window (N weeks), trend directions.
- Name differentials explicitly.
- Frame as "owner-reported behavioral data corroborating weight trend."
- Keep it compact — vets scan, they don't read.

**Example (water↑ + weight↓, notable, vet):**
> Concurrent increase in water intake and progressive weight loss observed over 12 weeks (r=0.81, same-week correlation). Owner-reported PU/PD pattern corroborating 8.2% total weight decline. Suggest: BUN/Cr/UA, T4, glucose/fructosamine.

**Example (vomiting↑ + weight↓, vet):**
> Progressive vomiting frequency increase tracking with weight loss over 10 weeks (r=0.74, lag=1 week). In a cat this age, differential includes IBD, small-cell GI lymphoma, hyperthyroidism. Consider abdominal ultrasound; endoscopic biopsy if bloodwork unremarkable.

---

## Data Confidence Framing

Correlation strength and data volume both affect how confident we should sound:

| Data | Framing |
|---|---|
| 4–6 weeks overlap, r ≥ 0.6 | "There's a consistent pattern emerging..." |
| 4–6 weeks overlap, r 0.3–0.6 | "There's a suggestive pattern — not yet conclusive..." |
| 7–12 weeks overlap, r ≥ 0.6 | "There's a clear, established pattern..." |
| 12+ weeks overlap, r ≥ 0.6 | "There's a well-established pattern over several months..." |

Don't say "notable pattern detected" for 4 weeks of data at r=0.61 — that's barely above the threshold and marginally confident. The label should match the evidence quality.

---

## Lag Is a Feature, Not Just a Statistic

When `lag > 0` and the predictor series (typeA) has recently shifted, but the outcome (typeB) hasn't yet caught up:

- This is exactly what the app is designed to detect.
- The description should say this explicitly: "Your tracking caught this early."
- If lag = 1–2 weeks and typeA recently changed: suggest the owner watch typeB closely over the next 1–2 weeks, and consider a vet call if it follows.

When `lag = 0`: simultaneous correlation. Confirms pattern, but can't use one to predict the other in advance. Focus on: "these two are linked — monitoring either one reflects the other."

---

## Technical Changes

### 1. Add trend detection to CorrelationResult

```ts
interface CorrelationResult {
  // existing fields...
  typeATrend: 'up' | 'down' | 'stable'
  typeBTrend: 'up' | 'down' | 'stable'
  dataWeeks: number    // number of weeks in the data window
}
```

### 2. Compute trend from weekly buckets

```ts
function detectTrend(buckets: WeeklyBucket[]): 'up' | 'down' | 'stable' {
  if (buckets.length < 4) return 'stable'
  const mid = Math.floor(buckets.length / 2)
  const avgFirst = mean(buckets.slice(0, mid).map(b => b.value))
  const avgSecond = mean(buckets.slice(mid).map(b => b.value))
  const changePct = Math.abs(avgSecond - avgFirst) / (avgFirst || 1)
  if (changePct < 0.04) return 'stable'
  return avgSecond > avgFirst ? 'up' : 'down'
}
```

### 3. Clinical annotation map

Add a `PAIR_CLINICAL` lookup that maps `[typeA, typeB]` → `{ ownerContext, vetDifferentials, confluenceRole }`. This is the knowledge layer — separate from prose generation so it can evolve independently.

### 4. Update `describeCorrelation` signature

```ts
describeCorrelation(
  result: CorrelationResult,
  catName: string,
  sex?: string | null,
  mode?: 'owner' | 'vet'   // default: 'owner'
): string
```

### 5. Add `detectConfluence` function

```ts
detectConfluence(results: CorrelationResult[]): ConfluenceResult | null
```

Check for known multi-pattern clusters. Return the strongest matching cluster if found, null otherwise.

### 6. Update vet export to use `mode: 'vet'`

`CatExportPage.tsx` passes `mode: 'vet'` to get clinical language + differentials + stats.

---

## Affected Code

- `frontend/src/lib/correlations.ts` — core changes (trend detection, PAIR_CLINICAL map, describeCorrelation, detectConfluence)
- `frontend/src/components/InsightsPanel.tsx` — use owner-mode descriptions, show confluence alert if detected
- `frontend/src/components/CorrelationChart.tsx` — insight text below chart (owner mode)
- `frontend/src/pages/CatExportPage.tsx` — vet-mode descriptions, include r/lag/dataWeeks, show confluence note

---

## Success Criteria

**Owner-facing:**
- water↑+weight↓ → tells owner this is a specific, meaningful signal and names the action clearly
- vomiting↑+weight↓ in a cat over 8 → mentions GI disease context without alarming
- lag > 0 + typeA recently changed → explicitly says "your tracking caught this early"
- Descriptions feel warm and useful, not generic

**Vet-facing:**
- Includes r value and lag in clinical framing
- Names differentials by pattern
- Does not repeat the owner-friendly softening language
- Compact enough to scan in 10 seconds

**Multi-pattern:**
- water↑ + vomiting↑ + weight↓ detected together → escalated confluence message surfaces above individual patterns
- Single-pattern descriptions remain unchanged when no confluence

**Bug fix (original requirement):**
- "Both vomiting and weight are declining" → description correctly says weight is declining, not rising
