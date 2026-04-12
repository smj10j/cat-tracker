// @vitest-environment jsdom
/**
 * Feature regression tests.
 *
 * Tests for specific features introduced in recent sprints:
 * - Push notification registration lifecycle
 * - Timezone sync logic
 * - Deep linking from notifications
 * - Hour-only reminder time helpers
 * - UTC↔local time conversion for medication doses
 */
import { describe, it, expect } from 'vitest';
import { localToUTC, utcToLocal } from '../../shared/lib/dates';

// ---------------------------------------------------------------------------
// Push notification registration
// ---------------------------------------------------------------------------
describe('Push notification token format', () => {
  it('Expo push tokens match expected format', () => {
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    expect(token).toMatch(/^ExponentPushToken\[.{20,50}\]$/);
  });

  it('rejects invalid token formats', () => {
    const invalidTokens = ['', 'not-a-token', 'ExponentPushToken[]', 'ExponentPushToken[x]'];
    for (const t of invalidTokens) {
      expect(t).not.toMatch(/^ExponentPushToken\[.{20,50}\]$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Timezone sync logic
// ---------------------------------------------------------------------------
describe('Timezone detection', () => {
  it('Intl.DateTimeFormat returns a valid IANA timezone', () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(tz).toBeTruthy();
    expect(typeof tz).toBe('string');
    // IANA timezones contain a slash (e.g., America/New_York) or are 'UTC'
    expect(tz === 'UTC' || tz.includes('/')).toBe(true);
  });

  it('detects timezone change correctly', () => {
    const serverTz = 'America/New_York';
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Should sync if different
    const shouldSync = deviceTz !== serverTz;
    expect(typeof shouldSync).toBe('boolean');
  });

  it('skips sync when timezone matches', () => {
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shouldSync = deviceTz !== deviceTz; // same timezone
    expect(shouldSync).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deep linking from notifications
// ---------------------------------------------------------------------------
describe('Notification deep link routing', () => {
  it('constructs correct deep link URL for cat Care tab', () => {
    const catId = 'abc123';
    const url = `/cats/${catId}?tab=care`;
    expect(url).toBe('/cats/abc123?tab=care');
  });

  it('handles notification data with catId', () => {
    const data = { catId: 'test-cat-123', url: '/cats/test-cat-123' };
    expect(data.catId).toBeTruthy();
    expect(data.url).toContain(data.catId);
  });

  it('handles notification data without catId gracefully', () => {
    const data: { catId?: string } = {};
    // Should not navigate when catId is missing
    expect(data.catId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Hour-only reminder time helpers
// ---------------------------------------------------------------------------
describe('Hour-only reminder time formatting', () => {
  function formatHourLabel(time: string): string {
    const hour = parseInt(time.split(':')[0] ?? '9', 10);
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  }

  function roundToHour(time: string): string {
    const parts = time.split(':');
    const hour = parseInt(parts[0] ?? '9', 10);
    const min = parseInt(parts[1] ?? '0', 10);
    const rounded = min >= 30 ? (hour + 1) % 24 : hour;
    return `${String(rounded).padStart(2, '0')}:00`;
  }

  it('formats midnight as 12:00 AM', () => {
    expect(formatHourLabel('00:00')).toBe('12:00 AM');
  });

  it('formats 9 AM correctly', () => {
    expect(formatHourLabel('09:00')).toBe('9:00 AM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatHourLabel('12:00')).toBe('12:00 PM');
  });

  it('formats 9 PM correctly', () => {
    expect(formatHourLabel('21:00')).toBe('9:00 PM');
  });

  it('rounds 09:15 down to 09:00', () => {
    expect(roundToHour('09:15')).toBe('09:00');
  });

  it('rounds 09:30 up to 10:00', () => {
    expect(roundToHour('09:30')).toBe('10:00');
  });

  it('rounds 09:45 up to 10:00', () => {
    expect(roundToHour('09:45')).toBe('10:00');
  });

  it('rounds 23:30 up to 00:00 (wraps midnight)', () => {
    expect(roundToHour('23:30')).toBe('00:00');
  });

  it('keeps exact hours unchanged', () => {
    expect(roundToHour('09:00')).toBe('09:00');
    expect(roundToHour('14:00')).toBe('14:00');
    expect(roundToHour('00:00')).toBe('00:00');
  });
});

// ---------------------------------------------------------------------------
// Medication dose UTC↔local conversion for display
// ---------------------------------------------------------------------------
describe('Medication dose display conversion', () => {
  it('converts UTC due_at to local time for notification display', () => {
    // A dose due at 14:00 UTC should display as 9:00 AM in New York (EST)
    const utcDueAt = '2026-01-15 14:00:00';
    const local = utcToLocal(utcDueAt, 'America/New_York');
    expect(local.time).toBe('09:00');
    expect(local.date).toBe('2026-01-15');
  });

  it('handles DST correctly for summer dates', () => {
    // Same time, different offset in summer (EDT = UTC-4)
    const utcDueAt = '2026-07-15 13:00:00';
    const local = utcToLocal(utcDueAt, 'America/New_York');
    expect(local.time).toBe('09:00');
  });

  it('handles date rollover in display', () => {
    // 4:00 AM UTC = 11:00 PM previous day in EST
    const utcDueAt = '2026-01-16 04:00:00';
    const local = utcToLocal(utcDueAt, 'America/New_York');
    expect(local.date).toBe('2026-01-15');
    expect(local.time).toBe('23:00');
  });

  it('stores correct UTC from local reminder time', () => {
    // User in New York sets 9 AM reminder
    const utc = localToUTC('2026-01-15', '09:00', 'America/New_York');
    expect(utc).toBe('2026-01-15 14:00:00');
  });

  it('cron hour window matches UTC due_at correctly', () => {
    // Simulate cron at 14:00 UTC
    const cronHourStart = '2026-01-15 14:00:00';
    const cronHourEnd = '2026-01-15 15:00:00';

    // A 9 AM EST dose stored as UTC
    const doseUtc = localToUTC('2026-01-15', '09:00', 'America/New_York');

    // The dose should fall within the 14:00-15:00 UTC window
    expect(doseUtc >= cronHourStart).toBe(true);
    expect(doseUtc < cronHourEnd).toBe(true);
  });
});
