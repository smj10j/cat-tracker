# PRD: Landscape Mode — Full-Screen Chart Visualization

**Status:** Implemented (Phase A + B + C)
**Last updated:** 2026-04-11

---

## Problem

Charts on mobile are constrained to ~60% of a narrow portrait viewport (~375px wide, ~240px chart height). Fine for a quick glance, but users who want to study trends, spot anomalies, or compare time ranges are squinting at compressed data. Every major health/fitness app (Apple Health, Fitbit, Garmin, MyFitnessPal) solves this with a full-screen landscape chart mode.

Cat Tracker should too — but only if the implementation is simple enough to maintain across two rendering stacks (Recharts on web, react-native-svg on native) without creating a parallel maintenance burden.

---

## Principles

1. **Explicit over magic** — The primary entry point is a visible expand button, not auto-rotation. Auto-rotate is a Phase B enhancement for users who discover it naturally; the button is how most users will learn the feature exists.
2. **Immersive but escapable** — Full-screen means full-screen (no nav bars, no tabs), but tapping a close button, pressing back, or rotating back to portrait exits immediately.
3. **Same data, better view** — Landscape mode shows the same chart with more horizontal room and denser tick marks. No new data fetching or computation.
4. **Platform-appropriate** — Web and native share the data layer (useChartWindow, time range state) but render through their own chart libraries. No abstraction layer that papers over Recharts vs react-native-svg differences.

---

## Scope

### In scope

- **Manual full-screen expand** — A visible expand/maximize icon on every chart that opens a full-viewport chart overlay. This is the primary entry point.
- **Full-screen chart overlay** — When activated, present the chart full-screen with:
  - Chart fills the viewport (minus minimal padding)
  - Time range selector (1W/1M/3M/6M/1Y/All) still accessible
  - Swipe navigation still works
  - Close/exit button (top-right corner) to return to normal layout
  - Y-axis labels and X-axis dates get more room — show denser ticks
- **Affected charts** — WeightChart, MeasurementChart, CompareChart (web); LineChart equivalents (native)
- **Auto-rotate on native** (Phase B) — Device rotation to landscape on a chart page auto-triggers full-screen mode, but only on phones (not tablets)
- **First-time discoverability hint** — A one-time tooltip or subtle animation drawing attention to the expand button

### Out of scope

- Landscape layout for non-chart screens (settings, forms, lists)
- Pinch-to-zoom on charts (useful but separate concern — see PRD-chart-time-navigation.md non-goals)
- Split-screen / multi-chart landscape view
- Tablet-optimized layouts (landscape charts are a stepping stone, not a full tablet redesign)
- Auto-rotate on web (unreliable — orientation media queries fire on desktop browser resize; see "Why not auto-rotate on web" below)

---

## Design

### Entry and exit

| Trigger | Platform | Behavior |
|---------|----------|----------|
| Tap expand icon on chart | All | Enter full-screen chart mode |
| Device rotation to landscape | Native (phones only) | Auto-enter full-screen if a chart is visible (Phase B) |
| Tap close button | All | Exit full-screen |
| Hardware/browser back | All | Exit full-screen |
| Device rotation to portrait | Native | Exit full-screen (Phase B) |
| Swipe down from top | Native | Dismiss gesture (Phase C) |

**Why no auto-rotate on web:** `window.matchMedia('(orientation: landscape)')` fires whenever `innerWidth > innerHeight`, which happens on every desktop browser resize. Distinguishing "user rotated their phone" from "user dragged their browser window wider" requires `window.screen.orientation` API, which has incomplete support (no Safari < 16.4) and still fires on laptop screen rotation. The cost of false positives (chart suddenly going full-screen while resizing a browser window) outweighs the benefit. Manual expand works reliably everywhere.

### Expand button design

The expand icon sits in the top-right corner of each chart container:

```
┌──────────────────────────────────┐
│                           [⛶]  │  ← expand icon (top-right, 44x44px touch target)
│  10.2 ──│         ·             │
│  10.0 ──│    ·         ·       │
│         └───────────────────────│
│   [1W] [1M] [3M] [6M] [1Y] [All]│
└──────────────────────────────────┘
```

- Icon: `⛶` (fullscreen symbol) or a simple `↗` expand arrow — 20px, ink-mid color (visible but not distracting), 44x44px touch target
- On hover (web): slight scale-up and color brighten to `ink`
- On first visit to a chart page: a one-time tooltip appears below the icon — "Tap to expand chart" — dismisses on tap or after 4 seconds, stored in localStorage/AsyncStorage so it only shows once

### Full-screen overlay layout

```
┌──────────────────────────────────────────────────┐
│ Cat Name · {unit}                         [×]   │  ← minimal header (unit from user prefs)
│                                                  │
│         ┌────────────────────────────────┐       │
│  10.2 ──│         ·                      │       │
│  10.0 ──│    ·         ·    ·            │       │
│   9.8 ──│  ·                   ·    ·    │       │
│   9.6 ──│·                          ·  · │       │
│         └────────────────────────────────┘       │
│         Jan    Feb    Mar    Apr    May           │
│                                                  │
│   [1W] [1M] [3M] [6M] [1Y] [All]               │  ← range selector
└──────────────────────────────────────────────────┘
```

- Background: `var(--color-bg)` (respects light/dark theme)
- Chart area: ~85% of viewport height (minus header and range selector)
- Range selector and swipe navigation carry over from the inline chart — state is preserved when entering/exiting full-screen
- Close button: top-right, 44x44px, always visible over the chart

### CompareChart in full-screen

CompareChart has unique layout needs — multiple lines plus a legend:

```
┌──────────────────────────────────────────────────┐
│ Compare · Weight                          [×]   │
│  [Luna] [Mochi] [Oliver]                        │  ← legend row: colored chips, horizontal
│         ┌────────────────────────────────┐       │
│  10.2 ──│   ───  Luna                    │       │
│  10.0 ──│   ─·─  Mochi                  │       │
│   9.8 ──│   ··· Oliver                   │       │
│         └────────────────────────────────┘       │
│   [1W] [1M] [3M] [6M] [1Y] [All]               │
└──────────────────────────────────────────────────┘
```

- Legend moves from below the chart (portrait) to a horizontal strip above the chart (full-screen). This reclaims vertical space for the chart itself.
- With > 4 cats, legend wraps to two rows. If > 6 cats, legend becomes horizontally scrollable (same pattern as the range selector pills on small screens).
- Each legend chip is tappable to toggle that series (existing CompareChart behavior, if implemented).
- The type selector (Weight/Food/Water/etc.) moves into the header row in full-screen to save vertical space.

---

## Architecture

### What is actually shared vs platform-specific

| Layer | Shared? | Details |
|-------|---------|---------|
| Time range state (`useChartWindow`) | Yes | Same hook, already in `shared/` or easily moved there |
| `ChartRangeSelector` component | No | Web: React DOM + Tailwind. Native: React Native View/Text. Same props, different render. |
| Chart rendering | **No** | Web: Recharts `<AreaChart>` / `<LineChart>`. Native: react-native-svg `<Path>` / `<Circle>`. Completely different APIs. |
| Full-screen overlay | **No** | Web: React portal + CSS. Native: React Native Modal or separate screen. |
| Expand button | **No** | Web: HTML button. Native: Pressable. |
| Orientation detection | **No** | Web: not used (manual only). Native: `expo-screen-orientation`. |
| Tick formatting logic | Yes | `getTickFormatter(range)` is pure JS, shareable |

**Key insight:** The "reuse the same chart" framing is misleading. Recharts and react-native-svg share zero rendering code. What is shared: the data pipeline (filtering, windowing, tick formatting). The overlay, layout, and chart rendering are fully platform-specific. Accept this upfront — trying to abstract over both charting libraries would create a leaky abstraction that's harder to maintain than two simple implementations.

### Web (frontend/)

**Full-screen overlay: `LandscapeChartOverlay.tsx`**

```tsx
// Rendered via React portal to document.body
// Uses position: fixed, inset: 0, z-index: 9999
// Receives chart content as children (the same <WeightChart> etc.)
// Chart component reads dimensions from the overlay container, not the inline position
```

- **Important:** React portals render children in a different DOM location but still cause a re-mount. The chart WILL unmount and remount when entering/exiting full-screen. This means one full Recharts render cycle on open and another on close. For typical datasets (< 200 points), this takes ~10-20ms — imperceptible. For cats with 500+ measurements in the visible window, the render could take 50-100ms. Mitigation: the `useChartWindow` filtering already limits visible points (e.g., a 3M window on a daily-measurement cat shows ~90 points). If "All" range with 500+ points is slow, add a data decimation step that reduces to ~200 points for display (keeping min/max/endpoints to preserve visual shape).
- **No frame-by-frame thrashing:** Because there is no rotation animation on web (overlay appears instantly), `ResponsiveContainer` fires exactly one resize callback after mount. Total transition time should be < 150ms for typical datasets.
- The overlay traps focus (accessibility), captures Escape key for close, and pushes a history state via `window.history.pushState({ chartFullScreen: true }, '')` so the browser back button closes the overlay instead of navigating away. Listen for `popstate` events — if the popped state lacks `chartFullScreen`, close the overlay. On explicit close (button or Escape), call `history.back()` to pop the entry. This works regardless of history depth because React Router's own history entries are always beneath ours.

**Expand button: `ChartExpandButton.tsx`**

```tsx
// Absolutely positioned in chart container's top-right corner
// onClick: set overlay state to open, pass chart content to overlay
// Rendered inside each chart's wrapper div
```

**Opt-in pattern:**

Charts opt in by wrapping in a `<FullScreenReady>` component:

```tsx
<FullScreenReady title="Weight" subtitle={unit} chartId="weight">
  <WeightChart data={data} ... />
</FullScreenReady>
```

`FullScreenReady` renders the expand button and manages the overlay state. Non-chart content is unaffected. The `chartId` is used only for the header label — the first-time tooltip is gated globally (one localStorage key for all charts), not per-chart.

### Native (app/)

**Full-screen: React Native Modal**

```tsx
// <Modal visible={isExpanded} animationType="fade" supportedOrientations={['portrait', 'landscape']}>
//   <SafeAreaView>
//     <LineChart width={screenWidth} height={screenHeight - headerHeight - selectorHeight} ... />
//     <ChartRangeSelector ... />
//   </SafeAreaView>
// </Modal>
```

- On native, the Modal component handles orientation support.
- Width/height come from `Dimensions.get('window')` with an event listener for orientation changes.
- The native LineChart already uses `containerWidth` from `onLayout` — it re-measures automatically.

**Orientation lock (Phase B):**

```tsx
import * as ScreenOrientation from 'expo-screen-orientation'

// On expand: allow landscape
ScreenOrientation.unlockAsync()

// On close: lock back to portrait
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
```

### CorrelationChart in full-screen

The CorrelationChart on CatProfile shows a normalized dual-line chart comparing two measurement types. In full-screen:

- The chart renders at full width like any other chart
- The correlation metadata (r-value, lag, trend descriptions) renders as a compact row above the chart, not as a separate panel
- The type selectors (Type A / Type B dropdowns) remain accessible in the header area
- If the correlation cannot be computed for the visible time window (< 4 weeks of aligned data), show "Not enough data for correlation in this period" centered in the chart area — same behavior as inline, just bigger text

### Performance considerations

**Web (Recharts):** Recharts renders every data point as an individual SVG element. At full viewport width (~900px on a landscape phone, ~1440px on desktop), this is fine for typical datasets. Stress test: a cat with daily weight measurements for 2 years = ~730 points. Recharts handles this without issue on modern devices (tested: Chrome on M1 Mac renders 1000 SVG nodes in ~20ms). If a future user has 2000+ points, the `useChartWindow` filtering naturally limits visible points when any range shorter than "All" is selected. For "All" with massive datasets, consider adding a decimation step (Phase C).

**Native (react-native-svg):** The native `LineChart` builds SVG path strings in JS and renders them as a single `<Path>` element per series (not individual `<Circle>` per point, except for dot overlays). This is efficient — a 500-point monotone Bezier path string is ~5KB and renders in one draw call. The bottleneck is the `monotonePath()` computation, which is O(n) and takes < 5ms for 500 points. Full-screen dimensions don't change the algorithmic cost, only the coordinate values.

### Gesture conflict resolution

The existing `SwipeableChart` captures horizontal swipes for time navigation. In full-screen mode:

1. **Horizontal swipe** — Still handled by `SwipeableChart` for time window navigation. No change needed.
2. **Swipe down from top edge** (Phase C, native only) — Dismiss gesture. Detected by checking if `touchStart.y < 60px` (top edge zone). If the swipe starts in the top edge, it's a dismiss. Otherwise, it's a chart interaction. This avoids conflict with horizontal swipe navigation.
3. **Tooltip touch-hold** — Still works. `SwipeableChart` already distinguishes swipes (50px+ horizontal) from taps/holds.
4. **Native PanResponder conflict** — The native `LineChart` uses `PanResponder` for tooltip tracking. In full-screen, the `PanResponder` still has priority within the SVG area. The dismiss gesture handler wraps the entire modal and only activates for top-edge vertical swipes.

### Handling device dimensions during orientation change (native)

When the device rotates, `Dimensions.get('window')` returns the new dimensions. But during the rotation animation (~300ms on iOS), intermediate values may be reported. The native `LineChart` already handles this via `onLayout` — it re-renders when the container size stabilizes. To avoid flickering:

1. Debounce the `onLayout` callback by 100ms during orientation transitions
2. Set a minimum dimension threshold — don't re-render if width/height changed by < 20px (prevents jitter from keyboard or status bar changes)

---

## Discoverability

Auto-rotate (Phase B) is invisible until a user happens to rotate their phone. The manual expand button is visible but easy to miss among chart controls. Discoverability plan:

### First-time tooltip (Phase A)
- On the first visit to any chart page, after a 1-second delay, show a small tooltip below the expand icon: "Tap to expand chart"
- Tooltip auto-dismisses after 4 seconds or on any tap
- Gate: `localStorage.getItem('chart-expand-hint-seen')` (web) / `AsyncStorage` (native)
- Only shows once, ever. Not per-chart — seeing it on one chart is enough.

### Expand icon visibility
- The icon uses `ink-mid` color (not `ink-dim`) — visible but not distracting
- On hover (web): slight scale-up and color brighten to `ink` (confirms interactivity)
- The icon is always rendered (not hidden behind a menu)
- No pulse animation — the first-time tooltip is sufficient for discoverability. Two competing "look at me" signals (pulse + tooltip) feel like nagware. The tooltip communicates intent ("Tap to expand chart"); a pulse just draws the eye without explaining why.

### Chart-empty state
- When a chart has 0 data points, the expand button is hidden (nothing to expand)
- When a chart has 1 data point, the expand button is still visible (seeing one dot on a big screen is fine)

---

## Tablet handling

"Don't auto-trigger on iPads" is too vague. The precise heuristic:

**Auto-rotate (Phase B) triggers only when ALL of these are true:**
1. Platform is native (`Platform.OS === 'ios' || Platform.OS === 'android'`)
2. Screen shortest dimension < 768px (`Math.min(screenWidth, screenHeight) < 768`) — this excludes iPads (834px+), iPad Mini (744px — borderline, but treated as tablet), and Android tablets
3. A chart is currently visible on screen
4. The measurement form is NOT open (user is analyzing, not inputting)

**Manual expand works on ALL devices** — tablets, phones, desktop web. No restrictions.

**Why not auto-rotate on tablets:** Tablets are commonly used in landscape as their default orientation. Auto-triggering full-screen every time the user opens a chart page would be disruptive. The manual expand button serves tablet users well.

---

## Implementation Phases

### Phase A — Manual expand button + full-screen overlay

**This phase is independently valuable and should be evaluated on its own merits.** The expand button solves the core problem (charts are too small to study trends) without any orientation detection complexity. It works identically on all platforms and screen sizes. If Phase B is never built, Phase A still delivers: users who want to study a chart tap one button and get a full-screen view. This is the same interaction model as YouTube (tap to go fullscreen) — no one needs auto-rotate to find value in fullscreen.

**Estimated effort:** ~2-3 days web, ~1-2 days native. Low risk — no new dependencies, no orientation APIs, no gesture conflicts.

**Web:**
1. Create `ChartExpandButton.tsx` — 44x44px expand icon, absolutely positioned top-right of chart container
2. Create `LandscapeChartOverlay.tsx` — React portal, fixed position, renders chart at full viewport size
3. Create `FullScreenReady.tsx` wrapper — manages expand state, renders button + overlay
4. Wrap `WeightChart` in `FullScreenReady` on CatProfile
5. Wrap `MeasurementChart` in `FullScreenReady` on CatProfile
6. Wrap chart area in `FullScreenReady` on CompareChart (CompareChart legend moves above chart in full-screen)
7. Wire close button, Escape key, browser back (push a history entry on expand so back button works)
8. Implement first-time tooltip (localStorage gate)
9. Preserve range selector state when entering/exiting full-screen (state lives in parent, not in the overlay)
10. Denser axis ticks in full-screen mode — detect container width and increase tick count when > 600px

**Native:**
1. Create `ChartExpandButton.tsx` (React Native Pressable)
2. Create `FullScreenChartModal.tsx` — React Native Modal with `presentationStyle="fullScreen"`
3. Integrate with `LineChart` — pass full viewport dimensions to chart
4. Wire close button, hardware back (Android)
5. Implement first-time tooltip (AsyncStorage gate)

**Tests:**
- Unit: `FullScreenReady` renders expand button, toggles overlay state
- Unit: `LandscapeChartOverlay` renders children at full viewport, traps Escape
- Unit: First-time tooltip shows once then never again
- Integration: WeightChart in overlay preserves range selector state
- Manual: Test on iPhone SE (375px), iPhone 15 (393px), iPad (820px), desktop (1440px)

### Phase B — Auto-rotate on native

1. Add `expo-screen-orientation` dependency
2. Create `useAutoLandscape` hook — listens for orientation changes, applies the tablet/phone heuristic (shortest dimension < 768px), checks if chart is visible and form is not open
3. Wire `useAutoLandscape` into `FullScreenChartModal` — auto-open on landscape, auto-close on portrait
4. Handle edge case: user is already in landscape when navigating to chart page (check orientation on mount, don't auto-trigger — only trigger on *change*). Rationale: if they're holding the phone sideways while browsing, we don't know they want full-screen. Let them tap the expand button.
5. Handle edge case: user opens full-screen manually, then rotates to landscape, then rotates back — close the overlay (rotation back to portrait always closes, regardless of how full-screen was entered). This prevents the confusing state of being in portrait with a "landscape" overlay still open.
6. Handle edge case: user navigates from one chart page to another while in landscape full-screen (e.g., taps a notification link). The overlay should close on route change (the unmount of the parent page handles this naturally since the overlay state lives in the page component).
7. Orientation lock: when the modal is open, unlock orientation. When it closes, lock to portrait.

**Tests:**
- Unit: `useAutoLandscape` fires callback on orientation change, respects the screen-size gate
- Manual: Test on iPhone (auto-triggers), iPad (does not auto-trigger)
- Manual: Test the "already in landscape on mount" edge case
- Manual: Test rotation during form input (should not trigger)

### Phase C — Polish and gestures

1. Swipe-down dismiss gesture (native) — top-edge detection (touchStart.y < 60px)
2. Smooth enter/exit animation — CSS transition (web: opacity + scale over 150ms), React Native Animated (native: fade over 200ms)

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No chart data (0 measurements) | Hide expand button. Nothing to maximize. |
| Single data point | Show expand button. One dot on a large canvas is fine. |
| Multiple charts on CatProfile | Expand the currently active chart (selected via chart sub-tab: Weight/Food/Water/etc.). Only one chart can be full-screen at a time. |
| CompareChart with 6+ cats | Legend wraps to 2 rows or scrolls horizontally. Chart height reduced by legend height. |
| Measurement form open below chart | Do not auto-rotate to full-screen (Phase B). Manual expand still works — user may want to reference the chart while the form scrolls below. |
| User resizes browser window while overlay is open | `ResponsiveContainer` re-measures. The chart adapts. No special handling needed. |
| User navigates away while overlay is open | Overlay closes. The router change unmounts the page component, which unmounts the overlay. |
| Orientation change during chart animation | Debounce `onLayout` by 100ms. Accept one extra re-render. |
| Split-screen / slide-over on iPad | Ignore — chart adapts via `ResponsiveContainer` (web) or `onLayout` (native) already. |
| PWA on home screen (web) | Manual expand works. Orientation API is more reliable in PWA mode but we still don't auto-trigger on web (see "Why not" above). |
| Screen reader active | Overlay announces "Chart expanded, full screen" on open and "Chart collapsed" on close. Close button has `aria-label="Close full-screen chart"`. |
| CorrelationChart with insufficient data | Show "Not enough data for correlation in this period" centered in the full-screen chart area. Type selectors remain accessible so the user can try different types. |
| "All" range with 500+ data points | Chart renders all points. If rendering takes > 100ms (measured via `performance.now()`), log a warning and consider decimation in Phase C. Do not block Phase A on this — most users will never hit this. |
| QuickAdd / BottomNav "Log" opens while overlay is visible | Close the full-screen overlay first. QuickAdd is a modal that overlaps the page — stacking it on top of the chart overlay creates z-index confusion and an inescapable state. The overlay's `onClose` fires before QuickAdd opens. On native, the Modal prevents other modals from stacking naturally. |
| iOS keyboard appears (e.g., VoiceOver text input) | Not applicable — the full-screen overlay has no text inputs. If a system overlay (Siri, notification) temporarily covers the chart, no special handling needed — the chart is static underneath. |

---

## Success Criteria

### Phase A (manual expand)
- Expand button is visible on all chart types (WeightChart, MeasurementChart, CompareChart) within 1 second of page load
- Tapping expand opens a full-viewport chart overlay in < 150ms (measured: time from click to overlay `DOMContentLoaded` or native `onShow`)
- Chart in overlay renders at > 90% of viewport width and > 70% of viewport height
- Range selector state (selected range, window position) is preserved when entering and exiting full-screen
- Tapping close, pressing Escape (web), or pressing hardware back (Android) dismisses the overlay in < 100ms
- First-time tooltip displays exactly once per user, then never again
- No regressions to portrait chart behavior (existing test suites pass)
- Lighthouse accessibility score remains >= 90 on chart pages

### Phase B (auto-rotate)
- Device rotation to landscape on a phone (< 768px shortest dimension) opens full-screen chart within 300ms
- Device rotation to landscape on a tablet (>= 768px shortest dimension) does NOT open full-screen
- Rotating back to portrait dismisses the overlay within 300ms
- No auto-trigger when the measurement form is visible

### Phase C (polish)
- Swipe-down dismiss works from the top 60px of the overlay
- Enter/exit animation completes in < 200ms with no visible frame drops (60fps)

---

## Testing Strategy

### Automated (CI)

| Test | Type | Framework |
|------|------|-----------|
| `FullScreenReady` renders expand button | Unit | vitest + @testing-library/react |
| `FullScreenReady` toggles overlay on button click | Unit | vitest + @testing-library/react |
| `LandscapeChartOverlay` renders children, traps Escape | Unit | vitest + @testing-library/react |
| First-time tooltip: shows once, sets localStorage | Unit | vitest + @testing-library/react |
| `useAutoLandscape` respects screen-size threshold | Unit | vitest (mock Dimensions) |
| WeightChart + overlay preserves range state | Integration | vitest + @testing-library/react |
| CompareChart legend position changes in overlay | Integration | vitest + @testing-library/react |

### Manual test matrix

| Device | OS | Test |
|--------|----|------|
| iPhone SE (375px) | iOS | Expand button visible, overlay fills screen, range selector usable, tooltip works |
| iPhone 15 Pro (393px) | iOS | Same + auto-rotate Phase B |
| iPad Air (820px) | iPadOS | Expand works, auto-rotate does NOT trigger |
| Pixel 7 (412px) | Android | Expand + auto-rotate + hardware back dismisses |
| Chrome desktop (1440px) | macOS | Expand works, no auto-rotate, Escape dismisses, browser resize while overlay open |
| Safari (375px simulated) | macOS | DevTools mobile sim — verify touch targets, overlay z-index above all other UI |
| Firefox | Linux | Keyboard navigation: Tab to expand button, Enter to open, Escape to close |

### What cannot be tested in CI

- Actual device orientation changes (requires physical device or Simulator)
- Recharts re-render performance during resize (requires browser profiling)
- react-native-svg layout measurement (requires native runtime)
- Touch gesture feel (swipe threshold tuning)

These require manual QA before each phase ships.

---

## Adoption Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Users don't notice the expand button | Medium | First-time tooltip on first chart visit, ink-mid color (not dim), hover feedback on web |
| Users accidentally trigger auto-rotate and are confused | Medium | Phase B only. Auto-rotate is on by default (matches Apple Health, Fitbit behavior — users expect rotation on chart screens). No settings toggle — adding a toggle for this creates a preference that almost no one will find or change, and the "close button always works" escape hatch is sufficient. If user complaints arise post-launch, a toggle can be added to Settings then. |
| Full-screen chart feels "empty" for cats with sparse data | Low | Only affects cats with < 5 measurements. Sparse charts look sparse at any size. Not a regression. |
| Expand button clutters the chart area | Low | 20px icon with 44px touch target, ink-mid color (not primary). The icon is small and positioned in the chart's top-right corner where it doesn't overlap data. Do NOT fade it — a disappearing button harms discoverability and adds animation complexity for negligible visual benefit. |
| Portal re-mount causes visible flicker on slow devices | Low | Test on iPhone SE (slowest supported device). If flicker is visible, add a 50ms opacity fade-in on the overlay to mask the re-mount. |

---

## Decisions (formerly Open Questions)

1. **Animation style:** Instant swap in Phase A. A 150ms fade-in is added in Phase C. Rationale: instant is simpler, and the full-screen overlay appearing immediately feels responsive. The Phase C fade masks the Recharts re-mount if it's perceptible on slower devices, but Phase A should not block on animation polish.

2. **Status bar:** Do NOT hide the iOS status bar. Hiding it causes a visual jump (content shifts up), and the user loses access to the clock and battery indicator while studying a health chart — information they may want while timing observations. The ~44px of vertical space gained is not worth the UX disruption. If users request it later, it can be a toggle.

3. **CompareChart legend placement:** Horizontal row above the chart, always. A sidebar wastes horizontal space (the entire point of full-screen is more horizontal room for the time axis). With > 4 cats the legend wraps to two rows; with > 6 it scrolls horizontally. This is the same pattern used by Apple Health's comparison view.

4. **Data point interaction:** Out of scope for this PRD. A persistent crosshair is a chart interaction enhancement that benefits both portrait and landscape modes. It should be a separate PRD if pursued, not coupled to full-screen mode.

5. **Denser Y-axis ticks:** Yes. Compute tick count dynamically based on chart height: `Math.floor(chartHeight / 60)` ticks, minimum 4, maximum 12. This applies in both full-screen and portrait (portrait typically gets 4-5 ticks at ~240px; full-screen gets 8-10 at ~500px). Implement in Phase A since it's a one-line change to the tick count prop.

---

## Non-goals

- Landscape support for non-chart screens
- Pinch-to-zoom
- Tablet-specific layouts
- Chart screenshot / share from full-screen mode (good future feature, separate PRD)
- Auto-rotate on web browsers

---

## Interaction with other PRDs

- **PRD-chart-time-navigation (dependency):** This PRD assumes `ChartRangeSelector`, `useChartWindow`, and `SwipeableChart` are already implemented (they are — see `frontend/src/components/ChartRangeSelector.tsx`, `frontend/src/lib/useChartWindow.ts`, `frontend/src/components/SwipeableChart.tsx`). The landscape overlay reuses these components — it does not duplicate their functionality.
- **PRD-localization-preferences:** The full-screen overlay header shows the measurement unit (e.g., "Luna · kg"). This must read from the user's `weightUnit` preference, not a hardcoded string. The `FullScreenReady` component's `subtitle` prop should be set by the parent using the preference context. If localization ships first, the overlay gets it for free. If landscape ships first, hardcode "lbs" initially and add a `// TODO: use weightUnit pref` comment — the localization migration will catch it as part of its "hardcoded lbs" sweep.
- **PRD-app-settings:** The first-time tooltip hint uses the same localStorage/AsyncStorage pattern as theme persistence. No conflict — different keys.

---

*Last updated: 2026-04-11*
