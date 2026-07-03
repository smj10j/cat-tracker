// Types — re-exported from shared single source of truth
export type {
  Cat, Measurement, User, Medication, MedicationDose, DoseWithContext,
  NotificationInbox, HouseholdMember, PendingInvite, HouseholdInfo,
  InvitePreview, HouseholdResponse, MedicationInput, HouseholdListItem, DayGroup,
} from '@shared/lib/types'
export { CARE_TYPE_ICONS } from '@shared/lib/types'

import type {
  Cat, Measurement, User, Medication, MedicationDose, MedicationInput,
  NotificationInbox, HouseholdResponse, HouseholdInfo, InvitePreview, HouseholdListItem,
} from '@shared/lib/types'
import type { CatTrackerWebApi } from '@shared/lib/apiTypes'

const BASE = '/api'
const API_VERSION = '1.0.0'

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
    headers: { 'Content-Type': 'application/json', 'X-API-Version': API_VERSION },
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
export const markDeceased = async (id: string, deceasedAt: string, memorialNote?: string): Promise<void> => {
  await request(`/cats/${id}`, { method: 'PUT', body: JSON.stringify({ deceased_at: deceasedAt, memorial_note: memorialNote ?? null }) })
}
export const markAlive = async (id: string): Promise<void> => {
  await request(`/cats/${id}`, { method: 'PUT', body: JSON.stringify({ deceased_at: null }) })
}
export const deleteCat = async (id: string): Promise<void> => {
  await request(`/cats/${id}`, { method: 'DELETE' })
}

import { LIMITS } from '@shared/lib/constants'
const MAX_PHOTO_BYTES = LIMITS.PHOTO_BYTES
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
export const deleteMeasurement = async (id: string): Promise<void> => {
  await request(`/measurements/${id}`, { method: 'DELETE' })
}

// Auth
export const getMe = () => request<User>('/auth/me')
export const updateMe = async (data: { timezone?: string; email_reminders?: number }): Promise<void> => {
  await request('/auth/me', { method: 'PUT', body: JSON.stringify(data) })
}
export const logout = async (): Promise<void> => {
  await request('/auth/logout', { method: 'POST' })
}
export const claimCats = () => request<{ claimed: number }>('/auth/claim-cats', { method: 'POST' })

// Medications
export const getMedications = (catId?: string) =>
  request<Medication[]>(`/medications${catId ? `?cat_id=${catId}` : ''}`)
export const getMedication = (id: string) =>
  request<Medication & { doses: MedicationDose[] }>(`/medications/${id}`)
export const createMedication = (data: MedicationInput) =>
  request<Medication>('/medications', { method: 'POST', body: JSON.stringify(data) })
export const updateMedication = (id: string, data: Partial<MedicationInput & { is_active: number }>) =>
  request<Medication>(`/medications/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const archiveMedication = async (id: string): Promise<void> => {
  await request(`/medications/${id}`, { method: 'DELETE' })
}

export const getNotifications = () => request<NotificationInbox>('/notifications')

// Household
export const getHousehold = () => request<HouseholdResponse>('/household')
export const getHouseholdList = () => request<HouseholdListItem[]>('/household/list')
export const renameHousehold = (name: string) =>
  request<HouseholdInfo>('/household', { method: 'PUT', body: JSON.stringify({ name }) })
export const sendInvite = (email: string, role: string) =>
  request<{ success: boolean; inviteUrl: string }>('/household/invites', {
    method: 'POST', body: JSON.stringify({ email, role }),
  })
export const revokeInvite = async (id: string): Promise<void> => {
  await request(`/household/invites/${id}`, { method: 'DELETE' })
}
export const changeMemberRole = async (userId: string, role: string): Promise<void> => {
  await request(`/household/members/${userId}/role`, {
    method: 'PUT', body: JSON.stringify({ role }),
  })
}
export const removeMember = async (userId: string): Promise<void> => {
  await request(`/household/members/${userId}`, { method: 'DELETE' })
}
export const acceptInvite = (token: string) =>
  request<{ success: boolean; household_id: string }>('/household/invites/accept', {
    method: 'POST', body: JSON.stringify({ token }),
  })
export const declineInvite = async (token: string): Promise<void> => {
  await request('/household/invites/decline', {
    method: 'POST', body: JSON.stringify({ token }),
  })
}
export const getInvitePreview = (token: string) =>
  fetch(`/api/household/invites/preview?token=${encodeURIComponent(token)}`)
    .then(async res => {
      const body = await res.json() as InvitePreview | { error: string }
      if (!res.ok) throw new ApiError((body as { error: string }).error, res.status)
      return body as InvitePreview
    })
export const administerDose = async (id: string, data?: { administered_at?: string; notes?: string }): Promise<void> => {
  await request(`/doses/${id}/administer`, { method: 'POST', body: JSON.stringify(data ?? {}) })
}
export const skipDose = async (id: string, skipReason?: string): Promise<void> => {
  await request(`/doses/${id}/skip`, { method: 'POST', body: JSON.stringify({ skip_reason: skipReason }) })
}
export const snoozeDose = (id: string, minutes?: number) =>
  request<{ snoozed_until: string | null }>(`/doses/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) })
export const bulkDoseAction = (doseIds: string[], action: 'administer' | 'skip') =>
  request<{ updated: number }>('/doses/bulk', { method: 'POST', body: JSON.stringify({ dose_ids: doseIds, action }) })
export const logPrnDose = (medicationId: string, data?: { given_at?: string; notes?: string }) =>
  request<MedicationDose>(`/medications/${medicationId}/log-dose`, { method: 'POST', body: JSON.stringify(data ?? {}) })

// Type conformance check — ensures this module implements every method in CatTrackerWebApi.
// If a method is missing or has the wrong signature, this line will produce a compile error.
const _typeCheck: CatTrackerWebApi = {
  getMe, updateMe, logout, claimCats,
  getCats, getCat, createCat, updateCat, markDeceased, markAlive, deleteCat,
  uploadCatPhoto, deleteCatPhoto,
  getMeasurements, createMeasurement, deleteMeasurement,
  getMedications, getMedication, createMedication, updateMedication, archiveMedication, logPrnDose,
  administerDose, skipDose, snoozeDose, bulkDoseAction,
  getNotifications,
  getHousehold, getHouseholdList, renameHousehold,
  sendInvite, revokeInvite, changeMemberRole, removeMember,
  getInvitePreview, acceptInvite, declineInvite,
}
void _typeCheck
