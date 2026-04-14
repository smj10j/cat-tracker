/**
 * App Store Readiness Test Suite
 *
 * Static analysis tests that verify the app is ready for App Store submission.
 * Blocks TestFlight builds (via build-ios.sh test gate) if any check fails.
 *
 * Categories:
 *   1. iPad layout readiness — every screen has responsive layout patterns
 *   2. App Store compliance — required features and metadata
 *   3. Screen smoke test coverage — no screen goes untested
 */
import fs from 'fs';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(APP_ROOT, relativePath), 'utf8');
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(APP_ROOT, relativePath));
}

// ---------------------------------------------------------------------------
// 1. iPad Layout Readiness
// ---------------------------------------------------------------------------

/**
 * Every screen file must import ResponsiveContainer or useResponsiveLayout,
 * or use NativeWind max-w-* classes. This ensures iPad layout constraints
 * are applied and prevents regression to full-width phone-only layouts.
 */
const SCREENS_REQUIRING_RESPONSIVE = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/log.tsx',
  'app/(tabs)/compare.tsx',
  'app/settings.tsx',
  'app/cats/[id]/index.tsx',
  'app/cats/new.tsx',
  'app/cats/[id]/edit.tsx',
  'app/cats/[id]/care-item.tsx',
  'app/cats/[id]/export.tsx',
  'app/cats/[id]/memorial.tsx',
  'app/cats/[id]/health.tsx',
  'app/wellness.tsx',
  'app/notifications.tsx',
  'app/household.tsx',
  'app/privacy.tsx',
  'app/import.tsx',
  'app/invite.tsx',
  'app/(auth)/login.tsx',
];

describe('iPad layout readiness', () => {
  it.each(SCREENS_REQUIRING_RESPONSIVE)(
    '%s has responsive layout (ResponsiveContainer, useResponsiveLayout, or max-w-)',
    (file) => {
      const src = readFile(file);
      const hasContainer = src.includes('ResponsiveContainer');
      const hasHook = src.includes('useResponsiveLayout');
      const hasMaxW = src.includes('max-w-');
      const hasContentMaxWidth = src.includes('contentMaxWidth');
      const hasInlineMaxWidth = src.includes('maxWidth');
      expect(
        hasContainer || hasHook || hasMaxW || hasContentMaxWidth || hasInlineMaxWidth
      ).toBe(true);
    },
  );

  it('LineChart does not use raw Dimensions.get for initial width', () => {
    const src = readFile('components/LineChart.tsx');
    // Should not have: useState(Dimensions.get('window').width - N)
    expect(src).not.toMatch(/useState\(\s*Dimensions\.get\(['"]window['"]\)\.width/);
    // Should use useResponsiveLayout or onLayout
    expect(src.includes('useResponsiveLayout') || src.includes('onLayout')).toBe(true);
  });

  it('BottomNav has maxWidth constraint for iPad', () => {
    const src = readFile('components/BottomNav.tsx');
    expect(src).toContain('maxWidth');
  });
});

// ---------------------------------------------------------------------------
// 2. App Store Compliance
// ---------------------------------------------------------------------------

describe('App Store compliance', () => {
  it('Settings screen has account deletion (Guideline 5.1.1(v))', () => {
    const src = readFile('app/settings.tsx');
    expect(src).toContain('deleteAccount');
    expect(src).toContain('Delete Account');
  });

  it('Privacy policy screen exists', () => {
    expect(fileExists('app/privacy.tsx')).toBe(true);
  });

  it('Settings screen links to privacy policy', () => {
    const src = readFile('app/settings.tsx');
    expect(src.toLowerCase()).toContain('privacy');
  });

  it('Login screen has privacy policy link (pre-auth access)', () => {
    const src = readFile('app/(auth)/login.tsx');
    expect(src.toLowerCase()).toContain('privacy');
  });

  it('app.json has required iOS metadata', () => {
    const appJson = JSON.parse(readFile('app.json'));
    const ios = appJson.expo.ios;
    expect(ios.bundleIdentifier).toBeTruthy();
    expect(ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(ios.usesAppleSignIn).toBe(true);
    expect(ios.supportsTablet).toBe(true);
  });

  it('Login screen offers both Google and Apple sign-in', () => {
    const src = readFile('app/(auth)/login.tsx');
    expect(src).toContain('Google');
    expect(src).toContain('Apple');
  });

  it('No placeholder content in user-facing screen text', () => {
    const placeholders = ['TODO:', 'FIXME:', 'coming soon', 'lorem ipsum'];
    for (const file of SCREENS_REQUIRING_RESPONSIVE) {
      const src = readFile(file);
      // Strip code comments (// and /* */ blocks) before checking
      const withoutComments = src
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .toLowerCase();
      for (const p of placeholders) {
        const found = withoutComments.includes(p.toLowerCase());
        if (found) {
          throw new Error(`Placeholder "${p}" found in ${file}`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Screen Smoke Test Coverage
// ---------------------------------------------------------------------------

describe('Screen smoke test coverage', () => {
  const ALL_ROUTABLE_SCREENS = [
    '(tabs)/index',
    '(tabs)/log',
    '(tabs)/compare',
    'settings',
    'privacy',
    'wellness',
    'notifications',
    'household',
    'cats/new',
    'cats/[id]/index',
    'cats/[id]/edit',
    'cats/[id]/care-item',
    'cats/[id]/export',
    'cats/[id]/memorial',
    'cats/[id]/health',
    'import',
    'invite',
    '(auth)/login',
  ];

  it('smoke test file covers all routable screens', () => {
    const smokeTestSrc = readFile('__tests__/screens/smoke.test.tsx');
    for (const screen of ALL_ROUTABLE_SCREENS) {
      // Use string includes instead of regex — simpler and avoids escaping issues
      const found = smokeTestSrc.includes(screen);
      if (!found) {
        throw new Error(`Screen "${screen}" is not covered in smoke.test.tsx`);
      }
    }
  });

  it('iPad smoke test file covers all routable screens', () => {
    const ipadTestSrc = readFile('__tests__/screens/ipad-smoke.test.tsx');
    for (const screen of ALL_ROUTABLE_SCREENS) {
      const found = ipadTestSrc.includes(screen);
      if (!found) {
        throw new Error(`Screen "${screen}" is not covered in ipad-smoke.test.tsx`);
      }
    }
  });
});
