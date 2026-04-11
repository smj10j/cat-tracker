# PRD: Health Alert Acknowledgment

> **Status:** Draft
> **Created:** 2026-04-11
> **Last updated:** 2026-04-11

---

## Problem Statement

When a cat's health status is "Urgent" or "Concerning," the home screen cat card and profile prominently display the alert with color-coded borders, badges, and status text. This is correct behavior — these are clinically significant signals.

However, once a user has **acknowledged** the alert (e.g., consulted a vet, adjusted the cat's diet, or determined it's a known/expected condition), the persistent visual urgency becomes noise. Users can't say "I know, I'm handling it" — the app keeps alarming them every time they open it.

This erodes trust in the alert system. Users who feel pestered by alerts they've already addressed start ignoring all alerts, including new ones.

---

## Goals

1. Allow users to acknowledge a health alert without dismissing or hiding the underlying data
2. Reduce visual urgency for acknowledged alerts while keeping the status visible
3. Preserve the full alert history so a vet export still shows the real health status
4. Automatically un-acknowledge if the condition worsens (e.g., watch → urgent)

## Non-Goals

- Muting alerts permanently (the acknowledgment should expire or reset)
- Per-measurement-type acknowledgment (too granular for v1)
- Notification suppression (push notifications are a separate system)

---

## Requirements (stub — to be fleshed out)

### R1: Acknowledge Action
- On the cat card (Home) or InsightsPanel (CatProfile), a small "Acknowledge" or "I'm on it" button appears for watch/concerning/urgent alerts
- Tapping it records the acknowledgment with a timestamp
- Optionally: a brief note field ("Vet visit scheduled for Thursday", "Switching food brands")

### R2: Acknowledged Visual State
- The cat card border returns to the neutral "ok" style (no urgent red/amber glow)
- A subtle indicator replaces the badge — perhaps a small muted pill: "⚠️ Acknowledged" in dim text
- The InsightsPanel on the profile still shows the full health status, but with a "You acknowledged this on [date]" note and reduced visual intensity
- The actual health status emoji/label is still visible — just not screaming

### R3: Auto-Reset
- If the health status **worsens** after acknowledgment (e.g., watch → concerning, or concerning → urgent), the acknowledgment is automatically cleared and the full alert returns
- If the health status **improves** (e.g., concerning → ok), the acknowledgment is moot and silently removed
- If the status stays the same, the acknowledgment persists indefinitely (the user said they're handling it)

### R4: Vet Export Transparency
- The vet export always shows the **real** health status, not the acknowledged-muted version
- If an alert was acknowledged, the export includes a note: "Owner acknowledged this status on [date]: [note]"

---

## Open Questions

1. **Storage:** Per-cat column (`acknowledged_status TEXT`, `acknowledged_at TEXT`, `acknowledged_note TEXT`) on the cats table? Or a separate `alert_acknowledgments` table for history?
2. **Scope:** Acknowledge the overall health status, or per-alert-type (weight rate, peak loss, etc.)? Overall is simpler for v1.
3. **Expiry:** Should acknowledgments expire after N days regardless? E.g., auto-reset after 30 days even if status hasn't changed, forcing a re-evaluation?
4. **Multi-user:** In a household, does one user's acknowledgment apply for all members? Probably yes — it's a statement about the cat's care, not a personal preference.
5. **Wording:** "Acknowledge" is clinical. "Got it" or "I'm on it" or "Noted" might feel more natural. Test copy options.

---

*Last updated: 2026-04-11*
