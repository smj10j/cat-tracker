export interface Cat {
  id: string
  name: string
  birthdate: string
  breed: string | null
  coloring: string | null
  notes: string | null
  photo_url: string | null
  sex: string | null
  microchip_id: string | null
  created_at: string
  updated_at: string
}

export function catPronouns(sex: string | null | undefined): { subject: string; possessive: string; object: string } {
  if (sex === 'Male') return { subject: 'he', possessive: 'his', object: 'him' }
  if (sex === 'Female') return { subject: 'she', possessive: 'her', object: 'her' }
  return { subject: 'they', possessive: 'their', object: 'them' }
}

export interface Measurement {
  id: string
  cat_id: string
  type: string
  value: number
  unit: string
  measured_at: string
  notes: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  hasOrphanedCats: boolean
}

const BASE = '/api'

export class ApiError extends Error {
  status: number
  conflictingCatName?: string
  constructor(message: string, status: number, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    if (extra?.conflictingCatName) this.conflictingCatName = extra.conflictingCatName as string
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>
    throw new ApiError((body.error as string) ?? 'Request failed', res.status, body)
  }
  return res.json() as Promise<T>
}

// Cats
export const getCats = () => request<Cat[]>('/cats')
export const getCat = (id: string) => request<Cat>(`/cats/${id}`)
export const createCat = (data: Omit<Cat, 'id' | 'created_at' | 'updated_at'>) =>
  request<Cat>('/cats', { method: 'POST', body: JSON.stringify(data) })
export const updateCat = (id: string, data: Partial<Omit<Cat, 'id' | 'created_at' | 'updated_at'>>) =>
  request<Cat>(`/cats/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCat = (id: string) =>
  request<{ success: boolean }>(`/cats/${id}`, { method: 'DELETE' })

// Measurements
export const getMeasurements = (catId: string, type?: string) =>
  request<Measurement[]>(`/cats/${catId}/measurements${type ? `?type=${type}` : ''}`)
export const createMeasurement = (catId: string, data: Omit<Measurement, 'id' | 'cat_id' | 'created_at'>) =>
  request<Measurement>(`/cats/${catId}/measurements`, { method: 'POST', body: JSON.stringify(data) })
export const deleteMeasurement = (id: string) =>
  request<{ success: boolean }>(`/measurements/${id}`, { method: 'DELETE' })

// Auth
export const getMe = () => request<User>('/auth/me')
export const logout = () => request<{ success: boolean }>('/auth/logout', { method: 'POST' })
export const claimCats = () => request<{ claimed: number }>('/auth/claim-cats', { method: 'POST' })

// Medications
export interface Medication {
  id: string
  cat_id: string
  user_id: string
  name: string
  type: string
  dose: string | null
  frequency: string
  frequency_days: number | null
  reminder_time: string
  start_date: string
  end_date: string | null
  doses_total: number | null
  notes: string | null
  is_active: number
  doses_remaining: number | null
  refill_alert_threshold: number | null
  created_at: string
  updated_at: string
  // Computed by list endpoint
  next_due_at?: string | null
  overdue_count?: number
}

export interface MedicationDose {
  id: string
  medication_id: string
  due_at: string
  administered_at: string | null
  skipped: number
  skip_reason: string | null
  notes: string | null
  created_at: string
}

export interface DoseWithContext extends MedicationDose {
  med_name: string
  dose: string | null
  med_type: string
  cat_name: string
  cat_id: string
}

export interface NotificationInbox {
  overdue: DoseWithContext[]
  due_today: DoseWithContext[]
  upcoming: DoseWithContext[]
  refill_alerts: (Medication & { cat_name: string })[]
}

export type MedicationInput = {
  cat_id: string
  name: string
  type?: string
  dose?: string | null
  frequency: string
  frequency_days?: number | null
  reminder_time?: string
  start_date: string
  end_date?: string | null
  doses_total?: number | null
  notes?: string | null
  doses_remaining?: number | null
  refill_alert_threshold?: number | null
}

export const getMedications = (catId?: string) =>
  request<Medication[]>(`/medications${catId ? `?cat_id=${catId}` : ''}`)
export const getMedication = (id: string) =>
  request<Medication & { doses: MedicationDose[] }>(`/medications/${id}`)
export const createMedication = (data: MedicationInput) =>
  request<Medication>('/medications', { method: 'POST', body: JSON.stringify(data) })
export const updateMedication = (id: string, data: Partial<MedicationInput & { is_active: number }>) =>
  request<Medication>(`/medications/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const archiveMedication = (id: string) =>
  request<{ success: boolean }>(`/medications/${id}`, { method: 'DELETE' })

export const getNotifications = () => request<NotificationInbox>('/notifications')
export const administerDose = (id: string, data?: { administered_at?: string; notes?: string }) =>
  request<MedicationDose>(`/doses/${id}/administer`, { method: 'POST', body: JSON.stringify(data ?? {}) })
export const skipDose = (id: string, skip_reason?: string) =>
  request<MedicationDose>(`/doses/${id}/skip`, { method: 'POST', body: JSON.stringify({ skip_reason }) })
