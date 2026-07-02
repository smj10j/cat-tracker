# PRD: Health Alert Acknowledgment

> **Status:** Approved
> **Created:** 2026-04-11
> **Last updated:** 2026-07-02

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
- Acknowledging correlation/confluence patterns from `detectCorrelations()` (v1 covers the weight health alert only; the patterns section is already collapsed by default per PRD-profile-clarity.md)
- Server-side recomputation of health status (health remains a client-side computation; see "Alert identity" below)

---

## User Stories

- **As a cat owner whose cat is on a vet-supervised weight-loss plan**, I want to acknowledge the "weight loss" alert once, so the home screen stops glowing red every day for a decline my vet prescribed.
- **As an owner who just booked a vet appointment**, I want to note "Vet visit Thursday" on the alert, so when I open the app Wednesday I remember why I'm not worried yet.
- **As a household member**, I want to see that my partner already acknowledged Luna's alert (and their note), so we don't both independently panic-book vet appointments.
- **As the same owner two weeks later**, I want the alert to come back at full intensity if the situation gets worse (concerning → urgent), because "I'm handling it" was about the situation I saw, not any future one.
- **As a vet reading an export**, I want to see the true health status plus a record that the owner acknowledged it and when, so I get honest data with owner context.
- **As a cautious user**, I want to be able to undo an acknowledgment ("actually, I *am* worried"), restoring the full-intensity alert.

---

## How Alerts Work Today (context)

There is **no stored alert entity**. Health status is computed client-side, on every render, by `assessHealth()` in `shared/lib/healthMetrics.ts`:

- Input: the cat's weight measurements (+ optional `ThresholdOverrides` served by `GET /api/config`, see PRD-api-versioning.md Phase B).
- Output: a `HealthAssessment` — `overallStatus` (`ok | watch | concerning | urgent`), per-period classifications, `peakLossPct`, `referencePeak`, and a human-readable `summary`.
- Rendered by: Home cat cards, `InsightsPanel.tsx` (web + iOS — the primary surface), `CatHealthGuidance.tsx`, `CatExportPage.tsx`.

Consequences for this feature:

1. Any two clients recompute the alert independently; the "same" alert has no ID.
2. The status can change without new data — e.g., a measurement is deleted, the reference-peak 180-day window slides, or the server pushes new threshold overrides via `/api/config`.
3. The server cannot validate a claimed status; it never sees a computed assessment.

## Alert Identity (the crux)

**What identifies "the same alert" across recomputation?**

Rejected options:

- **Hash of the assessment output** (summary text, rates, peakLossPct): invalidated by every new weigh-in, rounding change, threshold override, or copy edit. Acks would silently evaporate weekly. Rejected.
- **Latest measurement ID**: a new measurement that doesn't change the picture (another stable weigh-in during a plateau of loss) would invalidate the ack even though nothing changed for the user. Rejected.
- **Stored server-side alert rows**: requires moving `assessHealth()` to the Worker or mirroring it — a large architectural change contradicting the shared-lib design and the api-versioning threshold-override model. Rejected for v1.

**Chosen model — severity-rank episodes:**

An acknowledgment is a statement: *"I know about a weight alert of severity S (direction D) on cat C, as of this moment."* It is keyed to `(cat_id, alert_kind, acknowledged_severity, direction)` — not to any particular computation.

- **Severity rank**: `ok=0 < watch=1 < concerning=2 < urgent=3` (same ordering as `worstStatus()` in `healthMetrics.ts`).
- **Direction**: `loss | gain` — derived at ack time from the assessment (`peakLossPct > 0` or worst period direction). A gain-watch and a loss-watch are clinically different alerts even at equal rank.
- **Episode**: a contiguous run of non-ok `overallStatus`. When status returns to `ok`, the episode is over and the ack is *resolved*; the next non-ok status starts a new episode and alerts at full intensity.

**Suppression rule (evaluated client-side at render, single shared implementation):**

```
given: current assessment A, active ack K for the same cat + kind
suppress (show acknowledged state) iff:
  rank(A.overallStatus) <= rank(K.acknowledged_severity)
  AND direction(A) == K.direction
  AND K not expired
otherwise: show full-intensity alert (ack is superseded)
```

This rule lives in a new shared module (proposed: `shared/lib/alertAck.ts`, e.g. `applyAcknowledgment(assessment, ack): { suppressed: boolean, reason }`), used by web and iOS identically. Recomputation with new data, deleted data, or new server thresholds all flow through the same comparison — no special cases.

The server stores the ack verbatim and never verifies the claimed severity (it can't). Validation is enum-level only. This is an accepted trust boundary: the worst a malicious client can do is quiet its own household's alert display.

---

## Re-trigger Semantics

When does an acknowledged alert resurface at full intensity?

| Event | Result |
|-------|--------|
| Status **worsens** past the acknowledged severity (watch→concerning, concerning→urgent) | Ack superseded — full alert returns immediately. This is the core safety property. |
| Direction **flips** (loss → gain or vice versa) at any severity | Ack superseded — it's a different clinical concern. |
| Status stays at the same severity (new measurements, same picture) | Ack persists — the user said they're handling *this*. |
| Status **improves but is still non-ok** (concerning → watch) | Ack persists (suppression rule: current rank ≤ acked rank). |
| Status returns to **ok** | Episode over. Ack is resolved (silently; no UI). The *next* non-ok status is a new episode → full alert. |
| **N days elapse** since acknowledgment (default proposal: **30 days**) | Ack expires — full alert returns with a gentle framing ("Still ongoing — you acknowledged this 30 days ago"). Forces periodic re-evaluation of long-running conditions; an acknowledged *urgent* status should never sleep forever. Expiry length is Open Question #1. |
| Server threshold overrides change the computed status without new data | No special case — the severity comparison handles it like any recomputation. |

**Resolution mechanics:** since the server never computes status, resolution is lazy. When a client renders `ok` while holding an active ack, it fire-and-forgets a resolve call (or the server resolves the stale ack automatically when the next ack for that cat is created). A single noisy "ok" reading could prematurely resolve an ack and re-alarm later; whether to debounce resolution (require ok on 2 consecutive assessments) is Open Question #3.

---

## Requirements

### R1: Acknowledge Action
- On the InsightsPanel (CatProfile — primary surface) a button appears inside the health headline block for watch/concerning/urgent alerts: proposed copy **"I'm on it"** (final wording Open Question #4)
- The Home cat card gets no button in v1 (too small a target); it reflects the acknowledged state only
- Tapping opens a lightweight inline confirm with an **optional note field** (≤ 280 chars): "Vet visit scheduled for Thursday", "Switching food brands"
- The ack records: who, when, severity + direction at that moment, note
- Requires **Contributor role or higher** in the cat's household (Viewers can see acks, not create them)
- An active ack can be withdrawn ("Undo") by any Contributor+ member, restoring the full alert

### R2: Acknowledged Visual State
- Home cat card: border/glow returns to the neutral "ok" treatment; a muted pill replaces the status badge — e.g. `👀 Acknowledged` in dim text (status emoji retained for color-independence, per PRD-accessibility.md)
- InsightsPanel: keeps the full health status text and summary, but drops the tinted panel background/border/pulse to neutral intensity; adds a line: **"Acknowledged by [name] · [date]"** with the note beneath, plus an "Undo" affordance
- `CatHealthGuidance.tsx` (the "what to watch for" page) is **not** muted — a user who navigates there wants full information
- The real status emoji/label is always still visible — reduced urgency, never hidden data

### R3: Auto-Reset
- Implemented via the re-trigger semantics table above (worsen or direction-flip → superseded; return-to-ok → resolved; N days → expired)
- Superseding/resolution never deletes rows — ack history is kept (row status transitions: `active → superseded | resolved | expired | withdrawn`)

### R4: Vet Export Transparency
- The vet export (`CatExportPage.tsx`, and the iOS export/Sitter surfaces) always shows the **real** computed health status — never the muted version
- If an active or recently-superseded ack exists, the export adds one line: *"Owner acknowledged this status on [date]: [note]"*

### R5: Household Semantics
- Acknowledgment is **per-cat, household-wide** — one member's ack applies for everyone. It is a statement about the cat's care, not a personal notification preference (resolves original Open Question #4)
- The actor's display name is shown so other members know who is "on it"
- If PRD-household-sharing-phase2.md's activity feed ships, ack/withdraw events are logged there ("Steve acknowledged Luna's weight alert")

### R6: Cross-Platform Parity
- Web and iOS ship together: shared suppression logic in `shared/lib/`, new API methods added to `CatTrackerApi` in `shared/lib/apiTypes.ts` first (compile-time conformance on both clients), UI applied to both `frontend/src/components/InsightsPanel.tsx` and `app/components/InsightsPanel.tsx`, and both Home screens

---

## Data Model

New table (`worker/src/db/schema.sql`), keeping full history with at most one active row per cat + kind:

```sql
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id                 TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  alert_kind             TEXT NOT NULL DEFAULT 'weight',   -- future: 'behavioral', 'confluence'
  acknowledged_severity  TEXT NOT NULL,                    -- 'watch' | 'concerning' | 'urgent'
  direction              TEXT NOT NULL,                    -- 'loss' | 'gain'
  acknowledged_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  note                   TEXT,                             -- <= 280 chars, validated server-side
  latest_measured_at     TEXT NOT NULL,                    -- watermark: newest weight measurement at ack time (display/debug, not identity)
  context                TEXT,                             -- JSON snapshot: { peakLossPct, worstRatePerWeek, summary } for export/history display
  status                 TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'superseded' | 'resolved' | 'expired' | 'withdrawn'
  expires_at             TEXT,                             -- created_at + N days; null = no expiry (pending Open Question #1)
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at               TEXT                              -- when status left 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ack_active
  ON alert_acknowledgments(cat_id, alert_kind) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ack_cat ON alert_acknowledgments(cat_id, created_at DESC);
```

Notes:
- A separate table (not columns on `cats`) — preserves history for the vet-export note and future analytics, and keeps `cats` clean (resolves original Open Question #1)
- `latest_measured_at` and `context` are **snapshots for display**, not part of alert identity — identity is `(cat_id, alert_kind, acknowledged_severity, direction)` per the suppression rule
- `ON DELETE CASCADE` from cats: acks travel with the cat on household move (Phase 2 `cats.household_id` update touches nothing here) and die with cat deletion

## API Sketch

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `PUT` | `/api/cats/:id/acknowledgment` | Contributor+ in cat's household | Body `{ kind: 'weight', severity, direction, note?, latest_measured_at, context? }`. Upsert: marks any existing active ack for (cat, kind) as `superseded`, inserts new `active` row. Returns the ack. |
| `DELETE` | `/api/cats/:id/acknowledgment?kind=weight` | Contributor+ | Withdraw: active row → `withdrawn`. 404 if none active. |
| `POST` | `/api/cats/:id/acknowledgment/resolve` | Contributor+ (fire-and-forget from clients) | Active row → `resolved` when a client observes `ok`. Idempotent. |

Read path: **no dedicated GET**. The active ack is embedded in existing responses to avoid N+1 on the Home screen:

- `GET /api/cats` → each cat gains `acknowledgment: AckRecord | null`
- `GET /api/cats/:id` → same field

Server validation: enum checks (`severity`, `direction`, `kind`), note length (add `ACK_NOTE: 280` to `LIMITS` in `shared/lib/constants.ts`), role check via existing household authorization helpers. Expiry enforced read-side (`expires_at < now` treated as expired even before any write flips the row).

## UX

### Web (`frontend/`)
- **InsightsPanel** (primary): "I'm on it" ghost button under the status summary → expands inline to note field + Confirm. Acknowledged state: neutral panel chrome, `Acknowledged by Sarah · Jun 12 — "Vet on Thursday"` line, small "Undo" text button
- **Home cat card**: swaps status-tinted border/badge for neutral border + muted `👀 Acknowledged` pill
- **CatExportPage**: appends the owner-acknowledgment line under the health summary (R4)

### iOS (`app/`)
- Mirror of the web treatment in `app/components/InsightsPanel.tsx` (Pressable + inline TextInput, 44pt targets), Home card parity in the cats list
- Uses the same shared suppression helper and API client method (Bearer transport)

Both platforms re-render from the embedded `acknowledgment` field; no polling. Acking is optimistic-UI with rollback on error; offline iOS shows the standard error toast (no offline queue in v1).

---

## Edge Cases

1. **New measurement at same severity** → still suppressed (identity is severity+direction, not data)
2. **Measurement deleted, status worsens** (e.g., deleting a recovery weigh-in) → severity rule supersedes the ack; full alert returns
3. **Server threshold override changes status with no new data** → same rule; no special handling
4. **Two members ack concurrently** → partial unique index serializes; second PUT supersedes the first (last-write-wins, both rows in history)
5. **Ack raced by new data** (status changed between render and tap) → server accepts the stale severity; the suppression rule immediately shows the correct state on next render — harmless
6. **Transient ok reading resolves the ack, then loss resumes** → new episode, full alert. Correct but potentially noisy; see Open Question #3 (debounced resolution)
7. **Acknowledging user leaves the household / deletes account** → `acknowledged_by` is `SET NULL`; display falls back to "a household member"
8. **Deceased cats** → alerts aren't rendered for deceased cats (existing behavior); acks are inert and cascade-delete with the cat
9. **Cat moved between households** (Phase 2) → ack rows follow `cat_id`; new household members see the previous household's active ack — acceptable (it's about the cat), noted for the Phase 2 PRD
10. **Fewer than 2 weight measurements** → status is always `ok`; no ack UI ever shows
11. **Expired ack** → read-side expiry means clients on stale caches converge on next fetch; no cron needed (optional cron cleanup can flip rows for hygiene)

---

## Acceptance Criteria

- [ ] Acknowledging a watch/concerning/urgent alert from CatProfile immediately mutes the Home card and InsightsPanel on **both** web and iOS for **all** household members (after refetch)
- [ ] The acknowledged state shows actor name, date, and note; real status emoji/label remains visible
- [ ] A status worsening past the acknowledged severity restores the full-intensity alert with no user action
- [ ] A direction flip (loss→gain) restores the full-intensity alert even at equal severity
- [ ] Status improving to ok and later degrading again produces a fresh, un-acknowledged alert
- [ ] Withdraw ("Undo") restores the full alert; a Viewer-role member sees but cannot create/withdraw acks (403 server-side)
- [ ] Vet export shows the true status plus the acknowledgment line when one exists
- [ ] All suppression logic lives in `shared/lib/` with unit tests covering the re-trigger table above; API methods declared in `shared/lib/apiTypes.ts`; worker route tests for role enforcement, upsert semantics, and note-length validation
- [ ] No schema change to `measurements` or `cats`

---

## Open Questions (for product owner)

1. **Expiry:** Is 30 days the right default before an ack force-expires? Should it vary by severity (e.g., urgent = 14 days, watch = 60/never)? Should it be server-configurable via `/api/config` thresholds?
2. **Role floor:** Contributor+ to acknowledge is proposed (they can already log data). Should it be Editor+ instead, since an ack changes what *everyone* sees?
3. **Resolution debounce:** Resolve the ack on the first `ok` assessment, or require ok to persist (2 consecutive assessments / ≥ N days) to avoid churn from one noisy scale reading?
4. **Wording:** "Acknowledge" is clinical. Proposed button copy is "I'm on it"; alternatives "Got it", "Noted". Pick one (and the muted pill text).
5. **Home card action:** Should the Home card also offer a long-press/swipe ack shortcut, or is CatProfile-only sufficient for v1?
6. **Scope creep guard:** Confirm v1 is weight-alert-only (`alert_kind='weight'`), with behavioral/confluence acks explicitly deferred (they become relevant if PRD-behavioral-trends.md ships alert-like copy).

---

*Last updated: 2026-07-02*
