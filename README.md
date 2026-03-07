# Cat Tracker

A lightweight web app for tracking health measurements for your cats over time. Built on Cloudflare's free tier — no server to maintain, no monthly bill.

**Live app:** https://cat-tracker.pages.dev

---

## Features

- Add and manage multiple cats with profile info (name, birthdate, breed, coloring, notes)
- Log multiple measurement types: weight, food, water, litter box, grooming, activity, vomiting
- **QuickAdd bottom sheet** — tap the center nav button to log any measurement in 2 taps
- **One-tap behavioral presets** — litter, grooming, activity, and vomiting use simple preset buttons (e.g., "Normal / Straining / Loose / Not used") instead of manual numeric entry
- Per-cat profile tabs: Weight | Food | Water | Behavior | All
- Per-cat measurement charts: weight chart with health emoji dots; scale chart for food/water
- **Multi-cat comparison chart** with per-series toggles and measurement type selector
- **Emoji health indicators** (✅👀⚠️🚨) on chart dots and cat cards, based on feline veterinary thresholds
- Wellness Guide page with cat health reference cards (vitals, monthly self-check, urgent signs)
- CSV import for bulk data entry
- PWA — installable on home screen
- **Google sign-in** — each user sees only their own cats; session-based auth via httpOnly cookies

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRDs/
│   │   ├── REGISTRY.md               # Canonical PRD status tracker
│   │   ├── PRD-mvp.md                # Original MVP requirements
│   │   ├── PRD-features-backlog.md   # Feature backlog
│   │   ├── PRD-ux-simplification.md  # UX simplification
│   │   ├── PRD-health-status-visuals.md  # Emoji health dots
│   │   ├── PRD-measurement-ux.md     # Measurement UX fixes
│   │   ├── PRD-charts-expansion.md   # Multi-type charts
│   │   ├── PRD-killer-app.md         # Roadmap research (under review)
│   │   └── PRD-auth.md               # User accounts & data isolation (under review)
│   ├── TDD/                          # Technical design docs
│   │   ├── README.md                 #   Index
│   │   ├── web.md                    #   Current web architecture
│   │   └── cross-platform.md        #   iOS/Android/web unified plan
│   └── DESIGN.md                     # Visual design system
├── worker/                 # Cloudflare Worker — REST API
│   ├── src/
│   │   ├── index.ts        # Hono app entry point + CORS
│   │   ├── routes/
│   │   │   ├── cats.ts           # CRUD for /api/cats
│   │   │   ├── measurements.ts   # CRUD for /api/measurements
│   │   │   └── import.ts         # POST /api/import (CSV bulk insert)
│   │   └── db/
│   │       └── schema.sql  # D1 schema (cats + measurements tables)
│   ├── wrangler.toml       # Worker config + D1 binding
│   └── package.json
├── frontend/               # React + Vite SPA — deployed to Pages
│   ├── src/
│   │   ├── App.tsx         # Router setup
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Cat list + wellness link
│   │   │   ├── CatProfile.tsx      # Per-cat chart, tabs, health alerts
│   │   │   ├── AddEditCat.tsx      # Add/edit cat form
│   │   │   ├── CompareChart.tsx    # Multi-cat comparison chart
│   │   │   ├── ImportPage.tsx      # CSV upload/preview/import
│   │   │   └── WellnessGuide.tsx   # Cat health reference page
│   │   ├── components/
│   │   │   ├── WeightChart.tsx       # Recharts line chart w/ emoji health dots
│   │   │   ├── MeasurementChart.tsx  # 0-3 scale chart for behavioral types
│   │   │   ├── MeasurementForm.tsx   # Inline measurement entry form
│   │   │   ├── QuickAdd.tsx          # Bottom sheet for quick measurement logging
│   │   │   ├── PageShell.tsx         # Layout wrapper; owns QuickAdd state
│   │   │   └── BottomNav.tsx         # Fixed bottom nav (Home/Compare/Log)
│   │   └── lib/
│   │       ├── api.ts                # Typed fetch wrappers for all API routes
│   │       ├── healthMetrics.ts      # Vet-threshold health status logic + emoji
│   │       └── measurementPresets.ts # Preset definitions for behavioral types
│   ├── functions/
│   │   └── api/[[path]].ts   # Pages Function: proxies /api/* → Worker
│   ├── public/
│   │   └── manifest.json     # PWA manifest
│   ├── vite.config.ts        # Dev proxy: /api → localhost:8787
│   └── package.json
├── TODO.md                 # Task tracking
├── CLAUDE.md               # Instructions for AI assistants working in this repo
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (custom dark design system) |
| Charts | Recharts |
| Routing | React Router v6 |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite-compatible) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |

Everything runs on Cloudflare's **free tier**.

---

## Local Development

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler` or use `npx`)
- A Cloudflare account (free)

### 1. Install dependencies

```bash
cd worker && npm install
cd ../frontend && npm install
```

### 2. Run the Worker locally

```bash
cd worker
npm run dev        # starts at http://localhost:8787
```

This uses the local D1 database (stored in `worker/.wrangler/state/`).

### 3. Apply schema to local DB (first time only)

```bash
cd worker
npm run db:migrate:local
```

### 4. Run the frontend

```bash
cd frontend
npm run dev        # starts at http://localhost:5173
```

The Vite dev server proxies `/api/*` to `localhost:8787`, so both must be running.

---

## Deployment

### Deploy the Worker (API)

```bash
cd worker
npx wrangler deploy
```

### Apply DB schema to production (first time or after schema changes)

```bash
cd worker
npm run db:migrate:remote
```

### Build and deploy the frontend

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

---

## Cloudflare Resources

| Resource | Name | Notes |
|----------|------|-------|
| Worker | `cat-tracker-api` | Deployed via `wrangler deploy` in `worker/` |
| Pages project | `cat-tracker` | Deployed via `wrangler pages deploy` in `frontend/` |
| D1 database | `cat-tracker-db` | ID: `9c923aa8-47a3-4029-b07f-3b67d208f9e6` |

The Pages site routes all `/api/*` traffic through a Pages Function (`frontend/functions/api/[[path]].ts`) that proxies to the Worker. This avoids CORS issues and keeps the API URL clean.

### First-time Cloudflare setup

If setting this up from scratch on a new Cloudflare account:

1. Log in: `wrangler login`
2. Create the D1 database: `npx wrangler d1 create cat-tracker-db`
3. Copy the `database_id` from the output into `worker/wrangler.toml`
4. Apply schema: `cd worker && npm run db:migrate:remote`
5. Deploy Worker: `npx wrangler deploy`
6. Create Pages project: `npx wrangler pages project create cat-tracker --production-branch main`
7. Build + deploy frontend: `cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker`

---

## API Reference

Base URL: `https://cat-tracker-api.stevej-67b.workers.dev` (or `/api` via Pages proxy)

### Cats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cats` | List all cats |
| `POST` | `/api/cats` | Create a cat |
| `GET` | `/api/cats/:id` | Get a cat |
| `PUT` | `/api/cats/:id` | Update a cat |
| `DELETE` | `/api/cats/:id` | Delete cat + all measurements |

### Measurements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cats/:id/measurements?type=weight` | List measurements (filter by type) |
| `POST` | `/api/cats/:id/measurements` | Add a measurement |
| `DELETE` | `/api/measurements/:id` | Delete a measurement |

### Import

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/import` | Bulk import cats + measurements from CSV |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/login?provider=google` | Redirect to Google OAuth |
| `GET` | `/api/auth/callback` | OAuth callback — creates session, sets cookie |
| `POST` | `/api/auth/logout` | Clears session |
| `GET` | `/api/auth/me` | Current user info |
| `POST` | `/api/auth/claim-cats` | Claim orphaned cats on first login |

### Health check

```
GET /api/health  →  { "status": "ok" }
```

---

## Health Indicators

The app uses feline veterinary research to classify weight change rates:

| Status | Emoji | Trigger |
|--------|-------|---------|
| Stable | ✅ | < 0.5%/week change |
| Watch | 👀 | 0.5–1%/week loss, or rapid gain > 1.5%/week |
| Concerning | ⚠️ | 1–2%/week loss, or > 7% total loss from peak |
| Urgent | 🚨 | > 2%/week loss, or > 10% total loss from peak |

Emoji dots appear on chart data points and as badges on cat cards. Logic lives in `frontend/src/lib/healthMetrics.ts`.

---

## Documents

- [`docs/PRDs/REGISTRY.md`](docs/PRDs/REGISTRY.md) — Canonical PRD status tracker
- [`docs/PRDs/PRD-mvp.md`](docs/PRDs/PRD-mvp.md) — Original MVP requirements
- [`docs/PRDs/PRD-features-backlog.md`](docs/PRDs/PRD-features-backlog.md) — Feature backlog
- [`docs/PRDs/PRD-ux-simplification.md`](docs/PRDs/PRD-ux-simplification.md) — UX simplification
- [`docs/PRDs/PRD-auth.md`](docs/PRDs/PRD-auth.md) — User accounts & data isolation
- [`docs/PRDs/PRD-killer-app.md`](docs/PRDs/PRD-killer-app.md) — Roadmap research
- [`docs/TDD/README.md`](docs/TDD/README.md) — Technical design docs index
  - [`docs/TDD/web.md`](docs/TDD/web.md) — Current web architecture
  - [`docs/TDD/cross-platform.md`](docs/TDD/cross-platform.md) — iOS / Android / web unified plan
- [`docs/DESIGN.md`](docs/DESIGN.md) — Visual design system
- [`TODO.md`](TODO.md) — Task tracking
- [`CLAUDE.md`](CLAUDE.md) — Instructions for AI assistants
