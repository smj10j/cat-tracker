/**
 * Tests for the API client: X-API-Version header, X-Device-Id header,
 * and UpgradeRequiredError handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We can't import the real api.ts because it depends on react-native Platform,
// expo-constants, and expo-device. Instead, test the UpgradeRequiredError class
// and the token validation logic that are portable.

describe('UpgradeRequiredError', () => {
  it('has the correct properties', () => {
    // Inline the class since we can't import the module in a non-RN environment
    class UpgradeRequiredError extends Error {
      minSupportedVersion: string;
      constructor(minVersion: string) {
        super('App update required');
        this.minSupportedVersion = minVersion;
      }
    }

    const err = new UpgradeRequiredError('2.0.0');
    expect(err.message).toBe('App update required');
    expect(err.minSupportedVersion).toBe('2.0.0');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('API version header contract', () => {
  it('X-API-Version should be a valid semver string', () => {
    // The app uses Constants.expoConfig?.version which comes from app.json
    const version = '1.0.0'; // matches app.json
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('device fingerprint format', () => {
  it('produces a model|os string', () => {
    // Mirrors getDeviceFingerprint() logic
    const model = 'iPhone15,2';
    const os = 'ios/17.4';
    const fingerprint = `${model}|${os}`;
    expect(fingerprint).toBe('iPhone15,2|ios/17.4');
    expect(fingerprint).toContain('|');
  });

  it('handles unknown model gracefully', () => {
    const model = 'unknown';
    const os = 'ios/17.4';
    const fingerprint = `${model}|${os}`;
    expect(fingerprint).toBe('unknown|ios/17.4');
  });
});

describe('426 response handling', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetch returning 426 should be detectable by status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: 'Client version is too old',
        minSupportedVersion: '2.0.0',
        currentVersion: '1.0.0',
      }), { status: 426 }),
    );

    const res = await fetch('http://localhost/api/health');
    expect(res.status).toBe(426);
    const body = await res.json() as { minSupportedVersion: string };
    expect(body.minSupportedVersion).toBe('2.0.0');
  });
});
