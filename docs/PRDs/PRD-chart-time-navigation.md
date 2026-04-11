# PRD: Chart Time Range & Swipe Navigation

> **Status:** Draft
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11

---

## Problem Statement

The Compare Chart (and individual cat charts) show all-time data with no way to zoom into a specific period. For cats with months or years of data, the chart becomes cluttered and trends within a specific timeframe are hard to read. Users have no quick way to compare "this month vs last month" or focus on a period around a vet visit.

---

## Goals

1. Let users select a time range for chart data (e.g., 1 week, 1 month, 3 months, 6 months, 1 year, all time)
2. Enable swipe-to-navigate: swipe left/right to shift the window forward/backward in time
3. Apply consistently across CompareChart, WeightChart, MeasurementChart, and CorrelationChart
4. Default to **3 months** — long enough to show trends, short enough to be readable

## Non-Goals

- Pinch-to-zoom (future enhancement — complex gesture handling)
- Custom date range picker with calendar UI (future — start with preset ranges)
- Data aggregation/downsampling for large datasets (future)

---

## Requirements (stub — to be fleshed out)

### R1: Range Selector
- Horizontal pill bar above the chart: `1W | 1M | 3M | 6M | 1Y | All`
- Default selection: 3M
- Persisted per-session (not across app restarts)
- When range changes, chart animates to the new window

### R2: Swipe Navigation
- Swipe left on the chart → shift window forward by half the range duration
- Swipe right → shift window backward by half the range duration
- Subtle left/right arrow indicators at chart edges when more data exists in that direction
- "Today" pill appears when the window doesn't include the current date — tap to snap back
- On native: use gesture handler for smooth swipe. On web: touch events or drag.

### R3: Chart Adaptation
- X-axis labels adapt to the range (days for 1W, weeks for 1M/3M, months for 6M/1Y)
- Data density: show individual dots for 1W/1M, aggregate to weekly for 3M+
- Empty ranges show a centered "No data in this period" message

### R4: Compare Chart Integration
- Range selector applies to all cats simultaneously
- Swipe navigates all series together (synchronized window)

---

## Open Questions

1. **Default range:** 3 months is proposed. Should it be adaptive — e.g., if a cat only has 2 weeks of data, default to 1M instead?
2. **Range memory:** Should the selected range persist across screens (e.g., if you pick 1M on Compare, does CatProfile also default to 1M)?
3. **Correlation chart:** Should the correlation chart respect the same time window, or does it need its own range (since correlations require minimum 4 weeks of data)?
4. **Animation style:** On range change, should the chart crossfade, slide, or re-render in place?

---

*Last updated: 2026-04-11*
