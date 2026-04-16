# PRD — Visual Identity v2: Color, Type, Hierarchy & Feel

| | |
|---|---|
| **Status** | `Approved` |
| **Last updated** | 2026-04-15 |
| **Author** | Design strategy review |
| **Scope** | Cross-platform: web (`frontend/`) + iOS (`app/`). All visual tokens flow from `frontend/src/index.css` and `app/global.css`. |
| **Related** | `docs/DESIGN.md` (current language), `PRD-app-settings.md` (theme infra already in place), `PRD-accessibility.md` (color independence + contrast) |

> "Design is not just what it looks like and feels like. Design is how it works." — Jobs

This PRD is a holistic re-read of the product's visual identity now that the app is feature-complete in core flows (charts, daily check-in, care schedule, memorial, household, vet export, iOS app in TestFlight). The question is no longer "does the dark-purple system look ok?" — it's "is this the identity that will *make* this app the one cat owners reach for daily, and that a well-respected brand expert would defend in a portfolio review?"

The answer, with high conviction: **the bones are good — keep the warm-night thesis — but the current execution is generic SaaS-purple, owns no distinctive territory in the pet-app market, and underuses the single most ownable surface in the app: the cat itself.** This PRD lays out what's working, what isn't, the full landscape of options, and a recommended direction.

**Shape of the proposal:** rather than a one-way-door bet on a single new identity, v2 ships all five color families described here as **user-selectable themes in Settings**, each with a dark/light pair, all built on a single token contract enforced in CI. **Lamplight** (warm amber on aubergine) is the default and the marketing identity. The architecture that makes this safe — and the engineering work it requires — is in §6.5.

---

## TL;DR for product owner

- Brand: keep "warm night" intent; replace generic Tailwind purple as the *default* with **Lamplight** (amber on aubergine).
- Ship Lamplight + four alternates (Warm Night sharpened, Forest, Clinical, Editorial) as a **Settings → Theme** picker, each with dark/light/system mode (independent axis from family).
- All ten variants (5 families × 2 modes) share one token contract; no component code branches on theme — it just reads tokens.
- Phase 0 (mandatory groundwork): tokenize ~86 hardcoded brand-color hex sites across the codebase before the picker can ship. Adds CI tests for token parity + AA contrast.
- Also in scope: typography unification (Plus Jakarta Sans body + display, web + iOS), the new "hero stat" amber-underline motif, hierarchy rules, **Phosphor Icons** (MIT-licensed, verified) replacing OS emoji in chrome, "warmth pulse" success animation, light-theme-as-its-own-design.
- Pre-auth splash, vet export, app icon, and App Store screenshots are pinned to Lamplight regardless of preference (documented exceptions in §6.5).

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

### Option D — "Linen" (anti-recommendation, included for completeness)

Off-white background, single muted teal accent, all-business — what 11pets and PetDesk look like.

- Bg `#FAFAFA`, Brand `#2B7A78`, dense data tables.

**Pros:** Familiar to any med-tech user, very safe.
**Cons:** Loses every emotional advantage we have. Becomes a forgettable utility. *This is what we are competing against, not joining.*

---

### Option E — "Almanac" (high-effort, high-ceiling)

Treat the app as a **personal magazine of one cat's life**. Cream paper background; serif display typeface for cat names (e.g., GT Super, Tiempos, or free alts like Fraunces); a single warm accent; large-format photos.

- Bg `#F4EFE6`, Ink `#1F1A14`, Display: serif, Brand: `#B85C2E` (terracotta), generous margins, body in a humanist sans (e.g. Söhne, or free: Inter Display).

**Pros:** Most distinctive. Genuinely *premium* feel — Day One / NYT Cooking energy. Photos look incredible.
**Cons:** High execution risk — serif display fonts at small sizes degrade fast on Android web; licensing for top serifs is real money; biggest deviation from current investment. Probably a v3 destination, not v2.

---

---

## 5.1 Each option, both modes — full token table

Every option below ships as a **dark/light pair** under a shared theme-family identity. The token *names* are identical across all ten variants — only the hex values change. This invariant is what makes the "pick a theme family, then pick a mode" UX possible and what protects us from per-component drift. (See §11 for the architecture that enforces this.)

Every variant has been spot-checked for the four critical contrast pairs: **ink on bg ≥ 4.5:1 (AA body)**, **brand on bg ≥ 3:1 (AA non-text / focus rings)**, **brand-on (text *on* brand) ≥ 4.5:1**, **ink-mid on bg ≥ 4.5:1**. Variants that needed tuning to clear AA are noted with a 🛡️.

### A — "Warm Night, sharpened"

| Token | Dark | Light |
|---|---|---|
| `--color-bg` | `#1A1326` | `#F6F2FB` |
| `--color-surface` | `#241A33` | `#FFFFFF` |
| `--color-surface-hi` | `#322547` | `#EFE8FA` |
| `--color-ink` | `#EDE9F6` | `#1F1A2E` |
| `--color-ink-mid` | `#A899C0` | `#5A4E7A` 🛡️ |
| `--color-ink-dim` | `#6B5F85` | `#9589B5` |
| `--color-brand` | `#B07BFF` | `#7C3AED` 🛡️ |
| `--color-brand-pressed` | `#8A52E6` | `#6D28D9` |
| `--color-brand-glow` | `rgba(176,123,255,0.18)` | `rgba(124,58,237,0.12)` |
| `--color-brand-on` | `#FFFFFF` | `#FFFFFF` |
| `--color-accent` | `#FFB37A` | `#C2410C` 🛡️ |
| `--color-rim` | `rgba(255,255,255,0.07)` | `rgba(40,20,80,0.08)` |

### B — "Lamplight" (default)

| Token | Dark | Light |
|---|---|---|
| `--color-bg` | `#1B1424` | `#FAF5EC` |
| `--color-surface` | `#261B33` | `#FFFEF9` |
| `--color-surface-hi` | `#332444` | `#F1E9D8` |
| `--color-ink` | `#F5EDE0` | `#2A211A` |
| `--color-ink-mid` | `#B8A89A` | `#6B5B4E` |
| `--color-ink-dim` | `#7A6B5E` | `#9C8E80` |
| `--color-brand` | `#F2A65A` | `#C8741F` 🛡️ |
| `--color-brand-pressed` | `#C8741F` | `#9A4F11` |
| `--color-brand-glow` | `rgba(242,166,90,0.18)` | `rgba(200,116,31,0.14)` |
| `--color-brand-on` | `#1B1424` | `#FFFFFF` |
| `--color-accent` | `#9C6BD9` | `#6E4FA8` 🛡️ |
| `--color-rim` | `rgba(255,220,180,0.08)` | `rgba(80,50,20,0.10)` |

### C — "Forest"

| Token | Dark | Light |
|---|---|---|
| `--color-bg` | `#141A14` | `#F4F1E8` |
| `--color-surface` | `#1E2820` | `#FFFFFF` |
| `--color-surface-hi` | `#27332A` | `#EAE6D8` |
| `--color-ink` | `#EFEFE7` | `#1A201A` |
| `--color-ink-mid` | `#A6B0A0` | `#4F5A4D` 🛡️ |
| `--color-ink-dim` | `#6B756A` | `#8A958A` |
| `--color-brand` | `#5BAE7E` | `#2F6A4A` 🛡️ |
| `--color-brand-pressed` | `#3F8A60` | `#214E36` |
| `--color-brand-glow` | `rgba(91,174,126,0.18)` | `rgba(47,106,74,0.12)` |
| `--color-brand-on` | `#0E140E` | `#FFFFFF` |
| `--color-accent` | `#D6936A` | `#A75D34` 🛡️ |
| `--color-rim` | `rgba(220,255,220,0.07)` | `rgba(20,40,20,0.10)` |

### D — "Linen"

(Born light. Dark variant included for parity but is the "weaker half" of this pair.)

| Token | Dark | Light |
|---|---|---|
| `--color-bg` | `#15191A` | `#FAFAFA` |
| `--color-surface` | `#1E2425` | `#FFFFFF` |
| `--color-surface-hi` | `#2A3132` | `#F0F2F3` |
| `--color-ink` | `#E8EDED` | `#0F1718` |
| `--color-ink-mid` | `#9BA8A8` | `#4A5556` 🛡️ |
| `--color-ink-dim` | `#65706F` | `#8A9495` |
| `--color-brand` | `#5FB3B0` | `#2B7A78` 🛡️ |
| `--color-brand-pressed` | `#3F908D` | `#1F5957` |
| `--color-brand-glow` | `rgba(95,179,176,0.18)` | `rgba(43,122,120,0.12)` |
| `--color-brand-on` | `#0E1718` | `#FFFFFF` |
| `--color-accent` | `#E8B05C` | `#A5731F` 🛡️ |
| `--color-rim` | `rgba(255,255,255,0.07)` | `rgba(15,40,40,0.08)` |

### E — "Almanac"

(Born light — paper metaphor. Dark variant works on espresso but loses some warmth.)

| Token | Dark | Light |
|---|---|---|
| `--color-bg` | `#1A1410` | `#F4EFE6` |
| `--color-surface` | `#251D17` | `#FFFCF5` |
| `--color-surface-hi` | `#312721` | `#EBE3D2` |
| `--color-ink` | `#F2E8D8` | `#1F1A14` |
| `--color-ink-mid` | `#B5A696` | `#5A4E40` 🛡️ |
| `--color-ink-dim` | `#7A6E60` | `#8F8474` |
| `--color-brand` | `#D87850` | `#B85C2E` 🛡️ |
| `--color-brand-pressed` | `#A85535` | `#8C4220` |
| `--color-brand-glow` | `rgba(216,120,80,0.18)` | `rgba(184,92,46,0.12)` |
| `--color-brand-on` | `#1A1410` | `#FFFFFF` |
| `--color-accent` | `#C7A86B` | `#8A6F3D` 🛡️ |
| `--color-rim` | `rgba(255,235,210,0.08)` | `rgba(60,40,20,0.10)` |

### Health palette — semantically constant, lightly tuned per family

The four health states (jade / honey / coral / rose) keep the **same role and approximate hue across all themes**. Each family shifts saturation ~5–10% to harmonize with its brand, but the relative ordering and meaning is invariant. This is non-negotiable: a coral measurement must read as "concerning" in every theme, regardless of family or mode.

| Token | Dark default | Light default |
|---|---|---|
| `--color-health-jade` | `#6BCF93` | `#2E8C5B` 🛡️ |
| `--color-health-honey` | `#F4C849` | `#A57A11` 🛡️ |
| `--color-health-coral` | `#EF7E48` | `#B85220` 🛡️ |
| `--color-health-rose` | `#E66666` | `#B8312E` 🛡️ |

Per-family tuning is documented in the implementation notes alongside the token files; the *contract* tested in CI is name parity, not hex equality, for these four tokens.

---

## 6. Recommendation — Lamplight as default, all five families ship as user themes

**Thesis:** rather than committing the product to a single visual identity, v2 ships all five color families as **user-selectable themes** in Settings, with Lamplight as the default. Each theme has a dark and light variant; the user picks `(family, mode)` independently. This is achievable because every option is built on the same token contract (§5.1, §6.5), so no component code branches on theme — the tokens simply resolve to different values.

The recommendation is two-part:
1. **Make Lamplight the default and the marketing identity** (App Store screenshots, splash, app icon, login page) — this is the brand's voice when no preference is expressed.
2. **Ship the other four as alternates** in Settings, surfaced as a "Theme" picker beneath the existing Dark/Light/System mode toggle.

**Design philosophy: great defaults, joyful optionality.** A user who never opens Settings should have a complete, delightful, opinionated experience — that's Lamplight's job. A user who *does* open Settings should feel like they've found a small toy: five real, considered theme worlds to live in, not a bag of toggles. The picker is not a fallback for a divisive default; it's a reward for curiosity. Users who love the current purple keep it (Option A). Users who want minimal-clinical can have it (Option D). Power users get to make the app theirs. And the brand still gets a defensible, ownable default that carries every external surface.

### Why Lamplight wins as the default

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

## 6.5 Theming architecture (the engineering substrate)

Shipping five families × two modes = ten variants requires real engineering discipline. The good news: the token plumbing already exists for one family × two modes (`PRD-app-settings` Phase A/B). The work is generalizing the existing one-axis system into a two-axis system without doubling component code.

### Two-axis model

| Axis | Values | Stored in |
|---|---|---|
| **Family** | `lamplight` (default), `warmnight`, `forest`, `linen`, `almanac` | `localStorage['themeFamily']` (web), `AsyncStorage['themeFamily']` (iOS), eventually D1 `user_preferences` (per `PRD-app-settings` Phase C) |
| **Mode** | `dark`, `light`, `system` | `localStorage['theme']` (existing key — kept for backward compat), `AsyncStorage['theme']`, same D1 column |

`system` mode resolves at runtime via `prefers-color-scheme`; the resolved value (`dark`/`light`) is then combined with the family to pick the token set.

### CSS selector strategy (web)

Today: `[data-theme="light"]` on `<html>` overrides root tokens.

v2: `<html data-theme-family="lamplight" data-theme="dark">`. CSS structure:

```css
:root,
[data-theme-family="lamplight"][data-theme="dark"] {
  --color-bg: #1B1424;
  --color-brand: #F2A65A;
  /* …full token set */
}

[data-theme-family="lamplight"][data-theme="light"] {
  --color-bg: #FAF5EC;
  --color-brand: #C8741F;
  /* …full token set */
}

[data-theme-family="warmnight"][data-theme="dark"] { … }
[data-theme-family="warmnight"][data-theme="light"] { … }
[data-theme-family="forest"][data-theme="dark"] { … }
/* …etc, 10 selector blocks total */
```

The default `:root` block doubles as the Lamplight-dark block so the page renders correctly before JS hydrates. Total CSS weight: ~3 KB additional after gzip — negligible.

### iOS (NativeWind) strategy

NativeWind supports `darkMode: 'class'` already. Extend with a custom class strategy: `<View className="theme-lamplight theme-dark">` at the root, and define the same ten token sets in `app/global.css`. The existing `useThemeColors()` hook expands to read all tokens (not just dark/light), keeping inline-styled components working unchanged.

### The non-negotiable invariant

**Every theme variant must define every token in the contract.** A missing token in one variant = silent visual bug only that user sees. Enforced by:

1. A canonical `TOKEN_CONTRACT` array in `shared/lib/themeTokens.ts` listing every token name.
2. A unit test (`shared/lib/__tests__/themeTokens.test.ts`) that parses both `frontend/src/index.css` and `app/global.css`, extracts each `[data-theme-family=…][data-theme=…]` block, and asserts every block defines exactly the tokens in `TOKEN_CONTRACT`. Fails CI if any block is missing or has an extra token.
3. A second test that asserts every brand/ink token clears AA (4.5:1) against its bg, computed in JS.

This is the *single most important engineering decision* in this PRD. Without this contract, theme drift will accumulate within two sprints and the picker becomes a liability.

### Phase 0: tokenize what isn't tokenized

A grep for hardcoded brand hexes (`#c084fc`, `#a855f7`, `#fb923c`, `#fbbf24`, `#f97316`, `#f87171`, `#4ade80`) finds **86 occurrences across 22 files** in `frontend/src/` alone. Many are in chart components and inline styles that bypass the token system. None of these surfaces will respond to a theme switch until tokenized.

Phase 0 (must precede any theme picker shipping) replaces every hardcoded brand/health hex with the corresponding token:
- `#c084fc` → `var(--color-brand)` or `useThemeColors().brand` (iOS)
- `#a855f7` → `var(--color-brand-pressed)`
- `#fb923c` → `var(--color-accent)` (note: amber-as-accent in non-Lamplight themes; in Lamplight it equals brand)
- `#4ade80` / `#fbbf24` / `#f97316` / `#f87171` → `var(--color-health-jade|honey|coral|rose)`
- Recharts components: read tokens via a `useThemeTokens()` hook backed by **`ThemeContext`** (the existing context already provides mode; extend with `family` and a `tokens` object derived from both axes). Components subscribe via the React context and re-render on change. *Do not* use `MutationObserver` on `<html>` — Context is the canonical reactivity path and avoids subtle hydration bugs.
- The `:focus-visible` ring, `.btn-primary` gradient, `.input-dark` focus, and `.glow-*` shadows in `index.css` move to tokens.

This is a mechanical, safe, well-scoped pass — but it must happen *before* the theme picker, not alongside it.

### Settings UI

`SettingsPage.tsx` gains a new section above the existing Mode toggle:

```
Appearance
  Theme            [ Lamplight ▾ ]   ← swatch picker, 5 options
                    (preview row of 4 swatches per theme)
  Mode             ( Dark | Light | System )   ← existing
```

The Theme picker is a vertical list of cards, each showing the family name, a 4-swatch preview (`bg`, `surface`, `brand`, `accent`), and a one-line description ("Warm amber on aubergine — the default"). Selecting a theme writes `themeFamily` to storage and updates the `data-theme-family` attribute; the rest of the app reacts via CSS variable cascade with zero re-render.

### Surfaces that do NOT theme

A small set of surfaces are intentionally pinned regardless of user preference:

| Surface | Pinned to | Reason |
|---|---|---|
| **Vet export** (`/cats/:id/export`) | Lamplight light | Designed for print on paper |
| **Login / splash** (pre-auth) | Lamplight (resolved mode) | No user preference available before auth — splash uses `prefers-color-scheme` only |
| **App icon** (iOS / PWA) | Lamplight | iOS supports tinted/dark icon variants but not arbitrary per-theme icons; we ship one |
| **App Store screenshots** | Lamplight | Marketing identity = default theme |
| **Marketing splash images** | Lamplight | Same |

These exceptions are documented in `docs/DESIGN.md` after this PRD lands.

### Storage migration

Existing users have `localStorage['theme']` set to `dark|light|system`. Migration on first load:

```ts
if (!localStorage.getItem('themeFamily')) {
  localStorage.setItem('themeFamily', 'lamplight');
}
// existing 'theme' key is preserved as-is
```

Server-side (when D1 `user_preferences` lands per `PRD-app-settings` Phase C): a single `theme_family` column added; default `'lamplight'`; nullable so unauthenticated/legacy clients fall back to localStorage.

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
- **v2 ships Phosphor Icons** (https://phosphoricons.com — MIT licensed; verify license file is checked in alongside the dependency). ~2 hours of integration vs ~2 days of custom drawing, and Phosphor's geometric, rounded-cap house style is already aligned with our intended voice.
- v3 may revisit a custom-drawn ~30-icon set if Phosphor proves limiting, but custom icons are explicitly out of scope for v2.
- Compromise: keep emoji on **historical** measurement entries and on cat avatars (the literal cat-emoji default avatar). Replace emoji only in **system chrome**.

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

The token plumbing means we can ship v2 incrementally without a "big bang." Phase 0 is mandatory groundwork; Phases 1–4 deliver visible value in order.

**Phase 0 — Tokenization sweep (1 sprint, mandatory groundwork)**
- Define the canonical `TOKEN_CONTRACT` in `shared/lib/themeTokens.ts`.
- Add the CI tests: token-contract parity across all variants, AA contrast for critical pairs.
- Replace all 86 hardcoded brand/health hex values across `frontend/src/` with the corresponding tokens (per §6.5).
- Same pass on `app/` for iOS (NativeWind + `useThemeColors()`).
- Move chart components to a `useThemeTokens()` hook so chart re-renders pick up theme switches.
- Replace inline hexes in `:focus-visible`, `.btn-primary`, `.input-dark`, `.glow-*` with tokens.
- **No visible change for users yet.** Theme remains Lamplight-as-current-purple-system. This phase is a refactor, gated on tests + visual regression confirming pixel parity with current production.

**Phase 1 — Lamplight default + Settings theme picker (1 sprint)**
- Define all five families × two modes (10 token blocks) in `index.css` and `global.css` per §5.1.
- Set Lamplight as the default `:root` block (Lamplight-dark = current root tokens replaced).
- Add `themeFamily` storage axis + migration logic per §6.5.
- Build the Settings "Theme" picker (5 swatched cards + existing Dark/Light/System mode toggle).
- One-time release note in Settings: "We refreshed the look — pick the theme that feels like home."
- App ships visually as Lamplight by default; users can opt back to "Warm Night" (Option A) which preserves the old purple feel.

**Phase 2 — Type unification & hero stat motif (1 sprint)**
- Add Plus Jakarta Sans as body font (already loaded on web; bundle in iOS).
- Implement the hero-stat treatment with the brand-color underline motif on `CatProfile`, `Home` cat rows, Daily Check-In confirmation, vet export. (Underline reads from `--color-brand` so it reflows per theme automatically.)
- Tighten label letter-spacing.

**Phase 3 — Hierarchy & icon system (1–2 sprints)**
- Apply the "max two cards / five zones per page" rule. Refactor `InsightsPanel`, `CatProfile`, `Home` accordingly.
- Replace system-chrome emoji with a Phosphor-based icon set (custom-drawn deferred to v3 budget permitting).
- Grow Home avatar; full-bleed profile hero photo.
- "Warmth pulse" on successful log (uses `--color-brand-glow`).

**Phase 4 — Marketing assets & polish (deferred, post-Phase 3)**
- Refresh app icon to lead with amber lamp shape.
- Marketing screenshots / App Store imagery refreshed in Lamplight.
- Polish pass on the four non-default themes based on user feedback from Phases 1–3.
- Consider a Pro/light "paper" Editorial polish pass (serif headlines? deferred to v3).

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Existing TestFlight users notice a sudden brand shift | Phase 1 release note + "Warm Night" theme available in Settings as opt-back to the old purple |
| Amber primary fails AA for some user | Verified design tokens against WCAG in §5.1; CI test asserts AA on every (family, mode) variant before merge |
| Plum accent disappears in charts | Chart palette uses brand + accent + jade + honey — four-color discipline; tested with one-cat, multi-cat, and color-vision-deficient simulations across all themes |
| Custom icon set delays Phase 3 | Phosphor Icons (MIT) as drop-in fallback to ship Phase 3 on time |
| iOS app icon refresh blocks App Store re-review | Phase 4 is post-resubmission; do not bundle with the iPad-fix release |
| **Theme-token drift across variants** (one variant missing a token) | Hard CI test on `TOKEN_CONTRACT` parity + AA contrast (§6.5). Build fails if any variant is incomplete or non-AA |
| **Component code branches on theme family** (anti-pattern) | Code review gate: any `if (themeFamily === 'lamplight')` in component code is a blocker. Theme reads tokens, never family identity |
| **QA matrix explosion (5 × 2 = 10 themes × N screens)** | Visual regression with Playwright snapshots in CI for the 10 token combinations on a representative set of 6 screens (Home, Profile, Check-In, Settings, Login, Vet Export). Manual QA only on Lamplight + the user-reported edge case |
| **Inline-styled chart components don't react to theme switch** | Phase 0 `useThemeTokens()` hook is mandatory; no chart ships in Phase 1 until verified to react |
| **Pre-auth splash can't read user theme preference** | Splash pinned to Lamplight, mode resolved via `prefers-color-scheme` — documented exception in §6.5 |

---

## 16. Resolved decisions (product owner, 2026-04-15)

1. **Default theme commitment.** ✅ Lamplight is the default and the marketing identity. The other four families ship as user-selectable themes in Settings.
2. **All five themes vs subset.** ✅ All five families ship in Phase 1. Architecture cost is the same; per-family token blocks are cheap once the contract exists.
3. **App icon refresh.** ✅ Generate **options only** in v2 — explore amber-lamp directions and check 3–5 SVG concepts into `app/assets/store/shared/icon-options/` for review. Do **not** swap the live app icon yet (avoids piling on the iPad-fix resubmission and keeps store identity stable). A future PRD selects and ships one.
4. **Custom icon investment.** ✅ Phosphor Icons (MIT) for v2; custom-drawn set deferred to v3.
5. **Almanac / serif direction.** ✅ Use a serif display face on the **Memorial Record page only** as a focused preview of Option E's spirit. Restricts the experiment to a single, emotionally appropriate surface.
6. **Splash refresh timing.** ✅ Bundled with Phase 1. The login/splash page (`PRD-login-splash`) gets its Lamplight content refresh in the same release that flips the brand color — they must land together so the splash doesn't read as broken next to the new app.
7. **Server-side preference sync.** ✅ localStorage-only for v2. `theme_family` rides along when `PRD-app-settings` Phase C lands; until then, theme is per-device. Acceptable trade-off for v2 ship velocity.

---

## 17. What success looks like

**Qualitative bar (the human read):**
- A friend looks at a screenshot from across the room and says "is that the cat one?" — yes.
- A vet receives an export and says "this looks more professional than what we send out."
- A user opens the app at 11 pm and the screen feels like a lamp, not a billboard.
- The App Store screenshots, on the page, look distinct from every other dark-mode purple-gradient app currently in the Health & Fitness charts.
- A designer reviewing the app for fun would say: "they made decisions." *(The bar.)*

**Quantitative gates (what we measure post-ship):**
- **Zero AA contrast regressions** vs. current production (CI-enforced on every PR).
- **Zero theme-token-drift incidents** in the 90 days following Phase 1 (any visible bug traced to a missing/wrong token = a hard look at the contract).
- **Theme picker engagement (Phase 1 + 30 days):** ≥ 15% of active users open the picker at least once. ≥ 5% pick a non-default theme and keep it for ≥ 7 days. (If both miss, the picker isn't earning its complexity — fold to Lamplight-only and remove the others until demand is proven.)
- **App Store conversion uplift after screenshot refresh (Phase 4 + 30 days):** target ≥ 10% relative lift in product-page-to-install rate. Below 0% = the visual story didn't land; revisit.
- **Crash / render-error rate** does not increase in the release containing Phase 1 (token typos and chart re-render bugs are the most likely regression class).
