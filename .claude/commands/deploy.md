---
description: Deploy the app to TestFlight (runs tests, builds locally by default, submits to TestFlight, deploys web + worker)
---

Run the full TestFlight deploy pipeline via `scripts/deploy-testflight.sh`.

## Default: local build (faster, free)

```bash
./scripts/deploy-testflight.sh --local
```

Local builds take ~10-15 min but produce the same IPA as cloud builds and don't consume EAS credits. This is the right default — use cloud only if local is blocked (Xcode/CocoaPods issue).

## What the script does

1. Runs all 4 test suites (shared + worker + frontend + app) — blocks on any failure
2. Verifies the Expo web export compiles clean
3. Builds a production iOS IPA locally
4. Submits to TestFlight via `eas submit`
5. Appends a TestFlight entry to `docs/app-store-submissions.md`
6. Deploys the web frontend to Cloudflare Pages
7. Conditionally deploys the Worker if `worker/` or `shared/` changed since last deploy

## Before running

- Verify `git status` is clean or at least committed — the script tags the commit for deploy tracking
- If UI changed, verify iPad readiness locally first (run `/pre-submit-check` or run `cd app && npm test`)
- Confirm EAS login is active and API key exists in `keys/`

## Alternative modes

- `./scripts/deploy-testflight.sh --cloud` — force EAS cloud build (uses credits; fails if quota exhausted)
- `./scripts/deploy-testflight.sh` (no flag) — auto: try cloud first, fall back to local on quota error

Only use `--cloud` if the user explicitly asks for it.

## Reference

- Script: `scripts/deploy-testflight.sh`
- Submission log: `docs/app-store-submissions.md` (entries appended automatically)
- EAS config: `app/eas.json`
