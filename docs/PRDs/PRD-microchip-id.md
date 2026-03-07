# PRD: Microchip ID as Cat Identifier

| | |
|---|---|
| **Status** | `Draft` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |

---

## Problem

Cats in the real world are identified by microchips — a globally unique 15-digit ISO 11784/11785 number implanted under the skin. Cat Tracker currently identifies cats by an opaque internal UUID, with the display name as the only human-meaningful identifier.

This creates friction in two situations:

1. **Multiple-household tracking:** A cat may be tracked by a shelter, a vet, and an owner in separate Cat Tracker accounts. There is currently no way to know they are the same cat.
2. **Import/export ambiguity:** CSV imports use the cat's name to match records. Names are not unique; microchip IDs are.

**Goal:** Add an optional but uniqueness-enforced `microchip_id` field to cats. When populated, it acts as the durable, cross-account identifier for a physical cat.

---

## Scope

- Add `microchip_id` as an editable field on the cat add and edit forms
- Auto-assign a placeholder value (`temp-microchip-id-<GUID>`) when the field is left blank
- Enforce uniqueness of real microchip IDs (anything not prefixed with `temp-microchip-id-`)
- Handle conflicts gracefully on create, edit, and import
- Do **not** change URL structure (URLs still use the internal `id`)
- Do **not** make microchip_id a required field at the UI level; it is optional

---

## Data Model

### Schema change

```sql
ALTER TABLE cats ADD COLUMN microchip_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cats_microchip ON cats(microchip_id)
  WHERE microchip_id IS NOT NULL AND microchip_id NOT LIKE 'temp-microchip-id-%';
```

A partial unique index excludes placeholder values, allowing multiple cats with `temp-microchip-id-*` IDs without conflicting.

### Auto-generation

When `microchip_id` is absent or empty on `POST /api/cats`:

```
microchip_id = "temp-microchip-id-" + crypto.randomUUID()
```

This ensures every cat always has a `microchip_id` value, but placeholder IDs are visually distinguishable from real ones in the UI.

---

## UI Changes

### Add Cat page (`/cats/new`)

- New optional field: **Microchip ID**
- Placeholder text: `e.g. 985112345678903`
- Helper text: "Leave blank to fill in later"
- Shown below Name, above Birthdate

### Edit Cat page (`/cats/:id/edit`)

- Same field, now pre-populated with the current value
- If the current value starts with `temp-microchip-id-`, show as blank (render as empty, submit as empty → re-generate on save) or show a muted "Not set" placeholder
- User can type a real microchip ID to replace the placeholder

### Validation (client-side)

- Must be numeric or alphanumeric (no spaces); warn but do not block on invalid format
- Duplicate detection: show inline error if the server returns a 409

---

## Conflict Resolution

### Scenario A: Same user, duplicate microchip ID across two cats

- This is almost certainly a data-entry error (the user typed the same chip number twice)
- Worker returns `409 Conflict` with body `{ error: "microchip_id_conflict", conflictingCatName: "Luna" }`
- UI shows: *"This microchip ID is already used by Luna. Check for a typo, or edit Luna to update her record."*

### Scenario B: Different user has already registered this microchip ID

- Two users tracking the same physical cat (e.g., vet and owner, shelter and adopter)
- The system should **not** expose that another account exists (privacy)
- Worker still returns `409 Conflict` with body `{ error: "microchip_id_conflict" }` — **without** a `conflictingCatName` (it belongs to another user)
- UI shows: *"This microchip ID is already registered. If this is your cat, contact support."*

### Scenario C: Editing a cat to take a microchip ID owned by a different one of the user's cats

- Same as Scenario A: show conflict message naming the other cat.

### Server-side conflict detection

The worker must query:

```sql
SELECT id, name, user_id FROM cats WHERE microchip_id = ? AND id != ?
```

- If no row: proceed
- If row has `user_id = current_user_id`: return 409 with `conflictingCatName`
- If row has `user_id != current_user_id`: return 409 without `conflictingCatName`

---

## Import (CSV)

- CSV may include an optional `microchip_id` column
- If a row's `microchip_id` matches an existing cat owned by the importing user → treat as an update to that cat (upsert by microchip_id)
- If a row's `microchip_id` conflicts with another user's cat → skip row, include in import error summary
- If `microchip_id` column absent or blank → generate temp ID as usual

---

## Display

- On the cat profile page, show microchip ID as a small metadata chip below the name if it is a real ID (not a placeholder)
- Format: `# 985 112 345 678 903` (spaced for readability)
- On the edit page, show both real and temp values

---

## Non-goals

- No cross-account merging or sharing of cat records based on microchip ID (that's PRD-killer-app.md P5 household sharing)
- No validation against external microchip databases
- No change to internal `id` used in URLs and foreign keys

---

## Open Questions

1. **Should real microchip IDs be globally unique or per-user unique?** This PRD recommends global uniqueness (matching real-world semantics) with a privacy-preserving conflict message for cross-account conflicts. An alternative is per-user uniqueness, which is simpler but allows the same chip to be registered in multiple accounts indefinitely.

2. **Partial-index support in D1:** SQLite supports partial unique indexes; D1 should too, but this needs verification in production.

3. **Migration for existing cats:** Existing cats need a `microchip_id` assigned. Options:
   - (a) Run a migration script to assign `temp-microchip-id-<GUID>` to all rows with `microchip_id IS NULL`
   - (b) Treat `NULL` as "not set" and only enforce uniqueness on non-null non-temp values
   - Option (b) is simpler and avoids needing a migration script. Recommended.

---

## Implementation Plan (when approved)

1. DB: add column; create partial unique index
2. Worker: update `POST /api/cats` and `PUT /api/cats/:id` to accept and validate `microchip_id`; add conflict detection query
3. Worker: update `POST /api/import` to support `microchip_id` column
4. Frontend `api.ts`: add `microchip_id` to `Cat` interface
5. Frontend `AddEditCat.tsx`: add input field; handle 409 conflict errors
6. Frontend `CatProfile.tsx`: display microchip ID badge when real ID is set
