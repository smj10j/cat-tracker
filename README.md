# Cat Tracker

A lightweight web app for tracking health measurements (starting with weight) for your cats over time. Built on Cloudflare's free tier — no server to maintain, no monthly bill.

**Live app:** https://cat-tracker.pages.dev

---

## Features

- Add and manage multiple cats with profile info (name, birthdate, breed, coloring, notes)
- Log weight measurements with date/time and optional notes
- Per-cat weight chart with zoomed scale to make changes visually meaningful
- Multi-cat comparison chart with per-series toggles
- Research-based health indicators: dots and banners flag concerning weight loss/gain rates based on feline veterinary thresholds

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRD.md              # Product requirements
│   ├── TDD.md              # Technical design doc
│   └── PRD-next.md         # Upcoming features roadmap
├── worker/                 # Cloudflare Worker — REST API
│   ├── src/
│   │   ├── index.ts        # Hono app entry point + CORS
│   │   ├── routes/
│   │   │   ├── cats.ts     # CRUD for /api/cats
│   │   │   └── measurements.ts  # CRUD for /api/measurements
│   │   └── db/
│   │       └── schema.sql  # D1 schema (cats + measurements tables)
│   ├── wrangler.toml       # Worker config + D1 binding
│   └── package.json
├── frontend/               # React + Vite SPA — deployed to Pages
│   ├── src/
│   │   ├── App.tsx         # Router setup
│   │   ├── pages/
│   │   │   ├── Home.tsx        # Cat list
│   │   │   ├── CatProfile.tsx  # Per-cat chart, measurements, health alerts
│   │   │   ├── AddEditCat.tsx  # Add/edit cat form
│   │   │   └── CompareChart.tsx  # Multi-cat comparison chart
│   │   ├── components/
│   │   │   ├── WeightChart.tsx     # Recharts line chart w/ health dots
│   │   │   └── MeasurementForm.tsx # Inline measurement entry form
│   │   └── lib/
│   │       ├── api.ts          # Typed fetch wrappers for all API routes
│   │       └── healthMetrics.ts  # Vet-threshold health status logic
│   ├── functions/
│   │   └── api/[[path]].ts   # Pages Function: proxies /api/* → Worker
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
| Styling | Tailwind CSS |
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
| `GET` | `/api/cats/:id/measurements?type=weight` | List measurements |
| `POST` | `/api/cats/:id/measurements` | Add a measurement |
| `DELETE` | `/api/measurements/:id` | Delete a measurement |

### Health check

```
GET /api/health  →  { "status": "ok" }
```

---

## Health Indicators

The app uses feline veterinary research to classify weight change rates:

| Status | Color | Trigger |
|--------|-------|---------|
| Stable | Green | < 0.5%/week change |
| Watch | Yellow | 0.5–1%/week loss, or rapid gain > 1.5%/week |
| Concerning | Orange | 1–2%/week loss, or > 7% total loss from peak |
| Urgent | Red | > 2%/week loss, or > 10% total loss from peak |

Logic lives in `frontend/src/lib/healthMetrics.ts`.

---

## Documents

- [`docs/PRD.md`](docs/PRD.md) — Original product requirements
- [`docs/TDD.md`](docs/TDD.md) — Technical design
- [`docs/PRD-next.md`](docs/PRD-next.md) — Next features roadmap
- [`TODO.md`](TODO.md) — Task tracking
- [`CLAUDE.md`](CLAUDE.md) — Instructions for AI assistants
