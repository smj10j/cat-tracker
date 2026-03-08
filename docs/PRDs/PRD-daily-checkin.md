# PRD: Daily Check-In — Multi-Measurement Entry Screen

**Status:** Draft
**Last updated:** 2026-03-07
**Supersedes:** PRD-killer-app.md P1 (Daily Check-In concept)
**Related:** PRD-ux-redesign.md §3A

---

## Problem

Logging a daily health observation for one cat currently requires 4–7 separate QuickAdd interactions — one per measurement type. The current QuickAdd flow asks the user to select a type first, enter a value, submit, then start over for the next type. This is too much friction to become a daily habit.

As a result, users tend to log only the measurements they're already worried about, rather than maintaining a complete baseline. Incomplete baselines make the correlation engine less useful and reduce the clinical value of the vet export.

The goal is a daily check-in that takes under 15 seconds and captures a complete behavioral picture in a single interaction.

---

## Proposal

A **Daily Check-In screen** that presents all measurement types for a selected cat simultaneously. The user taps one preset per row, then submits once. One measurement record is created per row that received a selection.

### Core interaction model

All measurement types are shown upfront. Unselected rows generate no record. There is no "select type first" step.

```
┌─────────────────────────────────────┐
│  Simba  ▾          Today, 8:14 AM ▾ │
├─────────────────────────────────────┤
│ Weight   [  lbs  ]                  │  ← numeric input, blank = skip
├─────────────────────────────────────┤
│ Food     None · Some · Most · All   │  ← tap to select; none = skip
│ Water    None · Some · Most · All   │
│ Litter   Not used · Straining · ... │
│ Grooming None · Less · Normal · ... │
│ Activity Lethargic · Low · Normal · │
│ Vomiting None · Once · A few · Many │
├─────────────────────────────────────┤
│      Logging 3 measurements         │
│         [ Log Check-In ]            │
└─────────────────────────────────────┘
```

### "No selection = no data" design rationale

This is a deliberate departure from the current QuickAdd model. Showing all types upfront serves two purposes:

1. **Completeness prompt**: The empty rows for types you haven't selected are a visual reminder that this data exists and could be tracked. Users naturally fill in more rows than they would if they had to consciously add each type.
2. **Honest data model**: Not logging vomiting is different from logging "None" for vomiting. The current model conflates the two. The check-in screen makes this distinction explicit — an unselected row means "I didn't observe/track this today," while selecting "None" means "I checked and there was none."

A subtle visual treatment distinguishes the two states: unselected rows have dimmed placeholder text; selected rows have their preset button highlighted.

### Adjustable date and time

The date/time picker defaults to now but can be adjusted. Common use case: logging yesterday's observations that weren't captured in the moment.

- Tapping the date/time area opens a compact inline picker
- Picker shows date + time
- If an adjusted time is set, it persists for the session so a user can log for the same past time across multiple check-ins (e.g., logging all of yesterday before switching back to today)

### Cat selector

- If navigated to from a cat's profile: that cat is pre-selected, selector is collapsed
- If opened from the center BottomNav "Log" button: cat selector is expanded; most-recently-logged cat is auto-highlighted
- With only one cat in the household: selector is hidden

### Concern indicators

Preset options flagged `concern: true` in `measurementPresets.ts` receive the same warning styling they currently use in QuickAdd (e.g., "Straining" in litter, "None" in food). These carry over with no logic change.

### Submit behavior

- Button label: "Log Check-In" if ≥1 row selected, greyed "Nothing to log" if 0
- Below the button: "Logging N measurement(s) for [Cat]" — updates live as selections are made
- On submit: creates one `POST /api/cats/:id/measurements` per selected row, all with the same `measured_at` timestamp
- On success: fires `measurementAdded` event (or context signal), shows brief confirmation, resets form (keeping cat + timestamp settings)
- Individual API failures are surfaced inline per row; successful rows are not re-submitted

---

## Interaction with QuickAdd

The Daily Check-In screen replaces QuickAdd as the primary "Log" interaction when a user taps the center BottomNav button. QuickAdd in its current form (one-type-at-a-time bottom sheet) is retired.

The check-in screen is a full page (not a bottom sheet) because it contains too many rows to display comfortably in a half-screen sheet. On mobile web and native, it scrolls naturally.

For users who want to log a single measurement quickly (e.g., just a weight), the check-in screen still supports this — scroll past the other rows, enter weight only, submit. The experience is not materially slower for single-type entry.

---

## Screens and entry points

| Entry point | Behavior |
|---|---|
| BottomNav center "Log" button | Opens check-in screen with cat selector |
| CatProfile "Log" button / header shortcut | Opens check-in screen with that cat pre-selected |
| Future: notification tap for overdue measurement | Opens check-in for that cat with relevant type pre-highlighted |

---

## API

No new API endpoints are needed. The check-in screen calls `POST /api/cats/:id/measurements` once per selected row using the existing API shape:

```json
{ "type": "food", "value": 2, "unit": "scale", "measured_at": "2026-03-07T08:14:00Z" }
```

Multiple calls are made in parallel (`Promise.all`) and resolved before showing confirmation.

---

## Out of scope

- **Streak tracking**: Tracked separately in PRD-killer-app.md P2. This PRD defines the logging interaction, not the habit-reinforcement layer.
- **Care items / medications**: Care schedule entries are managed in MedicationFormPage. They are not included in the check-in screen.
- **Historical bulk editing**: Editing already-submitted check-in rows is done individually through the existing measurement history timeline, not through a "re-open check-in" flow.
- **Recurring schedules / pre-filling**: The check-in always starts blank. Pre-filling from the previous day's values is future work.

---

## Open questions

1. **Weight placement**: Should weight be at the top (most medically significant), or should it be separated with a visual divider to signal it requires a scale while the others are observational? The current proposal places it first with a note.
2. **Timestamp granularity**: Should the time picker show hours + minutes, or just AM/PM? Most check-ins happen at a predictable time each day; minute-level precision may be unnecessary noise.
3. **"Log again" flow**: After submitting, should the form reset to empty (current proposal) or retain selections for easy correction? Retaining could lead to accidental re-submission.
