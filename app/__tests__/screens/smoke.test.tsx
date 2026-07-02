/**
 * Screen smoke tests — verify every screen can mount without crashing.
 *
 * These tests use @testing-library/react with jsdom, mocking all React Native
 * and Expo modules (see setup.ts). They catch:
 *   - Import errors (broken/missing dependencies)
 *   - Null reference errors during initial render
 *   - Component tree errors (bad props, missing context)
 *   - State initialization bugs
 *
 * They do NOT test visual layout, native gestures, or device-specific behavior.
 */
import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { fixtures } from './setup';

// ---------------------------------------------------------------------------
// Helper: render a screen and wait for async effects (data fetching)
// ---------------------------------------------------------------------------
async function renderScreen(Component: React.ComponentType<any>, props: Record<string, any> = {}) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(React.createElement(Component, props));
  });
  // Allow microtasks (API mock resolves) to flush
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result!;
}

// ===========================================================================
// CORE SCREENS (highest crash risk)
// ===========================================================================

describe('CatProfile screen', () => {
  let CatProfile: React.ComponentType<any>;

  beforeAll(async () => {
    CatProfile = (await import('../../app/cats/[id]/index')).default;
  });

  it('renders without crashing with valid data', async () => {
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('renders the cat name', async () => {
    await renderScreen(CatProfile);
    await waitFor(() => {
      expect(screen.getByText('Luna')).toBeTruthy();
    });
  });

  it('renders health/care/about tabs', async () => {
    await renderScreen(CatProfile);
    await waitFor(() => {
      expect(screen.getByText('Health')).toBeTruthy();
      expect(screen.getByText('Care')).toBeTruthy();
      expect(screen.getByText('About')).toBeTruthy();
    });
  });
});

describe('Home screen', () => {
  let HomeScreen: React.ComponentType<any>;

  beforeAll(async () => {
    HomeScreen = (await import('../../app/(tabs)/index')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(HomeScreen);
    expect(container).toBeTruthy();
  });

  it('renders the My Cats header', async () => {
    await renderScreen(HomeScreen);
    await waitFor(() => {
      expect(screen.getByText('My Cats')).toBeTruthy();
    });
  });

  it('renders cat cards from fixture data', async () => {
    await renderScreen(HomeScreen);
    await waitFor(() => {
      expect(screen.getByText('Luna')).toBeTruthy();
    });
  });
});

describe('Compare screen', () => {
  let CompareScreen: React.ComponentType<any>;

  beforeAll(async () => {
    CompareScreen = (await import('../../app/(tabs)/compare')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(CompareScreen);
    expect(container).toBeTruthy();
  });

  it('renders time range preset buttons (1W, 1M, 3M, 6M, 1Y, All)', async () => {
    await renderScreen(CompareScreen);
    await waitFor(() => {
      expect(screen.getByText('1W')).toBeTruthy();
      expect(screen.getByText('1M')).toBeTruthy();
      expect(screen.getByText('3M')).toBeTruthy();
      expect(screen.getByText('6M')).toBeTruthy();
      expect(screen.getByText('1Y')).toBeTruthy();
      expect(screen.getByText('All')).toBeTruthy();
    });
  });
});

describe('Log (Daily Check-In) screen', () => {
  let LogScreen: React.ComponentType<any>;

  beforeAll(async () => {
    LogScreen = (await import('../../app/(tabs)/log')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(LogScreen);
    expect(container).toBeTruthy();
  });

  it('renders the Daily Check-In header', async () => {
    await renderScreen(LogScreen);
    expect(screen.getByText('Daily Check-In')).toBeTruthy();
  });

  it('renders date picker button with "Today"', async () => {
    await renderScreen(LogScreen);
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
  });

  it('renders full 24-hour time range (12:00 AM through 11:00 PM)', async () => {
    await renderScreen(LogScreen);
    await waitFor(() => {
      expect(screen.getByText('12:00 AM')).toBeTruthy();
      expect(screen.getByText('6:00 AM')).toBeTruthy();
      expect(screen.getByText('12:00 PM')).toBeTruthy();
      expect(screen.getByText('11:00 PM')).toBeTruthy();
    });
  });

  it('renders weight input with visible placeholder', async () => {
    const { container } = await renderScreen(LogScreen);
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('Leave blank to skip')).toBeTruthy();
  });
});

// ===========================================================================
// CAT MANAGEMENT SCREENS
// ===========================================================================

describe('AddCat screen', () => {
  let AddCat: React.ComponentType<any>;

  beforeAll(async () => {
    AddCat = (await import('../../app/cats/new')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(AddCat);
    expect(container).toBeTruthy();
  });

  it('renders the Add Cat button', async () => {
    await renderScreen(AddCat);
    expect(screen.getByText('Add Cat')).toBeTruthy();
  });

  it('renders birthdate picker button (not text input)', async () => {
    await renderScreen(AddCat);
    expect(screen.getByText('Select birthdate')).toBeTruthy();
  });

  it('renders sex segmented control with Male and Female options', async () => {
    await renderScreen(AddCat);
    expect(screen.getByText('Male')).toBeTruthy();
    expect(screen.getByText('Female')).toBeTruthy();
  });
});

describe('EditCat screen', () => {
  let EditCat: React.ComponentType<any>;

  beforeAll(async () => {
    EditCat = (await import('../../app/cats/[id]/edit')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(EditCat);
    expect(container).toBeTruthy();
  });
});

describe('CatExport screen', () => {
  let CatExport: React.ComponentType<any>;

  beforeAll(async () => {
    CatExport = (await import('../../app/cats/[id]/export')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(CatExport);
    expect(container).toBeTruthy();
  });
});

describe('Sitter screen', () => {
  let Sitter: React.ComponentType<any>;

  beforeAll(async () => {
    Sitter = (await import('../../app/cats/[id]/sitter')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Sitter);
    expect(container).toBeTruthy();
  });

  it('renders cat name and the Daily Schedule section', async () => {
    await renderScreen(Sitter);
    await waitFor(() => {
      expect(screen.getByText('Luna')).toBeTruthy();
      expect(screen.getByText('Daily Schedule')).toBeTruthy();
    });
  });

  it('renders a Share button', async () => {
    await renderScreen(Sitter);
    await waitFor(() => {
      expect(screen.getByLabelText('Share sitter view')).toBeTruthy();
    });
  });

  it('groups scheduled meds and surfaces an as-needed section when present', async () => {
    const { api } = (await import('../../lib/api')) as any;
    api.getMedications.mockResolvedValueOnce([
      {
        id: 'sched1', cat_id: 'test-cat-123', name: 'Subcutaneous fluids',
        type: 'subq_fluids', frequency: 'daily', dose: '100mL LRS',
        reminder_time: '08:00', notes: null, is_active: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'prn1', cat_id: 'test-cat-123', name: 'Gabapentin',
        type: 'medication', frequency: 'as_needed', dose: '50mg',
        notes: 'If hiding or limping', is_active: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await renderScreen(Sitter);
    await waitFor(() => {
      expect(screen.getByText('Subcutaneous fluids')).toBeTruthy();
      expect(screen.getByText('Gabapentin')).toBeTruthy();
      // As-Needed heading is split across nested Text nodes; assert the trailing copy.
      expect(screen.getByText(/only if triggered/)).toBeTruthy();
    });
  });

  it('handles a cat with no medications', async () => {
    const { api } = (await import('../../lib/api')) as any;
    api.getMedications.mockResolvedValueOnce([]);
    const { container } = await renderScreen(Sitter);
    expect(container).toBeTruthy();
    expect(screen.getByText('No scheduled medications.')).toBeTruthy();
  });
});

describe('CatHealth screen', () => {
  let CatHealth: React.ComponentType<any>;

  beforeAll(async () => {
    CatHealth = (await import('../../app/cats/[id]/health')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(CatHealth);
    expect(container).toBeTruthy();
  });
});

describe('Memorial screen', () => {
  let Memorial: React.ComponentType<any>;

  beforeAll(async () => {
    Memorial = (await import('../../app/cats/[id]/memorial')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Memorial);
    expect(container).toBeTruthy();
  });

  it('renders cat name and life summary for a deceased cat', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      deceased_at: '2026-03-01',
      memorial_note: 'Always in our hearts',
    });
    await renderScreen(Memorial);
    await waitFor(() => {
      expect(screen.getByText('Luna')).toBeTruthy();
      expect(screen.getByText(/Always in our hearts/)).toBeTruthy();
      expect(screen.getByText('Life summary')).toBeTruthy();
    });
  });

  it('renders lifespan calculation', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      birthdate: '2022-03-15',
      deceased_at: '2026-03-01',
    });
    await renderScreen(Memorial);
    await waitFor(() => {
      expect(screen.getByText(/4 years of life/)).toBeTruthy();
    });
  });

  it('renders weight history section when measurements exist', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      deceased_at: '2026-03-01',
    });
    await renderScreen(Memorial);
    await waitFor(() => {
      expect(screen.getByText('Weight history')).toBeTruthy();
    });
  });

  it('handles cat with no measurements', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      deceased_at: '2026-03-01',
    });
    api.getMeasurements.mockResolvedValueOnce([]);
    const { container } = await renderScreen(Memorial);
    expect(container).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('0')).toBeTruthy(); // measurements logged = 0
    });
  });

  it('renders edit memorial button', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      deceased_at: '2026-03-01',
    });
    await renderScreen(Memorial);
    await waitFor(() => {
      expect(screen.getByText('Edit memorial')).toBeTruthy();
    });
  });
});

// ===========================================================================
// UTILITY SCREENS
// ===========================================================================

describe('Settings screen', () => {
  let Settings: React.ComponentType<any>;

  beforeAll(async () => {
    Settings = (await import('../../app/settings')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Settings);
    expect(container).toBeTruthy();
  });
});

describe('Wellness Guide screen', () => {
  let Wellness: React.ComponentType<any>;

  beforeAll(async () => {
    Wellness = (await import('../../app/wellness')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Wellness);
    expect(container).toBeTruthy();
  });

  it('renders guide sections', async () => {
    await renderScreen(Wellness);
    expect(screen.getByText('Weight Monitoring')).toBeTruthy();
    expect(screen.getByText('Food & Water Intake')).toBeTruthy();
  });
});

describe('Notifications screen', () => {
  let Notifications: React.ComponentType<any>;

  const overdueDose = (id: string) => ({
    id,
    medication_id: 'med1',
    due_at: '2026-06-30 09:00',
    administered_at: null,
    skipped: 0,
    skip_reason: null,
    notes: null,
    created_at: '2026-06-30 09:00',
    med_name: 'Flea Prevention',
    dose: null,
    med_type: 'flea',
    cat_name: 'Luna',
    cat_id: 'test-cat-123',
  });

  beforeAll(async () => {
    Notifications = (await import('../../app/notifications')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Notifications);
    expect(container).toBeTruthy();
  });

  it('shows bulk actions in the Overdue header with 2+ overdue doses', async () => {
    const { api } = (await import('../../lib/api')) as any;
    api.getNotifications.mockResolvedValueOnce({
      overdue: [overdueDose('d1'), overdueDose('d2')],
      due_today: [], upcoming: [], refill_alerts: [],
    });
    await renderScreen(Notifications);
    await waitFor(() => {
      expect(screen.getByText('Mark all given')).toBeTruthy();
      expect(screen.getByText('Dismiss all')).toBeTruthy();
    });
  });

  it('hides bulk actions with a single overdue dose', async () => {
    const { api } = (await import('../../lib/api')) as any;
    api.getNotifications.mockResolvedValueOnce({
      overdue: [overdueDose('d1')],
      due_today: [], upcoming: [], refill_alerts: [],
    });
    await renderScreen(Notifications);
    await waitFor(() => expect(screen.getByText('Overdue')).toBeTruthy());
    expect(screen.queryByText('Mark all given')).toBeNull();
    expect(screen.queryByText('Dismiss all')).toBeNull();
  });

  it('calls bulkDoseAction with all overdue ids when Mark all given is pressed', async () => {
    const { api } = (await import('../../lib/api')) as any;
    api.getNotifications.mockResolvedValueOnce({
      overdue: [overdueDose('d1'), overdueDose('d2')],
      due_today: [], upcoming: [], refill_alerts: [],
    });
    await renderScreen(Notifications);
    await waitFor(() => expect(screen.getByText('Mark all given')).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText('Mark all given'));
    });
    await waitFor(() =>
      expect(api.bulkDoseAction).toHaveBeenCalledWith(['d1', 'd2'], 'administer'),
    );
  });
});

describe('Household screen', () => {
  let Household: React.ComponentType<any>;

  beforeAll(async () => {
    Household = (await import('../../app/household')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Household);
    expect(container).toBeTruthy();
  });
});

describe('Privacy screen', () => {
  let Privacy: React.ComponentType<any>;

  beforeAll(async () => {
    Privacy = (await import('../../app/privacy')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Privacy);
    expect(container).toBeTruthy();
  });
});

describe('CareItem screen', () => {
  let CareItem: React.ComponentType<any>;

  beforeAll(async () => {
    CareItem = (await import('../../app/cats/[id]/care-item')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(CareItem);
    expect(container).toBeTruthy();
  });

  it('loads cat data and renders form', async () => {
    const { container } = await renderScreen(CareItem);
    // Should have loaded cat data from mock API
    expect(container.innerHTML).toContain('Luna');
  });

  it('renders the schedule mode control with both options', async () => {
    await renderScreen(CareItem);
    expect(screen.getByText('After a dose is given')).toBeTruthy();
    expect(screen.getByText('Stick to schedule')).toBeTruthy();
    expect(screen.getByText('Restart the interval')).toBeTruthy();
  });

  it('keeps the schedule mode control when custom frequency is selected', async () => {
    await renderScreen(CareItem);
    await act(async () => {
      fireEvent.click(screen.getByText('Custom interval'));
    });
    expect(screen.getByText('After a dose is given')).toBeTruthy();
    expect(screen.getByText('Restart the interval')).toBeTruthy();
  });

  it('hides the schedule mode control for as-needed frequency', async () => {
    await renderScreen(CareItem);
    await act(async () => {
      fireEvent.click(screen.getByText('As needed (no schedule)'));
    });
    expect(screen.queryByText('After a dose is given')).toBeNull();
  });

  it('shows the past-start-date prompt in create mode when a past date is picked', async () => {
    const { container } = await renderScreen(CareItem);
    const { todayLocalDate } = await import('@shared/lib/formatting');

    // Open the start-date picker (field shows today's date by default)
    const dateField = screen.getByText(todayLocalDate()).closest('button')!;
    await act(async () => {
      fireEvent.click(dateField);
    });

    // The mocked DateTimePicker fires onChange with 2020-01-01 on click
    const picker = container.querySelector('[data-component="DateTimePicker"]')!;
    await act(async () => {
      fireEvent.click(picker);
    });

    await waitFor(() => {
      expect(screen.getByText(/start date is in the past/i)).toBeTruthy();
      expect(screen.getByText('Yes')).toBeTruthy();
      expect(screen.getByText('No')).toBeTruthy();
    });
  });
});

describe('Import screen', () => {
  let Import: React.ComponentType<any>;

  beforeAll(async () => {
    Import = (await import('../../app/import')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Import);
    expect(container).toBeTruthy();
  });

  it('renders the Import Data header', async () => {
    await renderScreen(Import);
    expect(screen.getByText('Import Data')).toBeTruthy();
  });
});

describe('Invite screen', () => {
  let Invite: React.ComponentType<any>;

  beforeAll(async () => {
    Invite = (await import('../../app/invite')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Invite);
    expect(container).toBeTruthy();
  });
});

describe('Login screen', () => {
  let Login: React.ComponentType<any>;

  beforeAll(async () => {
    Login = (await import('../../app/(auth)/login')).default;
  });

  it('renders without crashing', async () => {
    const { container } = await renderScreen(Login);
    expect(container).toBeTruthy();
  });

  it('renders sign-in buttons', async () => {
    await renderScreen(Login);
    await waitFor(() => {
      expect(screen.getByText(/sign in with google/i)).toBeTruthy();
    });
  });
});

// ===========================================================================
// LOCALIZATION & LANDSCAPE FEATURES
// ===========================================================================

describe('Settings — Regional preferences', () => {
  let Settings: React.ComponentType<any>;

  beforeAll(async () => {
    Settings = (await import('../../app/settings')).default;
  });

  it('renders Regional section with date/time/weight controls', async () => {
    await renderScreen(Settings);
    await waitFor(() => {
      expect(screen.getByText('Regional')).toBeTruthy();
      expect(screen.getByText('Date format')).toBeTruthy();
      expect(screen.getByText('Time format')).toBeTruthy();
      expect(screen.getByText('Weight unit')).toBeTruthy();
    });
  });

  it('renders date format options', async () => {
    await renderScreen(Settings);
    await waitFor(() => {
      expect(screen.getByText('MM/DD')).toBeTruthy();
      expect(screen.getByText('DD/MM')).toBeTruthy();
      expect(screen.getByText('YYYY-MM')).toBeTruthy();
    });
  });

  it('renders weight unit options', async () => {
    await renderScreen(Settings);
    await waitFor(() => {
      expect(screen.getByText('lbs')).toBeTruthy();
      expect(screen.getByText('kg')).toBeTruthy();
    });
  });
});

describe('CatProfile — chart expand button', () => {
  let CatProfile: React.ComponentType<any>;

  beforeAll(async () => {
    CatProfile = (await import('../../app/cats/[id]/index')).default;
  });

  it('renders expand button on weight chart', async () => {
    await renderScreen(CatProfile);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand chart').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Compare — chart expand button', () => {
  let CompareScreen: React.ComponentType<any>;

  beforeAll(async () => {
    CompareScreen = (await import('../../app/(tabs)/compare')).default;
  });

  it('renders expand button on compare chart', async () => {
    await renderScreen(CompareScreen);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Expand chart').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Home — localized weight display', () => {
  let HomeScreen: React.ComponentType<any>;

  beforeAll(async () => {
    HomeScreen = (await import('../../app/(tabs)/index')).default;
  });

  it('renders cat weight with unit from preferences', async () => {
    await renderScreen(HomeScreen);
    await waitFor(() => {
      // Default prefs are US (lbs). Cat fixture has weight 10.2.
      expect(screen.getByText(/lbs/)).toBeTruthy();
    });
  });
});

describe('Log — default weight unit from preferences', () => {
  let LogScreen: React.ComponentType<any>;

  beforeAll(async () => {
    LogScreen = (await import('../../app/(tabs)/log')).default;
  });

  it('renders weight unit selector defaulting to preferences', async () => {
    await renderScreen(LogScreen);
    await waitFor(() => {
      expect(screen.getByText('lbs')).toBeTruthy();
    });
  });
});

// ===========================================================================
// EDGE CASES — CatProfile with degenerate data
// ===========================================================================

describe('CatProfile edge cases', () => {
  let CatProfile: React.ComponentType<any>;

  beforeAll(async () => {
    CatProfile = (await import('../../app/cats/[id]/index')).default;
  });

  it('handles zero measurements without crashing', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getMeasurements.mockResolvedValueOnce([]);
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('handles zero medications without crashing', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getMedications.mockResolvedValueOnce([]);
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('handles a single weight measurement', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getMeasurements.mockResolvedValueOnce([fixtures.measurements[0]]);
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('handles a deceased cat', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      deceased_at: '2026-03-01',
      memorial_note: 'Always in our hearts',
    });
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('handles cat with no breed or birthdate', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockResolvedValueOnce({
      ...fixtures.cat,
      breed: null,
      birthdate: null,
      coloring: null,
    });
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });

  it('handles API error gracefully', async () => {
    const { api } = await import('../../lib/api') as any;
    api.getCat.mockRejectedValueOnce(new Error('Network error'));
    api.getMeasurements.mockRejectedValueOnce(new Error('Network error'));
    api.getMedications.mockRejectedValueOnce(new Error('Network error'));
    const { container } = await renderScreen(CatProfile);
    expect(container).toBeTruthy();
  });
});
