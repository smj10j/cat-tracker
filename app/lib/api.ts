import { Platform } from 'react-native';

// Types — shared with frontend
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
}

// On web, use relative URLs (Pages proxy handles /api/* → Worker).
// On native, call the Worker directly with Bearer token.
const BASE_URL = Platform.OS === 'web' ? '' : 'https://cat-tracker.pages.dev';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (authToken && Platform.OS !== 'web') {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? 'same-origin' : undefined,
  });

  if (!res.ok && res.status === 401) {
    throw new Error('Unauthorized');
  }

  return res;
}

export const api = {
  // Auth
  async getMe(): Promise<User> {
    const res = await apiFetch('/api/auth/me');
    return res.json() as Promise<User>;
  },

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  },

  async deleteAccount(): Promise<void> {
    await apiFetch('/api/auth/account', { method: 'DELETE' });
  },

  async exportData(): Promise<string> {
    const res = await apiFetch('/api/auth/export');
    return res.text();
  },

  async registerDeviceToken(token: string, platform: string): Promise<void> {
    await apiFetch('/api/auth/device-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  // Cats
  async getCats(): Promise<Cat[]> {
    const res = await apiFetch('/api/cats');
    const data = await res.json() as { cats: Cat[] } | Cat[];
    return Array.isArray(data) ? data : data.cats;
  },

  async getCat(id: string): Promise<Cat> {
    const res = await apiFetch(`/api/cats/${id}`);
    return res.json() as Promise<Cat>;
  },

  async createCat(cat: Partial<Cat>): Promise<Cat> {
    const res = await apiFetch('/api/cats', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
    return res.json() as Promise<Cat>;
  },

  async updateCat(id: string, cat: Partial<Cat>): Promise<Cat> {
    const res = await apiFetch(`/api/cats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat),
    });
    return res.json() as Promise<Cat>;
  },

  async deleteCat(id: string): Promise<void> {
    await apiFetch(`/api/cats/${id}`, { method: 'DELETE' });
  },

  // Measurements
  async getMeasurements(catId: string, type?: string): Promise<Measurement[]> {
    const params = type ? `?type=${type}` : '';
    const res = await apiFetch(`/api/cats/${catId}/measurements${params}`);
    const data = await res.json() as { measurements: Measurement[] } | Measurement[];
    return Array.isArray(data) ? data : data.measurements;
  },

  async addMeasurement(catId: string, measurement: {
    type: string;
    value: number;
    unit: string;
    measured_at: string;
    notes?: string;
  }): Promise<Measurement> {
    const res = await apiFetch(`/api/cats/${catId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(measurement),
    });
    return res.json() as Promise<Measurement>;
  },

  async deleteMeasurement(id: string): Promise<void> {
    await apiFetch(`/api/measurements/${id}`, { method: 'DELETE' });
  },
};
