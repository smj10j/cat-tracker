import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types'

export type AppEnv = {
  Bindings: {
    DB: D1Database
    /** R2 bucket for cat photos; public URL: https://pub-40305f88ebb54339b47a48224f195f92.r2.dev */
    PHOTOS: R2Bucket
    /** KV namespace for app configuration (feature flags, thresholds, maintenance mode) */
    CONFIG_KV: KVNamespace
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    /** Base URL for OAuth redirect, e.g. https://cat-tracker.pages.dev */
    OAUTH_REDIRECT_BASE: string
    /** Resend API key for transactional email (https://resend.com) */
    RESEND_API_KEY: string
    /** Apple Sign In — Service ID registered in Apple Developer portal */
    APPLE_SERVICE_ID: string
    /** Apple Sign In — ES256 private key (PEM format) for generating client secrets */
    APPLE_PRIVATE_KEY: string
    /** Apple Sign In — Team ID from Apple Developer portal */
    APPLE_TEAM_ID: string
    /** Apple Sign In — Key ID for the private key */
    APPLE_KEY_ID: string
  }
  Variables: {
    userId: string
    sessionId: string
    apiVersion: string
  }
}
