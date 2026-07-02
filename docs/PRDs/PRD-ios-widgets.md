# PRD: iOS Widgets & Siri Shortcuts

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-ios-app-store.md (Implemented — app live), PRD-medication-reminders.md / PRD-push-notifications.md (care schedule + dose data) |
| **Related** | [docs/TDD/cross-platform.md](../TDD/cross-platform.md), [docs/SECURITY.md](../SECURITY.md), `scripts/build-ios.sh` |

---

## Problem

The entire value of a care schedule is knowing **what's due next** — and today that requires unlocking the phone, finding Whisker Health, launching it, and navigating to the Care tab. Push notifications cover the moment a dose comes due, but not the ambient question ("did I already give the fluids?", "what's tonight look like?") that owners ask a dozen times a day.

Glanceability is the whole point. A home-screen widget answers "what's next for my cats" in zero taps; Siri Shortcuts answer "log it" with zero hands (mid-pill, holding the cat). This is also the single most-requested class of feature for care/medication apps and a meaningful retention surface — the widget keeps the app on page one of the home screen.

---

## Target users

- **Daily med-givers** (CKD/senior cat households) — multiple doses/day, glance at the widget between doses.
- **Multi-caretaker households** — "has anyone given the 6 PM dose?" answered from the lock/home screen.
- **Weight-watchers** — owners tracking a trend who want last weight visible without opening the app.
- **Hands-full loggers** — "Hey Siri, mark Mochi's fluids given" while literally holding the cat.

---

## User stories

1. "I glance at my home screen and see *Gabapentin — Mochi — due 6:00 PM* without opening anything."
2. "The medium widget shows today's full schedule for both cats, with checkmarks on what's done, plus each cat's last weight."
3. "When I give the dose, I tap the circle **on the widget** and it's logged." (iOS 17+)
4. "Hey Siri, log Peanut's weight — 9.2 pounds." / "Hey Siri, mark fluids given for Mochi."
5. "After I log a dose in the app, the widget updates within seconds, not hours."

---

## Scope (phased)

### Phase 0 — Investigation spike (MANDATORY first task — see Technical Risk)

Timeboxed (2–3 days) proof that a WidgetKit extension target coexists with our Expo-managed workflow and `eas build --local` pipeline. Exit artifact: a branch where a hello-world widget builds into the production IPA via `./scripts/build-ios.sh`, plus a written go/no-go note covering plugin choice, credential handling, and prebuild survivability. **No further phase starts until this passes.**

### Phase A — Read-only home-screen widgets

- **Small widget**: the single next-due care item across all cats — cat name, item name + dose, due time; "All done for today 🐾" empty state.
- **Medium widget**: today's care items (given ✓ / pending, grouped by time) for up to ~2 cats + last recorded weight per cat; overflow indicator ("+2 more").
- Data path: the app serializes a **widget snapshot** (JSON) into **App Group** shared storage (`group.me.01j.whisker`) — written on app foreground, after any dose/care/weight mutation, and by periodic background refresh (`expo-background-task` / BGAppRefreshTask hitting the existing API with the stored Bearer token). Each write calls `WidgetCenter.reloadAllTimelines()` via a small native module.
- The widget's Swift `TimelineProvider` renders **entirely from the snapshot** — it computes timeline entries at each dose's due time so state flips ("due" → "overdue") happen without a refresh. The widget itself performs **no network calls in Phase A**.
- Light/dark rendering per system appearance, Lamplight palette.
- Deep link: tapping the widget opens the relevant cat's Care tab (`whiskerhealth://` scheme already exists).

### Phase B — Interactive widgets (iOS 17+)

- "Mark given" button on each pending dose directly in the widget via `AppIntent` + `Button` (WidgetKit interactivity).
- The intent runs in the extension process, so it must call `POST` dose-administer on the Worker itself — requiring the Bearer token to be readable from a **shared Keychain access group** (see Security).
- Optimistic snapshot update + timeline reload on success; error state reverts and shows a subtle retry glyph.
- Attribution recorded (`administered_via = 'widget'`, sharing the additive column proposed in PRD-sitter-live-link).
- Gated at runtime to iOS 17+; older iOS gets Phase A widgets unchanged.

### Phase C — App Intents / Siri Shortcuts

- App Intents exposed to the Shortcuts app and Siri:
  - **"Mark <med> given for <cat>"** — parameterized on a Cat entity + care item; confirms verbally, writes via API, updates snapshot.
  - **"Log <cat>'s weight"** — Siri asks for the number; validated against existing weight rules (positive, ≤ 200) before submit.
  - **"What's due for <cat>?"** — read-only spoken/visual answer from the snapshot.
- Cat and care-item entities populated from the snapshot (`AppEntity` + queries), so Siri can disambiguate ("Which cat — Mochi or Peanut?").
- Donated intents / Shortcuts appear in Spotlight and the Shortcuts gallery.

---

## Technical risk — Expo + native extension target (read this before estimating)

Being honest: **this is the first feature that puts Swift code and a second Xcode target into an Expo-managed repo.** The complexity is real and front-loaded:

1. **Widgets cannot be written in React Native.** WidgetKit extensions are SwiftUI-only, run in a separate process, and are a separate Xcode target with their own bundle id (`me.01j.whisker.widgets`), entitlements, and provisioning profile.
2. **Expo CNG must generate that target on every prebuild.** The `ios/` directory is disposable in our workflow; hand-editing the Xcode project is not viable. The realistic options:
   - **`@bacons/apple-targets` config plugin** (community, Evan Bacon): declares the widget target from a `targets/widget/` folder (Swift + `expo-target.config.js`); prebuild regenerates it. Most-trodden path, but community-maintained — pin the version and expect friction on Expo SDK upgrades.
   - **Custom config plugin**: full control, significant upfront cost, we own the Xcode-project mutation code forever.
   - **Bare workflow / committed `ios/`**: rejected — it forfeits CNG and complicates every future SDK upgrade far more than a plugin does.
3. **EAS build implications** (`scripts/build-ios.sh --local` is our default): multi-target builds need credentials for *both* bundle ids and the App Group capability on both. EAS credentials can manage extension profiles, but this must be proven in the spike — locally *and* with `--cloud` as fallback. First failing build error messages in this area are notoriously opaque.
4. **Swift in the repo**: expect roughly 300–600 lines of SwiftUI/Swift for Phase A (timeline provider, entry views, snapshot decoding), more for B/C (AppIntents). This code is invisible to our Jest suites — it needs at minimum a compile gate in CI (the IPA build itself) and manual QA per release.
5. **Keychain sharing (Phase B/C)**: `expo-secure-store` writes to the app's default keychain access group; the extension can't read it without a shared access group entitlement on both targets and a migration for existing stored tokens. This is subtle and must be in the spike's scope for feasibility (even if implementation waits for Phase B).
6. **Upgrade tax**: every Expo SDK bump now also revalidates the targets plugin, the widget build, and Swift API deprecations. Budget it into all future upgrade estimates.

**Mitigation**: Phase 0 spike is mandatory and go/no-go. If `@bacons/apple-targets` proves unworkable, the fallback decision (custom plugin vs. shelve the PRD) goes back to the product owner before any further investment.

---

## Data model sketch (D1 — additive only)

**Phase A: no D1 changes.** The snapshot is derived client-side from data the app already fetches; it lives on-device in the App Group container.

**Phase B/C (attribution, additive):**

```sql
-- Shared with PRD-sitter-live-link if both land; apply once, idempotently.
ALTER TABLE medication_doses ADD COLUMN administered_via TEXT;
-- values: null (app), 'sitter_link', 'widget', 'siri'
```

No new tables. No schema shape changes to `measurements` or `medications`.

---

## API sketch

**Phase A: no new endpoints.** Background refresh reuses existing authenticated GETs (cats, care items, doses, latest weight) with the stored Bearer token; the app composes the snapshot.

**Optional Phase A optimization** (only if refresh cost matters in practice):

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/widget-snapshot` | One authenticated call returning the pre-composed snapshot (next-due, today's doses per cat, last weights). Behind `requireAuth`; add to `CatTrackerApi` in `shared/lib/apiTypes.ts` first, per convention. |

**Phase B/C**: reuse the existing dose-administer and measurement-create endpoints, passing `administered_via` / a `source` field. Both platforms' API clients gain the parameter via `shared/lib/apiTypes.ts`.

---

## UX notes

- **Snapshot staleness indicator**: if the snapshot is > 12h old (app not opened, background refresh starved), the widget shows a subtle "open app to refresh" footer rather than confidently-wrong data. Never render stale dose states as authoritative.
- **Empty states**: no cats → onboarding nudge; no care items → "No meds scheduled" + last weight only; all done → celebratory done state.
- **Families**: `systemSmall` and `systemMedium` in Phase A. Lock-screen (accessory) families and StandBy are follow-ups (see Out of scope).
- **Widget gallery previews** must use placeholder cats ("Whiskers, 9:00 AM — Amlodipine"), not real user data.
- **Interactive tap targets** (Phase B): one button per dose row, ≥ 44pt effective target, immediate visual state change (WidgetKit's optimistic rendering).
- **Siri phrasing** (Phase C): keep intent titles short and cat-name-parameterized; verbal confirmation before any write ("Mark fluids as given for Mochi — correct?").
- Respect Reduce Motion / Dynamic Type; SwiftUI text styles map to system type scaling.

---

## Security considerations

Per [docs/SECURITY.md](../SECURITY.md) — new auth-adjacent surface requires review before deploy.

1. **Snapshot at rest**: the App Group container holds cat names, med names/doses, and weights — health-adjacent but not credentials. Set `NSFileProtectionCompleteUntilFirstUserAuthentication` (default) at minimum. No session tokens ever go in the snapshot or App Group `UserDefaults`.
2. **Lock-screen exposure**: home-screen widgets render on the lock screen via widget stacks/Always-On displays on some devices. Mark med rows `privacySensitive()` so iOS redacts them when locked (Phase A includes this; it's cheap).
3. **Shared Keychain (Phase B/C)**: the Bearer token becomes readable by the widget extension via a keychain access group shared **only** between our two targets (same team id, explicit group). Scope: no broadening of token TTL or permissions; the extension uses the same 7-day rolling session. Document the access-group entitlement in SECURITY.md when implemented.
4. **Extension network calls (Phase B)**: HTTPS to the existing Worker only; same `requireAuth`; no new public routes. Failures fail closed (widget reverts to pending state).
5. **Siri (Phase C)**: writes require explicit confirmation; intents never read back data while the device is locked unless Face/Touch ID has unlocked (`authenticationPolicy` on the intent).
6. Secrets never in source — unchanged; no new secrets are introduced.

---

## Edge cases

- **User signs out**: app must clear the App Group snapshot and reload timelines, else the widget shows another (previous) account's cats on a shared device.
- **Multiple cats, small widget**: strictly the single next-due item across all cats; ties broken by soonest-created.
- **All care items PRN (`as_needed`)**: nothing is "due" — small widget falls back to last weight + "No scheduled meds".
- **Cat deceased/archived**: excluded from the snapshot on next write; a stale widget may show it until refresh (acceptable; staleness footer covers pathological cases).
- **Timezone change mid-day** (travel): due times in the snapshot are the schedule's local times; regenerate the snapshot on significant time change (`NSSystemTimeZoneDidChange` → app-side listener on next launch/foreground).
- **Background refresh starvation**: iOS budgets BGAppRefresh aggressively for rarely-opened apps — exactly our risk cohort. The staleness indicator is the safety net; do not promise real-time in marketing copy.
- **Interactive tap races** (Phase B): dose already given in-app before the widget tap lands → API returns already-given; widget re-syncs rather than erroring.
- **Widget on iPad**: renders fine (app is iPad-supported post-1.0.3 layout work); verify snapshot text scales in larger widget sizes.
- **iOS < 17 with Phase B shipped**: interactivity code paths compile-gated (`#available(iOS 17, *)`); older devices keep read-only widgets.

---

## Out of scope

- Lock-screen (accessory) widgets, StandBy, and Live Activities — follow-up PRD once home-screen widgets prove out.
- Apple Watch app / complications.
- Android widgets (Glance) — belongs to the Android track after PRD-android ships.
- Logging arbitrary measurement types via widget/Siri beyond weight + dose-given (v1 keeps the intent surface tiny).
- Widget configuration UI beyond cat selection (no per-widget theming).
- Real-time push-driven widget reloads (silent pushes to reload timelines are unreliable and budget-limited; revisit only if staleness proves painful).

---

## Open questions for product owner

1. **How much native Swift is the repo willing to absorb?** Phase A alone commits us to a Swift target, a community config plugin dependency, and permanent upgrade tax (see Technical Risk). Is that acceptable for a widget, or should this wait until there are 2–3 native-only features to amortize the cost?
2. **Minimum iOS version**: keep the current deployment target (~iOS 15.1, Expo default) and runtime-gate interactivity to 17+, or raise the app minimum to iOS 17 and ship Phase A+B together with one code path? (App Store analytics on active OS versions should decide this.)
3. **Phase C priority**: Siri Shortcuts are the smallest audience but the strongest "wow". Ship A → B → C strictly, or pull the read-only "What's due?" intent into Phase A since it needs no interactivity plumbing?
4. **Per-widget cat selection**: should the small widget be user-configurable to pin one cat (WidgetKit `IntentConfiguration`), or always "next due across all cats" for v1?

---

## Acceptance criteria

### Phase 0 (spike)
- [ ] Hello-world SwiftUI widget builds inside the production IPA via `./scripts/build-ios.sh` (local mode) with correct provisioning for both targets.
- [ ] App Group read/write proven between RN app and widget.
- [ ] Written go/no-go covering plugin choice, credentials, `--cloud` fallback, and prebuild-clean survivability.

### Phase A
- [ ] Small widget shows the true next-due item; medium shows today's schedule (✓/pending) + last weight per cat.
- [ ] Snapshot rewritten + timelines reloaded on app foreground and after any dose/care/weight mutation; background refresh path works on-device.
- [ ] Due→overdue state flips occur via timeline entries without network.
- [ ] Staleness footer appears when snapshot > 12h old; sign-out clears the snapshot.
- [ ] Widget deep-links to the correct cat's Care tab; light/dark correct; `privacySensitive()` applied.
- [ ] `./scripts/build-ios.sh` and TestFlight submission succeed with the extension target; no web or Android-web regressions (widget code is iOS-target-only).

### Phase B
- [ ] "Mark given" from the widget records the dose with `administered_via='widget'` within seconds; races with in-app logging resolve cleanly.
- [ ] Token access via shared keychain group works after fresh install and after app update (token migration verified).
- [ ] iOS 15/16 devices are unaffected.

### Phase C
- [ ] "Mark <med> given for <cat>" and "Log <cat>'s weight" work via Siri voice and the Shortcuts app, with confirmation before writes and correct multi-cat disambiguation.
- [ ] Weight values validated server-side as usual; refusals are spoken clearly.
