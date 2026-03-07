# Cat Tracker — TODO

## Status Key
- [ ] Not started
- [x] Complete
- [-] In progress

---

## Phase 0: Planning
- [x] Write PRD (docs/PRDs/PRD-mvp.md)
- [x] Write TDD (docs/TDD.md)
- [x] Create this TODO list

## Phase 1: Project Setup
- [x] Scaffold Worker project (Hono + TypeScript + wrangler.toml)
- [x] Scaffold Frontend project (React + Vite + Tailwind + React Router)
- [x] Create D1 database via wrangler CLI
- [x] Apply schema migration to D1 (local + remote)
- [x] Configure Pages → Worker API proxy

## Phase 2: Backend API
- [x] Implement GET/POST /api/cats
- [x] Implement GET/PUT/DELETE /api/cats/:id
- [x] Implement GET/POST /api/cats/:id/measurements
- [x] Implement DELETE /api/measurements/:id
- [x] Test all endpoints (verified against production)

## Phase 3: Frontend
- [x] Set up React Router routes
- [x] Home page: cat list + "Add Cat" button
- [x] Add/Edit Cat form page
- [x] Cat Profile page (header, info, chart)
- [x] Add Measurement form/modal
- [x] Weight chart component (Recharts line chart)
- [x] Measurement history table
- [x] Basic mobile-responsive layout

## Phase 4: Integration & Polish
- [x] Wire frontend to live API
- [x] Handle loading and error states
- [x] Basic form validation
- [x] Empty states (no cats, no measurements)

## Phase 5: Deployment
- [x] Deploy Worker to Cloudflare (cat-tracker-api.stevej-67b.workers.dev)
- [x] Deploy frontend to Cloudflare Pages (cat-tracker.pages.dev)
- [x] Verify end-to-end in production
- [x] Initial git commits with full working MVP

## Phase 6: Features & Enhancements (Sprint 1)

### Bugs & Polish
- [x] Fix: percentage values showing more than 1 decimal place in health summaries

### Quick Wins
- [x] PWA manifest.json — home screen installability
- [x] Quick-add floating button on home screen (cat selector + measurement in 2 taps)

### CSV Import
- [x] Backend: POST /api/import endpoint (parse CSV, bulk insert cats + measurements)
- [x] Frontend: Import page — file upload, preview table, confirm/cancel

### More Measurement Types
- [x] Add food intake (oz/day) measurement type to form + chart
- [x] Add water intake (oz/day) measurement type to form + chart
- [x] Cat profile tabs: Weight | Food | Water | All History

### Photo Upload
- [ ] Set up Cloudflare R2 bucket for cat photos
- [ ] Backend: POST /api/cats/:id/photo endpoint → R2 upload, returns photo_url
- [ ] Frontend: Photo upload UI on add/edit cat form
- [ ] Display real photo in cat list + profile (fallback to emoji)

### Health Alerts — Phase 2
- [ ] Trend regression: compute rolling slope over last N points, overlay dashed line on chart
- [ ] Ideal weight range: per-cat target min/max, shaded band on chart
- [ ] "Due for weigh-in" badge on home screen based on reminder_interval_days

### Sharing
> **Superseded** by PRD-auth.md — token sharing replaced by full OAuth user accounts
- [ ] See PRD-auth.md for the approved approach

## Phase 6b: Design Overhaul (docs/DESIGN.md)

### Foundation
- [x] Design doc written (docs/DESIGN.md)
- [x] Tailwind config: new color system (night/surface/lavender/amber/ink tokens)
- [x] index.css: dark base styles, glass-card class, slideUpFade animation, skeleton shimmer
- [x] index.html: add Plus Jakarta Sans from Google Fonts

### Navigation & Layout
- [x] BottomNav component (Home / Compare / Add tabs, fixed bottom, blur backdrop)
- [x] PageShell layout wrapper (padding bottom for nav, safe areas)
- [x] App.tsx: wrap all routes in PageShell, remove old header Import link

### Pages
- [x] Home page redesign (dark cards, staggered entrance, cat avatars with glow)
- [x] Cat profile redesign (hero section, amber stats, personal health language)
- [x] Comparison chart redesign (dark chart, gradient toggle pills)
- [x] Add/Edit cat form redesign (dark inputs, glass card)
- [x] Import page redesign (dark styling)
- [x] QuickAdd bottom sheet polish (dark surface-hi, blur backdrop)

### Chart Polish
- [x] WeightChart: dark grid, gradient line, glow dots, area fill
- [x] CompareChart: dark grid, same visual treatment

### Details
- [x] Health status badges: soft glow on urgent pulse
- [x] Skeleton loading states (replace plain "Loading..." text)
- [x] Entrance animations on list items (staggered slideUpFade)
- [x] Success micro-animation on measurement add

## Phase 6c: Health Signals & Behavioral Tracking

### Visual Health Hierarchy
- [x] Home cat cards: status-tinted borders/backgrounds, text badges for non-ok states
- [x] Home: sort cats by severity (urgent first)
- [x] CatProfile: more dramatic health alert visual treatment for urgent (pulsing border, larger footprint)
- [x] Update STATUS_COLORS in healthMetrics.ts to match design tokens (jade/honey/coral/rose)

### Behavioral Measurement Types
- [x] QuickAdd: add grooming, play, activity, vomiting, litter types with proper units
- [x] MeasurementForm: same new types
- [x] CatProfile: "Behavior" tab showing grooming/play/activity/vomiting/litter entries

### Contextual Health Guidance
- [x] healthMetrics.ts: add WATCH_ATTENTION, CONCERNING_ATTENTION, URGENT_VET_SIGNS arrays
- [x] CatProfile: "Pay attention to..." section for watch/concerning status
- [x] CatProfile: "Take to the vet NOW if..." section for concerning/urgent status

### Home Wellness Section
- [x] Home: add "Cat Wellness" section below cat list
- [x] Monthly self-check card (weigh, coat, gums, eyes, ears)
- [x] Normal vitals reference card
- [x] Urgent signs quick-reference (always call vet)


## Phase 7: Infrastructure
- [ ] GitHub Actions: auto-deploy Worker + Pages on push to main
- [ ] PWA service worker + offline measurement queueing
## Phase 8: UX Simplification (PRD-ux-simplification.md)

### Docs
- [x] Move PRDs to docs/PRDs/ folder
- [x] Create PRD-ux-simplification.md
- [x] Update CLAUDE.md with PRD conventions

### Navigation & Home Screen
- [x] BottomNav: center button opens QuickAdd sheet (not /cats/new); re-label "Log"
- [x] PageShell: manage QuickAdd open/close state; pass onLog to BottomNav
- [x] QuickAdd: accept open/onClose props instead of self-managing; remove floating trigger button; fire measurementAdded custom event on success
- [x] Home: add "＋ Add a cat" dashed-card at bottom of cat list
- [x] Home: replace wellness accordion with single "Cat Wellness Guide →" button
- [x] Home: listen for measurementAdded event and re-fetch cats

### Wellness Guide Page
- [x] New page: frontend/src/pages/WellnessGuide.tsx (move accordion cards here)
- [x] Add /wellness route in App.tsx

### Simplified Measurement Presets
- [x] Create frontend/src/lib/measurementPresets.ts with preset definitions + getPresetLabel()
- [x] QuickAdd: use tap-to-select preset buttons for food/water/litter/grooming/activity/vomiting
- [x] MeasurementForm: same preset UI for behavioral types
- [x] History display: show label string (e.g. "Most") when unit === 'scale'

### Docs cleanup
- [x] Update README.md docs paths to reflect docs/PRDs/ move

## Phase 9: Health Visuals, Chart Expansion, Measurement UX (PRD refs)

### Health Status Emoji Dots (PRD-health-status-visuals.md)
- [x] Add STATUS_EMOJI to healthMetrics.ts
- [x] WeightChart: replace colored circles with emoji SVG text nodes
- [x] CompareChart: replace dots + legend colored circles with emoji

### Measurement UX Fixes (PRD-measurement-ux.md)
- [x] QuickAdd: replace horizontal pill row with <select> dropdown for type
- [x] measurementPresets.ts: fix litter labels/order (Not used · Straining · Loose/Diarrhea · Normal)
- [x] measurementPresets.ts: shorten grooming "Not grooming" → "None"

### Charts Expansion (PRD-charts-expansion.md)
- [x] CompareChart: add type selector; re-fetch + re-render on type change
- [x] CompareChart: scale-type Y axis shows preset labels; plain dots for non-weight
- [x] New MeasurementChart.tsx component for 0–3 scale types
- [x] CatProfile: show WeightChart on weight tab, MeasurementChart on food/water tabs, no chart on behavior/all tabs

### Killer App PRD (PRD-killer-app.md — for review, not yet implementing)
- [x] REVIEW: P0 Vet export / shareable summary — implemented, see Phase 13
- [ ] REVIEW: P1 Daily check-in multi-log screen
- [ ] REVIEW: P2 Streak & consistency tracking
- [ ] REVIEW: P3 Weigh-in reminders
- [x] REVIEW: P4 Correlation insights — implemented Phase 11
- [ ] REVIEW: P5 Household sharing / token auth
- [ ] REVIEW: P6 Shelter mode
- [ ] REVIEW: P7 AI health narrative

## Phase 12: Profile UX — Insights Panel & History Timeline (PRD-profile-ux.md)

- [x] InsightsPanel.tsx: single severity-tinted panel merging health alerts + correlation insights
- [x] Proactive correlation text: detected patterns shown immediately (no manual type selection)
- [x] Collapsible "Explore correlations" expander within Insights
- [x] History grouped by calendar day with headers (Today / Yesterday / Mon Jan 6 · N entries)
- [x] Default: last 14 days; "View N older entries" to reveal rest
- [x] History resets to recent window when type tab changes
- [x] Removed Trends tab from history tab bar

## Phase 11: Correlations (PRD-correlations.md)

- [x] New lib: correlations.ts (bucketByWeek, normalize, lagCorrelation, detectCorrelations, describeCorrelation, getHomeBadge)
- [x] New component: CorrelationChart.tsx (normalized dual-line chart, type selectors, pattern insight prose)
- [x] CatProfile: Trends tab (shows when 2+ measurement types available)
- [x] Home: correlation badge on cat cards for active predictive signals

## Phase 10: Auth — User Accounts & Data Isolation (PRD-auth.md)

### Schema
- [x] Add users table (id, email, display_name, avatar_url, oauth_provider, oauth_id)
- [x] Add sessions table (id, user_id, expires_at)
- [x] Add nullable user_id column to cats table

### Worker — Auth Routes
- [x] GET /api/auth/login?provider=google — redirect to OAuth consent
- [x] GET /api/auth/callback — exchange code, upsert user, create session, set cookie
- [x] POST /api/auth/logout — delete session, clear cookie
- [x] GET /api/auth/me — return current user

### Worker — Auth Middleware & Query Scoping
- [x] Auth middleware: validate session cookie, inject userId into context
- [x] Scope GET /api/cats to user_id
- [x] Scope POST /api/cats to user_id
- [x] Scope GET/PUT/DELETE /api/cats/:id to user_id
- [x] Scope GET/POST /api/cats/:id/measurements to user_id (via cat ownership)
- [x] Scope DELETE /api/measurements/:id to user_id
- [x] Scope POST /api/import to user_id

### Worker — Session Cleanup Cron
- [x] Add Cron trigger (0 3 * * *) to delete expired sessions

### Frontend — Auth
- [x] AuthContext: fetch /api/auth/me on mount; provide user, loading, logout()
- [x] /login page: "Sign in with Google" button
- [x] ProtectedRoute wrapper: redirect to /login if not authenticated
- [x] User avatar in BottomNav (or top corner): name + Sign out
- [x] First-login "claim existing cats" prompt

### Fixes (post-implementation bugs)
- [x] OAuth state: replaced cookie-based state with D1 oauth_states table (cookie was swallowed by opaque redirect in proxy)
- [x] Session cookie: proxy now reconstructs 3xx responses explicitly so Set-Cookie headers reach the browser
- [x] Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET Worker secrets
- [x] Register https://cat-tracker.pages.dev/api/auth/callback as authorized redirect URI in Google Cloud Console

## Phase 13: Vet Export, Input/Output Metrics, Profile UX Polish

### Vet Export (PRD-vet-export.md)
- [x] CatExportPage.tsx at /cats/:id/export — print-friendly white background
- [x] Cat info, weight summary table (last 15 entries with change deltas)
- [x] Behavioral tables: last 4 weeks with getPresetLabel human-readable values
- [x] Detected patterns section (owner prose)
- [x] "Print / Save as PDF" button (window.print())
- [x] Export buttons on CatProfile and CatHealthGuidance
- [x] Export uses vet-mode correlation descriptions with clinical differentials

### Input/Output Metric Framing (PRD-input-output-metrics.md)
- [x] Classify measurement types: INPUT_TYPES (food, water, grooming, activity, play) vs OUTCOME_TYPES (weight, vomiting, litter)
- [x] CorrelationChart constrained selectors: left = input, right = outcome
- [x] Graceful empty state if no input types logged

### CatHealthGuidance page (PRD-profile-ux.md continuation)
- [x] /cats/:id/health — dedicated health guidance page
- [x] Vet signs shown first for urgent/concerning; pay-attention list; contextual reassurance
- [x] "Export for vet" button in header

### UX polish
- [x] Cat sex field (Male/Female/Unknown) in add/edit form; stored in D1 (migration applied)
- [x] Correlation descriptions use gendered pronouns (his/her/their) based on sex
- [x] Remove autoFocus from QuickAdd weight input (keyboard no longer pops on open)
- [x] BottomNav simplified to 3 items (Cats | Log | Compare) — Log is now perfectly centered
- [x] Profile avatar moved from BottomNav to top-left of Home header with sign-out popover

## Phase 14: Login Splash Page (PRD-login-splash.md)
- [x] Hero section: cat emoji with radial glow, floating metric bubbles (9.4 lbs / ↗ stable)
- [x] Branded sparkline hint at health tracking
- [x] Value prop: "Know your cat's health trends before they become vet emergencies."
- [x] 3 feature rows: weight tracking, early warning patterns, vet-ready summaries
- [x] Sign-in button with gradient border; privacy note footer

## Phase 15: Correlation Descriptions Overhaul (PRD-correlation-descriptions.md)
- [x] Add typeATrend / typeBTrend / dataWeeks to CorrelationResult (fix direction bug)
- [x] detectTrend() — first-half vs second-half average comparison
- [x] Clinical annotation per pair: food/water/grooming/activity/vomiting → weight
- [x] describeCorrelation() mode param: 'owner' (plain language) vs 'vet' (clinical + differentials + stats)
- [x] Owner descriptions: pair-specific clinical context, gendered pronouns, confidence framing, early-warning note when isPredictive
- [x] Vet descriptions: r value, lag, dataWeeks, differentials by pair+direction
- [x] detectConfluence(): detects multi-pattern clusters (kidney/thyroid/DM; systemic illness)
- [x] InsightsPanel: shows confluence alert card above individual patterns
- [x] CorrelationChart: adds typeATrend/typeBTrend/dataWeeks to local result; catSex prop
- [x] CatExportPage: vet-mode descriptions; confluence note in amber card

## Phase 16: Delete Cat, Profile Clarity, Microchip ID PRD

### Delete cat (Edit page)
- [x] AddEditCat.tsx: import deleteCat; add deleting state; add handleDelete() with confirm dialog
- [x] AddEditCat.tsx: "Delete Cat" button at bottom of form — edit mode only; red destructive style
- [x] worker/routes/cats.ts: DELETE endpoint explicitly deletes measurements before cat (belt-and-suspenders alongside FK CASCADE)

### Profile clarity (PRD-profile-clarity.md — Approved + Implemented)
- [x] Write PRD-profile-clarity.md
- [x] Add PRD to REGISTRY.md (status: Approved → Implemented)
- [x] InsightsPanel.tsx: collapse patterns section by default into single toggle row
- [x] Collapsed header shows count badge ("N detected") and ⚠️ "Multiple signals" pill when confluence present
- [x] Merge "Explore measurement patterns" section into expanded patterns section (eliminates standalone third section)
- [x] Health alert section unchanged — always visible

### Microchip ID PRD (Draft — no implementation)
- [x] Write PRD-microchip-id.md covering: auto-generated temp IDs, partial unique index, same-user vs cross-user conflict resolution, CSV import upsert, open questions
- [x] Add PRD to REGISTRY.md (status: Draft)

## Phase 18: Security Hardening (PRD-security.md)

### Documentation
- [x] Create docs/SECURITY.md — principles, architecture model, known limitations
- [x] Create PRD-security.md — 8 findings (SEC-01 through SEC-08) with fixes
- [x] Update REGISTRY.md, CLAUDE.md with SECURITY.md references

### Implementation
- [x] worker/routes/auth.ts: SEC-01 — atomic OAuth state via DELETE...RETURNING
- [x] worker/routes/auth.ts: SEC-07 — session count cap (keep newest 20 per user)
- [x] worker/src/index.ts: SEC-02 — CORS locked to known origins
- [x] worker/src/index.ts: SEC-03 — security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] worker/routes/cats.ts: SEC-04 — field length validation on POST/PUT
- [x] worker/routes/measurements.ts: SEC-04 + SEC-05 — field length + type/unit/value validation
- [x] worker/routes/import.ts: SEC-04 + SEC-06 — field length + 1MB body size limit
- [x] frontend/public/_headers: SEC-03 — CSP, security headers for Pages SPA
- [x] frontend/pages/AddEditCat.tsx: SEC-08 — maxLength on all text inputs; MeasurementForm notes maxLength
- [x] Deploy worker + frontend

## Phase 19: Microchip ID (PRD-microchip-id.md)

### Documentation
- [x] PRD-microchip-id.md written, status updated to Approved

### Implementation
- [x] worker/db/schema.sql: add microchip_id column + partial unique index
- [x] Apply schema migration to remote D1 (column + index)
- [x] worker/routes/cats.ts: POST — generate temp ID if absent; conflict check for real IDs
- [x] worker/routes/cats.ts: PUT — accept microchip_id update; conflict check; privacy-preserving 409
- [x] worker/routes/import.ts: support optional 6th column (microchip_id) in CSV; match by chip before name
- [x] frontend/lib/api.ts: add microchip_id to Cat interface; ApiError class for structured errors
- [x] frontend/pages/AddEditCat.tsx: microchip_id field (blank if temp); 409 error handling with ApiError
- [x] frontend/pages/CatProfile.tsx: display microchip badge for real IDs (spaced formatting)
- [x] Deploy worker + frontend

## Phase 22: Household Sharing PRD (2026-03-07)

- [x] Write PRD-household-sharing.md (Draft): household model, 4-role permission matrix, invite flow, migration strategy, API endpoints, security considerations, phased implementation plan
- [x] Add to REGISTRY.md (status: Draft)

---

## Phase 21: Medication Reminders — Phase A Implementation (2026-03-07)

### Backend
- [x] schema.sql: add medications + medication_doses tables (with UNIQUE on med_id+due_at for idempotent cron)
- [x] Apply migration to remote D1
- [x] worker/routes/medications.ts: GET/POST/PUT/DELETE /api/medications, dose generation (90-day forward window), batched INSERT OR IGNORE
- [x] worker/routes/medications.ts: GET /api/notifications (overdue/due-today/upcoming-7d/refill alerts)
- [x] worker/routes/medications.ts: POST /api/doses/:id/administer, POST /api/doses/:id/skip
- [x] worker/index.ts: register medication routes + extend cron to roll 90-day dose window

### Frontend
- [x] api.ts: Medication + MedicationDose + NotificationInbox types + API functions
- [x] NotificationsPage.tsx: inbox with Overdue/Due Today/Upcoming sections, Mark Given/Skip buttons
- [x] MedicationFormPage.tsx: add/edit form with preset picker, frequency/schedule fields
- [x] CatProfile.tsx: Medications section (active meds with next due date, overdue indicator, Add button)
- [x] Home.tsx: notification bell with overdue+due-today badge count in header
- [x] App.tsx: /notifications, /cats/:id/medications/new, /medications/:id/edit routes

### Deploy + docs
- [x] Deploy worker
- [x] Deploy frontend
- [x] Update REGISTRY.md status to Implemented

---

## Phase 20: Medication Reminders PRD (2026-03-07)

### Documentation only — do not implement until Approved
- [x] Write PRD-medication-reminders.md (Draft): medication schedule model, dose records, 90-day materialization strategy, in-app notification inbox, push notifications (VAPID/Web Push), preset medications, full API spec, phased implementation plan (A-D)
- [x] Add PRD-medication-reminders.md to REGISTRY.md (status: Draft)
- [x] Replace all "Sprint X" Last Updated values in REGISTRY.md with precise git-derived timestamps

---

## Phase 17: Authorization Fix + Documentation Overhaul

### Security fix — ownership scoping for mutations
- [x] cats.ts PUT: change ownership check from `(user_id = ? OR user_id IS NULL)` to `user_id = ?`
- [x] cats.ts DELETE: same fix — owner only
- [x] measurements.ts POST: cat ownership check requires `user_id = ?` (not orphaned)
- [x] measurements.ts DELETE: JOIN ownership check requires `c.user_id = ?` (not orphaned)
- [x] Read endpoints (GET cats/:id, GET measurements) intentionally retain `OR user_id IS NULL` for orphaned cat visibility

### Documentation
- [x] Create docs/API.md — full API spec: all endpoints, request/response shapes, status codes, authentication, authorization model, orphaned cat rules, CORS note, Worker env bindings
- [x] Overhaul docs/TDD.md — bring current: full schema with all columns (sex, user_id), all routes including auth/export/health, complete component/lib file list, all frontend routes, key design decisions section, auth flow, QuickAdd flow, correlation engine description
- [x] CLAUDE.md: replace "Working Style" with formal Execution Loop (7 ordered steps); remove stale PRD status table; add API.md to docs references
- [x] Deploy worker with security fixes
