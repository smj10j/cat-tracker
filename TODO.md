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

## Phase 6: Features & Enhancements (Sprint 1)

### Bugs & Polish
- [x] Fix: percentage values showing more than 1 decimal place in health summaries

### Quick Wins
- [ ] PWA manifest.json — home screen installability
- [ ] Quick-add floating button on home screen (cat selector + measurement in 2 taps)

### CSV Import
- [ ] Backend: POST /api/import endpoint (parse CSV, bulk insert cats + measurements)
- [ ] Frontend: Import page — file upload, preview table, confirm/cancel

### More Measurement Types
- [ ] Add food intake (oz/day) measurement type to form + chart
- [ ] Add water intake (oz/day) measurement type to form + chart
- [ ] Cat profile tabs: Weight | Food | Water | All History

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
- [ ] Add household token to D1 schema
- [ ] Backend: generate/rotate token endpoint
- [ ] Frontend: settings page with shareable link + rotate button
- [ ] Middleware: accept ?token= on all API routes

## Phase 7: Infrastructure
- [ ] GitHub Actions: auto-deploy Worker + Pages on push to main
- [ ] PWA service worker + offline measurement queueing
