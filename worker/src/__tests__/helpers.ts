import { env } from 'cloudflare:test'

// Full schema DDL for the test database — includes all columns (incl. those added via ALTER TABLE
// in production). This schema is intentionally self-contained for test isolation.
export const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,
  oauth_id        TEXT NOT NULL,
  timezone        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  device_fingerprint TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  next_url    TEXT,
  expires_at  TEXT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'google',
  native_redirect_uri TEXT
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, token)
);

CREATE TABLE IF NOT EXISTS households (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  invited_by        TEXT REFERENCES users(id),
  invite_email      TEXT,
  invite_token_hash TEXT UNIQUE,
  invite_expires_at TEXT,
  invited_at        TEXT NOT NULL DEFAULT (datetime('now')),
  joined_at         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hm_active_user
  ON household_members(household_id, user_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS cats (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name         TEXT NOT NULL,
  birthdate    TEXT NOT NULL,
  breed        TEXT,
  coloring     TEXT,
  notes        TEXT,
  photo_url    TEXT,
  sex          TEXT,
  is_neutered  INTEGER,
  microchip_id  TEXT,
  user_id       TEXT REFERENCES users(id),
  household_id  TEXT REFERENCES households(id),
  deceased_at   TEXT,
  memorial_note TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cats_microchip
  ON cats(microchip_id)
  WHERE microchip_id IS NOT NULL AND microchip_id NOT LIKE 'temp-microchip-id-%';

CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id      TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medications (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id                 TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL DEFAULT 'other',
  dose                   TEXT,
  frequency              TEXT NOT NULL,
  frequency_days         INTEGER,
  reminder_time          TEXT NOT NULL DEFAULT '09:00',
  start_date             TEXT NOT NULL,
  end_date               TEXT,
  doses_total            INTEGER,
  notes                  TEXT,
  is_active              INTEGER NOT NULL DEFAULT 1,
  doses_remaining        INTEGER,
  refill_alert_threshold INTEGER,
  schedule_mode          TEXT NOT NULL DEFAULT 'fixed',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medication_doses (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  due_at          TEXT NOT NULL,
  administered_at TEXT,
  skipped         INTEGER NOT NULL DEFAULT 0,
  skip_reason     TEXT,
  notes                TEXT,
  notification_sent_at TEXT,
  missed               INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medication_id, due_at)
);

CREATE TABLE IF NOT EXISTS apple_token_cache (
  token_key   TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, action, window_start)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT,
  action      TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`

/** Apply the full schema DDL to the test database (idempotent). */
export async function applySchema(): Promise<void> {
  const statements = TEST_SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  for (const sql of statements) {
    await env.DB.prepare(sql).run()
  }
}

export async function clearDb(): Promise<void> {
  await env.DB.exec(`
    DELETE FROM audit_log;
    DELETE FROM rate_limits;
    DELETE FROM apple_token_cache;
    DELETE FROM device_tokens;
    DELETE FROM medication_doses;
    DELETE FROM medications;
    DELETE FROM measurements;
    DELETE FROM household_members;
    DELETE FROM cats;
    DELETE FROM households;
    DELETE FROM sessions;
    DELETE FROM oauth_states;
    DELETE FROM users;
  `)
}

interface UserSeed {
  id?: string
  email?: string
  display_name?: string
  oauth_provider?: string
  oauth_id?: string
}

export async function seedUser(overrides: UserSeed = {}): Promise<Required<UserSeed>> {
  const u = {
    id: 'user-1',
    email: 'test@example.com',
    display_name: 'Test User',
    oauth_provider: 'google',
    oauth_id: 'google-123',
    ...overrides,
  }
  await env.DB.prepare(
    'INSERT INTO users (id, email, display_name, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)',
  ).bind(u.id, u.email, u.display_name, u.oauth_provider, u.oauth_id).run()
  return u
}

export async function seedSession(userId: string, sessionId = 'session-1'): Promise<string> {
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, '2099-01-01 00:00:00')",
  ).bind(sessionId, userId).run()
  return sessionId
}

export function authedHeaders(sessionId: string): Record<string, string> {
  return { Cookie: `session=${sessionId}` }
}

export function bearerHeaders(sessionId: string): Record<string, string> {
  return { Authorization: `Bearer ${sessionId}` }
}
