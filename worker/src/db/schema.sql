CREATE TABLE IF NOT EXISTS cats (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,
  birthdate   TEXT NOT NULL,
  breed       TEXT,
  coloring    TEXT,
  notes       TEXT,
  photo_url   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

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
