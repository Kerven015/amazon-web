-- Vendora — first schema.
-- Run by `npm run db:migrate` as vendora_owner (MIGRATION_DATABASE_URL), inside one transaction.
-- The site itself connects as vendora_app, which can only SELECT / INSERT / UPDATE / DELETE.

CREATE EXTENSION IF NOT EXISTS citext;

/* --------------------------------------------------------------------------
   Shared trigger: keep updated_at current on every UPDATE
-------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/* --------------------------------------------------------------------------
   Products
   `data` holds the rest of the ProductRecord exactly as the admin edits it
   (texts in 4 languages, sizes, colours, images, care…). price, stock,
   product_type and created_at are copied into real columns for filtering and
   sorting. Stock per size/colour lives in product_stock (the source of truth),
   and reviews in reviews.
   deleted_at: "Delete" in the admin sets it; "Undo" within 10 minutes clears it.
   Rows deleted longer ago are purged for good.
-------------------------------------------------------------------------- */
CREATE TABLE products (
  id           text PRIMARY KEY,
  slug         text NOT NULL,
  sku          text,
  hidden       boolean NOT NULL DEFAULT false,
  product_type text NOT NULL,
  price        numeric(10,2) NOT NULL CHECK (price >= 0),
  stock        integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  data         jsonb NOT NULL,
  -- Keeps the catalogue in the order it was created / seeded
  position     bigint GENERATED ALWAYS AS IDENTITY,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Slug and SKU must be unique among live products (a product waiting in the
-- undo window doesn't block its slug forever).
CREATE UNIQUE INDEX products_slug_key ON products (slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX products_sku_key ON products (lower(sku)) WHERE deleted_at IS NULL AND sku IS NOT NULL;
CREATE INDEX products_live_idx ON products (position) WHERE deleted_at IS NULL;
CREATE INDEX products_type_idx ON products (product_type) WHERE deleted_at IS NULL;
CREATE INDEX products_deleted_idx ON products (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- colour = the colour name, or 'default' for products without colours (same keys as sizes[].stock)
CREATE TABLE product_stock (
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size       text NOT NULL,
  colour     text NOT NULL,
  quantity   integer NOT NULL CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, size, colour)
);
CREATE TRIGGER product_stock_updated_at BEFORE UPDATE ON product_stock FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* --------------------------------------------------------------------------
   Customers (separate from the admin login in .env.local)
-------------------------------------------------------------------------- */
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL,
  password_hash     text NOT NULL,
  name              text NOT NULL,
  locale            text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr', 'tk', 'ru')),
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- id = SHA-256 (hex) of the random token in the cookie; the token itself is never stored.
CREATE TABLE sessions (
  id           text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- "Keep me signed in": 30-day cookie; otherwise a browser-session cookie with a 1-day server expiry
  remember     boolean NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent   text,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT '',
  full_name   text NOT NULL,
  line1       text NOT NULL,
  line2       text,
  city        text NOT NULL,
  region      text NOT NULL,
  postal_code text NOT NULL,
  country     char(2) NOT NULL,
  phone       text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses (user_id, created_at);
-- At most one default address per customer
CREATE UNIQUE INDEX addresses_one_default ON addresses (user_id) WHERE is_default;
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* --------------------------------------------------------------------------
   Orders — every order belongs to a signed-in customer (no guest orders)
-------------------------------------------------------------------------- */
CREATE TABLE orders (
  id                 text PRIMARY KEY CHECK (id ~ '^VD-[0-9]{6}$'),
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  email              citext NOT NULL,
  status             text NOT NULL DEFAULT 'placed'
                     CHECK (status IN ('placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  delivery_option    text NOT NULL CHECK (delivery_option IN ('fast', 'standard', 'eco')),
  -- Display-only: "card:Card:4242" or "wallet". No card data is ever sent to the server.
  payment_method     text NOT NULL,
  -- Copy of the address at the time of ordering (editing the address book later doesn't change it)
  address            jsonb NOT NULL,
  subtotal           numeric(10,2) NOT NULL CHECK (subtotal >= 0),
  discount           numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping           numeric(10,2) NOT NULL CHECK (shipping >= 0),
  tax                numeric(10,2) NOT NULL CHECK (tax >= 0),
  total              numeric(10,2) NOT NULL CHECK (total >= 0),
  discount_code      text,
  estimated_delivery timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_created_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- product_id has no foreign key on purpose: orders must outlive deleted products.
CREATE TABLE order_items (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   text NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id text NOT NULL,
  title      text NOT NULL,
  image      text NOT NULL DEFAULT '',
  size       text NOT NULL DEFAULT '',
  colour     text NOT NULL DEFAULT '',
  quantity   integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  list_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);
CREATE TRIGGER order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The tracking timeline: one row per status change
CREATE TABLE order_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   text NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  at         timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events (order_id, at);
CREATE TRIGGER order_events_updated_at BEFORE UPDATE ON order_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* --------------------------------------------------------------------------
   Reviews, wishlist, bag
-------------------------------------------------------------------------- */
CREATE TABLE reviews (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id    text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  -- NULL for the imported catalogue reviews
  user_id       uuid REFERENCES users (id) ON DELETE SET NULL,
  author        text NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         text NOT NULL DEFAULT '',
  body          text NOT NULL DEFAULT '',
  size_bought   text,
  colour_bought text,
  verified      boolean NOT NULL DEFAULT false,
  helpful       integer NOT NULL DEFAULT 0 CHECK (helpful >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON reviews (product_id, created_at DESC);
-- One review per customer per product
CREATE UNIQUE INDEX reviews_one_per_user ON reviews (product_id, user_id) WHERE user_id IS NOT NULL;
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wishlist_items (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE TRIGGER wishlist_items_updated_at BEFORE UPDATE ON wishlist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- size / colour are '' when the product has no choice to make
CREATE TABLE cart_items (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size       text NOT NULL DEFAULT '',
  colour     text NOT NULL DEFAULT '',
  quantity   integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id, size, colour)
);
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* --------------------------------------------------------------------------
   Failed customer sign-ins (rate limit: 5 per IP + email in 15 minutes)
-------------------------------------------------------------------------- */
CREATE TABLE login_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         text NOT NULL,
  email      citext NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_lookup_idx ON login_attempts (ip, email, at);
CREATE INDEX login_attempts_at_idx ON login_attempts (at);
CREATE TRIGGER login_attempts_updated_at BEFORE UPDATE ON login_attempts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
