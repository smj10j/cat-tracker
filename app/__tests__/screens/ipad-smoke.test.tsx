/**
 * iPad smoke tests — verify every screen renders without crashing at iPad dimensions.
 *
 * These tests mirror the existing smoke tests but with screen dimensions set to
 * iPad Air 11-inch (1024x1366). This catches:
 *   - Conditional rendering that breaks at wide widths
 *   - Layout calculations that produce invalid values on iPad
 *   - Components that assume phone dimensions
 *   - ResponsiveContainer / rv() scaling working correctly
 */
// @vitest-environment jsdom
import React from 'react';
import { render, act } from '@testing-library/react';
import { setMockScreenDimensions, resetMockScreenDimensions } from './setup';

// Set iPad dimensions before all tests
beforeAll(() => {
  setMockScreenDimensions(1024, 1366);
});

afterAll(() => {
  resetMockScreenDimensions();
});

async function renderScreen(Component: React.ComponentType<any>) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(React.createElement(Component));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result!;
}

// ---------------------------------------------------------------------------
// Every routable screen must mount without crashing at iPad dimensions
// ---------------------------------------------------------------------------

describe('iPad smoke tests — all screens render at 1024x1366', () => {
  it('Home screen', async () => {
    const Screen = (await import('../../app/(tabs)/index')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Log screen', async () => {
    const Screen = (await import('../../app/(tabs)/log')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Compare screen', async () => {
    const Screen = (await import('../../app/(tabs)/compare')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Settings screen', async () => {
    const Screen = (await import('../../app/settings')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Cat Profile screen', async () => {
    const Screen = (await import('../../app/cats/[id]/index')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('New Cat screen', async () => {
    const Screen = (await import('../../app/cats/new')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Edit Cat screen', async () => {
    const Screen = (await import('../../app/cats/[id]/edit')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Care Item screen', async () => {
    const Screen = (await import('../../app/cats/[id]/care-item')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Export screen', async () => {
    const Screen = (await import('../../app/cats/[id]/export')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Memorial screen', async () => {
    const Screen = (await import('../../app/cats/[id]/memorial')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Health screen', async () => {
    const Screen = (await import('../../app/cats/[id]/health')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Wellness screen', async () => {
    const Screen = (await import('../../app/wellness')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Notifications screen', async () => {
    const Screen = (await import('../../app/notifications')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Household screen', async () => {
    const Screen = (await import('../../app/household')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Privacy screen', async () => {
    const Screen = (await import('../../app/privacy')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Import screen', async () => {
    const Screen = (await import('../../app/import')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Invite screen', async () => {
    const Screen = (await import('../../app/invite')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });

  it('Login screen', async () => {
    const Screen = (await import('../../app/(auth)/login')).default;
    const { container } = await renderScreen(Screen);
    expect(container).toBeTruthy();
  });
});
