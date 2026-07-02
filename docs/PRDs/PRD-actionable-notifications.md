# PRD: Actionable Notifications & Daily Digest

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-medication-reminders.md (`Partial` — dose model, `/api/doses/:id/administer`), PRD-push-notifications.md (`In Progress` — Expo push, `device_tokens`, hourly cron) |
| **Related** | ROADMAP.md WP1 (overdue hygiene), WP4b (overdue follow-up reminder), WP4c (snooze affordances in-app) |

---

## Problem

Today the push notification says "Reminder: Peanut — Time to give Fluids" and then makes the user do all the work: unlock the phone, open the app, navigate to the cat, find the dose, tap "Mark given." Every step is a chance to get distracted. If the moment passes — hands full of cat, syringe in the other hand — nothing follows up, and the dose silently joins the overdue pile.

This is the behavioral half of the overdue-pileup problem whose mechanical half is being fixed in ROADMAP WP1: WP1 stops overdue doses from accumulating unboundedly, and WP4b adds a single 24-hour follow-up push. But the fastest way to prevent an overdue dose is to make *acting on the reminder* take one tap, at the lock screen, at the moment the reminder fires. Secondarily, users with multiple care items have no morning overview — each item pings individually at its own hour, and there is no "here's your care day" summary.

---

## Target users

- **Daily-treatment households** (subQ fluids, methimazole ×2/day) where the reminder→administer loop runs 400+ times a year — every saved tap compounds.
- **Busy owners** who see the push, think "in five minutes," and need a snooze that actually comes back.
- **Multi-item households** who want one morning digest instead of a scatter of per-item pings.
- **Notification-sensitive users** who will disable push entirely unless they get quiet hours and per-item muting.

---

## User stories

1. **One-tap given**: "The push fires at 8 PM while I'm giving Mochi her pill. Let me long-press the notification and tap 'Mark given' without opening the app."
2. **Snooze**: "I see the reminder but I'm driving. 'Snooze 1h' — remind me again when I'm home."
3. **Morning digest**: "At 7:30 AM tell me '2 care items due today for Peanut: Fluids at 9 AM, Methimazole at 8 PM.' I'll plan my day around it."
4. **Mute one item**: "The vet said to pause the appetite stimulant reminders but keep the schedule — mute this item's pushes without deleting it."
5. **Quiet hours**: "Never buzz me between 10 PM and 7 AM. If a dose is due at 11 PM, I set it that way on purpose — but the *follow-up* can wait until morning."

---

## Scope (phased)

### Phase A — Actionable iOS push (Mark given / Snooze 1h)

- Register an expo-notifications **notification category** (e.g. `care_dose`) at app startup via `Notifications.setNotificationCategoryAsync`, with two actions:
  - **"Mark given"** — background action (`opensAppToForeground: false`). The response handler calls the existing `POST /api/doses/:id/administer` with the stored Bearer token; no UI.
  - **"Snooze 1h"** — background action; see the snooze design below.
- Cron push messages gain `categoryId: 'care_dose'` (Expo push field) and carry `doseIds: string[]` in `data`. The cron already groups multiple meds per cat into one push; when a push covers multiple doses, the action label becomes **"Mark all given"** and administers every dose in the payload (they were all due that hour — this matches the "I did the 8 PM round" mental model).
- Failure handling: if the background call fails (token expired, offline), fire a local notification "Couldn't mark Peanut's dose — tap to open" that deep-links into the app.

**Snooze design — the server/local tradeoff (spec'd, final call is an open question):**

| | Server-side snooze | Client-side local notification |
|---|---|---|
| Mechanism | New `POST /api/doses/:id/snooze` sets `snoozed_until`; hourly cron re-pushes once `snoozed_until` passes | App schedules a local notification at now+1h via expo-notifications |
| Timing precision | Coarse — cron runs at :00, so "1h" lands 1–2h later in practice | Exact 60 minutes |
| Household visibility | Yes — dose row shows "snoozed until 9:20" to all members; other devices don't re-ping early | No — server unaware; WP4b follow-up could double-ping |
| Offline behavior | Requires network at snooze time | Works offline |
| Interaction with WP4b follow-up | Clean — follow-up logic checks `snoozed_until` | Messy — server can't suppress its follow-up |

**Recommended: hybrid.** The action calls the server endpoint (source of truth: suppresses WP4b's follow-up and other devices' re-pings until `snoozed_until`) *and* schedules a local notification at exactly +1h on the acting device (precision). If the server call fails, the local notification still fires — graceful degradation.

### Phase B — Morning daily digest (opt-in)

- Per-user preference: `digest_enabled` (default **off**) + `digest_time` (HH:MM local, default 08:00).
- The hourly cron, for each user whose local time (via `users.timezone`) has just crossed their `digest_time` and who hasn't received today's digest (`digest_last_sent_date` guard, user-local date), assembles: doses due today across all their cats, plus overdue count if nonzero.
- One push: **"2 care items due today for Peanut"** / body lists items with times, e.g. "Fluids at 9 AM · Methimazole at 8 PM". Multiple cats: "4 care items due today for Peanut and Mochi". Overdue prefix when applicable: "1 overdue · 2 due today…".
- No due items and nothing overdue → **no push** (silence is the feature).
- Digest tap deep-links to the notifications inbox.

### Phase C — Notification preferences screen

- New "Notifications" section in Settings (web + iOS):
  - Digest on/off + time picker.
  - **Quiet hours** (start/end, local): due-hour pushes and follow-ups are *deferred* to quiet-hours end, not dropped. (Doses scheduled *inside* quiet hours by the user still push at their due hour — the user asked for that time explicitly; only follow-ups and digests defer.)
  - **Per-care-item mute**: per user, per medication — mutes pushes for that item without touching the schedule, other members' notifications, or the in-app inbox.
- Backed by a `notification_prefs` table + `care_item_mutes` table (see data model). Chosen over columns on `users` to keep `users` lean and because mutes are inherently multi-row.

**Explicitly referenced, not duplicated here:** the overdue follow-up reminder (one re-ping ~24h after a dose goes unresolved) is ROADMAP **WP4b** and stays in PRD-medication-reminders' approved scope. This PRD only requires that snooze (`snoozed_until`), quiet hours, and per-item mutes are *respected* by that follow-up when it lands.

---

## Data model sketch (D1, additive only)

```sql
-- Phase A: snooze marker on doses
ALTER TABLE medication_doses ADD COLUMN snoozed_until TEXT;  -- ISO datetime; null = not snoozed

-- Phase B/C: per-user notification preferences (one row per user, created lazily)
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  digest_enabled         INTEGER NOT NULL DEFAULT 0,
  digest_time            TEXT NOT NULL DEFAULT '08:00',   -- HH:MM, user-local
  digest_last_sent_date  TEXT,                            -- YYYY-MM-DD user-local; idempotency guard
  quiet_hours_start      TEXT,                            -- HH:MM; null = no quiet hours
  quiet_hours_end        TEXT,
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase C: per-user, per-care-item push mute
CREATE TABLE IF NOT EXISTS care_item_mutes (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id  TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, medication_id)
);
```

Notes:

- `snoozed_until` also unlocks ROADMAP WP4c's in-app snooze affordance — same column, two entry points.
- Cron changes: the due-this-hour query gains `AND (d.snoozed_until IS NULL OR d.snoozed_until <= datetime('now'))`; re-push after snooze reuses the existing `notification_sent_at` marker by clearing it when a snooze is set (one marker, no new bookkeeping). Push-message assembly excludes `(user, medication)` pairs present in `care_item_mutes` and users currently inside quiet hours (defer, don't drop — deferred items send at quiet-hours end via the normal hourly pass).
- Digest requires `users.timezone` — ROADMAP WP2a (timezone backfill) is a soft prerequisite for Phase B; users without a timezone fall back to UTC with the known caveat.

---

## API sketch

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/doses/:id/administer` | **Exists** (PRD-medication-reminders). Called by the notification action; accepts optional `administered_at`. No changes needed beyond confirming it's idempotent when called twice (double-tap on the action) |
| `POST` | `/api/doses/:id/snooze` | New. Body `{ minutes?: number }` (default 60, max 24h). Sets `snoozed_until = now + minutes`, clears `notification_sent_at`. Auth: any active household member of the cat (same rule as administer) |
| `GET` | `/api/notification-prefs` | New. Returns the user's row (defaults if none) |
| `PUT` | `/api/notification-prefs` | New. Upsert digest/quiet-hours fields; validates HH:MM |
| `PUT` | `/api/medications/:id/mute` | New. Body `{ muted: boolean }` — inserts/deletes the caller's `care_item_mutes` row |

- All behind `requireAuth`; add to `CatTrackerApi` in `shared/lib/apiTypes.ts` first, then both clients.
- Notification action calls from the iOS background handler use the same Bearer transport as the rest of `app/lib/api.ts` — no special auth path.
- Update `docs/API.md` alongside implementation.

---

## UX notes (web + iOS — parity mandatory)

### iOS

- **Lock-screen actions** (Phase A): long-press/expand the care push → "Mark given" (or "Mark all given") and "Snooze 1h". Success is silent; failure produces the fallback local notification. After "Mark given," a subsequent app open shows the dose already administered — no sync surprise.
- **Preferences** (Phase C): Settings → Notifications: digest toggle + native time picker, quiet hours pickers, and a muted-items list. Additionally, each care item's detail/edit screen gets a "Mute reminders for me" toggle — mute lives where the annoyance is felt.
- **Digest** (Phase B): tap opens the notifications inbox (`app/app/notifications.tsx`).

### Web

- Web has no native push today (PRD-medication-reminders Phase B / web push is deprioritized per ROADMAP WP4f), so parity means:
  - **Snooze and Mark given as inline actions** on inbox rows (`NotificationsPage.tsx`) — the same endpoints, in-app. Snoozed rows show "Snoozed until 9:20 AM" and drop out of the Overdue/Due sections until then.
  - **Preferences screen parity** (Phase C): identical Settings section on web — the prefs govern iOS pushes but are viewable/editable anywhere (households share devices unevenly).
  - Digest has no web delivery channel in this PRD; the digest *content* is effectively the existing inbox. If web push ships later, digests reuse `notification_prefs` unchanged.

### Copy

- Keep verbs physical and cat-specific: "Mark given", "Snooze 1h", "2 care items due today for Peanut". No exclamation points before 9 AM.

---

## Edge cases

- **Double-tap / race**: two household members (or one user twice) mark the same dose given — `administer` must be idempotent (second call is a no-op or 200-with-current-state, never a duplicate record or 500).
- **Grouped push, partial truth**: "Mark all given" administers all doses in the payload. If the user actually gave only one of two meds, they can un-mark/annotate in-app; the action optimizes for the common case. (Sending one push per dose was rejected: 3 meds at 8 PM = 3 lock-screen rows of noise.)
- **Stale action on an old notification**: user taps "Mark given" on yesterday's push after someone else already administered or the dose was skipped/expired (WP1c `missed` state) — server responds idempotently/409-safe; client stays silent on already-resolved, shows the fallback notification only on real errors.
- **Snooze past end of schedule or past a WP1c expiry cutoff**: cap `snoozed_until` so it can't resurrect a dose WP1's hygiene has expired; expired-while-snoozed doses just never re-ping.
- **Quiet hours spanning midnight** (22:00–07:00): the deferral math must handle wrap-around; test at UTC±12 per the WP2 timezone suite.
- **Digest + timezone missing**: no `users.timezone` → UTC fallback; digest may land at odd hours. Acceptable pre-WP2a; note it in the prefs UI ("Times use your device timezone" once WP2a lands).
- **Digest idempotency across cron retries**: `digest_last_sent_date` is checked-and-set in the same pass; a re-run within the hour must not double-send.
- **Deleted/archived care item with a live snooze or mute**: cascades handle mutes; snoozed doses of archived meds are already excluded by `m.is_active = 1`.
- **User with zero device tokens**: digest and actions are iOS-only surfaces; the prefs screen on web must not imply pushes will arrive without the app installed.

---

## Out of scope

- Web push / VAPID delivery (PRD-medication-reminders Phase B; deprioritized per ROADMAP WP4f).
- Email digests (Resend exists; possible later — see open questions).
- The 24h overdue follow-up itself (ROADMAP WP4b, PRD-medication-reminders scope).
- Custom snooze durations in the notification UI (fixed 1h action; the API supports `minutes` for future in-app pickers per WP4c).
- Per-cat (as opposed to per-item) mute; household-level notification policies.
- Android delivery (future-proofing noted below, but no Android build exists).
- Rich notifications (images, progress) and iOS Live Activities.

---

## Open questions for product owner

1. **Snooze: hybrid, server-only, or local-only?** Recommendation is the hybrid (server as source of truth + local notification for precision). If simplicity wins, server-only costs snooze precision (1–2h effective); local-only breaks household visibility and WP4b coordination.
2. **Android future-proofing**: `device_tokens.platform` already allows `'android'` and Expo categories map to Android notification actions — should Phase A code be written platform-agnostic now (cheap: avoid `Platform.OS === 'ios'` guards around category registration), or is that speculative?
3. **Digest scope**: one digest covering all cats (recommended) or per-cat digests? And should the digest include yesterday's missed items or is that WP4b/WP1c's job alone?
4. **Grouped "Mark all given"**: acceptable, or must actions be strictly per-dose (one push per dose)?

---

## Acceptance criteria

### Phase A
- [ ] Care pushes carry the `care_dose` category; long-press shows "Mark given"/"Mark all given" and "Snooze 1h" on iOS lock screen and notification center.
- [ ] "Mark given" administers the payload dose(s) via the existing endpoint without opening the app; the dose shows as administered on next app/web load for **all** household members.
- [ ] Repeat taps and already-resolved doses are handled idempotently (no duplicates, no error toast for benign races).
- [ ] "Snooze 1h" suppresses re-pings until `snoozed_until` and (per chosen design) re-notifies afterward; snoozed rows render as snoozed in the web and iOS inboxes.
- [ ] Failed background actions produce the fallback "tap to open" notification.
- [ ] Web inbox rows gain Snooze alongside the existing Mark given/Skip (parity).
- [ ] Worker tests: snooze endpoint validation, cron exclusion of snoozed doses, `notification_sent_at` reset; app tests for category registration and response handling.

### Phase B
- [ ] Digest sends at most once per user-local day, within the hour of `digest_time`, only when items are due/overdue, only when `digest_enabled`.
- [ ] Digest copy matches spec ("N care items due today for <cat(s)>" with per-item times); tap deep-links to the inbox.

### Phase C
- [ ] Settings → Notifications exists on **both** platforms: digest toggle/time, quiet hours, muted items.
- [ ] Quiet hours defer follow-ups/digests (never drop them) and handle midnight wrap; due-hour pushes for explicitly-scheduled times still fire.
- [ ] Per-item mute silences that item's pushes for the muting user only; inbox and other members unaffected.
- [ ] `notification_prefs` and `care_item_mutes` migrations are idempotent; `docs/API.md` updated.
