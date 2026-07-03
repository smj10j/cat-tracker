import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../../pages/SettingsPage'

// Mock the API module (only the methods SettingsPage touches)
vi.mock('../../lib/api', () => ({
  updateMe: vi.fn(),
  getCats: vi.fn(),
  getMedications: vi.fn(),
  getNotificationPrefs: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  setMedicationMute: vi.fn(),
}))

// Mock the contexts SettingsPage depends on so we can render it standalone.
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: 'dark', setMode: vi.fn(), family: 'lamplight', setFamily: vi.fn() }),
}))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email_reminders: 1 }, refresh: vi.fn() }),
}))
vi.mock('../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    prefs: { dateFormat: 'MDY', timeFormat: '12h', weightUnit: 'lbs' },
    setPref: vi.fn(),
    resetToLocale: vi.fn(),
    isOverridden: () => false,
  }),
}))
vi.mock('../../hooks/useGoBack', () => ({ useGoBack: () => vi.fn() }))

import {
  getCats, getMedications, getNotificationPrefs, updateNotificationPrefs, setMedicationMute,
} from '../../lib/api'

function prefsFixture(overrides: Record<string, unknown> = {}) {
  return {
    digest_enabled: 0,
    digest_time: '08:00',
    digest_last_sent_date: null,
    quiet_hours_start: null,
    quiet_hours_end: null,
    ...overrides,
  } as never
}

const mutedMed = {
  id: 'med-1', cat_id: 'cat-1', name: 'Appetite stimulant', muted: 1,
} as never
const unmutedMed = {
  id: 'med-2', cat_id: 'cat-1', name: 'Methimazole', muted: 0,
} as never
const cats = [{ id: 'cat-1', name: 'Peanut' }] as never

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getNotificationPrefs).mockResolvedValue(prefsFixture())
  vi.mocked(getMedications).mockResolvedValue([mutedMed, unmutedMed])
  vi.mocked(getCats).mockResolvedValue(cats)
  vi.mocked(updateNotificationPrefs).mockImplementation(async (patch) => prefsFixture(patch as object))
  vi.mocked(setMedicationMute).mockResolvedValue({ muted: false })
})

describe('SettingsPage — Notifications: daily digest', () => {
  it('turns the digest on and persists digest_enabled', async () => {
    renderPage()
    const toggle = await screen.findByRole('switch', { name: 'Daily digest' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(vi.mocked(updateNotificationPrefs)).toHaveBeenCalledWith({ digest_enabled: 1 })
    )
    // Time input appears once enabled
    expect(await screen.findByLabelText('Time')).toBeInTheDocument()
  })

  it('shows the time input and persists digest_time when digest is already on', async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValue(prefsFixture({ digest_enabled: 1 }))
    renderPage()

    const time = await screen.findByLabelText('Time')
    fireEvent.change(time, { target: { value: '07:30' } })

    await waitFor(() =>
      expect(vi.mocked(updateNotificationPrefs)).toHaveBeenCalledWith({ digest_time: '07:30' })
    )
  })
})

describe('SettingsPage — Notifications: quiet hours', () => {
  it('persists a quiet-hours start and sends null when cleared', async () => {
    renderPage()
    const start = await screen.findByLabelText('Start')

    fireEvent.change(start, { target: { value: '22:00' } })
    await waitFor(() =>
      expect(vi.mocked(updateNotificationPrefs)).toHaveBeenCalledWith({ quiet_hours_start: '22:00' })
    )

    fireEvent.change(start, { target: { value: '' } })
    await waitFor(() =>
      expect(vi.mocked(updateNotificationPrefs)).toHaveBeenCalledWith({ quiet_hours_start: null })
    )
  })
})

describe('SettingsPage — Notifications: muted care items', () => {
  it('lists muted items with the cat name and unmutes on click', async () => {
    renderPage()

    // Only the muted med is listed
    expect(await screen.findByText('Appetite stimulant')).toBeInTheDocument()
    expect(screen.getByText('Peanut')).toBeInTheDocument()
    expect(screen.queryByText('Methimazole')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }))

    await waitFor(() =>
      expect(vi.mocked(setMedicationMute)).toHaveBeenCalledWith('med-1', false)
    )
    // Removed from the list optimistically
    await waitFor(() => expect(screen.queryByText('Appetite stimulant')).toBeNull())
  })

  it('shows an empty line when nothing is muted', async () => {
    vi.mocked(getMedications).mockResolvedValue([unmutedMed])
    renderPage()

    expect(await screen.findByText('No muted items.')).toBeInTheDocument()
  })

  it('notes that these settings control the iOS app', async () => {
    renderPage()
    expect(
      await screen.findByText('These settings control notifications on the iOS app.')
    ).toBeInTheDocument()
  })
})
