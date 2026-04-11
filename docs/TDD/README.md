# Cat Tracker — Technical Design Documents

This directory contains all technical design documents (TDDs) for Cat Tracker.
Each TDD covers one platform or architectural layer. Read the one relevant to the work you're doing.

---

## TDD Index

| Document | Covers | Status |
|---|---|---|
| [web.md](web.md) | Current production architecture: Cloudflare Worker + D1 + R2 + React/Vite SPA on Pages | **Current** |
| [cross-platform.md](cross-platform.md) | iOS app (Whisker Health) using Expo SDK 54 + Expo Router v6 + NativeWind v4 | **Implemented — in TestFlight** |

---

## When to read which

**Before any backend or web frontend work** → read `web.md`.
It is the source of truth for everything currently running in production: schema, auth flow, deployment, route structure, design decisions.

**Before starting mobile / cross-platform work** → read `cross-platform.md` first, then `web.md`.
The cross-platform TDD describes what changes and what stays the same. The Worker and D1 schema described in `web.md` remain the authoritative backend for both.

---

## Adding a new TDD

When a third platform or major architectural layer warrants a TDD:

1. Create `docs/TDD/<name>.md`
2. Add a row to the table above
3. Link to it from `CLAUDE.md` and `README.md`

Keep TDDs scoped to architecture and implementation decisions. Feature-level specifications live in `docs/PRDs/`.
