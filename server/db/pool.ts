/**
 * The one PostgreSQL connection pool (node-postgres), built from DATABASE_URL.
 *
 * Every query in the app goes through `query()` or a `withTransaction()` client,
 * always with $1, $2… parameters — SQL is never built by joining strings.
 */
import pg from "pg";
import { env } from "../env";

// numeric(10,2) → number (prices stay well inside double precision) and bigint counts → number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

let pool: pg.Pool | null = null;

export class DatabaseConfigError extends Error {}

export function databaseUrl(name = "DATABASE_URL") {
  const url = env(name);
  if (!url) throw new DatabaseConfigError(`${name} is not set. Add it to .env.local — see .env.example and deploy/postgres-setup.md.`);
  return url;
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl(),
      max: Number(env("DATABASE_POOL_SIZE") ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // An idle client losing its connection must not crash the server
    pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  }
  return pool;
}

/** Anything that can run a query: the pool helper below, or a transaction client. */
export type Db = { query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) => Promise<pg.QueryResult<R>> };

export function query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<R>(text, values);
}

/** Runs `fn` inside BEGIN … COMMIT; any error rolls back and is re-thrown. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Called once at start-up. Without a working database the shop would only half
 * work, so the server prints why and exits instead.
 */
export async function assertDatabaseReady(): Promise<void> {
  try {
    await query("SELECT 1 FROM products LIMIT 1");
  } catch (err) {
    const e = err as Error & { code?: string };
    let why = e.message;
    if (err instanceof DatabaseConfigError) why = e.message;
    else if (e.code === "42P01") why = "The tables don't exist yet. Run `npm run db:migrate` (and `npm run db:seed` for the catalogue).";
    else if (e.code === "ECONNREFUSED") why = `Nothing is listening at the address in DATABASE_URL (${e.message}). Is PostgreSQL running?`;
    else if (e.code === "28P01") why = "PostgreSQL rejected the user name or password in DATABASE_URL.";
    else if (e.code === "3D000") why = "The database named in DATABASE_URL doesn't exist (see deploy/postgres-setup.md).";
    console.error(`\n✗ Can't start Vendora: the database isn't ready.\n  ${why}\n`);
    await pool?.end().catch(() => {});
    process.exit(1);
  }
}

export async function closePool() {
  await pool?.end();
  pool = null;
}
