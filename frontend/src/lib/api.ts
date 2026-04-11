export interface Cat {
  id: string
  name: string
  birthdate: string
  breed: string | null
  coloring: string | null
  notes: string | null
  photo_url: string | null
  sex: string | null
  is_neutered: number | null
  microchip_id: string | null
  household_id: string | null
  household_name: string | null
  deceased_at: string | null
  memorial_note: string | null
  created_at: string
  updated_at: string
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
export const getCats = (status?: 'active' | 'memorial' | 'all') =>
  request<Cat[]>(`/cats${status ? `?status=${status}` : ''}`)
export const getCat = (id: string) => request<Cat>(`/cats/${id}`)
export const createCat = (data: Omit<Cat, 'id' | 'created_at' | 'updated_at' | 'household_id' | 'household_name'>) =>
  request<Cat>('/cats', { method: 'POST', body: JSON.stringify(data) })
export const updateCat = (id: string, data: Partial<Omit<Cat, 'id' | 'created_at' | 'updated_at' | 'household_id' | 'household_name'>>) =>
  request<Cat>(`/cats/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const markDeceased = (id: string, deceased_at: string, memorial_note?: string) =>
  request<Cat>(`/cats/${id}`, { method: 'PUT', body: JSON.stringify({ deceased_at, memorial_note: memorial_note ?? null }) })
export const markAlive = (id: string) =>
  request<Cat>(`/cats/${id}`, { method: 'PUT', body: JSON.stringify({ deceased_at: null, memorial_note: null }) })
export const deleteCat = (id: string) =>
  request<{ success: boolean }>(`/cats/${id}`, { method: 'DELETE' })

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_CANVAS_DIM = 2048 // scale down images larger than this

// Converts any image Blob to a JPEG Blob via canvas.
// Always goes through canvas (never sends raw File bytes) so the output is a
// clean JPEG with no EXIF, predictable size, and correct MIME type.
// Uses createImageBitmap (works directly from Blob, no FileReader needed) with
// a FileReader+Image fallback for older browsers (Safari < 16.4).
function drawBitmapToJpeg(bmp: ImageBitmap): Promise<Blob> {
  let { width: w, height: h } = bmp
  if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
    const ratio = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas not available'))
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed')),
      'image/jpeg',
      0.9,
    ),
  )
}

function toJpegBlobFallback(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode image — try a different file'))
      img.onload = () => {
        createImageBitmap(img).then(bmp => drawBitmapToJpeg(bmp)).then(resolve, reject)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

async function toJpegBlob(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return await drawBitmapToJpeg(bmp)
    } catch {
      // Fall through to legacy path (e.g. unsupported format)
    }
  }
  return toJpegBlobFallback(file)
}

export async function uploadCatPhoto(catId: string, blob: Blob): Promise<{ photo_url: string }> {
  // Always convert through canvas — ensures a clean bounded-size JPEG blob
  // regardless of original format or size. Raw File bytes are never sent directly.
  const jpeg = await toJpegBlob(blob)
  if (jpeg.size > MAX_PHOTO_BYTES) {
    throw new Error(`Photo is too large after compression (${(jpeg.size / 1024 / 1024).toFixed(1)} MB). Try a smaller image.`)
  }
  const form = new FormData()
  form.append('photo', jpeg, 'photo.jpg')
  const res = await fetch(`${BASE}/cats/${catId}/photo`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>
    throw new ApiError((body.error as string) ?? 'Upload failed', res.status, body)
  }
  return res.json() as Promise<{ photo_url: string }>
}

export async function deleteCatPhoto(catId: string): Promise<void> {
  const res = await fetch(`${BASE}/cats/${catId}/photo`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>
    throw new ApiError((body.error as string) ?? 'Delete failed', res.status, body)
  }
}

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

// Household
export interface HouseholdMember {
  id: string
  user_id: string
  role: string
  invited_at: string
  joined_at: string | null
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface PendingInvite {
  id: string
  invite_email: string
  role: string
  invited_at: string
  invite_expires_at: string | null
  invited_by_name: string | null
}

export interface HouseholdInfo {
  id: string
  name: string
  owner_user_id: string
  created_at: string
}

export interface HouseholdResponse {
  household: HouseholdInfo
  members: HouseholdMember[]
  pendingInvites: PendingInvite[]
  myRole: string
  isOwner: boolean
}

export interface HouseholdListItem {
  id: string
  name: string
  role: string
  is_owner: number
}

export interface InvitePreview {
  household_name: string
  invited_by_name: string | null
  invite_email: string
  role: string
}

export const getHousehold = () => request<HouseholdResponse>('/household')
export const getHouseholdList = () => request<HouseholdListItem[]>('/household/list')
export const renameHousehold = (name: string) =>
  request<HouseholdInfo>('/household', { method: 'PUT', body: JSON.stringify({ name }) })
export const sendInvite = (email: string, role: string) =>
  request<{ success: boolean; inviteUrl: string }>('/household/invites', {
    method: 'POST', body: JSON.stringify({ email, role }),
  })
export const revokeInvite = (id: string) =>
  request<{ success: boolean }>(`/household/invites/${id}`, { method: 'DELETE' })
export const changeMemberRole = (userId: string, role: string) =>
  request<{ success: boolean }>(`/household/members/${userId}/role`, {
    method: 'PUT', body: JSON.stringify({ role }),
  })
export const removeMember = (userId: string) =>
  request<{ success: boolean }>(`/household/members/${userId}`, { method: 'DELETE' })
export const acceptInvite = (token: string) =>
  request<{ success: boolean; household_id: string }>('/household/invites/accept', {
    method: 'POST', body: JSON.stringify({ token }),
  })
export const declineInvite = (token: string) =>
  request<{ success: boolean }>('/household/invites/decline', {
    method: 'POST', body: JSON.stringify({ token }),
  })
export const getInvitePreview = (token: string) =>
  fetch(`/api/household/invites/preview?token=${encodeURIComponent(token)}`)
    .then(async res => {
      const body = await res.json() as InvitePreview | { error: string }
      if (!res.ok) throw new ApiError((body as { error: string }).error, res.status)
      return body as InvitePreview
    })
export const administerDose = (id: string, data?: { administered_at?: string; notes?: string }) =>
  request<MedicationDose>(`/doses/${id}/administer`, { method: 'POST', body: JSON.stringify(data ?? {}) })
export const skipDose = (id: string, skip_reason?: string) =>
  request<MedicationDose>(`/doses/${id}/skip`, { method: 'POST', body: JSON.stringify({ skip_reason }) })
