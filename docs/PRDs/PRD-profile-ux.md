# PRD: Cat Profile UX — Insights Panel & History Timeline

**Status:** Implemented
**Scope:** CatProfile.tsx layout refactor — two focused improvements

---

## Problem

### 1. Scattered insights, buried Trends

The cat profile currently has three separate alert cards (health status, "pay attention", "vet now") that render at the top as a stack, followed by a chart area, then a history section with a Trends tab buried in the tab bar. Problems:

- The three alert cards are disconnected from each other and from the correlation data
- The Trends tab is invisible unless the user notices it in the tab bar
- Detected correlations (e.g., "Kylo's food dropped before his weight dropped") are only surfaced *after* the user manually picks two types from dropdowns — the insight is reactive, not proactive
- No single glanceable section answers "what should I know about this cat right now?"

### 2. Measurement history is a flat wall of text

The history section renders all entries as a single reverse-chronological list. A cat with 9 weeks of data across 6 types can have 80+ entries with no visual grouping. It's not scannable and gets worse over time.

---

## Goals

1. Merge health alerts + correlations into one **Insights section** that's the authoritative "what to know" panel, visually weighted by severity
2. Surface detected correlations proactively — tell the user what patterns exist, don't make them guess
3. Keep the interactive correlation chart accessible but out of the way unless wanted
4. Make the measurement history **scannable** — grouped by day, default to recent entries, easy to dig deeper

---

## Design: Insights Panel

### Location
Directly below the hero header, replacing the current three separate alert cards.

### When it's shown
Always, as long as there's at least one weight measurement or one detected correlation. The panel may have no health alert content (if weight is stable) but can still show correlation insights.

### Severity tinting
The panel border and background tint are driven by the most severe signal present:
- Urgent weight status → rose tint + pulsing border
- Concerning weight status → coral/orange tint
- Watch weight status → amber/honey tint
- OK weight, notable correlation → lavender/purple tint (neutral insight)
- OK weight, no correlations → not shown (clean slate)

### Panel sections (in order)

**1. Health summary** (shown if status != ok and >= 2 weight measurements)
- Current: the icon + bold copy + health.summary paragraph — keep as-is

**2. What to watch** (shown if watch/concerning/urgent)
- Current: the "Pay attention to..." list — keep content, consolidate visual treatment

**3. Vet signs** (shown if concerning/urgent)
- Current: the "Take to the vet NOW" list — keep content

**4. Detected patterns** (shown if >= 2 measurement types logged)
- New: proactively computed from detectCorrelations()
- Each notable/weak correlation shown as a short text card:
  - Header: e.g., "Food intake → Weight" with a strength indicator dot
  - Body: the describeCorrelation() copy, e.g., "Kylo's food intake tends to drop about 2 weeks before his weight drops. Watching food intake can give you an early signal."
- If no correlations yet: "No patterns detected — keep logging to see trends emerge"

**5. Explore correlations** (collapsible, shown if >= 2 types)
- A "Explore correlations ↓" toggle button at the bottom of the Insights panel
- Expands to reveal the full CorrelationChart (type selectors + chart), collapsed by default
- Gives access to the interactive comparison without cluttering the default view

### Tab bar change
Remove "Trends" from the history tab bar — it now lives in Insights.

---

## Design: Measurement History Timeline

### Grouping
Group all entries by calendar day (Today, Yesterday, Mon Jan 6, etc.).
Within each day group, entries are sorted most-recent-first by time.

### Default view
Show groups that fall within the last **14 calendar days**.
- If there are no entries in that window, fall back to showing the 3 most recent day groups.
- If the filtered data (based on active type tab) produces no entries in the window, show the most recent 3 groups for that type.

### Older entries
If entries exist outside the 14-day window: show a muted "View N older entries" button at the bottom.
Tapping it reveals all day groups (no pagination needed — the data is small).

### Day header format
```
Today · 3 entries
Yesterday · 1 entry
Mon, Jan 6 · 2 entries
```

### Type filter tabs
The existing Weight / Food / Water / Behavior / All tabs continue to work — they filter which types appear across all day groups.

---

## Implementation Order

1. Write PRD (this doc)
2. Create `InsightsPanel.tsx` component
3. Rewrite history section in CatProfile with grouped timeline + load-older
4. Update CatProfile: replace 3 alert cards with InsightsPanel; remove Trends tab from tab bar; update Tab type
5. Update REGISTRY.md + TODO.md
6. Deploy + commit

---

## Open Questions (resolved)

1. **Should Insights be collapsible?** No — always show expanded. The content is too important to hide behind a toggle. On clean slate (OK + no correlations) the section is omitted entirely.

2. **What if there's no weight data at all?** Skip the health summary and vet sections; still show detected correlations if 2+ other types exist.

3. **Explore chart: default open or closed?** Closed by default. The proactive text cards answer "what patterns exist"; the chart is for "let me dig into this specific pair". Keeping it collapsed avoids visual overload.

4. **Should the history grouping reset when the type tab changes?** Yes — switch tab → reset to default 14-day window view.
