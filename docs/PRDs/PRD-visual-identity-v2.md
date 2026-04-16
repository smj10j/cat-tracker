# PRD — Visual Identity v2: Color, Type, Hierarchy & Feel

| | |
|---|---|
| **Status** | `Draft` |
| **Last updated** | 2026-04-15 |
| **Author** | Design strategy review |
| **Scope** | Cross-platform: web (`frontend/`) + iOS (`app/`). All visual tokens flow from `frontend/src/index.css` and `app/global.css`. |
| **Related** | `docs/DESIGN.md` (current language), `PRD-app-settings.md` (theme infra already in place), `PRD-accessibility.md` (color independence + contrast) |

> "Design is not just what it looks like and feels like. Design is how it works." — Jobs

This PRD is a holistic re-read of the product's visual identity now that the app is feature-complete in core flows (charts, daily check-in, care schedule, memorial, household, vet export, iOS app in TestFlight). The question is no longer "does the dark-purple system look ok?" — it's "is this the identity that will *make* this app the one cat owners reach for daily, and that a well-respected brand expert would defend in a portfolio review?"

The answer, with high conviction: **the bones are good — keep the warm-night thesis — but the current execution is generic SaaS-purple, owns no distinctive territory in the pet-app market, and underuses the single most ownable surface in the app: the cat itself.** This PRD lays out what's working, what isn't, the full landscape of options, and a recommended direction.

---

## 1. The job to be done (re-stated)

A person opens this app:
- in the morning, half-awake, to log a weight before work
- at night, in a dim room, with the cat in their lap, to check a worrying trend
- under fluorescent vet-office lights, to share a chart
- after the cat has died, to read the memorial

This is an emotional product. It sits next to Apple Health, Day One, and the Notes app on the home screen — not next to enterprise dashboards. The visual identity must:

1. **Be calm.** Never alarm. Never feel clinical even when surfacing clinical information.
2. **Be warm.** Cats are family. The app should feel like family software, not enterprise software.
3. **Be precise.** Numbers, charts, and dates must be unambiguous and easy to read at a glance, half-awake.
4. **Be ownable.** A second's glance at a screenshot should tell a stranger "that's the cat one." Not generic Material/SaaS.
5. **Hold up under scrutiny.** A vet, a designer, or a journalist looking at it should think "someone made decisions here."

---

## 2. Honest audit of where we are today

### What's working

- **The "warm night" thesis** (`docs/DESIGN.md`) is genuinely good. Dark-first with purple undertones is a defensible point of view, not just a fashion choice. Most pet apps are aggressively bright/cheerful — we should not become that.
- **The token system is real.** `--color-bg`, `--color-card`, `--color-ink-*` etc. with a working light-theme override means a v2 is a token swap, not a rewrite. This is enormous leverage.
- **Plus Jakarta Sans on cat names + amber numerals** is the one piece of true visual signature the app has. Keep it.
- **Glass cards + soft shadows** read as modern and avoid the worst sin of dark UIs (flat slabs).
- **Health-status palette** (jade / honey / coral / rose) is well-considered: warm, non-alarming, semantically distinct.
- **Bottom nav with the floating Log pill** is a strong, recognizable shape.

### What isn't working

1. **Brand purple is generic.** `#c084fc` (Tailwind `purple-400`) and the `c084fc → a855f7` gradient are *the* default 2023–2025 SaaS gradient. Linear, Vercel, Raycast, dozens of AI dashboards, half of Product Hunt. We are wearing the same suit as everyone else.
2. **The brand color does no semantic work.** Purple appears on primary buttons, focus rings, the active tab, the chart line, the splash CTA — but it doesn't *mean* anything. It's just "the accent." A great brand color encodes meaning. Ours doesn't.
3. **The cat is not the hero.** Photos exist (`PRD-cat-photos`) but the layout still leads with chrome — header bars, card frames, status pills. On the cat profile, the photo is a hero element, but on Home it's a 72px circle inside a generic list row. The cat is the product; show it.
4. **Amber is underused.** `#fb923c` is described as the "warm accent" but appears almost only on cat names and a few health states. If amber is the warmth, it should be the warmth — not a guest star.
5. **Light theme is a port, not a design.** It exists (good) but reads as the dark theme with the brightness inverted. There's no light-mode equivalent of "warm night" — it should be "warm morning," with its own personality, not a clinical white-and-purple SaaS look.
6. **Typography is monoculture-system-stack.** Plus Jakarta Sans is used only as `.font-display`. Body text falls back to system stack, which on iOS = SF Pro and on web = whatever. The two platforms diverge in feel even though they share intent.
7. **Iconography is emojis.** ✅ 👀 ⚠️ 🚨 are warm and fast and accessible — and they will look different on every OS. Apple's emoji set looks cute; Windows/Android's looks corporate. We have no consistent icon system.
8. **Numbers don't sing.** Weight values are the most-looked-at thing in the app. They get `text-2xl`, tabular nums, and a color. They should get a *moment* — a custom numeric treatment that makes "9.4 lbs" feel like a piece of typography, not a label.
9. **No motif.** Great consumer apps have a *thing* — Day One has the page-curl, Headspace has the breathing circle, Things has the satisfying check, Strava has the orange burst. We have none. There's no shape or gesture you'd recognize across screens.
10. **Information density is uneven.** The Insights panel can render 5+ stacked colored cards on a busy cat's profile, while the Home cat list is enormous and airy. Hierarchy is set per-screen, not per-system.

### The honest summary

We have *good taste* and an *unfinished identity*. The current design wouldn't embarrass us, but it also wouldn't be remembered. A reviewer would describe it as "clean dark mode pet tracker." That's the ceiling of where we are. We can do considerably better without a redesign — by sharpening, not replacing.

---

## 3. Market scan: what comparables look like, and what they teach us

### Pet-care apps

| App | Visual stance | What's good | What it teaches us |
|---|---|---|---|
| **11pets** | White/gray, cyan accent, photo-forward | Photos are massive on the cat profile | Photo size = perceived care |
| **Pet First Aid (Red Cross)** | Red-cross utilitarian | Function over feeling | This is *not* what we want — clinical-medical kills warmth |
| **Cat Cafe / Neko Atsume** | Cute illustrative, soft pastels, kawaii | Joyful, ownable | Too toyish for health data — but *the warmth they deliver* is what we're missing |
| **PetDesk / vet-practice apps** | Corporate teal/blue, photo-thumb, list-heavy | Functional reminders | Cold and forgettable — the trap to avoid |
| **Tractive / Fi (GPS collars)** | Bold green or blue, map-forward | Strong single brand color used everywhere | Brand-color discipline matters |
| **Whisker (litter robot app)** | Black + purple gradient, IoT-tech feel | Premium gloss | We literally share part of our name and our color — distinguishing from this matters |

### Adjacent: what the best consumer-health apps do

| App | Lesson |
|---|---|
| **Apple Health** | Multi-color category coding (heart=red, activity=orange, sleep=indigo). Color *means* something. Numbers are huge and beautiful. |
| **Oura** | Off-black background (warm gray, not pure black), single accent that shifts by state (sleep score color = score). Color *responds*. |
| **Whoop** | Strain/recovery palette is the entire brand — one color = one feeling. |
| **Strava** | The orange. That's it. One color, total commitment, instantly recognizable. |
| **Day One** | Cream/sand light theme that feels like paper. Warm without being saccharine. We should steal this energy for our light theme. |
| **Things 3** | Restraint. Almost no color. Hierarchy via type weight and whitespace. Looks expensive. |
| **Pillow / AutoSleep** | Dark navy with a single warm accent. Calm, nighttime-appropriate. Closest neighbor to our intended feel. |
| **Headspace / Calm** | Owned palette (Headspace orange, Calm midnight blue). Their color *is* the brand. |

### What the market is missing (our opening)

- No major cat-focused app owns "warm, calm, beautifully made." The category is split between **cute-toyish** (Neko Atsume vibe) and **clinical-corporate** (PetDesk vibe). There is a wide-open lane for a **"premium, warm, serious-but-loving"** identity — think Day One for cats, or Oura for cats. That is the lane we should sprint into.

---

## 4. Design principles for v2 (the constraints we will design within)

Before listing color options, the principles that any direction must satisfy:

1. **One brand color, used with discipline.** Not two co-equal accents. A primary brand hue that is unmistakable, and a single warm accent that means "the cat / a moment of joy."
2. **Color encodes meaning, not decoration.** The brand color is reserved for primary action, current state, and the brand's voice. Health colors stay semantic. Nothing is colorful "because it looked nice."
3. **Photo > chrome.** The cat's photo is the largest, most-saturated thing on the screen at all times. UI chrome is quieter than the content.
4. **Calm dark, warm light.** Both themes have a personality. Dark = "warm night" (kept). Light = "warm morning" — paper, sand, dawn — *not* white-with-purple.
5. **Type carries hierarchy, not boxes.** Reduce the number of bordered cards on a screen. Let scale, weight, and whitespace do the work.
6. **Numbers are typography.** Weight readouts get a custom numeric treatment (size, weight, optical alignment) that becomes a recognizable signature.
7. **One motif, used everywhere.** A repeating shape or gesture (the "soft pill," the "amber underline," the "ringed avatar") that appears across surfaces and becomes the app's silent signature.
8. **Accessible by default.** Every primary text/background pair ≥ 4.5:1 contrast. Color never the sole carrier of state (already a `PRD-accessibility` Phase C item — fold it in here).
9. **Cross-platform parity.** Web and iOS must feel like one product, not two. Same tokens, same type, same motion curves. (Today they share tokens but not type.)
10. **Boring is ok; generic is not.** A restrained, considered design beats a "creative" one. But same-as-everyone-else is the worst outcome of all.

---

## 5. Color direction — five options considered

Each option assumes the dark theme remains primary and a parallel warm-light theme is designed alongside. Each is named, characterized, weighed, and shown what it would *replace*.

### Option A — "Warm Night, sharpened" (incremental)

Keep the current dark-purple system but tighten it. Move from generic Tailwind purple to a custom hue with more red/warmth in it; commit to amber as a true co-brand; add a single signature gradient for hero numbers only.

**Palette (dark):**
- Background: `#1A1326` (current `#16111f` warmed half a stop)
- Surface: `#241A33`
- Brand: `#B07BFF` (custom — slightly redder and more saturated than `#c084fc`, less SaaS, more "nightshade")
- Brand-pressed: `#8A52E6`
- Warmth: `#FFB37A` (custom amber, slightly peachier than `#fb923c`, reads as "lamplight" not "Halloween")
- Hero gradient (numbers only): brand → warmth, ~30° angle

**Pros:** Lowest risk. Token swap, no layout changes. Preserves what's working. Done in a weekend.
**Cons:** Still in the "purple gradient" family the market is saturated with. Improves but doesn't differentiate.
**Best if:** We want to ship faster than re-think.

---

### Option B — "Lamplight" (recommended — see §6)

Reframe the brand around **amber as primary**, with a deep aubergine as the dark surface. The app's visual signature becomes "a lit lamp in a dark room" — exactly what the original DESIGN.md describes but never actually built. Purple recedes from "the brand" to "a deep, atmospheric background" — it stops being a button color and becomes a *room*.

**Palette (dark — "Lamplight Night"):**
- Background: `#1B1424` (deep aubergine, near-black, unmistakably warm)
- Surface: `#261B33`
- Surface-hi: `#332444`
- Rim: `rgba(255, 220, 180, 0.08)` (warm-tinted, not neutral white)
- Ink: `#F5EDE0` (warm cream — never bluish white)
- Ink-mid: `#B8A89A`
- Ink-dim: `#7A6B5E`
- **Brand (Amber Lamplight): `#F2A65A`** — warm orange-amber, used on primary action, brand mark, focus, active tab
- Brand-glow: `rgba(242,166,90,0.18)`
- Brand-deep: `#C8741F` (pressed/hover depth)
- Accent (Plum, used sparingly): `#9C6BD9` — for charts, subtle highlights
- Health: jade `#6BCF93`, honey `#F4C849`, coral `#EF7E48`, rose `#E66666` (slightly warmed, lower saturation than current — same semantics)

**Palette (light — "Lamplight Morning"):**
- Background: `#FAF5EC` (warm paper / cream — *not* white)
- Surface: `#FFFEF9` (a single shade lighter than bg)
- Ink: `#2A211A` (warm near-black)
- Ink-mid: `#6B5B4E`
- Brand: `#C8741F` (deeper amber for AA contrast on cream)
- Accent (Plum): `#6E4FA8`

This is the option this PRD recommends. Full reasoning in §6.

**Pros:**
- Owns a color (amber) no major pet app uses meaningfully. Strava owns orange in fitness; we'd own warm-amber in pet care.
- The metaphor is true: the app *is* a warm lamp in a dark room. The brand color finally matches the brand thesis.
- Amber on dark hits high contrast easily (AAA on this background).
- Light theme finally has a personality (warm cream, like a vet's intake form on good paper).
- Still distinguishable from the "Whisker / Litter Robot" purple gradient — solves the brand-collision problem.

**Cons:**
- Bigger lift than Option A. Requires touching every component that currently uses purple as the primary action color.
- Plum/purple has to demote itself gracefully — care needed in the chart palette so it doesn't disappear.
- The product mark / app icon will likely need updating to lead with amber, not purple.

---

### Option C — "Forest" (radical departure)

Lean into "natural / living thing" with a deep forest-green primary, warm clay accent, and earthy off-black background.

- Bg `#141A14`, Surface `#1E2820`, Brand `#5BAE7E` (sage), Accent `#D6936A` (terracotta)

**Pros:** Healthy / living connotations, very few apps in this space. Reads as nature-and-care.
**Cons:** Green is heavily owned by fitness (Whoop, Robinhood, Spotify). Loses the "warm intimate room" thesis. Doesn't fit a nighttime-companion app — green reads as daytime/outdoors. Recommend against.

---

### Option D — "Clinical" (anti-recommendation, included for completeness)

Off-white background, single muted teal accent, all-business — what 11pets and PetDesk look like.

- Bg `#FAFAFA`, Brand `#2B7A78`, dense data tables.

**Pros:** Familiar to any med-tech user, very safe.
**Cons:** Loses every emotional advantage we have. Becomes a forgettable utility. *This is what we are competing against, not joining.*

---

### Option E — "Editorial" (high-effort, high-ceiling)

Treat the app as a **personal magazine of one cat's life**. Cream paper background; serif display typeface for cat names (e.g., GT Super, Tiempos, or free alts like Fraunces); a single warm accent; large-format photos.

- Bg `#F4EFE6`, Ink `#1F1A14`, Display: serif, Brand: `#B85C2E` (terracotta), generous margins, body in a humanist sans (e.g. Söhne, or free: Inter Display).

**Pros:** Most distinctive. Genuinely *premium* feel — Day One / NYT Cooking energy. Photos look incredible.
**Cons:** High execution risk — serif display fonts at small sizes degrade fast on Android web; licensing for top serifs is real money; biggest deviation from current investment. Probably a v3 destination, not v2.

---

## 6. Recommendation — Option B ("Lamplight"), with phased adoption

### Why Lamplight wins on the merits

1. **It's the only option that makes the brand name match the brand mark.** The product is about quiet vigilance — watching a small life closely. A warm amber light on a dark background is *literally* that. The current cool-purple is decorative; amber is *thematic*.
2. **It opens an unowned lane.** No major pet app — and no major health/wellness app for cats — is built on warm amber. We'd be the "Strava of cat care" in color identity, where Strava = "everyone knows it from one block away."
3. **It improves accessibility.** Amber on deep aubergine clears WCAG AAA at body sizes; the current `#c084fc` on `#16111f` is borderline AA. Light theme on warm cream beats white-on-white-on-purple for older readers (a meaningful share of cat owners are over 55).
4. **It survives the photo test.** Cat photos are the most colorful thing on the screen. Amber UI sits next to photos of cats *much* more naturally than purple does — orange-tabby, calico, ginger, even the warm tones in tuxedo cats' eyes all live in the amber family. The UI starts to *belong* to the content.
5. **It's reachable from where we are.** Dark theme already trends warm. The token plumbing already exists. The only structural change is "primary brand color is no longer purple" — a roughly 30-file find-and-edit when scoped to `--color-brand-*` and `bg-brand-*` Tailwind classes.

### What we keep

- Plus Jakarta Sans for display & cat names. Add it as the **body** font too (one type family across the app — see §7).
- Tabular numerals for measurements.
- Glass cards, soft shadows, the 4px spatial grid, motion curves, bottom-nav silhouette with the floating Log pill (now amber, finally meaningful).
- Health-status palette semantics. We *re-tune* the hexes to harmonize with amber but keep jade/honey/coral/rose as the four categories.
- The "warm night" thesis from `DESIGN.md` — we're *delivering* it for the first time, not replacing it.

### What we change

| Surface | Today | v2 (Lamplight) |
|---|---|---|
| Primary CTA bg | `linear-gradient(135deg, #c084fc, #a855f7)` | `#F2A65A` solid (or amber→deep-amber gradient on hero only) |
| Focus ring | `#c084fc` | `#F2A65A` |
| Active bottom nav | Purple pill | Amber pill |
| Chart line | Purple→amber gradient | Amber line, plum dots — flips foreground/background of the existing gradient |
| Cat name in hero | Amber | Amber (kept — already correct) |
| Hero numbers | Tabular sans | Tabular sans + new "stat" treatment (see §8) |
| Background | `#16111f` (cool-violet near-black) | `#1B1424` (warm aubergine near-black) |
| Light theme | Lavender-on-white SaaS | Warm cream paper, deep amber accent |
| Borders | Cool white-alpha | Warm cream-alpha (`rgba(255,220,180,0.08)`) |

---

## 7. Typography v2

**Decision:** Adopt **Plus Jakarta Sans** as the single type family for both display *and* body, across web and iOS. This collapses the current "display font + system stack" split into one consistent voice.

- **Display / Cat names / Page titles**: Plus Jakarta Sans, 600/700, slight negative letter-spacing at large sizes (`-0.01em` at 24px+).
- **Body / UI**: Plus Jakarta Sans 400/500. Body sizes 14–15 px web, 15–16 px iOS.
- **Numerals**: Plus Jakarta Sans tabular nums for all measurements; consider OpenType `ss01` if available for circled/styled numerals on the hero stat.
- **Caption / Label**: 11–12 px, weight 500, `letter-spacing: 0.04em`, uppercase for category labels only (current 0.02em is too tight).

**Trade-off:** A second font request on the web (already loaded, so no cost) and bundling the font in the iOS app (~80 KB per weight). Worth it for cross-platform consistency. Still **2 weights max per screen** (current rule preserved).

**Rejected:** Adding a serif (Editorial Option E) — saved for a possible v3.

---

## 8. The "hero stat" treatment (the new motif)

Today the cat-profile hero shows the current weight in `text-2xl` amber tabular numerals. v2 promotes it to a **signature element**:

- Size 56–72 px on tablet/web, 44–52 px on phone.
- Weight 700.
- Optical kerning fix on the unit (`lbs`/`kg` gets 0.6× size, baseline-aligned, `ink-mid` color).
- A 1px amber underline spans only the numeric portion — like a chart's x-axis cropped to the value. This is the **motif**: an amber underline beneath the most important number on every screen (current weight on profile, count on Home, today's date on Check-In).
- Chart hover tooltips also use this treatment for consistency.

This is the "thing you'd recognize from a screenshot." It's small. It is the point.

---

## 9. Hierarchy, density, and flow

Beyond color and type, the audit (§2) flagged hierarchy as a real problem. v2 should adopt three system-level rules:

1. **Maximum two card-bordered surfaces per screen.** Today the Insights panel can stack five. Replace nested cards with type hierarchy and dividers (`var(--color-rim)` 1 px hairlines) where possible.
2. **The cat photo is the largest visual element on every screen it appears on.** Home cat row avatar grows from 72 → 88 px and becomes the visual anchor; the photo on the profile hero becomes a true full-bleed banner with a soft warm-gradient overlay (already half-built).
3. **Establish a "page rhythm":** every page = (a) hero zone (photo or title + stat), (b) one-line context strip, (c) primary content (chart, list, form), (d) optional secondary panel, (e) action zone (bottom nav). No page should have more than five vertical zones. Today CatProfile has eight on a busy cat. We compress.

---

## 10. Iconography

**Decision:** Replace OS-emoji icons (✅ 👀 ⚠️ 🚨, plus the various 🍗💧🐾 measurement emoji) with a **custom 24px line-icon set** in two weights (line / filled), drawn in a consistent geometric style with rounded caps. Health-state icons gain a subtle amber/jade/honey/coral tint applied as fill on the filled variant.

- Why: emoji renders inconsistently across iOS / Android web / Windows / Linux, and pulls visual weight we can't control. A custom set ensures consistency and gives the brand a recognizable voice in micro-UI.
- Cost: ~2 days for a designer to draw the ~30 icons we use. Phosphor Icons (open source, MIT) is a strong pre-built fallback if we want to ship faster.
- Compromise: keep emoji on **historical** measurement entries and on cat avatars (the literal cat-emoji default avatar). Replace it only in **system chrome**.

---

## 11. Motion

Current motion (`docs/DESIGN.md` §"Motion & Animation") is correct in spirit. v2 adds two small things:

- **The "warmth pulse"**: when a measurement is successfully logged, the hero stat does a single-frame amber glow (not a scale, not a shake — just a 400 ms glow rise-and-fall on `box-shadow`). This is a positive-reinforcement micro-moment specific to the act of logging — the only time the brand color *animates*. Becomes another piece of signature.
- **Reduce-motion respect**: all entrance animations gated on `prefers-reduced-motion: no-preference`. Already partially in place; make it system-wide. (Folds in an open `PRD-accessibility` item.)

---

## 12. Light theme as a first-class design

The single biggest underperforming surface today is the light theme. v2 designs it from scratch, not as a dark-theme inversion:

- **Background**: `#FAF5EC` (warm cream / paper).
- **Surface**: `#FFFEF9` (one step up — *barely* visible card edge, like pages laid on a desk).
- **Borders**: `rgba(50,30,15,0.08)` (warm shadow, not cool gray).
- **Brand**: `#C8741F` (deeper amber — needs to be darker than dark-mode amber to clear AA on cream).
- **Ink**: `#2A211A` (warm near-black, never `#000`).
- **Accent (Plum)**: `#6E4FA8` for chart lines and subtle highlights.

This makes the light theme feel like a moleskine notebook left open on the kitchen counter — warm, papery, unmistakably ours. It also makes vet exports look like they were printed on good paper, not faxed.

---

## 13. Accessibility commitments (folded in)

- Every primary text/background pair ≥ AA (4.5:1) at body sizes, ≥ AAA (7:1) at hero sizes. Verified with a contrast lint added to CI (small Vite plugin or simple test).
- `:focus-visible` ring stays — but in amber.
- Color is never the sole carrier of state: every health badge keeps the icon+text combination already specified in `PRD-accessibility` Phase C. Treated as a hard requirement for v2 ship.
- `prefers-reduced-motion` honored across all entrance, glow, and shimmer animations.
- Minimum touch target 44 × 44 pt across both platforms (already partial — finished here).

---

## 14. Phased rollout

The token plumbing means we can ship v2 in three deploys without a "big bang."

**Phase 1 — Tokens & color (1 sprint)**
- Update `index.css` (web) and `global.css` (iOS) tokens to Lamplight values.
- Replace gradient `btn-primary` with solid amber.
- Update focus ring, bottom-nav active state, chart primary line.
- Keep all layouts identical; this is a pure color swap.
- Visual regression check: walk every screen on dark + light, web + iOS.

**Phase 2 — Type unification & hero stat (1 sprint)**
- Add Plus Jakarta Sans as body font (already loaded on web; bundle in iOS).
- Implement the hero-stat treatment with amber underline motif on `CatProfile`, `Home` cat rows, Daily Check-In confirmation, vet export.
- Tighten label letter-spacing.

**Phase 3 — Hierarchy & icon system (1–2 sprints)**
- Apply the "max two cards / five zones per page" rule. Refactor `InsightsPanel`, `CatProfile`, `Home` accordingly.
- Replace system-chrome emoji with a custom or Phosphor-based icon set.
- Grow Home avatar; full-bleed profile hero photo.
- "Warmth pulse" on successful log.

**Phase 4 (optional, deferred) — Editorial light theme polish & app icon**
- Refresh app icon to lead with amber lamp shape.
- Marketing screenshots / App Store imagery refreshed.
- Consider a Pro/light "paper" mode polish pass (serif headlines? deferred to v3.).

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Existing TestFlight users notice a sudden brand shift | Ship Phase 1 alongside a one-time "We refreshed the look" Settings note; no functional changes |
| Amber primary fails AA for some user | Verified design tokens against WCAG before merge; light-theme amber is `#C8741F` not `#F2A65A` for this reason |
| Plum accent disappears in charts | Chart palette uses plum + amber + jade + honey — four-color discipline; tested with one-cat, multi-cat, and color-vision-deficient simulations |
| Custom icon set delays Phase 3 | Phosphor Icons (MIT) as drop-in fallback to ship Phase 3 on time |
| iOS app icon refresh blocks App Store re-review | Phase 4 is post-resubmission; do not bundle with the iPad-fix release |

---

## 16. Open questions for the product owner

1. **Brand color commitment.** Are we comfortable making amber the brand color and demoting purple to atmospheric/accent? This is the load-bearing decision in this PRD.
2. **App icon refresh.** Yes / no / later? If yes, this should follow the App Store re-review (don't pile on changes).
3. **Custom icon investment.** Custom drawn set vs Phosphor adoption. ~2 days vs ~2 hours.
4. **Editorial / serif direction.** Park Option E for v3, or explore a serif-headline experiment in a single surface (e.g. Memorial Record page) to test the waters?
5. **Marketing implication.** If we adopt Lamplight, the splash page (`PRD-login-splash`) needs a refresh. Treat that as part of Phase 1 or as its own follow-up?

---

## 17. What success looks like

- A friend looks at a screenshot from across the room and says "is that the cat one?" — yes.
- A vet receives an export and says "this looks more professional than what we send out."
- A user opens the app at 11 pm and the screen feels like a lamp, not a billboard.
- The App Store screenshots, on the page, look distinct from every other dark-mode purple-gradient app currently in the Health & Fitness charts.
- A designer reviewing the app for fun would say: "they made decisions."

That last one is the bar.
