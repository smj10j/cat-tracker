# PRD: Care Extensions — SubQ Fluids, As-Needed Items, Sitter View

| | |
|---|---|
| **Status** | `Approved` |
| **Author** | Product Owner |
| **Created** | 2026-05-05 |

---

## Problem

The Care section today assumes every item is a **scheduled** medication or vet event with a recurring frequency. That misses two common realities for cat owners — especially CKD/senior cats:

1. **Subcutaneous fluids** are a daily-or-every-other-day at-home treatment for many CKD cats and have no preset, so users hand-type the name every time.
2. **As-needed (PRN) items** like gabapentin for pain, Cerenia for vomiting, or Onsior post-procedure should be tracked but should **not** generate dose reminders or overdue alerts. Today the only way to capture them is to enter a fake schedule.

In addition, when an owner leaves the cat with a sitter, there is no clean read-only view that shows everything a sitter needs to know — name, age, scheduled meds, as-needed meds with the trigger condition, and notes — in a single screenshot-friendly layout.

---

## User Stories

1. **CKD cat owner**: "Mochi gets 100mL of LRS subQ every other day. Let me pick that from a preset like I do for Revolution."
2. **PRN gabapentin**: "Mochi gets gabapentin 100mg only if she's hiding or limping. I want it tracked so the sitter knows it exists, but I don't want a daily reminder for it."
3. **Cat sitter handoff**: "I'm flying out tomorrow. I want to text my neighbor one screenshot that has Mochi's age, microchip, scheduled meds, dose times, and the as-needed meds with the conditions to give them."

---

## Scope

### In scope

- **SubQ fluids preset** in the existing care preset list, under category "Medication" (it is medication-adjacent and CKD owners look for it there). New care type `subq_fluids` with a 💧 icon.
- **As-needed (PRN) frequency** as a first-class option on care items. When selected:
  - Schedule fields (start date, reminder time, end date, course length) are hidden in the form
  - No `medication_doses` rows are generated
  - The item is excluded from the notification inbox (overdue / due today / upcoming)
  - The item is excluded from refill alerts (rationale: PRN consumption is unpredictable; alerts would be noise)
  - The Care list shows it in a separate "As needed" group with its trigger condition (notes)
- **Sitter View** — a read-only `/cats/:id/sitter` route on web that:
  - Shows the cat's photo, name, age, sex/neuter, microchip
  - Lists scheduled care items with: name, dose, frequency, reminder time, notes
  - Lists as-needed items separately with: name, dose, "Give if…" trigger (notes), notes
  - Has no app chrome (no bottom nav, no edit buttons) — captures cleanly in one screenshot
  - Has a single "← Back" link and a "Print / Save as PDF" button
  - Uses `loader=eager` for the photo so screenshots don't show a placeholder
- A "Sitter view" button on the Care tab that links to it.

### Added 2026-05-05 — iOS Sitter View (in scope for follow-up)

The original plan deferred the iOS screen because the web URL is reachable from mobile Safari. In practice owners open the app, tap Care, and expect a "send to sitter" affordance there — not a context switch to Safari. So we bring it in.

- **iOS Sitter screen** at `app/app/cats/[id]/sitter.tsx` mirroring the web layout, with iPad-responsive container.
- **Native share** via `expo-print` (render the screen content to PDF) + `expo-sharing` (open the iOS share sheet). PDF is universal: AirDrop, Messages, Mail, Notes, third-party apps.
- **Entry point**: "🐾 Sitter view — shareable summary" Pressable on the Care tab, placed below the Reminders link.

### Out of scope (this sprint)

- Editable PRN log ("administered as-needed at X time") — owners can still note it but no formal log this sprint.
- Multiple sitter profiles or per-sitter access controls (different problem space — covered by household sharing).
- Sharing a deep-link rather than a static PDF (would require unauthenticated read-token endpoints; not justified yet).

---

## Data Model

### No schema migration required

The existing `medications.frequency` column is `TEXT`, so we add `'as_needed'` as a new accepted value to `VALID_FREQUENCIES` (shared constant). Backward compatible — existing rows are unaffected.

| Field | When `frequency = 'as_needed'` |
|---|---|
| `frequency_days` | always `null` |
| `start_date` | required (defaults to today; represents "tracking start") |
| `reminder_time` | stored but unused (defaults to `09:00`) |
| `end_date` | optional |
| `doses_total` | always `null` |
| `doses_remaining` | optional (rarely useful; not surfaced) |
| `refill_alert_threshold` | always `null` (no refill alerts for PRN) |

### Worker behavior

- `POST /api/medications` — if `frequency === 'as_needed'`, skip `generateDoses` entirely. `frequency_days` validation is skipped.
- `PUT /api/medications` — same. When transitioning from scheduled → as_needed, future undosed/unskipped doses are deleted (already handled by existing logic) and no new doses are inserted.
- `GET /api/notifications` — overdue/due_today/upcoming queries already filter on `medication_doses`, so PRN items are naturally excluded. Refill alerts query adds `AND m.frequency != 'as_needed'`.
- Cron extension — `generateDoses` is called per active med; we add `WHERE m.is_active = 1 AND m.frequency != 'as_needed'` so PRN items are skipped.

---

## UI Behavior

### Care item form (web + iOS)

- Frequency picker now includes "As needed (no schedule)" as the **first** option.
- When selected:
  - Schedule section is hidden (start date kept hidden; backend defaults to today)
  - Stock tracking section is hidden (refill alerts don't fire for PRN)
  - Notes label encouragement updates to: "When to give (e.g., 'If hiding or refusing food')"

### Care tab

- Care items split into two groups:
  - **Scheduled** — current behavior (next-due, overdue badges)
  - **As needed** — name, dose, "Give if: <notes>"
- Heading hidden if either group is empty.

### Sitter View (`/cats/:id/sitter`)

Layout, top to bottom:

1. Cat photo (rounded, full-width-ish) + name, age, sex/neuter, microchip
2. **Daily Schedule** card — items grouped by reminder time (e.g., "9:00 AM" header, then list of meds at that time)
3. **As Needed** card — name + dose + trigger notes
4. **Care Notes** — anything else from the cat's `notes` field
5. Footer with print/back

No edit affordances. No nav bar. Background: `surface` so it screenshots cleanly on light or dark mode.

---

## Acceptance Criteria

- [x] SubQ fluids preset appears in the preset picker under Medication and applies type `subq_fluids` with a default daily frequency.
- [x] Care type `subq_fluids` has an icon and renders correctly in care list.
- [x] Frequency picker shows "As needed (no schedule)" as an option.
- [x] When `as_needed` is selected, schedule and stock fields hide; saving produces zero `medication_doses` rows.
- [x] PRN items do not appear in `/api/notifications` overdue/due-today/upcoming/refill arrays.
- [x] Care tab on the cat profile groups items into Scheduled vs As Needed.
- [x] `/cats/:id/sitter` renders a clean, no-chrome layout suitable for one-screenshot capture; print stylesheet hides nav.
- [x] Existing scheduled medications continue to work; cron continues to extend their dose window.
- [ ] iOS Sitter screen renders cat header, scheduled meds grouped by reminder time, as-needed items, and care notes.
- [ ] iOS Sitter screen has a Share button that produces a PDF and opens the iOS share sheet (Messages/Mail/AirDrop).
- [ ] Care tab on iOS surfaces a "Sitter view" entry point.

---

## Open Questions

None. SubQ frequency presets default to daily — a CKD owner can switch to "every 2 days" via the custom interval field if needed.
