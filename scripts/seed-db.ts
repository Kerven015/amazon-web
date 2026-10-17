/**
 * npm run db:seed
 *
 * Imports data/products.json (the catalogue the shop shipped with) into PostgreSQL:
 * products, their stock per size × colour and their reviews.
 * Safe to run twice: everything is upserted by id, so a second run changes nothing.
 * Note: a product that exists in both is overwritten with the file's version —
 * run it on a fresh database, or after you've exported admin edits back to the file.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { env, loadEnv } from "../server/env";
import type { ProductRecord } from "../src/types";

loadEnv();
const url = env("MIGRATION_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) {
  console.error("✗ Set DATABASE_URL in .env.local — see deploy/postgres-setup.md.");
  process.exit(1);
}

const file = path.resolve(process.cwd(), env("DATA_DIR") ?? "data", "products.json");
const products = JSON.parse(readFileSync(file, "utf8")) as ProductRecord[];

const client = new pg.Client({ connectionString: url });
await client.connect();

let reviewCount = 0;
try {
  await client.query("BEGIN");
  for (const p of products) {
    const { reviews, rating: _r, reviewCount: _c, ...data } = p;
    await client.query(
      `INSERT INTO products (id, slug, sku, hidden, product_type, price, stock, data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE
         SET slug = EXCLUDED.slug, sku = EXCLUDED.sku, hidden = EXCLUDED.hidden, product_type = EXCLUDED.product_type,
             price = EXCLUDED.price, stock = EXCLUDED.stock, data = EXCLUDED.data, created_at = EXCLUDED.created_at,
             deleted_at = NULL`,
      [p.id, p.slug, p.sku || null, !!p.hidden, p.productType, p.price, p.stock ?? 0, JSON.stringify(data), p.createdAt || new Date().toISOString()],
    );

    const cells = p.sizes.flatMap((s) => Object.entries(s.stock).map(([colour, quantity]) => ({ size: s.name, colour, quantity: Math.max(0, Math.floor(quantity)) })));
    await client.query("DELETE FROM product_stock WHERE product_id = $1", [p.id]);
    await client.query(
      `INSERT INTO product_stock (product_id, size, colour, quantity)
       SELECT $1, size, colour, quantity FROM unnest($2::text[], $3::text[], $4::int[]) AS t(size, colour, quantity)`,
      [p.id, cells.map((c) => c.size), cells.map((c) => c.colour), cells.map((c) => c.quantity)],
    );
    await client.query("UPDATE products SET stock = (SELECT coalesce(sum(quantity), 0) FROM product_stock WHERE product_id = $1) WHERE id = $1", [p.id]);

    for (const r of reviews ?? []) {
      await client.query(
        `INSERT INTO reviews (id, product_id, author, rating, title, body, size_bought, colour_bought, verified, helpful, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE
           SET product_id = EXCLUDED.product_id, author = EXCLUDED.author, rating = EXCLUDED.rating, title = EXCLUDED.title,
               body = EXCLUDED.body, size_bought = EXCLUDED.size_bought, colour_bought = EXCLUDED.colour_bought,
               verified = EXCLUDED.verified, helpful = EXCLUDED.helpful, created_at = EXCLUDED.created_at`,
        [r.id, p.id, r.author || "Vendora customer", Math.min(5, Math.max(1, Math.round(r.rating))), r.title ?? "", r.body ?? "", r.sizeBought ?? null, r.colourBought ?? null, !!r.verified, r.helpful ?? 0, r.date],
      );
      reviewCount++;
    }
  }
  await client.query("COMMIT");
  console.log(`✓ Seeded ${products.length} products and ${reviewCount} reviews from ${path.relative(process.cwd(), file)}.`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  const e = err as Error & { code?: string };
  console.error(`✗ Seeding failed, nothing was changed: ${e.message}${e.code === "42P01" ? " — run `npm run db:migrate` first." : ""}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
