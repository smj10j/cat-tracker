import { Platform } from 'react-native';

// Types re-exported from shared — single source of truth
export type {
  Cat, Measurement, User, Medication, MedicationDose, DoseWithContext,
  NotificationInbox, HouseholdMember, PendingInvite, HouseholdInfo,
  InvitePreview, HouseholdResponse,
} from '@shared/lib/types';
export { CARE_TYPE_ICONS } from '@shared/lib/types';

import type {
  Cat, Measurement, User, Medication, MedicationDose,
  NotificationInbox, HouseholdResponse, HouseholdInfo, InvitePreview,
} from '@shared/lib/types';

// --- Platform-specific API implementation below ---

// On web, use relative URLs (Pages proxy handles /api/* -> Worker).
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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed: ${res.status}`);
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

  async claimCats(): Promise<{ claimed: number }> {
    const res = await apiFetch('/api/auth/claim-cats', { method: 'POST' });
    return res.json() as Promise<{ claimed: number }>;
  },

  // Cats
  async getCats(scope?: string): Promise<Cat[]> {
    const params = scope ? `?scope=${scope}` : '';
    const res = await apiFetch(`/api/cats${params}`);
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

  async uploadCatPhoto(id: string, uri: string): Promise<{ photo_url: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match?.[1] ?? 'jpg';
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    formData.append('photo', {
      uri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    const headers = new Headers();
    if (authToken && Platform.OS !== 'web') {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const res = await fetch(`${BASE_URL}/api/cats/${id}/photo`, {
      method: 'POST',
      body: formData,
      headers,
      credentials: Platform.OS === 'web' ? 'same-origin' : undefined,
    });
    if (!res.ok) throw new Error('Photo upload failed');
    return res.json() as Promise<{ photo_url: string }>;
  },

  async deleteCatPhoto(id: string): Promise<void> {
    await apiFetch(`/api/cats/${id}/photo`, { method: 'DELETE' });
  },

  async markDeceased(id: string, deceasedAt: string, memorialNote?: string): Promise<void> {
    await apiFetch(`/api/cats/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ deceased_at: deceasedAt, memorial_note: memorialNote ?? null }),
    });
  },

  async markAlive(id: string): Promise<void> {
    await apiFetch(`/api/cats/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ deceased_at: null }),
    });
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
    notes?: string | null;
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

  // Medications
  async getMedications(catId?: string): Promise<Medication[]> {
    const params = catId ? `?cat_id=${catId}` : '';
    const res = await apiFetch(`/api/medications${params}`);
    return res.json() as Promise<Medication[]>;
  },

  async getMedication(id: string): Promise<Medication & { doses: MedicationDose[] }> {
    const res = await apiFetch(`/api/medications/${id}`);
    return res.json() as Promise<Medication & { doses: MedicationDose[] }>;
  },

  async createMedication(data: {
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
  }): Promise<Medication> {
    const res = await apiFetch('/api/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json() as Promise<Medication>;
  },

  async updateMedication(
    id: string,
    data: Partial<{
      cat_id: string;
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
    }>,
  ): Promise<Medication> {
    const res = await apiFetch(`/api/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json() as Promise<Medication>;
  },

  async archiveMedication(id: string): Promise<void> {
    await apiFetch(`/api/medications/${id}`, { method: 'DELETE' });
  },

  async logDose(doseId: string, action: 'administer' | 'skip', skipReason?: string): Promise<void> {
    if (action === 'administer') {
      await apiFetch(`/api/doses/${doseId}/administer`, { method: 'POST' });
    } else {
      await apiFetch(`/api/doses/${doseId}/skip`, {
        method: 'POST',
        body: JSON.stringify({ reason: skipReason ?? null }),
      });
    }
  },

  async getNotifications(): Promise<NotificationInbox> {
    const res = await apiFetch('/api/notifications');
    return res.json() as Promise<NotificationInbox>;
  },

  // Household
  async getHousehold(): Promise<HouseholdResponse> {
    const res = await apiFetch('/api/household');
    return res.json() as Promise<HouseholdResponse>;
  },

  async renameHousehold(name: string): Promise<HouseholdInfo> {
    const res = await apiFetch('/api/household', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return res.json() as Promise<HouseholdInfo>;
  },

  async sendInvite(email: string, role: string): Promise<{ success: boolean; inviteUrl?: string }> {
    const res = await apiFetch('/api/household/invites', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    return res.json() as Promise<{ success: boolean; inviteUrl?: string }>;
  },

  async revokeInvite(inviteId: string): Promise<void> {
    await apiFetch(`/api/household/invites/${inviteId}`, { method: 'DELETE' });
  },

  async changeMemberRole(userId: string, role: string): Promise<void> {
    await apiFetch(`/api/household/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async removeMember(userId: string): Promise<void> {
    await apiFetch(`/api/household/members/${userId}`, { method: 'DELETE' });
  },

  async getInvitePreview(token: string): Promise<InvitePreview> {
    const res = await apiFetch(`/api/household/invites/preview?token=${encodeURIComponent(token)}`);
    return res.json() as Promise<InvitePreview>;
  },

  async acceptInvite(token: string): Promise<{ success: boolean }> {
    const res = await apiFetch('/api/household/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return res.json() as Promise<{ success: boolean }>;
  },

  async declineInvite(token: string): Promise<void> {
    await apiFetch('/api/household/invites/decline', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
