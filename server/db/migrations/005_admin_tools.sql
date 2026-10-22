-- Admin tools: activity log, stock history, shipment tracking, review moderation and shop settings.
-- Only adds tables/columns (nothing existing is rewritten or dropped).

/* --------------------------------------------------------------------------
   Activity log: who did what in the admin, and when. Append-only for the app.
-------------------------------------------------------------------------- */
CREATE TABLE admin_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,
  -- e.g. "product.update", "order.status", "stock.adjust", "review.hide"
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  -- Small summary of the change (never passwords, tokens or full customer data)
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text
);
CREATE INDEX admin_audit_log_at_idx ON admin_audit_log (at DESC);
CREATE INDEX admin_audit_log_entity_idx ON admin_audit_log (entity_type, entity_id, at DESC);

-- The running site may add entries but never edit or remove them
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vendora_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON admin_audit_log FROM vendora_app;
  END IF;
END $$;

/* --------------------------------------------------------------------------
   Stock history: every change to product_stock, with the reason.
   change = units added (+) or taken (−); quantity_after = the cell afterwards.
-------------------------------------------------------------------------- */
CREATE TABLE stock_movements (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key: the history outlives deleted products
  product_id     text NOT NULL,
  size           text NOT NULL,
  colour         text NOT NULL,
  change         integer NOT NULL CHECK (change <> 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason         text NOT NULL CHECK (reason IN ('sale', 'cancelled', 'product_edit', 'received', 'returned', 'damaged', 'lost', 'correction')),
  order_id       text,
  note           text NOT NULL DEFAULT '',
  actor          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX stock_movements_created_idx ON stock_movements (created_at DESC);

/* --------------------------------------------------------------------------
   Orders: shipment tracking + the product SKU at the time of ordering
-------------------------------------------------------------------------- */
ALTER TABLE orders ADD COLUMN carrier text;
ALTER TABLE orders ADD COLUMN tracking_number text;
ALTER TABLE order_items ADD COLUMN sku text;
-- Fill the SKU for existing order lines from products that still exist
UPDATE order_items i SET sku = p.sku FROM products p WHERE p.id = i.product_id AND i.sku IS NULL AND p.sku IS NOT NULL;

/* --------------------------------------------------------------------------
   Reviews: hidden by the admin → not shown in the shop or counted in the rating
-------------------------------------------------------------------------- */
ALTER TABLE reviews ADD COLUMN hidden_at timestamptz;
CREATE INDEX reviews_created_idx ON reviews (created_at DESC);

/* --------------------------------------------------------------------------
   Shop settings edited in the admin (key → JSON value)
-------------------------------------------------------------------------- */
CREATE TABLE shop_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO shop_settings (key, value) VALUES ('low_stock_threshold', '3') ON CONFLICT DO NOTHING;
