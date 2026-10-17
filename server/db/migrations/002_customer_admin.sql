-- Admin → Customers: block an account (it can't sign in, and its sessions end).
ALTER TABLE users ADD COLUMN blocked_at timestamptz;

-- "Signed in now" lists look up live sessions by user
CREATE INDEX IF NOT EXISTS sessions_user_live_idx ON sessions (user_id, expires_at);
