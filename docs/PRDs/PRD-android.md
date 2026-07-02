# PRD: Android Release (Google Play)

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-ios-app-store.md (Implemented — cross-platform foundation), PRD-visual-identity-v2.md (Lamplight theme for screenshots) |
| **Related** | [docs/TDD/cross-platform.md](../TDD/cross-platform.md), [docs/app-store-submissions.md](../app-store-submissions.md), `scripts/build-ios.sh`, `scripts/submit-testflight.sh` |

---

## Problem

Whisker Health is live on the iOS App Store, but the Expo codebase it runs on is **Android-capable and unshipped**. Android is roughly half the mobile audience (more in many regions), and the web app is a poor substitute on Android phones: no push medication reminders, no home-screen presence beyond a PWA shortcut, no store discoverability, and browser-tab ergonomics for a daily-use logging app.

The hard work — shared libs, Bearer auth, push infrastructure, responsive layouts, the store-submission pipeline pattern — is done. What remains is the Android-specific delta: auditing iOS-only code paths, FCM credentials, one Worker query, store assets, build/submit scripts, and Play Console process. This PRD is the "incremental work later" that PRD-ios-app-store's Goal 3 explicitly deferred.

---

## Target users

- **Android-primary cat owners** — currently limited to the mobile web app, with no reminders.
- **Mixed households** — one caretaker on iOS with the native app, the other on Android stuck on web; household sharing works but the experience is lopsided (no push for the Android member).
- **Existing web users on Android** — the smart-banner equivalent audience; lowest-friction install conversions.

---

## User stories

1. "I have a Pixel. I want the same app my partner has on her iPhone — reminders included."
2. "I found Whisker Health on the Play Store searching 'cat medication tracker' and installed it in one tap."
3. "I signed in with Google on my Android phone and all our household's cats were just there."
4. "I get the 6 PM fluids reminder on my Android phone exactly like iOS users do."
5. (Maintainer) "I run `./scripts/build-android.sh && ./scripts/submit-play.sh` and a build lands on the internal track, logged in the submission history."

---

## Scope (phased)

### Phase A — Internal testing track

**A1. iOS-only code path audit** (first task; produces a checklist tracked in TODO.md):
- **Auth**: `expo-apple-authentication` is iOS-only. On Android: hide the Apple button; **Google OAuth becomes the primary (top) sign-in**. Decide the Google flow (existing web-redirect flow via `expo-auth-session` + `?mode=native` callback vs. native Google Sign-In / Credential Manager — see Open Questions). Apple-account continuity for iOS→Android switchers is an edge case below.
- **PDF share** (Sitter view, Vet Export): verify `expo-print` + `expo-sharing` output on Android — page sizing, share-sheet targets, and file-provider behavior differ from iOS.
- **Safe areas / StatusBar**: audit every screen for hardcoded iOS assumptions (notch insets, translucent status bar, home-indicator padding); Android 15 enforces edge-to-edge — verify `SafeAreaView`/insets usage renders correctly.
- **Notifications**: Android requires **notification channels** — create a "Care reminders" channel at app init with sound/importance; verify the `expo-notifications` config-plugin icon (white/transparent small icon requirement) and `#c084fc` accent render correctly; runtime `POST_NOTIFICATIONS` permission (Android 13+) requested on first relevant action, mirroring iOS timing.
- **Misc sweep**: `Platform.OS === 'ios'` occurrences, date/time picker (Android variant of `@react-native-community/datetimepicker` is a dialog, not inline), haptics, keyboard-avoiding behavior, font rendering of Lamplight type ramp.

**A2. Push notifications end-to-end**:
- Upload **FCM v1 service-account credentials** to EAS (`eas credentials`); add `google-services.json` (gitignored or EAS-file-managed, consistent with `keys/` conventions).
- App registers its Expo push token with `platform: 'android'` (the `device_tokens` table and SEC-14 validation already accept this).
- **Worker cron change**: `worker/src/index.ts` (currently ~line 192) selects `... FROM device_tokens WHERE platform = 'ios'` — change to `WHERE platform IN ('ios', 'android')`. Expo push tokens are transport-agnostic, so `sendExpoPushNotifications` and stale-token cleanup need no changes. Add a worker test covering mixed-platform fan-out.

**A3. App identity & assets**:
- **Package name**: `app.json` currently has `android.package: "me.o1j.whisker"` — note the `o1j` vs iOS's `01j` bundle id (Android package segments cannot start with a digit, so `me.01j.whisker` is invalid). **Confirm this exact string before first upload — it is permanent on Play.** See Open Questions.
- Adaptive icon: `adaptive-icon.png` foreground on `#16111f` (already configured) — verify against the final Lamplight icon direction (icon selection is an open follow-up in visual-identity-v2); test circle/squircle/rounded masks.
- Splash screen parity with iOS; monochrome/themed icon (Android 13+) if the foreground asset supports it.

**A4. Build & submit pipeline**:
- `eas.json`: add `build.production.android` (AAB, `autoIncrement` for `versionCode`), a `preview` APK profile for sideload testing, and `submit.production.android` with `serviceAccountKeyPath` pointing into gitignored `keys/` (mirroring the ASC API key pattern).
- `scripts/build-android.sh` mirroring `build-ios.sh`: run all 4 test suites → verify Expo web export → deploy web + conditional Worker → build AAB (`--local` default; requires JDK + Android SDK on this machine — document setup; `--cloud` fallback) → write `/tmp/whisker-android-build-info.env`.
- `scripts/submit-play.sh` mirroring `submit-testflight.sh`: consume the info file, `eas submit --platform android --path <aab>` to the **internal testing track**, verify success marker, append a Play entry to `docs/app-store-submissions.md`, rename the info file `.submitted.*`. (Note: there is no `altool` equivalent — even "local" submits route through `eas submit` with the Play service account; document this asymmetry in the script header.)
- Signing: use **Play App Signing** with an EAS-managed upload key (standard); record where credentials live.

**A5. Play Console setup**:
- Developer account ($25 one-time) and app record for the confirmed package name.
- **Data safety form** — translate the Privacy Nutrition Labels table from PRD-ios-app-store 1:1 (email, name, cat health data, photos, user id, push token; no tracking, no ads).
- Content rating questionnaire (expect Everyone), privacy policy URL (`/privacy`, already live), app category (Lifestyle), target-API-level compliance (Expo SDK's target is current; verify against Play's rolling requirement).
- **Closed-testing prerequisite (honest process note)**: personal developer accounts created after Nov 2023 must run a closed test with ≥ 12–20 testers for 14 continuous days before production access is granted. If this applies to our account, it dominates the Phase A→B timeline — confirm account standing first (see Open Questions) and recruit testers early.

**Exit criteria (Phase A)**: internal-track build installable from Play; sign-in (Google), full CRUD, charts, PDF shares, and push reminders verified on ≥ 2 physical devices (one small phone, one large/tablet) + emulator matrix; submission logged.

### Phase B — Production release

- **Store listing**: title (≤ 30 chars), short description (≤ 80), full description derived from `app/assets/store/shared/app-description.md`; feature graphic 1024×500 in Lamplight theme.
- **Screenshots**: phone (16:9 or 9:16, min 2) + 7"/10" tablet sets, Lamplight theme per PRD-visual-identity-v2, captured via emulator script (extend the existing screenshot tooling; store under `app/assets/store/android/` — the placeholder structure from PRD-ios-app-store).
- **Staged rollout**: release to production at **20% → 50% → 100%**, advancing only after 48h with no crash-rate regression (Play vitals + existing error monitoring).
- **Submission logging**: extend the format spec at the top of `docs/app-store-submissions.md` with Play entry types (`Play Internal`, `Play Production (staged N%)`), appended by `submit-play.sh` for internal and manually for rollout stage changes — mirroring the TestFlight/App Store Review split.
- Web app: add a Play Store badge next to the App Store badge on the login page.
- In-app review prompt via the Play equivalent (`expo-store-review` handles both platforms) after the 5th check-in, matching iOS behavior.

**Exit criteria (Phase B)**: app live at 100% rollout; listing complete; crash-free rate ≥ 99.5%; submission log format extended and in use.

---

## Data model sketch (D1 — additive only)

**No new tables, no new columns.** The schema was built cross-platform from day one:

- `device_tokens.platform` already documents `'ios' | 'android' | 'web'`; Android rows simply start existing.
- Sessions, users (`oauth_provider`), cats, measurements, medications: unchanged.

The only persistence-adjacent change is the **cron query** in `worker/src/index.ts` (see A2) — code, not schema.

---

## API sketch

**No new endpoints.** Deltas only:

| Change | Where |
|---|---|
| Push fan-out includes Android tokens: `WHERE platform IN ('ios','android')` | `worker/src/index.ts` scheduled handler (~line 192) |
| App sends `platform: 'android'` on `POST /api/auth/device-token` | `app/lib/api.ts` call site (value from `Platform.OS`) |
| Google OAuth on Android reuses existing `/api/auth/login` + `?mode=native` callback (pending OQ2) | No Worker change if the web flow is chosen; a native Google Sign-In flow would add an id-token verification route similar to `/api/auth/apple-native` |

`shared/lib/apiTypes.ts` is unchanged unless OQ2 resolves to native Google Sign-In.

---

## UX notes

- **Hardware/gesture back**: audit every stack — modals and bottom sheets must dismiss on back (not exit the app); the root Cats tab backs out to home screen per platform convention; predictive-back (Android 14+) should not visually break sheet transitions. Expo Router handles the default cases; test the custom sheets.
- **Sign-in screen**: Google button first and full-width on Android; Apple button hidden (not disabled) — with a small "Signed up with Apple on iPhone?" affordance if OQ3 resolves to supporting it.
- **Material expectations, Lamplight skin**: we intentionally keep the hand-rolled component look (no component library, per repo rules) — but respect Android system behaviors: ripple on Pressables where iOS uses opacity, system font fallback (Roboto) for any iOS-only font in the Lamplight ramp, date/time pickers in their native Android dialog form.
- **Tablets**: the responsive layout system (`useResponsiveLayout`, `ResponsiveContainer`, `rv()` — docs/TDD/cross-platform.md) was built for iPad; verify breakpoints on common Android tablet DPs and in split-screen/freeform windows (Android multi-window can resize the app arbitrarily — layouts must reflow, not clip).
- **Edge-to-edge**: verify chart screens and the tab bar against gesture-nav insets and punch-hole cameras at 375dp-equivalents and up.
- Empty/error states, theming (dark/light/system), and copy: parity with iOS — no Android-specific redesign in this PRD.

---

## Security considerations

Per [docs/SECURITY.md](../SECURITY.md); the model extends cleanly but review these before ship:

1. **Token storage**: `expo-secure-store` on Android uses Keystore-backed EncryptedSharedPreferences — same API we already call; verify no fallback-to-plaintext path on the min SDK chosen. Bearer-token handling, rolling TTL, and the SEC-10 device-fingerprint header behave identically.
2. **No new attack surface**: no new routes (pending OQ2). If native Google Sign-In is chosen, its id-token verification route must mirror the Apple-native route's protections, including SEC-13-style replay prevention.
3. **FCM credentials**: the FCM v1 service-account JSON and Play service-account key are secrets — gitignored `keys/` or EAS-managed, never in source (Principle 7). Document both in the secrets table.
4. **Push payloads**: unchanged content (cat name + med name) now transits FCM as well as APNs via Expo — same data class, no new PII; note it in the privacy policy's third-party list only if the policy enumerates push transports.
5. **App integrity**: Play App Signing holds the release key; the upload key lives in EAS. No certificate pinning (consistent with iOS decision). Backup rules: set `android:allowBackup` such that auto-backup excludes SecureStore data (Expo default is acceptable — verify, don't assume).
6. **Data safety form accuracy**: legally load-bearing; it must match actual collection exactly (mirror the iOS Nutrition Labels — no drift).

---

## Edge cases

- **iOS→Android switcher who signed up with Apple**: `oauth_provider='apple'` users have no Apple button on Android. Options: support Apple's web OAuth flow on Android, or a one-time account-link path. Without one of these, they cannot sign in on Android at all (OQ3 — must resolve before Phase B).
- **Hardware back on the auth WebView/Custom Tab**: cancelling mid-OAuth must return to the login screen cleanly, not a dead state.
- **Older Android**: min SDK decision (OQ1). Expo SDK default (~minSdk 24 / Android 7) covers ~99% of active devices; test low-RAM behavior — chart screens (Skia) on 2GB devices are the risk.
- **Android tablets & multi-window**: covered in UX notes; also affects Play listing (tablet screenshots required for tablet-optimized badge).
- **Notification behaviors**: OEM battery managers (Samsung, Xiaomi) can defer FCM — reminders may arrive late on aggressive-doze devices; document in a help/FAQ rather than pretending exactness. Channel deleted/muted by user → app should surface "reminders are off" state like iOS permission-denied does.
- **PWA-installed web app users**: installing the native app leaves the PWA shortcut behind; both keep working (same account) — add a "get the app" nudge on Android web like the iOS smart banner.
- **Expo push token rotation on Android**: tokens rotate more often than iOS; the existing stale-token cleanup in the cron handles delivery failures, and the 10-token per-user cap (SEC-14) prevents accumulation.
- **Play review flags**: health-adjacent apps occasionally get asked for medical-claims justification; the citations-first posture (`docs/research/`) is the answer — keep clinical claims out of the listing copy.

---

## Out of scope

- Android home-screen widgets (Glance) and Wear OS — follow-up after PRD-ios-widgets proves the widget concept.
- In-app purchases, monetization.
- Android-specific redesign or Material 3 component adoption.
- F-Droid or APK-direct distribution.
- Localization (unchanged from iOS decision — English-only).
- Retiring `frontend/` — unrelated to this PRD (tracked in PRD-ios-app-store Phase 7, still deferred).

---

## Open questions for product owner

1. **Minimum SDK**: accept Expo's default (~API 24 / Android 7, maximal reach) or raise to API 26+ (Android 8) for simpler notification-channel and background behavior? Recommendation: Expo default unless the audit finds a concrete blocker.
2. **Google sign-in flow on Android**: reuse the existing web OAuth redirect flow (`expo-auth-session` + `?mode=native` callback — zero Worker changes, consistent with today) or adopt native Google Sign-In / Credential Manager (one-tap UX, but a new Worker verification route and SDK dependency)? Recommendation: web flow for Phase A; revisit native one-tap only if install→sign-in conversion is poor.
3. **Apple-account continuity on Android**: support Sign in with Apple via Apple's web OAuth on Android (works, slightly clunky), build account linking, or accept that Apple-only users can't use Android for v1? This gates mixed-ecosystem households and must be decided before Phase B.
4. **Package name**: confirm `me.o1j.whisker` (current app.json value; `me.01j.whisker` is invalid on Android since a segment can't start with a digit) — or choose something cleaner (e.g., `me.whiskerhealth.app`) **now**, because it is permanent once the first build is uploaded.
5. **Play account standing**: does our developer account fall under the 14-day/12+ tester closed-testing requirement for new personal accounts? This solely determines whether Phase B is ~2 weeks or ~5+ weeks after Phase A.

---

## Acceptance criteria

### Phase A
- [ ] iOS-only audit checklist completed and tracked in TODO.md; all findings fixed or explicitly waived.
- [ ] Android build signs in with Google, hides Apple sign-in, and reaches full feature parity (CRUD, check-in, charts, care schedule, sitter PDF share, vet export, household, CSV import, settings, account deletion) on physical devices.
- [ ] Push reminder round-trip works: Android token registered with `platform='android'`, cron fans out to mixed iOS+Android households, notification channel + small icon render correctly; worker test covers the `IN ('ios','android')` query.
- [ ] Adaptive icon and splash verified across launcher masks; edge-to-edge and hardware-back audits pass.
- [ ] `eas.json` android profiles added; `scripts/build-android.sh` (tests → deploys → local AAB) and `scripts/submit-play.sh` (upload → verify → log) work end-to-end.
- [ ] Play app record exists with completed data-safety form, content rating, and privacy policy link; internal-track build installable by testers.
- [ ] Submission auto-logged to `docs/app-store-submissions.md`; all 4 test suites pass; zero iOS or web regressions.

### Phase B
- [ ] Store listing complete (title, descriptions, feature graphic, phone + tablet Lamplight screenshots).
- [ ] Closed-testing requirement (if applicable) satisfied and documented.
- [ ] Staged rollout executed 20% → 50% → 100% with crash-free ≥ 99.5% at each gate.
- [ ] `docs/app-store-submissions.md` format spec extended with Play entry types and in use.
- [ ] Play Store badge on the web login page; review prompt active on Android.
