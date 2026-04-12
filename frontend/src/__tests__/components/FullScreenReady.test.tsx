import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FullScreenReady from '../../components/FullScreenReady'

describe('FullScreenReady', () => {
  it('renders expand button when hasData is true', () => {
    render(
      <FullScreenReady title="Weight" hasData={true}>
        {() => <div>Chart content</div>}
      </FullScreenReady>
    )
    expect(screen.getByLabelText('Expand chart to full screen')).toBeTruthy()
  })

  it('hides expand button when hasData is false', () => {
    render(
      <FullScreenReady title="Weight" hasData={false}>
        {() => <div>Chart content</div>}
      </FullScreenReady>
    )
    expect(screen.queryByLabelText('Expand chart to full screen')).toBeNull()
  })

  it('renders children with isFullScreen=false by default', () => {
    render(
      <FullScreenReady title="Weight" hasData={true}>
        {(fs) => <div data-testid="chart">{fs ? 'fullscreen' : 'inline'}</div>}
      </FullScreenReady>
    )
    expect(screen.getByTestId('chart').textContent).toBe('inline')
  })

  it('opens overlay on expand button click', () => {
    render(
      <FullScreenReady title="Weight" subtitle="lbs" hasData={true}>
        {(fs) => <div data-testid="chart">{fs ? 'fullscreen' : 'inline'}</div>}
      </FullScreenReady>
    )

    fireEvent.click(screen.getByLabelText('Expand chart to full screen'))

    // Should now have the overlay with close button
    expect(screen.getByLabelText('Close full-screen chart')).toBeTruthy()
    // Overlay renders children with isFullScreen=true
    const charts = screen.getAllByTestId('chart')
    // One inline (false) + one in overlay (true)
    expect(charts).toHaveLength(2)
    expect(charts[1]!.textContent).toBe('fullscreen')
  })

  it('closes overlay on close button click', () => {
    render(
      <FullScreenReady title="Weight" hasData={true}>
        {(fs) => <div data-testid="chart">{fs ? 'fullscreen' : 'inline'}</div>}
      </FullScreenReady>
    )

    fireEvent.click(screen.getByLabelText('Expand chart to full screen'))
    expect(screen.getByLabelText('Close full-screen chart')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Close full-screen chart'))
    expect(screen.queryByLabelText('Close full-screen chart')).toBeNull()
  })
})
