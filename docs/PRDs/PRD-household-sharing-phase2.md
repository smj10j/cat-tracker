# PRD: Household Sharing — Phase 2

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |
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

## Features

### 1. Ownership Transfer

**Problem:** The owner is permanent in Phase 1. No recovery exists if the owner becomes unavailable.

**Design:**

- Only the current owner can initiate a transfer.
- Transfer target must be an active Admin in the household.
- Transfer triggers a confirmation modal: "Transfer ownership to [name]? You'll remain an Admin but will no longer be the household owner. This cannot be undone."
- On confirmation: `households.owner_user_id` is updated; the prior owner's `household_members.role` stays `admin` (they do not lose membership).
- An email notification is sent to the new owner and to all other Admins.

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/household/transfer-ownership` | Owner only | `{ new_owner_user_id }` |

**Lock-out recovery path (Phase 2 requirement):**

If the owner becomes inaccessible (Google account deleted, compromised, or owner simply disappeared), a recovery path is needed. **Trigger:** Any Admin in the household can initiate a "Claim ownership" action from the `/household` page. This action is only visible when the current owner has not signed in for 30+ days (check `sessions` table for the owner's most recent `created_at`). When initiated:

1. An email is sent to all other Admins in the household: "[Name] has requested ownership of [Household]. If you do not object, ownership will transfer in 24 hours."
2. Any other Admin can cancel the transfer within 24 hours by clicking a link in the email.
3. After 24 hours with no cancellation, the requesting Admin becomes the new owner.

This is an edge case but must exist before the product is considered reliable for multi-person households. The 30-day inactivity gate prevents casual ownership grabs while the original owner is simply on vacation.

**Pragmatic alternative for v1:** If the automated recovery flow proves too complex to build in the first pass, an acceptable interim is a documented manual process: the Admin emails the developer (or uses a support form) with their household ID, and ownership is transferred via `wrangler d1 execute`. This is fine for the current user base. The automated flow becomes necessary when the user count grows beyond what manual support can handle.

---

### 2. Delete Household

**Problem:** A household cannot currently be retired or removed.

**Design:**

- Only the owner can delete a household.
- The delete flow has two steps:
  1. Owner sees: "Deleting this household will permanently remove [N] cats and all their measurements. This cannot be undone."
  2. Owner must type the household name to confirm (destructive-action confirmation pattern).
- **Alternative: Transfer cats before deleting.** The delete modal shows a "Move cats to another household first" option if the owner belongs to another household — surfaces the Move Cats feature naturally.
- On deletion: all `cats`, `measurements`, `medications`, `medication_doses`, and `household_members` rows for this household are deleted. The `households` row is deleted last.
- **R2 photo cleanup:** For each cat being deleted, the handler must also delete the R2 object at `cats/{cat_id}/photo.jpg` if it exists. Without this, photos become orphaned in the R2 bucket with no referencing database row. Use `env.PHOTOS.delete(key)` for each cat — batch if possible. Failure to delete an R2 object should log a warning but not block the household deletion (the D1 data is the primary concern; orphaned R2 objects can be cleaned up later).
- **Audit log entries:** If PRD-security-phase2.md SEC-15 (audit logging) is implemented, the household deletion must write an audit entry *before* deleting the data. The audit entry should capture the household name, member count, and cat count for forensic context.
- If the owner is not in any other household, a personal household is auto-created for them (consistent with signup behavior) to ensure they always have a household.

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

**UI location:** Cat profile → Edit cat → "Move to another household" link (only visible if user has Admin role in 2+ households).

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/api/cats/:id/move` | Editor+ source, Admin+ dest | `{ destination_household_id }` |

---

### 4. Activity Feed / Audit Log

**Problem:** Members have no visibility into household actions. For households with a sick cat and multiple caretakers, this is a significant gap: "Did someone already give Luna her thyroid pill this morning?"

**Design:**

The audit log records who did what and when. It is household-scoped and visible to all active members.

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
| Member joined | "Maria (pet sitter) joined as Contributor" |
| Member removed | "Steve removed Maria from the household" |
| Role changed | "Steve changed Sarah's role from Contributor to Editor" |
| Invite sent | "Steve sent an invite to grandma@example.com" |
| Invite revoked | "Steve revoked grandma@example.com's invite" |
| Ownership transferred | "Steve transferred ownership to Sarah" |

**UI:**

- Accessible from the `/household` page: "Activity →" link or tab below the members list.
- `/household/activity` — paginated list of events, newest first.
- Each row: avatar initial + actor name + action text + time (relative: "3 hours ago"; absolute on hover).
- Filter by cat or by member (optional, Phase 2 stretch goal).
- Retention: keep 90 days of events. Older events pruned by daily cron.

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

**Implementation note:** Write activity entries in the same D1 batch as the mutation that triggered them. Not a separate async step — this ensures consistency. Each route that modifies household data calls a shared `logActivity(db, householdId, actorId, eventType, entityType, entityId, displayText)` helper.

**Stale display names:** The `display_text` column is pre-rendered at write time (e.g., "Sarah logged Luna's weight: 9.4 lbs"). If Sarah later changes her Google display name, old activity entries will show the old name. This is intentional and acceptable — activity entries are historical records of what happened at that point in time. Do not attempt to retroactively update `display_text` on name changes.

**Privacy:** All household members (including Viewers) can see all activity entries. This is intentional — the audit log is a transparency feature for shared cat care. There is no concept of Admin-only activity entries in v1. If this becomes a concern (e.g., "Sarah removed Maria" being visible to the remaining Contributor), it can be addressed in a future phase by adding a `min_role_visible TEXT` column.

**Relationship to security audit log (PRD-security-phase2.md SEC-15):** The `household_activity` table is user-facing (rendered in UI, friendly display_text, household-scoped). The `audit_log` table is for security forensics (ip_address, user_agent, global scope). They serve different purposes. Do not merge them.

---

### 5. Household-Wide Medication Notifications

**Problem:** When one household member marks a dose as given, others don't know. A cat with twice-daily medication could accidentally receive double doses if two caretakers don't coordinate.

**Design:**

**In-app notification** (extends the existing `/notifications` inbox from PRD-medication-reminders.md):

- When a dose is marked given or skipped by *another* household member, all other members who have the cat in their household receive a notification entry: "Maria marked Luna's Methimazole as given · 20 min ago".
- These entries appear in the "Due Today" section of the `/notifications` page, with the dose shown as completed (dimmed, with the actor's name).
- The notification is only generated when the *actor is not the current viewer* — no self-notification.

**Push notification** (only if PRD-medication-reminders.md Phase B is implemented):

- If a household member has granted push permission, they receive a push when a co-member marks a dose.
- Format: "Luna's Methimazole was given by Maria" with a muted style (not the same urgency as an overdue dose alert).

**Database change (to medication_doses):**

```sql
ALTER TABLE medication_doses ADD COLUMN administered_by TEXT REFERENCES users(id);
```

**Migration note:** The `medication_doses` table currently has columns: `id`, `medication_id`, `due_at`, `administered_at`, `skipped`, `skip_reason`, `notes`, `created_at`. The `administered_by` column does not exist yet. Use `ADD COLUMN IF NOT EXISTS` per project convention. All existing administered doses will have `administered_by = NULL`, which the UI should handle gracefully — display "Marked as given" without an actor name for pre-migration doses.

Already stored as `administered_at` (timestamp) in Phase A. The `administered_by` column adds the actor, enabling "marked given by Maria" display.

**API change:** `POST /api/doses/:id/administer` already exists in `worker/src/routes/medications.ts`. Add `administered_by = userId` (from the auth context) when recording the dose. No endpoint signature change needed — it's the same route, just a new column written. The `userId` is already available from the `requireAuth` middleware.

---

### 6. Confirmation Dialogs for High-Impact Actions

**Problem:** Phase 1 shipped without confirmation dialogs for destructive or high-impact actions.

**Actions requiring confirmation:**

| Action | Confirmation prompt |
|--------|-------------------|
| Remove member | "Remove [name] from this household? They'll lose access immediately. Their data stays." |
| Downgrade Admin to lower role | "Change [name]'s role to [role]? They'll lose the ability to invite and remove members." |
| Transfer ownership | "Transfer ownership to [name]? This cannot be undone." (requires typing name to confirm) |
| Delete household | Two-step: impact summary, then type household name to confirm |
| Delete cat | "Delete [name]? All measurements, medications, and history will be permanently removed." |

**Implementation note:** These are modal dialogs (not browser `confirm()`), styled consistently with the app's dark/light-mode palette (respect CSS variables from PRD-app-settings.md). Build a shared `ConfirmDialog` component with two variants:

1. **Simple confirmation:** Title, message, Cancel/Confirm buttons. Used for: remove member, downgrade role, delete cat.
2. **Destructive confirmation with text input:** Title, impact summary, a text input that must match a specific string (e.g., the household name) before the confirm button enables. Used for: delete household, transfer ownership.

The text-input variant prevents accidental confirmation of high-impact actions. The confirm button is disabled until the input matches exactly (case-sensitive). This replaces the current browser `confirm()` calls in `HouseholdPage.tsx` (line ~110) for role changes and member removal.

---

### 7. Invitation UX Improvements (Phase B from Phase 1)

The following items were deferred from PRD-household-sharing.md Phase B:

**7a. Invitation reminder email:**
If an invite hasn't been accepted after 3 days, send one reminder email to the invitee (same template as the original, with subject "Reminder: You've been invited to..."). Only one reminder per invite.

**7b. Admin notification on member join:**
When someone accepts an invite, send an email to all Admins: "[Name] joined [Household] as [Role]."

**7c. Admin notification on member removal:**
When an Admin removes a member, the removed member receives an email: "You've been removed from [Household] on Cat Tracker." Brief and factual — no justification required.

These all use the shared `sendEmail()` utility from `worker/src/lib/email.ts` (established in Decision #4 of PRD-household-sharing.md).

---

## Implementation Plan

> **Ordering rationale:** Phase 2A ships the highest-frequency, highest-safety-impact feature first — the activity feed that prevents double-dosing. This is a daily pain point for multi-caretaker households. Lifecycle operations (ownership transfer, delete, move) are important but rare; they move to 2B. Email polish is lowest-priority and moves to 2C.

### Phase 2A — Transparency and medication coordination (highest daily value)
1. `administered_by` column on medication_doses + migration
2. Update `POST /api/doses/:id/administer` to write `administered_by = userId`
3. Update notifications page to show "Marked as given by [Name]" for co-member doses
4. `household_activity` table and `logActivity()` helper
5. Activity event writes in all mutating routes (measurements, doses, cats, members)
6. `/household/activity` page with paginated feed
7. Confirmation dialogs: shared `ConfirmDialog` component (simple + destructive variants)
8. Apply confirmation dialogs to: remove member, role change, delete cat

### Phase 2B — Lifecycle and safety (rare but important)
9. Ownership transfer endpoint + UI + email notification
10. Admin lock-out recovery path (30-day inactivity trigger, 24-hour objection window)
11. Delete household endpoint + two-step UI (with R2 photo cleanup)
12. Move cats between households (API + cat edit UI entry point)

### Phase 2C — Communication polish
13. Invitation reminder email (3-day resend)
14. Admin email on member join
15. Admin/member email on removal
16. Push notifications for co-member dose events (if Phase B of medication PRD is live)

---

## Dependencies & Cross-PRD Continuity

| Dependency | Notes |
|-----------|-------|
| PRD-household-sharing.md Phase A | Must be fully implemented before any Phase 2 work. **Status: done.** |
| `worker/src/lib/email.ts` | Shared `sendEmail()` utility — already exists and is used by Phase A invite flow. Ready for Phase 2C email notifications. |
| PRD-medication-reminders.md Phase B (push) | Only required for Phase 2C push notifications; rest of Phase 2 is independent |
| PRD-security-phase2.md SEC-15 (audit log) | If implemented before household Phase 2, the delete-household and ownership-transfer flows should write audit entries. If SEC-15 is not yet implemented, skip the audit writes — they can be backfilled later. Do not block Phase 2 on SEC-15. |
| PRD-cat-photos.md (R2 infrastructure) | The delete-household flow must clean up R2 photos. The R2 bucket binding (`PHOTOS`) already exists in `worker/src/types.ts`. |
| PRD-household-sharing.md Phase B (confirmation dialogs) | Phase B of the original PRD proposed custom confirmation dialogs. Phase 2 of *this* PRD also requires them (Feature #6). **These should be implemented once, in this PRD, not separately.** If Phase B of the original PRD is implemented first, reuse the `ConfirmDialog` component. If not, implement it here and retroactively apply to Phase B items (role change, member removal). |

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
