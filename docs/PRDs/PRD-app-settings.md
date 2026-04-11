# PRD: App Settings

**Status:** Partial (Phases A + B implemented; Phase C remaining)
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
- Language / locale settings

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

## Non-goals

- Custom color themes / accent colors
- High contrast mode (OS-level high contrast is handled separately by `prefers-contrast`)
- Per-device settings without a D1 sync (Phase C handles cross-device)
