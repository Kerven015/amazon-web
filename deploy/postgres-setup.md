# PostgreSQL for Vendora — on your own server

Vendora keeps everything (products, customers, sessions, bags, orders, reviews) in
PostgreSQL running **on the same machine as the Node app**. Nothing is hosted
elsewhere, and the database is never reachable from the internet: only the app,
on `127.0.0.1`, can connect.

These steps are for **Ubuntu 22.04/24.04 or Debian 12/13**. Commands starting with
`sudo` run as your normal admin user; `sudo -u postgres …` runs as the database
superuser. Any PostgreSQL from 13 up works. The steps below install 17; if you
pick another version, change `17` in the paths.

---

## 1. Install PostgreSQL from the official apt repository

The PostgreSQL project's own repository (apt.postgresql.org) has current releases
and security updates sooner than the distribution's packages.

```bash
sudo apt update
sudo apt install -y curl ca-certificates postgresql-common
# Adds apt.postgresql.org with its signing key (script shipped by postgresql-common)
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh   # press Enter when it asks
sudo apt install -y postgresql-17

# Running?
sudo systemctl status postgresql --no-pager
sudo -u postgres psql -c "select version();"
```

## 2. Keep it private

**a. Listen on localhost only.** In `/etc/postgresql/17/main/postgresql.conf`:

```conf
listen_addresses = 'localhost'      # never '*'
password_encryption = scram-sha-256
```

**b. Only local connections, with passwords.** Replace the rules in
`/etc/postgresql/17/main/pg_hba.conf` with exactly these:

```conf
# TYPE  DATABASE  USER                        ADDRESS        METHOD
local   all       postgres                                   peer
local   vendora   vendora_owner,vendora_app                  scram-sha-256
host    vendora   vendora_owner,vendora_app   127.0.0.1/32   scram-sha-256
host    vendora   vendora_owner,vendora_app   ::1/128        scram-sha-256
```

There are no other `host` lines, so even a mistake in `listen_addresses` wouldn't
let anyone in from outside.

```bash
sudo systemctl restart postgresql
sudo ss -tlnp | grep 5432      # should show only 127.0.0.1:5432 (and [::1]:5432)
```

**c. Close port 5432 in the firewall** (and allow only what the site needs):

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp
sudo ufw enable
sudo ufw status verbose
```

If your hosting provider has its own firewall (security groups, cloud firewall),
don't open 5432 there either.

## 3. Create the database and the two roles

| Role | Used by | Can do |
| --- | --- | --- |
| `vendora_owner` | `npm run db:migrate` (and `db:seed`) | owns the tables: CREATE, ALTER, DROP |
| `vendora_app` | the running site | SELECT / INSERT / UPDATE / DELETE rows only (no DROP, no ALTER) |

Even if the site were tricked into running SQL, the app role couldn't drop or
change a table.

Make two strong passwords (letters and digits only, so they don't need escaping in a URL):

```bash
openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 32; echo   # run twice
```

Then, as the superuser:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE vendora_owner LOGIN;
CREATE ROLE vendora_app LOGIN;
\password vendora_owner
\password vendora_app

CREATE DATABASE vendora OWNER vendora_owner ENCODING 'UTF8' TEMPLATE template0;
\c vendora

-- Nobody but these two roles may connect
REVOKE ALL ON DATABASE vendora FROM PUBLIC;
GRANT CONNECT ON DATABASE vendora TO vendora_owner, vendora_app;

-- Only the owner creates things in the schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO vendora_app;

-- Every table / sequence vendora_owner creates (now and in later migrations)
-- is readable and writable by vendora_app — but nothing more
ALTER DEFAULT PRIVILEGES FOR ROLE vendora_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vendora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE vendora_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vendora_app;
\q
```

(`citext` and `gen_random_uuid()` are part of PostgreSQL; the first migration enables
`citext` itself, which the database owner is allowed to do.)

## 4. Point the app at it

In the app folder, add to `.env.local` (read only by the server, never sent to the browser):

```bash
DATABASE_URL=postgres://vendora_app:APP_PASSWORD@127.0.0.1:5432/vendora
MIGRATION_DATABASE_URL=postgres://vendora_owner:OWNER_PASSWORD@127.0.0.1:5432/vendora
```

```bash
chmod 600 .env.local
npm ci
npm run db:migrate     # creates the tables (runs each migration once)
npm run db:seed        # imports data/products.json — safe to run twice
npm run build
npm start              # the server checks the database first and exits if it can't reach it
```

Check that the app role really is limited:

```bash
psql "postgres://vendora_app:APP_PASSWORD@127.0.0.1:5432/vendora" -c "DROP TABLE reviews;"
# → ERROR:  must be owner of table reviews
```

For later releases: `git pull && npm ci && npm run db:migrate && npm run build`, then
restart the app. Migrations that already ran are skipped.

**Keeping the app running (optional).** `/etc/systemd/system/vendora.service`:

```ini
[Unit]
Description=Vendora shop
After=network.target postgresql.service
Requires=postgresql.service

[Service]
WorkingDirectory=/srv/vendora
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production PORT=3000
User=vendora
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now vendora
```

Put a reverse proxy with HTTPS (Caddy or nginx) in front of port 3000, and set
`TRUST_PROXY=1` in `.env.local` so the sign-in rate limit sees real visitor IPs.

## 5. Daily backups (kept 14 days)

`/usr/local/bin/vendora-backup.sh`:

```sh
#!/bin/sh
# Daily dump of the Vendora database; keeps the last 14 days.
set -eu
DIR=/var/backups/vendora
mkdir -p "$DIR"
pg_dump -Fc -d vendora -f "$DIR/vendora-$(date +%F-%H%M).dump"
find "$DIR" -name 'vendora-*.dump' -mtime +13 -delete
```

```bash
sudo chmod 755 /usr/local/bin/vendora-backup.sh
sudo install -d -o postgres -g postgres -m 700 /var/backups/vendora
# Every night at 03:15, as the postgres user (no password needed: local peer login)
echo '15 3 * * * postgres /usr/local/bin/vendora-backup.sh' | sudo tee /etc/cron.d/vendora-backup
sudo -u postgres /usr/local/bin/vendora-backup.sh && ls -lh /var/backups/vendora   # test it once
```

A backup on the same disk doesn't help if the server is lost: copy
`/var/backups/vendora` somewhere else regularly too (e.g. `rsync` to another machine).

**Restore.** First try it on a copy, which is safe at any time:

```bash
sudo -u postgres createdb -O vendora_owner vendora_restore_test
sudo -u postgres pg_restore -d vendora_restore_test /var/backups/vendora/vendora-2026-10-17-0315.dump
sudo -u postgres psql vendora_restore_test -c "select count(*) from orders;"
sudo -u postgres dropdb vendora_restore_test
```

To put a backup back into the live database (everything since that backup is lost):

```bash
sudo systemctl stop vendora
sudo -u postgres pg_restore --clean --if-exists --single-transaction -d vendora /var/backups/vendora/vendora-2026-10-17-0315.dump
sudo systemctl start vendora
```

`--single-transaction` means a restore that fails half-way changes nothing.
Ownership and the app role's rights are part of the dump, so nothing needs re-granting.

## 6. The same setup on your own computer (development)

Use the same two roles and the same SQL as step 3, so development behaves like the server.

- **Ubuntu/Debian:** steps 1–3 above (the firewall step is optional on a laptop).
- **macOS (Homebrew):** `brew install postgresql@17 && brew services start postgresql@17`,
  then `psql postgres` and run the SQL from step 3 (`sudo -u postgres` isn't needed).
- **Windows:** install PostgreSQL 17 with the EDB installer from postgresql.org
  (leave it on port 5432, local only), open *SQL Shell (psql)* and run the SQL from step 3.
  Or use WSL with the Ubuntu steps.
- **Docker (any OS):** a throw-away database that listens only on your machine:

  ```bash
  docker run -d --name vendora-db -e POSTGRES_PASSWORD=dev -p 127.0.0.1:5432:5432 postgres:17
  docker exec -it vendora-db psql -U postgres     # then the SQL from step 3
  ```

Then in `.env.local`:

```bash
DATABASE_URL=postgres://vendora_app:APP_PASSWORD@127.0.0.1:5432/vendora
MIGRATION_DATABASE_URL=postgres://vendora_owner:OWNER_PASSWORD@127.0.0.1:5432/vendora
```

```bash
npm run db:migrate && npm run db:seed && npm run dev   # http://localhost:5173
```

To start over: `sudo -u postgres dropdb vendora`, create it again (step 3), then migrate and seed.

---

**If the site won't start**, it says why: `DATABASE_URL is not set`, `Nothing is listening`
(PostgreSQL isn't running), `rejected the user name or password`, or `The tables don't
exist yet` (run `npm run db:migrate`).
