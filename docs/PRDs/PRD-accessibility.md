# PRD: Accessibility

**Status:** Draft
**Last updated:** 2026-03-07

---

## Problem

Cat Tracker was built mobile-first with a custom dark design system but without an explicit accessibility pass. An audit of the current codebase reveals several gaps that would make the app difficult or impossible to use for people with:

- **Color vision deficiency** (colorblindness affects ~8% of males, ~0.5% of females): health status is communicated in part through color, and chart elements use color as their primary differentiator
- **Motor impairment**: touch targets in the daily check-in grid fall below the 44×44pt minimum; keyboard navigation is untested with no visible focus styles
- **Low vision**: 31 instances of `text-[10px]` (≈7.5px rendered); section labels in DailyCheckin, MeasurementForm, and BottomNav are at or below the WCAG-recommended minimum
- **Screen reader users**: `<label>` elements are not associated to their `<input>` elements via `htmlFor`/`id`; no `aria-live` regions for dynamic feedback (save confirmations, errors); preset buttons have no accessible name beyond their visible label

This PRD does not propose a complete WCAG 2.1 Level AA certification effort — that would require a formal audit tool and ongoing maintenance process. Instead it proposes a targeted set of high-impact fixes that address the most common impairments for a health-monitoring app used by everyday cat owners.

---

## Scope

### In scope
- Color-independent health status signals
- Touch target sizing
- Label-input association
- Focus visibility
- Screen reader feedback for dynamic actions
- Minimum text size
- Semantic HTML structure

### Out of scope
- Full WCAG 2.1 Level AA certification (a worthwhile future goal, not this PRD)
- Support for screen magnification beyond standard browser zoom
- Internationalization / localization
- Voice control beyond what OS-level voice control already handles

---

## Current state audit

### 1. Color vision deficiency

**Current:** Health status uses four colors (green ✅, yellow 👀, orange ⚠️, red 🚨). The emoji provide a redundant non-color signal for the status labels and InsightsPanel, which is good. However:

- `WeightChart.tsx` and `CompareChart.tsx` use `STATUS_COLORS` (green/yellow/orange/red) to color chart dot fills — the emoji appear as SVG text nodes on the dots, which helps, but the line colors and area fills are color-only
- Behavioral preset buttons use `rgba(248,113,113,...)` (red-ish) vs `rgba(255,255,255,...)` (neutral) to distinguish "concern" from "normal" presets — no shape, icon, or text difference
- The `CONCERNS_ATTENTION` sections in WellnessGuide and alerts use colored borders/backgrounds without an alternative signal

**Risk:** A user with deuteranopia (red-green colorblindness, the most common form) may not distinguish the "urgent" (red) from "watch" (yellow) status or the "concern" preset buttons from normal ones. Protanopia users similarly lose the red channel entirely.

**Proposed fix:**
- Add a small icon or shape prefix to concern-tier preset buttons (e.g., a `!` prefix character or a small triangle indicator in the button text). This is text, not icon, so no image dependency.
- Ensure chart line/area differentiators include at least one non-color dimension: stroke dash pattern (solid/dashed) per cat in CompareChart, or explicit status labels on chart axes rather than color-coded dots alone.
- STATUS_LABEL (`'Stable' | 'Watch' | 'Concerning' | 'Urgent'`) is already exported — surface it as a text badge alongside every emoji use so the label is always present, not just on hover.

### 2. Touch target sizing

**Current:** WCAG 2.5.5 (Level AAA) and Apple Human Interface Guidelines both recommend 44×44pt minimum touch targets. Android recommends 48×48dp.

Problematic areas found:
- Daily check-in preset buttons: `minHeight: 34`, `fontSize: 10` — below 44pt minimum
- BottomNav items: icon + label spans are clickable but the wrapping element is ~50px wide and may not be 44px tall
- The `×` close button in MeasurementForm is `w-8 h-8` (32px) — below minimum
- History "Load more" links, small action buttons in InsightsPanel

**Proposed fix:** Enforce `min-h-[44px]` on all interactive elements. For the preset grid in DailyCheckin, replace the current compressed layout with `min-h-[44px]` buttons — the extra height is acceptable given the usability benefit. Add `padding: 10px 4px` to small buttons to extend the tap target without changing the visual size.

### 3. Label-input association

**Current:** All `<label>` elements in the app are visual-only. Example in MeasurementForm:
```tsx
<label className="block text-xs ...">Weight</label>
<input type="number" ... />
```
Without `htmlFor` on the label and a matching `id` on the input, screen readers cannot associate the label with the control. A VoiceOver or TalkBack user tabbing to the weight input hears "number field" not "Weight, number field."

**Proposed fix:** Add `htmlFor`/`id` pairs to every `<label>` and its associated `<input>` or `<select>` throughout the app:
```tsx
<label htmlFor="weight-value" className="...">Weight</label>
<input id="weight-value" type="number" ... />
```
This is a mechanical change — no visual or functional impact.

### 4. Focus visibility

**Current:** The dark design system has no `focus:` ring styles defined in `index.css` or Tailwind config. Tailwind's default focus-visible ring is overridden by the global `*:focus { outline: none }` pattern that many dark-theme setups apply. Keyboard users cannot see which element has focus.

**Proposed fix:** Add a global focus-visible style in `index.css`:
```css
:focus-visible {
  outline: 2px solid #c084fc; /* brand lavender */
  outline-offset: 2px;
  border-radius: 4px;
}
```
`focus-visible` only shows when the user is navigating by keyboard (not mouse or touch), so this adds zero visual noise for pointer users.

### 5. Screen reader feedback for dynamic actions

**Current:** Save success and error states are rendered as visible DOM elements but have no `aria-live` attribute. A screen reader user who taps "Log Check-In" and then listens will hear nothing until they manually re-navigate the page.

**Proposed fix:** Wrap status messages in `role="status"` (polite) and errors in `role="alert"` (assertive):
```tsx
{saved && <div role="status" aria-live="polite">Check-in saved!</div>}
{error && <div role="alert" aria-live="assertive">{error}</div>}
```
This applies to: DailyCheckin save confirmation, MeasurementForm error, any delete confirmation, auth error states.

Additionally, the `saving` state (while the API call is in flight) should be announced: `<button aria-busy={saving}>` signals to screen readers that an operation is in progress.

### 6. Text size

**Current:** 31 instances of `text-[10px]` across the app. At standard mobile font scaling, 10px renders as ≈7.5pt, well below WCAG's recommended minimum of 12pt for body text and 14pt for comfortable reading.

Affected areas: section labels ("WHEN", "CAT", "OBSERVATIONS"), BottomNav labels, preset button text in DailyCheckin, notification section headers.

**Proposed fix:** Establish a minimum of `text-xs` (12px) for ALL visible text in the app. Section labels that are currently `text-[10px] uppercase tracking-wider` can become `text-xs uppercase tracking-wider` — the uppercase + tracking still creates the visual hierarchy, at a readable size.

The one legitimate exception is print-only content in `CatExportPage.tsx` where 10px may be appropriate for dense table data on paper — that stays as-is.

### 7. Semantic HTML

**Current:** Tab selectors in CatProfile are `<button>` elements without `role="tab"` or `aria-selected`. Collapsible sections (InsightsPanel patterns toggle) are `<button>` elements without `aria-expanded`. The three-tab CatProfile navigation lacks a wrapping `role="tablist"`.

**Proposed fix:**
- Add `role="tablist"`, `role="tab"`, and `aria-selected` to CatProfile's tab bar and chart sub-tab bar
- Add `aria-expanded={isOpen}` to all toggle/accordion buttons (WellnessGuide cards, InsightsPanel patterns, MedicationsSection)
- Add `aria-controls` pointing to the panel ID on each toggle button

---

## Implementation Plan

### Phase A — Zero-visual-impact fixes (high value, low risk)
1. Label-input `htmlFor`/`id` associations — all forms
2. `role="status"` / `role="alert"` / `aria-live` on all dynamic feedback
3. `aria-busy={saving}` on all save buttons
4. `aria-expanded` on all accordion/toggle buttons
5. `role="tablist"` / `role="tab"` / `aria-selected` on CatProfile tabs
6. `:focus-visible` ring in `index.css`

### Phase B — Text and touch targets
7. Replace all `text-[10px]` with `text-xs` (12px) except print-only contexts
8. Enforce `min-h-[44px]` on: DailyCheckin preset buttons, MeasurementForm close button, any other buttons below 44px

### Phase C — Color independence
9. Add text labels ("!" prefix or "⚠" unicode) to concern-tier preset buttons in DailyCheckin and MeasurementForm
10. CompareChart: add stroke dash pattern (dashed vs solid) as second differentiator per cat in addition to line color
11. Ensure STATUS_LABEL text badge always appears alongside STATUS_EMOJI in InsightsPanel and health status cards

---

## Success Criteria

- A keyboard-only user can navigate the full app (Home → Cat Profile → Daily Check-In → submit → back) without a mouse
- A VoiceOver (iOS) user can fill out and submit the Daily Check-In form and hear confirmation
- A user with deuteranopia can identify which preset buttons indicate concern vs. normal without relying solely on color
- All visible interactive elements are at least 44px tall
- No visible text is smaller than 12px
- All `<label>` elements are associated to their `<input>` via `htmlFor`/`id`

---

## Non-goals

- This PRD does not require a third-party accessibility audit
- Does not require ARIA live region for chart updates (charts are supplementary; the text summary is the primary signal)
- Does not require high-contrast mode (OS-level high contrast is respected by `prefers-contrast` media query — a future enhancement)
