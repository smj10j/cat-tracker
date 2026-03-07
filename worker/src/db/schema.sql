CREATE TABLE IF NOT EXISTS cats (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name         TEXT NOT NULL,
  birthdate    TEXT NOT NULL,
  breed        TEXT,
  coloring     TEXT,
  notes        TEXT,
  photo_url    TEXT,
  sex          TEXT,
  microchip_id TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partial unique index: enforces uniqueness only for real microchip IDs (not temp placeholders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cats_microchip
  ON cats(microchip_id)
  WHERE microchip_id IS NOT NULL AND microchip_id NOT LIKE 'temp-microchip-id-%';

-- Run once: ALTER TABLE cats ADD COLUMN sex TEXT;
-- Run once: ALTER TABLE cats ADD COLUMN microchip_id TEXT;
-- Run once: ALTER TABLE cats ADD COLUMN is_neutered INTEGER;

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

CREATE INDEX IF NOT EXISTS idx_measurements_cat_type
  ON measurements(cat_id, type, measured_at);

-- Auth tables (added in auth sprint)
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,
  oauth_id        TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Run once: ALTER TABLE cats ADD COLUMN user_id TEXT REFERENCES users(id);
-- Run once: CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);

-- Medication reminders (added 2026-03-07)
CREATE TABLE IF NOT EXISTS medications (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id                 TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL DEFAULT 'other',
  dose                   TEXT,
  frequency              TEXT NOT NULL,     -- 'daily'|'twice_daily'|'weekly'|'monthly'|'custom'
  frequency_days         INTEGER,           -- for 'custom' frequency
  reminder_time          TEXT NOT NULL DEFAULT '09:00',  -- HH:MM local time
  start_date             TEXT NOT NULL,     -- YYYY-MM-DD
  end_date               TEXT,              -- YYYY-MM-DD, null = ongoing
  doses_total            INTEGER,           -- null = ongoing course
  notes                  TEXT,
  is_active              INTEGER NOT NULL DEFAULT 1,
  doses_remaining        INTEGER,           -- null = not tracking stock
  refill_alert_threshold INTEGER,           -- alert when doses_remaining <= this
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medications_cat ON medications(cat_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id, is_active);

CREATE TABLE IF NOT EXISTS medication_doses (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  due_at          TEXT NOT NULL,      -- 'YYYY-MM-DD HH:MM:00' (SQLite datetime format)
  administered_at TEXT,
  skipped         INTEGER NOT NULL DEFAULT 0,
  skip_reason     TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medication_id, due_at)       -- idempotent cron insertion via INSERT OR IGNORE
);

CREATE INDEX IF NOT EXISTS idx_doses_medication ON medication_doses(medication_id, due_at);
CREATE INDEX IF NOT EXISTS idx_doses_due ON medication_doses(due_at, administered_at);

-- Household sharing (added 2026-03-07)
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

CREATE INDEX IF NOT EXISTS idx_hm_household ON household_members(household_id, status);
CREATE INDEX IF NOT EXISTS idx_hm_user ON household_members(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hm_active_user
  ON household_members(household_id, user_id)
  WHERE status = 'active';

-- Run once: ALTER TABLE cats ADD COLUMN household_id TEXT REFERENCES households(id);
-- Run once: CREATE INDEX IF NOT EXISTS idx_cats_household ON cats(household_id);
-- Run once: ALTER TABLE oauth_states ADD COLUMN next_url TEXT;
