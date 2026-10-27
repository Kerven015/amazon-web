-- Sign-in limit per account from every IP together (server/customer-auth.ts): look up failures by email.
CREATE INDEX login_attempts_email_idx ON login_attempts (email, at);
