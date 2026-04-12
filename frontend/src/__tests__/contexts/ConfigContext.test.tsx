import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider, useConfig, useFeatureFlag, useThresholds } from '../../contexts/ConfigContext'

function ConfigDisplay() {
  const { config, loading } = useConfig()
  const streaks = useFeatureFlag('streaksEnabled')
  const thresholds = useThresholds()
  if (loading) return <div>loading</div>
  return (
    <div>
      <span data-testid="version">{config.latestVersion}</span>
      <span data-testid="streaks">{streaks ? 'on' : 'off'}</span>
      <span data-testid="thresholds">{thresholds ? 'custom' : 'default'}</span>
      <span data-testid="maintenance">{config.maintenanceMode ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('ConfigContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('provides default config on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))

    render(
      <ConfigProvider>
        <ConfigDisplay />
      </ConfigProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByText('loading')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('version').textContent).toBe('1.0.0')
    expect(screen.getByTestId('streaks').textContent).toBe('off')
    expect(screen.getByTestId('thresholds').textContent).toBe('default')
  })

  it('loads config from /api/config', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        minSupportedVersion: '1.0.0',
        latestVersion: '1.2.0',
        features: {
          pushNotificationsEnabled: false,
          appleSignInEnabled: true,
          streaksEnabled: true,
          aiNarrativeEnabled: false,
        },
        thresholds: {
          weightLoss: { watchPctPerWeek: 0.5, concerningPctPerWeek: 1.0, urgentPctPerWeek: 1.5 },
        },
        maintenanceMode: false,
      })),
    )

    render(
      <ConfigProvider>
        <ConfigDisplay />
      </ConfigProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('version').textContent).toBe('1.2.0')
    })
    expect(screen.getByTestId('streaks').textContent).toBe('on')
    expect(screen.getByTestId('thresholds').textContent).toBe('custom')
  })
})
