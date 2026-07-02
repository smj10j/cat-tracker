# PRD: Observations Journal

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-cat-photos.md (Implemented — R2 upload pattern), PRD-vet-export.md (Implemented — export integration), PRD-household-sharing.md (Partial — role gating), PRD-daily-checkin.md (Implemented — quick-add entry point) |

---

## Problem

Not everything about a cat's health is a number. Owners notice things — "hiding under the bed since Tuesday," "limping slightly on the left front leg," "vet called back: bloodwork normal, recheck in 3 months" — that don't fit the generic measurements table and have no home in the app today. The `notes` field on a measurement only works if there happens to be a measurement to attach it to, and the cat-level `notes` field is a single static blob, not a dated record.

The result: this context lives in the owner's memory or a texting thread, and by the next vet visit it's gone. "When did the hiding start?" is exactly the question a vet asks and exactly the question the app cannot currently answer — even though the owner opened the app that day to log weight.

---

## Target users

- **Chronic-condition owners** (CKD, hyperthyroid, IBD cats) who already log measurements daily and notice qualitative changes between numbers.
- **Post-procedure / new-medication owners** who need a dated record of "how she's doing" during recovery or a medication trial.
- **Multi-caretaker households** where one person notices something and the other takes the cat to the vet — observations must travel with the cat, not the person.
- **Vet-visit preparers** who use the existing export and want their observations included, not just charts.

---

## User stories

1. **Hiding onset**: "Mochi has been hiding under the bed since Tuesday. I want to write that down with the date so I can tell the vet exactly when it started."
2. **Photo evidence**: "There's a bald patch on Luna's flank. I want to snap a photo and attach it to a note so I can compare it in two weeks."
3. **Vet-call outcome**: "The clinic called with bloodwork results. I want to record 'creatinine stable, recheck in 3 months' where I'll actually find it again."
4. **Tag and filter**: "Show me every time I noted 'limping' — is this the third time this year or the tenth?"
5. **Household handoff**: "My partner noticed Peanut straining in the litter box while I was traveling. I want to see that in Peanut's history when I get back."
6. **Vet visit prep**: "When I export Peanut's records for the vet, include what I've observed — not just the weight chart."
7. **Check-in flow**: "I'm already on the daily check-in screen and remembered she sneezed a lot today. Let me add a note without navigating somewhere else."

---

## Scope (phased)

### Phase A — Core journal (entries + timeline + tags)

- New `journal_entries` table (see data model): free text up to **2000 characters**, per cat, with an `occurred_at` timestamp the user can backdate.
- CRUD API + web and iOS entry forms.
- **Preset descriptive tags** (0..n per entry) from a fixed shared list. Tags are **descriptive, never diagnostic** — "hiding," not "depression"; "straining in litter box," not "urinary blockage." This is the same discipline the app applies to behavioral measurements (see `docs/research/behavioral-indicators.md`): we record what the owner observed, and leave interpretation to the vet. The tag list lives in `shared/lib/constants.ts` next to `BEHAVIORAL_TYPES`.
- **Timeline interleaving**: journal entries appear in the existing History section on the cat profile (web `CatProfile.tsx`, iOS `app/app/cats/[id]/index.tsx`), interleaved with measurements in the existing `groupByDay` day-grouping, visually distinct (note icon, italic-ish treatment per DESIGN.md).
- **Tag filter** on the History view: tapping a tag chip filters the timeline to entries carrying that tag.
- **Quick-add entry point** on the daily check-in screen (web `DailyCheckin.tsx`, iOS `(tabs)/log.tsx`): an "Add a note" row below the measurement rows.
- **Role gating**: `contributor` and above can create entries; authors can edit/delete their own; `admin` can delete any entry (moderation escape hatch). `viewer` is read-only. Entries display the author's name in multi-member households.

### Phase B — Photos

- Optional **one photo per entry**, reusing the cat-photo R2 upload pattern (`POST` multipart, JPEG, max 5 MB, stored in R2, public URL with cache-busting `?v=`).
- Photo thumbnail in the timeline row; tap to view full-size.
- Deleting an entry deletes its photo object from R2 (same as `DELETE /api/cats/:id/photo` behavior).

### Phase C — Vet export integration

- New **"Owner observations"** section in the vet export (`CatExportPage.tsx` and the iOS export), after the measurement history: dated entries (with tags, without photos in v1) covering the export's date range, capped for length (see Edge cases).
- Section is omitted entirely if there are no entries in range.

---

## Data model sketch (D1, additive only)

No changes to existing tables. One new table:

```sql
-- Observations journal (PRD-notes-journal)
CREATE TABLE IF NOT EXISTS journal_entries (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id      TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),      -- author
  occurred_at TEXT NOT NULL,                            -- when observed (backdatable), ISO datetime
  text        TEXT NOT NULL,                            -- 1..2000 chars, enforced in Worker
  tags        TEXT,                                     -- JSON array of preset tag keys, e.g. '["hiding","limping"]'; null = untagged
  photo_url   TEXT,                                     -- Phase B; null = no photo
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_cat ON journal_entries(cat_id, occurred_at DESC);
```

Notes:

- **Tags as a JSON text column, not a join table.** Entry volume is modest (a heavy user might write a few hundred per cat per year) and tag filtering is per-cat, so the client can filter the already-fetched list. If server-side filtering is ever needed, `WHERE tags LIKE '%"hiding"%'` works against the JSON encoding; a `journal_entry_tags` join table remains a purely additive future migration.
- **Tag values are validated in the Worker** against the shared preset list (`VALID_JOURNAL_TAGS` in `shared/lib/constants.ts`) — free-form tags are rejected so the taxonomy can't drift into diagnostic language.
- **`user_id` has no `ON DELETE CASCADE`** — entries belong to the cat's record and should survive a departing household member, mirroring how measurements behave. Account deletion nulls or removes per existing account-deletion flow (decision mirrors whatever measurements do today).
- Photo objects live at `journal/{entry_id}/photo.jpg` in R2 (bucket choice is an open question below).

### Proposed starter tag taxonomy (descriptive only — final list is an open question)

`hiding`, `limping`, `low energy`, `restless`, `vocalizing more`, `sneezing`, `coughing`, `overgrooming`, `scratching`, `eating less`, `eating more`, `drinking more`, `litter box change`, `vet visit / call`, `good day`

---

## API sketch

| Method | Path | Auth / role | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/cats/:id/journal` | Viewer+ | List entries for a cat, newest first. Query params: `?tag=hiding`, `?from=`/`?to=` (ISO dates), `?limit=`/`?offset=` |
| `POST` | `/api/cats/:id/journal` | Contributor+ | Create entry `{ occurred_at, text, tags? }`. Rejects >2000 chars, unknown tags, deceased cats (403) |
| `PUT` | `/api/journal/:entryId` | Author (or Admin) | Update `occurred_at`, `text`, `tags` |
| `DELETE` | `/api/journal/:entryId` | Author or Admin | Delete entry; deletes R2 photo if present |
| `POST` | `/api/journal/:entryId/photo` | Author (Contributor+) | Phase B. Multipart JPEG ≤ 5 MB; stores to R2, sets `photo_url` with `?v=` cache-buster — same contract as `POST /api/cats/:id/photo` |
| `DELETE` | `/api/journal/:entryId/photo` | Author or Admin | Phase B. Removes R2 object, nulls `photo_url` |

- All routes behind `requireAuth`; household authorization mirrors the measurements routes (user must be an active member of the cat's household).
- Add the methods to `CatTrackerApi` in `shared/lib/apiTypes.ts` first — both platform clients implement them (cookies on web, Bearer on iOS).
- Update `docs/API.md` alongside implementation.

---

## UX notes (web + iOS — parity mandatory)

### Entry form (both platforms)

- Fields: date/time (defaults to now, backdatable — reuse the check-in screen's adjusted-time pattern), multiline text (live character counter appears past ~1800 chars), tag chips (multi-select from the preset list), photo attach (Phase B).
- Tag chips use the descriptive labels verbatim; no free-text tag input.
- Placeholder copy nudges observation, not diagnosis: *"What did you notice? e.g., 'Hiding under the bed since this morning.'"*

### History timeline (both platforms)

- Entries interleave with measurements inside the existing day-grouped History on the cat profile, sorted by `occurred_at` within each day.
- Row treatment: 📝 note icon, first ~2 lines of text, tag chips, author name (households with >1 member), photo thumbnail if present. Tap to expand / edit.
- **Tag filter bar** appears above History when the cat has any tagged entries; tapping a chip filters to that tag, tapping again clears. Filtering hides measurements while active (it's a journal filter), with a clear "Showing notes tagged 'hiding' — Clear" affordance.

### Quick-add from check-in

- Web `DailyCheckin.tsx` and iOS `(tabs)/log.tsx`: an "📝 Add a note" row below the measurement rows expands inline (text + tags, no photo in the quick path). Submitting the check-in submits the note too; the note is independent — it saves even if no measurement rows were selected.

### Vet export

- "Owner observations" section: reverse-chronological list, `MMM D — text (tags)` per entry. Print stylesheet keeps entries from splitting across page breaks where possible.

### Design

- Follow DESIGN.md; use `surface`/`ink` tokens; no new component library. JSX unicode rule applies (paste literal characters, never `\uXXXX` in JSX text).

---

## Edge cases

- **Deceased cats**: history is read-only — `POST` returns 403 for cats with `deceased_at` set (consistent with medication auto-deactivation in PRD-deceased-cat). Existing entries remain visible on the profile history and Memorial page. Editing/deleting existing entries stays allowed (typo fixes on a record you're keeping).
- **Photo deletion**: deleting an entry must delete its R2 object (no orphaned storage); deleting just the photo keeps the entry. If the R2 delete fails, the DB write still proceeds (photo becomes unreachable garbage; acceptable, same tradeoff as cat photos).
- **Export length limits**: cap the "Owner observations" section at the **most recent 30 entries** within the export range, with a "…and N earlier observations not shown" line. 30 × 2000 chars worst case is still printable; typical entries are 1–2 lines.
- **2000-char limit**: enforced server-side (400) and client-side (counter + disabled submit). Counts Unicode code points, not bytes.
- **Concurrent household edits**: last-write-wins on `PUT`, same as every other resource; no locking.
- **Backdating**: `occurred_at` may be any past datetime; future datetimes rejected (400). Backdated entries slot into the correct day group.
- **Cat deletion**: `ON DELETE CASCADE` removes entries; the cat-deletion flow must also sweep `journal/{entry_id}/*` R2 objects (extend the existing photo-cleanup path).
- **Empty text**: rejected — an entry must have text; tags and photo are optional extras, not substitutes.

---

## Out of scope

- Free-form / user-defined tags (taxonomy stays curated to keep it descriptive).
- Multiple photos per entry, or video.
- Journal entries not attached to a cat (household-level notes).
- Rich text, markdown, or @-mentions.
- Correlating journal tags with measurements in the correlations engine (interesting future work — a tag is arguably a boolean time series — but not this PRD).
- Reminders or follow-ups on entries ("re-check bald patch in 2 weeks").
- Search over entry text (tag filter only in v1).

---

## Open questions for product owner

1. **Tag taxonomy**: is the starter list above right? Additions/removals? (Constraint: every tag must be observational — if a term implies a diagnosis, it's out.) Should tags be validated against `docs/research/behavioral-indicators.md` language where overlapping?
2. **R2 bucket for journal photos**: share the existing `cat-tracker-photos` bucket under a `journal/` prefix (zero new infra, one lifecycle to manage) or create a dedicated bucket (cleaner blast radius, separate public URL)? Recommendation: share the bucket with the `journal/` prefix.
3. **Should measurement `notes` migrate or cross-link?** Users already stash observations in measurement notes. Do we leave them where they are (recommended — they render in the timeline already) or offer a "promote to journal entry" affordance?
4. **Export photos**: Phase C omits photos from the vet export. Should a later phase include thumbnails (PDF size and print cost go up)?

---

## Acceptance criteria

### Phase A
- [ ] `journal_entries` table created via idempotent migration; no existing tables altered.
- [ ] Contributor+ can create an entry (text ≤ 2000 chars, backdatable `occurred_at`, 0..n preset tags) from the cat profile on **both** web and iOS.
- [ ] Viewer can read but receives 403 on create/edit/delete.
- [ ] Unknown tag keys and >2000-char text are rejected with 400; deceased cats reject creates with 403.
- [ ] Entries interleave with measurements in the day-grouped History on both platforms, visually distinct, with author shown in multi-member households.
- [ ] Tag filter shows only entries carrying the selected tag; clearing restores the full timeline.
- [ ] "Add a note" quick-add appears on the check-in screen (web + iOS) and saves independently of measurement rows.
- [ ] `CatTrackerApi` in `shared/lib/apiTypes.ts` gains the journal methods; both clients compile.
- [ ] Worker route tests (auth, roles, validation, deceased) + frontend/app component tests per `docs/TESTING.md`.

### Phase B
- [ ] Photo attach (JPEG ≤ 5 MB) works on both platforms; thumbnail renders in the timeline.
- [ ] Deleting an entry removes its R2 object; deleting a cat sweeps its journal photos.

### Phase C
- [ ] Vet export renders "Owner observations" (dated text + tags) for the export range, capped at 30 entries with an overflow line, omitted when empty — on both web export and iOS export/PDF.
- [ ] `docs/API.md` updated with all journal endpoints.
