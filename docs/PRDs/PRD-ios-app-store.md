# PRD: iOS App Store Deployment

> **Status:** Approved
> **Created:** 2026-04-10
> **Last updated:** 2026-04-10
> **Depends on:** All current `Implemented` PRDs (the app must ship with full feature parity)
> **Related TDD:** [docs/TDD/cross-platform.md](../TDD/cross-platform.md)

---

## Problem Statement

Cat Tracker is a fully functional web app deployed on Cloudflare Pages, used daily by real households to monitor feline health. It works well on mobile Safari and Chrome — but it is invisible to the ~650M iOS users who discover apps exclusively through the App Store.

A native iOS presence unlocks:
- **Discoverability**: App Store search, category browsing, and editorial features
- **Push notifications**: Real medication reminders (the web push path was deferred; native APNS is the faster route)
- **Credibility**: An App Store listing signals a "real" product to users and veterinarians receiving exported reports
- **Retention**: Home screen icon with badge counts; no browser tab to lose

The web app must continue to work exactly as it does today — on desktop and mobile browsers — throughout and after this transition. Mobile web must not regress.

---

## Goals

1. Ship Cat Tracker to the **iOS App Store** with full feature parity to the current web app
2. Maintain the **existing web app** (desktop and mobile) without regression throughout the process
3. Build on a **cross-platform foundation** (Expo/React Native) so Android Play Store deployment requires only incremental work later
4. Enable **fully automated builds and submissions** — Claude Code can build, submit, and take screenshots without manual developer intervention
5. Establish an **asset management structure** that keeps icons, screenshots, and store metadata organized and version-controlled

## Non-Goals

- Android Play Store submission (this PRD is iOS-first; the architecture supports Android but submission is a future PRD)
- Monetization, in-app purchases, or subscriptions
- iPad-optimized layout (iPhone-only for v1.0; iPad can run the iPhone app)
- Offline mode / local-first data (future enhancement; requires significant sync architecture)
- HealthKit or Apple Health integration (cats, not humans)
- Widget / Apple Watch companion
- Localization (English-only for v1.0; multi-language is a future PRD if international traction warrants it)

---

## Requirements

### Functional Requirements

#### F1: Feature Parity
The iOS app must support every feature currently available in the web app at time of submission:
- Google OAuth sign-in
- **Sign in with Apple** (required by Apple for apps offering third-party social login)
- Cat CRUD with photo upload (camera + library)
- All measurement types (weight, food, water, litter, grooming, activity, vomiting)
- Daily Check-In screen
- Weight and behavioral charts with health status indicators
- Correlation engine and InsightsPanel
- Vet Export (PDF generation + native share sheet)
- Medication/care schedule management with in-app notification inbox
- Household sharing (invite, roles, member management)
- CSV import (via native file picker)
- Settings (dark/light/system theme)
- Wellness Guide
- In Memoriam (deceased cat flow)
- Compare Chart (multi-cat)

#### F2: Native Push Notifications
- Medication reminders delivered via APNS (through Expo's push proxy)
- Notification tap deep-links to the relevant cat's Care tab
- Permission request on first relevant action (not on app launch)
- Badge count reflects overdue + due-today medications

#### F3: Sign in with Apple
- Apple requires this whenever an app offers any other social sign-in method
- Worker auth routes must support Apple OAuth in addition to existing Google OAuth
- Users who sign in with Apple get the same experience as Google OAuth users
- "Hide My Email" relay addresses must work correctly
- Apple OAuth must also work on the web app (added benefit, not just iOS requirement)

#### F4: Deep Linking / Universal Links
- Household invite emails (`/invite?token=...`) should open in the iOS app if installed
- Apple Universal Links configuration (`.well-known/apple-app-site-association` on the web domain)
- **Domain consideration:** The web app lives on `cat-tracker.pages.dev` (Cloudflare Pages). The AASA file must be served at `https://cat-tracker.pages.dev/.well-known/apple-app-site-association`. Verify that Pages Functions or a static file in `public/.well-known/` can serve this with the correct `application/json` content type — Cloudflare Pages may strip the `.well-known` directory or misroute it.
- Graceful fallback to web if app is not installed

#### F5: Data Export
- Apple Review Guideline 5.1.2 recommends (and reviewers increasingly expect) that users can export all their data, not just a vet-focused PDF
- Add a "Download My Data" option in Settings that exports a JSON or CSV archive of: cats, measurements, medications, household memberships
- The existing Vet Export (print PDF) is not sufficient on its own — it only covers measurements and is formatted for clinical use, not data portability
- This also supports GDPR data portability requirements (Article 20)

#### F6: Account Deletion
- Apple Review Guideline 5.1.1(v) requires apps that support account creation to also support in-app account deletion
- Settings page → "Delete Account" → confirmation dialog → hard delete all user data (cats, measurements, medications, photos, sessions, household memberships)
- Must handle sole-admin-of-household edge case (require ownership transfer or dissolution first)
- R2 photos for the user's cats must be purged alongside D1 data
- **Decision: No grace period for v1.0** — immediate hard delete simplifies implementation and review. A grace period can be added later if user feedback warrants it.

#### F7: Automated Build & Submission Pipeline
- A single command (or Claude Code action) triggers: build → submit to TestFlight / App Store Connect
- EAS Build handles cloud compilation (no local Xcode required)
- EAS Submit uploads to App Store Connect
- App Store Connect API key stored as project secret for non-interactive submission
- Screenshot generation automated via Simulator + `xcrun simctl`

### Non-Functional Requirements

#### NF1: Performance
- App launch to interactive home screen: < 2 seconds on iPhone 12 or newer
- Chart rendering: < 500ms for a cat with 6 months of daily measurements
- JS bundle size (native): < 5 MB (excluding Skia/Hermes)
- Web bundle size: must not increase more than 500 KB over current Vite build (Skia WASM is the risk)

#### NF2: Privacy & Compliance
- **Privacy Nutrition Labels** (App Store): accurately declare all data collection (see Privacy section)
- **Privacy Policy**: publicly accessible URL, linked from App Store listing and in-app Settings
- No tracking, no analytics SDKs, no advertising identifiers in v1.0
- All user data stored in Cloudflare D1 and R2 (existing); no new third-party data processors
- **Data residency note:** Cloudflare's global network processes and caches data in multiple jurisdictions including the EU. The privacy policy must accurately reflect this — "no EU-specific processing" is not correct given Cloudflare's architecture. Consult a privacy template that covers global CDN data routing.

#### NF3: Reliability
- Error monitoring via Sentry (or `expo-updates` error reporting) for native crash tracking
- OTA update capability via EAS Update for JS-only fixes (no App Store review required)
- Graceful degradation when network is unavailable (informative error states, not blank screens)

#### NF4: Accessibility
- VoiceOver support: all interactive elements must have accessible labels
- Dynamic Type support: text scales with iOS system font size preference
- Minimum 44pt touch targets (already enforced on web; must carry over to native)

#### NF5: Security
- Session tokens stored in iOS Keychain (via `expo-secure-store`)
- No sensitive data in `AsyncStorage` or `UserDefaults`
- Certificate pinning not required for v1.0 (Cloudflare provides TLS)

---

## Asset Management Structure

All app store assets, icons, and metadata are version-controlled in the repository:

```
app/
├── assets/
│   ├── images/
│   │   ├── icon.png                    # 1024×1024 app icon (no alpha, no rounded corners)
│   │   ├── adaptive-icon.png           # 1024×1024 Android adaptive foreground (transparent bg)
│   │   ├── splash.png                  # 1284×2778 splash screen source
│   │   └── favicon.png                 # 32×32 web favicon
│   └── store/
│       ├── ios/
│       │   ├── screenshots/
│       │   │   ├── 6.7-inch/           # iPhone 15 Pro Max (1290×2796) — required
│       │   │   │   ├── 01-home.png
│       │   │   │   ├── 02-cat-profile.png
│       │   │   │   ├── 03-daily-checkin.png
│       │   │   │   ├── 04-health-insights.png
│       │   │   │   └── 05-vet-export.png
│       │   │   └── 6.5-inch/           # iPhone 14 Plus (1284×2778) — required
│       │   │       └── (same set)
│       │   ├── description.txt         # App Store description (max 4000 chars)
│       │   ├── keywords.txt            # Comma-separated, max 100 chars total
│       │   ├── whats-new.txt           # Release notes template
│       │   └── promotional-text.txt    # 170-char promotional blurb
│       ├── android/                    # Future — placeholder structure
│       │   ├── screenshots/
│       │   ├── feature-graphic.png     # 1024×500
│       │   └── description.txt
│       ├── privacy-policy.md           # Source for privacy policy page
│       └── shared/
│           ├── app-description.md      # Canonical description (store-specific files derive from this)
│           └── screenshot-script.sh    # Automated screenshot capture via Simulator
```

### Screenshot Automation

Screenshots are captured programmatically:

```bash
# Boot simulator, install app, capture screens
xcrun simctl boot "iPhone 15 Pro Max"
# ... navigate to each screen via deep link or test harness
xcrun simctl io booted screenshot app/assets/store/ios/screenshots/6.7-inch/01-home.png
```

A `screenshot-script.sh` orchestrates this flow. Claude Code can run this script after a successful build to regenerate screenshots for any submission.

---

## App Store Metadata

### Listing Details

| Field | Value |
|-------|-------|
| **App Name** | Cat Tracker — Health Monitor |
| **Subtitle** | Weight, meds & wellness logs |
| **Category** | Lifestyle (primary), Health & Fitness (secondary) |
| **Age Rating** | 4+ (no objectionable content) |
| **Price** | Free |
| **In-App Purchases** | None |
| **Languages** | English |
| **Bundle ID** | `me.01j.cattracker` |
| **SKU** | `cat-tracker-ios` |

### Description (draft)

> Track your cat's health with the care they deserve. Cat Tracker logs weight, food intake, hydration, grooming, activity, and litter habits — then connects the dots with correlation insights backed by veterinary guidelines (AAFP, WSAVA, ISFM).
>
> **What you get:**
> - Weight tracking with trend charts and clinically-sourced health alerts
> - Daily check-in for quick multi-measurement logging
> - Medication & care schedule with push notification reminders
> - Correlation engine that spots patterns (e.g., food drop → weight loss) weeks before they become emergencies
> - One-tap vet export: print-ready PDF with weight history, behavioral trends, and clinical observations
> - Household sharing so everyone caring for your cat stays in sync
>
> Built by cat people, grounded in veterinary science. Every health threshold cites its source — AAFP, WSAVA, ISFM, or peer-reviewed feline medicine journals.
>
> Free. No ads. No tracking. Your cats' data stays yours.

### Keywords
`cat health, cat weight, pet tracker, cat medication, feline health, cat wellness, pet weight log, vet export, cat care, pet health`

### Privacy Nutrition Labels

| Data Type | Collected | Linked to Identity | Used for Tracking |
|-----------|-----------|-------------------|-------------------|
| Email address | Yes (sign-in) | Yes | No |
| Name | Yes (display name from OAuth) | Yes | No |
| Health data (cat, not human) | Yes | Yes | No |
| Photos | Yes (cat profile photos) | Yes | No |
| User ID | Yes (internal) | Yes | No |
| Push notification token | Yes (device token for APNS) | Yes | No |

**Data not collected:** Location, contacts, browsing history, search history, diagnostics, advertising data, financial data, purchases, usage data.

---

## Privacy Policy

A privacy policy must be publicly accessible before App Store submission. It must cover:

1. What data is collected (measurements, photos, email, display name)
2. How data is stored (Cloudflare D1, R2 — location: Cloudflare's global network)
3. Who has access (only the user and their household members)
4. Third-party services (Google OAuth, Apple OAuth, Resend for email, Expo push proxy)
5. Data retention and deletion (user can delete cats and data; account deletion available)
6. Contact information for privacy inquiries
7. GDPR/CCPA compliance statement (Cloudflare processes data globally, including in the EU — the policy must address data subject rights under GDPR Articles 15–20 and CCPA opt-out rights)

**Hosted at:** `https://cat-tracker.pages.dev/privacy` (new static route) and linked from the App Store listing.

---

## Sign in with Apple — Technical Scope

This is the highest-risk requirement and must be completed before App Store submission.

### Worker Changes
1. New OAuth 2.0 client registration with Apple (Apple Developer portal → Certificates, Identifiers & Profiles → Service IDs)
2. `GET /api/auth/login?provider=apple` — redirect to Apple's authorization endpoint
3. `GET /api/auth/callback` — handle Apple's `id_token` (JWT); Apple uses `POST` for the callback with `form_urlencoded` body, not query params like Google
4. Apple returns a JWT `id_token` directly (no token exchange step) — decode and verify against Apple's public keys (JWKS)
5. Apple sends the user's name **only on the first authorization** — must persist it on first callback
6. "Hide My Email" generates a `privaterelay.appleid.com` address — household invites must work with these relay addresses
7. `users` table: `oauth_provider` can now be `'apple'` in addition to `'google'`

### Frontend/App Changes
1. Login screen: "Sign in with Apple" button (required to be displayed with equal prominence to Google)
2. On iOS native: use `expo-apple-authentication` for the native Sign in with Apple flow
3. On web: use Apple JS SDK or redirect-based flow

### Risks
- Apple's OAuth is meaningfully different from Google's (POST callback, JWT id_token, first-time-only name)
- The `privaterelay.appleid.com` email relay can be finicky with transactional email (Resend should handle it, but test)
- Estimated effort: 2–3 days including testing
- **Scheduling note:** This work is now part of Phase 1 (not a standalone phase). Surfacing it early de-risks the most common App Store rejection reason and ensures Worker auth middleware is settled before screen development begins.

---

## Phased Delivery

Each phase is independently deployable. The web app remains fully functional throughout.

### Phase 0 — Prerequisites & Project Scaffolding
**Goal:** All external accounts are set up; Expo project compiles for all platforms; shared libs pass tests.

**Prerequisites (blocking — must be complete before any implementation):**
- **Apple Developer Program enrollment** ($99/year) — requires Apple ID, identity verification, and can take 24–72 hours (or longer for organization accounts). Cannot create provisioning profiles, push certificates, App Store Connect apps, or Sign in with Apple Service IDs without this.
- **EAS account** — sign up at expo.dev and link to the Apple Developer account
- **App Store Connect** — create the app record (`me.01j.cattracker`), which reserves the bundle ID and enables TestFlight
- **Google Cloud Console** — create an iOS OAuth 2.0 client ID (separate from the existing web client ID)

**Implementation:**
- Initialize Expo project in `app/` directory
- Configure Expo Router v4, NativeWind v4, TypeScript
- Copy and verify `lib/` files (correlations, healthMetrics, measurementPresets)
- Set up `app/assets/` directory structure
- Copy Pages Functions proxy (`functions/api/[[path]].ts`)
- Worker: add Bearer token support to `requireAuth` middleware
- Worker: add `?mode=native` to auth callback
- Verify web target deploys to Cloudflare Pages and works
- Verify `npm test` passes in `worker/` and `app/`

**Exit criteria:** Apple Developer account active; App Store Connect app record created; `npx expo start` launches on iOS Simulator with a placeholder screen; web export deploys to Pages; all lib tests pass.

### Phase 1 — Authentication & Navigation Shell (including Sign in with Apple)
**Goal:** Users can sign in with Google or Apple on iOS and see the tab navigator. Sign in with Apple ships here — not later — because it's the single most common App Store rejection reason for apps with social login, and the Worker auth changes touch middleware that every subsequent phase depends on.

- Implement `useAuth` hook (SecureStore on native, cookies on web)
- Native login screen with `expo-auth-session` (Google OAuth)
- **Sign in with Apple — full implementation:**
  - Register Service ID in Apple Developer portal
  - Implement Apple OAuth in Worker auth routes (POST callback, JWT verification, JWKS)
  - Handle first-time-only name delivery and persist on first callback
  - `expo-apple-authentication` on iOS native
  - Apple JS flow on web
  - Test "Hide My Email" relay with household invites via Resend
  - Add "Sign in with Apple" button with equal prominence on login screen
- Web login screen (redirect to existing `/api/auth/login`)
- Auth gate in root layout
- Tab navigator (Cats | Log | Compare)
- Test on iOS Simulator **and physical device** — `expo-auth-session` has known Simulator-vs-device differences

**Exit criteria:** Sign-in works with both Google and Apple on iOS Simulator, physical device, and web; tab bar renders; authenticated API calls succeed; household invites work with Apple relay email addresses.

### Phase 2 — Core Screens
**Goal:** Full cat management CRUD on all platforms.

- Home screen (cat list, health badges, notification bell)
- CatProfile (3-tab layout: Health / Care / About)
- AddEditCat (form + photo picker via `expo-image-picker`)
- QuickAdd / Daily Check-In (bottom sheet on native, CSS sheet on web)
- `MeasurementRefreshContext` replaces `window.dispatchEvent` event bus
- Settings page with theme toggle

**Exit criteria:** Can add a cat, take its photo, log measurements, view profile — on both iOS and web.

### Phase 3 — Charts & Health Intelligence
**Goal:** All data visualization works on native.

- Install Victory Native XL + React Native Skia
- Port WeightChart, MeasurementChart, CorrelationChart
- Wire InsightsPanel (logic unchanged; JSX primitives change)
- CompareChart (multi-cat)
- Measure web bundle size impact of Skia WASM; evaluate code-split if > 500 KB increase

**Exit criteria:** All charts render correctly with health status indicators on iOS and web. Web bundle size validated.

### Phase 4 — Native Features & Remaining Screens
**Goal:** Full feature parity with web.

- CropModal native variant (`expo-image-manipulator`)
- Push notifications: `device_tokens` table, Worker route, registration, tap deep-link
- Vet Export: `expo-print` + `expo-sharing` for native PDF
- CSV Import: `expo-document-picker`
- Remaining screens: Household, Notifications, MedicationForm, Invite, WellnessGuide, CatHealthGuidance, CatExportPage
- In Memoriam flow
- Deep linking / Universal Links configuration

**Exit criteria:** Every screen and feature works on iOS. No web regressions.

### Phase 5 — Privacy, Polish & Store Prep
**Goal:** App is submission-ready.

- Create and deploy privacy policy at `/privacy`
- Implement account deletion (F6): `DELETE /api/auth/account` + Settings UI + R2 cleanup
- Implement data export (F5): "Download My Data" in Settings → JSON/CSV archive
- Generate app icon (1024×1024) and splash screen from design system
- Error monitoring setup (Sentry or equivalent)
- OTA update configuration (EAS Update)
- Accessibility audit (VoiceOver walkthrough of all screens)
- Performance profiling (startup time, chart rendering, bundle size)
- Write App Store description, keywords, promotional text
- Configure `eas.json` with App Store Connect API key for automated submission
- Configure automated screenshot capture script

**Exit criteria:** All store metadata ready; privacy policy live; app passes internal QA.

### Phase 6 — TestFlight & Submission
**Goal:** App live in the iOS App Store.

- `eas build --platform ios --profile production`
- `eas submit --platform ios` → TestFlight
- **TestFlight beta testing plan:**
  - Internal testers: minimum 3 people across 2+ device types (e.g., iPhone 13, iPhone 15 Pro)
  - Test duration: 1 week minimum
  - Test matrix: every screen, both auth providers (Google + Apple), push notification flow, photo upload, vet export, household invite, account deletion, theme toggle
  - Bug tracking: logged as GitHub issues tagged `ios-beta`
  - Exit criteria: zero P0/P1 bugs; all P2 bugs documented with workarounds
- Fix any issues found
- Generate and commit final screenshots
- Submit for App Store review
- **Review timeline:** Expect 1–3 days for initial review. Budget 2 rejection-and-resubmit cycles (common reasons: metadata issues, missing functionality, privacy concerns). Total calendar time from first submission to approval: 1–3 weeks.
- App goes live

**Exit criteria:** Cat Tracker available for download in the iOS App Store.

### Phase 7 — Retire `frontend/` (Post-Launch)
**Goal:** Single codebase for all platforms.

- Confirm `app/` web export matches `frontend/` functionality exactly
- **Parallel running criteria:** Deploy `app/` web export to a preview URL (e.g., `app.cat-tracker.pages.dev`). Run both for 2 weeks. Success = zero user-reported regressions and equivalent Lighthouse scores (Performance ≥ 90, Accessibility ≥ 95).
- **Rollback plan:** Keep `frontend/` in the repo (unused but intact) for 30 days after cutover. If critical regressions emerge, revert Cloudflare Pages to deploy from `frontend/dist/` with a single config change.
- Delete `frontend/` directory (after 30-day hold)
- Update all deploy instructions and CLAUDE.md
- Update Cloudflare Pages to deploy from `app/dist/`

**Exit criteria:** `frontend/` removed; single `app/` directory serves web, iOS (and future Android).

---

## Automated Deployment Commands

These commands should be runnable by Claude Code without human intervention:

```bash
# === Worker (unchanged) ===
cd worker && npx wrangler deploy

# === Web (new Expo path) ===
cd app && npx expo export --platform web
cd app && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true

# === iOS Build ===
cd app && eas build --platform ios --profile production --non-interactive

# === iOS Submit to TestFlight ===
cd app && eas submit --platform ios --latest --non-interactive

# === iOS Submit to App Store (after TestFlight approval) ===
# Uses App Store Connect API key configured in eas.json
cd app && eas submit --platform ios --latest --non-interactive

# === Screenshots ===
cd app && bash assets/store/shared/screenshot-script.sh
```

### Required Secrets / Configuration (one-time setup by the developer)

| Secret | Where | How to set |
|--------|-------|------------|
| Expo account token | `EXPO_TOKEN` env var or `eas login` | `eas login` interactively once |
| App Store Connect API Key | `eas.json` → `submit.production.ios` | Generate in App Store Connect → Users and Access → Keys |
| Apple Team ID | `eas.json` | From Apple Developer portal |
| ASC App ID | `eas.json` | Created when app is registered in App Store Connect |
| Apple OAuth Service ID | Worker secret `APPLE_SERVICE_ID` | Apple Developer portal |
| Apple OAuth private key | Worker secret `APPLE_PRIVATE_KEY` | Apple Developer portal |
| Google OAuth iOS Client ID | `app.json` `extra` field | Google Cloud Console |

---

## Versioning Strategy

- **Semantic versioning** for the app: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)
- **Build number** auto-incremented by EAS Build (Apple requires unique build numbers)
- **OTA updates** via EAS Update for JS-only changes (skips App Store review)
- Version bumps:
  - `PATCH` — bug fixes, copy changes, threshold adjustments
  - `MINOR` — new features, new measurement types, UI enhancements
  - `MAJOR` — breaking changes to data model, major redesigns
- Version displayed in Settings page

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Apple rejects for missing Sign in with Apple | **Certain** (if not implemented) | **Blocking** | Moved to Phase 1 — ships with the auth foundation, not as a late addition |
| Apple Developer Program enrollment delayed | Medium (org accounts can take weeks) | **Blocking** | Start enrollment immediately, before any code work. Use a personal account if org verification stalls. |
| Apple rejects for "limited functionality" or "web app wrapper" | Low (Expo Router renders native views) | High | Ensure native navigation, transitions, and platform conventions are followed |
| Victory Native XL / Skia WASM adds > 2 MB to web bundle | Medium | Medium | Measure in Phase 3; if too large, use platform split (Victory on native, keep Recharts on web) |
| Apple OAuth implementation takes longer than expected | Medium | Medium | Now in Phase 1 — any delays surface early when there's maximum schedule flexibility |
| NativeWind v4 gaps in RN core components | Medium | Low | Use `StyleSheet.create()` fallback for specific components |
| `expo-auth-session` fails on iOS physical device | Low | High | Test on physical device in Phase 1, not just Simulator |
| Privacy policy content doesn't satisfy Apple review | Low | Medium | Use established templates; review Apple's guidelines before writing |
| EAS Build free tier limits hit during development | Low | Low | 30 iOS builds/month on free tier; upgrade to $15/mo if needed (see Costs section) |
| Existing web users confused by two entry points | Low | Low | Same sign-in, same data — web and native are just different doors to the same house |
| `.well-known/apple-app-site-association` not served correctly on Pages | Medium | Medium | Test early in Phase 4; fallback is a Cloudflare Worker route if Pages can't serve `.well-known` |
| App Store review rejects for account deletion implementation | Low | High | Follow Apple's documented requirements exactly; test the full flow including R2 cleanup before submission |

---

## Rollback Plan

This PRD touches the Worker (auth changes), D1 schema (new tables/columns), and eventually replaces the web frontend. Every change is designed to be reversible. If things go off the rails at any phase, here's how to get back to today's working state.

### Guiding principle

The production web app (`frontend/`) and its deployment pipeline are **never modified** during Phases 0–6. All iOS/Expo work happens in an isolated `app/` directory deployed to a separate staging Pages project. The existing web app can only be affected by Worker changes — and those are additive, never destructive.

### Per-phase rollback procedures

#### Phases 0–2 (Scaffolding, Auth, Core Screens)

**Worker changes at risk:** Bearer token support in `requireAuth`, Apple OAuth routes, `?mode=native` callback branch.

**Rollback:**
1. `git revert` the Worker commits that added Bearer/Apple auth
2. `cd worker && npx wrangler deploy` — redeploys the previous Worker code
3. D1 schema changes (e.g., `device_tokens` table) are additive (`IF NOT EXISTS`) — they can be left in place harmlessly, or dropped with `DROP TABLE IF EXISTS device_tokens`
4. Delete `app/` directory — it has no connection to the production frontend
5. Remove Apple OAuth secrets: `wrangler secret delete APPLE_SERVICE_ID && wrangler secret delete APPLE_PRIVATE_KEY`

**Time to recover:** < 15 minutes. Zero user-facing impact (no one is using the native app yet).

#### Phase 3 (Charts & Health Intelligence)

No Worker or schema changes. All work is in `app/`. Rollback = delete `app/` and revert commits.

#### Phase 4 (Native Features & Remaining Screens)

**Worker changes at risk:** `device_tokens` table, push notification registration route.

**Rollback:**
1. `git revert` the push notification Worker commits
2. Redeploy Worker
3. `DROP TABLE IF EXISTS device_tokens` on D1 (remote) — safe because no production code references it
4. Delete `app/`

**Time to recover:** < 15 minutes.

#### Phase 5 (Privacy, Polish & Store Prep)

**Worker changes at risk:** `DELETE /api/auth/account` (account deletion route), data export route.

**Rollback:**
1. `git revert` the account deletion / export commits
2. Redeploy Worker
3. Privacy policy page at `/privacy` is a static route — can be left or removed; no harm either way

#### Phase 6 (TestFlight & Submission)

This is App Store submission. If the app is rejected or has critical bugs:
- Do not promote from TestFlight to public release
- Fix issues in `app/` and resubmit, or abandon the submission entirely
- The web app is completely unaffected — it hasn't been touched

**Abandoning the iOS app entirely at this point:**
1. Remove the app from App Store Connect (or let it lapse)
2. `git revert` all Worker changes added for iOS support (Bearer auth, Apple OAuth, push routes, account deletion)
3. Redeploy Worker
4. Delete `app/` directory
5. Drop orphaned D1 tables: `DROP TABLE IF EXISTS device_tokens`
6. The `users` table may now contain users who signed in with Apple — they lose access. If this is unacceptable, keep the Apple OAuth route but remove the native-specific code.

#### Phase 7 (Retire `frontend/` — the danger zone)

This is the **only phase where the production web app is at risk.** It's also the only phase that's irreversible without preparation.

**What happens:** Cloudflare Pages switches from deploying `frontend/dist/` to `app/dist/`.

**Rollback (within 30-day hold period):**
1. `frontend/` is still in the repo (unused but intact for 30 days)
2. Rebuild and redeploy: `cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true`
3. Web app is restored to its pre-cutover state in < 5 minutes
4. The iOS native app continues to work (it talks to the Worker, not the frontend)

**Rollback (after `frontend/` is deleted):**
1. Restore from git history: `git checkout HEAD~N -- frontend/` (where N is the commit that deleted it)
2. `cd frontend && npm install && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true`
3. Recovery time: ~10 minutes

### Full abort — abandoning the entire iOS initiative

If the project is cancelled at any point:

1. **Git:** Revert all iOS-related commits to `worker/` (auth changes, push routes, account deletion). Leave `app/` deletion for a cleanup commit.
2. **Worker:** `cd worker && npx wrangler deploy` — restores pre-iOS Worker
3. **D1:** Run cleanup migrations:
   ```sql
   DROP TABLE IF EXISTS device_tokens;
   -- oauth_states.next_url column and users with oauth_provider='apple' 
   -- can be left in place (harmless) or cleaned up manually
   ```
4. **Cloudflare secrets:** `wrangler secret delete APPLE_SERVICE_ID && wrangler secret delete APPLE_PRIVATE_KEY`
5. **Apple Developer Program:** Let the $99/year membership lapse at renewal. The app is automatically removed from the App Store after the account expires.
6. **EAS/Expo:** Delete the project at expo.dev. No ongoing cost.
7. **App Store Connect:** If the app was published, remove it from sale. Existing installs continue working (they hit the Worker) but receive no updates.

### What cannot be rolled back

- **Users who signed in with Apple:** If any users created accounts via Apple OAuth before rollback, their `users` rows have `oauth_provider='apple'`. Removing Apple OAuth means those users can no longer sign in. Options: (a) keep the Apple auth route even if the iOS app is abandoned, (b) migrate those users to Google OAuth (requires them to re-authenticate), or (c) accept the data loss and delete those user rows.
- **Push notification opt-ins:** If users granted push permission and we later remove the iOS app, their device tokens become stale. This is harmless — undelivered pushes just fail silently.
- **App Store reviews/ratings:** Once published, reviews are permanent on the App Store listing even if the app is removed.

---

## Costs

| Item | Cost | Frequency | Notes |
|------|------|-----------|-------|
| Apple Developer Program | $99 | Annual | Required. Non-negotiable prerequisite. |
| EAS Build (free tier) | $0 | — | 30 iOS builds/month. Sufficient for development. |
| EAS Build (production tier) | $15/mo | Monthly | Only if free tier is insufficient; adds priority queue and more builds. |
| Sentry (free tier) | $0 | — | 5K errors/month, 1 user. Sufficient for v1.0 launch. |
| Resend (existing) | $0 | — | Already provisioned; Apple relay emails count against existing volume. |
| Cloudflare (existing) | $0 | — | D1, R2, Workers, Pages all on free tier. No change. |

**Total ongoing cost:** $99/year minimum (Apple Developer Program only). All other services have viable free tiers for the current scale.

---

## Launch Strategy

The App Store listing alone does not generate downloads. The "50 downloads in 30 days" success metric requires active distribution.

### Pre-Launch (during TestFlight)
- Finalize App Store listing copy, screenshots, and keywords (Phase 5)
- Prepare a launch announcement for existing web users (in-app banner or notification)

### Launch Day
- Submit to App Store with pre-set release date (coordinate across listing, screenshots, and description)
- Add "Download on the App Store" badge to the web app login page and home screen
- Post to relevant communities: Reddit r/cats, r/CatAdvice; cat health forums; Hacker News (Show HN) if appropriate for the engineering story

### Post-Launch (first 30 days)
- Prompt web users on mobile Safari/Chrome to download the native app (smart app banner via `<meta name="apple-itunes-app">` tag)
- Monitor App Store reviews daily; respond to all reviews within 48 hours
- Solicit ratings via `SKStoreReviewController` after the user's 5th Daily Check-In (not on first launch — earn it first)
- Track download → sign-in conversion; if < 50%, investigate onboarding friction

### ASO (App Store Optimization)
- Keywords are limited to 100 characters — the current list uses 97. Monitor search rankings for top 3 keywords after launch and adjust in the next update.
- Category selection (Lifestyle primary, Health & Fitness secondary) is correct for discoverability — pet apps surface in both.
- Subtitle is the strongest ranking signal after the app name — iterate based on impression-to-download conversion.

---

## Success Metrics

| Metric | Target | Timeframe | How to measure |
|--------|--------|-----------|----------------|
| App Store approval | First submission accepted (budget 2 rejection cycles) | Within 3 weeks of first submission | App Store Connect |
| iOS downloads | 50 | First 30 days | App Store Connect analytics |
| Download → sign-in conversion | > 50% | First 30 days | Compare App Store downloads to new iOS sessions in D1 |
| iOS DAU / Web DAU ratio | > 0.5 | After 60 days | D1 session queries filtered by user-agent or auth method |
| Push notification opt-in rate | > 60% of iOS users | After 30 days | `device_tokens` table count vs. iOS user count |
| App Store rating | ≥ 4.5 stars | First 10 reviews | App Store Connect |
| Web regression bugs | 0 critical | Throughout migration | GitHub issues tagged `web-regression` |
| Crash-free rate (iOS) | > 99.5% | Ongoing | Sentry dashboard |
| Time to interactive (cold launch) | < 2 seconds | Ongoing | Profiling in Xcode Instruments |

---

## Open Questions

1. **App name**: "Cat Tracker" is generic and likely contested in App Store search. "Cat Tracker — Health Monitor" is more descriptive but long. Consider a distinctive name (e.g., "Whisker", "PurrLog", "CatVitals") for better brand recall and ASO. **Decision needed before Phase 5** — changing the name after submission is possible but resets review history.
2. ~~**Data export**~~ — **Resolved:** Full data export added as F5. Vet export alone is insufficient for Apple's data portability expectations and GDPR Article 20.
3. **Tablet layout**: `supportsTablet: false` for v1.0, but Apple occasionally flags this during review. Prepare a one-line justification ("optimized for iPhone; iPad support planned for v1.1") in case the reviewer asks.
4. **Terms of Service**: Not strictly required by Apple for free apps without subscriptions. **Recommendation: skip for v1.0** — write one if/when monetization is introduced. The privacy policy alone satisfies Apple's requirements.
5. **Existing web PWA users**: The native app supersedes the PWA. **Recommendation:** Add a smart app banner (`<meta name="apple-itunes-app">`) on the web app — iOS Safari renders this natively and it's zero-maintenance. No custom banner needed.
6. **Expo SDK version**: Pin to latest stable at time of init. The TDD was originally written against SDK 52; verify compatibility of all chosen libraries (Victory Native XL, NativeWind v4, expo-apple-authentication, expo-secure-store) with the current SDK before Phase 0.
7. **Bundle ID domain ownership**: The bundle ID `me.01j.cattracker` implies control of `01j.me`. The web app lives on `cat-tracker.pages.dev`. Universal Links require the AASA file on the *web domain users interact with*. Confirm: will the AASA be served from `cat-tracker.pages.dev` or `01j.me`? If the former, the bundle ID's reverse-domain prefix doesn't matter for Universal Links (they're decoupled), but if we want a custom domain later, `01j.me` needs to serve the AASA.
8. **Registry staleness**: PRD-deceased-cat.md and PRD-weight-alert-sensitivity.md show `Draft` in REGISTRY.md but appear to be implemented (per git log). The "depends on all Implemented PRDs" clause in this PRD needs those statuses corrected to accurately scope feature parity.

---

*Last updated: 2026-04-10*
