-- Newsletter sign-ups (footer form). Kept after unsubscribing (unsubscribed_at set) so a later
-- export never mails someone who said no; deleting a subscriber removes the row for good.
CREATE TABLE newsletter_subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL,
  locale          text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr', 'tk', 'ru')),
  -- The customer account that signed up, when they were signed in
  user_id         uuid REFERENCES users (id) ON DELETE SET NULL,
  -- When they agreed, from where, and the text they agreed to (proof of consent)
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  consent_text    text NOT NULL,
  ip              text,
  unsubscribed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);
CREATE INDEX newsletter_subscribers_active_idx ON newsletter_subscribers (subscribed_at DESC) WHERE unsubscribed_at IS NULL;
CREATE TRIGGER newsletter_subscribers_updated_at BEFORE UPDATE ON newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
