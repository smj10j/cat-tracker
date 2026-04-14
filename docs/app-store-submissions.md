# App Store Submission Log

Tracks every TestFlight build and App Store review submission.
- TestFlight entries are added automatically by `scripts/deploy-testflight.sh`
- App Store review entries are added manually (tell Claude "I submitted build X for review")

---

## Entry Format (for AI assistants and humans)

### Adding a new TestFlight build

Done automatically by `scripts/deploy-testflight.sh`. The format is:

```markdown
## Version X.Y.Z (Build YYYY-MM-DD)
- **Submitted**: YYYY-MM-DD HH:MM:SS
- **Commit**: <short-hash> (<full-hash>)
- **Commit message**: <subject line of commit>
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
```

### Recording an App Store review submission and its outcome

**Attach review info to the original build entry that was submitted for review — not to later TestFlight builds.** The review outcome belongs with the submission that was actually reviewed.

**Step 1 — When the build is submitted for review:** Add `- IN REVIEW` to the version header and note the submission date:

```markdown
## Version X.Y.Z — Build NN (YYYY-MM-DD) - IN REVIEW
- **TestFlight**: YYYY-MM-DD
- **App Store Review**: YYYY-MM-DD (submitted)
  - **App Store Status**: In Review since YYYY-MM-DD
```

**Step 2 — When the review completes (approved or rejected):** Update the suffix and append outcome details:

```markdown
## Version X.Y.Z — Build NN (YYYY-MM-DD) - REJECTED
- **TestFlight**: YYYY-MM-DD
- **App Store Review**: YYYY-MM-DD (submitted)
  - **App Store Status**: Rejected YYYY-MM-DD
  - **Rejection reason**: Guideline X.Y — "<direct quote from Apple review team>"
  - **Root cause**: <1-2 sentence technical explanation>
  - **Fix**: Commit <hash> — <what was changed>
```

For approvals, use `- APPROVED` and `**App Store Status**: Approved YYYY-MM-DD`.

**Never default to REJECTED.** The default state while awaiting review is `IN REVIEW`.

### Required screenshot dimensions (reference)

iPhone 6.7" / 6.9" App Store screenshots: **1284×2778** or **1242×2688**. Resize with `sips --resampleHeightWidth <H> <W> <file>`.

---

## Version 1.0.0 — Build 25 (2026-04-11) - REJECTED
- **TestFlight**: 2026-04-11
- **App Store Review**: 2026-04-11
  - **App Store Status**: Rejected 2026-04-14
  - **Rejection reason**: Guideline 2.4 — "Parts of the app's user interface were crowded, laid out, or displayed in a way that made it difficult to use the app when reviewed on iPad Air 11-inch (M3) running iPadOS 26.4.1."
  - **Root cause**: App had `supportsTablet: false` and zero responsive layout patterns — all screens used hardcoded `paddingHorizontal: 16` with no `maxWidth` constraints, causing content to stretch edge-to-edge on iPad.
  - **Fix**: Commit 99c775e — enabled `supportsTablet: true`, added `useResponsiveLayout` hook and `ResponsiveContainer` wrapper to all 17 screens, scaled key visual elements for iPad via `rv()` helper, added pre-submission test suite to prevent regression.

