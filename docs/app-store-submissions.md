# App Store Submission Log

Tracks every TestFlight build and App Store review submission.
- TestFlight entries are added automatically by `scripts/deploy-testflight.sh`
- App Store review entries are added manually (tell Claude "I submitted build X for review")

---

## Version 1.0.0 — Build 25 (2026-04-11)
- **TestFlight**: 2026-04-11
- **App Store Review**: 2026-04-11
- **Commit**: 2535ebd (2535ebd33ceeeb1846ec0ac2b3b13b7eed4e8041)
- **Submission ID**: 0848be30-eb7c-4fdf-8b89-de876b79672a
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Notable changes**: Initial App Store submission. Memorial page parity with web, deceased cats visible on mobile home screen, keyboard dismissal fixes.

## Version 1.0.0 (Build 2026-04-12) — REJECTED
- **Submitted**: 2026-04-12 18:46:23
- **Commit**: 45ba8d7 (45ba8d7c47fe4d24ccbf81f40573d1559d5c965e)
- **Commit message**: Extract shared constants: measurement labels, behavioral types, chart colors, medication form labels, roundToHour, toLocalDatetimeString
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
- **App Store Review**: Rejected 2026-04-14
  - **Rejection reason**: Guideline 2.4 — "Parts of the app's user interface were crowded, laid out, or displayed in a way that made it difficult to use the app when reviewed on iPad Air 11-inch (M3) running iPadOS 26.4.1."
  - **Root cause**: App had `supportsTablet: false` and zero responsive layout patterns — all screens used hardcoded `paddingHorizontal: 16` with no `maxWidth` constraints, causing content to stretch edge-to-edge on iPad.
  - **Fix**: Commit 99c775e — enabled `supportsTablet: true`, added `useResponsiveLayout` hook and `ResponsiveContainer` wrapper to all 17 screens, scaled key visual elements for iPad via `rv()` helper, added pre-submission test suite to prevent regression.

## Version 1.0.0 (Build 2026-04-12)
- **Submitted**: 2026-04-12 19:38:48
- **Commit**: 56568d1 (56568d18f0fc188fc9a18fa9d5cc4d5e3bd95619)
- **Commit message**: Update documentation to reflect shared library refactoring
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
