import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BcsPicker from '../../components/BcsPicker'
import { BCS_PRESETS } from '@shared/lib/measurementPresets'

describe('BcsPicker', () => {
  it('renders all nine WSAVA score segments', () => {
    render(<BcsPicker value={null} onChange={vi.fn()} />)
    for (let n = 1; n <= 9; n++) {
      expect(screen.getByRole('button', { name: `Score ${n} of 9` })).toBeInTheDocument()
    }
  })

  it('shows the scale-name caption and no description before a score is picked', () => {
    render(<BcsPicker value={null} onChange={vi.fn()} />)
    expect(screen.getByText('9-point body condition scale')).toBeInTheDocument()
    // No band label rendered until a score is selected
    expect(screen.queryByText('Ideal')).toBeNull()
    expect(screen.queryByText('Over ideal')).toBeNull()
  })

  it('calls onChange with the tapped score', () => {
    const onChange = vi.fn()
    render(<BcsPicker value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Score 5 of 9' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('renders the selected score as N/9 with its transcribed band label + description', () => {
    render(<BcsPicker value={5} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Score 5 of 9' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('5/9')).toBeInTheDocument()
    expect(screen.getByText('Ideal')).toBeInTheDocument()
    const preset = BCS_PRESETS.find((p) => p.value === 5)!
    expect(screen.getByText(preset.description)).toBeInTheDocument()
  })

  it('shows the score-6 footnote note only for score 6', () => {
    const { rerender } = render(<BcsPicker value={6} onChange={vi.fn()} />)
    expect(screen.getByText(/may be acceptable in some cats/i)).toBeInTheDocument()
    rerender(<BcsPicker value={5} onChange={vi.fn()} />)
    expect(screen.queryByText(/may be acceptable in some cats/i)).toBeNull()
  })

  it('introduces no authored evaluative copy — only transcribed WSAVA strings', () => {
    // Render every score; the picker must never surface judgment words the
    // clinical guardrail forbids (only "Under ideal / Ideal / Over ideal" + the
    // verbatim WSAVA description are allowed).
    const forbidden = /\b(overweight|underweight|too heavy|too thin|unhealthy|healthy|obese)\b/i
    for (const preset of BCS_PRESETS) {
      const { container, unmount } = render(<BcsPicker value={preset.value} onChange={vi.fn()} />)
      expect(container.textContent ?? '').not.toMatch(forbidden)
      unmount()
    }
  })
})
