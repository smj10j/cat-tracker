# PRD: Household Sharing — Phase 2

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |
| **Last updated** | 2026-07-02 |
| **Depends on** | PRD-household-sharing.md (Phase A must be implemented first) |

---

## Overview

This PRD covers the features deferred from PRD-household-sharing.md. Phase 1 established the household model, invite system, and role-based access control. Phase 2 completes the lifecycle operations — ownership continuity, household retirement, inter-household cat migration, transparency (audit log), and coordinated notifications across household members.

These features are required before the product is considered reliable for any non-trivial household or small-clinic deployment.

---

## Problem Summary

Phase 1 left several dangerous or frustrating gaps:

1. **Lock-out risk**: If the sole owner's Google account becomes inaccessible (deleted, compromised, lost to divorce), the household is permanently frozen. No other Admin can recover it. This is documented in PRD-household-sharing.md Decision #6 as a known Phase 2 blocker.

2. **No exit path for households**: A household cannot be deleted. A cat cannot be moved to another household. If someone creates the wrong household structure or leaves a relationship, there is no way to reorganize without deleting cats.

3. **Opaque to members**: Members have no visibility into what actions have been taken — who logged a dose, who deleted a measurement, who changed a role. For multi-caretaker households with a sick cat, this blind spot is frustrating and potentially dangerous.

4. **Notification gaps**: Admins don't know when someone joins or leaves. Dose events aren't shared with other household members. The household is collaborative in data but not in awareness.

5. **UX friction in confirmations**: Phase 1 shipped without confirmation dialogs for high-impact actions (role downgrades, member removal). Users can make mistakes with no warning.

---

## User Stories

**Ownership transfer & lock-out recovery (Feature 1)**
- As a household owner who is moving abroad, I want to hand ownership to my partner, so the household keeps a functioning owner without support intervention.
- As an Admin whose co-owner's Google account was deleted, I want a recovery path to claim ownership, so our cats' data isn't frozen forever.
- As a different Admin in that household, I want to be notified and able to object before an ownership claim completes, so a bad-faith grab can't happen quietly.

**Delete household (Feature 2)**
- As an owner who created a duplicate household by mistake, I want to delete it (after moving or accepting the loss of its cats), so my household list reflects reality.
- As an owner deleting a household, I want the app to force me to type its name and show exactly what will be destroyed, so I can't do this accidentally.

**Move cats (Feature 3)**
- As a user who joined my partner's household after tracking my cat solo, I want to move my cat (with its full history and care schedule) into the shared household, so both of us can care for it.
- As a user whose cat physically moved to a relative's home, I want the cat's record to follow it.

**Activity feed / audit (Feature 4)**
- As a caretaker in a three-person household, I want to see "Maria marked Luna's Methimazole as given, 20 min ago", so I don't double-dose the cat.
- As an Admin, I want to see who deleted a measurement or changed a role, so surprises are explainable.

**Dose attribution & notifications (Feature 5)**
- As a household member, when a dose is marked given by someone else, I want my notifications inbox to show it as done *by them*, so my mental model of today's care is accurate.

**Confirmations (Feature 6)**
- As an Admin on a small phone screen, I want destructive taps (remove member, delete cat) to require explicit confirmation, so a mis-tap can't remove my mother-in-law from the household.

**Invitation UX (Feature 7)**
- As an invitee who missed the first email, I want one reminder, so the invite doesn't silently die.
- As an Admin, I want to know when someone accepts, so I can follow up with them.

---

## Features

### 1. Ownership Transfer

**Problem:** The owner is permanent in Phase 1. No recovery exists if the owner becomes unavailable.

**Design:**

- Only the current owner can initiate a transfer.
- Transfer target must be an **active** Admin in the household (`household_members.status = 'active'` and `role = 'admin'` — a pending invitee is never a valid target; see Edge Cases).
- Transfer triggers a confirmation modal: "Transfer ownership to [name]? You'll remain an Admin but will no longer be the household owner. This cannot be undone."
- On confirmation: `households.owner_user_id` is updated; the prior owner's `household_members.role` stays `admin` (they do not lose membership).
- An email notification is sent to the new owner and to all other Admins.

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/household/transfer-ownership` | Owner only | `{ new_owner_user_id }` |

**Precedent already in the codebase:** account deletion (`worker/src/routes/auth.ts`, `DELETE /api/auth/account`) already performs an automatic ownership transfer — when a deleting owner has another active admin, `owner_user_id` is reassigned; when not, the household is deleted (and deletion is blocked entirely when other members would be stranded, 409). Feature 1 makes this same mechanism user-initiated, and the two paths should share a helper so semantics can't drift.

**Lock-out recovery path (Phase 2 requirement):**

If the owner becomes inaccessible (Google account deleted, compromised, or owner simply disappeared), a recovery path is needed. **Trigger:** Any Admin in the household can initiate a "Claim ownership" action from the `/household` page. This action is only visible when the current owner has not been active for 30+ days. When initiated:

1. An email is sent to all other Admins in the household: "[Name] has requested ownership of [Household]. If you do not object, ownership will transfer in 24 hours."
2. Any other Admin can cancel the transfer within 24 hours by clicking a link in the email.
3. After 24 hours with no cancellation, the requesting Admin becomes the new owner.

This is an edge case but must exist before the product is considered reliable for multi-person households. The 30-day inactivity gate prevents casual ownership grabs while the original owner is simply on vacation.

**Inactivity signal (design correction, 2026-07-02):** the original draft proposed checking the `sessions` table for the owner's most recent `created_at`. That signal is unreliable: session rows are deleted on sign-out and on account deletion, sessions are capped per user, and rolling 7-day sessions mean an *active* user may show only recent rows while a signed-out-but-reachable user shows none. Instead, add **`users.last_seen_at`** (see Data Model Deltas), updated by the `requireAuth` middleware at most once per day (cheap conditional write). The claim action is visible when `last_seen_at` (or `users.created_at` as fallback for pre-migration rows) is older than 30 days. Pre-migration users all start with `NULL` → treat `NULL` as "unknown, use account created_at" and document that claims are not possible against users who never sign in after the migration until 30 days pass.

**Claim mechanics:** a pending claim is a row in `ownership_claims` (see Data Model Deltas). The cancel link uses a hashed token (same pattern as invite tokens, SHA-256 per Phase 1). Finalization is executed by the existing daily cron: any claim past `execute_after` with `status='pending'` transfers ownership, marks the claim `executed`, and emails all Admins. If the original owner signs in while a claim is pending (`last_seen_at` refresh), the claim is auto-cancelled and the claimant notified.

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/household/claim-ownership` | Admin, when owner inactive 30+ days | Creates pending claim, emails Admins |
| `POST` | `/api/household/claim-ownership/cancel` | Any other Admin (via emailed token) or the owner | `{ token }` — cancels pending claim |

**Pragmatic alternative for v1:** If the automated recovery flow proves too complex to build in the first pass, an acceptable interim is a documented manual process: the Admin emails the developer (or uses a support form) with their household ID, and ownership is transferred via `wrangler d1 execute`. This is fine for the current user base. The automated flow becomes necessary when the user count grows beyond what manual support can handle. **This is Open Question #1 — the product owner should pick automated vs. manual-first.**

---

### 2. Delete Household

**Problem:** A household cannot currently be retired or removed.

**Design:**

- Only the owner can delete a household.
- The delete flow has two steps:
  1. Owner sees: "Deleting this household will permanently remove [N] cats and all their measurements. This cannot be undone."
  2. Owner must type the household name to confirm (destructive-action confirmation pattern — see Feature 6).
- **Alternative: Transfer cats before deleting.** The delete modal shows a "Move cats to another household first" option if the owner belongs to another household — surfaces the Move Cats feature naturally.
- On deletion: all `cats`, `measurements`, `medications`, `medication_doses`, and `household_members` rows for this household are deleted. The `households` row is deleted last.
- **R2 photo cleanup:** For each cat being deleted, the handler must also delete the R2 object at `cats/{cat_id}/photo.jpg` if it exists. Without this, photos become orphaned in the R2 bucket with no referencing database row. Use `env.PHOTOS.delete(key)` for each cat — batch if possible. Failure to delete an R2 object should log a warning but not block the household deletion (the D1 data is the primary concern; orphaned R2 objects can be cleaned up later).
- **Audit log entries:** SEC-15 audit logging is **implemented** (see Feature 4). The household deletion must write an `audit_log` entry via `logAudit()` *before* deleting the data, capturing the household name, member count, and cat count in `metadata` for forensic context. (New `AuditAction` value: `household_deleted` — see Data Model Deltas.)
- If the owner is not in any other household, a personal household is auto-created for them (consistent with signup behavior — `ensureHousehold()` in `worker/src/lib/household.ts`) to ensure they always have a household.

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `DELETE` | `/api/household` | Owner only | Deletes household and all owned data |

---

### 3. Move Cats Between Households

> **Priority note:** This is the lowest-priority feature in Phase 2. The primary use case (invited user's pre-existing cats) is a one-time migration, and the ongoing use case (cat physically moves homes) is rare. If Phase 2B scope needs to be cut, this is the first candidate. Users can work around it by re-creating the cat in the new household and importing historical data via CSV.

**Problem:** Phase 1 creates one household per user, but cats may need to be reassigned — when a cat physically moves to a new home, when a user reorganizes their household structure, or when accepting the Phase 1 limitation that invited users' pre-existing cats don't auto-merge.

**Design:**

- **Who can move a cat**: Editor or Admin of the *source* household AND Admin of the *destination* household.
- Source and destination must both be households the requesting user is an active member of with sufficient role (not two different users coordinating — single user with access to both).
- The move is instantaneous; all measurements, medications, and doses travel with the cat (they are linked via `cat_id` foreign key, so updating `cats.household_id` is sufficient — no row-level migration needed for measurements or doses).
- A confirmation dialog shows: "Move [Cat Name] to [Destination]? All measurements and medications will move too."
- The moved cat's `household_id` is updated; `cats.user_id` (legacy attribution) is preserved.
- **Medication ownership after move:** The `medications` table has a `user_id` column (the user who created the medication). After a cat move, this `user_id` may reference a user who is not a member of the destination household. This is acceptable — `user_id` on medications is attribution (who created it), not authorization (who can see it). Authorization flows through the cat's `household_id` → `household_members`. The medication remains visible and manageable by the destination household's members with appropriate roles. No `user_id` update is needed on move.
- **R2 photos:** The R2 key scheme is `cats/{cat_id}/photo.jpg`. Since the key uses `cat_id` (not `household_id`), photos survive the move with no R2 changes needed.
- **Activity entries:** the move is logged to **both** households' activity feeds ("Steve moved Mochi to [Destination]" / "Steve moved Mochi in from [Source]"). Historical `household_activity` rows about the cat stay with the *source* household — they describe events that happened there.

**UI location:** Cat profile → Edit cat → "Move to another household" link (only visible if user has Admin role in 2+ households).

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/cats/:id/move` | Editor+ source, Admin+ dest | `{ destination_household_id }` |

---

### 4. Activity Feed / Audit Log

**Problem:** Members have no visibility into household actions. For households with a sick cat and multiple caretakers, this is a significant gap: "Did someone already give Luna her thyroid pill this morning?"

**Design:**

The activity feed records who did what and when. It is household-scoped and visible to all active members.

**Events recorded:**

| Event | Example display |
|-------|----------------|
| Measurement logged | "Sarah logged Luna's weight: 9.4 lbs" |
| Measurement deleted | "Steve deleted a measurement for Gemini" |
| Medication dose marked given | "Maria marked Luna's Methimazole as given" |
| Medication dose skipped | "Steve skipped Kylo's Revolution Plus" |
| Cat added | "Sarah added Mochi to the household" |
| Cat edited | "Steve updated Gemini's profile" |
| Cat deleted | "Steve deleted Max" |
| Cat moved in/out | "Steve moved Mochi to Riverside Cats" |
| Member joined | "Maria (pet sitter) joined as Contributor" |
| Member removed | "Steve removed Maria from the household" |
| Role changed | "Steve changed Sarah's role from Contributor to Editor" |
| Invite sent | "Steve sent an invite to grandma@example.com" |
| Invite revoked | "Steve revoked grandma@example.com's invite" |
| Ownership transferred | "Steve transferred ownership to Sarah" |
| Ownership claim started/cancelled/executed | "Sarah requested ownership (owner inactive 30+ days)" |

**UI:**

- Accessible from the `/household` page: "Activity →" link or tab below the members list (web `HouseholdPage.tsx`; iOS `app/app/household.tsx` gets an equivalent screen — cross-platform rule applies).
- `/household/activity` — paginated list of events, newest first.
- Each row: avatar initial + actor name + action text + time (relative: "3 hours ago"; absolute on hover).
- Filter by cat or by member (optional, Phase 2 stretch goal).
- Retention: keep 90 days of events. Older events pruned by the existing daily cron (same retention window the SEC-15 audit cron already uses — reuse the scheduled handler, separate DELETE).

**Relationship to the existing SEC-15 `audit_log` (decision: extend it — do NOT reuse it for the feed):**

An `audit_log` table **already exists in production** (PRD-security-phase2.md SEC-15; schema in `worker/src/db/schema.sql`, helper `logAudit()` in `worker/src/lib/audit.ts`). Evaluated for reuse, rejected for the user-facing feed because the two have incompatible contracts:

| | `audit_log` (exists) | `household_activity` (new) |
|---|---|---|
| Purpose | Security forensics | User-facing transparency feed |
| Scope | Global, keyed by `user_id` only — **no `household_id`**, cannot be queried per household without joins that break for departed members | Household-scoped, indexed `(household_id, created_at DESC)` |
| Content | `action`, `ip_address`, `user_agent`, JSON `metadata` — PII (IP/UA) that must never be shown to members | Pre-rendered `display_text`, `entity_type`/`entity_id` |
| Write path | Best-effort `waitUntil()`, may silently drop | Same D1 batch as the mutation (consistency required — see below) |
| Retention | 90-day cron | 90-day cron |
| Coverage | Auth/security events only (`sign_in`, `cat_deleted`, `member_removed`, …) | High-frequency care events (every measurement, every dose) |

Writing every measurement into `audit_log` would flood the security log; exposing `audit_log` to members would leak IP/UA. So: **two tables, one shared retention cron.** What Phase 2 *does* add to the existing `audit_log`: new `AuditAction` values (`household_deleted`, `ownership_transferred`, `ownership_claimed`, `cat_moved`) written via `logAudit()` for the destructive/lifecycle operations, alongside their `household_activity` entries. Routine care events (measurements, doses) go to `household_activity` only.

**Database:**

```sql
CREATE TABLE IF NOT EXISTS household_activity (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,  -- 'measurement_added', 'dose_given', 'member_removed', etc.
  entity_type  TEXT,           -- 'cat', 'measurement', 'medication_dose', 'member', 'invite'
  entity_id    TEXT,           -- ID of affected entity
  display_text TEXT NOT NULL,  -- pre-rendered human-readable string
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ha_household ON household_activity(household_id, created_at DESC);
```

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `GET` | `/api/household/activity` | Any member | Paginated activity log (`?cursor=&limit=50`) |

**Implementation note:** Write activity entries in the same D1 batch as the mutation that triggered them. Not a separate async step — this ensures consistency. Each route that modifies household data calls a shared `logActivity(db, householdId, actorId, eventType, entityType, entityId, displayText)` helper (new, in `worker/src/lib/` — sibling of, not merged with, `logAudit`).

**Stale display names:** The `display_text` column is pre-rendered at write time (e.g., "Sarah logged Luna's weight: 9.4 lbs"). If Sarah later changes her Google display name, old activity entries will show the old name. This is intentional and acceptable — activity entries are historical records of what happened at that point in time. Do not attempt to retroactively update `display_text` on name changes.

**Privacy:** All household members (including Viewers) can see all activity entries. This is intentional — the audit log is a transparency feature for shared cat care. There is no concept of Admin-only activity entries in v1. If this becomes a concern (e.g., "Sarah removed Maria" being visible to the remaining Contributor), it can be addressed in a future phase by adding a `min_role_visible TEXT` column.

---

### 5. Household-Wide Medication Notifications

**Problem:** When one household member marks a dose as given, others don't know. A cat with twice-daily medication could accidentally receive double doses if two caretakers don't coordinate.

**Design:**

**In-app notification** (extends the existing `/notifications` inbox from PRD-medication-reminders.md):

- When a dose is marked given or skipped by *another* household member, all other members who have the cat in their household receive a notification entry: "Maria marked Luna's Methimazole as given · 20 min ago".
- These entries appear in the "Due Today" section of the `/notifications` page, with the dose shown as completed (dimmed, with the actor's name).
- The notification is only generated when the *actor is not the current viewer* — no self-notification.

**Push notification** (only if PRD-medication-reminders.md Phase B is implemented; note iOS push already exists via device_tokens — see docs/ROADMAP.md WP4f for the web-push status):

- If a household member has granted push permission, they receive a push when a co-member marks a dose.
- Format: "Luna's Methimazole was given by Maria" with a muted style (not the same urgency as an overdue dose alert).

**Database change (to medication_doses):**

```sql
ALTER TABLE medication_doses ADD COLUMN administered_by TEXT REFERENCES users(id);
```

**Migration note:** The `medication_doses` table currently has columns: `id`, `medication_id`, `due_at`, `administered_at`, `skipped`, `skip_reason`, `notes`, `notification_sent_at`, `created_at`. The `administered_by` column does not exist yet. Use `ADD COLUMN IF NOT EXISTS` per project convention. All existing administered doses will have `administered_by = NULL`, which the UI should handle gracefully — display "Marked as given" without an actor name for pre-migration doses.

Already stored as `administered_at` (timestamp) in Phase A. The `administered_by` column adds the actor, enabling "marked given by Maria" display.

**API change:** `POST /api/doses/:id/administer` already exists in `worker/src/routes/medications.ts`. Add `administered_by = userId` (from the auth context) when recording the dose. No endpoint signature change needed — it's the same route, just a new column written. The `userId` is already available from the `requireAuth` middleware.

**Attribution edge:** if the administering user later leaves the household (or deletes their account → `SET NULL` semantics apply only on user-row deletion; membership removal changes nothing), the dose row keeps `administered_by`. Display falls back to "a former member" when the user is no longer resolvable or no longer a member.

---

### 6. Confirmation Dialogs for High-Impact Actions

**Problem:** Phase 1 shipped without confirmation dialogs for destructive or high-impact actions.

> **Scope note (2026-07-02):** the base `window.confirm()`/`alert()` replacement — a shared in-app **ConfirmDialog + toast** component applied to `CatProfile.tsx`, `HouseholdPage.tsx`, `MedicationFormPage.tsx`, `AddEditCat.tsx` — is being delivered separately by **docs/ROADMAP.md WP3c** (which also closes the household-sharing Phase B "custom confirmation dialogs" item). **This PRD does not re-specify that component.** What remains in *this* PRD's scope: (a) the **destructive typed-confirmation variant** (type-the-name-to-confirm) if WP3c ships only the simple variant, and (b) wiring both variants to the new Phase 2 actions below.

**Actions requiring confirmation:**

| Action | Confirmation prompt | Variant |
|--------|-------------------|---------|
| Remove member | "Remove [name] from this household? They'll lose access immediately. Their data stays." | Simple |
| Downgrade Admin to lower role | "Change [name]'s role to [role]? They'll lose the ability to invite and remove members." | Simple |
| Transfer ownership | "Transfer ownership to [name]? This cannot be undone." | Typed (target's name) |
| Delete household | Two-step: impact summary ("removes N cats, M measurements…"), then type household name | Typed (household name) |
| Delete cat | "Delete [name]? All measurements, medications, and history will be permanently removed." | Simple |
| Move cat | "Move [Cat Name] to [Destination]? All measurements and medications will move too." | Simple |
| Claim ownership | "Request ownership of [Household]? All other admins will be notified and can object for 24 hours." | Simple |

**Two-step destructive pattern (spec for the typed variant):**

1. **Step 1 — impact summary:** modal titled with the action, body enumerating concrete consequences with real counts fetched at open time ("2 cats, 340 measurements, 3 active care items"), Cancel + "Continue" buttons. Continue is styled as destructive (rose), Cancel is the default/safe action and has focus.
2. **Step 2 — typed match:** a text input labeled "Type *[exact string]* to confirm". The confirm button stays disabled until the input matches exactly (case-sensitive, no trimming surprises — trim leading/trailing whitespace only). Escape/backdrop dismisses safely at either step. Must be keyboard- and screen-reader-accessible per PRD-accessibility.md (`role="alertdialog"`, focus trap, `aria-describedby` on the impact text).
3. Both platforms: web modal + iOS equivalent (React Native `Modal`); shared copy strings so wording can't drift.

---

### 7. Invitation UX Improvements (Phase B from Phase 1)

The following items were deferred from PRD-household-sharing.md Phase B (also tracked as docs/ROADMAP.md WP5a):

**7a. Invitation reminder email:**
If an invite hasn't been accepted after 3 days, send one reminder email to the invitee (same template as the original, with subject "Reminder: You've been invited to..."). Only one reminder per invite.

**7b. Admin notification on member join:**
When someone accepts an invite, send an email to all Admins: "[Name] joined [Household] as [Role]."

**7c. Admin notification on member removal:**
When an Admin removes a member, the removed member receives an email: "You've been removed from [Household] on Cat Tracker." Brief and factual — no justification required.

These all use the shared `sendEmail()` utility from `worker/src/lib/email.ts` (established in Decision #4 of PRD-household-sharing.md).

---

## Data Model Deltas (consolidated)

| Change | Table | Notes |
|--------|-------|-------|
| New table | `household_activity` | Feature 4 schema above; 90-day cron retention |
| New column | `medication_doses.administered_by TEXT REFERENCES users(id)` | Feature 5; `NULL` for pre-migration doses |
| New column | `users.last_seen_at TEXT` | Feature 1 inactivity signal; written by `requireAuth` at most once/day |
| New table | `ownership_claims` | Feature 1 recovery: `id`, `household_id`, `claimant_user_id`, `cancel_token_hash`, `execute_after`, `status` (`pending`/`cancelled`/`executed`), `created_at` |
| Extend enum (code only) | `AuditAction` in `worker/src/lib/audit.ts` | Add `household_deleted`, `ownership_transferred`, `ownership_claimed`, `cat_moved`; **no schema change** — `audit_log.action` is free TEXT |

No changes to `households`, `household_members`, `cats`, or `measurements` shapes. All migrations idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) per project convention.

## API Sketch (consolidated)

Existing Phase 1 routes for context (`worker/src/routes/household.ts`): `GET /api/household`, `GET /api/household/list`, `PUT /api/household`, `PUT /api/household/members/:userId/role`, `DELETE /api/household/members/:userId`, `POST /api/household/invites`, `DELETE /api/household/invites/:id`, `POST /api/household/invites/accept|decline`, `GET /api/household/invites/preview`.

New in Phase 2:

| Method | Path | Min role | Feature |
|--------|------|----------|---------|
| `POST` | `/api/household/transfer-ownership` | Owner | 1 |
| `POST` | `/api/household/claim-ownership` | Admin (owner inactive 30+ d) | 1 |
| `POST` | `/api/household/claim-ownership/cancel` | Admin (token) or Owner | 1 |
| `DELETE` | `/api/household` | Owner | 2 |
| `POST` | `/api/cats/:id/move` | Editor+ source AND Admin dest | 3 |
| `GET` | `/api/household/activity` | Viewer+ (any member) | 4 |

All new methods must be added to `CatTrackerApi` in `shared/lib/apiTypes.ts` first (compile-time conformance for both clients), per the cross-platform rule. All are additive (API versioning policy, PRD-api-versioning.md).

## Permission Matrix — destructive/lifecycle actions

| Action | Viewer | Contributor | Editor | Admin | Owner |
|--------|--------|-------------|--------|-------|-------|
| View activity feed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark dose given/skipped (existing) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Remove member | ❌ | ❌ | ❌ | ✅ (not the owner; not self — use "leave") | ✅ (anyone but self) |
| Change role | ❌ | ❌ | ❌ | ✅ (cannot change owner's) | ✅ |
| Transfer ownership | ❌ | ❌ | ❌ | ❌ | ✅ |
| Claim ownership (recovery) | ❌ | ❌ | ❌ | ✅ (gated on owner inactivity) | n/a |
| Cancel ownership claim | ❌ | ❌ | ❌ | ✅ (other admins) | ✅ |
| Delete household | ❌ | ❌ | ❌ | ❌ | ✅ |
| Move cat out (source side) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Move cat in (destination side) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete cat (existing) | ❌ | ❌ | ✅ | ✅ | ✅ |

Enforcement is server-side via the existing `hasRole()` hierarchy (`shared/lib/constants.ts`) plus an explicit `owner_user_id` check for owner-only routes; UI merely hides unavailable actions.

---

## Edge Cases

1. **Owner tries to remove themself / demote themself** → rejected (400). The owner must transfer ownership first. The owner can never be removed by an Admin.
2. **Transfer target is a pending (uninvited-accepted) member** → rejected: target must be `status='active'` AND `role='admin'`. The UI only lists eligible targets; the server re-validates.
3. **Last admin leaves or is removed, non-admin members remain** → the owner is always an admin and cannot be removed, so a household can never reach zero admins via membership operations. The only paths that touch this are account deletion (already blocks when the sole admin has other members — 409 in `auth.ts`) and ownership transfer (target is an admin by definition).
4. **Owner deletes their account** (existing flow) → auto-transfer to another active admin, else household deleted; blocked with 409 if other members would be stranded. Feature 1 shares this helper.
5. **Claim started, owner comes back** → owner's next authenticated request refreshes `last_seen_at`; pending claim auto-cancels and the claimant is emailed. Owner can also cancel explicitly.
6. **Two admins race to claim** → one pending claim per household (unique partial index on `ownership_claims(household_id) WHERE status='pending'`); second claim gets 409 "a claim is already pending."
7. **Cat with an active care schedule moves households** → medications/doses travel via `cat_id` (no re-parenting); future dose *notifications* fan out to destination members from the moment of the move; source members lose visibility (correct — they no longer care for the cat). Overdue doses travel too — the destination inbox may instantly show overdue items; the move confirmation should mention active care items ("Mochi has 2 active care items — reminders will switch to [Destination]'s members").
8. **Cat moves while a dose was administered by a source-household member** → `administered_by` remains; renders as "a former member" in the destination (see Feature 5 attribution edge).
9. **Cat with an active alert acknowledgment moves** (if PRD-alert-acknowledgment.md ships) → ack rows follow `cat_id`; acceptable, documented there.
10. **Delete household with pending invites** → `household_members` rows (which hold invites) cascade-delete; the invite link then 404s at preview/accept with a friendly "this household no longer exists" message. No email to pending invitees in v1 (Open Question #5).
11. **Delete household racing an in-flight measurement write** → FK constraints reject the orphan write; client shows the standard error. Acceptable.
12. **Deceased cats** move/delete like any cat; memorial data travels with `cat_id`.
13. **Activity feed row for a deleted entity** → `entity_id` dangles by design (`display_text` is self-contained); the UI must not attempt to link to deleted entities (link only when the entity still resolves).
14. **Timezone note for the 24-hour objection window and 30-day gate** → both computed in UTC on the server; imprecision of a few hours is acceptable and documented in code (per docs/ROADMAP.md WP2 conventions, mark intentional-UTC comparisons inline).

---

## Implementation Plan

> **Ordering rationale:** Phase 2A ships the highest-frequency, highest-safety-impact feature first — the activity feed that prevents double-dosing. This is a daily pain point for multi-caretaker households. Lifecycle operations (ownership transfer, delete, move) are important but rare; they move to 2B. Email polish is lowest-priority and moves to 2C.

### Phase 2A — Transparency and medication coordination (highest daily value)
1. `administered_by` column on medication_doses + migration
2. Update `POST /api/doses/:id/administer` to write `administered_by = userId`
3. Update notifications page to show "Marked as given by [Name]" for co-member doses (web + iOS)
4. `household_activity` table and `logActivity()` helper
5. Activity event writes in all mutating routes (measurements, doses, cats, members)
6. `/household/activity` page with paginated feed (web + iOS screen)
7. Confirmation dialogs: consume WP3c's `ConfirmDialog`; add the typed destructive variant if WP3c shipped only the simple one
8. Apply confirmation dialogs to: remove member, role change, delete cat

### Phase 2B — Lifecycle and safety (rare but important)
9. `users.last_seen_at` migration + `requireAuth` daily-throttled write
10. Ownership transfer endpoint + UI + email notification (shared helper with account-deletion transfer)
11. Admin lock-out recovery path (`ownership_claims`, 30-day inactivity trigger, 24-hour objection window, cron finalization)
12. Delete household endpoint + two-step UI (with R2 photo cleanup + `audit_log` entry)
13. Move cats between households (API + cat edit UI entry point + dual activity entries)

### Phase 2C — Communication polish
14. Invitation reminder email (3-day resend)
15. Admin email on member join
16. Admin/member email on removal
17. Push notifications for co-member dose events (if Phase B of medication PRD is live)

---

## Dependencies & Cross-PRD Continuity

| Dependency | Notes |
|-----------|-------|
| PRD-household-sharing.md Phase A | Must be fully implemented before any Phase 2 work. **Status: done.** |
| `worker/src/lib/email.ts` | Shared `sendEmail()` utility — already exists and is used by Phase A invite flow. Ready for Phase 2C email notifications. |
| PRD-medication-reminders.md Phase B (push) | Only required for Phase 2C push notifications; rest of Phase 2 is independent. iOS native push exists; web push status per docs/ROADMAP.md WP4f. |
| PRD-security-phase2.md SEC-15 (audit log) | **Implemented** — `audit_log` table + `logAudit()` exist in production. Phase 2 destructive flows write entries with new `AuditAction` values (see Feature 4 / Data Model Deltas). The old "skip if not implemented" caveat is obsolete. |
| PRD-cat-photos.md (R2 infrastructure) | The delete-household flow must clean up R2 photos. The R2 bucket binding (`PHOTOS`) already exists in `worker/src/types.ts`. |
| docs/ROADMAP.md WP3c (confirm dialogs/toasts) | Delivers the base `ConfirmDialog` + toast replacement for `window.confirm()`/`alert()` across the app, and closes household-sharing Phase B's dialog item. **This PRD consumes that component — reference, don't duplicate** (see Feature 6 scope note). |
| PRD-alert-acknowledgment.md (Draft) | If approved, ack/withdraw events should be logged to `household_activity`, and ack rows travel with cats on move (edge case #9). Soft dependency both ways. |

---

## Success Criteria

**Daily use (Phase 2A — highest priority):**
- Within 5 minutes of one household member marking a dose as given, all other members see the updated status and the actor's name in their notification inbox
- A caretaker opening the notification inbox can answer "Did someone already give Luna her pill?" without texting anyone
- Members can see who logged which measurement and who marked which dose — within the 90-day activity retention window
- No destructive household action (remove member, delete cat) can happen with a single tap — all require explicit confirmation

**Lifecycle (Phase 2B):**
- Owner can transfer ownership to another Admin; the new owner can then manage the household without the original owner present
- An Admin can recover a household whose owner has been inactive for 30+ days
- A household can be deleted after typing the household name to confirm; all owned data including R2 photos is removed
- A cat can be moved to another household by a user who is Editor/Admin in both; all measurements, medications, and photos travel with it

**Communication (Phase 2C):**
- An invitee who hasn't responded in 3 days receives one reminder email
- All Admins are notified by email when someone joins their household

## Acceptance Criteria

**Phase 2A**
- [ ] Marking a dose given writes `administered_by`; other members' inboxes show "given by [Name]"; pre-migration doses render without an actor, no crashes
- [ ] Every mutating household route writes a `household_activity` row in the same D1 batch; feed paginates via cursor; Viewer can read, nobody can write directly
- [ ] Activity rows survive actor account deletion (`SET NULL`) and display gracefully
- [ ] 90-day cron prunes `household_activity` (test with backdated rows)
- [ ] Remove-member / role-change / delete-cat all gated behind ConfirmDialog on web **and** iOS; zero remaining `window.confirm()` on these paths

**Phase 2B**
- [ ] Transfer: owner-only (403 otherwise), target must be active admin (400 otherwise), prior owner remains admin, emails sent, `audit_log` + `household_activity` entries written
- [ ] Claim: hidden/rejected while owner active within 30 days; objection cancels; owner sign-in auto-cancels; cron executes after 24h; one pending claim per household
- [ ] Delete household: owner-only, typed-name confirmation, deletes cats/measurements/medications/doses/members then household, best-effort R2 cleanup, `audit_log` written *before* deletion, fallback personal household auto-created when needed
- [ ] Move cat: dual-role check enforced server-side, `household_id` updated, care items and photos intact, activity entries in both households, confirmation mentions active care items
- [ ] Tests in `worker/src/__tests__/` for every permission-matrix row of the new endpoints (allowed + denied cases)

**Phase 2C**
- [ ] Exactly one reminder email per stale invite; admin join/removal emails sent via `sendEmail()`

---

## Open Questions (for product owner)

1. **Lock-out recovery scope for v1:** build the automated claim flow (Feature 1's `ownership_claims` + cron) now, or ship transfer-only with the documented manual `wrangler d1 execute` recovery until user count justifies automation?
2. **Delete household — data escrow:** is hard-delete acceptable, or should deletion soft-retain data for N days (undo window)? Hard-delete is specced; an undo window would add significant complexity (hidden state, cron purge) for a rare action.
3. **Activity feed granularity:** log *every* measurement (potentially dozens/day from Daily Check-In — one check-in can create 5-7 rows)? Alternative: collapse a single check-in submission into one entry ("Sarah logged a check-in for Luna: 6 measurements"). Recommendation: collapse; confirm.
4. **Feed visibility for Viewers:** v1 says all members including Viewers see everything (transparency-first). Any reservations, given pet-sitter Viewer accounts will see member-management events?
5. **Pending invitees on household deletion:** notify them by email that the invite is void, or let the link 404 gracefully? (v1 spec: 404 gracefully.)
6. **Move-cat role floor on source:** Editor+ is specced (matches delete-cat). Should it be Admin-only on both sides for symmetry with destination?
7. **`last_seen_at` privacy:** it enables "owner inactive 30+ days" checks but is also user-activity metadata. Show it anywhere in UI (e.g., members list "last active"), or keep it server-internal? (v1 spec: server-internal only.)
8. **Phase 2A iOS scope:** the activity feed needs a new iOS screen (`app/app/household.tsx` extension). Ship web+iOS together per the cross-platform rule (assumed), or web-first with a fast-follow TestFlight?

---

*Last updated: 2026-07-02*
