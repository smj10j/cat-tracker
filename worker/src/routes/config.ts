import { Hono } from 'hono'
import type { AppEnv } from '../types'

const config = new Hono<AppEnv>()

// Default config — returned if KV is empty or malformed
const DEFAULT_CONFIG = {
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
  maintenanceMessage: null,
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
    return c.json(raw, 200, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    })
  } catch (e) {
    console.error('Failed to read config from KV:', e)
    return c.json(DEFAULT_CONFIG, 200, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    })
  }
})

export default config
