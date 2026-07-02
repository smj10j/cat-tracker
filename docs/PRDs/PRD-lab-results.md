# PRD: Lab Results Tracking

| | |
|---|---|
| **Status** | `Draft` |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Author** | AI research (for product owner review) |
| **Depends on** | Vet export (PRD-vet-export), charts infrastructure; soft dependency on PRD-vet-visits (optional visit linkage) |

---

## Problem

The cats whose owners use this app hardest are chronic-condition cats — CKD, hyperthyroidism, diabetes. That is exactly the audience already giving sub-q fluids and running medication schedules here. Those cats get bloodwork every 3–6 months, and the numbers that matter (creatinine, SDMA, T4, glucose curves) come back as a paper printout or a PDF attachment.

Today those owners:

- keep values in a notes app, a spreadsheet, or a folder of PDFs;
- cannot see whether creatinine has been drifting up over four panels or is stable;
- re-type history from memory when they see a new vet or an ER doctor.

Cat Tracker already trends weight and behavior over time and already produces a vet-facing export. Lab values are the same shape of problem — sparse time series per cat — and the single highest-value data we don't hold for the chronic-condition audience.

**What this feature is:** a structured place to transcribe lab values and see them over time.
**What it is not:** an interpreter. The app will not stage, grade, or explain any value.

---

## Target users

- **CKD owners** tracking creatinine, BUN, SDMA, phosphorus, potassium, USG across quarterly panels.
- **Hyperthyroid owners** tracking T4 through dose titration.
- **Diabetic owners** tracking glucose/fructosamine.
- **Vets receiving the export** — a clean value table with dates beats "I think it was around 3 last spring."

---

## User stories

1. "Mochi's chem panel came back. Let me enter the whole panel — one date, twelve values — in one screen, not twelve separate forms."
2. "Show me creatinine over the last two years, with the lab's reference range behind it, so I can see the trend before the recheck."
3. "My lab prints the reference range next to each value. I'll enter that too — different labs use different ranges."
4. "When I print the vet export for the new internist, include the lab history table."
5. "The ER vet asked when her potassium was last checked. Search: potassium, most recent value, date."

---

## Scope

### Phase A — entry, trends, export

- **`lab_results` table** (see data model): one row per analyte per draw date, with value, unit, and **reference range as printed on the user's lab report**.
- **Preset analyte list** in `shared/lib/` — *names and common units only*: creatinine, BUN, SDMA, phosphorus, calcium, potassium, sodium, chloride, ALT, ALP, total T4, glucose, fructosamine, USG, HCT/PCV, WBC, platelets, total protein, albumin (list finalized at implementation). Free-text analyte allowed for anything not listed.
- **Panel entry UX**: pick a date once, then fill values for many analytes on one screen; per-cat prefill of last-used unit and reference range per analyte (editable every time).
- **Per-analyte trend chart** with the user-entered reference band rendered behind the series.
- **Vet export section**: "Lab results (owner-transcribed)" — per-analyte history table.
- Edit/delete of individual results; results list grouped by draw date on a Labs section of the cat profile.

### Phase B (small follow-ups, same release train if cheap)

- Optional link from a panel to a `vet_visits` row if PRD-vet-visits has shipped (`vet_visit_id` FK from day one, nullable, unused until then).
- CSV export of raw lab rows alongside the existing data-export path.

### Clinical-content guardrail — the defining constraint

Per `docs/research/README.md` and CLAUDE.md, and non-negotiable for this feature:

- **Reference ranges are entered from the user's own lab report. The app never hardcodes, suggests, or defaults a reference range for any analyte.** Ranges differ by lab, methodology, and unit system; shipping a built-in range is a clinical claim.
- **No interpretation of values.** Nothing may render copy like "your cat's creatinine suggests…", "elevated", "abnormal", or color-code severity. The only permitted framing is positional and attributed: "above the reference range printed on your lab report."
- **IRIS staging is explicitly out of scope** until Tier 1 citations (IRIS guidelines are the obvious primary source) are documented in `docs/research/` **and** a follow-up PRD is approved. Same for any analyte-specific guidance copy.
- The preset list itself (names/units) is nomenclature, not clinical guidance — no citation needed. Any *description* of what an analyte measures beyond its name is Tier 2-citable Wellness Guide territory and ships only with `docs/research/` entries.

### Why NOT the generic `measurements` table

Deliberate decision, documented here so it isn't relitigated: lab rows carry per-row `ref_low`/`ref_high`, per-row units that vary by lab, analyte identity, and panel (draw-date) grouping. Forcing that into `measurements(type, value, unit)` would require changing the measurements shape — which CLAUDE.md forbids — or lossy stuffing into notes. Labs also should not flow into the behavioral correlation engine or daily check-in. New table, additive only; `measurements` untouched.

---

## Data model sketch (D1, additive only)

```sql
CREATE TABLE IF NOT EXISTS lab_results (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id       TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who entered it
  taken_at     TEXT NOT NULL,   -- YYYY-MM-DD sample/draw date (panels group on this)
  analyte      TEXT NOT NULL,   -- preset key ('creatinine') or free text
  value        REAL NOT NULL,
  unit         TEXT NOT NULL,   -- exactly as printed on the report ('mg/dL', 'µmol/L', ...)
  ref_low      REAL,            -- from the user's lab report; nullable (some analytes print one bound)
  ref_high     REAL,
  note         TEXT,            -- 'fasted', 'in-clinic stress', lab name, etc.
  vet_visit_id TEXT REFERENCES vet_visits(id) ON DELETE SET NULL,  -- nullable; unused until PRD-vet-visits ships
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_results_cat_analyte ON lab_results(cat_id, analyte, taken_at);
CREATE INDEX IF NOT EXISTS idx_lab_results_cat_date    ON lab_results(cat_id, taken_at);
```

Shared additions:

- `shared/lib/types.ts`: `LabResult` interface (snake_case, `| null` nullables).
- `shared/lib/labPresets.ts` (new): `LAB_ANALYTES` — `{ key, label, commonUnits: string[] }[]`. Names and unit strings only; **no ranges, no descriptions**.
- `LIMITS` in `shared/lib/constants.ts`: `LAB_ANALYTE: 100`, `LAB_UNIT: 30`, `LAB_NOTE: 1000`.

---

## API sketch

Methods added to `CatTrackerApi` in `shared/lib/apiTypes.ts` first. Proposed authorization: **Contributor+ creates** (transcription is data entry, like measurements), **Editor+ edits/deletes** — confirm in Q4.

| Route | Notes |
|---|---|
| `GET /api/cats/:id/lab-results` | Optional `?analyte=creatinine` filter; sorted by `taken_at` |
| `POST /api/lab-results` | Body: `{ cat_id, taken_at, results: [{ analyte, value, unit, ref_low?, ref_high?, note? }] }` — batch-first so a panel is one request/one transaction; a single value is a one-element array |
| `PUT /api/lab-results/:id` | Single-row edit |
| `DELETE /api/lab-results/:id` | Single row; deleting a whole panel = client iterates (rare) |

Validation: `value`, `ref_low`, `ref_high` finite numbers; `ref_low <= ref_high` when both present; analyte/unit/note length limits; `taken_at` valid date not absurdly in the future. No range plausibility checks per analyte — that would smuggle in a clinical claim; warn only on obviously malformed input (Q5).

**Vet export**: export route/page adds a lab section — per analyte: rows of (date, value, unit, ref range), most recent first, capped sensibly for print — with the caption "Values and reference ranges transcribed by the owner from laboratory reports."

Not touched: notification inbox (no lab reminders in this PRD — recheck reminders belong to PRD-vet-visits), correlation engine, health alerts.

---

## UX notes (web + iOS — parity mandatory)

### Labs section on the cat profile (both platforms)

- New "Labs" area (placement per existing tab pattern) listing panels grouped by `taken_at` date — "Apr 12, 2026 — 12 values" — expanding to the analyte rows.
- Each analyte row: name, value + unit, the user-entered range beside it, and a neutral marker when outside that range (position dot on a range bar; **no red/alarm styling, no severity words** — outside-range display is attributed to "your lab's printed range").

### Panel entry

- "Add lab results" → date picker, then a scrollable form of preset analytes (value + unit + ref low/high per line) with an "add another analyte" free-text row. Blank lines are simply not saved.
- Per-cat, per-analyte prefill of unit and ref range from that analyte's most recent entry — visible and editable, never silently assumed; changed ranges save with that row only.
- Mobile-first: this form is the feature. Numeric keypads, tight tab order, one-thumb flow at 375px; iOS uses native keyboards and mirrors field order exactly.

### Trend chart

- Per-analyte line chart (tap an analyte from the Labs list): value series with the reference band shaded behind it.
- The band derives from each point's **own** ref values — if the lab (and thus range) changed mid-history, the band steps at that date rather than pretending one range covered everything.
- Points with no entered range plot without a band segment. Y-axis auto-scales to include both series and band. Chart follows existing chart-time-navigation and landscape conventions; iOS renders with the app's existing chart components.
- If the same analyte appears in mixed units across history, chart one unit at a time with a unit toggle — never silently convert (see Q1).

### Empty state

- "Track bloodwork over time. Enter values and reference ranges exactly as printed on your lab report." Sets the transcription framing immediately.

---

## Edge cases

- **Mixed units over time** (clinic switch, mg/dL → µmol/L): rows store what was printed; the chart never mixes units on one axis (unit toggle per above). No conversion in v1 (Q1).
- **Reference range changes between panels**: handled per-point (band steps); the panel form prefills the *latest* range but the user confirms each time.
- **One-sided ranges** (e.g., only an upper bound printed): `ref_low` null is valid; band renders open-ended.
- **USG and unitless analytes**: unit field accepts free text; presets carry the conventional unit string; no numeric special-casing.
- **Duplicate entry** (same cat/date/analyte twice): allowed — recheck same-day redraws exist — but the panel form warns when a value already exists for that date+analyte.
- **Typos producing wild values**: warn on suspicious magnitude relative to that cat's own history for the same analyte+unit (self-referential, not clinical); never block (Q5).
- **Deceased cats**: labs remain viewable from the memorial record's health history and in the export; no new entry from memorial UI (consistent with measurements).
- **Household roles**: viewers read; contributor/editor split per Q4; all members see the same data.
- **Free-text analytes**: trend chart matches on exact analyte string; the form nudges toward presets to keep series coherent.

---

## Out of scope

- **Any interpretation of values** — staging, severity, prognosis, "suggests", trend judgments ("worsening"). Blocked until Tier 1 citations exist in `docs/research/` **and** a dedicated PRD is approved.
- **IRIS staging** — explicitly named as out of scope; the most-requested and most citation-sensitive feature in this area.
- **Hardcoded reference ranges** — permanently out of scope by design, not just deferred.
- **Photo/OCR import of lab PDFs** — genuinely attractive future idea (snap the printout, confirm parsed values); noted for a future PRD, not this one. Manual entry only.
- Unit conversion between measurement systems (Q1 decides if ever).
- Lab-based reminders/notifications; labs in the correlation engine or daily check-in.

---

## Open questions for product owner

1. **Unit conversion (mg/dL ↔ µmol/L etc.):** v1 stores and displays exactly what the report printed, with a per-unit chart toggle for mixed histories. Is that acceptable, or is display-time conversion (with the conversion factor shown) required for households whose labs switched systems? Recommendation: no conversion in v1 — conversion factors are easy to get subtly wrong and wrongness here is costly.
2. **Panel presets:** should the entry form offer named panel groupings (e.g., a "renal panel" set that pre-expands creatinine/BUN/SDMA/phosphorus/potassium/USG)? Groupings are just entry conveniences (names only), but the *composition* of a named panel edges toward clinical framing — confirm comfort level or ship analyte-list-only.
3. **InsightsPanel:** should recent lab trends appear in InsightsPanel at all (even as neutral "creatinine: 4 entries, last Apr 12")? InsightsPanel is alert-adjacent surface area; anything beyond factual recency risks implying interpretation. Recommendation: keep labs out of InsightsPanel in Phase A.
4. **Authorization split:** Contributor+ to create (like measurements) with Editor+ to edit/delete — or Editor-only throughout (like medications)?
5. **Sanity warnings:** is the self-referential magnitude warning (vs. the cat's own history) wanted, or should v1 validate format only?

---

## Acceptance criteria

- [ ] A user can enter a full multi-analyte panel for one date in a single screen and single request, on web and iOS.
- [ ] Every stored row carries the unit and (optionally) the reference range exactly as entered; the app contains **zero** built-in reference ranges — verified by test asserting no range constants exist for any analyte.
- [ ] Per-analyte trend chart renders the value series with the user-entered reference band, stepping when entered ranges change; mixed-unit histories never share an axis.
- [ ] No UI, push, or export surface renders interpretive copy for lab values (no "elevated/abnormal/suggests", no severity colors); out-of-range display is neutral and attributed to the user's lab report.
- [ ] Preset analyte list lives in `shared/lib/` with names/units only and is consumed by both platforms.
- [ ] Vet export includes the lab history section with the owner-transcription caption.
- [ ] Unit/range prefill comes from the cat's own prior entries and is always visible and editable at entry time.
- [ ] Edit and delete work per the agreed role split; unauthorized roles are rejected by the worker.
- [ ] `measurements` table shape unchanged; migration is a single additive `CREATE TABLE IF NOT EXISTS` in schema.sql, applied local + remote.
- [ ] `CatTrackerApi` gains the lab methods first; web and iOS clients implement; all four test suites pass.
