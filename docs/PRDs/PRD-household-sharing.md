# PRD: Household Sharing

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |

---

## Problem

Cat Tracker is single-user today. Households with multiple caretakers — partners, spouses, children, pet sitters — cannot share access to the same cats. If one person logs all measurements but is away, the other has no visibility. If a caretaker administers medication, the primary owner doesn't know. Every multi-person household is effectively blocked from using Cat Tracker collaboratively. This is the highest-friction limitation for households with more than one person involved in cat care.

---

## User Stories

1. **Spouse access**: "My husband and I both take care of our three cats. I set everything up, but he should be able to log measurements from his phone without me having to hand him mine."
2. **Read-only family member**: "My daughter likes to track the cats too, but I don't want her accidentally deleting anything. I want her to see everything but not change it."
3. **Pet sitter**: "Our cat sitter checks in twice a day. I want her to log food and litter observations, but I don't want her to be able to add or delete cats."
4. **Invite management**: "I can see who I've invited, whether they've accepted, and I can revoke access if the pet sitter stops working with us."
5. **Joint household**: "My partner and I should have equal admin access — either of us should be able to invite people or change permissions, not just whoever set the account up first."
6. **Multiple households**: "I help care for my parents' cats too. I should be able to see their cats and mine from the same app."

---

## Scope

### In scope
- Household entity: a named group that owns cats and has members
- Four roles: Viewer, Contributor, Editor, Admin (see permission matrix)
- A single owner per household (elevated Admin who cannot be removed)
- Email-based invitations (via Cloudflare Workers + MailChannels)
- Invite management: send, revoke, view pending, accept, decline
- Member management: view members, change roles, remove members
- Household settings page (name, members, invites) accessible from profile
- Migration: auto-create a personal household per existing user; move their cats into it
- Home screen aggregates cats across all households the user belongs to
- Multi-household cat card labeling (visible when user is in 2+ households)

### Out of scope (first version)
- Moving cats between households (Phase 2)
- Per-cat permissions (household-level only in v1)
- Shared medication reminder schedules between members (Phase 2 — linked to PRD-medication-reminders.md P5)
- Notification to other household members when a dose is marked given (Phase 2)
- Transferring household ownership (Phase 2)
- Deleting a household (Phase 2)
- Mobile push notifications for new household invites (Phase 2)
- SAML/SSO for shelter or clinic use (separate PRD)
- Household activity feed / audit log (Phase 2)

---

## Conceptual Model

### Household

A **household** is the top-level owner of cats. Every cat belongs to exactly one household. Every user who has ever used the app belongs to at least one household (their personal household, auto-created at signup or during migration).

```
Household
├── id
├── name         (e.g., "Johnson Family Cats")
├── owner_user_id
└── created_at
```

The **owner** is a special Admin who:
- Cannot be removed by other Admins
- Is the only one who can rename the household (Admin perk, but owner is final authority)
- Cannot have their role changed
- Is the person who created the household (or the person ownership was transferred to — Phase 2)

### Membership

```
HouseholdMember
├── id
├── household_id
├── user_id          -- null until the invite is accepted
├── role             -- 'viewer' | 'contributor' | 'editor' | 'admin'
├── status           -- 'pending' | 'active' | 'removed'
├── invited_by       -- user_id of the Admin who sent the invite
├── invite_email     -- email the invite was sent to
├── invite_token     -- stored hashed (SHA-256); plaintext sent in email link
├── invite_expires_at
├── invited_at
└── joined_at
```

---

## Permission Matrix

| Capability | Viewer | Contributor | Editor | Admin |
|------------|:------:|:-----------:|:------:|:-----:|
| View cats and all measurements | ✓ | ✓ | ✓ | ✓ |
| Add / edit measurements | | ✓ | ✓ | ✓ |
| Delete measurements | | ✓ | ✓ | ✓ |
| Add / edit cats | | | ✓ | ✓ |
| Delete cats | | | ✓ | ✓ |
| Mark medication doses given / skip | | ✓ | ✓ | ✓ |
| Export / vet summary | ✓ | ✓ | ✓ | ✓ |
| View household members | ✓ | ✓ | ✓ | ✓ |
| Invite new members | | | | ✓ |
| Revoke pending invites | | | | ✓ |
| Remove members | | | | ✓ |
| Change member roles | | | | ✓ |
| Rename household | | | | ✓ |
| Remove owner | | | | — (never) |
| Transfer ownership | | | | owner only |
| Delete household | | | | owner only |

**Role hierarchy**: Viewer < Contributor < Editor < Admin. An Admin cannot elevate another member to a role higher than Admin. An Admin cannot change the owner's role.

---

## Invite Flow (detailed)

### Sending an invite

1. Admin opens `/household`, fills in the invitee's email address and selects a role.
2. Client calls `POST /api/household/invites` with `{ email, role }`.
3. Worker:
   a. Verifies the requester is Admin of their household.
   b. Checks if the email already belongs to an active member (reject with `already_member`).
   c. Checks if a non-expired invite already exists for that email (reject with `invite_pending` — Admin can revoke and resend if needed).
   d. Generates a cryptographically random 32-byte token. Stores SHA-256 hash in DB; keeps raw token for the email link.
   e. Creates `household_members` row: `status='pending'`, `user_id=null`, `invite_token=hash`, `invite_expires_at=now+7d`.
   f. Sends invite email via MailChannels (see email template section).
4. Returns the new pending-invite row (without the token hash).

### Receiving the invite

The invite email contains a link:
```
https://cat-tracker.pages.dev/invite?token=<raw_token>
```

When the recipient clicks:
1. Frontend renders `/invite?token=xxx`.
2. If not logged in: redirect to `/login?next=/invite?token=xxx`. After Google sign-in, redirect back.
3. Once authenticated, frontend calls `GET /api/household/invites/accept?token=xxx`.
4. Worker:
   a. SHA-256 hashes the token, looks up the `household_members` row.
   b. Validates: token exists, `status='pending'`, `invite_expires_at > now()`.
   c. Validates that the logged-in user's email matches `invite_email` (prevents link-stealing if someone forwards the email).
   d. Sets `user_id = current_user_id`, `status = 'active'`, `joined_at = now()`, clears `invite_token`.
5. Frontend redirects to `/` — the user now sees all cats from their new household alongside their existing cats.

### Declining an invite

At step 3 above, the `/invite` page also shows a "Decline" button. `POST /api/household/invites/:id/decline` sets `status='removed'` and clears the token. The invite slot can then be re-used (Admin can re-invite the same email).

### Revoking an invite (Admin-side)

Admin calls `DELETE /api/household/invites/:id` — sets `status='removed'`, clears `invite_token`. If the recipient clicks the link after revocation, they receive a clear error: "This invite has expired or been revoked."

---

## UX / UI Design

### Entry point: Profile popover

The current profile popover (Home screen, top-left avatar) has: display name, email, Sign out. One new item is added:

```
[Avatar]  Steve Johnson
          steve@gmail.com

          Household settings →
          ────────────────────
          Sign out
```

"Household settings →" navigates to `/household`. This placement is intentional: household management is an account-level action, not a task. It belongs near Sign Out, not in the bottom navigation.

### `/household` page

```
← My Cats

Household
"Johnson Family Cats"  [rename]

MEMBERS (3)
┌─────────────────────────────────────────────────┐
│ 👤 Steve Johnson (you)          Admin  ·  Owner │
├─────────────────────────────────────────────────┤
│ 👤 Sarah Johnson                Editor  [▾]  [×]│
├─────────────────────────────────────────────────┤
│ 👤 Maria P. (pet sitter)        Viewer  [▾]  [×]│
└─────────────────────────────────────────────────┘

PENDING INVITES (1)
┌──────────────────────────────────────────────────┐
│ ✉ grandma@example.com           Viewer  [Revoke] │
│   Invited 2 days ago · expires in 5 days         │
└──────────────────────────────────────────────────┘

INVITE SOMEONE
  Email address: [________________________]
  Role:          [Editor           ▾]
                 [Send invite]
```

**Role selector tooltip** (shown inline when hovering a role):
- Viewer — can see cats and measurements; cannot add or change anything
- Contributor — can log measurements and mark medications given; cannot add or remove cats
- Editor — can add, edit, and delete cats and measurements
- Admin — full control including inviting and removing members

**Non-Admin view** of the same page shows: members list (read-only, no remove/role-change buttons), no invite form, no pending invites section.

### Home screen — multi-household cat labeling

When a user belongs to exactly one household: no change to current cat card UI.

When a user belongs to 2+ households: each cat card gets a subtle household label below the cat name:
```
🐱  Luna                  Watch
    2y · Domestic Shorthair
    Johnson Family Cats       ← household label (muted, smaller)
```

If the user's only household is their personal one (renamed from "Your Cats" to whatever they named it), no label is shown — same as single-household.

### Invite acceptance page: `/invite`

```
Cat Tracker

You've been invited to
"Johnson Family Cats"

Invited by Steve Johnson · as Editor

You'll be able to view, log measurements, and
manage cats for this household.

     [Accept invitation]
     [Decline]
```

If not logged in, a "Sign in with Google to continue" prompt appears first, then redirects back to this page.

Error states:
- Token expired: "This invite link has expired. Ask the household admin to send a new one."
- Token not found / revoked: "This invite is no longer valid."
- Email mismatch: "This invite was sent to a different email address. Sign in with [invite_email] to accept it."
- Already a member: "You're already a member of this household."

---

## API Endpoints

### Household

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `GET` | `/api/household` | Any member | Get household info, member list, pending invites |
| `PUT` | `/api/household` | Admin | Rename household |

### Members

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `PUT` | `/api/household/members/:userId/role` | Admin | Change member's role (not owner's) |
| `DELETE` | `/api/household/members/:userId` | Admin | Remove member |

### Invites

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/household/invites` | Admin | Send invite (`{ email, role }`) |
| `DELETE` | `/api/household/invites/:id` | Admin | Revoke pending invite |
| `GET` | `/api/household/invites/preview?token=` | Anyone | Preview invite details (no auth required — used to render accept page before login) |
| `POST` | `/api/household/invites/accept` | Authenticated | Accept invite (`{ token }`) |
| `POST` | `/api/household/invites/decline` | Anyone | Decline invite (`{ token }`) |

### Authorization changes to existing routes

All existing cat and measurement routes currently scope by `user_id`. After this PRD is implemented, they scope by `household_id` — specifically by the set of households the requesting user is a member of. The middleware will be updated:

```
// Current
WHERE cats.user_id = ?

// After
WHERE cats.household_id IN (
  SELECT household_id FROM household_members
  WHERE user_id = ? AND status = 'active'
)
```

Write operations additionally check that the user's role in that household grants the required permission.

---

## Database Schema Changes

```sql
CREATE TABLE IF NOT EXISTS households (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name         TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,  -- null until accepted
  role              TEXT NOT NULL,   -- 'viewer'|'contributor'|'editor'|'admin'
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'active'|'removed'
  invited_by        TEXT REFERENCES users(id),
  invite_email      TEXT,
  invite_token_hash TEXT UNIQUE,     -- SHA-256 of raw token; null after acceptance
  invite_expires_at TEXT,
  invited_at        TEXT NOT NULL DEFAULT (datetime('now')),
  joined_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_hm_household ON household_members(household_id, status);
CREATE INDEX IF NOT EXISTS idx_hm_user ON household_members(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hm_active_user
  ON household_members(household_id, user_id)
  WHERE status = 'active';

-- Add household_id to cats
ALTER TABLE cats ADD COLUMN household_id TEXT REFERENCES households(id);
CREATE INDEX IF NOT EXISTS idx_cats_household ON cats(household_id);
```

Note: `invite_token_hash` is a SHA-256 hex digest. The raw token is only ever in the email link and never stored.

---

## Migration from Current Single-User Model

Every existing user has cats owned via `cats.user_id`. Migration creates a personal household for each user:

1. For each `users` row:
   a. Create a `households` row: `name = display_name + "'s Cats"`, `owner_user_id = user.id`
   b. Create a `household_members` row: `user_id = user.id`, `role = 'admin'`, `status = 'active'`, `joined_at = user.created_at`
2. For each `cats` row: set `household_id` from the household created for `cats.user_id` (using a temporary lookup map)
3. For each `medications` row: (if medication reminders is live) the `cat_id` → `household_id` link is implicit through the cat; no change needed
4. After migration: `cats.user_id` is kept as `created_by_user_id` (rename column) for attribution — or left as a legacy field (reads ignored, auth goes through household_id only)

Migration is run as a D1 Worker one-shot script, idempotent: skip users who already have a `household_members` row.

```sql
-- Migration pseudocode (run in Worker script)
-- Step 1: for each user who has no household yet, create one
INSERT INTO households (id, name, owner_user_id)
SELECT lower(hex(randomblob(8))), display_name || '''s Cats', id
FROM users
WHERE id NOT IN (SELECT owner_user_id FROM households);

-- Step 2: add owner as member
INSERT OR IGNORE INTO household_members (id, household_id, user_id, role, status, joined_at)
SELECT lower(hex(randomblob(8))), h.id, h.owner_user_id, 'admin', 'active', datetime('now')
FROM households h
WHERE h.owner_user_id NOT IN (
  SELECT user_id FROM household_members WHERE status = 'active'
);

-- Step 3: assign cats to their owner's household
UPDATE cats
SET household_id = (
  SELECT h.id FROM households h WHERE h.owner_user_id = cats.user_id
)
WHERE household_id IS NULL AND user_id IS NOT NULL;
```

---

## Email Invite Template

Delivered via Cloudflare Workers → MailChannels transactional API (same mechanism as medication reminder emails planned in PRD-medication-reminders.md Phase C).

**Subject**: `{InviterName} invited you to {HouseholdName} on Cat Tracker`

**Body** (plain text version):
```
Hi there,

{InviterName} has invited you to join "{HouseholdName}" on Cat Tracker as a {Role}.

As a {Role}, you'll be able to:
  · {role capability description}

Click the link below to accept:
  {invite_url}

This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.

— Cat Tracker
```

**HTML version**: styled to match the Cat Tracker dark-mode aesthetic with the lavender/amber color palette. Action button: "Accept invitation →" with gradient border treatment matching the login page sign-in button.

---

## Security Considerations

- **Invite token**: 32 bytes from `crypto.getRandomValues()` → hex string (256 bits of entropy). Stored as SHA-256 hash in DB; plaintext never stored. Same pattern as OAuth state tokens.
- **Email verification**: acceptance validates that the logged-in user's email matches `invite_email`. Prevents a link forwarded to someone else from granting them access.
- **Token expiry**: 7 days. Expired tokens are rejected server-side; the invite row can be cleaned up by cron.
- **Role ceiling**: an Admin cannot grant a role higher than their own (no privilege escalation). Enforced server-side.
- **Owner protection**: the `owner_user_id` row in `household_members` cannot be targeted by remove or role-change endpoints — owner identity checked before any mutation.
- **Authorization on all routes**: every cat/measurement read and write verifies the requester is an active member of the cat's household with a sufficient role. No `user_id`-based bypass.
- **Rate limiting on invite send**: max 10 pending invites per household at a time to prevent abuse.
- **No invite preview leakage**: `GET /api/household/invites/preview?token=` returns only household name, inviter display name, and role — not member emails or internal IDs.
- **Orphaned invite cleanup**: daily cron expires `invite_expires_at < datetime('now')` rows (`status='pending'` → `status='removed'`).

---

## Open Questions

1. **Personal household naming**: "Steve's Cats" is fine for one person, but once it's a shared household it's misleading. Should the owner be prompted to rename the household when they send their first invite? Or just let them rename from the settings page whenever?

2. **Invited user's own cats**: If User B (invitee) already had their own cats before accepting User A's invite, their cats remain in User B's personal household — not automatically visible to User A. For the "husband and wife" use case, the practical answer is: one person sets up the household, the other never had their own cats. But if they did, moving cats to the shared household requires Phase 2 functionality. Is this acceptable for v1?

3. **What happens when a member is removed?** Their access is revoked immediately. Any measurements or cats they added remain (they're owned by the household, not the individual). This is the correct behavior — removing someone from the household shouldn't delete the cat history they contributed. Confirm this is desired.

4. **MailChannels integration timing**: MailChannels is also referenced in PRD-medication-reminders.md Phase C. Should both be implemented together as a shared email utility, or independently? Recommendation: implement as a shared `sendEmail()` utility in the Worker, callable from any route.

5. **Household visibility on cat export**: the vet export page currently shows cat name, birthdate, etc. Should it also show household name? Or is that an internal concept that doesn't belong in a vet-facing document?

6. **Admin quorum**: what if the only Admin is the owner, and the owner's Google account becomes inaccessible? No recovery path exists in v1. Phase 2 should add "Transfer ownership" to prevent lock-out.

7. **Invitation to a non-Google-account email**: Cat Tracker uses Google OAuth only. If the invitee uses a different email for Google than the one the invite was sent to, the email-match check will fail. Should the system allow override ("This invite was for sarah@company.com — are you signing in as sarah@gmail.com?" with explicit confirmation), or just tell the invitee to re-request an invite to their Google email?

---

## Implementation Plan (phased)

### Phase A — Household model + invite system
1. DB migration: create `households`, `household_members` tables; `ALTER TABLE cats ADD COLUMN household_id`
2. Migration script: create personal households for all existing users; assign cats
3. Worker middleware: update auth/ownership checks to use household membership
4. Worker: `GET/PUT /api/household` endpoints
5. Worker: `POST /api/household/invites` (generate token, store hash, send email via MailChannels)
6. Worker: `GET /api/household/invites/preview?token=`, `POST .../accept`, `POST .../decline`
7. Worker: `DELETE /api/household/invites/:id` (revoke), `DELETE /api/household/members/:id` (remove member), `PUT .../role` (change role)
8. Worker: extend cron to expire old pending invites
9. Frontend: add "Household settings →" to profile popover
10. Frontend: `/household` page — members list, pending invites, invite form
11. Frontend: `/invite?token=` page — accept/decline UI with login redirect handling
12. Frontend: home screen household label on cat cards (multi-household case)

### Phase B — Polish and edge cases
1. Role change confirmation dialog (especially when downgrading someone)
2. "Remove member" confirmation dialog with impact summary
3. Invitation reminder email (resend if not accepted after 3 days)
4. Email notification to all Admins when someone accepts an invite
5. Email notification when a member is removed

### Phase C — Advanced (future)
1. Transfer household ownership
2. Delete household (with cat reassignment or deletion prompt)
3. Move cats between households
4. Activity feed / audit log
5. Household-wide medication reminder notifications
