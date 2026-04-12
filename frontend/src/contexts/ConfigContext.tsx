import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThresholdOverrides } from '@shared/lib/healthMetrics'

export interface AppConfig {
  minSupportedVersion: string
  latestVersion: string
  updateMessage?: string | null
  features: {
    pushNotificationsEnabled: boolean
    appleSignInEnabled: boolean
    streaksEnabled: boolean
    aiNarrativeEnabled: boolean
    [key: string]: boolean
  }
  thresholds: ThresholdOverrides | null
  maintenanceMode: boolean
  maintenanceMessage?: string | null
  deprecations?: Record<string, string> | null
}

const DEFAULT_CONFIG: AppConfig = {
  minSupportedVersion: '1.0.0',
  latestVersion: '1.0.0',
  features: {
    pushNotificationsEnabled: false,
    appleSignInEnabled: true,
    streaksEnabled: false,
    aiNarrativeEnabled: false,
  },
  thresholds: null,
  maintenanceMode: false,
}

interface ConfigContextValue {
  config: AppConfig
  loading: boolean
}

const ConfigContext = createContext<ConfigContextValue>({
  config: DEFAULT_CONFIG,
  loading: true,
})

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/config')
      .then((res) => res.json() as Promise<AppConfig>)
      .then((data) => {
        if (!cancelled) {
          setConfig(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <ConfigContext.Provider value={{ config, loading }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext)
}

export function useFeatureFlag(flag: string): boolean {
  const { config } = useConfig()
  return config.features[flag] ?? false
}

export function useThresholds(): ThresholdOverrides | undefined {
  const { config } = useConfig()
  return config.thresholds ?? undefined
}
