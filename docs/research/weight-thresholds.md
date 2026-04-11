# Weight Threshold Sources

Documents every numeric threshold used in `frontend/src/lib/healthMetrics.ts` with its clinical basis.

---

## Rate-of-change thresholds (`classifyRate` function)

### >2%/week loss → `urgent`

**Claim:** Losing more than 2% of body weight per week is a clinically significant rate associated with hepatic lipidosis risk.

**Basis:**
- AAFP (American Association of Feline Practitioners) Nutritional Guidelines state that intentional feline weight loss programs should not exceed 0.5–1% of body weight per week. Weight loss exceeding 2%/week indicates an acute process rather than intentional management.
- Feline hepatic lipidosis (fatty liver disease) is the most common severe hepatic disease in cats and develops rapidly with caloric restriction or anorexia. The JVIM literature (including Armstrong & Blanchard, 2009, "Hepatic lipidosis in cats") identifies rapid weight loss as a primary risk factor.
- The WSAVA Global Nutrition Committee nutritional assessment guidelines describe rapid weight change (directional loss >2%/week) as warranting immediate clinical investigation.

**Sources:**
- AAFP Nutritional Guidelines (updated periodically; aafponline.org — verify current version at time of update)
- Armstrong PJ, Blanchard G. "Hepatic lipidosis in cats." Vet Clin North Am Small Anim Pract. 2009;39(3):599-616.
- WSAVA Global Nutrition Committee Nutritional Assessment Guidelines (wsava.org)

---

### 1.5–2%/week loss → `concerning`

**Claim:** Loss of 1.5–2% of body weight per week clearly exceeds the recommended maximum rate for intentional feline weight loss and warrants clinical attention.

**Basis:**
- WSAVA Nutritional Assessment Guidelines and AAFP Weight Management Guidelines both cite 0.5–1% per week as the maximum safe rate for supervised intentional weight loss. At 1.5%/week, the rate is 50% above the upper bound of the safe range, providing high confidence this represents a genuine clinical signal rather than measurement noise.
- At this rate, if sustained, a cat would lose ~6% of body weight in 4 weeks — approaching the threshold for clinically significant total loss.

**Sources:**
- WSAVA Global Nutrition Committee Nutritional Assessment Guidelines
- AAFP/AAHA Weight Management Guidelines for Dogs and Cats

**Previous threshold:** 1%/week (changed 2026-04-11 — see "Home scale measurement accuracy" section for rationale)

---

### 0.75–1.5%/week loss → `watch`

**Claim:** Loss of 0.75–1.5%/week is a meaningful rate that warrants monitoring but is below the clinical intervention threshold.

**Basis:**
- AAFP guidelines cite 0.5–1%/week as the safe intentional weight-loss range. However, the previous 0.5%/week `watch` threshold produced frequent false positives from normal home-scale fluctuations (see "Home scale measurement accuracy" below). The 0.75%/week lower bound provides a buffer above scale noise while remaining well below the clinical intervention threshold of 1.5%/week.
- At 0.75%/week sustained, a cat would lose ~3% in a month — enough to warrant attention but not clinical concern on its own.

**Sources:**
- AAFP Weight Management Guidelines; WSAVA Nutritional Assessment Guidelines (see above)

**Previous threshold:** 0.5%/week (changed 2026-04-11 — see "Home scale measurement accuracy" section for rationale)

---

### >3%/week gain → `concerning`

**Claim:** Weight gain exceeding 3%/week may indicate fluid retention, overfeeding, or thyroid/metabolic dysfunction.

**Basis:**
- Rapid weight gain in cats is less studied than rapid loss. The `concerning` designation at >3%/week reflects clinical convention: gains at this rate are either overfeeding (addressable with management) or pathological fluid retention (pleural effusion, ascites), both of which warrant veterinary review.
- AAFP hyperthyroidism management guidelines note that thyroid dysfunction can present with either rapid weight gain (hypothyroidism, rare in cats) or weight loss (hyperthyroidism, common). Rapid gain is a soft signal for metabolic workup.

**Sources:**
- AAFP Hyperthyroidism Management Guidelines
- Clinical convention; confirmed by general feline internal medicine references (Merck Vet Manual, Ettinger & Feldman "Textbook of Veterinary Internal Medicine")

---

### 2–3%/week gain → `watch`

**Basis:** Lower bound raised from 1.5% to 2%/week to reduce false positives from normal post-meal or hydration fluctuations measured on home scales. Conservative lower bound for monitoring.

**Previous threshold:** 1.5%/week (changed 2026-04-11)

---

## Total-loss-from-peak thresholds (`assessHealth` function)

### >10% total from peak → `urgent`

**Claim:** Losing more than 10% of peak recorded body weight constitutes clinically significant weight loss requiring veterinary evaluation.

**Basis:**
- The 10% threshold is widely cited in feline internal medicine as the point at which weight loss is unambiguously "clinically significant" — the Merck Veterinary Manual and multiple JVIM publications use this as a standard benchmark.
- Multiple authors in *Veterinary Clinics of North America: Small Animal Practice* describe >10% body weight loss as sufficient justification for a full diagnostic workup regardless of the time frame over which it occurred.

**Sources:**
- Merck Veterinary Manual — "Weight Loss in Cats" (merckvetmanual.com)
- Hall JA et al. "Nutritional status of dogs and cats with naturally occurring cancer." JAVMA, 2003 (references 10% threshold)
- General consensus: Ettinger & Feldman, *Textbook of Veterinary Internal Medicine*, 8th ed.

---

### 7–10% total from peak → `concerning`

**Claim:** 7–10% loss from peak is notable and warrants clinical discussion.

**Basis:**
- ISFM (International Society of Feline Medicine) feline nutrition guidelines use 5–10% as the range for "moderate" weight loss requiring investigation. The 7% lower boundary used here is deliberately conservative — it falls above the "mild" (3–5%) range to reduce false alarms.

**Sources:**
- ISFM Guidelines on Feline Nutrition (icatcare.org)

---

### 4–7% total from peak → `watch`

**Basis:** Below the ISFM "moderate" threshold; above negligible. Conservative lower bound for monitoring. Consistent with AAFP guidance that weight changes >3–4% should be tracked.

---

## Monthly weigh-in recommendation

The Wellness Guide recommends monthly weight logging.

**Basis:**
- WSAVA Life Stage Guidelines recommend weight assessment at every wellness visit. For cats with chronic disease or weight concerns, monthly home monitoring is described as sufficient to detect meaningful trend changes.
- AAFP Senior Care Guidelines recommend semi-annual or more frequent weigh-ins for cats over 7 years.

**Sources:**
- WSAVA Life Stage Guidelines (wsava.org)
- AAFP Senior Care Guidelines (aafponline.org)

---

## Notes on unit choice (lbs vs. kg)

Cat Tracker defaults to lbs (US user base) but supports kg. All thresholds above are expressed as percentages of body weight, so they are unit-independent.

---

---

## Algorithm sensitivity decisions (added 2026-04-10)

These decisions address false-positive alert behaviour when the rate-of-change model is applied to real-world consumer weight data (weekly home scale readings). They are engineering judgements, not clinical thresholds, but are documented here for auditability.

### Interval gate (< 5 days between measurements → period skipped)

**Problem:** Extrapolating a weekly-rate from measurements taken only 1–3 days apart amplifies scale noise into alarming rates (e.g., a 0.15 lb scale fluctuation over 2 days = 5%/week).

**Decision:** Any consecutive pair with fewer than 5 days between measurements is recorded in the `periods` array with `skipped: true` and excluded from both rate classification and worst-period summary selection. The 5-day threshold is the minimum interval at which a weekly-rate extrapolation is meaningfully stable. It is not a clinical threshold.

### Noise floor (< 1.5% relative change or < 0.2 lbs absolute → ok, not classified)

**Problem:** Home scales for cats (typically infant/kitchen/bathroom scales) have an accuracy of ±0.1–0.2 lbs. Normal daily biological weight variation in cats (hydration, meals, elimination) is 1–3% of body weight. The previous 0.5% relative-only noise floor was insufficient — it equated to just 0.04 lbs on an 8 lb cat, filtering essentially nothing. This caused normal ±0.1 lb fluctuations between weekly weigh-ins to trigger "watch" and even "concerning" alerts.

**Decision:** A measurement-to-measurement change is classified as `ok` (noise) when **either** condition is met:
1. `|Δweight| / previous_weight < 0.015` (1.5% relative), **or**
2. `|Δweight| < 0.2` lbs absolute

The dual threshold ensures small cats (where 0.2 lbs is a larger percentage) and large cats (where 0.2 lbs is tiny) are both protected. The 0.2 lbs absolute value reflects the practical accuracy limit of consumer scales. The 1.5% relative value accounts for biological variation that is not clinically meaningful.

**Previous threshold:** 0.5% relative only (changed 2026-04-11)

### Robust peak reference — 90th percentile of last 180 days

**Problem:** Using all-time maximum weight as the baseline for total-loss-from-peak alerts causes persistent false alarms when a cat's healthy weight declines over years (natural aging, diet change, post-illness recovery) or when an early single high measurement acts as a ratchet.

**Decision:** The baseline (`referencePeak`) is computed as the 90th-percentile of measurements in the 180 days preceding the most recent measurement. The 90th-percentile (nearest-rank: `idx = ceil(N × 0.9) − 1`) is robust to a single outlier high reading. The 180-day window is approximately 6 months — long enough to establish a meaningful baseline but short enough to track genuine long-term improvement.

**Fallback:** When fewer than 8 measurements exist within the 180-day window, the algorithm falls back to the all-time maximum weight. 8 measurements is approximately 2 months of weekly weigh-ins — the minimum sample needed for the percentile to be stable. With fewer data points, the all-time max is the least-wrong reference available.

Neither the 180-day window nor the 90th-percentile level are clinical thresholds; both are engineering calibration choices documented here for future review.

### Consecutive-period requirement for overallStatus escalation (added 2026-04-11)

**Problem:** The `overallStatus` field previously took the worst status of *any single period* via `worstStatus()`. This meant one measurement-to-measurement dip — even if immediately followed by a return to the prior weight — would flag the cat's entire assessment as "watch" or worse. For cats weighed weekly on home scales, normal ±0.1 lb fluctuations produced frequent isolated non-ok periods that did not represent genuine trends.

**Decision:** A period's non-ok rate classification only escalates `overallStatus` when the **previous non-skipped, non-noise-floor period** was also non-ok **in the same direction** (both loss, or both gain). This requires a sustained signal across at least two consecutive measurement intervals before the overall assessment changes.

**Exception:** The cumulative peak-loss thresholds (4% → watch, 7% → concerning, 10% → urgent) are applied unconditionally, as cumulative loss from baseline *is* a trend signal by definition — it already accounts for the full history.

**Rationale:** A single dip that bounces back is indistinguishable from scale noise or normal biological variation. Requiring two consecutive periods in the same direction filters oscillation patterns while still catching genuine sustained weight changes. This is an engineering judgement, not a clinical threshold.

### Home scale measurement accuracy (added 2026-04-11)

This section documents the real-world measurement constraints that inform the noise floor and rate threshold calibrations above.

**Consumer scale accuracy:**
- Bathroom scales (used to weigh owner holding cat, then subtract): ±0.2–0.5 lbs typical accuracy
- Kitchen/food scales (for small cats): ±0.05–0.1 lbs, but max capacity often limits use
- Infant scales (purpose-designed, best option): ±0.1 lbs typical accuracy
- Pet-specific scales: vary widely; ±0.1–0.2 lbs is representative

**Biological variation:**
- A cat's weight varies 1–3% within a single day based on hydration, recent meals, and elimination. An 8 lb cat can weigh 7.9 lbs before breakfast and 8.15 lbs after. This is not a weight change.
- The combination of scale accuracy (��0.1–0.2 lbs) and biological variation means differences of ≤0.2 lbs between weekly weigh-ins carry no clinical signal.

**Implications for the algorithm:**
- Any change < 0.2 lbs should be treated as stable regardless of percentage
- Rate thresholds must be set high enough that normal scale-noise fluctuations (0.1–0.2 lbs on a weekly basis) do not trigger alerts
- The "watch" rate threshold of 0.75%/week on a 10 lb cat = 0.075 lbs/week. Without the absolute noise floor, this would fire on every ±0.1 lb fluctuation. The 0.2 lbs absolute floor prevents this.

These constraints are not clinical thresholds but practical calibration against the realities of home monitoring.

---

*Last reviewed: 2026-04-11. Next review recommended when AAFP or WSAVA publish updated nutritional guidelines.*
