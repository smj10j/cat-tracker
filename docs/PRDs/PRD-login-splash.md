# PRD: Marketing / Splash Login Page

**Status:** Implemented

## Problem

The current login page is a single centered card with a "Sign in with Google" button. It gives no context about what the app does, who it's for, or why someone should trust it with their cat's health data. First impressions are poor.

## Goal

Make the login page feel like the front door to something worth caring about — warm, purposeful, and clearly useful within seconds of landing.

## Core Ideas

### Above the fold
- App name + a short tagline ("Track what matters. Catch problems early.")
- A hero graphic or illustration — could be a simple SVG cat silhouette, or an abstract health chart rendered as a gentle arc in the brand purple/orange palette
- One bold sentence about the core value prop: "Know your cat's health trends before they become vet emergencies."

### Feature highlights (3 compact points, icon + text)
- 🐾 **Weight & behavior tracking** — Log in 10 seconds, see trends over time
- 📊 **Early warning system** — Pattern detection flags changes before they're obvious
- 🏥 **Vet-ready reports** — One tap to generate a printable health summary

### Sign in
- "Sign in with Google" button — same as now, but styled larger and more inviting
- Below: "Your data stays yours. We don't sell it or share it."

### Tone
Warm, not clinical. This is for cat owners who care deeply, not healthcare professionals. The copy should feel like it was written by someone who has a cat and has worried about them.

## Design Notes

- Keep the dark Warm Night theme — it's distinct and looks great on mobile
- Brand gradient (purple → orange) for the hero accent
- The layout on mobile should be top-to-bottom: hero → tagline → features → CTA
- On larger screens, a two-column layout (illustration left, CTA right) could work

## What This is NOT

- Not a landing page for a SaaS product — no pricing tiers, no "free trial"
- Not a bloated marketing page with testimonials and FAQs
- Just enough to make a first-time visitor go "oh, this is useful" before signing in

## Implementation Notes

- Route: `/login` — replace the current minimal page
- No backend changes needed
- The Google OAuth button behavior stays identical
- Can use inline SVG for the hero illustration — no image assets needed
- Keep the existing auth error handling (`?error=` param → toast)
