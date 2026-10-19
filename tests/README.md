# Security tests

`npm test` starts the real API (the same code as `npm start`, in production mode) against a
**separate test database** and checks:

| File | What it proves |
| --- | --- |
| `access-control.test.ts` | Every admin route needs an admin session, every account route a customer session; forged or edited cookies fail; customers can't see or change each other's orders, addresses, wishlist |
| `input-validation.test.ts` | Prices and totals come from the database (tampered prices ignored); no mass assignment; bad or oversized input → 4xx, never 500; uploads must be real images and can't escape their folder |
| `auth-sessions.test.ts` | Argon2id password hashes; no hash in any response; sign-in rate limits; cookie flags; logout, password change, blocking and "log out everywhere" really end sessions; forged Google tokens fail |
| `csrf-headers.test.ts` | Requests from other sites are refused; no CORS for other origins; CSP, HSTS, X-Frame-Options, nosniff |
| `injection.test.ts` | SQL-looking input is plain data (login, search, URLs); script in reviews and names stays text; no `javascript:` / `data:` image URLs |
| `abuse-limits.test.ts` | Order, review and address limits, including simultaneous requests |
| `unit.test.ts` | Redirects after sign-in stay on the site; visitor IP behind a proxy; admin password rules; totals |

## One-time setup

Create a test database next to your real one, with the same two roles
(as in `deploy/postgres-setup.md`, step 3 — just a different name):

```sql
CREATE DATABASE vendora_test OWNER vendora_owner;
\c vendora_test
REVOKE ALL ON DATABASE vendora_test FROM PUBLIC;
GRANT CONNECT ON DATABASE vendora_test TO vendora_owner, vendora_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO vendora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE vendora_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vendora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE vendora_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vendora_app;
```

Then in `.env.local`:

```bash
TEST_DATABASE_URL=postgres://vendora_app:APP_PASSWORD@127.0.0.1:5432/vendora_test
TEST_MIGRATION_DATABASE_URL=postgres://vendora_owner:OWNER_PASSWORD@127.0.0.1:5432/vendora_test
```

The tests **refuse to run** unless the database name contains `test`: each file empties the
customer, order and session tables and re-seeds the products. Uploads go to a temporary folder.

## Run

```bash
npm test
```

About 15 seconds. Each file runs on its own, one after another. A failing test names the
protection that broke.
