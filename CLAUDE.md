# CLAUDE.md — Cat Tracker

This file provides context and instructions for AI assistants (Claude Code, etc.) working in this repository.

## What this project is

A cat health measurement tracker built on Cloudflare's free tier. Users add cats, log weight measurements, and view time-series charts with veterinary-threshold health alerts.

## Live URLs

- Frontend: https://cat-tracker.pages.dev
- Worker API: https://cat-tracker-api.stevej-67b.workers.dev
- API health check: https://cat-tracker-api.stevej-67b.workers.dev/api/health

## Memory

Project memory is stored at:
`~/.claude/projects/-Users-steve-code-smj10j-cat-tracker/memory/MEMORY.md`

Always read this at the start of a session.

## Project layout

```
shared/       Pure TypeScript shared between frontend/ and app/
  lib/
    types.ts              Shared interfaces (Cat, Measurement, User, etc.)
    correlations.ts       Correlation engine (Pearson lag, detectTrend)
    healthMetrics.ts      Weight health status thresholds
    measurementPresets.ts Behavioral preset labels (0-3 scale)
    dates.ts              Timezone-safe date parsing (parseLocalDate, catAge)
worker/       Cloudflare Worker — Hono REST API
frontend/     React + Vite SPA + Pages Functions proxy
app/          Expo/React Native iOS app (Whisker Health)
docs/
  PRDs/       Product requirement documents (one file per feature area)
  TDD/        Technical design documents
    README.md       TDD index — read this first
    web.md          Current production architecture
    cross-platform.md  iOS app architecture (implemented, in TestFlight)
  research/   Veterinary evidence base — required companion to healthMetrics.ts
    README.md          Sourcing standards and process
    weight-thresholds.md  Citations for every numeric threshold
    behavioral-indicators.md  Citations for behavioral alert lists
    feline-resources.md       Reference directory (journals, guidelines, orgs)
  DESIGN.md   Visual design system
TODO.md       Task tracking — keep this updated
```

See README.md for the full file map.

## Key conventions

### Deploying

Always deploy both pieces after making changes:

```bash
# Full TestFlight release (tests → build → submit → deploy web + worker)
./scripts/deploy-testflight.sh

# Worker only (if API changed)
cd worker && npx wrangler deploy

# Frontend only (always needed for UI changes)
cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

#### `scripts/deploy-testflight.sh`
One-command pipeline: runs all tests, verifies Expo web export, builds production iOS via EAS, submits to TestFlight, deploys web frontend, and conditionally deploys Worker. Use this after any code change that should reach TestFlight testers. Requires EAS login and API key in `keys/`.

### Database changes

Schema lives in `worker/src/db/schema.sql`. After changes:
```bash
cd worker
npm run db:migrate:local   # apply to local dev DB
npm run db:migrate:remote  # apply to production
```

Use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` to keep migrations idempotent.

### Adding a new measurement type

The measurements table is generic (`type`, `value`, `unit`). To add a new type:
1. Add the option to the `<select>` in `frontend/src/components/MeasurementForm.tsx`
2. Add a chart component in `frontend/src/components/` if the visualization differs
3. Wire it into `CatProfile.tsx` — fetch with `getMeasurements(id, 'new-type')`
4. No DB schema changes needed

### Cross-platform file mapping

| What | Location | Shared? |
|------|----------|---------|
| Types (Cat, Measurement, etc.) | `shared/lib/types.ts` | Single source of truth |
| Correlations engine | `shared/lib/correlations.ts` | Single source of truth |
| Health thresholds | `shared/lib/healthMetrics.ts` | Single source of truth |
| Measurement presets | `shared/lib/measurementPresets.ts` | Single source of truth |
| Date parsing | `shared/lib/dates.ts` | Single source of truth |
| API client (web) | `frontend/src/lib/api.ts` | Platform-specific (cookies) |
| API client (native) | `app/lib/api.ts` | Platform-specific (Bearer) |
| Screens (web) | `frontend/src/pages/*.tsx` | Platform-specific (React DOM) |
| Screens (native) | `app/app/**/*.tsx` | Platform-specific (React Native) |

**Rule:** If you change a shared file, both platforms get the change automatically. If you change a platform-specific file (screen, API client), check the other platform's equivalent and apply the same change.

### Health metrics and clinical content

Logic is in `shared/lib/healthMetrics.ts`. Every threshold and clinical claim in this file (and in `WellnessGuide.tsx`, `CatHealthGuidance.tsx`, `InsightsPanel.tsx`, `CatExportPage.tsx`) is backed by veterinary literature documented in `docs/research/`.

**Mandatory process for any clinical content change:**
1. Find the primary source (Tier 1 preferred — AAFP, WSAVA, ISFM, JVIM, JFMS)
2. Update `docs/research/weight-thresholds.md` or `docs/research/behavioral-indicators.md` with the citation
3. Update the inline comment in `healthMetrics.ts` to reference the guideline by name
4. Only then update the threshold value or copy

**Never:**
- Add a numeric threshold without a citation in `docs/research/`
- State a clinical claim (e.g., "associated with hepatic lipidosis") without the guideline named in the code comment
- Derive thresholds from secondary sources (articles citing articles) — go to the primary guideline
- Use AI-generated clinical content as a source

See `docs/research/README.md` for the full sourcing standard and tier definitions.

### TypeScript

- Worker: `@cloudflare/workers-types`, strict mode, bundler module resolution
- Frontend: strict mode, `noUnusedLocals`, `noUnusedParameters`
- Both use `noUncheckedIndexedAccess` style — always null-check array accesses

### Style

- Tailwind CSS — prefer utility classes, use `brand-*` color scale for primary actions
- No component library — keep it simple, custom components only
- Mobile-first: test at 375px width

## Cloudflare resources

| Resource | Name | ID |
|----------|------|----|
| Worker | `cat-tracker-api` | — |
| Pages project | `cat-tracker` | — |
| D1 database | `cat-tracker-db` | `9c923aa8-47a3-4029-b07f-3b67d208f9e6` |
| Cloudflare account | — | `67ba5425d0189fa7d4cf1ada3239e058` |

## Email infrastructure

Transactional email is sent via **Resend** (https://resend.com).

- **From address**: `noreply@01j.me` (verified domain `01j.me`)
- **Worker secret**: `RESEND_API_KEY` (set via `wrangler secret put RESEND_API_KEY`)
- **Helper**: `worker/src/lib/email.ts` — `sendEmail(params, apiKey)` calls `POST https://api.resend.com/emails`
- **Note**: MailChannels ended their free Cloudflare Workers integration; do not use it.

## Git workflow

- Commit after each logical chunk of work
- Keep commits focused; reference the feature area in the message
- No force pushes; no `--no-verify`
- The `main` branch is production (Pages auto-deploys are not configured — manual `wrangler pages deploy` is used)

## Execution Loop

**THIS IS MANDATORY. Follow every step, every time — including doc-only work.**

### At the start of every session (no exceptions)

1. Read `docs/PRDs/REGISTRY.md` — know what exists and its status.
2. Read `TODO.md` — know what was done and what remains.
3. Read `~/.claude/projects/-Users-steve-code-smj10j-cat-tracker/memory/MEMORY.md` — already loaded, but confirm it's current.

### For every task (documentation, code, or mixed)

Follow these steps **in order**. Do not skip, reorder, or batch steps.

1. **Documentation first** — Write or update PRDs, docs/TDD/web.md, API.md, REGISTRY.md, and decision docs before touching code. If a feature has no `Approved` PRD, write one and stop — do not implement until approved. This applies even for small changes: update the relevant doc before the code.

2. **Update TODO.md** — Add a new Phase entry for the work about to be done (even if doc-only). Mark tasks `[-]` (in progress) before starting. **This step is required for all work, not just implementation sprints.**

3. **Implement** — Write the code. **Write or update tests alongside implementation** (see `docs/TESTING.md`).

   **Cross-platform rule (MANDATORY):** When modifying any screen, component, API method, type, or lib file:
   - Check if the same change is needed in the other platform (`frontend/` ↔ `app/`)
   - Bug fixes, new API methods, type changes, and business logic updates must be applied to BOTH
   - Shared logic (types, correlations, healthMetrics, measurementPresets, dates) lives in `shared/lib/` — edit there, not in platform copies
   - Platform-specific files (`frontend/src/lib/api.ts`, `app/lib/api.ts`) differ only in transport (cookies vs Bearer) — but types and method signatures must match
   - Run `./scripts/check-shared-drift.sh` to verify shared libs haven't been duplicated

4. **Run tests** — Before deploying, ensure all tests pass:
   - `cd worker && npm test`
   - `cd frontend && npm test`
   If any test fails, fix the code (or the test if the expectation was wrong) before proceeding.

5. **Deploy** — After any change:
   - Worker: `cd worker && npx wrangler deploy`
   - Frontend: `cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true`

6. **Mark TODO items complete** — Change `[-]` → `[x]` for all finished tasks. Update REGISTRY.md status to `Implemented` for completed PRDs. Do this before committing.

7. **Commit to git** — One logical unit = one commit. Message must reference the feature area. Never batch unrelated changes. Never use `--no-verify`.

8. **Push to remote** — `git push origin main` immediately after every commit. Do not accumulate unpushed commits.

9. **Update MEMORY.md** — After completing a sprint, update `~/.claude/projects/-Users-steve-code-smj10j-cat-tracker/memory/MEMORY.md`.

### Common failure modes to avoid

- **Skipping TODO.md for "quick" or doc-only tasks** — every task needs a TODO entry.
- **Committing without pushing** — push is part of the same step, not optional.
- **Implementing before a PRD is Approved** — Draft status means do not implement.
- **Batching multiple unrelated changes into one commit** — each logical unit gets its own commit.
- **Skipping tests** — run `npm test` in both `worker/` and `frontend/` before every deploy; never deploy with failing tests.
- **Adding code without tests** — every new route, lib function, or component needs accompanying tests in `worker/src/__tests__/` or `frontend/src/__tests__/`.
- **Forgetting to deploy** — both Worker and frontend must be deployed after any change to either.
- **Forgetting to update REGISTRY.md status** — when a PRD's implementation is complete, mark it `Implemented` before committing.

### Additional working style notes

- **Fix bugs before features** — address cleanup items first.
- **Parallelize when safe** — split backend vs. frontend work when files don't overlap; integrate at the end.
- **Never ask the user unless truly blocked** — make reasonable decisions, document them in the commit message.

## Docs

### PRD Registry (IMPORTANT — read before any feature work)

**`docs/PRDs/REGISTRY.md`** is the canonical source of truth for all feature work.

Before implementing anything:
1. **Read REGISTRY.md** — check if there's an existing PRD, what its status is, and whether it was already implemented or rejected
2. Never implement a feature that has no `Approved` or higher status in the registry
3. Never duplicate work listed as `Implemented`

Registry status values: `Draft` → `Under Review` → `Approved` → `In Progress` → `Implemented` / `Rejected` / `Superseded`

### Adding a new PRD

1. Create `docs/PRDs/PRD-<short-descriptor>.md`
2. Add an entry to `docs/PRDs/REGISTRY.md` with status `Draft`
3. Update `README.md` Documents section
4. Wait for product owner to move status to `Approved` before implementing
5. When implementation is complete, update registry status to `Implemented` and add TODO items as `[x]`

### Current PRD statuses

See **`docs/PRDs/REGISTRY.md`** — it is the single source of truth and is always up to date. Do not rely on any status table here; check REGISTRY.md directly.

### Other docs
- `docs/API.md` — full API spec: every endpoint, request/response shapes, auth requirements, authorization rules (who can mutate what)
- `docs/SECURITY.md` — security guidelines, principles, architecture model, known limitations; **read before adding auth/sessions/new API routes**
- `docs/TDD/web.md` — current web architecture, design decisions, schema, auth flow, correlation engine
- `docs/TDD/cross-platform.md` — iOS/Android/web unified app plan (Expo + Expo Router; not yet implemented)
- `docs/DESIGN.md` — visual design system
- `docs/research/README.md` — **required reading before adding or changing any clinical content**; sourcing standards, tier definitions, and the process for adding new evidence

## What NOT to do

- Don't implement auth/login until PRD-auth.md is moved to `Approved` in REGISTRY.md
- Don't change the measurements schema shape — it's intentionally generic
- Don't install a component library; keep the UI hand-rolled with Tailwind
- Don't start from zero on new pages — reuse the layout pattern from `CatProfile.tsx`
- Don't add or change health thresholds without updating `docs/research/` first — threshold changes without citations will cause clinical regression
- Don't add clinical claims (condition names, risk associations, guideline references) to alert copy or the Wellness Guide without a Tier 1 source documented in `docs/research/`
