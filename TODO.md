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
- [ ] Scaffold Worker project (Hono + TypeScript + wrangler.toml)
- [ ] Scaffold Frontend project (React + Vite + Tailwind + React Router)
- [ ] Create D1 database via wrangler CLI
- [ ] Apply schema migration to D1 (local + remote)
- [ ] Configure Pages → Worker API proxy

## Phase 2: Backend API
- [ ] Implement GET/POST /api/cats
- [ ] Implement GET/PUT/DELETE /api/cats/:id
- [ ] Implement GET/POST /api/cats/:id/measurements
- [ ] Implement DELETE /api/measurements/:id
- [ ] Test all endpoints locally with wrangler dev

## Phase 3: Frontend
- [ ] Set up React Router routes
- [ ] Home page: cat list + "Add Cat" button
- [ ] Add/Edit Cat form page
- [ ] Cat Profile page (header, info, tabs)
- [ ] Add Measurement form/modal
- [ ] Weight chart component (Recharts line chart)
- [ ] Measurement history table
- [ ] Basic mobile-responsive layout

## Phase 4: Integration & Polish
- [ ] Wire frontend to live API
- [ ] Handle loading and error states
- [ ] Basic form validation
- [ ] Empty states (no cats, no measurements)

## Phase 5: Deployment
- [ ] Deploy Worker to Cloudflare
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Verify end-to-end in production
- [ ] Initial git commit with full working MVP

## Backlog (Post-MVP)
- [ ] Cat photo upload (Cloudflare R2)
- [ ] Additional measurement types (length, food intake)
- [ ] Date range filtering on charts
- [ ] PWA manifest + offline support
- [ ] GitHub Actions CI/CD
