import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from '../../pages/NotificationsPage'

// Mock the API module
vi.mock('../../lib/api', () => ({
  getNotifications: vi.fn(),
  administerDose: vi.fn(),
  skipDose: vi.fn(),
  bulkDoseAction: vi.fn(),
  CARE_TYPE_ICONS: { flea: '🪳', medication: '💊' },
}))

import { getNotifications, bulkDoseAction } from '../../lib/api'

function overdueDose(id: string) {
  return {
    id,
    medication_id: 'med1',
    due_at: '2026-06-30 09:00',
    administered_at: null,
    skipped: 0,
    skip_reason: null,
    notes: null,
    missed: 0,
    created_at: '2026-06-30 09:00',
    med_name: 'Flea Prevention',
    dose: null,
    med_type: 'flea',
    cat_name: 'Luna',
    cat_id: 'cat-1',
  }
}

function inboxWith(overdue: ReturnType<typeof overdueDose>[]) {
  return { overdue, due_today: [], upcoming: [], refill_alerts: [] } as never
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(bulkDoseAction).mockResolvedValue({ updated: 2 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NotificationsPage — bulk overdue actions', () => {
  it('shows bulk buttons in the Overdue header with 2+ overdue doses', async () => {
    vi.mocked(getNotifications).mockResolvedValue(inboxWith([overdueDose('d1'), overdueDose('d2')]))
    renderPage()

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Mark all given' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss all' })).toBeInTheDocument()
  })

  it('hides bulk buttons with a single overdue dose', async () => {
    vi.mocked(getNotifications).mockResolvedValue(inboxWith([overdueDose('d1')]))
    renderPage()

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Mark all given' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss all' })).toBeNull()
  })

  it('Mark all given calls bulkDoseAction with all overdue ids and refetches', async () => {
    vi.mocked(getNotifications).mockResolvedValue(inboxWith([overdueDose('d1'), overdueDose('d2')]))
    renderPage()

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Mark all given' }))

    await waitFor(() =>
      expect(vi.mocked(bulkDoseAction)).toHaveBeenCalledWith(['d1', 'd2'], 'administer')
    )
    // Initial load + refetch after the bulk action
    await waitFor(() => expect(vi.mocked(getNotifications)).toHaveBeenCalledTimes(2))
  })

  it('Dismiss all confirms before calling bulkDoseAction with skip', async () => {
    vi.mocked(getNotifications).mockResolvedValue(inboxWith([overdueDose('d1'), overdueDose('d2')]))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss all' }))

    expect(confirmSpy).toHaveBeenCalledWith('Dismiss all 2 overdue doses?')
    await waitFor(() =>
      expect(vi.mocked(bulkDoseAction)).toHaveBeenCalledWith(['d1', 'd2'], 'skip')
    )
  })

  it('Dismiss all does nothing when the confirm is cancelled', async () => {
    vi.mocked(getNotifications).mockResolvedValue(inboxWith([overdueDose('d1'), overdueDose('d2')]))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss all' }))

    expect(vi.mocked(bulkDoseAction)).not.toHaveBeenCalled()
  })
})
