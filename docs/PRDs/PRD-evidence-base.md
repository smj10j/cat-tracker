# PRD: Veterinary Evidence Base — Sources, Citations, and Research Infrastructure

**Status:** Draft
**Last updated:** 2026-03-07

---

## Problem

Cat Tracker makes specific clinical claims — thresholds for weight loss severity, behavioral warning signs, statements like "cats should not lose more than 1% body weight per week" and "hepatic lipidosis risk." These are grounded in real veterinary literature, but:

1. **The sources are not documented anywhere.** A comment in `healthMetrics.ts` says "based on feline veterinary literature" and lists two organizations (AAFP, Merck) without citations. If a threshold needs to be updated or challenged, there is no starting point for the review.

2. **The app's clinical content is not attributed in the UI.** Users see warnings and health status indicators but have no way to understand where they come from. Unattributed clinical claims reduce trust and could be seen as arbitrary opinion.

3. **There is no process for adding new evidence-based content.** As we expand to more measurement types, behavioral indicators, and wellness content, without a research infrastructure we will accumulate more unattributed content.

4. **The Wellness Guide and vet export are richer tools than they look.** Adding even minimal source attribution would make both dramatically more credible — for owners, vets, and anyone reviewing a generated export.

---

## Proposal

This PRD has three components: a documentation infrastructure layer, source attribution in the codebase, and in-app surface changes.

---

## Component 1: Research Infrastructure (`docs/research/`)

Create a `docs/research/` folder with the following structure:

```
docs/research/
├── README.md              # Principles for sourcing and citing; how to evaluate new evidence
├── weight-thresholds.md   # Sources for the specific % thresholds used in healthMetrics.ts
├── behavioral-indicators.md  # Sources for food/water/litter/grooming/activity/vomiting signals
└── feline-resources.md    # Curated list of authoritative organizations and reference materials
```

### `docs/research/README.md` — Research principles

Documents the standard we hold ourselves to:

- **Prefer peer-reviewed sources**: Journal of Veterinary Internal Medicine, Journal of Feline Medicine and Surgery
- **Use clinical guidelines from major bodies**: AAFP (American Association of Feline Practitioners), WSAVA (World Small Animal Veterinary Association), ISFM (International Society of Feline Medicine)
- **Use consumer-facing trusted references** for Wellness Guide and UI copy: Cornell Feline Health Center, Merck Veterinary Manual (for owners), ASPCA
- **Do not derive thresholds from secondary sources** (articles that cite articles). Go to the primary study or guideline
- **Record the date accessed** for web sources, as clinical guidelines are updated periodically
- **When uncertain, be conservative and recommend vet consultation** rather than stating a firm rule

Also documents the review process: any change to a threshold or clinical claim requires updating `docs/research/` before updating the code or copy.

### `docs/research/weight-thresholds.md` — Weight threshold sources

Documents every numeric threshold in `healthMetrics.ts` with its source:

| Threshold | Claim | Source |
|---|---|---|
| >2%/week loss = `urgent` | Associated with hepatic lipidosis risk | AAFP nutritional guidelines; JVIM studies on feline hepatic lipidosis |
| 1–2%/week loss = `concerning` | Exceeds safe intentional loss rate | WSAVA nutritional assessment guidelines |
| 0.5–1%/week loss = `watch` | Low end of clinically significant loss | Clinical convention; AAFP weight management guidelines |
| >10% total from peak = `urgent` | Clinically significant weight loss requiring vet evaluation | Multiple JVIM studies; Merck Vet Manual |
| 7–10% total from peak = `concerning` | Warrants clinical attention | ISFM feline nutrition guidelines |
| >3%/week gain = `concerning` | May indicate fluid retention or thyroid dysfunction | AAFP hyperthyroidism management guidelines |
| Monthly weigh-in recommendation | Frequency for chronic disease monitoring | WSAVA guidelines for life-stage nutrition |

Each entry in the actual doc will include the full citation, URL/DOI, and date accessed.

### `docs/research/behavioral-indicators.md` — Behavioral signal sources

Documents the clinical basis for each behavioral measurement type and the WATCH/CONCERNING/URGENT signal lists in `healthMetrics.ts`. Key sources:

- **Litter box changes (especially straining)**: AAFP feline idiopathic cystitis and FLUTD guidelines; straining in male cats flagged as potentially life-threatening urinary obstruction
- **Food intake as leading indicator**: Multiple JVIM studies showing food intake changes precede weight changes by 1–3 days in chronic disease
- **Hiding and activity reduction**: ISFM and AAFP consensus on pain recognition in cats — behavioral withdrawal is a primary pain indicator
- **Grooming changes**: ISFM consensus on skin disease + over-grooming; AAFP guidelines on stress and psychogenic alopecia
- **Vomiting frequency thresholds**: AAFP consensus guidelines on chronic vomiting (>1/week warrants investigation)

### `docs/research/feline-resources.md` — Reference directory

A curated list of authoritative organizations, publications, and tools that can be referenced when adding new content:

**Clinical guidelines bodies:**
- AAFP (aafponline.org) — feline-specific clinical practice guidelines
- WSAVA (wsava.org) — global nutrition and care standards
- ISFM (icatcare.org) — International Cat Care and ISFM guidelines
- ABVP (abvp.com) — feline specialty board-certified veterinarians

**Peer-reviewed journals:**
- Journal of Feline Medicine and Surgery (JFMS)
- Journal of Veterinary Internal Medicine (JVIM)
- Veterinary Clinics of North America: Small Animal Practice

**Consumer-facing trusted references:**
- Cornell Feline Health Center (vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center)
- Merck Veterinary Manual — owner section (merckvetmanual.com)
- ASPCA poison control and general cat care
- iCatCare (icatcare.org) — International Cat Care consumer content

---

## Component 2: Source Attribution in the Codebase

### `frontend/src/lib/healthMetrics.ts`

Replace the current generic comment with specific citations inline. Each threshold block gets a reference pointing to `docs/research/weight-thresholds.md`:

```typescript
// Weight loss thresholds — see docs/research/weight-thresholds.md for full citations
// >2%/week: hepatic lipidosis risk (AAFP Nutritional Guidelines; JVIM 2002 Armstrong et al.)
// 1-2%/week: exceeds safe intentional loss rate (WSAVA Nutritional Assessment Guidelines 2021)
// >10% total: clinically significant — requires veterinary evaluation (Merck Vet Manual; JVIM)
```

Similarly for the `WATCH_ATTENTION`, `CONCERNING_ATTENTION`, and `URGENT_VET_SIGNS` arrays:

```typescript
// Behavioral indicators — see docs/research/behavioral-indicators.md
// Sources: AAFP feline pain recognition consensus 2022; ISFM feline stress guidelines 2020;
//          AAFP chronic vomiting guidelines
```

This is a documentation-only change with no functional effect.

---

## Component 3: In-App Surface Changes

### Wellness Guide

The current Wellness Guide page (`WellnessGuide.tsx`) presents information without any source attribution. Each section should gain a brief "Source" or "Based on" footer:

> Weight thresholds based on AAFP and WSAVA nutritional guidelines. For full sources, see [research notes] or consult your veterinarian.

The link can point to a lightweight in-app "About this app's research" page (new, low-complexity), or to external resources in a new tab.

### Health Guidance alerts

The CatHealthGuidance page and InsightsPanel alerts that reference specific thresholds (e.g., "hepatic lipidosis risk") should include a brief, non-alarming source note. Not a footnote — something woven into the text:

> **Current:** "This exceeds 2%/week — a threshold associated with hepatic lipidosis risk."
> **After:** "This exceeds 2%/week, the clinical threshold for rapid feline weight loss (AAFP guidelines). Vet visit recommended."

### Vet export

The vet export (`CatExportPage.tsx`) currently presents data and patterns without explaining the methodology behind the health status classification. Adding a brief "Methodology" section at the bottom of the export gives vets the context they need to evaluate the data:

> **Health status thresholds** in this report follow AAFP and WSAVA nutritional guidelines: urgent (>2%/week loss or >10% total from peak), concerning (1–2%/week or >7% total), watch (0.5–1%/week). Behavioral indicators reference AAFP and ISFM consensus guidelines. Full citations at [URL or note].

This section is print-only and adds approximately half a page to the export. It significantly increases the document's credibility with veterinarians.

### README and project documentation

The project README and relevant docs should acknowledge the evidence basis in their description of the health indicator system. The existing README section on health indicators already shows the thresholds but doesn't say where they come from. Add one sentence:

> Thresholds follow [AAFP](https://aafponline.org) and [WSAVA](https://wsava.org) feline nutritional guidelines. Full citations in [`docs/research/`](docs/research/).

---

## Implementation Order

If approved, implement in this order — later phases depend on the earlier documentation being accurate:

1. **Phase A — Research docs**: Create `docs/research/` folder and populate all four files with full citations. This is documentation-only, no code changes.
2. **Phase B — Code comments**: Update `healthMetrics.ts` inline comments with specific citations. Documentation-only.
3. **Phase C — Vet export**: Add "Methodology" section to `CatExportPage.tsx`. Small UI change, high value for clinician credibility.
4. **Phase D — Wellness Guide**: Add source attributions to `WellnessGuide.tsx` and `CatHealthGuidance.tsx`. Medium UI change.
5. **Phase E — In-line alert text**: Refine alert copy in `InsightsPanel.tsx` and `healthMetrics.ts` summary strings to reference guidelines by name. Small copy changes.

---

## Out of Scope

- **Displaying full citations in the app**: A reference list inside the app would be overwhelming. A single short line per section pointing to an external source or the vet export methodology note is sufficient.
- **Building a citations database**: Citations live in `docs/research/` markdown files, not a structured data store.
- **AI-generated health content**: Generating new clinical content via the Claude API is tracked separately in PRD-killer-app.md P7.
- **Replacing existing copy wholesale**: The goal is attribution and credibility, not a content audit. Existing copy that is clinically reasonable stays; only specific threshold claims get citations.

---

## Success Criteria

- A veterinarian reviewing a vet export can see where the thresholds come from without asking
- Any engineer adding a new measurement type or threshold has a clear process for finding and documenting sources
- The Wellness Guide and CatHealthGuidance pages cite at least one authoritative source per section
- `docs/research/` is treated as a required update alongside any future change to a threshold or clinical claim
