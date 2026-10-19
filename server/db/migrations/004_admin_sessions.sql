-- Admin sessions kept on the server, so "Log out" and "Log out everywhere" really end them
-- (a stolen admin cookie stops working at once instead of staying valid for 8 hours).
CREATE TABLE admin_sessions (
  -- SHA-256 (hex) of the random session id inside the signed admin cookie
  id           text PRIMARY KEY,
  username     text NOT NULL,
  expires_at   timestamptz NOT NULL,
  ip           text,
  user_agent   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_expires_idx ON admin_sessions (expires_at);
CREATE TRIGGER admin_sessions_updated_at BEFORE UPDATE ON admin_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
