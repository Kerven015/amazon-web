/**
 * npm run db:migrate
 *
 * Applies server/db/migrations/NNN_name.sql in order, each inside its own
 * transaction, and records it in schema_migrations so it never runs twice.
 * Connects as the schema owner (MIGRATION_DATABASE_URL); falls back to
 * DATABASE_URL for a single-user development database.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { env, loadEnv } from "../server/env";

loadEnv();
const url = env("MIGRATION_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) {
  console.error("✗ Set MIGRATION_DATABASE_URL (the vendora_owner role) in .env.local — see deploy/postgres-setup.md.");
  process.exit(1);
}
if (!env("MIGRATION_DATABASE_URL")) console.warn("! MIGRATION_DATABASE_URL is not set — using DATABASE_URL.");

const dir = path.resolve(import.meta.dirname, "../server/db/migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f))
  .sort();

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
} catch (err) {
  console.error(`✗ Can't connect to PostgreSQL: ${(err as Error).message}`);
  process.exit(1);
}

let applied = 0;
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Only one migrator at a time (two deploys starting together)
  await client.query("SELECT pg_advisory_lock(727001)");
  const done = new Set((await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version));

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (done.has(version)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`→ ${file} … `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      applied++;
      console.log("done");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.log("failed");
      throw err;
    }
  }
  console.log(applied ? `✓ Applied ${applied} migration(s).` : "✓ Database is up to date.");
} catch (err) {
  console.error(`✗ Migration failed (nothing from the failing file was kept): ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
