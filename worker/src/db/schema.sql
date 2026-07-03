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
  microchip_id TEXT,
  user_id      TEXT REFERENCES users(id),
  household_id TEXT REFERENCES households(id),
  deceased_at  TEXT,
  memorial_note TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partial unique index: enforces uniqueness only for real microchip IDs (not temp placeholders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cats_microchip
  ON cats(microchip_id)
  WHERE microchip_id IS NOT NULL AND microchip_id NOT LIKE 'temp-microchip-id-%';

CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
CREATE INDEX IF NOT EXISTS idx_cats_household ON cats(household_id);

-- Production migration history (already applied; do not re-run):
-- ALTER TABLE cats ADD COLUMN sex TEXT;
-- ALTER TABLE cats ADD COLUMN microchip_id TEXT;
-- ALTER TABLE cats ADD COLUMN is_neutered INTEGER;
-- ALTER TABLE cats ADD COLUMN user_id TEXT REFERENCES users(id);
-- ALTER TABLE cats ADD COLUMN household_id TEXT REFERENCES households(id);
-- ALTER TABLE cats ADD COLUMN deceased_at TEXT;
-- ALTER TABLE cats ADD COLUMN memorial_note TEXT;

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
  timezone        TEXT,              -- IANA timezone, e.g. 'America/New_York'
  email_reminders INTEGER NOT NULL DEFAULT 1,  -- overdue-dose email fallback opt-out
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);
-- Migration 2026-07-02 (medication reminders Phase C):
-- ALTER TABLE users ADD COLUMN email_reminders INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  device_fingerprint TEXT,  -- SEC-10: hash of device model + OS version
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Production migration (already applied; do not re-run):
-- ALTER TABLE sessions ADD COLUMN device_fingerprint TEXT;

-- (user_id and idx_cats_user are now in the CREATE TABLE above)

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL,
  next_url    TEXT,
  provider    TEXT NOT NULL DEFAULT 'google',
  native_redirect_uri TEXT
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
  schedule_mode          TEXT NOT NULL DEFAULT 'fixed',  -- 'fixed' = doses anchored to start_date; 'interval' = re-anchor from last given dose
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Migration 2026-07-02 (care schedule correctness):
-- ALTER TABLE medications ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'fixed';

CREATE INDEX IF NOT EXISTS idx_medications_cat ON medications(cat_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id, is_active);

CREATE TABLE IF NOT EXISTS medication_doses (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  due_at          TEXT NOT NULL,      -- 'YYYY-MM-DD HH:MM:00' (SQLite datetime format)
  administered_at TEXT,
  skipped         INTEGER NOT NULL DEFAULT 0,
  skip_reason     TEXT,
  notes                TEXT,
  notification_sent_at TEXT,           -- set when push notification sent for this dose
  missed               INTEGER NOT NULL DEFAULT 0,  -- cron-expired overdue dose; excluded from inbox, visible in history
  followup_sent_at     TEXT,           -- set when the single 24h overdue follow-up push was sent
  email_sent_at        TEXT,           -- set when the overdue email fallback was sent
  snoozed_until        TEXT,           -- WP4g: dose deferred until this ISO datetime; cron re-pings once it passes
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medication_id, due_at)       -- idempotent cron insertion via INSERT OR IGNORE
);
-- Migration 2026-07-02 (care schedule correctness):
-- ALTER TABLE medication_doses ADD COLUMN missed INTEGER NOT NULL DEFAULT 0;
-- Migration 2026-07-02 (medication reminders Phase C + overdue follow-up):
-- ALTER TABLE medication_doses ADD COLUMN followup_sent_at TEXT;
-- ALTER TABLE medication_doses ADD COLUMN email_sent_at TEXT;
-- Migration 2026-07-02 (WP4g actionable notifications — snooze):
-- ALTER TABLE medication_doses ADD COLUMN snoozed_until TEXT;

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

-- (household_id and idx_cats_household are now in the CREATE TABLE above)

-- Production migration history for oauth_states (already applied):
-- ALTER TABLE oauth_states ADD COLUMN next_url TEXT;
-- ALTER TABLE oauth_states ADD COLUMN provider TEXT NOT NULL DEFAULT 'google';

-- Push notification device tokens (added for iOS App Store)
CREATE TABLE IF NOT EXISTS device_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,  -- 'ios' | 'android' | 'web'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- SEC-13: Apple token replay prevention (added 2026-04-11)
CREATE TABLE IF NOT EXISTS apple_token_cache (
  token_key   TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);

-- SEC-12: Rate limiting (added 2026-04-11)
CREATE TABLE IF NOT EXISTS rate_limits (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,        -- 'data_export' etc.
  window_start TEXT NOT NULL,       -- ISO datetime of window start
  count       INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, action);

-- SEC-15: Audit logging (added 2026-04-11)
-- user_id is not a FK — audit entries must survive user deletion (forensic log)
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT,
  action      TEXT NOT NULL,        -- 'sign_in','sign_out','account_deleted','data_exported','cat_deleted','member_added','member_removed','role_changed'
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    TEXT,                  -- JSON blob for action-specific context
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);

-- Health alert acknowledgments (PRD-alert-acknowledgment, 2026-07-02)
-- Keyed by (cat_id, alert_kind, acknowledged_severity, direction); at most one
-- active row per (cat, kind). Full history retained for the vet export.
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  cat_id                 TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  alert_kind             TEXT NOT NULL DEFAULT 'weight',   -- future: 'behavioral', 'confluence'
  acknowledged_severity  TEXT NOT NULL,                    -- 'watch' | 'concerning' | 'urgent'
  direction              TEXT NOT NULL,                    -- 'loss' | 'gain'
  acknowledged_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  note                   TEXT,                             -- <= 280 chars
  latest_measured_at     TEXT NOT NULL,                    -- newest weight measurement at ack time
  context                TEXT,                             -- JSON snapshot for export/history
  status                 TEXT NOT NULL DEFAULT 'active',   -- 'active'|'superseded'|'resolved'|'expired'|'withdrawn'
  expires_at             TEXT,                             -- created_at + N days; null = no expiry
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at               TEXT                              -- when status left 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ack_active
  ON alert_acknowledgments(cat_id, alert_kind) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ack_cat ON alert_acknowledgments(cat_id, created_at DESC);
