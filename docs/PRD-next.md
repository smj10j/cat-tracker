# Cat Tracker — Next Features PRD

This document captures the product roadmap following the MVP. Items are roughly priority-ordered within each section. Each section can be built incrementally.

---

## 1. Cat Profiles — Richer Data

### 1a. Photo Upload

**Problem:** The cat emoji placeholder is a fine stand-in, but the app would feel much more personal with real photos.

**Proposal:**
- Upload a photo when adding or editing a cat
- Store in Cloudflare R2 (free tier: 10 GB storage, 1M requests/month)
- Display as a circular avatar on the cat list, profile header, and comparison chart legend
- Accept JPEG/PNG/WebP; resize on the client to ≤800px before upload to save R2 bandwidth

**API changes:**
- Add `POST /api/cats/:id/photo` → returns `{ photo_url }` after uploading to R2
- Existing `photo_url` field on the cats table is already wired up

**Notes:** R2 requires a public bucket or a signed-URL strategy. Simplest MVP: make the bucket public and store the object URL directly in `photo_url`.

---

### 1b. Actual Birthdates

**Problem:** The seed data used `2020-01-01` as a placeholder for birthdates of Gemini, Kylo, and Lyra. Age calculations are wrong.

**Proposal:** Simple UX prompt — when a cat's birthdate is a round number (Jan 1 of any year), show a nudge on the profile: "Add {name}'s real birthdate for accurate age."

---

## 2. Additional Measurement Types

**Problem:** Only weight is tracked. Other measurements are clinically useful and requested by owners.

**Proposal:** The schema already supports arbitrary types. Add UI and chart support for:

| Type | Unit | Health relevance |
|------|------|-----------------|
| Food intake | oz/day or g/day | Appetite changes are early illness indicators |
| Water intake | oz/day or mL/day | Increased thirst → kidney/diabetes flag |
| Body length | cm or in | Track kitten growth; BCS calculation |
| Vet visit | — | Log date + vet notes as a text event |

**Implementation:**
- `MeasurementForm` already has a type `<select>` — just add options
- Each new type gets its own chart component (or reuse `WeightChart` for numeric types)
- `CatProfile` tabs: "Weight" | "Food" | "Water" | "History" (all)
- New health thresholds in `healthMetrics.ts` for each type (e.g., sudden drop in food intake = flag)

---

## 3. Smarter Health Alerts

**Problem:** Current alerts fire on individual intervals, which can create noise from weigh-in timing variation. Also, there's no proactive notification.

### 3a. Trend-based alerting

Instead of flagging a single interval, compute a rolling regression over the last N measurements. A sustained downward slope is more meaningful than a single drop.

- Use linear regression over the last 4–6 data points
- Flag if slope (lbs/week) exceeds thresholds
- Show the trend line on the chart (dashed overlay)

### 3b. Measurement reminders

**Proposal:** Allow setting a reminder cadence per cat (e.g., "remind me to weigh Gemini every 2 weeks"). Implement as:
- A stored `reminder_interval_days` field on the cats table
- A badge on the home screen: "Due for weigh-in: Gemini (14 days ago)"
- Optional: push notifications via Web Push API (requires a service worker)

### 3c. Ideal weight range

Let users set a target weight range per cat (vet-recommended). Chart shows a shaded band; measurements outside the band are highlighted.

---

## 4. Data Management

### 4a. CSV Import

**Problem:** Historical data sitting in a spreadsheet (like the data loaded at launch) should have a self-service import path.

**Proposal:** Upload a CSV with columns: `date, cat, type, value, unit`. The app parses it, previews the rows, and bulk-inserts on confirm.

**Format:**
```
date,cat,type,value,unit
1/2/2026,Luna,weight,8.6,lbs
1/2/2026,Gemini,weight,11.9,lbs
```

### 4b. CSV / JSON Export

**Proposal:** Download all data for a cat (or all cats) as CSV or JSON. Useful for sharing with a vet.

Button on the cat profile: "Export data" → downloads `luna-measurements.csv`.

---

## 5. Sharing & Collaboration

**Problem:** Multiple people in a household may want to log data (e.g., a partner who feeds the cats).

**Proposal (lightweight):**
- Generate a shareable link with a secret token embedded: `cat-tracker.pages.dev?token=abc123`
- The token is stored in D1; requests that include it get full read/write access
- No per-user accounts; just a household-level shared secret
- Token can be rotated from settings

This avoids full auth complexity while enabling multi-device use.

---

## 6. UX & Polish

### 6a. Progressive Web App (PWA)

Add a `manifest.json` and service worker so the app can be installed to the iOS/Android home screen. Weight logging is a quick interaction that benefits from an app-like feel.

### 6b. Offline support

Cache the API responses in a service worker. Allow adding measurements while offline; sync when connectivity returns. Useful for logging measurements without cell service.

### 6c. Dark mode

Tailwind supports `dark:` variants. Toggle respects the OS preference by default.

### 6d. Quick-add from home screen

A floating "+" button on the home screen that opens a bottom sheet to log a measurement without navigating to the cat profile first. Select the cat + enter the value in 2 taps.

---

## 7. Insights & Reporting

### 7a. Monthly summary email / report

A lightweight Cloudflare Worker Cron job that generates a monthly summary:
- Weight trend for each cat (up/down/stable)
- Any health flags from the past month
- Sent as a plain HTML email via Resend or Mailgun (both have free tiers)

### 7b. Comparison vs. breed average

Integrate a reference dataset of average healthy weights by breed. Show where a cat falls on a distribution chart.

---

## Priority Order (suggested next sprint)

1. **CSV Import** — unblocks easy data entry from existing spreadsheets (high value, low complexity)
2. **Quick-add bottom sheet** — makes daily logging fast enough to become a habit
3. **Photo upload** — high emotional value, straightforward with R2
4. **Food/water intake types** — extends the core tracking loop
5. **Measurement reminders** — drives retention
6. **PWA manifest** — trivial effort, meaningful UX upgrade for mobile users
