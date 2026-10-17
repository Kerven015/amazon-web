-- "Continue with Google" / One Tap.
-- An account can be linked to a Google account; Google-only accounts have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE user_identities (
  provider     text NOT NULL CHECK (provider IN ('google')),
  -- Google's permanent id for the person ("sub"); stays the same if they change their Gmail address
  subject      text NOT NULL,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email        citext NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);
CREATE TRIGGER user_identities_updated_at BEFORE UPDATE ON user_identities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
