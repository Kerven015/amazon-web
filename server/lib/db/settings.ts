/**
 * Shop settings the admin can change (shop_settings, 005_admin_tools.sql).
 * Each setting has a default here, so a missing row never breaks anything.
 */
import { type Db, query } from "../../db/pool";

export type ShopSettings = { lowStockThreshold: number };

const DEFAULTS: ShopSettings = { lowStockThreshold: 3 };
const KEYS: Record<keyof ShopSettings, string> = { lowStockThreshold: "low_stock_threshold" };

export async function getSettings(db: Db = { query }): Promise<ShopSettings> {
  const { rows } = await db.query<{ key: string; value: unknown }>("SELECT key, value FROM shop_settings");
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const n = Number(byKey.get(KEYS.lowStockThreshold));
  return { lowStockThreshold: Number.isInteger(n) && n >= 0 ? n : DEFAULTS.lowStockThreshold };
}

/** Saves the given settings; returns all settings afterwards. */
export async function saveSettings(next: Partial<ShopSettings>, db: Db = { query }): Promise<ShopSettings> {
  for (const [name, value] of Object.entries(next) as [keyof ShopSettings, unknown][]) {
    await db.query(
      `INSERT INTO shop_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [KEYS[name], JSON.stringify(value)],
    );
  }
  return getSettings(db);
}
