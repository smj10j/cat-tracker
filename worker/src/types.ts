import type { D1Database } from '@cloudflare/workers-types'

export type AppEnv = {
  Bindings: {
    DB: D1Database
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    /** Base URL for OAuth redirect, e.g. https://cat-tracker.pages.dev */
    OAUTH_REDIRECT_BASE: string
  }
  Variables: {
    userId: string
  }
}
