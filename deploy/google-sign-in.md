# "Continue with Google" and One Tap — setup

The shop's Google sign-in needs one value: a **Google OAuth Client ID**. It's free and
takes about 10 minutes. Until it's set, the Google button and One Tap stay hidden and
everything else works as before.

## 1. Create a Google Cloud project

1. Go to **https://console.cloud.google.com** and sign in with the Google account that should own the shop's settings.
2. At the top, click the project picker → **New project**. Name it e.g. `Vendora` → **Create**, then make sure it's selected.

## 2. Set up the consent screen (what customers see)

1. Menu → **APIs & Services → OAuth consent screen** (it may be called **Google Auth Platform → Branding**).
2. Click **Get started** (or **Configure consent screen**).
3. Fill in:
   - **App name:** your shop's name (e.g. `Vendora`)
   - **User support email:** your email
   - **Audience / User type:** **External**
   - **Contact email:** your email
4. Save. You don't need to add any scopes: email, profile and openid are included automatically.
5. Under **Audience**, click **Publish app** when you go live. While the app is in
   *Testing*, only the Google accounts you add as **Test users** can sign in.

## 3. Create the Client ID

1. **APIs & Services → Credentials** (or **Google Auth Platform → Clients**) → **Create credentials → OAuth client ID**.
2. **Application type:** **Web application**. Name: `Vendora website`.
3. **Authorized JavaScript origins** — add every address the shop runs on:
   - `http://localhost:5173` (development — `npm run dev`)
   - `http://localhost` (Google needs this one too for local testing)
   - `https://your-domain.com` (your real site, when you have it)
4. **Authorized redirect URIs:** leave empty — this sign-in method doesn't use redirects.
5. **Create**. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
   You don't need the client secret.

## 4. Put it in the shop

In `.env.local` (next to `DATABASE_URL`):

```bash
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
```

Restart the site (`Ctrl + C`, then `npm run dev` — or restart the service in production).
Run `npm run db:migrate` once if you haven't since updating.

## 5. Try it

1. Open `http://localhost:5173/en/login` — under the form you'll see **Continue with Google**.
2. Click it, pick your Google account → you're signed in (a new account is created the first time).
3. Sign out, then open the home page: Google's **One Tap** box ("Continue as …") appears in the corner.
   Once you've used it, it can sign you in by itself next time.
4. In **Admin → Customers** your account shows a **Google** tag.

## How it behaves

- **New email** → a new account, email already verified, no password. The customer can add one under
  *Your account → Profile → Set a password* to also sign in with email + password.
- **Email that already has an account** (registered with a password) → Google proves they own the inbox,
  so it opens that same account (orders, bag, addresses). Their password keeps working too.
- **Changed Gmail address** → still the same account (Google's permanent id is stored, not just the email).
- **Blocked accounts** can't sign in with Google either.
- **Signing out** turns off One Tap's automatic sign-in for that browser, so it doesn't sign them straight back in.
- The server checks every Google token itself (signature, expiry, that it's for *your* Client ID,
  that Google verified the email) — a browser can't pretend to be someone else.

## If something's off

| What you see | Fix |
| --- | --- |
| No Google button at all | `GOOGLE_CLIENT_ID` missing in `.env.local`, or the site wasn't restarted |
| "The given origin is not allowed for the given client ID" (browser console) | Add the exact address (with `http`/`https` and port) to **Authorized JavaScript origins**, then wait a few minutes |
| "Access blocked: app has not completed verification" / only some people can sign in | The app is still in *Testing* — add test users, or **Publish app** |
| One Tap never appears | Normal if you're not signed into Google in that browser, recently closed it, or blocked third-party sign-in prompts in the browser |
