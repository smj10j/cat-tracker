# PRD: Push Notifications (iOS Native)

| | |
|---|---|
| **Status** | `Approved` |
| **Author** | Product Owner |
| **Created** | 2026-04-11 |
| **References** | PRD-medication-reminders.md (Phase B) |

---

## Problem

Cat Tracker has medication reminders with an in-app notification inbox (PRD-medication-reminders Phase A), but users only see reminders when they open the app. Medication doses can be missed because there is no proactive notification. This is especially critical for time-sensitive medications like twice-daily methimazole where a missed dose can cause a thyroid crisis.

---

## Solution

Send iOS push notifications via the Expo Push API when medication doses come due. An hourly Cloudflare Worker cron job checks for doses due in the current hour, looks up registered device tokens, and sends notifications. Users register for push on first login; tapping a notification deep-links to the cat's Care tab.

---

## Scope

### In scope
- iOS native push notifications via Expo Push API
- Hourly cron trigger on Cloudflare Workers (free tier)
- Push token registration after login (permission request + token storage)
- Notification grouping: one notification per cat per hour (combining multiple meds)
- Deep linking from notification tap to cat Care tab
- Stale token cleanup (DeviceNotRegistered)
- Duplicate prevention via `notification_sent_at` column on medication_doses
- Hour-only reminder time granularity (HH:00 format)

### Out of scope (future phases)
- Web push notifications (VAPID/service worker) — Phase B2
- Email fallback for missed doses — Phase C
- Notification preferences (quiet hours, per-medication opt-out)
- Action buttons on notifications (mark given from notification)
- Android push (no Android app yet)

---

## Architecture

### Cron Flow (hourly)
1. Cron fires at minute 0 of every hour
2. Query `medication_doses` where `due_at` falls in current hour window, not administered, not skipped, not already notified, medication is active
3. Look up `device_tokens` for affected users (iOS platform only)
4. Group by (user, cat) — one notification per cat combining all meds due
5. Send via Expo Push API (`POST https://exp.host/--/api/v2/push/send`)
6. Mark doses as notified (`notification_sent_at = datetime('now')`)
7. Delete stale tokens on `DeviceNotRegistered` errors

### App Flow
1. After login, request notification permission
2. Get Expo push token via `getExpoPushTokenAsync()`
3. Register token via `POST /api/auth/device-token` (existing endpoint)
4. On sign out, unregister token via `DELETE /api/auth/device-token`
5. `NotificationHandler` component listens for notification taps and deep-links to cat profile

### Notification Format
- **Title:** `Reminder: {cat_name}`
- **Body:** `Time to give {med_name}` or `Time to give {med1} and {med2}`
- **Data:** `{ catId: "abc", url: "/cats/abc" }`
- **Sound:** default

---

## Schema Changes

```sql
ALTER TABLE medication_doses ADD COLUMN notification_sent_at TEXT;
```

No new tables needed. Device tokens table already exists.

---

## Hour-Only Reminder Times

Reminder times are constrained to whole hours (e.g., `09:00`, `14:00`). The care item form shows an hour picker (not minute picker). The cron runs hourly and matches doses in the current hour window.

Existing data with non-zero minutes is rounded to the nearest hour on load and via a one-time migration.

---

## Security

- Push tokens scoped to authenticated users only
- No sensitive data in notification payloads (cat name + medication name only)
- Expo Push API requires no access token for basic usage
- Stale tokens cleaned up automatically

---

## Implementation Phases

1. Schema migration (notification_sent_at column)
2. Push helper (Expo Push API wrapper)
3. Cron update (hourly + push sending logic)
4. App token registration (AuthContext)
5. Notification handler + deep linking
6. Hour-only reminder time picker (both platforms)
7. Tests
8. Deploy + migrate
