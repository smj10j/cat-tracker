# Cat Tracker — Technical Design Document

## Architecture Overview

```
┌─────────────────────────────────┐
│  Cloudflare Pages               │
│  (React + Vite SPA)             │
│  /  /cats/:id  /cats/new        │
└────────────┬────────────────────┘
             │ fetch /api/*
┌────────────▼────────────────────┐
│  Cloudflare Worker (Hono)       │
│  /api/cats                      │
│  /api/cats/:id                  │
│  /api/measurements              │
│  /api/cats/:id/measurements     │
└────────────┬────────────────────┘
             │ D1 binding
┌────────────▼────────────────────┐
│  Cloudflare D1 (SQLite)         │
│  cats, measurements tables      │
└─────────────────────────────────┘
```

The frontend (Cloudflare Pages) proxies API calls to the Worker via Pages Functions or a `_routes.json` config that forwards `/api/*` to the Worker.

---

## Project Structure

```
cat-tracker/
├── docs/
│   ├── PRD.md
│   └── TDD.md
├── worker/               # Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts      # Worker entry + Hono app
│   │   ├── routes/
│   │   │   ├── cats.ts
│   │   │   └── measurements.ts
│   │   └── db/
│   │       └── schema.sql
│   ├── wrangler.toml
│   └── package.json
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CatProfile.tsx
│   │   │   └── AddCat.tsx
│   │   ├── components/
│   │   │   ├── CatCard.tsx
│   │   │   ├── MeasurementForm.tsx
│   │   │   └── WeightChart.tsx
│   │   └── lib/
│   │       └── api.ts    # typed fetch wrappers
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
└── TODO.md
```

---

## Database Schema (D1 / SQLite)

```sql
-- cats table
CREATE TABLE cats (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,
  birthdate   TEXT NOT NULL,          -- ISO 8601 date: YYYY-MM-DD
  breed       TEXT,
  coloring    TEXT,
  notes       TEXT,
  photo_url   TEXT,                   -- R2 URL if uploaded
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- measurements table (generic, extensible)
CREATE TABLE measurements (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id          TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,      -- e.g. 'weight', 'length'
  value           REAL NOT NULL,
  unit            TEXT NOT NULL,      -- e.g. 'lbs', 'kg', 'cm'
  measured_at     TEXT NOT NULL,      -- ISO 8601 datetime
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_measurements_cat_type ON measurements(cat_id, type, measured_at);
```

---

## API Design

Base path: `/api`

### Cats

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cats | List all cats |
| POST | /api/cats | Create a cat |
| GET | /api/cats/:id | Get a cat |
| PUT | /api/cats/:id | Update a cat |
| DELETE | /api/cats/:id | Delete a cat (cascades measurements) |

### Measurements

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cats/:id/measurements | List measurements for a cat (optional ?type=weight) |
| POST | /api/cats/:id/measurements | Add a measurement |
| DELETE | /api/measurements/:id | Delete a measurement |

### Request/Response shapes

**Cat (POST/PUT body)**
```json
{
  "name": "Luna",
  "birthdate": "2020-03-15",
  "breed": "Domestic Shorthair",
  "coloring": "Tabby",
  "notes": "Very fluffy",
  "photo_url": null
}
```

**Measurement (POST body)**
```json
{
  "type": "weight",
  "value": 9.2,
  "unit": "lbs",
  "measured_at": "2024-01-15T10:30:00Z",
  "notes": "Morning before breakfast"
}
```

---

## Frontend Routing

Using React Router (client-side):

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Home` | List of all cats |
| `/cats/new` | `AddEditCat` | Add cat form |
| `/cats/:id` | `CatProfile` | Cat profile + chart + measurements |
| `/cats/:id/edit` | `AddEditCat` | Edit cat form |

---

## Deployment

### Worker
```toml
# worker/wrangler.toml
name = "cat-tracker-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "cat-tracker-db"
database_id = "<to be filled after creation>"
```

### Pages
- Build command: `npm run build` (in frontend/)
- Output dir: `dist/`
- Proxy `/api/*` → Worker via `_worker.js` or wrangler pages config

### CI/CD
- Manual `wrangler deploy` for Worker
- `wrangler pages deploy dist/` for Pages
- Later: GitHub Actions

---

## Key Dependencies

### Worker
- `hono` — lightweight routing framework for Workers
- `@cloudflare/workers-types`

### Frontend
- `react`, `react-dom`, `react-router-dom`
- `recharts` — charting
- `tailwindcss`
- `vite`

---

## MVP Scope & Iteration Plan

### Phase 1 (MVP)
- [x] PRD + TDD
- [ ] Project scaffolding
- [ ] D1 schema + migration
- [ ] Worker API (cats + measurements CRUD)
- [ ] Frontend: cat list, add cat, cat profile
- [ ] Frontend: add measurement form
- [ ] Frontend: weight chart (Recharts)
- [ ] Deploy to Cloudflare

### Phase 2 (Future)
- Cat photo upload (R2)
- Additional measurement types
- Date range filtering on charts
- PWA / add to home screen
- Auth (if needed)
