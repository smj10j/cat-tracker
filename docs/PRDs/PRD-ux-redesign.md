# PRD: UX Redesign — Competitive Analysis & Next-Generation Features

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner + AI |
| **Created** | 2026-03-07 |
| **Depends on** | PRD-killer-app.md (P1, P2, P3, P6, P7) |

---

## 1. Context: Competitive Analysis

Screenshots were captured from a vet-provided pet management app (appears to be a practice-integrated app like PetDesk or similar). Five screens were analyzed:

### What they have

| Screen | Description |
|--------|-------------|
| **Pet profile — About tab** | Full-bleed hero photo (~60% of viewport), pet name below in large serif type, "Request Record" button, structured details (breed, sex/neuter status, birthdate, weight) with icons. Tabs: Reminders / About / Selfie. Floating "EDIT" FAB. |
| **Pet profile — Reminders tab** | Same hero photo as backdrop. List of vet-created reminders with emoji icons, due dates, "Created by Practice" attribution. Tap-to-expand detail card with due date. "+ NEW" FAB. |
| **Add New Reminder** | Pet selector dropdown, free-text description, icon picker (10 emoji categories: Dental, X-ray, Fecal, Vaccination, Default, Parasite, Surgery, Bloodwork, Exam, Medication), date+time picker. Simple, single-purpose form. |
| **Reminder icon picker** | 3x4 grid of illustrated/emoji icons, each labeled. Selected icon gets a highlight border. |
| **All Reminders list** | Two top-level tabs (All Pets / All Reminders). Flat chronological list across all pets. Each row: pet photo, pet name, emoji + reminder description, "Created by Practice" attribution, due date. "+ NEW" FAB. |

### What they do well

1. **Hero photo dominance** — The profile photo takes up ~60% of the screen. This is emotionally powerful. When you open Gemini's profile, you see *Gemini*, not a data table. It makes the app feel personal.

2. **Structured pet details with icons** — Breed (paw icon), Sex/Neuter status (gender icon), Birthdate (cake icon), Weight (scale icon). Each field has a recognizable icon prefix. Scannable at a glance.

3. **Reminder emoji categorization** — Each reminder type gets a visual identity (syringe for vaccination, tooth for dental, poop for fecal, etc.). In a list of 8 reminders, you can instantly spot which is which. This is particularly good for the "All Reminders" view where reminders span multiple pets.

4. **Practice attribution** — "Created by Practice" labels distinguish vet-generated reminders from user-created ones. This two-way data flow (vet pushes reminders to pet owner) is a strong engagement model.

5. **Selfie tab** — Dedicated space for pet photos beyond the profile picture. Implies a photo gallery/timeline.

### What they do poorly / where we're already better

1. **No health intelligence whatsoever** — Pure data entry and reminders with zero analysis. No weight trends, no behavioral tracking, no correlation insights, no health status assessment. **We are dramatically ahead here.** Our InsightsPanel, health status system, correlation engine, and vet export are features this app doesn't attempt.

2. **No charts or visualization** — Weight is shown as a static number ("12.75 lbs"). No history, no trend line, no change tracking. Our WeightChart and MeasurementChart are a major advantage.

3. **No behavioral measurement system** — They track medical events (vaccinations, exams) but not daily behaviors (food, water, litter, activity). Our behavioral tracking with 0-3 scale presets and correlation analysis is unique.

4. **White/light design is clinical, not warm** — Purple header, white cards, green accents. Functional but feels like a medical portal, not an app you want to open. Our dark "Warm Night" design language is more inviting for daily use.

5. **No household/sharing model visible** — Appears to be single-user with vet-push data only.

6. **Reminder system is simplistic** — Date + description + icon. No recurring schedules, no dose tracking, no "mark as given" flow, no refill reminders. Our medication system with frequencies, dose generation, and notification inbox is far more capable.

7. **No daily check-in or habit formation** — No streaks, no logging encouragement, no consistency tracking.

### Key takeaways

| Aspect | Competitor | Cat Tracker | Verdict |
|--------|-----------|-------------|---------|
| Profile hero photo | Full-bleed, emotional | Small circle avatar | **They win — adopt this** |
| Pet detail layout | Icon-prefixed structured fields | Inline text | **They win — adopt this** |
| Reminder categorization | Emoji icons per type | Text-only medication list | **They win — adopt this** |
| Health intelligence | None | InsightsPanel + correlations + health status | **We win — keep and extend** |
| Charts & trends | None | WeightChart + MeasurementChart + CompareChart | **We win — keep** |
| Behavioral tracking | None | 8 types with presets + correlation | **We win — keep** |
| Medication scheduling | Simple date reminders | Recurring + dose tracking + inbox | **We win — keep** |
| Visual design | Clinical white/purple | Warm dark, glass cards | **We win — keep** |
| Vet integration | Practice-created reminders | Vet export PDF | **Different approaches — explore** |
| Photo gallery | "Selfie" tab | Single profile photo | **They win — explore** |

---

## 2. Proposed Changes

### 2A. Cat Profile Hero Redesign (HIGH priority)

**Problem:** Our cat profile shows a small 80px circle avatar next to text. The competitor's full-bleed hero photo creates an instant emotional connection. When someone opens their cat's profile, the first thing they should see is their cat's face filling the screen — not a data card.

**Proposal:**

Replace the current compact profile header with a full-bleed hero image section:

```
[  Full-bleed photo (200-280px tall)                    ]
[  with gradient fade to dark at bottom                  ]
[                                                        ]
[                                   [camera icon button] ]
[  Luna                                    age: 3y 2mo  ]
[  Domestic Shorthair  *  Female  *  9.4 lbs             ]
[============ status badge (OK / Watch / etc) ===========]
```

- Photo fills full width, ~40% of viewport height
- Gradient overlay (transparent -> night) at the bottom so text is readable
- Cat name in large display font over the gradient
- Structured detail row with breed, sex, latest weight — icon-prefixed like the competitor
- Health status badge integrated into the hero footer
- Camera icon button in top-right corner of hero for photo upload (replaces current tap-avatar flow)
- Fallback when no photo: a large emoji on a gentle gradient background (not a blank rectangle)
- Microchip badge below details row if present
- Parallax-lite: photo shifts slightly on scroll (CSS `background-attachment: fixed` or transform on scroll, subtle)

**Why:** This is the single biggest emotional impact change we can make. The photo is why people open the app. Make it feel like a love letter to their cat.

**Recommendation:** STRONGLY ADOPT. The competitor's best idea and it's straightforward to implement with our existing R2 photo infrastructure.

---

### 2B. Structured Pet Details with Icons (MEDIUM priority)

**Problem:** Our profile currently shows breed, sex, age, and weight as inline text below the avatar. The competitor uses icon-prefixed rows that are more scannable.

**Proposal:**

Replace the current text details with an icon-row layout:

| Icon | Field | Example |
|------|-------|---------|
| Paw print | Breed | Domestic Shorthair |
| Gender symbol | Sex + neuter status | Male Neutered |
| Cake/Calendar | Age / Birthdate | 3y 2mo (born Jan 2022) |
| Scale | Latest weight + trend | 9.4 lbs (stable) |
| Microchip | Microchip ID | 985 112 345 678 903 |

Show as a compact 2-column or list layout below the hero. Each row has a small icon (could be emoji or SVG), the value, and optional trend indicator for weight.

**New field: Neuter/Spay status** — The competitor shows "Male Neutered." We only track sex. Add an optional `is_neutered` boolean to the cats table. Neuter status is relevant for health assessments (intact males have different weight norms; spayed females are prone to weight gain).

**Recommendation:** ADOPT. Low effort, meaningful improvement to scannability. The neuter status field adds genuine health value.

---

### 2C. Reminder/Event Type Icons (MEDIUM priority)

**Problem:** Our medications list and notification inbox are text-only. When you have 5+ medications across 3 cats, scanning is slow. The competitor's emoji-per-type approach makes this instant.

**Proposal:**

Add a `MEDICATION_TYPE_ICONS` map:

| Type | Icon | Label |
|------|------|-------|
| flea | Bug emoji | Flea/Tick |
| heartworm | Heart emoji | Heartworm |
| pill | Pill emoji | Daily Pill |
| vaccine | Syringe emoji | Vaccination |
| supplement | Vitamin emoji | Supplement |
| dental | Tooth emoji | Dental |
| exam | Stethoscope emoji | Vet Exam |
| bloodwork | Blood drop emoji | Bloodwork |
| surgery | Bandage emoji | Surgery |
| other | Calendar emoji | Other |

Display the icon in:
- MedicationsSection on CatProfile (next to each medication name)
- NotificationsPage inbox items
- MedicationFormPage (icon picker during creation, similar to competitor's grid)

**Extend medication types:** Add `dental`, `exam`, `bloodwork`, and `surgery` to the medication `type` enum. These are really "vet event reminders" rather than medications — rename the concept from "Medications" to **"Care Schedule"** to encompass both recurring medications AND one-time vet events (annual exam, dental cleaning, bloodwork panel).

This is a conceptual upgrade: the competitor splits "reminders" and "medical records" as separate concepts, but our medication system already has the scheduling infrastructure. By broadening it to "Care Schedule," a single system handles:
- Daily pill reminders (recurring)
- Monthly flea prevention (recurring)
- Annual vet exam (one-time, reschedule after)
- Dental cleaning in 6 months (one-time)
- Vaccination boosters (one-time with known interval)

**Recommendation:** ADOPT. High-value UX improvement that also broadens the medication system's utility.

---

### 2D. Cat Profile Tabs Redesign (MEDIUM priority)

**Problem:** Our CatProfile has measurement-type tabs (Weight / Food / Water / Behavior / All) which are data-oriented. The competitor organizes by *purpose* (Reminders / About / Selfie). Neither is perfect alone — ours is too granular, theirs ignores health data entirely.

**Proposal:** Reorganize into purpose-driven tabs that preserve our data richness:

| Tab | Contents |
|-----|----------|
| **Health** | InsightsPanel + charts (weight/food/water/behavior sub-tabs within) + measurement history |
| **Care** | Care Schedule (medications + vet events) + notification status |
| **About** | Structured details, microchip, notes, edit link |

Three tabs instead of five. The current 5-tab measurement split moves *inside* the Health tab as a sub-selector (pill toggles or a dropdown, not full-width tabs). This reduces top-level cognitive load while keeping all data accessible.

The "Care" tab subsumes the current MedicationsSection and becomes the primary view for medication management, upcoming vet visits, and reminder status — all in one place instead of buried in a collapsible accordion.

**Recommendation:** CONSIDER. This is a larger refactor. The current tab structure works; this is an upgrade, not a fix. Could be phased: Phase 1 = hero photo + detail icons. Phase 2 = tab reorganization.

---

### 2E. Photo Gallery / Timeline (LOW priority)

**Problem:** The competitor has a "Selfie" tab for a photo gallery. We support exactly one profile photo. Cat owners take many photos and would love a chronological gallery showing how their cat has changed over time.

**Proposal:**

Add an optional photo timeline to the cat profile:
- Gallery stored in R2 under `cats/{catId}/gallery/{timestamp}.jpg`
- Each photo has a date and optional caption
- Displayed as a grid or scrollable timeline
- Profile photo is always the most recent gallery entry (or manually pinned)
- Maximum ~20 photos per cat (free tier constraint)

**Why this could be powerful:** A photo from 6 months ago alongside today's photo, with the weight chart showing the same period, tells a visual health story that no other app provides. "Here's Luna at 12 lbs in June — here she is at 9 lbs now" is more compelling than any chart.

**Recommendation:** DEFER. Cool idea but significant scope (R2 multi-file management, gallery UI, storage limits). Consider as a standalone PRD after higher-impact items.

---

## 3. Killer App Features to Promote

Based on the competitive analysis, several items from PRD-killer-app.md become more urgent. The competitor has *zero* health intelligence — this is our moat, and we should widen it.

### 3A. Daily Check-In Screen (P1 — HIGH priority, promote to Approved)

**Problem:** Logging food, water, litter, and activity requires 4 separate QuickAdd interactions. The competitor doesn't even attempt this. We should make daily behavioral logging a single 10-second interaction.

**Full spec (expanding PRD-killer-app.md P1):**

A dedicated "Daily Check-In" flow, accessible from:
- Home screen (prominent card: "How are your cats today?")
- BottomNav "Log" button (add as an option alongside QuickAdd)

**Screen layout:**

```
Daily Check-In — Mar 7, 2026
                                         [Switch cat: Luna v]

Food        [None] [Some] [Most] [All]        <- tap one
Water       [None] [Some] [Most] [All]
Litter      [Not used] [Straining] [Loose/Diarrhea] [Normal]
Activity    [Lethargic] [Low] [Normal] [Active]
Grooming    [None] [Some] [Normal] [Excessive]

Weight      [____] lbs                        <- optional numeric
Notes       [____________________________]    <- optional free text

            [ Log All for Luna ]

            [Next cat: Gemini ->]   or   [Done]
```

**Behavioral details:**
- Pre-selects "Normal" for all categories (most days are normal — make the happy path one tap of "Log All")
- Swiping left/right navigates between cats
- After logging the last cat, shows a confirmation with streak count
- All entries share the same timestamp
- If today's check-in already exists, show a "You already checked in today — update?" prompt
- Accessible from a persistent "Daily Check-In" card on the home screen

**Why now:** The competitor has zero daily engagement features. This is the feature that turns Cat Tracker from "an app I open sometimes" into "the first app I open every morning." Combined with streaks (3B below), this is the habit engine.

---

### 3B. Streak & Consistency Tracking (P2 — HIGH priority, promote to Approved)

**Problem:** Without habit reinforcement, users log sporadically. The competitor relies on vet-pushed reminders to drive opens. We should drive opens through *intrinsic motivation*.

**Full spec (expanding PRD-killer-app.md P2):**

**Streak definition:** A "check-in day" is any day where at least one measurement was logged for a given cat. A streak is consecutive check-in days.

**UI elements:**

1. **Home screen streak badge on cat cards:**
   - Fire emoji + day count: "7 days" (when active streak)
   - Dimmed: "Last logged 3 days ago" (when streak broken)

2. **Home screen streak summary card** (above cat list):
   ```
   Your streak: 12 days
   [===========----------]  longest: 18 days
   Keep it going — check in today!
   ```

3. **Cat profile logging calendar** (inside the Health tab):
   - GitHub-style contribution heatmap for the past 90 days
   - Each square = one day, color intensity = number of measurements
   - Tapping a day shows what was logged

4. **Streak milestones:**
   - 7 days: "One week! You're building a great habit."
   - 30 days: "A full month of caring for {name}."
   - 100 days: "100 days. Your vet would be impressed."
   - Show as a subtle toast/celebration on the check-in confirmation screen

5. **Streak recovery grace period:** Missing one day doesn't break the streak if you log double the next day (backfill yesterday). This prevents frustrating resets from a single missed day.

**Data model:** No new tables needed. Compute streaks from the measurements table: `SELECT DISTINCT date(measured_at) FROM measurements WHERE cat_id = ? ORDER BY 1 DESC`. This is a frontend computation from existing data.

---

### 3C. Weigh-In Reminders (P3 — MEDIUM priority)

**Problem:** Weight is the most medically valuable measurement but also the highest-friction (need a scale). Without cadence prompts, owners forget. The competitor handles this with vet-created reminders; we should let owners self-serve.

**Proposal (expanding PRD-killer-app.md P3):**

- Add `weigh_in_interval_days` to cats table (default: 14)
- Home screen: "Due for weigh-in" badge when last weight measurement is older than the interval
- Compute from `measurements` table: `MAX(measured_at) WHERE type='weight' AND cat_id=?`
- Shown as a gentle nudge card on the home screen, not a notification
- Settings per cat on the edit page: "Remind me to weigh every [7/14/21/30] days"

**Recommendation:** ADOPT as part of the Daily Check-In feature — the check-in screen can include an optional weight field that shows a nudge ("It's been 16 days since you weighed Luna") when overdue.

---

### 3D. AI Health Narrative (P7 — MEDIUM priority, worth exploring)

**Problem:** Our health data is rich but presented as charts and technical correlation descriptions. Non-expert owners may not know what to make of "negative correlation between food intake and weight (r=-0.73, lag 2 weeks)." The competitor offers zero interpretation. We could leapfrog everyone with AI-generated plain-language health summaries.

**Proposal:**

- Weekly or on-demand "Health Summary" per cat, generated via Claude API
- Input: last 30 days of all measurements, health status, active correlations, medication adherence
- Output: 2-3 paragraph narrative in warm, non-alarmist language

**Example output:**
> Luna had a steady week. She ate well 6 out of 7 days and her water intake has been consistent. Her weight held at 9.4 lbs — right where she's been for the past month. Her litter habits are normal and she's been grooming regularly.
>
> One thing to keep an eye on: her activity level has been "Low" for 3 of the last 5 days, which is a change from her usual "Normal." This could just be the weather, but if it continues for another week, it might be worth mentioning at her next vet visit.
>
> Overall: Luna is doing well. Keep up the daily check-ins!

**Why this matters:** This is the feature that would make a vet say "what app is that?" The vet export already generates clinical language — an owner-facing narrative is the same data in a different voice. It also makes the daily check-in data *feel* valuable to the user: "the app actually reads what I log and tells me something useful."

**Implementation notes:**
- Claude API call with structured prompt + measurement data
- Cache the result for 24 hours (don't regenerate on every page view)
- "This is not veterinary advice" disclaimer always present
- Cost: ~$0.01 per summary with Claude Haiku; very sustainable on free tier usage
- Could also generate a "Vet Briefing" version for the export page

**Recommendation:** EXPLORE. High impact, moderate complexity. Write a separate detailed PRD if the product owner is interested.

---

### 3E. Vet Integration — Two-Way Data (FUTURE / exploratory)

**Problem:** The competitor's strongest feature is that the *vet practice* creates reminders that appear in the owner's app. This two-way relationship is powerful for engagement ("my vet uses this app too") and data quality ("the vet entered my cat's weight from the exam").

**Concept:**

- A vet could generate a "link code" for a cat that the owner adds to their Cat Tracker profile
- Once linked, the vet can push: vaccination records, exam reminders, weight from office visits, lab results
- The owner's daily behavioral data could be shared back to the vet (with permission) before appointments
- This turns our vet export from a one-time PDF into an ongoing two-way health channel

**Recommendation:** DO NOT BUILD NOW. This requires a vet-side portal, which is a separate product. But it's worth noting as a long-term differentiator. The competitor has this but does nothing intelligent with the data; we would have the intelligence layer already built.

---

## 4. Things NOT to Change

Based on the analysis, several aspects of our design are already superior. Explicitly: do not regress on these.

| Feature | Why it stays |
|---------|-------------|
| **Dark "Warm Night" design** | The competitor's clinical white UI feels like a doctor's portal. Our dark design creates emotional attachment and is better for the "phone at night" use case. |
| **InsightsPanel + health status system** | The competitor has zero health intelligence. This is our primary differentiator. |
| **Correlation engine** | No competing consumer pet app does lag-correlation analysis on behavioral data. |
| **Vet export with clinical language** | Our export page with dual-audience descriptions (owner vs vet) is more useful than a raw "request record" button. |
| **Behavioral measurement presets** | Our 0-3 scale with labeled presets (None/Some/Most/All) is elegant and fast. Keep this as the basis for the Daily Check-In. |
| **QuickAdd bottom sheet** | Fast single-measurement logging should remain available alongside the new Daily Check-In. |
| **Glass card aesthetic** | The frosted-glass card style with subtle borders is more refined than the competitor's flat white cards. |

---

## 5. Implementation Phases

### Phase 1: Profile Hero + Detail Icons (visual impact)
- Full-bleed hero photo on CatProfile
- Structured icon-prefixed detail fields
- Add `is_neutered` field to cats table + edit form
- No new features, just visual upgrade

### Phase 2: Care Schedule + Type Icons (medication upgrade)
- Rename "Medications" to "Care Schedule"
- Add event types: dental, exam, bloodwork, surgery
- Emoji icon map for all types
- Icon picker on medication/event form
- Display icons in all list contexts

### Phase 3: Daily Check-In + Streaks (engagement engine)
- Daily Check-In screen with multi-category single-submit
- Streak tracking computation + UI (badges, calendar heatmap)
- Weigh-in reminder nudges
- Home screen check-in card

### Phase 4: AI Health Narrative (intelligence layer)
- Claude API integration for weekly health summaries
- Owner-facing narrative on CatProfile
- Vet-facing briefing on export page
- Caching + disclaimer UI

### Phase 5: Profile Tabs + Photo Gallery (structural)
- Reorganize CatProfile tabs (Health / Care / About)
- Photo gallery/timeline (if prioritized)

---

## 6. Open Questions for Product Owner

1. **Profile hero photo**: Full-bleed taking ~40% of viewport, or a more moderate ~25% hero that leaves the chart visible above the fold? (The competitor goes all-in on photo; we have more data to show.)

2. **"Care Schedule" rename**: Is broadening medications to include vet events (exams, dental, bloodwork) the right conceptual move, or should they stay separate?

3. **Daily Check-In**: Should it be the *default* action when tapping "Log" on the BottomNav, with QuickAdd as a secondary option? Or offered as a separate home screen card?

4. **AI Health Narrative**: Is Claude API integration in scope for the near-term? Estimated cost is ~$0.01/summary. Should we write a detailed PRD?

5. **Streak recovery**: Allow backfilling yesterday's check-in to preserve a streak, or strict "you missed it, start over" policy?

6. **Neuter/spay status**: Worth adding now (small schema change) or bundle with a broader "pet details" update?

7. **Photo gallery**: Interested at all, or is single profile photo sufficient for the foreseeable future?

---

*This PRD is a Draft. Do not implement any items until the product owner reviews, selects which proposals to approve, and moves the status to Approved.*

---

## Remaining scope — detailed (2026-07-02)

> Per REGISTRY.md the remaining items are 2E, 3B, 3C, 3D. Phases 1–2 and 3A shipped (hero, detail icons, Care Schedule, tab reorg, daily check-in).

### 2E — Photo gallery / timeline (minimal viable version)

**What/why:** One profile photo exists today; owners want a chronological gallery. Minimal version reuses the proven R2 pipeline: `PHOTOS` bucket binding (`cat-tracker-photos`), public base URL `PHOTOS_BASE` and the upload pattern in `worker/src/routes/cats.ts:259-300`, plus `CatAvatar`/crop patterns from PRD-cat-photos.

**Implementation sketch:**
- D1 table `cat_photos` (`id`, `cat_id` FK CASCADE, `url`, `caption TEXT NULL`, `taken_at TEXT`, `created_at`) — D1 metadata beats R2 `list()` for captions and ordering.
- Worker (add methods to `shared/lib/apiTypes.ts` first): `POST /api/cats/:id/photos` (Editor role, multipart like the existing photo route; R2 key `cats/{id}/gallery/{uuid}.jpg`; reject the 21st photo with 400 per the 20-photo cap), `GET /api/cats/:id/photos` (any member), `DELETE /api/cats/:id/photos/:photoId` (Editor; delete R2 object + row).
- Client: skip the square-crop modal for v1 — downscale longest edge to ~1200px, JPEG q0.85, same server-side size limit as the profile photo.
- UI: 3-column grid section on the **About** tab (`frontend/src/pages/CatProfile.tsx`; native `app/app/cats/[id]/index.tsx`); tap → full-screen viewer with date/caption; delete from viewer; optional "Set as profile photo" action re-uses the existing profile-photo endpoint.
- Cat deletion: gallery rows cascade, but R2 objects don't — extend the cat delete handler to remove `cats/{id}/gallery/*` objects.

**Edge cases:** 20-photo cap needs clear UI messaging; deceased cats keep a read-only gallery (nice on the memorial page, not required for v1); concurrent uploads racing the cap (COUNT check is best-effort — acceptable).

**Acceptance:** Editor can upload/caption/delete, Viewer can only view; 21st upload rejected with a clear error; photos render on both platforms; worker tests for all three routes.

### 3B — Streak & consistency tracking (spec verification + gap fill)

The §3B spec above is largely complete (definition, badges, summary card, heatmap, milestones). **Gaps found on verification, now filled:**

1. **Per-cat vs per-user:** cat card badge = per-cat streak (distinct local calendar days with ≥1 measurement of *any* type for that cat). Home "Your streak" summary = per-user (≥1 measurement across any non-deceased cat that day).
2. **Timezone / "logged today":** bucket `measurements.measured_at` into **device-local** calendar days using `parseLocalDate` from `shared/lib/dates.ts` (streaks are computed client-side; the device timezone is the honest frame for "did I log today"). A 23:50 entry counts for that day only; DST handled by native Date semantics — no manual offsets.
3. **Shared lib (cross-platform rule):** implement `shared/lib/streaks.ts` — e.g. `computeStreak(localDays: string[], today: string): { current: number; longest: number; lastLoggedDaysAgo: number }` — with tests in `shared/__tests__/streaks.test.ts`; both `frontend/src/pages/Home.tsx` and `app/app/(tabs)/index.tsx` import it. No new API or DB (confirmed: computable from existing measurements).
4. **Grace period (decision surfaced):** the "log double the next day" rule adds hidden-state complexity. Recommended simplification: no special rule — the check-in date picker already allows backfilling yesterday, and a backfilled day is simply no longer a gap. PO to confirm dropping the "double" mechanic.
5. **Display surfaces:** Home cat cards + summary card (both platforms); milestone toast on the check-in confirmation; the 90-day heatmap in CatProfile Health tab is **optional/deferrable** if scope is tight.
6. **Exclusions:** deceased cats excluded from badges and the user streak.

**Acceptance:** streak values match hand-computed fixtures including a DST-boundary case; identical results web vs iOS; badge states (active fire vs "Last logged N days ago") render per spec; zero backend changes.

### 3C — Weigh-in reminders (`reminder_interval_days`)

**What/why:** Weight is the highest-value, highest-friction measurement; a per-cat cadence nudge closes the loop. Also closes PRD-features-backlog §3b and the "due for weigh-in" badge.

**Implementation sketch:**
- Migration: `ALTER TABLE cats ADD COLUMN reminder_interval_days INTEGER;` (NULL = off). UI presets 7/14/21/30 on the cat edit form (`frontend/src/pages/AddEditCat.tsx`, `app/app/cats/[id]/edit.tsx`). **Decision surfaced:** default NULL (opt-in, no surprise pushes for existing users — recommended) vs default 14 as §3C originally proposed.
- Plumbing: add the field to `shared/lib/types.ts` `Cat`, and to GET/POST/PUT in `worker/src/routes/cats.ts`.
- Overdue logic (shared helper, e.g. in `shared/lib/streaks.ts` or `formatting.ts`): overdue when `now - MAX(measured_at WHERE type='weight') > interval`; a cat with no weights ever anchors on `created_at`.
- Surfaces: (a) Home nudge card + cat-card badge (client-side, both platforms); (b) check-in screen nudge ("It's been 16 days since you weighed Luna"); (c) **notifications inbox** — extend `GET /api/notifications` (`worker/src/routes/medications.ts`) with a `weigh_in_due` section (cats where interval set, not deceased, overdue) rendered in `NotificationsPage.tsx` / `app/app/notifications.tsx` with a "Log weight" CTA.
- **Push cron:** in `worker/src/index.ts` `scheduled()` (hourly), send an Expo push to the owner's `device_tokens` when a cat becomes overdue. Needs a sent-marker to avoid hourly spam: `ALTER TABLE cats ADD COLUMN weigh_in_reminder_sent_at TEXT;` — re-notify only when the marker is older than `reminder_interval_days` (max one push per cat per interval). Clear the marker when a new weight measurement is posted (measurements route). Fire near the user's local morning using `users.timezone` (fallback: 17:00 UTC).

**Edge cases:** deceased cats excluded everywhere; household cats notify `cats.user_id` owner only in v1 (matches medication push semantics); disabling the interval clears badges and stops pushes; interval shortened mid-cycle re-evaluates immediately.

**Acceptance:** badge/inbox appear exactly when overdue and disappear after a weight is logged; at most one push per cat per interval; shared overdue helper unit-tested; worker inbox test updated.

### 3D — AI Health Narrative

**Not specified here.** Needs its own detailed PRD (prompt design, caching, cost controls, disclaimer/clinical-content review against `docs/research/` standards, and Claude API key management) before any implementation — consistent with REGISTRY.md's "Planned (no PRD written)" entry. Do not implement from this document.
