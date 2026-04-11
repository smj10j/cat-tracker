# PRD: Chart Time Range & Swipe Navigation

> **Status:** Approved
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11

---

## Problem Statement

The Compare Chart (and individual cat charts) show all-time data with no way to zoom into a specific period. For cats with months or years of data, the chart becomes cluttered and trends within a specific timeframe are hard to read. Users have no quick way to compare "this month vs last month" or focus on a period around a vet visit.

This is also a prerequisite for meaningful chart display in the iOS app, where screen space is more constrained and touch gestures are the primary interaction model.

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
- Server-side filtering — all data is already fetched; filtering is client-side
- Re-computing health assessments per visible window — `assessHealth()` always uses full history; status emoji on visible dots reflect the global assessment, not the windowed view

---

## Requirements

### R1: Range Selector

- Horizontal pill bar above the chart: `1W | 1M | 3M | 6M | 1Y | All`
- Default selection: **All** (preserves current behavior — changing the default to a shorter range would make existing users think their data disappeared). Once users have had time to discover the range selector, a future PRD can revisit defaulting to 3M for cats with > 6 months of data.
- Persisted per-session (not across app restarts) — stored in React state, not localStorage
- When range changes, chart animates to the new window (Recharts `animationDuration={300}`)
- The pill bar is a shared component used by all chart types (see implementation below)
- Active pill uses the `brand-lavender` accent; inactive pills use `surface-hi` with `ink-dim` text
- Touch target: each pill is at least 44px tall (accessibility requirement from PRD-accessibility.md)
- **Small screens (375px):** 6 pills at 44px height may not fit comfortably in a single row at readable text sizes. If the pills overflow, use a horizontally scrollable strip (not wrapping to a second row — that pushes the chart too far down). Test at 375px during implementation and adjust pill padding/font-size before shipping.

### R2: Swipe Navigation

- Swipe left on the chart area → shift window forward in time by **half the range duration**
- Swipe right on the chart area → shift window backward by **half the range duration**
- Subtle left/right chevron indicators (`‹` / `›`) at chart edges when more data exists in that direction
- **"Today" pill** appears when the window doesn't include the current date — tap to snap back to the most recent window
- The window cannot scroll past today (future dates have no data)
- The window cannot scroll before the earliest measurement date (show empty state if approached)
- **Web:** detect swipe via `touchstart`/`touchend` delta (minimum 50px horizontal, maximum 30px vertical — this prevents triggering on diagonal scrolls). Do not call `preventDefault()` on `touchmove`, which would block vertical page scrolling. **Recharts tooltip conflict:** Recharts uses `onMouseMove`/`onTouchMove` for tooltip positioning. The swipe handler must coexist: use a dedicated touch layer (`SwipeableChart` wrapper) *outside* the Recharts `ResponsiveContainer`, not on the SVG itself. This avoids intercepting Recharts' internal touch handling.
- **Native (iOS app):** use `react-native-gesture-handler` `PanGestureHandler` with `activeOffsetX` threshold. This integrates cleanly with Expo's gesture system.
- Visual feedback: during active swipe, the chart content shifts horizontally to follow the finger (translateX on the wrapper div). On release, animate to the new window position or snap back if the swipe was insufficient.

### R3: Adaptive X-Axis Labels

X-axis labels should adapt to the selected range to avoid label crowding:

| Range | Label format | Approximate tick count |
|-------|-------------|----------------------|
| 1W | Day names: "Mon", "Tue", "Wed" | 7 |
| 1M | Day of month: "1", "8", "15", "22" | 4–5 |
| 3M | Week start dates: "Jan 6", "Jan 13" or month names if sparse | 6–8 |
| 6M | Month names: "Jan", "Feb", "Mar" | 6 |
| 1Y | Month names: "Jan", "Mar", "May" (every other) | 6 |
| All | Year+month: "Jan '25", "Jul '25" | 4–8 adaptive |

Recharts supports custom `tickFormatter` on `XAxis` — use a function that takes the range as a closure parameter.

### R4: Compare Chart Integration

- The range selector applies to **all cats simultaneously** — there is one shared range, not per-cat ranges
- Swipe navigates all series together (synchronized window)
- When the type selector changes on CompareChart, the range selection is preserved (don't reset to 3M)

### R5: Empty Range Handling

- When the selected window contains no data points, show a centered `ink-dim` message: "No measurements in this period"
- When the window contains only 1 data point, still render it (a single dot with its value label)
- The "Today" pill and swipe arrows still function in empty-range state so the user can navigate to a period with data

### R6: Correlation Chart Interaction

- The correlation chart uses its own time window for **data computation** (correlations require minimum 4 weeks of aligned data)
- The **display range** on the normalized dual-line chart should respect the range selector
- If the selected range is shorter than the minimum correlation window (4 weeks), **hide the correlation section entirely** rather than showing it with confusing disclaimers. Users don't understand "computed over a longer period" — they just see a chart that doesn't match the range they selected. Simpler to hide it and let the full-range "All" view show correlations.
- If no correlation data exists within the range at any range setting, collapse the section with no message (same as current behavior when insufficient data exists)

---

## Technical Scope

### Shared Component: `ChartRangeSelector`

```
frontend/src/components/ChartRangeSelector.tsx
```

Props:
- `range: TimeRange` — current selection
- `onRangeChange: (range: TimeRange) => void`
- `windowStart: Date` — current window start (for "Today" pill visibility)
- `onNavigate: (direction: 'back' | 'forward' | 'today') => void`
- `hasOlderData: boolean` — show left arrow
- `hasNewerData: boolean` — show right arrow (and "Today" pill)

Types:
```typescript
type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'

interface ChartWindow {
  range: TimeRange
  windowEnd: Date   // always the "right edge" of the visible window
}

// Approximate day counts — used for window size calculation.
// Calendar-month precision is not needed: the purpose is to set a
// visible window size, not to align to calendar boundaries.
// A user who selects "1M" expects ~30 days of data, not exactly
// "Feb 11 to Mar 11." The slight imprecision (±1 day) is invisible
// in the chart and avoids complex calendar arithmetic.
const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': null
}
```

The `windowEnd` starts at today. Swiping backward moves it into the past. "Today" resets it to today. The visible data is `windowEnd - RANGE_DAYS[range]` to `windowEnd`.

### Hook: `useChartWindow`

```
frontend/src/lib/useChartWindow.ts
```

A custom React hook that manages the range/window state and provides filtered data.

**Precondition:** `measurements` must be sorted by `measured_at` ascending. This is already the case for all existing callers — the API returns measurements in chronological order and the existing chart components depend on this. The hook uses `measurements[0]` for "earliest data" detection; unsorted input would produce incorrect `hasOlderData` results.

**Performance:** The `filteredData` memo runs `Array.filter()` with `new Date()` construction per item. For typical datasets (< 500 measurements per cat), this is < 1ms. For cats with 1000+ measurements over multiple years, the filter is still O(n) and negligible compared to Recharts' SVG rendering cost. No optimization needed.

```typescript
function useChartWindow(measurements: Measurement[]) {
  const [range, setRange] = useState<TimeRange>('All')
  const [windowEnd, setWindowEnd] = useState(() => new Date())

  const windowStart = useMemo(() => {
    const days = RANGE_DAYS[range]
    if (days === null) return null  // "All" range
    const d = new Date(windowEnd)
    d.setDate(d.getDate() - days)
    return d
  }, [range, windowEnd])

  const filteredData = useMemo(() => {
    if (!windowStart) return measurements
    return measurements.filter(m => {
      const d = new Date(m.measured_at)
      return d >= windowStart && d <= windowEnd
    })
  }, [measurements, windowStart, windowEnd])

  const navigate = useCallback((direction: 'back' | 'forward' | 'today') => {
    if (direction === 'today') {
      setWindowEnd(new Date())
      return
    }
    const days = RANGE_DAYS[range]
    if (days === null) return  // can't navigate in "All" mode
    const shift = Math.floor(days / 2)
    setWindowEnd(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + (direction === 'forward' ? shift : -shift))
      // Don't scroll past today
      const today = new Date()
      if (next > today) return today
      return next
    })
  }, [range])

  const hasOlderData = useMemo(() => {
    if (!windowStart || measurements.length === 0) return false
    const earliest = new Date(measurements[0]!.measured_at)
    return earliest < windowStart
  }, [measurements, windowStart])

  const hasNewerData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(windowEnd)
    end.setHours(0, 0, 0, 0)
    return end < today
  }, [windowEnd])

  return {
    range, setRange, windowEnd, windowStart,
    filteredData, navigate, hasOlderData, hasNewerData
  }
}
```

### Changes to Existing Chart Components

**`WeightChart.tsx`:**
- Accept `useChartWindow` return value as props (or call the hook internally)
- Render `<ChartRangeSelector>` above the Recharts container
- Pass `filteredData` to Recharts instead of the full measurement array
- Use the range-adaptive `tickFormatter` on `XAxis`
- Wrap the chart container in a touch handler for swipe detection

**`MeasurementChart.tsx`:**
- Same integration pattern as WeightChart

**`CompareChart.tsx`:**
- Single `useChartWindow` instance shared across all cat series
- Filter each cat's data through the same `windowStart`/`windowEnd`
- Range selector rendered once above the chart

**`CorrelationChart.tsx`:**
- Display range respects the selector; computation window is separate (always uses all available data for correlation math)

### Swipe Handler Component

```
frontend/src/components/SwipeableChart.tsx
```

A wrapper component that detects horizontal swipe gestures on its children:

```typescript
function SwipeableChart({
  onSwipeLeft,
  onSwipeRight,
  children
}: {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  children: React.ReactNode
}) {
  // Track touch start/end X coordinates
  // Minimum 50px horizontal delta, max 30px vertical delta
  // Call onSwipeLeft (forward in time) or onSwipeRight (backward)
}
```

On web, this uses standard touch events. For the iOS app (when chart components are ported), this will be replaced with `PanGestureHandler` from `react-native-gesture-handler`.

---

## Interactions with Existing Features

| Feature | Interaction | Notes |
|---------|------------|-------|
| Health status emoji on chart dots | Unchanged — emoji render on whatever dots are visible. **Important:** the emoji reflects the global `assessHealth()` result (computed from ALL measurements), not a windowed assessment. A dot that's "concerning" based on 6-month context still shows "concerning" even if only 1 week is visible. This is correct — re-computing health per window would produce misleading results (e.g., a single dot in a 1-week window would always show "ok" because there's no comparison point). | |
| InsightsPanel | Not affected — uses full measurement history | |
| MeasurementForm | Adding a measurement resets window to "Today" if not already there | Ensures new data is visible |
| CatProfile chart sub-tabs | Range selection preserved when switching between Weight/Food/Water | Reset only on navigating away from the cat |
| Vet export | Not affected — export always uses full history | |
| Memorial page (read-only charts) | Range selector still available for navigating historical data | |

---

## Open Questions

1. **Default range — RESOLVED: "All".** Changing the default from the current all-time view to 3M would make existing users think their data disappeared. Default to "All" to preserve current behavior. A future iteration can revisit this after users have discovered the range selector. If total data span is less than the selected range, the chart simply shows all data with extra whitespace.

2. **Range memory:** Should the selected range persist across screens (e.g., if you pick 1M on Compare, does CatProfile also default to 1M)? **Recommendation:** No — each chart instance manages its own range. Shared state adds complexity and may confuse users who expect independent views.

3. **Correlation chart:** Should the correlation chart respect the same time window, or does it need its own range? **Recommendation:** Display follows the range selector; computation always uses full data. Show a note when the display window is narrower than the computation window.

4. **Animation style:** On range change, should the chart crossfade, slide, or re-render in place? **Recommendation:** Use Recharts' built-in `animationDuration={300}` which smoothly transitions data points. No custom animation needed.

---

## Implementation Plan

**Phase A is shippable on its own.** The range selector alone delivers the core value — the ability to zoom into a time period. Swipe navigation (Phase B) is an enhancement for touch-heavy users, and polish (Phase C) fills in edge cases. If resources are constrained, ship Phase A and defer B/C indefinitely.

### Phase A — Range Selector + Filtering
1. Create `TimeRange` type and `RANGE_DAYS` constant
2. Create `useChartWindow` hook
3. Create `ChartRangeSelector` component
4. Integrate into `WeightChart` — range selector above chart, filtered data
5. Integrate into `MeasurementChart` — same pattern
6. Integrate into `CompareChart` — shared window across all series
7. Add range-adaptive `tickFormatter` for X-axis labels

### Phase B — Swipe Navigation
8. Create `SwipeableChart` wrapper with touch event detection
9. Wrap all chart containers in `SwipeableChart`
10. Add left/right chevron indicators at chart edges
11. Add "Today" pill when window doesn't include current date
12. Add visual swipe feedback (translateX during drag)

### Phase C — Polish
13. Empty-range handling ("No measurements in this period")
14. Correlation chart display-range integration
15. Verify range selector works correctly on Memorial page read-only charts
16. Write tests for `useChartWindow` hook (filtering, navigation bounds, edge cases)

---

## Success Criteria

- Users can select from 6 preset time ranges on any chart
- The default "All" view preserves current behavior — no user sees their data "disappear" after this ships
- Selecting 3M or shorter makes charts immediately readable for cats with months of data
- Swiping left/right on the chart navigates between time periods (Phase B)
- X-axis labels adapt to the selected range (no label crowding or overlap)
- CompareChart synchronizes range across all cat series
- "Today" pill always brings the user back to the most recent data
- No regression in chart performance (Recharts renders filtered data, not full history)
- All interactive elements in the range selector meet the 44px touch target minimum
- The range selector renders correctly on 375px screens without horizontal overflow or unreadable text

---

*Last updated: 2026-04-11*
