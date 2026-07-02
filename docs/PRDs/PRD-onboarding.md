# PRD: First-Run Onboarding & Empty-State Guidance

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-daily-checkin.md (Implemented — the activation target), PRD-household-sharing.md (Partial — invited-member join path), PRD-visual-identity-v2.md (In Progress — Lamplight visuals for carousel) |
| **Related** | TODO.md Phase 58 deferred item ("One-time release-note row at top of Settings") — folded into Phase C |

---

## Problem

A new user signs in and lands on an empty Home screen with an "Add Cat" button. That's it. Everything that makes Cat Tracker worth choosing over a notes app — the 15-second daily check-in, correlation insights, the care schedule with push reminders, the sitter view, the one-tap vet export — is discoverable only by poking around after the user has already invested in adding a cat and some data. There is no guided path from install to the moment the product proves itself: the first logged measurement.

App Store users are the sharpest version of this problem: they downloaded on the strength of screenshots, and the first session decides whether there is a second one. Today the app spends that session showing them blank tabs.

---

## Target users

- **Fresh installs** (App Store or web) with zero cats and zero context.
- **Invited household members** who join via an invite link into a household that already has cats and data — a *different* first run that today gets the same nothing.
- **Returning users after an update** who have no way to learn what shipped (the App Store "What's New" text is read by approximately no one).

---

## User stories

1. **New owner**: "I just downloaded this. Show me in ten seconds what it does, then get me to add my cat without making me hunt for the button."
2. **Skeptic**: "I don't do tutorials. Let me skip everything and still figure the app out from the screens themselves."
3. **Empty-tab wanderer**: "I added my cat, then opened Trends and it's blank. Tell me *why* it's blank and what to do about it — don't just show white space."
4. **Tire-kicker**: "Before I type in my cat's real info, let me see the app with data in it. Give me a sample cat I can poke at and then delete in one tap."
5. **Invited partner**: "My wife invited me to the household. Don't ask me to add a cat — Peanut is already there. Show me where to log and what my role lets me do."
6. **Updater**: "The app updated. Tell me once, briefly, what's new — then never mention it again."

---

## Scope (phased)

### Phase A — Welcome carousel, guided first cat, contextual empty states

- **Welcome carousel** (first sign-in only): 2–3 screens of value props, swipeable, with a persistent "Skip" affordance. Proposed screens:
  1. *Log in 15 seconds a day* — check-in screen visual: weight, food, litter, behavior in one pass.
  2. *See what's connected* — trends + correlations visual ("appetite dipped 2 days before the vomiting started").
  3. *Never miss a dose* — care schedule + push reminder + sitter view visual.
  - Final screen's primary CTA: **"Add your cat"**. Skipping at any point lands on Home.
- **Guided add-your-first-cat**: the existing Add Cat form, entered from the carousel CTA, with onboarding framing (progress feel, "you can add more later"). On save, land on the cat profile with a one-time callout pointing at the Log button: *"Log your first weight — that's the whole habit."*
- **Contextual empty states with CTAs** on each major surface, replacing blank space (web + iOS):

| Surface | Empty state copy (draft) | CTA |
|---|---|---|
| Home (no cats) | "Add your first cat to start tracking weight, appetite, and more." | Add Cat |
| Home (cats, no data today) | existing check-in nudge — keep | Log today's check-in |
| Care tab (no items) | "Track medications, fluids, and vet visits — with reminders." | Add care item |
| History (no measurements) | "Measurements you log will show up here, grouped by day." | Log a measurement |
| Trends/Compare (no data or one point) | "Charts need a few days of data. Log daily and trends appear here." | Log a measurement |
| Trends (data, no correlations yet) | "Correlations appear once two measures overlap for ~2 weeks." | — (informational) |

- **Persisted onboarding flag**: `users.onboarded_at` (server-side, see data model) — survives reinstall and follows the account across devices/platforms. Set when the carousel completes *or* is skipped.

### Phase B — Optional demo cat

- On the carousel's final screen (and Home's empty state), a secondary option: **"Explore with a sample cat."**
- Server seeds a demo cat ("Whiskers (Sample)") with ~3 weeks of plausible data: daily weights with a mild dip, food/water, a couple of behavioral scores, one care item with dose history — enough to light up Home, History, Trends, Care, and one correlation.
- **Clearly labeled everywhere**: "Sample" badge on the card, banner on the profile ("This is sample data — Remove sample cat"), excluded by flag from vet export and the sitter view (nobody hands a vet fake data).
- **One-tap removal** from the banner or Home; delete cascades like a normal cat. Adding a first real cat prompts removal but doesn't force it.
- Demo data must not trigger real health alerts pushes or care reminders (no doses due in the future; `is_demo` excluded from cron push queries).

### Phase C — Post-update "What's new" sheet

- One-time, dismissible sheet (iOS) / banner-row (web Settings) shown on first launch after a version change, listing 2–4 bullet highlights.
- **Folds in TODO.md Phase 58's deferred item** — "One-time release-note row at top of Settings" — this PRD supersedes that line item; implement it here, not separately.
- Content source: release-note entries in `CONFIG_KV` (`app_config` already exists and is fetched unauthenticated) keyed by version, so notes ship without an app-store release for web and can be written once for both platforms.
- Seen-state: `last_seen_release_notes` stored client-side (AsyncStorage / localStorage) — per-device by design; a shared device with two users is fine seeing it twice, and this avoids a server write on every launch.

### Success metric

**Activation rate: fraction of new accounts that log ≥ 1 measurement in their first session** (proxy: within 24h of `users.created_at`). Measurable today with a D1 query — no new tracking infrastructure:

```sql
SELECT COUNT(DISTINCT u.id) * 1.0 / (SELECT COUNT(*) FROM users WHERE created_at > ?) AS activation
FROM users u
JOIN cats c ON c.user_id = u.id
JOIN measurements m ON m.cat_id = c.id
WHERE u.created_at > ? AND m.created_at < datetime(u.created_at, '+1 day');
```

Capture the baseline **before** Phase A ships; target is directional improvement, not a specific number (traffic is small).

---

## Data model sketch (D1, additive only)

```sql
-- Phase A: server-persisted onboarding completion (survives reinstall, cross-device)
ALTER TABLE users ADD COLUMN onboarded_at TEXT;   -- ISO datetime; null = show onboarding

-- Phase B: demo cat marker
ALTER TABLE cats ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
```

Notes:

- `onboarded_at` on `users` (not a table): it's one nullable scalar per user, the same shape as `timezone`. Returned by the existing `/api/me` payload so clients decide the first-run path with zero extra requests.
- `is_demo` on `cats`: demo cats are real rows (real measurements, real care items) so every screen works unmodified; the flag exists only for labeling, export/sitter exclusion, and cron push exclusion. Deleting the demo cat is the ordinary cat-delete cascade.
- Phase C needs **no schema** — content in KV, seen-state on device.
- Existing users: a backfill sets `onboarded_at = created_at` for all accounts existing at deploy time, so **no current user ever sees the carousel** (see Edge cases).

---

## API sketch

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | **Exists** — response gains `onboarded_at` (and nothing else changes) |
| `POST` | `/api/me/onboarded` | New. Sets `onboarded_at = now` if null (idempotent). Called on carousel finish/skip |
| `POST` | `/api/onboarding/demo-cat` | New (Phase B). Creates the demo cat + seeded measurements + care history for the caller's household; 409 if one already exists. Rate-limited (reuses `rate_limits`) |
| `DELETE` | `/api/cats/:id` | **Exists** — one-tap removal is a normal cat delete; no special endpoint |
| `GET` | `/api/config` | **Exists** (unauthenticated KV-backed config) — payload gains `releaseNotes: { version, highlights[] }` (Phase C) |

- Add new methods to `CatTrackerApi` in `shared/lib/apiTypes.ts` first; both clients implement.
- Demo-cat seed content is generated server-side from a fixture in `worker/src/lib/` so both platforms get identical sample data; dates are computed relative to "now" so charts always look fresh.
- Update `docs/API.md` alongside implementation.

---

## UX notes (web + iOS — parity mandatory)

### Carousel

- **Both platforms get it.** iOS: full-screen swipeable pager after first sign-in. Web: the same 2–3 panels as a centered modal/route after first sign-in — same copy, same Lamplight illustrations, DOM-appropriate layout. Parity is content parity, not pixel parity.
- Visuals use Lamplight (PRD-visual-identity-v2) tokens and illustration style; static images or lightweight lottie-free renders — no video, no heavy assets on first paint.
- "Skip" visible on every panel; completing or skipping both call `POST /api/me/onboarded`.
- iPad: use the existing `useResponsiveLayout` / `ResponsiveContainer` system (this is exactly the class of screen that got Build 25 rejected — test iPad explicitly).

### Empty states

- One shared pattern (icon + one sentence + one CTA), implemented as a small reusable component per platform — not bespoke per screen. Tone per DESIGN.md: warm, concrete, no exclamation marks.
- Empty states are permanent furniture, not onboarding: a user who deletes all data sees them again. They must read correctly for that user too (nothing "welcome!"-flavored).
- Note: ROADMAP WP5c already plans a CatProfile empty-state CTA — coordinate so it uses this shared component rather than shipping a one-off.

### Guided first cat + first-log callout

- The callout pointing at the Log button is a one-time, dismissible tooltip-style nudge (per-device seen-state); it never appears again after a first measurement exists.

### Demo cat

- "Sample" badge on the Home card; persistent banner on the profile with the remove action. Banner copy: *"Whiskers is sample data so you can explore. Remove sample cat"*.
- Demo cat sorts last on Home.

### What's new

- iOS: bottom sheet on first launch of a new version — max 4 bullets, one "Nice" dismiss button. Web: the Phase 58 row at the top of Settings, dismissible, same content from `/api/config`.
- Never blocks the user's task: shown after Home renders, never before login or during onboarding (a brand-new user's version is by definition "seen").

---

## Edge cases

- **Returning users must never see onboarding**: backfill `onboarded_at = created_at` for all existing accounts in the same migration that adds the column, *before* any client that reads the flag ships. A null check alone is not enough — the flag must be server-side so reinstalls and new devices stay clean.
- **Invited household members**: after invite acceptance, the household already has cats → carousel shows a **tailored final panel** ("You've joined Steve's household — Peanut is already here") and the add-cat step is skipped entirely; the first-log callout still applies (their activation moment is the same). Role-appropriate: a `viewer` gets "browse" framing, not "log" CTAs.
- **Sign-in on second platform** (web after iOS or vice versa): `onboarded_at` is set → no carousel; per-device nudges (first-log callout, what's-new) may show once per device, which is acceptable.
- **Skip on panel 1**: full skip = onboarded; never re-prompt. There is no "resume onboarding."
- **Demo cat + real cat coexistence**: correlations, alerts, and Home all function; only export/sitter/push exclude the demo. Attempting a second demo cat → 409.
- **Demo cat in a shared household**: any editor can remove it; the "Sample" badge renders for every member (the flag is on the cat, not the user).
- **Offline first launch (iOS)**: if `/api/me` can't be reached the app already gates on auth; onboarding state resolves whenever the first authenticated load succeeds — no local guessing that could double-show or permanently hide it.
- **What's-new after multiple skipped versions**: show only the latest version's notes, not a backlog.
- **Web user with no `app_config` release-notes entry**: sheet/row simply doesn't render; absence of content is not an error.

---

## Out of scope

- Interactive walkthrough overlays / coach marks beyond the single first-log callout (tour frameworks age badly and fight the DESIGN.md minimalism).
- Onboarding emails or push re-engagement campaigns ("You haven't logged yet!").
- Account-less "try before sign-in" mode (auth is the front door; demo cat covers the tire-kicker inside it).
- A/B testing infrastructure for carousel variants (traffic is far too small).
- Analytics SDKs — the success metric is a D1 query, and that's deliberate.
- Localizing carousel content (app is English-only today; PRD-localization-preferences covers formats, not copy).

---

## Open questions for product owner

1. **Demo-data content**: which measurement types and story should the sample cat tell? Proposal: 21 days of weight with a gentle decline that trips a *mild* trend insight (shows the feature without alarmist copy), food/water, litter, one behavioral score, one active care item with a dose history — but the exact shape (and whether a *declining* weight is the right first impression) is a product call.
2. **Carousel parity**: is the web modal version required at launch, or does web ship empty-states-only in Phase A with the carousel following? (iOS is where first-run impressions matter most; a cut here halves Phase A.)
3. **Demo cat entry points**: carousel + empty Home only, or also in Settings later ("Re-add sample cat") for demos/support?
4. **What's-new cadence**: every TestFlight/App Store version, or only "marketing-worthy" releases? (Recommend: only when someone writes highlights into KV — absence means silence.)

---

## Acceptance criteria

### Phase A
- [ ] `users.onboarded_at` added via idempotent migration; all pre-existing accounts backfilled in the same migration; `/api/me` returns it.
- [ ] First sign-in on iOS shows the carousel (2–3 panels, skippable everywhere); finishing or skipping calls the onboarded endpoint; it never renders again on any device thereafter.
- [ ] Web shows the equivalent carousel content per the parity decision in open question 2 (or documented deferral).
- [ ] Carousel final CTA opens the existing Add Cat flow; saving lands on the cat profile with the one-time first-log callout; callout never reappears once a measurement exists.
- [ ] Invited members joining a household with cats skip the add-cat step and see the tailored joined-household panel.
- [ ] All six empty states in the Scope table render with copy + CTA on **both** platforms, via a shared per-platform component, at 375px and on iPad.
- [ ] Baseline activation rate recorded (D1 query) before deploy; query documented for re-running.
- [ ] Tests: worker (onboarded endpoint idempotency, `/api/me` shape, backfill), frontend + app (carousel skip/finish paths, empty-state rendering).

### Phase B
- [ ] "Explore with a sample cat" seeds the demo cat server-side with fixture data relative to today; charts, history, care, and at least one correlation render with it.
- [ ] Demo cat is visibly labeled on every surface, sorts last, is excluded from vet export, sitter view, and cron push notifications, and is removable in one tap by any editor+.
- [ ] Second demo-cat request returns 409; endpoint is rate-limited.

### Phase C
- [ ] Release-note highlights read from `CONFIG_KV` via `/api/config`; iOS sheet and web Settings row show once per device per version and dismiss permanently.
- [ ] TODO.md Phase 58's "one-time release-note row" item is satisfied by this implementation (mark it complete there, referencing this PRD).
- [ ] No release-notes content in KV → no UI rendered, no errors.
