# PRD: Usability Polish

**Status:** Draft
**Last updated:** 2026-03-07

---

## Problem

Cat Tracker has grown significantly — from a simple weight logger to a multi-tab health dashboard with behavioral tracking, correlations, care schedules, household sharing, and daily check-ins. Each feature was implemented correctly, but the sum of these additions has introduced friction that degrades the everyday experience:

- Pages don't scroll to the top on navigation, leaving users disoriented mid-page
- Preset buttons on the daily check-in save immediately with no confirmation — accidental taps are unrecoverable without finding and deleting the measurement
- Disabled states are communicated by opacity alone — users don't know *why* they can't act
- The submit button on Daily Check-In shows "Nothing to log yet" when inactive — a label, not an instruction
- Loading states are inconsistently handled across pages (some show a spinner, some show blank content, some show a layout shift)
- The Delete action on measurements is immediate and irreversible with no undo
- Back navigation is inconsistent — some pages `navigate(-1)`, others hardcode a path, and some don't provide a back button at all
- Dense information hierarchy in CatProfile means users frequently miss the key health summary because it's below a long InsightsPanel

This PRD proposes a focused set of usability improvements organized by severity. It is explicitly about polish and friction reduction — not new features.

---

## Scope

### In scope
- Scroll position on navigation
- Preset tap feedback and undo
- Disabled state communication
- Loading and empty states consistency
- Delete confirmation
- Back navigation audit
- Submit button copy
- Form error recovery patterns

### Out of scope
- Feature additions (those belong in dedicated feature PRDs)
- Visual redesign (see PRD-ux-redesign.md)
- Performance optimization
- Onboarding / first-run experience (a separate future PRD)

---

## Issues and Proposals

### 1. Scroll position on route change

**Current behavior:** React Router does not scroll to the top on navigation by default. When a user scrolls down on Home, taps a cat, scrolls down on CatProfile, then taps the back button, they land mid-page on Home at their previous scroll position. This is sometimes intentional (back should restore position) but is disorienting when *forward-navigating* to a new page.

**User impact:** A user who taps "Log Check-In" from a scrolled Home page lands mid-page on the Check-In form. A user who taps a cat from a long list lands with the chart already scrolled past.

**Proposal:** Add a `ScrollToTop` component that fires on route change for forward navigation. React Router v6 supports this via `useLocation` effect:

```tsx
// frontend/src/components/ScrollToTop.tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
```

Mount it once inside `<Router>` in `App.tsx`. This scrolls to top on every forward navigation. Back/forward browser navigation is unaffected (the browser handles scroll restoration for history entries).

**Trade-off:** Users who navigate Back will lose their scroll position on the destination page. This is an acceptable trade-off — the browser's back gesture is still available, and most pages are short enough that re-scrolling is not a burden.

---

### 2. Preset button immediate-save (no undo)

**Current behavior:** In the DailyCheckin page, tapping a behavioral preset button *selects* it; submitting is explicit via "Log Check-In." This is fine.

In MeasurementForm (the "Add Measurement" panel on CatProfile), tapping a behavioral preset saves *immediately* — there is no explicit submit step for behavioral types. This is a remnant of the original QuickAdd design pattern that has become inconsistent with DailyCheckin.

**User impact:** An accidental tap on "Vomiting — Many times" immediately posts a record. The user must scroll to the history, find the entry, and delete it to correct the mistake.

**Proposal:** Apply the DailyCheckin's selection model to MeasurementForm's behavioral presets:
1. First tap → selects the preset (highlights it, no save yet)
2. A "Save Observation" button appears below the preset grid
3. Second tap on the same preset → deselects it (cancel)
4. Saving is always explicit

This makes both entry points consistent and eliminates accidental saves. The button text matches: "Save [Type]" (e.g., "Save Food Observation").

---

### 3. Disabled state communication

**Current behavior:** The "Log Check-In" submit button shows:
- `opacity: 0.4` + text "Nothing to log yet" when nothing is selected
- Normal appearance + text "Log Check-In" when ready

The opacity change and placeholder text communicate *that* it's disabled, not *why* or *what to do*.

**Proposal:**
- Remove "Nothing to log yet" as button label — it's a label, not a call to action
- Use a brief contextual hint *below* the button when it's disabled: `"Select at least one measurement above to log"` in `text-xs text-ink-dim`
- The button itself stays disabled with the standard visual treatment but shows "Log Check-In" as its permanent label so users know what the action is

Pattern applies to any submit button that is conditionally disabled. The rule: *the button always says what it will do; contextual help explains the prerequisite.*

---

### 4. Loading state consistency

**Current behavior:** Pages handle loading differently:
- `CatProfile`: shows "Loading…" text centered in the page
- `CatExportPage`: shows "Preparing export…" text
- `Home`: shows the cat list structure while data loads (skeleton-like)
- `DailyCheckin`: no explicit loading state — the cat selector briefly shows empty then populates
- `NotificationsPage`: similar brief flash of empty content before data arrives

**Proposal:** Establish a consistent loading pattern for all data-fetching pages:
- A minimal centered spinner or "Loading…" text (no layout shift, no empty card flash)
- The existing `loading` boolean pattern is already used in most places — standardize on a shared `<LoadingShell>` component that renders the centered spinner

This is a low-effort fix that removes the jarring empty-state flashes on fast connections.

---

### 5. Delete confirmation

**Current behavior:** Measurement deletion in CatProfile is immediate — tapping the delete icon removes the measurement with no confirmation. While there is a "delete" action per measurement in the history, there is no undo.

**User impact:** Accidental deletion of historical data is permanent. For a health-monitoring app where longitudinal data is the core value, this is a meaningful data-loss risk.

**Proposal:** Add a two-step delete for measurements:
1. First tap on delete → shows an inline confirmation: `"Delete this entry? [Cancel] [Delete]"` replacing the measurement row
2. Second tap on "Delete" → executes deletion

This is a common pattern (iOS destructive actions, Gmail's "Undo" toast) and eliminates accidental deletions. The inline confirmation is preferable to a modal because it keeps context visible.

**Optional enhancement (lower priority):** A 5-second "Undo" toast after deletion, using a local state buffer before the API call. This is a nicer pattern but adds more complexity — defer until the two-step confirm is in place.

---

### 6. Back navigation audit

**Current state:** Different pages handle back navigation differently:

| Page | Back behavior |
|------|--------------|
| CatProfile | `navigate('/')` — hardcoded to Home |
| DailyCheckin | `navigate(-1)` — history back |
| CatExportPage | `navigate('/cats/${cat.id}')` — hardcoded |
| MedicationFormPage | Presumably `navigate(-1)` or hardcoded |
| HouseholdSettingsPage | ? |
| AddEditCat | ? |

**Problem:** Hardcoded back navigation breaks when a user arrives from a non-standard path (e.g., deep-linked, or navigated from a notification). `navigate(-1)` is almost always better unless there's no history entry (e.g., direct deep link).

**Proposal:** Audit every page with a back button and switch to `navigate(-1)` by default. The only case where a specific fallback is needed is when the page might be the first in history (direct link) — for those, use `navigate(-1)` with a fallback: if `window.history.length <= 1`, navigate to the canonical parent.

A simple helper:
```typescript
function goBack(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  if (window.history.length > 1) navigate(-1)
  else navigate(fallback)
}
```

---

### 7. Empty states

**Current state:** Several empty states exist but are inconsistent in style and helpfulness:

- Home with no cats: shows a dashed "Add a cat" card — good
- CatProfile with no measurements: shows a text string, no call to action
- CompareChart with one cat: shows content but comparison is meaningless with one series
- NotificationsPage with no notifications: needs verification

**Proposal:** Each empty state should:
1. Briefly explain what would appear here
2. Offer a direct action to fill it

Example for CatProfile with no weight measurements:
> "No weight measurements yet. [+ Add your first weight →]"

The action button/link should be styled distinctly (not just text) so it's easy to tap.

---

### 8. Form error recovery

**Current state:** When an API call fails, error messages are shown inline. However:
- The form does not highlight which field(s) caused the error
- The error message disappears if the user changes the type selector (e.g., in MeasurementForm, `setError(null)` is called on type change, which is correct, but not on other interactions)
- No guidance on *what to do* — "Something went wrong" gives no recovery path

**Proposal:**
- Error messages should include an actionable next step: "Couldn't save. Check your connection and try again." rather than just the raw error message string
- Network errors (the most common failure mode) should suggest retry rather than refreshing the page
- The retry should be a button, not text: `"Retry"` alongside the error message

---

### 9. Confirmation feedback after save

**Current state:** Daily Check-In shows a green banner "Check-in saved!" for 2 seconds after successful submit. This is good. But MeasurementForm closes the panel on success with no feedback — the measurement just appears in the history below, which the user may not notice.

**Proposal:** After a successful MeasurementForm save, briefly show a toast or inline confirmation before closing: "Saved!" for 1 second, then close. This gives the user confidence the action succeeded before the form disappears.

---

### 10. CatProfile information hierarchy

**Current state:** On opening a cat's profile, the user sees:
1. Hero photo with cat name and weight overlay
2. Three tabs (Health / Care / About)
3. On Health tab: InsightsPanel (may be tall if patterns are expanded), then chart tab bar, then chart, then history

The most important single piece of information — the health status and any urgent alert — is inside the InsightsPanel which can push the chart and weight below the fold. Users who tap into a cat's profile to check their weight may have to scroll past health text to see the chart.

**Proposal:**
- The health status badge (emoji + label + brief summary) should be visible at the top of the Health tab without requiring scroll — it is already there, but the InsightsPanel's expanded state can push everything down
- Default the patterns section to collapsed (it may already be, needs verification) and keep only the health alert visible in the collapsed state
- Consider a fixed "pinned" summary pill at the top of Health showing only the STATUS_EMOJI, STATUS_LABEL, and latest weight — one line, always visible — and let the full InsightsPanel be below it

---

## Implementation Order

### Phase A — Zero-risk wins
1. `ScrollToTop` component in App.tsx
2. Disabled button copy fix ("Log Check-In" always; contextual hint below)
3. Error messages with actionable copy + Retry button
4. Save confirmation in MeasurementForm before close

### Phase B — Interaction model
5. Preset button selection model in MeasurementForm (make consistent with DailyCheckin)
6. Two-step delete confirmation for measurements
7. Back navigation audit — switch to `navigate(-1)` + fallback

### Phase C — State and hierarchy
8. Loading state standardization (shared `<LoadingShell>` component)
9. Empty state copy and actions audit
10. CatProfile health status pin / hierarchy review

---

## Success Criteria

- Navigating to any page always starts at the top of that page's content
- No measurement can be accidentally saved from a single tap (preset buttons require explicit save)
- No measurement can be accidentally deleted from a single tap (two-step confirmation)
- Every disabled interactive element explains its prerequisite either inline or via adjacent help text
- Every API error includes a suggested recovery action
- The current health status and latest weight are visible on CatProfile Health tab without scrolling on a 375px screen

---

## Remaining scope — detailed (2026-07-02)

> Phases A + B shipped (see REGISTRY.md). Three Phase C items remain.

### C-8 — Shared `<LoadingShell>` component

**What/why:** Loading is still ad hoc — `NotificationsPage.tsx` renders inline "Loading…" (~line 187), `CatProfile.tsx` has its own skeleton, other pages flash empty content. One component ends the inconsistency.

**Implementation sketch:** create `frontend/src/components/LoadingShell.tsx` — centered spinner + optional label, `role="status" aria-live="polite"`, generous `py-16` so content doesn't jump when data lands. Replace the initial-load branches in `CatProfile.tsx`, `NotificationsPage.tsx`, `CatExportPage.tsx`, `DailyCheckin.tsx`, `HouseholdPage.tsx`, `SitterView.tsx`. Scope is web (this PRD predates the app); check the native equivalents use a consistent `ActivityIndicator` pattern and file a parity note if not.

**Edge cases:** keep CatProfile's hero skeleton (it prevents a large layout shift) — LoadingShell is for pages without a bespoke skeleton; don't show LoadingShell during background refetches, only initial load.

**Acceptance:** every data-fetching page shows LoadingShell (or an intentional skeleton) on initial load; `role="status"` present; no empty-card flash under network throttling.

### C-9 — CatProfile empty-state CTA

**What/why:** `CatProfile.tsx` ~line 512 shows plain text "No {chartTab} measurements yet" (and ~line 104 "No care items tracked yet.") with no action — a dead end for new users.

**Implementation sketch:** replace with one-line explanation + a distinct, tappable CTA (min-h 44px): "No weight measurements yet — **+ Add first weight**", opening the existing add-measurement flow pre-set to the active tab's type; care section gets "**+ Add care item**" linking to the care item form. Apply the same pattern on native `app/app/cats/[id]/index.tsx` (cross-platform rule).

**Edge cases:** Viewer-role household members can't add — show the explanation without the CTA; deceased cats (memorial context) show no CTA.

**Acceptance:** each empty tab/section shows a styled CTA that opens the correct form with the type pre-selected; hidden for Viewer role; component test asserts CTA presence per tab.

### C-10 — Health status visible without scrolling at 375px

**What/why:** Status must be legible the instant the profile opens. Today the hero (42vh, max 380px — `CatProfile.tsx:277`) already contains a `STATUS_LABEL` pill (~lines 397–401), **but only when a latest weight exists and there are ≥2 weight measurements** — cats with 0–1 weights show no status at all, and the InsightsPanel below can push the chart under the fold.

**Implementation sketch:** (a) always render a status chip in the hero whenever `assessHealth` yields an assessment — including "Stable"; cats with no weight data get a neutral "No weight data" chip (doubling as a nudge); (b) verify at 375×667 that hero + tab bar leave the chip fully visible with zero scroll (it's inside the hero, so this holds as long as the hero max-height stays ≤380px — add that constraint to the manual QA checklist); (c) confirm InsightsPanel patterns default to collapsed (PRD-profile-clarity behavior) so the Health tab's alert headline stays near the top.

**Edge cases:** very long cat names truncate (already `truncate`) without pushing the chip off-screen; urgent pulse animation respects `prefers-reduced-motion` (already system-wide per Visual Identity v2).

**Acceptance:** at 375×667, STATUS_LABEL (or the neutral chip) + latest weight are visible without any scrolling for every cat state (0, 1, ≥2 weight measurements); manual QA checklist entry added; jsdom test asserts the chip renders in all three data states.
