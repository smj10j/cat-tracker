import { Hono } from 'hono'
import type { AppEnv } from '../types'

const config = new Hono<AppEnv>()

// Default config — returned if KV is empty or malformed
const DEFAULT_CONFIG = {
  minSupportedVersion: '1.0.0',
  latestVersion: '1.0.0',
  updateMessage: null as string | null,
  features: {
    pushNotificationsEnabled: false,
    appleSignInEnabled: true,
    streaksEnabled: false,
    aiNarrativeEnabled: false,
  },
  thresholds: null as {
    weightLoss?: {
      watchPctPerWeek: number
      concerningPctPerWeek: number
      urgentPctPerWeek: number
    }
    weightGain?: {
      watchPctPerWeek: number
      concerningPctPerWeek: number
    }
    noiseFloorPct?: number
    minIntervalDays?: number
    referencePeakWindowDays?: number
    referencePeakMinMeasurements?: number
    totalLoss?: {
      watchPct: number
      concerningPct: number
      urgentPct: number
    }
  } | null,
  maintenanceMode: false,
  maintenanceMessage: null as string | null,
  deprecations: null as Record<string, string> | null,  // field -> sunset date ISO string
}

config.get('/config', async (c) => {
  try {
    const raw = await c.env.CONFIG_KV.get('app_config', 'json')
    if (!raw || typeof raw !== 'object') {
      return c.json(DEFAULT_CONFIG, 200, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      })
    }
    // Validate: must have minSupportedVersion and features
    const cfg = raw as Record<string, unknown>
    if (!cfg.minSupportedVersion || !cfg.features) {
      console.warn('Invalid config blob in KV, returning defaults')
      return c.json(DEFAULT_CONFIG, 200, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      })
    }
    // Validate threshold sanity if present
    if (cfg.thresholds && typeof cfg.thresholds === 'object') {
      const t = cfg.thresholds as Record<string, unknown>
      if (t.weightLoss && typeof t.weightLoss === 'object') {
        const wl = t.weightLoss as Record<string, number>
        if (wl.urgentPctPerWeek !== undefined && wl.concerningPctPerWeek !== undefined &&
            wl.watchPctPerWeek !== undefined) {
          if (!(wl.urgentPctPerWeek > wl.concerningPctPerWeek &&
                wl.concerningPctPerWeek > wl.watchPctPerWeek &&
                wl.watchPctPerWeek > 0)) {
            console.warn('Invalid threshold values in KV config, returning defaults')
            return c.json(DEFAULT_CONFIG, 200, {
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            })
          }
        }
      }
    }
    // Add Deprecation/Sunset headers if any deprecations are configured
    const headers: Record<string, string> = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    }
    const cfgTyped = cfg as Record<string, unknown>
    if (cfgTyped.deprecations && typeof cfgTyped.deprecations === 'object') {
      const deps = cfgTyped.deprecations as Record<string, string>
      const dates = Object.values(deps).filter(Boolean)
      if (dates.length > 0) {
        headers['Deprecation'] = 'true'
        // Sunset = earliest deprecation date
        const earliest = dates.sort()[0]
        if (earliest) headers['Sunset'] = new Date(earliest).toUTCString()
      }
    }

    return c.json(raw, 200, headers)
  } catch (e) {
    console.error('Failed to read config from KV:', e)
    return c.json(DEFAULT_CONFIG, 200, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    })
  }
})

export default config
