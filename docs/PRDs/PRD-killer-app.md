# PRD: Killer App Research & Roadmap

**Status:** For review — not yet approved for implementation
**Purpose:** Synthesize research into a prioritized roadmap for making Cat Tracker a genuinely indispensable tool

---

## Research Summary

Sources: pet health app landscape, shelter software features, feline veterinary literature, habit-formation research.

### What the best pet health apps do well
- **Daily check-in ritual** — a single prompt ("how is Luna today?") that logs multiple dimensions at once rather than discrete form submissions
- **Streak tracking** — users who log 7 days in a row are dramatically more likely to continue; the app should reward consistency
- **Vet-ready export** — the single most-requested feature; owners want a PDF or shareable link to show at appointments
- **Correlation surfacing** — "Luna's food intake dropped 3 days before her weight dropped" is more valuable than either data point alone
- **Multi-person households** — a partner or shelter staff member needs to log without disrupting the primary owner's view
- **Reminders that are personal** — "Time to weigh Gemini — it's been 12 days" beats a generic daily notification

### What makes shelters different from households
- High cat volume (20–200+ animals)
- Staff rotation means data must be self-documenting ("who logged this?")
- Intake/outcome dates matter (how long in care)
- Medical templates: common entry types (physical exam, vaccination, deworming) need one-tap recording
- Triage view: which animals need attention RIGHT NOW

### What early research says about cat health signals
- Weight loss is the most reliable early indicator of systemic disease, but owners rarely notice it until >10% is lost
- Litter box changes (especially straining) often precede visible symptoms by days
- Food intake changes are a leading indicator — often 1–3 days ahead of weight changes
- Behavioral changes (hiding, reduced play) are the earliest signals but hardest to quantify
- Monthly home weigh-ins + weekly behavioral check-ins is the clinical recommendation

---

## Proposed Features (Priority Ordered)

---

### P0: Vet Export / Visit Summary

**Problem:** The #1 use case for all this data is showing it to a vet. Currently, there's no way to share it.

**Proposal:**
- "Export for Vet" button on CatProfile
- Generates a 1-page PDF or printable HTML: cat info, weight trend chart, recent behavioral observations, health status summary
- Shareable URL option: `cat-tracker.pages.dev/share/{token}/{catId}` — read-only, time-limited

**Why P0:** Every measurement we collect has higher value if it can be acted on. Without export, we're a local diary.

---

### P1: Daily Check-In (Single-Screen Multi-Log)

**Problem:** Logging food, water, litter, and activity as separate QuickAdd taps means 4 interactions for a daily check-in. This is too many.

**Proposal:**
A "Daily Check-In" mode — one screen that shows all behavioral categories for a selected cat with preset selectors side-by-side. One submit logs all of them with the same timestamp.

```
[Gemini — Daily Check-in]
Food:    [None] [Some] [Most] [All]
Water:   [None] [Some] [Most] [All]
Litter:  [Not used] [Straining] [Loose] [Normal]
Activity:[Lethargic] [Low] [Normal] [Active]
[Log All]
```

Single tap per row → tap "Log All" → all 4 logged at once. This is the core loop that should happen daily.

---

### P2: Streak & Consistency Tracking

**Problem:** Without any habit reinforcement, users log sporadically. Sporadic data is less useful (gaps make trends unreliable).

**Proposal:**
- Track "check-in streak" per cat (consecutive days with at least one measurement)
- Show streak badge on cat card: "🔥 12 days"
- On the home screen: "Gemini hasn't been logged in 4 days" nudge card
- On CatProfile: a small calendar heatmap of logging activity (like GitHub contributions)

---

### P3: Weigh-In Reminders

**Problem:** Weight is the most medically valuable measurement but requires a scale, so owners do it less often. Without a cadence, gaps appear.

**Proposal:**
- Per-cat reminder interval setting (e.g., "every 7 days" or "every 2 weeks")
- Browser notification (or PWA push) when overdue
- Home screen badge: "Due for weigh-in: Gemini (9 days ago)"
- DB: add `reminder_interval_days` column to cats table

---

### P4: Correlation Insights

**Problem:** Users see individual data points but not the relationships between them.

**Proposal:**
A "Trends" section on CatProfile that surfaces:
- "Food intake has been below 'Most' for the past 4 days — weight has dropped 3% this week"
- "Litter box visits are down — last 3 days show 'Not used'"
- Simple rule-based triggers (not ML) using the data we already have

This closes the loop: log → see pattern → take action.

---

### P5: Household Sharing / Multi-User

**Problem:** Partners, family members, or shelter staff all need to log without creating accounts.

**Proposal (token-based, no auth):**
- Generate a household token on a Settings page
- Share via link: `cat-tracker.pages.dev?token=abc123`
- Token grants full read/write to all cats
- Token can be rotated (invalidates old link)
- Optional: show initials of who logged each measurement (store in a `logged_by` field; token holder sets their name on first visit)

---

### P6: Shelter Mode

**Problem:** The app is designed for single households but the UX is well-suited for small shelters (< 50 cats). The gap is: no way to distinguish between "my 3 cats" and "20 shelter cats that rotate."

**Proposal:**
- "Room" or "Group" concept: cats can be tagged to a room/group (e.g., "Quarantine Wing", "Adoption Floor")
- Home screen: filter/group by room
- Triage view: sorted by health status across entire facility, with last-logged timestamp
- Medical templates: one-tap logging for "vaccinated today", "dewormed", "vet exam"
- Intake/outcome dates on cat profile

This doesn't require a schema overhaul — rooms are just a tag on cats, medical events are just a new measurement type.

---

### P7: AI Health Narrative

**Problem:** Raw numbers and emoji dots are informative but not actionable for non-expert owners.

**Proposal:**
- Weekly summary pushed to the user: "Gemini had a good week — ate well 6/7 days, weight stable. Kylo's weight dropped 2% this week — watch this."
- Uses Claude API to generate the narrative from the structured data
- Careful framing: "This is not veterinary advice" always included

**Note:** Requires Anthropic API key integration. See PRD for Claude API usage.

---

### P8: Smart Scale Integration

**Problem:** Manual weigh-ins require picking up and holding the cat on a scale, reading the number, navigating to the app, and typing it in. This friction reduces frequency.

**Proposal:**
- Support QR-code-based "weigh station" mode: a QR code displayed near the scale opens the QuickAdd sheet pre-selected to the cat
- Future: Bluetooth scale integration (e.g., Petkit or Happy 8 pet scales) that auto-logs via Web Bluetooth API

---

## What Would Make This "Killer"

Combining **P1 (Daily Check-In)** + **P2 (Streaks)** + **P0 (Vet Export)** creates a virtuous loop:

1. You open the app daily because it's habit (streak)
2. Check-in takes 10 seconds (Daily Check-In screen)
3. When the vet asks "how has she been eating?" you have an answer backed by 60 days of data
4. The vet is impressed → you tell your friends

That story doesn't exist anywhere else for cat owners. Most apps are either too medical (designed for vets) or too casual (designed for sharing cute photos). This app can own the "owner who actually cares about their cat's health" persona.

---

## Appendix: Competitive Landscape

| App | Strengths | Weaknesses |
|-----|-----------|------------|
| Petfetti | Pretty UI, multi-pet | No behavioral tracking, no charts |
| PetNote+ | Good form variety | No trend analysis, confusing UX |
| Maven Pet | Wearable integration, real-time | Hardware required, expensive |
| DogCat App | Multi-type logging | Dog-focused, weak cat health context |
| Shelter software (ShelterBuddy, etc.) | Complete records | Designed for staff, not owners; expensive |

**Gap this app can own:** Lightweight, free, cat-focused, behaviorally-aware, with vet-quality data.
