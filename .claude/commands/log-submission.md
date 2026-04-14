---
description: Log an App Store review submission or outcome to docs/app-store-submissions.md
---

The user is reporting an App Store review event — either a new submission, or an outcome (rejection/approval) for a previously-submitted build. Your job is to log it correctly in `docs/app-store-submissions.md`.

## Three states

Every reviewed build moves through three states:
1. **IN REVIEW** — submitted to App Store review, awaiting Apple's decision
2. **REJECTED** or **APPROVED** — Apple's decision

**Never default to REJECTED.** A new submission starts as IN REVIEW.

## Process

1. **Identify what event the user is reporting:**
   - "I submitted build X for review" → **IN REVIEW** (new)
   - "Apple rejected build X" → **REJECTED** (update existing IN REVIEW entry)
   - "Build X was approved" → **APPROVED** (update existing IN REVIEW entry)

2. **Identify the build.** Check `docs/app-store-submissions.md` for the build entry. Review events attach to the original submitted build entry — not later TestFlight-only builds. If the user didn't specify, ask which build.

3. **Apply the format per the spec at the top of `docs/app-store-submissions.md`:**
   - Add or update the status suffix on the version header (`- IN REVIEW` / `- REJECTED` / `- APPROVED`)
   - Add or update sub-bullets under `**App Store Review**:`

4. **For rejections: after logging the rejection, plan the fix.**
   - Use `EnterPlanMode` — the fix must address the root cause, not just the symptom
   - After fix is committed, append `**Fix**: Commit <hash> — <summary>` to the entry
   - Consider whether a regression test should be added to prevent the issue from recurring (see `app/__tests__/appStoreReadiness.test.ts` for the pattern)

5. **Commit the log update.** Message format:
   - `Log App Store submission for <version/build>` (IN REVIEW)
   - `Log App Store rejection for <version/build>` (REJECTED)
   - `Log App Store approval for <version/build>` (APPROVED)

## Reference

- Format spec: top of `docs/app-store-submissions.md`
- Apple review guidelines: https://developer.apple.com/app-store/review/guidelines/
- Past rejections and their root causes are recorded in the log itself — check for patterns
