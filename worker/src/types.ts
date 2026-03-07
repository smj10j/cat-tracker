import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

export type AppEnv = {
  Bindings: {
    DB: D1Database
    /** R2 bucket for cat photos; public URL: https://pub-40305f88ebb54339b47a48224f195f92.r2.dev */
    PHOTOS: R2Bucket
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    /** Base URL for OAuth redirect, e.g. https://cat-tracker.pages.dev */
    OAUTH_REDIRECT_BASE: string
    /** Resend API key for transactional email (https://resend.com) */
    RESEND_API_KEY: string
  }
  Variables: {
    userId: string
  }
}
