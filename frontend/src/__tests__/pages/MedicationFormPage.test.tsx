import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MedicationFormPage from '../../pages/MedicationFormPage'

// Mock the API module
vi.mock('../../lib/api', () => ({
  getCat: vi.fn(),
  getMedication: vi.fn(),
  createMedication: vi.fn(),
  updateMedication: vi.fn(),
  archiveMedication: vi.fn(),
}))

import { getCat, createMedication } from '../../lib/api'

const mockCat = {
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
} as never

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/cats/cat-1/medications/new']}>
      <Routes>
        <Route path="/cats/:catId/medications/new" element={<MedicationFormPage />} />
        <Route path="/cats/:catId" element={<div>Cat profile</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCat).mockResolvedValue(mockCat)
  vi.mocked(createMedication).mockResolvedValue({ id: 'med-1', cat_id: 'cat-1' } as never)
})

describe('MedicationFormPage — schedule mode', () => {
  it('renders the schedule mode control for the default (monthly) frequency', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    expect(screen.getByText('After a dose is given')).toBeInTheDocument()
    expect(screen.getByText('Stick to schedule')).toBeInTheDocument()
    expect(screen.getByText('Restart the interval')).toBeInTheDocument()
  })

  it('renders the schedule mode control for custom frequency, defaulting to interval', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'custom' } })

    const restart = screen.getByRole('radio', { name: /restart the interval/i })
    expect(restart).toHaveAttribute('aria-checked', 'true')
    const stick = screen.getByRole('radio', { name: /stick to schedule/i })
    expect(stick).toHaveAttribute('aria-checked', 'false')
  })

  it('resets schedule mode when frequency changes back to a calendar frequency', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    const freq = screen.getByLabelText('Frequency')
    fireEvent.change(freq, { target: { value: 'custom' } })
    fireEvent.change(freq, { target: { value: 'monthly' } })

    expect(screen.getByRole('radio', { name: /stick to schedule/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('hides the schedule mode control for as-needed and twice-daily frequencies', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    const freq = screen.getByLabelText('Frequency')
    fireEvent.change(freq, { target: { value: 'as_needed' } })
    expect(screen.queryByText('After a dose is given')).toBeNull()

    fireEvent.change(freq, { target: { value: 'twice_daily' } })
    expect(screen.queryByText('After a dose is given')).toBeNull()
  })
})

describe('MedicationFormPage — past start date prompt', () => {
  it('shows the prompt with Yes defaulted when the start date is in the past (create mode)', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    expect(screen.queryByText(/start date is in the past/i)).toBeNull()

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } })

    expect(screen.getByText(/start date is in the past/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'false')
  })

  it('hides the prompt when the start date is today', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())
    expect(screen.queryByText(/start date is in the past/i)).toBeNull()
  })

  it('passes first_dose_given to the create payload when answered', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sub-Q Fluids' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } })

    fireEvent.click(screen.getByRole('button', { name: /add care item/i }))

    await waitFor(() => expect(vi.mocked(createMedication)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createMedication)).toHaveBeenCalledWith(
      expect.objectContaining({ first_dose_given: true, start_date: '2020-01-01' })
    )
  })

  it('omits first_dose_given when the start date is today', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText(/for Simba/)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sub-Q Fluids' } })
    fireEvent.click(screen.getByRole('button', { name: /add care item/i }))

    await waitFor(() => expect(vi.mocked(createMedication)).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createMedication).mock.calls[0]![0] as Record<string, unknown>
    expect('first_dose_given' in payload).toBe(false)
  })
})
