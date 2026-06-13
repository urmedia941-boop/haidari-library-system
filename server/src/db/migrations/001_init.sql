-- Haidari Library — initial schema
-- Unified library + cafeteria management with central accounting.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users & auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'cashier'
                CHECK (role IN ('admin', 'manager', 'cashier')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'book' CHECK (kind IN ('book', 'cafeteria')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS authors (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS translators (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Products (books + cafeteria share one table, discriminated by `type`)
--   acquisition  : how the item entered stock
--   intended_use : whether it is meant to be sold or given as a gift
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('book', 'cafeteria')),
  name          TEXT NOT NULL,
  barcode       TEXT UNIQUE,
  sku           TEXT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cost_price    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sale_price    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  acquisition   TEXT NOT NULL DEFAULT 'purchased'
                CHECK (acquisition IN ('purchased', 'free')),
  intended_use  TEXT NOT NULL DEFAULT 'sale'
                CHECK (intended_use IN ('sale', 'gift')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Book-specific attributes
CREATE TABLE IF NOT EXISTS book_details (
  product_id      INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  author_id       INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  translator_id   INTEGER REFERENCES translators(id) ON DELETE SET NULL,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  isbn            TEXT,
  edition         TEXT,
  publisher_place TEXT
);

-- ---------------------------------------------------------------------------
-- Discounts & promotions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discounts (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT 'global'
                CHECK (scope IN ('global', 'product', 'category', 'loyalty')),
  product_id    INTEGER REFERENCES products(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  value         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  start_date    DATE,
  end_date      DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sales (POS + website) and their line items
--   channel : store | website
--   section : library | cafeteria | mixed  (derived from items)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id             SERIAL PRIMARY KEY,
  invoice_no     TEXT NOT NULL UNIQUE,
  channel        TEXT NOT NULL DEFAULT 'store'
                 CHECK (channel IN ('store', 'website')),
  section        TEXT NOT NULL DEFAULT 'mixed'
                 CHECK (section IN ('library', 'cafeteria', 'mixed')),
  cashier_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name  TEXT,
  subtotal       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_total     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);
CREATE INDEX IF NOT EXISTS idx_sales_section ON sales(section);

CREATE TABLE IF NOT EXISTS sale_items (
  id               SERIAL PRIMARY KEY,
  sale_id          INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name     TEXT NOT NULL,
  product_type     TEXT NOT NULL DEFAULT 'book',
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT 'sale'
                   CHECK (transaction_type IN ('sale', 'gift'))
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ---------------------------------------------------------------------------
-- Inventory movements (audit trail of every stock change)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL
                CHECK (movement_type IN
                  ('purchase', 'free_in', 'sale', 'gift_out', 'adjustment')),
  quantity      INTEGER NOT NULL,         -- signed: +in / -out
  unit_cost     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reference     TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);

-- ---------------------------------------------------------------------------
-- Purchases (stock-in from suppliers) and their items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id          SERIAL PRIMARY KEY,
  reference   TEXT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  section     TEXT NOT NULL DEFAULT 'library'
              CHECK (section IN ('library', 'cafeteria', 'general')),
  total_cost  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'unpaid'
              CHECK (status IN ('unpaid', 'partial', 'paid')),
  note        TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_cost   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  acquisition TEXT NOT NULL DEFAULT 'purchased'
              CHECK (acquisition IN ('purchased', 'free'))
);

-- ---------------------------------------------------------------------------
-- Expenses (general operating costs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  section     TEXT NOT NULL DEFAULT 'general'
              CHECK (section IN ('library', 'cafeteria', 'general')),
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  spent_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_at ON expenses(spent_at);

-- ---------------------------------------------------------------------------
-- Supplier payments (settling payables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_payments (
  id          SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note        TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
