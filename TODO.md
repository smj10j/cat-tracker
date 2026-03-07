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
- [ ] REVIEW: P0 Vet export / shareable summary
- [ ] REVIEW: P1 Daily check-in multi-log screen
- [ ] REVIEW: P2 Streak & consistency tracking
- [ ] REVIEW: P3 Weigh-in reminders
- [ ] REVIEW: P4 Correlation insights
- [ ] REVIEW: P5 Household sharing / token auth
- [ ] REVIEW: P6 Shelter mode
- [ ] REVIEW: P7 AI health narrative

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

### Pending — requires manual setup
- [ ] Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET Worker secrets
- [ ] Register https://cat-tracker.pages.dev/api/auth/callback as authorized redirect URI in Google Cloud Console
