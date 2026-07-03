/**
 * Shared types for Whisker Health — used by both frontend/ and app/.
 *
 * This is the SINGLE SOURCE OF TRUTH for all API response shapes.
 * Do not duplicate these interfaces in platform-specific code.
 */

export interface Cat {
  id: string;
  name: string;
  birthdate: string;
  breed: string | null;
  coloring: string | null;
  notes: string | null;
  photo_url: string | null;
  sex: string | null;
  is_neutered: number | null;
  microchip_id: string | null;
  household_id: string | null;
  household_name: string | null;
  deceased_at: string | null;
  memorial_note: string | null;
  created_at: string;
  updated_at: string;
  // Active health-alert acknowledgment for this cat, embedded in cat responses
  // (PRD-alert-acknowledgment). null when there is none.
  acknowledgment?: AckRecord | null;
}

// ---------------------------------------------------------------------------
// Health alert acknowledgment (PRD-alert-acknowledgment)
// ---------------------------------------------------------------------------

export type AckSeverity = 'watch' | 'concerning' | 'urgent';
export type AckDirection = 'loss' | 'gain';
export type AckStatus = 'active' | 'superseded' | 'resolved' | 'expired' | 'withdrawn';

export interface AckRecord {
  id: string;
  cat_id: string;
  alert_kind: string;                    // 'weight' in v1
  acknowledged_severity: AckSeverity;    // severity the user acknowledged
  direction: AckDirection;               // loss vs gain — a different clinical concern
  acknowledged_by: string | null;        // user id (SET NULL if the user is deleted)
  acknowledged_by_name: string | null;   // joined display name for UI
  note: string | null;                   // <= 280 chars
  latest_measured_at: string;            // newest weight measurement at ack time (display/debug)
  context: string | null;                // JSON snapshot { peakLossPct, summary } for export
  status: AckStatus;
  expires_at: string | null;             // created_at + N days; null = no expiry
  created_at: string;
  ended_at: string | null;               // when status left 'active'
}

export interface Measurement {
  id: string;
  cat_id: string;
  type: string;
  value: number;
  unit: string;
  measured_at: string;
  notes: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  email_reminders?: number;
  oauth_provider: string;
  hasOrphanedCats: boolean;
  session_age_seconds?: number;
}

export interface Medication {
  id: string;
  cat_id: string;
  user_id: string;
  name: string;
  type: string;
  dose: string | null;
  frequency: string;
  frequency_days: number | null;
  reminder_time: string;
  start_date: string;
  end_date: string | null;
  doses_total: number | null;
  notes: string | null;
  is_active: number;
  doses_remaining: number | null;
  refill_alert_threshold: number | null;
  schedule_mode?: 'fixed' | 'interval';
  created_at: string;
  updated_at: string;
  next_due_at?: string | null;
  overdue_count?: number;
  last_given_at?: string | null;
  /** Per-caller push mute state (PRD-actionable-notifications Phase C). 1 = the
   *  requesting user muted this item's reminders; 0/undefined = not muted. */
  muted?: number;
}

export interface MedicationDose {
  id: string;
  medication_id: string;
  due_at: string;
  administered_at: string | null;
  skipped: number;
  skip_reason: string | null;
  notes: string | null;
  missed?: number;
  snoozed_until?: string | null;
  created_at: string;
}

export interface DoseWithContext extends MedicationDose {
  med_name: string;
  dose: string | null;
  med_type: string;
  cat_name: string;
  cat_id: string;
}

export interface NotificationInbox {
  overdue: DoseWithContext[];
  due_today: DoseWithContext[];
  upcoming: DoseWithContext[];
  refill_alerts: (Medication & { cat_name: string })[];
}

/**
 * Per-user notification preferences (PRD-actionable-notifications Phase B/C).
 * `digest_enabled` is 0/1; times are 'HH:MM' user-local; a null quiet-hours
 * bound means quiet hours are off. `digest_last_sent_date` is server-managed.
 */
export interface NotificationPrefs {
  digest_enabled: number;
  digest_time: string;
  digest_last_sent_date: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  user_id: string;
  role: string;
  invited_at: string;
  joined_at: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface PendingInvite {
  id: string;
  invite_email: string;
  role: string;
  invited_at: string;
  invite_expires_at: string | null;
  invited_by_name: string | null;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
}

export interface InvitePreview {
  household_name: string;
  invited_by_name: string | null;
  invite_email: string;
  role: string;
}

export interface HouseholdResponse {
  household: HouseholdInfo;
  members: HouseholdMember[];
  pendingInvites: PendingInvite[];
  myRole: string;
  isOwner: boolean;
}

export type MedicationInput = {
  cat_id: string;
  name: string;
  type?: string;
  dose?: string | null;
  frequency: string;
  frequency_days?: number | null;
  reminder_time?: string;
  start_date: string;
  end_date?: string | null;
  doses_total?: number | null;
  notes?: string | null;
  doses_remaining?: number | null;
  refill_alert_threshold?: number | null;
  schedule_mode?: 'fixed' | 'interval';
  first_dose_given?: boolean;
};

export interface HouseholdListItem {
  id: string;
  name: string;
  role: string;
  is_owner: number;
}

export interface DayGroup {
  dateStr: string;
  label: string;
  items: Measurement[];
}

// ---------------------------------------------------------------------------
// Observations journal (PRD-notes-journal)
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  cat_id: string;
  user_id: string;              // author
  author_name?: string | null;  // joined display name for multi-member households
  occurred_at: string;          // when observed (backdatable), ISO datetime
  text: string;                 // 1..2000 chars
  tags: string[] | null;        // preset tag keys (JOURNAL_TAG_LABELS); null = untagged
  photo_url: string | null;     // Phase B; null = no photo
  created_at: string;
  updated_at: string;
}

/** A History-timeline item — measurements and journal entries interleaved. */
export type TimelineItem =
  | { kind: 'measurement'; at: string; measurement: Measurement }
  | { kind: 'journal'; at: string; entry: JournalEntry };

export interface TimelineDayGroup {
  dateStr: string;
  label: string;
  items: TimelineItem[];
}

export const CARE_TYPE_ICONS: Record<string, string> = {
  flea: '🦟',
  heartworm: '❤️',
  pill: '💊',
  vaccine: '💉',
  supplement: '🌿',
  subq_fluids: '💧',
  dental: '🦷',
  exam: '🩺',
  bloodwork: '🩸',
  surgery: '🩹',
  other: '📅',
};
