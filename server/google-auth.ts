/**
 * "Continue with Google" and One Tap.
 *
 * The browser gets an ID token (a JWT signed by Google) from Google Identity Services
 * and posts it to POST /api/auth/google. Here we check it with Google's official
 * library: signature (Google's public keys), issuer, audience (our client id) and
 * expiry. Only then do we trust the email in it — and only when Google says it's verified.
 *
 * Linking (option A): a Google account whose verified email matches an existing account
 * opens that account (its orders, bag, addresses). A new email creates a new account
 * without a password; the customer can add one later in their profile.
 */
import { OAuth2Client } from "google-auth-library";
import { query, withTransaction } from "./db/pool";
import { env } from "./env";

export const googleClientId = () => env("GOOGLE_CLIENT_ID")?.trim() || null;

export type GoogleProfile = { sub: string; email: string; name: string };

let client: OAuth2Client | null = null;

export class GoogleTokenError extends Error {}

/** Checks the ID token; throws GoogleTokenError when it isn't a valid, verified Google sign-in for this site. */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  const clientId = googleClientId();
  if (!clientId) throw new GoogleTokenError("Google sign-in isn't configured");
  client ??= new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleTokenError("Invalid Google credential");
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new GoogleTokenError("Google didn't confirm this email");
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: (payload.name || payload.given_name || payload.email.split("@")[0]).trim().slice(0, 80),
  };
}

export type GoogleSignIn = { userId: string; name: string; email: string; locale: string; blocked: boolean; created: boolean };

/**
 * Finds the account for a verified Google profile, linking or creating it:
 *   1. already linked to this Google account → that account
 *   2. an account with the same email → link it (option A) and use it
 *   3. otherwise → a new account (no password), email marked verified
 */
export async function signInWithGoogle(profile: GoogleProfile, locale: string): Promise<GoogleSignIn> {
  return withTransaction(async (db) => {
    type U = { id: string; name: string; email: string; locale: string; blocked_at: Date | null };
    const result = (u: U, created: boolean): GoogleSignIn => ({ userId: u.id, name: u.name, email: u.email, locale: u.locale, blocked: !!u.blocked_at, created });

    // 1. Linked before
    const linked = await db.query<U>(
      `SELECT u.id, u.name, u.email, u.locale, u.blocked_at
         FROM user_identities i JOIN users u ON u.id = i.user_id
        WHERE i.provider = 'google' AND i.subject = $1`,
      [profile.sub],
    );
    if (linked.rows[0]) {
      await db.query("UPDATE user_identities SET last_used_at = now(), email = $2 WHERE provider = 'google' AND subject = $1", [profile.sub, profile.email]);
      await db.query("UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1 AND email = $2", [linked.rows[0].id, profile.email]);
      return result(linked.rows[0], false);
    }

    // 2. Same email, registered with a password → link (Google has proven they own the inbox)
    const existing = await db.query<U & { email_verified_at: Date | null }>(
      "SELECT id, name, email, locale, blocked_at, email_verified_at FROM users WHERE email = $1 FOR UPDATE",
      [profile.email],
    );
    let user: U = existing.rows[0];
    let created = false;
    if (user) {
      if (!existing.rows[0].email_verified_at) {
        // Nobody had proven they own this inbox, so the account may have been registered by
        // someone else ahead of time ("pre-account takeover"). Drop that password and every
        // session, so only the inbox owner — signing in with Google now — gets in.
        // The customer can set a new password from their profile.
        await db.query("UPDATE users SET password_hash = NULL WHERE id = $1", [user.id]);
        await db.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
      }
      await db.query("UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1", [user.id]);
    } else {
      // 3. New customer
      const inserted = await db.query<U>(
        `INSERT INTO users (email, name, locale, password_hash, email_verified_at)
         VALUES ($1, $2, $3, NULL, now())
         RETURNING id, name, email, locale, blocked_at`,
        [profile.email, profile.name, locale],
      );
      user = inserted.rows[0];
      created = true;
    }
    await db.query(
      `INSERT INTO user_identities (provider, subject, user_id, email) VALUES ('google', $1, $2, $3)
       ON CONFLICT (provider, subject) DO UPDATE SET user_id = EXCLUDED.user_id, email = EXCLUDED.email, last_used_at = now()`,
      [profile.sub, user.id, profile.email],
    );
    return result(user, created);
  });
}

/** How a customer can sign in: ["password"], ["google"] or both. */
export async function signInMethods(userId: string) {
  const { rows } = await query<{ has_password: boolean; google: boolean }>(
    `SELECT u.password_hash IS NOT NULL AS has_password,
            EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = u.id AND i.provider = 'google') AS google
       FROM users u WHERE u.id = $1`,
    [userId],
  );
  return { hasPassword: !!rows[0]?.has_password, google: !!rows[0]?.google };
}
