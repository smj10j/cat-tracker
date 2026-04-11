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
  created_at: string;
  updated_at: string;
  next_due_at?: string | null;
  overdue_count?: number;
}

export interface MedicationDose {
  id: string;
  medication_id: string;
  due_at: string;
  administered_at: string | null;
  skipped: number;
  skip_reason: string | null;
  notes: string | null;
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

export const CARE_TYPE_ICONS: Record<string, string> = {
  flea: '🦟',
  heartworm: '❤️',
  pill: '💊',
  vaccine: '💉',
  supplement: '🌿',
  dental: '🦷',
  exam: '🩺',
  bloodwork: '🩸',
  surgery: '🩹',
  other: '📅',
};
