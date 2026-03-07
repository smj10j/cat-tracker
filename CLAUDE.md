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
worker/     Cloudflare Worker — Hono REST API
frontend/   React + Vite SPA + Pages Functions proxy
docs/       PRD, TDD, and roadmap documents
TODO.md     Task tracking — keep this updated
```

See README.md for the full file map.

## Key conventions

### Deploying

Always deploy both pieces after making changes:

```bash
# Worker (if API changed)
cd worker && npx wrangler deploy

# Frontend (always needed for UI changes)
cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

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

### Health metrics

Logic is in `frontend/src/lib/healthMetrics.ts`. Thresholds are based on feline veterinary literature. If adding thresholds for new measurement types (e.g., food intake), create a parallel function in the same file.

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

## Git workflow

- Commit after each logical chunk of work
- Keep commits focused; reference the feature area in the message
- No force pushes; no `--no-verify`
- The `main` branch is production (Pages auto-deploys are not configured — manual `wrangler pages deploy` is used)

## Working Style (autonomous mode)

When given an open-ended task like "build the next set of features":

1. **Read TODO.md first** — understand current state before touching anything
2. **Plan before coding** — write down what you're going to do (update TODO) so you don't lose track
3. **Fix bugs before features** — small cleanup items first, then new features
4. **Parallelize with background agents** — split backend vs. frontend work across agents when the files don't overlap; integrate at the end
5. **Commit after each logical unit** — one feature = one commit; don't batch unrelated changes
6. **Deploy as you go** — run `npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true` after frontend changes; `npx wrangler deploy` after Worker changes
7. **Update TODO.md as you complete items** — mark `[x]` and commit the TODO update with the feature commit
8. **Never ask the user for input unless truly blocked** — make reasonable decisions, document them in the commit message
9. **Keep MEMORY.md current** — update after completing a sprint so the next session has context

## What NOT to do

- Don't add auth/login without being asked — it's intentionally single-tenant
- Don't change the measurements schema shape — it's intentionally generic
- Don't install a component library; keep the UI hand-rolled with Tailwind
- Don't start from zero on new pages — reuse the layout pattern from `CatProfile.tsx`
