# PRD: Medication Reminders

| | |
|---|---|
| **Status** | `Partial` (Phase A implemented; Phases B, C, D remaining) |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |

---

## Problem

Cat owners who give recurring medications — monthly flea/tick prevention, daily thyroid pills, heartworm prophylaxis — have no reliable reminder system built into Cat Tracker. Today they rely on phone calendar entries, sticky notes, or simply forgetting. Missing a dose of methimazole can cause a thyroid crisis; missing monthly flea medication starts an infestation. This is a high-stakes, high-frequency pain point that the app is well-positioned to solve.

---

## User Stories

1. **Monthly prevention user**: "I give Luna Revolution every 28 days. Remind me the day it's due and again if I miss it."
2. **Daily pill user**: "Mochi takes 2.5mg methimazole every 12 hours. Remind me at 8am and 8pm. I need to know if I forgot a dose."
3. **Multi-cat household**: "All three cats get flea medication the same day. One reminder should cover all of them."
4. **Reorder reminder**: "I have 3 doses of Heartgard left. Remind me to order more in 2 weeks."
5. **Vet appointment**: "Luna's annual exam is April 15. Remind me a week before and the morning of."
6. **Finite course**: "Mochi is on a 14-day antibiotic course. Remind me daily and tell me how many days are left."

---

## Scope

### In scope
- Medication schedule management (per cat, per medication)
- Recurring and one-time reminders (daily, every N days, monthly, custom interval)
- Finite treatment courses with auto-end
- In-app notification inbox with badge count on home screen
- "Mark as given" with optional timestamp and notes
- "Skip dose" with reason
- Refill reminders (track doses remaining, warn before runout)
- Web Push notifications (opt-in, for PWA-installed users)
- Cron-driven reminder delivery (piggybacks on existing daily cron)
- Pre-built presets for common cat medications
- Per-notification preferences (opt-in push, quiet hours)

### Out of scope (first version)
- Email notifications (Phase 2 — via Resend transactional email)
- SMS notifications
- Multi-cat single reminder ("give all cats flea meds") — Phase 2
- Medication interaction checking
- Prescription refill tracking with pharmacy integration
- Reminders shared with another household member (blocked on household sharing PRD)
- Dosage tapering schedules (e.g., steroids reduced over time)

---

## Medication Model

### Schedule parameters

A **medication schedule** defines what to give, when to start, how often, and when (if ever) to stop.

```
medications
├── id, cat_id, user_id
├── name          TEXT    -- "Revolution Plus" / "Methimazole" / custom
├── type          TEXT    -- 'flea' | 'heartworm' | 'pill' | 'vaccine' | 'supplement' | 'other'
├── dose          TEXT    -- "1 tube" / "2.5mg" / "1 tablet" — free text
├── frequency     TEXT    -- 'daily' | 'twice_daily' | 'weekly' | 'monthly' | 'custom'
├── frequency_days INT    -- for custom: interval in days (28 for "every 4 weeks")
├── start_date    TEXT    -- ISO date of first dose
├── end_date      TEXT    -- ISO date — null means ongoing; set for finite courses
├── doses_total   INT     -- for finite courses: total doses in the course (null = ongoing)
├── notes         TEXT    -- "Give with food" / "Topical — part fur between shoulder blades"
├── is_active     INT     -- 1 = active, 0 = paused/archived
├── doses_remaining INT   -- current count of doses in stock (null = not tracking)
├── refill_alert_days INT -- remind this many days before estimated runout (null = disabled)
└── created_at, updated_at
```

### Dose records

Each individual administration event is tracked:

```
medication_doses
├── id, medication_id
├── due_at          TEXT  -- scheduled datetime for this dose
├── administered_at TEXT  -- actual datetime given (null = not yet given)
├── skipped         INT   -- 1 if explicitly skipped
├── skip_reason     TEXT  -- optional: "cat refused", "traveling", "vet advised hold"
├── notes           TEXT  -- optional: "vomited 30min later" / "gave at clinic"
└── created_at
```

### Dose generation strategy

Doses are **materialized 90 days forward** when a medication is created or updated, then extended by the daily cron. This keeps queries simple (no on-the-fly schedule math in every request) without creating unbounded records.

- On `POST /api/medications`: generate doses from `start_date` to `start_date + 90 days`
- On `PUT /api/medications`: regenerate future doses from today + 90 days
- Daily cron (03:00): extend all active medications by generating doses through today + 90 days (idempotent; skips dates that already have a row)
- When a dose is administered: the next dose is confirmed by the cron's next run (no immediate action needed)

Calculation of `due_at` for each dose:
```
dose_N.due_at = start_date + (N * frequency_days)
```
For `twice_daily`: two doses per day at `start_time` and `start_time + 12h`
For `monthly`: `start_date + N * 30` days (normalized to same day-of-month if possible)

---

## In-App Notification Inbox

### Data model (no separate table needed)

The inbox is a **computed view** over `medication_doses` and medications, grouped by urgency:

| Section | Query condition |
|---------|----------------|
| **Overdue** | `due_at < now()` AND `administered_at IS NULL` AND `skipped = 0` |
| **Due today** | `due_at` within the next 24h AND not administered |
| **Upcoming** | `due_at` within the next 7 days AND not administered |
| **Refill alerts** | `doses_remaining ≤ threshold` AND `doses_remaining > 0` |

### UI: `/notifications` page

```
Notifications

  OVERDUE (1)
  ┌──────────────────────────────────────────────┐
  │ 🐱 Mochi  •  Methimazole                     │
  │ Was due: Yesterday at 8:00 PM                │
  │ [Mark Given]  [Skip]                         │
  └──────────────────────────────────────────────┘

  DUE TODAY (2)
  ┌──────────────────────────────────────────────┐
  │ 🐱 Luna  •  Revolution Plus                  │
  │ Due: Today at 9:00 AM                        │
  │ [Mark Given]  [Skip]                         │
  └──────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────┐
  │ 🐱 Mochi  •  Methimazole                     │
  │ Due: Today at 8:00 PM                        │
  │ [Remind me later]                            │
  └──────────────────────────────────────────────┘

  REFILL ALERT
  ┌──────────────────────────────────────────────┐
  │ Luna  •  Revolution Plus                     │
  │ 2 doses remaining — order soon               │
  └──────────────────────────────────────────────┘
```

### Home screen badge

A notification bell (or count badge) on the home screen shows the count of overdue + due-today items. Tapping navigates to `/notifications`.

### Cat profile integration

Each cat's profile page shows a "Medications" section below the insights panel:
- Active medications listed with next due date
- "Add Medication" button
- Overdue doses shown with red indicator

---

## Push Notifications

### Architecture

Web Push allows server-to-browser push messages even when the app is not open, using the browser's push service. Requires:
1. A service worker registered on the frontend
2. VAPID key pair (generated once, stored as Worker secrets)
3. User grants notification permission; browser returns a push subscription object
4. Client POSTs subscription to `/api/push/subscribe`
5. Server sends push messages via the Web Push protocol

### VAPID signing

The Worker uses `crypto.subtle` (available natively in Workers) to sign VAPID JWTs. The `web-push` npm package handles the protocol details and works in Workers with `nodejs_compat` mode already enabled. Alternative: implement VAPID signing manually using Workers' built-in Web Crypto API.

### Service worker changes

`frontend/src/sw.ts` (new file, registered by Vite):
```ts
self.addEventListener('push', (event) => {
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### Push subscription schema

```sql
CREATE TABLE push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Cron integration

Extend the daily cron (already runs at 03:00 UTC) to:
1. Generate new doses 90 days out for all active medications
2. Query doses due in the next 8 hours that haven't been notified
3. For each, look up the user's push subscriptions and send notifications
4. If no push subscription, fall back to in-app inbox (already populated by dose records)

### Platform support

| Platform | Support |
|----------|---------|
| Android Chrome (PWA installed) | Full support |
| Android Firefox | Full support |
| iOS Safari 16.4+ (added to home screen) | Supported |
| iOS Safari < 16.4 | Not supported — in-app inbox only |
| Desktop Chrome/Firefox/Edge | Full support |
| Desktop Safari | Not supported — in-app inbox only |

Push notifications are an **enhancement** on top of the always-available in-app inbox. Users without push support still get the full reminder experience in-app.

### Notification preferences

Per-user settings stored in a `notification_preferences` table or as a JSON column on `users`:
- `push_enabled`: boolean (default false)
- `quiet_hours_start`: time string (e.g., "22:00") — no pushes after this
- `quiet_hours_end`: time string (e.g., "07:00") — no pushes before this
- `notify_overdue`: boolean (default true)
- `notify_upcoming_hours`: integer (default 2 — notify 2h before due)

---

## Preset Medications

Pre-built medication types reduce friction for common cases:

| Name | Type | Default frequency | Notes |
|------|------|------------------|-------|
| Revolution Plus | flea | Every 30 days | Topical |
| Advantage Multi | flea | Every 30 days | Topical |
| Frontline Plus | flea | Every 30 days | Topical |
| Heartgard Plus | heartworm | Monthly | Oral chew |
| Interceptor Plus | heartworm | Monthly | Oral |
| Methimazole | pill | Daily (or twice daily) | Hyperthyroid |
| Prednisolone | pill | Daily | Steroid |
| Gabapentin | pill | Daily | Pain/anxiety |
| Dewormer | other | Every 3 months | |
| Annual exam | vaccine | 365 days | |
| FVRCP vaccine | vaccine | 1095 days (3 years) | After initial series |
| Rabies vaccine | vaccine | 1095 days | |

---

## API Endpoints

### Medications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/medications` | List all active medications for the user (with next due date per med) |
| `POST` | `/api/medications` | Create medication + generate 90 days of doses |
| `GET` | `/api/medications/:id` | Get schedule + last 30 and next 30 doses |
| `PUT` | `/api/medications/:id` | Update schedule; regenerate future doses |
| `DELETE` | `/api/medications/:id` | Archive (set is_active = 0) |

### Doses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | Inbox: overdue, due today, upcoming 7d, refill alerts |
| `POST` | `/api/doses/:id/administer` | Mark dose given (`administered_at`, optional notes) |
| `POST` | `/api/doses/:id/skip` | Mark dose skipped (`skip_reason`) |

### Push

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/push/vapid-key` | Return public VAPID key for client subscription setup |
| `POST` | `/api/push/subscribe` | Register push subscription |
| `DELETE` | `/api/push/subscribe` | Unsubscribe current endpoint |

---

## Database Schema Changes

```sql
CREATE TABLE medications (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id          TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'other',
  dose            TEXT,
  frequency       TEXT NOT NULL,    -- 'daily'|'twice_daily'|'weekly'|'monthly'|'custom'
  frequency_days  INTEGER,          -- for 'custom' frequency
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  doses_total     INTEGER,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  doses_remaining INTEGER,
  refill_alert_days INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medications_cat ON medications(cat_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id, is_active);

CREATE TABLE medication_doses (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  due_at          TEXT NOT NULL,
  administered_at TEXT,
  skipped         INTEGER NOT NULL DEFAULT 0,
  skip_reason     TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doses_medication ON medication_doses(medication_id, due_at);
CREATE INDEX IF NOT EXISTS idx_doses_due ON medication_doses(due_at, administered_at);

CREATE TABLE push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Security Considerations

- All medication and dose endpoints require auth; scoped to `user_id`
- Push subscriptions scoped to `user_id`; only the owning user can delete them
- VAPID private key stored as a Worker secret (never in source or D1)
- Push payload is end-to-end encrypted by the Web Push protocol
- `POST /api/push/subscribe` validates subscription object shape before storing
- Notification endpoint returns only medications/doses owned by the requesting user
- See `docs/SECURITY.md` for general principles that apply here

---

## Open Questions

1. **Notification for twice-daily meds at specific times**: The daily cron at 03:00 UTC only runs once. If a dose is due at 20:00 local time, the push won't arrive until 03:00+. Options: (a) add a second cron trigger mid-day, (b) accept up-to-8hr delay for push, (c) have the client poll and trigger local notifications via Service Worker. Recommended: add a second cron at 15:00 UTC to cover evening doses. The Cloudflare free tier allows multiple cron triggers.

2. **"Mark given" from the push notification itself**: Can users mark a dose given directly from the notification action button without opening the app? Web Push supports action buttons, but this requires a background fetch from the service worker. This is feasible but complex — defer to Phase 2.

3. **Dose generation for very long medications**: A cat on daily methimazole indefinitely will accumulate 365 dose rows per year. At typical D1 row sizes, this is manageable (~50KB/year). After 5 years: ~250KB for one cat's doses. Acceptable. Add a cron cleanup to delete administered/skipped doses older than 2 years to prevent unbounded growth.

4. **What if the user changes a medication's frequency mid-course?** PUT to `/api/medications/:id` should: keep all past dose records intact, delete all future (not yet administered) doses, regenerate from today forward with the new frequency.

5. **Multi-cat same medication**: Should a user be able to create one schedule entry that applies to multiple cats? Simpler: create one entry per cat with the same medication. The inbox groups by cat name for clarity. Shared schedules can be addressed in Phase 2.

6. **Email notifications via Resend**: Transactional email is already integrated via Resend (`noreply@01j.me`, verified domain `01j.me`). Phase C email fallback would reuse the existing `sendEmail()` helper in `worker/src/lib/email.ts` with the user's Google email as the recipient. Note: MailChannels ended their free Cloudflare Workers integration — do not use it.

---

## Implementation Plan (phased)

### Phase A — Core scheduling + in-app inbox (no push)
1. DB schema: `medications` + `medication_doses` tables
2. Worker: CRUD for `/api/medications`, dose generation logic
3. Worker: `/api/notifications` inbox endpoint
4. Worker: `/api/doses/:id/administer` and `/api/doses/:id/skip`
5. Worker: extend cron to generate rolling 90-day dose window
6. Frontend: `/notifications` page (inbox UI)
7. Frontend: Badge count on home screen
8. Frontend: Medications section on cat profile
9. Frontend: Add/edit medication form with presets
10. Frontend: Mark given / skip UI

### Phase B — Web Push notifications
1. Generate VAPID key pair; store as Worker secrets
2. Frontend: service worker with push + notificationclick handlers
3. Frontend: notification permission request flow
4. Worker: `/api/push/*` endpoints
5. Worker: cron extended to send push notifications

### Phase C — Email fallback
1. Worker: use Resend for email delivery (already integrated via `worker/src/lib/email.ts`; reuse `sendEmail()`)
2. Worker: send email when no push subscription exists and dose becomes overdue
3. Frontend: notification preferences page (opt out of email)

### Phase D — Refill tracking
1. Worker: refill alert logic in cron
2. Frontend: doses_remaining management on medication edit form
