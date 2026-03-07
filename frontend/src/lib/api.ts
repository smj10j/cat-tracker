export interface Cat {
  id: string
  name: string
  birthdate: string
  breed: string | null
  coloring: string | null
  notes: string | null
  photo_url: string | null
  sex: string | null
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
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
