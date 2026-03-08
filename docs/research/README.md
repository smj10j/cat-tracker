# Research Infrastructure — Cat Tracker

This folder documents the veterinary and scientific basis for every clinical claim, threshold, and health indicator in Cat Tracker. It is a **required companion to `frontend/src/lib/healthMetrics.ts`**.

---

## Purpose

Cat Tracker presents specific clinical numbers to users and veterinarians — weight-change rate thresholds, behavioral warning tiers, hepatic lipidosis risk flags. These are not arbitrary; they reflect published feline veterinary guidelines. This folder exists so that:

1. Any developer can trace a threshold back to its source
2. Any threshold change is reviewed against the original evidence before the code is changed
3. Future content additions follow a consistent research standard

---

## Files in this folder

| File | What it covers |
|------|---------------|
| `weight-thresholds.md` | Every numeric threshold in `healthMetrics.ts` — rate-of-change and total-loss cutoffs |
| `behavioral-indicators.md` | Sources for `WATCH_ATTENTION`, `CONCERNING_ATTENTION`, and `URGENT_VET_SIGNS` arrays |
| `feline-resources.md` | Curated directory of authoritative organizations and publications to consult for new content |

---

## Source quality standards

When adding or updating any clinical content, follow these standards:

### Tier 1 — preferred (use for thresholds and alert copy)
- Peer-reviewed clinical guidelines from AAFP, WSAVA, or ISFM
- Studies in JVIM (Journal of Veterinary Internal Medicine) or JFMS (Journal of Feline Medicine and Surgery)
- Consensus statements from feline specialty boards (ABVP)

### Tier 2 — acceptable for Wellness Guide and user-facing copy
- Cornell Feline Health Center (vet.cornell.edu)
- Merck Veterinary Manual owner-facing content (merckvetmanual.com)
- iCatCare / International Cat Care (icatcare.org)
- ASPCA general care guidance

### Do not use
- Pet industry blogs, brand-sponsored content, or secondary summaries without a primary citation
- Articles that cite articles without tracing back to the primary study or guideline
- AI-generated clinical content

---

## Process for adding new clinical content

Follow this sequence every time. This is not optional:

1. **Find the primary source** — go to the guideline or study directly; do not rely on summaries
2. **Document it** — add an entry to the relevant file in this folder before writing any code
3. **Record the access date** for web sources (guidelines are revised periodically)
4. **Write conservative copy** — when the evidence is ambiguous, recommend vet consultation rather than stating a firm rule
5. **Update the code comment** — the relevant section of `healthMetrics.ts` must reference this folder

Any PR that changes a threshold or adds a new clinical claim in `healthMetrics.ts`, `WellnessGuide.tsx`, `CatHealthGuidance.tsx`, or `CatExportPage.tsx` **must** include an update to this folder.

---

## What "conservative copy" means in practice

- State the threshold and the guideline it comes from, then recommend vet consultation — do not diagnose
- Use "associated with" or "consistent with" rather than "caused by" or "means"
- For urgent signs, err toward urgency — the cost of a false alarm is one vet visit; the cost of missing a blockage is the cat's life
- Never claim a specific disease from a symptom pattern; flag the differential for the vet to evaluate

---

## Relationship to code

The primary implementation file is `frontend/src/lib/healthMetrics.ts`. Each threshold block in that file has an inline comment referencing this folder. When the thresholds change, update both the comment and the corresponding file here.

The vet export (`CatExportPage.tsx`) includes a Methodology section that names the guideline sources. That section must stay in sync with the threshold documentation here.
