# PRD: UX Simplification — Ease of Data Entry

**Status:** Approved
**Priority:** High — ease of use is a core product value
**Context:** This app is used by cat owners (and potentially shelter staff) who need to log data quickly and often. The fundamental UX principle is: **if logging feels like a chore, people won't do it**. Every interaction should be doable with one thumb while holding a cat.

---

## Guiding Principle

**Data entry must be effortless.** A frazzled shelter employee holding their iPhone with one hand, with a cat in the other, must be able to log an observation in 3 taps or fewer. Precision is secondary to frequency — it's more valuable to have daily "most of their food" logs than occasional exact gram counts.

---

## 1. Navigation: Center Button → Log Measurement

**Problem:** The BottomNav center "+" button navigates to `/cats/new` (add a cat). Adding a cat is a rare action. Logging a measurement is the most frequent action in the app.

**Proposal:**
- The center "+" button in BottomNav opens the QuickAdd measurement sheet (not a navigation link)
- Remove the separate floating 📊 trigger button (it was a workaround for this missing connection)
- Re-label the center button to "Log" to reflect its new purpose

**Implementation notes:**
- Move QuickAdd rendering to `PageShell` so it's always available regardless of current page
- BottomNav receives an `onLog` callback prop instead of using a NavLink
- QuickAdd fires a `measurementAdded` browser custom event on success; Home page listens and re-fetches

---

## 2. Home Screen: "Add a Cat" in the List, Not the Nav

**Problem:** Adding a cat is a rare action that currently occupies prime real estate in the BottomNav. It creates confusion when the center button now opens QuickAdd.

**Proposal:**
- Add an "＋ Add a cat" item at the bottom of the cat list on the Home page
- Style it as a dashed-border card — clearly secondary to the actual cat cards
- Clicking it navigates to `/cats/new`
- BottomNav center button label changes from "Add Cat" to "Log"

---

## 3. Cat Wellness Guide — Dedicated Page

**Problem:** The wellness accordion section on the Home page takes up significant vertical space. It's educational content that users may want to reference occasionally, but it dominates the primary use case (viewing cats and logging data).

**Proposal:**
- Move the four wellness cards (Monthly Self-Check, Normal Vitals, Always Call the Vet, Nutrition Basics) to a dedicated `/wellness` route
- On the Home page, replace the accordion section with a single tappable button: "Cat Wellness Guide →"
- The Wellness page uses the same collapsible card pattern but has room to expand
- Add Wellness to the routes in `App.tsx`

---

## 4. Simplified Behavioral Measurement Inputs

**Problem:** The current behavioral measurement types (food, water, litter, grooming, activity, vomiting) use numeric freeform input. This is slow, error-prone, and requires the user to decide on a number. For qualitative observations, a predefined scale is both faster and more meaningful.

**Guiding constraint:** Each measurement type should be logable in 2 taps after selecting the cat — one tap to pick the type, one tap to pick the level.

### Input type: Tap-to-select preset buttons (not a number field)

Replace the numeric input for behavioral types with a row of large tap targets. Tapping a preset immediately sets value + unit.

### Presets by type

| Type | Options (displayed) | Stored value | Unit |
|------|---------------------|-------------|------|
| Food intake | None · Some · Most · All | 0 / 1 / 2 / 3 | scale |
| Water intake | None · Some · Most · All | 0 / 1 / 2 / 3 | scale |
| Litter box | Not used · Diarrhea · Straining · Normal | 0 / 1 / 2 / 3 | scale |
| Grooming | Not grooming · Less · Normal · Excessive | 0 / 1 / 2 / 3 | scale |
| Activity | Lethargic · Low · Normal · Active | 0 / 1 / 2 / 3 | scale |
| Vomiting | None · Once · A few times · Many times | 0 / 1 / 2 / 3 | scale |

**Weight** stays as a numeric input — exact weight in lbs/kg is the key clinical metric.

### Display in history

When `unit === 'scale'`, display the label string (e.g. "Most") instead of the numeric value. Implement a shared `getPresetLabel(type, value)` helper in `lib/measurementPresets.ts`.

### Breaking change note

Existing measurements stored with old units (`/5`, `episodes`, `visits`) display as-is. New entries use `unit: 'scale'` with the 0-3 numeric scale. No migration needed — the old data is minimal and the types are distinct enough in context.

---

## Files Affected

### New
- `frontend/src/pages/WellnessGuide.tsx` — dedicated wellness content page
- `frontend/src/lib/measurementPresets.ts` — preset definitions + label helper

### Modified
- `frontend/src/components/BottomNav.tsx` — center button → onLog callback, label "Log"
- `frontend/src/components/PageShell.tsx` — render QuickAdd with open/close state
- `frontend/src/components/QuickAdd.tsx` — remove floating trigger button; use presets for behavioral types; fire custom event on success; accept open/onClose props
- `frontend/src/components/MeasurementForm.tsx` — use presets for behavioral types
- `frontend/src/pages/Home.tsx` — add "Add a cat" card; replace wellness accordion with link button; remove QuickAdd render; listen for measurementAdded event
- `frontend/src/App.tsx` — add `/wellness` route
- `README.md` — update docs paths
- `CLAUDE.md` — add PRD folder convention

---

## Out of Scope

- Changes to the database schema
- Changes to the Worker API
- Health metric calculations for behavioral types (future PRD)
- Auto-submit on preset tap in MeasurementForm (QuickAdd only, to keep inline form deliberate)
