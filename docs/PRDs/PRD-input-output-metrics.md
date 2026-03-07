# PRD: Input vs Output Metric Framing

**Status:** Implemented
**Scope:** Correlation chart UX + correlations.ts classification

---

## Problem

The "Explore measurement patterns" chart currently lets users pick any two measurement types for comparison — including backwards pairs (weight → food) and same-category pairs (food → water). This causes two issues:

1. **Direction confusion**: weight → food implies weight changes cause food changes, which is backwards. The causal arrow always runs input → outcome.
2. **Misleading correlations**: food vs water are both inputs. They may be correlated (a sick cat eats and drinks less), but showing this as a lag correlation chart implies one predicts the other, which misframes the insight.

The food+water declining together *is* a meaningful clinical signal, but it's better surfaced as a proactive "both inputs are falling" pattern, not a lag correlation.

---

## Classification

| Type | Category | Rationale |
|------|----------|-----------|
| food | Input | Consumption — leading indicator |
| water | Input | Consumption — leading indicator |
| grooming | Input | Self-care behavior — leading indicator |
| activity | Input | Physical behavior — leading indicator |
| play | Input | Engagement behavior — leading indicator |
| weight | Outcome | Primary physical health output |
| vomiting | Outcome | GI symptom — sign of internal state |
| litter | Outcome | Elimination pattern — sign of internal state |

---

## Change: Explore chart selectors

**Before:** both dropdowns show all available types; disabled on same selection.

**After:**
- Left dropdown (labeled "Input / behavior"): only Input types available in this cat's data
- Right dropdown (labeled "Health outcome"): only Outcome types available in this cat's data
- Default: first available input on left, weight on right
- If the cat only has outcome types logged (no inputs): hide the explore section and show a nudge to log behavioral types

**Labels make the question explicit:** "Does [food intake] predict [weight]?"

---

## What stays the same

The proactive `detectCorrelations()` function already only checks input→outcome pairs (KNOWN_PAIRS). No change needed there.

The food+water simultaneous decline is not surfaced here. It could be a future pattern rule in `detectCorrelations()` (e.g., "both food and water intake have been declining — this combination warrants a vet check").

---

## Why this is worth doing

- Prevents nonsensical comparisons from appearing in the UI
- Makes the chart's purpose self-evident ("does this behavior predict this outcome?")
- Reduces the number of options in each dropdown, making selection faster
- Consistent with how the proactive detection already works
