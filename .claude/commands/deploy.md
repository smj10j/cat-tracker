---
description: Deploy the app to TestFlight (tests → web + worker → local IPA build → TestFlight submit + log)
---

Run the full TestFlight deploy pipeline as two sequential steps. **Call them in order**, and stop immediately if the build step fails — do not attempt to submit.

## Step 1: Build

```bash
./scripts/build-ios.sh
```

Default is a local build (faster, no EAS credits). This runs all 4 test suites, verifies the Expo web export, deploys the web frontend to Cloudflare Pages, conditionally deploys the Worker, then builds the production IPA locally. On success it writes build metadata to `/tmp/whisker-build-info.env`.

Only if step 1 succeeds, proceed to step 2.

## Step 2: Submit

```bash
./scripts/submit-testflight.sh
```

Picks up the metadata from `/tmp/whisker-build-info.env`, runs `eas submit`, verifies the submission actually reached Apple (not just that `eas submit` exited 0), and appends a TestFlight entry to `docs/app-store-submissions.md`. The info file is renamed with a `.submitted.*` suffix to prevent accidental re-submission.

If the submit fails, the info file is preserved. Retry with:

```bash
./scripts/submit-testflight.sh --info-file /tmp/whisker-build-info.env
```

— no need to rebuild the IPA.

## Alternative build modes

- `./scripts/build-ios.sh --local` — explicit local build (same as default)
- `./scripts/build-ios.sh --cloud` — EAS cloud build (uses free-plan credits; fails if quota exhausted)

Only use `--cloud` if the user explicitly asks for it.

## Before running

- Verify `git status` is clean or committed — the build script tags the commit for worker-deploy tracking
- If UI changed, run `/pre-submit-check` first (or `cd app && npm test`)
- Confirm EAS login is active and API key exists in `keys/`

## Reference

- Build script: `scripts/build-ios.sh`
- Submit script: `scripts/submit-testflight.sh`
- Submission log: `docs/app-store-submissions.md` (entries appended automatically by submit script)
- EAS config: `app/eas.json`
