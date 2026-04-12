# Whisker Health (formerly Cat Tracker)

A cat health tracking app built on Cloudflare's free tier. Log weight, food, water, grooming, activity, and litter habits — then spot patterns early with correlation insights backed by veterinary guidelines.

**Web app:** https://cat-tracker.pages.dev
**iOS app:** Whisker Health (App Store — in progress)
**Privacy policy:** https://cat-tracker.pages.dev/privacy

---

## Features

- Add and manage multiple cats with profiles (name, birthdate, breed, sex, neuter status, microchip ID, photos)
- Log multiple measurement types: weight, food, water, litter box, grooming, activity, vomiting
- **Daily Check-In** — log all measurement types for a cat in one screen, with date picker for past days
- **QuickAdd bottom sheet** — tap the center nav button to log any measurement in 2 taps
- **One-tap behavioral presets** — litter, grooming, activity, and vomiting use simple preset buttons
- **Correlation engine** — detects patterns across measurement types (e.g., food drop → weight loss)
- **Health status indicators** (✅👀⚠️🚨) on chart dots and cat cards, based on feline veterinary thresholds
- **Weight alert tuning** — noise floor calibrated for home scale accuracy (1.5% relative or 0.2 lbs absolute) to reduce false positives
- **Chart time ranges** — 1W / 1M / 3M / 6M / 1Y / All presets with swipe navigation on all charts
- **Vet Export** — print-ready summary with weight history, behavioral trends, and clinical observations
- **Medication & care schedule** with in-app notification inbox and hourly reminder time granularity
- **Push notifications** — iOS medication reminders via Expo Push API, delivered by an hourly Cloudflare Worker cron
- **Timezone-aware reminders** — medication doses stored in UTC, displayed in the user's local time; DST transitions handled automatically
- **Household sharing** — invite family members with role-based access (Viewer/Contributor/Editor/Admin)
- **In Memoriam** — gentle way to mark a cat as deceased while preserving their health records
- **Wellness Guide** with AAFP/WSAVA/ISFM-sourced health reference
- **Localization** — date format (MM/DD, DD/MM, YYYY-MM), time format (12h/24h), and weight unit (lbs/kg) preferences
- CSV import for bulk data entry
- PWA — installable on home screen
- **Google + Apple sign-in** — session-based auth with httpOnly cookies (web) or Bearer tokens (native)
- **Account deletion** and **full data export** (GDPR/CCPA compliance)
- **Persistent bottom navigation** on iOS — visible on every authenticated screen

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRDs/                         # Product requirements (see REGISTRY.md)
│   │   └── REGISTRY.md               #   Canonical PRD status tracker
│   ├── TDD/                          # Technical design docs
│   │   ├── README.md                 #   Index
│   │   ├── web.md                    #   Current web architecture
│   │   └── cross-platform.md        #   iOS/Android/web unified plan
│   ├── research/                     # Veterinary evidence base
│   │   ├── README.md                 #   Sourcing standards and process
│   │   ├── weight-thresholds.md      #   Citations for numeric thresholds
│   │   ├── behavioral-indicators.md  #   Citations for behavioral alert lists
│   │   └── feline-resources.md       #   Reference directory
│   ├── API.md                        # Full API specification
│   ├── DESIGN.md                     # Visual design system
│   ├── SECURITY.md                   # Security model and guidelines
│   └── TESTING.md                    # Testing strategy
├── worker/                 # Cloudflare Worker — REST API
│   ├── src/
│   │   ├── index.ts              # Hono app entry + CORS + security headers
│   │   ├── middleware/auth.ts    # Session auth (cookie + Bearer token)
│   │   ├── routes/
│   │   │   ├── auth.ts           # Google OAuth, Apple OAuth, account deletion, data export
│   │   │   ├── cats.ts           # CRUD for /api/cats + photo upload
│   │   │   ├── measurements.ts   # CRUD for /api/measurements
│   │   │   ├── medications.ts    # Medication schedules + dose tracking
│   │   │   ├── household.ts      # Household sharing + invites
│   │   │   └── import.ts         # POST /api/import (CSV bulk insert)
│   │   ├── lib/
│   │   │   ├── apple-auth.ts     # Apple Sign In JWT verification + client secret generation
│   │   │   ├── audit.ts          # Audit log helper
│   │   │   ├── email.ts          # Transactional email via Resend
│   │   │   ├── household.ts      # Household creation helper
│   │   │   └── push.ts           # Expo Push API helper (batch send, stale token cleanup)
│   │   └── db/schema.sql         # D1 schema
│   ├── wrangler.toml
│   └── package.json
├── frontend/               # React + Vite SPA — deployed to Cloudflare Pages
│   ├── src/
│   │   ├── pages/                # All web app screens
│   │   ├── components/           # Reusable UI components
│   │   └── lib/                  # API client, health metrics, measurement presets
│   ├── functions/api/[[path]].ts # Pages Function: proxies /api/* → Worker
│   └── package.json
├── app/                    # Expo/React Native — iOS app (Whisker Health)
│   ├── app/                      # Expo Router file-based routes
│   │   ├── (auth)/login.tsx      # Login screen (Google + Apple)
│   │   ├── (tabs)/               # Tab navigator (Cats | Log | Compare)
│   │   ├── cats/[id]/            # Cat profile, edit, export, memorial
│   │   ├── settings.tsx          # Account settings, deletion, data export
│   │   ├── privacy.tsx           # Privacy policy
│   │   └── ...                   # All other screens
│   ├── components/               # React Native UI components (BottomNav, LineChart, etc.)
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Dual-path auth + push token registration + timezone sync
│   │   ├── ThemeContext.tsx      # Dark/light/system theme
│   │   └── PreferencesContext.tsx # Regional preferences (date, time, weight unit)
│   ├── lib/                      # Shared TS: api, correlations, healthMetrics
│   ├── assets/store/             # App Store metadata (description, keywords, screenshots)
│   ├── app.json                  # Expo config (bundle ID, permissions, plugins)
│   └── eas.json                  # EAS Build/Submit profiles
├── shared/                 # Pure TypeScript shared between frontend/ and app/
│   └── lib/
│       ├── types.ts              # Shared interfaces (Cat, Measurement, User, etc.)
│       ├── correlations.ts       # Correlation engine (Pearson lag, detectTrend)
│       ├── healthMetrics.ts      # Weight health status thresholds
│       ├── measurementPresets.ts  # Behavioral preset labels (0-3 scale)
│       ├── dates.ts              # Timezone-safe date parsing + UTC↔local conversion
│       └── preferences.ts        # User preferences (date/time/weight format helpers)
├── scripts/                # Deployment and utility scripts
│   └── deploy-testflight.sh      # One-command TestFlight pipeline
├── keys/                   # Apple API keys (.gitignored)
├── TODO.md
├── CLAUDE.md
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (web) | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Frontend (iOS) | Expo SDK 54 + Expo Router v6 + NativeWind v4 + React Native |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite-compatible) |
| Object Storage | Cloudflare R2 (cat photos) |
| Email | Resend (transactional email for household invites) |
| Push notifications | Expo Push API (iOS) — hourly cron delivery via Cloudflare Workers |
| Auth | Google OAuth + Apple Sign In |
| Hosting | Cloudflare Pages (web) + Workers (API) + EAS Build (iOS) |

Everything runs on Cloudflare's **free tier** (including hourly cron) + Apple Developer Program ($99/year for iOS).

---

## Local Development

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- A Cloudflare account (free)
- For iOS development: Xcode, EAS CLI (`npm install -g eas-cli`)

### 1. Install dependencies

```bash
cd worker && npm install
cd ../frontend && npm install
cd ../app && npm install
```

### 2. Run the Worker locally

```bash
cd worker
npm run dev        # starts at http://localhost:8787
```

### 3. Run the web frontend

```bash
cd frontend
npm run dev        # starts at http://localhost:5173
```

### 4. Run the Expo app

```bash
cd app

# iOS Simulator
npx expo start --ios

# Web
npx expo start --web
```

---

## iOS App (Whisker Health)

The iOS app is built with Expo and shares business logic with the web frontend. It uses Bearer token auth (via `expo-secure-store`) instead of cookies.

### App Store Details

| Field | Value |
|-------|-------|
| **App Name** | Whisker Health |
| **Bundle ID** | `me.01j.whisker` |
| **App Store Connect ID** | 6762031793 |
| **Team ID** | UR8VJZL4LG |
| **EAS Project** | @smj10j/whisker-health |

### Building

```bash
cd app

# Development build (for Simulator)
npx eas build --platform ios --profile development-simulator

# Development build (for physical device — requires Developer Mode on device)
npx eas build --platform ios --profile development

# Preview build (standalone, no dev server needed — for device testing)
npx eas build --platform ios --profile preview

# Production build (for App Store / TestFlight)
npx eas build --platform ios --profile production --non-interactive
```

### Running on Simulator

```bash
# Boot simulator + install + launch the latest development-simulator build
npx eas build:run --platform ios --latest

# Or start the dev server and connect manually
npx expo start --ios
```

### Running on Physical Device

1. Enable **Developer Mode**: Settings → Privacy & Security → Developer Mode → On → Restart
2. Build with `preview` or `development` profile (not `development-simulator`)
3. Scan the QR code from the EAS build page to install
4. For `development` builds, start the dev server: `npx expo start`

### Deploy to TestFlight (one command)

```bash
./scripts/deploy-testflight.sh            # auto: cloud build, falls back to local if quota exhausted
./scripts/deploy-testflight.sh --local    # force local build (no EAS credits)
./scripts/deploy-testflight.sh --cloud    # force cloud build only
```

This single script handles the entire release pipeline:
1. Runs all tests (shared + worker + frontend + app) — aborts if any fail
2. Verifies the Expo web export compiles
3. Builds a production iOS binary (cloud or local — see below)
4. Submits the binary to TestFlight via EAS Submit
5. Deploys the web frontend to Cloudflare Pages
6. Deploys the Worker if any `worker/` files changed since last commit

**Build modes:**
- **Default (no flag):** Tries EAS cloud build. If the free plan quota is exhausted, automatically falls back to local build.
- **`--local`:** Builds on your machine via `eas build --local`. No EAS credits used. Requires Xcode and CocoaPods.
- **`--cloud`:** Forces cloud build. Fails if quota is exhausted.

Both modes produce the same IPA and submit to TestFlight identically.

After the script finishes, Apple processes the build (~5-10 min). Then it appears in TestFlight at [appstoreconnect.apple.com](https://appstoreconnect.apple.com/apps/6762031793/testflight/ios).

**When to use:** After any code changes you want to test on a real device or share with testers. Safe to run repeatedly — each run creates a new build with an auto-incremented build number.

**Prerequisites:** EAS login (`npx eas login`), App Store Connect API key in `keys/AuthKey_AN6N75VF8R.p8` (gitignored). Local builds additionally require Xcode and CocoaPods.

### Manual submission (alternative)

```bash
cd app

# Build only
npx eas build --platform ios --profile production --non-interactive

# Submit a specific build URL
npx eas submit --platform ios --url <IPA_URL> --non-interactive

# Or submit the latest build
npx eas submit --platform ios --latest --non-interactive
```

---

## Deployment

### Deploy the Worker (API)

```bash
cd worker && npx wrangler deploy
```

### Deploy the web frontend

```bash
cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

### Apply DB schema to production

```bash
cd worker && npm run db:migrate:remote
```

---

## Testing

```bash
# All test suites
cd shared && npm test     # 129 tests (correlations, health metrics, dates, preferences)
cd worker && npm test     # 138 tests (routes, push, household, security)
cd app && npm test        # 106 tests (screen smoke, features, bottomNav, line charts)
cd frontend && npm test   #  62 tests (components, pages, contexts, health metrics)
```

See [`docs/TESTING.md`](docs/TESTING.md) for strategy and infrastructure details.

---

## Cloudflare Resources

| Resource | Name | Notes |
|----------|------|-------|
| Worker | `cat-tracker-api` | Hono REST API |
| Pages project | `cat-tracker` | Web SPA + Pages Functions proxy |
| D1 database | `cat-tracker-db` | `9c923aa8-47a3-4029-b07f-3b67d208f9e6` |
| R2 bucket | `cat-tracker-photos` | Public: `pub-40305f88ebb54339b47a48224f195f92.r2.dev` |

---

## Auth

The app supports two OAuth providers:

- **Google OAuth** — web redirect flow (cookies) + native flow (Bearer tokens via `expo-auth-session`)
- **Apple Sign In** — web redirect flow + native iOS SDK (`expo-apple-authentication`) with `POST /api/auth/apple-native`

Native apps store session tokens in iOS Keychain via `expo-secure-store` and send them as `Authorization: Bearer` headers. The web app uses httpOnly session cookies via the Pages proxy.

---

## Privacy & Compliance

- **Privacy policy:** https://cat-tracker.pages.dev/privacy
- **Account deletion:** Settings → Delete Account (immediate, irreversible — Apple requirement)
- **Data export:** Settings → Download My Data (full JSON export — GDPR Article 20)
- No analytics SDKs, no advertising identifiers, no tracking
- Data stored on Cloudflare D1/R2 (global network, encrypted in transit and at rest)

---

## Health Indicators

| Status | Emoji | Trigger |
|--------|-------|---------|
| Stable | ✅ | Change below noise floor (1.5% relative or 0.2 lbs absolute) |
| Watch | 👀 | 0.75–1.5%/week loss, or rapid gain > 2%/week, or 4–7% total loss from peak |
| Concerning | ⚠️ | 1.5–2%/week loss, or gain > 3%/week, or 7–10% total loss from peak |
| Urgent | 🚨 | > 2%/week loss, or > 10% total loss from peak |

Thresholds are calibrated for **home scale accuracy** — consumer pet scales have ~0.1–0.2 lbs precision, and normal daily fluctuation is 1–3% of body weight. The noise floor prevents false alerts from scale jitter and normal biological variation. Escalation to Watch/Concerning/Urgent requires consecutive periods of sustained change (not single data points).

Thresholds follow [AAFP](https://aafponline.org) and [WSAVA](https://wsava.org) feline nutritional guidelines. Full citations and sourcing standards in [`docs/research/`](docs/research/).

---

## Documents

| Document | Purpose |
|---|---|
| [`docs/PRDs/REGISTRY.md`](docs/PRDs/REGISTRY.md) | Canonical index of all product requirements |
| [`docs/TDD/README.md`](docs/TDD/README.md) | Technical design docs: web architecture and cross-platform plan |
| [`docs/research/README.md`](docs/research/README.md) | Veterinary evidence base and sourcing standards |
| [`docs/API.md`](docs/API.md) | Full API specification |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual design system |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security model, auth guidelines, known limitations |
| [`docs/TESTING.md`](docs/TESTING.md) | Testing strategy |
