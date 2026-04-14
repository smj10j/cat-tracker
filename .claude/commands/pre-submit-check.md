---
description: Run the full pre-submission verification before a TestFlight or App Store build
---

Before cutting a TestFlight or App Store build, verify the app is ready. This mirrors what `scripts/build-ios.sh` will run — catch issues early.

## Steps

1. **All four test suites pass:**
   ```bash
   cd shared && npm test -- --run
   cd worker && npm test -- --run
   cd frontend && npm test -- --run
   cd app && npm test -- --run
   ```
   The app suite includes `appStoreReadiness.test.ts` (static analysis) and `ipad-smoke.test.tsx` (iPad render tests). If either fails, DO NOT submit — fix the underlying issue.

2. **TypeScript compiles clean in all packages:**
   ```bash
   cd shared && npx tsc --noEmit
   cd worker && npx tsc --noEmit
   cd frontend && npx tsc --noEmit
   cd app && npx tsc --noEmit
   ```

3. **Check for recent changes that could affect App Store review:**
   - New screens added? Verify they have smoke test coverage and responsive layout.
   - New API endpoints? Verify auth/authorization tests.
   - Permission changes in `app.json`? Verify the usage descriptions are accurate and justified.
   - New third-party libraries? Verify their licenses and data practices.

4. **Review `docs/app-store-submissions.md` for past rejections.** If a prior rejection reason could apply to current code changes, verify the relevant tests are still passing and the root cause hasn't regressed.

5. **Visual verification (if UI changed):**
   - iPhone simulator: no regressions in portrait
   - iPad simulator (iPad Air 11-inch): content centered at 640px, elements scaled appropriately

## If any check fails

Diagnose the root cause, fix it, re-run the full check. Do NOT submit with known failures — every App Store rejection costs days of turnaround time.

## Reference

- Deploy script: `scripts/build-ios.sh`
- Readiness test: `app/__tests__/appStoreReadiness.test.ts`
- iPad smoke tests: `app/__tests__/screens/ipad-smoke.test.tsx`
- Past rejections: `docs/app-store-submissions.md`
