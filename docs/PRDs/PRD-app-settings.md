# PRD: App Settings

**Status:** Partial (Phases A + B implemented; Phase C remaining; Phase D in progress)
**Last updated:** 2026-04-11

---

## Problem

Cat Tracker has no user-configurable settings. As the app grows, preferences like display mode, notification preferences, and default units need a home. The most immediate request is a dark/light mode toggle — the app currently forces dark mode with no override.

---

## Scope

### In scope
- App settings screen accessible from the user profile / household menu
- Dark / light / system mode toggle
- Settings persistence (localStorage for display; D1 for sync-across-devices if auth is available)

### Out of scope
- Per-cat settings (those belong in the cat edit form)
- Notification delivery settings (belongs in PRD-medication-reminders.md Phase B)
- Language / locale settings (see PRD-localization-preferences.md)

---

## Design

### Where to put it

The natural entry point is the user profile popover on the Home page. Currently it shows:
- User name + email
- Household settings link
- Sign out

Proposed addition: **Settings** link between Household settings and Sign out. Route: `/settings`.

Alternatively, a gear icon in the Home header. The profile popover feels more appropriate — settings are per-user, not per-page.

### Dark / Light / System mode

**Three options:**
- **System** (default) — respects `prefers-color-scheme`
- **Dark** — always dark (current behavior)
- **Light** — light theme

The current design system is dark-only (hardcoded colors in `index.css`, Tailwind config, and inline styles throughout). A proper light theme requires a CSS variable layer.

**Proposed implementation:**
1. Define CSS custom properties (tokens) for all color values used in the design system
2. Apply them via a `data-theme` attribute on `<html>` or `<body>`
3. Light theme overrides the tokens in a `[data-theme="light"]` selector
4. System mode uses `@media (prefers-color-scheme: light)` within the same token block

**Tokens needed (initial set):**
```css
:root[data-theme="dark"], :root {
  --color-bg: #16111f;
  --color-surface: rgba(255,255,255,0.04);
  --color-ink: #ede9f6;
  --color-ink-mid: #8b7aaa;
  --color-ink-dim: #6b5f85;
  --color-border: rgba(255,255,255,0.07);
  --color-lavender: #c084fc;
  --color-amber: #fb923c;
  --color-rose: #f87171;
  --color-green: #4ade80;
}

:root[data-theme="light"] {
  --color-bg: #f8f7ff;
  --color-surface: rgba(0,0,0,0.03);
  --color-ink: #1a1030;
  --color-ink-mid: #4a3f6a;
  --color-ink-dim: #7a6fa0;
  --color-border: rgba(0,0,0,0.08);
  /* accent colors same — lavender/amber/rose work on light too */
}
```

**Complexity estimate:** Medium-high. The majority of the work is the CSS refactor — 862 modules currently use hardcoded `rgba(255,255,255,...)` and `rgba(0,0,0,...)` patterns. A full token migration would touch most component files.

**Phased approach:**
- **Phase A** — Settings screen, route, persistence, and the *toggle UI* only. No light theme yet (toggle shows "coming soon" for light).
- **Phase B** — CSS token layer for all surfaces and text colors; functional light theme.
- **Phase C** — System mode (automatic switching); sync preference to D1 for cross-device.

---

## Settings screen layout

```
← Settings

Display
  [Dark] [Light] [System]    ← segmented control

(future sections)
Measurements
  Default weight unit: [lbs] [kg]

Notifications
  → Notification preferences (link to future settings)
```

Minimal for Phase A — just the display section with the toggle.

---

## Persistence

- `localStorage` key: `cat-tracker-theme` (`'dark' | 'light' | 'system'`)
- Apply on app init (before first render) to avoid flash of wrong theme
- Phase C: sync to D1 `user_preferences` column (JSON blob)

---

## Implementation Order

### Phase A — Settings screen + toggle UI (no light theme yet)
1. Create `/settings` route + `SettingsPage.tsx`
2. Add "Settings" link to Home profile popover
3. Theme toggle control with localStorage persistence
4. Apply `data-theme` attribute on `<html>` — dark/system behave identically for now
5. Show "Light theme coming soon" for the light option

### Phase B — Light theme
6. CSS token layer (custom properties for all color values)
7. Migrate all hardcoded colors in `index.css` and component inline styles to tokens
8. Light theme token values
9. Verify all pages in light mode

### Phase C — System mode + sync
10. `prefers-color-scheme` media query respects system setting
11. D1 `user_preferences` column; sync on sign-in

---

## Success Criteria

- A user can navigate to Settings from the Home profile menu
- Selecting Dark / Light / System persists across page reloads
- Light theme makes all pages readable (no invisible text, no broken layouts)
- System mode automatically switches when OS appearance changes

---

---

## Phase D — Native (iOS) Theme Support

The iOS/Expo app (`app/`) currently only supports dark mode with hardcoded hex values. Phase D brings dark/light/system mode parity to native.

### Approach

- **NativeWind `darkMode: 'class'`** + CSS variables in `global.css` — Tailwind class-based colors (`bg-night`, `text-ink`) switch automatically
- **`useThemeColors()` hook** for inline styles — 17 files use hardcoded hex values that can't be reached by CSS vars
- **AsyncStorage persistence** — key `'whisker-theme'`, default `'dark'` (no visual change for existing users)
- **NativeWind's `useColorScheme()`** — provides `setColorScheme('dark' | 'light' | 'system')` at runtime

### Implementation steps

1. Install `@react-native-async-storage/async-storage`
2. Define CSS variables in `app/global.css` (`:root` = light, `.dark` = dark)
3. Update `app/tailwind.config.ts`: `darkMode: 'class'`, colors reference CSS vars
4. Create `app/lib/colors.ts` (palette objects), `app/hooks/useThemeColors.ts` (hook)
5. Create `app/contexts/ThemeContext.tsx` (AsyncStorage persistence + NativeWind bridge)
6. Update `app/app/_layout.tsx` with `ThemeProvider` + dynamic `StatusBar`
7. Add theme toggle UI to `app/app/settings.tsx`
8. Migrate 17 files with inline hardcoded hex to use `useThemeColors()`

---

## Non-goals

- Custom color themes / accent colors
- High contrast mode (OS-level high contrast is handled separately by `prefers-contrast`)
- Per-device settings without a D1 sync (Phase C handles cross-device)

---

## Remaining scope — detailed (2026-07-02)

### Phase C — D1 `user_preferences` sync across devices

**What/why:** All settings are device-local today — web localStorage (`cat-tracker-theme` mode, `cat-tracker-theme-family`, `cat-tracker-prefs` regional overrides in `frontend/src/contexts/{Theme,Preferences}Context.tsx`) and native AsyncStorage (`whisker-theme`, `themeFamily`, `cat-tracker-prefs` in `app/contexts/`). A user with iPhone + web reconfigures theme family and regional formats twice. Sync makes settings account-level. (This also unblocks PRD-visual-identity-v2's "localStorage-only until Phase C" note and PRD-localization-preferences Phase C.)

**Schema:** `ALTER TABLE users ADD COLUMN preferences TEXT;` — one JSON blob:
```json
{ "theme": { "mode": "dark|light|system", "family": "lamplight|..." },
  "regional": { "weightUnit": "...", "dateFormat": "...", "timeFormat": "..." },
  "updated_at": "2026-07-02T18:00:00Z" }
```
Only *explicit overrides* are stored for regional (matching the current `cat-tracker-prefs` overrides model) so locale-derived defaults keep working on new devices.

**API:** fold the blob into the `GET /api/auth/me` response (zero extra round-trips at startup) + a new `PUT /api/preferences` that replaces the blob. Add the method to `CatTrackerApi` in `shared/lib/apiTypes.ts` **first** so both clients get compile errors until implemented (`frontend/src/lib/api.ts`, `app/lib/api.ts`). Server-side validation: whitelist known keys/enum values, reject blobs > ~2 KB, never trust `updated_at` for auth purposes.

**Conflict resolution — last-write-wins, whole blob:** each client stamps `updated_at` when the user changes any setting. On sign-in / app foreground: fetch server blob; if `server.updated_at > local.updated_at` → apply server values to local storage; else if local has a dirty flag → PUT local. On every settings change: apply locally immediately, then debounced (~2 s) best-effort PUT. Whole-blob LWW is deliberate — per-key merging isn't worth it for a handful of settings; simultaneous edits on two devices are resolved by whichever saves last. (Decision surfaced: confirm LWW granularity.)

**Offline behavior:** local storage remains the render source of truth — the theme must keep applying synchronously before first paint exactly as today (no flash), with sync reconciling afterward. Failed PUTs set a `dirty` flag in local storage and retry on next start/foreground. Signed-out users keep working purely locally (theme works pre-auth).

**Migration from localStorage/AsyncStorage:** on first sign-in after deploy, if the server blob is empty and local values exist → upload local (existing users keep their settings on their primary device, and it propagates). Keep reading/writing the existing storage keys — they become the local cache of the synced blob; no key renames.

**Edge cases:** account deletion drops the blob with the users row; corrupted/unknown server blob → ignore, fall back to local, overwrite on next change; a device that was offline for weeks applies LWW like any other (its stale blob loses if the server is newer); `system` mode syncs the *preference*, not the resolved light/dark value.

**Acceptance:** change theme family on device A → device B reflects it after next launch/sign-in; regional override syncs the same way; offline changes persist and sync on reconnect; no theme flash on cold start (verified on both platforms); worker tests for PUT validation + `auth/me` inclusion; both API clients conform to the updated `CatTrackerApi`.
