-- Migration 001: Add user_id to cats (run once after schema.sql)
-- Safe to run: D1 will error if column already exists — that's fine.
ALTER TABLE cats ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
