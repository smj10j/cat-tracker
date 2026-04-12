# Cat Tracker — TODO

## Status Key
- [ ] Not started
- [x] Complete
- [-] In progress

---

## Phase 50: Push Notifications — iOS Native (2026-04-11)

### PRD & Documentation
- [x] Create PRD-push-notifications.md (Approved)
- [x] Update REGISTRY.md with new entry

### Worker Infrastructure
- [x] Add notification_sent_at column to medication_doses (schema + test helpers)
- [x] Create worker/src/lib/push.ts — Expo Push API helper (batch sending, stale token detection)
- [x] Change cron from daily (0 3 * * *) to hourly (0 * * * *)
- [x] Add push notification logic to cron: query due doses, group by user+cat, send via Expo, mark notified
- [x] Stale token cleanup on DeviceNotRegistered errors

### iOS App
- [x] Push token registration in AuthContext after login (getExpoPushTokenAsync + registerDeviceToken)
- [x] Token unregistration on sign out
- [x] NotificationHandler component in root layout (foreground display + tap deep linking)
- [x] Cat profile deep link support (tab=care query param)

### Hour-Only Reminder Time
- [x] iOS care-item form: replace text input with hour-only ScrollView picker
- [x] Web MedicationFormPage: replace type=time input with hour-only select dropdown
- [x] Round existing reminder_time values on load (both platforms)

### Tests
- [x] Push helper tests (batching, error handling, stale tokens) — 7 tests
- [x] Update smoke test mocks (expo-notifications, expo-constants, PreferencesContext)
- [x] All tests pass (74 shared + 65 app + 52 frontend + 115 worker = 306)

### Deployment
- [x] Deploy worker (hourly cron + push logic)
- [x] Run D1 migration (notification_sent_at column)
- [x] Round existing reminder_time values in production
- [x] Deploy frontend (hour-only picker)

## Phase 49: API Versioning B/C + Security Hardening Phase 2 B/C (2026-04-11)

### Security Phase 2 — Phase B
- [x] SEC-12: Data export rate limiting (5 req/hr per user, rate_limits D1 table, 429 + Retry-After)
- [x] SEC-14: Device token validation (regex for Expo/APNs) + per-user cap (10 tokens, prune oldest)
- [x] SEC-15: Audit logging (audit_log D1 table, log key actions, 90-day cron cleanup)

### Security Phase 2 — Phase C
- [x] SEC-10: Device fingerprint binding (device_fingerprint column on sessions, soft enforcement = log only)
- [x] SEC-16: Accepted risk documentation (Authorization header in CORS noted in SECURITY.md)

### API Versioning — Phase B
- [x] Configurable health thresholds: assessHealth accepts optional overrides from /api/config
- [x] Frontend ConfigContext: fetch + cache /api/config, provide thresholds to components
- [x] update-config.sh: script for safe KV config updates with validation and diff preview

### API Versioning — Phase C
- [x] Feature flag checks in UI (gate components on config.features.*)
- [x] 426 Upgrade Required enforcement (server rejects requests below minSupportedVersion)
- [x] Deprecation/Sunset response headers middleware
- [x] Client-version aggregate logging to KV (daily counts by version)

### Cross-Platform
- [x] iOS app: X-API-Version header, 426 handling, ConfigContext for native

### Tests & Deploy
- [x] Worker tests for rate limiting, audit log, device token validation, version enforcement (15 tests)
- [x] Frontend tests for ConfigContext (2 tests) + healthMetrics threshold overrides (4 tests)
- [x] All test suites pass: 108 worker + 74 shared + 42 frontend (3 pre-existing failures from localization)
- [x] Update REGISTRY.md statuses

---

## Phase 48: iOS Bug Fixes & Persistent Bottom Nav (2026-04-11)

### Architecture
- [x] Rearchitect iOS app to use persistent BottomNav component at root layout level
- [x] Replace Tabs navigator with Slot in (tabs)/_layout.tsx
- [x] Create app/components/BottomNav.tsx with Cats/Log/Compare tabs
- [x] Update root _layout.tsx to render BottomNav for all authenticated screens
- [x] Add `edges={['top']}` to all SafeAreaView instances across 16 iOS screens

### Bug Fixes
- [x] Fix weight text clipping in Daily Checkin (increased font size, padding, min-height)
- [x] Add date picker to Daily Checkin with preselection to today (DateTimePicker)
- [x] Extend hour selector to full 24-hour range (was 6 AM–10 PM, now 12 AM–11 PM)
- [x] Add date state to Daily Checkin (was locked to today only)
- [x] Restore time range presets on Compare view (1W, 1M, 3M, 6M, 1Y, All)
- [x] Fix Add Cat sex field wrapping (moved to full-width row, not side-by-side with breed)
- [x] Replace text input birthdate with native DateTimePicker on Add Cat screen

### Cross-Platform Consistency
- [x] Verified web frontend has all features (date picker, time range, bottom nav) already correct
- [x] No web-side changes needed — all bugs were iOS-only

### Regression Tests
- [x] Add BottomNav component test (renders tabs, visibility rules for auth/login)
- [x] Add Compare screen test: time range presets (1W, 1M, 3M, 6M, 1Y, All)
- [x] Add Log screen tests: date picker, 24-hour range, weight input visibility
- [x] Add AddCat screen tests: birthdate picker, sex segmented control
- [x] Add frontend DailyCheckin tests: date picker allows past dates, 24-hour options
- [x] Fix pre-existing type errors in shared test fixtures (missing `notes` field)

### Verification
- [x] All tests pass (74 shared + 65 app + 46 frontend + 93 worker = 278)

## Phase 0: Planning
- [x] Write PRD (docs/PRDs/PRD-mvp.md)
- [x] Write TDD (docs/TDD.md)
- [x] Create this TODO list

## Phase 47: Reduce False-Positive Health Alerts (2026-04-11)

### Documentation
- [x] Update docs/research/weight-thresholds.md with home scale accuracy rationale
- [x] Update vet export methodology in frontend/src/pages/CatExportPage.tsx
- [x] Update vet export methodology in app/app/cats/[id]/export.tsx

### Algorithm (shared/lib/healthMetrics.ts)
- [x] Raise noise floor to 1.5% relative OR 0.2 lbs absolute
- [x] Raise rate thresholds (watch: 0.75%/wk, concerning: 1.5%/wk, watch gain: 2%/wk)
- [x] Add consecutive-period requirement for overallStatus escalation

### Tests (shared/__tests__/healthMetrics.test.ts)
- [x] Update existing threshold tests for new values
- [x] Add test: oscillating ±0.1 lbs on 8 lb cat = ok (Mochi scenario)
- [x] Add test: oscillating ±0.2 lbs on 10 lb cat = ok (Biscuit scenario)
- [x] Add test: 0.1 lb drop on 7 lb cat = ok (Pepper scenario)
- [x] Add test: sustained decline = watch (Oscar scenario)
- [x] Add test: single bad period + recovery = ok (consecutive requirement)

### Verification
- [x] All tests pass (74 shared + 93 worker + 44 frontend + 45 app = 256)
- [x] Review account cats: Mochi=ok, Biscuit=ok, Pepper=ok, Oscar=watch

## Phase 46: iOS Dark/Light/System Theme (2026-04-11)

### Infrastructure (Phase 1)
- [x] Install @react-native-async-storage/async-storage
- [x] Add CSS variables to app/global.css (light :root + .dark override)
- [x] Update app/tailwind.config.ts: darkMode: 'class', CSS var color references
- [x] Create app/lib/colors.ts (dark/light palette constants)
- [x] Create app/hooks/useThemeColors.ts
- [x] Create app/contexts/ThemeContext.tsx (AsyncStorage + NativeWind bridge)
- [x] Update app/app/_layout.tsx (ThemeProvider + dynamic StatusBar)

### Settings UI (Phase 2)
- [x] Add Appearance section with Dark/Light/System segmented control to settings.tsx

### Inline Color Migration (Phase 3)
- [x] app/app/(tabs)/_layout.tsx — tab bar colors
- [x] app/app/(tabs)/index.tsx — cat list
- [x] app/app/(tabs)/log.tsx — daily check-in
- [x] app/app/(tabs)/compare.tsx — compare chart
- [x] app/app/cats/[id]/index.tsx — cat detail
- [x] app/app/cats/[id]/edit.tsx — edit form
- [x] app/app/cats/[id]/care-item.tsx
- [x] app/app/cats/[id]/export.tsx
- [x] app/app/cats/[id]/health.tsx
- [x] app/app/cats/new.tsx
- [x] app/app/household.tsx
- [x] app/app/notifications.tsx
- [x] app/components/QuickAdd.tsx
- [x] app/components/MeasurementForm.tsx
- [x] app/components/InsightsPanel.tsx
- [x] app/components/LineChart.tsx
- [x] app/components/ErrorBoundary.tsx

### Verification
- [x] All tests pass (65 shared + 93 worker + 44 frontend + 45 app = 247)
- [x] Grep confirms no leftover hardcoded dark-theme hex values

## Phase 45: Screen Smoke Tests + CatProfile Hook Fix (2026-04-11)

### Infrastructure
- [x] Install @testing-library/react, @testing-library/jest-dom, jsdom
- [x] Create __tests__/screens/setup.ts with comprehensive RN/Expo mocks
- [x] Update vitest.config.ts: jsdom env for screen tests, automatic JSX

### Smoke Tests (25 tests)
- [x] CatProfile — renders with data, shows name, tabs, edge cases (empty data, deceased, API error)
- [x] Home screen — renders, shows header, shows cat cards
- [x] Compare, AddCat, EditCat, CatExport, CatHealth, Memorial
- [x] Settings, Wellness Guide, Notifications, Household, Privacy

### Bug Fix: CatProfile Rules of Hooks violation
- [x] Move useMemo above early returns in app/app/cats/[id]/index.tsx
  (useMemo was called after conditional returns, violating Rules of Hooks)

### Verification
- [x] All 247 tests pass (65 shared + 93 worker + 44 frontend + 45 app)
- [x] deploy-testflight.sh already runs `cd app && npm test` — no changes needed

## Phase 44: Wellness Guide Navigation — iOS + Web Parity (2026-04-11)

### iOS Home Screen
- [x] Add Wellness Guide card to home screen ListFooter (matches web pattern)

### InsightsPanel — Contextual "Learn More" Link (both platforms)
- [x] Add Wellness Guide link below health CTA in iOS InsightsPanel
- [x] Add Wellness Guide link below health CTA in web InsightsPanel (cross-platform parity)

### Tests
- [x] Run all test suites (93 worker + 44 frontend + 65 shared + 20 app)

### Deploy & Ship
- [x] Commit and push

## Phase 43: PRD — Landscape Mode Full-Screen Charts (2026-04-11)
- [x] Write PRD stub (docs/PRDs/PRD-landscape-charts.md)
- [x] Add to REGISTRY.md
- [x] Multi-pass review (SWE + PM + business/design)
- [x] Product owner approved

## Phase 42: PRD — Localization & Regional Preferences (2026-04-11)
- [x] Write PRD stub (docs/PRDs/PRD-localization-preferences.md)
- [x] Add to REGISTRY.md
- [x] Cross-reference from PRD-app-settings.md
- [x] Multi-pass review (SWE + PM + business/design)
- [x] Product owner approved

## Phase 41: iOS Critical Bug Fixes (2026-04-11)

### Bug 7: Compare tab crashes (SIGABRT)
- [x] Create ErrorBoundary component
- [x] Wrap LineChart in ErrorBoundary with data table fallback

### Bug 6: Notification bell does nothing
- [x] Wire notification bell onPress to router.push('/notifications')

### Bug 5: Health guidance link broken
- [x] Create app/app/cats/[id]/health.tsx (health guidance screen)
- [x] Register health screen in _layout.tsx
- [x] Fix InsightsPanel navigation to /cats/[id]/health

### Bug 1: Data export on native
- [x] Install expo-file-system
- [x] Implement native export via FileSystem + Sharing

### Bug 2: Deceased date picker missing
- [x] Add memorial modal with date picker and note textarea
- [x] Wire "passed away" link to open modal instead of immediate save
- [x] Increase memorial note limit from 150 to 1024 chars (schema, worker, web, iOS)

### Bug 4: No metric type selector on pet page
- [x] Add measurement type pill selector to cat profile
- [x] Show appropriate chart for each measurement type
- [x] Filter history by selected type

### Bug 3: Chart polish (units, axes, legend)
- [x] Add Y-axis unit label to LineChart
- [x] Improve axis tick styling
- [x] Add health status context above weight chart

### Deploy
- [x] Run all tests (93 worker, 109 frontend)
- [x] Expo web export compiles
- [-] Commit and push
- [ ] Deploy to TestFlight via deploy-testflight.sh

## Phase 40: Security Phase 2A + API Versioning A + Chart Time Navigation (2026-04-11)

### Security Phase 2 — Phase A (PRD-security-phase2.md)
- [x] SEC-11: Re-auth gate on account deletion (5-min session age check)
- [x] SEC-11: Add session_age_seconds to GET /api/auth/me response
- [x] SEC-13: apple_token_cache table in schema.sql
- [x] SEC-13: Apple token replay check in POST /api/auth/apple-native
- [x] SEC-13: Cron cleanup for expired apple_token_cache rows
- [x] Tests: auth-security.test.ts (re-auth gate + replay prevention, 5 tests)
- [x] Update docs/SECURITY.md with SEC-11 and SEC-13
- [x] Update docs/API.md with re-auth requirement and session_age_seconds

### API Versioning — Phase A (PRD-api-versioning.md)
- [x] Create KV namespace cat-tracker-config (ID: 7fc5a67f7e774458a99bf41dc7fe761c)
- [x] Add CONFIG_KV binding to wrangler.toml + types.ts
- [x] Implement GET /api/config route (KV read, validation, cache headers, defaults fallback)
- [x] Add X-API-Version middleware to index.ts
- [x] Register config route in index.ts (before auth middleware)
- [x] Add X-API-Version header to frontend api.ts request()
- [x] Tests: config.test.ts (defaults, KV read, cache headers, validation, 6 tests)
- [x] Seed initial config in KV
- [x] Update docs/API.md with config endpoint and versioning policy
- [x] Update docs/TDD/web.md with KV namespace and config route

### Chart Time Navigation — Phases A+B (PRD-chart-time-navigation.md)
- [x] Create useChartWindow hook (frontend/src/lib/useChartWindow.ts)
- [x] Create ChartRangeSelector component (pill bar, scrollable on small screens)
- [x] Integrate into WeightChart (range selector, filtered data, adaptive tick formatter)
- [x] Integrate into MeasurementChart (same pattern)
- [x] Integrate into CompareChart (shared window across all cat series)
- [x] Create SwipeableChart wrapper (touch gesture detection)
- [x] Add chevron indicators and "Today" pill
- [x] Tests: useChartWindow.test.ts (filtering, navigation, edge cases, 10 tests)
- [x] Update docs/TDD/web.md with new components

### iOS App Fixes (discovered during audit)
- [x] Invite acceptance screen: full implementation (preview, accept, decline, error handling, auth gate)
- [x] Add getInvitePreview, acceptInvite, declineInvite to app/lib/api.ts
- [x] Add InvitePreview type to app/lib/api.ts
- [x] Settings screen: add "Household Settings" navigation link
- [x] Verify Expo web export compiles
- [x] All tests passing (93 worker, 109 frontend)

### Deploy + Finalize
- [x] Run worker tests (93 passing)
- [x] Run frontend tests (109 passing)
- [x] Worker deployed
- [x] Frontend deployed
- [x] Update REGISTRY.md statuses
- [-] Commit and push

## Phase 32: iOS App Store Planning (PRD-ios-app-store.md)
- [x] Write PRD-ios-app-store.md (Draft): product requirements, asset strategy, automated deployment, App Store metadata, privacy, phased delivery (Phases 0–7), success metrics
- [x] Update docs/TDD/cross-platform.md: Sign in with Apple technical scope, OTA updates, deep linking/universal links, error monitoring, versioning strategy, CI/CD pipeline, performance budgets, account deletion, web migration safety protocol
- [x] Add PRD to REGISTRY.md (status: Draft)
- [x] Add Phase 32 to TODO.md
- [x] Product owner review and approval → moved to Approved (2026-04-10)
- [x] Implementation safety assessment and rollback plan added to PRD

## Phase 33: iOS App Store — Phase 0A: Worker Changes
- [x] Fix oauth_states.next_url schema (comment → real migration)
- [x] Add Bearer token support to requireAuth middleware
- [x] Add Apple OAuth routes (login redirect, POST callback, JWT verification)
- [x] Update CORS to allow Authorization header
- [x] Add device_tokens table for push notifications
- [x] Add account deletion endpoint (DELETE /api/auth/account)
- [x] Add data export endpoint (GET /api/auth/export)
- [x] Write comprehensive tests for all new Worker routes (25 new tests, 82 total)
- [x] Deploy Worker
- [x] Commit and push

## Phase 34: iOS App Store — Phase 0B: Expo Project Scaffolding
- [x] Initialize Expo project in app/ directory (Expo SDK 54)
- [x] Configure Expo Router v6, NativeWind v4, TypeScript
- [x] Copy and verify lib/ files (correlations, healthMetrics, measurementPresets)
- [x] Create cross-platform API client (lib/api.ts) with Bearer + cookie dual-path
- [x] Set up app/assets/ directory structure
- [x] Copy Pages Functions proxy
- [x] Copy _headers for CSP
- [x] Verify web export compiles (1.08 MB JS bundle)
- [x] Commit and push

## Phase 35: iOS App Store — Phase 1: Auth & Navigation Shell
- [x] Implement AuthContext (SecureStore on native, cookies on web)
- [x] Login screen with Google OAuth (expo-auth-session / redirect)
- [x] Login screen with Sign in with Apple (expo-apple-authentication native, redirect web)
- [x] Auth gate in root layout
- [x] Tab navigator (Cats | Log | Compare)
- [x] Cat profile screen skeleton (cats/[id])
- [x] Settings screen with account deletion + data export
- [x] Verify web export deploys to Cloudflare Pages
- [x] Commit and push

## Phase 36: iOS App Store — Phase 2: Core Screens
- [x] Home screen (cat list, health status, notification bell, profile header)
- [x] CatProfile (3-tab layout: Health / Care / About)
- [x] AddEditCat: new cat (cats/new.tsx) and edit cat (cats/[id]/edit.tsx)
- [x] QuickAdd component (bottom sheet measurement logging)
- [x] MeasurementForm component (preset-based behavioral entry)
- [x] CatAvatar component (photo or emoji fallback, deceased overlay)
- [x] InsightsPanel component (health alerts from healthMetrics.ts)
- [x] Settings page with account deletion + data export
- [x] Commit and push

## Phase 37: iOS App Store — Phase 3: Charts
- [x] Victory Native XL + React Native Skia installed
- [x] CompareChart: functional data table with cat toggles, type selector, health badges (charts deferred to v1.1 — table view for v1.0)
> Remaining items tracked in Outstanding Work > iOS App > Charts

## Phase 38: iOS App Store — Phase 4: Remaining Screens & Native Features
- [x] Notifications screen (medication inbox with sections)
- [x] Wellness Guide screen (AAFP/WSAVA/ISFM content)
- [x] In Memoriam screen (cats/[id]/memorial.tsx)
- [x] Vet Export screen — full implementation with weight table, behavioral summary, correlations, confluence, methodology, Share/Print
- [x] Household screen — full implementation with member list, role badges, invite form, role management, member removal
- [x] Invite screen (token acceptance)
- [x] Deep linking: .well-known/apple-app-site-association created
> Remaining items tracked in Outstanding Work > iOS App > Native Features

## Phase 39: iOS App Store — Phase 5: Privacy, Polish & Store Prep
- [x] Privacy policy screen at /privacy (GDPR Articles 15-20, CCPA)
- [x] Privacy policy deployed at public URL: https://cat-tracker.pages.dev/privacy
- [x] App Store metadata: description.txt, keywords.txt, whats-new.txt, promotional-text.txt
- [x] Canonical app-description.md for store listing derivation
- [x] EAS config (eas.json) with build profiles + App Store Connect API key
- [x] App icon (1024x1024) — lavender cat with whiskers + jade health heart
- [x] Adaptive icon, splash icon, favicon generated from SVG source
- [x] Commit and push
> Remaining items tracked in Outstanding Work > iOS App > Polish

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
> **Completed** in Phase 26 (PRD-cat-photos.md) — R2 bucket, crop modal, CatAvatar component
- [x] Set up Cloudflare R2 bucket for cat photos
- [x] Backend: POST /api/cats/:id/photo endpoint → R2 upload, returns photo_url
- [x] Frontend: Photo upload UI on add/edit cat form
- [x] Display real photo in cat list + profile (fallback to emoji)

### Health Alerts — Phase 2
> Remaining items tracked in "Outstanding Work" section below
- [x] ~~Trend regression~~ → tracked in Outstanding Work (PRD-features-backlog)
- [x] ~~Ideal weight range~~ → tracked in Outstanding Work (PRD-features-backlog)
- [x] ~~"Due for weigh-in" badge~~ → tracked in Outstanding Work (PRD-ux-redesign 3C)

### Sharing
> **Superseded** by PRD-auth.md (Implemented) + PRD-household-sharing.md (Partial)
- [x] See PRD-auth.md — implemented in Phase 10
- [x] See PRD-household-sharing.md — Phase A implemented in Phase 24

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
> Tracked in "Outstanding Work" section below
- [x] ~~GitHub Actions~~ → tracked in Outstanding Work (Infrastructure)
- [x] ~~PWA service worker~~ → tracked in Outstanding Work (Infrastructure)

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

### Killer App PRD (PRD-killer-app.md — status review)
- [x] P0 Vet export — implemented (PRD-vet-export.md, Phase 13)
- [x] P1 Daily check-in — implemented (PRD-daily-checkin.md, Phase 12)
- [ ] P2 Streak & consistency tracking — not started (specified in PRD-ux-redesign.md 3B)
- [ ] P3 Weigh-in reminders — not started (specified in PRD-ux-redesign.md 3C)
- [x] P4 Correlation insights — implemented (PRD-correlations.md, Phase 11)
- [x] P5 Household sharing — partial (PRD-household-sharing.md, Phase 24)
- [ ] P6 Shelter mode — not started
- [ ] P7 AI health narrative — not started (concept in PRD-ux-redesign.md 3D)

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

## Phase 28: UX Redesign (PRD-ux-redesign.md)

### Documentation
- [x] Analyze 5 screenshots from vet practice pet management app
- [x] Write PRD-ux-redesign.md: competitive analysis, 5 design proposals, 5 killer app promotions
- [x] Add PRD to REGISTRY.md (status: Draft)

### Implementation (2A/2B/2C/2D — 2026-03-07)
- [x] 2A: Full-bleed hero photo on CatProfile (~42vh, gradient overlays, name/weight over gradient)
- [x] 2A: Camera button with overlaid file input (PWA-safe) + remove photo button in hero
- [x] 2B: is_neutered INTEGER column added to cats table + D1 migration applied
- [x] 2B: Worker routes/cats.ts reads/writes is_neutered in POST + PUT
- [x] 2B: Cat interface in api.ts includes is_neutered; CARE_TYPE_ICONS map exported
- [x] 2B: AddEditCat.tsx adds neuter status selector (Neutered/Spayed / Intact / Unknown)
- [x] 2B: CatProfile About tab shows structured icon-prefixed detail rows (breed/sex/neuter/age/weight/microchip)
- [x] 2C: CARE_TYPE_ICONS map (flea/heartworm/pill/vaccine/supplement/dental/exam/bloodwork/surgery/other)
- [x] 2C: MedicationFormPage: added dental/exam/bloodwork/surgery types; fixed Annual exam preset type
- [x] 2C: MedicationFormPage: renamed "Add Medication" → "Add Care Item" title and button
- [x] 2C: CatProfile: MedicationsSection → CareScheduleSection with type emoji icons per row
- [x] 2C: NotificationsPage: DoseCard shows care type icon before cat/med name
- [x] 2D: CatProfile 5-tab measurement system → 3-tab top-level: Health / Care / About
- [x] 2D: Health tab: InsightsPanel + chart + MeasurementForm + history timeline
- [x] 2D: Care tab: CareScheduleSection + "View all notifications" link
- [x] 2D: About tab: icon detail rows + notes + Edit profile button
- [x] 3A: Daily Check-In — implemented separately (PRD-daily-checkin.md, Phase 12)
> Remaining 2E, 3B–3E tracked in Outstanding Work section below

---

## Phase 26: Cat Photos Implementation (2026-03-07)

### Infrastructure
- [x] Create R2 bucket `cat-tracker-photos` with public access (pub-40305f88ebb54339b47a48224f195f92.r2.dev)
- [x] worker/wrangler.toml: add [[r2_buckets]] binding
- [x] worker/src/types.ts: add PHOTOS: R2Bucket to AppEnv

### Backend
- [x] worker/src/routes/cats.ts: POST /api/cats/:id/photo (multipart, validate, R2 put, D1 update)
- [x] worker/src/routes/cats.ts: DELETE /api/cats/:id/photo (R2 delete, D1 null)
- [x] frontend/public/_headers: update CSP img-src with R2 public domain + blob:

### Frontend
- [x] frontend/src/lib/api.ts: uploadCatPhoto(), deleteCatPhoto()
- [x] frontend/src/components/CatAvatar.tsx: new reusable component
- [x] frontend/src/components/CropModal.tsx: new crop/zoom modal (Canvas API)
- [x] frontend/src/pages/AddEditCat.tsx: photo slot + file picker + crop flow
- [x] frontend/src/pages/CatProfile.tsx: tappable avatar with action sheet
- [x] frontend/src/pages/Home.tsx: replace emoji div with CatAvatar
- [x] frontend/src/pages/CatExportPage.tsx: photo in print header

### Docs + Deploy
- [x] Update PRD-cat-photos.md status to Implemented
- [x] Update REGISTRY.md status to Implemented
- [x] Update docs/TDD.md with R2 bucket and photo routes
- [x] Deploy worker
- [x] Deploy frontend

## Phase 27: Test Suite + CropModal Bug Fix (2026-03-07)

### Testing infrastructure
- [x] docs/TESTING.md: strategy, tooling, directory structure, naming conventions, patterns
- [x] worker/vitest.config.ts: defineWorkersConfig with wrangler.toml; vitest downgraded to ^3.2.4 for pool compatibility
- [x] worker/package.json: add test + test:watch scripts
- [x] worker/src/__tests__/helpers.ts: TEST_SCHEMA, applySchema(), clearDb(), seedUser(), seedSession(), authedHeaders()
- [x] frontend/vitest.config.ts + vitest.setup.ts: jsdom environment, @testing-library/jest-dom
- [x] frontend/package.json: add test + test:watch scripts + devDependencies
- [x] frontend/tsconfig.json: exclude src/__tests__ from tsc (avoids noUnusedLocals errors in test files)

### Worker tests (57 passing)
- [x] worker/src/__tests__/lib/medications.test.ts: generateDoses (daily/twice_daily/weekly/monthly/custom), windowEnd90 (13 tests)
- [x] worker/src/__tests__/lib/household.test.ts: ROLE_LEVEL, hasRole, ensureHousehold (create/idempotent/null-name/migration), getCatRole (legacy/shared/no-access/nonexistent) (13 tests)
- [x] worker/src/__tests__/routes/cats.test.ts: auth guard, GET/POST/GET:id/PUT/DELETE (16 tests)
- [x] worker/src/__tests__/routes/measurements.test.ts: GET/POST/DELETE with validation and auth (15 tests)

### Frontend tests (52 passing)
- [x] frontend/src/__tests__/lib/healthMetrics.test.ts: empty/single/stable/watch/concerning/urgent/peakLoss/period/sort/direction (11 tests)
- [x] frontend/src/__tests__/lib/correlations.test.ts: bucketByWeek/normalize/lagCorrelation/detectTrend/detectCorrelations (18 tests)
- [x] frontend/src/__tests__/lib/measurementPresets.test.ts: PRESET_TYPES/PRESETS/getPresetLabel/getPresetTicks (12 tests)
- [x] frontend/src/__tests__/components/CatAvatar.test.tsx: render/emoji-fallback/sizes/border/className/error-hide (7 tests)
- [x] frontend/src/__tests__/components/CropModal.test.tsx: data-URL behavior/no-blob/buttons/cancel (4 tests)

### CropModal bug fix
- [x] frontend/src/components/CropModal.tsx: switch from URL.createObjectURL() (blob: URL — ERR_ACCESS_DENIED) to FileReader.readAsDataURL() (data: URL — no security/timing issues)

### Process
- [x] CLAUDE.md Execution Loop: add step 4 (Run tests before deploy); add test failure modes to common pitfalls
- [x] Deploy frontend (CropModal fix)

---

## Phase 25: Email infra docs + Cat Photos PRD (2026-03-07)

- [x] Update all MailChannels references across docs to Resend + noreply@01j.me (PRD-household-sharing.md, PRD-medication-reminders.md, PRD-features-backlog.md, REGISTRY.md)
- [x] Add Email infrastructure section to CLAUDE.md
- [x] Write PRD-cat-photos.md (Draft): R2 storage, canvas crop/zoom UI, CatAvatar component, display specs for all locations, API design, security considerations, phased implementation plan
- [x] REGISTRY.md: add PRD-cat-photos.md entry + detail block; mark PRD-features-backlog.md §1a as superseded
- [x] PRD-features-backlog.md §1a: collapse to superseded pointer

---

## Phase 24: Household Sharing Implementation (2026-03-07)

### Backend
- [x] schema.sql: households + household_members tables; household_id on cats; next_url on oauth_states
- [x] D1 migration applied to remote
- [x] lib/household.ts: ensureHousehold() lazy migration, getCatRole(), hasRole(), ROLE_LEVEL
- [x] lib/email.ts: MailChannels sendEmail() utility
- [x] routes/household.ts: GET/PUT /api/household, GET /api/household/list, full invite CRUD, member management, public preview endpoint
- [x] routes/cats.ts: all operations scoped to household membership; role gates (editor+ for writes)
- [x] routes/measurements.ts: scoped to household membership; contributor+ for writes
- [x] routes/import.ts: set household_id on created cats
- [x] routes/auth.ts: next_url in oauth_states; claim-cats migrates to household
- [x] index.ts: household routes registered; cron expiry for stale invites
- [x] Deploy worker

### Frontend
- [x] api.ts: Cat interface adds household_id + household_name; household types + API functions
- [x] HouseholdPage.tsx: members, pending invites, invite form, rename
- [x] InvitePage.tsx: public accept/decline page with login redirect for unauthenticated users
- [x] Home.tsx: household settings link in profile popover; household labels on multi-household cat cards
- [x] App.tsx: /household and /invite routes
- [x] Deploy frontend

### Docs
- [x] REGISTRY.md: update status to Implemented
- [x] PRD-household-sharing.md: update status to Implemented

---

## Phase 23: Household Sharing PRDs (2026-03-07)

- [x] Write PRD-household-sharing.md (Draft): household model, 4-role permission matrix, invite flow, migration strategy, API endpoints, security considerations, phased implementation plan
- [x] Add PRD-household-sharing.md to REGISTRY.md (status: Draft)
- [x] Update PRD-household-sharing.md: replace Open Questions with Resolved Decisions (7 product owner decisions documented)
- [x] Write PRD-household-sharing-phase2.md (Draft): ownership transfer, household deletion, cat migration, audit log, household-wide medication notifications, confirmation dialogs
- [x] Add PRD-household-sharing-phase2.md to REGISTRY.md (status: Draft)

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

## Phase 29: Accessibility & Usability Implementation (2026-03-07)

### Phase A Usability (zero-risk wins)
- [x] Create frontend/src/components/ScrollToTop.tsx + wire into App.tsx
- [x] DailyCheckin.tsx: disabled submit button always says "Log Check-In"; contextual hint below when disabled
- [x] MeasurementForm.tsx: actionable error messages ("Couldn't save. Check your connection and try again.")
- [x] MeasurementForm.tsx: show "Saved!" flash for 1s before closing panel

### Phase A Accessibility (zero-visual-impact)
- [x] frontend/src/index.css: add :focus-visible ring (2px brand lavender, offset 2px)
- [x] MeasurementForm.tsx: add htmlFor/id to all label-input pairs
- [x] AddEditCat.tsx: add htmlFor/id to all label-input pairs (field() helper + inline labels)
- [x] DailyCheckin.tsx: add htmlFor/id to all label-input pairs
- [x] MedicationFormPage.tsx: add htmlFor/id to all label-input pairs (12 pairs)
- [x] DailyCheckin.tsx: add role="status" to save banner; role="alert" to error; aria-busy on submit
- [x] MeasurementForm.tsx: role="alert" on error div; role="status" on saved flash; aria-busy on save buttons
- [x] InsightsPanel.tsx: aria-expanded on patterns toggle + explore toggle; aria-controls pointing to panel IDs
- [x] WellnessGuide.tsx: aria-expanded on accordion cards toggle buttons
- [x] CatProfile.tsx: role="tablist"/role="tab"/aria-selected on profile tabs (Health/Care/About) + chart sub-tabs

### Phase B Usability (interaction model)
- [x] MeasurementForm.tsx: preset buttons — first tap selects (no save); "Save [Type] Observation" button appears; second tap deselects
- [x] CatProfile.tsx: two-step inline delete confirmation (Cancel/Delete buttons replace Delete link)
- [x] CatProfile.tsx: back button navigate('/') → navigate(-1) with fallback
- [x] CatExportPage.tsx: back nav → navigate(-1) with fallback

### Phase B Accessibility (text and touch targets)
- [x] Replace all text-[10px] with text-xs across all files (31 instances) via sed
- [x] DailyCheckin.tsx: preset buttons min-h-[44px] (was 34px)
- [x] MeasurementForm.tsx: × close button min 44px tap target (minWidth/minHeight 44px)

### Phase C Accessibility (color independence)
- [x] DailyCheckin.tsx + MeasurementForm.tsx: add "! " prefix to concern-tier preset buttons
> Remaining items tracked in Outstanding Work > Accessibility Phase C

### Phase C Usability (state & hierarchy)
> Tracked in Outstanding Work > Usability Phase C

### Deploy & docs
- [x] Run frontend tests (63 passing)
- [x] Deploy frontend (https://d73ec733.cat-tracker.pages.dev)
- [x] Update REGISTRY.md status to Partial for both PRDs
- [x] Commit + push

---

## Phase 14: PRD Writing — Accessibility and Usability
- [x] Audit codebase: aria attributes, label associations, touch targets, text sizes, color usage, scroll behavior
- [x] Write PRD-accessibility.md (Draft): color independence, touch targets, screen reader support, focus visibility, text size
- [x] Write PRD-usability.md (Draft): scroll-to-top, preset save model, disabled states, delete confirmation, back nav, loading/empty states
- [x] Add both PRDs to REGISTRY.md

## Phase 13: Veterinary Evidence Base (PRD-evidence-base.md)
- [x] Update PRD status to Implemented in REGISTRY.md
- [x] Create docs/research/README.md — sourcing principles and process
- [x] Create docs/research/weight-thresholds.md — full citations for each numeric threshold
- [x] Create docs/research/behavioral-indicators.md — sources for behavioral signal lists
- [x] Create docs/research/feline-resources.md — curated reference directory
- [x] Update healthMetrics.ts inline comments with specific citations
- [x] Add Methodology section to CatExportPage.tsx (vet export footer)
- [x] Add source attribution footer to WellnessGuide.tsx
- [x] Update CLAUDE.md — health metrics section + "What NOT to do"
- [x] Verify README.md docs/research/ reference is in place
- [x] Deploy frontend

## Phase 12: Daily Check-In (PRD-daily-checkin.md)
- [x] Create DailyCheckin.tsx — all measurement types on one screen, unselected = not logged, hourly date/time picker
- [x] Update BottomNav — center "Log" button navigates to /checkin; remove onLog prop
- [x] Update PageShell — remove QuickAdd state and import (QuickAdd retired)
- [x] Add /checkin route to App.tsx
- [x] Write tests: DailyCheckin component (11 tests)
- [x] Fix pre-existing worker test failure: is_neutered column missing from helpers.ts TEST_SCHEMA
- [x] Deploy frontend
- [x] Mark PRD-daily-checkin.md Implemented in REGISTRY.md

## Phase 30: Weight Alert Sensitivity (PRD-weight-alert-sensitivity.md)

### Algorithm changes (frontend/src/lib/healthMetrics.ts)
- [x] Add percentile90() helper and referencePeak to HealthAssessment interface
- [x] Add skipped field to PeriodHealth interface
- [x] Interval gate: skip rate classification for measurements < 5 days apart
- [x] Noise floor: skip alerts for changes < 0.5% of previous weight
- [x] Use referencePeak (90th pct of last 180 days) instead of peakWeight for peakLossPct
- [x] Filter skipped periods from worstPeriod in buildSummary()
- [x] Update peak-loss copy to use "recent weight" language

### Copy + UI
- [x] InsightsPanel: update "below peak" → "below recent weight" copy
- [x] WeightChart: no status emoji on skipped/noise-floor dots (handled via status: ok)
- [x] CatExportPage: update methodology section for new peak reference

### Tests + docs
- [x] Add new test cases to healthMetrics.test.ts
- [x] Update docs/research/weight-thresholds.md with engineering decisions

### Deploy
- [x] Run frontend tests
- [x] Build and deploy frontend

## Phase 31: In Memoriam — Deceased Cat (PRD-deceased-cat.md)

### Database
- [x] Add deceased_at and memorial_note columns to schema.sql
- [x] Run db:migrate:local (remote: run manually per deploy instructions)

### Worker API
- [x] GET /api/cats: add ?status=active|memorial|all filter
- [x] PUT /api/cats/:id: accept deceased_at + memorial_note, side-effect deactivate medications + delete future doses
- [x] Verify /notifications query filters is_active=1 (existing, confirmed)

### Frontend: api.ts
- [x] Add deceased_at, memorial_note to Cat interface
- [x] Update getCats() to accept optional status param

### Frontend: pages
- [x] Home.tsx: use getCats('all'), split active/memorial, render In Memoriam section
- [x] AddEditCat.tsx: add "passed away" link + bottom sheet for deceased marking
- [x] AddEditCat.tsx: add "restore" link for already-deceased cats
- [x] MemorialPage.tsx: new page (hero, note, life summary, collapsible health record)
- [x] App.tsx: add /cats/:id/memorial route

### Tests + deploy
- [x] Worker TEST_SCHEMA updated with deceased_at + memorial_note columns
- [x] Run worker tests (57/57 passing)
- [x] Run frontend tests (85/85 passing)
- [x] Deploy worker
- [ ] Deploy frontend (requires manual wrangler auth)


---

## Outstanding Work

> Consolidated 2026-04-11. Single source of truth for all unfinished work.
> Items appear in exactly one place — check here first before adding new tasks.

---

### Web App — Partial PRD Remaining Work

#### Accessibility Phase C — Color Independence (PRD-accessibility.md)
- [ ] CompareChart.tsx: stroke dash patterns (solid vs dashed) as second per-cat differentiator
- [ ] InsightsPanel.tsx: STATUS_LABEL text badge always alongside STATUS_EMOJI

#### Usability Phase C — State & Hierarchy (PRD-usability.md)
- [ ] Shared `<LoadingShell>` component for consistent loading states
- [ ] Empty state improvements (CatProfile no-measurement call-to-action)
- [ ] CatProfile health status visible without scrolling on 375px screen

#### Household Sharing Phase B — Polish & Notifications (PRD-household-sharing.md)
- [ ] Custom ConfirmDialog component for role changes (replace browser `confirm()`)
- [ ] Custom ConfirmDialog component for member removal (replace browser `confirm()`)
- [ ] Invitation reminder email: auto-resend via Resend after 3 days
- [ ] Email notification to Admins when someone accepts an invite
- [ ] Email notification to removed member

#### Medication Reminders Phase B — Web Push (PRD-medication-reminders.md)
- [ ] Generate VAPID key pair; store as Worker secrets
- [ ] Create `push_subscriptions` table in schema.sql
- [ ] Service worker (sw.ts) with push + notificationclick handlers
- [ ] Notification permission request flow (opt-in UI)
- [ ] Worker: `GET /api/push/vapid-key`, `POST /api/push/subscribe`, `DELETE /api/push/subscribe`
- [ ] Worker: extend cron to send push notifications for due/overdue doses
- [ ] Add second cron trigger at 15:00 UTC for evening dose coverage

#### Medication Reminders Phase C — Email Fallback (PRD-medication-reminders.md)
- [ ] Send overdue-dose email via Resend when no push subscription exists
- [ ] Notification preferences page (opt out of email)

#### Medication Reminders Phase D — Refill Tracking (PRD-medication-reminders.md)
- [ ] Refill alert logic in cron (check doses_remaining vs refill_alert_days)
- [ ] doses_remaining management UI on medication edit form
- [ ] Refill alert cards in notification inbox

#### App Settings Phase C — Cross-Device Sync (PRD-app-settings.md)
- [ ] D1 `user_preferences` column (JSON blob) on users table
- [ ] Sync theme preference to D1 on save; read on sign-in

#### Features Backlog — Remaining (PRD-features-backlog.md)
- [ ] Trend regression: rolling slope overlay on chart
- [ ] Ideal weight range: per-cat target min/max, shaded band on chart

### Web App — New Features (PRD-ux-redesign.md)

- [ ] 3B: Streak & consistency tracking (HIGH — streak badges, home card, calendar heatmap, milestones)
- [ ] 3C: Weigh-in reminders — `weigh_in_interval_days` per cat, "Due for weigh-in" badge (MEDIUM)
- [ ] 3D: AI Health Narrative via Claude API (MEDIUM — needs separate detailed PRD)
- [ ] 2E: Photo gallery/timeline (LOW — significant scope)
- [ ] 3E: Vet Integration two-way data (FUTURE — concept only)

### iOS App — Deferred to v1.1 (PRD-ios-app-store.md)

#### Charts (Phase 3)
- [ ] Victory Native XL chart rendering (WeightChart, MeasurementChart, CorrelationChart)
- [ ] Chart time range selector + swipe navigation (PRD-chart-time-navigation.md, Draft)
- [ ] Web bundle size measurement for Skia WASM; platform split if needed

#### Native Features (Phase 4)
- [ ] Push notification registration + delivery via Expo push service (APNs key D4TLDX697M ready)
- [ ] CSV import via expo-document-picker
- [ ] PDF vet export via expo-print (current: text share works)
- [ ] Medication form screen (new/edit from iOS app — web version works)

#### Polish (Phase 5)
- [ ] Sentry error monitoring (account needed)
- [ ] VoiceOver accessibility audit
- [ ] Performance profiling (startup time, chart rendering)
- [ ] Automated screenshot capture script (xcrun simctl)
- [ ] Dark/light/system theme toggle in iOS app (web version works)

#### Submission (Phases 6-7)
- [x] Apple Developer Program enrollment (Team ID: UR8VJZL4LG)
- [x] EAS account creation + Apple Developer linking (@smj10j/whisker-health)
- [x] App Store Connect app record (ID: 6762031793, name: Whisker Health)
- [x] Google Cloud Console iOS OAuth client ID + redirect URI
- [x] Apple Developer portal: Service ID (me.01j.whisker.web), Sign In key (9U9V7Z7986), APNs key (D4TLDX697M)
- [x] Worker secrets: APPLE_SERVICE_ID, APPLE_PRIVATE_KEY, APPLE_TEAM_ID, APPLE_KEY_ID
- [x] App Store Connect API key for automated submission (AN6N75VF8R)
- [x] Production build + TestFlight submission
- [-] TestFlight beta testing (in progress)
- [ ] App Store review submission

### Infrastructure
- [ ] GitHub Actions: auto-deploy Worker + Pages on push to main
- [ ] PWA service worker + offline measurement queueing
