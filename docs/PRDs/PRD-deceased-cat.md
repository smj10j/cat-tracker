# PRD: In Memoriam — Marking a Cat as Deceased

| | |
|---|---|
| **Status** | `Implemented` |
| **Created** | 2026-04-10 |
| **Implemented** | 2026-04-11 |
| **Author** | AI research |

---

## Problem

Cat Tracker has no way to mark a cat as deceased. Right now, the only option is to delete — and deletion is the wrong word and the wrong outcome.

Gemini, one of the first cats tracked in this app, recently died from lymphoma. The app's health alerts prompted his owner to seek veterinary care. That data — every weight measurement, every behavioral log, the vet export — is an irreplaceable record of a life. It deserves to be treated as such.

The absence of a deceased-cat flow creates a quiet, painful problem: owners either leave the cat in the active list (seeing his chart every day, getting health alerts for a cat who is no longer here) or delete him (losing the data permanently). Neither is right.

---

## Background & Emotional Context

People who track their cats' health are, by definition, people who care deeply. For them, the data is not just numbers — it is a timeline of a relationship. The weight chart shows when something started going wrong. The vet export was printed and brought to appointments. The behavioral logs captured the last months of a life.

When a cat dies, the owner is grieving. The app should respond to that moment with the same care it showed during the cat's life. That means:

- The language should be gentle. "Passed away," not "deceased." "Remember Gemini," not "Confirm."
- The data should never be deleted. It should be archived and accessible when the owner is ready.
- The active cat list should be peaceful. A deceased cat should not appear alongside healthy cats, generating alerts and filling chart space.
- The memorial should be findable. Owners who want to visit the record, re-read the history, or print the vet export should be able to do so without difficulty.

This is not a feature about data management. It is a feature about how this app treats the people who trust it with something that matters.

**Why this is a product-trust feature, not a niche one:** Cat owners who know their cat's record will be honored when they pass are more likely to trust — and consistently use — the app during the cat's life. The act of logging a weight measurement is an act of care. The app should make clear it understands that, and will hold that record with the same seriousness. This feature is also a natural completeness for anyone who experiences loss: without it, the only option is deletion, and deletion at that moment is harmful to the relationship between the user and the product.

---

## Goals

- Provide a gentle, purposeful way to mark a cat as having passed away
- Preserve all historical data permanently — nothing is deleted
- Remove deceased cats from the active UI without erasing them
- Offer a memorial record page that serves as both an archive and a tribute
- Stop medication reminders, health alerts, and compare-chart inclusion for deceased cats
- Work gracefully in households where multiple members share access to the same cat

## Non-Goals

- This is not a social or sharing feature — no public memorial pages, no sharing links
- This is not a grief support feature — no resources, helplines, or external links (out of scope for this app)
- This is not a deletion path — un-marking should be possible (for mistakes) but is not the primary flow
- No changes to how data is stored or exported; the vet export works the same way

---

## UX Design

### Marking a Cat as Deceased

**Entry point:** A quiet text link at the very bottom of the Edit Cat page, below the Save button and a generous gap:

```
─────────────────────────
Gemini has passed away →
```

Using the cat's name as the subject (not "Mark Gemini as...") matches the app's conversational voice — short, personal, stated as a truth rather than an action. It is styled as `ink-dim` text (muted, not alarming), smaller than body text. Not a button, not a red destructive action. Its placement below the primary save action makes it findable without being prominent. Only visible when editing an existing cat, never on the Add form.

**Confirmation bottom sheet:** Tapping the link opens a **bottom sheet** (not a full-screen modal — per the design system, full-screen modals are not used in this app). The bottom sheet rises from the bottom of the screen with the standard `surface-hi` background.

Content:
- Title in display font: **"Remembering Gemini"** — the cat's name, warm, present tense
- **Date of passing** field (date picker, pre-filled with today, required). Label: "When did Gemini pass away?" Plain and direct.
- **A note** field: optional textarea, 1024 character limit, label "A few words (optional)". Placeholder: *"The bravest cat. He helped us know when to get help."* — first person, lowercase, feels like something you'd actually write
- Primary button: **"Remember Gemini"** — lavender pill, full-width, cat's name included
- Secondary: a plain text link "Not now" — dismisses the sheet without saving. Not "Cancel" (too transactional) and not "No" (feels argumentative)
- No words: "confirm," "submit," "delete," "archive," or "proceed"

**After confirmation:**
- The cat is marked in the database with `deceased_at` and optional `memorial_note`
- The user is navigated directly to the Memorial Record page
- The memorial page itself serves as the confirmation — no separate banner needed. The page heading "Remembering Gemini" is the affirmation.
- All active medications for this cat are automatically deactivated server-side (no notification sent to the user)

### Viewing the Cat List After Loss

The home screen cat list shows only **active cats** by default.

Below the active cat list, if any deceased cats exist, a quiet **"In Memoriam"** section appears:

```
─── In Memoriam ───────────────────────────────

  🐾 Gemini           Passed away Jan 14, 2026
  🐾 Oliver           Passed away Mar 3, 2025

```

- Each row is compact — name, photo/emoji, and date of passing
- Tapping a row navigates to the Memorial Record page
- The section is visually subdued (muted text, no health status indicators, no alerts)
- The section only appears if the user has at least one deceased cat

This means: opening the app feels like opening an app for your living cats. Gemini is still there, just not demanding daily attention.

### The Memorial Record Page

Route: `/cats/:id/memorial`

A page that serves as both an archive and a tribute. Layout:

1. **Hero**: Full-bleed cat photo with gradient overlay and the cat's name in large display font. If no photo exists, a centered large 🐱 emoji on the standard hero gradient background (consistent with how CatProfile handles no-photo cats — do not stretch the emoji to fill). Dates shown below the name only if both are confidently known: *"2013 – 2026"*. If birthdate is missing or imprecise (a common scenario for adopted cats), show only *"Passed away January 2026"*. Do not guess or abbreviate years that haven't been entered.

2. **Memorial note**: If the owner wrote one, displayed below the hero in `ink-mid` italic text, generous line height. Centered, max-width constrained — this should feel like a handwritten note, not a form field.

3. **Life summary**: A single auto-generated line in `ink-dim` text: *"You tracked Gemini's health for 22 months and logged 47 observations."* The observation count is the total number of measurement records of any type (weight, food, water, behavioral — all count). Use the month duration rather than start/end dates to keep it human.

4. **Health record** (collapsible, collapsed by default): Full weight chart and measurement history using the same read-only components from CatProfile. The collapsed header should say "Gemini's health record →" — not "View data" or "Expand." Collapsed by default because the data may be emotionally difficult to see immediately; always accessible when the owner is ready.

5. **"Download Gemini's record"**: A ghost-style button (not the primary lavender pill — this is not the primary action on this page) that opens the existing vet export in a new tab. Keep the label personal ("Gemini's record"), not clinical ("Save health record as PDF"). On mobile, opening a new tab for print is disorienting — add a brief note beneath the button: *"Opens a print-ready summary — choose 'Save as PDF' from the print dialog."*

6. **"Edit this memory"**: A text link at the bottom, below all content. Tapping it opens the Edit Cat page, pre-scrolled to or highlighting the memorial-specific fields (date of passing, memorial note). This reuses the existing Edit Cat page rather than creating a parallel edit surface — consistent with how all cat data is edited in this app. The link label "Edit this memory" is warmer than "Edit memorial note."

There is **no Delete button** on the Memorial Record page. Permanent deletion, if ever needed, is accessible through the Edit Cat form (which already has the delete flow), not from this page. This separation is intentional — the memorial page should never feel like it's one tap away from erasure.

**Back navigation:** The Memorial Record page back button uses `navigate(-1)` with a `window.history.length > 1` fallback to `/` — same pattern as CatProfile. When accessed from the "In Memoriam" home section, back correctly returns to Home.

### Accessing Historical Data

The health record section (collapsed by default) provides the full weight chart and measurement history read-only. The download button opens the vet export as a PDF keepsake. Both are always available and never expire.

---

## Technical Scope

### Database Changes

```sql
ALTER TABLE cats ADD COLUMN deceased_at TEXT;        -- YYYY-MM-DD date string, nullable
ALTER TABLE cats ADD COLUMN memorial_note TEXT;      -- up to 1024 chars, nullable
```

No new tables. `deceased_at IS NOT NULL` is the signal that a cat is deceased. The `deleted_at` soft-delete column (if it exists or is added in the future) should remain separate — deceased ≠ deleted.

Migration: `ADD COLUMN IF NOT EXISTS` as per project convention. Both the migration SQL and `worker/src/db/schema.sql` (the source-of-truth schema file) must be updated.

### API Changes

**`GET /api/cats`**: Add optional `?status=active|memorial|all` query parameter.
- Default: `status=active` (adds `AND c.deceased_at IS NULL` to the existing household WHERE clause)
- `status=memorial`: returns only cats where `deceased_at IS NOT NULL`
- `status=all`: returns all cats regardless of status
- Home uses `status=all` in a single request and splits client-side (see Frontend Changes). Separate calls for active/memorial are unnecessary round-trips.
- This is a breaking change to the default response shape — audit all callers before deploying. At the time of writing, callers are: `Home.tsx`, `CompareChart.tsx`, `QuickAdd` (via PageShell). All benefit from the default filter without code changes. `docs/API.md` must be updated.

**`PUT /api/cats/:id`**: Accept `deceased_at` (`YYYY-MM-DD` date string or `null`) and `memorial_note` (string, max 1024 chars) in the request body. Authorization is unchanged: Editor role required (already enforced). Server-side validation must enforce `memorial_note.length <= 150` consistent with the security conventions in PRD-security.md.

When `deceased_at` transitions from `null` to a non-null value, the handler must:
1. `UPDATE medications SET is_active = 0 WHERE cat_id = ?` — the column is `is_active`, not `active`
2. `DELETE FROM medication_doses WHERE medication_id IN (SELECT id FROM medications WHERE cat_id = ?) AND administered_at IS NULL AND skipped = 0` — remove pending future dose records that the cron pre-generated in the 90-day window; leaving them risks stale notifications if a cat is ever un-marked

No new routes required. The memorial page is a frontend-only route that uses the existing `GET /api/cats/:id` and `GET /api/cats/:id/measurements` endpoints; both already return all columns including `deceased_at` and `memorial_note` once the columns exist.

### Frontend Changes

**`frontend/src/lib/api.ts`**: Two changes required:
1. Add `deceased_at: string | null` and `memorial_note: string | null` to the `Cat` interface. These fields will be present in all `GET /api/cats` and `GET /api/cats/:id` responses once the DB columns exist.
2. Update `getCats()` to accept an optional status parameter: `getCats(status?: 'active' | 'memorial' | 'all')` — appends `?status=<value>` when provided. Default call with no argument still uses the API default (`active`), so all existing callers continue to work unchanged.

**`AddEditCat.tsx`**: Add the "Mark as having passed away" text link and the memorial confirmation modal. Only shown when editing an existing cat (`catId` is defined). Modal contains date input and textarea. On confirmation, calls `updateCat(id, { deceased_at, memorial_note })`, then navigates to `/cats/:id/memorial`.

**`Home.tsx`**: Use a single `getCats('all')` call and split the result client-side: cats where `deceased_at == null` go into the active list; cats where `deceased_at != null` go into the "In Memoriam" section. One round-trip, no sequencing complexity.

**`CatProfile.tsx`**: Guard at the top of the component — after the cat is fetched, if `cat.deceased_at` is set, render `<MemorialPage cat={cat} />` inline (or `return <Navigate to={/cats/${catId}/memorial} replace />` if you prefer a clean URL). Do NOT use a `useEffect` redirect after render: that causes a double-fetch and a visible flash. The inline render approach is simpler and avoids the extra network request.

**`MemorialPage.tsx`** (new component, also used as the `/cats/:id/memorial` route): Hero, memorial note, collapsible health record section (weight chart + measurement history, read-only), life-summary line, PDF export button, "Edit memorial note" text link. No measurement form, no InsightsPanel, no health alerts, no care schedule tabs.

**`CompareChart.tsx` and `QuickAdd`**: No changes required. Both call `getCats()` (no argument) which hits the `status=active` default and automatically excludes deceased cats.

**Notifications query (worker-side)**: The existing `/notifications` route must add `AND m.is_active = 1` to its medication JOIN if not already present, ensuring deactivated medications don't surface in the inbox. Verify this during implementation.

### Interactions with Existing Features

| Feature | Behavior for deceased cats | How achieved |
|---------|---------------------------|--------------|
| Home cat list | Hidden from active list; shown in "In Memoriam" section | `GET /api/cats?status=all` + client-side split |
| Health alerts / InsightsPanel | Not shown | `CatProfile` guards on `cat.deceased_at` |
| Measurement form / QuickAdd | Not shown (no logging) | Same guard; QuickAdd excluded by default API filter |
| Care schedule / medications | Deactivated at time of marking | Worker `PUT` handler; `is_active = 0` |
| Future medication_doses | Deleted at time of marking | Worker `PUT` handler; delete pending unactioned doses |
| Notification inbox | Suppressed | Verify `is_active = 1` filter in notifications query |
| CompareChart cat selector | Excluded automatically | Default `getCats()` hits `status=active` |
| Vet export | Available from memorial page; same content | No change to export route |
| Household sharing | All household members see the same state | `deceased_at` is on the cat row, scoped to the household |
| CSV import | No interaction — import creates new cats, not edits deceased | No change needed |

---

## Open Questions

1. **Un-marking — RESOLVED:** Un-marking is in scope for MVP. A cat marked deceased in error (wrong cat in a multi-cat household, user changed their mind, mistake) must have a recovery path. Implementation: the Edit Cat page for a deceased cat shows a quiet text link in place of the "passed away" link: *"Gemini is no longer marked as passed away →"*. Tapping opens a confirmation bottom sheet: "Restore Gemini's active record?" with a "Restore" primary action and "Not now" dismiss. After restoration, `deceased_at` is set to `null`. Medications are **not** automatically reactivated — the owner must re-enable them manually, since the care needs may have changed. The user is navigated to the normal Cat Profile after restoration.

2. **Date precision — RESOLVED:** Accept a full date (`YYYY-MM-DD`) from the date picker, which is the standard HTML date input. Do not try to build a month/year-only picker — added UX complexity for an edge case. If the owner doesn't know the exact date, they can enter an approximate one (e.g., first of the month). This is good enough.

3. **Vet export header — RESOLVED:** No change to the export page content or header. The vet export is a clinical document intended to communicate with a veterinarian. Changing it to say "In Memoriam" could create confusion if shared with a vet for post-mortem review. The "Download Gemini's record" button label on the memorial page provides the reframing without altering the document itself.

4. **Household notification — DEFERRED:** When a household member marks a cat as deceased, other members will see the change reflected the next time they load the app (the home screen will update). An active in-app notification is desirable but requires the notification infrastructure (PRD-medication-reminders.md Phase B or a dedicated notification type) — defer to a future sprint.

5. **Photo retention — RESOLVED:** Photos stored at `cats/{cat_id}/photo.jpg` in R2 must not be deleted when a cat is marked as deceased. This is already the default behavior (marking deceased calls `PUT /api/cats/:id`, not the photo delete endpoint). Explicitly: do not add any photo cleanup to the deceased-marking flow. The implementation checklist should include a line item confirming this was not added.

6. **"In Memoriam" section heading — RESOLVED:** Use **"In Memoriam"**. It is warm, elegant, universally understood, and not overwrought. The alternatives are either too colloquial ("Passed Away"), too sentimental ("Always Remembered"), or too wordy ("Their Memory Lives Here"). "In Memoriam" is the right level — it honors without performing grief.

7. **Daily Check-In cat selector:** The `/checkin` screen has its own cat selector. Deceased cats must not appear in it. This is automatically handled by the `getCats()` default filter (`status=active`), but the implementation should verify that the Daily Check-In's cat fetch does not pass `status=all`.

8. **Permanent deletion:** If an owner wants to permanently delete a deceased cat's record (e.g., for privacy, or after re-adopting with the same name), this remains possible through the Edit Cat page's existing delete flow. The memorial page itself offers no deletion path — this separation is intentional.

---

## Success Metrics

Success for this feature is harder to measure than most, and that's appropriate. The primary signal is qualitative:

- **No user reports that they felt forced to delete their cat's data** — the In Memoriam path should be discoverable before delete is considered
- **The vet export is accessed from the memorial page** — suggests owners are using it as a keepsake
- **Low "un-mark" rate** — suggests the confirmation flow is deliberate and the correct date was entered

The feature should not generate engagement metrics. If an owner visits the memorial page once a year on their cat's anniversary, that is a success.

---

*This PRD was written in memory of Gemini, who helped teach his family when something was wrong.*
