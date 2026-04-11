# PRD: Behavioral Trend Charts

> **Status:** Draft
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11

---

## Problem Statement

Users log behavioral observations daily (food intake, water, grooming, activity, litter, vomiting) using 0-3 scale presets. This data accumulates but is only visible as a history list of individual entries. There's no way to visualize behavioral trends over time — whether a cat's appetite has been declining over weeks, whether grooming returned to normal after a medication change, or whether vomiting frequency is increasing.

The web frontend has `MeasurementChart.tsx` which renders scale charts for behavioral types, and the CatProfile has a chart sub-selector. But the iOS app currently only shows a weight trend chart on the Health tab — behavioral data has no visual representation.

---

## Goals

1. Show behavioral measurement trends as time-series charts on the CatProfile Health tab
2. Let users switch between measurement types (weight, food, water, grooming, activity, litter, vomiting) with a chart type selector
3. Render the 0-3 scale values with human-readable Y-axis labels (e.g., "None / Some / Most / All" for food)
4. Surface multi-week patterns visually so users notice gradual changes before they become emergencies

## Non-Goals

- Aggregate/average behavioral data into weekly summaries (future — show raw daily observations first)
- Correlation visualization between behavioral types (handled by CorrelationChart, separate feature)
- Behavioral alerts/notifications (handled by healthMetrics.ts and InsightsPanel)

---

## Requirements (stub — to be fleshed out)

### R1: Chart Type Selector
- Horizontal pill bar on CatProfile Health tab, above the chart: `Weight | Food | Water | Litter | Grooming | Activity | Vomiting`
- Default: Weight (current behavior)
- Switching types replaces the chart with the selected type's data
- Active pill uses lavender accent; dimmed pills show types that have data vs. no data

### R2: Behavioral Scale Chart
- Y-axis: 0-3 with preset labels (not just numbers)
  - Food/Water: None (0) / Some (1) / Most (2) / All (3)
  - Grooming: None / Less / Normal / Excessive
  - Activity: Lethargic / Low / Normal / Active
  - Vomiting: None / Once / A few times / Many times
  - Litter: Not used / Straining / Loose / Normal
- X-axis: dates (adaptive per PRD-chart-time-navigation.md when implemented)
- Data points shown as dots connected by lines
- Dot color: green for "normal" values (varies by type), amber/red for concern values

### R3: Behavioral Trend Insight
- Below the chart, a one-line trend summary: "Food intake has been declining over the past 2 weeks" or "Grooming is stable at Normal"
- Uses the existing `detectTrend()` function from `correlations.ts` (compares first-half vs second-half average)

### R4: Empty State
- Types with no data show: "No [food] observations yet. Log a check-in to start tracking."
- Link to Daily Check-In screen

---

## Existing Infrastructure

| Component | Location | Status |
|-----------|----------|--------|
| `MeasurementChart.tsx` | `frontend/src/components/` | Web only — uses Recharts |
| `LineChart.tsx` | `app/components/` | iOS — uses Victory Native XL, supports multi-series |
| `measurementPresets.ts` | `app/lib/` (shared) | Preset labels for all behavioral types |
| `correlations.ts` → `detectTrend()` | `app/lib/` (shared) | Trend detection (rising/falling/stable) |
| Chart sub-selector | `frontend/src/pages/CatProfile.tsx` | Web only — `chartTab` state switching between types |

The iOS implementation mainly requires wiring the existing `LineChart` component with a type selector and scale-aware Y-axis labels. The pure TS logic is already shared.

---

## Open Questions

1. **Chart style for 0-3 scale:** Line chart (connecting dots) or step chart (horizontal segments with vertical jumps)? Step might be more accurate for discrete 0-3 values. Line suggests continuous data which isn't quite right.
2. **Multiple observations per day:** If a user logs food twice in one day (morning and evening), show both dots? Average them? Show the latest?
3. **"Normal" range shading:** Should the chart show a green-tinted band for the "normal" range of each type? E.g., food "Most" to "All" is normal, so shade that region. This visually highlights when values dip below normal.

---

*Last updated: 2026-04-11*
