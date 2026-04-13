/**
 * Tests for care item form validation and payload construction.
 * Uses shared pure functions from @shared/lib/careItemForm.
 */
import { describe, it, expect } from 'vitest';
import {
  CARE_ITEM_DEFAULTS,
  validateCareItem,
  buildCareItemPayload,
  type CareItemFields,
} from '../../shared/lib/careItemForm';

describe('validateCareItem', () => {
  it('rejects empty name', () => {
    expect(validateCareItem(CARE_ITEM_DEFAULTS)).toBe('Name is required');
  });

  it('rejects whitespace-only name', () => {
    expect(validateCareItem({ ...CARE_ITEM_DEFAULTS, name: '   ' })).toBe('Name is required');
  });

  it('rejects empty start date', () => {
    expect(validateCareItem({ ...CARE_ITEM_DEFAULTS, name: 'Meds', startDate: '' })).toBe('Start date is required');
  });

  it('passes with valid inputs', () => {
    expect(validateCareItem({ ...CARE_ITEM_DEFAULTS, name: 'Revolution Plus' })).toBeNull();
  });
});

describe('buildCareItemPayload', () => {
  const fields: CareItemFields = {
    ...CARE_ITEM_DEFAULTS,
    name: 'Revolution Plus',
    type: 'flea',
    dose: '1 tube',
    frequency: 'monthly',
    frequencyDays: '30',
    reminderTime: '09:00',
    startDate: '2026-01-01',
    notes: 'Topical',
  };

  it('builds correct payload with required fields', () => {
    const p = buildCareItemPayload(fields, 'abc123');
    expect(p.cat_id).toBe('abc123');
    expect(p.name).toBe('Revolution Plus');
    expect(p.type).toBe('flea');
    expect(p.dose).toBe('1 tube');
    expect(p.frequency).toBe('monthly');
    expect(p.end_date).toBeNull();
    expect(p.doses_total).toBeNull();
  });

  it('only includes frequency_days when frequency is custom', () => {
    const p = buildCareItemPayload(fields, 'cat1');
    expect(p.frequency_days).toBeNull();

    const custom = buildCareItemPayload({ ...fields, frequency: 'custom', frequencyDays: '45' }, 'cat1');
    expect(custom.frequency_days).toBe(45);
  });

  it('trims name and notes, nullifies empty strings', () => {
    const p = buildCareItemPayload({ ...fields, name: '  Gabapentin  ', dose: '', notes: '   ' }, 'cat1');
    expect(p.name).toBe('Gabapentin');
    expect(p.dose).toBeNull();
    expect(p.notes).toBeNull();
  });

  it('parses numeric strings for stock tracking', () => {
    const p = buildCareItemPayload({
      ...fields,
      dosesTotal: '14',
      dosesRemaining: '3',
      refillThreshold: '2',
    }, 'cat1');
    expect(p.doses_total).toBe(14);
    expect(p.doses_remaining).toBe(3);
    expect(p.refill_alert_threshold).toBe(2);
  });

  it('returns null for non-numeric stock strings', () => {
    const p = buildCareItemPayload({
      ...fields,
      dosesTotal: 'abc',
      dosesRemaining: '',
    }, 'cat1');
    expect(p.doses_total).toBeNull();
    expect(p.doses_remaining).toBeNull();
  });
});
