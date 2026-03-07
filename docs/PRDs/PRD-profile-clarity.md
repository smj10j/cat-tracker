# PRD: Cat Profile — Insights Panel Clarity

| | |
|---|---|
| **Status** | `Approved` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |

---

## Problem

The top of the cat profile page can become visually overwhelming when multiple conditions are true simultaneously:

1. An urgent or concerning weight alert is visible
2. A confluence cluster alert is visible ("Multiple signals — Kidney/Thyroid/DM cluster")
3. Two or three individual correlation descriptions are listed
4. An "Explore measurement patterns" toggle button is visible

In this state, a user must scroll past 4–6 distinct informational blocks before reaching the chart and measurement form — the core of the page. Each block is styled with its own border and background, so the panel feels like a wall of callouts rather than structured information.

### What must NOT be lost

- Health alerts (urgent/concerning/watch) are actionable and must stay prominent
- Correlation patterns are valuable but secondary — they don't require immediate action
- The confluence cluster warning is the most important pattern signal; it should surface even in a collapsed state
- The "Explore" chart interaction is discovery-level; it can be subordinate to the text patterns

---

## Goals

1. Reduce the default visual footprint of the insights panel when there are many signals
2. Preserve immediate visibility of health alerts
3. Keep all existing information accessible without scrolling past a wall before the chart
4. No functionality removed — just reorganized

---

## Design

### Health alert section (unchanged)

The health headline, summary, and "What to watch for" CTA remain fully visible whenever status is `watch`, `concerning`, or `urgent`. These require attention and should not be collapsed.

### Patterns section — collapsible, collapsed by default

Replace the always-expanded patterns section with a single collapsible row:

**Collapsed (default) state:**

```
[icon] Patterns  ·  [N detected badge]  ·  [⚠️ if confluence]        ↓
```

- Icon: 📊
- Label: "Patterns"
- Badge: "N detected" (e.g., "2 detected") — muted brand color; "None yet" if 0
- If a confluence cluster is detected: show a small amber "⚠️ Multiple signals" pill inline
- Chevron: rotates on expand
- Clicking anywhere on the row expands/collapses

**Expanded state:**

Same content as current "Patterns detected" section plus "Explore" chart:
1. Confluence alert card (if present)
2. Individual correlation descriptions (or "No patterns detected yet" empty state)
3. "Explore measurement patterns" chart toggle (moved from its own section into here)

### Visual simplification

- Remove the separate "Explore measurement patterns" section — it moves inside the expanded patterns section
- The three-section panel (health + patterns + explore) becomes two sections: health + patterns
- When no health alert exists, the panel may show only the collapsible patterns row — much lighter default footprint

---

## Behavior Details

| Condition | Default appearance |
|-----------|-------------------|
| No health alert, no patterns | Panel hidden (no change) |
| No health alert, patterns exist | Collapsed patterns row only |
| Health alert, no patterns | Health alert only |
| Health alert + patterns, no confluence | Health alert + collapsed patterns row |
| Health alert + patterns + confluence | Health alert + collapsed patterns row (⚠️ pill visible in header) |

### Persistence

Collapse state is not persisted across navigation — reset to collapsed on every page load. Users who want to see patterns will expand once per visit, which is reasonable for secondary information.

---

## Implementation Notes

- All changes in `frontend/src/components/InsightsPanel.tsx`
- Merge `exploreOpen` state into the patterns expansion state (single `patternsOpen` boolean)
- The `CorrelationChart` renders inside the expanded patterns section
- Keep the same panel border/background coloring logic (health status drives panel chrome)
- The collapsed patterns row should use a subtle background distinguishable from the health section divider

---

## Non-goals

- No changes to CorrelationChart internals
- No changes to health alert content or styling
- No changes to the cat profile page layout outside of InsightsPanel
