# Body Condition Score (BCS) Sources

Documents the veterinary basis for the Body Condition Score feature. Cat Tracker
**transcribes** a WSAVA 9-point body condition score (1–9) that the owner or
veterinarian has already assigned; the app does not compute, infer, or reinterpret
the score. The per-score descriptive copy shown next to each number is taken
**verbatim from the WSAVA Global Nutrition Committee cat BCS chart** — the primary
source below. No score is diagnosed by the app and no clinical interpretation layer
sits on top of the transcribed number.

Body condition score is WSAVA's standardized estimate of body fat, one of its
"5th vital sign" nutritional-assessment tools. It is scored on a 9-point scale where
1 = emaciated, 5 = ideal, and 9 = grossly obese.

---

## Primary source — descriptive copy (per-score phrases)

**Document:** *Body Condition Score* chart for Cats
**Publisher / author:** WSAVA (World Small Animal Veterinary Association) Global
Nutrition Committee
**Current version URL (June 2025):**
https://wsava.org/wp-content/uploads/2025/06/WSAVA_BCSCat_BCSCat_Nutrition_250612.pdf
**Prior version URL (©2013, retrieved for cross-check):**
https://wsava.org/wp-content/uploads/2020/01/Cat-Body-Condition-Scoring-2017.pdf
**Chart index page:** https://wsava.org/global-guidelines/global-nutrition-guidelines/
**Access date:** 2026-07-02

**Underlying validated system cited on the chart:**
- Laflamme DP. *Development and validation of a body condition score system for cats: A clinical tool.* Feline Pract 1997;25:13-18.
- Bjornvad CR, et al. *Evaluation of a nine-point body condition scoring system in physically inactive pet cats.* AJVR 2011;72:433-437.
- Teng KT, et al. *Strong associations of 9-point body condition scoring with survival and lifespan in cats.* J Feline Med Surg 2018;20(12):1110-1118. DOI: 10.1177/1098612X17752198

**Where used in the app:** the BCS entry/measurement screen (the descriptive phrase
displayed alongside each 1–9 option) and the vet export. This is transcription of the
owner's/vet's score, not an app-generated assessment.

---

## The 9-point scale — WSAVA verbatim descriptions (cat)

Descriptions below are transcribed **verbatim** from the current WSAVA cat BCS chart
(June 2025 version). The chart groups the scores under three header bands:
**UNDER IDEAL (1–4)**, **IDEAL (5)**, **OVER IDEAL (6–9)**.

| Score | Band | WSAVA description (verbatim, cat) |
|------:|------|-----------------------------------|
| 1 | Under ideal | Ribs very easily seen on short-haired cats. No fat pads present. Severe abdominal tuck. Lumbar vertebrae and pelvic bones easily seen and felt. |
| 2 | Under ideal | Ribs easily seen on short-haired cats. Lumbar vertebrae obvious. Pronounced abdominal tuck. No fat pads present. |
| 3 | Under ideal | Ribs easily felt with minimal fat covering. Lumbar vertebrae obvious. Obvious waist behind ribs. Minimal abdominal fat pads. |
| 4 | Under ideal | Ribs felt with minimal fat covering. Noticeable waist behind ribs. Slight abdominal tuck. Minimal abdominal fat pads. |
| 5 | **Ideal** | Well-proportioned. Ribs felt with slight fat covering. Waist seen behind ribs, but not pronounced. Abdominal fat pad minimal. |
| 6 | Over ideal | Ribs felt with slight excess fat covering. Waist and abdominal fat pad present but not obvious. Abdominal tuck absent.\* |
| 7 | Over ideal | Ribs not easily felt through moderate fat covering. Waist not easily seen. Slight rounding of abdomen may be present. Moderate abdominal fat pad. |
| 8 | Over ideal | Ribs not felt due to excess fat covering. Waist absent. Obvious rounding of abdomen with prominent abdominal fat pad. Fat deposits present over lower back area. |
| 9 | Over ideal | Ribs not felt under heavy fat cover. Heavy fat deposits over lumbar area, face and limbs. Distention of abdomen with no waist. Extensive abdominal fat deposits. |

\* The 2025 chart footnotes score 6: *"A body condition score of 6/9 may be acceptable
in some cats, especially older cats."*

**Sourcing notes:**
- All 9 descriptions are sourced from the WSAVA chart itself. None are inferred.
- Score 5 as printed contains a source typo ("Abdminal fat pad minimal"); transcribed
  above as the intended "Abdominal." Use the corrected spelling in the app.
- The prior 2017 chart (©2013) carries the same clinical content with slightly older
  wording (e.g., score 1: *"Ribs visible on shorthaired cats. No palpable fat. Severe
  abdominal tuck. Lumbar vertebrae and wings of ilia easily palpated."*). The 2025
  version is the canonical text to ship; the 2017 version was fetched only to confirm
  the descriptions are stable across revisions.

---

## Ideal range (4–5/9) — cited to the primary WSAVA guideline

The WSAVA cat **chart** labels only **5/9** as the "IDEAL" column. The broader
**4–5/9 acceptable/ideal band** is stated explicitly in the companion WSAVA guideline
text (Tier 1 primary), so it is citable:

> "The goal for most pets is a BCS of 4 to 5 of 9. (This may appear 'too thin' to some
> pet owners so client education is important.)"

> Nutritional screening risk factor — Physical Examination: "Body condition score
> (9 point scale): Any score less than 4 or greater than 5" [flags the animal for
> extended nutritional evaluation].

> "Disease risk associations with higher BCS in adult animals appear to increase above
> 6 of 9."

**Source:** WSAVA Nutritional Assessment Guidelines Task Force Members (Freeman L,
Becvarova I, Cave N, MacKay C, Nguyen P, Rama B, Takashima G, Tiffin R, Tsjimoto H,
van Beukelen P). *WSAVA Nutritional Assessment Guidelines.* J Small Anim Pract.
2011;52(7):385-396.
**URL:** https://wsava.org/wp-content/uploads/2020/01/WSAVA-Nutrition-Assessment-Guidelines-2011-JSAP.pdf
**Access date:** 2026-07-02

**Guidance for the code:** If the app displays an "ideal" band, use **4–5/9** and cite
the JSAP 2011 guideline; the chart's single-column "IDEAL = 5/9" and the 2025 footnote
that "6/9 may be acceptable in some cats, especially older cats" are the finer print and
should not be flattened into a numeric alert. Prefer showing the transcribed number and
the WSAVA description without an app-generated "too heavy / too thin" judgment, per the
conservative-copy standard in `README.md`.

---

## Verification status

**Reached the true Tier 1 primary source: YES.**

- The per-score descriptive copy was extracted **verbatim from the actual WSAVA
  Global Nutrition Committee cat BCS chart PDFs** (current June 2025 chart and the
  2017/©2013 chart for cross-check), retrieved directly from `wsava.org`. Text was
  extracted from the official PDFs (not a summary, blog, or AI paraphrase) and both
  chart revisions agree on the clinical content.
- The 9-point scale structure (1 = emaciated … 5 = ideal … 9 = grossly obese; bands
  UNDER IDEAL 1–4 / IDEAL 5 / OVER IDEAL 6–9) is confirmed on the chart and in the
  JSAP 2011 guideline.
- The **4–5/9 ideal range** is confirmed against the primary WSAVA Nutritional
  Assessment Guidelines (JSAP 2011), quoted above — it is NOT uncited and may ship
  with that citation.
- All 9 scores (1 through 9) have a sourced WSAVA description; none are missing or
  inferred.

No weak/secondary sources were used. This document may back per-score descriptive copy
in the code.

---

*Last reviewed: 2026-07-02. Next review recommended when WSAVA publishes a revised cat
BCS chart or updated Nutritional Assessment Guidelines.*
