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

export interface HouseholdResponse {
  household: HouseholdInfo;
  members: HouseholdMember[];
  pendingInvites: PendingInvite[];
  myRole: string;
  isOwner: boolean;
}

export const CARE_TYPE_ICONS: Record<string, string> = {
  flea: '\uD83E\uDD9F',
  heartworm: '\u2764\uFE0F',
  pill: '\uD83D\uDC8A',
  vaccine: '\uD83D\uDC89',
  supplement: '\uD83C\uDF3F',
  dental: '\uD83E\uDDB7',
  exam: '\uD83E\uDE7A',
  bloodwork: '\uD83E\uDE78',
  surgery: '\uD83E\uDE79',
  other: '\uD83D\uDCC5',
};

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
};
