# Cat Tracker — Next Features PRD

**Status:** Partial

This document captures the product roadmap following the MVP. Items are roughly priority-ordered within each section. Each section can be built incrementally.

---

## 1. Cat Profiles — Richer Data

### 1a. Photo Upload

> **Superseded by PRD-cat-photos.md** — see that document for the full spec including crop/zoom UX, CatAvatar component, display locations, R2 infrastructure, and API design.

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
- Sent as a plain HTML email via Resend (already integrated; `noreply@01j.me` on verified domain `01j.me`)

### 7b. Comparison vs. breed average

Integrate a reference dataset of average healthy weights by breed. Show where a cat falls on a distribution chart.

---

## 8. Health Severity Visual Hierarchy

**Problem:** All health states (watch, concerning, urgent) look nearly identical — a small colored dot. Users miss urgent signals at a glance.

**Proposal:** Each severity level should have a dramatically different visual footprint:
- **OK**: neutral card, small green dot
- **Watch**: amber border on cat card, amber text badge ("Watch"), amber avatar ring
- **Concerning**: orange-tinted card background, stronger border, orange glow, "Concerning" badge visible
- **Urgent**: red pulsing border, red tinted card, large pulsing "Urgent" chip, cats sorted to top of list

Sort cats on home screen by severity (urgent → concerning → watch → ok) so critical cats always appear first.

---

## 9. Behavioral Measurement Types

**Problem:** Weight alone misses critical early-warning signals. Behavioral changes (grooming, activity, litter habits) often precede weight changes by days or weeks.

**New measurement types** (no schema change needed — uses existing type/value/unit system):

| Type | Unit | What to watch |
|------|------|--------------|
| Grooming | /5 (score) | 1=not grooming/matted, 3=normal, 5=excessive |
| Play Time | min | Minutes of active play per session |
| Activity Level | /5 (score) | 1=lethargic, 3=normal, 5=hyperactive |
| Vomiting | episodes | Episodes in 24 hours |
| Litter Box | visits | Visits per day |

**Implementation:**
- Add to QuickAdd and MeasurementForm type dropdowns
- "Behavior" tab on cat profile showing all behavioral measurements
- Behavioral entries shown in history with appropriate icons

---

## 10. Contextual Health Guidance in Cat Profiles

**Problem:** Users see a health alert but don't know what to do with it or what to look for beyond weight.

**Proposal:** Add two evidence-based guidance sections to cat profiles when status is non-OK:

**"Pay attention to..." (watch and concerning):**
- Changes in grooming habits
- Hiding or social withdrawal
- Litter box frequency or consistency changes
- Reduced interest in play
- Changes in eating speed or appetite
- New vocalizations

**"Take to the vet NOW if you notice..." (concerning and urgent):**
- Not eating for >24 hours (hepatic lipidosis risk)
- Straining in litter box — especially males (urinary blockage emergency)
- Pale, yellow, or white gums
- Labored breathing or open-mouth panting
- Collapse, extreme weakness, or loss of coordination
- Vomiting multiple times per day
- Crying out or hiding completely

Content sourced from feline veterinary literature. Displayed in a contextual card below the health alert.

---

## 11. Home Page Cat Wellness Section

**Problem:** The home page is purely a list. Users have no reference point for what "healthy" looks like, making it hard to know when to act.

**Proposal:** Add a "Cat Wellness" section below the cat list with:
- **Monthly self-check reminders**: weigh, coat, gums, eyes, ears, body palpation
- **Normal vitals reference**: temperature (99–102.5°F), heart rate (140–220 bpm), sleep (12–16 hrs/day)
- **Always call the vet** quick-reference: the urgent signs list
- **Nutrition basics**: wet food importance, portion guidance, hydration

Design: collapsible cards or a horizontal scrolling card strip to keep it from dominating the screen.

---

## Priority Order (suggested next sprint)

1. **CSV Import** — unblocks easy data entry from existing spreadsheets (high value, low complexity)
2. **Quick-add bottom sheet** — makes daily logging fast enough to become a habit
3. **Photo upload** — high emotional value, straightforward with R2
4. **Food/water intake types** — extends the core tracking loop
5. **Measurement reminders** — drives retention
6. **PWA manifest** — trivial effort, meaningful UX upgrade for mobile users

---

## Remaining scope — detailed (2026-07-02)

> Per REGISTRY.md, two items remain (date-range filtering shipped via PRD-chart-time-navigation.md; §5 sharing superseded by PRD-auth/household-sharing).

### §3a/§3c — Trend regression / ideal weight band

**Clinical-content constraint first:** an app-supplied "ideal weight band" is a clinical claim. Per CLAUDE.md, it requires a Tier 1 citation in `docs/research/weight-thresholds.md` **before** any threshold or band ships — no such citation exists today. The spec therefore splits:

**(a) Simple trend line — non-clinical, implementable now.** Least-squares linear regression over the weight points in the chart's visible window, rendered as a dashed overlay on `WeightChart` with a purely descriptive caption ("↓ 0.12 lbs/week over the last 6 weeks"). No healthy/unhealthy framing, no alert coupling.
- Sketch: new `shared/lib/trend.ts` (`linearRegression(points: {x,y}[]): { slope, intercept, r2 }`) — deliberately **outside** `healthMetrics.ts` to keep it free of clinical entanglement; tests in `shared/__tests__/trend.test.ts`. Render in `frontend/src/components/WeightChart.tsx` (Recharts `ReferenceLine`/second `Line`) and native `app/components/LineChart.tsx` (dashed overlay path). Convert slope through `shared/lib/preferences.ts` weight-unit helpers.
- Edge cases: <4 points in window → no trend line; windowed vs All range → compute on visible points only; huge time gaps make slope/week misleading — caption states the actual span.
- Acceptance: dashed line + caption appear with ≥4 in-window points; slope matches a hand-computed fixture; copy contains no clinical adjectives; parity web + iOS.

**(b) Ideal weight band — blocked pending a decision.** Two paths, PO to choose:
1. **Vet/user-entered target range (recommended):** optional `target_weight_min/max` fields on the cat edit form; chart shows a shaded band; copy stays neutral ("outside your target range" — the numbers are the vet's, not the app's, so no citation is needed, but the rendering copy still must avoid clinical claims).
2. **App-derived default band:** requires Tier 1 sourcing (candidate: WSAVA/AAHA body-condition-score guidance) documented in `docs/research/weight-thresholds.md` and the full clinical-content process before implementation. Do not build without it.

### "Due for weigh-in" badge

Fully specified in **PRD-ux-redesign.md §3C → "Remaining scope — detailed (2026-07-02)"** (`reminder_interval_days` on cats, home badge/nudge, notifications-inbox `weigh_in_due` section, push-cron sent-marker). Implementing that item closes this one — do not duplicate the spec here.
