# Cat Tracker — TODO

## Status Key
- [ ] Not started
- [x] Complete
- [-] In progress

---

## Phase 0: Planning
- [x] Write PRD (docs/PRD.md)
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

## Backlog (Post-MVP)
- [ ] Cat photo upload (Cloudflare R2)
- [ ] Additional measurement types (length, food intake)
- [ ] Date range filtering on charts
- [ ] PWA manifest + offline support
- [ ] GitHub Actions CI/CD
