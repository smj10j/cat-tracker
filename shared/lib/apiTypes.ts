/**
 * Shared API client interface — both frontend/ and app/ must implement this.
 *
 * Adding a method here will produce a compile error in both platforms until
 * implemented, ensuring the clients never drift out of sync.
 *
 * Platform-specific transport (cookies vs Bearer, canvas vs native URI) lives
 * in each platform's api.ts. Only the method signatures are shared.
 */

import type {
  Cat, Measurement, User, Medication, MedicationDose,
  NotificationInbox, HouseholdResponse, HouseholdInfo, InvitePreview,
  HouseholdListItem, MedicationInput,
} from './types'

// ---------------------------------------------------------------------------
// API interface
// ---------------------------------------------------------------------------

export interface CatTrackerApi {
  // Auth
  getMe(): Promise<User>
  updateMe(data: { timezone?: string; email_reminders?: number }): Promise<void>
  logout(): Promise<void>
  claimCats(): Promise<{ claimed: number }>

  // Cats
  getCats(status?: 'active' | 'memorial' | 'all'): Promise<Cat[]>
  getCat(id: string): Promise<Cat>
  createCat(data: Partial<Cat>): Promise<Cat>
  updateCat(id: string, data: Partial<Cat>): Promise<Cat>
  markDeceased(id: string, deceasedAt: string, memorialNote?: string): Promise<void>
  markAlive(id: string): Promise<void>
  deleteCat(id: string): Promise<void>

  // Cat photos — upload signature is platform-specific (Blob on web, URI on native)
  deleteCatPhoto(id: string): Promise<void>

  // Measurements
  getMeasurements(catId: string, type?: string): Promise<Measurement[]>
  createMeasurement(catId: string, data: {
    type: string; value: number; unit: string; measured_at: string; notes?: string | null
  }): Promise<Measurement>
  deleteMeasurement(id: string): Promise<void>

  // Medications
  getMedications(catId?: string): Promise<Medication[]>
  getMedication(id: string): Promise<Medication & { doses: MedicationDose[] }>
  createMedication(data: MedicationInput): Promise<Medication>
  updateMedication(id: string, data: Partial<MedicationInput & { is_active: number }>): Promise<Medication>
  archiveMedication(id: string): Promise<void>
  logPrnDose(medicationId: string, data?: { given_at?: string; notes?: string }): Promise<MedicationDose>

  // Doses
  administerDose(id: string, data?: { administered_at?: string; notes?: string }): Promise<void>
  skipDose(id: string, skipReason?: string): Promise<void>
  snoozeDose(id: string, minutes?: number): Promise<{ snoozed_until: string | null }>
  bulkDoseAction(doseIds: string[], action: 'administer' | 'skip'): Promise<{ updated: number }>

  // Notifications
  getNotifications(): Promise<NotificationInbox>

  // Household
  getHousehold(): Promise<HouseholdResponse>
  getHouseholdList(): Promise<HouseholdListItem[]>
  renameHousehold(name: string): Promise<HouseholdInfo>
  sendInvite(email: string, role: string): Promise<{ success: boolean; inviteUrl?: string }>
  revokeInvite(id: string): Promise<void>
  changeMemberRole(userId: string, role: string): Promise<void>
  removeMember(userId: string): Promise<void>
  getInvitePreview(token: string): Promise<InvitePreview>
  acceptInvite(token: string): Promise<{ success: boolean }>
  declineInvite(token: string): Promise<void>
}

// ---------------------------------------------------------------------------
// App-only extensions (not available on web)
// ---------------------------------------------------------------------------

export interface CatTrackerNativeApi extends CatTrackerApi {
  deleteAccount(): Promise<void>
  exportData(): Promise<string>
  registerDeviceToken(token: string, platform: string): Promise<void>
  uploadCatPhoto(id: string, uri: string): Promise<{ photo_url: string }>
}

// ---------------------------------------------------------------------------
// Web-only extensions (not available on native)
// ---------------------------------------------------------------------------

export interface CatTrackerWebApi extends CatTrackerApi {
  uploadCatPhoto(catId: string, blob: Blob): Promise<{ photo_url: string }>
}
