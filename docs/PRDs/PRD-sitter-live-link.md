# PRD: Sitter Live Share Link

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-07-02 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-care-extensions.md (Sitter View — Implemented), PRD-household-sharing.md (invite token pattern — Implemented) |
| **Related** | [docs/SECURITY.md](../SECURITY.md), [docs/API.md](../API.md) |

---

## Problem

The Sitter View shipped in PRD-care-extensions as a **static artifact**: the owner screenshots the web page or shares a PDF from the iOS app. That was the right v1, but it fails in two common ways:

1. **Schedules change mid-trip.** The vet adjusts a dose, a new med starts, a course ends. The sitter is now working from a stale PDF and there is no way to push an update short of re-generating and re-texting the file.
2. **The sitter can't see what's already been given.** With two caretakers (or an owner who gave the morning dose before leaving), a static page risks **missed doses or double doses** — the exact failure the care schedule exists to prevent.

A full household invite is the wrong tool for a sitter: it requires the sitter to create an account, grants access to all cats and history, and lingers after the trip. What's needed is a **tokenized, read-only, expiring URL** that renders the live sitter view — no login, no app install — with an optional opt-in for the sitter to check off doses.

---

## Target users

- **Cat owners traveling** who leave meds/fluids with a neighbor, friend, family member, or professional sitter.
- **Cat sitters** — often non-technical, on any phone, unwilling to install an app or create an account for a one-week job.
- **Multi-caretaker households mid-handoff** — owner gives the 9 AM dose at the airport; sitter takes over at 6 PM and needs to see that state.

---

## User stories

1. **Owner, night before a trip**: "I want to text my sitter one link that always shows Mochi's current schedule — so if the vet changes her dose on Tuesday, the sitter sees it Tuesday."
2. **Sitter, standing in the kitchen**: "Did the owner give the morning gabapentin before they left? I want to see today's doses and which are already done."
3. **Owner, opting in to check-off**: "Let my sitter tap 'given' when she does the fluids, so I can see from the beach that it happened — and so she can't accidentally double it tomorrow."
4. **Owner, trip over**: "The sitter job is done. Kill the link now, don't wait for expiry."
5. **Owner, two cats**: "The sitter is watching both cats — one link with both schedules, not two links."

---

## Scope

### Phase A — Live read-only link

- Owner generates a share link from the Care tab / Sitter View (web + iOS): select one or more cats, optional label ("June trip — Sarah"), expiry (default **14 days**, max 60).
- The link is `https://cat-tracker.pages.dev/sitter/<token>` — a public SPA route that renders the existing sitter-view layout **live from the API**, no login required.
- Content mirrors the existing sitter view per selected cat: photo, name, age, sex/neuter, scheduled items grouped by reminder time, as-needed items with triggers, care notes — **plus today's dose status** (given ✓ / pending / skipped), read-only.
- Owner can list active links and **revoke** any of them (Settings → or Care tab). Revocation is immediate.
- Token follows the household-invite pattern: random raw token in the URL, **only the SHA-256 hash stored** in D1 (`worker/src/routes/household.ts` → `generateToken()` + `hashToken()`).
- Entry points: "Share live link" button on the web Sitter View and the iOS Sitter screen (alongside the existing PDF share, which stays).

### Phase B — Sitter check-off (opt-in)

- Per-link toggle at creation (and editable after): **"Allow the sitter to mark doses given"** — default **off**.
- When enabled, the public page shows a "Mark given" button on each pending dose for **today and past-due** doses only (no pre-logging tomorrow).
- The dose is recorded with attribution: `administered_via = 'sitter_link'` plus the link id — the owner's Care tab and history show "given via sitter link".
- Owner sees check-offs live (existing dose queries pick them up; no polling infra needed beyond normal refresh).
- Skip and notes entry by the sitter are **not** in Phase B (see Out of scope).

---

## Data model sketch (D1 — additive only)

```sql
-- New table (idempotent, additive)
CREATE TABLE IF NOT EXISTS share_links (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  token_hash     TEXT NOT NULL UNIQUE,          -- SHA-256 hex of the raw token; raw token never stored
  created_by     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cat_ids        TEXT NOT NULL,                 -- JSON array of cat ids, e.g. '["ab12..","cd34.."]'
  label          TEXT,                          -- owner-facing name, e.g. "June trip — Sarah"
  allow_checkoff INTEGER NOT NULL DEFAULT 0,    -- Phase B toggle
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,                 -- default now + 14 days, max now + 60 days
  revoked_at     TEXT,                          -- null = active
  last_viewed_at TEXT,                          -- best-effort, for the owner's link list
  view_count     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_share_links_user ON share_links(created_by, revoked_at);

-- Phase B: dose attribution (additive columns; existing rows unaffected)
ALTER TABLE medication_doses ADD COLUMN administered_via TEXT;          -- null = owner/app; 'sitter_link'
ALTER TABLE medication_doses ADD COLUMN administered_share_link_id TEXT; -- FK-ish to share_links.id (soft)
```

Notes:
- `cat_ids` as JSON TEXT (not a join table) keeps this additive and simple; links are small and short-lived. Every read re-validates each cat id against the creator's current access (see Security).
- Cron: purge rows where `expires_at < datetime('now', '-30 days')` — keep a 30-day tail so "expired" and "revoked" states can render distinct messaging, then hard-delete.
- No changes to `cats`, `medications`, or the measurements schema.

---

## API sketch

### Owner-authenticated (behind `requireAuth`, existing session/Bearer)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/share-links` | Create. Body: `{ cat_ids, label?, expires_in_days?, allow_checkoff? }`. Returns `{ id, url }` — the **only** time the raw token is returned. |
| `GET` | `/api/share-links` | List caller's links: label, cat names, created/expires/revoked, view stats. Never returns tokens. |
| `PUT` | `/api/share-links/:id` | Update `label`, `allow_checkoff`, `expires_at` (within max). |
| `DELETE` | `/api/share-links/:id` | Revoke (sets `revoked_at`; row retained for messaging + audit). |

### Public (no auth — added to the explicit public-route allowlist)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sitter-link/:token` | Resolve token → sitter payload for all linked cats: cat header fields, scheduled items grouped by time, PRN items, care notes, today's + past-due dose statuses, and `{ allow_checkoff, expires_at }`. Uniform `404` for unknown / expired / revoked. |
| `POST` | `/api/sitter-link/:token/doses/:doseId/given` | **Phase B.** Marks the dose administered with `administered_via='sitter_link'`. Validates: link active, `allow_checkoff=1`, dose belongs to a med of a linked cat, dose not already given, `due_at` ≤ end of today (link creator's timezone). |

Frontend: new public SPA route `/sitter/:token` (web). iOS does **not** need a token-consuming screen — sitters use the web URL; the iOS app only gets the create/manage UI.

---

## UX notes

- **Create flow** (web + iOS): from Sitter View → "Share live link" → cat multi-select (defaults to the current cat), label, expiry, Phase B toggle → creates and immediately opens the share sheet (iOS) / copy-link + QR (web). Show the copy "Anyone with this link can view the care schedule until it expires."
- **Public page**: reuse the existing sitter-view layout and components — no app chrome, no nav, `surface` background, print-friendly. Add a slim status bar: "Live schedule · updates automatically · expires Jul 16". Today's doses render with ✓ / ◻ state.
- **Expired/revoked**: friendly full-page message — "This care link is no longer active. Ask the owner for a new one." Identical for both states from the sitter's perspective (see Security); the *owner's* link list distinguishes them.
- **Manage links**: a "Live links" section listing active links with cat names, label, expiry, last viewed, and a Revoke button; revoke asks for confirmation.
- **Phase B check-off**: tapping "Mark given" shows an inline confirm ("Mark Gabapentin 100mg as given now?"), then renders ✓ with "given 2:14 PM via this link". Owner-side history rows show a small "sitter" badge.
- Mobile-first at 375px; sitters are overwhelmingly on phones.

---

## Security considerations

This introduces the app's **first unauthenticated data endpoint**, so this section is normative. See [docs/SECURITY.md](../SECURITY.md) for the baseline model; a security review per its cadence checklist is required before deploy.

1. **Token entropy**: raw tokens are ≥ 128 bits from `crypto.getRandomValues` (recommend 32 random bytes → 64 hex chars), following the existing `generateToken()` in `worker/src/routes/household.ts`. The URL is the sole credential.
2. **Hashing at rest**: only the SHA-256 hex of the token is stored (`token_hash`, UNIQUE), matching `household_members.invite_token_hash`. A D1 leak does not expose usable links. Lookups are by hash — indexed equality, no timing side channel on token content.
3. **Enumeration resistance**: unknown, expired, and revoked tokens all return the same `404` body with the same latency profile. No "expired vs invalid" distinction to an unauthenticated caller. 128-bit space makes brute force infeasible regardless.
4. **Rate limiting (required, not optional)**: docs/SECURITY.md lists "no rate limiting" as an accepted risk *for authenticated routes*. That acceptance does not extend here. Reuse the SEC-12 `rate_limits` D1 pattern keyed by `cf-connecting-ip`: e.g., 120 reads/hour/IP on `GET /api/sitter-link/:token`, 30/hour/IP on the Phase B `POST`, and a stricter cap on 404 responses (e.g., 20 failed lookups/hour/IP → `429`).
5. **Data exposure is care-schedule only.** The payload must contain: cat name, photo URL, age/sex/neuter, care items, dose statuses, cat care notes. It must **not** contain: owner email or display name, household member info, other cats, measurement history, weight/health data, microchip id (deliberate narrowing vs. the authenticated sitter view — see Open Questions), or any internal user ids.
6. **Access re-validation on every read**: the payload is built by re-checking, per request, that each `cat_ids` entry is still readable by `created_by` (not deleted, not transferred out of their household). Cats that fail the check are silently omitted.
7. **Revocation**: `DELETE` sets `revoked_at`; the very next public request 404s. No caching of the payload (`Cache-Control: no-store`) so revocation and schedule edits are immediate.
8. **Phase B write safety**: the public `POST` can only flip `administered_at` on a dose that is (a) under a linked cat, (b) pending, (c) due today or earlier. It cannot create, edit, delete, or skip anything. Idempotent: double-tap returns the already-given state, not an error that leaks info.
9. **Audit**: log `share_link_created`, `share_link_revoked`, and `sitter_dose_given` (with link id, dose id, IP) to the existing `audit_log` (SEC-15 infra, 90-day retention).
10. **Caps**: max 10 active links per user (mirrors the device-token cap pattern); max expiry 60 days.
11. Parameterized statements, server-side validation at the boundary, secrets untouched — per existing principles.

---

## Edge cases

- **Cat deceased or archived mid-trip**: the public payload omits deceased cats (re-validation, #6 above). If *all* linked cats are omitted, render the expired-style message rather than an empty schedule. Owner's link list flags the link as "no active cats".
- **Med edited mid-trip**: the live view reflects it on next load — that's the feature. Phase B risk: schedule edits delete/regenerate future dose rows, so a sitter holding a stale page could POST a now-deleted `doseId` → return `404`, client refetches and re-renders. Never resurrect deleted doses.
- **Med deleted / deactivated mid-trip**: disappears from the view; pending check-offs against it 404 as above.
- **Multiple concurrent links**: fully supported (e.g., overlapping sitters). Each link is independent for revocation and attribution. The 10-active cap bounds abuse.
- **Link opened after expiry**: friendly expired page (no data). Expiry is checked server-side per request, not client-side.
- **Owner deletes their account**: `ON DELETE CASCADE` removes their share links; public route 404s.
- **Sitter's timezone ≠ owner's**: "today's doses" is computed in the creator's timezone (dose `due_at` values are already generated in the owner's local schedule); display times as stored, labeled clearly.
- **Link pasted into a chat app**: link-preview bots will hit the URL. `GET` is read-only and rate-limited; ensure the public page sends `noindex` robots meta and the API sets `no-store`. Accept that previews may show the cat's name/photo — same as sharing the PDF today.
- **Two sitters tap "Mark given" simultaneously** (Phase B): first write wins (`administered_at IS NULL` guard in the UPDATE); the second gets the already-given response.

---

## Out of scope

- Sitter accounts, passwords, or PIN-protected links (a second secret adds friction without meaningfully changing the threat model of a shared URL).
- Sitter-initiated skips, notes, photos, or measurement logging via the link.
- Push/email notifications to the owner on check-off (owner sees state in-app; notification is a follow-up).
- Editable schedules via the link — under no circumstances.
- Replacing the PDF share — it stays for offline/printed use.
- Household sharing changes — full-access collaboration remains the household feature.

---

## Open questions for product owner

1. **Multi-cat default**: when creating a link from a specific cat's Sitter View, should the cat picker default to *just that cat* (current proposal) or preselect *all* the owner's cats? Single-cat default is safer (least exposure); all-cats is fewer taps for the common "watch everything" case.
2. **Phase B undo**: does a sitter need per-dose undo ("Undo — marked by mistake"), and for how long (e.g., 15-minute window on doses *they* marked via the same link)? Without undo, mistakes require the owner to fix from the app.
3. **Microchip id**: the authenticated Sitter View shows it; this PRD excludes it from the public payload as a precaution. Keep excluded, or include it (it's genuinely useful if the cat escapes on the sitter's watch)?
4. **Default expiry**: 14 days proposed. Confirm default and the 60-day max.

---

## Acceptance criteria

### Phase A
- [ ] Owner can create a link (cats, label, expiry, default 14d) from web and iOS; raw token is shown exactly once and never retrievable again.
- [ ] `share_links` stores only the SHA-256 hash; migration is idempotent (`IF NOT EXISTS`) and applied local + remote.
- [ ] `/sitter/<token>` renders the live sitter layout for all linked cats with today's dose statuses, unauthenticated, mobile-first.
- [ ] Schedule edits by the owner appear on the sitter's next page load with no re-share.
- [ ] Unknown, expired, and revoked tokens return an identical 404 API response; the page shows the friendly inactive message.
- [ ] Revoke works immediately; owner link list shows label, cats, expiry, last-viewed.
- [ ] Public payload contains no owner PII, no other cats, no measurements, no microchip (pending OQ3).
- [ ] Rate limiting active on the public routes; failed-lookup throttle verified with a test.
- [ ] `share_link_created` / `share_link_revoked` appear in `audit_log`.
- [ ] Max 10 active links enforced with a clear error.
- [ ] Worker + frontend + app test suites cover: token hashing, expiry, revocation, cat re-validation, payload shape (no-PII assertion).

### Phase B
- [ ] `allow_checkoff` toggle at creation and on existing links; default off.
- [ ] Sitter can mark today's/past-due pending doses given; row records `administered_via='sitter_link'` + link id.
- [ ] Owner's Care tab and dose history show "given via sitter link" attribution.
- [ ] Double-submit and deleted-dose races handled per Edge cases; no dose can be created/edited/skipped via the link.
- [ ] `sitter_dose_given` audit events recorded.
