# PRD: Charts Expansion — Multi-Type Compare & Profile Chart by Tab

**Status:** Approved for implementation
**Scope:** Compare screen supports all measurement types; CatProfile chart follows active tab

---

## 1. Compare Screen — All Measurement Types

### Problem

CompareChart always fetches and displays `type=weight`. Users can't compare food intake, water intake, or behavioral observations across cats.

### Proposal

Add a type selector at the top of the Compare screen. When the type changes, re-fetch measurements for all cats using the new type and redraw the chart.

### Type options

Same set as QuickAdd: Weight · Food · Water · Litter Box · Grooming · Activity · Vomiting

### Chart behavior by type

- **Weight**: numeric Y axis (lbs/kg); keep health-status dots (✅/👀/⚠️/🚨)
- **Scale types (food/water/litter/grooming/activity/vomiting)**: Y axis 0–3 with label ticks (None/Some/Most/All etc.); use plain dots (no health scoring — thresholds not defined for these types yet)

### Tooltip

- Weight: show `{value} lbs`
- Scale types: show preset label (e.g. "Most") via `getPresetLabel(type, value)`

### Health dots on non-weight types

Skip health-status coloring for non-weight measurements — use the line's own color for dots. Health analysis for behavioral types is a future PRD.

### Files affected

- `frontend/src/pages/CompareChart.tsx` — add type selector state, re-fetch on change, conditional Y axis

---

## 2. CatProfile — Chart Follows Active Tab

### Problem

The chart in CatProfile always shows weight regardless of which tab is active. Selecting the "Food" tab shows the food history list but still displays the weight chart above it.

### Proposal

Show a relevant chart above the history list for each tab:

| Tab | Chart |
|-----|-------|
| Weight | WeightChart (existing — health dots, area fill, health-colored Y domain) |
| Food | MeasurementChart with scale labels |
| Water | MeasurementChart with scale labels |
| Behavior | No chart — behavior mixes multiple types; history table is more useful |
| All | No chart — too many mixed types; history table only |

### MeasurementChart component (new)

A shared generic chart for 0–3 scale measurements:
- Reuses the same AreaChart visual style (dark grid, gradient line, gradient fill)
- Y axis: fixed 0–3, tick labels mapped to preset labels for the current type
- Dots: plain colored (no health status — just the lavender/amber gradient)
- Tooltip: shows preset label + date
- Props: `measurements: Measurement[], type: string`

### Files affected

- `frontend/src/components/MeasurementChart.tsx` — new generic chart component
- `frontend/src/pages/CatProfile.tsx` — render chart based on active tab
