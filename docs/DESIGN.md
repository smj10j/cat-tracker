# Cat Tracker — Design Language

> "This is an app you open when your cat is curled up next to you. It should feel exactly like that moment."

---

## The Job To Be Done

The person using this app loves their cat. Deeply. They are logging a weight measurement at 7am before work, or checking if Gemini's recent weight drop is something to worry about, or just curious how much Luna has grown since they got her.

They are not managing a spreadsheet. They are caring for a family member.

The app's job is to make that act of caring feel:
- **Fast** — data entry should be frictionless, almost invisible
- **Trustworthy** — health data should be accurate, clear, and never alarmist
- **Warm** — the app should feel like it loves these cats too
- **Delightful** — small moments of joy that make logging feel like a ritual, not a chore

---

## The Feeling: "Lamplight" (v2 default)

> As of April 2026, the app's default brand identity is **Lamplight** — warm amber on deep aubergine. Users can choose from 5 theme families in Settings (Lamplight, Warm Night, Forest, Linen, Almanac), each with dark/light/system mode. See `PRD-visual-identity-v2.md` for the full design rationale and token tables.

Imagine you're sitting in a dim room. Your cat is asleep next to you. You open your phone to log their weight. That is the context for every design decision.

**Dark-first.** Not because dark mode is trendy, but because this app lives in intimate moments. A bright white screen would shatter that.

**Warm, not cold.** Our darks have aubergine undertones — like a room lit by a single warm lamp. The brand color is amber (#F2A65A dark / #C8741F light), not the previous cool purple. Never cold gray-black. Never clinical blue-black.

**Soft, not flat.** Cards float gently above the background. Text glows faintly. Charts breathe. Nothing is hard-edged or harsh.

**Precise, not sparse.** Generous whitespace, yes — but the space is intentional. Every element that's there earns its place. Density is never the goal, but neither is emptiness.

---

## Color System

### Token Architecture (v2)

All colors flow through CSS custom properties defined in `frontend/src/index.css` (web) and `app/global.css` (iOS). Each theme family × mode pair defines the full token contract (45 tokens). The canonical contract is in `shared/lib/themeTokens.ts` and is enforced by CI tests.

**5 theme families:** Lamplight (default), Warm Night, Forest, Linen, Almanac.
**2 modes per family:** Dark, Light (+ System which resolves at runtime).

### Lamplight Dark (default) — Key Tokens
| Token | Hex | Use |
|-------|-----|-----|
| `bg` | `#1B1424` | Page background — deep aubergine |
| `surface` | `#261B33` | Cards, panels — first elevation |
| `surface-hi` | `#332444` | Modals, bottom sheets — second elevation |
| `ink` | `#F5EDE0` | Primary text — warm cream |
| `ink-mid` | `#B8A89A` | Secondary text, labels |
| `ink-dim` | `#7A6B5E` | Placeholder, disabled |
| `brand` | `#F2A65A` | Primary brand — warm amber |
| `brand-pressed` | `#C8741F` | Pressed states, depth |
| `brand-glow` | `rgba(242,166,90,0.18)` | Focus rings, soft glows |
| `brand-on` | `#1B1424` | Text on brand surfaces |
| `accent` | `#9C6BD9` | Secondary accent — plum |
| `rim` | `rgba(255,220,180,0.08)` | Borders — warm-tinted glass edge |

> Full token tables for all 5 families × both modes are in `PRD-visual-identity-v2.md` §5.1.

### Health Status (softened)
| Status | Color | Hex | Notes |
|--------|-------|-----|-------|
| Stable | Jade | `#4ade80` | Reassuring, not aggressive |
| Watch | Honey | `#fbbf24` | Warm, not alarming |
| Concerning | Coral | `#f97316` | Informative, not panicked |
| Urgent | Rose | `#f87171` | Soft red — serious but never hostile |

### Rule: Never use pure white text. Never use #000 or #111 as a background.

---

## Typography

**Display + Body:** `Plus Jakarta Sans` — friendly, slightly rounded, warm. Used for everything: headings, cat names, body text, and key numbers (v2 unified the font stack). Fallback to system-ui.

**Memorial / Almanac preview:** `Fraunces` — a serif display face used on the Memorial Record page for cat names and dates. This is the single surface where Option E (Almanac) gets a preview.

**Numbers / Weights:** `font-variant-numeric: tabular-nums` — measurements always line up cleanly.

### Scale
- **Hero** (cat names, page titles): `28–32px`, `font-weight: 700`, Plus Jakarta Sans
- **Section** (card titles): `16–18px`, `font-weight: 600`
- **Body**: `14–15px`, `font-weight: 400`
- **Label / Caption**: `11–12px`, `font-weight: 500`, `letter-spacing: 0.04em`, uppercase for category labels
- **Stat** (weight values): `22–28px`, `font-weight: 700`, tabular numerals
- **Hero Stat** (motif): `36–56px`, `font-weight: 700`, tabular numerals, 1px brand-color underline beneath the numeric portion + smaller baseline-aligned unit. The "signature element" that appears on CatProfile, Home, Check-In, and vet export.

### Rule: Maximum 2 font weights on any single screen. Never bold everything.

---

## Spatial System

Base unit: `4px`. All spacing is multiples of 4.

- **XS**: 4px — tight internal padding
- **SM**: 8px — between related elements
- **MD**: 16px — card padding, standard gap
- **LG**: 24px — section separation
- **XL**: 32px — page-level breathing room
- **2XL**: 48px+ — hero sections

**Rule:** Cards have `20–24px` internal padding. Page content has `16–20px` horizontal margins. Bottom nav gets `24px` bottom safe-area padding.

---

## Component Patterns

### Cards
```
background: rgba(255, 255, 255, 0.04)
border: 1px solid rgba(255, 255, 255, 0.07)
border-radius: 20px
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.05)
```
Cards feel like frosted glass panels floating in a dark room. They have a whisper of a top highlight (the inset shadow) that gives them physicality.

### Buttons — Primary
Pill shape (`border-radius: 9999px`). Lavender background. Full-width on mobile for primary actions. Subtle gradient from `#c084fc` to `#a855f7`. Has a soft glow on focus.

### Buttons — Secondary / Ghost
Transparent background with `rim` border. Text in `ink-mid`. Hover state fills with `lavender-glow`.

### Inputs
Dark background (`surface-hi`), `rim` border. On focus: border becomes `lavender`, box-shadow is a soft lavender glow. No floating labels — clear, static labels above.

### Health Status Badges
Soft pill with matching background opacity (15%) and border. The dot before the label has a subtle CSS `box-shadow` glow matching the color. Never a harsh colored block.

### Charts
- Line: 2.5px stroke, gradient from `lavender` to `amber` along the x-axis
- Area fill: subtle gradient from lavender-glow to transparent
- Dots: Emoji SVG text nodes (`<text>` element) showing health status emoji on weight charts; plain colored circles on scale charts
- Y-axis: Zoomed to data range always — never starts at zero
- Gridlines: `rgba(255,255,255,0.04)` — barely visible

### Bottom Navigation
Fixed bottom bar, `surface` background with `backdrop-filter: blur(20px)`. 3 tabs: Home, Compare, Log. The Log tab is a lavender pill that floats above the bar slightly — tapping it opens the QuickAdd bottom sheet. Active tab icon and label in lavender; inactive in `ink-dim`.

---

## Motion & Animation

**Philosophy:** Motion should feel like something breathing, not bouncing. Every animation is either a reveal (bringing something into being) or a response (acknowledging an action).

### Entrance animations
Cards and list items enter with:
```css
animation: slideUpFade 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
/* translate-y: 12px → 0, opacity: 0 → 1 */
```
Stagger delay: `30ms` per item, max 5 items staggered (beyond that, no stagger — feels too slow).

### Micro-interactions
- **Button press**: `scale(0.97)` on active, springs back on release
- **Add measurement success**: Brief `scale(1.05)` on the measurement row that was just added, then settles
- **Health dot**: Subtle CSS `pulse` animation (scale 1 → 1.2 → 1, 3s loop) on `urgent` status only
- **Tab switch**: Content fades (150ms) rather than slides — prevents disorientation

### Loading
Skeleton screens only — never a spinner. Skeleton has a shimmer animation from left to right (`background-position` animation on a gradient).

### What we DON'T animate
- Page transitions (React Router doesn't support this well without a library — not worth the complexity)
- Hover effects that require precise mouse positioning on mobile
- Anything over 300ms — too slow
- Bouncy/spring physics that feel toy-like

---

## Tone of Voice

The app speaks in short, warm sentences. It knows these are cats, not patients.

**DO:**
- "Luna's doing great — weight is stable." ✓
- "Gemini has lost some weight recently. Might be worth a vet chat." ✓
- "No measurements yet. Add the first one!" ✓
- Use the cat's name whenever possible

**DON'T:**
- "WARNING: Clinically significant weight loss detected." ✗
- "Error: No data available for this entity." ✗
- Generic medical language ✗
- Passive voice ✗

---

## What We Will NOT Do

- ~~Light mode~~ — **Implemented.** Dark, Light, and System themes via Settings. CSS variables adapt all colors; dark remains the default.
- ❌ Carousels or horizontal scroll lists (disorienting, adds no value here)
- ❌ Modal dialogs that block the full screen (use bottom sheets instead)
- ❌ Color more than 2 distinct hues on a single card
- ❌ Emojis in body text (decorative only, as large isolated glyphs)
- ❌ More than one call-to-action per screen
- ❌ Data tables with more than 5 visible columns
- ❌ Harsh shadows (only soft, diffuse shadows with low opacity)
- ❌ Placeholder text that disappears (labels must always be visible)
- ❌ Red for anything other than "urgent" health status
- ❌ Gradient text (except on cat names in hero positions — sparingly)
- ❌ Loading spinners
- ❌ Toast notifications that auto-dismiss (the user might miss them — use inline success states)

---

## The Cat List (Home)

Each cat gets a card. The card shows:
- A large circular avatar (emoji or photo, `72px`)
- Cat name in display font
- Age + last measurement as subtitle
- A health status emoji (✅ stable, 👀 watch, ⚠️ concerning, 🚨 urgent)

Cards are arranged in a vertical list with `16px` gaps. They enter with staggered `slideUpFade`.

The list should feel like opening a scrapbook of your cats — each one with presence.

---

## The Cat Profile

The profile is the emotional heart of the app. It should feel like a dedicated page for someone you love.

- **Hero**: Cat name in large display font, avatar prominent, key stats (current weight, age) in glowing amber numerals
- **Health alert** (if any): Appears as a soft colored card with the cat's name in it — "Gemini has lost 8% of her weight recently." Personal and warm, not clinical
- **Chart**: Full-width, generous height (`280px`), the visual centerpiece of the page
- **Measurement tabs**: Weight / Food / Water / Behavior / All — simple pill tabs

---

## Implementation Priority

1. Design system foundation (colors, fonts, base CSS)
2. Bottom navigation
3. Home page redesign
4. Cat profile redesign
5. Chart visual improvements (gradient line, glow dots, dark grid)
6. Comparison chart redesign
7. Add/Edit cat form redesign
8. Import page redesign
9. Quick-add bottom sheet polish
10. Skeleton loading states
11. Entrance animations
