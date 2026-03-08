import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DailyCheckin from '../../pages/DailyCheckin'

// Mock the API module
vi.mock('../../lib/api', () => ({
  getCats: vi.fn(),
  createMeasurement: vi.fn(),
}))

import { getCats, createMeasurement } from '../../lib/api'

const mockCats = [
  {
    id: 'cat-1',
    name: 'Simba',
    birthdate: '2020-01-01',
    breed: null,
    coloring: null,
    notes: null,
    photo_url: null,
    sex: null,
    is_neutered: null,
    microchip_id: null,
    household_id: null,
    household_name: null,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    name: 'Luna',
    birthdate: '2021-06-15',
    breed: null,
    coloring: null,
    notes: null,
    photo_url: null,
    sex: null,
    is_neutered: null,
    microchip_id: null,
    household_id: null,
    household_name: null,
    created_at: '2021-06-15T00:00:00Z',
    updated_at: '2021-06-15T00:00:00Z',
  },
]

function renderCheckin() {
  return render(
    <MemoryRouter>
      <DailyCheckin />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCats).mockResolvedValue(mockCats)
  vi.mocked(createMeasurement).mockResolvedValue({} as never)
})

describe('DailyCheckin', () => {
  it('renders all behavioral measurement types', async () => {
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('Litter')).toBeInTheDocument()
    expect(screen.getByText('Grooming')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.getByText('Vomiting')).toBeInTheDocument()
  })

  it('submit button is disabled when nothing is selected', async () => {
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    // With one cat it auto-selects, but no measurements chosen yet
    const button = screen.getByRole('button', { name: /log check-in/i })
    expect(button).toBeDisabled()
  })

  it('auto-selects the only cat when there is one', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())
    // Cat selector should be hidden; header shows cat name
    expect(screen.queryByRole('combobox', { name: /cat/i })).toBeNull()
  })

  it('shows cat selector when there are multiple cats', async () => {
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())
    // Cat selector shows the placeholder option; other selects (hour, unit) do not
    expect(screen.getByRole('option', { name: 'Select a cat…' })).toBeInTheDocument()
  })

  it('updates measurement count when a preset is selected', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    // "Most" appears for food and water — click the first one (food)
    fireEvent.click(screen.getAllByRole('button', { name: 'Most' })[0]!)

    await waitFor(() =>
      expect(screen.getByText(/logging 1 measurement/i)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /log check-in/i })).not.toBeDisabled()
  })

  it('deselects a preset when tapped again', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    // "Most" appears for food and water — use the first (food)
    const mostButtons = screen.getAllByRole('button', { name: 'Most' })
    fireEvent.click(mostButtons[0]!) // select food=Most
    await waitFor(() => expect(screen.getByText(/logging 1 measurement/i)).toBeInTheDocument())

    fireEvent.click(mostButtons[0]!) // deselect
    await waitFor(() => expect(screen.queryByText(/logging 1 measurement/i)).toBeNull())
  })

  it('counts weight as a measurement when a valid value is entered', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    const weightInput = screen.getByPlaceholderText(/leave blank to skip/i)
    fireEvent.change(weightInput, { target: { value: '9.4' } })

    await waitFor(() =>
      expect(screen.getByText(/logging 1 measurement/i)).toBeInTheDocument()
    )
  })

  it('calls createMeasurement for each selected type on submit', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    // Select food = Most (value 2) and activity = Normal (value 2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Most' })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: 'Normal' })[0]!)

    fireEvent.click(screen.getByRole('button', { name: /log check-in/i }))

    await waitFor(() => expect(vi.mocked(createMeasurement)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createMeasurement)).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ type: 'food', value: 2, unit: 'scale' })
    )
  })

  it('fires measurementAdded event on successful submit', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    const listener = vi.fn()
    window.addEventListener('measurementAdded', listener)

    fireEvent.click(screen.getByRole('button', { name: 'Once' }))
    fireEvent.click(screen.getByRole('button', { name: /log check-in/i }))

    await waitFor(() => expect(listener).toHaveBeenCalled())
    window.removeEventListener('measurementAdded', listener)
  })

  it('resets form after successful submit', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Once' }))
    await waitFor(() => expect(screen.getByText(/logging 1 measurement/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /log check-in/i }))

    // After reset, count disappears
    await waitFor(() => expect(screen.queryByText(/logging 1 measurement/i)).toBeNull())
  })

  it('shows an error when createMeasurement fails', async () => {
    vi.mocked(getCats).mockResolvedValue([mockCats[0]!])
    vi.mocked(createMeasurement).mockRejectedValue(new Error('Network error'))
    renderCheckin()
    await waitFor(() => expect(screen.getByText('Simba')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Once' }))
    fireEvent.click(screen.getByRole('button', { name: /log check-in/i }))

    await waitFor(() =>
      expect(screen.getByText(/could not be saved/i)).toBeInTheDocument()
    )
  })
})
