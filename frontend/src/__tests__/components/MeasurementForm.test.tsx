import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MeasurementForm from '../../components/MeasurementForm'
import * as api from '../../lib/api'
import type { Measurement } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  createMeasurement: vi.fn(),
}))

const mockMeasurement: Measurement = {
  id: 'meas-1',
  cat_id: 'cat-1',
  type: 'food',
  value: 0,
  unit: 'scale',
  measured_at: '2026-03-08T12:00:00.000Z',
  notes: null,
}

function renderForm(onAdded = vi.fn()) {
  return render(<MeasurementForm catId="cat-1" onAdded={onAdded} />)
}

describe('MeasurementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders collapsed "Add Measurement" button by default', () => {
    renderForm()
    expect(screen.getByRole('button', { name: '+ Add Measurement' })).toBeInTheDocument()
  })

  it('opens the form when "Add Measurement" is clicked', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
    expect(screen.getByText('New Measurement')).toBeInTheDocument()
  })

  it('closes the form when × is clicked', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('New Measurement')).toBeNull()
  })

  describe('weight type', () => {
    it('saves weight on button click', async () => {
      vi.mocked(api.createMeasurement).mockResolvedValue(mockMeasurement)
      const onAdded = vi.fn()
      renderForm(onAdded)
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))

      fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '9.4' } })
      fireEvent.click(screen.getByRole('button', { name: /save weight/i }))

      await waitFor(() => expect(api.createMeasurement).toHaveBeenCalledWith(
        'cat-1',
        expect.objectContaining({ type: 'weight', value: 9.4, unit: 'lbs' }),
      ))
      expect(onAdded).toHaveBeenCalled()
    })

    it('shows error for invalid weight input', async () => {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '-1' } })
      fireEvent.click(screen.getByRole('button', { name: /save weight/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid positive number')
    })

    it('shows actionable error when API call fails', async () => {
      vi.mocked(api.createMeasurement).mockRejectedValue(new Error('Network error'))
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '9.4' } })
      fireEvent.click(screen.getByRole('button', { name: /save weight/i }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent("Couldn't save")
    })
  })

  describe('behavioral preset type (select-then-save model)', () => {
    function openFoodType() {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'food' } })
    }

    it('does NOT save immediately on preset tap — no API call', () => {
      openFoodType()
      const noneBtn = screen.getByRole('button', { name: /^! None$/ })
      fireEvent.click(noneBtn)
      expect(api.createMeasurement).not.toHaveBeenCalled()
    })

    it('shows "Save Food Intake Observation" button after selecting a preset', () => {
      openFoodType()
      fireEvent.click(screen.getByRole('button', { name: /^! None$/ }))
      expect(screen.getByRole('button', { name: /save food intake observation/i })).toBeInTheDocument()
    })

    it('marks the selected preset as aria-pressed=true', () => {
      openFoodType()
      const noneBtn = screen.getByRole('button', { name: /^! None$/ })
      fireEvent.click(noneBtn)
      expect(noneBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('deselects a preset on second tap and hides the save button', () => {
      openFoodType()
      const noneBtn = screen.getByRole('button', { name: /^! None$/ })
      fireEvent.click(noneBtn) // select
      fireEvent.click(noneBtn) // deselect
      expect(noneBtn).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByRole('button', { name: /save food intake observation/i })).toBeNull()
    })

    it('saves the selected preset when "Save" button is clicked', async () => {
      vi.mocked(api.createMeasurement).mockResolvedValue({ ...mockMeasurement, type: 'food', value: 0 })
      const onAdded = vi.fn()
      render(<MeasurementForm catId="cat-1" onAdded={onAdded} />)
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'food' } })

      fireEvent.click(screen.getByRole('button', { name: /^! None$/ }))
      fireEvent.click(screen.getByRole('button', { name: /save food intake observation/i }))

      await waitFor(() => expect(api.createMeasurement).toHaveBeenCalledWith(
        'cat-1',
        expect.objectContaining({ type: 'food', value: 0, unit: 'scale' }),
      ))
      expect(onAdded).toHaveBeenCalled()
    })

    it('shows saved flash after successful save', async () => {
      vi.mocked(api.createMeasurement).mockResolvedValue({ ...mockMeasurement, type: 'food', value: 0 })
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'food' } })
      fireEvent.click(screen.getByRole('button', { name: /^! None$/ }))
      fireEvent.click(screen.getByRole('button', { name: /save food intake observation/i }))

      expect(await screen.findByRole('status')).toHaveTextContent('Saved')
    })
  })

  describe('body condition score (bcs) type', () => {
    function openBcsType() {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'bcs' } })
    }

    it('renders a 1–9 picker (nine score segments) instead of the weight input', () => {
      openBcsType()
      for (let n = 1; n <= 9; n++) {
        expect(screen.getByRole('button', { name: `Score ${n} of 9` })).toBeInTheDocument()
      }
      // No numeric weight field for bcs
      expect(screen.queryByRole('button', { name: /save weight/i })).toBeNull()
    })

    it('does NOT save immediately on score tap — no API call, no Save button until selected', () => {
      openBcsType()
      expect(screen.queryByRole('button', { name: /save body condition/i })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Score 6 of 9' }))
      expect(api.createMeasurement).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /save body condition/i })).toBeInTheDocument()
    })

    it('marks the selected score aria-pressed and shows its WSAVA band label + description', () => {
      openBcsType()
      const six = screen.getByRole('button', { name: 'Score 6 of 9' })
      fireEvent.click(six)
      expect(six).toHaveAttribute('aria-pressed', 'true')
      // Transcribed band label + score-6 footnote appear
      expect(screen.getByText('Over ideal')).toBeInTheDocument()
      expect(screen.getByText('6/9')).toBeInTheDocument()
      expect(screen.getByText(/may be acceptable in some cats/i)).toBeInTheDocument()
    })

    it('saves the selected score as type=bcs, unit=scale', async () => {
      vi.mocked(api.createMeasurement).mockResolvedValue({ ...mockMeasurement, type: 'bcs', value: 6 })
      const onAdded = vi.fn()
      render(<MeasurementForm catId="cat-1" onAdded={onAdded} />)
      fireEvent.click(screen.getByRole('button', { name: '+ Add Measurement' }))
      fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'bcs' } })

      fireEvent.click(screen.getByRole('button', { name: 'Score 6 of 9' }))
      fireEvent.click(screen.getByRole('button', { name: /save body condition/i }))

      await waitFor(() => expect(api.createMeasurement).toHaveBeenCalledWith(
        'cat-1',
        expect.objectContaining({ type: 'bcs', value: 6, unit: 'scale' }),
      ))
      expect(onAdded).toHaveBeenCalled()
    })

    it('re-tapping a different score changes the selection (not a toggle)', () => {
      openBcsType()
      fireEvent.click(screen.getByRole('button', { name: 'Score 3 of 9' }))
      fireEvent.click(screen.getByRole('button', { name: 'Score 7 of 9' }))
      expect(screen.getByRole('button', { name: 'Score 3 of 9' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Score 7 of 9' })).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
