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
