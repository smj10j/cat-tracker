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

If no owner exists (account deleted in Google), a recovery path is available: any Admin in the household can claim ownership via a 24-hour email confirmation flow sent to all Admins. This is an edge case but must exist.

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
- If the owner is not in any other household, a personal household is auto-created for them (consistent with signup behavior) to ensure they always have a household.

**API:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `DELETE` | `/api/household` | Owner only | Deletes household and all owned data |

---

### 3. Move Cats Between Households

**Problem:** Phase 1 creates one household per user, but cats may need to be reassigned — when a cat physically moves to a new home, when a user reorganizes their household structure, or when accepting the Phase 1 limitation that invited users' pre-existing cats don't auto-merge.

**Design:**

- **Who can move a cat**: Editor or Admin of the *source* household AND Admin of the *destination* household.
- Source and destination must both be households the requesting user is an active member of with sufficient role (not two different users coordinating — single user with access to both).
- The move is instantaneous; all measurements, medications, and doses travel with the cat.
- A confirmation dialog shows: "Move [Cat Name] to [Destination]? All measurements and medications will move too."
- The moved cat's `household_id` is updated; `cats.user_id` (legacy attribution) is preserved.

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

Already stored as `administered_at` and `status='given'` in Phase A. The `administered_by` column adds the actor, enabling "marked given by Maria" display.

**API change:** `POST /api/doses/:id/administer` already exists. Add `administered_by = userId` when recording the dose. No endpoint change needed — it's the same route, just a new column written.

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

**Implementation note:** These are modal dialogs (not browser `confirm()`), styled consistently with the app's dark-mode palette. Use a shared `ConfirmDialog` component.

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

### Phase 2A — Safety and lifecycle (required before enterprise use)
1. Ownership transfer endpoint + UI + email notification
2. Admin lock-out recovery path (edge case but must exist)
3. Confirmation dialogs: remove member, role change, ownership transfer
4. Delete household endpoint + two-step UI
5. Move cats between households (API + cat edit UI entry point)

### Phase 2B — Transparency and coordination
6. `household_activity` table and `logActivity()` helper
7. Activity event writes in all mutating routes
8. `/household/activity` page
9. `administered_by` on medication_doses; update notifications page to show actor name
10. Household-wide dose notifications in inbox

### Phase 2C — Polish and communication
11. Invitation reminder email (3-day resend)
12. Admin email on member join
13. Admin/member email on removal
14. Push notifications for co-member dose events (if Phase B of medication PRD is live)

---

## Dependencies

| Dependency | Notes |
|-----------|-------|
| PRD-household-sharing.md Phase A | Must be fully implemented before any Phase 2 work |
| `worker/src/lib/email.ts` | Shared sendEmail utility — must exist before invitation emails in Phase 2C |
| PRD-medication-reminders.md Phase B (push) | Only required for Phase 2C push notifications; rest of Phase 2 is independent |

---

## Success Criteria

- Owner can transfer ownership to another Admin; the new owner can then manage the household without the original owner
- A household can be deleted after explicit confirmation; all owned data is removed
- A cat can be moved to another household by a user who is Editor/Admin in both
- Members can see who logged which measurement and who marked which dose — within 90-day retention window
- A double-dose scenario is prevented by "marked by Maria" visibility in the notification inbox
- Removing a member requires a confirmation dialog; the action is never a single tap
