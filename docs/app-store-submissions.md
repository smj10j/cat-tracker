# App Store Submission Log

Tracks every TestFlight build and App Store review submission.
- TestFlight entries are added automatically by `scripts/submit-testflight.sh`
- App Store review entries are added manually (tell Claude "I submitted build X for review")

---

## Entry Format (for AI assistants and humans)

### Adding a new TestFlight build

Done automatically by `scripts/submit-testflight.sh` (invoked after `scripts/build-ios.sh`). The format is:

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
  - **Outcome**: Approved (confirmed 2026-07-02 — altool rejected a new 1.0.3 TestFlight build with 'previously approved version [1.0.3]' / closed pre-release train, which only occurs post-approval)
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


## Version 1.0.0 — Build 43 (2026-04-14) - APPROVED
- **TestFlight**: 2026-04-14 10:49:44 (via local)
- **Commit**: 764f9a6 (764f9a69172cf804c7cf92bfd4b694bc87b306b3)
- **Commit message**: Split TestFlight deploy into build + submit scripts with better error handling
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **App Store Review**: 2026-04-14 (submitted)
  - **App Store Status**: Approved 2026-04-17

## Version 1.0.0 (Build 2026-04-15)
- **Submitted**: 2026-04-15 21:05:25 (via local)
- **Commit**: 38f0e97 (38f0e976c209943ecd1e0ca7b14bf4115880e3ac)
- **Commit message**: Visual Identity v2 Phase 4 + docs: icon options, DESIGN.md, REGISTRY, deploy
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight

## Version 1.0.1 (Build 2026-05-05)
- **Submitted**: 2026-05-05 19:30:36 (via local)
- **Commit**: d25e764 (d25e764501648520d6d545358b3bb27b41613d98)
- **Commit message**: Merge pull request #2 from smj10j/claude/add-care-options-U5daJ
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight

## Version 1.0.2 (Build 2026-05-05)
- **Submitted**: 2026-05-05 19:57:11 (via local)
- **Commit**: 7f8e3af (7f8e3af06fadfa98c3297c72e88b55bbd6cc9048)
- **Commit message**: care: native iOS Sitter view with PDF share
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight

## Version 1.0.3 (Build 2026-05-05) - APPROVED
- **TestFlight**: 2026-05-05 20:08:20 (via local)
- **Commit**: 094651d (094651d84a3fc08a4656cc9975c1c0cb66e386cc)
- **Commit message**: care: fix Sitter view subtitle rendering as literal escape
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **App Store Review**: 2026-05-05 (submitted)
  - **App Store Status**: In Review since 2026-05-05

## Version 1.0.4 (Build 2026-07-02)
- **Submitted**: 2026-07-02 17:38:03 (via local)
- **Commit**: f6cde9c (f6cde9cd9eaff3edc392c6d58dbdaeb4c0cf98ac)
- **Commit message**: app: bump version 1.0.3 -> 1.0.4; log v1.0.3 App Store approval
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
