/**
 * Tests for care item form validation and payload construction.
 * Exercises the same logic used in app/app/cats/[id]/care-item.tsx.
 */
import { describe, it, expect } from 'vitest';

// Inlined from care-item.tsx — payload builder
function buildCareItemPayload(fields: {
  catId: string;
  name: string;
  type: string;
  dose: string;
  frequency: string;
  frequencyDays: string;
  reminderTime: string;
  startDate: string;
  endDate: string;
  dosesTotal: string;
  notes: string;
  dosesRemaining: string;
  refillThreshold: string;
}) {
  return {
    cat_id: fields.catId,
    name: fields.name.trim(),
    type: fields.type,
    dose: fields.dose.trim() || null,
    frequency: fields.frequency,
    frequency_days:
      fields.frequency === 'custom'
        ? parseInt(fields.frequencyDays, 10) || null
        : null,
    reminder_time: fields.reminderTime,
    start_date: fields.startDate,
    end_date: fields.endDate || null,
    doses_total: fields.dosesTotal
      ? parseInt(fields.dosesTotal, 10) || null
      : null,
    notes: fields.notes.trim() || null,
    doses_remaining: fields.dosesRemaining
      ? parseInt(fields.dosesRemaining, 10) || null
      : null,
    refill_alert_threshold: fields.refillThreshold
      ? parseInt(fields.refillThreshold, 10) || null
      : null,
  };
}

function validateCareItem(name: string, startDate: string, catId: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (!startDate) return 'Start date is required';
  if (!catId) return 'Cat is required';
  return null;
}

describe('validateCareItem', () => {
  it('rejects empty name', () => {
    expect(validateCareItem('', '2026-01-01', 'cat1')).toBe('Name is required');
  });

  it('rejects whitespace-only name', () => {
    expect(validateCareItem('   ', '2026-01-01', 'cat1')).toBe('Name is required');
  });

  it('rejects empty start date', () => {
    expect(validateCareItem('Meds', '', 'cat1')).toBe('Start date is required');
  });

  it('rejects empty cat ID', () => {
    expect(validateCareItem('Meds', '2026-01-01', '')).toBe('Cat is required');
  });

  it('passes with valid inputs', () => {
    expect(validateCareItem('Revolution Plus', '2026-01-01', 'cat1')).toBeNull();
  });
});

describe('buildCareItemPayload', () => {
  const defaults = {
    catId: 'abc123',
    name: 'Revolution Plus',
    type: 'flea',
    dose: '1 tube',
    frequency: 'monthly',
    frequencyDays: '30',
    reminderTime: '09:00',
    startDate: '2026-01-01',
    endDate: '',
    dosesTotal: '',
    notes: 'Topical',
    dosesRemaining: '',
    refillThreshold: '',
  };

  it('builds correct payload with required fields', () => {
    const p = buildCareItemPayload(defaults);
    expect(p.cat_id).toBe('abc123');
    expect(p.name).toBe('Revolution Plus');
    expect(p.type).toBe('flea');
    expect(p.dose).toBe('1 tube');
    expect(p.frequency).toBe('monthly');
    expect(p.end_date).toBeNull();
    expect(p.doses_total).toBeNull();
  });

  it('only includes frequency_days when frequency is custom', () => {
    const p = buildCareItemPayload(defaults);
    expect(p.frequency_days).toBeNull(); // monthly, not custom

    const custom = buildCareItemPayload({
      ...defaults,
      frequency: 'custom',
      frequencyDays: '45',
    });
    expect(custom.frequency_days).toBe(45);
  });

  it('trims name and notes, nullifies empty strings', () => {
    const p = buildCareItemPayload({
      ...defaults,
      name: '  Gabapentin  ',
      dose: '',
      notes: '   ',
    });
    expect(p.name).toBe('Gabapentin');
    expect(p.dose).toBeNull();
    expect(p.notes).toBeNull();
  });

  it('parses numeric strings for stock tracking', () => {
    const p = buildCareItemPayload({
      ...defaults,
      dosesTotal: '14',
      dosesRemaining: '3',
      refillThreshold: '2',
    });
    expect(p.doses_total).toBe(14);
    expect(p.doses_remaining).toBe(3);
    expect(p.refill_alert_threshold).toBe(2);
  });

  it('returns null for non-numeric stock strings', () => {
    const p = buildCareItemPayload({
      ...defaults,
      dosesTotal: 'abc',
      dosesRemaining: '',
    });
    expect(p.doses_total).toBeNull();
    expect(p.doses_remaining).toBeNull();
  });
});
