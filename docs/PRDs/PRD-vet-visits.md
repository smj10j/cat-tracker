# PRD: Vet Visits & Medical Records

| | |
|---|---|
| **Status** | `Draft` |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Author** | AI research (for product owner review) |
| **Depends on** | Notification inbox + iOS push (PRD-medication-reminders, PRD-push-notifications), household roles (PRD-household-sharing), vet export (PRD-vet-export), R2 upload pattern (PRD-cat-photos, Phase B only) |

---

## Problem

Cat Tracker is thorough about *home* care — weights, behaviors, medications, dose reminders — but knows nothing about the *vet relationship* that all of that data ultimately serves:

1. **No appointment tracking.** An owner books a recheck for three weeks out and has nowhere to put it. The app that reminds them about a daily pill cannot remind them about the appointment the pill was prescribed at.
2. **No visit history.** "When was Mochi last seen? What did the vet say?" lives in email confirmations and memory. The vet export summarizes home data but has no record of the clinical encounters that contextualize it.
3. **No vaccine records.** Rabies certificates and FVRCP due dates live in a drawer. Boarding facilities and sitters ask for them; owners scramble.

The care schedule already models *recurring* vet events (exam, dental, bloodwork types exist as care items), but a care item is a reminder template — it is not a record of "we went, this clinic, this vet, this outcome." Those are different objects and conflating them has been a recurring source of user confusion.

---

## Target users

- **Chronic-condition owners** (CKD, hyperthyroid, diabetic cats) with frequent rechecks — the same audience as sub-q fluids and medication reminders. They may have 6–12 visits a year across multiple clinics/specialists.
- **Routine-care owners** with one annual exam and vaccine boosters who mainly want "don't let the rabies vaccine lapse."
- **Households**: a partner or sitter should be able to see "next vet visit: Tuesday 2pm at Elm Street Animal Hospital" without asking.

---

## User stories

1. "Mochi has a CKD recheck on July 24 at 2pm. Remind me the day before, like you do for her meds."
2. "What did the vet say at the April visit? I want to re-read the outcome before the recheck."
3. "The boarding place needs proof of rabies. Show me the vaccine record and when the next one is due."
4. "My partner took her to the emergency vet Saturday. I want that in the shared record with the discharge notes."
5. (Phase B) "The clinic handed me a two-page discharge summary. Let me photograph it and attach it to the visit."
6. "When I print the vet export for a new specialist, include her visit history and vaccine records."

---

## Scope

### Phase A — visits, vaccines, reminders

- **`vet_visits` table** (see data model): scheduled and/or occurred datetime, clinic name, vet name, reason, notes, outcome.
- **Appointment reminders** reusing the existing notification infrastructure: upcoming visits appear in the notification inbox, and the existing cron sends a push ahead of the appointment (mirroring the `notification_sent_at` pattern on `medication_doses`).
- **Vaccine records**: name, date administered, **user-entered** next-due date, optional link to the visit it was given at. Approaching next-due dates surface in the inbox and trigger a reminder push.
- **Display**: a "Vet visits" section on the Care tab (upcoming first, then history) and visit entries interleaved in the cat's history timeline.
- **Vet export**: a "Vet visits & vaccines" section in the existing export.

### Phase B — document attachments

- Photo/document attachments on a visit (discharge notes, invoices, certificates), stored in R2 using the cat-photos upload pattern (`POST` multipart, size limit, Editor role, keyed under the cat's R2 prefix).
- Attachment list + viewer on the visit detail; attachments are **not** embedded in the vet export (linked count only).

### Clinical-content guardrail (applies to both phases)

Per `docs/research/README.md` and CLAUDE.md: this feature stores **user-entered facts only**. Specifically:

- Vaccine presets are **names only** (e.g., "Rabies", "FVRCP", "FeLV"). The app must **not** suggest, compute, or default any vaccination interval or next-due date. Booster schedules are clinical guidance; shipping any such copy requires Tier 1 citations (e.g., the current AAHA/AAFP Feline Vaccination Guidelines) documented in `docs/research/` **before** the copy is written.
- No copy anywhere in this feature may imply a vaccine is "overdue by veterinary standards" — only "past the next-due date you entered."

---

## Data model sketch (D1, additive only)

No changes to any existing table. The generic `measurements` table shape is untouched.

```sql
CREATE TABLE IF NOT EXISTS vet_visits (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id        TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- creator
  scheduled_at  TEXT,              -- 'YYYY-MM-DD HH:MM:00' local wall time (same convention as medication_doses.due_at)
  occurred_at   TEXT,              -- set when the visit happened; a visit may be retroactive (occurred_at only)
  clinic_name   TEXT,
  vet_name      TEXT,
  reason        TEXT,              -- 'CKD recheck', 'annual exam', ...
  notes         TEXT,
  outcome       TEXT,              -- what the vet said / plan
  reminder_sent_at TEXT,           -- push-dedupe, mirrors medication_doses.notification_sent_at
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vet_visits_cat ON vet_visits(cat_id, scheduled_at, occurred_at);

CREATE TABLE IF NOT EXISTS vaccinations (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id           TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vaccine_name     TEXT NOT NULL,  -- preset name or free text; names only, no schedule logic
  administered_on  TEXT NOT NULL,  -- YYYY-MM-DD
  next_due_on      TEXT,           -- YYYY-MM-DD, ALWAYS user-entered from the vet's record; never computed
  vet_visit_id     TEXT REFERENCES vet_visits(id) ON DELETE SET NULL,
  notes            TEXT,           -- lot number, adverse reactions, etc.
  reminder_sent_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vaccinations_cat ON vaccinations(cat_id, next_due_on);

-- Phase B
CREATE TABLE IF NOT EXISTS vet_documents (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id        TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  vet_visit_id  TEXT REFERENCES vet_visits(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- uploader
  r2_key        TEXT NOT NULL,     -- cats/{cat_id}/documents/{id}.{ext}
  file_name     TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vet_documents_visit ON vet_documents(vet_visit_id);
```

Status is **derived**, not stored: `occurred_at` set → completed; `scheduled_at` in the future → upcoming; `scheduled_at` in the past with no `occurred_at` → needs follow-up ("Did this visit happen?"). Cancelling a scheduled visit = deleting it.

Shared types (`shared/lib/types.ts`): `VetVisit`, `Vaccination`, `VetDocument` interfaces matching the columns, snake_case fields, `| null` for nullables.

---

## API sketch

New methods go on `CatTrackerApi` in `shared/lib/apiTypes.ts` first (both platforms then implement). Authorization mirrors medications: **Editor role for all mutations**, any household member reads.

| Route | Notes |
|---|---|
| `GET /api/cats/:id/vet-visits` | All visits for a cat, upcoming + past, with attached vaccination/document counts |
| `POST /api/vet-visits` | `cat_id` in body; at least one of `scheduled_at` / `occurred_at` required |
| `PUT /api/vet-visits/:id` | Includes "mark as occurred" (sets `occurred_at`, optionally `outcome`) |
| `DELETE /api/vet-visits/:id` | Phase B: also deletes attached `vet_documents` rows and their R2 objects |
| `GET /api/cats/:id/vaccinations` | Sorted by `next_due_on` then `administered_on` |
| `POST /api/vaccinations` / `PUT /api/vaccinations/:id` / `DELETE /api/vaccinations/:id` | |
| `POST /api/vet-visits/:id/documents` | Phase B. Multipart, Editor role, size limit per open question Q1; pattern from `POST /api/cats/:id/photo` |
| `DELETE /api/documents/:id` | Phase B. Deletes row + R2 object |

**Notification inbox** (`GET /api/notifications`): `NotificationInbox` gains two additive arrays — `upcoming_visits: (VetVisit & { cat_name: string })[]` (scheduled within the lead window) and `vaccines_due: (Vaccination & { cat_name: string })[]` (`next_due_on` within the lead window or past). Additive change; audit both API clients and inbox screens on web and iOS.

**Cron**: the existing scheduled worker gains two queries — visits with `scheduled_at` inside the push lead window and `reminder_sent_at IS NULL`, and vaccinations likewise against `next_due_on`. Push copy is factual only ("Mochi's vet visit is tomorrow at 2:00 PM — Elm Street Animal Hospital"). Deceased cats (`deceased_at IS NOT NULL`) are excluded from both queries.

**Vet export**: the export endpoint/page adds a "Vet visits & vaccines" section — reverse-chronological visit table (date, clinic, reason, outcome) and a vaccine table (name, given, next due) with an explicit "next-due dates as recorded by the owner" caption.

---

## UX notes (web + iOS — parity mandatory)

### Care tab (both platforms)

- New **"Vet visits"** section below the care schedule groups: next upcoming visit as a card (date, time, clinic, reason, countdown), then a collapsed "Past visits" list.
- **"Vaccines"** subsection: one row per vaccine name showing most recent dose + next due; a "past due" badge is purely date-arithmetic on the user's own entry.
- Add flows: "Add vet visit" and "Add vaccine" buttons (Editor+ only; hidden for viewer/contributor, consistent with medication affordances).

### Visit form

- Fields: date + time, clinic, vet, reason, notes; "This visit already happened" toggle switches the form to occurred/outcome mode. Reason gets lightweight suggestions from care-item types (exam, dental, bloodwork) but stays free text.
- After a past-dated scheduled visit, the visit card prompts "Did this visit happen?" → one tap marks occurred and opens the outcome field.

### History timeline

- Visits render as timeline entries alongside measurements in the cat's history (reusing the `groupByDay`/`DayGroup` presentation), icon `🩺`, tappable to the visit detail.

### iOS specifics

- Screens under `app/app/cats/[id]/` mirroring the web layouts, iPad-responsive via `useResponsiveLayout`/`ResponsiveContainer`.
- Push notifications reuse the existing device-token pipeline; tapping a visit push deep-links to the visit detail.

### Phase B attachments

- Visit detail shows an attachment strip (thumbnails for images, file icon for PDFs); tap to view full-screen (web: new tab; iOS: QuickLook-style viewer/share sheet).
- Upload via camera or file picker on iOS; file input on web.

---

## Edge cases

- **Retroactive visits**: `occurred_at` only, no `scheduled_at` — no reminder is ever generated.
- **Scheduled visit passes unmarked**: it must not sit in "upcoming" forever; after `scheduled_at` passes it moves to a "needs follow-up" state and out of the inbox.
- **Timezones**: `scheduled_at` is local wall time, matching `medication_doses.due_at`; cron uses `users.timezone` for push timing exactly as dose reminders do.
- **Deceased cats**: marking a cat deceased must suppress visit/vaccine reminders (add these tables to the deceased-marking cleanup alongside medication deactivation); history and export remain available from the memorial record.
- **Household visibility**: all members see visits/vaccines; only Editor+ mutates. The creator's `user_id` is informational ("added by Steve"), not an authz boundary.
- **Duplicate vaccine names**: "Rabies" entered twice with different dates is valid history, not an error; the Vaccines section groups by name and shows the latest.
- **Visit deletion with linked records**: vaccinations linked via `vet_visit_id` survive (`ON DELETE SET NULL`); Phase B documents are deleted with the visit (row + R2 object — verify R2 cleanup in tests).
- **`next_due_on` far in the past** (lapsed for years): show the date factually; do not escalate urgency or add clinical framing.

---

## Out of scope

- **Two-way vet-practice integration** (clinic pushes records/reminders into the app) — explicitly deferred exploratory work, see PRD-ux-redesign §3E.
- OCR / auto-parsing of uploaded documents (future idea; see PRD-lab-results for the same stance).
- Cost/expense tracking (open question Q2 — not in Phase A regardless).
- Computed vaccination schedules or any booster-interval guidance (blocked on Tier 1 citations; see guardrail above).
- Clinic directory / maps / phone integration; sitter-view inclusion of visit history.

---

## Open questions for product owner

1. **Attachment types & quota (Phase B):** JPEG + PDF only, or also HEIC/PNG? Proposed limits: 10 MB per file, 20 documents per cat (R2 free tier is generous but unbounded uploads invite abuse). Confirm numbers.
2. **Cost tracking:** should visits carry an optional `cost` field (and a running total in the export)? Cheap to add now, noisy if unused. Yes/no.
3. **Reminder lead times:** proposed defaults — visit push 24h before at the appointment's local time, vaccines surfaced at 30 days before `next_due_on`. Fixed defaults, or user-configurable in App Settings?
4. **Care-schedule overlap:** when a user has a recurring "annual exam" care item *and* logs a vet visit, should completing the visit offer to check off / reschedule the matching care item, or stay fully independent in Phase A?

---

## Acceptance criteria

- [ ] Editor can create a scheduled visit; it appears on the Care tab (web + iOS) with date, clinic, reason.
- [ ] Upcoming visits appear in the notification inbox and generate exactly one push per visit (`reminder_sent_at` dedupe), on both platforms.
- [ ] A visit can be marked occurred with an outcome; it moves to Past visits and appears in the history timeline.
- [ ] Vaccination records store a user-entered `next_due_on`; the app never pre-fills or computes it.
- [ ] Vaccines within the lead window (or past due) appear in the inbox with date-factual copy only — no clinical claims anywhere in visit/vaccine UI, push, or export copy.
- [ ] Vet export includes the "Vet visits & vaccines" section with the owner-recorded caption.
- [ ] Viewer and contributor roles see visit/vaccine data but get no mutation affordances; worker rejects their mutations.
- [ ] Deceased cats generate no visit/vaccine notifications.
- [ ] `measurements` table shape unchanged; all schema changes are new tables with idempotent `IF NOT EXISTS` migrations applied to schema.sql + local + remote.
- [ ] (Phase B) Documents upload via multipart with type/size validation, Editor role enforced, R2 objects deleted when the document or parent visit is deleted.
- [ ] Shared types and `CatTrackerApi` methods added first; both API clients implement; all four test suites pass.
