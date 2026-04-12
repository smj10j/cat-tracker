# PRD: Localization & Regional Preferences

**Status:** Implemented (Phase A1 + A2)
**Last updated:** 2026-04-11

---

## Problem

Cat Tracker hardcodes US conventions: 12-hour time, `lbs` weight, `MM/DD/YYYY` dates. There are 17 `toLocaleDateString` call sites in `frontend/src/` (13 `en-US` + 4 `en-CA` for internal date logic), 8 in `app/` (5 `en-US` + 3 `en-CA`), and ~21 hardcoded `lbs` display references across 11 frontend component files. Users in metric locales see unfamiliar formats with no way to change them.

As the app reaches international users via the iOS App Store, this friction becomes a barrier to adoption. Rather than bolt on one-off toggles, this PRD defines a preference framework that locale-sensitive features plug into.

---

## Principles

1. **Locale-first defaults** -- Detect the user's locale (`navigator.language` / `expo-localization`) and derive sensible defaults. A user in Berlin should see 24-hour time and kg without configuring anything.
2. **Explicit overrides** -- Every locale-derived default can be overridden in Settings. The user's explicit choice always wins over detection.
3. **Progressive adoption** -- Ship the framework and a few high-impact preferences first. New locale-sensitive features plug into the same system later.
4. **Shared across platforms** -- Preference keys, allowed values, derivation logic, and format helpers live in `shared/lib/` so web and iOS stay in sync.

---

## Scope

### In scope (Phase A -- framework + weight/date/time preferences)

| Preference | Key | Options | Default |
|------------|-----|---------|---------|
| **Weight unit** | `weightUnit` | `lbs` / `kg` | Derived from locale |
| **Date format** | `dateFormat` | `MDY` / `DMY` / `YMD` | Derived from locale |
| **Time format** | `timeFormat` | `12h` / `24h` | Derived from locale |

Weight unit is listed first because it is the highest-impact preference: it affects chart labels, health badges, measurement forms, the vet export, and the `healthMetrics` engine.

### In scope (Phase B -- additional preferences + chart integration)

| Preference | Key | Options | Default |
|------------|-----|---------|---------|
| **Week start** | `weekStart` | `sunday` / `monday` | Derived from locale |
| **Temperature unit** | `temperatureUnit` | `F` / `C` | Derived from locale |

Phase B also wires preferences into chart axis labels and the vet export.

### Out of scope

- **Language / translations** -- Full i18n (string translation) is a separate, much larger effort. This PRD covers formatting preferences only.
- **Currency** -- Not relevant to the app today.
- **Per-cat unit overrides** -- All cats share the user's preference. A vet who works in both lbs and kg across cats could be addressed later.
- **Number format** (`,` vs `.` decimal separator) -- Deferred. The `Intl.NumberFormat` API handles this transparently when we pass the user's locale, and it doesn't need a user-facing toggle.
- **Timezone** -- The app already uses the browser/device timezone implicitly. An explicit timezone picker is deferred until there's a concrete user need.

---

## Design

### Settings UI

Extend the existing `/settings` (SettingsPage) with a **Regional** section below Appearance:

```
<- Settings

Appearance
  [Dark] [Light] [System]

Regional                                    (Phase A1: date + time only)
  Date format        [MM/DD/YYYY]  [DD/MM/YYYY]  [YYYY-MM-DD]
  Time format        [12-hour]  [24-hour]

  Weight unit        [lbs]  [kg]           (added in Phase A2)

  Reset to locale defaults               <- text button, muted
```

Each control shows the current value. If a preference matches what locale detection would give, show a subtle "(auto)" label so the user knows it was derived, not manually set. When the user explicitly sets a value, the "(auto)" label disappears for that preference.

The "Reset to locale defaults" button clears all explicit overrides and re-derives from the detected locale. It should be disabled (hidden or grayed out) when no overrides are active.

### iOS app

Same preferences, same keys. Surface them in the native Settings screen (`app/app/settings.tsx`). On iOS, use `expo-localization` to detect the device locale for default derivation.

---

## Architecture

### Preference definition (shared)

**File:** `shared/lib/preferences.ts`

This is the single source of truth for preference keys, allowed values, locale derivation, and format helpers.

```typescript
// -- Types --

export type WeightUnit = 'lbs' | 'kg'
export type DateFormat = 'MDY' | 'DMY' | 'YMD'
export type TimeFormat = '12h' | '24h'
export type WeekStart = 'sunday' | 'monday'
export type TemperatureUnit = 'F' | 'C'

export interface UserPreferences {
  weightUnit: WeightUnit
  dateFormat: DateFormat
  timeFormat: TimeFormat
  weekStart: WeekStart        // Phase B
  temperatureUnit: TemperatureUnit  // Phase B
}

// -- Schema (for validation and extensibility) --

export interface PreferenceDef<T> {
  key: string
  options: readonly T[]
  deriveDefault: (locale: string) => T
}

export const PREFERENCE_DEFS = {
  weightUnit: {
    key: 'weightUnit',
    options: ['lbs', 'kg'] as const,
    deriveDefault: (locale: string): WeightUnit => {
      // US, Liberia, Myanmar officially use imperial.
      // Canada defaults to lbs because pet owners commonly use lbs for cat weight.
      const region = regionFromLocale(locale)
      return ['US', 'LR', 'MM', 'CA'].includes(region) ? 'lbs' : 'kg'
    },
  },
  dateFormat: { /* ... */ },
  timeFormat: { /* ... */ },
  // Adding a new preference: add one entry here + one field to UserPreferences
} as const satisfies Record<string, PreferenceDef<unknown>>

// -- Derivation --

export function deriveDefaults(locale: string): UserPreferences { /* ... */ }

// -- Format helpers (what components call) --

export function formatWeight(value: number, fromUnit: string, prefs: UserPreferences): string
// Converts if fromUnit !== prefs.weightUnit, then formats with unit label
// e.g. formatWeight(9.4, 'lbs', { weightUnit: 'kg' }) => "4.3 kg"

export function formatDate(iso: string, prefs: UserPreferences): string
// Short display date: "Mar 7, 2026" or "7 Mar 2026" or "2026-03-07"

export function formatDateShort(iso: string, prefs: UserPreferences): string
// Chart-friendly: "Mar 7" or "7 Mar" etc.

export function formatTime(iso: string, prefs: UserPreferences): string
// "3:45 PM" or "15:45"

export function formatDateTime(iso: string, prefs: UserPreferences): string
// Combined: "Mar 7, 2026 at 3:45 PM"

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number
// Pure conversion: lbs -> kg or kg -> lbs. Rounds to 2 decimal places.
// Identity if from === to.

// -- Internal helper --
function regionFromLocale(locale: string): string
// Extracts region subtag: "en-US" -> "US", "de" -> "DE" (via Intl fallback)
```

**Adding a new preference** requires exactly:
1. Add the type alias (e.g., `type TemperatureUnit = 'F' | 'C'`)
2. Add the field to `UserPreferences`
3. Add an entry to `PREFERENCE_DEFS` with `deriveDefault`
4. (Optional) Add a format helper if the preference affects display

No context provider changes, no storage changes -- the framework handles unknown keys gracefully.

### Weight unit conversion -- the hard part

Weight is the most complex preference because it's not just display formatting -- it requires value conversion. Key design decisions:

1. **Storage is unit-tagged.** Measurements are stored in D1 with their original unit (`unit` column = `'lbs'` or `'kg'`). This does not change. We never silently re-write stored data.

2. **Display converts on read.** The `formatWeight(value, fromUnit, prefs)` helper converts from the stored unit to the user's preferred unit. Every display site passes the measurement's `unit` field.

3. **Input uses the preferred unit.** MeasurementForm, QuickAdd, and DailyCheckin default the weight unit selector to `prefs.weightUnit`. The stored measurement records whatever unit the user submitted in.

4. **`healthMetrics.ts` stays unit-agnostic internally.** The engine already computes percentage changes, which are unit-independent. The `lbsChange` field name is misleading but the math is correct for any unit as long as all measurements in a sequence use the same unit. Phase A2 adds a normalization step: before computing health, convert all weights to lbs (the engine's fixed internal unit — see Migration section for rationale). Rename `lbsChange` to `absoluteChange` in `PeriodHealth`.

5. **Chart Y-axis labels** show the preferred unit. The `WeightChart` component converts data points for display.

### Storage

- **Web:** `localStorage` key `cat-tracker-prefs` -- JSON object containing only explicit overrides (not derived values). Example: `{"weightUnit":"kg"}` for a user who only changed weight. Empty object `{}` means all defaults.
- **Native:** `AsyncStorage` key `cat-tracker-prefs`, same shape.
- **D1 (Phase C, with PRD-app-settings):** Column `user_preferences` on the `users` table, type `TEXT` (JSON). The blob contains both theme and regional prefs in a flat structure:

```json
{
  "theme": "dark",
  "weightUnit": "kg",
  "dateFormat": "DMY",
  "timeFormat": "24h"
}
```

Only explicit overrides are stored (no derived values). This means the D1 column can be added now (Phase A) even if sync logic comes in Phase C -- the schema is stable.

**Migration:** `ALTER TABLE users ADD COLUMN user_preferences TEXT DEFAULT '{}'` -- idempotent with `ADD COLUMN IF NOT EXISTS`. No data migration needed; empty object means "all locale defaults."

### Context provider

**Files:** `frontend/src/contexts/PreferencesContext.tsx`, `app/contexts/PreferencesContext.tsx`

```typescript
interface PreferencesContextValue {
  prefs: UserPreferences          // fully resolved (explicit overrides merged over locale defaults)
  overrides: Partial<UserPreferences>  // only what the user explicitly set
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  resetToLocale: () => void
  isOverridden: (key: keyof UserPreferences) => boolean  // drives the "(auto)" indicator
}
```

On mount: read `cat-tracker-prefs` from localStorage, call `deriveDefaults(navigator.language)`, merge overrides on top. On change: persist overrides immediately, update state.

#### Relationship to ThemeContext

**Decision: Keep them separate.** Rationale:

- ThemeContext has a side effect (setting `data-theme` on `document.documentElement`) that fires on every theme change. Preferences have no DOM side effects.
- ThemeContext listens to `matchMedia('prefers-color-scheme')` changes. Preferences don't need media query listeners.
- Merging them would mean every theme change re-renders every component that reads any preference, and vice versa. Keeping them separate isolates re-render trees.
- Phase C D1 sync will store both in the same JSON blob, but that's a storage concern, not a React concern. The sync layer reads/writes the blob; each context owns its own keys.

#### Performance: re-renders when preferences change

Preferences change rarely (essentially never during normal use -- only on the Settings page). There is no performance concern with a single context holding all preferences. The entire app re-renders once when a preference changes, which is identical to what happens today when the theme changes. No memoization splitting or selector pattern is needed.

If a future phase adds a high-frequency preference (unlikely), we can split the context at that point. Do not pre-optimize.

### Fallback behavior

| Scenario | Behavior |
|----------|----------|
| `localStorage` unavailable (private browsing in some browsers) | Fall back to `deriveDefaults(navigator.language)` on every render. Preferences are not persisted but the app is fully functional. |
| `navigator.language` undefined (SSR, test environment) | `deriveDefaults` treats empty/undefined locale as `'en-US'` (the existing hardcoded behavior, so no regression). |
| Test environment | Export a `TestPreferencesProvider` that accepts a `prefs` prop for deterministic testing. Default to the US fallback so existing tests don't break. |
| Corrupt JSON in localStorage | Catch parse errors, fall back to `{}` (all defaults), log a warning. |

---

## Migration path for existing code

### Inventory of call sites

Determined by grepping the codebase (counts are current as of 2026-04-11):

| Pattern | Frontend | App | Total |
|---------|----------|-----|-------|
| `toLocaleDateString('en-US', ...)` | 13 | 5 | 18 |
| `toLocaleTimeString` / `toLocaleString` | ~4 | ~3 | ~7 |
| Hardcoded `lbs` in display strings | ~21 (across 11 files) | ~5 | ~26 |
| `toLocaleDateString('en-CA')` (internal YYYY-MM-DD) | 4 | 3 | 7 |
| `const unit = 'lbs'` in `healthMetrics.ts` `buildSummary()` | — (shared) | — | 1 |

**Important:** The `en-CA` calls produce `YYYY-MM-DD` strings for date comparison logic (grouping measurements by day, computing cutoff dates). These are NOT display formatting and MUST NOT be migrated. They should be left as-is or moved to a `toISODateString()` helper in `shared/lib/dates.ts` for clarity.

### Migration strategy

1. **Create shared helpers** (`shared/lib/preferences.ts`) with the format functions.
2. **Add `PreferencesContext`** to both platforms, wrapping the app root.
3. **Migrate call sites file by file.** Each file is independent. Replace:
   - `new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` with `formatDateShort(iso, prefs)`
   - `${value} lbs` with `formatWeight(value, unit, prefs)`
   - etc.
4. **Add an ESLint rule** (or a grep-based CI check) that flags `toLocaleDateString('en-US'` to prevent regression. Allowed pattern: `toLocaleDateString('en-CA')` for internal date strings.
5. **Risk:** Missing a call site means one spot still shows US formatting. This is cosmetically wrong but not a data bug. The CI check catches it going forward.

### `healthMetrics.ts` migration

This is the highest-risk migration because it affects health status computation.

**Current state (verified 2026-04-11):**
- `PeriodHealth.lbsChange` is referenced in `shared/lib/healthMetrics.ts` (7 occurrences) and `frontend/src/components/WeightChart.tsx` (1 occurrence: line 63 displays it). The app/ codebase does NOT reference `lbsChange` directly.
- `buildSummary()` in `healthMetrics.ts` has `const unit = 'lbs'` hardcoded on line 150 — this renders unit strings in the summary text and MUST be parameterized.
- `assessHealth()` receives `Measurement[]` but never inspects `measurement.unit`. It assumes all values are in the same unit. If a user submits a mix of lbs and kg, health computation will be silently wrong today (pre-existing bug, not introduced by this PRD).

**Migration steps:**

1. Rename `lbsChange` to `absoluteChange` in the `PeriodHealth` interface. Update the 2 consumer files: `healthMetrics.ts` itself and `WeightChart.tsx`.
2. Add a `displayUnit: WeightUnit` parameter to `assessHealth()`, which passes it through to `buildSummary()`. Remove the hardcoded `const unit = 'lbs'`. Inside `buildSummary()`, use `convertWeight()` to convert the internal lbs values to the display unit before embedding them in summary strings. This keeps the engine pure — it doesn't read React context or localStorage — while letting the summary text be locale-appropriate. Callers pass their preferred unit: `assessHealth(measurements, prefs.weightUnit)`. Example: if internal value is 0.8 lbs loss and display unit is kg, summary reads "Lost 0.4 kg."
3. The percentage-based thresholds (`changePercent`, `changePerWeek`, `peakLossPct`) are already unit-agnostic — they work identically in lbs or kg. No changes needed.
4. **Mixed-unit normalization:** Add a normalization step at the TOP of `assessHealth()`: scan the incoming `Measurement[]` and if any `unit` values differ, convert all to a single canonical unit (lbs internally, to minimize diff and preserve existing test expectations). This fixes the pre-existing mixed-unit bug and keeps the engine's internals stable. Display-side conversion to the user's preferred unit happens in `formatWeight()`, not inside healthMetrics.
5. **Why normalize to lbs internally, not the user's preference:** The health engine is a pure function — it should not depend on a UI preference. Normalizing to a fixed internal unit (lbs) means health computations are deterministic regardless of display settings. `formatWeight()` handles the user-facing conversion.
6. **`absoluteChange` is always in lbs (internal unit).** Since the engine normalizes to lbs internally, `PeriodHealth.absoluteChange` is always in lbs. Display consumers (e.g., `WeightChart.tsx` line 63, which currently shows `{Math.abs(period.lbsChange)} {unit}`) must convert for display: `formatWeight(Math.abs(period.absoluteChange), 'lbs', prefs)`. This is the one place where the engine's internal unit leaks to the UI — add a JSDoc comment on `absoluteChange` stating its unit is always lbs to prevent future confusion.
7. **Test coverage:** Add test cases with kg-only and mixed lbs+kg measurement sequences. Verify identical health status output for equivalent weights in different units.

Grep pattern to find all consumers of `lbsChange`: `grep -r "lbsChange" shared/ frontend/ app/`

---

## Implementation Phases

### Phase A1 -- Framework + date/time formatting

**Independently shippable.** After this phase, the preference framework exists and date/time display respects locale. Weight unit is deferred to A2 because it requires the healthMetrics migration.

1. Create `shared/lib/preferences.ts`: types, `PREFERENCE_DEFS`, `deriveDefaults()`, format helpers (`formatDate`, `formatDateShort`, `formatTime`, `formatDateTime`). Include `weightUnit` in the types and derivation, but format helpers for weight can be stubs that return the raw value + stored unit until A2.
2. Create `PreferencesContext` in `frontend/src/contexts/` and `app/contexts/`
3. Add "Regional" section to `SettingsPage.tsx` (web) and `app/app/settings.tsx` (native) — show date format and time format only. Do NOT render the weight unit row until A2 is ready. A visible control that does nothing erodes user trust and creates support questions.
4. Migrate all frontend date/time display call sites (~18 files) to use format helpers
5. Migrate all app date/time display call sites (~8 files) to use format helpers
6. Add `toISODateString()` to `shared/lib/dates.ts` to replace internal `en-CA` calls (optional cleanup, reduces confusion during migration)
7. Add CI check: script that greps for `toLocaleDateString('en-US'` in `frontend/src/` and `app/` -- fail if found (allowed: `en-CA` pattern)
8. Add D1 column: `ALTER TABLE users ADD COLUMN IF NOT EXISTS user_preferences TEXT DEFAULT '{}'` (schema only; sync logic is Phase C)

**Tests:**
- `shared/lib/preferences.test.ts`: `deriveDefaults()` for `en-US`, `en-GB`, `de-DE`, `ja-JP`, `en-CA`, `fr-FR`, empty string
- `shared/lib/preferences.test.ts`: `formatDate` output for each `DateFormat` value x multiple input dates
- `shared/lib/preferences.test.ts`: `formatTime` output for 12h vs 24h
- `frontend/src/__tests__/components/SettingsPage.test.tsx`: Regional section renders, toggling a preference persists it, "Reset" clears overrides
- Existing test suites pass without modification (TestPreferencesProvider defaults to US)

### Phase A2 -- Weight unit preference + healthMetrics migration

**Independently shippable.** After this phase, the weight unit preference is fully functional. Separated from A1 because the healthMetrics interface change is cross-cutting and higher risk.

1. Implement `formatWeight()` and `convertWeight()` in `shared/lib/preferences.ts`
2. Migrate `healthMetrics.ts`:
   - Rename `lbsChange` to `absoluteChange` in `PeriodHealth` (2 consumer files: `healthMetrics.ts`, `WeightChart.tsx`)
   - Add `displayUnit: WeightUnit` parameter to `assessHealth()` → `buildSummary()`. Convert internal lbs values to display unit in summary strings via `convertWeight()`
   - Add mixed-unit normalization at the top of `assessHealth()` — convert all to lbs internally
3. Migrate frontend weight display call sites (~11 files, ~21 occurrences): replace hardcoded `lbs` with `formatWeight(value, unit, prefs)`
4. Migrate app weight display call sites (~5 files)
5. Update MeasurementForm, QuickAdd, and DailyCheckin to default the weight unit selector to `prefs.weightUnit`
6. Enable the weight unit toggle in SettingsPage (remove any stub/disabled state from A1)

**Tests:**
- `shared/lib/preferences.test.ts`: `formatWeight` conversion accuracy (lbs->kg, kg->lbs, identity, edge cases like 0)
- `shared/lib/preferences.test.ts`: `convertWeight` round-trip: `lbs->kg->lbs` returns original within 0.01 tolerance
- `shared/lib/healthMetrics.test.ts`: Existing tests pass after `lbsChange` -> `absoluteChange` rename
- `shared/lib/healthMetrics.test.ts`: New test cases with kg-unit measurements produce correct health status
- `shared/lib/healthMetrics.test.ts`: Mixed-unit measurement sequences are normalized correctly
- `frontend/src/__tests__/components/WeightChart.test.tsx`: Verify `absoluteChange` (always lbs internally) is converted to user's preferred unit for display

### Phase B -- Additional preferences + deeper integration

**Independently shippable.** Adds week start and temperature, plus chart/export integration.

1. Add `weekStart` and `temperatureUnit` to `PREFERENCE_DEFS` and the Settings UI
2. Wire chart axis labels (`useChartWindow.ts`, `WeightChart.tsx`, `CorrelationChart.tsx`) to use format helpers
3. Vet export decision: always include ISO dates in parentheses alongside the user's preferred format; always show weight in both lbs and kg. This makes the export universally readable regardless of the vet's locale.
4. Chart axis density testing: verify label readability for all three date formats at each chart window (1W/1M/3M/6M/1Y)

**Tests:**
- Chart axis label tests with different preference values
- Vet export test verifying dual-unit weight display and ISO date presence

### Phase C -- D1 sync + native parity

**Ships with PRD-app-settings Phase C.** Preferences sync across devices.

1. Sync logic: on sign-in, fetch `user_preferences` from D1, merge with local overrides (server wins for conflicts, local wins for keys not present on server)
2. On preference change, write to D1 via new `PUT /api/user/preferences` endpoint
3. iOS app reads/writes same keys via Bearer-authed API
4. Offline: local overrides apply immediately; sync on next successful API call

---

## Locale Derivation Logic

Use `Intl` APIs where possible rather than maintaining lookup tables:

```typescript
function deriveDefaults(locale: string): UserPreferences {
  const safeLocale = locale || 'en-US'
  const region = regionFromLocale(safeLocale)

  return {
    weightUnit: ['US', 'LR', 'MM', 'CA'].includes(region) ? 'lbs' : 'kg',
    dateFormat: deriveDateFormat(safeLocale),
    timeFormat: deriveTimeFormat(safeLocale),
    weekStart: deriveWeekStart(safeLocale),       // Phase B (returns 'sunday' until then)
    temperatureUnit: deriveTemperatureUnit(region), // Phase B (returns 'F' until then)
  }
}

function deriveTimeFormat(locale: string): TimeFormat {
  // Use Intl to check if the locale natively uses 12-hour time
  const resolved = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions()
  return resolved.hourCycle === 'h12' || resolved.hourCycle === 'h11' ? '12h' : '24h'
}

function deriveDateFormat(locale: string): DateFormat {
  // Format a known date and inspect the output to determine field order
  const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2026, 0, 15))
  const order = parts.filter(p => ['month', 'day', 'year'].includes(p.type)).map(p => p.type)
  if (order[0] === 'year') return 'YMD'
  if (order[0] === 'day') return 'DMY'
  return 'MDY'
}
```

This avoids hardcoded locale tables and handles edge cases (e.g., `en-CA` correctly derives `YMD` via Intl).

**Weight unit is the exception.** The `Intl` API does not expose whether a locale prefers imperial or metric weight. Weight derivation must use a hardcoded region list: only US, Liberia, and Myanmar use lbs officially. Canada is a special case -- officially metric, but pet owners commonly weigh cats in lbs. We default `en-CA` to `lbs` because the pet health context favors the convention cat owners actually use, and they can override to kg.

**Reference table (for testing, not for implementation):**

| Locale | Time | Weight | Date | Week start |
|--------|------|--------|------|------------|
| `en-US` | 12h | lbs | MDY | Sunday |
| `en-GB` | 24h | kg | DMY | Monday |
| `en-AU` | 12h | kg | DMY | Monday |
| `de-DE` | 24h | kg | DMY | Monday |
| `ja-JP` | 24h | kg | YMD | Monday |
| `en-CA` | 12h | lbs | YMD | Sunday |
| `fr-FR` | 24h | kg | DMY | Monday |
| `(empty)` | 12h | lbs | MDY | Sunday |

---

## Success Criteria

### Phase A1

1. **Locale detection accuracy:** `deriveDefaults()` returns correct values for at least `en-US`, `en-GB`, `de-DE`, `ja-JP`, `en-CA`, `fr-FR`, and empty string (verified by unit tests -- 7 test cases minimum).
2. **Zero US-format date regression:** `grep -r "toLocaleDateString('en-US'" frontend/src/ app/` returns zero matches after migration.
3. **Immediate reactivity:** Changing date or time format in Settings updates all visible dates/times without a page reload (manual test on CatProfile and Home).
4. **Existing test suites unbroken:** `cd worker && npm test` and `cd frontend && npm test` pass with zero modifications to existing test files (the TestPreferencesProvider defaults to US).
5. **Framework extensibility verified:** Adding `weekStart` to `PREFERENCE_DEFS` requires no changes to `PreferencesContext` or storage logic (verified by code review during Phase B planning).

### Phase A2

6. **Weight conversion correctness:** `convertWeight(10, 'lbs', 'kg')` returns `4.54`; round-trip `lbs->kg->lbs` returns the original within 0.01 tolerance (unit tests).
7. **No health regression:** All existing `healthMetrics` tests pass after the `lbsChange` -> `absoluteChange` rename. New kg test cases pass.
8. **Mixed-unit normalization:** A measurement sequence with both lbs and kg entries produces the same health status as an equivalent all-lbs sequence (unit test).
9. **Weight display correctness:** On CatProfile, Home, and WeightChart, a user with `weightUnit: 'kg'` sees all weights converted from their stored unit (manual test with existing lbs data).

### Phase B

10. **Chart readability:** All three date formats produce non-overlapping axis labels at every chart window size (manual test at 375px width).
11. **Vet export universality:** Export includes both lbs and kg for weight values, and ISO dates alongside formatted dates (unit test).

### Phase C

12. **Cross-device sync:** A user who sets `kg` on web sees `kg` on iOS after sign-in (integration test).
13. **Offline resilience:** Preferences work without network; sync on reconnect (manual test).

---

## Decisions (formerly Open Questions)

1. **Vet export formatting:** Always show both units (e.g., "9.4 lbs / 4.3 kg") and include ISO dates alongside the user's preferred format. The vet export is a clinical document shared with a third party whose locale preferences are unknown. Dual-format eliminates ambiguity.

2. **Shared households:** Per-user preferences, not per-household. Two users in the same household with different unit preferences each see their own formatting. Measurements in D1 retain their original submitted unit. This is the simplest correct behavior and avoids a confusing "whose preference wins?" question. If a user sees a household member logged "4.3 kg" but their display shows lbs, the converted value displays correctly — the stored data is the source of truth.

3. **Mixed-unit historical data:** Acceptable and handled. If a user has historical lbs measurements and switches to kg, display converts on the fly via `formatWeight()`. New measurements store in whatever unit the user submitted. The health engine normalizes all measurements to a canonical internal unit (lbs) at computation time, so mixed-unit sequences produce correct health assessments. This is a pre-existing concern (a user could already manually type kg into a weight field with unit='kg') — the preference framework just makes it more likely to occur, and the normalization step fixes it properly.

---

## Accessibility

- Segmented controls in the Regional section must be keyboard-navigable (arrow keys) and announce the selected value to screen readers (`aria-pressed` or `role="radio"`).
- Date/time format changes do not affect screen reader behavior -- `datetime` attributes on `<time>` elements should use ISO format regardless of display preference.
- The "(auto)" indicator should be announced to screen readers (e.g., via `aria-label="Weight unit: kilograms (auto-detected)"` rather than relying on visual-only styling).

---

## Interaction with other PRDs

- **PRD-landscape-charts.md:** The full-screen chart overlay header shows the cat name and unit label (e.g., "Luna · lbs"). This must use the user's `weightUnit` preference, not a hardcoded string. The landscape PRD's `FullScreenReady` component should accept a `subtitle` prop that the parent computes via `formatWeight` or passes the preference unit label. No special coordination needed — as long as the landscape overlay reads from the same data the inline chart does, it gets the right unit.
- **PRD-app-settings.md (Phase C):** The D1 `user_preferences` JSON blob is shared between theme and regional preferences. The schema is defined here (flat keys, explicit overrides only). Both PRDs should ship their Phase C sync together to avoid two separate migration+endpoint efforts.
- **PRD-chart-time-navigation.md:** Chart axis date labels currently use `toLocaleDateString('en-US', ...)` in `useChartWindow.ts` (6 occurrences). These are migrated in Phase A1.

---

## Non-goals

- Full i18n / string translation
- RTL layout support
- Custom date format strings (pick from the three standard patterns)
- Per-cat unit preferences
- Number format toggle (handled by `Intl.NumberFormat` transparently)
