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

### 1–2%/week loss → `concerning`

**Claim:** Loss of 1–2% of body weight per week exceeds the recommended maximum rate for intentional feline weight loss.

**Basis:**
- WSAVA Nutritional Assessment Guidelines and AAFP Weight Management Guidelines both cite 0.5–1% per week as the maximum safe rate for supervised intentional weight loss. Unintentional loss at this rate warrants clinical attention.
- At this rate, if sustained, a cat would lose 7% of body weight in ~7 weeks — approaching the threshold for clinically significant total loss.

**Sources:**
- WSAVA Global Nutrition Committee Nutritional Assessment Guidelines
- AAFP/AAHA Weight Management Guidelines for Dogs and Cats

---

### 0.5–1%/week loss → `watch`

**Claim:** Loss of 0.5–1%/week is at or near the lower bound of clinically significant rate; worth monitoring.

**Basis:**
- 0.5%/week is the lower boundary of the safe intentional weight-loss range per AAFP guidelines. Unintentional loss at this rate is a soft signal — not urgent, but worth tracking. Clinical convention supports a "watch" classification here.

**Sources:**
- AAFP Weight Management Guidelines; WSAVA Nutritional Assessment Guidelines (see above)

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

### 1.5–3%/week gain → `watch`

**Basis:** Linear interpolation of the gain `concerning` threshold; conservative lower bound for monitoring.

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

*Last reviewed: 2026-03-07. Next review recommended when AAFP or WSAVA publish updated nutritional guidelines.*
