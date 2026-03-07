# PRD: Measurement UX Fixes

**Status:** Implemented
**Scope:** Fix mobile horizontal scroll in QuickAdd type selector; refine behavioral preset labels

---

## 1. Mobile Type Selector — No Horizontal Scroll

### Problem

QuickAdd's measurement type selector renders 7 pill buttons in a `flex overflow-x-auto` row. On a 375px iPhone screen, only ~3 pills are visible and the user must scroll horizontally — a poor one-thumb experience.

### Proposal

Replace the horizontal scrolling pill row with a native `<select>` dropdown. The OS picker is thumb-friendly, requires zero horizontal scrolling, and is accessible by default.

**Before:** Horizontal scrolling pills
**After:** Single `<select>` styled with `input-dark`

This reduces the interaction to: select cat → pick type → tap preset. Three steps, no scrolling.

---

## 2. Behavioral Preset Label Review

### Food intake

| Label | Value | Concern | Notes |
|-------|-------|---------|-------|
| None | 0 | ✅ | Ate nothing — always concerning |
| Some | 1 | — | Less than half |
| Most | 2 | — | More than half |
| All | 3 | — | Finished the bowl |

✅ **No changes needed.**

### Water intake

Same scale as food. ✅ **No changes needed.**

### Litter box

Current: Not used · Diarrhea · Straining · Normal
Issues:
- "Straining" is more urgent than "Diarrhea" in cats (potential urinary blockage, esp. in males) but has a higher value (less bad). Values should reflect clinical severity.
- "Not used" and "Straining" can both mean urinary blockage — should both be flagged as urgent concern.

**Revised:**

| Label | Value | Concern | Notes |
|-------|-------|---------|-------|
| Not used | 0 | ✅ | No litter visit — could be blocked |
| Straining | 1 | ✅ | Trying with little output — potential blockage (urgent in males) |
| Loose/Diarrhea | 2 | ✅ | Loose or liquid stool |
| Normal | 3 | — | Normal visit |

### Grooming

Current: "Not grooming" is 10 chars — too long for a tap button.

**Revised:**

| Label | Value | Concern | Notes |
|-------|-------|---------|-------|
| None | 0 | ✅ | Not grooming / matted coat |
| Less | 1 | — | Less than their usual baseline |
| Normal | 2 | — | Typical for this cat |
| Excessive | 3 | ✅ | Overgrooming, hair loss, skin irritation |

### Activity

✅ **No changes needed.** (Lethargic · Low · Normal · Active)

### Vomiting

✅ **No changes needed.** (None · Once · A few times · Many times)

---

## Files Affected

- `frontend/src/components/QuickAdd.tsx` — type `<select>` dropdown
- `frontend/src/lib/measurementPresets.ts` — update litter and grooming labels/values
